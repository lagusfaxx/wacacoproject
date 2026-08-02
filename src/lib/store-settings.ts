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
/**
 * Segundo logo. Cuando esta cargado, la cabecera y el pie alternan entre los
 * dos: sirve para mostrar junto a la marca de los productos la de la empresa
 * que opera la tienda, sin que parezca que una es la otra.
 */
export const SECONDARY_LOGO_SETTING_KEY = 'store.logoSecondary';
/** Texto alternativo del segundo logo, para lectores de pantalla. */
export const SECONDARY_LOGO_ALT_SETTING_KEY = 'store.logoSecondaryAlt';
/**
 * Icono de la pestana del navegador. Vacio = el icono por defecto que viaja en
 * el repositorio (`public/icon.svg`).
 */
export const FAVICON_SETTING_KEY = 'store.favicon';
export const CARRIER_SETTING_KEY = 'store.shippingCarrier';
/**
 * Logo del medio de pago, subido desde el panel.
 *
 * No viaja en el repositorio porque es marca de un tercero: lo descarga el
 * propietario de la pagina oficial de Mercado Pago y lo sube, igual que su
 * propio logo. Sin el, la tienda escribe el nombre en texto.
 */
export const PAYMENT_LOGO_SETTING_KEY = 'store.paymentLogo';

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
  secondaryLogoUrl: string | null;
  secondaryLogoAlt: string;
  /** Icono de la pestana subido desde el panel. null = el del repositorio. */
  faviconUrl: string | null;
  /** Logo del medio de pago. null = se escribe el nombre en texto. */
  paymentLogoUrl: string | null;
  marquee: string[];
  /** Titular grande de la portada. Vacio = solo el nombre del producto. */
  heroHeadline: string | null;
  /** Descripcion por defecto para buscadores y redes sociales. */
  metaDescription: string;
  /**
   * Lo que el propietario escribio de verdad, sin el respaldo generico.
   * La portada arma uno mejor con el catalogo cuando esto viene vacio.
   */
  metaDescriptionCustom: string | null;
  /**
   * Marca de los productos que vende la tienda, cuando no es la propia.
   *
   * Es el dato que faltaba para que la tienda se encuentre por el nombre de la
   * marca: si la tienda se llama de una forma y vende otra, esa palabra no
   * aparece en ninguna parte de la pagina por mucho catalogo que haya.
   */
  brand: string | null;
  /** Titulo de la portada en Google. Vacio = se arma solo con el catalogo. */
  seoTitle: string | null;
  /** Encabezado del texto de portada, que es el h1 de la pagina. */
  seoHeading: string | null;
  /** Parrafo de la portada, el unico texto largo que Google encuentra ahi. */
  seoText: string | null;
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
            'store.brand',
            'store.seoTitle',
            'store.seoHeading',
            'store.seoText',
            LOGO_SETTING_KEY,
            SECONDARY_LOGO_SETTING_KEY,
            SECONDARY_LOGO_ALT_SETTING_KEY,
            FAVICON_SETTING_KEY,
            PAYMENT_LOGO_SETTING_KEY,
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
    metaDescriptionCustom: map.get('store.metaDescription') || null,
    brand: map.get('store.brand') || null,
    seoTitle: map.get('store.seoTitle') || null,
    seoHeading: map.get('store.seoHeading') || null,
    seoText: map.get('store.seoText') || null,
    logoUrl: map.get(LOGO_SETTING_KEY) || null,
    secondaryLogoUrl: map.get(SECONDARY_LOGO_SETTING_KEY) || null,
    secondaryLogoAlt: map.get(SECONDARY_LOGO_ALT_SETTING_KEY) || '',
    faviconUrl: map.get(FAVICON_SETTING_KEY) || null,
    paymentLogoUrl: map.get(PAYMENT_LOGO_SETTING_KEY) || null,
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

/** Icono que viaja en el repositorio y se usa mientras no se suba otro. */
export const DEFAULT_FAVICON = '/icon.svg';

/**
 * Iconos que declara el `<head>`.
 *
 * El icono de la pestana apunta a `/favicon.ico`, que no es un archivo sino la
 * ruta que sirve el icono configurado en el panel recortado a 48x48. Se hace
 * asi por Google: solo acepta iconos cuadrados de lado multiplo de 48, y
 * cuando el declarado no le sirve pide `/favicon.ico` a secas. Declarando esa
 * misma direccion, los dos caminos llevan al mismo sitio y en los resultados
 * de busqueda sale el icono de la tienda y no el que viene en el repositorio.
 *
 * La direccion es fija a proposito, aunque el icono cambie: Google guarda el
 * icono por URL y una direccion nueva en cada cambio reinicia su cache.
 *
 * El de iOS sigue apuntando al archivo original, sin recortar: ahi lo que se
 * usa es una imagen grande para la pantalla de inicio, no un icono de 48.
 */
export function storeIcons(faviconUrl: string | null): {
  icon: { url: string; sizes: string; type: string }[];
  shortcut: { url: string }[];
  apple: { url: string }[];
} {
  return {
    icon: [{ url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' }],
    shortcut: [{ url: '/favicon.ico' }],
    apple: [{ url: faviconUrl || DEFAULT_FAVICON }],
  };
}

export type NavLink = { label: string; href: string };

/** Enlaces de la cabecera cuando el propietario no ha configurado ninguno. */
const DEFAULT_NAV: NavLink[] = [
  { label: 'Seguir mi pedido', href: '/seguimiento' },
  { label: 'Ayuda', href: '/ayuda' },
];

export async function getNavLinks(): Promise<NavLink[]> {
  try {
    const items = await prisma.menuItem.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: { label: true, href: true },
    });
    return items.length ? items : DEFAULT_NAV;
  } catch {
    return DEFAULT_NAV;
  }
}
