export type Product = {
  id: number;
  sku: string;
  title_ka: string;
  title_en?: string | null;
  title_ru?: string | null;
  description_ka?: string | null;
  description_en?: string | null;
  description_ru?: string | null;
  price_gel: number;
  stock_qty: number;

  // ✅ add this
  image_url?: string | null;

  // (keep your existing fields if you have them)
  model_id?: number | null;
  is_featured?: boolean;
  is_new?: boolean;
  is_sale?: boolean;
  created_at?: string;
  updated_at?: string;
};