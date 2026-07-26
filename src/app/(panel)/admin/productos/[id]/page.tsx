import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteProduct } from '@/app/actions/admin';
import { ProductForm } from '@/components/admin/product-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Editar producto' };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
};

export default async function EditProductPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const [{ id }, { creado }] = await Promise.all([params, searchParams]);

  const [product, collections] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        collections: true,
        variants: { orderBy: { position: 'asc' } },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.collection.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } }),
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
          href={`/productos/${product.slug}`}
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

      {product.variants.length > 0 ? (
        <section className="mt-8 border border-sand-dark bg-white">
          <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
            Variantes
          </h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>SKU</th>
                  <th>Color</th>
                  <th className="text-right">Stock</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="font-semibold">{variant.name}</td>
                    <td className="font-mono text-xs">{variant.sku}</td>
                    <td>
                      {variant.colorHex ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{ backgroundColor: variant.colorHex }}
                          />
                          {variant.colorHex}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-right tabular-nums">{variant.stock}</td>
                    <td>
                      <span
                        className={`badge ${
                          variant.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sand-dark text-ink-soft'
                        }`}
                      >
                        {variant.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-sand-dark px-6 py-4 text-xs text-ink-muted">
            El stock de un producto con variantes se descuenta tanto de la variante elegida como del
            total del producto.
          </p>
        </section>
      ) : null}

      <div className="mt-8">
        <ProductForm
          collections={collections}
          currency={env.currency}
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
            stock: product.stock,
            weightGrams: product.weightGrams,
            lengthCm: product.lengthCm,
            widthCm: product.widthCm,
            heightCm: product.heightCm,
            active: product.active,
            featured: product.featured,
            isNew: product.isNew,
            award: product.award ?? '',
            position: product.position,
            images: product.images.map((image) => image.url).join('\n'),
            collectionIds: product.collections.map((entry) => entry.collectionId),
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
