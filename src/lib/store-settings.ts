import 'server-only';

import { prisma } from './db';
import { env } from './env';

/**
 * Ajustes editables de la tienda.
 *
 * Viven en la tabla `Setting` para que el propietario pueda cambiarlos sin
 * volver a desplegar. Las variables de entorno solo aportan el valor inicial.
 */
export const LOGO_SETTING_KEY = 'store.logo';
export const CARRIER_SETTING_KEY = 'store.shippingCarrier';

/**
 * Nombre del transportista que se muestra cuando el envio no lo cotiza un
 * courier integrado. Lo edita el propietario junto con sus tarifas.
 */
export async function shippingCarrierName(): Promise<string> {
  const row = await prisma.setting
    .findUnique({ where: { key: CARRIER_SETTING_KEY } })
    .catch(() => null);
  return row?.value?.trim() || 'Despacho estandar';
}

export type StoreSettings = {
  name: string;
  email: string;
  announcement: string | null;
  logoUrl: string | null;
  marquee: string[];
  /** Titular grande de la portada. Vacio = solo el nombre del producto. */
  heroHeadline: string | null;
  /** Descripcion por defecto para buscadores y redes sociales. */
  metaDescription: string;
};

/** Mensajes por defecto de la cinta, editables desde el panel. */
const DEFAULT_MARQUEE = [
  'Envio a todo Chile con Blue Express',
  'Pago seguro con Mercado Pago',
  'Garantia oficial de 2 anos',
  'Repuestos disponibles',
];

export async function getStoreSettings(): Promise<StoreSettings> {
  let rows: { key: string; value: string }[] = [];

  try {
    rows = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'store.name',
            'store.email',
            'store.announcement',
            'store.marquee',
            'store.heroHeadline',
            'store.metaDescription',
            LOGO_SETTING_KEY,
          ],
        },
      },
      select: { key: true, value: true },
    });
  } catch {
    // Si la base todavia no responde, la tienda sigue renderizando.
  }

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const rawMarquee = map.get('store.marquee');

  return {
    name: map.get('store.name') || env.storeName,
    email: map.get('store.email') || env.storeEmail,
    announcement: map.get('store.announcement') || null,
    heroHeadline: map.get('store.heroHeadline') || null,
    metaDescription:
      map.get('store.metaDescription') ||
      `${map.get('store.name') || env.storeName}. Compra en linea con despacho a todo Chile y pago seguro.`,
    logoUrl: map.get(LOGO_SETTING_KEY) || null,
    marquee: rawMarquee
      ? rawMarquee
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 8)
      : DEFAULT_MARQUEE,
  };
}

export { DEFAULT_MARQUEE };
