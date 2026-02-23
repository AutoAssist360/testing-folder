import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { validate } from "../../../middleware/validate";
import { createReviewSchema } from "./reviews.schemas";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const reviewRouter = Router();

reviewRouter.use(userAuth, roleGuard("user", "admin"));

// ─── POST /reviews ───────────────────────────────────────────
reviewRouter.post(
  "/",
  validate(createReviewSchema),
  asyncWrapper(async (req, res) => {
    const { job_id, rating, comment } = req.body;

    const job = await prisma.job.findUnique({
      where: { job_id },
      include: {
        request: { select: { user_id: true } },
      },
    });

    if (!job) {
      throw new AppError("Job not found", 404);
    }

    // Ownership validation
    if (job.request.user_id !== req.userId) {
      throw new AppError("You do not have access to this job", 403);
    }

    if (!["completed", "verified"].includes(job.status)) {
      throw new AppError(
        `Cannot review a job with status '${job.status}'. Job must be completed first.`,
        400
      );
    }

    // Check for existing review on this job
    const existingReview = await prisma.review.findUnique({
      where: { job_id },
    });
    if (existingReview) {
      throw new AppError("You have already reviewed this job", 409);
    }

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          user_id: req.userId,
          job_id,
          technician_id: job.technician_id,
          rating,
          comment,
        },
      });

      // Recalculate technician's average rating
      const { _avg, _count } = await tx.review.aggregate({
        where: { technician_id: job.technician_id },
        _avg: { rating: true },
        _count: { review_id: true },
      });

      await tx.technicianProfile.update({
        where: { technician_id: job.technician_id },
        data: {
          rating: _avg.rating ?? 0,
          total_reviews: _count.review_id,
        },
      });

      return newReview;
    });

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
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = { user_id: req.userId };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.review.count({ where }),
    ]);

    res.json({ reviews, total, page, limit });
  })
);
