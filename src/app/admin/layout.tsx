import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/admin/admin-nav';
import { WacacoMark } from '@/components/brand';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Panel Wacaco' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // La pagina de acceso al panel vive dentro de /admin, asi que aqui no se
  // fuerza la sesion: cada pagina protegida llama a `requireAdmin()`.
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  if (!isAdmin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-sand">
      <div className="border-b border-sand-dark bg-white">
        <div className="container-site flex h-16 items-center justify-between gap-6">
          <Link href="/admin" className="flex items-center gap-2.5 text-ink">
            <WacacoMark className="h-6 w-6" />
            <span className="font-display text-lg font-bold uppercase tracking-[0.12em]">
              Panel
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="hidden font-display text-xs font-semibold uppercase tracking-widest text-ink-soft hover:text-brand sm:inline"
            >
              Ver tienda
            </Link>
            <span className="hidden text-xs text-ink-muted md:inline">{user.email}</span>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn-ghost btn-sm">
                Salir
              </button>
            </form>
          </div>
        </div>
      </div>

      <AdminNav />

      <div className="container-site py-8">{children}</div>
    </div>
  );
}
