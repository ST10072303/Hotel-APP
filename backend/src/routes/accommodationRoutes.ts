import { Router } from "express";
import {activateAccommodation, createAccommodation, deleteAccommodation, getAccommodationDetails,
        getAccommodations, getAdminAccommodations, updateAccommodation,  } from "../controllers/accommodationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Public routes: browse hotel branches.
router.get("/:id", getAccommodationDetails);
router.get("/", getAccommodations);

// Admin-only route: list active and inactive hotel branches.
router.get("/admin", authenticateToken, requireRole("admin"), getAdminAccommodations);

// Admin-only route: create a hotel branch.
router.post("/", authenticateToken, requireRole("admin"), createAccommodation);

// Admin-only route: update a hotel branch.
router.put("/:id", authenticateToken, requireRole("admin"), updateAccommodation);

// Admin-only route: deactivate a hotel branch.
router.delete("/:id", authenticateToken, requireRole("admin"), deleteAccommodation);

// Admin-only route: reactivate an inactive hotel branch.
router.patch("/:id/activate", authenticateToken, requireRole("admin"), activateAccommodation);
export default router;
