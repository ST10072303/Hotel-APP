import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { loginUser, registerUser,} from "../services/authService.js";
import { getUserById } from "../services/userService.js";

// Validate registration input.
const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

// Validate login input.
const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

//POsT /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({success: false, message: "Invalid registration details",
    errors: validation.error.issues.map((issue) => ({field: issue.path.join("."), message: issue.message}))});
    return;
  }

  try {
    const result = await registerUser(validation.data);

    res.status(201).json({success: true, message: "Account registered successfully", data: result});
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      res.status(409).json({success: false, message: "An account with this email already exists"});
      return;
    }
    next(error);
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({success: false, message: "Invalid login details", errors: validation.error.issues.map((issue) => ({
        field: issue.path.join("."), message: issue.message}))});
    return;
  }

  try {
    const result = await loginUser(validation.data);
    res.status(200).json({success: true, message: "Login successful", data: result});
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      res.status(401).json({success: false, message: "Invalid email or password"});
      return;
    }

    if (error instanceof Error && error.message === "ACCOUNT_INACTIVE") {
      res.status(403).json({success: false, message: "This account is inactive"});
      return;
    }
    next(error);
  }
};

// Returns the profile of the authenticated user, Requires a valid JWT.
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({success: false, message: "Authentication required."});
      return;
    }

    const user = await getUserById(req.user.id);

    if (!user) {
      res.status(404).json({success: false, message: "User not found."});
      return;
    }

    if (!user.is_active) {
      res.status(403).json({success: false, message: "This account is inactive."});
      return;
    }

    res.status(200).json({success: true, data: user});
  } catch (error) {
    next(error);
  }
};
