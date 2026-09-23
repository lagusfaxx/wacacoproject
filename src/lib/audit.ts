import 'server-only';

import { prisma } from './db';

/** IP de la peticion en curso, si la hay (fuera de una peticion no existe). */
async function requestIp(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]!.trim();
    return h.get('x-real-ip') ?? 'unknown';
  } catch {
    return null;
  }
}

export async function writeAuditLog(input: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? {}) as object,
        ip: await requestIp(),
      },
    });
  } catch {
    // La auditoria nunca debe hacer fallar la operacion principal.
  }
}
