import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listAuditLogsQuery } from "../admin.schemas";
import { dateFilter, paginate } from "../admin.helpers";

export const adminAuditLogsRouter = Router();

adminAuditLogsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/audit-logs ───────────────────────────────────
adminAuditLogsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listAuditLogsQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.entity_type) where.entity_type = q.entity_type;
    if (q.action) where.action = { contains: q.action, mode: "insensitive" };
    if (q.performed_by) where.performed_by = q.performed_by;
    if (q.from || q.to) where.created_at = dateFilter(q.from, q.to);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { full_name: true, email: true, role: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);
