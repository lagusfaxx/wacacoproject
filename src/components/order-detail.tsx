import type { Order, OrderEvent, OrderItem } from '@prisma/client';
import { OrderStatusBadge } from './order-status-badge';
import { StoreIcon, TruckIcon } from './icons';
import { formatMoney } from '@/lib/money';
import {
  fulfillmentFlow,
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
  pickupLines = null,
  children,
}: {
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
  /**
   * Punto de retiro tal como esta hoy en los ajustes. Si la tienda se mudo
   * entre la compra y el retiro, esta es la direccion a la que hay que ir; sin
   * el, se muestra la que quedo guardada en el pedido.
   */
  pickupLines?: string[] | null;
  children?: React.ReactNode;
}) {
  const retiro = order.deliveryMethod === 'retiro';
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

          <p className="mt-4 text-sm text-ink-soft">
            {orderStatusDescription(order.status, {
              paymentMethod: order.paymentMethod,
              deliveryMethod: order.deliveryMethod,
            })}
          </p>
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
              label={retiro ? 'Retiro en tienda' : 'Envio'}
              value={
                retiro
                  ? 'Sin costo'
                  : Number(order.shippingTotal) === 0
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
          <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-tight">
            {retiro ? <StoreIcon className="h-5 w-5 text-brand" /> : null}
            {retiro ? 'Retiro en tienda' : 'Direccion de envio'}
          </h2>

          {retiro ? (
            <>
              <address className="mt-4 space-y-0.5 text-sm not-italic text-ink-soft">
                {(pickupLines ?? frozenPickupLines(order)).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </address>
              <p className="mt-4 border-t border-sand-dark pt-4 text-sm text-ink-soft">
                <span className="font-semibold text-ink">Retira: </span>
                {order.shipFullName}
              </p>
              <p className="text-sm text-ink-muted">
                Pidelo con el numero {order.number}. {order.shipPhone} · {order.email}
              </p>
            </>
          ) : (
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
          )}

          {!retiro && order.shipCarrier ? (
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

/** El punto de retiro tal como quedo guardado en el pedido, como respaldo. */
function frozenPickupLines(order: Order): string[] {
  return [order.shipLine2 ?? '', order.shipLine1, `${order.shipCity}, ${order.shipRegion}`].filter(
    (line) => line.trim(),
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

/**
 * Las etapas del pedido.
 *
 * Las barras van siempre en horizontal, tambien en el telefono: apiladas
 * ocupaban cinco filas enteras y empujaban el resto del seguimiento fuera de
 * la pantalla. Lo que no cabe a 390 pixeles son los cinco nombres, asi que ahi
 * se muestra solo en cual vas; desde `sm` vuelve cada nombre bajo su barra.
 */
function ProgressTimeline({ order }: { order: Order }) {
  if (isTerminalFailure(order.status)) return null;

  const flow = fulfillmentFlow(order.deliveryMethod);
  const currentIndex = flow.indexOf(order.status === 'IN_PROCESS' ? 'PENDING' : order.status);
  const current = flow[Math.max(0, currentIndex)]!;

  return (
    <div className="mt-8">
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {flow.map((step, index) => {
          const done = index <= currentIndex;
          return (
            <li key={step}>
              <span
                className={`block h-1.5 w-full rounded-full ${done ? 'bg-brand' : 'bg-sand-dark'}`}
                aria-hidden="true"
              />
              <span
                className={`mt-2 hidden font-display text-[11px] font-semibold uppercase leading-tight tracking-widest sm:block ${
                  done ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {orderStatusLabel(step)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 font-display text-xs font-semibold uppercase tracking-widest text-ink sm:hidden">
        <span className="text-ink-muted">
          Paso {Math.max(1, currentIndex + 1)} de {flow.length} ·{' '}
        </span>
        {orderStatusLabel(current)}
      </p>
    </div>
  );
}
