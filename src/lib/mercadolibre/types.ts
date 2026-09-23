/** Formas (parciales) de las respuestas de la API de Mercado Libre que se usan. */

export type MlVariation = {
  id: number;
  price: number;
  available_quantity: number;
  sold_quantity?: number;
  seller_custom_field?: string | null;
  attribute_combinations?: { name: string; value_name: string | null }[];
};

export type MlItem = {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  base_price?: number;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  status: string;
  sub_status?: string[];
  permalink: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  listing_type_id?: string;
  condition?: string;
  category_id?: string;
  seller_custom_field?: string | null;
  catalog_listing?: boolean;
  health?: number | null;
  date_created?: string;
  last_updated?: string;
  variations?: MlVariation[];
  pictures?: { secure_url?: string; url?: string }[];
  shipping?: { free_shipping?: boolean; logistic_type?: string };
};

export type MlOrderItem = {
  item: { id: string; title: string; variation_id?: number | null; seller_sku?: string | null };
  quantity: number;
  unit_price: number;
  full_unit_price?: number;
  sale_fee?: number;
};

export type MlOrder = {
  id: number;
  status: string;
  status_detail?: unknown;
  date_created: string;
  date_closed?: string;
  total_amount: number;
  paid_amount?: number;
  currency_id: string;
  order_items: MlOrderItem[];
  buyer?: { id: number; nickname?: string };
  shipping?: { id?: number | null };
  pack_id?: number | null;
  tags?: string[];
  payments?: { id: number; status: string; total_paid_amount?: number; date_approved?: string }[];
};

export type MlQuestion = {
  id: number;
  item_id: string;
  text: string;
  status: string;
  date_created: string;
  from?: { id: number };
  answer?: { text: string; date_created: string } | null;
};

export type MlPaging = { total: number; offset: number; limit: number };
