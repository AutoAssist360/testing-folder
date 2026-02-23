import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { paginate, paginationQuery } from "../../../utils/paginate";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";

export const offerRouter = Router();

offerRouter.use(userAuth, roleGuard("user", "admin"));

// ─── GET /requests/:requestId/offers ─────────────────────────
offerRouter.get(
  "/requests/:requestId/offers",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId ;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError(
        "You do not have access to this request's offers",
        403
      );
    }

    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = { request_id: requestId };

    const [offers, total] = await Promise.all([
      prisma.technicianOffer.findMany({
        where,
        include: {
          technician: {
            include: {
              user: {
                select: { full_name: true, email: true },
              },
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.technicianOffer.count({ where }),
    ]);

    res.json({ offers, total, page, limit });
  })
);

// ─── PATCH /offers/:offerId/accept ───────────────────────────
offerRouter.patch(
  "/offers/:offerId/accept",
  asyncWrapper(async (req, res) => {
    const offerId = req.params.offerId ;

    const offer = await prisma.technicianOffer.findUnique({
      where: { offer_id: offerId },
      include: { request: true },
    });

    if (!offer || !offer.request || offer.request.deleted_at) {
      throw new AppError("Offer not found", 404);
    }

    if (offer.request.user_id !== req.userId) {
      throw new AppError("You do not have access to this offer", 403);
    }

    // Prevent duplicate acceptance
    if (offer.status !== "pending") {
      throw new AppError(`Offer has already been ${offer.status}`, 400);
    }

    // Transaction: accept offer → create job → update request → reject others
    // The existingAccepted check is INSIDE the transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction to prevent TOCTOU race
      const existingAccepted = await tx.technicianOffer.findFirst({
        where: {
          request_id: offer.request_id,
          status: "accepted",
        },
      });

      if (existingAccepted) {
        throw new AppError(
          "An offer for this request has already been accepted",
          400
        );
      }

      const acceptedOffer = await tx.technicianOffer.update({
        where: { offer_id: offerId },
        data: { status: "accepted" },
      });

      const job = await tx.job.create({
        data: {
          request_id: offer.request_id,
          technician_id: offer.technician_id,
          offer_id: offerId,
          status: "assigned",
        },
      });

      await tx.serviceRequest.update({
        where: { request_id: offer.request_id },
        data: { status: "offer_accepted" },
      });

      await tx.technicianOffer.updateMany({
        where: {
          request_id: offer.request_id,
          offer_id: { not: offerId },
          status: "pending",
        },
        data: { status: "rejected" },
      });

      return { offer: acceptedOffer, job };
    });

    res.json({
      message: "Offer accepted successfully",
      offer: result.offer,
      job: result.job,
    });
  })
);

// ─── PATCH /offers/:offerId/reject ───────────────────────────
offerRouter.patch(
  "/offers/:offerId/reject",
  asyncWrapper(async (req, res) => {
    const offerId = req.params.offerId ;

    const offer = await prisma.technicianOffer.findUnique({
      where: { offer_id: offerId },
      include: { request: true },
    });

    if (!offer || !offer.request || offer.request.deleted_at) {
      throw new AppError("Offer not found", 404);
    }

    if (offer.request.user_id !== req.userId) {
      throw new AppError("You do not have access to this offer", 403);
    }

    if (offer.status !== "pending") {
      throw new AppError(`Offer has already been ${offer.status}`, 400);
    }

    const rejected = await prisma.technicianOffer.update({
      where: { offer_id: offerId },
      data: { status: "rejected" },
    });

    res.json({
      message: "Offer rejected successfully",
      offer: rejected,
    });
  })
);
