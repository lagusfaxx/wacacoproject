import type { OrderStatus } from '@prisma/client';
import { orderStatusLabel } from '@/lib/order-status';

const STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PROCESS: 'bg-sky-100 text-sky-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PREPARING: 'bg-indigo-100 text-indigo-800',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-sand-dark text-ink-soft',
  REFUNDED: 'bg-purple-100 text-purple-800',
  FAILED: 'bg-red-100 text-red-800',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{orderStatusLabel(status)}</span>;
}
