import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";
import { clearAuthCookies } from "../utils/cookieHelper";
import { validate } from "../Middelware/validate";
import { updateProfileSchema } from "../validations/schemas";

export const profileRouter = Router();

// All profile routes require authentication
profileRouter.use(userAuth);

// ─── GET /profile ─────────────────────────────────────────────
profileRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { user_id: req.userId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({ user });
  })
);

// ─── PUT /profile ─────────────────────────────────────────────
profileRouter.put(
  "/",
  validate(updateProfileSchema),
  asyncWrapper(async (req, res) => {
    const { full_name, phone_number } = req.body;

    // Check phone uniqueness if updating
    if (phone_number) {
      const phoneExists = await prisma.user.findFirst({
        where: {
          phone_number,
          user_id: { not: req.userId },
        },
      });
      if (phoneExists) {
        throw new AppError("Phone number already in use", 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { user_id: req.userId },
      data: {
        ...(full_name !== undefined && { full_name }),
        ...(phone_number !== undefined && { phone_number }),
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  })
);

// ─── DELETE /profile (soft delete) ────────────────────────────
profileRouter.delete(
  "/",
  asyncWrapper(async (req, res) => {
    await prisma.user.update({
      where: { user_id: req.userId },
      data: { deleted_at: new Date(), is_active: false },
    });

    clearAuthCookies(res);

    res.json({ message: "Account deleted successfully" });
  })
);
