import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { prisma } from '@/lib/db';
import { productCardSelect, toCards } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false, follow: true },
};

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const term = (q ?? '').trim().slice(0, 80);

  const products = term
    ? await prisma.product.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { subtitle: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { sku: { contains: term, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ featured: 'desc' }, { position: 'asc' }],
        take: 48,
        ...productCardSelect,
      })
    : [];

  return (
    <>
      <header className="border-b border-sand-dark bg-sand">
        <div className="container-site py-14">
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-5xl">
            {term ? `Resultados para "${term}"` : 'Buscar productos'}
          </h1>
          <form action="/buscar" method="get" className="mt-8 flex max-w-xl gap-3">
            <input
              type="search"
              name="q"
              defaultValue={term}
              placeholder="Escribe el nombre de un producto..."
              className="field flex-1"
              maxLength={80}
            />
            <button type="submit" className="btn-dark btn-sm py-3">
              Buscar
            </button>
          </form>
        </div>
      </header>

      {term ? (
        <>
          <p className="container-site py-6 text-xs uppercase tracking-widest text-ink-muted">
            {products.length} {products.length === 1 ? 'resultado' : 'resultados'}
          </p>
          <ProductGrid
            products={await toCards(products)}
            emptyMessage={`No encontramos productos para "${term}".`}
          />
        </>
      ) : (
        <div className="container-site py-20 text-center text-ink-muted">
          Escribe arriba para buscar en el catalogo.
        </div>
      )}
    </>
  );
}
