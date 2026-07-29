import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { expireStaleTransferOrders } from '@/lib/order-expiry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vencimiento de los pedidos por transferencia sin pagar, para un cron.
 *
 * La tienda ya hace este mismo barrido sola con el trafico normal (ver
 * `maybeExpireStaleOrders`), asi que esta ruta es el respaldo para cuando no
 * hay visitas: un `curl` cada hora desde el servidor y listo.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://tutienda.cl/api/tareas/vencer-pedidos
 */
export async function POST(request: Request) {
  const secret = env.cronSecret;
  if (!secret) {
    return NextResponse.json(
      { error: 'Las tareas programadas estan desactivadas: falta CRON_SECRET.' },
      { status: 404 },
    );
  }

  if (!authorized(request, secret)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const expired = await expireStaleTransferOrders();

  return NextResponse.json({
    expired: expired.length,
    orders: expired.map((order) => order.number),
  });
}

export const GET = POST;

/** Comparacion en tiempo constante, para no filtrar la clave a base de reintentos. */
function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '');
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}
