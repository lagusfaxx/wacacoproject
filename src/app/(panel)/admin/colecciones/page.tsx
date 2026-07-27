import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Colecciones' };

export default async function AdminCollectionsPage() {
  await requireAdmin();

  const collections = await prisma.collection.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          Colecciones
        </h1>
        <Link href="/admin/colecciones/nueva" className="btn-primary btn-sm py-3">
          Nueva coleccion
        </Link>
      </div>

      <div className="mt-6 border border-sand-dark bg-white">
        {collections.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-muted">
            Todavia no hay colecciones.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Coleccion</th>
                  <th className="text-right">Productos</th>
                  <th>SEO</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 bg-sand">
                          {collection.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={collection.image}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/colecciones/${collection.id}`}
                            className="block truncate font-semibold hover:text-brand"
                          >
                            {collection.name}
                          </Link>
                          <p className="text-xs text-ink-muted">/coleccion/{collection.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{collection._count.products}</td>
                    <td>
                      <span
                        className={`badge ${
                          collection.seoTitle || collection.seoDescription
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sand text-ink-muted'
                        }`}
                      >
                        {collection.seoTitle || collection.seoDescription
                          ? 'Personalizado'
                          : 'Automatico'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          collection.noIndex
                            ? 'bg-amber-100 text-amber-800'
                            : collection.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sand-dark text-ink-soft'
                        }`}
                      >
                        {collection.noIndex
                          ? 'Oculta en Google'
                          : collection.active
                            ? 'Activa'
                            : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
