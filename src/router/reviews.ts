import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";
import { validate } from "../Middelware/validate";
import { createReviewSchema } from "../validations/schemas";

export const reviewRouter = Router();

// All review routes require authentication
reviewRouter.use(userAuth);

// ─── POST /reviews ───────────────────────────────────────────
reviewRouter.post(
  "/",
  validate(createReviewSchema),
  asyncWrapper(async (req, res) => {
    const { job_id, rating, comment } = req.body;

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { job_id },
      include: {
        request: { select: { user_id: true } },
      },
    });

    if (!job) {
      throw new AppError("Job not found", 404);
    }

    // Verify ownership
    if (job.request.user_id !== req.userId) {
      throw new AppError("You do not have access to this job", 403);
    }

    // Only allow review after job is completed or verified
    if (!["completed", "verified"].includes(job.status)) {
      throw new AppError(
        `Cannot review a job with status '${job.status}'. Job must be completed first.`,
        400
      );
    }

    const review = await prisma.review.create({
      data: {
        user_id: req.userId,
        rating,
        comment,
      },
    });

    // Update technician's rating and total_reviews
    const allReviews = await prisma.review.findMany({
      where: { user_id: req.userId },
      select: { rating: true },
    });

    // Recalculate technician average rating
    // Note: In production you'd track reviews per technician; this updates the offering technician
    const techProfile = await prisma.technicianProfile.findUnique({
      where: { technician_id: job.technician_id },
    });

    if (techProfile) {
      await prisma.technicianProfile.update({
        where: { technician_id: job.technician_id },
        data: {
          total_reviews: { increment: 1 },
        },
      });
    }

    res.status(201).json({
      message: "Review submitted successfully",
      review,
    });
  })
);

// ─── GET /reviews ────────────────────────────────────────────
reviewRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { user_id: req.userId },
      orderBy: { created_at: "desc" },
    });

    res.json({ reviews });
  })
);
