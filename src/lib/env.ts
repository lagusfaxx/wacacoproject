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
  /**
   * Access token de Mercado Pago. Es la unica credencial que la tienda
   * necesita: con Checkout Pro el cobro ocurre en el sitio de Mercado Pago,
   * asi que no hay nada que firmar desde el navegador y la public key no se
   * usa. El client id/secret son solo para OAuth de marketplaces que cobran
   * en nombre de terceros, que no es el caso.
   */
  get mpAccessToken() {
    return requireVar('MP_ACCESS_TOKEN');
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
  /**
   * Si el sitio se sirve por HTTPS, segun APP_URL.
   *
   * Determina el atributo `Secure` de las cookies. No puede deducirse de
   * NODE_ENV: una cookie `Secure` enviada sobre http la descarta el navegador
   * sin avisar, y la sesion nunca llega a guardarse. Eso deja el panel en un
   * bucle de inicio de sesion imposible de diagnosticar desde el servidor.
   */
  get usesHttps() {
    return read('APP_URL', 'http://localhost:3000').startsWith('https://');
  },
};

/** Monedas sin decimales: los importes se redondean a entero. */
const ZERO_DECIMAL_CURRENCIES = new Set(['CLP', 'COP', 'PYG', 'JPY', 'KRW', 'VND']);

export function currencyHasDecimals(currency = env.currency): boolean {
  return !ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}
