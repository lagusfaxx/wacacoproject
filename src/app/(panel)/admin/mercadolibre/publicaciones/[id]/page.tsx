import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MlForm } from '@/components/admin/ml/ml-form';
import { Empty, MlError, Panel, StatusBadge, Tile } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { getItem, getItemPromotions, itemVisitsByDay, listOrders } from '@/lib/mercadolibre/read';
import { safeMl } from '@/lib/mercadolibre/safe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Publicacion de Mercado Libre' };

type PageProps = { params: Promise<{ id: string }> };

type ItemPromotion = {
  id?: string;
  type?: string;
  status?: string;
  name?: string;
  price?: number;
  original_price?: number;
  suggested_discounted_price?: number;
  start_date?: string;
  finish_date?: string;
  offer_id?: string;
};

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export default async function MlItemPage({ params }: PageProps) {
  await requireAdmin();
  const { id: raw } = await params;
  const id = raw.toUpperCase();
  if (!/^[A-Z]{3}\d{5,15}$/.test(id)) notFound();

  const result = await safeMl(async () => {
    const [item, promotions, visits, orders] = await Promise.all([
      getItem(id),
      getItemPromotions(id).catch(() => []),
      itemVisitsByDay(id, 30).catch(() => null),
      listOrders({ itemId: id, limit: 10 }).catch(() => null),
    ]);
    return { item, promotions: promotions as ItemPromotion[], visits, orders };
  });
  if (!result.ok) return <MlError error={result.error} notConnected={result.notConnected} />;
  const { item, promotions, visits, orders } = result.data;
  const money = (v: number) => formatMoney(v, item.currency_id);
  const variations = item.variations ?? [];

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border border-sand-dark bg-white p-6">
        <div className="flex min-w-0 items-start gap-4">
          {item.secure_thumbnail || item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.secure_thumbnail || item.thumbnail} alt="" className="h-20 w-20 shrink-0 object-contain" />
          ) : null}
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold tracking-tight">{item.title}</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {item.id} · {item.listing_type_id} · {item.condition}
              {item.seller_custom_field ? ` · SKU ${item.seller_custom_field}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={item.status} />
              <a href={item.permalink} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                Ver en Mercado Libre
              </a>
            </div>
          </div>
        </div>
        <Link href="/admin/mercadolibre/publicaciones" className="btn-ghost btn-sm">Volver</Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile value={money(item.price)} label="Precio" hint={item.original_price ? `Antes ${money(item.original_price)}` : undefined} />
        <Tile value={item.available_quantity} label="Stock" />
        <Tile value={item.sold_quantity} label="Vendidas (historico)" />
        <Tile
          value={visits ? visits.total_visits.toLocaleString('es-CL') : '—'}
          label="Visitas 30 dias"
          hint={item.health !== null && item.health !== undefined ? `Calidad ${Math.round(item.health * 100)}%` : undefined}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Precio">
          <div className="p-6">
            <MlForm op="ml_cambiar_precio" hidden={{ item_id: item.id }} submitLabel="Cambiar precio">
              <div>
                <label className="label" htmlFor="precio">Nuevo precio ({item.currency_id})</label>
                <input id="precio" name="precio" type="number" min="1" defaultValue={item.price} className="field" />
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="forzar" className="h-4 w-4 accent-[#E1580E]" />
                Confirmo un cambio de mas del 40%
              </label>
            </MlForm>
            {variations.length > 0 ? (
              <p className="mt-3 text-xs text-ink-muted">Se aplica a todas las variaciones.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Stock">
          <div className="space-y-3 p-6">
            {variations.length === 0 ? (
              <MlForm op="ml_cambiar_stock" hidden={{ item_id: item.id }} submitLabel="Guardar" inline>
                <input name="cantidad" type="number" min="0" defaultValue={item.available_quantity} aria-label="Stock" className="field w-32" />
              </MlForm>
            ) : (
              variations.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm">
                    {(v.attribute_combinations ?? []).map((a) => a.value_name).join(' / ') || v.id}
                    <span className="ml-2 text-xs text-ink-muted">{v.sold_quantity ?? 0} vendidas</span>
                  </span>
                  <MlForm op="ml_cambiar_stock" hidden={{ item_id: item.id, variation_id: v.id }} submitLabel="Guardar" inline>
                    <input name="cantidad" type="number" min="0" defaultValue={v.available_quantity} aria-label="Stock de la variacion" className="field w-24 py-1.5" />
                  </MlForm>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Estado">
          <div className="flex flex-wrap gap-3 p-6">
            {item.status === 'paused' ? (
              <MlForm op="ml_cambiar_estado" hidden={{ item_id: item.id, estado: 'active' }} submitLabel="Activar" inline />
            ) : null}
            {item.status === 'active' ? (
              <MlForm op="ml_cambiar_estado" hidden={{ item_id: item.id, estado: 'paused' }} submitLabel="Pausar" inline />
            ) : null}
            {item.status !== 'closed' ? (
              <MlForm op="ml_cambiar_estado" hidden={{ item_id: item.id, estado: 'closed' }} submitLabel="Finalizar" inline danger>
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="checkbox" name="confirmar" className="h-4 w-4 accent-[#E1580E]" />
                  Entiendo que es irreversible
                </label>
              </MlForm>
            ) : (
              <p className="text-sm text-ink-muted">Publicacion finalizada.</p>
            )}
          </div>
        </Panel>

        <Panel title="Titulo">
          <div className="p-6">
            <MlForm op="ml_cambiar_titulo" hidden={{ item_id: item.id }} submitLabel="Cambiar titulo">
              <input name="titulo" defaultValue={item.title} maxLength={60} aria-label="Titulo" className="field" />
            </MlForm>
            {item.sold_quantity > 0 ? (
              <p className="mt-3 text-xs text-ink-muted">Mercado Libre no permite cambiar el titulo de una publicacion con ventas.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Descripcion">
        <div className="p-6">
          <MlForm op="ml_cambiar_descripcion" hidden={{ item_id: item.id }} submitLabel="Guardar descripcion">
            <textarea name="descripcion" defaultValue={item.description} rows={10} aria-label="Descripcion" className="field font-mono text-sm" />
          </MlForm>
        </div>
      </Panel>

      <Panel title="Promociones">
        {promotions.length === 0 ? (
          <Empty>Esta publicacion no participa ni es candidata a promociones.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Promocion</th>
                  <th>Estado</th>
                  <th>Precio</th>
                  <th>Vigencia</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promotions.map((p, index) => (
                  <tr key={`${p.id ?? p.type}-${index}`}>
                    <td>
                      <span className="font-semibold">{p.name || p.type}</span>
                      <span className="block text-xs text-ink-muted">{p.type}{p.id ? ` · ${p.id}` : ''}</span>
                    </td>
                    <td><StatusBadge status={p.status ?? ''} /></td>
                    <td className="tabular-nums">
                      {p.price ? money(p.price) : p.suggested_discounted_price ? `Sugerido ${money(p.suggested_discounted_price)}` : '—'}
                    </td>
                    <td className="text-xs">
                      {p.start_date?.slice(0, 10)} → {p.finish_date?.slice(0, 10)}
                    </td>
                    <td>
                      {p.status === 'started' || p.status === 'pending' ? (
                        <MlForm
                          op="ml_quitar_promocion"
                          hidden={{
                            item_id: item.id,
                            promotion_type: p.type ?? '',
                            ...(p.id && p.type !== 'PRICE_DISCOUNT' ? { promotion_id: p.id } : {}),
                            ...(p.offer_id ? { offer_id: p.offer_id } : {}),
                          }}
                          submitLabel="Quitar"
                          inline
                          danger
                        />
                      ) : p.status === 'candidate' && p.id && p.type ? (
                        <MlForm
                          op="ml_sumar_a_promocion"
                          hidden={{ item_id: item.id, promotion_id: p.id, promotion_type: p.type, ...(p.offer_id ? { offer_id: p.offer_id } : {}) }}
                          submitLabel="Participar"
                          inline
                        >
                          <input
                            name="precio_oferta"
                            type="number"
                            min="1"
                            defaultValue={p.suggested_discounted_price ?? undefined}
                            placeholder="Precio"
                            aria-label="Precio de oferta"
                            className="field w-28 py-1.5"
                          />
                        </MlForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-sand-dark p-6">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">Crear descuento propio</h3>
          <MlForm op="ml_crear_descuento" hidden={{ item_id: item.id }} submitLabel="Crear descuento">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="precio_oferta">Precio con descuento</label>
                <input id="precio_oferta" name="precio_oferta" type="number" min="1" required className="field" />
              </div>
              <div>
                <label className="label" htmlFor="precio_mp">Precio Mercado Puntos (opcional)</label>
                <input id="precio_mp" name="precio_mercado_puntos" type="number" min="1" className="field" />
              </div>
              <div>
                <label className="label" htmlFor="desde">Desde</label>
                <input id="desde" name="desde" type="date" defaultValue={isoDay(0)} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="hasta">Hasta (max 14 dias)</label>
                <input id="hasta" name="hasta" type="date" defaultValue={isoDay(7)} className="field" />
              </div>
            </div>
          </MlForm>
        </div>
      </Panel>

      <Panel title="Ultimas ventas" action={<Link href={`/admin/mercadolibre/preguntas?item=${item.id}`} className="text-xs text-brand hover:underline">Ver preguntas</Link>}>
        {!orders || orders.results.length === 0 ? (
          <Empty>Sin ventas registradas.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.results.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.id}</td>
                    <td className="text-xs">{new Date(o.date_created).toLocaleString('es-CL')}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right tabular-nums">{money(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
