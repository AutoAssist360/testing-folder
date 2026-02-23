import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { updateFulfillmentStatusSchema } from "../vendor.schemas";
import { assertFulfillmentTransition } from "../vendor.helpers";

export const vendorFulfillmentRouter = Router();
vendorFulfillmentRouter.use(userAuth, roleGuard("vendor"));

// ─── GET /vendor/orders/:orderId/fulfillment ─────────────────
vendorFulfillmentRouter.get(
  "/orders/:orderId/fulfillment",
  asyncWrapper(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { order_id: req.params.orderId  },
      include: { warehouse: { select: { vendor_id: true } } },
    });

    if (!order || order.warehouse.vendor_id !== req.userId)
      throw new AppError("Order not found", 404);

    const fulfillments = await prisma.fulfillment.findMany({
      where: { order_id: order.order_id },
      orderBy: { created_at: "desc" },
    });

    res.json({ fulfillments });
  })
);

// ─── PATCH /vendor/fulfillment/:fulfillmentId/status ─────────
vendorFulfillmentRouter.patch(
  "/fulfillment/:fulfillmentId/status",
  validate(updateFulfillmentStatusSchema),
  asyncWrapper(async (req, res) => {
    const fulfillment = await prisma.fulfillment.findUnique({
      where: { fulfillment_id: req.params.fulfillmentId  },
      include: {
        order: {
          include: { warehouse: { select: { vendor_id: true } } },
        },
      },
    });

    if (!fulfillment || fulfillment.order.warehouse.vendor_id !== req.userId)
      throw new AppError("Fulfillment not found", 404);

    const { status, tracking_number, carrier, estimated_delivery, notes } =
      req.body;

    assertFulfillmentTransition(fulfillment.status, status);

    // Validate that the order is in a valid state for fulfillment updates
    const validOrderStatesForShipping = ["confirmed", "processing", "shipped"];
    if (
      status === "shipped" &&
      !validOrderStatesForShipping.includes(fulfillment.order.order_status)
    ) {
      throw new AppError(
        `Cannot ship fulfillment: order is in '${fulfillment.order.order_status}' state. Order must be at least 'confirmed'.`,
        400
      );
    }

    const now = new Date();
    const data = { status };

    if (tracking_number !== undefined) data.tracking_number = tracking_number;
    if (carrier !== undefined) data.carrier = carrier;
    if (estimated_delivery !== undefined)
      data.estimated_delivery = new Date(estimated_delivery);
    if (notes !== undefined) data.notes = notes;

    // Auto-set timestamps based on status
    if (status === "shipped") data.shipped_at = now;
    if (status === "delivered") data.delivered_at = now;

    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.fulfillment.update({
        where: { fulfillment_id: fulfillment.fulfillment_id },
        data,
      });

      // If delivered, update order status to delivered
      if (status === "delivered") {
        // Check if ALL fulfillments for this order are delivered
        const pending = await tx.fulfillment.count({
          where: {
            order_id: fulfillment.order_id,
            status: { not: "delivered" },
            fulfillment_id: { not: fulfillment.fulfillment_id },
          },
        });

        if (pending === 0) {
          await tx.order.update({
            where: { order_id: fulfillment.order_id },
            data: { order_status: "delivered" },
          });
        }
      }

      // If shipped, ensure order is at least "shipped"
      if (status === "shipped") {
        const order = await tx.order.findUnique({
          where: { order_id: fulfillment.order_id },
          select: { order_status: true },
        });
        if (
          order &&
          !["shipped", "delivered"].includes(order.order_status)
        ) {
          await tx.order.update({
            where: { order_id: fulfillment.order_id },
            data: { order_status: "shipped" },
          });
        }
      }

      return f;
    });

    res.json({ message: "Fulfillment status updated", fulfillment: updated });
  })
);
