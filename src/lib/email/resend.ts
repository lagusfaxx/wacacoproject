import 'server-only';

import { env } from '../env';

/**
 * Cliente minimo de Resend.
 *
 * Se habla con la API por HTTP en vez de instalar el SDK: el envio es un POST
 * con cuatro campos y una dependencia menos es una superficie menos que
 * mantener al dia.
 */

const ENDPOINT = 'https://api.resend.com/emails';
/** Un correo no puede dejar colgada una compra: se corta y se sigue. */
const TIMEOUT_MS = 10_000;

export type ResendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; retriable: boolean };

export type ResendMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

async function post(message: ResendMessage): Promise<ResendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        error: payload.message || payload.name || `Resend respondio ${response.status}.`,
        // 4xx es culpa de la peticion (dominio sin verificar, correo invalido):
        // reintentar solo repetiria el mismo error.
        retriable: response.status >= 500 || response.status === 429,
      };
    }

    return { ok: true, id: payload.id ?? '' };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? 'Resend no respondio a tiempo.' : String(error),
      retriable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia el mensaje con un unico reintento para los fallos pasajeros (un 500 o
 * un limite de tasa). Mas reintentos alargarian la respuesta al cliente sin
 * mejorar mucho la entrega.
 */
export async function sendWithResend(message: ResendMessage): Promise<ResendResult> {
  const first = await post(message);
  if (first.ok || !first.retriable) return first;

  await new Promise((resolve) => setTimeout(resolve, 400));
  return post(message);
}
