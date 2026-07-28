import { formatMoney } from '@/lib/money';

/**
 * Grafico de barras sin librerias externas: mantiene el bundle liviano y
 * evita cargar scripts de terceros en el panel.
 */
export function RevenueChart({
  data,
}: {
  data: { date: string; total: number; orders: number }[];
}) {
  const max = Math.max(...data.map((point) => point.total), 1);
  const hasSales = data.some((point) => point.total > 0);
  const formatter = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

  if (!hasSales) {
    return (
      <div className="flex h-52 items-center justify-center border border-dashed border-sand-dark text-sm text-ink-muted">
        Sin ventas en el periodo.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-52 items-end gap-1" role="img" aria-label="Ventas por dia">
        {data.map((point) => {
          const heightPercent = point.total === 0 ? 2 : Math.max(4, (point.total / max) * 100);
          const label = `${formatter.format(new Date(`${point.date}T12:00:00`))}: ${formatMoney(
            point.total,
          )} (${point.orders} ${point.orders === 1 ? 'pedido' : 'pedidos'})`;

          return (
            // Como en el grafico de visitas, la columna tiene que ocupar el
            // alto de la fila para que la altura en porcentaje de la barra
            // tenga contra que calcularse.
            <div key={point.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <span
                className={`w-full rounded-t-sm transition-colors ${
                  point.total > 0 ? 'bg-brand group-hover:bg-brand-600' : 'bg-sand-dark'
                }`}
                style={{ height: `${heightPercent}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2.5 py-1.5 text-xs text-white group-hover:block">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-[11px] uppercase tracking-widest text-ink-muted">
        <span>{formatter.format(new Date(`${data[0]?.date ?? ''}T12:00:00`))}</span>
        <span>{formatter.format(new Date(`${data[data.length - 1]?.date ?? ''}T12:00:00`))}</span>
      </div>
    </div>
  );
}
