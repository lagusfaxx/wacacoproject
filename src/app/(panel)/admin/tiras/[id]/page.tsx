import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteProductStrip } from '@/app/actions/admin';
import { ProductStripForm } from '@/components/admin/product-strip-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Editar tira de productos' };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
};

export default async function EditStripPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const [{ id }, { creado }] = await Promise.all([params, searchParams]);

  const [strip, products] = await Promise.all([
    prisma.productStrip.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    }),
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, active: true },
    }),
  ]);
  if (!strip) notFound();

  return (
    <>
      <Link
        href="/admin/tiras"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a tiras
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        {strip.title}
      </h1>

      {creado ? (
        <p className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Tira creada correctamente.
        </p>
      ) : null}

      <div className="mt-8">
        <ProductStripForm
          products={products}
          values={{
            id: strip.id,
            title: strip.title,
            placement: strip.placement,
            position: strip.position,
            active: strip.active,
            productIds: strip.items.map((item) => item.productId),
          }}
        />
      </div>

      <section className="mt-10 border border-red-200 bg-red-50 p-6">
        <h2 className="font-display text-base font-bold uppercase tracking-tight text-red-800">
          Eliminar tira
        </h2>
        <p className="mt-2 text-sm text-red-700">
          Solo se borra la tira. Los productos que la componen no se tocan.
        </p>
        <form action={deleteProductStrip} className="mt-4">
          <input type="hidden" name="stripId" value={strip.id} />
          <button
            type="submit"
            className="btn bg-red-600 px-6 py-3 text-white transition-colors hover:bg-red-700"
          >
            Eliminar tira
          </button>
        </form>
      </section>
    </>
  );
}
