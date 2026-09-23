import type { Metadata } from 'next';
import { approveMcpAccess, denyMcpAccess } from '@/app/actions/mercadolibre';
import { requireAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { findClient, mcpResourceUrl, normalizeScope, redirectUriAllowed, SCOPE_WRITE } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Autorizar acceso de Claude',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

/**
 * Pantalla de aprobacion OAuth: aqui un administrador decide si Claude (u otro
 * cliente MCP) puede operar la cuenta de Mercado Libre.
 *
 * Mientras el cliente o el destino no sean validos no se redirige a ninguna
 * parte: devolver un error a un destino no verificado seria un redirector
 * abierto.
 */
export default async function AuthorizeMcpPage({ searchParams }: PageProps) {
  const user = await requireAdmin();
  const q = await searchParams;

  const client = q.client_id ? await findClient(q.client_id) : null;
  const redirectUri = q.redirect_uri ?? '';
  const redirectOk = client?.redirectUris.includes(redirectUri) && redirectUriAllowed(redirectUri);

  const problems: string[] = [];
  if (!client) problems.push('La aplicacion que pide acceso no esta registrada.');
  else if (!redirectOk) problems.push('La direccion de vuelta no coincide con la registrada o no esta permitida.');
  if (q.response_type !== 'code') problems.push('Tipo de respuesta no soportado.');
  if (q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(q.code_challenge ?? '')) {
    problems.push('Falta el desafio PKCE (S256).');
  }
  if (q.resource && q.resource !== mcpResourceUrl() && q.resource !== env.appUrl) {
    problems.push('El recurso pedido no corresponde a este servidor.');
  }

  if (problems.length > 0 || !client) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">Solicitud invalida</h1>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-700">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-muted">Vuelve a agregar el conector desde Claude.</p>
      </Shell>
    );
  }

  const scope = normalizeScope(q.scope);
  const wantsWrite = scope.split(' ').includes(SCOPE_WRITE);
  const destino = new URL(redirectUri).host;

  const hidden = (
    <>
      <input type="hidden" name="client_id" value={client.clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="code_challenge" value={q.code_challenge} />
      <input type="hidden" name="state" value={q.state ?? ''} />
      <input type="hidden" name="scope" value={scope} />
    </>
  );

  return (
    <Shell>
      <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-ink-muted">
        Acceso a Mercado Libre
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight">
        {client.name} quiere conectarse
      </h1>

      <dl className="mt-6 space-y-3 border border-sand-dark p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Aplicacion</dt>
          <dd className="font-semibold">{client.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Volvera a</dt>
          <dd className="font-mono font-semibold">{destino}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Como</dt>
          <dd className="font-semibold">{user.email}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-ink-soft">
        Podra ver ventas, publicaciones, visitas, preguntas y promociones de la cuenta de Mercado Libre de{' '}
        {env.storeName}. Solo apruebalo si tu mismo estas agregando el conector ahora.
      </p>

      <form action={approveMcpAccess} className="mt-6 space-y-5">
        {hidden}
        {wantsWrite ? (
          <label className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-4 text-sm">
            <input type="checkbox" name="allow_write" defaultChecked className="mt-0.5 h-4 w-4 accent-[#E1580E]" />
            <span>
              <strong>Permitir cambios</strong>: precios, stock, pausar/activar publicaciones, responder
              preguntas y promociones. Cada cambio queda en la bitacora. Desmarcalo para dar solo lectura.
            </span>
          </label>
        ) : null}
        <button type="submit" className="btn-primary w-full">
          Autorizar
        </button>
      </form>
      <form action={denyMcpAccess} className="mt-3">
        {hidden}
        <button type="submit" className="btn-ghost w-full">
          Cancelar
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg border border-sand-dark bg-white p-8">{children}</div>
  );
}
