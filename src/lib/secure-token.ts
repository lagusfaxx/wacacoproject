import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

/** Hash para guardar credenciales que solo hace falta comparar, nunca leer. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Secreto aleatorio apto para URL. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Desafio PKCE S256 de un verificador. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
