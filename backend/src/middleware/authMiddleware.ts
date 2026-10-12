import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth.js";

// Define the authenticated user's information on Express requests.
declare global {
  namespace Express {
    interface Request {user?: {id: string; role: "customer" | "admin";}}
  }
}

// Verifies the JWT supplied in the Authorization header.
// Allows the request to continue only when the token is valid.
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authorizationHeader = req.headers.authorization;

  // Check that the Authorization header uses the Bearer scheme.
  if (!authorizationHeader?.startsWith("Bearer ")) {
    res.status(401).json({success: false, message: "Authentication required. Please provide a valid token."});
    return;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    res.status(401).json({success: false, message: "Authentication required. Please provide a valid token."});
    return;
  }

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret);

    // Ensure the token contains the expected user information.
    if (typeof decoded === "string" || typeof decoded.sub !== "string" || (decoded.role !== "customer" && decoded.role !== "admin")) {
      res.status(401).json({success: false, message: "Invalid or expired token."});
      return;
    }

    // Attach the verified user information to the request.
    req.user = {id: decoded.sub, role: decoded.role};
    next();
  } catch {
    res.status(401).json({success: false, message: "Invalid or expired token."});
  }
};
