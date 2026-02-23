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
    if (user.role !== "admin") throw new AppError("Access denied", 403);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);
