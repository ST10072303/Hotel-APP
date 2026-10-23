import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../config/database.js";

// Validate the information required to create a booking.
const createBookingSchema = z.object({
  accommodation_id: z.string().trim().min(1),
  room_type_id: z.string().trim().min(1),
  check_in: z.string().date(),
  check_out: z.string().date(),
  guest_count: z.number().int().positive(),
  quantity: z.number().int().positive(),
  special_requests: z.string().trim().max(2000).optional(),
}).refine(
  (data) => data.check_out > data.check_in,
  {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  }
);

// Calculate the number of nights between two validated dates.
const calculateNights = (checkIn: string, checkOut: string): number => {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();

  return (end - start) / (1000 * 60 * 60 * 24);
};

// Generate a booking reference for the customer.
const generateBookingReference = (): string => {
  return `MH-${randomBytes(6).toString("hex").toUpperCase()}`;
};

// POST /api/bookings
// Create a booking for the authenticated customer.
export const createBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Ensure authentication middleware supplied the user's ID.
  if (!req.user) {
    res.status(401).json({success: false, message: "Authentication required."});
    return;
  }

  // Validate the request body before querying the database.
  const validation = createBookingSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({success: false, message: "Invalid booking details.", errors: validation.error.issues.map((issue) => ({
    field: issue.path.join("."), message: issue.message}))});
    return;
  }

  const {accommodation_id, room_type_id, check_in, check_out, guest_count, quantity, special_requests} = validation.data;

  // Do not allow a customer to book dates that have already passed.
  const today = new Date().toISOString().slice(0, 10);

  if (check_in < today) {
    res.status(400).json({success: false, message: "Check-in cannot be in the past."});
    return;
  }

  const nights = calculateNights(check_in, check_out);

  if (!Number.isInteger(nights) || nights <= 0) {
    res.status(400).json({success: false, message: "Please provide valid check-in and check-out dates."});
    return;
  }

  // Use a transaction so the booking and its room details are saved together.
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Confirm the accommodation and room type exist and are active.
    // Lock the room type to help prevent concurrent overbooking.
    const roomResult = await client.query<{id: string; accommodation_id: string; capacity: number;
      price_per_night: string; total_units: number;}>(
      `SELECT id, accommodation_id, capacity, price_per_night, total_units
       FROM room_types
       WHERE id = $1
         AND accommodation_id = $2
         AND is_active = TRUE
       FOR UPDATE`, [room_type_id, accommodation_id]);

    const roomType = roomResult.rows[0];

    if (!roomType) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(404).json({success: false, message: "The selected room type was not found or is unavailable."});
      return;
    }

    // Check the combined guest capacity across all requested rooms.
    if (guest_count > Number(roomType.capacity) * quantity) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(400).json({success: false, message: "The selected rooms cannot accommodate that many guests."});
      return;
    }

    // Count rooms already booked for any overlapping dates.
    // Cancelled bookings do not consume room inventory.
    const availabilityResult = await client.query<{ booked_units: string }>(
      `SELECT COALESCE(SUM(br.quantity), 0)::text AS booked_units
       FROM booking_rooms br
       INNER JOIN bookings b ON b.id = br.booking_id
       WHERE br.room_type_id = $1
         AND b.status IN ('pending', 'confirmed')
         AND b.check_in < $3::date
         AND b.check_out > $2::date`, [room_type_id, check_in, check_out]);

    const bookedUnits = Number(availabilityResult.rows[0].booked_units);
    const remainingUnits = Number(roomType.total_units) - bookedUnits;

    if (remainingUnits < quantity) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(409).json({success: false, message: "There are not enough rooms available for those dates.",
        data: {requested_rooms: quantity, available_rooms: Math.max(remainingUnits, 0)}});
      return;
    }

    // Calculate the total using the price stored in PostgreSQL.
    const pricePerNight = Number(roomType.price_per_night);
    const totalAmount = (pricePerNight * quantity * nights).toFixed(2);

    // Create the main booking record.
    const bookingReference = generateBookingReference();

    const bookingResult = await client.query<{
      id: string;
      booking_reference: string;
      accommodation_id: string;
      check_in: string;
      check_out: string;
      guest_count: number;
      total_amount: string;
      currency: string;
      status: string;
    }>(`INSERT INTO bookings (booking_reference, user_id, accommodation_id, check_in, check_out,
        guest_count, total_amount, currency, status, special_requests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ZAR', 'pending', $8)
       RETURNING id, booking_reference, accommodation_id, check_in, check_out, guest_count, total_amount, currency, status`,
      [bookingReference, req.user.id, accommodation_id, check_in, check_out, guest_count, totalAmount, special_requests || null]);

    const booking = bookingResult.rows[0];

    // Link the selected room type and quantity to the booking.
    await client.query(
      `INSERT INTO booking_rooms (booking_id, room_type_id, quantity, price_per_night)
       VALUES ($1, $2, $3, $4)`, [booking.id, room_type_id, quantity, pricePerNight]);

    // Commit both database inserts together.
    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({success: true, message: "Booking created successfully. Payment is not yet confirmed.",
      data: {...booking, nights, quantity, price_per_night: pricePerNight.toFixed(2)}});
  } catch (error) {
    // Undo partial changes if an operation fails.
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Booking transaction rollback failed:", rollbackError);
      }
    }

    next(error);
  } finally {
    // Always return the connection to the pool.
    client.release();
  }
};
