import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountShell } from '@/components/account-shell';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mis pedidos',
  robots: { index: false, follow: false },
};

export default async function AccountOrdersPage() {
  const user = await requireUser('/cuenta/ingresar?next=/cuenta/pedidos');

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { take: 4 } },
  });

  return (
    <AccountShell user={user} title="Mis pedidos">
      {orders.length === 0 ? (
        <div className="border border-sand-dark bg-sand px-6 py-16 text-center">
          <p className="text-sm text-ink-muted">Todavia no tienes pedidos.</p>
          <Link href="/products" className="btn-primary mt-6">
            Ver productos
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {orders.map((order) => (
            <li key={order.id} className="border border-sand-dark p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <Link
                    href={`/cuenta/pedidos/${order.number}`}
                    className="font-display text-lg font-bold uppercase tracking-tight hover:text-brand"
                  >
                    {order.number}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(
                      order.createdAt,
                    )}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
                <span className="ml-auto font-display text-lg font-semibold">
                  {formatMoney(order.total, order.currency)}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {order.items.map((item) => (
                  <div key={item.id} className="h-14 w-14 bg-sand" title={item.name}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                ))}
                <Link
                  href={`/cuenta/pedidos/${order.number}`}
                  className="ml-auto font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
                >
                  Ver detalle
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
