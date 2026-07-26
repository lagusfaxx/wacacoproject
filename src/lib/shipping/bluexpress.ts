import 'server-only';

import { prisma } from '../db';
import { env } from '../env';

/**
 * Cliente de la API de Blue Express.
 *
 * Se usan dos servicios:
 *  - `/api/ecommerce/comunas/v1/bxgeo`  resuelve el nombre de una comuna al
 *    codigo de distrito interno de Blue Express.
 *  - `/api/ecommerce/pricing/v1`        cotiza el envio con ese codigo, el
 *    origen de la bodega y las dimensiones de los bultos.
 *
 * Las credenciales las entrega Blue Express al habilitar la integracion.
 * Si no estan configuradas, o si la API falla, el llamador debe caer a la
 * tarifa plana: una tienda nunca debe quedar sin poder cobrar el envio.
 */

const REQUEST_TIMEOUT_MS = 8000;
const GEO_CACHE_TTL_DAYS = 30;

export class BluexpressError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'BluexpressError';
  }
}

export type BluexpressConfig = {
  baseUrl: string;
  apiKey: string;
  token: string;
  /** Comuna de origen, en codigo de distrito de Blue Express. */
  originDistrict: string;
  /** Tipos de servicio a cotizar, ej. "EX" o "EX,SD". */
  serviceTypes: string;
  /** PAQU (paquete) o DOCU (documento). */
  productFamily: string;
};

export function readConfig(): BluexpressConfig | null {
  const apiKey = process.env.BLUEX_API_KEY ?? '';
  const token = process.env.BLUEX_TOKEN ?? '';
  const originDistrict = process.env.BLUEX_ORIGIN_DISTRICT ?? '';

  if (!apiKey || !token || !originDistrict) return null;

  return {
    baseUrl: (process.env.BLUEX_BASE_URL ?? 'https://apigw.bluex.cl').replace(/\/+$/, ''),
    apiKey,
    token,
    originDistrict,
    serviceTypes: process.env.BLUEX_SERVICE_TYPES ?? 'EX',
    productFamily: process.env.BLUEX_PRODUCT_FAMILY ?? 'PAQU',
  };
}

export function isConfigured(): boolean {
  return readConfig() !== null;
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();

    if (!response.ok) {
      throw new BluexpressError(
        `Blue Express respondio ${response.status}`,
        text.slice(0, 500),
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BluexpressError('Blue Express devolvio una respuesta que no es JSON', text.slice(0, 200));
    }
  } catch (error) {
    if (error instanceof BluexpressError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BluexpressError('Blue Express no respondio a tiempo');
    }
    throw new BluexpressError('No se pudo contactar a Blue Express', error);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Resolucion de comuna -> codigo de distrito
// ---------------------------------------------------------------------------

type GeoResponse = {
  data?: {
    districtCode?: string;
    district?: string;
    cityName?: string;
    regionCode?: string;
  } | null;
  districtCode?: string;
  code?: string;
};

/** Normaliza para comparar: sin tildes, minusculas, sin espacios extra. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Traduce una comuna escrita por el comprador al codigo que usa Blue Express.
 * El resultado se cachea en la base de datos: el padron de comunas casi no
 * cambia y evita una llamada extra en cada cotizacion.
 */
export async function resolveDistrict(
  commune: string,
  regionCode: string,
): Promise<{ districtCode: string; districtName: string } | null> {
  const config = readConfig();
  if (!config) return null;

  const key = `bluex:district:${regionCode}:${normalize(commune)}`;
  const cached = await prisma.setting.findUnique({ where: { key } }).catch(() => null);

  if (cached) {
    const age = Date.now() - cached.updatedAt.getTime();
    if (age < GEO_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
      const [districtCode, ...rest] = cached.value.split('|');
      if (districtCode) return { districtCode, districtName: rest.join('|') || commune };
    }
  }

  let payload: GeoResponse;
  try {
    payload = await postJson<GeoResponse>(
      `${config.baseUrl}/api/ecommerce/comunas/v1/bxgeo`,
      {
        address: commune.trim(),
        type: 'wacaco-store',
        shop: `${env.appUrl}/`,
        regionCode,
        agencyId: '',
      },
      { apikey: config.apiKey, 'BX-TOKEN': config.token },
    );
  } catch (error) {
    console.error('[bluex] no se pudo resolver la comuna', commune, error);
    return null;
  }

  const districtCode = payload.data?.districtCode ?? payload.districtCode ?? payload.code ?? '';
  if (!districtCode) return null;

  const districtName = payload.data?.district ?? payload.data?.cityName ?? commune.trim();

  await prisma.setting
    .upsert({
      where: { key },
      create: { key, value: `${districtCode}|${districtName}` },
      update: { value: `${districtCode}|${districtName}` },
    })
    .catch(() => undefined);

  return { districtCode, districtName };
}

// ---------------------------------------------------------------------------
// Cotizacion
// ---------------------------------------------------------------------------

export type Parcel = {
  /** Peso en kilogramos. */
  weightKg: number;
  /** Dimensiones en centimetros. */
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  quantity: number;
};

export type ShippingQuote = {
  /** Codigo del servicio, ej. "EX". */
  serviceType: string;
  serviceName: string;
  /** Costo en la moneda de la tienda. */
  cost: number;
  /** Dias habiles prometidos, si Blue Express los informa. */
  promiseDays: number | null;
  isFree: boolean;
};

type PricingResponse = {
  code?: string;
  message?: string;
  data?: {
    total?: number | string;
    promiseDay?: number | string;
    nameService?: string;
    serviceType?: string;
    isShipmentFree?: boolean;
  } | null;
};

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Cotiza un envio. Devuelve `null` cuando Blue Express no esta configurado o
 * no puede cotizar ese destino; el llamador decide el respaldo.
 */
export async function quote(input: {
  districtCode: string;
  regionCode: string;
  parcels: Parcel[];
  /** Valor declarado del pedido, requerido por la cabecera `price`. */
  declaredValue: number;
}): Promise<ShippingQuote | null> {
  const config = readConfig();
  if (!config) return null;

  if (input.parcels.length === 0) return null;

  const bultos = input.parcels.map((parcel) => ({
    ancho: Math.max(1, Math.round(parcel.widthCm)),
    largo: Math.max(1, Math.round(parcel.lengthCm)),
    alto: Math.max(1, Math.round(parcel.heightCm)),
    pesoFisico: Math.max(0.1, Number(parcel.weightKg.toFixed(2))),
    cantidad: Math.max(1, Math.round(parcel.quantity)),
  }));

  let payload: PricingResponse;
  try {
    payload = await postJson<PricingResponse>(
      `${config.baseUrl}/api/ecommerce/pricing/v1`,
      {
        from: { country: 'CL', district: config.originDistrict },
        to: { country: 'CL', state: input.regionCode, district: input.districtCode },
        serviceType: config.serviceTypes,
        domain: `${env.appUrl}/`,
        datosProducto: {
          producto: 'P',
          familiaProducto: config.productFamily,
          bultos,
        },
      },
      {
        apikey: config.apiKey,
        'BX-TOKEN': config.token,
        price: String(Math.round(input.declaredValue)),
      },
    );
  } catch (error) {
    console.error('[bluex] fallo la cotizacion', error);
    return null;
  }

  // "00" y "01" son las respuestas correctas del cotizador.
  if (payload.code && payload.code !== '00' && payload.code !== '01') {
    console.warn('[bluex] cotizacion rechazada:', payload.code, payload.message);
    return null;
  }

  const total = toNumberOrNull(payload.data?.total);
  if (total === null) return null;

  return {
    serviceType: payload.data?.serviceType ?? config.serviceTypes.split(',')[0]!.trim(),
    serviceName: payload.data?.nameService ?? 'Blue Express',
    cost: Math.max(0, Math.round(total)),
    promiseDays: toNumberOrNull(payload.data?.promiseDay),
    isFree: payload.data?.isShipmentFree === true,
  };
}

/** URL publica de seguimiento de Blue Express. */
export function trackingUrl(trackingNumber: string): string {
  return `https://www.bluex.cl/seguimiento/?documento=${encodeURIComponent(trackingNumber)}`;
}
