import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { retryPayment } from '@/app/actions/checkout';
import { OrderDetail } from '@/components/order-detail';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getReviewableItems } from '@/lib/reviews';
import { ReviewForm } from '@/components/review-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Detalle del pedido',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ number: string }> };

export default async function AccountOrderDetailPage({ params }: PageProps) {
  const { number } = await params;
  const user = await requireUser(`/cuenta/ingresar?next=/cuenta/pedidos/${number}`);

  // El filtro por userId impide que un cliente vea el pedido de otro
  // cambiando el numero en la URL.
  const order = await prisma.order.findFirst({
    where: { number: number.toUpperCase(), userId: user.id },
    include: {
      items: true,
      events: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();

  const canRetry = order.status === 'PENDING' || order.status === 'FAILED';
  // Solo de un pedido entregado se puede opinar, y solo de lo que no se
  // califico todavia.
  const porCalificar = await getReviewableItems(order.id);

  return (
    <div className="container-site py-12">
      <Link
        href="/cuenta/pedidos"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
      >
        Volver a mis pedidos
      </Link>

      <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-none tracking-tight">
        Pedido {order.number}
      </h1>

      <div className="mt-10">
        <OrderDetail order={order} items={order.items} events={order.events}>
          {canRetry ? (
            <form action={retryPayment} className="mt-6">
              <input type="hidden" name="trackingToken" value={order.trackingToken} />
              <button type="submit" className="btn-primary btn-sm py-3">
                Completar el pago
              </button>
            </form>
          ) : null}
        </OrderDetail>
      </div>

      {porCalificar.length > 0 ? (
        <section className="mt-12 border-t border-sand-dark pt-10">
          <h2 className="font-display text-2xl font-bold uppercase leading-none tracking-tight">
            Cuentanos que te parecio
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Tu opinion se publica en la ficha del producto y ayuda a quien esta decidiendo.
          </p>

          <div className="mt-8 space-y-10">
            {porCalificar.map((item) => (
              <div key={item.productId} className="max-w-2xl border border-sand-dark bg-white p-6">
                <ReviewForm
                  orderId={order.id}
                  productId={item.productId!}
                  productName={item.name}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
