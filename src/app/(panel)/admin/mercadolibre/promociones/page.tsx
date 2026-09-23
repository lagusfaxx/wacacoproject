import type { Metadata } from 'next';
import { Empty, MlError, Panel, StatusBadge } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { listPromotions } from '@/lib/mercadolibre/read';
import { safeMl } from '@/lib/mercadolibre/safe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Promociones de Mercado Libre' };

const TYPES: Record<string, string> = {
  DEAL: 'Campana de Mercado Libre',
  MARKETPLACE_CAMPAIGN: 'Campana co-financiada',
  SELLER_CAMPAIGN: 'Campana propia',
  PRICE_DISCOUNT: 'Descuento propio',
  LIGHTNING: 'Oferta relampago',
  DOD: 'Oferta del dia',
  VOLUME: 'Descuento por volumen',
  SMART: 'Campana automatizada',
  PRICE_MATCHING: 'Precio competitivo',
  UNHEALTHY_STOCK: 'Liquidacion de stock',
  PRE_NEGOTIATED: 'Pre-negociada',
};

export default async function MlPromotionsPage() {
  await requireAdmin();
  const result = await safeMl(() => listPromotions());
  if (!result.ok) return <MlError error={result.error} notConnected={result.notConnected} />;
  const promotions = result.data.results ?? [];

  return (
    <div className="mt-8 space-y-4">
      <Panel title="Campanas disponibles y activas">
        {promotions.length === 0 ? (
          <Empty>No hay campanas para esta cuenta en este momento.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Campana</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  <th>Inscripcion hasta</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-semibold">{p.name || p.id}</span>
                      <span className="block font-mono text-xs text-ink-muted">{p.id}</span>
                    </td>
                    <td className="text-sm">{TYPES[p.type] ?? p.type}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="whitespace-nowrap text-xs">
                      {p.start_date?.slice(0, 10)} → {p.finish_date?.slice(0, 10)}
                    </td>
                    <td className="whitespace-nowrap text-xs">{p.deadline_date?.slice(0, 10) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="text-xs text-ink-muted">
        Para sumar una publicacion a una campana o crear un descuento propio, entra a la publicacion: ahi aparecen las
        campanas para las que es candidata, con el precio sugerido. Claude puede hacerlo tambien con las herramientas
        ml_sumar_a_promocion y ml_crear_descuento.
      </p>
    </div>
  );
}
