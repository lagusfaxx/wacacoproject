import 'server-only';

import { prisma } from '../db';
import { env } from '../env';
import { sendWithResend } from './resend';
import type { RenderedEmail } from './templates';

/**
 * Punto unico por donde salen los correos.
 *
 * Se encarga de tres cosas que ninguna plantilla deberia repetir:
 *
 *  - **Idempotencia.** Mercado Pago reintenta la misma notificacion varias
 *    veces; sin una marca, el cliente recibiria el comprobante tres veces. La
 *    fila de EmailLog se crea *antes* de enviar y su clave unica hace de
 *    cerrojo, asi que dos procesos simultaneos tampoco lo duplican.
 *  - **Tolerancia a fallos.** Un correo caido no puede voltear una compra ya
 *    cobrada: los errores se anotan y se devuelven, nunca se lanzan.
 *  - **Rastro.** Queda registrado que se intento, a quien y con que resultado,
 *    que es lo primero que se necesita cuando alguien dice "no me llego".
 */

export type DeliveryOutcome = 'sent' | 'failed' | 'skipped' | 'duplicate';

export type DeliveryResult = { outcome: DeliveryOutcome; detail?: string };

export async function deliver(options: {
  to: string;
  type: string;
  email: RenderedEmail;
  /** Clave de idempotencia. Sin ella el mismo correo puede repetirse. */
  dedupeKey?: string;
}): Promise<DeliveryResult> {
  const to = options.to.trim().toLowerCase();
  if (!to || !to.includes('@')) {
    return { outcome: 'failed', detail: 'destinatario invalido' };
  }

  // Consulta previa para el caso normal: sin ella, cada reintento del webhook
  // deja un error de clave duplicada en los registros del servidor, que asusta
  // sin motivo. El cerrojo de verdad sigue siendo la clave unica de abajo.
  if (options.dedupeKey) {
    const existing = await prisma.emailLog
      .findUnique({ where: { dedupeKey: options.dedupeKey }, select: { id: true } })
      .catch(() => null);
    if (existing) return { outcome: 'duplicate' };
  }

  let logId: string;
  try {
    const row = await prisma.emailLog.create({
      data: {
        to,
        subject: options.email.subject,
        type: options.type,
        dedupeKey: options.dedupeKey ?? null,
        status: 'SKIPPED',
      },
    });
    logId = row.id;
  } catch (error) {
    // La clave unica salto: este aviso ya se envio (o se esta enviando).
    if (isUniqueViolation(error)) return { outcome: 'duplicate' };
    // Si ni siquiera se puede anotar, se intenta enviar igual: es peor que el
    // cliente se quede sin su comprobante que sin su linea de registro.
    console.error('[email] no se pudo registrar el envio:', error);
    return env.emailEnabled ? sendWithoutLog(to, options) : { outcome: 'skipped' };
  }

  if (!env.emailEnabled) {
    await updateLog(logId, {
      status: 'SKIPPED',
      error: 'Falta configurar RESEND_API_KEY y EMAIL_FROM.',
    });
    console.warn(`[email] omitido (${options.type}): la tienda no tiene el correo configurado.`);
    return { outcome: 'skipped', detail: 'correo no configurado' };
  }

  const result = await sendWithResend({
    to,
    subject: options.email.subject,
    html: options.email.html,
    text: options.email.text,
    replyTo: env.emailReplyTo || undefined,
  });

  if (result.ok) {
    await updateLog(logId, { status: 'SENT', providerId: result.id || null, error: null });
    return { outcome: 'sent' };
  }

  // Se libera la clave para que un reintento posterior si pueda enviarlo: el
  // cerrojo debe proteger de duplicados, no dejar al cliente sin el correo.
  await updateLog(logId, { status: 'FAILED', error: result.error.slice(0, 500), dedupeKey: null });
  console.error(`[email] fallo el envio (${options.type}):`, result.error);
  return { outcome: 'failed', detail: result.error };
}

async function updateLog(
  id: string,
  data: {
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    providerId?: string | null;
    error?: string | null;
    dedupeKey?: string | null;
  },
): Promise<void> {
  await prisma.emailLog.update({ where: { id }, data }).catch(() => undefined);
}

async function sendWithoutLog(
  to: string,
  options: { type: string; email: RenderedEmail },
): Promise<DeliveryResult> {
  const result = await sendWithResend({
    to,
    subject: options.email.subject,
    html: options.email.html,
    text: options.email.text,
    replyTo: env.emailReplyTo || undefined,
  });
  return result.ok ? { outcome: 'sent' } : { outcome: 'failed', detail: result.error };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
