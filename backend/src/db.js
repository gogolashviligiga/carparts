// backend/src/db.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

function buildConnectionStringFromParts() {
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "";
  const db = process.env.DB_NAME || "postgres";

  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  return `postgres://${auth}@${host}:${port}/${encodeURIComponent(db)}`;
}

const connectionString =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  buildConnectionStringFromParts();

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}