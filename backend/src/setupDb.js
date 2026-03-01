import { query, pool } from "./db.js";

async function main() {
  // admins
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // products (multilingual)
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,

      title_ka TEXT NOT NULL,
      title_en TEXT,
      title_ru TEXT,

      description_ka TEXT,
      description_en TEXT,
      description_ru TEXT,

      price_gel NUMERIC(12,2) NOT NULL DEFAULT 0,
      stock_qty INT NOT NULL DEFAULT 0,

      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_new BOOLEAN NOT NULL DEFAULT FALSE,
      is_sale BOOLEAN NOT NULL DEFAULT FALSE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // indexes for faster search
  await query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_products_title_ka ON products (title_ka);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_products_title_en ON products (title_en);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_products_title_ru ON products (title_ru);`);

  console.log("✅ Database tables created");
}

main()
  .catch((e) => {
    console.error("❌ setupDb failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
