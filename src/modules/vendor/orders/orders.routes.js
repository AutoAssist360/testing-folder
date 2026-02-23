import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { listOrdersQuery, returnOrderSchema } from "../vendor.schemas";
import {
  paginate,
  dateFilter,
  assertOrderTransition,

} from "../vendor.helpers";

export const vendorOrdersRouter = Router();
vendorOrdersRouter.use(userAuth, roleGuard("vendor"));

// ─── Helper: find order owned by vendor ──────────────────────
async function findVendorOrder(orderId, vendorId) {
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    include: { warehouse: { select: { vendor_id: true } } },
  });

  if (!order || order.warehouse.vendor_id !== vendorId)
    throw new AppError("Order not found", 404);

  return order;
}

// ─── GET /vendor/orders ──────────────────────────────────────
vendorOrdersRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit, order_status, payment_status, from, to } =
      listOrdersQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    // Get all warehouse IDs owned by vendor
    const warehouseIds = (
      await prisma.warehouse.findMany({
        where: { vendor_id: req.userId },
        select: { warehouse_id: true },
      })
    ).map((w) => w.warehouse_id);

    if (warehouseIds.length === 0) {
      return res.json({ orders: [], total: 0, page, limit });
    }

    const where = { warehouse_id: { in: warehouseIds } };
    if (order_status) where.order_status = order_status;
    if (payment_status) where.payment_status = payment_status;
    const created = dateFilter(from, to);
    if (created) where.created_at = created;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: "desc" },
        include: {
          user: { select: { user_id: true, full_name: true, email: true } },
          warehouse: { select: { warehouse_id: true, name: true } },
          _count: { select: { items: true, fulfillments: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, limit });
  })
);

// ─── GET /vendor/orders/:orderId ─────────────────────────────
vendorOrdersRouter.get(
  "/:orderId",
  asyncWrapper(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { order_id: req.params.orderId  },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        warehouse: { select: { warehouse_id: true, name: true, city: true } },
        items: {
          include: {
            part: { select: { part_id: true, part_name: true } },
          },
        },
        fulfillments: { orderBy: { created_at: "desc" } },
        reservations: {
          include: {
            inventory: {
              select: {
                part: { select: { part_id: true, part_name: true } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new AppError("Order not found", 404);

    // Verify ownership
    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: order.warehouse_id },
      select: { vendor_id: true },
    });
    if (!warehouse || warehouse.vendor_id !== req.userId)
      throw new AppError("Order not found", 404);

    res.json({ order });
  })
);

// ─── PATCH /vendor/orders/:orderId/confirm ───────────────────
vendorOrdersRouter.patch(
  "/:orderId/confirm",
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    assertOrderTransition(order.order_status, "confirmed");

    const updated = await prisma.order.update({
      where: { order_id: order.order_id },
      data: { order_status: "confirmed" },
    });

    res.json({ message: "Order confirmed", order: updated });
  })
);

// ─── PATCH /vendor/orders/:orderId/cancel ────────────────────
vendorOrdersRouter.patch(
  "/:orderId/cancel",
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    assertOrderTransition(order.order_status, "cancelled");

    // Transaction: cancel order + release reservations + restore inventory
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { order_id: order.order_id },
        data: { order_status: "cancelled" },
      });

      // Find active reservations for this order
      const reservations = await tx.inventoryReservation.findMany({
        where: { order_id: order.order_id, status: "active" },
      });

      for (const r of reservations) {
        // Release reserved quantity back to available
        await tx.inventory.update({
          where: { inventory_id: r.inventory_id },
          data: {
            quantity_available: { increment: r.quantity },
            quantity_reserved: { decrement: r.quantity },
          },
        });

        await tx.inventoryReservation.update({
          where: { reservation_id: r.reservation_id },
          data: { status: "cancelled" },
        });
      }
    });

    res.json({ message: "Order cancelled, inventory reservations released" });
  })
);

// ─── POST /vendor/orders/:orderId/return ─────────────────────
vendorOrdersRouter.post(
  "/:orderId/return",
  validate(returnOrderSchema),
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    // Only delivered orders can be returned
    if (order.order_status !== "delivered") {
      throw new AppError("Only delivered orders can be returned", 400);
    }

    const { reason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Mark order as returned
      await tx.order.update({
        where: { order_id: order.order_id },
        data: {
          order_status: "returned",
          payment_status: "refunded",
          notes: `Return reason: ${reason}`,
        },
      });

      // Restore inventory from order items
      const items = await tx.orderItem.findMany({
        where: { order_id: order.order_id },
      });

      const missingInventory = [];
      for (const item of items) {
        // Find inventory in same warehouse for this part
        const inv = await tx.inventory.findUnique({
          where: {
            warehouse_id_part_id: {
              warehouse_id: order.warehouse_id,
              part_id: item.part_id,
            },
          },
        });

        if (inv) {
          await tx.inventory.update({
            where: { inventory_id: inv.inventory_id },
            data: { quantity_available: { increment: item.quantity } },
          });
        } else {
          missingInventory.push(item.part_id);
        }
      }

      // Cancel any remaining active reservations
      await tx.inventoryReservation.updateMany({
        where: { order_id: order.order_id, status: "active" },
        data: { status: "cancelled" },
      });

      return missingInventory;
    });

    const response = { message: "Order return processed, inventory restored" };
    if (result.length > 0) {
      response.warning = `Inventory records not found for part IDs: ${result.join(", ")}. Stock was not restored for these parts.`;
    }

    res.json(response);
  })
);
