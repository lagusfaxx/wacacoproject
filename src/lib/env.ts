/**
 * Acceso centralizado a variables de entorno.
 *
 * Las lecturas son perezosas a proposito: `next build` evalua los modulos
 * durante la compilacion y en ese momento el contenedor todavia no tiene
 * necesariamente las credenciales reales. Fallar en build por una variable
 * que solo se necesita en runtime rompe el deploy sin motivo.
 */

function read(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  return '';
}

function requireVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa el archivo .env (ver .env.example).`,
    );
  }
  return value;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  get databaseUrl() {
    return requireVar('DATABASE_URL');
  },
  get appUrl() {
    return read('APP_URL', 'http://localhost:3000').replace(/\/+$/, '');
  },
  get sessionSecret() {
    const secret = requireVar('SESSION_SECRET');
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.');
    }
    return secret;
  },
  get mpAccessToken() {
    return requireVar('MP_ACCESS_TOKEN');
  },
  get mpPublicKey() {
    return read('MP_PUBLIC_KEY');
  },
  get mpWebhookSecret() {
    return read('MP_WEBHOOK_SECRET');
  },
  get mpSandbox() {
    return read('MP_SANDBOX', 'false') === 'true';
  },
  get currency() {
    return read('MP_CURRENCY', 'CLP').toUpperCase();
  },
  get storeName() {
    return read('STORE_NAME', 'Wacaco Store');
  },
  get storeEmail() {
    return read('STORE_EMAIL', 'hola@wacaco.local');
  },
  get freeShippingThreshold() {
    return toNumber(read('FREE_SHIPPING_THRESHOLD', '60000'), 60000);
  },
  get shippingFlatRate() {
    return toNumber(read('SHIPPING_FLAT_RATE', '4990'), 4990);
  },
  get taxRate() {
    return toNumber(read('TAX_RATE', '0'), 0);
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};

/** Monedas sin decimales: los importes se redondean a entero. */
const ZERO_DECIMAL_CURRENCIES = new Set(['CLP', 'COP', 'PYG', 'JPY', 'KRW', 'VND']);

export function currencyHasDecimals(currency = env.currency): boolean {
  return !ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}
