import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth-forms';
import { WacacoMark } from '@/components/brand';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acceso al panel',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.role === 'ADMIN') redirect('/admin');

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-16">
      <div className="w-full max-w-md bg-white p-10">
        <div className="mb-8 flex items-center gap-2.5">
          <WacacoMark className="h-7 w-7" />
          <span className="font-display text-xl font-bold uppercase tracking-[0.12em]">
            Panel de administracion
          </span>
        </div>

        <p className="mb-8 text-sm text-ink-muted">
          Ingresa con tu cuenta de administrador para gestionar productos, pedidos y clientes.
        </p>

        <LoginForm next="/admin" isAdmin />
      </div>
    </div>
  );
}
