import { formatMoney } from '@/lib/money';

export type SummaryTotals = {
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  total: string;
  couponCode: string | null;
  missingForFreeShipping: string;
  freeShippingThreshold: number;
  /** true cuando aun no hay direccion para cotizar el despacho. */
  shippingPending: boolean;
};

export function OrderSummary({
  totals,
  children,
}: {
  totals: SummaryTotals;
  children?: React.ReactNode;
}) {
  const hasDiscount = Number(totals.discountTotal) > 0;
  const freeShipping = Number(totals.shippingTotal) === 0;
  const missing = Number(totals.missingForFreeShipping);

  return (
    <aside className="border border-sand-dark bg-sand p-6 lg:sticky lg:top-28">
      <h2 className="font-display text-lg font-bold uppercase tracking-tight">Resumen</h2>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
        {hasDiscount ? (
          <Row
            label={`Descuento${totals.couponCode ? ` (${totals.couponCode})` : ''}`}
            value={`- ${formatMoney(totals.discountTotal)}`}
            highlight
          />
        ) : null}
        <Row
          label="Envio"
          value={
            totals.shippingPending
              ? 'Se calcula al pagar'
              : freeShipping
                ? 'Gratis'
                : formatMoney(totals.shippingTotal)
          }
          highlight={!totals.shippingPending && freeShipping}
        />
        {Number(totals.taxTotal) > 0 ? (
          <Row label="Impuestos" value={formatMoney(totals.taxTotal)} />
        ) : null}
      </dl>

      {missing > 0 ? (
        <p className="mt-4 border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
          Te faltan {formatMoney(totals.missingForFreeShipping)} para obtener envio gratis.
        </p>
      ) : null}

      <div className="mt-5 flex items-baseline justify-between border-t border-sand-dark pt-5">
        <span className="font-display text-base font-bold uppercase tracking-tight">Total</span>
        <span className="font-display text-2xl font-semibold">{formatMoney(totals.total)}</span>
      </div>

      {children}
    </aside>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={highlight ? 'font-semibold text-emerald-700' : 'text-ink'}>{value}</dd>
    </div>
  );
}
