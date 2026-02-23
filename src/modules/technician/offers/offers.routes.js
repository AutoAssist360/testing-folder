import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { createOfferSchema } from "../technician.schemas";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const techOffersRouter = Router();

techOffersRouter.use(userAuth, roleGuard("technician"));

/** Helper: get technicianProfile or throw */
async function getTechProfile(userId) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new AppError("Technician profile not found", 404);
  return profile;
}

// ─── POST /tech/offers ──────────────────────────────────────────
techOffersRouter.post(
  "/",
  validate(createOfferSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    // Ensure technician is verified and online before making offers
    if (!profile.is_verified) {
      throw new AppError("Your profile must be verified before submitting offers", 403);
    }
    if (!profile.is_online) {
      throw new AppError("You must be online to submit offers", 400);
    }

    const { request_id, repair_mode, estimated_cost, estimated_time, message } =
      req.body;

    // Verify request exists and is accepting offers
    const request = await prisma.serviceRequest.findUnique({
      where: { request_id },
    });
    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }
    if (
      request.status !== "created" &&
      request.status !== "pending_offers"
    ) {
      throw new AppError("Request is no longer accepting offers", 400);
    }

    // Prevent duplicate offer on same request
    const existingOffer = await prisma.technicianOffer.findFirst({
      where: {
        request_id,
        technician_id: profile.technician_id,
        status: { in: ["pending", "accepted"] },
      },
    });
    if (existingOffer) {
      throw new AppError("You already have an active offer on this request", 409);
    }

    const offer = await prisma.$transaction(async (tx) => {
      const newOffer = await tx.technicianOffer.create({
        data: {
          request_id,
          technician_id: profile.technician_id,
          repair_mode,
          estimated_cost,
          estimated_time,
          message: message || null,
        },
      });

      // Move request to pending_offers if still in "created"
      if (request.status === "created") {
        await tx.serviceRequest.update({
          where: { request_id },
          data: { status: "pending_offers" },
        });
      }

      return newOffer;
    });

    res.status(201).json({ message: "Offer submitted", offer });
  })
);

// ─── GET /tech/offers ───────────────────────────────────────────
techOffersRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = { technician_id: profile.technician_id };

    const [offers, total] = await Promise.all([
      prisma.technicianOffer.findMany({
        where,
        include: {
          request: {
            select: {
              request_id: true,
              issue_description: true,
              issue_type: true,
              status: true,
              service_location_type: true,
              created_at: true,
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

// ─── GET /tech/offers/:offerId ──────────────────────────────────
techOffersRouter.get(
  "/:offerId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const offerId = req.params.offerId ;

    const offer = await prisma.technicianOffer.findUnique({
      where: { offer_id: offerId },
      include: {
        request: {
          include: {
            vehicle: { include: { variant: { include: { model: { include: { company: true } } } } } },
            parts: { include: { part: true } },
            media: true,
          },
        },
      },
    });

    if (!offer) throw new AppError("Offer not found", 404);
    if (offer.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized to view this offer", 403);
    }

    res.json({ offer });
  })
);
