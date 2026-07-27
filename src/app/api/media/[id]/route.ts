import { NextResponse } from 'next/server';
import { getImage } from '@/lib/media';

export const runtime = 'nodejs';

/**
 * Sirve una imagen subida desde el panel.
 *
 * El id se genera al subir y nunca se reutiliza, asi que el contenido de una
 * URL no cambia jamas y puede cachearse de forma indefinida. Reemplazar la
 * imagen de un producto crea un id nuevo, y con el una URL nueva.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const asset = await getImage(id).catch(() => null);
  if (!asset) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Evita que un SVG subido se interprete como documento en el dominio.
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
