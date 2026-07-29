import 'server-only';

import { prisma } from './db';

/**
 * Los canales por donde escribe el cliente: WhatsApp e Instagram.
 *
 * Van en los ajustes porque el numero cambia, la cuenta cambia, y el mensaje
 * con el que arranca la conversacion se ajusta segun la campana.
 */

export const SOCIAL_KEYS = {
  whatsapp: 'social.whatsapp',
  whatsappMessage: 'social.whatsappMensaje',
  instagram: 'social.instagram',
} as const;

export type SocialSettings = {
  /** Numero en formato internacional, solo digitos. Vacio = sin boton. */
  whatsapp: string;
  /** Texto con el que se abre la conversacion. */
  whatsappMessage: string;
  /** URL completa del perfil. Vacio = sin enlace. */
  instagram: string;
  /** Nombre de usuario, para mostrarlo junto al enlace. */
  instagramHandle: string;
};

export const EMPTY_SOCIAL: SocialSettings = {
  whatsapp: '',
  whatsappMessage: '',
  instagram: '',
  instagramHandle: '',
};

const DEFAULT_MESSAGE = 'Hola, tengo una consulta sobre un producto';

/**
 * Deja el numero como lo quiere WhatsApp: solo digitos, con el codigo de pais.
 *
 * En Chile la gente escribe su numero de seis maneras distintas (+56 9 1234
 * 5678, 56912345678, 9 1234 5678, 912345678...). Todas significan lo mismo y
 * todas tienen que funcionar, porque quien lo escribe en el panel no tiene por
 * que saber que WhatsApp exige el formato internacional sin signos.
 */
export function normalizeWhatsapp(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  if (!digitos) return '';

  // Ya viene con codigo de pais.
  if (digitos.startsWith('56')) return digitos;
  // Movil chileno con el 9 delante, sin pais.
  if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`;
  // Movil chileno sin el 9 y sin pais.
  if (digitos.length === 8) return `569${digitos}`;

  // Cualquier otro largo se respeta tal cual: puede ser de otro pais.
  return digitos;
}

export function whatsappUrl(number: string, message: string): string {
  const texto = message.trim() || DEFAULT_MESSAGE;
  return `https://wa.me/${number}?text=${encodeURIComponent(texto)}`;
}

/** Acepta la URL completa, "@usuario" o solo el usuario. */
export function normalizeInstagram(raw: string): { url: string; handle: string } {
  const limpio = raw.trim().replace(/\/+$/, '');
  if (!limpio) return { url: '', handle: '' };

  const desdeUrl = limpio.match(/instagram\.com\/([^/?#]+)/i);
  const handle = (desdeUrl?.[1] ?? limpio).replace(/^@/, '').trim();
  if (!handle) return { url: '', handle: '' };

  return { url: `https://www.instagram.com/${handle}`, handle: `@${handle}` };
}

export async function getSocialSettings(): Promise<SocialSettings> {
  let rows: { key: string; value: string }[] = [];

  try {
    rows = await prisma.setting.findMany({
      where: { key: { in: Object.values(SOCIAL_KEYS) } },
      select: { key: true, value: true },
    });
  } catch {
    return EMPTY_SOCIAL;
  }

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const instagram = normalizeInstagram(map.get(SOCIAL_KEYS.instagram) ?? '');

  return {
    whatsapp: normalizeWhatsapp(map.get(SOCIAL_KEYS.whatsapp) ?? ''),
    whatsappMessage: map.get(SOCIAL_KEYS.whatsappMessage) ?? '',
    instagram: instagram.url,
    instagramHandle: instagram.handle,
  };
}
