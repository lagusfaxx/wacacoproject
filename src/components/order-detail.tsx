import type { Order, OrderEvent, OrderItem } from '@prisma/client';
import { OrderStatusBadge } from './order-status-badge';
import { TruckIcon } from './icons';
import { formatMoney } from '@/lib/money';
import {
  FULFILLMENT_FLOW,
  isTerminalFailure,
  orderStatusDescription,
  orderStatusLabel,
} from '@/lib/order-status';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function OrderDetail({
  order,
  items,
  events,
  children,
}: {
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="border border-sand-dark p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-widest text-ink-muted">
                Pedido
              </p>
              <p className="font-display text-2xl font-bold uppercase tracking-tight">
                {order.number}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <p className="mt-4 text-sm text-ink-soft">{orderStatusDescription(order.status)}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Realizado el {dateFormatter.format(order.createdAt)}
          </p>

          {children}
        </div>

        <ProgressTimeline order={order} />

        {order.trackingNumber ? (
          <div className="mt-8 border border-sand-dark bg-sand p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-tight">
              <TruckIcon className="h-5 w-5 text-brand" />
              Seguimiento del envio
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              {order.carrier ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Transportista</dt>
                  <dd className="font-semibold">{order.carrier}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Numero de seguimiento</dt>
                <dd className="font-mono font-semibold">{order.trackingNumber}</dd>
              </div>
            </dl>
            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-sm mt-5"
              >
                Rastrear envio
              </a>
            ) : null}
          </div>
        ) : null}

        {events.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-base font-bold uppercase tracking-tight">
              Historial del pedido
            </h2>
            <ol className="mt-5 space-y-5 border-l-2 border-sand-dark pl-6">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                  <p className="font-display text-sm font-semibold uppercase tracking-wide">
                    {event.title}
                  </p>
                  {event.message ? (
                    <p className="mt-1 text-sm text-ink-soft">{event.message}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    {dateFormatter.format(event.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <aside>
        <div className="border border-sand-dark bg-sand p-6">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">Productos</h2>
          <ul className="mt-5 space-y-4">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 bg-white">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-full w-full object-contain" />
                  ) : null}
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">
                    {item.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold uppercase tracking-tight">
                    {item.name}
                  </p>
                  {item.variantName ? (
                    <p className="text-xs text-ink-muted">{item.variantName}</p>
                  ) : null}
                </div>
                <p className="text-sm tabular-nums">
                  {formatMoney(item.lineTotal, order.currency)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2 border-t border-sand-dark pt-5 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
            {Number(order.discountTotal) > 0 ? (
              <SummaryRow
                label={`Descuento${order.couponCode ? ` (${order.couponCode})` : ''}`}
                value={`- ${formatMoney(order.discountTotal, order.currency)}`}
              />
            ) : null}
            <SummaryRow
              label="Envio"
              value={
                Number(order.shippingTotal) === 0
                  ? 'Gratis'
                  : formatMoney(order.shippingTotal, order.currency)
              }
            />
            {Number(order.taxTotal) > 0 ? (
              <SummaryRow label="Impuestos" value={formatMoney(order.taxTotal, order.currency)} />
            ) : null}
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-sand-dark pt-4">
            <span className="font-display text-sm font-bold uppercase tracking-tight">Total</span>
            <span className="font-display text-xl font-semibold">
              {formatMoney(order.total, order.currency)}
            </span>
          </div>
        </div>

        <div className="mt-6 border border-sand-dark p-6">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Direccion de envio
          </h2>
          <address className="mt-4 space-y-0.5 text-sm not-italic text-ink-soft">
            <p className="font-semibold text-ink">{order.shipFullName}</p>
            <p>{order.shipLine1}</p>
            {order.shipLine2 ? <p>{order.shipLine2}</p> : null}
            <p>
              {order.shipCity}, {order.shipRegion}
            </p>
            {order.shipPostalCode ? <p>{order.shipPostalCode}</p> : null}
            <p>{order.shipCountry}</p>
            <p className="pt-2">{order.shipPhone}</p>
            <p>{order.email}</p>
          </address>
          {order.shipCarrier ? (
            <p className="mt-4 border-t border-sand-dark pt-4 text-sm text-ink-muted">
              <span className="font-semibold text-ink">Despacho: </span>
              {order.shipCarrier}
              {order.shipServiceName && order.shipServiceName !== order.shipCarrier
                ? ` · ${order.shipServiceName}`
                : ''}
              {order.shipPromiseDays
                ? ` · ${order.shipPromiseDays} ${
                    order.shipPromiseDays === 1 ? 'dia habil' : 'dias habiles'
                  }`
                : ''}
            </p>
          ) : null}

          {order.notes ? (
            <p className="mt-4 border-t border-sand-dark pt-4 text-sm text-ink-muted">
              <span className="font-semibold text-ink">Notas: </span>
              {order.notes}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProgressTimeline({ order }: { order: Order }) {
  if (isTerminalFailure(order.status)) return null;

  const currentIndex = FULFILLMENT_FLOW.indexOf(
    order.status === 'IN_PROCESS' ? 'PENDING' : order.status,
  );

  return (
    <ol className="mt-8 grid gap-3 sm:grid-cols-5">
      {FULFILLMENT_FLOW.map((step, index) => {
        const done = index <= currentIndex;
        return (
          <li key={step}>
            <span
              className={`block h-1.5 w-full rounded-full ${done ? 'bg-brand' : 'bg-sand-dark'}`}
              aria-hidden="true"
            />
            <span
              className={`mt-2 block font-display text-[11px] font-semibold uppercase tracking-widest ${
                done ? 'text-ink' : 'text-ink-muted'
              }`}
            >
              {orderStatusLabel(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
