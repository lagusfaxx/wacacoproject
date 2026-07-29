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
import { getTransferSettings, transferIsUsable } from '@/lib/bank-transfer';
import { getPickupSettings, pickupIsUsable } from '@/lib/pickup';
import { toDecimal } from '@/lib/money';
import { rateLimit } from '@/lib/rate-limit';
import { regionName } from '@/lib/regions-cl';
import { checkoutSchema, fieldErrors, pickupCheckoutSchema } from '@/lib/validation';

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

  // Que el formulario pida retiro no lo decide: solo vale si la tienda tiene
  // el punto de retiro activado y con direccion cargada.
  const pickupSettings = await getPickupSettings();
  const porRetiro =
    String(formData.get('deliveryMethod') ?? '') === 'retiro' && pickupIsUsable(pickupSettings);

  const parsed = porRetiro
    ? pickupCheckoutSchema.safeParse({
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
        notes: formData.get('notes'),
        email: formData.get('email'),
        couponCode: formData.get('couponCode'),
      })
    : checkoutSchema.safeParse({
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

  // El esquema de retiro no trae direccion; se completa con la del punto de
  // retiro para que el pedido, el panel y los correos tengan siempre un lugar
  // que leer.
  // Los dos esquemas comparten el contacto; la direccion solo la trae el de
  // despacho, por eso es opcional al leerla.
  const data: {
    fullName: string;
    phone: string;
    email: string;
    notes: string;
    couponCode: string;
    line1?: string;
    line2?: string;
    city?: string;
    regionCode?: string;
    postalCode?: string;
    country?: string;
  } = parsed.data;

  const direccion = porRetiro
    ? {
        line1: pickupSettings.address,
        line2: pickupSettings.place || null,
        city: pickupSettings.commune,
        region: pickupSettings.region || pickupSettings.commune,
        regionCode: null,
        postalCode: '',
        country: 'CL',
      }
    : {
        line1: data.line1 ?? '',
        line2: data.line2 || null,
        city: data.city ?? '',
        region: regionName(data.regionCode ?? ''),
        regionCode: data.regionCode ?? '',
        postalCode: data.postalCode ?? '',
        country: data.country ?? 'CL',
      };

  // Los totales se recalculan aqui desde la base de datos y el envio se vuelve
  // a cotizar con Blue Express: nada de lo que venga en el formulario influye
  // en el monto a cobrar, ni siquiera la tarifa que vio el comprador.
  const totals = await priceCart(cart, {
    couponCode,
    pickup: porRetiro,
    destination: porRetiro
      ? null
      : { regionCode: direccion.regionCode ?? '', commune: direccion.city },
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

  // La transferencia solo se acepta si la tienda la tiene activada y con los
  // datos cargados: el metodo llega del formulario y eso nunca decide solo.
  const transfer = await getTransferSettings();
  const porTransferencia =
    String(formData.get('paymentMethod') ?? '') === 'transferencia' && transferIsUsable(transfer);

  let destino: string;
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
        line1: direccion.line1,
        line2: direccion.line2,
        city: direccion.city,
        region: direccion.region,
        regionCode: direccion.regionCode,
        postalCode: direccion.postalCode,
        country: direccion.country,
        notes: data.notes || null,
      },
      paymentMethod: porTransferencia ? 'transferencia' : 'mercadopago',
      deliveryMethod: porRetiro ? 'retiro' : 'despacho',
    });
    createdOrderId = order.orderId;

    // Por transferencia no hay pasarela: el pedido queda esperando el deposito
    // y el comprador va a la pagina de seguimiento, donde estan los datos de
    // la cuenta y el numero que tiene que poner como mensaje.
    //
    // El destino se guarda y se salta al final, sin llamar aqui a `redirect`:
    // esa funcion avisa a Next lanzando una excepcion, y el catch de abajo la
    // tomaria por un fallo del pago y descartaria el pedido recien creado.
    if (porTransferencia) {
      await clearCart(cart.id);
      (await cookies()).delete(COUPON_COOKIE);

      await writeAuditLog({
        userId: session?.sub ?? null,
        action: 'checkout.transfer',
        entity: 'Order',
        entityId: order.orderId,
        metadata: { number: order.number, total: totals.total.toString() },
      });

      await notifyOrderPlaced(order.orderId).catch((emailError) => {
        console.error('[checkout] no se pudo enviar el aviso del pedido', emailError);
      });

      destino = `/seguimiento/${order.trackingToken}`;
    } else {
      const preference = await createCheckoutPreference({
        orderNumber: order.number,
        trackingToken: order.trackingToken,
        payer: { name: data.fullName, email: data.email, phone: data.phone },
        lines: totals.lines.map((line) => ({
          id: line.sku,
          title: line.variantName ? `${line.name} - ${line.variantName}` : line.name,
          description: line.variantName ?? undefined,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          pictureUrl: line.image ? `${env.appUrl}${line.image}` : undefined,
        })),
        discount: totals.discountTotal,
        shipping: totals.shippingTotal,
        tax: totals.taxTotal,
        total: totals.total,
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

      destino = preference.checkoutUrl;
    }
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
  redirect(destino);
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
    payer: { name: order.shipFullName, email: order.email, phone: order.shipPhone },
    lines: order.items.map((item) => ({
      id: item.sku,
      title: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
      quantity: item.quantity,
      lineTotal: toDecimal(item.lineTotal),
      pictureUrl: item.image ? `${env.appUrl}${item.image}` : undefined,
    })),
    discount: toDecimal(order.discountTotal),
    shipping: toDecimal(order.shippingTotal),
    tax: toDecimal(order.taxTotal),
    total: toDecimal(order.total),
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

  // Quien empezo por transferencia y termina pagando con tarjeta deja de ser
  // un pedido "esperando el deposito": si no, el vencimiento automatico podria
  // cancelarlo mientras el pago viaja por la pasarela.
  if (order.paymentMethod === 'transferencia') {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: 'mercadopago' },
    });
  }

  redirect(preference.checkoutUrl);
}
