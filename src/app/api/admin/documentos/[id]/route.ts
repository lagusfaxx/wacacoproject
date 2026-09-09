import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { safeFilename } from '@/lib/documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Descarga un documento que se envio por correo desde el panel.
 *
 * A diferencia de las imagenes, esto no es publico: son boletas y comprobantes
 * de clientes, asi que la ruta exige sesion de administrador y pide al
 * navegador que lo baje en vez de abrirlo (un PDF o un SVG abierto en el
 * dominio de la tienda es una pagina mas dentro del sitio).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return new NextResponse('No autorizado', { status: 403 });
  }

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const file = await prisma.documentEmailFile.findUnique({ where: { id } });
  if (!file) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filename = safeFilename(file.filename).replace(/"/g, '');

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
