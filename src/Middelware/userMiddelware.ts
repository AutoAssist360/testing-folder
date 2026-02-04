import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { USER_SECRET } from "../../config";


declare global {
  namespace Express {
    interface Request {
        userId: string;
    }
  }
}

interface TokenPayload extends JwtPayload {
  userId: string;
}

export const userAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // ✅ 1. Check cookie
    if (req.cookies?.authcookie) {
      token = req.cookies.authcookie;
    }

    // ✅ 2. Check Authorization header (Bearer token)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // ✅ 3. Token missing
    if (!token) {
      return res.status(401).json({
        message: "Authentication token missing"
      });
    }

    // ✅ 4. Verify token
    if (!USER_SECRET) {
      return res.status(500).json({
        message: "Server configuration error"
      });
    }

    const decoded = jwt.verify(token, USER_SECRET) as TokenPayload;

    if (!decoded.userId) {
      return res.status(401).json({
        message: "Invalid token payload"
      });
    }

    // ✅ 5. Attach user globally
    req.userId = decoded.userId;

    next();
  } catch (error: any) {

    // ✅ Token expired
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired"
      });
    }

    // ✅ Invalid token
    return res.status(401).json({
      message: "Invalid authentication token"
    });
  }
};
