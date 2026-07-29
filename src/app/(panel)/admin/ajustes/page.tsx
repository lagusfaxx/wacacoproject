import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandForm } from '@/components/admin/brand-form';
import { SettingsForm } from '@/components/admin/settings-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';
import { isBluexpressEnabled } from '@/lib/shipping';
import { getStoreSettings } from '@/lib/store-settings';
import { getTransferSettings } from '@/lib/bank-transfer';
import { TransferForm } from '@/components/admin/transfer-form';
import { getPickupSettings } from '@/lib/pickup';
import { PickupForm } from '@/components/admin/pickup-form';
import { getSocialSettings } from '@/lib/social';
import { SocialForm } from '@/components/admin/social-form';
import { getStorePolicies } from '@/lib/store-policies';
import { PoliciesForm } from '@/components/admin/policies-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [store, transfer, pickup, social, policies, settings, recentLogs, recentEmails] =
    await Promise.all([
    getStoreSettings(),
    getTransferSettings(),
    getPickupSettings(),
    getSocialSettings(),
    getStorePolicies(),
    prisma.setting.findMany(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true } } },
    }),
    prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const bluexReady = isBluexpressEnabled();
  const webhookUrl = `${env.appUrl}/api/webhooks/mercadopago`;

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Ajustes
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel title="Tienda">
            <SettingsForm
              storeName={store.name}
              storeEmail={store.email}
              announcement={store.announcement ?? ''}
              marquee={store.marquee.join('\n')}
              heroHeadline={store.heroHeadline ?? ''}
              metaDescription={store.metaDescription}
              brand={store.brand ?? ''}
              seoTitle={store.seoTitle ?? ''}
              seoHeading={store.seoHeading ?? ''}
              seoText={store.seoText ?? ''}
            />
          </Panel>

          <Panel title="WhatsApp e Instagram">
            <SocialForm values={social} />
          </Panel>

          <Panel title="Marca">
            <BrandForm
              logoUrl={store.logoUrl}
              secondaryLogoUrl={store.secondaryLogoUrl}
              secondaryLogoAlt={store.secondaryLogoAlt}
              faviconUrl={store.faviconUrl}
              paymentLogoUrl={store.paymentLogoUrl}
              storeName={store.name}
            />
          </Panel>
        </div>

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

          <Panel title="Transferencia bancaria">
            <TransferForm values={transfer} />
          </Panel>

          <Panel title="Retiro en tienda">
            <PickupForm values={pickup} />
          </Panel>

          <Panel title="Correo (Resend)">
            <dl className="space-y-3 text-sm">
              <Row
                label="Envio de correos"
                value={env.emailEnabled ? 'Activo' : 'Sin configurar'}
                badge={env.emailEnabled ? 'ok' : 'warn'}
              />
              <Row label="Remitente" value={env.emailFrom || 'Falta EMAIL_FROM'} />
              <Row label="Responder a" value={env.emailReplyTo || store.email} />
            </dl>

            <p className="mt-4 text-xs text-ink-muted">
              {env.emailEnabled
                ? 'La tienda envia el aviso de pedido recibido, el comprobante al acreditarse el pago, los cambios de estado y los codigos de confirmacion y de recuperacion de contrasena.'
                : 'Sin RESEND_API_KEY y EMAIL_FROM la tienda funciona igual pero no envia ningun correo: cada intento queda anotado abajo como omitido. El remitente debe ser de un dominio verificado en Resend.'}
            </p>

            <div className="mt-5 border-t border-sand-dark pt-5">
              <p className="label">Ultimos correos</p>
              {recentEmails.length === 0 ? (
                <p className="mt-2 text-xs text-ink-muted">Todavia no se ha enviado ninguno.</p>
              ) : (
                <ul className="mt-2 divide-y divide-sand-dark">
                  {recentEmails.map((email) => (
                    <li key={email.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{email.subject}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {email.to} · {email.type}
                        </p>
                        {email.error ? (
                          <p className="mt-0.5 text-xs text-red-700">{email.error}</p>
                        ) : null}
                      </div>
                      <span
                        className={`badge shrink-0 ${
                          email.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : email.status === 'SKIPPED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {email.status === 'SENT'
                          ? 'Enviado'
                          : email.status === 'SKIPPED'
                            ? 'Omitido'
                            : 'Fallo'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel title="Envios">
            <dl className="space-y-3 text-sm">
              <Row
                label="Cotizador Blue Express"
                value={bluexReady ? 'Activo' : 'Sin configurar'}
                badge={bluexReady ? 'ok' : 'warn'}
              />
              <Row
                label="Comuna de origen"
                value={process.env.BLUEX_ORIGIN_DISTRICT || 'Sin definir'}
              />
              <Row label="Servicios cotizados" value={process.env.BLUEX_SERVICE_TYPES || 'EX'} />
              <Row
                label="Envio gratis desde"
                value={
                  env.freeShippingThreshold > 0
                    ? formatMoney(env.freeShippingThreshold)
                    : 'Desactivado'
                }
              />
              <Row label="Tarifa de respaldo" value={formatMoney(env.shippingFlatRate)} />
              <Row label="Impuesto sobre el subtotal" value={`${env.taxRate}%`} />
            </dl>
            <p className="mt-4 text-xs text-ink-muted">
              {bluexReady
                ? 'El costo se cotiza en tiempo real con Blue Express segun la comuna, el peso y las medidas de cada producto. Si la API no responde se aplica tu tarifa por region.'
                : 'Blue Express es opcional. Sin el, el costo sale de las tarifas por region que definas tu.'}
            </p>
            <Link href="/admin/envios" className="btn-ghost btn-sm mt-4">
              Editar tarifas por region
            </Link>
          </Panel>

          <Panel title="Plazos de entrega y devolucion">
            <PoliciesForm values={policies} />
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
