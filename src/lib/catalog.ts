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
  return withRatings(products);
}

/**
 * Adjunta a cada tarjeta su nota media.
 *
 * Va en una consulta aparte y no en el select del producto porque es un
 * agregado: pedir todas las opiniones para calcular un promedio traeria a
 * memoria cientos de textos que la tarjeta no muestra.
 */
export async function withRatings(
  products: ProductWithRelations[],
): Promise<ProductCardData[]> {
  const ratings = await getRatingsByProduct(products.map((product) => product.id));
  return products.map((product) => ({
    ...toCardData(product),
    rating: ratings.get(product.id) ?? null,
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

  return strips
    .map((strip) => ({
      id: strip.id,
      title: strip.title,
      placement: strip.placement,
      products: strip.items
        .filter((item) => item.product.active)
        .map((item) => toCardData(item.product)),
    }))
    .filter((strip) => strip.products.length > 0);
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

  if (products.length >= limit) return products.map(toCardData);

  // Si la coleccion no alcanza para llenar la fila se completa con destacados.
  const filler = await prisma.product.findMany({
    where: { active: true, id: { notIn: [productId, ...products.map((p) => p.id)] } },
    orderBy: { position: 'asc' },
    take: limit - products.length,
    ...productCardSelect,
  });

  return [...products, ...filler].map(toCardData);
}
