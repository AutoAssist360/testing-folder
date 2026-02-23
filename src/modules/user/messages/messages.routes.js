import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { validate } from "../../../middleware/validate";
import { sendMessageSchema } from "./messages.schemas";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const messageRouter = Router();

messageRouter.use(userAuth, roleGuard("user", "admin"));

// ─── GET /requests/:requestId/messages ───────────────────────
messageRouter.get(
  "/requests/:requestId/messages",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId ;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to these messages", 403);
    }

    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = { request_id: requestId };

    const [messages, total] = await Promise.all([
      prisma.platformMessage.findMany({
        where,
        include: {
          sender: {
            select: { user_id: true, full_name: true, role: true },
          },
          receiver: {
            select: { user_id: true, full_name: true, role: true },
          },
        },
        orderBy: { sent_at: "asc" },
        skip,
        take,
      }),
      prisma.platformMessage.count({ where }),
    ]);

    // Mark messages sent to this user as read
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

// ─── POST /requests/:requestId/messages ──────────────────────
messageRouter.post(
  "/requests/:requestId/messages",
  validate(sendMessageSchema),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId ;
    const { receiver_id, message } = req.body;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    const receiver = await prisma.user.findUnique({
      where: { user_id: receiver_id },
    });

    if (!receiver || receiver.deleted_at) {
      throw new AppError("Receiver not found", 404);
    }

    // Users can only message technicians involved in this request
    if (receiver.role !== "technician") {
      throw new AppError(
        "You can only message technicians involved in this service request",
        403
      );
    }

    const techProfile = await prisma.technicianProfile.findUnique({
      where: { user_id: receiver_id },
    });
    if (!techProfile) {
      throw new AppError("Receiver does not have a technician profile", 400);
    }

    const involvement = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        technician_id: techProfile.technician_id,
        status: { in: ["pending", "accepted"] },
      },
    });
    if (!involvement) {
      throw new AppError(
        "Receiver is not involved in this service request",
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
      include: {
        sender: { select: { user_id: true, full_name: true } },
        receiver: { select: { user_id: true, full_name: true } },
      },
    });

    res.status(201).json({
      message: "Message sent successfully",
      data: newMessage,
    });
  })
);
