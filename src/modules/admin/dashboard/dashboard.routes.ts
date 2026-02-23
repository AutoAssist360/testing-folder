import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";

export const adminDashboardRouter = Router();

adminDashboardRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/dashboard ────────────────────────────────────
adminDashboardRouter.get(
  "/",
  asyncWrapper(async (_req, res) => {
    const [
      totalUsers,
      activeUsers,
      totalTechnicians,
      verifiedTechnicians,
      onlineTechnicians,
      totalVendors,
      totalWarehouses,
      requestCounts,
      jobCounts,
      orderCounts,
      invoiceCounts,
      recentRequests,
    ] = await Promise.all([
      prisma.user.count({ where: { deleted_at: null } }),
      prisma.user.count({ where: { is_active: true, deleted_at: null } }),
      prisma.technicianProfile.count(),
      prisma.technicianProfile.count({ where: { is_verified: true } }),
      prisma.technicianProfile.count({ where: { is_online: true } }),
      prisma.user.count({ where: { role: "vendor", deleted_at: null } }),
      prisma.warehouse.count({ where: { is_active: true } }),
      prisma.serviceRequest.groupBy({
        by: ["status"],
        _count: { status: true },
        where: { deleted_at: null },
      }),
      prisma.job.groupBy({
        by: ["status"],
        _count: { status: true },
        where: { deleted_at: null },
      }),
      prisma.order.groupBy({
        by: ["order_status"],
        _count: { order_status: true },
      }),
      prisma.invoice.groupBy({
        by: ["payment_status"],
        _count: { payment_status: true },
        where: { deleted_at: null },
      }),
      prisma.serviceRequest.findMany({
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 5,
        select: {
          request_id: true,
          issue_type: true,
          status: true,
          created_at: true,
          user: { select: { full_name: true } },
        },
      }),
    ]);

    res.json({
      users: { total: totalUsers, active: activeUsers },
      technicians: {
        total: totalTechnicians,
        verified: verifiedTechnicians,
        online: onlineTechnicians,
      },
      vendors: { total: totalVendors },
      warehouses: { active: totalWarehouses },
      requests: Object.fromEntries(
        requestCounts.map((r) => [r.status, r._count.status])
      ),
      jobs: Object.fromEntries(
        jobCounts.map((j) => [j.status, j._count.status])
      ),
      orders: Object.fromEntries(
        orderCounts.map((o) => [o.order_status, o._count.order_status])
      ),
      invoices: Object.fromEntries(
        invoiceCounts.map((i) => [i.payment_status, i._count.payment_status])
      ),
      recentRequests,
    });
  })
);
