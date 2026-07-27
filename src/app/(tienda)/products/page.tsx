import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { SortSelect } from '@/components/sort-select';
import { prisma } from '@/lib/db';
import { productCardSelect, toCardData } from '@/lib/catalog';
import { orderByForSort, parseSort } from '@/lib/sorting';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Todos los productos',
  description: 'Catalogo completo de cafeteras portatiles Wacaco y accesorios.',
};

type PageProps = {
  searchParams: Promise<{ orden?: string; coleccion?: string }>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const { orden, coleccion } = await searchParams;
  const sort = parseSort(orden);

  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        ...(coleccion ? { collections: { some: { collection: { slug: coleccion } } } } : {}),
      },
      orderBy: orderByForSort(sort),
      ...productCardSelect,
    }),
    prisma.collection.findMany({ where: { active: true }, orderBy: { position: 'asc' } }),
  ]);

  return (
    <>
      <header className="border-b border-sand-dark bg-sand">
        <div className="container-site py-14">
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-6xl">
            Todos los productos
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-muted">
            Cafeteras espresso manuales y electricas, cafeteras de filtro y los accesorios que
            completan tu equipo portatil.
          </p>
        </div>
      </header>

      <div className="container-site flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/products" active={!coleccion}>
            Todo
          </FilterChip>
          {collections.map((collection) => (
            <FilterChip
              key={collection.id}
              href={`/products?coleccion=${collection.slug}${orden ? `&orden=${orden}` : ''}`}
              active={coleccion === collection.slug}
            >
              {collection.name}
            </FilterChip>
          ))}
        </div>
        <SortSelect value={sort} />
      </div>

      <p className="container-site pb-4 text-xs uppercase tracking-widest text-ink-muted">
        {products.length} {products.length === 1 ? 'producto' : 'productos'}
      </p>

      <ProductGrid products={products.map(toCardData)} />
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`border px-4 py-2 font-display text-xs font-semibold uppercase tracking-widest transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-sand-dark bg-white text-ink-soft hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
