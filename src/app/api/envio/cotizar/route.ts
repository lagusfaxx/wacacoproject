import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCart } from '@/lib/cart';
import { getClientIp } from '@/lib/auth';
import { getCouponCode } from '@/lib/coupon';
import { formatMoney } from '@/lib/money';
import { priceCart } from '@/lib/pricing';
import { rateLimit } from '@/lib/rate-limit';
import { isValidRegionCode } from '@/lib/regions-cl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  regionCode: z.string().trim().max(10),
  commune: z.string().trim().max(80),
  /** "retiro" no cobra envio; cualquier otra cosa cotiza el despacho. */
  deliveryMethod: z.string().trim().max(20).optional(),
});

/**
 * Cotizacion en vivo para el checkout.
 *
 * Devuelve solo importes ya formateados: el precio que se cobra se vuelve a
 * calcular en el servidor al confirmar el pedido, asi que esta respuesta es
 * informativa y no puede alterar el cobro.
 */
export async function POST(request: Request) {
  const ip = await getClientIp();
  const limit = await rateLimit(`quote:${ip}`, 60, 60 * 5);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Demasiadas consultas de envio. Intenta en unos minutos.' },
      { status: 429 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Peticion invalida.' }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de destino invalidos.' }, { status: 400 });
  }

  const { regionCode, commune } = parsed.data;
  const pickup = parsed.data.deliveryMethod === 'retiro';
  const hasDestination = isValidRegionCode(regionCode) && commune.length >= 2;

  const [cart, couponCode] = await Promise.all([getCart(), getCouponCode()]);
  const totals = await priceCart(cart, {
    couponCode,
    pickup,
    destination: hasDestination ? { regionCode, commune } : null,
  });

  if (totals.lines.length === 0) {
    return NextResponse.json({ error: 'Tu carrito esta vacio.' }, { status: 400 });
  }

  return NextResponse.json({
    carrier: totals.shipping.carrier,
    serviceName: totals.shipping.serviceName,
    promiseDays: totals.shipping.promiseDays,
    source: totals.shipping.source,
    notice: totals.shipping.notice,
    shippingLabel:
      totals.shipping.source === 'pending' || totals.shipping.source === 'unavailable'
        ? null
        : totals.shipping.source === 'pickup'
          ? 'Sin costo'
          : Number(totals.shippingTotal) === 0
            ? 'Gratis'
            : formatMoney(totals.shippingTotal),
    subtotalLabel: formatMoney(totals.subtotal),
    discountLabel: Number(totals.discountTotal) > 0 ? formatMoney(totals.discountTotal) : null,
    taxLabel: Number(totals.taxTotal) > 0 ? formatMoney(totals.taxTotal) : null,
    totalLabel: formatMoney(totals.total),
  });
}
