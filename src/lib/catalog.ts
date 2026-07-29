import 'server-only';

import type { Prisma, ProductBlock } from '@prisma/client';
import { prisma } from './db';
import {
  type ProductBlockData,
  toBlockImageFit,
  toBlockImageSide,
  toBlockImageSize,
  toBlockKind,
  toBlockTheme,
} from './product-blocks';
import type { ProductCardData } from '@/components/product-card';
import { getRatingsByProduct } from './reviews';
import { getPickupSettings, pickupIsUsable } from './pickup';

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { images: true; variants: true };
}>;

export const productCardSelect = {
  include: {
    images: { orderBy: { position: 'asc' } },
    variants: { where: { active: true }, orderBy: { position: 'asc' } },
  },
} satisfies Prisma.ProductDefaultArgs;

/**
 * Los Server Components no pueden pasar objetos Decimal al cliente, por lo que
 * los importes se serializan a string y se formatean al renderizar.
 */
export function toCardData(product: ProductWithRelations): ProductCardData {
  return {
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : null,
    image: product.images[0]?.url ?? null,
    award: product.award,
    isNew: product.isNew,
    incoming: product.incoming,
    stock: product.variants.length
      ? product.variants.reduce((total, variant) => total + variant.stock, 0)
      : product.stock,
    colors: product.variants
      .filter((variant) => variant.colorHex)
      .map((variant) => ({ name: variant.name, hex: variant.colorHex })),
  };
}

export async function getFeaturedProducts(limit = 4): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { active: true, featured: true },
    orderBy: { position: 'asc' },
    take: limit,
    ...productCardSelect,
  });
  return toCards(products);
}

/**
 * Las tarjetas completas: con su nota media y con el aviso de retiro.
 *
 * La nota va en una consulta aparte y no en el select del producto porque es
 * un agregado: pedir todas las opiniones para calcular un promedio traeria a
 * memoria cientos de textos que la tarjeta no muestra. El retiro es un ajuste
 * de la tienda, asi que se lee una vez para todo el listado.
 *
 * Cualquier listado del catalogo deberia pasar por aqui. Cuando no lo hacia,
 * las estrellas aparecian en la ficha del producto pero no en el catalogo, que
 * es justo donde ayudan a decidir cual abrir.
 */
export async function toCards(products: ProductWithRelations[]): Promise<ProductCardData[]> {
  const [ratings, pickup] = await Promise.all([
    getRatingsByProduct(products.map((product) => product.id)),
    getPickupSettings(),
  ]);

  const conRetiro = pickupIsUsable(pickup);

  return products.map((product) => ({
    ...toCardData(product),
    rating: ratings.get(product.id) ?? null,
    pickup: conRetiro,
  }));
}

/**
 * Tiras de productos elegidos a mano para la portada, con sus productos ya en
 * el formato de tarjeta. Se descartan las tiras que quedaron sin productos
 * visibles, para no dibujar un titulo sobre una fila vacia.
 */
export async function getProductStrips(): Promise<
  { id: string; title: string; placement: string; products: ProductCardData[] }[]
> {
  const strips = await prisma.productStrip.findMany({
    where: { active: true },
    orderBy: { position: 'asc' },
    include: {
      items: {
        orderBy: { position: 'asc' },
        include: { product: productCardSelect },
      },
    },
  });

  const armadas = await Promise.all(
    strips.map(async (strip) => ({
      id: strip.id,
      title: strip.title,
      placement: strip.placement,
      products: await toCards(
        strip.items.filter((item) => item.product.active).map((item) => item.product),
      ),
    })),
  );

  return armadas.filter((strip) => strip.products.length > 0);
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: { where: { active: true }, orderBy: { position: 'asc' } },
      blocks: { where: { active: true }, orderBy: { position: 'asc' } },
      collections: { include: { collection: true } },
    },
  });
}

/**
 * Pasa los bloques guardados al formato que espera el componente que los
 * dibuja: sin nulos y con los dos campos acotados a sus valores validos, para
 * que un dato viejo o escrito a mano no rompa la pagina.
 */
export function toBlockData(blocks: ProductBlock[]): ProductBlockData[] {
  return blocks.map((block) => ({
    id: block.id,
    kind: toBlockKind(block.kind),
    eyebrow: block.eyebrow ?? '',
    title: block.title ?? '',
    body: block.body ?? '',
    image: block.image ?? '',
    images: block.images,
    video: block.video ?? '',
    theme: toBlockTheme(block.theme),
    imageSize: toBlockImageSize(block.imageSize),
    imageSide: toBlockImageSide(block.imageSide),
    imageFit: toBlockImageFit(block.imageFit),
    ctaLabel: block.ctaLabel ?? '',
    ctaHref: block.ctaHref ?? '',
    active: block.active,
  }));
}

export async function getRelatedProducts(
  productId: string,
  collectionIds: string[],
  limit = 4,
): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      id: { not: productId },
      ...(collectionIds.length
        ? { collections: { some: { collectionId: { in: collectionIds } } } }
        : {}),
    },
    orderBy: { position: 'asc' },
    take: limit,
    ...productCardSelect,
  });

  if (products.length >= limit) return toCards(products);

  // Si la coleccion no alcanza para llenar la fila se completa con destacados.
  const filler = await prisma.product.findMany({
    where: { active: true, id: { notIn: [productId, ...products.map((p) => p.id)] } },
    orderBy: { position: 'asc' },
    take: limit - products.length,
    ...productCardSelect,
  });

  return toCards([...products, ...filler]);
}
