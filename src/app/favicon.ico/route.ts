import { NextResponse } from 'next/server';

import { getFavicon } from '@/lib/favicon';

export const runtime = 'nodejs';
// El icono sale de la base de datos, asi que no puede quedar congelado en el
// build: se resuelve en cada peticion y se apoya en la cache de `getFavicon`.
export const dynamic = 'force-dynamic';

/**
 * Sirve `/favicon.ico` con el icono configurado en el panel.
 *
 * Antes esto era un archivo fijo en `public/`, y por eso Google mostraba el
 * dibujo por defecto del repositorio en vez del icono de la tienda: cuando el
 * icono declarado en el `<head>` no le sirve, Google pide esta direccion a
 * secas y se queda con lo que encuentre aqui. Ahora encuentra el mismo icono
 * que ve el navegador en la pestana.
 */
export async function GET() {
  const icon = await getFavicon();

  return new NextResponse(new Uint8Array(icon.bytes), {
    headers: {
      'Content-Type': icon.mimeType,
      'Content-Length': String(icon.bytes.length),
      // Una hora de cache: suficiente para no reconstruirlo en cada visita y
      // poco para que un icono nuevo se vea el mismo dia.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
