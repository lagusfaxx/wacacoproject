import type { Metadata } from 'next';
import { MenuForm, type MenuRow } from '@/components/admin/menu-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Menu' };

export default async function AdminMenuPage() {
  await requireAdmin();

  const [items, collections] = await Promise.all([
    prisma.menuItem.findMany({ orderBy: { position: 'asc' } }),
    prisma.collection.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: { name: true, slug: true },
    }),
  ]);

  const rows: MenuRow[] = items.map((item) => ({
    label: item.label,
    href: item.href,
    active: item.active,
  }));

  const suggestions = [
    { label: 'Catalogo completo', href: '/products' },
    ...collections.map((collection) => ({
      label: collection.name,
      href: `/coleccion/${collection.slug}`,
    })),
    { label: 'Seguir mi pedido', href: '/seguimiento' },
    { label: 'Ayuda', href: '/ayuda' },
    { label: 'Mi cuenta', href: '/cuenta' },
  ];

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Menu
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Los enlaces que aparecen en la cabecera, junto al desplegable de
        productos. El desplegable con tus colecciones se arma solo.
      </p>

      <div className="mt-6">
        <MenuForm items={rows} suggestions={suggestions} />
      </div>
    </>
  );
}
