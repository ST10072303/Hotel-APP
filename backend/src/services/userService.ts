import { pool } from "../config/database.js";

// Public account information.
// Sensitive fields such as password_hash are never returned.
export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "customer" | "admin";
  is_active: boolean;
}

// Retrieves a user by their database ID.
// Returns null when the user does not exist.
export const getUserById = async (id: string): Promise<UserProfile | null> => {
  const result = await pool.query<UserProfile>(
    `SELECT id, full_name, email, role, is_active
     FROM users
     WHERE id = $1
     LIMIT 1`, [id]);

  return result.rows[0] ?? null;
};
