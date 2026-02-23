import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { setAuthCookies, clearAuthCookies } from "../../../utils/cookieHelper";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../../utils/tokenHelper";
import { validate } from "../../../middleware/validate";
import { adminSigninSchema } from "../admin.schemas";

export const adminAuthRouter = Router();

// ─── POST /admin/auth/signin ─────────────────────────────────
adminAuthRouter.post(
  "/signin",
  validate(adminSigninSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.deleted_at) throw new AppError("Invalid email or password", 401);
    if (user.role !== "admin") throw new AppError("Invalid email or password", 401);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid email or password", 401);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Signed in successfully", accessToken });
  })
);

// ─── POST /admin/auth/logout ─────────────────────────────────
adminAuthRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ─── POST /admin/auth/refresh ────────────────────────────────
adminAuthRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) throw new AppError("Refresh token missing", 401);

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true, is_active: true },
    });

    if (!user || user.deleted_at) throw new AppError("Account not found", 401);
    if (user.role !== "admin") throw new AppError("Access denied", 403);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);
