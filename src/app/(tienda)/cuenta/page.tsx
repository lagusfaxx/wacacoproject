import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountShell } from '@/components/account-shell';
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
    <AccountShell user={user}>
      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="section-title text-2xl">Ultimos pedidos</h2>
          {orders.length > 0 ? (
            <Link
              href="/cuenta/pedidos"
              className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
            >
              Ver todos
            </Link>
          ) : null}
        </div>

        {orders.length === 0 ? (
          <div className="border border-sand-dark bg-sand px-6 py-12 text-center">
            <p className="text-sm text-ink-muted">Todavia no tienes pedidos.</p>
            <Link href="/products" className="btn-primary mt-6">
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

      {/*
        El resumen solo muestra lo que hay guardado y manda a editarlo a su
        propia pagina. Asi esta pantalla no tiene ningun boton de guardar y se
        lee de una sola pasada.
      */}
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Mis datos" href="/cuenta/datos" action="Editar">
          <SummaryLine label="Nombre" value={user.name} />
          <SummaryLine label="Correo" value={user.email} />
          <SummaryLine label="Telefono" value={user.phone || 'Sin telefono'} />
        </SummaryCard>

        <SummaryCard
          title="Direccion de envio"
          href="/cuenta/direccion"
          action={address ? 'Editar' : 'Agregar'}
        >
          {address ? (
            <>
              <SummaryLine label="Recibe" value={address.fullName} />
              <SummaryLine
                label="Direccion"
                value={[address.line1, address.line2].filter(Boolean).join(', ')}
              />
              <SummaryLine label="Comuna" value={`${address.city}, ${address.region}`} />
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              Todavia no guardaste una direccion. Si la agregas, el checkout viene completo.
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="Seguridad" href="/cuenta/seguridad" action="Cambiar contrasena">
          <p className="text-sm text-ink-muted">
            Tu contrasena esta guardada cifrada. Cambiala cuando quieras desde aqui.
          </p>
        </SummaryCard>
      </div>
    </AccountShell>
  );
}

function SummaryCard({
  title,
  href,
  action,
  children,
}: {
  title: string;
  href: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border border-sand-dark p-6">
      <h3 className="font-display text-base font-bold uppercase tracking-tight">{title}</h3>
      <div className="mt-4 flex-1 space-y-2">{children}</div>
      <Link
        href={href}
        className="mt-6 font-display text-xs font-bold uppercase tracking-widest text-brand underline-offset-4 hover:underline"
      >
        {action}
      </Link>
    </section>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="font-display text-[11px] uppercase tracking-widest text-ink-muted">
        {label}
      </span>
      <span className="mt-0.5 block text-ink-soft">{value}</span>
    </p>
  );
}
