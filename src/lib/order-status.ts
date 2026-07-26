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
  SHIPPED: 'Tu pedido va en camino.',
  DELIVERED: 'Tu pedido fue entregado. Que lo disfrutes.',
  CANCELLED: 'Este pedido fue cancelado.',
  REFUNDED: 'Este pedido fue reembolsado.',
  FAILED: 'El pago fue rechazado. Puedes reintentarlo.',
};

/** Etapas visibles en la linea de tiempo del cliente. */
export const FULFILLMENT_FLOW: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
];

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

export function orderStatusDescription(status: OrderStatus): string {
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
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'FAILED',
];
