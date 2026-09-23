import type { Metadata } from 'next';
import Link from 'next/link';
import { refreshMercadoLibre } from '@/app/actions/mercadolibre';
import { MlSalesChart } from '@/components/admin/ml/ml-sales-chart';
import { Empty, MlError, Panel, percent, Tile } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { safeMl } from '@/lib/mercadolibre/safe';
import { type ItemRow, getSummary, SUMMARY_PERIODS } from '@/lib/mercadolibre/summary';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mercado Libre' };

type PageProps = { searchParams: Promise<{ dias?: string }> };

const LEVELS: Record<string, string> = {
  '5_green': 'Verde',
  '4_light_green': 'Verde claro',
  '3_yellow': 'Amarilla',
  '2_orange': 'Naranja',
  '1_red': 'Roja',
};

export default async function MlSummaryPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { dias } = await searchParams;
  const periodo = SUMMARY_PERIODS.includes(Number(dias)) ? Number(dias) : 30;

  const result = await safeMl(() => getSummary(periodo));
  if (!result.ok) return <MlError error={result.error} notConnected={result.notConnected} />;
  const s = result.data;
  const money = (v: number) => formatMoney(v, s.currency);
  const actualizado = new Intl.DateTimeFormat('es-CL', { timeStyle: 'short' }).format(new Date(s.generatedAt));

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {SUMMARY_PERIODS.map((d) => (
            <Link
              key={d}
              href={`/admin/mercadolibre?dias=${d}`}
              className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                periodo === d ? 'border-ink bg-ink text-white' : 'border-sand-dark text-ink-soft hover:border-ink-soft'
              }`}
            >
              {d} dias
            </Link>
          ))}
        </div>
        <form action={refreshMercadoLibre} className="flex items-center gap-3 text-xs text-ink-muted">
          Datos de las {actualizado}
          <button type="submit" className="btn-ghost btn-sm">
            Actualizar
          </button>
        </form>
      </div>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile value={money(s.totals.revenue)} label="Ventas" hint={`${s.totals.orders} ventas · ${s.totals.units} unidades`} />
        <Tile value={s.totals.visits.toLocaleString('es-CL')} label="Visitas" hint="Unicas por dia, con hasta 48 h de retraso" />
        <Tile value={percent(s.totals.conversion, 2)} label="Conversion" hint="Ventas / visitas" />
        <Tile value={money(s.totals.averageTicket)} label="Ticket promedio" hint={`${s.totals.buyers} compradores`} />
        <Tile value={s.totals.activeItems} label="Publicaciones activas" hint={`${s.totals.pausedItems} pausadas · ${s.totals.outOfStock} sin stock`} />
        <Tile
          value={
            s.totals.unansweredQuestions > 0 ? (
              <Link href="/admin/mercadolibre/preguntas" className="text-brand hover:underline">
                {s.totals.unansweredQuestions}
              </Link>
            ) : (
              0
            )
          }
          label="Preguntas sin responder"
        />
        <Tile value={s.totals.cancelled} label="Canceladas" hint="En el periodo" />
        <Tile
          value={LEVELS[s.account.level ?? ''] ?? '—'}
          label="Reputacion"
          hint={[
            s.account.powerSeller ? `MercadoLider ${s.account.powerSeller}` : null,
            s.account.claimsRate !== undefined ? `Reclamos ${percent(s.account.claimsRate * 100, 2)}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined}
        />
      </section>

      {s.truncated ? (
        <p className="mt-4 text-xs text-amber-700">
          El periodo tiene muchos datos: el resumen considera las primeras 2.000 ventas y 500 publicaciones activas.
        </p>
      ) : null}

      <section className="mt-4 border border-sand-dark bg-white p-6">
        <MlSalesChart data={s.daily} formatMoney={money} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Mas vendidos">
          <ItemTable rows={s.topSold} money={money} empty="Sin ventas en el periodo." />
        </Panel>
        <Panel title="Mas visitados">
          <ItemTable rows={s.topVisited} money={money} empty="Sin visitas registradas." />
        </Panel>
        <Panel title="Mejor conversion">
          <ItemTable rows={s.bestConversion} money={money} empty="Hace falta al menos 20 visitas por publicacion." />
        </Panel>
        <Panel title="Visitas sin ventas">
          <ItemTable rows={s.visitsNoSales} money={money} empty="Ninguna publicacion con visitas y sin ventas." />
        </Panel>
        <Panel title="Stock bajo (3 o menos)">
          <ItemTable rows={s.lowStock} money={money} empty="Todas las publicaciones activas tienen stock." />
        </Panel>
      </div>
    </>
  );
}

function ItemTable({ rows, money, empty }: { rows: ItemRow[]; money: (v: number) => string; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Publicacion</th>
            <th className="text-right">Vendidas</th>
            <th className="text-right">Visitas</th>
            <th className="text-right">Conv.</th>
            <th className="text-right">Stock</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/mercadolibre/publicaciones/${r.id}`} className="line-clamp-1 font-semibold hover:text-brand">
                  {r.title}
                </Link>
                <span className="text-xs text-ink-muted">
                  {r.id} · {money(r.price)}
                  {r.revenue ? ` · ${money(r.revenue)} vendidos` : ''}
                </span>
              </td>
              <td className="text-right tabular-nums">{r.units}</td>
              <td className="text-right tabular-nums">{r.visits}</td>
              <td className="text-right tabular-nums">{percent(r.conversion)}</td>
              <td className={`text-right tabular-nums ${r.stock === 0 ? 'text-red-700' : ''}`}>{r.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
