import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session-token';

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
    const url = request.nextUrl.clone();
    url.pathname = '/admin/ingresar';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
