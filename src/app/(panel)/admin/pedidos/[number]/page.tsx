import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderStatusForm } from '@/components/admin/order-status-form';
import { markReadyForPickup } from '@/app/actions/admin';
import { PaymentSyncForm } from '@/components/admin/payment-sync-form';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Detalle del pedido' };

type PageProps = { params: Promise<{ number: string }> };

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export default async function AdminOrderDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { number } = await params;

  const order = await prisma.order.findUnique({
    where: { number: number.toUpperCase() },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) notFound();

  const retiro = order.deliveryMethod === 'retiro';

  // Solo tiene sentido reconsultar a Mercado Pago un pedido que fue por la
  // pasarela y sigue sin resolverse.
  const esperandoPago =
    order.paymentMethod !== 'transferencia' &&
    (order.status === 'PENDING' || order.status === 'IN_PROCESS' || order.status === 'FAILED');

  return (
    <>
      <Link
        href="/admin/pedidos"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          {order.number}
        </h1>
        <OrderStatusBadge status={order.status} />
        <span className="ml-auto font-display text-2xl font-semibold">
          {formatMoney(order.total, order.currency)}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Creado el {dateFormatter.format(order.createdAt)}
        {order.paidAt ? ` · Pagado el ${dateFormatter.format(order.paidAt)}` : ''}
        {' · '}
        {retiro ? 'Retiro en tienda' : 'Despacho a domicilio'}
        {order.paymentMethod === 'transferencia' ? ' · Paga por transferencia' : ''}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel title="Articulos">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>SKU</th>
                    <th className="text-right">Precio</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 bg-sand">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            {item.variantName ? (
                              <p className="text-xs text-ink-muted">{item.variantName}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">{item.sku}</td>
                      <td className="text-right tabular-nums">
                        {formatMoney(item.unitPrice, order.currency)}
                      </td>
                      <td className="text-right tabular-nums">{item.quantity}</td>
                      <td className="text-right tabular-nums">
                        {formatMoney(item.lineTotal, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-5 ml-auto max-w-xs space-y-2 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
              {Number(order.discountTotal) > 0 ? (
                <Row
                  label={`Descuento${order.couponCode ? ` (${order.couponCode})` : ''}`}
                  value={`- ${formatMoney(order.discountTotal, order.currency)}`}
                />
              ) : null}
              <Row label="Envio" value={formatMoney(order.shippingTotal, order.currency)} />
              {Number(order.taxTotal) > 0 ? (
                <Row label="Impuestos" value={formatMoney(order.taxTotal, order.currency)} />
              ) : null}
              <div className="flex justify-between border-t border-sand-dark pt-2 font-display font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(order.total, order.currency)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Pagos">
            {esperandoPago ? (
              <div className="mb-5 border border-sand-dark bg-sand p-4">
                <PaymentSyncForm orderId={order.id} />
              </div>
            ) : null}

            {order.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">Todavia no hay registros de pago.</p>
            ) : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID Mercado Pago</th>
                      <th>Estado</th>
                      <th>Metodo</th>
                      <th className="text-right">Monto</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="font-mono text-xs">
                          {payment.externalId ?? (
                            <span className="text-ink-muted">
                              pref. {payment.preferenceId?.slice(0, 18) ?? '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-sand text-ink-soft">{payment.status}</span>
                          {payment.statusDetail ? (
                            <p className="mt-1 text-xs text-ink-muted">{payment.statusDetail}</p>
                          ) : null}
                        </td>
                        <td className="text-xs">
                          {payment.paymentMethod ?? '—'}
                          {payment.installments && payment.installments > 1
                            ? ` · ${payment.installments} cuotas`
                            : ''}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatMoney(payment.amount, payment.currency)}
                        </td>
                        <td className="text-xs text-ink-muted">
                          {dateFormatter.format(payment.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Historial">
            <ol className="space-y-4 border-l-2 border-sand-dark pl-5">
              {order.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  <p className="font-display text-sm font-semibold uppercase tracking-wide">
                    {event.title}
                    {!event.isPublic ? (
                      <span className="ml-2 badge bg-sand text-ink-muted">interno</span>
                    ) : null}
                  </p>
                  {event.message ? (
                    <p className="mt-1 text-sm text-ink-soft">{event.message}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    {dateFormatter.format(event.createdAt)}
                    {event.createdBy ? ` · ${event.createdBy}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          {retiro ? (
            <Panel title="Retiro en tienda">
              <p className="text-sm text-ink-soft">
                Este pedido no se despacha: lo pasa a buscar{' '}
                <span className="font-semibold text-ink">{order.shipFullName}</span>.
              </p>

              {order.readyAt ? (
                <p className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Avisado como listo el {dateFormatter.format(order.readyAt)}
                </p>
              ) : (
                <form action={markReadyForPickup} className="mt-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <button type="submit" className="btn-primary w-full">
                    Marcar listo para retiro
                  </button>
                  <p className="mt-2 text-xs text-ink-muted">
                    Cambia el estado y le manda al cliente un correo con la direccion, el horario y
                    el numero con el que tiene que pedirlo.
                  </p>
                </form>
              )}
            </Panel>
          ) : null}

          <Panel title="Gestion del pedido">
            <OrderStatusForm
              orderId={order.id}
              status={order.status}
              carrier={order.carrier ?? ''}
              trackingNumber={order.trackingNumber ?? ''}
              trackingUrl={order.trackingUrl ?? ''}
            />
          </Panel>

          <Panel title="Cliente">
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{order.shipFullName}</p>
              <p className="text-ink-soft">{order.email}</p>
              <p className="text-ink-soft">{order.shipPhone}</p>
              {order.user ? (
                <Link
                  href={`/admin/clientes?q=${encodeURIComponent(order.user.email)}`}
                  className="mt-2 inline-block font-display text-xs font-bold uppercase tracking-widest text-brand"
                >
                  Cuenta registrada
                </Link>
              ) : (
                <p className="mt-2 text-xs uppercase tracking-widest text-ink-muted">
                  Compra como invitado
                </p>
              )}
            </div>
          </Panel>

          <Panel title={retiro ? 'Punto de retiro' : 'Direccion de envio'}>
            <address className="space-y-0.5 text-sm not-italic text-ink-soft">
              <p>{order.shipLine1}</p>
              {order.shipLine2 ? <p>{order.shipLine2}</p> : null}
              <p>
                {order.shipCity}, {order.shipRegion}
              </p>
              {order.shipPostalCode ? <p>{order.shipPostalCode}</p> : null}
              <p>{order.shipCountry}</p>
            </address>
            {order.notes ? (
              <p className="mt-4 border-t border-sand-dark pt-4 text-sm">
                <span className="font-semibold">Notas: </span>
                {order.notes}
              </p>
            ) : null}
            <p className="mt-4 border-t border-sand-dark pt-4 text-xs text-ink-muted">
              Enlace de seguimiento del cliente:{' '}
              <Link
                href={`/seguimiento/${order.trackingToken}`}
                className="break-all font-mono text-brand"
              >
                /seguimiento/{order.trackingToken}
              </Link>
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-sand-dark bg-white">
      <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
        {title}
      </h2>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
