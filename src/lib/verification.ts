import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { VerificationPurpose } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';

/**
 * Codigos de un solo uso enviados por correo.
 *
 * Seis digitos son faciles de teclear pero tambien de adivinar, asi que la
 * seguridad no esta en la longitud sino en el resto: cada codigo vive quince
 * minutos, admite cinco intentos, se invalida al usarse y al pedir uno nuevo
 * los anteriores caducan. En la base solo queda el hash.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 15;
export const MAX_ATTEMPTS = 5;

export function generateCode(): string {
  // randomInt usa el generador criptografico: Math.random es predecible y
  // aqui el numero es la llave de una cuenta.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/**
 * El hash lleva la clave de sesion como pimienta: con el volcado de la tabla
 * y sin la variable de entorno no se puede recorrer el millon de codigos
 * posibles para dar con el original.
 */
function hashCode(code: string): string {
  return createHmac('sha256', env.sessionSecret).update(code).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Crea un codigo y caduca los anteriores del mismo correo y proposito, para
 * que solo sirva el ultimo que recibio el cliente.
 */
export async function issueCode(
  email: string,
  purpose: VerificationPurpose,
): Promise<{ code: string; minutes: number }> {
  const normalized = email.trim().toLowerCase();
  const code = generateCode();

  await prisma.verificationCode.updateMany({
    where: { email: normalized, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationCode.create({
    data: {
      email: normalized,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  // Limpieza oportunista: la tabla no tiene por que guardar para siempre los
  // codigos que ya nadie puede usar.
  await purgeExpiredCodes().catch(() => 0);

  return { code, minutes: CODE_TTL_MINUTES };
}

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' };

/**
 * Comprueba el codigo y lo consume si es correcto.
 *
 * Un codigo equivocado suma un intento; al quinto el codigo muere aunque le
 * quede tiempo, que es lo que impide probar los diez mil restantes.
 */
export async function consumeCode(
  email: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<CodeCheck> {
  const normalized = email.trim().toLowerCase();
  const candidate = code.replace(/\D/g, '');

  const record = await prisma.verificationCode.findFirst({
    where: { email: normalized, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { ok: false, reason: 'not_found' };

  if (record.expiresAt <= new Date()) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (candidate.length !== CODE_LENGTH || !sameHash(record.codeHash, hashCode(candidate))) {
    const updated = await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= MAX_ATTEMPTS) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      return { ok: false, reason: 'too_many_attempts' };
    }
    return { ok: false, reason: 'mismatch' };
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}

/** Borra los codigos vencidos hace mas de un dia. */
export async function purgeExpiredCodes(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.verificationCode.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return result.count;
}
