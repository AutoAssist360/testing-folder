import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler to catch errors and forward them to Express error handler.
 */
export const asyncWrapper = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
