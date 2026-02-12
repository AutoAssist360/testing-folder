import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";

export const jobRouter = Router();

// All job routes require authentication
jobRouter.use(userAuth);

// ─── GET /jobs ───────────────────────────────────────────────
jobRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const jobs = await prisma.job.findMany({
      where: {
        request: { user_id: req.userId },
        deleted_at: null,
      },
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
    });

    res.json({ jobs });
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
              include: { variant: { include: { model: { include: { company: true } } } } },
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

    if (!job) {
      throw new AppError("Job not found", 404);
    }

    // Verify ownership through the request
    if (job.request.user_id !== req.userId) {
      throw new AppError("You do not have access to this job", 403);
    }

    res.json({ job });
  })
);
