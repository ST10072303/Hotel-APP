import { Router } from "express";
import { login, register } from "../controllers/authController.js";

const router = Router();

// Register a new customer account.
router.post("/register", register);

// Authenticate an existing customer.
router.post("/login", login);

export default router;
