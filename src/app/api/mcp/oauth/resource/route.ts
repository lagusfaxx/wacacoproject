import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { mcpResourceUrl, SUPPORTED_SCOPES } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

/** Metadatos del recurso protegido (RFC 9728). Se sirve en /.well-known/oauth-protected-resource. */
export function GET() {
  return NextResponse.json({
    resource: mcpResourceUrl(),
    authorization_servers: [env.appUrl],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: `Mercado Libre · ${env.storeName}`,
  });
}
