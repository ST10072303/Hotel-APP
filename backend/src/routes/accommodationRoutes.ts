import { Router } from "express";
import { createAccommodation, getAccommodationDetails, getAccommodations } from "../controllers/accommodationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Public routes: customers can browse active hotel branches.
router.get("/:id", getAccommodationDetails);
router.get("/", getAccommodations);

// Protected route: only administrators can add branches.
router.post("/", authenticateToken, requireRole("admin"), createAccommodation);

export default router;
