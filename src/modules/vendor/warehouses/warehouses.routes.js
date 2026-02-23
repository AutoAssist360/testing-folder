import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  listWarehousesQuery,
} from "../vendor.schemas";
import { paginate } from "../vendor.helpers";

export const vendorWarehousesRouter = Router();
vendorWarehousesRouter.use(userAuth, roleGuard("vendor"));

// ─── POST /vendor/warehouses ─────────────────────────────────
vendorWarehousesRouter.post(
  "/",
  validate(createWarehouseSchema),
  asyncWrapper(async (req, res) => {
    const warehouse = await prisma.warehouse.create({
      data: { ...req.body, vendor_id: req.userId },
    });

    res.status(201).json({ message: "Warehouse created", warehouse });
  })
);

// ─── GET /vendor/warehouses ──────────────────────────────────
vendorWarehousesRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit, is_active } = listWarehousesQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = { vendor_id: req.userId };
    if (is_active !== undefined) where.is_active = is_active;

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({ where, skip, take, orderBy: { created_at: "desc" } }),
      prisma.warehouse.count({ where }),
    ]);

    res.json({ warehouses, total, page, limit });
  })
);

// ─── GET /vendor/warehouses/:warehouseId ─────────────────────
vendorWarehousesRouter.get(
  "/:warehouseId",
  asyncWrapper(async (req, res) => {
    const { warehouseId } = req.params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId  },
      include: {
        _count: { select: { inventories: true, orders: true } },
      },
    });

    if (!warehouse || warehouse.vendor_id !== req.userId)
      throw new AppError("Warehouse not found", 404);

    res.json({ warehouse });
  })
);

// ─── PUT /vendor/warehouses/:warehouseId ─────────────────────
vendorWarehousesRouter.put(
  "/:warehouseId",
  validate(updateWarehouseSchema),
  asyncWrapper(async (req, res) => {
    const { warehouseId } = req.params;

    const existing = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId  },
    });
    if (!existing || existing.vendor_id !== req.userId)
      throw new AppError("Warehouse not found", 404);

    const warehouse = await prisma.warehouse.update({
      where: { warehouse_id: warehouseId  },
      data: req.body,
    });

    res.json({ message: "Warehouse updated", warehouse });
  })
);

// ─── DELETE /vendor/warehouses/:warehouseId (soft-deactivate) ─
vendorWarehousesRouter.delete(
  "/:warehouseId",
  asyncWrapper(async (req, res) => {
    const { warehouseId } = req.params;

    const existing = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId  },
    });
    if (!existing || existing.vendor_id !== req.userId)
      throw new AppError("Warehouse not found", 404);

    await prisma.warehouse.update({
      where: { warehouse_id: warehouseId  },
      data: { is_active: false },
    });

    res.json({ message: "Warehouse deactivated" });
  })
);
