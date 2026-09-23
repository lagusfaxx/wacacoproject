import 'server-only';

import { cached } from './client';
import {
  accountVisitsByDay,
  allItemIds,
  allOrders,
  countItems,
  countUnansweredQuestions,
  getAccount,
  getItems,
  itemVisits,
} from './read';

/**
 * Resumen de Mercado Libre: ventas, visitas, conversion y lo mas vendido.
 *
 * Mercado Libre no expone una "conversion" como tal: se calcula aqui como
 * ventas / visitas, igual que en su panel de metricas. Las visitas son unicas
 * por dia y la API las entrega con hasta 48 horas de retraso, asi que los
 * ultimos dos dias pueden aparecer con menos visitas de las reales.
 */

const TIME_ZONE = 'America/Santiago';
export const SUMMARY_PERIODS = [7, 30, 90];

/** Estados de una venta que cuentan como venta concretada. */
const PAID = new Set(['paid', 'confirmed']);

const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function keyOf(date: string | Date): string {
  return dayKey.format(typeof date === 'string' ? new Date(date) : date);
}

export type ItemRow = {
  id: string;
  title: string;
  thumbnail: string;
  permalink: string;
  price: number;
  stock: number;
  status: string;
  units: number;
  orders: number;
  revenue: number;
  visits: number;
  /** ventas / visitas, en porcentaje. null cuando no hubo visitas. */
  conversion: number | null;
};

export type MlSummary = {
  days: number;
  generatedAt: string;
  currency: string;
  account: {
    nickname: string;
    permalink?: string;
    level?: string | null;
    powerSeller?: string | null;
    claimsRate?: number;
    cancellationsRate?: number;
    delayedRate?: number;
    ratings?: { positive?: number; neutral?: number; negative?: number };
  };
  totals: {
    revenue: number;
    orders: number;
    units: number;
    averageTicket: number;
    buyers: number;
    cancelled: number;
    visits: number;
    conversion: number | null;
    activeItems: number;
    pausedItems: number;
    unansweredQuestions: number;
    outOfStock: number;
  };
  daily: { date: string; revenue: number; orders: number; visits: number }[];
  topSold: ItemRow[];
  topVisited: ItemRow[];
  bestConversion: ItemRow[];
  /** Publicaciones con visitas pero sin ventas: candidatas a revisar precio o fotos. */
  visitsNoSales: ItemRow[];
  /** Publicaciones activas con poco stock. */
  lowStock: ItemRow[];
  truncated: boolean;
};

export async function getSummary(days: number, fresh = false): Promise<MlSummary> {
  const period = SUMMARY_PERIODS.includes(days) ? days : Math.min(Math.max(Math.round(days), 1), 150);
  return cached(`ml:summary:${period}`, 300, () => buildSummary(period), fresh);
}

async function buildSummary(days: number): Promise<MlSummary> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - days * 24 * 60 * 60 * 1000);

  const [account, orders, visitsByDay, activeIds, pausedItems, unanswered] = await Promise.all([
    getAccount(),
    allOrders(desde, hasta),
    accountVisitsByDay(days).catch(() => ({ total_visits: 0, results: [] })),
    allItemIds('active', 500),
    countItems('paused').catch(() => 0),
    countUnansweredQuestions().catch(() => 0),
  ]);

  // --- Ventas -------------------------------------------------------------
  const perItem = new Map<string, { title: string; units: number; orders: number; revenue: number }>();
  const daily = new Map<string, { revenue: number; orders: number; visits: number }>();
  for (let i = days - 1; i >= 0; i--) {
    daily.set(keyOf(new Date(hasta.getTime() - i * 86_400_000)), { revenue: 0, orders: 0, visits: 0 });
  }

  let revenue = 0;
  let units = 0;
  let paidOrders = 0;
  let cancelled = 0;
  let currency = 'CLP';
  const buyers = new Set<number>();

  for (const order of orders) {
    currency = order.currency_id || currency;
    if (order.status === 'cancelled') {
      cancelled += 1;
      continue;
    }
    if (!PAID.has(order.status)) continue;

    paidOrders += 1;
    revenue += order.total_amount;
    if (order.buyer?.id) buyers.add(order.buyer.id);

    const day = daily.get(keyOf(order.date_created));
    if (day) {
      day.revenue += order.total_amount;
      day.orders += 1;
    }

    for (const line of order.order_items) {
      units += line.quantity;
      const row = perItem.get(line.item.id) ?? { title: line.item.title, units: 0, orders: 0, revenue: 0 };
      row.units += line.quantity;
      row.orders += 1;
      row.revenue += line.unit_price * line.quantity;
      perItem.set(line.item.id, row);
    }
  }

  // --- Visitas ------------------------------------------------------------
  for (const point of visitsByDay.results ?? []) {
    const day = daily.get(keyOf(point.date));
    if (day) day.visits += point.total;
  }
  const totalVisits =
    visitsByDay.total_visits || [...daily.values()].reduce((sum, d) => sum + d.visits, 0);

  // Visitas por publicacion: las activas mas las que vendieron (aunque ya no
  // esten activas), con tope para no pedir miles de ids.
  const ids = [...new Set([...perItem.keys(), ...activeIds])].slice(0, 300);
  const [items, visits] = await Promise.all([getItems(ids), itemVisits(ids, desde, hasta)]);

  const rows: ItemRow[] = items.map((item) => {
    const sold = perItem.get(item.id);
    const v = visits.get(item.id) ?? 0;
    const itemOrders = sold?.orders ?? 0;
    return {
      id: item.id,
      title: item.title,
      thumbnail: item.secure_thumbnail || item.thumbnail || '',
      permalink: item.permalink,
      price: item.price,
      stock: item.available_quantity,
      status: item.status,
      units: sold?.units ?? 0,
      orders: itemOrders,
      revenue: sold?.revenue ?? 0,
      visits: v,
      conversion: v > 0 ? (itemOrders / v) * 100 : null,
    };
  });

  const active = rows.filter((row) => row.status === 'active');

  return {
    days,
    generatedAt: new Date().toISOString(),
    currency,
    account: {
      nickname: account.nickname,
      permalink: account.permalink,
      level: account.seller_reputation?.level_id,
      powerSeller: account.seller_reputation?.power_seller_status,
      claimsRate: account.seller_reputation?.metrics?.claims?.rate,
      cancellationsRate: account.seller_reputation?.metrics?.cancellations?.rate,
      delayedRate: account.seller_reputation?.metrics?.delayed_handling_time?.rate,
      ratings: account.seller_reputation?.transactions?.ratings,
    },
    totals: {
      revenue,
      orders: paidOrders,
      units,
      averageTicket: paidOrders ? revenue / paidOrders : 0,
      buyers: buyers.size,
      cancelled,
      visits: totalVisits,
      conversion: totalVisits > 0 ? (paidOrders / totalVisits) * 100 : null,
      activeItems: activeIds.length,
      pausedItems,
      unansweredQuestions: unanswered,
      outOfStock: active.filter((row) => row.stock === 0).length,
    },
    daily: [...daily.entries()].map(([date, d]) => ({ date, ...d })),
    topSold: rows.filter((r) => r.units > 0).sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 15),
    topVisited: rows.filter((r) => r.visits > 0).sort((a, b) => b.visits - a.visits).slice(0, 15),
    // Con menos de 20 visitas la tasa es puro ruido.
    bestConversion: rows
      .filter((r) => r.visits >= 20 && r.conversion !== null)
      .sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))
      .slice(0, 15),
    visitsNoSales: active
      .filter((r) => r.visits >= 20 && r.orders === 0)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 15),
    lowStock: active.filter((r) => r.stock <= 3).sort((a, b) => a.stock - b.stock).slice(0, 15),
    truncated: orders.length >= 2000 || activeIds.length >= 500,
  };
}
