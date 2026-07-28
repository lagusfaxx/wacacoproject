import 'server-only';

import { prisma } from './db';
import { REVENUE_STATUSES } from './stats';

/**
 * Estadisticas de visita de la tienda.
 *
 * Los datos salen de la propia base, no de un servicio externo: no hay
 * etiquetas de terceros ni se manda nada fuera. De cada visita se guarda la
 * ruta, de donde venia y si era telefono o computador; nunca la IP ni nada que
 * apunte a una persona concreta.
 */

/** Ventana que define "ahora mismo" en la vista en vivo. */
export const LIVE_MINUTES = 5;

/** Sin actividad durante este rato, la visita se da por terminada. */
export const SESSION_MINUTES = 30;

/** Un carrito con cosas y quieto mas de este rato se considera abandonado. */
export const ABANDONED_MINUTES = 30;

/** Cuanto tiempo se conservan las visitas antes de borrarse solas. */
export const RETENTION_DAYS = 90;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number): Date {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Agrupa el referente por sitio, que es lo unico accionable.
 *
 * La URL completa de una busqueda de Google no dice nada util y ademas es
 * larguisima; lo que importa es "vino de Google" o "vino de Instagram".
 */
export function referrerLabel(referrer: string | null): string {
  if (!referrer) return 'Directo';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (!host) return 'Directo';
    if (host.includes('google.')) return 'Google';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('facebook.') || host === 'l.facebook.com') return 'Facebook';
    if (host.includes('tiktok.')) return 'TikTok';
    if (host.includes('bing.')) return 'Bing';
    return host;
  } catch {
    return 'Directo';
  }
}

export type LiveStats = {
  visitorsNow: number;
  viewsLastHour: number;
  activeCarts: number;
  /** Que estan mirando ahora mismo, de mas visto a menos. */
  watching: { path: string; visitors: number }[];
};

/** Foto del momento: es lo que se refresca solo en el panel. */
export async function getLiveStats(): Promise<LiveStats> {
  const live = minutesAgo(LIVE_MINUTES);

  const [sessions, viewsLastHour, activeCarts, recent] = await Promise.all([
    prisma.pageView.findMany({
      where: { createdAt: { gte: live } },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }),
    prisma.pageView.count({ where: { createdAt: { gte: minutesAgo(60) } } }),
    prisma.cart.count({
      where: { items: { some: {} }, updatedAt: { gte: minutesAgo(ABANDONED_MINUTES) } },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: live } },
      select: { path: true, sessionId: true },
    }),
  ]);

  // Una misma persona recargando no son cinco visitantes en esa pagina.
  const porPagina = new Map<string, Set<string>>();
  for (const view of recent) {
    const set = porPagina.get(view.path) ?? new Set<string>();
    set.add(view.sessionId);
    porPagina.set(view.path, set);
  }

  return {
    visitorsNow: sessions.length,
    viewsLastHour,
    activeCarts,
    watching: [...porPagina.entries()]
      .map(([path, set]) => ({ path, visitors: set.size }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 8),
  };
}

export type TrafficStats = {
  views: number;
  visitors: number;
  viewsToday: number;
  visitorsToday: number;
  orders: number;
  /** Pedidos por cada cien visitantes. */
  conversionPercent: number | null;
  daily: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  topProducts: { slug: string; name: string; views: number }[];
  sources: { label: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
};

/** Trafico del periodo, para las tablas y el grafico del panel. */
export async function getTrafficStats(periodDays = 30): Promise<TrafficStats> {
  const from = daysAgo(periodDays);
  const today = startOfToday();

  const [views, sessions, viewsToday, sessionsToday, orders, rows] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: from } } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: from } },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }),
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: today } },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }),
    prisma.order.count({
      where: { createdAt: { gte: from }, status: { in: REVENUE_STATUSES } },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: from } },
      select: {
        sessionId: true,
        path: true,
        referrer: true,
        device: true,
        productSlug: true,
        createdAt: true,
      },
    }),
  ]);

  // El resto se resuelve en memoria: son como mucho unas decenas de miles de
  // filas por mes y salen mas baratas asi que en seis consultas agrupadas.
  const daily = new Map<string, { views: number; visitors: Set<string> }>();
  const pages = new Map<string, number>();
  const products = new Map<string, number>();
  const sources = new Map<string, Set<string>>();
  const devices = new Map<string, Set<string>>();

  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const bucket = daily.get(day) ?? { views: 0, visitors: new Set<string>() };
    bucket.views += 1;
    bucket.visitors.add(row.sessionId);
    daily.set(day, bucket);

    pages.set(row.path, (pages.get(row.path) ?? 0) + 1);
    if (row.productSlug) products.set(row.productSlug, (products.get(row.productSlug) ?? 0) + 1);

    const source = referrerLabel(row.referrer);
    (sources.get(source) ?? sources.set(source, new Set()).get(source)!).add(row.sessionId);
    (devices.get(row.device) ?? devices.set(row.device, new Set()).get(row.device)!).add(
      row.sessionId,
    );
  }

  const slugs = [...products.keys()];
  const nombres = slugs.length
    ? await prisma.product.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, name: true },
      })
    : [];

  const visitors = sessions.length;

  return {
    views,
    visitors,
    viewsToday,
    visitorsToday: sessionsToday.length,
    orders,
    conversionPercent: visitors > 0 ? (orders / visitors) * 100 : null,
    daily: [...daily.entries()]
      .map(([date, value]) => ({ date, views: value.views, visitors: value.visitors.size }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topPages: [...pages.entries()]
      .map(([path, count]) => ({ path, views: count }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    topProducts: [...products.entries()]
      .map(([slug, count]) => ({
        slug,
        name: nombres.find((p) => p.slug === slug)?.name ?? slug,
        views: count,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    sources: [...sources.entries()]
      .map(([label, set]) => ({ label, visitors: set.size }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 8),
    devices: [...devices.entries()]
      .map(([device, set]) => ({ device, visitors: set.size }))
      .sort((a, b) => b.visitors - a.visitors),
  };
}

export type AbandonedCart = {
  id: string;
  updatedAt: Date;
  email: string | null;
  name: string | null;
  units: number;
  total: string;
  items: { name: string; variant: string | null; quantity: number }[];
};

/**
 * Carritos que quedaron con cosas dentro y sin comprar.
 *
 * Al confirmar un pedido el carrito se vacia, asi que cualquier carrito con
 * articulos y quieto un rato es una compra que no llego a terminarse. El
 * correo solo aparece si la persona tenia sesion iniciada: de un visitante
 * anonimo no se guarda ningun dato de contacto.
 */
export async function getAbandonedCarts(limit = 20): Promise<AbandonedCart[]> {
  const carts = await prisma.cart.findMany({
    where: {
      items: { some: {} },
      updatedAt: { lt: minutesAgo(ABANDONED_MINUTES), gte: daysAgo(RETENTION_DAYS) },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      user: { select: { email: true, name: true } },
      items: {
        include: {
          product: { select: { name: true, price: true } },
          variant: { select: { name: true, priceDelta: true } },
        },
      },
    },
  });

  return carts.map((cart) => {
    // El precio de una variante es el del producto mas su diferencia, igual
    // que en el carrito de la tienda.
    const total = cart.items.reduce((sum, item) => {
      const price = Number(item.product.price) + Number(item.variant?.priceDelta ?? 0);
      return sum + price * item.quantity;
    }, 0);

    return {
      id: cart.id,
      updatedAt: cart.updatedAt,
      email: cart.user?.email ?? null,
      name: cart.user?.name ?? null,
      units: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      total: total.toFixed(0),
      items: cart.items.map((item) => ({
        name: item.product.name,
        variant: item.variant?.name ?? null,
        quantity: item.quantity,
      })),
    };
  });
}

/** Suma de lo que se quedo en carritos abandonados, para la tarjeta de arriba. */
export async function getAbandonedTotal(): Promise<{ count: number; total: number }> {
  const carts = await getAbandonedCarts(200);
  return {
    count: carts.length,
    total: carts.reduce((sum, cart) => sum + Number(cart.total), 0),
  };
}

/**
 * Guarda una vista.
 *
 * Se llama desde la ruta que recibe el aviso del navegador. Devuelve `false`
 * cuando la vista se descarta, para que quien llama no se moleste en escribir.
 */
export async function recordPageView(view: {
  sessionId: string;
  path: string;
  referrer: string | null;
  device: string;
  productSlug: string | null;
}): Promise<boolean> {
  // El panel no es la tienda: contar sus paginas ensuciaria las estadisticas
  // del propietario con sus propias visitas.
  if (view.path.startsWith('/admin') || view.path.startsWith('/api')) return false;

  await prisma.pageView.create({
    data: {
      sessionId: view.sessionId,
      path: view.path.slice(0, 300),
      referrer: view.referrer?.slice(0, 300) || null,
      device: view.device === 'movil' ? 'movil' : 'escritorio',
      productSlug: view.productSlug?.slice(0, 200) || null,
    },
  });

  return true;
}

/** Borra las visitas mas viejas que la ventana de conservacion. */
export async function purgeOldPageViews(): Promise<number> {
  const { count } = await prisma.pageView.deleteMany({
    where: { createdAt: { lt: daysAgo(RETENTION_DAYS) } },
  });
  return count;
}
