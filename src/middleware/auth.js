 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }
import { verifyAccessToken, } from "../utils/tokenHelper";
import { prisma } from "../lib/prisma";










/**
 * Authenticate user via access token (cookie or Authorization header).
 * Also verifies user exists and is not soft-deleted.
 */
export const userAuth = async (
  req,
  res,
  next
) => {
  try {
    let token;

    // 1. Check cookie
    if (_optionalChain([req, 'access', _ => _.cookies, 'optionalAccess', _2 => _2.accessToken])) {
      token = req.cookies.accessToken;
    } else if (_optionalChain([req, 'access', _3 => _3.cookies, 'optionalAccess', _4 => _4.authcookie])) {
      token = req.cookies.authcookie;
    }

    // 2. Check Authorization header (Bearer token)
    if (!token && _optionalChain([req, 'access', _5 => _5.headers, 'access', _6 => _6.authorization, 'optionalAccess', _7 => _7.startsWith, 'call', _8 => _8("Bearer ")])) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 3. Token missing
    if (!token) {
      return res.status(401).json({ message: "Authentication token missing" });
    }

    // 4. Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "Access token expired", code: "TOKEN_EXPIRED" });
      }
      return res
        .status(401)
        .json({ message: "Invalid authentication token" });
    }

    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // 5. Verify user exists and not soft-deleted
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true, is_active: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.deleted_at) {
      return res.status(403).json({ message: "Account has been deleted" });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "Account has been suspended" });
    }

    // 6. Attach to request
    req.userId = decoded.userId;
    req.userRole = decoded.role || (user.role );

    next();
  } catch (e) {
    return res.status(401).json({ message: "Authentication failed" });
  }
};
