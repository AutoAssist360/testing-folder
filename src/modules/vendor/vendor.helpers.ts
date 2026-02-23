import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

/**
 * Verify a warehouse belongs to the requesting vendor.
 * Returns the warehouse if found; throws 404 otherwise.
 */
export async function ownerWarehouse(warehouseId: string, vendorId: string) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { warehouse_id: warehouseId },
  });

  if (!warehouse) throw new AppError("Warehouse not found", 404);
  if (warehouse.vendor_id !== vendorId)
    throw new AppError("Warehouse not found", 404);
  if (!warehouse.is_active)
    throw new AppError("Warehouse is inactive", 400);

  return warehouse;
}

/**
 * Build a Prisma-compatible date range filter.
 */
export function dateFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return filter;
}

/**
 * Calculate skip/take from page + limit.
 */
export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

// ─── Order status transition map ─────────────────────────────

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};

export function assertOrderTransition(current: string, next: string) {
  const allowed = ORDER_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppError(
      `Cannot transition order from '${current}' to '${next}'`,
      400
    );
  }
}

// ─── Fulfillment status transition map ───────────────────────

const FULFILLMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "failed"],
  processing: ["shipped", "failed"],
  shipped: ["in_transit", "delivered", "failed"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: [],
};

export function assertFulfillmentTransition(current: string, next: string) {
  const allowed = FULFILLMENT_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppError(
      `Cannot transition fulfillment from '${current}' to '${next}'`,
      400
    );
  }
}
