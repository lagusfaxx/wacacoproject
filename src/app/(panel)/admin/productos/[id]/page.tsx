import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteProduct } from '@/app/actions/admin';
import { ProductForm } from '@/components/admin/product-form';
import { requireAdmin } from '@/lib/auth';
import { toBlockData } from '@/lib/catalog';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Editar producto' };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
};

export default async function EditProductPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const [{ id }, { creado }] = await Promise.all([params, searchParams]);

  const [product, collections, store] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        collections: true,
        variants: { orderBy: { position: 'asc' } },
        blocks: { orderBy: { position: 'asc' } },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.collection.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } }),
    getStoreSettings(),
  ]);

  if (!product) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/productos"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
        >
          Volver a productos
        </Link>
        <Link
          href={`/products/${product.slug}`}
          target="_blank"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
        >
          Ver en la tienda
        </Link>
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        {product.name}
      </h1>

      {creado ? (
        <p className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Producto creado correctamente.
        </p>
      ) : null}

      <div className="mt-8">
        <ProductForm
          collections={collections}
          currency={env.currency}
          siteUrl={env.appUrl}
          storeName={store.name}
          values={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            subtitle: product.subtitle ?? '',
            description: product.description,
            features: product.features.join('\n'),
            price: product.price.toString(),
            compareAtPrice: product.compareAtPrice?.toString() ?? '',
            sku: product.sku,
            gtin: product.gtin ?? '',
            brand: product.brand ?? '',
            stock: product.stock,
            weightGrams: product.weightGrams,
            lengthCm: product.lengthCm,
            widthCm: product.widthCm,
            heightCm: product.heightCm,
            active: product.active,
            featured: product.featured,
            isNew: product.isNew,
            incoming: product.incoming,
            award: product.award ?? '',
            position: product.position,
            images: product.images.map((image) => image.url),
            variants: product.variants.map((variant) => ({
              id: variant.id,
              name: variant.name,
              colorHex: variant.colorHex ?? '',
              sku: variant.sku,
              priceDelta: variant.priceDelta.toString(),
              stock: String(variant.stock),
              active: variant.active,
            })),
            blocks: toBlockData(product.blocks),
            collectionIds: product.collections.map((entry) => entry.collectionId),
            seoTitle: product.seoTitle ?? '',
            seoDescription: product.seoDescription ?? '',
            seoImage: product.seoImage ?? '',
            noIndex: product.noIndex,
          }}
        />
      </div>

      <section className="mt-10 border border-red-200 bg-red-50 p-6">
        <h2 className="font-display text-base font-bold uppercase tracking-tight text-red-800">
          Zona de riesgo
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-red-700">
          {product._count.orderItems > 0
            ? `Este producto aparece en ${product._count.orderItems} lineas de pedido, por lo que no se elimina: se archivara desactivandolo para conservar el historial.`
            : 'Este producto no tiene ventas registradas y se eliminara definitivamente.'}
        </p>
        <form action={deleteProduct} className="mt-5">
          <input type="hidden" name="productId" value={product.id} />
          <button
            type="submit"
            className="btn bg-red-600 px-6 py-3 text-white transition-colors hover:bg-red-700"
          >
            {product._count.orderItems > 0 ? 'Archivar producto' : 'Eliminar producto'}
          </button>
        </form>
      </section>
    </>
  );
}
