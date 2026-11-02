import { Router } from "express";
import {activateAccommodation, createAccommodation, deleteAccommodation, getAccommodationDetails,
        getAccommodations, getAdminAccommodations, updateAccommodation,  } from "../controllers/accommodationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Admin-only route: list active and inactive hotel branches.
// Keep this BEFORE /:id so "admin" is not treated as an accommodation ID.
router.get("/admin", authenticateToken, requireRole("admin"), getAdminAccommodations);

// Public routes: browse hotel branches.
router.get("/", getAccommodations);
router.get("/:id", getAccommodationDetails);

// Admin-only route: create a hotel branch.
router.post("/", authenticateToken, requireRole("admin"), createAccommodation);

// Admin-only route: update a hotel branch.
router.put("/:id", authenticateToken, requireRole("admin"), updateAccommodation);

// Admin-only route: deactivate a hotel branch.
router.delete("/:id", authenticateToken, requireRole("admin"), deleteAccommodation);

// Admin-only route: reactivate a hotel branch.
router.patch("/:id/activate", authenticateToken, requireRole("admin"), activateAccommodation);

export default router;
