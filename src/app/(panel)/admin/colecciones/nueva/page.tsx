import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectionForm } from '@/components/admin/collection-form';
import { requireAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Nueva coleccion' };

export default async function NewCollectionPage() {
  await requireAdmin();
  const store = await getStoreSettings();

  return (
    <>
      <Link
        href="/admin/colecciones"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a colecciones
      </Link>
      <h1 className="mb-8 mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Nueva coleccion
      </h1>

      <CollectionForm
        siteUrl={env.appUrl}
        storeName={store.name}
        values={{
          id: '',
          name: '',
          slug: '',
          tagline: '',
          description: '',
          image: '',
          position: 0,
          active: true,
          seoTitle: '',
          seoDescription: '',
          seoImage: '',
          noIndex: false,
        }}
      />
    </>
  );
}
