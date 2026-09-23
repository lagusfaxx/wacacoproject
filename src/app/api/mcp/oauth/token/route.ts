import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/auth';
import { exchangeCode, OAuthError, refreshTokens } from '@/lib/mcp/auth';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

function oauthError(code: string, description: string, status = 400) {
  return NextResponse.json({ error: code, error_description: description }, { status, headers: NO_STORE });
}

/** Endpoint de tokens OAuth: canje del codigo (con PKCE) y renovacion. */
export async function POST(request: Request) {
  const ip = await getClientIp();
  const limit = await rateLimit(`mcp-token:${ip}`, 60, 600);
  if (!limit.ok) return oauthError('slow_down', 'Demasiados intentos.', 429);

  const type = request.headers.get('content-type') ?? '';
  let params: URLSearchParams;
  if (type.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    params = new URLSearchParams(
      Object.entries(body).map(([k, v]) => [k, String(v ?? '')]) as [string, string][],
    );
  } else {
    params = new URLSearchParams(await request.text());
  }

  const get = (key: string) => params.get(key) ?? '';

  try {
    if (get('grant_type') === 'authorization_code') {
      if (!get('code') || !get('client_id') || !get('redirect_uri') || !get('code_verifier')) {
        return oauthError('invalid_request', 'Faltan parametros.');
      }
      const tokens = await exchangeCode({
        code: get('code'),
        clientId: get('client_id'),
        redirectUri: get('redirect_uri'),
        codeVerifier: get('code_verifier'),
      });
      return NextResponse.json(tokens, { headers: NO_STORE });
    }

    if (get('grant_type') === 'refresh_token') {
      if (!get('refresh_token') || !get('client_id')) {
        return oauthError('invalid_request', 'Faltan parametros.');
      }
      const tokens = await refreshTokens({
        refreshToken: get('refresh_token'),
        clientId: get('client_id'),
      });
      return NextResponse.json(tokens, { headers: NO_STORE });
    }

    return oauthError('unsupported_grant_type', 'Tipo de concesion no soportado.');
  } catch (error) {
    if (error instanceof OAuthError) return oauthError(error.code, error.message);
    console.error('[mcp] error en /token', error);
    return oauthError('server_error', 'Error interno.', 500);
  }
}
