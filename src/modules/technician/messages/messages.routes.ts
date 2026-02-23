import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { sendMessageSchema } from "../technician.schemas";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const techMessagesRouter = Router();

techMessagesRouter.use(userAuth, roleGuard("technician"));

// ─── GET /tech/requests/:requestId/messages ─────────────────────
techMessagesRouter.get(
  "/:requestId/messages",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      select: { deleted_at: true },
    });

    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    // Verify the technician has an accepted/pending offer for this request
    const involvement = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        technician_id: profile.technician_id,
        status: { in: ["pending", "accepted"] },
      },
    });
    if (!involvement) {
      throw new AppError("Not authorized to view messages for this request", 403);
    }

    // Only return messages where this tech is sender or receiver
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = {
      request_id: requestId,
      OR: [{ sender_id: req.userId }, { receiver_id: req.userId }],
    };

    const [messages, total] = await Promise.all([
      prisma.platformMessage.findMany({
        where,
        include: {
          sender: {
            select: { user_id: true, full_name: true, role: true },
          },
        },
        orderBy: { sent_at: "asc" },
        skip,
        take,
      }),
      prisma.platformMessage.count({ where }),
    ]);

    // Mark unread messages addressed to this technician as read
    await prisma.platformMessage.updateMany({
      where: {
        request_id: requestId,
        receiver_id: req.userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    res.json({ messages, total, page, limit });
  })
);

// ─── POST /tech/requests/:requestId/messages ────────────────────
techMessagesRouter.post(
  "/:requestId/messages",
  validate(sendMessageSchema),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;
    const { receiver_id, message } = req.body;

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    // Verify the technician has an active involvement on this request
    const involvement = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        technician_id: profile.technician_id,
        status: { in: ["pending", "accepted"] },
      },
    });
    if (!involvement) {
      throw new AppError("Not authorized to message on this request", 403);
    }

    // Verify the request exists
    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });
    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    // Verify the receiver exists
    const receiver = await prisma.user.findUnique({
      where: { user_id: receiver_id },
      select: { user_id: true, deleted_at: true },
    });
    if (!receiver || receiver.deleted_at) {
      throw new AppError("Receiver not found", 404);
    }

    // Verify the receiver is actually the request owner (user who created the request)
    if (receiver_id !== request.user_id) {
      throw new AppError(
        "You can only message the user who created this service request",
        403
      );
    }

    const newMessage = await prisma.platformMessage.create({
      data: {
        request_id: requestId,
        sender_id: req.userId,
        receiver_id,
        message,
      },
    });

    res.status(201).json({ message: "Message sent", data: newMessage });
  })
);
