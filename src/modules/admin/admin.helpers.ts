import { prisma } from "../../lib/prisma";

/**
 * Write an entry to the audit_logs table.
 * Accepts an optional transaction client (`tx`) so the audit log
 * can be written atomically inside a $transaction.
 */
export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  oldValue?: any;
  newValue?: any;
  tx?: { auditLog: typeof prisma.auditLog };
}) {
  const client = params.tx ?? prisma;
  await client.auditLog.create({
    data: {
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      performed_by: params.performedBy,
      old_value: params.oldValue ?? undefined,
      new_value: params.newValue ?? undefined,
    },
  });
}

/**
 * Build Prisma-compatible date range filter.
 */
export function dateFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return filter;
}

/**
 * Calculate skip from page + limit.
 */
export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}
