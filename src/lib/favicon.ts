import 'server-only';

import { createHash } from 'node:crypto';
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
 *
 * Aqui se arman las dos formas del mismo icono:
 *
 * - el `.ico` de la pestana, que ahora lleva varios tamanos dentro (48, 96 y
 *   144) en vez de solo 48, porque Google se queda con el mas grande que
 *   encuentre y a 48 el dibujo le llega justo;
 * - un `.png` suelto para el manifiesto y para iOS, que son las otras dos
 *   fuentes de las que Google saca el icono de un sitio.
 */

/** Lado en pixeles del icono mas chico. Google exige cuadrado y multiplo de 48. */
export const FAVICON_SIZE = 48;

/**
 * Tamanos que viajan dentro del `.ico`.
 *
 * Todos son multiplos de 48 a proposito: es la condicion que Google pone para
 * quedarse con un icono, y con tres medidas el navegador tambien elige la que
 * le sirve sin reescalar.
 */
export const FAVICON_SIZES = [48, 96, 144];

/** Lados que acepta la ruta del PNG. Cerrado para no generar tamanos a pedido. */
export const ICON_PNG_SIZES = [48, 96, 144, 180, 192, 512];

export type Favicon = { bytes: Buffer; mimeType: string; etag: string };

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
 * Envuelve uno o varios PNG en un contenedor ICO.
 *
 * Un ICO puede llevar el PNG tal cual dentro, sin reencodearlo a mapa de bits:
 * lo entienden todos los navegadores en uso y tambien el robot de Google, y
 * asi el archivo pesa una fraccion de lo que pesaria en BMP. El formato admite
 * varias imagenes en el mismo archivo, una por tamano, y quien lo lee se queda
 * con la que le conviene.
 */
function icoFromPngs(images: { png: Buffer; size: number }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(images.length, 4); // cantidad de imagenes

  // Cada entrada del indice mide 16 bytes y las imagenes van despues de todas.
  let offset = header.length + images.length * 16;

  const entries = images.map(({ png, size }) => {
    const entry = Buffer.alloc(16);
    // Un lado de 256 se escribe como 0, que es como el formato marca ese caso.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // colores de la paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

/** Huella del contenido, para que el navegador y el robot puedan revalidar. */
function etagOf(bytes: Buffer): string {
  return `"${createHash('sha1').update(bytes).digest('hex').slice(0, 16)}"`;
}

/** Imagen de partida: la que subio el propietario o la del repositorio. */
async function sourceImage(faviconUrl: string | null): Promise<{ bytes: Buffer; mimeType: string }> {
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
 * Lleva la imagen a un PNG cuadrado del lado pedido.
 *
 * `contain` en vez de recortar: un logo apaisado perderia los extremos si se
 * cuadrara a la fuerza, y lo que queda alrededor se rellena transparente.
 * Devuelve `null` si sharp no esta disponible, y quien llama decide con que
 * responder en ese caso.
 */
async function toPng(bytes: Buffer, size: number): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    sharp.concurrency(1);

    return await sharp(bytes, { failOn: 'none' })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return null;
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
const cache = new Map<string, { key: string; value: Favicon; at: number }>();

async function cached(slot: string, key: string, build: () => Promise<Favicon>): Promise<Favicon> {
  const hit = cache.get(slot);
  if (hit && hit.key === key && Date.now() - hit.at < CACHE_MS) return hit.value;

  const value = await build();
  cache.set(slot, { key, value, at: Date.now() });
  return value;
}

/** Clave de cache: mientras el ajuste no cambie, el icono es el mismo. */
async function settingsKey(): Promise<{ key: string; faviconUrl: string | null }> {
  const settings = await getStoreSettings().catch(() => null);
  return { key: settings?.faviconUrl || DEFAULT_FAVICON, faviconUrl: settings?.faviconUrl ?? null };
}

/** El `.ico` de `/favicon.ico`, con los tres tamanos dentro. */
export async function getFavicon(): Promise<Favicon> {
  const { key, faviconUrl } = await settingsKey();

  return cached('ico', key, async () => {
    const source = await sourceImage(faviconUrl);
    const pngs = await Promise.all(
      FAVICON_SIZES.map(async (size) => ({ size, png: await toPng(source.bytes, size) })),
    );
    const usable = pngs.filter((image): image is { size: number; png: Buffer } => image.png !== null);

    // Sin sharp no hay como redimensionar: va la imagen del propietario tal
    // cual, que es peor icono pero sigue siendo el suyo y no el del repositorio.
    if (usable.length === 0) {
      return { ...source, etag: etagOf(source.bytes) };
    }

    const bytes = icoFromPngs(usable);
    return { bytes, mimeType: 'image/x-icon', etag: etagOf(bytes) };
  });
}

/**
 * El mismo icono en PNG, para el manifiesto y para iOS.
 *
 * Google no mira solo `/favicon.ico`: tambien lee los iconos declarados en el
 * manifiesto de la aplicacion web, y ahi un ICO no sirve.
 */
export async function getIconPng(size: number): Promise<Favicon> {
  const side = ICON_PNG_SIZES.includes(size) ? size : 192;
  const { key, faviconUrl } = await settingsKey();

  return cached(`png:${side}`, key, async () => {
    const source = await sourceImage(faviconUrl);
    const png = await toPng(source.bytes, side);

    if (!png) return { ...source, etag: etagOf(source.bytes) };
    return { bytes: png, mimeType: 'image/png', etag: etagOf(png) };
  });
}
