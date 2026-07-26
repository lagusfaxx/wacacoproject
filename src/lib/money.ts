import { Prisma } from '@prisma/client';
import { currencyHasDecimals, env } from './env';

export type Money = Prisma.Decimal;

const LOCALE_BY_CURRENCY: Record<string, string> = {
  CLP: 'es-CL',
  ARS: 'es-AR',
  MXN: 'es-MX',
  COP: 'es-CO',
  PEN: 'es-PE',
  UYU: 'es-UY',
  BRL: 'pt-BR',
  USD: 'en-US',
};

/** Convierte cualquier representacion numerica a Decimal de forma segura. */
export function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

/** Numero plano, util para enviarlo a Mercado Pago o a los componentes cliente. */
export function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(toDecimal(value).toFixed(currencyHasDecimals() ? 2 : 0));
}

/** Redondea al minimo divisible de la moneda (CLP no admite decimales). */
export function round(value: Prisma.Decimal | number | string): Prisma.Decimal {
  const decimals = currencyHasDecimals() ? 2 : 0;
  return toDecimal(value).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
}

export function formatMoney(
  value: Prisma.Decimal | number | string,
  currency = env.currency,
): string {
  const amount = Number(toDecimal(value));
  const decimals = currencyHasDecimals(currency) ? 2 : 0;
  try {
    return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? 'es-CL', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(decimals)}`;
  }
}
