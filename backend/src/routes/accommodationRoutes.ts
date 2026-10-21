import { Router } from "express";
import { getAccommodationDetails, getAccommodations } from "../controllers/accommodationController.js";

const router = Router();

// Register the specific ID route alongside the list route.
router.get("/:id", getAccommodationDetails);
router.get("/", getAccommodations);

export default router;
