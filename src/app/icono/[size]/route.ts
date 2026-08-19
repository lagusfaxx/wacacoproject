import { NextResponse, type NextRequest } from 'next/server';

import { ICON_PNG_SIZES, getIconPng } from '@/lib/favicon';

export const runtime = 'nodejs';
// Mismo motivo que en `/favicon.ico`: el icono sale de la base de datos.
export const dynamic = 'force-dynamic';

/**
 * Sirve el icono de la tienda en PNG: `/icono/192.png`.
 *
 * Google no saca el icono de un sitio de un solo lugar. Mira `/favicon.ico`,
 * mira el `<link rel="icon">` del `<head>` y tambien mira los iconos que
 * declara el manifiesto de la aplicacion web — y ahi un ICO no le sirve, tiene
 * que ser PNG. Esta ruta cubre ese tercer camino, y de paso el icono que iOS
 * usa al guardar la pagina en la pantalla de inicio.
 *
 * Los lados posibles estan en una lista cerrada (`ICON_PNG_SIZES`) para que
 * nadie pueda pedir mil tamanos distintos y hacer trabajar al servidor de
 * gusto; cualquier otro valor cae en 192.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ size: string }> }) {
  const { size } = await context.params;
  const side = Number.parseInt(size.replace(/\.png$/, ''), 10);

  if (!ICON_PNG_SIZES.includes(side)) {
    return new NextResponse('Tamano no disponible', { status: 404 });
  }

  const icon = await getIconPng(side);

  if (request.headers.get('if-none-match') === icon.etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: icon.etag } });
  }

  return new NextResponse(new Uint8Array(icon.bytes), {
    headers: {
      'Content-Type': icon.mimeType,
      'Content-Length': String(icon.bytes.length),
      ETag: icon.etag,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
