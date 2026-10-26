import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { createBooking, getMyBookings, cancelBooking } from "../controllers/bookingController.js";

// Create the router for customer booking endpoints.
const router = Router();

// Require a valid login token for all booking endpoints.
router.use(authenticateToken);

// Customers can retrieve their own bookings.
router.get("/", requireRole("customer"), getMyBookings);

// Customers can create bookings.
router.post("/", requireRole("customer"), createBooking);

// Customers can cancel their own eligible bookings.
router.delete("/:bookingId", requireRole("customer"), cancelBooking);

export default router;
