/**
 * Custom application error class with HTTP status codes.
 */
export class AppError extends Error {
  
  

  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
