import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { ProductCardData } from '@/components/product-card';

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
  return products.map(toCardData);
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: { where: { active: true }, orderBy: { position: 'asc' } },
      collections: { include: { collection: true } },
    },
  });
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
