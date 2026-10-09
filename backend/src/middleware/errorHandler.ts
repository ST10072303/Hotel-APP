
import type { ErrorRequestHandler } from "express";

// Handle unexpected errors in one place.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("API error:", error);

  res.status(500).json({success: false, message: "An unexpected server error occurred.",});
};
