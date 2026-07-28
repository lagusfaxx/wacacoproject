import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OVERLAY_CLASS, toImageMode, toOverlay, toPlacement } from '@/lib/banner-style';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Banners' };

type BannerRow = Awaited<ReturnType<typeof prisma.banner.findMany>>[number];

export default async function AdminBannersPage() {
  await requireAdmin();
  const banners = await prisma.banner.findMany({ orderBy: { position: 'asc' } });

  const heroBanners = banners.filter((banner) => toPlacement(banner.placement) === 'hero');
  const featureBanners = banners.filter((banner) => toPlacement(banner.placement) === 'destacado');
  const bottomBanners = banners.filter((banner) => toPlacement(banner.placement) === 'inferior');

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          Banners
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Las piezas graficas de la portada. Cada banner elige donde aparece: el
          carrusel de arriba o alguna de las franjas anchas que bajan por la
          portada. En cada franja puedes poner los que quieras: se apilan segun
          su orden.
        </p>
      </div>

      <BannerGroup
        title="Carrusel principal"
        description="Primera pantalla de la portada. Si no hay ninguno activo, el carrusel se arma solo con tus productos destacados."
        newHref="/admin/banners/nuevo"
        emptyText="Todavia no hay banners en el carrusel. La portada esta usando tus productos destacados."
        banners={heroBanners}
      />

      <BannerGroup
        title='Franja bajo "Mas vendidos"'
        description='Bandas anchas en medio de la portada. Si pones varias se apilan una tras otra por orden; si no hay ninguna activa, la franja usa el producto marcado como "Nuevo".'
        newHref="/admin/banners/nuevo?ubicacion=destacado"
        emptyText='Todavia no hay banner para esta franja. La portada esta usando el producto marcado como "Nuevo".'
        banners={featureBanners}
      />

      <BannerGroup
        title='Franja bajo "Colecciones"'
        description="Mas abajo en la portada, tras la tira de colecciones y antes de los beneficios. Si pones varias se apilan por orden. Si no hay ninguna, esa parte simplemente no aparece."
        newHref="/admin/banners/nuevo?ubicacion=inferior"
        emptyText="Todavia no hay banners en esta parte de la portada."
        banners={bottomBanners}
      />
    </>
  );
}

function BannerGroup({
  title,
  description,
  newHref,
  emptyText,
  banners,
}: {
  title: string;
  description: string;
  newHref: string;
  emptyText: string;
  banners: BannerRow[];
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold uppercase leading-none tracking-tight">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">{description}</p>
        </div>
        <Link href={newHref} className="btn-primary btn-sm py-3">
          Nuevo banner
        </Link>
      </div>

      {banners.length === 0 ? (
        <p className="mt-6 border border-dashed border-sand-dark bg-white px-6 py-14 text-center text-sm text-ink-muted">
          {emptyText}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {banners.map((banner) => (
            <li key={banner.id} className="border border-sand-dark bg-white">
              <Link href={`/admin/banners/${banner.id}`} className="flex flex-wrap items-stretch">
                <div
                  className="relative flex min-h-28 flex-1 items-center gap-4 overflow-hidden px-6 py-4"
                  style={{ background: banner.background ?? '#1C1B1A' }}
                >
                  {banner.image && toImageMode(banner.imageMode) === 'background' ? (
                    <div className="absolute inset-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={banner.image}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                      <div
                        className={`absolute inset-0 ${OVERLAY_CLASS[toOverlay(banner.overlay)]}`}
                      />
                    </div>
                  ) : null}
                  <div className="relative z-10 min-w-0 flex-1">
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
                  {/* Cualquier modo que no sea fondo completo deja la foto a un
                      costado: en la fila del listado se resume con la misma
                      miniatura. */}
                  {banner.image && toImageMode(banner.imageMode) !== 'background' ? (
                    <div className="relative z-10 hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-sand/95 p-2 sm:flex">
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
                  {banner.video ? (
                    <span className="badge bg-ink text-white">Video</span>
                  ) : null}
                  <span className="text-xs text-ink-muted">Orden {banner.position}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
