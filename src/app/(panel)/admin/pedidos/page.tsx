import type { Metadata } from 'next';
import Link from 'next/link';
import type { OrderStatus, Prisma } from '@prisma/client';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { ALL_ORDER_STATUSES, orderStatusLabel } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pedidos' };

const PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<{ estado?: string; q?: string; pagina?: string }>;
};

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { estado, q, pagina } = await searchParams;

  const statusFilter = ALL_ORDER_STATUSES.includes(estado as OrderStatus)
    ? (estado as OrderStatus)
    : null;
  const term = (q ?? '').trim().slice(0, 80);
  const page = Math.max(1, Number(pagina) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(term
      ? {
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { shipFullName: { contains: term, mode: 'insensitive' } },
            { trackingNumber: { contains: term, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(params: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = { estado: statusFilter ?? undefined, q: term || undefined, ...params };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const search = query.toString();
    return search ? `/admin/pedidos?${search}` : '/admin/pedidos';
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Pedidos
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action="/admin/pedidos" method="get" className="flex gap-2">
          {statusFilter ? <input type="hidden" name="estado" value={statusFilter} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={term}
            placeholder="Numero, correo o seguimiento"
            className="field w-64 py-2.5"
            maxLength={80}
          />
          <button type="submit" className="btn-dark btn-sm">
            Buscar
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip href={buildHref({ estado: undefined, pagina: undefined })} active={!statusFilter}>
          Todos ({total})
        </FilterChip>
        {ALL_ORDER_STATUSES.map((status) => (
          <FilterChip
            key={status}
            href={buildHref({ estado: status, pagina: undefined })}
            active={statusFilter === status}
          >
            {orderStatusLabel(status)}
          </FilterChip>
        ))}
      </div>

      <div className="mt-6 border border-sand-dark bg-white">
        {orders.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-muted">
            No hay pedidos que coincidan con el filtro.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Articulos</th>
                  <th>Estado</th>
                  <th>Envio</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
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
                    <td>
                      <p className="text-sm">{order.shipFullName}</p>
                      <p className="text-xs text-ink-muted">{order.email}</p>
                    </td>
                    <td className="tabular-nums">{order._count.items}</td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="text-xs text-ink-muted">
                      {order.trackingNumber ? (
                        <>
                          <span className="block text-ink">{order.carrier ?? 'Transportista'}</span>
                          <span className="font-mono">{order.trackingNumber}</span>
                        </>
                      ) : (
                        '—'
                      )}
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
      </div>

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-widest text-ink-muted">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildHref({ pagina: String(page - 1) })} className="btn-ghost btn-sm">
                Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={buildHref({ pagina: String(page + 1) })} className="btn-ghost btn-sm">
                Siguiente
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`border px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-sand-dark bg-white text-ink-soft hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
