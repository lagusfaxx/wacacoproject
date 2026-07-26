import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth-forms';
import { getSessionPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: PageProps) {
  const session = await getSessionPayload();
  if (session) redirect('/cuenta');

  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;

  return (
    <div className="container-site max-w-md py-16">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
        Crear cuenta
      </h1>
      <p className="mb-8 mt-4 text-sm text-ink-muted">
        Guarda tus datos, sigue tus envios y compra mas rapido la proxima vez.
      </p>
      <RegisterForm next={safeNext} />
    </div>
  );
}
