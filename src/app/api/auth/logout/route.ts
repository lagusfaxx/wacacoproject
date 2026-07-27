import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { publicOrigin } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El cierre de sesion se hace por POST para que no pueda dispararse desde una
 * simple etiqueta de imagen o un enlace en otro sitio.
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const appOrigin = publicOrigin(request);
  const requestOrigin = new URL(request.url).origin;

  // Solo se acepta el cierre de sesion desde la propia tienda. Se aceptan el
  // dominio publico y el host con el que llego la peticion, para que tambien
  // funcione al entrar por una direccion alternativa (localhost, IP interna).
  if (origin && origin !== appOrigin && origin !== requestOrigin) {
    return NextResponse.json({ error: 'origen no permitido' }, { status: 403 });
  }

  await destroySession();

  /**
   * El destino sale de APP_URL y no de la URL de la peticion. Un `Location`
   * relativo no sirve como defensa: Next lo convierte igual en absoluto
   * usando la URL de la peticion, que sin un `Host` util es la direccion de
   * escucha del contenedor. Asi el navegador acababa en `0.0.0.0:3000`
   * (Chrome lo muestra como `https://0.0.0.0:3000` al intentar subirlo a
   * HTTPS), una direccion que no existe en la maquina del visitante.
   */
  return NextResponse.redirect(new URL('/', appOrigin), { status: 303 });
}
