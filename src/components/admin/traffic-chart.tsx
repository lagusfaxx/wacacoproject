/**
 * Grafico de visitas por dia.
 *
 * Mismo criterio que el de ventas: barras dibujadas a mano, sin librerias de
 * terceros, para no cargar el panel con un script entero por un grafico.
 */
export function TrafficChart({
  data,
}: {
  data: { date: string; views: number; visitors: number }[];
}) {
  const max = Math.max(...data.map((point) => point.views), 1);
  const formatter = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center border border-dashed border-sand-dark text-sm text-ink-muted">
        Todavia no hay visitas registradas.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-52 items-end gap-1" role="img" aria-label="Visitas por dia">
        {data.map((point) => {
          const alto = Math.max(4, (point.views / max) * 100);
          const etiqueta = `${formatter.format(new Date(`${point.date}T12:00:00`))}: ${
            point.views
          } vistas de ${point.visitors} ${point.visitors === 1 ? 'visitante' : 'visitantes'}`;

          return (
            // La columna ocupa todo el alto de la fila: sin eso, la altura en
            // porcentaje de la barra no tiene contra que calcularse y no se
            // dibuja nada.
            <div key={point.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <span
                className="w-full rounded-t-sm bg-ink transition-colors group-hover:bg-brand"
                style={{ height: `${alto}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-xs text-white group-hover:block">
                {etiqueta}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-muted">
        <span>{formatter.format(new Date(`${data[0]!.date}T12:00:00`))}</span>
        <span>{formatter.format(new Date(`${data[data.length - 1]!.date}T12:00:00`))}</span>
      </div>
    </div>
  );
}
