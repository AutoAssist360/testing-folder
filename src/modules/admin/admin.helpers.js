 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import { prisma } from "../../lib/prisma";

/**
 * Write an entry to the audit_logs table.
 * Accepts an optional transaction client (`tx`) so the audit log
 * can be written atomically inside a $transaction.
 */
export async function logAudit(params







) {
  const client = _nullishCoalesce(params.tx, () => ( prisma));
  await client.auditLog.create({
    data: {
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      performed_by: params.performedBy,
      old_value: _nullishCoalesce(params.oldValue, () => ( undefined)),
      new_value: _nullishCoalesce(params.newValue, () => ( undefined)),
    },
  });
}

/**
 * Build Prisma-compatible date range filter.
 */
export function dateFilter(from, to) {
  if (!from && !to) return undefined;
  const filter = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return filter;
}

/**
 * Calculate skip from page + limit.
 */
export function paginate(page, limit) {
  return { skip: (page - 1) * limit, take: limit };
}
