import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { analyticsQuery } from "../admin.schemas";
import { dateFilter } from "../admin.helpers";
import { Decimal } from "../../../../generated/prisma/internal/prismaNamespace";

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/analytics/revenue ────────────────────────────
adminAnalyticsRouter.get(
  "/revenue",
  asyncWrapper(async (req, res) => {
    const q = analyticsQuery.parse(req.query);

    const invoiceWhere: any = { deleted_at: null, payment_status: "completed" };
    const orderWhere: any = { payment_status: "completed" };

    if (q.from || q.to) {
      invoiceWhere.paid_at = dateFilter(q.from, q.to);
      orderWhere.created_at = dateFilter(q.from, q.to);
    }

    const [invoiceAgg, orderAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { total: true },
        _count: { invoice_id: true },
      }),
      prisma.order.aggregate({
        where: orderWhere,
        _sum: { total: true },
        _count: { order_id: true },
      }),
    ]);

    const serviceRevenue = new Decimal(invoiceAgg._sum.total ?? 0);
    const orderRevenue = new Decimal(orderAgg._sum.total ?? 0);
    const totalRevenue = serviceRevenue.add(orderRevenue);

    const toMoney = (value: Decimal) => Number(value.toFixed(2));

    res.json({
      serviceRevenue: toMoney(serviceRevenue),
      orderRevenue: toMoney(orderRevenue),
      totalRevenue: toMoney(totalRevenue),
      serviceInvoiceCount: invoiceAgg._count.invoice_id,
      orderCount: orderAgg._count.order_id,
    });
  })
);

// ─── GET /admin/analytics/matching ───────────────────────────
// Shows how effectively requests are being matched to technicians
adminAnalyticsRouter.get(
  "/matching",
  asyncWrapper(async (req, res) => {
    const q = analyticsQuery.parse(req.query);

    const where: any = { deleted_at: null };
    if (q.from || q.to) where.created_at = dateFilter(q.from, q.to);

    const [
      totalRequests,
      completedRequests,
      cancelledRequests,
      avgOffersPerRequest,
      requestsWithNoOffers,
    ] = await Promise.all([
      prisma.serviceRequest.count({ where }),
      prisma.serviceRequest.count({ where: { ...where, status: "completed" } }),
      prisma.serviceRequest.count({ where: { ...where, status: "cancelled" } }),
      prisma.technicianOffer.groupBy({
        by: ["request_id"],
        _count: { offer_id: true },
        ...((q.from || q.to)
          ? { where: { created_at: dateFilter(q.from, q.to) } }
          : {}),
      }),
      prisma.serviceRequest.count({
        where: {
          ...where,
          offers: { none: {} },
          status: { notIn: ["cancelled"] },
        },
      }),
    ]);

    const totalOfferGroups = avgOffersPerRequest.length;
    const totalOffers = avgOffersPerRequest.reduce(
      (sum, g) => sum + g._count.offer_id,
      0
    );
    const avgOffers = totalOfferGroups
      ? Math.round((totalOffers / totalOfferGroups) * 100) / 100
      : 0;

    const completionRate = totalRequests
      ? Math.round((completedRequests / totalRequests) * 10000) / 100
      : 0;
    const cancellationRate = totalRequests
      ? Math.round((cancelledRequests / totalRequests) * 10000) / 100
      : 0;

    res.json({
      totalRequests,
      completedRequests,
      cancelledRequests,
      completionRate,
      cancellationRate,
      avgOffersPerRequest: avgOffers,
      requestsWithNoOffers,
    });
  })
);

// ─── GET /admin/analytics/performance ────────────────────────
// Shows technician performance metrics
adminAnalyticsRouter.get(
  "/performance",
  asyncWrapper(async (req, res) => {
    const q = analyticsQuery.parse(req.query);

    const jobWhere: any = { deleted_at: null };
    if (q.from || q.to) jobWhere.started_at = dateFilter(q.from, q.to);

    const [totalJobs, completedJobs, topTechnicians, avgJobDuration] =
      await Promise.all([
        prisma.job.count({ where: jobWhere }),
        prisma.job.count({ where: { ...jobWhere, status: "completed" } }),
        prisma.job.groupBy({
          by: ["technician_id"],
          where: { ...jobWhere, status: "completed" },
          _count: { job_id: true },
          orderBy: { _count: { job_id: "desc" } },
          take: 10,
        }),
        prisma.job.findMany({
          where: {
            ...jobWhere,
            status: "completed",
            started_at: { not: null },
            completed_at: { not: null },
          },
          select: { started_at: true, completed_at: true },
        }),
      ]);

    // Resolve top technician names
    const techIds = topTechnicians.map((t) => t.technician_id);
    const techProfiles = await prisma.technicianProfile.findMany({
      where: { technician_id: { in: techIds } },
      include: { user: { select: { full_name: true } } },
    });
    const techMap = new Map(
      techProfiles.map((t) => [t.technician_id, t.user.full_name])
    );

    const topList = topTechnicians.map((t) => ({
      technician_id: t.technician_id,
      name: techMap.get(t.technician_id) || "Unknown",
      completed_jobs: t._count.job_id,
    }));

    // Calculate average duration in hours
    let avgDurationHours = 0;
    if (avgJobDuration.length > 0) {
      const totalMs = avgJobDuration.reduce((sum, j) => {
        if (!j.started_at || !j.completed_at) return sum;
        return sum + (j.completed_at.getTime() - j.started_at.getTime());
      }, 0);
      avgDurationHours =
        Math.round((totalMs / avgJobDuration.length / 3600000) * 100) / 100;
    }

    res.json({
      totalJobs,
      completedJobs,
      completionRate: totalJobs
        ? Math.round((completedJobs / totalJobs) * 10000) / 100
        : 0,
      avgJobDurationHours: avgDurationHours,
      topTechnicians: topList,
    });
  })
);
