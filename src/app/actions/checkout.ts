'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getClientIp, getSessionPayload, writeAuditLog } from '@/lib/auth';
import { clearCart, getOrCreateCart } from '@/lib/cart';
import { COUPON_COOKIE, getCouponCode } from '@/lib/coupon';
import { priceCart } from '@/lib/pricing';
import { createOrderFromTotals, discardUnpaidOrder, OrderError } from '@/lib/orders';
import { notifyOrderPlaced } from '@/lib/email/notifications';
import { createCheckoutPreference } from '@/lib/mercadopago';
import { toNumber } from '@/lib/money';
import { rateLimit } from '@/lib/rate-limit';
import { regionName } from '@/lib/regions-cl';
import { checkoutSchema, fieldErrors } from '@/lib/validation';

export type CheckoutState = {
  status: 'idle' | 'error';
  message: string;
  errors: Record<string, string>;
};

export async function startCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const ip = await getClientIp();
  const limit = await rateLimit(`checkout:${ip}`, 10, 60 * 5);
  if (!limit.ok) {
    return {
      status: 'error',
      message: `Demasiados intentos de pago. Espera ${limit.retryAfterSeconds} segundos.`,
      errors: {},
    };
  }

  const parsed = checkoutSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    line1: formData.get('line1'),
    line2: formData.get('line2'),
    city: formData.get('city'),
    regionCode: formData.get('regionCode'),
    postalCode: formData.get('postalCode'),
    country: formData.get('country') || 'CL',
    notes: formData.get('notes'),
    email: formData.get('email'),
    couponCode: formData.get('couponCode'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los datos marcados en el formulario.',
      errors: fieldErrors(parsed.error),
    };
  }

  const session = await getSessionPayload();
  const cart = await getOrCreateCart();
  const couponCode = await getCouponCode();
  const data = parsed.data;

  // Los totales se recalculan aqui desde la base de datos y el envio se vuelve
  // a cotizar con Blue Express: nada de lo que venga en el formulario influye
  // en el monto a cobrar, ni siquiera la tarifa que vio el comprador.
  const totals = await priceCart(cart, {
    couponCode,
    destination: { regionCode: data.regionCode, commune: data.city },
  });

  if (totals.lines.length === 0) {
    return { status: 'error', message: 'Tu carrito esta vacio.', errors: {} };
  }
  if (totals.hasStockIssues) {
    return {
      status: 'error',
      message: 'Algunos productos quedaron sin stock. Revisa tu carrito.',
      errors: {},
    };
  }
  if (totals.shipping.source === 'unavailable') {
    return {
      status: 'error',
      message: totals.shipping.notice ?? 'No despachamos a la region seleccionada.',
      errors: { regionCode: 'Region sin despacho.' },
    };
  }

  let checkoutUrl: string;
  let createdOrderId: string | null = null;

  try {
    const order = await createOrderFromTotals({
      totals,
      email: data.email,
      phone: data.phone,
      userId: session?.sub ?? null,
      shipping: {
        fullName: data.fullName,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        region: regionName(data.regionCode),
        regionCode: data.regionCode,
        postalCode: data.postalCode || '',
        country: data.country,
        notes: data.notes || null,
      },
    });
    createdOrderId = order.orderId;

    const preference = await createCheckoutPreference({
      orderNumber: order.number,
      trackingToken: order.trackingToken,
      shippingCost: toNumber(totals.shippingTotal),
      payer: { name: data.fullName, email: data.email, phone: data.phone },
      items: totals.lines.map((line) => ({
        id: line.sku,
        title: line.variantName ? `${line.name} - ${line.variantName}` : line.name,
        description: line.variantName ?? undefined,
        quantity: line.quantity,
        unitPrice: toNumber(line.unitPrice),
        pictureUrl: line.image ? `${env.appUrl}${line.image}` : undefined,
      })),
    });

    await prisma.payment.create({
      data: {
        orderId: order.orderId,
        provider: 'mercadopago',
        preferenceId: preference.preferenceId,
        status: 'PENDING',
        amount: totals.total,
        currency: env.currency,
        payerEmail: data.email,
      },
    });

    // El carrito se vacia recien aqui, cuando el pedido ya tiene una
    // preferencia valida. Si el pago falla despues, el pedido sigue
    // disponible para reintentarlo desde la cuenta o el seguimiento.
    await clearCart(cart.id);
    (await cookies()).delete(COUPON_COOKIE);

    await writeAuditLog({
      userId: session?.sub ?? null,
      action: 'checkout.started',
      entity: 'Order',
      entityId: order.orderId,
      metadata: { number: order.number, total: totals.total.toString() },
    });

    // Aviso de "pedido recibido". Va despues de vaciar el carrito y siempre
    // dentro de un catch: el comprador tiene que llegar a Mercado Pago aunque
    // el correo no salga.
    await notifyOrderPlaced(order.orderId).catch((emailError) => {
      console.error('[checkout] no se pudo enviar el aviso del pedido', emailError);
    });

    checkoutUrl = preference.checkoutUrl;
  } catch (error) {
    // El pedido nunca llego a Mercado Pago: se descarta y se libera el stock
    // para que el comprador pueda reintentar sin perder inventario.
    if (createdOrderId) {
      await discardUnpaidOrder(createdOrderId).catch((cleanupError) => {
        console.error('[checkout] no se pudo revertir el pedido', cleanupError);
      });
    }

    if (error instanceof OrderError) {
      return { status: 'error', message: error.message, errors: {} };
    }

    console.error('[checkout] fallo al iniciar el pago', error);
    return {
      status: 'error',
      message:
        'No pudimos iniciar el pago con Mercado Pago. Intenta nuevamente en unos minutos.',
      errors: {},
    };
  }

  // `redirect` lanza una excepcion de control de Next, por eso va fuera del try.
  redirect(checkoutUrl);
}

/** Genera una nueva preferencia para un pedido que quedo sin pagar. */
export async function retryPayment(formData: FormData): Promise<void> {
  const trackingToken = String(formData.get('trackingToken') ?? '');
  if (!trackingToken) return;

  const order = await prisma.order.findUnique({
    where: { trackingToken },
    include: { items: true },
  });

  if (!order) return;
  if (order.status !== 'PENDING' && order.status !== 'FAILED') return;

  const preference = await createCheckoutPreference({
    orderNumber: order.number,
    trackingToken: order.trackingToken,
    shippingCost: toNumber(order.shippingTotal),
    payer: { name: order.shipFullName, email: order.email, phone: order.shipPhone },
    items: order.items.map((item) => ({
      id: item.sku,
      title: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      pictureUrl: item.image ? `${env.appUrl}${item.image}` : undefined,
    })),
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: 'mercadopago',
      preferenceId: preference.preferenceId,
      status: 'PENDING',
      amount: order.total,
      currency: order.currency,
      payerEmail: order.email,
    },
  });

  redirect(preference.checkoutUrl);
}
