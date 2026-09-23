import 'server-only';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { pkceChallenge, randomToken } from '@/lib/secure-token';
import { decryptSecret, encryptSecret } from './crypto';

/**
 * Conexion OAuth con la cuenta de vendedor de Mercado Libre.
 *
 * Flujo: el administrador pulsa "Conectar", Mercado Libre le pide aprobar la
 * aplicacion y vuelve a /api/mercadolibre/callback con un codigo que se
 * cambia por el par access/refresh token. Se usa PKCE y un `state` aleatorio
 * atado a una cookie, asi un codigo robado o una vuelta forjada no sirven.
 */

export const ML_API = 'https://api.mercadolibre.com';
export const CONNECTION_ID = 'default';
/** Cookie con el `state` y el verificador PKCE mientras dura la autorizacion. */
export const ML_OAUTH_COOKIE = 'wc_ml_oauth';

const AUTH_HOSTS: Record<string, string> = {
  MLC: 'https://auth.mercadolibre.cl',
  MLA: 'https://auth.mercadolibre.com.ar',
  MLM: 'https://auth.mercadolibre.com.mx',
  MLB: 'https://auth.mercadolivre.com.br',
  MCO: 'https://auth.mercadolibre.com.co',
  MPE: 'https://auth.mercadolibre.com.pe',
  MLU: 'https://auth.mercadolibre.com.uy',
};

/** Margen para renovar el token antes de que venza de verdad. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function mlConfigured(): boolean {
  return env.mlClientId !== '' && env.mlClientSecret !== '';
}

export function mlRedirectUri(): string {
  return `${env.appUrl}/api/mercadolibre/callback`;
}

export class MlNotConnectedError extends Error {
  constructor(message = 'Mercado Libre no esta conectado. Conectalo desde Panel > Mercado Libre > Conexion.') {
    super(message);
    this.name = 'MlNotConnectedError';
  }
}

/** Datos para iniciar la autorizacion: la URL y lo que hay que recordar. */
export function buildAuthorization() {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const host = AUTH_HOSTS[env.mlSiteId] ?? AUTH_HOSTS.MLC!;
  const url = new URL('/authorization', host);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.mlClientId);
  url.searchParams.set('redirect_uri', mlRedirectUri());
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', pkceChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return { url: url.toString(), state, verifier };
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  user_id: number;
};

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.mlClientId,
      client_secret: env.mlClientSecret,
      ...params,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
    message?: string;
    error?: string;
  };
  if (!response.ok || !body.access_token || !body.refresh_token) {
    // Nunca se incluye el cuerpo completo: podria traer datos sensibles.
    throw new Error(
      `Mercado Libre rechazo el token (${response.status}): ${body.message ?? body.error ?? 'sin detalle'}`,
    );
  }
  return body as TokenResponse;
}

/** Cambia el codigo de la vuelta por los tokens y guarda la conexion. */
export async function completeAuthorization(input: {
  code: string;
  verifier: string;
  adminEmail: string;
}) {
  const token = await requestToken({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: mlRedirectUri(),
    code_verifier: input.verifier,
  });

  const me = await fetch(`${ML_API}/users/me`, {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ nickname?: string; site_id?: string }>) : null))
    .catch(() => null);

  const data = {
    mlUserId: String(token.user_id),
    nickname: me?.nickname || String(token.user_id),
    siteId: me?.site_id || env.mlSiteId,
    accessTokenEnc: encryptSecret(token.access_token),
    refreshTokenEnc: encryptSecret(token.refresh_token),
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scope: token.scope ?? '',
    connectedBy: input.adminEmail,
  };

  await prisma.mlConnection.upsert({
    where: { id: CONNECTION_ID },
    create: { id: CONNECTION_ID, ...data },
    update: data,
  });
  return data;
}

export async function getConnection() {
  return prisma.mlConnection.findUnique({ where: { id: CONNECTION_ID } });
}

export async function disconnect() {
  await prisma.mlConnection.deleteMany({ where: { id: CONNECTION_ID } });
}

/**
 * Access token vigente, renovandolo si esta por vencer.
 *
 * Mercado Libre entrega un refresh token de UN SOLO USO: si dos peticiones lo
 * usan a la vez, la segunda lo gasta en vano y la conexion se pierde. Por eso
 * la renovacion ocurre dentro de una transaccion que bloquea la fila: la
 * segunda espera, relee y encuentra el token ya renovado.
 */
export async function getAccessToken(options: { force?: boolean } = {}): Promise<{
  token: string;
  userId: string;
}> {
  if (!mlConfigured()) {
    throw new MlNotConnectedError(
      'Falta configurar ML_CLIENT_ID y ML_CLIENT_SECRET en las variables de entorno.',
    );
  }

  const current = await getConnection();
  if (!current) throw new MlNotConnectedError();

  const fresh = current.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
  if (fresh && !options.force) {
    return { token: decryptSecret(current.accessTokenEnc), userId: current.mlUserId };
  }

  const seenUpdatedAt = current.updatedAt.getTime();

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MlConnection" WHERE id = ${CONNECTION_ID} FOR UPDATE`;
      const locked = await tx.mlConnection.findUnique({ where: { id: CONNECTION_ID } });
      if (!locked) throw new MlNotConnectedError();

      // Otra peticion renovo mientras se esperaba el bloqueo.
      if (locked.updatedAt.getTime() !== seenUpdatedAt) {
        return { token: decryptSecret(locked.accessTokenEnc), userId: locked.mlUserId };
      }

      let token: TokenResponse;
      try {
        token = await requestToken({
          grant_type: 'refresh_token',
          refresh_token: decryptSecret(locked.refreshTokenEnc),
        });
      } catch (error) {
        throw new MlNotConnectedError(
          `No se pudo renovar el acceso a Mercado Libre: ${(error as Error).message}. Vuelve a conectar la cuenta.`,
        );
      }

      await tx.mlConnection.update({
        where: { id: CONNECTION_ID },
        data: {
          accessTokenEnc: encryptSecret(token.access_token),
          refreshTokenEnc: encryptSecret(token.refresh_token),
          expiresAt: new Date(Date.now() + token.expires_in * 1000),
          scope: token.scope ?? locked.scope,
        },
      });
      return { token: token.access_token, userId: locked.mlUserId };
    },
    { timeout: 30_000, maxWait: 30_000 },
  );
}
