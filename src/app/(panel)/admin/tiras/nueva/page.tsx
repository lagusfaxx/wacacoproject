import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductStripForm } from '@/components/admin/product-strip-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Nueva tira de productos' };

export default async function NewStripPage() {
  await requireAdmin();

  const [products, count] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, active: true },
    }),
    prisma.productStrip.count(),
  ]);

  return (
    <>
      <Link
        href="/admin/tiras"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a tiras
      </Link>
      <h1 className="mb-8 mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Nueva tira de productos
      </h1>

      <ProductStripForm
        products={products}
        values={{
          id: '',
          title: '',
          placement: 'destacado',
          position: count,
          active: true,
          productIds: [],
        }}
      />
    </>
  );
}
