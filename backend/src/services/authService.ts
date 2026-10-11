import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import { authConfig } from "../config/auth.js";

// Data returned after successful authentication.
export interface AuthUser {
    id: string;
    full_name: string;
    email: string;
    role: "customer" | "admin";
}

export interface AuthResult {
    user: AuthUser;
    token: string;
}

// Data accepted when registering a new user.
export interface RegisterInput {
    full_name: string;
    email: string;
    password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const SALT_ROUNDS = 12;

// Register a customer account with a securely hashed password.
export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
    const fullName = input.full_name.trim();
    const email = input.email.trim().toLowerCase();

    const existingUser = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1",  [email]);

    if (existingUser.rows.length > 0) {
        throw new Error("EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const result = await pool.query<AuthUser>(`INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3)
        RETURNING id, full_name, email, role`, [fullName, email, passwordHash]);

    const user = result.rows[0];
    const token = jwt.sign({sub: user.id, role: user.role}, authConfig.jwtSecret, 
      {expiresIn: authConfig.jwtExpiresIn as jwt.SignOptions["expiresIn"]}
    );
    return { user, token };
};

// Authenticate a user with email and password.
export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();

  const result = await pool.query<{id: string; full_name: string; email: string; role: "customer" | "admin";
    is_active: boolean; password_hash: string | null;}>(
    `SELECT id, full_name, email, role, is_active, password_hash
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`, [email]);

  const user = result.rows[0];

  // Use a generic error for missing users and incorrect passwords.
  if (!user || !user.password_hash || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.is_active) {
    throw new Error("ACCOUNT_INACTIVE");
  }

  const safeUser: AuthUser = {id: user.id, full_name: user.full_name, email: user.email, role: user.role};
  const token = jwt.sign({sub: safeUser.id, role: safeUser.role}, authConfig.jwtSecret,
    {expiresIn: authConfig.jwtExpiresIn as jwt.SignOptions["expiresIn"]}
  );

  return {user: safeUser, token};
};
