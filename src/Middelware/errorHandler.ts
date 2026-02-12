import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

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

  console.error("Unhandled Error:", err);

  return res.status(500).json({
    message: "Internal server error",
  });
};
