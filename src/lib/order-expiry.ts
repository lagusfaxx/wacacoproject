import 'server-only';

import { prisma } from './db';
import { getTransferSettings } from './bank-transfer';
import { restoreStock } from './orders';
import { orderStatusLabel } from './order-status';
import { notifyOrderStatus } from './email/notifications';

/**
 * Vencimiento de los pedidos por transferencia que nunca se pagaron.
 *
 * Un pedido por transferencia descuenta inventario al crearse: esa es la
 * reserva que el comprador esta pidiendo. Si nunca transfiere, esas unidades
 * quedan fuera de la tienda sin que nadie las haya comprado, y con un solo
 * articulo en stock basta un pedido abandonado para que la ficha aparezca
 * agotada. Cumplido el plazo configurado en Ajustes, el pedido se cancela solo
 * y el stock vuelve.
 *
 * Solo alcanza a la transferencia. Los pedidos de Mercado Pago no se tocan:
 * ahi la pasarela puede acreditar un pago tarde y cancelar por nuestra cuenta
 * un pedido que si se pago seria mucho peor que retener una unidad de mas.
 */

/** Espera minima entre dos barridos disparados por visitas a la tienda. */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

let lastSweepAt = 0;
let running: Promise<number> | null = null;

export type ExpiredOrder = { id: string; number: string };

/**
 * Cancela los pedidos por transferencia que pasaron su plazo y devuelve
 * cuantos alcanzo. Es seguro llamarla de mas: si no hay nada vencido no
 * escribe nada.
 */
export async function expireStaleTransferOrders(): Promise<ExpiredOrder[]> {
  const transfer = await getTransferSettings();
  const cutoff = new Date(Date.now() - transfer.holdHours * 60 * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: {
      paymentMethod: 'transferencia',
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: { id: true, number: true, couponCode: true },
    // Un tope por barrido para que una tienda con meses de pedidos viejos no
    // se coma la primera visita despues de un despliegue.
    take: 50,
  });

  const expired: ExpiredOrder[] = [];

  for (const order of stale) {
    try {
      const cancelled = await cancelOne(order.id, order.couponCode);
      if (cancelled) expired.push({ id: order.id, number: order.number });
    } catch (error) {
      console.error(`[pedidos] no se pudo vencer el pedido ${order.number}`, error);
    }
  }

  // Los avisos van fuera de la transaccion y uno por uno: que el proveedor de
  // correo falle no puede dejar el stock retenido.
  for (const order of expired) {
    await notifyOrderStatus(
      order.id,
      'CANCELLED',
      'No vimos la transferencia dentro del plazo, asi que liberamos las unidades reservadas. Si ya transferiste, respondenos este correo con el comprobante y lo reactivamos.',
    ).catch((error) => {
      console.error(`[pedidos] no se pudo avisar la cancelacion de ${order.number}`, error);
    });
  }

  return expired;
}

/**
 * Cancela un pedido concreto dentro de una transaccion, volviendo a comprobar
 * las condiciones: entre la consulta y la escritura el comprador pudo pagar.
 */
async function cancelOne(orderId: string, couponCode: string | null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order || order.status !== 'PENDING' || order.paymentMethod !== 'transferencia') {
      return false;
    }
    // Un pago real asociado significa que algo si llego: lo revisa una persona.
    if (order.payments.some((payment) => payment.externalId !== null)) return false;

    await restoreStock(order.id, tx);

    if (couponCode) {
      await tx.coupon.updateMany({
        where: { code: couponCode, timesRedeemed: { gt: 0 } },
        data: { timesRedeemed: { decrement: 1 } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledAt: order.cancelledAt ?? new Date() },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: 'CANCELLED',
        title: orderStatusLabel('CANCELLED'),
        message: 'Vencio el plazo para transferir y se liberaron las unidades reservadas.',
        createdBy: 'sistema',
      },
    });

    return true;
  });
}

/**
 * Barrido oportunista.
 *
 * El proyecto no tiene un programador de tareas, asi que el vencimiento se
 * dispara con el trafico normal de la tienda, como mucho una vez cada diez
 * minutos. No bloquea a quien esta navegando: se lanza y se olvida.
 *
 * Para una tienda muy quieta conviene ademas el cron de
 * `/api/tareas/vencer-pedidos`, que hace exactamente lo mismo con horario fijo.
 */
export function maybeExpireStaleOrders(): void {
  const now = Date.now();
  if (running || now - lastSweepAt < SWEEP_INTERVAL_MS) return;

  lastSweepAt = now;
  running = expireStaleTransferOrders()
    .then((expired) => expired.length)
    .catch((error) => {
      console.error('[pedidos] fallo el barrido de vencimientos', error);
      return 0;
    })
    .finally(() => {
      running = null;
    });
}
