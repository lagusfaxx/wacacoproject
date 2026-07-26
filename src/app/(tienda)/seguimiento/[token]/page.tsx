import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderDetail } from '@/components/order-detail';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Estado de mi pedido',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string }> };

export default async function TrackingDetailPage({ params }: PageProps) {
  const { token } = await params;

  // El token es aleatorio de 192 bits: funciona como enlace privado para que
  // quien compro como invitado pueda ver su pedido sin crear una cuenta.
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    include: {
      items: true,
      events: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();

  return (
    <div className="container-site py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
          Estado de tu pedido
        </h1>
        <Link
          href="/productos"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
        >
          Seguir comprando
        </Link>
      </div>

      <div className="mt-10">
        <OrderDetail order={order} items={order.items} events={order.events} />
      </div>
    </div>
  );
}
