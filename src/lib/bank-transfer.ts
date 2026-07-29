import 'server-only';

import { prisma } from './db';

/**
 * Datos para pagar por transferencia.
 *
 * Viven en los ajustes y no en el codigo porque cambian: una cuenta nueva, un
 * banco distinto, otro correo para los comprobantes. El propietario los edita
 * desde el panel y se reflejan en el checkout y en el seguimiento del pedido.
 */

export const TRANSFER_KEYS = {
  enabled: 'pago.transferencia.activo',
  bank: 'pago.transferencia.banco',
  accountType: 'pago.transferencia.tipoCuenta',
  accountNumber: 'pago.transferencia.numeroCuenta',
  holder: 'pago.transferencia.titular',
  taxId: 'pago.transferencia.rut',
  email: 'pago.transferencia.correo',
  notes: 'pago.transferencia.instrucciones',
  holdHours: 'pago.transferencia.horasReserva',
} as const;

/**
 * Horas que un pedido por transferencia mantiene reservado el stock.
 *
 * Al elegir transferencia el pedido descuenta inventario igual que una compra
 * pagada: es lo que hace que la reserva valga algo. Sin un plazo, quien nunca
 * transfiere deja esas unidades fuera de la tienda para siempre. Cumplido el
 * plazo el pedido se cancela solo y el stock vuelve.
 */
export const DEFAULT_HOLD_HOURS = 48;
export const MIN_HOLD_HOURS = 1;
export const MAX_HOLD_HOURS = 240;

export type TransferSettings = {
  enabled: boolean;
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  taxId: string;
  email: string;
  notes: string;
  /** Horas que el pedido queda reservado esperando la transferencia. */
  holdHours: number;
};

export const EMPTY_TRANSFER: TransferSettings = {
  enabled: false,
  bank: '',
  accountType: '',
  accountNumber: '',
  holder: '',
  taxId: '',
  email: '',
  notes: '',
  holdHours: DEFAULT_HOLD_HOURS,
};

/** Lee las horas de reserva de un valor guardado, acotadas a un rango sensato. */
export function parseHoldHours(value: string | undefined | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HOLD_HOURS;
  return Math.min(MAX_HOLD_HOURS, Math.max(MIN_HOLD_HOURS, parsed));
}

/**
 * Solo se ofrece transferencia si esta activada y los datos minimos estan
 * cargados: banco, numero de cuenta y titular. Mostrar el metodo con la cuenta
 * a medio llenar es peor que no ofrecerlo.
 */
export function transferIsUsable(transfer: TransferSettings): boolean {
  return Boolean(
    transfer.enabled && transfer.bank.trim() && transfer.accountNumber.trim() && transfer.holder.trim(),
  );
}

export async function getTransferSettings(): Promise<TransferSettings> {
  let rows: { key: string; value: string }[] = [];

  try {
    rows = await prisma.setting.findMany({
      where: { key: { in: Object.values(TRANSFER_KEYS) } },
      select: { key: true, value: true },
    });
  } catch {
    return EMPTY_TRANSFER;
  }

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    enabled: map.get(TRANSFER_KEYS.enabled) === 'true',
    bank: map.get(TRANSFER_KEYS.bank) ?? '',
    accountType: map.get(TRANSFER_KEYS.accountType) ?? '',
    accountNumber: map.get(TRANSFER_KEYS.accountNumber) ?? '',
    holder: map.get(TRANSFER_KEYS.holder) ?? '',
    taxId: map.get(TRANSFER_KEYS.taxId) ?? '',
    email: map.get(TRANSFER_KEYS.email) ?? '',
    notes: map.get(TRANSFER_KEYS.notes) ?? '',
    holdHours: parseHoldHours(map.get(TRANSFER_KEYS.holdHours)),
  };
}
