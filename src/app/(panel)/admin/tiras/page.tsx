import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Tiras de productos' };

const PLACEMENT_LABEL: Record<string, string> = {
  destacado: 'Bajo "Mas vendidos"',
  inferior: 'Bajo "Colecciones"',
};

export default async function AdminStripsPage() {
  await requireAdmin();
  const strips = await prisma.productStrip.findMany({
    orderBy: { position: 'asc' },
    include: {
      items: {
        orderBy: { position: 'asc' },
        include: { product: { select: { name: true } } },
      },
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
            Tiras de productos
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Filas de productos que eliges tu, con el titulo que quieras. A
            diferencia de &quot;Mas vendidos&quot;, que se arma sola con los
            productos destacados, aqui mandas tu: decides que productos van y en
            que orden.
          </p>
        </div>
        <Link href="/admin/tiras/nueva" className="btn-primary btn-sm py-3">
          Nueva tira
        </Link>
      </div>

      {strips.length === 0 ? (
        <p className="mt-8 border border-dashed border-sand-dark bg-white px-6 py-14 text-center text-sm text-ink-muted">
          Todavia no hay tiras de productos. Crea una para mostrar en la portada
          los productos que tu elijas.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {strips.map((strip) => (
            <li key={strip.id} className="border border-sand-dark bg-white">
              <Link
                href={`/admin/tiras/${strip.id}`}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
              >
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold uppercase leading-none tracking-tight">
                    {strip.title}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-ink-muted">
                    {PLACEMENT_LABEL[strip.placement] ?? strip.placement}
                  </p>
                  <p className="mt-2 truncate text-sm text-ink-soft">
                    {strip.items.length === 0
                      ? 'Sin productos'
                      : strip.items.map((item) => item.product.name).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`badge ${
                      strip.active ? 'bg-emerald-100 text-emerald-800' : 'bg-sand-dark text-ink-soft'
                    }`}
                  >
                    {strip.active ? 'Visible' : 'Oculta'}
                  </span>
                  <span className="text-xs text-ink-muted">Orden {strip.position}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
