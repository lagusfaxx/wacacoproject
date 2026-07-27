import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Healthcheck usado por Docker y Coolify. Comprueba tambien la conexion a la
 * base de datos: un contenedor que responde pero no puede leer Postgres no
 * sirve para atender pedidos.
 */
export async function GET() {
  // Sirve tambien para saber que version esta desplegada: al depurar es facil
  // confundir un problema real con un contenedor que quedo en un commit viejo.
  const build = {
    commit: process.env.SOURCE_COMMIT?.slice(0, 8) ?? 'desconocido',
    appUrl: process.env.APP_URL ?? null,
    features: ['banners', 'menu', 'media-upload', 'seo-por-ficha', 'envios-por-region'],
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'up',
      time: new Date().toISOString(),
      build,
    });
  } catch {
    return NextResponse.json({ status: 'degraded', database: 'down', build }, { status: 503 });
  }
}
