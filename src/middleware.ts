import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session-token';
import { publicUrl } from '@/lib/public-url';

/**
 * Primera barrera para el panel: corta el paso antes de renderizar. Cada
 * pagina del panel vuelve a comprobar el rol contra la base de datos con
 * `requireAdmin()`, porque el JWT puede quedar desactualizado.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/ingresar') return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || session.role !== 'ADMIN') {
    // El destino se arma con APP_URL y no con `request.nextUrl`, que trae la
    // direccion de escucha del contenedor (0.0.0.0) cuando la peticion llega
    // sin un `Host` util. Ver src/lib/public-url.ts.
    return NextResponse.redirect(publicUrl('/admin/ingresar', request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
