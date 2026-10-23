import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { createBooking } from "../controllers/bookingController.js";

// Create the router for customer booking endpoints.
const router = Router();

// Require a valid login token for all booking endpoints.
router.use(authenticateToken);

// Only customers can create bookings.
router.post("/", requireRole("customer"), createBooking);

export default router;
