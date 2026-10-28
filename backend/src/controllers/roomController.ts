import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";

// Validate the accommodation ID supplied in the URL.
const accommodationIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Accommodation ID must be a positive integer.");

// GET /api/rooms/branches/:accommodationId
// Retrieve active room types for one active hotel branch.
export const getRoomTypesByAccommodation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Confirm that the request comes from an administrator.
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({success: false, message: "Administrator access is required."});
    return;
  }

  // Validate the branch ID before querying PostgreSQL.
  const validation = accommodationIdSchema.safeParse(req.params.accommodationId);

  if (!validation.success) {
    res.status(400).json({success: false, message: "Invalid accommodation ID."});
    return;
  }

  const accommodationId = validation.data;

  try {
    // Confirm the branch exists and is active.
    const branchResult = await pool.query(
      `SELECT id, name
       FROM accommodations
       WHERE id = $1 AND is_active = TRUE`, [accommodationId]);

    if (branchResult.rows.length === 0) {
      res.status(404).json({success: false, message: "Active hotel branch not found."});
      return;
    }

    // Retrieve active room types belonging to this branch.
    const roomResult = await pool.query(
      `SELECT id, accommodation_id, name, description, capacity, price_per_night,
         total_units, is_active
       FROM room_types
       WHERE accommodation_id = $1
         AND is_active = TRUE
       ORDER BY name ASC, id ASC`, [accommodationId]);

    res.status(200).json({success: true, count: roomResult.rows.length, data: roomResult.rows});
  } catch (error) {
    next(error);
  }
};
