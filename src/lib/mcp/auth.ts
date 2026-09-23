import 'server-only';

import type { McpToken, User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { pkceChallenge, randomToken, sha256 } from '@/lib/secure-token';

/**
 * Credenciales del servidor MCP.
 *
 * Dos formas de entrar, las dos terminan en una fila de McpToken:
 *   - Clave de API creada en el panel (Claude Code, Claude Desktop).
 *   - OAuth 2.1 con PKCE y registro dinamico (conector de claude.ai), que
 *     exige que un administrador con sesion abierta apruebe el acceso.
 *
 * Solo se guarda el hash de cada token. Cada peticion vuelve a comprobar que
 * el usuario siga activo y siga siendo ADMIN: quitarle el rol corta el acceso
 * de Claude de inmediato.
 */

export const SCOPE_READ = 'ml:read';
export const SCOPE_WRITE = 'ml:write';
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE];

const ACCESS_TTL_SECONDS = 60 * 60; // 1 hora
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const CODE_TTL_SECONDS = 60;

export function mcpResourceUrl(): string {
  return `${env.appUrl}/api/mcp`;
}

export function normalizeScope(requested: string | null | undefined): string {
  const asked = (requested ?? '').split(/\s+/).filter((s) => SUPPORTED_SCOPES.includes(s));
  // Sin scope explicito se entrega lectura y escritura: el administrador lo
  // ve en la pantalla de aprobacion y puede bajarlo a solo lectura.
  const scopes = asked.length ? asked : SUPPORTED_SCOPES;
  // Escribir implica poder leer lo que se va a cambiar.
  if (scopes.includes(SCOPE_WRITE) && !scopes.includes(SCOPE_READ)) scopes.unshift(SCOPE_READ);
  return [...new Set(scopes)].join(' ');
}

function newToken(kind: 'API_KEY' | 'ACCESS' | 'REFRESH'): string {
  const prefix = kind === 'API_KEY' ? 'mcpk' : kind === 'ACCESS' ? 'mcpa' : 'mcpr';
  return `${prefix}_${randomToken(32)}`;
}

// ---------------------------------------------------------------------------
// Claves de API
// ---------------------------------------------------------------------------

export async function createApiKey(input: {
  userId: string;
  name: string;
  write: boolean;
  expiresInDays: number | null;
}) {
  const token = newToken('API_KEY');
  const row = await prisma.mcpToken.create({
    data: {
      kind: 'API_KEY',
      name: input.name,
      tokenHash: sha256(token),
      prefix: token.slice(0, 12),
      scope: input.write ? `${SCOPE_READ} ${SCOPE_WRITE}` : SCOPE_READ,
      userId: input.userId,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null,
    },
  });
  return { token, row };
}

/** Revoca una credencial y, si viene de OAuth, toda su familia. */
export async function revokeToken(id: string) {
  const row = await prisma.mcpToken.findUnique({ where: { id } });
  if (!row) return;
  await prisma.mcpToken.updateMany({
    where: row.familyId ? { familyId: row.familyId } : { id },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Verificacion de cada peticion
// ---------------------------------------------------------------------------

export type McpAuth = { user: User; token: McpToken; scopes: string[] };

export async function authenticateBearer(header: string | null): Promise<McpAuth | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  if (!match) return null;
  const raw = match[1]!;
  if (!raw.startsWith('mcpk_') && !raw.startsWith('mcpa_')) return null;

  const token = await prisma.mcpToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  if (!token || token.kind === 'REFRESH' || token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt <= new Date()) return null;
  if (!token.user.active || token.user.role !== 'ADMIN') return null;

  // Marca de ultimo uso, sin escribir en cada peticion.
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.mcpToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  const { user, ...rest } = token;
  return { user, token: rest as McpToken, scopes: token.scope.split(' ') };
}

// ---------------------------------------------------------------------------
// OAuth: registro de clientes
// ---------------------------------------------------------------------------

export function redirectUriAllowed(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  // https siempre, salvo la maquina local (Claude Code abre un puerto local).
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return false;
  return env.mcpAllowedRedirectHosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export async function registerClient(input: { name: string; redirectUris: string[] }) {
  const clientId = `mcpc_${randomToken(18)}`;
  await prisma.mcpOAuthClient.create({
    data: { clientId, name: input.name, redirectUris: input.redirectUris },
  });
  return clientId;
}

export async function findClient(clientId: string) {
  return prisma.mcpOAuthClient.findUnique({ where: { clientId } });
}

// ---------------------------------------------------------------------------
// OAuth: codigo y tokens
// ---------------------------------------------------------------------------

export async function createAuthCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}) {
  const code = randomToken(32);
  await prisma.mcpAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    },
  });
  // Limpieza oportunista de codigos vencidos.
  await prisma.mcpAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3600_000) } } })
    .catch(() => undefined);
  return code;
}

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function issueTokens(input: {
  userId: string;
  clientId: string;
  clientName: string;
  scope: string;
  familyId: string;
}) {
  const access = newToken('ACCESS');
  const refresh = newToken('REFRESH');
  const base = {
    name: input.clientName,
    scope: input.scope,
    userId: input.userId,
    clientId: input.clientId,
    familyId: input.familyId,
  };
  await prisma.mcpToken.createMany({
    data: [
      {
        ...base,
        kind: 'ACCESS',
        tokenHash: sha256(access),
        prefix: access.slice(0, 12),
        expiresAt: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000),
      },
      {
        ...base,
        kind: 'REFRESH',
        tokenHash: sha256(refresh),
        prefix: refresh.slice(0, 12),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      },
    ],
  });
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh,
    scope: input.scope,
  };
}

export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  const client = await findClient(input.clientId);
  if (!client) throw new OAuthError('invalid_client', 'Cliente desconocido.');

  // Se marca usado dentro de la misma operacion: un codigo repetido no sirve
  // dos veces ni aunque lleguen las dos peticiones a la vez.
  const claimed = await prisma.mcpAuthCode.updateMany({
    where: { codeHash: sha256(input.code), usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  const code = await prisma.mcpAuthCode.findUnique({ where: { codeHash: sha256(input.code) } });
  if (claimed.count !== 1 || !code) throw new OAuthError('invalid_grant', 'Codigo invalido o vencido.');

  if (code.clientId !== input.clientId || code.redirectUri !== input.redirectUri) {
    throw new OAuthError('invalid_grant', 'El codigo no corresponde a este cliente.');
  }
  if (pkceChallenge(input.codeVerifier) !== code.codeChallenge) {
    throw new OAuthError('invalid_grant', 'code_verifier incorrecto.');
  }

  const user = await prisma.user.findUnique({ where: { id: code.userId } });
  if (!user?.active || user.role !== 'ADMIN') throw new OAuthError('invalid_grant', 'Usuario sin acceso.');

  await prisma.mcpOAuthClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
  return issueTokens({
    userId: code.userId,
    clientId: client.clientId,
    clientName: client.name,
    scope: code.scope,
    familyId: randomToken(12),
  });
}

export async function refreshTokens(input: { refreshToken: string; clientId: string }) {
  const row = await prisma.mcpToken.findUnique({
    where: { tokenHash: sha256(input.refreshToken) },
    include: { user: true },
  });
  if (!row || row.kind !== 'REFRESH' || row.clientId !== input.clientId) {
    throw new OAuthError('invalid_grant', 'Refresh token invalido.');
  }
  if (row.revokedAt) {
    // Un refresh token ya usado que vuelve a aparecer indica robo: se corta
    // la familia completa (recomendacion de OAuth 2.1).
    if (row.familyId) {
      await prisma.mcpToken.updateMany({ where: { familyId: row.familyId }, data: { revokedAt: new Date() } });
    }
    throw new OAuthError('invalid_grant', 'Refresh token revocado.');
  }
  if (row.expiresAt && row.expiresAt <= new Date()) throw new OAuthError('invalid_grant', 'Refresh token vencido.');
  if (!row.user.active || row.user.role !== 'ADMIN') throw new OAuthError('invalid_grant', 'Usuario sin acceso.');

  const rotated = await prisma.mcpToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (rotated.count !== 1) throw new OAuthError('invalid_grant', 'Refresh token ya usado.');

  // Los access tokens anteriores de la familia dejan de servir.
  await prisma.mcpToken.updateMany({
    where: { familyId: row.familyId, kind: 'ACCESS', revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return issueTokens({
    userId: row.userId,
    clientId: row.clientId!,
    clientName: row.name,
    scope: row.scope,
    familyId: row.familyId ?? randomToken(12),
  });
}
