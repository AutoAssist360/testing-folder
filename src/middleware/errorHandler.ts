import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { z } from "zod";

/**
 * Global error handling middleware — must be registered LAST.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Handle Zod validation errors (e.g. from inline query parsing)
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.issues.map((issue: z.ZodIssue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  console.error("Unhandled Error:", err);

  return res.status(500).json({
    message: "Internal server error",
  });
};
