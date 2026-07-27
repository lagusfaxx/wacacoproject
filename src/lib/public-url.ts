import { env } from '@/lib/env';

/**
 * Direcciones de escucha que jamas sirven como destino para un navegador:
 * significan "todas las interfaces", no una maquina concreta. Chrome ademas
 * bloquea 0.0.0.0 y muestra la pagina de "el sitio no esta disponible".
 */
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]', '0000:0000:0000:0000:0000:0000:0000:0000']);

function firstValue(header: string | null): string {
  // Una cadena de proxies deja los valores separados por coma.
  return header?.split(',')[0]?.trim() ?? '';
}

function isWildcardHost(host: string): boolean {
  return WILDCARD_HOSTS.has(host.replace(/:\d+$/, '').toLowerCase());
}

/**
 * Origen publico de la tienda (`https://midominio.cl`).
 *
 * Orden de preferencia:
 *   1. APP_URL, la unica fuente que no depende de la peticion.
 *   2. `x-forwarded-host` / `host`, que deja el proxy (Coolify, Traefik...).
 *   3. El origen de la peticion, ya sin comodines.
 *
 * El paso 3 existe porque una peticion sin `Host` util deja a Next armando la
 * URL con la direccion de escucha del contenedor (0.0.0.0): redirigir ahi
 * manda al navegador a un sitio que no existe. En ese caso se sustituye por
 * localhost, que si es alcanzable desde la maquina que esta mirando.
 *
 * Que las cabeceras sean manipulables no abre un agujero: solo se usan para
 * devolver al visitante a su propio dominio, nunca para decidir permisos.
 */
export function publicOrigin(request: Request): string {
  if (process.env.APP_URL) return new URL(env.appUrl).origin;

  const host = firstValue(request.headers.get('x-forwarded-host') || request.headers.get('host'));
  if (host && !isWildcardHost(host)) {
    const proto = firstValue(request.headers.get('x-forwarded-proto')) || 'http';
    return `${proto}://${host}`;
  }

  const url = new URL(request.url);
  if (isWildcardHost(url.host)) url.hostname = 'localhost';
  return url.origin;
}

/**
 * Devuelve `path` como URL absoluta hacia el dominio publico, descartando el
 * host que traiga la peticion cuando no sirve como destino.
 */
export function publicUrl(path: string, request: Request): URL {
  return new URL(path, publicOrigin(request));
}
