import type { Metadata } from 'next';
import { AccountShell } from '@/components/account-shell';
import { AddressForm } from '@/components/account-forms';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Direccion de envio',
  robots: { index: false, follow: false },
};

export default async function AccountAddressPage() {
  const user = await requireUser('/cuenta/ingresar?next=/cuenta/direccion');

  const address = await prisma.address.findFirst({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <AccountShell
      user={user}
      title="Direccion de envio"
      description="Es la direccion que aparece completada en el checkout. Siempre puedes cambiarla al momento de comprar."
    >
      <div className="max-w-2xl">
        <AddressForm
          defaults={{
            fullName: address?.fullName ?? user.name,
            phone: address?.phone ?? user.phone ?? '',
            line1: address?.line1 ?? '',
            line2: address?.line2 ?? '',
            city: address?.city ?? '',
            regionCode: address?.regionCode ?? '',
            postalCode: address?.postalCode ?? '',
            country: address?.country ?? 'CL',
          }}
        />
      </div>
    </AccountShell>
  );
}
