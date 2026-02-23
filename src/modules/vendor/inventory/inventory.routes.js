 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import {
  addInventorySchema,
  updateInventorySchema,
  bulkInventorySchema,
  listInventoryQuery,
} from "../vendor.schemas";
import { ownerWarehouse, paginate } from "../vendor.helpers";

export const vendorInventoryRouter = Router();
vendorInventoryRouter.use(userAuth, roleGuard("vendor"));

// ─── POST /vendor/warehouses/:warehouseId/inventory ──────────
vendorInventoryRouter.post(
  "/warehouses/:warehouseId/inventory",
  validate(addInventorySchema),
  asyncWrapper(async (req, res) => {
    const warehouse = await ownerWarehouse(
      req.params.warehouseId ,
      req.userId
    );

    const { part_id, quantity_available, unit_cost, reorder_level } = req.body;

    // Verify part exists
    const part = await prisma.carPart.findUnique({ where: { part_id } });
    if (!part) throw new AppError("Car part not found", 404);

    // Check duplicate
    const existing = await prisma.inventory.findUnique({
      where: {
        warehouse_id_part_id: {
          warehouse_id: warehouse.warehouse_id,
          part_id,
        },
      },
    });
    if (existing)
      throw new AppError(
        "Inventory for this part already exists in this warehouse. Use PUT to update.",
        409
      );

    const inventory = await prisma.inventory.create({
      data: {
        warehouse_id: warehouse.warehouse_id,
        part_id,
        quantity_available,
        unit_cost,
        reorder_level: _nullishCoalesce(reorder_level, () => ( 0)),
      },
      include: { part: { select: { part_id: true, part_name: true } } },
    });

    res.status(201).json({ message: "Inventory added", inventory });
  })
);

// ─── GET /vendor/warehouses/:warehouseId/inventory ───────────
vendorInventoryRouter.get(
  "/warehouses/:warehouseId/inventory",
  asyncWrapper(async (req, res) => {
    const warehouse = await ownerWarehouse(
      req.params.warehouseId ,
      req.userId
    );

    const { page, limit, low_stock } = listInventoryQuery.parse(req.query);

    const warehouseFilter = { warehouse_id: warehouse.warehouse_id };

    if (low_stock) {
      // Prisma doesn't support field-to-field comparisons, so for low_stock
      // we fetch ALL matching items (no skip/take) and paginate in-memory.
      const allItems = await prisma.inventory.findMany({
        where: { ...warehouseFilter, reorder_level: { gt: 0 } },
        orderBy: { updated_at: "desc" },
        include: {
          part: {
            select: { part_id: true, part_name: true, category_id: true },
          },
        },
      });

      const lowStockItems = allItems.filter(
        (i) => i.quantity_available <= i.reorder_level
      );

      const total = lowStockItems.length;
      const start = (page - 1) * limit;
      const paginated = lowStockItems.slice(start, start + limit);

      return res.json({
        inventory: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    const { skip, take } = paginate(page, limit);
    const where = warehouseFilter;

    const [inventories, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take,
        orderBy: { updated_at: "desc" },
        include: {
          part: {
            select: { part_id: true, part_name: true, category_id: true },
          },
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    res.json({
      inventory: inventories,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// ─── PUT /vendor/inventory/:inventoryId ──────────────────────
vendorInventoryRouter.put(
  "/inventory/:inventoryId",
  validate(updateInventorySchema),
  asyncWrapper(async (req, res) => {
    const inv = await prisma.inventory.findUnique({
      where: { inventory_id: req.params.inventoryId  },
      include: { warehouse: { select: { vendor_id: true } } },
    });

    if (!inv || inv.warehouse.vendor_id !== req.userId)
      throw new AppError("Inventory not found", 404);

    const { quantity_available, unit_cost, reorder_level } = req.body;

    // Prevent negative stock after reserved
    if (quantity_available !== undefined && quantity_available < inv.quantity_reserved) {
      throw new AppError(
        `Available stock cannot be less than reserved quantity (${inv.quantity_reserved})`,
        400
      );
    }

    const inventory = await prisma.inventory.update({
      where: { inventory_id: inv.inventory_id },
      data: {
        ...(quantity_available !== undefined && { quantity_available }),
        ...(unit_cost !== undefined && { unit_cost }),
        ...(reorder_level !== undefined && { reorder_level }),
      },
      include: { part: { select: { part_id: true, part_name: true } } },
    });

    res.json({ message: "Inventory updated", inventory });
  })
);

// ─── DELETE /vendor/inventory/:inventoryId ───────────────────
vendorInventoryRouter.delete(
  "/inventory/:inventoryId",
  asyncWrapper(async (req, res) => {
    const inv = await prisma.inventory.findUnique({
      where: { inventory_id: req.params.inventoryId  },
      include: { warehouse: { select: { vendor_id: true } } },
    });

    if (!inv || inv.warehouse.vendor_id !== req.userId)
      throw new AppError("Inventory not found", 404);

    if (inv.quantity_reserved > 0)
      throw new AppError(
        "Cannot delete inventory with active reservations",
        400
      );

    await prisma.inventory.delete({
      where: { inventory_id: inv.inventory_id },
    });

    res.json({ message: "Inventory deleted" });
  })
);

// ─── POST /vendor/warehouses/:warehouseId/inventory/bulk ─────
vendorInventoryRouter.post(
  "/warehouses/:warehouseId/inventory/bulk",
  validate(bulkInventorySchema),
  asyncWrapper(async (req, res) => {
    const warehouse = await ownerWarehouse(
      req.params.warehouseId ,
      req.userId
    );

    const { items } = req.body 






;

    // Verify all parts exist
    const partIds = items.map((i) => i.part_id);
    const parts = await prisma.carPart.findMany({
      where: { part_id: { in: partIds } },
      select: { part_id: true },
    });
    const foundIds = new Set(parts.map((p) => p.part_id));
    const missing = partIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0)
      throw new AppError(`Car parts not found: ${missing.join(", ")}`, 404);

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of items) {
        // Check if inventory already exists
        const existing = await tx.inventory.findUnique({
          where: {
            warehouse_id_part_id: {
              warehouse_id: warehouse.warehouse_id,
              part_id: item.part_id,
            },
          },
        });

        if (existing && item.quantity_available < existing.quantity_reserved) {
          throw new AppError(
            `Cannot set quantity_available (${item.quantity_available}) below quantity_reserved (${existing.quantity_reserved}) for part ${item.part_id}`,
            400
          );
        }

        const result = await tx.inventory.upsert({
          where: {
            warehouse_id_part_id: {
              warehouse_id: warehouse.warehouse_id,
              part_id: item.part_id,
            },
          },
          create: {
            warehouse_id: warehouse.warehouse_id,
            part_id: item.part_id,
            quantity_available: item.quantity_available,
            unit_cost: item.unit_cost,
            reorder_level: _nullishCoalesce(item.reorder_level, () => ( 0)),
          },
          update: {
            quantity_available: item.quantity_available,
            unit_cost: item.unit_cost,
            reorder_level: _nullishCoalesce(item.reorder_level, () => ( 0)),
          },
          include: { part: { select: { part_id: true, part_name: true } } },
        });
        results.push(result);
      }
      return results;
    });

    res.status(201).json({
      message: `${created.length} inventory items upserted`,
      inventory: created,
    });
  })
);
