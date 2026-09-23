import 'server-only';

import { getAccessToken } from './auth';
import { cached, chunk, mapLimit, mlFetch } from './client';
import type { MlItem, MlOrder, MlPaging, MlQuestion } from './types';

/**
 * Lecturas de la cuenta de Mercado Libre. Todo lo que muestra el panel y lo
 * que consultan las herramientas MCP sale de aqui.
 */

const ITEM_ATTRIBUTES = [
  'id',
  'title',
  'price',
  'original_price',
  'base_price',
  'currency_id',
  'available_quantity',
  'sold_quantity',
  'status',
  'sub_status',
  'permalink',
  'thumbnail',
  'secure_thumbnail',
  'listing_type_id',
  'condition',
  'category_id',
  'seller_custom_field',
  'catalog_listing',
  'health',
  'date_created',
  'last_updated',
  'variations',
  'shipping',
].join(',');

export async function sellerId(): Promise<string> {
  return (await getAccessToken()).userId;
}

/** Formato de fecha que esperan los filtros de la API. */
export function mlDate(date: Date): string {
  return date.toISOString().replace('Z', '-00:00');
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

export type MlAccount = {
  id: number;
  nickname: string;
  site_id: string;
  permalink?: string;
  points?: number;
  seller_reputation?: {
    level_id?: string | null;
    power_seller_status?: string | null;
    transactions?: {
      total?: number;
      completed?: number;
      canceled?: number;
      ratings?: { positive?: number; neutral?: number; negative?: number };
    };
    metrics?: Record<string, { rate?: number; value?: number; period?: string } | undefined>;
  };
};

export async function getAccount(): Promise<MlAccount> {
  return cached('ml:account', 300, () => mlFetch<MlAccount>('/users/me'));
}

// ---------------------------------------------------------------------------
// Publicaciones
// ---------------------------------------------------------------------------

export async function getItems(ids: string[]): Promise<MlItem[]> {
  const batches = chunk(ids, 20);
  const results = await mapLimit(batches, 3, (batch) =>
    mlFetch<{ code: number; body: MlItem }[]>('/items', {
      query: { ids: batch.join(','), attributes: ITEM_ATTRIBUTES },
    }),
  );
  return results.flat().filter((r) => r.code === 200).map((r) => r.body);
}

export async function listItems(input: {
  status?: 'active' | 'paused' | 'closed' | 'under_review' | 'inactive';
  q?: string;
  sku?: string;
  offset?: number;
  limit?: number;
  orden?: 'mas_vendidos' | 'precio_asc' | 'precio_desc' | 'recientes';
}) {
  const seller = await sellerId();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 50);
  const sort =
    input.orden === 'precio_asc'
      ? 'price_asc'
      : input.orden === 'precio_desc'
        ? 'price_desc'
        : input.orden === 'recientes'
          ? 'start_time_desc'
          : input.orden === 'mas_vendidos'
            ? 'sold_quantity_desc'
            : undefined;

  const search = await mlFetch<{ results: string[]; paging: MlPaging }>(
    `/users/${seller}/items/search`,
    {
      query: {
        status: input.status,
        q: input.q,
        seller_sku: input.sku,
        offset: input.offset ?? 0,
        limit,
        orders: sort,
      },
    },
  );

  let items = await getItems(search.results);
  // Respaldo por si la API ignora `q`: el filtro por titulo tambien se aplica aqui.
  if (input.q) {
    const needle = input.q.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.id.toLowerCase() === needle ||
        (item.seller_custom_field ?? '').toLowerCase().includes(needle),
    );
  }
  return { items, paging: search.paging };
}

/** Todos los ids de publicaciones con un estado dado (hasta `max`). */
export async function allItemIds(status: string, max = 1000): Promise<string[]> {
  const seller = await sellerId();
  const ids: string[] = [];
  for (let offset = 0; offset < max; offset += 50) {
    const page = await mlFetch<{ results: string[]; paging: MlPaging }>(
      `/users/${seller}/items/search`,
      { query: { status, offset, limit: 50 } },
    );
    ids.push(...page.results);
    if (offset + 50 >= page.paging.total || page.results.length === 0) break;
  }
  return ids;
}

export async function getItem(itemId: string) {
  const [item, description] = await Promise.all([
    mlFetch<MlItem>(`/items/${itemId}`),
    mlFetch<{ plain_text?: string }>(`/items/${itemId}/description`).catch(() => null),
  ]);
  return { ...item, description: description?.plain_text ?? '' };
}

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export async function listOrders(input: {
  desde?: Date;
  hasta?: Date;
  estado?: 'paid' | 'cancelled' | 'confirmed' | 'payment_required' | 'payment_in_process' | 'invalid';
  itemId?: string;
  offset?: number;
  limit?: number;
}) {
  const seller = await sellerId();
  return mlFetch<{ results: MlOrder[]; paging: MlPaging }>('/orders/search', {
    query: {
      seller,
      'order.status': input.estado,
      'order.date_created.from': input.desde ? mlDate(input.desde) : undefined,
      'order.date_created.to': input.hasta ? mlDate(input.hasta) : undefined,
      item: input.itemId,
      sort: 'date_desc',
      offset: input.offset ?? 0,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 50),
    },
  });
}

/** Todas las ventas de un periodo (con tope, para no recorrer anos de historia). */
export async function allOrders(desde: Date, hasta: Date, max = 2000): Promise<MlOrder[]> {
  const orders: MlOrder[] = [];
  for (let offset = 0; offset < max; offset += 50) {
    const page = await listOrders({ desde, hasta, offset, limit: 50 });
    orders.push(...page.results);
    if (offset + 50 >= page.paging.total || page.results.length === 0) break;
  }
  return orders;
}

export async function getOrder(orderId: string) {
  const order = await mlFetch<MlOrder>(`/orders/${orderId}`);
  const shipment = order.shipping?.id
    ? await mlFetch<Record<string, unknown>>(`/shipments/${order.shipping.id}`, {
        headers: { 'x-format-new': 'true' },
      }).catch(() => null)
    : null;
  return { ...order, shipment };
}

// ---------------------------------------------------------------------------
// Preguntas
// ---------------------------------------------------------------------------

export async function listQuestions(input: {
  estado?: 'UNANSWERED' | 'ANSWERED';
  itemId?: string;
  offset?: number;
  limit?: number;
}) {
  const seller = await sellerId();
  const data = await mlFetch<{ questions: MlQuestion[]; total: number }>('/questions/search', {
    query: {
      seller_id: seller,
      item: input.itemId,
      status: input.estado,
      sort_fields: 'date_created',
      sort_types: 'DESC',
      api_version: 4,
      offset: input.offset ?? 0,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 50),
    },
  });

  // El titulo de la publicacion hace falta para entender la pregunta.
  const ids = [...new Set(data.questions.map((q) => q.item_id))];
  const items = ids.length ? await getItems(ids) : [];
  const titles = new Map(items.map((item) => [item.id, item.title]));
  return {
    total: data.total,
    questions: data.questions.map((q) => ({ ...q, item_title: titles.get(q.item_id) ?? '' })),
  };
}

// ---------------------------------------------------------------------------
// Promociones
// ---------------------------------------------------------------------------

export type MlPromotion = {
  id: string;
  type: string;
  status: string;
  name?: string;
  start_date?: string;
  finish_date?: string;
  deadline_date?: string;
  benefits?: unknown;
};

export async function listPromotions() {
  const seller = await sellerId();
  return mlFetch<{ results: MlPromotion[]; paging?: MlPaging }>(
    `/seller-promotions/users/${seller}`,
    { query: { app_version: 'v2' } },
  );
}

export async function getItemPromotions(itemId: string) {
  return mlFetch<unknown[]>(`/seller-promotions/items/${itemId}`, {
    query: { app_version: 'v2' },
  });
}

export async function getPromotionItems(input: {
  promotionId: string;
  promotionType: string;
  estado?: 'candidate' | 'pending' | 'started' | 'finished';
  searchAfter?: string;
}) {
  return mlFetch<unknown>(`/seller-promotions/promotions/${input.promotionId}/items`, {
    query: {
      promotion_type: input.promotionType,
      status: input.estado,
      search_after: input.searchAfter,
      app_version: 'v2',
    },
  });
}

// ---------------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------------

/** Visitas por dia de toda la cuenta. La API tiene datos hasta 150 dias atras. */
export async function accountVisitsByDay(days: number) {
  const seller = await sellerId();
  const data = await mlFetch<{ total_visits: number; results: { date: string; total: number }[] }>(
    `/users/${seller}/items_visits/time_window`,
    { query: { last: Math.min(days, 150), unit: 'day' } },
  );
  return data;
}

/** Visitas totales por publicacion en un rango de fechas. */
export async function itemVisits(ids: string[], desde: Date, hasta: Date): Promise<Map<string, number>> {
  const visits = new Map<string, number>();
  const batches = chunk([...new Set(ids)], 20);
  await mapLimit(batches, 3, async (batch) => {
    const data = await mlFetch<
      { item_id: string; total_visits: number }[] | { item_id: string; total_visits: number }
    >('/items/visits', {
      query: { ids: batch.join(','), date_from: mlDate(desde), date_to: mlDate(hasta) },
    }).catch(() => []);
    for (const row of Array.isArray(data) ? data : [data]) {
      if (row?.item_id) visits.set(row.item_id, row.total_visits ?? 0);
    }
  });
  return visits;
}

/** Visitas por dia de una publicacion. */
export async function itemVisitsByDay(itemId: string, days: number) {
  return mlFetch<{ item_id: string; total_visits: number; results: { date: string; total: number }[] }>(
    `/items/${itemId}/visits/time_window`,
    { query: { last: Math.min(days, 150), unit: 'day' } },
  );
}

/** Conteo rapido (solo el total) de un listado. */
export async function countItems(status: string): Promise<number> {
  const seller = await sellerId();
  const data = await mlFetch<{ paging: MlPaging }>(`/users/${seller}/items/search`, {
    query: { status, limit: 1 },
  });
  return data.paging.total;
}

export async function countUnansweredQuestions(): Promise<number> {
  const seller = await sellerId();
  const data = await mlFetch<{ total: number }>('/questions/search', {
    query: { seller_id: seller, status: 'UNANSWERED', api_version: 4, limit: 1 },
  });
  return data.total;
}
