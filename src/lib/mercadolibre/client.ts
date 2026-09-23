import 'server-only';

import { getAccessToken, ML_API } from './auth';

/**
 * Cliente HTTP de la API de Mercado Libre.
 *
 * - Solo habla con api.mercadolibre.com: la ruta nunca puede cambiar el host.
 * - Si el token fue revocado a mitad de camino (401), renueva una vez y repite.
 * - Ante un 429 (limite de peticiones) espera un momento y reintenta una vez.
 */

export class MlApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'MlApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export type MlRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Cabeceras extra, ej. x-format-new para envios. */
  headers?: Record<string, string>;
};

export function mlUrl(path: string, query?: Query): URL {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new MlApiError(400, 'Ruta de la API invalida.');
  }
  const url = new URL(path, ML_API);
  if (url.origin !== ML_API) throw new MlApiError(400, 'Ruta de la API invalida.');
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as { message?: string; error?: string; cause?: { message?: string }[] };
    const causes = Array.isArray(b.cause)
      ? b.cause.map((c) => c?.message).filter(Boolean).join('; ')
      : '';
    const main = b.message || b.error || '';
    if (main || causes) return [main, causes].filter(Boolean).join(' — ');
  }
  return `Mercado Libre respondio ${status}.`;
}

export async function mlFetch<T = unknown>(path: string, request: MlRequest = {}): Promise<T> {
  const url = mlUrl(path, request.query);

  const attempt = async (token: string) =>
    fetch(url, {
      method: request.method ?? 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...request.headers,
      },
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });

  let { token } = await getAccessToken();
  let response = await attempt(token);

  if (response.status === 401) {
    ({ token } = await getAccessToken({ force: true }));
    response = await attempt(token);
  }
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await attempt(token);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new MlApiError(response.status, errorMessage(response.status, body), body);
  }
  return body as T;
}

/** Ejecuta tareas en paralelo con un tope, para no gatillar el limite de la API. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Cache corto en memoria para lecturas caras (resumen, visitas). */
const cache = new Map<string, { expires: number; value: unknown }>();

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>, fresh = false): Promise<T> {
  const hit = cache.get(key);
  if (!fresh && hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { expires: Date.now() + ttlSeconds * 1000, value });
  return value;
}

/** Olvida lo guardado: se llama tras cada cambio y cuando llega un aviso. */
export function invalidateCache(prefix = '') {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}
