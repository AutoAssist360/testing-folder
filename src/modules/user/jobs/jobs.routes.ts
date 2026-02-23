import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const jobRouter = Router();

jobRouter.use(userAuth, roleGuard("user", "admin"));

// ─── GET /jobs ───────────────────────────────────────────────
jobRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = {
      request: { user_id: req.userId },
      deleted_at: null,
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          request: {
            select: {
              request_id: true,
              issue_description: true,
              issue_type: true,
              status: true,
            },
          },
          technician: {
            include: {
              user: { select: { full_name: true } },
            },
          },
          offer: {
            select: {
              repair_mode: true,
              estimated_cost: true,
              estimated_time: true,
            },
          },
          invoice: {
            select: {
              invoice_id: true,
              total: true,
              payment_status: true,
            },
          },
        },
        orderBy: { started_at: "desc" },
        skip,
        take,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ jobs, total, page, limit });
  })
);

// ─── GET /jobs/:jobId ────────────────────────────────────────
jobRouter.get(
  "/:jobId",
  asyncWrapper(async (req, res) => {
    const jobId = req.params.jobId as string;

    const job = await prisma.job.findUnique({
      where: { job_id: jobId },
      include: {
        request: {
          include: {
            vehicle: {
              include: {
                variant: {
                  include: { model: { include: { company: true } } },
                },
              },
            },
            media: true,
            parts: { include: { part: true } },
          },
        },
        technician: {
          include: {
            user: { select: { full_name: true, email: true } },
          },
        },
        offer: true,
        invoice: { include: { items: true } },
      },
    });

    if (!job || job.deleted_at) {
      throw new AppError("Job not found", 404);
    }

    if (job.request.user_id !== req.userId) {
      throw new AppError("You do not have access to this job", 403);
    }

    res.json({ job });
  })
);
