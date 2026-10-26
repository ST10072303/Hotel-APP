import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 64) {
  throw new Error("Token must be configured.");
}

export const authConfig = {jwtSecret, jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h"};
