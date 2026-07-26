import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { retryPayment } from '@/app/actions/checkout';
import { OrderDetail } from '@/components/order-detail';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    </div>
  );
}
