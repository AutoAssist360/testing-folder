import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";

export const offerRouter = Router();

// All offer routes require authentication
offerRouter.use(userAuth);

// ─── GET /requests/:requestId/offers ─────────────────────────
// Note: This is mounted at /requests/:requestId/offers in server.ts
offerRouter.get(
  "/requests/:requestId/offers",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;

    // Verify request ownership
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request's offers", 403);
    }

    const offers = await prisma.technicianOffer.findMany({
      where: { request_id: requestId },
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
    });

    res.json({ offers });
  })
);

// ─── PATCH /offers/:offerId/accept ───────────────────────────
offerRouter.patch(
  "/offers/:offerId/accept",
  asyncWrapper(async (req, res) => {
    const offerId = req.params.offerId as string;

    const offer = await prisma.technicianOffer.findUnique({
      where: { offer_id: offerId },
      include: { request: true },
    });

    if (!offer) {
      throw new AppError("Offer not found", 404);
    }

    // Verify ownership through request
    if (offer.request!.user_id !== req.userId) {
      throw new AppError("You do not have access to this offer", 403);
    }

    // Prevent duplicate accept
    if (offer.status !== "pending") {
      throw new AppError(`Offer has already been ${offer.status}`, 400);
    }

    // Check if another offer for this request was already accepted
    const existingAccepted = await prisma.technicianOffer.findFirst({
      where: {
        request_id: offer.request_id,
        status: "accepted",
      },
    });

    if (existingAccepted) {
      throw new AppError("An offer for this request has already been accepted", 400);
    }

    // Transaction: accept offer + create job + update request status + reject other pending offers
    const result = await prisma.$transaction(async (tx) => {
      // 1. Accept this offer
      const acceptedOffer = await tx.technicianOffer.update({
        where: { offer_id: offerId },
        data: { status: "accepted" },
      });

      // 2. Create job
      const job = await tx.job.create({
        data: {
          request_id: offer.request_id,
          technician_id: offer.technician_id,
          offer_id: offerId,
          status: "assigned",
        },
      });

      // 3. Update service request status
      await tx.serviceRequest.update({
        where: { request_id: offer.request_id },
        data: { status: "offer_accepted" },
      });

      // 4. Reject all other pending offers for this request
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
    const offerId = req.params.offerId as string;

    const offer = await prisma.technicianOffer.findUnique({
      where: { offer_id: offerId },
      include: { request: true },
    });

    if (!offer) {
      throw new AppError("Offer not found", 404);
    }

    if (offer.request!.user_id !== req.userId) {
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
