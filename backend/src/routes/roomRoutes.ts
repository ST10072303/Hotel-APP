import { Router } from "express";
import { createRoomType, getRoomTypesByAccommodation, updateRoomType, } from "../controllers/roomController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// All room-management routes require administrator authentication.
router.use(authenticateToken, requireRole("admin"));

// Create a room type.
router.post("/", createRoomType);

// Retrieve active room types for a specific hotel branch.
router.get("/branches/:accommodationId", getRoomTypesByAccommodation);

// Update an existing room type.
router.put("/:roomTypeId", updateRoomType);

export default router;