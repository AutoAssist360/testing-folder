

/**
 * Wraps an async route handler to catch errors and forward them to Express error handler.
 */
export const asyncWrapper = (
  fn
) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
