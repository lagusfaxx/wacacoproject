import 'server-only';

import { prisma } from './db';
import { MEDIA_WIDTHS } from './media-url';

/**
 * Imagenes subidas desde el panel.
 *
 * Se guardan en Postgres en lugar de en disco porque el contenedor de Coolify
 * es efimero: cualquier archivo escrito en el sistema de archivos se pierde en
 * el siguiente despliegue. Guardarlas en la base tambien las incluye en los
 * respaldos de la tienda sin configurar nada aparte.
 */

/**
 * Peso maximo de una imagen subida desde el panel.
 *
 * Si se toca, hay que subir tambien `serverActions.bodySizeLimit` en
 * `next.config.ts`: el logo viaja por una Server Action, que trae su propio
 * tope y cortaria el archivo antes de que esta comprobacion llegue a correr.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

export type MediaError = { error: string };
export type MediaResult = { url: string; id: string };

/** Un SVG puede traer scripts; se rechaza en lugar de guardarlo. */
function svgIsSafe(buffer: Buffer): boolean {
  const source = buffer.toString('utf8').toLowerCase();
  return (
    !source.includes('<script') &&
    !source.includes('javascript:') &&
    !/\son\w+\s*=/.test(source)
  );
}

export async function storeImage(file: File, alt = ''): Promise<MediaResult | MediaError> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No se recibio ningun archivo.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Formato no admitido. Usa JPG, PNG, WEBP, AVIF o SVG.' };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      error: `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el maximo son ${
        MAX_IMAGE_BYTES / 1024 / 1024
      } MB.`,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (file.type === 'image/svg+xml' && !svgIsSafe(bytes)) {
    return { error: 'El SVG contiene codigo ejecutable y no se puede usar.' };
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      filename: file.name.slice(0, 200) || 'imagen',
      mimeType: file.type,
      size: bytes.length,
      bytes,
      alt: alt.slice(0, 200),
    },
    select: { id: true },
  });

  // Se dejan preparadas las versiones optimizadas mientras el propietario
  // sigue llenando el formulario, para que ningun visitante las espere.
  warmVariants(asset.id, bytes, file.type);

  return { id: asset.id, url: `/api/media/${asset.id}` };
}

export async function getImage(id: string) {
  return prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, size: true },
  });
}

// ---------------------------------------------------------------------------
// Versiones optimizadas
// ---------------------------------------------------------------------------

/** Formatos modernos, del que mejor comprime al que menos. */
const MODERN_FORMATS = ['avif', 'webp'] as const;
export type MediaFormat = (typeof MODERN_FORMATS)[number];

/** Un SVG ya es texto y escala solo; reencodearlo no aporta nada. */
const NOT_OPTIMIZABLE = ['image/svg+xml'];

/**
 * La lista de anchos es cerrada a proposito: uno libre en la URL dejaria que
 * cualquiera pidiera mil tamanos distintos y llenara la base de versiones.
 */
export function toMediaWidth(value: string | null): number | null {
  const width = Number(value);
  return MEDIA_WIDTHS.includes(width) ? width : null;
}

/** Elige el mejor formato que el navegador dice aceptar. */
export function pickFormat(accept: string | null): MediaFormat | null {
  const header = (accept ?? '').toLowerCase();
  return MODERN_FORMATS.find((format) => header.includes(`image/${format}`)) ?? null;
}

/**
 * Devuelve la imagen en el ancho y formato pedidos, generandola la primera vez.
 *
 * Nunca modifica ni reemplaza el original: la version optimizada se guarda
 * aparte, como cache. Si algo falla — sharp no disponible, formato que no se
 * puede leer — se devuelve el original tal cual, que es exactamente el
 * comportamiento que habia antes de todo esto.
 */
export async function getOptimizedImage(
  id: string,
  width: number | null,
  format: MediaFormat | null,
): Promise<{ bytes: Buffer; mimeType: string; size: number } | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, size: true },
  });
  if (!asset) return null;

  const original = { bytes: Buffer.from(asset.bytes), mimeType: asset.mimeType, size: asset.size };
  if (NOT_OPTIMIZABLE.includes(asset.mimeType)) return original;
  if (!width && !format) return original;

  const key = { mediaId: id, width: width ?? 0, format: format ?? 'origen' };

  const cached = await prisma.mediaVariant
    .findUnique({
      where: { mediaId_width_format: key },
      select: { bytes: true, mimeType: true, size: true },
    })
    .catch(() => null);
  if (cached) {
    return { bytes: Buffer.from(cached.bytes), mimeType: cached.mimeType, size: cached.size };
  }

  // Nadie espera a que se genere. Comprimir una foto grande cuesta segundos, y
  // hacerlo mientras alguien mira la pantalla en blanco es exactamente el
  // problema que esto venia a resolver: se manda el original, que ya esta
  // listo, y las versiones quedan hechas para la siguiente visita.
  //
  // Se preparan todos los anchos de una vez, no solo el pedido: la imagen ya
  // esta leida de la base y quien entra despues pedira otro ancho segun su
  // pantalla. Con esto una sola visita deja la foto lista para todos.
  warmVariants(id, original.bytes, original.mimeType);
  return original;
}

/** Variantes que ya se estan calculando, para no repetir el trabajo. */
const enCurso = new Set<string>();

/**
 * Calcula y guarda una version, si no estaba ya.
 *
 * No devuelve nada a proposito: quien la pide no la espera. Los errores se
 * tragan porque esto es cache; si falla, la proxima peticion sirve el original
 * igual que ahora.
 */
async function ensureVariant(
  id: string,
  originalBytes: Buffer,
  width: number | null,
  format: MediaFormat | null,
): Promise<void> {
  const key = { mediaId: id, width: width ?? 0, format: format ?? 'origen' };
  const marca = `${key.mediaId}|${key.width}|${key.format}`;
  if (enCurso.has(marca)) return;
  enCurso.add(marca);

  try {
    const existe = await prisma.mediaVariant
      .findUnique({ where: { mediaId_width_format: key }, select: { id: true } })
      .catch(() => null);
    if (existe) return;

    const rendered = await render(originalBytes, width, format).catch(() => null);
    if (!rendered) return;

    // Si la version "optimizada" pesa mas que el original, no vale la pena:
    // pasa con fotos ya comprimidas al limite y con imagenes muy pequenas.
    if (!width && rendered.bytes.length >= originalBytes.length) return;

    await prisma.mediaVariant
      .create({
        data: {
          ...key,
          mimeType: rendered.mimeType,
          size: rendered.bytes.length,
          bytes: rendered.bytes,
        },
      })
      .catch(() => undefined);
  } finally {
    enCurso.delete(marca);
  }
}

/**
 * Deja preparadas las versiones de una imagen recien subida.
 *
 * Se lanza al subir, sin esperarla: para cuando el primer visitante llegue a
 * la portada, las fotos del banner ya estan comprimidas y salen al instante.
 */
export function warmVariants(id: string, bytes: Buffer, mimeType: string): void {
  if (NOT_OPTIMIZABLE.includes(mimeType)) return;

  // Se espera un poco antes de empezar. Comprimir ocupa el procesador, y si
  // arranca en el mismo instante en que alguien esta cargando la portada le
  // roba el tiempo a la pagina que lo disparo: medido, la foto del banner
  // pasaba de 400 ms a 4 segundos. Este respiro basta para que la visita en
  // curso termine primero.
  setTimeout(() => {
    void (async () => {
      for (const format of MODERN_FORMATS) {
        for (const width of [null, ...MEDIA_WIDTHS]) {
          await ensureVariant(id, bytes, width, format).catch(() => undefined);
        }
      }
    })();
  }, WARM_DELAY_MS).unref?.();
}

/** Respiro antes de empezar a comprimir en segundo plano. */
const WARM_DELAY_MS = 4000;

/**
 * Reencodea con sharp.
 *
 * Se importa aqui dentro y no arriba porque es un modulo nativo: si el
 * despliegue no lo trae, esta funcion falla y quien llama sirve el original,
 * en lugar de tumbar la tienda entera.
 */
async function render(
  bytes: Buffer,
  width: number | null,
  format: MediaFormat | null,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const sharp = (await import('sharp')).default;

  // Un solo hilo por operacion: el servidor de la tienda suele tener uno o dos
  // nucleos, y dejar que libvips se los quede todos deja la pagina esperando.
  sharp.concurrency(1);

  let pipeline = sharp(bytes, { failOn: 'none' });

  const meta = await pipeline.metadata();
  // Nunca se agranda una imagen: pedir 1920 de una foto de 800 devolveria una
  // version borrosa y mas pesada que el original.
  if (width && meta.width && width < meta.width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true });
  }

  // Calidades altas a proposito: el objetivo es que no se note la diferencia.
  // AVIF y WEBP a estos valores son visualmente indistinguibles del original y
  // aun asi pesan una fraccion.
  //
  // El esfuerzo de AVIF va al minimo porque el reparto es pesimo: medido sobre
  // una foto de 2400x1600 a 1920 de ancho, subirlo de 0 a 4 tarda 2927 ms en
  // vez de 446 y solo ahorra 2 KB de 10. No vale la pena ni siquiera
  // calculandolo en segundo plano, que igual es tiempo de servidor.
  if (format === 'avif') {
    return { bytes: await pipeline.avif({ quality: 62, effort: 0 }).toBuffer(), mimeType: 'image/avif' };
  }
  if (format === 'webp') {
    return { bytes: await pipeline.webp({ quality: 85 }).toBuffer(), mimeType: 'image/webp' };
  }

  // Sin formato moderno solo queda reducir el ancho, conservando el original.
  if (!width) return null;
  if (meta.format === 'png') {
    return { bytes: await pipeline.png({ compressionLevel: 9 }).toBuffer(), mimeType: 'image/png' };
  }
  return { bytes: await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer(), mimeType: 'image/jpeg' };
}

/** Extrae el id de una URL /api/media/<id>, si lo es. */
export function mediaIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^\/api\/media\/([A-Za-z0-9_-]+)$/.exec(url.trim());
  return match ? match[1]! : null;
}

/**
 * Todas las imagenes que alguna fila de la tienda esta usando ahora mismo.
 *
 * Es la lista de la que depende la limpieza para no borrar algo vivo, asi que
 * cuando se agregue un sitio nuevo donde pegar una imagen hay que sumarlo
 * aqui. Olvidarlo no da error: borra la imagen y deja un hueco en la tienda.
 */
async function usedMediaIds(): Promise<Set<string>> {
  const [productImages, products, collections, banners, blocks, settings] = await Promise.all([
    prisma.productImage.findMany({ select: { url: true } }),
    prisma.product.findMany({ select: { seoImage: true } }),
    prisma.collection.findMany({ select: { image: true, seoImage: true } }),
    prisma.banner.findMany({ select: { image: true, video: true } }),
    prisma.productBlock.findMany({ select: { image: true, images: true, video: true } }),
    prisma.setting.findMany({ select: { value: true } }),
  ]);

  const used = new Set<string>();
  const track = (value: string | null | undefined) => {
    const id = mediaIdFromUrl(value);
    if (id) used.add(id);
  };

  productImages.forEach((image) => track(image.url));
  products.forEach((product) => track(product.seoImage));
  collections.forEach((collection) => {
    track(collection.image);
    track(collection.seoImage);
  });
  banners.forEach((banner) => {
    track(banner.image);
    track(banner.video);
  });
  // Los bloques del producto guardan la foto del bloque partido, el logo del
  // relato, el cartel del video y la fila entera de la franja de fotos.
  blocks.forEach((block) => {
    track(block.image);
    track(block.video);
    block.images.forEach(track);
  });
  settings.forEach((setting) => track(setting.value));

  return used;
}

/**
 * Borra las imagenes que ya no referencia nadie.
 *
 * Se llama al guardar un producto, coleccion o banner. Sin esto la base
 * acumularia cada imagen que el propietario subio y despues reemplazo.
 */
export async function purgeOrphanImages(): Promise<number> {
  const assets = await prisma.mediaAsset.findMany({ select: { id: true, createdAt: true } });
  if (assets.length === 0) return 0;

  const used = await usedMediaIds();

  // Se respeta una ventana de gracia: una imagen recien subida puede estar en
  // un formulario todavia sin guardar.
  const cutoff = Date.now() - 60 * 60 * 1000;
  const orphans = assets
    .filter((asset) => !used.has(asset.id) && asset.createdAt.getTime() < cutoff)
    .map((asset) => asset.id);

  if (orphans.length === 0) return 0;

  const removed = await prisma.mediaAsset.deleteMany({ where: { id: { in: orphans } } });
  return removed.count;
}
