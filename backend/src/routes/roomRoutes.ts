import { Router } from "express";
import { getRoomTypesByAccommodation } from "../controllers/roomController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// All room-management routes require administrator authentication.
router.use(authenticateToken, requireRole("admin"));

// Retrieve active room types for a specific hotel branch.
router.get("/branches/:accommodationId", getRoomTypesByAccommodation);

export default router;
