import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteBanner } from '@/app/actions/admin';
import { BannerForm } from '@/components/admin/banner-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Editar banner' };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
};

export default async function EditBannerPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const [{ id }, { creado }] = await Promise.all([params, searchParams]);

  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) notFound();

  return (
    <>
      <Link
        href="/admin/banners"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a banners
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        {banner.title || 'Banner sin titular'}
      </h1>

      {creado ? (
        <p className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Banner creado correctamente.
        </p>
      ) : null}

      <div className="mt-8">
        <BannerForm
          values={{
            id: banner.id,
            placement: banner.placement,
            eyebrow: banner.eyebrow ?? '',
            title: banner.title ?? '',
            subtitle: banner.subtitle ?? '',
            subtitleBold: banner.subtitleBold,
            ctaLabel: banner.ctaLabel ?? '',
            ctaHref: banner.ctaHref ?? '',
            image: banner.image ?? '',
            video: banner.video ?? '',
            imageMode: banner.imageMode,
            overlay: banner.overlay,
            background: banner.background ?? '',
            position: banner.position,
            active: banner.active,
          }}
        />
      </div>

      <section className="mt-10 border border-red-200 bg-red-50 p-6">
        <h2 className="font-display text-base font-bold uppercase tracking-tight text-red-800">
          Eliminar banner
        </h2>
        <form action={deleteBanner} className="mt-4">
          <input type="hidden" name="bannerId" value={banner.id} />
          <button
            type="submit"
            className="btn bg-red-600 px-6 py-3 text-white transition-colors hover:bg-red-700"
          >
            Eliminar banner
          </button>
        </form>
      </section>
    </>
  );
}
