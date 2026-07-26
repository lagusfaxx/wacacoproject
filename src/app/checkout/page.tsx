import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckoutForm, type CheckoutDefaults } from '@/components/checkout-form';
import { OrderSummary } from '@/components/order-summary';
import { ShieldIcon } from '@/components/icons';
import { getCart } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { getCouponCode } from '@/lib/coupon';
import { prisma } from '@/lib/db';
import { priceCart } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finalizar compra',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [cart, couponCode, user] = await Promise.all([getCart(), getCouponCode(), getCurrentUser()]);
  const totals = await priceCart(cart, { couponCode });

  if (totals.lines.length === 0) redirect('/carrito');

  const address = user
    ? await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })
    : null;

  const defaults: CheckoutDefaults = {
    email: user?.email ?? '',
    fullName: address?.fullName ?? user?.name ?? '',
    phone: address?.phone ?? user?.phone ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    region: address?.region ?? '',
    postalCode: address?.postalCode ?? '',
    country: address?.country ?? 'CL',
  };

  return (
    <div className="container-site py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-5xl">
          Finalizar compra
        </h1>
        <Link
          href="/carrito"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
        >
          Volver al carrito
        </Link>
      </div>

      {!user ? (
        <p className="mt-6 border border-sand-dark bg-sand px-5 py-4 text-sm text-ink-soft">
          Puedes comprar como invitado.{' '}
          <Link href="/cuenta/ingresar?next=/checkout" className="font-semibold underline">
            Inicia sesion
          </Link>{' '}
          si quieres guardar tus datos y seguir tus pedidos.
        </p>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <CheckoutForm defaults={defaults} totalLabel={formatMoney(totals.total)} />

        <div className="lg:order-last">
          <OrderSummary
            totals={{
              subtotal: totals.subtotal.toString(),
              discountTotal: totals.discountTotal.toString(),
              shippingTotal: totals.shippingTotal.toString(),
              taxTotal: totals.taxTotal.toString(),
              total: totals.total.toString(),
              couponCode: totals.couponCode,
              missingForFreeShipping: totals.missingForFreeShipping.toString(),
              freeShippingThreshold: totals.freeShippingThreshold,
            }}
          >
            <ul className="mt-6 space-y-4 border-t border-sand-dark pt-5">
              {totals.lines.map((line) => (
                <li key={`${line.productId}-${line.variantId ?? 'base'}`} className="flex gap-3">
                  <div className="relative h-16 w-16 shrink-0 bg-white">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-full w-full object-contain" />
                    ) : null}
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">
                      {line.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold uppercase tracking-tight">
                      {line.name}
                    </p>
                    {line.variantName ? (
                      <p className="text-xs text-ink-muted">{line.variantName}</p>
                    ) : null}
                  </div>
                  <p className="text-sm tabular-nums">{formatMoney(line.lineTotal)}</p>
                </li>
              ))}
            </ul>

            <p className="mt-6 flex items-start gap-2 border-t border-sand-dark pt-5 text-xs text-ink-muted">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              Conexion cifrada. El cobro lo procesa Mercado Pago.
            </p>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
