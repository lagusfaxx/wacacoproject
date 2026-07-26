import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/productos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/ayuda`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const [products, collections] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.collection.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticRoutes,
      ...collections.map((collection) => ({
        url: `${base}/coleccion/${collection.slug}`,
        lastModified: collection.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...products.map((product) => ({
        url: `${base}/productos/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
