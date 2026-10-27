import { Router } from "express";
import {createAccommodation, getAccommodationDetails, getAccommodations,
        updateAccommodation, } from "../controllers/accommodationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Public routes: browse hotel branches.
router.get("/:id", getAccommodationDetails);
router.get("/", getAccommodations);

// Admin-only route: create a hotel branch.
router.post("/", authenticateToken, requireRole("admin"), createAccommodation);

// Admin-only route: update a hotel branch.
router.put("/:id", authenticateToken, requireRole("admin"), updateAccommodation);

export default router;
