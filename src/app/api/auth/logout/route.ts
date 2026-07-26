import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El cierre de sesion se hace por POST para que no pueda dispararse desde una
 * simple etiqueta de imagen o un enlace en otro sitio.
 */
export async function POST(request: Request) {
  await destroySession();

  const origin = request.headers.get('origin');
  const appOrigin = new URL(env.appUrl).origin;
  const requestOrigin = new URL(request.url).origin;

  // Solo se acepta el cierre de sesion desde la propia tienda.
  if (origin && origin !== appOrigin && origin !== requestOrigin) {
    return NextResponse.json({ error: 'origen no permitido' }, { status: 403 });
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
