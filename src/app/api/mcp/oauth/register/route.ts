import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp } from '@/lib/auth';
import { registerClient, redirectUriAllowed } from '@/lib/mcp/auth';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  client_name: z.string().trim().min(1).max(80).optional(),
  redirect_uris: z.array(z.string().max(500)).min(1).max(5),
});

/**
 * Registro dinamico de clientes (RFC 7591), que usa claude.ai al agregar el
 * conector. Registrarse no da acceso a nada: solo permite pedir autorizacion,
 * que un administrador tiene que aprobar con su sesion. Aun asi solo se
 * aceptan destinos de la lista MCP_ALLOWED_REDIRECT_HOSTS.
 */
export async function POST(request: Request) {
  const ip = await getClientIp();
  const limit = await rateLimit(`mcp-register:${ip}`, 10, 3600);
  if (!limit.ok) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Datos de registro invalidos.' },
      { status: 400 },
    );
  }

  const bad = parsed.data.redirect_uris.find((uri) => !redirectUriAllowed(uri));
  if (bad) {
    return NextResponse.json(
      {
        error: 'invalid_redirect_uri',
        error_description: `Destino no permitido: ${bad}. Agregalo a MCP_ALLOWED_REDIRECT_HOSTS si es de confianza.`,
      },
      { status: 400 },
    );
  }

  const name = parsed.data.client_name ?? 'Cliente MCP';
  const clientId = await registerClient({ name, redirectUris: parsed.data.redirect_uris });

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: name,
      redirect_uris: parsed.data.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 },
  );
}
