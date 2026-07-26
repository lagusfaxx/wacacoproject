import type { Metadata } from 'next';
import Link from 'next/link';
import { AddressForm, PasswordForm, ProfileForm } from '@/components/account-forms';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await requireUser('/cuenta/ingresar?next=/cuenta');

  const [address, orders] = await Promise.all([
    prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  return (
    <div className="container-site py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
            Hola, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{user.email}</p>
        </div>
        <div className="flex gap-3">
          {user.role === 'ADMIN' ? (
            <Link href="/admin" className="btn-outline btn-sm py-2.5">
              Panel admin
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn-ghost">
              Cerrar sesion
            </button>
          </form>
        </div>
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="section-title text-2xl">Ultimos pedidos</h2>
          <Link
            href="/cuenta/pedidos"
            className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="border border-sand-dark bg-sand px-6 py-12 text-center">
            <p className="text-sm text-ink-muted">Todavia no tienes pedidos.</p>
            <Link href="/productos" className="btn-primary mt-6">
              Ver productos
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-sand-dark border-y border-sand-dark">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-4 py-5">
                <div className="min-w-40">
                  <Link
                    href={`/cuenta/pedidos/${order.number}`}
                    className="font-display text-base font-bold uppercase tracking-tight hover:text-brand"
                  >
                    {order.number}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(
                      order.createdAt,
                    )}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
                <span className="ml-auto font-display text-base font-semibold">
                  {formatMoney(order.total, order.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="section-title mb-6 text-2xl">Mis datos</h2>
          <ProfileForm name={user.name} phone={user.phone ?? ''} />

          <h2 className="section-title mb-6 mt-14 text-2xl">Seguridad</h2>
          <PasswordForm />
        </section>

        <section>
          <h2 className="section-title mb-6 text-2xl">Direccion de envio</h2>
          <AddressForm
            defaults={{
              fullName: address?.fullName ?? user.name,
              phone: address?.phone ?? user.phone ?? '',
              line1: address?.line1 ?? '',
              line2: address?.line2 ?? '',
              city: address?.city ?? '',
              regionCode: address?.regionCode ?? '',
              postalCode: address?.postalCode ?? '',
              country: address?.country ?? 'CL',
            }}
          />
        </section>
      </div>
    </div>
  );
}
