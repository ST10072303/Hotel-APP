import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";

// POST /api/rooms
// Creates a room type for an active hotel branch.
const createRoomTypeSchema = z.object({accommodation_id: z.string().regex(
  /^[1-9]\d*$/, "Accommodation ID must be a positive integer."),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  capacity: z.number().int().min(1),
  price_per_night: z.number().finite().min(0.01),
  total_units: z.number().int().min(1)}).strict();

export const createRoomType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Only administrators can create room types.
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({success: false, message: "Administrator access is required."});
    return;
  }

  // Validate the submitted room details.
  const validation = createRoomTypeSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({success: false, message: "Invalid room type details.", errors: validation.error.issues.map((issue) => ({
      field: issue.path.join("."), message: issue.message}))
    });
    return;
  }

  const {accommodation_id, name, description, capacity, price_per_night, total_units} = validation.data;

  try {
    // Ensure the selected hotel branch exists and is active.
    const branchResult = await pool.query(
      `SELECT id
       FROM accommodations
       WHERE id = $1 AND is_active = TRUE`,
      [accommodation_id]);

    if (branchResult.rows.length === 0) {
      res.status(404).json({success: false, message: "Active hotel branch not found."});
      return;
    }

    // Insert the room type and return the saved database record.
    const roomResult = await pool.query(
      `INSERT INTO room_types (accommodation_id, name, description, capacity, price_per_night, total_units, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, accommodation_id, name, description, capacity, price_per_night, total_units, is_active`,
      [accommodation_id, name, description?.trim() || null, capacity, price_per_night, total_units]);

    res.status(201).json({success: true, message: "Room type created successfully.", data: roomResult.rows[0]});
  } catch (error) {
    next(error);
  }
};

// Validate the accommodation ID supplied in the URL.
const accommodationIdSchema = z.string() .regex(/^[1-9]\d*$/, "Accommodation ID must be a positive integer.");


// GET /api/rooms/branches/:accommodationId
// Retrieve active room types for one active hotel branch.
export const getRoomTypesByAccommodation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Confirm that the request comes from an administrator.
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ success: false, message: "Administrator access is required." });
    return;
  }

  // Validate the branch ID before querying PostgreSQL.
  const validation = accommodationIdSchema.safeParse(req.params.accommodationId);

  if (!validation.success) {
    res.status(400).json({ success: false, message: "Invalid accommodation ID." });
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
      res.status(404).json({ success: false, message: "Active hotel branch not found." });
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

    res.status(200).json({ success: true, count: roomResult.rows.length, data: roomResult.rows });
  } catch (error) {
    next(error);
  }
};


/**
 * Validates the editable fields of a room type.
 * The accommodation ID is intentionally not editable here.
 */
const updateRoomTypeSchema = z.object({name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).nullable().optional(),
    capacity: z.number().int().min(1), price_per_night: z.number().finite().min(0.01),
    total_units: z.number().int().min(1)}).strict();

// PUT /api/rooms/:roomTypeId
// Update an existing room type.
export const updateRoomType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({success: false, message: "Administrator access is required."});
    return;
  }

  const idValidation = z .string() .regex(/^[1-9]\d*$/) .safeParse(req.params.roomTypeId);

  if (!idValidation.success) {
    res.status(400).json({success: false, message: "Room type ID must be a positive integer."});
    return;
  }

  const validation = updateRoomTypeSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({success: false, message: "Invalid room type details.", errors: validation.error.issues.map((issue) => ({
        field: issue.path.join("."), message: issue.message}))
    });
    return;
  }

  const {name, description, capacity, price_per_night, total_units} = validation.data;

  try {
    const result = await pool.query(`UPDATE room_types AS rt
       SET name = $1, description = $2, capacity = $3, price_per_night = $4, total_units = $5, updated_at = CURRENT_TIMESTAMP
       FROM accommodations AS a
       WHERE rt.id = $6 AND rt.accommodation_id = a.id AND rt.is_active = TRUE AND a.is_active = TRUE
       RETURNING
         rt.id, rt.accommodation_id, rt.name, rt.description, rt.capacity, rt.price_per_night, rt.total_units, rt.is_active`,
      [name, description?.trim() || null, capacity, price_per_night, total_units, idValidation.data]);

    if (result.rows.length === 0) {
      res.status(404).json({success: false, message: "Active room type not found."});
      return;
    }

    res.status(200).json({success: true, message: "Room type updated successfully.", data: result.rows[0]});
  } catch (error) {
    next(error);
  }
};

