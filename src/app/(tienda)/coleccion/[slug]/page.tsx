import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { ProductGrid } from '@/components/product-grid';
import { SortSelect } from '@/components/sort-select';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { productCardSelect, toCards } from '@/lib/catalog';
import {
  absoluteUrl,
  resolveSeoDescription,
  resolveSeoImage,
  resolveSeoTitle,
} from '@/lib/seo';
import { getStoreSettings } from '@/lib/store-settings';
import { orderByForSort, parseSort } from '@/lib/sorting';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orden?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [collection, store] = await Promise.all([
    prisma.collection.findFirst({ where: { slug, active: true } }),
    getStoreSettings(),
  ]);
  if (!collection) return { title: 'Coleccion no encontrada' };

  const fallback = {
    name: collection.name,
    tagline: collection.tagline,
    body: collection.description,
    image: collection.image,
    storeName: store.name,
  };

  const title = resolveSeoTitle(collection, fallback);
  const description = resolveSeoDescription(collection, fallback);
  const image = absoluteUrl(resolveSeoImage(collection, fallback), env.appUrl);
  const canonical = `${env.appUrl}/coleccion/${collection.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: collection.noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      siteName: store.name,
      images: image ? [{ url: image, alt: collection.name }] : undefined,
    },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const [{ slug }, { orden }] = await Promise.all([params, searchParams]);
  const sort = parseSort(orden);

  const collection = await prisma.collection.findFirst({ where: { slug, active: true } });
  if (!collection) notFound();

  const products = await prisma.product.findMany({
    where: { active: true, collections: { some: { collectionId: collection.id } } },
    orderBy: orderByForSort(sort),
    ...productCardSelect,
  });

  // Lo que Google necesita para entender una pagina de categoria: donde esta
  // dentro del sitio y que productos contiene, en su orden.
  const canonical = `${env.appUrl}/coleccion/${collection.slug}`;
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: env.appUrl },
          { '@type': 'ListItem', position: 2, name: 'Productos', item: `${env.appUrl}/products` },
          { '@type': 'ListItem', position: 3, name: collection.name, item: canonical },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        name: collection.name,
        description: collection.description || collection.tagline || undefined,
        url: canonical,
        inLanguage: 'es-CL',
        ...(products.length > 0
          ? {
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: products.length,
                itemListElement: products.map((product, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: product.name,
                  url: `${env.appUrl}/products/${product.slug}`,
                })),
              },
            }
          : {}),
      },
    ],
  };

  return (
    <>
      <JsonLd data={collectionJsonLd} />

      <header className="border-b border-sand-dark bg-sand">
        <div className="container-site flex flex-col items-start gap-8 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <nav aria-label="Ruta" className="mb-4 text-xs uppercase tracking-widest text-ink-muted">
              <Link href="/" className="hover:text-brand">
                Inicio
              </Link>
              <span className="px-2">/</span>
              <Link href="/products" className="hover:text-brand">
                Productos
              </Link>
              <span className="px-2">/</span>
              <span className="text-ink">{collection.name}</span>
            </nav>
            <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand">
              Coleccion
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-6xl">
              {collection.name}
            </h1>
            {collection.tagline ? (
              <p className="mt-3 text-base uppercase tracking-wide text-ink-muted">
                {collection.tagline}
              </p>
            ) : null}
            {collection.description ? (
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
                {collection.description}
              </p>
            ) : null}
          </div>
          {collection.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collection.image} alt="" aria-hidden="true" className="h-40 w-40 object-contain" />
          ) : null}
        </div>
      </header>

      <div className="container-site flex flex-wrap items-center justify-between gap-4 py-6">
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          {products.length} {products.length === 1 ? 'producto' : 'productos'}
        </p>
        <SortSelect value={sort} />
      </div>

      <ProductGrid
        products={await toCards(products)}
        emptyMessage="Todavia no hay productos en esta coleccion."
      />
    </>
  );
}
