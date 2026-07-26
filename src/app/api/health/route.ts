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
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up', time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503 });
  }
}
