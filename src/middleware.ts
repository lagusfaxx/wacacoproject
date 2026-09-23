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
    // Se conserva el destino (por ejemplo la aprobacion de acceso de Claude)
    // para volver ahi despues de iniciar sesion.
    const next = `${pathname}${request.nextUrl.search}`;
    const target = pathname === '/admin' ? '/admin/ingresar' : `/admin/ingresar?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(publicUrl(target, request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
