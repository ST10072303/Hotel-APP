import { Router } from "express";
import { login, register, getCurrentUser } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

// Public authentication routes.
router.post("/register", register);
router.post("/login", login);

// Protected route: requires a valid JWT.
router.get("/me", authenticateToken, getCurrentUser);

export default router;
