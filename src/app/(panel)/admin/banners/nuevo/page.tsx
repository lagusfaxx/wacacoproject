import type { Metadata } from 'next';
import Link from 'next/link';
import { BannerForm } from '@/components/admin/banner-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Nuevo banner' };

export default async function NewBannerPage() {
  await requireAdmin();
  // Se coloca al final del carrusel por defecto.
  const count = await prisma.banner.count();

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
          eyebrow: '',
          title: '',
          subtitle: '',
          ctaLabel: 'Comprar ahora',
          ctaHref: '/productos',
          image: '',
          background: '',
          position: count,
          active: true,
        }}
      />
    </>
  );
}
