import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderDetail } from '@/components/order-detail';
import { TransferDetails } from '@/components/transfer-details';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getTransferSettings, transferIsUsable } from '@/lib/bank-transfer';

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

  // Los datos de la cuenta solo tienen sentido mientras el pedido siga
  // esperando el pago: una vez confirmado, estorban.
  const transfer = await getTransferSettings();
  const esperandoTransferencia =
    order.paymentMethod === 'transferencia' &&
    order.status === 'PENDING' &&
    transferIsUsable(transfer);

  return (
    <div className="container-site py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
          Estado de tu pedido
        </h1>
        <Link
          href="/products"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
        >
          Seguir comprando
        </Link>
      </div>

      <div className="mt-10">
        {esperandoTransferencia ? (
          <section className="mb-10 border-2 border-ink bg-sand p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold uppercase leading-none tracking-tight">
              Datos para transferir
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-ink-soft">
              Tu pedido esta reservado. Transfiere el monto exacto y pon el numero de pedido como
              mensaje, asi lo reconocemos al tiro. Apenas veamos la transferencia lo preparamos y
              te avisamos por correo.
            </p>

            <div className="mt-6 max-w-xl">
              <TransferDetails
                data={transfer}
                reference={order.number}
                amount={formatMoney(order.total, order.currency)}
              />
            </div>
          </section>
        ) : null}

        <OrderDetail order={order} items={order.items} events={order.events} />
      </div>
    </div>
  );
}
