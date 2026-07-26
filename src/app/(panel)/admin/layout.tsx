import Link from 'next/link';
import { AdminNav } from '@/components/admin/admin-nav';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // La pagina de acceso al panel vive dentro de /admin, asi que aqui no se
  // fuerza la sesion: cada pagina protegida llama a `requireAdmin()`.
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  // La pagina de acceso se renderiza sola, sin la barra del panel.
  if (!isAdmin) return <>{children}</>;

  return (
    <div>
      <div className="border-b border-sand-dark bg-white">
        <div className="container-site flex h-16 items-center justify-between gap-6">
          <Link href="/admin" className="flex items-center gap-2.5 text-ink">
            <span className="h-6 w-1.5 bg-brand" aria-hidden="true" />
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
