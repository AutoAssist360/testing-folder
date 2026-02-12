import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/tokenHelper";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userRole: string;
    }
  }
}

/**
 * Authenticate user via access token (cookie or Authorization header).
 * Also verifies user exists and is not soft-deleted.
 */
export const userAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // 1. Check cookie (new accessToken cookie first, then legacy)
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.cookies?.authcookie) {
      token = req.cookies.authcookie;
    }

    // 2. Check Authorization header (Bearer token)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 3. Token missing
    if (!token) {
      return res.status(401).json({ message: "Authentication token missing" });
    }

    // 4. Verify token
    let decoded: TokenPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // 5. Verify user exists and not soft-deleted
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.deleted_at) {
      return res.status(403).json({ message: "Account has been deleted" });
    }

    // 6. Attach to request
    req.userId = decoded.userId;
    req.userRole = decoded.role || (user.role as string);

    next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication failed" });
  }
};
