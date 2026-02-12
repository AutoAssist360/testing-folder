import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";
import { setAuthCookies, clearAuthCookies } from "../utils/cookieHelper";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/tokenHelper";
import { validate } from "../Middelware/validate";
import { signupSchema, signinSchema } from "../validations/schemas";

export const authRouter = Router();

const SALT_ROUNDS = 10;

// ─── POST /auth/signup ──────────────────────────────────────────
authRouter.post(
  "/signup",
  validate(signupSchema),
  asyncWrapper(async (req, res) => {
    const { email, password, full_name, phone_number } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError("User already exists with this email", 409);
    }

    // Check phone uniqueness if provided
    if (phone_number) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone_number },
      });
      if (phoneExists) {
        throw new AppError("Phone number already in use", 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        full_name: full_name || "",
        phone_number: phone_number || "",
        role: "user",
      },
    });

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
    const token =
      req.cookies?.refreshToken ||
      req.body?.refreshToken;

    if (!token) {
      throw new AppError("Refresh token missing", 401);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new AppError("Invalid or expired refresh token. Please login again.", 401);
    }

    // Verify user still valid
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found or account deleted", 401);
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
