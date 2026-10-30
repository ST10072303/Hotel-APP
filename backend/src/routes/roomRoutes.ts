import { Router } from "express";
import { activateRoomType, createRoomType, deactivateRoomType, getRoomTypesByAccommodation, updateRoomType, } from "../controllers/roomController.js";
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

// Deactivate a room type.
router.delete("/:roomTypeId", deactivateRoomType);

// Reactivate an inactive room type.
router.patch("/:roomTypeId/activate", activateRoomType);

export default router;