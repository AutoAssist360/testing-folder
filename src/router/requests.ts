import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";
import { validate } from "../Middelware/validate";
import { createRequestSchema } from "../validations/schemas";

export const requestRouter = Router();

// All request routes require authentication
requestRouter.use(userAuth);

// ─── POST /requests ──────────────────────────────────────────
requestRouter.post(
  "/",
  validate(createRequestSchema),
  asyncWrapper(async (req, res) => {
    const {
      vehicle_id,
      issue_description,
      issue_type,
      breakdown_latitude,
      breakdown_longitude,
      service_location_type,
      requires_towing,
    } = req.body;

    // Verify vehicle belongs to user
    const vehicle = await prisma.userVehicle.findUnique({
      where: { vehicle_id },
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.user_id !== req.userId) {
      throw new AppError("This vehicle does not belong to you", 403);
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        user_id: req.userId,
        vehicle_id,
        issue_description,
        issue_type,
        breakdown_latitude,
        breakdown_longitude,
        service_location_type,
        requires_towing,
      },
      include: {
        vehicle: {
          include: { variant: { include: { model: { include: { company: true } } } } },
        },
      },
    });

    res.status(201).json({
      message: "Service request created successfully",
      serviceRequest,
    });
  })
);

// ─── GET /requests ───────────────────────────────────────────
requestRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { status } = req.query;

    const where: any = {
      user_id: req.userId,
      deleted_at: null,
    };

    if (status && typeof status === "string") {
      // Allow filtering by comma-separated statuses
      const statuses = status.split(",");
      where.status = { in: statuses };
    }

    const requests = await prisma.serviceRequest.findMany({
      where,
      include: {
        vehicle: {
          include: { variant: { include: { model: { include: { company: true } } } } },
        },
        offers: { select: { offer_id: true, status: true } },
        job: { select: { job_id: true, status: true } },
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ requests });
  })
);

// ─── GET /requests/:requestId ────────────────────────────────
requestRouter.get(
  "/:requestId",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        vehicle: {
          include: { variant: { include: { model: { include: { company: true } } } } },
        },
        parts: { include: { part: true } },
        media: true,
        offers: true,
        job: true,
      },
    });

    if (!serviceRequest) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    res.json({ serviceRequest });
  })
);

// ─── PATCH /requests/:requestId/cancel ───────────────────────
requestRouter.patch(
  "/:requestId/cancel",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    // Only allow cancellation if status is 'created' or 'pending_offers'
    if (!["created", "pending_offers"].includes(serviceRequest.status)) {
      throw new AppError(
        `Cannot cancel request with status '${serviceRequest.status}'. Only 'created' or 'pending_offers' requests can be cancelled.`,
        400
      );
    }

    const updated = await prisma.serviceRequest.update({
      where: { request_id: requestId },
      data: { status: "cancelled" },
    });

    res.json({
      message: "Service request cancelled successfully",
      serviceRequest: updated,
    });
  })
);
