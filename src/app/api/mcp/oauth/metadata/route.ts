import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { SUPPORTED_SCOPES } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

/** Metadatos del servidor de autorizacion (RFC 8414). Se sirve en /.well-known/oauth-authorization-server. */
export function GET() {
  const base = env.appUrl;
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/admin/mcp/autorizar`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}
