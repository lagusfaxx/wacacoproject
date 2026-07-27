import type { Metadata } from 'next';
import Link from 'next/link';
import { BannerForm } from '@/components/admin/banner-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toPlacement } from '@/lib/banner-style';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Nuevo banner' };

type PageProps = { searchParams: Promise<{ ubicacion?: string }> };

export default async function NewBannerPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { ubicacion } = await searchParams;
  const placement = toPlacement(ubicacion);
  // Se coloca al final de los banners de su misma ubicacion.
  const count = await prisma.banner.count({ where: { placement } });

  return (
    <>
      <Link
        href="/admin/banners"
        className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
      >
        Volver a banners
      </Link>
      <h1 className="mb-8 mt-4 font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Nuevo banner
      </h1>

      <BannerForm
        values={{
          id: '',
          placement,
          eyebrow: '',
          title: '',
          subtitle: '',
          subtitleBold: false,
          ctaLabel: 'Comprar ahora',
          ctaHref: '/products',
          image: '',
          video: '',
          imageMode: 'background',
          overlay: 'medium',
          background: '',
          position: count,
          active: true,
        }}
      />
    </>
  );
}
