import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { listRequestsQuery, forceAssignSchema } from "../admin.schemas";
import { logAudit, dateFilter, paginate } from "../admin.helpers";

export const adminRequestsRouter = Router();

adminRequestsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/requests ─────────────────────────────────────
adminRequestsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listRequestsQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where: any = { deleted_at: null };
    if (q.status) where.status = q.status;
    if (q.issue_type) where.issue_type = q.issue_type;
    if (q.from || q.to) where.created_at = dateFilter(q.from, q.to);

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { user_id: true, full_name: true, email: true } },
          vehicle: { select: { vehicle_id: true, registration_number: true } },
          _count: { select: { offers: true, parts: true, media: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    res.json({
      requests,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/requests/:requestId ──────────────────────────
adminRequestsRouter.get(
  "/:requestId",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        vehicle: {
          include: {
            variant: { include: { model: { include: { company: true } } } },
          },
        },
        parts: { include: { part: true } },
        media: true,
        offers: {
          include: {
            technician: {
              include: {
                user: { select: { full_name: true, email: true } },
              },
            },
          },
        },
        job: {
          include: {
            technician: {
              include: {
                user: { select: { full_name: true } },
              },
            },
            invoice: { select: { invoice_id: true, total: true, payment_status: true } },
          },
        },
        messages: {
          orderBy: { sent_at: "desc" },
          take: 10,
          include: {
            sender: { select: { full_name: true, role: true } },
          },
        },
      },
    });

    if (!request) throw new AppError("Service request not found", 404);
    if (request.deleted_at)
      throw new AppError("Service request has been deleted", 404);

    res.json({ request });
  })
);

// ─── PATCH /admin/requests/:requestId/cancel ─────────────────
adminRequestsRouter.patch(
  "/:requestId/cancel",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      select: { request_id: true, status: true, deleted_at: true },
    });

    if (!request || request.deleted_at)
      throw new AppError("Service request not found", 404);
    if (request.status === "completed")
      throw new AppError("Cannot cancel a completed request", 400);
    if (request.status === "cancelled")
      throw new AppError("Request is already cancelled", 400);

    const oldStatus = request.status;

    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { request_id: requestId },
        data: { status: "cancelled" },
      });

      // Expire all pending offers
      await tx.technicianOffer.updateMany({
        where: { request_id: requestId, status: "pending" },
        data: { status: "expired" },
      });

      // Cancel any in-progress or assigned jobs linked to this request
      await tx.job.updateMany({
        where: {
          request_id: requestId,
          status: { in: ["assigned", "in_progress"] },
          deleted_at: null,
        },
        data: { deleted_at: new Date() },
      });

      await logAudit({
        entityType: "ServiceRequest",
        entityId: requestId,
        action: "CANCEL_REQUEST",
        performedBy: req.userId,
        oldValue: { status: oldStatus },
        newValue: { status: "cancelled" },
        tx,
      });
    });

    res.json({ message: "Request cancelled" });
  })
);

// ─── POST /admin/requests/:requestId/force-assign ────────────
adminRequestsRouter.post(
  "/:requestId/force-assign",
  validate(forceAssignSchema),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;
    const { technician_id, repair_mode, estimated_cost, estimated_time } =
      req.body;

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: { job: true },
    });

    if (!request || request.deleted_at)
      throw new AppError("Service request not found", 404);
    if (request.status === "completed" || request.status === "cancelled")
      throw new AppError("Cannot assign a completed/cancelled request", 400);
    if (request.job)
      throw new AppError("Request already has an assigned job", 409);

    // Verify technician exists and is valid
    const profile = await prisma.technicianProfile.findUnique({
      where: { technician_id },
      include: { user: { select: { is_active: true, deleted_at: true } } },
    });
    if (!profile) throw new AppError("Technician not found", 404);
    if (profile.user.deleted_at || !profile.user.is_active)
      throw new AppError("Technician is not available", 400);

    const result = await prisma.$transaction(async (tx) => {
      // Create an offer on behalf of admin
      const offer = await tx.technicianOffer.create({
        data: {
          request_id: requestId,
          technician_id,
          repair_mode,
          estimated_cost,
          estimated_time,
          status: "accepted",
        },
      });

      // Create the job
      const job = await tx.job.create({
        data: {
          request_id: requestId,
          technician_id,
          offer_id: offer.offer_id,
          status: "assigned",
        },
      });

      // Update request status
      await tx.serviceRequest.update({
        where: { request_id: requestId },
        data: { status: "offer_accepted" },
      });

      // Expire remaining pending offers
      await tx.technicianOffer.updateMany({
        where: {
          request_id: requestId,
          status: "pending",
          offer_id: { not: offer.offer_id },
        },
        data: { status: "expired" },
      });

      await logAudit({
        entityType: "ServiceRequest",
        entityId: requestId,
        action: "FORCE_ASSIGN",
        performedBy: req.userId,
        newValue: {
          technician_id,
          job_id: job.job_id,
          offer_id: offer.offer_id,
        },
        tx,
      });

      return { offer, job };
    });

    res.status(201).json({
      message: "Technician force-assigned",
      job: result.job,
      offer: result.offer,
    });
  })
);
