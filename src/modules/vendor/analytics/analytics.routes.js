import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { analyticsQuery, lowStockQuery } from "../vendor.schemas";
import { dateFilter, ownerWarehouse, paginate } from "../vendor.helpers";
import { Decimal } from "../../../../generated/prisma/internal/prismaNamespace";

export const vendorAnalyticsRouter = Router();
vendorAnalyticsRouter.use(userAuth, roleGuard("vendor"));

// ─── Helper: get all warehouse IDs for vendor ────────────────
async function vendorWarehouseIds(vendorId) {
  const warehouses = await prisma.warehouse.findMany({
    where: { vendor_id: vendorId },
    select: { warehouse_id: true },
  });
  return warehouses.map((w) => w.warehouse_id);
}

// ─── GET /vendor/analytics/revenue ───────────────────────────
vendorAnalyticsRouter.get(
  "/revenue",
  asyncWrapper(async (req, res) => {
    const { from, to } = analyticsQuery.parse(req.query);
    const warehouseIds = await vendorWarehouseIds(req.userId);

    if (warehouseIds.length === 0) {
      return res.json({
        total_revenue: 0,
        total_orders: 0,
        avg_order_value: 0,
      });
    }

    const where = {
      warehouse_id: { in: warehouseIds },
      order_status: { not: "cancelled" },
    };
    const created = dateFilter(from, to);
    if (created) where.created_at = created;

    const orders = await prisma.order.findMany({
      where,
      select: { total: true },
    });

    const totalRevenue = orders.reduce(
      (sum, o) => sum.add(o.total),
      new Decimal(0)
    );

    const toMoney = (value) => Number(value.toFixed(2));

    res.json({
      total_revenue: toMoney(totalRevenue),
      total_orders: orders.length,
      avg_order_value:
        orders.length > 0
          ? toMoney(totalRevenue.div(orders.length))
          : 0,
    });
  })
);

// ─── GET /vendor/analytics/orders ────────────────────────────
vendorAnalyticsRouter.get(
  "/orders",
  asyncWrapper(async (req, res) => {
    const { from, to } = analyticsQuery.parse(req.query);
    const warehouseIds = await vendorWarehouseIds(req.userId);

    if (warehouseIds.length === 0) {
      return res.json({
        total: 0,
        by_status: {},
        by_payment: {},
      });
    }

    const baseWhere = { warehouse_id: { in: warehouseIds } };
    const created = dateFilter(from, to);
    if (created) baseWhere.created_at = created;

    const [total, byStatus, byPayment] = await Promise.all([
      prisma.order.count({ where: baseWhere }),

      prisma.order.groupBy({
        by: ["order_status"],
        where: baseWhere,
        _count: { order_id: true },
      }),

      prisma.order.groupBy({
        by: ["payment_status"],
        where: baseWhere,
        _count: { order_id: true },
      }),
    ]);

    res.json({
      total,
      by_status: Object.fromEntries(
        byStatus.map((g) => [g.order_status, g._count.order_id])
      ),
      by_payment: Object.fromEntries(
        byPayment.map((g) => [g.payment_status, g._count.order_id])
      ),
    });
  })
);

// ─── GET /vendor/analytics/inventory ─────────────────────────
vendorAnalyticsRouter.get(
  "/inventory",
  asyncWrapper(async (req, res) => {
    const warehouseIds = await vendorWarehouseIds(req.userId);

    if (warehouseIds.length === 0) {
      return res.json({
        total_items: 0,
        total_available: 0,
        total_reserved: 0,
        total_value: 0,
        low_stock_count: 0,
      });
    }

    const inventories = await prisma.inventory.findMany({
      where: { warehouse_id: { in: warehouseIds } },
      select: {
        quantity_available: true,
        quantity_reserved: true,
        unit_cost: true,
        reorder_level: true,
      },
    });

    let totalAvailable = 0;
    let totalReserved = 0;
    let totalValue = new Decimal(0);
    let lowStockCount = 0;

    for (const inv of inventories) {
      totalAvailable += inv.quantity_available;
      totalReserved += inv.quantity_reserved;
      totalValue = totalValue.add(
        new Decimal(inv.unit_cost).mul(inv.quantity_available)
      );
      if (inv.reorder_level > 0 && inv.quantity_available <= inv.reorder_level) {
        lowStockCount++;
      }
    }

    res.json({
      total_items: inventories.length,
      total_available: totalAvailable,
      total_reserved: totalReserved,
      total_value: Number(totalValue.toFixed(2)),
      low_stock_count: lowStockCount,
    });
  })
);

// ─── GET /vendor/warehouses/:warehouseId/low-stock ───────────
vendorAnalyticsRouter.get(
  "/warehouses/:warehouseId/low-stock",
  asyncWrapper(async (req, res) => {
    const warehouse = await ownerWarehouse(
      req.params.warehouseId ,
      req.userId
    );

    const { page, limit, threshold } = lowStockQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    // Fetch inventory items where quantity_available <= reorder_level (or custom threshold)
    const allInventory = await prisma.inventory.findMany({
      where: { warehouse_id: warehouse.warehouse_id },
      include: {
        part: {
          select: { part_id: true, part_name: true, category_id: true },
        },
      },
      orderBy: { quantity_available: "asc" },
    });

    const lowStock = allInventory.filter((inv) => {
      const level = threshold !== undefined ? threshold : inv.reorder_level;
      return level > 0 && inv.quantity_available <= level;
    });

    const paginated = lowStock.slice(skip, skip + take);

    res.json({
      low_stock: paginated,
      total: lowStock.length,
      page,
      limit,
    });
  })
);
