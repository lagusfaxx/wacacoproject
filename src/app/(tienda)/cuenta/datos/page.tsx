import type { Metadata } from 'next';
import { AccountShell } from '@/components/account-shell';
import { ProfileForm } from '@/components/account-forms';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mis datos',
  robots: { index: false, follow: false },
};

export default async function AccountProfilePage() {
  const user = await requireUser('/cuenta/ingresar?next=/cuenta/datos');

  return (
    <AccountShell
      user={user}
      title="Mis datos"
      description="Con estos datos te identificamos en los pedidos y te avisamos si hay algo que resolver con un despacho."
    >
      <div className="max-w-xl">
        <ProfileForm name={user.name} phone={user.phone ?? ''} email={user.email} />
      </div>
    </AccountShell>
  );
}
