import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getImage } from './media';
import { isMediaUrl } from './media-url';
import { DEFAULT_FAVICON, getStoreSettings } from './store-settings';

/**
 * El icono que Google muestra junto al enlace en sus resultados.
 *
 * Google no lee cualquier icono que declare la pagina: pide uno cuadrado y de
 * lado multiplo de 48, y cuando no encuentra uno que le sirva se va a
 * `/favicon.ico` a secas. Mientras ese archivo fue el dibujo por defecto del
 * repositorio, eso era justo lo que salia en las busquedas — el icono naranjo
 * de la plantilla — aunque el propietario hubiera subido el suyo desde el
 * panel, porque el suyo se declaraba en una direccion distinta.
 *
 * Por eso `/favicon.ico` dejo de ser un archivo fijo y pasa por aqui: sea cual
 * sea el camino por el que Google llegue, siempre recibe el mismo icono, el
 * que esta configurado, recortado a la medida que pide.
 */

/** Lado en pixeles. Google exige cuadrado y multiplo de 48. */
export const FAVICON_SIZE = 48;

export type Favicon = { bytes: Buffer; mimeType: string };

/** Ruta del icono que viaja en el repositorio, para cuando no hay otro. */
const FALLBACK_PATH = join(process.cwd(), 'public', 'icon.svg');

/**
 * Copia de emergencia del icono por defecto.
 *
 * Es el mismo dibujo que `public/icon.svg`, escrito aqui para que la ruta
 * responda algo aunque el archivo no viaje en la imagen del contenedor.
 */
const FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">' +
  '<rect width="48" height="48" fill="#1C1B1A"/>' +
  '<g fill="none" stroke="#E1580E" stroke-width="3.5" stroke-linecap="round">' +
  '<path d="M11 9h26v18c0 7.2-5.8 11.5-13 11.5S11 34.2 11 27V9Z"/>' +
  '<path d="M18 16v11M24 16v14M30 16v11"/></g></svg>';

/**
 * Envuelve un PNG en un contenedor ICO.
 *
 * Un ICO puede llevar el PNG tal cual dentro, sin reencodearlo a mapa de bits:
 * lo entienden todos los navegadores en uso y tambien el robot de Google, y
 * asi el archivo pesa una fraccion de lo que pesaria en BMP.
 */
function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(1, 4); // cantidad de imagenes

  const entry = Buffer.alloc(16);
  // Un lado de 256 se escribe como 0; con 48 no aplica, pero deja la funcion
  // correcta si alguna vez se pide mas grande.
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // colores de la paleta
  entry.writeUInt8(0, 3); // reservado
  entry.writeUInt16LE(1, 4); // planos
  entry.writeUInt16LE(32, 6); // bits por pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

/** Imagen de partida: la que subio el propietario o la del repositorio. */
async function sourceImage(faviconUrl: string | null): Promise<Favicon> {
  if (isMediaUrl(faviconUrl)) {
    const id = faviconUrl!.split('/').pop()!;
    const asset = await getImage(id).catch(() => null);
    if (asset) {
      return { bytes: Buffer.from(asset.bytes), mimeType: asset.mimeType };
    }
  }

  const bytes = await readFile(FALLBACK_PATH).catch(() => Buffer.from(FALLBACK_SVG, 'utf8'));
  return { bytes, mimeType: 'image/svg+xml' };
}

/**
 * Lleva la imagen a un ICO cuadrado de 48.
 *
 * `contain` en vez de recortar: un logo apaisado perderia los extremos si se
 * cuadrara a la fuerza, y lo que queda alrededor se rellena transparente. Si
 * sharp no esta disponible se devuelve la imagen tal cual, que es peor icono
 * pero sigue siendo el del propietario.
 */
async function toIcon(source: Favicon): Promise<Favicon> {
  try {
    const sharp = (await import('sharp')).default;
    sharp.concurrency(1);

    const png = await sharp(source.bytes, { failOn: 'none' })
      .resize(FAVICON_SIZE, FAVICON_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return { bytes: icoFromPng(png, FAVICON_SIZE), mimeType: 'image/x-icon' };
  } catch {
    return source;
  }
}

/**
 * Cache en memoria del proceso.
 *
 * El icono cambia cuando el propietario sube otro, o sea casi nunca, y en
 * cambio se pide en cada pestana. Se guarda por poco tiempo para que un cambio
 * desde el panel se vea sin reiniciar nada.
 */
const CACHE_MS = 60_000;
let cache: { key: string; value: Favicon; at: number } | null = null;

export async function getFavicon(): Promise<Favicon> {
  const settings = await getStoreSettings().catch(() => null);
  const key = settings?.faviconUrl || DEFAULT_FAVICON;

  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }

  const value = await toIcon(await sourceImage(settings?.faviconUrl ?? null));
  cache = { key, value, at: Date.now() };
  return value;
}
