import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  CheckoutClient,
  type CheckoutDefaults,
  type SummaryLabels,
  type SummaryLine,
} from '@/components/checkout-client';
import { getCart } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { getCouponCode } from '@/lib/coupon';
import { prisma } from '@/lib/db';
import { priceCart } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import { CHILE_REGIONS } from '@/lib/regions-cl';
import { isBluexpressEnabled } from '@/lib/shipping';
import { getStoreSettings } from '@/lib/store-settings';
import { getTransferSettings, transferIsUsable } from '@/lib/bank-transfer';
import { getPickupSettings, pickupIsUsable } from '@/lib/pickup';
import { maybeExpireStaleOrders } from '@/lib/order-expiry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finalizar compra',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Momento justo para soltar el stock de los pedidos por transferencia que
  // vencieron: alguien esta por comprar y las unidades tienen que estar.
  maybeExpireStaleOrders();

  const [cart, couponCode, user, store] = await Promise.all([
    getCart(),
    getCouponCode(),
    getCurrentUser(),
    getStoreSettings(),
  ]);

  // Solo se ofrece transferencia si esta activada y con la cuenta cargada, y
  // solo se ofrece retiro si hay una direccion donde ir a buscar el pedido.
  const [transferSettings, pickupSettings] = await Promise.all([
    getTransferSettings(),
    getPickupSettings(),
  ]);
  const transfer = transferIsUsable(transferSettings) ? transferSettings : null;
  const pickup = pickupIsUsable(pickupSettings)
    ? {
        place: pickupSettings.place,
        address: pickupSettings.address,
        commune: pickupSettings.commune,
        region: pickupSettings.region,
        hours: pickupSettings.hours,
        notes: pickupSettings.notes,
      }
    : null;

  // Sin destino todavia: el envio queda "por calcular" hasta que el comprador
  // elija region y comuna, y se cotiza en vivo desde el cliente.
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
    regionCode: address?.regionCode ?? '',
    postalCode: address?.postalCode ?? '',
    country: address?.country ?? 'CL',
  };

  const lines: SummaryLine[] = totals.lines.map((line) => ({
    key: `${line.productId}-${line.variantId ?? 'base'}`,
    name: line.name,
    variantName: line.variantName,
    quantity: line.quantity,
    image: line.image,
    lineTotalLabel: formatMoney(line.lineTotal),
  }));

  const initialSummary: SummaryLabels = {
    subtotalLabel: formatMoney(totals.subtotal),
    discountLabel: Number(totals.discountTotal) > 0 ? formatMoney(totals.discountTotal) : null,
    couponCode: totals.couponCode,
    shippingLabel: null,
    taxLabel: Number(totals.taxTotal) > 0 ? formatMoney(totals.taxTotal) : null,
    totalLabel: formatMoney(totals.total),
    carrier: totals.shipping.carrier,
    serviceName: totals.shipping.serviceName,
    promiseDays: totals.shipping.promiseDays,
    notice: totals.shipping.notice,
    source: totals.shipping.source,
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

      <CheckoutClient
        defaults={defaults}
        lines={lines}
        initialSummary={initialSummary}
        regions={CHILE_REGIONS}
        bluexEnabled={isBluexpressEnabled()}
        paymentLogoUrl={store.paymentLogoUrl}
        transfer={transfer}
        transferHoldHours={transferSettings.holdHours}
        pickup={pickup}
      />
    </div>
  );
}
