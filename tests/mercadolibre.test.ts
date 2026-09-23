/**
 * Pruebas de la integracion con Mercado Libre y del servidor MCP.
 *
 * La API de Mercado Libre se simula reemplazando `fetch`: se verifica lo que
 * la tienda le envia (cuerpos de PUT, renovaciones de token) sin tocar una
 * cuenta real. Usa la base de datos de DATABASE_URL y limpia lo que crea.
 *
 *   npm run test:ml
 */
import { PrismaClient } from '@prisma/client';

process.env.SESSION_SECRET ||= 'test-session-secret-that-is-long-enough-1234';
process.env.ML_CLIENT_ID ||= '123';
process.env.ML_CLIENT_SECRET ||= 'secret';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function rejects(fn: () => Promise<unknown>, match: RegExp): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return match.test((error as Error).message);
  }
}

// --- API simulada ---------------------------------------------------------

type Call = { method: string; url: URL; body: unknown };
const calls: Call[] = [];
let refreshCount = 0;

const items: Record<string, Record<string, unknown>> = {
  MLC100: { id: 'MLC100', title: 'Molinillo', price: 10000, available_quantity: 5, status: 'active', sold_quantity: 2 },
  MLC200: {
    id: 'MLC200',
    title: 'Termo',
    price: 20000,
    available_quantity: 7,
    status: 'active',
    sold_quantity: 0,
    variations: [
      { id: 1, price: 20000, available_quantity: 3, attribute_combinations: [{ name: 'Color', value_name: 'Negro' }] },
      { id: 2, price: 20000, available_quantity: 4, attribute_combinations: [{ name: 'Color', value_name: 'Rojo' }] },
    ],
  },
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname !== 'api.mercadolibre.com') return realFetch(input, init);
  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
  calls.push({ method, url, body });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

  if (url.pathname === '/oauth/token') {
    refreshCount += 1;
    await new Promise((r) => setTimeout(r, 150));
    return json({ access_token: `AT-${refreshCount}`, refresh_token: `RT-${refreshCount}`, expires_in: 21600, user_id: 999 });
  }
  const match = /^\/items\/(MLC\d+)$/.exec(url.pathname);
  if (match) {
    const item = items[match[1]!];
    if (!item) return json({ message: 'not found' }, 404);
    if (method === 'PUT') return json({ ...item, ...(body as object) });
    return json(item);
  }
  return json({ message: 'no simulado' }, 404);
}) as typeof fetch;

// --- Pruebas --------------------------------------------------------------

async function testCrypto() {
  console.log('\nCifrado de tokens');
  const { encryptSecret, decryptSecret } = await import('../src/lib/mercadolibre/crypto');
  const a = encryptSecret('APP_USR-secreto');
  check('ida y vuelta', decryptSecret(a) === 'APP_USR-secreto');
  check('iv distinto en cada cifrado', encryptSecret('x') !== encryptSecret('x'));
  const [v, iv, tag, data] = a.split('.');
  const tampered = [v, iv, tag, Buffer.from('otro-dato').toString('base64url')].join('.');
  check('detecta alteraciones', await rejects(async () => decryptSecret(tampered!), /./));
  check('el texto guardado no contiene el token', !a.includes('secreto'));
  void data;
}

async function seedConnection(expired: boolean) {
  const { encryptSecret } = await import('../src/lib/mercadolibre/crypto');
  await prisma.mlConnection.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      mlUserId: '999',
      nickname: 'TEST',
      siteId: 'MLC',
      accessTokenEnc: encryptSecret('AT-0'),
      refreshTokenEnc: encryptSecret('RT-0'),
      expiresAt: new Date(Date.now() + (expired ? -1000 : 3600_000)),
    },
    update: {
      accessTokenEnc: encryptSecret('AT-0'),
      refreshTokenEnc: encryptSecret('RT-0'),
      expiresAt: new Date(Date.now() + (expired ? -1000 : 3600_000)),
    },
  });
}

async function testRefresh() {
  console.log('\nRenovacion del token (refresh de un solo uso)');
  const { getAccessToken } = await import('../src/lib/mercadolibre/auth');
  await seedConnection(true);
  refreshCount = 0;
  const results = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);
  check('tres peticiones simultaneas renuevan una sola vez', refreshCount === 1, `renovaciones: ${refreshCount}`);
  check('todas reciben el token nuevo', results.every((r) => r.token === 'AT-1'));
  const refreshCall = calls.find((c) => c.url.pathname === '/oauth/token');
  check('usa el refresh token guardado', String(refreshCall?.body ?? '').includes('refresh_token=RT-0'));
  const row = await prisma.mlConnection.findUnique({ where: { id: 'default' } });
  check('guarda el token cifrado, no en claro', !!row && !row.accessTokenEnc.includes('AT-1'));
}

async function testWrites() {
  console.log('\nCambios en publicaciones');
  const w = await import('../src/lib/mercadolibre/write');
  const ctx = { userId: null, via: 'panel' as const };
  await seedConnection(false);

  calls.length = 0;
  await w.updatePrice(ctx, { itemId: 'MLC100', price: 11000 });
  const put = calls.find((c) => c.method === 'PUT');
  check('precio simple', JSON.stringify(put?.body) === JSON.stringify({ price: 11000 }));

  check(
    'rechaza un cambio de precio de mas del 40% sin forzar',
    await rejects(() => w.updatePrice(ctx, { itemId: 'MLC100', price: 1000 }), /40%/),
  );
  calls.length = 0;
  await w.updatePrice(ctx, { itemId: 'MLC100', price: 1000, forzar: true });
  check('lo acepta con forzar', calls.some((c) => c.method === 'PUT'));

  calls.length = 0;
  await w.updatePrice(ctx, { itemId: 'MLC200', price: 21000 });
  const vput = calls.find((c) => c.method === 'PUT')?.body as { variations?: { id: number; price: number }[] };
  check(
    'con variaciones el precio va en todas',
    vput?.variations?.length === 2 && vput.variations.every((v) => v.price === 21000),
  );

  check(
    'stock con variaciones exige elegir una',
    await rejects(() => w.updateStock(ctx, { itemId: 'MLC200', quantity: 9 }), /variaciones/),
  );
  calls.length = 0;
  await w.updateStock(ctx, { itemId: 'MLC200', quantity: 9, variationId: 2 });
  const sput = calls.find((c) => c.method === 'PUT')?.body as { variations: Record<string, unknown>[] };
  check(
    'manda todas las variaciones (la omitida se borraria) y cambia solo la elegida',
    sput.variations.length === 2 &&
      sput.variations[0]!.available_quantity === undefined &&
      sput.variations[1]!.available_quantity === 9,
  );

  check(
    'finalizar exige confirmar',
    await rejects(() => w.setStatus(ctx, { itemId: 'MLC100', status: 'closed' }), /irreversible/),
  );
  check(
    'descuento mayor al precio se rechaza',
    await rejects(
      () =>
        w.createPriceDiscount(ctx, { itemId: 'MLC100', dealPrice: 99999, startDate: '2026-10-01', finishDate: '2026-10-05' }),
      /menor/,
    ),
  );
  check(
    'descuento de mas de 14 dias se rechaza',
    await rejects(
      () =>
        w.createPriceDiscount(ctx, { itemId: 'MLC100', dealPrice: 500, startDate: '2026-10-01', finishDate: '2026-10-30' }),
      /14 dias/,
    ),
  );
}

async function testClientGuards() {
  console.log('\nCliente de la API');
  const { mlUrl } = await import('../src/lib/mercadolibre/client');
  check('no permite cambiar de host', await rejects(async () => mlUrl('//evil.com/x'), /invalida/));
  check('no permite barras invertidas', await rejects(async () => mlUrl('/\\evil.com'), /invalida/));
  check('arma la URL con parametros', mlUrl('/items', { ids: 'A,B' }).toString() === 'https://api.mercadolibre.com/items?ids=A%2CB');
}

async function testMcp() {
  console.log('\nServidor MCP');
  const { createApiKey, authenticateBearer, redirectUriAllowed } = await import('../src/lib/mcp/auth');
  const { handleMessage } = await import('../src/lib/mcp/server');

  const admin = await prisma.user.create({
    data: { email: `mcp-test-${Date.now()}@test.cl`, passwordHash: 'x', name: 'MCP', role: 'ADMIN' },
  });
  try {
    const readOnly = await createApiKey({ userId: admin.id, name: 'lectura', write: false, expiresInDays: null });
    const auth = await authenticateBearer(`Bearer ${readOnly.token}`);
    check('la clave autentica', auth?.user.id === admin.id);
    check('se guarda solo el hash', readOnly.row.tokenHash !== readOnly.token && !readOnly.row.tokenHash.includes(readOnly.token));
    check('token inventado no autentica', (await authenticateBearer('Bearer mcpk_inventado')) === null);

    const list = (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, auth!)) as {
      result: { tools: { name: string }[] };
    };
    check(
      'solo lectura no ve herramientas de escritura',
      !list.result.tools.some((t) => t.name === 'ml_cambiar_precio'),
    );
    const call = (await handleMessage(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'ml_cambiar_precio', arguments: { item_id: 'MLC100', precio: 9000 } } },
      auth!,
    )) as { result: { isError?: boolean } };
    check('solo lectura no puede escribir', call.result.isError === true);

    await prisma.user.update({ where: { id: admin.id }, data: { role: 'CUSTOMER' } });
    check('quitar el rol ADMIN corta el acceso', (await authenticateBearer(`Bearer ${readOnly.token}`)) === null);

    check('acepta el callback de claude.ai', redirectUriAllowed('https://claude.ai/api/mcp/auth_callback'));
    check('acepta localhost por http', redirectUriAllowed('http://localhost:33418/callback'));
    check('rechaza otros dominios', !redirectUriAllowed('https://evil.com/cb'));
    check('rechaza http fuera de localhost', !redirectUriAllowed('http://claude.ai/cb'));
    check('rechaza dominios parecidos', !redirectUriAllowed('https://evilclaude.ai/cb'));
  } finally {
    await prisma.user.delete({ where: { id: admin.id } });
  }
}

async function main() {
  const existing = await prisma.mlConnection.findUnique({ where: { id: 'default' } });
  try {
    await testCrypto();
    await testClientGuards();
    await testRefresh();
    await testWrites();
    await testMcp();
  } finally {
    await prisma.mlConnection.deleteMany({ where: { id: 'default' } });
    if (existing) await prisma.mlConnection.create({ data: existing });
    await prisma.auditLog.deleteMany({ where: { action: { startsWith: 'ml.item' }, userId: null } });
    await prisma.$disconnect();
  }
  console.log(`\n${passed} ok, ${failed} fallidas`);
  process.exit(failed ? 1 : 0);
}

void main();
