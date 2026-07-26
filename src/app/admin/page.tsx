import type { Metadata } from 'next';
import Link from 'next/link';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getDashboardStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Resumen' };

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [stats, recentOrders] = await Promise.all([
    getDashboardStats(30),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        currency: true,
        email: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
            Resumen
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Ultimos 30 dias</p>
        </div>
        <Link href="/admin/productos/nuevo" className="btn-primary btn-sm py-3">
          Nuevo producto
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ventas del periodo"
          value={formatMoney(stats.revenuePeriod)}
          hint={
            stats.revenueChangePercent === null
              ? 'Sin datos del periodo anterior'
              : `${stats.revenueChangePercent >= 0 ? '+' : ''}${stats.revenueChangePercent}% vs periodo anterior`
          }
          positive={stats.revenueChangePercent !== null && stats.revenueChangePercent >= 0}
        />
        <StatCard
          label="Pedidos del periodo"
          value={String(stats.ordersPeriod)}
          hint={`${stats.ordersPending} esperando pago`}
        />
        <StatCard
          label="Ticket promedio"
          value={formatMoney(stats.averageOrderValue)}
          hint={`Ventas totales ${formatMoney(stats.revenueTotal)}`}
        />
        <StatCard
          label="Clientes"
          value={String(stats.customersTotal)}
          hint={`${stats.customersPeriod} nuevos en el periodo`}
        />
      </div>

      {stats.ordersToShip > 0 ? (
        <Link
          href="/admin/pedidos?estado=PAID"
          className="mt-6 flex items-center justify-between gap-4 border-l-4 border-brand bg-white px-6 py-4 transition-colors hover:bg-brand-50"
        >
          <span className="text-sm text-ink-soft">
            Tienes <strong className="text-ink">{stats.ordersToShip}</strong>{' '}
            {stats.ordersToShip === 1 ? 'pedido pagado pendiente' : 'pedidos pagados pendientes'} de
            despacho.
          </span>
          <span className="font-display text-xs font-bold uppercase tracking-widest text-brand">
            Ver pedidos
          </span>
        </Link>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="border border-sand-dark bg-white p-6">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Ventas por dia
          </h2>
          <div className="mt-6">
            <RevenueChart data={stats.dailyRevenue} />
          </div>
        </section>

        <section className="border border-sand-dark bg-white p-6">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Productos mas vendidos
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">Aun no hay ventas registradas.</p>
          ) : (
            <ol className="mt-5 space-y-4">
              {stats.topProducts.map((product, index) => (
                <li key={product.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-sand font-display text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-ink-muted">{product.quantity} unidades</p>
                  </div>
                  <span className="text-sm tabular-nums">{formatMoney(product.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="border border-sand-dark bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-sand-dark px-6 py-4">
            <h2 className="font-display text-base font-bold uppercase tracking-tight">
              Pedidos recientes
            </h2>
            <Link
              href="/admin/pedidos"
              className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
            >
              Ver todos
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="px-6 py-10 text-sm text-ink-muted">Todavia no hay pedidos.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/admin/pedidos/${order.number}`}
                          className="font-display font-semibold uppercase hover:text-brand"
                        >
                          {order.number}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {new Intl.DateTimeFormat('es-CL', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(order.createdAt)}
                        </p>
                      </td>
                      <td className="max-w-52 truncate text-ink-soft">{order.email}</td>
                      <td>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(order.total, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border border-sand-dark bg-white p-6">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Stock bajo
          </h2>
          {stats.lowStock.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">Todo el catalogo tiene stock suficiente.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {stats.lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/productos/${product.id}`}
                    className="min-w-0 flex-1 truncate text-sm hover:text-brand"
                  >
                    {product.name}
                  </Link>
                  <span
                    className={`badge ${
                      product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {product.stock} u.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
}) {
  return (
    <div className="border border-sand-dark bg-white p-6">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-ink-muted">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p
        className={`mt-2 text-xs ${
          positive === undefined ? 'text-ink-muted' : positive ? 'text-emerald-700' : 'text-red-600'
        }`}
      >
        {hint}
      </p>
    </div>
  );
}
