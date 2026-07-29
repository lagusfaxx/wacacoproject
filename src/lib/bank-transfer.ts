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
} as const;

export type TransferSettings = {
  enabled: boolean;
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  taxId: string;
  email: string;
  notes: string;
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
};

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
  };
}
