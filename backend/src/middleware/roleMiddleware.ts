import type { Request, Response, NextFunction } from "express";

type UserRole = "customer" | "admin";

// Restricts access to users with an allowed role, use after authenticateToken in protected routes.
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({success: false, message: "Authentication required."});
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({success: false, message: "You do not have permission to access this resource."});
      return;
    }
    next();
  };
};
