import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PasswordResetForm } from '@/components/verification-forms';
import { getSessionPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recuperar contrasena',
  robots: { index: false, follow: false },
};

export default async function PasswordResetPage() {
  const session = await getSessionPayload();
  if (session) redirect('/cuenta');

  return (
    <div className="container-site max-w-md py-16">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
        Recuperar contrasena
      </h1>
      <p className="mb-8 mt-4 text-sm text-ink-muted">
        Te enviamos un codigo de 6 digitos al correo de tu cuenta y con el defines una contrasena
        nueva.
      </p>
      <PasswordResetForm />
    </div>
  );
}
