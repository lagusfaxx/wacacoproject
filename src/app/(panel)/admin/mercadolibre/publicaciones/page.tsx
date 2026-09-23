import type { Metadata } from 'next';
import Link from 'next/link';
import { MlForm } from '@/components/admin/ml/ml-form';
import { Empty, MlError, Panel, StatusBadge } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { listItems } from '@/lib/mercadolibre/read';
import { safeMl } from '@/lib/mercadolibre/safe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Publicaciones de Mercado Libre' };

const ESTADOS = ['active', 'paused', 'closed', 'under_review'] as const;
const ORDENES = ['mas_vendidos', 'recientes', 'precio_asc', 'precio_desc'] as const;
const PAGE = 50;

type PageProps = {
  searchParams: Promise<{ estado?: string; q?: string; orden?: string; pagina?: string }>;
};

export default async function MlItemsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const estado = ESTADOS.find((e) => e === sp.estado) ?? 'active';
  const orden = ORDENES.find((o) => o === sp.orden) ?? 'mas_vendidos';
  const q = (sp.q ?? '').trim().slice(0, 120);
  const pagina = Math.max(1, Math.min(20, Number(sp.pagina) || 1));

  const result = await safeMl(() =>
    listItems({ status: estado, q: q || undefined, orden, offset: (pagina - 1) * PAGE, limit: PAGE }),
  );
  if (!result.ok) return <MlError error={result.error} notConnected={result.notConnected} />;
  const { items, paging } = result.data;
  const pages = Math.ceil(paging.total / PAGE);

  const href = (p: number) =>
    `/admin/mercadolibre/publicaciones?${new URLSearchParams({ estado, orden, q, pagina: String(p) })}`;

  return (
    <div className="mt-8 space-y-4">
      <form className="flex flex-wrap items-end gap-3 border border-sand-dark bg-white p-4" method="get">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="ml-q">Buscar</label>
          <input id="ml-q" name="q" defaultValue={q} placeholder="Titulo, id o SKU" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="ml-estado">Estado</label>
          <select id="ml-estado" name="estado" defaultValue={estado} className="field">
            <option value="active">Activas</option>
            <option value="paused">Pausadas</option>
            <option value="closed">Finalizadas</option>
            <option value="under_review">En revision</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ml-orden">Orden</label>
          <select id="ml-orden" name="orden" defaultValue={orden} className="field">
            <option value="mas_vendidos">Mas vendidas</option>
            <option value="recientes">Mas recientes</option>
            <option value="precio_asc">Precio menor</option>
            <option value="precio_desc">Precio mayor</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrar</button>
      </form>

      <Panel title={`${paging.total} publicaciones`}>
        {items.length === 0 ? (
          <Empty>No hay publicaciones con estos filtros.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Publicacion</th>
                  <th>Estado</th>
                  <th className="text-right">Vendidas</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const hasVariations = (item.variations?.length ?? 0) > 0;
                  return (
                    <tr key={item.id}>
                      <td className="max-w-xs">
                        <div className="flex items-center gap-3">
                          {item.secure_thumbnail || item.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.secure_thumbnail || item.thumbnail} alt="" className="h-10 w-10 shrink-0 object-contain" />
                          ) : null}
                          <div className="min-w-0">
                            <Link href={`/admin/mercadolibre/publicaciones/${item.id}`} className="line-clamp-2 font-semibold hover:text-brand">
                              {item.title}
                            </Link>
                            <span className="text-xs text-ink-muted">
                              {item.id}
                              {item.seller_custom_field ? ` · SKU ${item.seller_custom_field}` : ''}
                              {hasVariations ? ` · ${item.variations!.length} variaciones` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className="text-right tabular-nums">{item.sold_quantity}</td>
                      <td>
                        <MlForm op="ml_cambiar_precio" hidden={{ item_id: item.id }} submitLabel="OK" inline>
                          <input
                            name="precio"
                            type="number"
                            min="1"
                            defaultValue={item.price}
                            aria-label={`Precio de ${item.title}`}
                            className="field w-28 py-1.5"
                          />
                        </MlForm>
                        {item.original_price ? (
                          <span className="text-xs text-ink-muted line-through">{formatMoney(item.original_price, item.currency_id)}</span>
                        ) : null}
                      </td>
                      <td>
                        {hasVariations ? (
                          <Link href={`/admin/mercadolibre/publicaciones/${item.id}`} className="text-xs text-brand hover:underline">
                            {item.available_quantity} u. · editar
                          </Link>
                        ) : (
                          <MlForm op="ml_cambiar_stock" hidden={{ item_id: item.id }} submitLabel="OK" inline>
                            <input
                              name="cantidad"
                              type="number"
                              min="0"
                              defaultValue={item.available_quantity}
                              aria-label={`Stock de ${item.title}`}
                              className="field w-20 py-1.5"
                            />
                          </MlForm>
                        )}
                      </td>
                      <td>
                        {item.status === 'active' ? (
                          <MlForm op="ml_cambiar_estado" hidden={{ item_id: item.id, estado: 'paused' }} submitLabel="Pausar" inline />
                        ) : item.status === 'paused' ? (
                          <MlForm op="ml_cambiar_estado" hidden={{ item_id: item.id, estado: 'active' }} submitLabel="Activar" inline />
                        ) : null}
                      </td>
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
          {pagina < pages && pagina < 20 ? <Link href={href(pagina + 1)} className="btn-ghost btn-sm">Siguiente</Link> : null}
        </div>
      ) : null}

      <p className="text-xs text-ink-muted">
        Un cambio de precio de mas del 40% se pide confirmar en la ficha de la publicacion.
      </p>
    </div>
  );
}
