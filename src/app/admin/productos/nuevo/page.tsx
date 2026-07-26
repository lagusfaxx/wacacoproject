import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductForm } from '@/components/admin/product-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Nuevo producto' };

export default async function NewProductPage() {
  await requireAdmin();
  const collections = await prisma.collection.findMany({
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <>
      <Link
        href="/admin/productos"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a productos
      </Link>
      <h1 className="mb-8 mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Nuevo producto
      </h1>

      <ProductForm
        collections={collections}
        currency={env.currency}
        values={{
          id: '',
          name: '',
          slug: '',
          subtitle: '',
          description: '',
          features: '',
          price: '',
          compareAtPrice: '',
          sku: '',
          stock: 0,
          weightGrams: 500,
          active: true,
          featured: false,
          isNew: false,
          award: '',
          position: 0,
          images: '',
          collectionIds: [],
        }}
      />
    </>
  );
}
