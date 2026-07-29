import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type { PaymentStatus } from '@prisma/client';
import { env } from './env';

/**
 * Capa de integracion con Mercado Pago (Checkout Pro).
 *
 * Reglas de seguridad que se aplican aqui:
 *  1. El monto enviado a Mercado Pago se calcula en el servidor (ver pricing.ts).
 *  2. Toda notificacion entrante se valida con HMAC-SHA256 (cabecera x-signature).
 *  3. El estado real del pago nunca se toma del cuerpo del webhook: se vuelve
 *     a consultar a la API de Mercado Pago usando el access token.
 */

function client(): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: env.mpAccessToken,
    options: { timeout: 10_000 },
  });
}

export type PreferenceItem = {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  pictureUrl?: string;
};

export type CreatePreferenceInput = {
  orderNumber: string;
  items: PreferenceItem[];
  shippingCost: number;
  payer: { name: string; email: string; phone?: string };
  /** Token del pedido, usado para armar las URLs de retorno. */
  trackingToken: string;
};

export type CreatePreferenceResult = {
  preferenceId: string;
  /** URL a la que se redirige al comprador. */
  checkoutUrl: string;
};

export async function createCheckoutPreference(
  input: CreatePreferenceInput,
): Promise<CreatePreferenceResult> {
  const preference = new Preference(client());
  const baseUrl = env.appUrl;

  const items = input.items.map((item) => ({
    id: item.id,
    title: item.title.slice(0, 250),
    description: item.description?.slice(0, 250),
    quantity: item.quantity,
    unit_price: item.unitPrice,
    currency_id: env.currency,
    picture_url: item.pictureUrl,
  }));

  const [firstName, ...restName] = input.payer.name.trim().split(/\s+/);

  const response = await preference.create({
    body: {
      items,
      payer: {
        name: firstName ?? input.payer.name,
        surname: restName.join(' ') || undefined,
        email: input.payer.email,
      },
      // Identifica el pedido en la respuesta del webhook.
      external_reference: input.orderNumber,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${baseUrl}/checkout/resultado?ref=${input.trackingToken}`,
        pending: `${baseUrl}/checkout/resultado?ref=${input.trackingToken}`,
        failure: `${baseUrl}/checkout/resultado?ref=${input.trackingToken}`,
      },
      auto_return: 'approved',
      statement_descriptor: env.storeName.slice(0, 22),
      shipments: input.shippingCost > 0 ? { cost: input.shippingCost, mode: 'not_specified' } : undefined,
      payment_methods: {
        excluded_payment_types: [],
        installments: 12,
      },
      // Si el comprador no paga en 24h la preferencia deja de ser valida.
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        order_number: input.orderNumber,
        store: env.storeName,
      },
    },
  });

  const preferenceId = response.id;
  const checkoutUrl = env.mpSandbox
    ? (response.sandbox_init_point ?? response.init_point)
    : (response.init_point ?? response.sandbox_init_point);

  if (!preferenceId || !checkoutUrl) {
    throw new Error('Mercado Pago no devolvio una URL de checkout valida.');
  }

  return { preferenceId, checkoutUrl };
}

export type MpPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  paymentTypeId: string | null;
  paymentMethodId: string | null;
  installments: number | null;
  payerEmail: string | null;
  raw: unknown;
};

/** Consulta el pago directamente a Mercado Pago (fuente de verdad). */
export async function fetchPayment(paymentId: string): Promise<MpPayment | null> {
  try {
    const payment = new Payment(client());
    const result = await payment.get({ id: paymentId });
    if (!result?.id) return null;

    return {
      id: String(result.id),
      status: String(result.status ?? 'pending'),
      statusDetail: result.status_detail ?? null,
      externalReference: result.external_reference ?? null,
      transactionAmount: result.transaction_amount ?? null,
      currencyId: result.currency_id ?? null,
      paymentTypeId: result.payment_type_id ?? null,
      paymentMethodId: result.payment_method_id ?? null,
      installments: result.installments ?? null,
      payerEmail: result.payer?.email ?? null,
      raw: result,
    };
  } catch (error) {
    console.error('[mercadopago] no se pudo obtener el pago', paymentId, error);
    return null;
  }
}

/**
 * Busca en Mercado Pago los pagos de un pedido, por su numero.
 *
 * Es la salida cuando la notificacion no llego: con el numero de pedido
 * (que viaja como `external_reference`) se recupera el pago sin depender del
 * webhook ni de que alguien haya anotado el id.
 *
 * Devuelve el pago mas relevante: si hay uno aprobado, ese; si no, el ultimo.
 */
export async function findPaymentByOrderNumber(orderNumber: string): Promise<MpPayment | null> {
  try {
    const payment = new Payment(client());
    const result = await payment.search({
      options: { external_reference: orderNumber, sort: 'date_created', criteria: 'desc' },
    });

    const encontrados = (result?.results ?? []).filter((row) => row?.id);
    if (encontrados.length === 0) return null;

    const aprobado = encontrados.find(
      (row) => row.status === 'approved' || row.status === 'authorized',
    );

    return fetchPayment(String((aprobado ?? encontrados[0])!.id));
  } catch (error) {
    console.error('[mercadopago] no se pudo buscar el pago del pedido', orderNumber, error);
    return null;
  }
}

/** Cuanto puede desviarse el reloj de la firma antes de rechazarla. */
const SIGNATURE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * El `ts` de la firma, en milisegundos.
 *
 * Mercado Pago lo manda en segundos (diez digitos), pero no siempre: hay
 * cuentas e integraciones que lo mandan en milisegundos (trece). Compararlo
 * sin mirar la unidad da una diferencia de casi cincuenta y cinco anos y
 * rechaza absolutamente todas las notificaciones, que es justo lo que pasaba.
 * Se decide por la magnitud: cualquier fecha razonable en segundos es menor
 * que un billon, y en milisegundos es mayor.
 */
function toMillis(ts: string): number | null {
  const value = Number(ts);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value < 1e12 ? value * 1000 : value;
}

/**
 * Valida la cabecera `x-signature` de una notificacion.
 *
 * Manifiesto esperado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Los pares cuyo valor no venga en la peticion se omiten.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): { valid: boolean; reason?: string } {
  const secret = env.mpWebhookSecret;
  if (!secret) {
    return { valid: false, reason: 'MP_WEBHOOK_SECRET no esta configurado' };
  }
  if (!params.signatureHeader) {
    return { valid: false, reason: 'falta la cabecera x-signature' };
  }

  let ts: string | null = null;
  let hash: string | null = null;

  for (const part of params.signatureHeader.split(',')) {
    const [rawKey, ...rawValue] = part.split('=');
    const key = rawKey?.trim();
    const value = rawValue.join('=').trim();
    if (key === 'ts') ts = value;
    if (key === 'v1') hash = value;
  }

  if (!ts || !hash) {
    return { valid: false, reason: 'cabecera x-signature mal formada' };
  }

  // Rechaza firmas viejas para dificultar el reenvio de una notificacion
  // capturada. La ventana es amplia a proposito: Mercado Pago reintenta una
  // notificacion durante horas, y rechazar un reintento legitimo significa
  // perder un pago que si se cobro. El riesgo de aceptarlo es bajo, porque el
  // estado nunca sale de la notificacion: se vuelve a consultar a la API.
  const timestampMs = toMillis(ts);
  if (timestampMs !== null) {
    const ageMs = Math.abs(Date.now() - timestampMs);
    if (ageMs > SIGNATURE_WINDOW_MS) {
      const horas = Math.round(ageMs / 3_600_000);
      return {
        valid: false,
        reason: `la firma esta fuera de la ventana de tiempo permitida (${horas} h de diferencia)`,
      };
    }
  }

  let manifest = '';
  // Mercado Pago envia el id en minusculas dentro del manifiesto.
  if (params.dataId) manifest += `id:${params.dataId.toLowerCase()};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(hash, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return { valid: false, reason: 'la firma no coincide' };
  }
  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return { valid: false, reason: 'la firma no coincide' };
  }

  return { valid: true };
}

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  authorized: 'AUTHORIZED',
  in_process: 'IN_PROCESS',
  in_mediation: 'IN_MEDIATION',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
  charged_back: 'CHARGED_BACK',
};

export function mapPaymentStatus(status: string): PaymentStatus {
  return PAYMENT_STATUS_MAP[status] ?? 'PENDING';
}
