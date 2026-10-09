import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { pool } from "./config/database.js";

// Load environment variables.
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Configure security headers.
app.use(helmet());

// Allow requests from the frontend.
app.use(cors({origin: process.env.FRONTEND_URL || "http://localhost:5173",}));

// Parse JSON request bodies.
app.use(express.json());

// API health check whether the express server is running.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({success: true, message: "Hotel App API is running", timestamp: new Date().toISOString(),});
});

// Database health check whether the PostgreSQL connection is working.
app.get("/api/health/database", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<{database_name: string;}>("SELECT current_database() AS database_name");

    res.status(200).json({success: true, message: "PostgreSQL connection is working", database: result.rows[0].database_name,});
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({success: false, message: "Database is currently unavailable",});
  }
});

// Handle unknown API endpoints.
app.use((_req: Request, res: Response) => {
  res.status(404).json({success: false, message: "API endpoint not found", });
});

// Start the API server.
app.listen(PORT, () => {
  console.log(`Hotel App API running at http://localhost:${PORT}`);
});
