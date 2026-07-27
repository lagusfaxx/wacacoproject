import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteCollection } from '@/app/actions/admin';
import { CollectionForm } from '@/components/admin/collection-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Editar coleccion' };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string }>;
};

export default async function EditCollectionPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const [{ id }, { creada }] = await Promise.all([params, searchParams]);

  const [collection, store] = await Promise.all([
    prisma.collection.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    }),
    getStoreSettings(),
  ]);

  if (!collection) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/colecciones"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
        >
          Volver a colecciones
        </Link>
        <Link
          href={`/coleccion/${collection.slug}`}
          target="_blank"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
        >
          Ver en la tienda
        </Link>
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        {collection.name}
      </h1>

      {creada ? (
        <p className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Coleccion creada correctamente.
        </p>
      ) : null}

      <div className="mt-8">
        <CollectionForm
          siteUrl={env.appUrl}
          storeName={store.name}
          values={{
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
            tagline: collection.tagline ?? '',
            description: collection.description ?? '',
            image: collection.image ?? '',
            position: collection.position,
            active: collection.active,
            seoTitle: collection.seoTitle ?? '',
            seoDescription: collection.seoDescription ?? '',
            seoImage: collection.seoImage ?? '',
            noIndex: collection.noIndex,
          }}
        />
      </div>

      <section className="mt-10 border border-red-200 bg-red-50 p-6">
        <h2 className="font-display text-base font-bold uppercase tracking-tight text-red-800">
          Eliminar coleccion
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-red-700">
          Se eliminara la agrupacion y su URL dejara de funcionar. Los{' '}
          {collection._count.products} productos asociados no se borran: quedan
          sin esta coleccion.
        </p>
        <form action={deleteCollection} className="mt-5">
          <input type="hidden" name="collectionId" value={collection.id} />
          <button
            type="submit"
            className="btn bg-red-600 px-6 py-3 text-white transition-colors hover:bg-red-700"
          >
            Eliminar coleccion
          </button>
        </form>
      </section>
    </>
  );
}
