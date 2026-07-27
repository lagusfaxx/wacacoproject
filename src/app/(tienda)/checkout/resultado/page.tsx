import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { retryPayment } from '@/app/actions/checkout';
import { OrderDetail } from '@/components/order-detail';
import { prisma } from '@/lib/db';
import { fetchPayment } from '@/lib/mercadopago';
import { applyPaymentUpdate } from '@/lib/orders';
import { isTerminalFailure } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Resultado del pago',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    ref?: string;
    payment_id?: string;
    status?: string;
    collection_id?: string;
  }>;
};

export default async function CheckoutResultPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const trackingToken = params.ref;
  if (!trackingToken) notFound();

  // El webhook puede tardar unos segundos. Como Mercado Pago devuelve el id
  // del pago en la URL de retorno, lo consultamos aqui para que el cliente vea
  // el estado definitivo de inmediato. La verificacion real sigue siendo la
  // llamada a la API: el parametro `status` de la URL no se usa como verdad.
  const paymentId = params.payment_id ?? params.collection_id;
  if (paymentId && /^\d+$/.test(paymentId)) {
    const payment = await fetchPayment(paymentId);
    if (payment) {
      const order = await prisma.order.findUnique({ where: { trackingToken } });
      // Solo se sincroniza si el pago corresponde a este mismo pedido.
      if (order && payment.externalReference === order.number) {
        await applyPaymentUpdate(payment);
      }
    }
  }

  const order = await prisma.order.findUnique({
    where: { trackingToken },
    include: {
      items: true,
      events: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();

  const success = order.status === 'PAID' || order.status === 'PREPARING' ||
    order.status === 'SHIPPED' || order.status === 'DELIVERED';
  const failed = isTerminalFailure(order.status);

  return (
    <div className="container-site py-12">
      <div
        className={`border-l-4 p-8 ${
          success
            ? 'border-emerald-500 bg-emerald-50'
            : failed
              ? 'border-red-500 bg-red-50'
              : 'border-amber-500 bg-amber-50'
        }`}
      >
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight lg:text-4xl">
          {success
            ? 'Gracias por tu compra'
            : failed
              ? 'No pudimos procesar tu pago'
              : 'Tu pago esta en proceso'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          {success
            ? `Confirmamos tu pedido ${order.number}. Te enviamos el detalle a ${order.email} y podras seguir su estado en cualquier momento.`
            : failed
              ? 'El pago fue rechazado o cancelado. Puedes reintentarlo con otro medio de pago.'
              : 'Mercado Pago todavia esta confirmando la transaccion. Apenas se acredite actualizaremos tu pedido automaticamente.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/seguimiento/${order.trackingToken}`} className="btn-dark btn-sm py-3">
            Seguir mi pedido
          </Link>
          {failed || order.status === 'PENDING' ? (
            <form action={retryPayment}>
              <input type="hidden" name="trackingToken" value={order.trackingToken} />
              <button type="submit" className="btn-primary btn-sm py-3">
                Reintentar el pago
              </button>
            </form>
          ) : null}
          <Link href="/products" className="btn-ghost">
            Seguir comprando
          </Link>
        </div>
      </div>

      <div className="mt-12">
        <OrderDetail order={order} items={order.items} events={order.events} />
      </div>
    </div>
  );
}
