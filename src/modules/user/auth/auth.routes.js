 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { setAuthCookies, clearAuthCookies } from "../../../utils/cookieHelper";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
} from "../../../utils/tokenHelper";
import { validate } from "../../../middleware/validate";
import {
  signupSchema,
  signinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schemas";
import { userAuth } from "../../../middleware/auth";

export const authRouter = Router();

const SALT_ROUNDS = 10;

// ─── POST /auth/signup ──────────────────────────────────────────
authRouter.post(
  "/signup",
  validate(signupSchema),
  asyncWrapper(async (req, res) => {
    const { email, password, full_name, phone_number } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && !existingUser.deleted_at) {
      throw new AppError("User already exists with this email", 409);
    }

    if (phone_number) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone_number },
      });
      if (phoneExists && !phoneExists.deleted_at) {
        throw new AppError("Phone number already in use", 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // If user was soft-deleted, reactivate with new data; otherwise create new
    let user;
    if (existingUser && existingUser.deleted_at) {
      user = await prisma.user.update({
        where: { user_id: existingUser.user_id },
        data: {
          password: hashedPassword,
          full_name: full_name || "",
          phone_number: phone_number || "",
          role: "user",
          is_active: true,
          deleted_at: null,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          full_name: full_name || "",
          phone_number: phone_number || "",
          role: "user",
        },
      });
    }

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: "User created successfully",
      accessToken,
    });
  })
);

// ─── POST /auth/signin ──────────────────────────────────────────
authRouter.post(
  "/signin",
  validate(signinSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    if (user.deleted_at) {
      throw new AppError("Account has been deleted", 403);
    }

    if (!user.is_active) {
      throw new AppError("Account has been suspended", 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid email or password", 401);
    }

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: "Signed in successfully",
      accessToken,
    });
  })
);

// ─── POST /auth/logout ──────────────────────────────────────────
authRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ─── POST /auth/refresh ─────────────────────────────────────────
authRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token = _optionalChain([req, 'access', _ => _.cookies, 'optionalAccess', _2 => _2.refreshToken]) || _optionalChain([req, 'access', _3 => _3.body, 'optionalAccess', _4 => _4.refreshToken]);

    if (!token) {
      throw new AppError("Refresh token missing", 401);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (e) {
      throw new AppError(
        "Invalid or expired refresh token. Please login again.",
        401
      );
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true, is_active: true },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found or account deleted", 401);
    }

    if (!user.is_active) {
      throw new AppError("Account has been suspended", 403);
    }

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: "Token refreshed successfully",
      accessToken,
    });
  })
);

// ─── POST /auth/forgot-password ─────────────────────────────────
authRouter.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || user.deleted_at || !user.is_active) {
      res.json({
        message:
          "If an account with that email exists, a password reset link has been sent",
      });
      return;
    }

    const resetToken = generateResetToken({ userId: user.user_id });

    // TODO: Send resetToken via email service in production
    // For development, return the token directly
    res.json({
      message:
        "If an account with that email exists, a password reset link has been sent",
      resetToken, // Remove in production — send via email instead
    });
  })
);

// ─── POST /auth/reset-password ──────────────────────────────────
authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { token, new_password } = req.body;

    let decoded;
    try {
      decoded = verifyResetToken(token);
    } catch (e2) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found", 404);
    }

    if (!user.is_active) {
      throw new AppError("Account has been suspended", 403);
    }

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);

    await prisma.user.update({
      where: { user_id: decoded.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password reset successfully" });
  })
);

// ─── POST /auth/change-password (authenticated) ─────────────────
authRouter.post(
  "/change-password",
  userAuth,
  validate(changePasswordSchema),
  asyncWrapper(async (req, res) => {
    const { current_password, new_password } = req.body;
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found", 404);
    }

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      throw new AppError("Current password is incorrect", 401);
    }

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);

    await prisma.user.update({
      where: { user_id: userId },
      data: { password: hashedPassword },
    });

    // Clear cookies to force re-login with new password
    clearAuthCookies(res);

    res.json({ message: "Password changed successfully. Please sign in again." });
  })
);