import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Origen publico de la tienda.
 *
 * No puede deducirse de `request.url`: el servidor standalone de Next escucha
 * en 0.0.0.0 y detras del proxy de Coolify esa direccion es la que termina en
 * la URL de la peticion. Redirigir ahi manda al navegador a
 * `https://0.0.0.0:3000`, que no existe. Se prefiere APP_URL y, si no esta
 * definida, las cabeceras que deja el proxy.
 */
function publicOrigin(request: Request): string {
  if (process.env.APP_URL) return new URL(env.appUrl).origin;

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host && !host.startsWith('0.0.0.0')) {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http';
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/**
 * El cierre de sesion se hace por POST para que no pueda dispararse desde una
 * simple etiqueta de imagen o un enlace en otro sitio.
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const appOrigin = publicOrigin(request);
  const requestOrigin = new URL(request.url).origin;

  // Solo se acepta el cierre de sesion desde la propia tienda.
  if (origin && origin !== appOrigin && origin !== requestOrigin) {
    return NextResponse.json({ error: 'origen no permitido' }, { status: 403 });
  }

  await destroySession();

  return NextResponse.redirect(new URL('/', appOrigin), { status: 303 });
}
