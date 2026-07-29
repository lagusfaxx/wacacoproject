import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { round, toDecimal } from '../money';
import { isValidRegionCode } from '../regions-cl';
import * as bluex from './bluexpress';

/**
 * Calculo del costo de envio.
 *
 * Orden de resolucion, de mas especifico a mas general:
 *  1. Si la compra supera el umbral de envio gratis, el costo es cero.
 *  2. Si Blue Express esta configurado y puede cotizar el destino, se usa su
 *     tarifa real.
 *  3. Si el propietario definio una tarifa manual para esa region, se usa esa.
 *  4. Si no hay nada de lo anterior, la tarifa plana de `SHIPPING_FLAT_RATE`.
 *
 * Los pasos 3 y 4 existen para que la tienda pueda vender sin contrato con un
 * courier, y para que una caida de su API no bloquee las compras.
 */

export type ShipmentDestination = {
  regionCode: string;
  commune: string;
};

export type ShipmentItem = {
  quantity: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShippingResult = {
  cost: Prisma.Decimal;
  carrier: string;
  serviceType: string | null;
  serviceName: string;
  promiseDays: number | null;
  districtCode: string | null;
  /**
   * De donde salio la tarifa.
   * `unavailable` = el propietario no despacha a esa region y la compra debe
   * bloquearse; no es un error tecnico sino una decision de negocio.
   * `pickup` = no hay envio, el comprador pasa a buscar el pedido.
   */
  source: 'bluex' | 'manual' | 'flat' | 'free' | 'pending' | 'unavailable' | 'pickup';
  /** Mensaje para mostrar al comprador cuando no se pudo cotizar. */
  notice: string | null;
};

const FLAT_CARRIER = 'Despacho estandar';

export function isBluexpressEnabled(): boolean {
  return bluex.isConfigured();
}

export function flatRateResult(free: boolean): ShippingResult {
  return {
    cost: round(free ? 0 : env.shippingFlatRate),
    carrier: FLAT_CARRIER,
    serviceType: null,
    serviceName: FLAT_CARRIER,
    promiseDays: null,
    districtCode: null,
    source: free ? 'free' : 'flat',
    notice: null,
  };
}

/**
 * Tarifa que el propietario cargo a mano para una region.
 * Devuelve `undefined` si no hay ninguna definida para ese destino.
 */
async function manualRate(
  regionCode: string,
  carrierName: string,
): Promise<ShippingResult | null | undefined> {
  const rate = await prisma.shippingRate
    .findUnique({ where: { regionCode } })
    .catch(() => null);

  if (!rate) return undefined;

  // Una tarifa desactivada significa "no despacho a esta region", que es
  // distinto de "no tengo tarifa": hay que impedir la compra, no cobrar otra.
  if (!rate.active) return null;

  return {
    cost: round(rate.price),
    carrier: carrierName,
    serviceType: null,
    serviceName: carrierName,
    promiseDays: rate.etaDays,
    districtCode: null,
    source: 'manual',
    notice: null,
  };
}

/**
 * Retiro en tienda: no hay envio que cotizar ni que cobrar.
 *
 * Se devuelve como si fuera una tarifa para que el resto del calculo no tenga
 * que saber nada del retiro: el costo es cero y el "transportista" es el punto
 * de retiro, que es lo que el comprador necesita leer en el resumen.
 */
export function pickupShipping(placeName: string): ShippingResult {
  const label = placeName.trim() || 'Retiro en tienda';
  return {
    cost: new Prisma.Decimal(0),
    carrier: 'Retiro en tienda',
    serviceType: null,
    serviceName: label,
    promiseDays: null,
    districtCode: null,
    source: 'pickup',
    notice: null,
  };
}

/** Envio aun sin calcular: el comprador no ha ingresado su direccion. */
export function pendingShipping(): ShippingResult {
  return {
    cost: new Prisma.Decimal(0),
    carrier: FLAT_CARRIER,
    serviceType: null,
    serviceName: FLAT_CARRIER,
    promiseDays: null,
    districtCode: null,
    source: 'pending',
    notice: 'El costo de envio se calcula al ingresar tu direccion.',
  };
}

/**
 * Convierte las lineas del carrito en bultos para el cotizador.
 * Se envia un bulto por linea, como espera Blue Express.
 */
function toParcels(items: ShipmentItem[]): bluex.Parcel[] {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      weightKg: Math.max(0.1, item.weightGrams / 1000),
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      quantity: item.quantity,
    }));
}

export async function quoteShipping(input: {
  items: ShipmentItem[];
  /** Subtotal ya descontado, base del umbral de envio gratis. */
  payableSubtotal: Prisma.Decimal;
  destination: ShipmentDestination | null;
  /** Nombre del transportista mostrado en las tarifas manuales. */
  carrierName?: string;
}): Promise<ShippingResult> {
  const carrierName = input.carrierName?.trim() || FLAT_CARRIER;
  if (input.items.length === 0) {
    return { ...flatRateResult(true), source: 'free' };
  }

  const threshold = env.freeShippingThreshold;
  const qualifiesFree = threshold > 0 && input.payableSubtotal.greaterThanOrEqualTo(threshold);

  if (qualifiesFree) {
    // Aun asi se intenta identificar el servicio, para que el pedido registre
    // con que courier viaja aunque el comprador no pague el envio.
    const carrier = bluex.isConfigured() ? 'Blue Express' : FLAT_CARRIER;
    return {
      cost: new Prisma.Decimal(0),
      carrier,
      serviceType: null,
      serviceName: carrier,
      promiseDays: null,
      districtCode: null,
      source: 'free',
      notice: null,
    };
  }

  if (!input.destination) return pendingShipping();

  const { regionCode, commune } = input.destination;

  if (!isValidRegionCode(regionCode)) return flatRateResult(false);

  // Respaldo para esta region, calculado una vez y reutilizado en cada salida.
  const manual = await manualRate(regionCode, carrierName);

  if (manual === null) {
    return {
      cost: new Prisma.Decimal(0),
      carrier: carrierName,
      serviceType: null,
      serviceName: carrierName,
      promiseDays: null,
      districtCode: null,
      source: 'unavailable',
      notice: 'Por ahora no despachamos a esta region. Escribenos y lo vemos.',
    };
  }

  const fallback = manual ?? flatRateResult(false);

  if (!bluex.isConfigured()) return fallback;

  if (commune.trim().length < 2) {
    return {
      ...fallback,
      notice: 'Ingresa tu comuna para cotizar el envio con Blue Express.',
    };
  }

  const district = await bluex.resolveDistrict(commune, regionCode);
  if (!district) {
    return {
      ...fallback,
      notice:
        'No pudimos identificar tu comuna en la red de Blue Express. Aplicamos la tarifa para tu region.',
    };
  }

  const quote = await bluex.quote({
    districtCode: district.districtCode,
    regionCode,
    parcels: toParcels(input.items),
    declaredValue: Number(input.payableSubtotal),
  });

  if (!quote) {
    return {
      ...fallback,
      districtCode: district.districtCode,
      notice:
        'Blue Express no esta disponible en este momento. Aplicamos la tarifa para tu region.',
    };
  }

  return {
    cost: round(quote.isFree ? 0 : quote.cost),
    carrier: 'Blue Express',
    serviceType: quote.serviceType,
    serviceName: quote.serviceName,
    promiseDays: quote.promiseDays,
    districtCode: district.districtCode,
    source: quote.isFree ? 'free' : 'bluex',
    notice: null,
  };
}

/** URL de seguimiento segun el transportista registrado en el pedido. */
export function trackingUrlFor(carrier: string | null, trackingNumber: string): string | null {
  if (!trackingNumber) return null;
  if (carrier && /blue\s*express|bluex/i.test(carrier)) {
    return bluex.trackingUrl(trackingNumber);
  }
  return null;
}

export { toDecimal };
