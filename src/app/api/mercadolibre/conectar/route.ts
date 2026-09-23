import { NextResponse } from 'next/server';
import { getCurrentUser, isSecureRequest } from '@/lib/auth';
import { buildAuthorization, ML_OAUTH_COOKIE, mlConfigured } from '@/lib/mercadolibre/auth';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inicia la conexion con Mercado Libre. El `state` y el verificador PKCE
 * quedan en una cookie httpOnly de vida corta, que la vuelta debe presentar.
 * Solo por POST (formulario del panel): un enlace no puede disparar la conexion.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.redirect(publicUrl('/admin/ingresar', request), 303);
  }
  if (!mlConfigured()) {
    return NextResponse.redirect(publicUrl('/admin/mercadolibre/conexion?error=config', request), 303);
  }

  const { url, state, verifier } = buildAuthorization();
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(ML_OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: await isSecureRequest(),
    // lax: la vuelta desde Mercado Libre es una navegacion de nivel superior.
    sameSite: 'lax',
    path: '/api/mercadolibre/callback',
    maxAge: 600,
  });
  return response;
}
