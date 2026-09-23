import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, MlError, Panel, StatusBadge } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { listOrders } from '@/lib/mercadolibre/read';
import { safeMl } from '@/lib/mercadolibre/safe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ventas de Mercado Libre' };

const ESTADOS = ['paid', 'cancelled', 'payment_required', 'payment_in_process'] as const;
const PAGE = 50;
const LABELS: Record<(typeof ESTADOS)[number], string> = {
  paid: 'Pagadas',
  cancelled: 'Canceladas',
  payment_required: 'Esperando pago',
  payment_in_process: 'Pago en proceso',
};

type PageProps = { searchParams: Promise<{ estado?: string; pagina?: string }> };

export default async function MlOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const estado = ESTADOS.find((e) => e === sp.estado);
  const pagina = Math.max(1, Math.min(100, Number(sp.pagina) || 1));

  const result = await safeMl(() => listOrders({ estado, offset: (pagina - 1) * PAGE, limit: PAGE }));
  if (!result.ok) return <MlError error={result.error} notConnected={result.notConnected} />;
  const { results, paging } = result.data;
  const pages = Math.ceil(paging.total / PAGE);
  const href = (p: number) => `/admin/mercadolibre/ventas?${new URLSearchParams({ ...(estado ? { estado } : {}), pagina: String(p) })}`;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/mercadolibre/ventas" className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest ${!estado ? 'border-ink bg-ink text-white' : 'border-sand-dark text-ink-soft'}`}>
          Todas
        </Link>
        {ESTADOS.map((e) => (
          <Link key={e} href={`/admin/mercadolibre/ventas?estado=${e}`} className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest ${estado === e ? 'border-ink bg-ink text-white' : 'border-sand-dark text-ink-soft'}`}>
            {LABELS[e]}
          </Link>
        ))}
      </div>

      <Panel title={`${paging.total} ventas`}>
        {results.length === 0 ? (
          <Empty>No hay ventas con este filtro.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Comprador</th>
                  <th>Productos</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Comision</th>
                </tr>
              </thead>
              <tbody>
                {results.map((o) => {
                  const fee = o.order_items.reduce((sum, l) => sum + (l.sale_fee ?? 0) * l.quantity, 0);
                  return (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">
                        {o.id}
                        {o.pack_id ? <span className="block text-ink-muted">Carrito {o.pack_id}</span> : null}
                      </td>
                      <td className="whitespace-nowrap text-xs">{new Date(o.date_created).toLocaleString('es-CL')}</td>
                      <td className="text-sm">{o.buyer?.nickname ?? '—'}</td>
                      <td className="max-w-xs text-sm">
                        {o.order_items.map((l) => (
                          <Link key={`${l.item.id}-${l.item.variation_id ?? ''}`} href={`/admin/mercadolibre/publicaciones/${l.item.id}`} className="line-clamp-1 hover:text-brand">
                            {l.quantity} × {l.item.title}
                          </Link>
                        ))}
                      </td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right tabular-nums">{formatMoney(o.total_amount, o.currency_id)}</td>
                      <td className="text-right tabular-nums text-ink-muted">{fee ? formatMoney(fee, o.currency_id) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {pagina > 1 ? <Link href={href(pagina - 1)} className="btn-ghost btn-sm">Anterior</Link> : null}
          <span className="text-ink-muted">Pagina {pagina} de {pages}</span>
          {pagina < pages && pagina < 100 ? <Link href={href(pagina + 1)} className="btn-ghost btn-sm">Siguiente</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
