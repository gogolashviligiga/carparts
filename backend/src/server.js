// backend/src/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

import { query } from "./db.js";
import { signAdminToken, requireAdmin } from "./auth.js";

dotenv.config();

const app = express();

// -------------------- MIDDLEWARE --------------------

// No caching (Safari / 304 issues)
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// CORS
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:4200")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// helper to avoid repeating try/catch
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// -------------------- HELPERS --------------------

const toStr = (v) => (v == null ? "" : String(v));
const clean = (v) => toStr(v).trim();

const normalizeEmptyToNull = (v) => {
  const s = clean(v);
  return s ? s : null;
};

const allowedStatuses = new Set(["new", "processing", "done", "cancelled"]);
const normalizeStatus = (s) => {
  const v = clean(s).toLowerCase();
  return allowedStatuses.has(v) ? v : "";
};

// -------------------- BASIC ROUTES --------------------

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get(
  "/api/db-check",
  asyncHandler(async (req, res) => {
    const r = await query("SELECT NOW() as now");
    res.json({ ok: true, now: r.rows[0].now });
  })
);

app.get("/", (req, res) => {
  res.json({ ok: true, service: "carparts-api" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// -------------------- PUBLIC: ORDER TRACKING --------------------
// GET /api/orders/:id?phone=599123123
app.get(
  "/api/orders/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const phone = clean(req.query.phone);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid order id" });
    }
    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone is required" });
    }

    // ✅ include address + note now
    const orderRes = await query(
      `
      SELECT
        id,
        customer_name,
        customer_phone,
        customer_address,
        customer_note,
        total_price,
        status,
        created_at
      FROM orders
      WHERE id = $1 AND customer_phone = $2
      `,
      [id, phone]
    );

    const order = orderRes.rows[0];
    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    const itemsRes = await query(
      `
      SELECT id, order_id, product_id, sku, title_ka, price_gel, qty
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    res.json({ ok: true, order, items: itemsRes.rows });
  })
);

// -------------------- ADMIN AUTH --------------------

app.post(
  "/api/admin/seed",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }

    const countRes = await query("SELECT COUNT(*)::int AS c FROM admins");
    if (countRes.rows[0].c > 0) {
      return res.status(409).json({ ok: false, error: "Admin already exists" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const r = await query(
      "INSERT INTO admins (email, password_hash) VALUES ($1,$2) RETURNING id,email",
      [String(email).toLowerCase(), password_hash]
    );

    const admin = r.rows[0];
    const token = signAdminToken(admin);
    res.json({ ok: true, admin, token });
  })
);

app.post(
  "/api/admin/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }

    const r = await query("SELECT id,email,password_hash FROM admins WHERE email=$1", [
      String(email).toLowerCase(),
    ]);

    const admin = r.rows[0];
    if (!admin) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const token = signAdminToken({ id: admin.id, email: admin.email });
    res.json({ ok: true, token });
  })
);

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

// -------------------- ADMIN: PRODUCTS --------------------

app.get(
  "/api/admin/products",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const q = clean(req.query.search);

    const params = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `
        WHERE sku ILIKE $1
           OR title_ka ILIKE $1
           OR title_en ILIKE $1
           OR title_ru ILIKE $1
      `;
    }

    const r = await query(
      `
      SELECT
        id,
        model_id,
        sku,
        title_ka, title_en, title_ru,
        description_ka, description_en, description_ru,
        price_gel, stock_qty,
        is_featured, is_new, is_sale,
        image_url,
        created_at, updated_at
      FROM products
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
      `,
      params
    );

    res.json({ ok: true, items: r.rows });
  })
);

app.post(
  "/api/admin/products",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body || {};

    const sku = clean(b.sku);
    const title_ka = clean(b.title_ka);
    if (!sku || !title_ka) {
      return res.status(400).json({ ok: false, error: "sku and title_ka required" });
    }

    const model_id = b.model_id == null || b.model_id === "" ? null : Number(b.model_id);
    if (b.model_id != null && b.model_id !== "" && !Number.isFinite(model_id)) {
      return res.status(400).json({ ok: false, error: "Invalid model_id" });
    }

    const image_url = normalizeEmptyToNull(b.image_url);

    const r = await query(
      `
      INSERT INTO products
        (model_id, sku, title_ka, title_en, title_ru,
         description_ka, description_en, description_ru,
         price_gel, stock_qty, is_featured, is_new, is_sale,
         image_url)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
      `,
      [
        model_id,
        sku,
        title_ka,
        b.title_en ?? null,
        b.title_ru ?? null,
        b.description_ka ?? null,
        b.description_en ?? null,
        b.description_ru ?? null,
        Number(b.price_gel ?? 0),
        Number(b.stock_qty ?? 0),
        !!b.is_featured,
        !!b.is_new,
        !!b.is_sale,
        image_url,
      ]
    );

    res.json({ ok: true, item: r.rows[0] });
  })
);

app.put(
  "/api/admin/products/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const b = req.body || {};

    // Support: "not sent" vs "sent null"
    const hasModelId = Object.prototype.hasOwnProperty.call(b, "model_id");
    const hasImageUrl = Object.prototype.hasOwnProperty.call(b, "image_url");

    const model_id =
      !hasModelId
        ? undefined
        : b.model_id === null || b.model_id === ""
        ? null
        : Number(b.model_id);

    if (model_id !== undefined && model_id !== null && !Number.isFinite(model_id)) {
      return res.status(400).json({ ok: false, error: "Invalid model_id" });
    }

    const image_url =
      !hasImageUrl ? undefined : normalizeEmptyToNull(b.image_url);

    const r = await query(
      `
      UPDATE products SET
        model_id        = CASE WHEN $16 THEN $2 ELSE model_id END,
        sku             = COALESCE($3, sku),
        title_ka        = COALESCE($4, title_ka),
        title_en        = COALESCE($5, title_en),
        title_ru        = COALESCE($6, title_ru),
        description_ka  = COALESCE($7, description_ka),
        description_en  = COALESCE($8, description_en),
        description_ru  = COALESCE($9, description_ru),
        price_gel       = COALESCE($10, price_gel),
        stock_qty       = COALESCE($11, stock_qty),
        is_featured     = COALESCE($12, is_featured),
        is_new          = COALESCE($13, is_new),
        is_sale         = COALESCE($14, is_sale),
        image_url       = CASE WHEN $15 THEN $17 ELSE image_url END,
        updated_at      = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        model_id === undefined ? null : model_id, // $2
        b.sku ? clean(b.sku) : null,
        b.title_ka ? clean(b.title_ka) : null,
        b.title_en != null ? clean(b.title_en) : null,
        b.title_ru != null ? clean(b.title_ru) : null,
        b.description_ka != null ? clean(b.description_ka) : null,
        b.description_en != null ? clean(b.description_en) : null,
        b.description_ru != null ? clean(b.description_ru) : null,
        b.price_gel != null ? Number(b.price_gel) : null,
        b.stock_qty != null ? Number(b.stock_qty) : null,
        b.is_featured != null ? !!b.is_featured : null,
        b.is_new != null ? !!b.is_new : null,
        b.is_sale != null ? !!b.is_sale : null,
        hasImageUrl, // $15
        hasModelId, // $16
        image_url === undefined ? null : image_url, // $17
      ]
    );

    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item: r.rows[0] });
  })
);

app.delete(
  "/api/admin/products/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const r = await query("DELETE FROM products WHERE id=$1 RETURNING id", [id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

    res.json({ ok: true });
  })
);

// -------------------- PUBLIC: BRANDS + MODELS --------------------

app.get(
  "/api/brands",
  asyncHandler(async (req, res) => {
    const r = await query(
      `
      SELECT id, name, slug, logo_url
      FROM brands
      ORDER BY name ASC
      `
    );
    res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/api/brands/:brandId/models",
  asyncHandler(async (req, res) => {
    const brandId = Number(req.params.brandId);
    if (!Number.isFinite(brandId) || brandId <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid brandId" });
    }

    const r = await query(
      `
      SELECT id, brand_id, name, slug
      FROM models
      WHERE brand_id = $1
      ORDER BY name ASC
      `,
      [brandId]
    );

    res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/api/models",
  asyncHandler(async (req, res) => {
    const r = await query(
      `
      SELECT m.id, m.brand_id, m.name, m.slug,
             b.name AS brand_name, b.slug AS brand_slug
      FROM models m
      JOIN brands b ON b.id = m.brand_id
      ORDER BY b.name ASC, m.name ASC
      `
    );
    res.json({ ok: true, items: r.rows });
  })
);

// Products filtered by model_id
app.get(
  "/api/models/:modelId/products",
  asyncHandler(async (req, res) => {
    const modelId = Number(req.params.modelId);
    if (!Number.isFinite(modelId) || modelId <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid modelId" });
    }

    const r = await query(
      `
      SELECT id, model_id, sku, title_ka, title_en, title_ru,
             price_gel, stock_qty, is_featured, is_new, is_sale,
             image_url
      FROM products
      WHERE model_id = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [modelId]
    );

    res.json({ ok: true, items: r.rows });
  })
);

// -------------------- PUBLIC: PRODUCTS --------------------

app.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    const q = clean(req.query.search);

    const params = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `
        WHERE sku ILIKE $1
           OR title_ka ILIKE $1
           OR title_en ILIKE $1
           OR title_ru ILIKE $1
      `;
    }

    const r = await query(
      `
      SELECT id, model_id, sku, title_ka, title_en, title_ru,
             price_gel, stock_qty, is_featured, is_new, is_sale,
             image_url
      FROM products
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
      `,
      params
    );

    res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/api/products/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const r = await query("SELECT * FROM products WHERE id=$1", [id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

    res.json({ ok: true, item: r.rows[0] });
  })
);

// -------------------- PUBLIC: ORDERS (CREATE ONLY) --------------------

app.post(
  "/api/orders",
  asyncHandler(async (req, res) => {
    const b = req.body || {};

    const customer_name = clean(b.customer_name);
    const customer_phone = clean(b.customer_phone);

    // ✅ NEW
    const customer_address = clean(b.customer_address);
    const customer_note = normalizeEmptyToNull(b.customer_note);

    const total_price = Number(b.total_price || 0);
    const items = Array.isArray(b.items) ? b.items : [];

    // require name/phone/address
    if (!customer_name || !customer_phone || !customer_address) {
      return res.status(400).json({
        ok: false,
        error: "customer_name, customer_phone, customer_address required",
      });
    }

    if (!items.length) {
      return res.status(400).json({ ok: false, error: "items required" });
    }

    // Validate items
    for (const it of items) {
      const product_id = Number(it.product_id ?? it.id);
      const qty = Number(it.qty || 0);
      const price = Number(it.price_gel || 0);

      if (
        !Number.isFinite(product_id) ||
        !clean(it.sku) ||
        !clean(it.title_ka) ||
        !Number.isFinite(price) ||
        qty <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error: "Each item must have product_id(or id), sku, title_ka, price_gel, qty (>0)",
        });
      }
    }

    await query("BEGIN");
    try {
      // ✅ Save address + note
      const orderRes = await query(
        `
        INSERT INTO orders
          (customer_name, customer_phone, customer_address, customer_note, total_price, status)
        VALUES
          ($1,$2,$3,$4,$5,'new')
        RETURNING
          id, customer_name, customer_phone, customer_address, customer_note,
          total_price, status, created_at
        `,
        [customer_name, customer_phone, customer_address, customer_note, total_price]
      );

      const order = orderRes.rows[0];

      for (const it of items) {
        const product_id = Number(it.product_id ?? it.id);
        await query(
          `
          INSERT INTO order_items (order_id, product_id, sku, title_ka, price_gel, qty)
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            order.id,
            product_id,
            clean(it.sku),
            clean(it.title_ka),
            Number(it.price_gel),
            Number(it.qty),
          ]
        );
      }

      await query("COMMIT");
      res.json({ ok: true, item: order });
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }
  })
);

// -------------------- ADMIN: ORDERS --------------------

// ✅ List orders now includes address + note (so UI can show it in the row)
app.get(
  "/api/admin/orders",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const r = await query(
      `
      SELECT
        id,
        customer_name,
        customer_phone,
        customer_address,
        customer_note,
        total_price,
        status,
        created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 500
      `
    );
    res.json({ ok: true, items: r.rows });
  })
);

// Update status
app.put(
  "/api/admin/orders/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const status = normalizeStatus(req.body?.status);

    if (!Number.isFinite(id) || id <= 0 || !status) {
      return res.status(400).json({ ok: false, error: "Invalid id or status" });
    }

    const r = await query(
      `
      UPDATE orders
      SET status=$1
      WHERE id=$2
      RETURNING
        id, customer_name, customer_phone, customer_address, customer_note,
        total_price, status, created_at
      `,
      [status, id]
    );

    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item: r.rows[0] });
  })
);

// Get items for an order (used for expand details)
app.get(
  "/api/admin/orders/:id/items",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const r = await query(
      `
      SELECT id, order_id, product_id, sku, title_ka, price_gel, qty
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    res.json({ ok: true, items: r.rows });
  })
);

// ✅ Optional: one endpoint that returns order + items together (nice for “click to open”)
app.get(
  "/api/admin/orders/:id/details",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const orderRes = await query(
      `
      SELECT
        id,
        customer_name,
        customer_phone,
        customer_address,
        customer_note,
        total_price,
        status,
        created_at
      FROM orders
      WHERE id = $1
      `,
      [id]
    );

    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ ok: false, error: "Not found" });

    const itemsRes = await query(
      `
      SELECT id, order_id, product_id, sku, title_ka, price_gel, qty
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    res.json({ ok: true, order, items: itemsRes.rows });
  })
);

// Delete order
app.delete(
  "/api/admin/orders/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    await query("BEGIN");
    try {
      await query("DELETE FROM order_items WHERE order_id=$1", [id]);

      const r = await query("DELETE FROM orders WHERE id=$1 RETURNING id", [id]);
      if (!r.rows[0]) {
        await query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "Not found" });
      }

      await query("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }
  })
);

// -------------------- GLOBAL ERROR HANDLER --------------------

app.use((err, req, res, next) => {
  console.error("❌ UNHANDLED ERROR:", err);
  res.status(500).json({ ok: false, error: err.message || "Server error" });
});

// -------------------- START --------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});