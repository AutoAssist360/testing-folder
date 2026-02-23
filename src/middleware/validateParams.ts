import { Request, Response, NextFunction } from "express";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that the specified route params are valid UUIDs.
 * Usage: router.get("/:orderId", validateUUID("orderId"), handler)
 */
export const validateUUID = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value && !UUID_REGEX.test(value as string)) {
        return res.status(400).json({
          message: `Invalid UUID format for parameter '${name}'`,
        });
      }
    }
    next();
  };
};

/**
 * Auto-validate ALL route params whose names end with "Id" or "id"
 * against UUID format. Apply once at the app level.
 */
export const validateUUIDParams = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  for (const [name, value] of Object.entries(req.params)) {
    // Only validate params that look like UUID identifiers
    if (
      (name.endsWith("Id") || name === "attemptId") &&
      value &&
      !UUID_REGEX.test(value as string)
    ) {
      return res.status(400).json({
        message: `Invalid UUID format for parameter '${name}'`,
      });
    }
  }
  next();
};
