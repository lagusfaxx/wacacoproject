import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchPayment, verifyWebhookSignature } from '@/lib/mercadopago';
import { applyPaymentUpdate } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Receptor de notificaciones (IPN/Webhooks) de Mercado Pago.
 *
 * Flujo:
 *  1. Se valida la firma HMAC de la cabecera `x-signature`.
 *  2. Se descarta cualquier notificacion que no sea de tipo `payment`.
 *  3. Se consulta el pago a la API de Mercado Pago (nunca se confia en el body).
 *  4. Se aplica el resultado al pedido de forma idempotente.
 *
 * Mercado Pago reintenta si no recibe 200/201, asi que se responde 200 tambien
 * cuando la notificacion no aplica: reintentarla no cambiaria el resultado.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Algunas notificaciones antiguas llegan sin cuerpo JSON.
  }

  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? String(body.type ?? '');

  // El tipo se mira antes que la firma. Mercado Pago manda tambien avisos de
  // `merchant_order` por cada compra, que no cambian el estado de ningun
  // pedido: validarlos solo servia para llenar el registro de "firma
  // rechazada" por notificaciones que igual se iban a descartar.
  if (type !== 'payment') {
    return NextResponse.json({ received: true, ignored: type || 'desconocido' });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;

  // Lo que se firma es `data.id`, y solo eso. El parametro `id` a secas es de
  // las notificaciones antiguas (`topic=payment&id=...`) y de las de
  // merchant_order: meterlo en el manifiesto como si fuera `data.id` producia
  // una firma que nunca podia coincidir.
  const dataId =
    url.searchParams.get('data.id') ?? (data.id !== undefined ? String(data.id) : null);
  const paymentId = dataId ?? url.searchParams.get('id');

  const signature = verifyWebhookSignature({
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
    alternateId: url.searchParams.get('id'),
  });

  if (!signature.valid) {
    console.warn('[webhook] firma rechazada:', signature.reason);
    return NextResponse.json({ error: 'firma invalida' }, { status: 401 });
  }

  // El manifiesto documentado es el del id en minusculas con request-id. Si
  // calzo otro, conviene saberlo: funciona, pero es senal de que la cuenta
  // firma distinto de lo que dice la documentacion.
  if (signature.variant && signature.variant !== 'id en minusculas, con request-id') {
    console.info(`[webhook] firma valida con una variante del manifiesto: ${signature.variant}`);
  }

  if (!paymentId) {
    return NextResponse.json({ received: true, ignored: 'sin id de pago' });
  }

  const payment = await fetchPayment(paymentId);
  if (!payment) {
    // Devolver 200 evita un bucle de reintentos por un pago inexistente.
    return NextResponse.json({ received: true, ignored: 'pago no encontrado' });
  }

  const result = await applyPaymentUpdate(payment);

  if (!result.handled) {
    console.warn('[webhook] notificacion no aplicada:', result.reason);
    return NextResponse.json({ received: true, ignored: result.reason });
  }

  await prisma.auditLog
    .create({
      data: {
        action: 'payment.webhook',
        entity: 'Order',
        entityId: result.orderNumber,
        metadata: {
          paymentId: payment.id,
          mpStatus: payment.status,
          orderStatus: result.status,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ received: true, order: result.orderNumber, status: result.status });
}

/** Mercado Pago valida la URL con un GET antes de habilitar el webhook. */
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'mercadopago-webhook' });
}
