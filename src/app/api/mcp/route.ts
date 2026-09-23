import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { authenticateBearer } from '@/lib/mcp/auth';
import { handleMessage } from '@/lib/mcp/server';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Punto de entrada del servidor MCP: https://TU-DOMINIO/api/mcp
 *
 * Toda peticion necesita `Authorization: Bearer <token>` (clave del panel u
 * OAuth). Sin credencial se responde 401 con la direccion de los metadatos
 * OAuth, que es como claude.ai descubre donde iniciar sesion.
 */

const MAX_BODY_BYTES = 1_000_000;

function unauthorized() {
  return NextResponse.json(
    { error: 'invalid_token', error_description: 'Falta una credencial valida.' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${env.appUrl}/.well-known/oauth-protected-resource/api/mcp"`,
      },
    },
  );
}

/**
 * Proteccion contra DNS rebinding: una pagina web abierta en el navegador no
 * puede llamar al servidor. Los clientes MCP llaman desde su servidor, sin
 * cabecera Origin, o desde un origen de Claude.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      origin === new URL(env.appUrl).origin ||
      ['claude.ai', 'claude.com'].some((h) => host === h || host.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  }

  const auth = await authenticateBearer(request.headers.get('authorization'));
  if (!auth) return unauthorized();

  const limit = await rateLimit(`mcp:${auth.token.id}`, 240, 60);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Mensaje demasiado grande.' }, { status: 413 });
  }

  let payload: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Mensaje demasiado grande.' }, { status: 413 });
    }
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalido.' } },
      { status: 400 },
    );
  }

  if (Array.isArray(payload)) {
    const responses = (
      await Promise.all(payload.slice(0, 20).map((m) => handleMessage(m, auth)))
    ).filter(Boolean);
    return responses.length
      ? NextResponse.json(responses)
      : new NextResponse(null, { status: 202 });
  }

  const response = await handleMessage(payload, auth);
  return response ? NextResponse.json(response) : new NextResponse(null, { status: 202 });
}

/** Sin sesiones ni stream de eventos: GET y DELETE no aplican. */
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}

export const DELETE = GET;
