import 'server-only';

import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from './db';

/** Estados que cuentan como venta concretada. */
export const REVENUE_STATUSES: OrderStatus[] = [
  'PAID',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
];

export type DashboardStats = {
  revenueTotal: Prisma.Decimal;
  revenuePeriod: Prisma.Decimal;
  revenuePrevious: Prisma.Decimal;
  revenueChangePercent: number | null;
  ordersPeriod: number;
  ordersPending: number;
  ordersToShip: number;
  averageOrderValue: Prisma.Decimal;
  customersTotal: number;
  customersPeriod: number;
  statusBreakdown: { status: OrderStatus; count: number }[];
  dailyRevenue: { date: string; total: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: string }[];
  lowStock: { id: string; name: string; slug: string; stock: number }[];
};

function daysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export async function getDashboardStats(periodDays = 30): Promise<DashboardStats> {
  const periodStart = daysAgo(periodDays);
  const previousStart = daysAgo(periodDays * 2);

  const [
    revenueAll,
    revenueCurrent,
    revenuePrev,
    ordersPeriodCount,
    ordersPending,
    ordersToShip,
    customersTotal,
    customersPeriod,
    statusGroups,
    topItems,
    lowStock,
    dailyRows,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: periodStart } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: previousStart, lt: periodStart },
      },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.order.count({ where: { status: { in: ['PENDING', 'IN_PROCESS'] } } }),
    prisma.order.count({ where: { status: { in: ['PAID', 'PREPARING'] } } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: periodStart } } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { status: { in: REVENUE_STATUSES } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.product.findMany({
      where: { active: true, stock: { lte: 10 } },
      orderBy: { stock: 'asc' },
      take: 6,
      select: { id: true, name: true, slug: true, stock: true },
    }),
    // Serie diaria para el grafico. Se agrupa en SQL para no traer todos los
    // pedidos a memoria.
    prisma.$queryRaw<{ day: Date; total: Prisma.Decimal; orders: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             COALESCE(SUM("total"), 0) AS total,
             COUNT(*) AS orders
      FROM "Order"
      WHERE "createdAt" >= ${periodStart}
        AND "status" = ANY (${REVENUE_STATUSES}::"OrderStatus"[])
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const revenueTotal = revenueAll._sum.total ?? new Prisma.Decimal(0);
  const revenuePeriod = revenueCurrent._sum.total ?? new Prisma.Decimal(0);
  const revenuePrevious = revenuePrev._sum.total ?? new Prisma.Decimal(0);

  const revenueChangePercent = revenuePrevious.isZero()
    ? revenuePeriod.isZero()
      ? 0
      : null
    : Number(
        revenuePeriod.minus(revenuePrevious).dividedBy(revenuePrevious).times(100).toFixed(1),
      );

  const paidOrders = revenueAll._count || 0;
  const averageOrderValue = paidOrders > 0 ? revenueTotal.dividedBy(paidOrders) : new Prisma.Decimal(0);

  const byDay = new Map(
    dailyRows.map((row) => [
      row.day.toISOString().slice(0, 10),
      { total: Number(row.total), orders: Number(row.orders) },
    ]),
  );

  const dailyRevenue = Array.from({ length: periodDays }, (_, index) => {
    const date = daysAgo(periodDays - 1 - index);
    const key = date.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    return { date: key, total: entry?.total ?? 0, orders: entry?.orders ?? 0 };
  });

  return {
    revenueTotal,
    revenuePeriod,
    revenuePrevious,
    revenueChangePercent,
    ordersPeriod: ordersPeriodCount,
    ordersPending,
    ordersToShip,
    averageOrderValue,
    customersTotal,
    customersPeriod,
    statusBreakdown: statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    dailyRevenue,
    topProducts: topItems.map((item) => ({
      name: item.name,
      quantity: item._sum.quantity ?? 0,
      revenue: (item._sum.lineTotal ?? new Prisma.Decimal(0)).toString(),
    })),
    lowStock,
  };
}
