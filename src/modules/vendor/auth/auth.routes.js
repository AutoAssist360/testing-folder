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
import { vendorSignupSchema, vendorSigninSchema } from "../vendor.schemas";

export const vendorAuthRouter = Router();

const SALT_ROUNDS = 10;

// ─── POST /vendor/auth/signup ────────────────────────────────
vendorAuthRouter.post(
  "/signup",
  validate(vendorSignupSchema),
  asyncWrapper(async (req, res) => {
    const { email, password, full_name, phone_number } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone_number }] },
    });

    if (existing) {
      const field = existing.email === email ? "email" : "phone number";
      throw new AppError(`An account with this ${field} already exists`, 409);
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        full_name,
        phone_number,
        role: "vendor",
      },
    });

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: "Vendor account created successfully",
      accessToken,
    });
  })
);

// ─── POST /vendor/auth/signin ────────────────────────────────
vendorAuthRouter.post(
  "/signin",
  validate(vendorSigninSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.deleted_at) throw new AppError("Account has been deleted", 403);
    if (user.role !== "vendor")
      throw new AppError("Invalid email or password", 401);
    if (!user.is_active)
      throw new AppError("Account has been suspended", 403);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid email or password", 401);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Signed in successfully", accessToken });
  })
);

// ─── POST /vendor/auth/logout ────────────────────────────────
vendorAuthRouter.post(
  "/logout",
  asyncWrapper(async (_req, res) => {
    clearAuthCookies(res);
    res.json({ message: "Logged out successfully" });
  })
);

// ─── POST /vendor/auth/refresh ───────────────────────────────
vendorAuthRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token =
      _optionalChain([req, 'access', _ => _.cookies, 'optionalAccess', _2 => _2.refreshToken]) ||
      _optionalChain([req, 'access', _3 => _3.headers, 'access', _4 => _4.authorization, 'optionalAccess', _5 => _5.split, 'call', _6 => _6(" "), 'access', _7 => _7[1]]);

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

    if (!user) throw new AppError("User not found", 401);
    if (user.deleted_at) throw new AppError("Account has been deleted", 403);
    if (user.role !== "vendor")
      throw new AppError("Invalid refresh token", 401);
    if (!user.is_active)
      throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);
