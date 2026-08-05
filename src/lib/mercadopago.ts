import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { Prisma, type PaymentStatus } from '@prisma/client';
import { env } from './env';
import { round, toDecimal, toNumber } from './money';

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

export type PreferenceLine = {
  id: string;
  title: string;
  description?: string;
  pictureUrl?: string;
  quantity: number;
  /** Lo que suma esta linea completa, ya redondeado. */
  lineTotal: Prisma.Decimal;
};

export type CreatePreferenceInput = {
  orderNumber: string;
  lines: PreferenceLine[];
  discount: Prisma.Decimal;
  shipping: Prisma.Decimal;
  tax: Prisma.Decimal;
  /**
   * Lo que hay que cobrar. Es la cifra que manda: los conceptos que se envian
   * a Mercado Pago se arman para sumar exactamente esto.
   */
  total: Prisma.Decimal;
  payer: { name: string; email: string; phone?: string };
  /** Token del pedido, usado para armar las URLs de retorno. */
  trackingToken: string;
};

/** Un concepto ya listo para Mercado Pago, con su importe en numero plano. */
type MpItem = { id: string; title: string; description?: string; pictureUrl?: string; quantity: number; unitPrice: number };

/**
 * Convierte el pedido en los conceptos que ve el comprador en Mercado Pago.
 *
 * La regla es una sola: la suma de los conceptos tiene que dar exactamente el
 * total del pedido. Mercado Pago cobra lo que suman los `items` y nada mas
 * (el campo `shipments.cost` aparece en el resumen pero no se cobra, que es
 * justo como un pedido terminaba cobrandose sin el envio), y el descuento de
 * un cupon no tiene donde ir: sin prorratearlo se cobraria de mas.
 *
 * Por eso el envio y los impuestos viajan como una linea propia, y el
 * descuento se reparte entre los productos.
 *
 * El reparto se hace sobre el acumulado y no linea por linea: el importe de
 * cada linea es la diferencia entre dos sumas ya redondeadas. Asi la suma da
 * el neto exacto por construccion, sin que ninguna linea tenga que absorber el
 * resto de las demas (que con muchas lineas chicas y un descuento grande podia
 * dejarla en negativo y tirar abajo la compra entera).
 */
export function buildPreferenceItems(input: CreatePreferenceInput): MpItem[] {
  const subtotal = input.lines.reduce((acc, line) => acc.plus(line.lineTotal), new Prisma.Decimal(0));
  const discount = Prisma.Decimal.min(round(input.discount), Prisma.Decimal.max(subtotal, 0));
  const neto = subtotal.minus(discount);
  const hayDescuento = discount.greaterThan(0);

  const items: MpItem[] = [];
  let acumulado = new Prisma.Decimal(0);
  let repartido = new Prisma.Decimal(0);

  for (const line of input.lines) {
    acumulado = acumulado.plus(line.lineTotal);

    // Cuanto deberia llevar acumulado el reparto hasta esta linea, redondeado.
    // Como el acumulado no baja nunca, la diferencia nunca es negativa.
    const hasta = subtotal.isZero() ? new Prisma.Decimal(0) : round(acumulado.times(neto).dividedBy(subtotal));
    const importe = hasta.minus(repartido);
    repartido = hasta;

    if (importe.lessThanOrEqualTo(0)) continue;

    // Sin descuento se conserva la cantidad real, que es lo que el comprador
    // espera ver. Con descuento el precio unitario ya no es un numero redondo,
    // asi que la linea va entera y la cantidad se dice en el titulo.
    const unitario = round(importe.dividedBy(line.quantity));
    const porUnidad = !hayDescuento && round(unitario.times(line.quantity)).equals(importe);

    items.push({
      id: line.id,
      title: (porUnidad || line.quantity === 1
        ? line.title
        : `${line.title} x${line.quantity}`
      ).slice(0, 250),
      description: line.description?.slice(0, 250),
      pictureUrl: line.pictureUrl,
      quantity: porUnidad ? line.quantity : 1,
      unitPrice: toNumber(porUnidad ? unitario : importe),
    });
  }

  const envio = round(input.shipping);
  if (envio.greaterThan(0)) {
    items.push({ id: 'envio', title: 'Despacho', quantity: 1, unitPrice: toNumber(envio) });
  }

  const impuestos = round(input.tax);
  if (impuestos.greaterThan(0)) {
    items.push({ id: 'impuestos', title: 'Impuestos', quantity: 1, unitPrice: toNumber(impuestos) });
  }

  // Ultima defensa: antes que cobrar un importe distinto al del pedido, no se
  // cobra nada. Un descuadre aqui llega al comprador como "no pudimos iniciar
  // el pago", que es molesto pero reparable; cobrar de mas, no.
  const suma = items.reduce(
    (acc, item) => acc.plus(round(toDecimal(item.unitPrice).times(item.quantity))),
    new Prisma.Decimal(0),
  );

  if (!suma.equals(round(input.total))) {
    throw new Error(
      `El desglose enviado a Mercado Pago suma ${suma.toString()} y el pedido es de ${round(
        input.total,
      ).toString()}.`,
    );
  }

  return items;
}

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

  const items = buildPreferenceItems(input).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
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
      // El envio NO va en `shipments`: ese campo se muestra en el resumen
      // pero no entra en el cobro, y el pedido terminaba pagandose sin el
      // despacho. Va como una linea mas, dentro de `items`.
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
  /**
   * Lo que suman los conceptos del pago. Ojo: NO es todo lo cobrado. Cuando
   * el envio viaja en `shipments`, Mercado Pago lo deja fuera de este campo y
   * lo informa aparte en `shippingAmount`. Para comparar contra el total de un
   * pedido esta `chargedTotal`.
   */
  transactionAmount: number | null;
  /** El envio, cuando Mercado Pago lo cobro por separado. */
  shippingAmount: number | null;
  currencyId: string | null;
  paymentTypeId: string | null;
  paymentMethodId: string | null;
  installments: number | null;
  payerEmail: string | null;
  raw: unknown;
};

/**
 * Todo lo que se le cobro al comprador por este pago.
 *
 * Mercado Pago parte el importe en dos campos cuando el envio va por
 * `shipments`: los productos en `transaction_amount` y el despacho en
 * `shipping_amount`. Comparar solo el primero contra el total del pedido daba
 * siempre de menos y mandaba a revision manual pagos que estaban perfectos.
 *
 * No se usa `total_paid_amount` porque ese incluye los intereses de las
 * cuotas, que los paga el comprador al banco y no son parte del pedido.
 */
export function chargedTotal(payment: MpPayment): number | null {
  if (payment.transactionAmount === null) return null;
  return payment.transactionAmount + (payment.shippingAmount ?? 0);
}

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
      shippingAmount: result.shipping_amount ?? null,
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
 * Los manifiestos que Mercado Pago puede haber firmado, en orden de preferencia.
 *
 * El documentado es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, con los
 * pares sin valor omitidos. Se prueban ademas dos variantes que aparecen en la
 * practica: el `data.id` tal cual llego (la documentacion pide pasarlo a
 * minusculas, pero no todas las cuentas lo firman asi) y el manifiesto sin el
 * `request-id`.
 *
 * Probar varias no debilita nada: todas se firman con el mismo secreto, que es
 * lo unico que un tercero no tiene. Y saber cual calzo es lo que convierte un
 * "la firma no coincide" en algo que se puede arreglar.
 */
function signatureManifests(
  dataId: string | null,
  requestId: string | null,
  ts: string,
  alternateId: string | null = null,
) {
  // `alternateId` es el `id` a secas de la URL. Normalmente es el mismo que
  // `data.id`, pero hay notificaciones que llegan solo con el, y ahi el unico
  // manifiesto que se probaba era el de "sin id", que nunca calza porque
  // Mercado Pago siempre firma el identificador del recurso.
  const crudos = [dataId, alternateId].filter((valor): valor is string => Boolean(valor));
  const ids = crudos.length
    ? [...new Set(crudos.flatMap((valor) => [valor.toLowerCase(), valor]))]
    : [null];
  const requestIds = requestId ? [requestId, null] : [null];
  const candidates: { nombre: string; manifest: string }[] = [];

  for (const id of ids) {
    for (const req of requestIds) {
      let manifest = '';
      if (id) manifest += `id:${id};`;
      if (req) manifest += `request-id:${req};`;
      manifest += `ts:${ts};`;

      candidates.push({
        nombre: [
          id === null ? 'sin id' : id === id.toLowerCase() ? 'id en minusculas' : 'id tal cual',
          req ? 'con request-id' : 'sin request-id',
        ].join(', '),
        manifest,
      });
    }
  }

  return candidates;
}

function hashesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
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
  /** El `id` a secas de la URL, para las notificaciones que no traen `data.id`. */
  alternateId?: string | null;
}): { valid: boolean; reason?: string; variant?: string } {
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

  for (const candidato of signatureManifests(
    params.dataId,
    params.requestId,
    ts,
    params.alternateId ?? null,
  )) {
    const expected = createHmac('sha256', secret).update(candidato.manifest).digest('hex');
    if (hashesMatch(expected, hash)) {
      return { valid: true, variant: candidato.nombre };
    }
  }

  // Ninguna variante calzo. El motivo casi siempre es la clave: la del panel
  // de Mercado Pago no es la misma que la del servidor. Se dice todo lo que se
  // puede decir sin revelar ni la clave ni la firma.
  return {
    valid: false,
    reason:
      'la firma no coincide con ninguna variante del manifiesto. ' +
      `Datos recibidos: data.id=${params.dataId ? 'si' : 'NO'}, ` +
      `x-request-id=${params.requestId ? 'si' : 'NO'}, ` +
      `largo de v1=${hash.length} (deben ser 64), ` +
      `largo de la clave=${secret.length}. ` +
      (secret.length === 32
        ? 'Una clave de 32 caracteres suele ser el Client Secret de la aplicacion, que no ' +
          'sirve para firmar: la clave secreta del webhook la entrega el panel en ' +
          'Tus integraciones > tu aplicacion > Webhooks, con el boton de la clave secreta, ' +
          'y es mas larga. '
        : '') +
      'Si el largo de v1 es 64, revisa que MP_WEBHOOK_SECRET sea la clave secreta ' +
      'que muestra el panel de Mercado Pago en Webhooks, para esta misma aplicacion ' +
      'y para el mismo modo (produccion o pruebas)',
  };
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
