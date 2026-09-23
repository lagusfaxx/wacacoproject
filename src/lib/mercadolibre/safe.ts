import 'server-only';

import { MlNotConnectedError } from './auth';
import { MlApiError } from './client';

export type MlResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; notConnected: boolean };

/** Ejecuta una lectura para una pagina del panel sin que un error la tumbe. */
export async function safeMl<T>(fn: () => Promise<T>): Promise<MlResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof MlNotConnectedError) {
      return { ok: false, error: error.message, notConnected: true };
    }
    if (error instanceof MlApiError) {
      return { ok: false, error: `Mercado Libre respondio ${error.status}: ${error.message}`, notConnected: false };
    }
    console.error('[mercadolibre] error de lectura', error);
    return { ok: false, error: 'No se pudo consultar Mercado Libre.', notConnected: false };
  }
}
