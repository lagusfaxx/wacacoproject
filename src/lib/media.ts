import 'server-only';

import { prisma } from './db';

/**
 * Imagenes subidas desde el panel.
 *
 * Se guardan en Postgres en lugar de en disco porque el contenedor de Coolify
 * es efimero: cualquier archivo escrito en el sistema de archivos se pierde en
 * el siguiente despliegue. Guardarlas en la base tambien las incluye en los
 * respaldos de la tienda sin configurar nada aparte.
 */

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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
      error: `La imagen pesa ${Math.round(file.size / 1024)} KB y el maximo son ${
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

  return { id: asset.id, url: `/api/media/${asset.id}` };
}

export async function getImage(id: string) {
  return prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, size: true },
  });
}

/** Extrae el id de una URL /api/media/<id>, si lo es. */
export function mediaIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^\/api\/media\/([A-Za-z0-9_-]+)$/.exec(url.trim());
  return match ? match[1]! : null;
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

  const [products, collections, banners, settings] = await Promise.all([
    prisma.productImage.findMany({ select: { url: true } }),
    prisma.collection.findMany({ select: { image: true, seoImage: true } }),
    prisma.banner.findMany({ select: { image: true } }),
    prisma.setting.findMany({ select: { value: true } }),
  ]);

  const used = new Set<string>();
  const track = (value: string | null | undefined) => {
    const id = mediaIdFromUrl(value);
    if (id) used.add(id);
  };

  products.forEach((image) => track(image.url));
  collections.forEach((collection) => {
    track(collection.image);
    track(collection.seoImage);
  });
  banners.forEach((banner) => track(banner.image));
  settings.forEach((setting) => track(setting.value));

  // Los productos tambien guardan seoImage; se consulta aparte porque el
  // select anterior no la incluye.
  const productSeo = await prisma.product.findMany({ select: { seoImage: true } });
  productSeo.forEach((product) => track(product.seoImage));

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
