'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { getCurrentUser, writeAuditLog } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { disconnect } from '@/lib/mercadolibre/auth';
import { invalidateCache, MlApiError } from '@/lib/mercadolibre/client';
import { MlGuardError } from '@/lib/mercadolibre/write';
import { MlNotConnectedError } from '@/lib/mercadolibre/auth';
import {
  createApiKey,
  createAuthCode,
  findClient,
  normalizeScope,
  redirectUriAllowed,
  revokeToken,
  SCOPE_READ,
} from '@/lib/mcp/auth';
import { toJsonSchema } from '@/lib/mcp/json-schema';
import { findTool } from '@/lib/mcp/tools';

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') throw new Error('No autorizado.');
  return user;
}

export type MlActionState = { status: 'idle' | 'ok' | 'error'; message: string };

// ---------------------------------------------------------------------------
// Operaciones sobre Mercado Libre desde el panel
// ---------------------------------------------------------------------------

/**
 * Ejecuta una herramienta de escritura con los datos de un formulario.
 *
 * El panel usa exactamente las mismas herramientas que Claude: el campo `op`
 * es el nombre de la herramienta y el resto son sus argumentos. Asi la
 * validacion y las protecciones (tope de cambio de precio, confirmacion al
 * finalizar, bitacora) son una sola y no pueden divergir.
 */
export async function runMlOperation(_prev: MlActionState, formData: FormData): Promise<MlActionState> {
  const user = await assertAdmin();
  const tool = findTool(String(formData.get('op') ?? ''));
  if (!tool || !tool.write) return { status: 'error', message: 'Operacion desconocida.' };

  const schema = toJsonSchema(tool.input) as { properties: Record<string, { type?: string }> };
  const args: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema.properties)) {
    const raw = formData.get(key);
    if (def.type === 'boolean') {
      args[key] = raw === 'on' || raw === 'true';
      continue;
    }
    if (raw === null || String(raw).trim() === '') continue;
    args[key] = def.type === 'number' || def.type === 'integer' ? Number(raw) : String(raw);
  }

  try {
    await tool.run(tool.input.parse(args), { userId: user.id, via: 'panel' });
    revalidatePath('/admin/mercadolibre', 'layout');
    return { status: 'ok', message: 'Cambio aplicado en Mercado Libre.' };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 'error', message: error.issues.map((i) => i.message).join(' ') };
    }
    if (error instanceof MlGuardError || error instanceof MlNotConnectedError) {
      return { status: 'error', message: error.message };
    }
    if (error instanceof MlApiError) {
      return { status: 'error', message: `Mercado Libre: ${error.message}` };
    }
    console.error('[mercadolibre] error en operacion', tool.name, error);
    return { status: 'error', message: 'No se pudo aplicar el cambio. Intenta de nuevo.' };
  }
}

export async function disconnectMercadoLibre(): Promise<void> {
  const user = await assertAdmin();
  await disconnect();
  invalidateCache('ml:');
  await writeAuditLog({ userId: user.id, action: 'ml.disconnect', entity: 'MercadoLibre', metadata: { via: 'panel' } });
  revalidatePath('/admin/mercadolibre', 'layout');
}

export async function refreshMercadoLibre(): Promise<void> {
  await assertAdmin();
  invalidateCache('ml:');
  revalidatePath('/admin/mercadolibre', 'layout');
}

// ---------------------------------------------------------------------------
// Acceso de Claude (MCP)
// ---------------------------------------------------------------------------

export type McpKeyState = MlActionState & { token?: string };

export async function createMcpKey(_prev: McpKeyState, formData: FormData): Promise<McpKeyState> {
  const user = await assertAdmin();
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  if (name.length < 2) return { status: 'error', message: 'Ponle un nombre a la clave (ej. "Claude Code").' };

  const days = Number(formData.get('expiresInDays') ?? 0);
  const { token, row } = await createApiKey({
    userId: user.id,
    name,
    write: formData.get('write') === 'on',
    expiresInDays: [30, 90, 365].includes(days) ? days : null,
  });
  await writeAuditLog({
    userId: user.id,
    action: 'mcp.key.create',
    entity: 'McpToken',
    entityId: row.id,
    metadata: { name, scope: row.scope },
  });
  revalidatePath('/admin/mercadolibre/conexion');
  return { status: 'ok', message: 'Clave creada. Copiala ahora: no se vuelve a mostrar.', token };
}

export async function revokeMcpKey(formData: FormData): Promise<void> {
  const user = await assertAdmin();
  const id = String(formData.get('id') ?? '');
  await revokeToken(id);
  await writeAuditLog({ userId: user.id, action: 'mcp.key.revoke', entity: 'McpToken', entityId: id });
  revalidatePath('/admin/mercadolibre/conexion');
}

/** Datos de una solicitud OAuth, revalidados en cada paso. */
async function readAuthorizeRequest(formData: FormData) {
  const clientId = String(formData.get('client_id') ?? '');
  const redirectUri = String(formData.get('redirect_uri') ?? '');
  const client = await findClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri) || !redirectUriAllowed(redirectUri)) {
    throw new Error('Solicitud de autorizacion invalida.');
  }
  const challenge = String(formData.get('code_challenge') ?? '');
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) throw new Error('Solicitud de autorizacion invalida.');
  return {
    client,
    redirectUri,
    challenge,
    state: String(formData.get('state') ?? ''),
    scope: normalizeScope(String(formData.get('scope') ?? '')),
  };
}

function withParams(uri: string, params: Record<string, string>): string {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

export async function approveMcpAccess(formData: FormData): Promise<void> {
  const user = await assertAdmin();
  const req = await readAuthorizeRequest(formData);
  // El administrador puede bajar el acceso a solo lectura.
  const scope = formData.get('allow_write') === 'on' ? req.scope : SCOPE_READ;

  const code = await createAuthCode({
    clientId: req.client.clientId,
    userId: user.id,
    redirectUri: req.redirectUri,
    codeChallenge: req.challenge,
    scope,
  });
  await writeAuditLog({
    userId: user.id,
    action: 'mcp.oauth.approve',
    entity: 'McpOAuthClient',
    entityId: req.client.clientId,
    metadata: { name: req.client.name, scope, redirect: new URL(req.redirectUri).host },
  });
  redirect(withParams(req.redirectUri, { code, state: req.state }));
}

export async function denyMcpAccess(formData: FormData): Promise<void> {
  await assertAdmin();
  const req = await readAuthorizeRequest(formData);
  redirect(withParams(req.redirectUri, { error: 'access_denied', state: req.state }));
}

export async function deleteMcpClient(formData: FormData): Promise<void> {
  const user = await assertAdmin();
  const clientId = String(formData.get('clientId') ?? '');
  await prisma.mcpToken.updateMany({ where: { clientId }, data: { revokedAt: new Date() } });
  await prisma.mcpOAuthClient.deleteMany({ where: { clientId } });
  await writeAuditLog({ userId: user.id, action: 'mcp.oauth.revoke', entity: 'McpOAuthClient', entityId: clientId });
  revalidatePath('/admin/mercadolibre/conexion');
}
