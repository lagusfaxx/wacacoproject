import 'server-only';

import { randomBytes } from 'node:crypto';
import { Prisma, type OrderStatus, type PrismaClient } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';
import { round, toDecimal } from './money';
import type { CartTotals } from './pricing';
import { chargedTotal, mapPaymentStatus, type MpPayment } from './mercadopago';
import { orderStatusLabel } from './order-status';
import { notifyOrderStatus } from './email/notifications';

export class OrderError extends Error {}

export type ShippingDetails = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  regionCode?: string | null;
  postalCode: string;
  country: string;
  notes?: string | null;
};

function generateOrderNumber(): string {
  return `WC-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function generateTrackingToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Crea el pedido y reserva stock en una sola transaccion.
 *
 * La reserva usa `updateMany` con la condicion `stock >= cantidad`, de modo
 * que dos compras simultaneas del ultimo articulo no puedan dejar el stock
 * en negativo: la segunda no afecta filas y la transaccion se revierte.
 */
export async function createOrderFromTotals(input: {
  totals: CartTotals;
  email: string;
  phone?: string | null;
  userId?: string | null;
  shipping: ShippingDetails;
  /** "mercadopago" | "transferencia". Por defecto, la pasarela. */
  paymentMethod?: string;
  /** "despacho" | "retiro". Por defecto, despacho a domicilio. */
  deliveryMethod?: string;
}): Promise<{ orderId: string; number: string; trackingToken: string }> {
  const { totals, shipping } = input;

  if (totals.lines.length === 0) {
    throw new OrderError('Tu carrito esta vacio.');
  }
  if (totals.hasStockIssues) {
    throw new OrderError('Algunos productos ya no tienen stock suficiente.');
  }
  if (totals.total.lessThanOrEqualTo(0)) {
    throw new OrderError('El total del pedido no es valido.');
  }

  return prisma.$transaction(async (tx) => {
    for (const line of totals.lines) {
      if (line.variantId) {
        const updated = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw new OrderError(`Sin stock suficiente para ${line.name} (${line.variantName}).`);
        }
      }

      const updatedProduct = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (updatedProduct.count === 0) {
        throw new OrderError(`Sin stock suficiente para ${line.name}.`);
      }
    }

    const number = await uniqueOrderNumber(tx);
    const trackingToken = generateTrackingToken();

    const order = await tx.order.create({
      data: {
        number,
        trackingToken,
        userId: input.userId ?? null,
        email: input.email.toLowerCase(),
        phone: input.phone ?? shipping.phone,
        status: 'PENDING',
        paymentMethod: input.paymentMethod ?? 'mercadopago',
        deliveryMethod: input.deliveryMethod ?? 'despacho',
        currency: env.currency,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        couponCode: totals.couponCode,
        shipFullName: shipping.fullName,
        shipPhone: shipping.phone,
        shipLine1: shipping.line1,
        shipLine2: shipping.line2 ?? null,
        shipCity: shipping.city,
        shipRegion: shipping.region,
        shipPostalCode: shipping.postalCode,
        shipCountry: shipping.country,
        notes: shipping.notes ?? null,
        // Datos del transportista con los que se cotizo, para que bodega
        // despache con el mismo servicio que pago el cliente.
        shipRegionCode: shipping.regionCode ?? null,
        shipDistrictCode: totals.shipping.districtCode,
        shipCarrier: totals.shipping.carrier,
        shipServiceType: totals.shipping.serviceType,
        shipServiceName: totals.shipping.serviceName,
        shipPromiseDays: totals.shipping.promiseDays,
        items: {
          create: totals.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            name: line.name,
            variantName: line.variantName,
            sku: line.sku,
            image: line.image,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })),
        },
        events: {
          create: {
            status: 'PENDING',
            title: 'Pedido creado',
            message:
              input.paymentMethod === 'transferencia'
                ? 'Estamos esperando tu transferencia.'
                : 'Estamos esperando la confirmacion del pago.',
          },
        },
      },
    });

    if (totals.couponCode) {
      await tx.coupon.updateMany({
        where: { code: totals.couponCode },
        data: { timesRedeemed: { increment: 1 } },
      });
    }

    return { orderId: order.id, number: order.number, trackingToken };
  });
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

async function uniqueOrderNumber(tx: TxClient): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateOrderNumber();
    const clash = await tx.order.findUnique({ where: { number: candidate } });
    if (!clash) return candidate;
  }
  throw new OrderError('No se pudo generar un numero de pedido unico.');
}

/** Devuelve al inventario las unidades reservadas por un pedido. */
export async function restoreStock(orderId: string, tx: TxClient = prisma) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (item.productId) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

/**
 * Descarta un pedido que nunca llego a la pasarela de pago y devuelve su
 * stock.
 *
 * Se usa cuando la creacion de la preferencia de Mercado Pago falla: sin
 * esto, cada reintento del comprador dejaria un pedido fantasma reteniendo
 * inventario que nadie va a pagar.
 */
export async function discardUnpaidOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    // Nunca se descarta un pedido que ya tenga un pago real asociado.
    if (!order || order.status !== 'PENDING') return;
    if (order.payments.some((payment) => payment.externalId !== null)) return;

    await restoreStock(orderId, tx);

    if (order.couponCode) {
      await tx.coupon.updateMany({
        where: { code: order.couponCode, timesRedeemed: { gt: 0 } },
        data: { timesRedeemed: { decrement: 1 } },
      });
    }

    await tx.order.delete({ where: { id: orderId } });
  });
}

const ORDER_STATUS_FROM_PAYMENT: Record<string, OrderStatus> = {
  approved: 'PAID',
  authorized: 'PAID',
  in_process: 'IN_PROCESS',
  in_mediation: 'IN_PROCESS',
  pending: 'PENDING',
  rejected: 'FAILED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
  charged_back: 'REFUNDED',
};

/**
 * Aplica el resultado de un pago al pedido. Es idempotente: reprocesar la
 * misma notificacion no duplica pagos, no descuenta stock dos veces ni
 * retrocede un pedido que ya fue despachado.
 */
export async function applyPaymentUpdate(mpPayment: MpPayment): Promise<
  { handled: false; reason: string } | { handled: true; orderNumber: string; status: OrderStatus }
> {
  const reference = mpPayment.externalReference;
  if (!reference) {
    return { handled: false, reason: 'el pago no trae external_reference' };
  }

  const order = await prisma.order.findUnique({ where: { number: reference } });
  if (!order) {
    return { handled: false, reason: `no existe el pedido ${reference}` };
  }

  const paymentStatus = mapPaymentStatus(mpPayment.status);
  const nextOrderStatus = ORDER_STATUS_FROM_PAYMENT[mpPayment.status] ?? 'PENDING';

  // Verificacion antifraude: el monto cobrado debe coincidir con el pedido.
  // Se suman los productos y el envio, porque Mercado Pago los informa en
  // campos distintos cuando el despacho se cobro por separado.
  const expected = round(order.total);
  const cobrado = chargedTotal(mpPayment);
  const charged = cobrado !== null ? round(cobrado) : null;
  const amountMismatch = charged !== null && !charged.equals(expected);

  // Solo se avisa al cliente si el pedido cambio de estado de verdad. Mercado
  // Pago reintenta la misma notificacion, y sin esto cada reintento seria un
  // correo.
  let changedTo: OrderStatus | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.payment.upsert({
      where: { externalId: mpPayment.id },
      create: {
        orderId: order.id,
        provider: 'mercadopago',
        externalId: mpPayment.id,
        status: paymentStatus,
        statusDetail: mpPayment.statusDetail,
        paymentType: mpPayment.paymentTypeId,
        paymentMethod: mpPayment.paymentMethodId,
        installments: mpPayment.installments,
        amount: charged ?? order.total,
        currency: mpPayment.currencyId ?? order.currency,
        payerEmail: mpPayment.payerEmail,
        raw: mpPayment.raw as Prisma.InputJsonValue,
      },
      update: {
        status: paymentStatus,
        statusDetail: mpPayment.statusDetail,
        paymentType: mpPayment.paymentTypeId,
        paymentMethod: mpPayment.paymentMethodId,
        installments: mpPayment.installments,
        amount: charged ?? order.total,
        raw: mpPayment.raw as Prisma.InputJsonValue,
      },
    });

    if (amountMismatch) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: order.status,
          title: 'Revision manual requerida',
          message: `El monto pagado (${charged?.toString()}) no coincide con el total del pedido (${expected.toString()}).`,
          isPublic: false,
          createdBy: 'sistema',
        },
      });
      return;
    }

    // Un pedido ya despachado o entregado no vuelve atras por una
    // notificacion tardia de Mercado Pago.
    const frozen: OrderStatus[] = ['PREPARING', 'SHIPPED', 'DELIVERED'];
    if (frozen.includes(order.status) && nextOrderStatus === 'PAID') return;
    if (order.status === nextOrderStatus) return;

    const shouldRestoreStock =
      (nextOrderStatus === 'CANCELLED' || nextOrderStatus === 'FAILED') &&
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'REFUNDED';

    if (shouldRestoreStock) {
      await restoreStock(order.id, tx);
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: nextOrderStatus,
        paidAt: nextOrderStatus === 'PAID' ? (order.paidAt ?? new Date()) : order.paidAt,
        cancelledAt:
          nextOrderStatus === 'CANCELLED' || nextOrderStatus === 'FAILED'
            ? (order.cancelledAt ?? new Date())
            : order.cancelledAt,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: nextOrderStatus,
        title: orderStatusLabel(nextOrderStatus),
        message: mpPayment.statusDetail
          ? `Mercado Pago informo: ${mpPayment.statusDetail}`
          : null,
        createdBy: 'mercadopago',
      },
    });

    changedTo = nextOrderStatus;
  });

  if (changedTo) {
    // El correo va fuera de la transaccion: un fallo del proveedor no puede
    // revertir un pago que ya se acredito.
    await notifyOrderStatus(order.id, changedTo).catch((error) => {
      console.error('[orders] no se pudo avisar el cambio de estado', error);
    });
  }

  return { handled: true, orderNumber: order.number, status: nextOrderStatus };
}

export function subtotalOf(lines: { lineTotal: Prisma.Decimal }[]): Prisma.Decimal {
  return round(lines.reduce((acc, l) => acc.plus(toDecimal(l.lineTotal)), new Prisma.Decimal(0)));
}
