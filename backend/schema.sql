-- backend/schema.sql
-- CarParts DB schema (Postgres)

BEGIN;

-- -------------------------
-- BRANDS
-- -------------------------
CREATE TABLE IF NOT EXISTS brands (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE,
  logo_url  TEXT
);

-- -------------------------
-- MODELS (belongs to brand)
-- -------------------------
CREATE TABLE IF NOT EXISTS models (
  id        BIGSERIAL PRIMARY KEY,
  brand_id  BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  UNIQUE (brand_id, slug)
);

-- -------------------------
-- PRODUCTS (optional model_id)
-- -------------------------
CREATE TABLE IF NOT EXISTS products (
  id              BIGSERIAL PRIMARY KEY,
  model_id        BIGINT REFERENCES models(id) ON DELETE SET NULL,

  sku             TEXT NOT NULL UNIQUE,

  title_ka        TEXT NOT NULL,
  title_en        TEXT,
  title_ru        TEXT,

  description_ka  TEXT,
  description_en  TEXT,
  description_ru  TEXT,

  price_gel       NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_qty       INT NOT NULL DEFAULT 0,

  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  is_new          BOOLEAN NOT NULL DEFAULT FALSE,
  is_sale         BOOLEAN NOT NULL DEFAULT FALSE,

  image_url       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------
-- ADMINS
-- -------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------
-- ORDERS
-- -------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               BIGSERIAL PRIMARY KEY,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_note    TEXT,
  total_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'new',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------
-- ORDER ITEMS
-- -------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  sku        TEXT NOT NULL,
  title_ka   TEXT NOT NULL,
  price_gel  NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty        INT NOT NULL DEFAULT 1
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_models_brand_id ON models(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_model_id ON products(model_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

COMMIT;