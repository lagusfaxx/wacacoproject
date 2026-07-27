import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerifyEmailForm } from '@/components/verification-forms';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirmar correo',
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const user = await requireUser('/cuenta/ingresar?next=/cuenta/verificar');

  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/cuenta';

  // Confirmar dos veces no tiene sentido: quien ya lo hizo sigue su camino.
  if (user.emailVerified) redirect(safeNext);

  return (
    <div className="container-site max-w-md py-16">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
        Confirma tu correo
      </h1>
      <p className="mb-8 mt-4 text-sm text-ink-muted">
        Asi nos aseguramos de poder enviarte el comprobante de tus compras y los avisos de despacho
        a una direccion que lees.
      </p>
      <VerifyEmailForm email={user.email} next={safeNext} />
    </div>
  );
}
