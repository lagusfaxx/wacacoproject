import 'server-only';

import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role, User } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
  signSession,
  verifySession,
} from './session-token';

const BCRYPT_ROUNDS = 12;

/**
 * Si la peticion actual llego por HTTPS.
 *
 * Determina el atributo `Secure` de las cookies, y tiene que salir de la
 * peticion y no de APP_URL: mientras el dominio definitivo se propaga es
 * normal que APP_URL ya apunte a https y la tienda se este visitando todavia
 * por http en una URL temporal. Una cookie `Secure` sobre http la descarta el
 * navegador sin avisar, y la sesion no llega a guardarse nunca.
 *
 * Coolify, como cualquier proxy inverso, informa el esquema original en
 * `x-forwarded-proto`. Que sea manipulable no importa aqui: forzar el valor
 * solo afecta a la propia sesion de quien lo manipula.
 */
export async function isSecureRequest(): Promise<boolean> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0]!.trim().toLowerCase() === 'https';

  const host = h.get('host') ?? '';
  // Sin cabecera del proxy se cae a lo declarado, salvo en desarrollo local.
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return false;
  return env.usesHttps;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: Pick<User, 'id' | 'email' | 'name' | 'role'>) {
  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isSecureRequest(),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Payload del JWT sin consultar la base de datos. */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Usuario real desde la base de datos. Se consulta siempre en operaciones
 * sensibles: un usuario desactivado o degradado a CUSTOMER debe perder el
 * acceso de inmediato, aunque su JWT todavia diga lo contrario.
 */
export async function getCurrentUser(): Promise<User | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(redirectTo = '/cuenta/ingresar'): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireRole(role: Role, redirectTo = '/cuenta/ingresar'): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  if (user.role !== role) redirect('/');
  return user;
}

export async function requireAdmin(): Promise<User> {
  return requireRole('ADMIN', '/admin/ingresar');
}

/** IP del cliente para rate limiting y auditoria. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
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
        ip: await getClientIp(),
      },
    });
  } catch {
    // La auditoria nunca debe hacer fallar la operacion principal.
  }
}
