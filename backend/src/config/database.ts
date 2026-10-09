import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Configure a reusable pool of PostgreSQL connections.
export const pool = new Pool({host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "hotel_app_db", user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,});

// Log unexpected errors from idle connections.
pool.on("error", (error: Error) => {
  console.error("Unexpected PostgreSQL connection error:", error.message);
});
