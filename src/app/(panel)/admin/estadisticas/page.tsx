import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveRefresh } from '@/components/admin/live-refresh';
import { TrafficChart } from '@/components/admin/traffic-chart';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import {
  ABANDONED_MINUTES,
  getAbandonedCarts,
  getAbandonedTotal,
  getLiveStats,
  getTrafficStats,
  LIVE_MINUTES,
} from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Estadisticas' };

type PageProps = { searchParams: Promise<{ dias?: string }> };

const PERIODOS = [7, 30, 90];

export default async function AdminStatsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { dias } = await searchParams;
  const periodo = PERIODOS.includes(Number(dias)) ? Number(dias) : 30;

  const [live, traffic, abandoned, abandonedTotal] = await Promise.all([
    getLiveStats(),
    getTrafficStats(periodo),
    getAbandonedCarts(20),
    getAbandonedTotal(),
  ]);

  const hace = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
            Estadisticas
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Quien esta en la tienda ahora, de donde llega y que se quedo sin comprar.
          </p>
        </div>
        <LiveRefresh seconds={15} />
      </div>

      {/* --- Ahora mismo ------------------------------------------------- */}
      <section className="mt-8 border border-sand-dark bg-ink text-white">
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          <LiveTile
            value={live.visitorsNow}
            label={live.visitorsNow === 1 ? 'Persona en la tienda' : 'Personas en la tienda'}
            hint={`Activas en los ultimos ${LIVE_MINUTES} minutos`}
          />
          <LiveTile
            value={live.viewsLastHour}
            label="Paginas vistas"
            hint="En la ultima hora"
          />
          <LiveTile
            value={live.activeCarts}
            label={live.activeCarts === 1 ? 'Carrito activo' : 'Carritos activos'}
            hint="Con productos dentro ahora"
          />
        </div>

        {live.watching.length > 0 ? (
          <div className="border-t border-white/10 p-6">
            <h2 className="font-display text-xs font-bold uppercase tracking-[0.28em] text-white/50">
              Que estan mirando
            </h2>
            <ul className="mt-4 space-y-2">
              {live.watching.map((row) => (
                <li key={row.path} className="flex items-center justify-between gap-4 text-sm">
                  <span className="truncate text-white/90">{row.path}</span>
                  <span className="shrink-0 tabular-nums text-white/60">
                    {row.visitors} {row.visitors === 1 ? 'persona' : 'personas'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="border-t border-white/10 p-6 text-sm text-white/60">
            No hay nadie en la tienda en este momento.
          </p>
        )}
      </section>

      {/* --- Periodo ------------------------------------------------------ */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold uppercase leading-none tracking-tight">
          Trafico
        </h2>
        <div className="flex gap-2">
          {PERIODOS.map((dias) => (
            <Link
              key={dias}
              href={`/admin/estadisticas?dias=${dias}`}
              className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                periodo === dias
                  ? 'border-ink bg-ink text-white'
                  : 'border-sand-dark text-ink-soft hover:border-ink-soft'
              }`}
            >
              {dias} dias
            </Link>
          ))}
        </div>
      </div>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile value={traffic.visitors.toLocaleString('es-CL')} label="Visitantes" hint={`Ultimos ${periodo} dias`} />
        <Tile value={traffic.views.toLocaleString('es-CL')} label="Paginas vistas" hint={`${traffic.viewsToday} hoy`} />
        <Tile
          value={traffic.conversionPercent === null ? '—' : `${traffic.conversionPercent.toFixed(1)}%`}
          label="Conversion"
          hint={`${traffic.orders} pedidos pagados`}
        />
        <Tile
          value={formatMoney(abandonedTotal.total)}
          label="En carritos abandonados"
          hint={`${abandonedTotal.count} ${abandonedTotal.count === 1 ? 'carrito' : 'carritos'}`}
        />
      </section>

      <section className="mt-4 border border-sand-dark bg-white p-6">
        <TrafficChart data={traffic.daily} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="De donde llegan">
          {traffic.sources.length === 0 ? (
            <Vacio>Sin datos todavia.</Vacio>
          ) : (
            <Lista
              rows={traffic.sources.map((s) => ({ label: s.label, value: s.visitors }))}
              unidad="visitantes"
            />
          )}
        </Panel>

        <Panel title="Paginas mas vistas">
          {traffic.topPages.length === 0 ? (
            <Vacio>Sin datos todavia.</Vacio>
          ) : (
            <Lista
              rows={traffic.topPages.map((p) => ({ label: p.path, value: p.views }))}
              unidad="vistas"
            />
          )}
        </Panel>

        <Panel title="Productos mas vistos">
          {traffic.topProducts.length === 0 ? (
            <Vacio>Sin datos todavia.</Vacio>
          ) : (
            <Lista
              rows={traffic.topProducts.map((p) => ({
                label: p.name,
                value: p.views,
                href: `/products/${p.slug}`,
              }))}
              unidad="vistas"
            />
          )}
        </Panel>
      </div>

      {traffic.devices.length > 0 ? (
        <section className="mt-4 border border-sand-dark bg-white p-6">
          <h3 className="font-display text-base font-bold uppercase tracking-tight">
            Telefono o computador
          </h3>
          <div className="mt-4 flex gap-6">
            {traffic.devices.map((d) => (
              <div key={d.device}>
                <p className="font-display text-2xl font-bold">{d.visitors}</p>
                <p className="text-xs uppercase tracking-wide text-ink-muted">
                  {d.device === 'movil' ? 'Telefono' : 'Computador'}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Carritos abandonados ----------------------------------------- */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold uppercase leading-none tracking-tight">
          Carritos abandonados
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          Carritos con productos dentro que llevan mas de {ABANDONED_MINUTES} minutos quietos y
          nunca llegaron a pedido. El correo solo aparece si la persona habia iniciado sesion: de
          un visitante anonimo no se guarda ningun dato de contacto.
        </p>

        {abandoned.length === 0 ? (
          <p className="mt-6 border border-dashed border-sand-dark bg-white px-6 py-14 text-center text-sm text-ink-muted">
            No hay carritos abandonados.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {abandoned.map((cart) => {
              const minutos = Math.round((Date.now() - cart.updatedAt.getTime()) / 60000);
              const cuando =
                minutos < 60
                  ? hace.format(-minutos, 'minute')
                  : minutos < 60 * 24
                    ? hace.format(-Math.round(minutos / 60), 'hour')
                    : hace.format(-Math.round(minutos / 1440), 'day');

              return (
                <li
                  key={cart.id}
                  className="flex flex-wrap items-start justify-between gap-4 border border-sand-dark bg-white px-6 py-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold uppercase tracking-tight">
                      {cart.email ?? 'Visitante sin cuenta'}
                    </p>
                    {cart.name ? (
                      <p className="text-xs uppercase tracking-wide text-ink-muted">{cart.name}</p>
                    ) : null}
                    <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                      {cart.items.map((item, index) => (
                        <li key={`${cart.id}-${index}`}>
                          {item.quantity} × {item.name}
                          {item.variant ? ` · ${item.variant}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-semibold">{formatMoney(cart.total)}</p>
                    <p className="text-xs uppercase tracking-wide text-ink-muted">
                      {cart.units} {cart.units === 1 ? 'unidad' : 'unidades'}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{cuando}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function LiveTile({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <div className="bg-ink p-6">
      <p className="font-display text-4xl font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-3 text-sm font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xs text-white/50">{hint}</p>
    </div>
  );
}

function Tile({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="border border-sand-dark bg-white p-6">
      <p className="font-display text-3xl font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-ink">{label}</p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-sand-dark bg-white">
      <h3 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
        {title}
      </h3>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

function Lista({
  rows,
  unidad,
}: {
  rows: { label: string; value: number; href?: string }[];
  unidad: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 truncate">
              {row.href ? (
                <Link href={row.href} className="hover:text-brand hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
            </span>
            <span className="shrink-0 tabular-nums text-ink-muted">
              {row.value.toLocaleString('es-CL')}
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-sand">
            <div className="h-1 bg-brand" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <span className="sr-only">{unidad}</span>
        </li>
      ))}
    </ul>
  );
}
