import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { pool } from "./config/database.js";
import { errorHandler } from "./middleware/errorHandler.js";
import accommodationRoutes from "./routes/accommodationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";

// Load environment variables.
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Configure security headers.
app.use(helmet());

// Allow requests from the frontend.
app.use(cors({origin: process.env.FRONTEND_URL || "http://localhost:5173"}));

// Parse JSON request bodies.
app.use(express.json());

// API health check.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({success: true, message: "Hotel App API is running", timestamp: new Date().toISOString()});
});

// Database health check.
app.get("/api/health/database", async (_req: Request, res: Response) => {
  const result = await pool.query<{ database_name: string }>("SELECT current_database() AS database_name");

  res.status(200).json({success: true, message: "PostgreSQL connection is working", database: result.rows[0].database_name});
});

// Accommodation API routes.
app.use("/api/accommodations", accommodationRoutes);

// Authentication API routes.
app.use("/api/auth", authRoutes);

// Booking API routes.
app.use("/api/bookings", bookingRoutes);

// Admin room-management API routes.
app.use("/api/rooms", roomRoutes);

// Handle unknown API endpoints.
app.use((_req: Request, res: Response) => {
  res.status(404).json({success: false, message: "API endpoint not found"});
});

// Handle unexpected errors after routes.
app.use(errorHandler);

// Start the server.
app.listen(PORT, () => {
  console.log(`Hotel App API running at http://localhost:${PORT}`);
});
