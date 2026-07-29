import 'server-only';

import { prisma } from './db';
import { env } from './env';

/**
 * Despacho y devoluciones, tal como se los declaramos a Google.
 *
 * Google no muestra el precio en el resultado de un producto solo porque el
 * precio este en la pagina: para eso la ficha tiene que calificar como
 * "merchant listing", y ahi pide ademas saber cuanto cuesta el envio, cuanto
 * demora y que pasa si el cliente devuelve el producto. Sin eso, el precio
 * queda fuera del resultado por mucho que el dato exista.
 *
 * Son datos del negocio, no del programa, asi que se editan desde el panel.
 * Los valores por defecto son los habituales de una tienda chilena que vende a
 * distancia, pero el propietario tiene que confirmarlos: lo que se declara
 * aqui es una promesa publica.
 */

export const POLICY_KEYS = {
  returnDays: 'politica.devolucionDias',
  returnsFree: 'politica.devolucionGratis',
  deliveryMin: 'politica.entregaMinima',
  deliveryMax: 'politica.entregaMaxima',
  handlingDays: 'politica.diasDespacho',
} as const;

export type StorePolicies = {
  /** Dias para devolver. 0 = no se aceptan devoluciones. */
  returnDays: number;
  /** true = la tienda paga el envio de vuelta. */
  returnsFree: boolean;
  /** Dias habiles de transito, del despacho a la entrega. */
  deliveryMin: number;
  deliveryMax: number;
  /** Dias habiles entre el pago y la entrega al courier. */
  handlingDays: number;
};

/**
 * Diez dias es el plazo de retracto que la ley chilena da en las ventas a
 * distancia, asi que es el piso razonable mientras nadie lo cambie.
 */
export const DEFAULT_POLICIES: StorePolicies = {
  returnDays: 10,
  returnsFree: false,
  deliveryMin: 1,
  deliveryMax: 5,
  handlingDays: 1,
};

function toInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(0, parsed));
}

export async function getStorePolicies(): Promise<StorePolicies> {
  let rows: { key: string; value: string }[] = [];

  try {
    rows = await prisma.setting.findMany({
      where: { key: { in: Object.values(POLICY_KEYS) } },
      select: { key: true, value: true },
    });
  } catch {
    return DEFAULT_POLICIES;
  }

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const min = toInt(map.get(POLICY_KEYS.deliveryMin), DEFAULT_POLICIES.deliveryMin, 90);
  const max = toInt(map.get(POLICY_KEYS.deliveryMax), DEFAULT_POLICIES.deliveryMax, 90);

  return {
    returnDays: toInt(map.get(POLICY_KEYS.returnDays), DEFAULT_POLICIES.returnDays, 365),
    returnsFree: map.get(POLICY_KEYS.returnsFree) === 'true',
    // Un maximo menor que el minimo es un dato imposible que invalida la ficha
    // entera; se ordena en vez de publicarlo al reves.
    deliveryMin: Math.min(min, max),
    deliveryMax: Math.max(min, max),
    handlingDays: toInt(map.get(POLICY_KEYS.handlingDays), DEFAULT_POLICIES.handlingDays, 30),
  };
}

/**
 * El costo del envio que se declara.
 *
 * Se publica la tarifa plana, que es lo que paga quien no alcanza el envio
 * gratis. Declarar de mas y cobrar de menos no molesta a nadie; al reves si,
 * y ademas Google lo penaliza.
 */
export function shippingDetailsJsonLd(policies: StorePolicies) {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: env.shippingFlatRate,
      currency: env.currency,
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'CL',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: policies.handlingDays,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: policies.deliveryMin,
        maxValue: policies.deliveryMax,
        unitCode: 'DAY',
      },
    },
  };
}

export function returnPolicyJsonLd(policies: StorePolicies) {
  if (policies.returnDays <= 0) {
    return {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'CL',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    };
  }

  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'CL',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: policies.returnDays,
    returnMethod: 'https://schema.org/ReturnByMail',
    ...(policies.returnsFree
      ? { returnFees: 'https://schema.org/FreeReturn' }
      : {
          returnFees: 'https://schema.org/ReturnShippingFees',
          // Decir que el envio de vuelta lo paga el comprador sin decir cuanto
          // deja la promesa a medias, y Google lo reclama. Se declara la misma
          // tarifa del despacho, que es lo que cuesta el viaje de vuelta.
          returnShippingFeesAmount: {
            '@type': 'MonetaryAmount',
            value: env.shippingFlatRate,
            currency: env.currency,
          },
        }),
  };
}

/**
 * Hasta cuando vale el precio publicado.
 *
 * Google lo pide para no mostrar en sus resultados un precio de hace un ano.
 * Se declara a un ano vista y se recalcula en cada visita, que es tanto como
 * decir "este precio es el de hoy".
 */
export function priceValidUntil(now = new Date()): string {
  const limite = new Date(now);
  limite.setUTCFullYear(limite.getUTCFullYear() + 1);
  return limite.toISOString().slice(0, 10);
}
