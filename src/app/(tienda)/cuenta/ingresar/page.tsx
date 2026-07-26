import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth-forms';
import { getSessionPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Iniciar sesion',
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await getSessionPayload();
  if (session) redirect('/cuenta');

  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;

  return (
    <div className="container-site max-w-md py-16">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
        Iniciar sesion
      </h1>
      <p className="mb-8 mt-4 text-sm text-ink-muted">
        Accede para ver tus pedidos y guardar tus direcciones de envio.
      </p>
      <LoginForm next={safeNext} />
    </div>
  );
}
