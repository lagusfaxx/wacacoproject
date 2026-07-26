import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product-grid';
import { SortSelect } from '@/components/sort-select';
import { prisma } from '@/lib/db';
import { productCardSelect, toCardData } from '@/lib/catalog';
import { orderByForSort, parseSort } from '@/lib/sorting';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orden?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await prisma.collection.findFirst({ where: { slug, active: true } });
  if (!collection) return { title: 'Coleccion no encontrada' };
  return {
    title: collection.name,
    description: collection.description ?? collection.tagline ?? undefined,
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

  return (
    <>
      <header className="border-b border-sand-dark bg-sand">
        <div className="container-site flex flex-col items-start gap-8 py-14 md:flex-row md:items-center md:justify-between">
          <div>
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
        products={products.map(toCardData)}
        emptyMessage="Todavia no hay productos en esta coleccion."
      />
    </>
  );
}
