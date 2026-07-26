import type { Metadata } from 'next';
import { SettingsForm } from '@/components/admin/settings-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [settings, recentLogs] = await Promise.all([
    prisma.setting.findMany(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const webhookUrl = `${env.appUrl}/api/webhooks/mercadopago`;

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Ajustes
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Tienda">
          <SettingsForm
            storeName={settingsMap.get('store.name') ?? env.storeName}
            storeEmail={settingsMap.get('store.email') ?? env.storeEmail}
            announcement={settingsMap.get('store.announcement') ?? ''}
          />
        </Panel>

        <div className="space-y-6">
          <Panel title="Mercado Pago">
            <dl className="space-y-3 text-sm">
              <Row
                label="Modo"
                value={env.mpSandbox ? 'Sandbox (pruebas)' : 'Produccion'}
                badge={env.mpSandbox ? 'warn' : 'ok'}
              />
              <Row
                label="Access token"
                value={env.mpAccessToken ? 'Configurado' : 'Falta configurar'}
                badge={env.mpAccessToken ? 'ok' : 'error'}
              />
              <Row
                label="Clave secreta del webhook"
                value={env.mpWebhookSecret ? 'Configurada' : 'Falta configurar'}
                badge={env.mpWebhookSecret ? 'ok' : 'error'}
              />
              <Row label="Moneda" value={env.currency} />
            </dl>

            <div className="mt-5 border-t border-sand-dark pt-5">
              <p className="label">URL de notificaciones (webhook)</p>
              <code className="mt-1 block break-all bg-sand px-3 py-2 text-xs">{webhookUrl}</code>
              <p className="mt-2 text-xs text-ink-muted">
                Pega esta URL en el panel de Mercado Pago, en Webhooks, y suscribe el evento
                &quot;Pagos&quot;. Copia la clave secreta que se genera ahi en la variable
                MP_WEBHOOK_SECRET.
              </p>
            </div>
          </Panel>

          <Panel title="Envios e impuestos">
            <dl className="space-y-3 text-sm">
              <Row
                label="Envio gratis desde"
                value={
                  env.freeShippingThreshold > 0
                    ? formatMoney(env.freeShippingThreshold)
                    : 'Desactivado'
                }
              />
              <Row label="Costo de envio" value={formatMoney(env.shippingFlatRate)} />
              <Row label="Impuesto sobre el subtotal" value={`${env.taxRate}%`} />
            </dl>
            <p className="mt-4 text-xs text-ink-muted">
              Estos valores se configuran con las variables de entorno
              FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_RATE y TAX_RATE.
            </p>
          </Panel>
        </div>
      </div>

      <section className="mt-6 border border-sand-dark bg-white">
        <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
          Actividad reciente
        </h2>
        {recentLogs.length === 0 ? (
          <p className="px-6 py-10 text-sm text-ink-muted">Sin actividad registrada.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Accion</th>
                  <th>Entidad</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs">{log.action}</td>
                    <td className="text-xs">
                      {log.entity}
                      {log.entityId ? (
                        <span className="text-ink-muted"> · {log.entityId.slice(0, 12)}</span>
                      ) : null}
                    </td>
                    <td className="text-xs text-ink-muted">{log.user?.email ?? 'sistema'}</td>
                    <td className="text-xs text-ink-muted">
                      {new Intl.DateTimeFormat('es-CL', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-sand-dark bg-white">
      <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
        {title}
      </h2>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: 'ok' | 'warn' | 'error';
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd>
        {badge ? (
          <span
            className={`badge ${
              badge === 'ok'
                ? 'bg-emerald-100 text-emerald-800'
                : badge === 'warn'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {value}
          </span>
        ) : (
          <span className="font-semibold">{value}</span>
        )}
      </dd>
    </div>
  );
}
