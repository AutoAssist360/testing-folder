import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listReservationsQuery } from "../vendor.schemas";
import { ownerWarehouse, paginate } from "../vendor.helpers";

export const vendorReservationsRouter = Router();
vendorReservationsRouter.use(userAuth, roleGuard("vendor"));

// ─── GET /vendor/warehouses/:warehouseId/reservations ────────
vendorReservationsRouter.get(
  "/warehouses/:warehouseId/reservations",
  asyncWrapper(async (req, res) => {
    const warehouse = await ownerWarehouse(
      req.params.warehouseId ,
      req.userId
    );

    const { page, limit, status } = listReservationsQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = {
      inventory: { warehouse_id: warehouse.warehouse_id },
    };
    if (status) where.status = status;

    const [reservations, total] = await Promise.all([
      prisma.inventoryReservation.findMany({
        where,
        skip,
        take,
        orderBy: { reserved_at: "desc" },
        include: {
          inventory: {
            select: {
              inventory_id: true,
              part: { select: { part_id: true, part_name: true } },
            },
          },
          order: { select: { order_id: true, order_number: true } },
        },
      }),
      prisma.inventoryReservation.count({ where }),
    ]);

    res.json({ reservations, total, page, limit });
  })
);

// ─── GET /vendor/reservations/:reservationId ─────────────────
vendorReservationsRouter.get(
  "/reservations/:reservationId",
  asyncWrapper(async (req, res) => {
    const reservation = await prisma.inventoryReservation.findUnique({
      where: { reservation_id: req.params.reservationId  },
      include: {
        inventory: {
          select: {
            inventory_id: true,
            warehouse_id: true,
            quantity_available: true,
            quantity_reserved: true,
            part: { select: { part_id: true, part_name: true } },
            warehouse: { select: { vendor_id: true, name: true } },
          },
        },
        order: {
          select: {
            order_id: true,
            order_number: true,
            order_status: true,
          },
        },
      },
    });

    if (
      !reservation ||
      reservation.inventory.warehouse.vendor_id !== req.userId
    )
      throw new AppError("Reservation not found", 404);

    res.json({ reservation });
  })
);
