import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Banners' };

export default async function AdminBannersPage() {
  await requireAdmin();
  const banners = await prisma.banner.findMany({ orderBy: { position: 'asc' } });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
            Banners
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Las diapositivas del carrusel de la portada. Si no hay ninguna activa,
            la portada arma el carrusel sola con tus productos destacados.
          </p>
        </div>
        <Link href="/admin/banners/nuevo" className="btn-primary btn-sm py-3">
          Nuevo banner
        </Link>
      </div>

      {banners.length === 0 ? (
        <p className="mt-6 border border-dashed border-sand-dark bg-white px-6 py-14 text-center text-sm text-ink-muted">
          Todavia no hay banners. La portada esta usando tus productos destacados.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {banners.map((banner) => (
            <li key={banner.id} className="border border-sand-dark bg-white">
              <Link href={`/admin/banners/${banner.id}`} className="flex flex-wrap items-stretch">
                <div
                  className="flex min-h-28 flex-1 items-center gap-4 px-6 py-4"
                  style={{ background: banner.background ?? '#1C1B1A' }}
                >
                  <div className="min-w-0 flex-1">
                    {banner.eyebrow ? (
                      <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-brand">
                        {banner.eyebrow}
                      </p>
                    ) : null}
                    <p className="truncate font-display text-2xl font-bold uppercase leading-none tracking-tight text-white">
                      {banner.title || 'Sin titular'}
                    </p>
                    {banner.subtitle ? (
                      <p className="mt-1 truncate text-xs text-white/70">{banner.subtitle}</p>
                    ) : null}
                  </div>
                  {banner.image ? (
                    <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-sand/95 p-2 sm:flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={banner.image} alt="" className="h-full w-full object-contain" />
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full items-center gap-3 border-t border-sand-dark px-6 py-3 sm:w-52 sm:border-l sm:border-t-0">
                  <span
                    className={`badge ${
                      banner.active ? 'bg-emerald-100 text-emerald-800' : 'bg-sand-dark text-ink-soft'
                    }`}
                  >
                    {banner.active ? 'Visible' : 'Oculto'}
                  </span>
                  <span className="text-xs text-ink-muted">Orden {banner.position}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
