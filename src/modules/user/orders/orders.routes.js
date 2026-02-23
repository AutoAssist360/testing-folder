import { Router } from "express";
import crypto from "crypto";
import { Decimal } from "../../../../generated/prisma/internal/prismaNamespace";
import { prisma } from "../../../lib/prisma";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { validate } from "../../../middleware/validate";
import {
  createOrderSchema,
  payOrderSchema,
  reservePartSchema,
} from "./orders.schemas";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const orderRouter = Router();

orderRouter.use(userAuth, roleGuard("user", "admin"));

// ─── Helper: generate human-readable order number ────────────
const generateOrderNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${ts}-${rand}`;
};

// ─── Tax rate (placeholder — externalise to config) ──────────
const TAX_RATE = 0.18; // 18% GST

// ═════════════════════════════════════════════════════════════
//  ORDER ROUTES
// ═════════════════════════════════════════════════════════════

// ─── GET /orders ─────────────────────────────────────────────
orderRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { status } = req.query;
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = { user_id: req.userId };

    if (status && typeof status === "string") {
      const statuses = status.split(",");
      where.order_status = { in: statuses };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          warehouse: {
            select: { warehouse_id: true, name: true, city: true },
          },
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
          fulfillments: {
            select: { fulfillment_id: true, status: true },
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, limit });
  })
);

// ─── GET /orders/:orderId ────────────────────────────────────
orderRouter.get(
  "/:orderId",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        warehouse: true,
        items: {
          include: {
            part: {
              select: {
                part_id: true,
                part_name: true,
                category: { select: { category_name: true } },
              },
            },
          },
        },
        fulfillments: { orderBy: { created_at: "desc" } },
        reservations: {
          select: {
            reservation_id: true,
            quantity: true,
            status: true,
            expires_at: true,
          },
        },
        request: {
          select: { request_id: true, issue_description: true, status: true },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Ownership validation
    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    res.json({ order });
  })
);

// ─── POST /orders ────────────────────────────────────────────
orderRouter.post(
  "/",
  validate(createOrderSchema),
  asyncWrapper(async (req, res) => {
    const { warehouse_id, request_id, items, notes } = req.body;

    // 1. Validate warehouse exists and is active
    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id },
    });

    if (!warehouse || !warehouse.is_active) {
      throw new AppError("Warehouse not found or inactive", 404);
    }

    // 2. If linked to a service request, validate ownership
    if (request_id) {
      const serviceRequest = await prisma.serviceRequest.findUnique({
        where: { request_id },
      });

      if (!serviceRequest) {
        throw new AppError("Service request not found", 404);
      }

      if (serviceRequest.user_id !== req.userId) {
        throw new AppError(
          "This service request does not belong to you",
          403
        );
      }
    }

    // 3. Transaction: validate stock + create order + reserve inventory
    //    Stock check is INSIDE the transaction to prevent race conditions
    const order = await prisma.$transaction(async (tx) => {
      // Validate all parts exist in warehouse inventory with sufficient stock
      const partIds = items.map((i) => i.part_id);
      const inventories = await tx.inventory.findMany({
        where: {
          warehouse_id,
          part_id: { in: partIds },
        },
        include: {
          part: { select: { part_id: true, part_name: true } },
        },
      });

      const inventoryMap = new Map(
        inventories.map((inv) => [inv.part_id, inv])
      );

      let subtotal = new Decimal(0);
      const orderItemsData




 = [];

      for (const item of items) {
        const inv = inventoryMap.get(item.part_id);

        if (!inv) {
          throw new AppError(
            `Part ID ${item.part_id} is not available in this warehouse`,
            400
          );
        }

        const available = inv.quantity_available - inv.quantity_reserved;
        if (available < item.quantity) {
          throw new AppError(
            `Insufficient stock for '${inv.part.part_name}'. Available: ${available}, Requested: ${item.quantity}`,
            400
          );
        }

        const unit_price = inv.unit_cost;
        const total_price = unit_price.mul(item.quantity);

        orderItemsData.push({
          part_id: item.part_id,
          quantity: item.quantity,
          unit_price,
          total_price,
        });

        subtotal = subtotal.add(total_price);
      }

      const tax = subtotal.mul(TAX_RATE).toDecimalPlaces(2);
      const total = subtotal.add(tax);
      const order_number = generateOrderNumber();

      const newOrder = await tx.order.create({
        data: {
          order_number,
          user_id: req.userId,
          warehouse_id,
          request_id: request_id || null,
          subtotal,
          tax,
          total,
          notes: notes || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
        },
      });

      // Reserve inventory for each item using atomic conditional update
      for (const item of orderItemsData) {
        const reserved = await tx.inventory.updateMany({
          where: {
            warehouse_id,
            part_id: item.part_id,
            quantity_available: { gte: item.quantity },
            quantity_reserved: { lte: Number.MAX_SAFE_INTEGER - item.quantity },
          },
          data: {
            quantity_reserved: { increment: item.quantity },
          },
        });

        if (reserved.count !== 1) {
          throw new AppError(
            `Insufficient stock while reserving part ID ${item.part_id}`,
            409
          );
        }

        const updatedInv = await tx.inventory.findUnique({
          where: {
            warehouse_id_part_id: {
              warehouse_id,
              part_id: item.part_id,
            },
          },
          select: { quantity_available: true, quantity_reserved: true },
        });

        if (
          !updatedInv ||
          updatedInv.quantity_reserved > updatedInv.quantity_available
        ) {
          throw new AppError(
            `Insufficient stock while reserving part ID ${item.part_id}`,
            409
          );
        }
      }

      return newOrder;
    });

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  })
);

// ─── POST /orders/:orderId/pay ───────────────────────────────
// NOTE: This is for ORDER payments only, separate from service invoice payments.
orderRouter.post(
  "/:orderId/pay",
  validate(payOrderSchema),
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;
    const { payment_method, transaction_id } = req.body;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Ownership validation
    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    if (order.payment_status === "completed") {
      throw new AppError("Order has already been paid", 400);
    }

    if (order.order_status === "cancelled") {
      throw new AppError("Cannot pay for a cancelled order", 400);
    }

    // Check duplicate transaction_id across both orders and invoices
    if (transaction_id) {
      const [existingOrder, existingInvoice] = await Promise.all([
        prisma.order.findFirst({ where: { transaction_id } }),
        prisma.invoice.findFirst({ where: { transaction_id } }),
      ]);

      if (existingOrder || existingInvoice) {
        throw new AppError("Transaction ID already used", 409);
      }
    }

    const nextOrderStatus =
      order.order_status === "pending" ? "confirmed" : order.order_status;

    const updatedOrder = await prisma.order.update({
      where: { order_id: orderId },
      data: {
        payment_status: "completed",
        payment_method,
        transaction_id,
        order_status: nextOrderStatus,
      },
      include: {
        items: {
          include: {
            part: { select: { part_id: true, part_name: true } },
          },
        },
      },
    });

    res.json({
      message: "Order payment successful",
      order: updatedOrder,
    });
  })
);

// ─── GET /orders/:orderId/fulfillment ────────────────────────
orderRouter.get(
  "/:orderId/fulfillment",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      select: { order_id: true, user_id: true, order_status: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Ownership validation
    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    const fulfillments = await prisma.fulfillment.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: "desc" },
    });

    res.json({
      order_id: orderId,
      order_status: order.order_status,
      fulfillments,
    });
  })
);

// ═════════════════════════════════════════════════════════════
//  PART RESERVATION ROUTE
// ═════════════════════════════════════════════════════════════

// ─── POST /orders/reserve-parts ──────────────────────────────
orderRouter.post(
  "/reserve-parts",
  validate(reservePartSchema),
  asyncWrapper(async (req, res) => {
    const { inventory_id, quantity, request_id, ttl_minutes } = req.body;

    // 1. Validate inventory exists
    const inventory = await prisma.inventory.findUnique({
      where: { inventory_id },
      include: {
        part: { select: { part_name: true } },
        warehouse: { select: { name: true, is_active: true } },
      },
    });

    if (!inventory) {
      throw new AppError("Inventory record not found", 404);
    }

    if (!inventory.warehouse.is_active) {
      throw new AppError("Warehouse is inactive", 400);
    }

    // 2. If linked to a service request, validate ownership
    if (request_id) {
      const serviceRequest = await prisma.serviceRequest.findUnique({
        where: { request_id },
      });

      if (!serviceRequest) {
        throw new AppError("Service request not found", 404);
      }

      if (serviceRequest.user_id !== req.userId) {
        throw new AppError(
          "This service request does not belong to you",
          403
        );
      }
    }

    // 3. Calculate TTL expiry
    const expires_at = new Date(Date.now() + ttl_minutes * 60 * 1000);

    // 4. Transaction: check stock + create reservation + update reserved count
    //    Stock check is INSIDE the transaction to prevent race conditions
    const reservation = await prisma.$transaction(async (tx) => {
      // Re-read inventory inside transaction for accurate stock
      const freshInv = await tx.inventory.findUnique({
        where: { inventory_id },
      });

      if (!freshInv) {
        throw new AppError("Inventory record not found", 404);
      }

      const available = freshInv.quantity_available - freshInv.quantity_reserved;
      if (available < quantity) {
        throw new AppError(
          `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${quantity}`,
          400
        );
      }

      const newReservation = await tx.inventoryReservation.create({
        data: {
          inventory_id,
          quantity,
          request_id: request_id || null,
          expires_at,
        },
      });

      const reserved = await tx.inventory.updateMany({
        where: {
          inventory_id,
          quantity_available: { gte: quantity },
          quantity_reserved: { lte: Number.MAX_SAFE_INTEGER - quantity },
        },
        data: {
          quantity_reserved: { increment: quantity },
        },
      });

      if (reserved.count !== 1) {
        throw new AppError(
          `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${quantity}`,
          409
        );
      }

      const updatedInv = await tx.inventory.findUnique({
        where: { inventory_id },
        select: { quantity_available: true, quantity_reserved: true },
      });

      if (
        !updatedInv ||
        updatedInv.quantity_reserved > updatedInv.quantity_available
      ) {
        throw new AppError(
          `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${quantity}`,
          409
        );
      }

      return newReservation;
    });

    // TODO: Schedule a background job (e.g. BullMQ / node-cron) to
    //       expire this reservation at `expires_at` and decrement
    //       quantity_reserved if still active.

    res.status(201).json({
      message: "Inventory reserved successfully",
      reservation: {
        ...reservation,
        part_name: inventory.part.part_name,
        warehouse_name: inventory.warehouse.name,
      },
    });
  })
);
