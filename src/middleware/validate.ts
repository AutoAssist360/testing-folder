import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Express middleware that validates req.body against a Zod schema.
 */
export const validate = (schema: z.ZodType<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.issues.map((issue: z.ZodIssue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      next(error);
    }
  };
};
