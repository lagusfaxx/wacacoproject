import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

/**
 * Firma/verificacion del JWT de sesion.
 *
 * Este modulo se mantiene libre de Prisma y bcrypt para poder usarse tambien
 * desde el middleware, que corre en el runtime Edge.
 */

export const SESSION_COOKIE = 'wc_session';
export const CART_COOKIE = 'wc_cart';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer('wacaco-store')
    .setAudience('wacaco-store')
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'wacaco-store',
      audience: 'wacaco-store',
      algorithms: ['HS256'],
    });
    if (!payload.sub) return null;
    const role = payload.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role,
    };
  } catch {
    return null;
  }
}
