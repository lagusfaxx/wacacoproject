import type { Metadata } from 'next';
import { AccountShell } from '@/components/account-shell';
import { PasswordForm } from '@/components/account-forms';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seguridad',
  robots: { index: false, follow: false },
};

export default async function AccountSecurityPage() {
  const user = await requireUser('/cuenta/ingresar?next=/cuenta/seguridad');

  return (
    <AccountShell
      user={user}
      title="Seguridad"
      description="Cambia tu contrasena cuando quieras. Si la olvidaste, cierra sesion y usa la opcion de recuperarla por correo."
    >
      <div className="max-w-xl">
        <PasswordForm />
      </div>
    </AccountShell>
  );
}
