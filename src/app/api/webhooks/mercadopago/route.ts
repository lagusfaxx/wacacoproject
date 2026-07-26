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

  const data = (body.data ?? {}) as Record<string, unknown>;
  const dataId =
    url.searchParams.get('data.id') ??
    url.searchParams.get('id') ??
    (data.id !== undefined ? String(data.id) : null);

  const signature = verifyWebhookSignature({
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
  });

  if (!signature.valid) {
    console.warn('[webhook] firma rechazada:', signature.reason);
    return NextResponse.json({ error: 'firma invalida' }, { status: 401 });
  }

  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? String(body.type ?? '');

  if (type !== 'payment') {
    // merchant_order y otros topicos no cambian el estado del pedido.
    return NextResponse.json({ received: true, ignored: type || 'desconocido' });
  }

  if (!dataId) {
    return NextResponse.json({ received: true, ignored: 'sin id de pago' });
  }

  const payment = await fetchPayment(dataId);
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
