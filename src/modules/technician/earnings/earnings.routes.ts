import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { Decimal } from "../../../../generated/prisma/internal/prismaNamespace";

export const techEarningsRouter = Router();

techEarningsRouter.use(userAuth, roleGuard("technician"));

// ─── GET /tech/earnings ─────────────────────────────────────────
techEarningsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    // All completed jobs with paid invoices
    const completedJobs = await prisma.job.findMany({
      where: {
        technician_id: profile.technician_id,
        status: { in: ["completed", "verified"] },
        deleted_at: null,
        invoice: { isNot: null },
      },
      include: {
        invoice: {
          select: {
            invoice_id: true,
            subtotal: true,
            tax: true,
            total: true,
            payment_status: true,
            paid_at: true,
            issued_at: true,
          },
        },
        request: {
          select: {
            request_id: true,
            issue_type: true,
            issue_description: true,
          },
        },
      },
      orderBy: { completed_at: "desc" },
    });

    const summary = {
      total_jobs: completedJobs.length,
      total_earned: new Decimal(0),
      total_pending: new Decimal(0),
      paid_count: 0,
      pending_count: 0,
    };

    for (const job of completedJobs) {
      if (!job.invoice) continue;
      const total = new Decimal(job.invoice.total);
      if (job.invoice.payment_status === "completed") {
        summary.total_earned = summary.total_earned.add(total);
        summary.paid_count++;
      } else if (job.invoice.payment_status === "pending") {
        summary.total_pending = summary.total_pending.add(total);
        summary.pending_count++;
      }
    }

    // Round to 2 decimal places
    const totalEarned = Number(summary.total_earned.toFixed(2));
    const totalPending = Number(summary.total_pending.toFixed(2));

    res.json({
      summary: {
        ...summary,
        total_earned: totalEarned,
        total_pending: totalPending,
      },
      jobs: completedJobs,
    });
  })
);
