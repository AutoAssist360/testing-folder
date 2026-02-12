import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";
import { validate } from "../Middelware/validate";
import { sendMessageSchema } from "../validations/schemas";

export const messageRouter = Router();

// All message routes require authentication
messageRouter.use(userAuth);

// ─── GET /requests/:requestId/messages ───────────────────────
messageRouter.get(
  "/requests/:requestId/messages",
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
      throw new AppError("You do not have access to these messages", 403);
    }

    const messages = await prisma.platformMessage.findMany({
      where: { request_id: requestId },
      include: {
        sender: { select: { user_id: true, full_name: true, role: true } },
        receiver: { select: { user_id: true, full_name: true, role: true } },
      },
      orderBy: { sent_at: "asc" },
    });

    // Mark messages sent to this user as read
    await prisma.platformMessage.updateMany({
      where: {
        request_id: requestId,
        receiver_id: req.userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    res.json({ messages });
  })
);

// ─── POST /requests/:requestId/messages ──────────────────────
messageRouter.post(
  "/requests/:requestId/messages",
  validate(sendMessageSchema),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId as string;
    const { receiver_id, message } = req.body;

    // Verify request ownership
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { user_id: receiver_id },
    });

    if (!receiver) {
      throw new AppError("Receiver not found", 404);
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
