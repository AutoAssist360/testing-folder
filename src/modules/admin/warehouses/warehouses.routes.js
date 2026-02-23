import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listWarehousesQuery, paginationQuery } from "../admin.schemas";
import { paginate } from "../admin.helpers";

export const adminWarehousesRouter = Router();

adminWarehousesRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/warehouses ───────────────────────────────────
adminWarehousesRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listWarehousesQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.is_active !== undefined) where.is_active = q.is_active;
    if (q.city) where.city = { contains: q.city, mode: "insensitive" };
    if (q.state) where.state = { contains: q.state, mode: "insensitive" };

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take,
        include: {
          vendor: {
            select: { user_id: true, full_name: true, email: true },
          },
          _count: { select: { inventories: true, orders: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.warehouse.count({ where }),
    ]);

    res.json({
      warehouses,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/warehouses/:warehouseId ──────────────────────
adminWarehousesRouter.get(
  "/:warehouseId",
  asyncWrapper(async (req, res) => {
    const warehouseId = req.params.warehouseId ;

    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId },
      include: {
        vendor: {
          select: { user_id: true, full_name: true, email: true, is_active: true },
        },
        _count: { select: { inventories: true, orders: true } },
      },
    });

    if (!warehouse) throw new AppError("Warehouse not found", 404);

    res.json({ warehouse });
  })
);

// ─── GET /admin/warehouses/:warehouseId/inventory ────────────
adminWarehousesRouter.get(
  "/:warehouseId/inventory",
  asyncWrapper(async (req, res) => {
    const warehouseId = req.params.warehouseId ;
    const q = paginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId },
      select: { warehouse_id: true },
    });
    if (!warehouse) throw new AppError("Warehouse not found", 404);

    const where = { warehouse_id: warehouseId };

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take,
        include: {
          part: {
            select: { part_id: true, part_name: true, category: { select: { category_name: true } } },
          },
        },
        orderBy: { updated_at: "desc" },
      }),
      prisma.inventory.count({ where }),
    ]);

    res.json({
      inventory,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);
