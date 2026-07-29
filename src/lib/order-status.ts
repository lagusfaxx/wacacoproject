import type { OrderStatus } from '@prisma/client';

/**
 * Etiquetas y flujo de estados. Vive fuera de `orders.ts` porque tambien lo
 * usan componentes de cliente, que no pueden importar modulos `server-only`.
 */
const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pago pendiente',
  IN_PROCESS: 'Pago en revision',
  PAID: 'Pago aprobado',
  PREPARING: 'En preparacion',
  READY_FOR_PICKUP: 'Listo para retiro',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
  FAILED: 'Pago rechazado',
};

const STATUS_DESCRIPTION: Record<OrderStatus, string> = {
  PENDING: 'Estamos esperando la confirmacion de Mercado Pago.',
  IN_PROCESS: 'Mercado Pago esta revisando el pago. Te avisaremos en cuanto se acredite.',
  PAID: 'Recibimos tu pago. Estamos preparando tu pedido.',
  PREPARING: 'Tu pedido esta siendo preparado en bodega.',
  READY_FOR_PICKUP: 'Tu pedido esta listo para que lo retires.',
  SHIPPED: 'Tu pedido va en camino.',
  DELIVERED: 'Tu pedido fue entregado. Que lo disfrutes.',
  CANCELLED: 'Este pedido fue cancelado.',
  REFUNDED: 'Este pedido fue reembolsado.',
  FAILED: 'El pago fue rechazado. Puedes reintentarlo.',
};

/** Etapas visibles en la linea de tiempo del cliente, para un despacho. */
export const FULFILLMENT_FLOW: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
];

/** El mismo recorrido para un pedido que se retira: no hay despacho. */
export const PICKUP_FLOW: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DELIVERED',
];

export function fulfillmentFlow(deliveryMethod: string): OrderStatus[] {
  return deliveryMethod === 'retiro' ? PICKUP_FLOW : FULFILLMENT_FLOW;
}

/** Un pedido que se retira en tienda, no que viaja. */
export function isPickup(order: { deliveryMethod: string }): boolean {
  return order.deliveryMethod === 'retiro';
}

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

/**
 * El texto que explica el estado.
 *
 * Con `paymentMethod` se ajusta al medio de pago: a quien esta esperando para
 * transferir no se le puede decir que se espera la confirmacion de Mercado
 * Pago, porque no hay ninguna que vaya a llegar.
 */
export function orderStatusDescription(
  status: OrderStatus,
  options: { paymentMethod?: string; deliveryMethod?: string } = {},
): string {
  if (status === 'PENDING' && options.paymentMethod === 'transferencia') {
    return 'Estamos esperando tu transferencia. Tu pedido queda reservado mientras tanto.';
  }
  if (status === 'DELIVERED' && options.deliveryMethod === 'retiro') {
    return 'Retiraste tu pedido. Que lo disfrutes.';
  }
  return STATUS_DESCRIPTION[status];
}

export function isTerminalFailure(status: OrderStatus): boolean {
  return status === 'CANCELLED' || status === 'FAILED' || status === 'REFUNDED';
}

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'IN_PROCESS',
  'PAID',
  'PREPARING',
  'READY_FOR_PICKUP',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'FAILED',
];
