/**
 * Ventas y visitas por dia de Mercado Libre. Barras dibujadas a mano, como el
 * resto de los graficos del panel.
 */
export function MlSalesChart({
  data,
  formatMoney,
}: {
  data: { date: string; revenue: number; orders: number; visits: number }[];
  formatMoney: (value: number) => string;
}) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  const fmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-muted">Sin datos en el periodo.</p>;
  }

  return (
    <div>
      <div className="flex h-52 items-end gap-1" role="img" aria-label="Ventas y visitas por dia">
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center gap-px">
            <span
              className="w-1/2 rounded-t-sm bg-ink transition-colors group-hover:bg-brand"
              style={{ height: `${Math.max(d.revenue ? 4 : 1, (d.revenue / maxRevenue) * 100)}%` }}
            />
            <span
              className="w-1/2 rounded-t-sm bg-sand-dark"
              style={{ height: `${Math.max(1, (d.visits / maxVisits) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-xs text-white group-hover:block">
              {fmt.format(new Date(`${d.date}T12:00:00`))}: {formatMoney(d.revenue)} · {d.orders}{' '}
              {d.orders === 1 ? 'venta' : 'ventas'} · {d.visits} visitas
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-muted">
        <span>{fmt.format(new Date(`${data[0]!.date}T12:00:00`))}</span>
        <span className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-ink" /> Ventas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-sand-dark" /> Visitas
          </span>
        </span>
        <span>{fmt.format(new Date(`${data[data.length - 1]!.date}T12:00:00`))}</span>
      </div>
    </div>
  );
}
