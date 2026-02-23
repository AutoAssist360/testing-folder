import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listJobsQuery } from "../admin.schemas";
import { dateFilter, paginate } from "../admin.helpers";

export const adminJobsRouter = Router();

adminJobsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/jobs ─────────────────────────────────────────
adminJobsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listJobsQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where: any = { deleted_at: null };
    if (q.status) where.status = q.status;
    if (q.from || q.to) where.started_at = dateFilter(q.from, q.to);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take,
        include: {
          request: {
            select: { request_id: true, issue_type: true, status: true },
          },
          technician: {
            include: {
              user: { select: { full_name: true, email: true } },
            },
          },
          invoice: {
            select: { invoice_id: true, total: true, payment_status: true },
          },
        },
        orderBy: { started_at: "desc" },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/jobs/:jobId ──────────────────────────────────
adminJobsRouter.get(
  "/:jobId",
  asyncWrapper(async (req, res) => {
    const jobId = req.params.jobId as string;

    const job = await prisma.job.findUnique({
      where: { job_id: jobId },
      include: {
        request: {
          include: {
            user: { select: { user_id: true, full_name: true, email: true } },
            vehicle: {
              include: {
                variant: { include: { model: { include: { company: true } } } },
              },
            },
            parts: { include: { part: true } },
          },
        },
        technician: {
          include: {
            user: { select: { full_name: true, email: true, phone_number: true } },
          },
        },
        offer: true,
        invoice: { include: { items: true } },
      },
    });

    if (!job) throw new AppError("Job not found", 404);
    if (job.deleted_at) throw new AppError("Job has been deleted", 404);

    res.json({ job });
  })
);
