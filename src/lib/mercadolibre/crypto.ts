import 'server-only';

import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Cifrado de los tokens de Mercado Libre antes de guardarlos.
 *
 * AES-256-GCM: ademas de ocultar el token, detecta cualquier alteracion del
 * texto cifrado. El formato guardado es `v1.<iv>.<tag>.<datos>` en base64url,
 * con un iv aleatorio por cada cifrado.
 */

const VERSION = 'v1';

function key(): Buffer {
  const configured = env.mlEncryptionKey;
  if (configured) {
    // Se acepta la clave tal como sale de `openssl rand -base64 32`, pero
    // cualquier texto sirve: se normaliza a 32 bytes con SHA-256.
    const decoded = Buffer.from(configured, 'base64');
    return decoded.length === 32 ? decoded : createHash('sha256').update(configured).digest();
  }
  // Derivada del secreto de sesion con una etiqueta propia, para que la misma
  // clave nunca se use para dos cosas distintas.
  return Buffer.from(
    hkdfSync('sha256', env.sessionSecret, 'wacaco-store', 'mercadolibre-tokens', 32),
  );
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('Token de Mercado Libre con formato desconocido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
