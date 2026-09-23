import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getConnection } from '@/lib/mercadolibre/auth';
import { invalidateCache } from '@/lib/mercadolibre/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  resource: z.string().max(300),
  user_id: z.union([z.number(), z.string()]),
  topic: z.string().max(60),
  application_id: z.union([z.number(), z.string()]),
  attempts: z.number().int().optional(),
});

/**
 * Avisos de Mercado Libre (ventas, preguntas, publicaciones, envios).
 *
 * Mercado Libre no firma estos avisos, asi que no se confia en ellos para
 * nada: solo se registran y vacian la cache, para que el panel y Claude lean
 * datos frescos de la API. Se descarta lo que no sea de esta aplicacion y de
 * esta cuenta. Hay que responder 200 rapido o Mercado Libre reintenta.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 200 });

  const data = parsed.data;
  const connection = await getConnection();
  if (
    !connection ||
    String(data.application_id) !== env.mlClientId ||
    String(data.user_id) !== connection.mlUserId
  ) {
    return new NextResponse(null, { status: 200 });
  }

  invalidateCache('ml:');
  await prisma.mlNotification
    .create({ data: { topic: data.topic, resource: data.resource, attempts: data.attempts ?? 1 } })
    .catch(() => undefined);

  // Se conserva un mes de avisos.
  if (Math.random() < 0.02) {
    await prisma.mlNotification
      .deleteMany({ where: { receivedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } })
      .catch(() => undefined);
  }

  return new NextResponse(null, { status: 200 });
}
