import { Request, Response, NextFunction } from "express";

/**
 * Role-based access control middleware.
 * Restricts access to users whose role matches one of the allowed roles.
 * Must be used AFTER `userAuth` middleware.
 *
 * @example
 *   router.use(userAuth, roleGuard("user", "admin"));
 */
export const roleGuard = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};
