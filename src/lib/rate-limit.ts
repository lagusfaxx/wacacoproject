import 'server-only';

import { prisma } from './db';

/**
 * Rate limiting con ventana fija respaldado por Postgres.
 *
 * Se usa la base de datos en lugar de memoria para que el limite siga siendo
 * valido si Coolify levanta mas de una replica del contenedor.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.expiresAt <= now) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return { ok: true, remaining: Math.max(0, limit - updated.count), retryAfterSeconds: 0 };
  } catch {
    // Si el contador falla no se bloquea al usuario legitimo.
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Limpieza oportunista de contadores vencidos. */
export async function purgeExpiredRateLimits() {
  try {
    await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    /* noop */
  }
}
