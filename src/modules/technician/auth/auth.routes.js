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
} from "../../../utils/tokenHelper";
import { validate } from "../../../middleware/validate";
import { techSignupSchema, techSigninSchema } from "../technician.schemas";

export const techAuthRouter = Router();

const SALT_ROUNDS = 10;

// ─── POST /tech/auth/signup ──────────────────────────────────────
techAuthRouter.post(
  "/signup",
  validate(techSignupSchema),
  asyncWrapper(async (req, res) => {
    const {
      email,
      password,
      full_name,
      phone_number,
      business_name,
      technician_type,
      location,
      latitude,
      longitude,
      service_radius,
    } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone_number }] },
    });

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "phone number";
      throw new AppError(`An account with this ${field} already exists`, 409);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          full_name,
          phone_number,
          role: "technician",
        },
      });

      await tx.technicianProfile.create({
        data: {
          user_id: newUser.user_id,
          business_name: business_name || null,
          technician_type,
          location,
          latitude,
          longitude,
          service_radius,
        },
      });

      return newUser;
    });

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: "Technician account created successfully",
      accessToken,
    });
  })
);

// ─── POST /tech/auth/signin ─────────────────────────────────────
techAuthRouter.post(
  "/signin",
  validate(techSigninSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.deleted_at) throw new AppError("Account has been deleted", 403);
    if (user.role !== "technician") throw new AppError("Invalid email or password", 401);
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

// ─── POST /tech/auth/logout ─────────────────────────────────────
techAuthRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ─── POST /tech/auth/refresh ────────────────────────────────────
techAuthRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token = _optionalChain([req, 'access', _ => _.cookies, 'optionalAccess', _2 => _2.refreshToken]) || _optionalChain([req, 'access', _3 => _3.body, 'optionalAccess', _4 => _4.refreshToken]);
    if (!token) throw new AppError("Refresh token missing", 401);

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (e) {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true, is_active: true },
    });

    if (!user || user.deleted_at) throw new AppError("Account not found", 401);
    if (user.role !== "technician") throw new AppError("Access denied", 403);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);
