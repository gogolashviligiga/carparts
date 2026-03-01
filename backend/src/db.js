import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ No database connection string found");
}

export const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}