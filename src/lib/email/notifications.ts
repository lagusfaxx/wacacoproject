import 'server-only';

import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { formatMoney, toDecimal } from '../money';
import { getStoreSettings } from '../store-settings';
import { getPickupSettings, pickupAddressLines } from '../pickup';
import { deliver, type DeliveryResult } from './send';
import {
  adminNewOrderEmail,
  orderPaidEmail,
  orderPlacedEmail,
  orderStatusEmail,
  passwordResetEmail,
  verificationCodeEmail,
  type EmailBrand,
  type OrderEmailData,
} from './templates';

/**
 * Los correos que la tienda envia, ya conectados a la base de datos.
 *
 * Todas las funciones devuelven el resultado en vez de lanzar: quien las llama
 * esta cerrando una compra o guardando un pedido, y ninguna de esas cosas debe
 * fallar porque el proveedor de correo tuvo un mal minuto.
 */

const ORDER_INCLUDE = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

async function brand(): Promise<EmailBrand> {
  const settings = await getStoreSettings();
  return {
    storeName: settings.name,
    logoUrl: settings.logoUrl,
    appUrl: env.appUrl,
    contactEmail: settings.email,
  };
}

/** Nombres legibles de los medios de pago que informa Mercado Pago. */
const PAYMENT_LABELS: Record<string, string> = {
  credit_card: 'Tarjeta de credito',
  debit_card: 'Tarjeta de debito',
  prepaid_card: 'Tarjeta prepago',
  account_money: 'Dinero en cuenta de Mercado Pago',
  bank_transfer: 'Transferencia bancaria',
  ticket: 'Pago en efectivo',
  atm: 'Pago en cajero',
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(value);
}

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

function toEmailData(order: OrderRecord, pickup: string[] | null): OrderEmailData {
  const currency = order.currency;
  const payment = order.payments[0] ?? null;
  const discount = toDecimal(order.discountTotal);
  const tax = toDecimal(order.taxTotal);

  return {
    number: order.number,
    // Se prefiere el nombre del despacho: es el que el cliente escribio en
    // esta compra, aunque su cuenta tenga otro.
    customerName: (order.shipFullName || '').split(' ')[0] || 'hola',
    customerNameFull: order.shipFullName || '',
    pickup,
    items: order.items.map((item) => ({
      name: item.name,
      variantName: item.variantName,
      quantity: item.quantity,
      lineTotal: formatMoney(item.lineTotal, currency),
    })),
    subtotal: formatMoney(order.subtotal, currency),
    discountTotal: discount.greaterThan(0) ? formatMoney(discount, currency) : null,
    shippingTotal: toDecimal(order.shippingTotal).greaterThan(0)
      ? formatMoney(order.shippingTotal, currency)
      : 'Gratis',
    taxTotal: tax.greaterThan(0) ? formatMoney(tax, currency) : null,
    total: formatMoney(order.total, currency),
    couponCode: order.couponCode,
    shippingAddress: [
      order.shipFullName,
      order.shipLine1,
      order.shipLine2 ?? '',
      `${order.shipCity}, ${order.shipRegion}`,
      order.shipPostalCode,
      order.shipPhone,
    ],
    shippingService: order.shipServiceName ?? order.shipCarrier,
    trackingUrl: `${env.appUrl}/seguimiento/${order.trackingToken}`,
    carrier: order.carrier ?? order.shipCarrier,
    trackingNumber: order.trackingNumber,
    carrierTrackingUrl: order.trackingUrl,
    paymentMethod: payment?.paymentType ? (PAYMENT_LABELS[payment.paymentType] ?? null) : null,
    paidAt: order.paidAt ? formatDate(order.paidAt) : null,
  };
}

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
}

/**
 * El punto de retiro de un pedido, o `null` si el pedido se despacha.
 *
 * Se lee de los ajustes y no del pedido porque es el dato vivo: si la tienda
 * se cambio de local entre la compra y el retiro, el cliente tiene que leer la
 * direccion nueva. Como respaldo queda la que se congelo en el pedido, por si
 * el punto de retiro se borro de los ajustes.
 */
async function pickupLinesFor(order: OrderRecord): Promise<string[] | null> {
  if (order.deliveryMethod !== 'retiro') return null;

  const lines = pickupAddressLines(await getPickupSettings());
  if (lines.length > 0) return lines;

  return [order.shipLine2 ?? '', order.shipLine1, `${order.shipCity}, ${order.shipRegion}`].filter(
    (line) => line.trim(),
  );
}

const SKIPPED: DeliveryResult = { outcome: 'skipped', detail: 'sin datos para enviar' };

/** Aviso de que el pedido quedo registrado, antes de que se acredite el pago. */
export async function notifyOrderPlaced(orderId: string): Promise<DeliveryResult> {
  const order = await loadOrder(orderId);
  if (!order) return SKIPPED;

  const data = toEmailData(order, await pickupLinesFor(order));
  return deliver({
    to: order.email,
    type: 'order.placed',
    dedupeKey: `order:${order.id}:placed`,
    email: orderPlacedEmail(await brand(), data),
  });
}

/**
 * Comprobante para el cliente y aviso para la tienda. Se llaman juntos porque
 * los dos cuelgan del mismo hecho: el pago se acredito.
 */
export async function notifyOrderPaid(orderId: string): Promise<DeliveryResult> {
  const order = await loadOrder(orderId);
  if (!order) return SKIPPED;

  const theme = await brand();
  const data = toEmailData(order, await pickupLinesFor(order));

  const customer = await deliver({
    to: order.email,
    type: 'order.paid',
    dedupeKey: `order:${order.id}:paid`,
    email: orderPaidEmail(theme, data),
  });

  await deliver({
    to: theme.contactEmail,
    type: 'order.paid.admin',
    dedupeKey: `order:${order.id}:paid:admin`,
    email: adminNewOrderEmail(theme, data, `${env.appUrl}/admin/pedidos/${order.number}`),
  });

  return customer;
}

/**
 * Cambio de estado (en preparacion, despachado, entregado, cancelado...).
 *
 * PENDING e IN_PROCESS no se avisan: son estados de tramite del pago que el
 * cliente ya vio en la pantalla de resultado, y avisarlos solo genera ruido.
 */
const SILENT_STATUSES: OrderStatus[] = ['PENDING', 'IN_PROCESS'];

export function statusIsNotifiable(status: OrderStatus): boolean {
  return !SILENT_STATUSES.includes(status);
}

export async function notifyOrderStatus(
  orderId: string,
  status: OrderStatus,
  note: string | null = null,
): Promise<DeliveryResult> {
  if (!statusIsNotifiable(status)) return { outcome: 'skipped', detail: 'estado sin aviso' };

  const order = await loadOrder(orderId);
  if (!order) return SKIPPED;

  // El pago acreditado tiene su propio correo, con comprobante.
  if (status === 'PAID') return notifyOrderPaid(orderId);

  const pickup = await pickupLinesFor(order);
  const data = toEmailData(order, pickup);

  // Sin nota escrita a mano, el aviso de retiro lleva las instrucciones
  // generales que el propietario cargo en Ajustes.
  const mensaje =
    note ?? (status === 'READY_FOR_PICKUP' ? (await getPickupSettings()).notes.trim() || null : null);

  return deliver({
    to: order.email,
    type: `order.${status.toLowerCase()}`,
    // Un pedido puede volver a un estado por el que ya paso (de despachado a
    // en preparacion, por ejemplo) y ese aviso si debe salir de nuevo, asi que
    // la clave incluye el momento del cambio.
    dedupeKey: `order:${order.id}:${status}:${order.updatedAt.getTime()}`,
    email: orderStatusEmail(await brand(), data, status, mensaje),
  });
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

export async function notifyVerificationCode(input: {
  email: string;
  name: string;
  code: string;
  minutes: number;
}): Promise<DeliveryResult> {
  return deliver({
    to: input.email,
    type: 'account.verify',
    email: verificationCodeEmail(await brand(), {
      code: input.code,
      name: input.name,
      minutes: input.minutes,
    }),
  });
}

export async function notifyPasswordReset(input: {
  email: string;
  name: string;
  code: string;
  minutes: number;
}): Promise<DeliveryResult> {
  return deliver({
    to: input.email,
    type: 'account.reset',
    email: passwordResetEmail(await brand(), {
      code: input.code,
      name: input.name,
      minutes: input.minutes,
    }),
  });
}
