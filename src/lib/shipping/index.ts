import 'server-only';

import { Prisma } from '@prisma/client';
import { env } from '../env';
import { round, toDecimal } from '../money';
import { isValidRegionCode } from '../regions-cl';
import * as bluex from './bluexpress';

/**
 * Calculo del costo de envio.
 *
 * Orden de resolucion:
 *  1. Si la compra supera el umbral de envio gratis, el costo es cero.
 *  2. Si Blue Express esta configurado y puede cotizar el destino, se usa su
 *     tarifa real.
 *  3. Si no, se aplica la tarifa plana de `SHIPPING_FLAT_RATE`.
 *
 * El paso 3 existe para que un corte de la API del courier no impida vender.
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
  /** De donde salio la tarifa, util para el panel y el soporte. */
  source: 'bluex' | 'flat' | 'free' | 'pending';
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
}): Promise<ShippingResult> {
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

  if (!bluex.isConfigured()) return flatRateResult(false);

  if (!isValidRegionCode(regionCode) || commune.trim().length < 2) {
    return {
      ...flatRateResult(false),
      notice: 'Selecciona tu region y comuna para cotizar el envio con Blue Express.',
    };
  }

  const district = await bluex.resolveDistrict(commune, regionCode);
  if (!district) {
    return {
      ...flatRateResult(false),
      notice:
        'No pudimos identificar tu comuna en la red de Blue Express. Aplicamos la tarifa estandar.',
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
      ...flatRateResult(false),
      districtCode: district.districtCode,
      notice: 'Blue Express no esta disponible en este momento. Aplicamos la tarifa estandar.',
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
