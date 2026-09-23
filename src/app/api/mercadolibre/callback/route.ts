import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getCurrentUser, writeAuditLog } from '@/lib/auth';
import { completeAuthorization, ML_OAUTH_COOKIE } from '@/lib/mercadolibre/auth';
import { invalidateCache } from '@/lib/mercadolibre/client';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameString(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Vuelta desde Mercado Libre con el codigo de autorizacion. */
export async function GET(request: Request) {
  const back = (status: string) => {
    const response = NextResponse.redirect(
      publicUrl(`/admin/mercadolibre/conexion?${status}`, request),
      303,
    );
    response.cookies.set(ML_OAUTH_COOKIE, '', { path: '/api/mercadolibre/callback', maxAge: 0 });
    return response;
  };

  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.redirect(publicUrl('/admin/ingresar', request), 303);
  }

  const params = new URL(request.url).searchParams;
  const code = params.get('code') ?? '';
  const state = params.get('state') ?? '';
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ML_OAUTH_COOKIE}=`))
    ?.slice(ML_OAUTH_COOKIE.length + 1);
  const [savedState, verifier] = decodeURIComponent(cookie ?? '').split('.');

  if (params.get('error')) return back('error=denied');
  if (!code || !state || !savedState || !verifier || !sameString(state, savedState)) {
    return back('error=state');
  }

  try {
    const connection = await completeAuthorization({ code, verifier, adminEmail: user.email });
    invalidateCache('ml:');
    await writeAuditLog({
      userId: user.id,
      action: 'ml.connect',
      entity: 'MercadoLibre',
      entityId: connection.mlUserId,
      metadata: { nickname: connection.nickname, via: 'panel' },
    });
    return back('ok=1');
  } catch (error) {
    console.error('[mercadolibre] error al conectar', error);
    return back('error=token');
  }
}
