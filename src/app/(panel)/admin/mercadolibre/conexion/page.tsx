import type { Metadata } from 'next';
import { deleteMcpClient, disconnectMercadoLibre, revokeMcpKey } from '@/app/actions/mercadolibre';
import { McpKeyForm } from '@/components/admin/ml/mcp-key-form';
import { Empty, Panel } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getConnection, mlConfigured, mlRedirectUri } from '@/lib/mercadolibre/auth';
import { mcpResourceUrl } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Conexion de Mercado Libre' };

type PageProps = { searchParams: Promise<{ ok?: string; error?: string }> };

const ERRORS: Record<string, string> = {
  config: 'Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en las variables de entorno.',
  denied: 'La autorizacion fue cancelada en Mercado Libre.',
  state: 'La vuelta desde Mercado Libre no se pudo verificar (sesion vencida). Intenta de nuevo.',
  token: 'Mercado Libre no entrego el acceso. Revisa que la URI de redireccion de la aplicacion sea exactamente la indicada abajo.',
};

const fecha = (d: Date | null) => (d ? d.toLocaleString('es-CL') : '—');

export default async function MlConnectionPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();

  const [connection, keys, clients, oauthTokens, activity, notifications] = await Promise.all([
    getConnection(),
    prisma.mcpToken.findMany({
      where: { kind: 'API_KEY', revokedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    }),
    prisma.mcpOAuthClient.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.mcpToken.findMany({
      where: { kind: 'REFRESH', revokedAt: null, expiresAt: { gt: now } },
      select: { clientId: true, scope: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ action: { startsWith: 'ml.' } }, { action: { startsWith: 'mcp.' } }] },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { user: { select: { email: true } } },
    }),
    prisma.mlNotification.findMany({ orderBy: { receivedAt: 'desc' }, take: 10 }),
  ]);

  const activeClients = clients
    .map((c) => ({ ...c, session: oauthTokens.find((t) => t.clientId === c.clientId) }))
    .filter((c) => c.session);

  return (
    <div className="mt-8 space-y-4">
      {sp.ok ? (
        <p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Cuenta de Mercado Libre conectada.</p>
      ) : null}
      {sp.error ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{ERRORS[sp.error] ?? 'No se pudo conectar.'}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cuenta de Mercado Libre">
          <div className="space-y-4 p-6 text-sm">
            {!mlConfigured() ? (
              <>
                <p>Para conectar, crea una aplicacion en el DevCenter de Mercado Libre y configura:</p>
                <Setup />
              </>
            ) : connection ? (
              <>
                <dl className="space-y-2">
                  <Row label="Cuenta" value={connection.nickname} />
                  <Row label="Id de vendedor" value={connection.mlUserId} />
                  <Row label="Sitio" value={connection.siteId} />
                  <Row label="Conectada por" value={connection.connectedBy ?? '—'} />
                  <Row label="Desde" value={fecha(connection.createdAt)} />
                  <Row label="Acceso renovado" value={fecha(connection.updatedAt)} />
                </dl>
                <div className="flex flex-wrap gap-3">
                  <form action="/api/mercadolibre/conectar" method="post">
                    <button type="submit" className="btn-ghost btn-sm">Reconectar</button>
                  </form>
                  <form action={disconnectMercadoLibre}>
                    <button type="submit" className="btn-ghost btn-sm text-red-700">Desconectar</button>
                  </form>
                </div>
                <p className="text-xs text-ink-muted">
                  Los tokens se guardan cifrados (AES-256-GCM) y se renuevan solos cada 6 horas.
                </p>
              </>
            ) : (
              <>
                <p>La aplicacion esta configurada. Conecta la cuenta de vendedor que usa la tienda:</p>
                <form action="/api/mercadolibre/conectar" method="post">
                  <button type="submit" className="btn-primary">Conectar Mercado Libre</button>
                </form>
                <details className="text-xs text-ink-muted">
                  <summary className="cursor-pointer">Datos de la aplicacion</summary>
                  <div className="mt-3"><Setup /></div>
                </details>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Conectar Claude (MCP)">
          <div className="space-y-4 p-6 text-sm">
            <p>
              Con este servidor MCP, Claude puede consultar el resumen, ventas, visitas, preguntas y promociones, y
              hacer cambios (precios, stock, pausar, responder, descuentos). Todo cambio queda en la bitacora de abajo.
            </p>
            <div>
              <p className="label">URL del servidor</p>
              <code className="block break-all border border-sand-dark bg-sand p-2 font-mono text-xs">{mcpResourceUrl()}</code>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-ink-soft">
              <li>
                <strong>claude.ai / app de Claude</strong>: Configuracion → Conectores → Agregar conector personalizado →
                pega la URL. Te traera a esta tienda a aprobar el acceso.
              </li>
              <li>
                <strong>Claude Code / Claude Desktop</strong>: crea una clave abajo y usa el comando que se muestra.
              </li>
            </ol>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Nueva clave de acceso">
          <div className="p-6">
            <McpKeyForm endpoint={mcpResourceUrl()} />
          </div>
        </Panel>

        <Panel title="Accesos activos">
          {keys.length === 0 && activeClients.length === 0 ? (
            <Empty>Claude todavia no tiene acceso.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Permiso</th>
                    <th>Ultimo uso</th>
                    <th>Vence</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <span className="font-semibold">{k.name}</span>
                        <span className="block font-mono text-xs text-ink-muted">{k.prefix}… · {k.user.email}</span>
                      </td>
                      <td className="text-xs">{k.scope.includes('ml:write') ? 'Lectura y cambios' : 'Solo lectura'}</td>
                      <td className="text-xs">{fecha(k.lastUsedAt)}</td>
                      <td className={`text-xs ${k.expiresAt && k.expiresAt < now ? 'text-red-700' : ''}`}>
                        {k.expiresAt ? fecha(k.expiresAt) : 'Nunca'}
                      </td>
                      <td>
                        <form action={revokeMcpKey}>
                          <input type="hidden" name="id" value={k.id} />
                          <button type="submit" className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-red-600">
                            Revocar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {activeClients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-semibold">{c.name}</span>
                        <span className="block text-xs text-ink-muted">OAuth · {c.redirectUris.map((u) => new URL(u).host).join(', ')}</span>
                      </td>
                      <td className="text-xs">{c.session?.scope.includes('ml:write') ? 'Lectura y cambios' : 'Solo lectura'}</td>
                      <td className="text-xs">{fecha(c.lastUsedAt)}</td>
                      <td className="text-xs">Se renueva sola</td>
                      <td>
                        <form action={deleteMcpClient}>
                          <input type="hidden" name="clientId" value={c.clientId} />
                          <button type="submit" className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-red-600">
                            Revocar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Bitacora">
          {activity.length === 0 ? (
            <Empty>Sin actividad todavia.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Accion</th>
                    <th>Recurso</th>
                    <th>Via</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => {
                    const meta = (a.metadata ?? {}) as { via?: string; client?: string };
                    return (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap text-xs">{fecha(a.createdAt)}</td>
                        <td className="font-mono text-xs">{a.action}</td>
                        <td className="font-mono text-xs">{a.entityId ?? '—'}</td>
                        <td className="text-xs">{meta.via === 'mcp' ? `Claude${meta.client ? ` (${meta.client})` : ''}` : meta.via ?? 'panel'}</td>
                        <td className="text-xs">{a.user?.email ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Avisos recibidos">
          {notifications.length === 0 ? (
            <Empty>Mercado Libre todavia no envio avisos.</Empty>
          ) : (
            <ul className="divide-y divide-sand-dark text-xs">
              {notifications.map((n) => (
                <li key={n.id} className="flex justify-between gap-3 px-6 py-3">
                  <span>
                    <span className="font-semibold">{n.topic}</span> <span className="font-mono text-ink-muted">{n.resource}</span>
                  </span>
                  <span className="whitespace-nowrap text-ink-muted">{fecha(n.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Setup() {
  return (
    <dl className="space-y-3 text-xs">
      <div>
        <dt className="label">URI de redireccion</dt>
        <dd><code className="break-all font-mono">{mlRedirectUri()}</code></dd>
      </div>
      <div>
        <dt className="label">URL de notificaciones</dt>
        <dd><code className="break-all font-mono">{env.appUrl}/api/mercadolibre/notificaciones</code></dd>
      </div>
      <div>
        <dt className="label">Topicos</dt>
        <dd>orders_v2, items, questions, shipments</dd>
      </div>
      <div>
        <dt className="label">Variables</dt>
        <dd>ML_CLIENT_ID y ML_CLIENT_SECRET (y opcional ML_ENCRYPTION_KEY)</dd>
      </div>
    </dl>
  );
}
