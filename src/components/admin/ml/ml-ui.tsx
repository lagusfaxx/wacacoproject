import Link from 'next/link';

export function MlError({ error, notConnected }: { error: string; notConnected: boolean }) {
  return (
    <div className="mt-8 border border-sand-dark bg-white p-8 text-center">
      <p className="text-sm text-ink-soft">{error}</p>
      {notConnected ? (
        <Link href="/admin/mercadolibre/conexion" className="btn-primary mt-6 inline-flex">
          Conectar Mercado Libre
        </Link>
      ) : null}
    </div>
  );
}

export function Tile({ value, label, hint }: { value: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="border border-sand-dark bg-white p-5">
      <p className="font-display text-3xl font-bold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 font-display text-xs font-bold uppercase tracking-widest text-ink-soft">{label}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border border-sand-dark bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-sand-dark px-6 py-4">
        <h2 className="font-display text-base font-bold uppercase tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-10 text-center text-sm text-ink-muted">{children}</p>;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activa', cls: 'bg-emerald-100 text-emerald-800' },
  paused: { label: 'Pausada', cls: 'bg-amber-100 text-amber-800' },
  closed: { label: 'Finalizada', cls: 'bg-sand-dark text-ink-soft' },
  under_review: { label: 'En revision', cls: 'bg-blue-100 text-blue-800' },
  inactive: { label: 'Inactiva', cls: 'bg-sand-dark text-ink-soft' },
  paid: { label: 'Pagada', cls: 'bg-emerald-100 text-emerald-800' },
  confirmed: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-800' },
  payment_required: { label: 'Esperando pago', cls: 'bg-amber-100 text-amber-800' },
  payment_in_process: { label: 'Pago en proceso', cls: 'bg-amber-100 text-amber-800' },
  UNANSWERED: { label: 'Sin responder', cls: 'bg-amber-100 text-amber-800' },
  ANSWERED: { label: 'Respondida', cls: 'bg-emerald-100 text-emerald-800' },
  started: { label: 'En curso', cls: 'bg-emerald-100 text-emerald-800' },
  pending: { label: 'Programada', cls: 'bg-blue-100 text-blue-800' },
  candidate: { label: 'Disponible', cls: 'bg-blue-100 text-blue-800' },
  finished: { label: 'Terminada', cls: 'bg-sand-dark text-ink-soft' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: 'bg-sand-dark text-ink-soft' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function percent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(digits)}%`;
}
