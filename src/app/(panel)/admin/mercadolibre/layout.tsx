import { MlNav } from '@/components/admin/ml/ml-nav';
import { requireAdmin } from '@/lib/auth';
import { getConnection } from '@/lib/mercadolibre/auth';

export const dynamic = 'force-dynamic';

export default async function MercadoLibreLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const connection = await getConnection();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
            Mercado Libre
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {connection
              ? `Cuenta conectada: ${connection.nickname}`
              : 'Sin cuenta conectada todavia.'}
          </p>
        </div>
      </div>
      <MlNav />
      {children}
    </>
  );
}
