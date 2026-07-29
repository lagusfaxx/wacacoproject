/**
 * Pruebas de la logica critica de la tienda: firma del webhook, reserva de
 * stock, idempotencia del pago y verificacion de montos.
 *
 * Se ejecutan contra la base de datos configurada en DATABASE_URL y limpian
 * todo lo que crean.
 *
 *   npm run test
 */
import { createHmac } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';

process.env.MP_WEBHOOK_SECRET ||= 'test-webhook-secret';
process.env.SESSION_SECRET ||= 'test-session-secret-that-is-long-enough-1234';
process.env.MP_ACCESS_TOKEN ||= 'TEST-token';
process.env.MP_CURRENCY ||= 'CLP';

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

function signature(manifest: string, secret: string): string {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

async function testWebhookSignature() {
  console.log('\nFirma del webhook (x-signature)');
  const { verifyWebhookSignature } = await import('../src/lib/mercadopago');

  const secret = process.env.MP_WEBHOOK_SECRET!;
  // Mercado Pago manda el `ts` en SEGUNDOS, no en milisegundos. La prueba lo
  // hacia con Date.now() y por eso pasaba mientras en produccion se rechazaba
  // hasta la ultima notificacion: la diferencia entre las dos unidades daba
  // decadas de antiguedad.
  const ts = String(Math.floor(Date.now() / 1000));
  const dataId = '1234567890';
  const requestId = 'req-abc-123';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = signature(manifest, secret);

  check(
    'acepta una firma valida',
    verifyWebhookSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      dataId,
    }).valid,
  );

  check(
    'rechaza una firma alterada',
    !verifyWebhookSignature({
      signatureHeader: `ts=${ts},v1=${'0'.repeat(64)}`,
      requestId,
      dataId,
    }).valid,
  );

  check(
    'rechaza si cambia el id del pago',
    !verifyWebhookSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      dataId: '9999999999',
    }).valid,
  );

  check(
    'rechaza una cabecera ausente',
    !verifyWebhookSignature({ signatureHeader: null, requestId, dataId }).valid,
  );

  check(
    'rechaza una cabecera mal formada',
    !verifyWebhookSignature({ signatureHeader: 'basura', requestId, dataId }).valid,
  );

  // Un reintento legitimo de Mercado Pago llega horas despues y tiene que
  // seguir valiendo: rechazarlo es perder un pago que si se cobro.
  const retryTs = String(Math.floor(Date.now() / 1000) - 6 * 60 * 60);
  const retryManifest = `id:${dataId};request-id:${requestId};ts:${retryTs};`;
  check(
    'acepta un reintento de horas despues',
    verifyWebhookSignature({
      signatureHeader: `ts=${retryTs},v1=${signature(retryManifest, secret)}`,
      requestId,
      dataId,
    }).valid,
  );

  const oldTs = String(Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60);
  const oldManifest = `id:${dataId};request-id:${requestId};ts:${oldTs};`;
  check(
    'rechaza una firma de hace dias (replay)',
    !verifyWebhookSignature({
      signatureHeader: `ts=${oldTs},v1=${signature(oldManifest, secret)}`,
      requestId,
      dataId,
    }).valid,
  );

  // La misma firma en milisegundos tambien tiene que valer: hay cuentas que
  // la mandan asi.
  const msTs = String(Date.now());
  check(
    'acepta el ts en milisegundos',
    verifyWebhookSignature({
      signatureHeader: `ts=${msTs},v1=${signature(`id:${dataId};request-id:${requestId};ts:${msTs};`, secret)}`,
      requestId,
      dataId,
    }).valid,
  );

  // El manifiesto omite los pares sin valor.
  const tsOnly = String(Math.floor(Date.now() / 1000));
  check(
    'acepta notificaciones sin request-id',
    verifyWebhookSignature({
      signatureHeader: `ts=${tsOnly},v1=${signature(`id:${dataId};ts:${tsOnly};`, secret)}`,
      requestId: null,
      dataId,
    }).valid,
  );
}

type Fixture = {
  productId: string;
  variantId: string;
  cleanup: () => Promise<void>;
};

async function createFixture(stock: number): Promise<Fixture> {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  const product = await prisma.product.create({
    data: {
      slug: `test-producto-${suffix.toLowerCase()}`,
      name: `Producto de prueba ${suffix}`,
      sku: `TEST-${suffix}`,
      price: new Prisma.Decimal(10000),
      stock,
      variants: {
        create: { name: 'Negro', sku: `TEST-${suffix}-NEG`, stock, colorHex: '#000000' },
      },
    },
    include: { variants: true },
  });

  return {
    productId: product.id,
    variantId: product.variants[0]!.id,
    cleanup: async () => {
      await prisma.orderItem.deleteMany({ where: { productId: product.id } });
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    },
  };
}

function buildTotals(fixture: Fixture, quantity: number, unitPrice = 10000) {
  const price = new Prisma.Decimal(unitPrice);
  const lineTotal = price.times(quantity);
  return {
    lines: [
      {
        productId: fixture.productId,
        variantId: fixture.variantId,
        name: 'Producto de prueba',
        variantName: 'Negro',
        slug: 'test',
        sku: 'TEST',
        image: null,
        unitPrice: price,
        quantity,
        lineTotal,
        available: quantity,
        inStock: true,
      },
    ],
    itemCount: quantity,
    subtotal: lineTotal,
    discountTotal: new Prisma.Decimal(0),
    shippingTotal: new Prisma.Decimal(0),
    taxTotal: new Prisma.Decimal(0),
    total: lineTotal,
    couponCode: null,
    couponError: null,
    freeShippingThreshold: 0,
    missingForFreeShipping: new Prisma.Decimal(0),
    hasStockIssues: false,
    shipping: {
      cost: new Prisma.Decimal(0),
      carrier: 'Despacho estandar',
      serviceType: null,
      serviceName: 'Despacho estandar',
      promiseDays: null,
      districtCode: null,
      source: 'free' as const,
      notice: null,
    },
  };
}

const SHIPPING = {
  fullName: 'Cliente de Prueba',
  phone: '+56900000000',
  line1: 'Calle Falsa 123',
  city: 'Santiago',
  region: 'Metropolitana de Santiago',
  regionCode: 'CL-RM',
  postalCode: '8320000',
  country: 'CL',
};

/**
 * El desglose que se le manda a Mercado Pago.
 *
 * Es la prueba que faltaba: Mercado Pago cobra lo que suman los `items`, asi
 * que si el desglose no da el total del pedido se cobra de menos (el envio
 * quedaba fuera) o de mas (un cupon que nunca se enviaba). Las dos cosas
 * terminan igual: el pago no cuadra con el pedido y queda trabado.
 */
async function testPreferenceBreakdown() {
  console.log('\nDesglose enviado a Mercado Pago');
  const { buildPreferenceItems } = await import('../src/lib/mercadopago');
  const { Prisma } = await import('@prisma/client');

  const d = (n: number) => new Prisma.Decimal(n);
  const suma = (items: { unitPrice: number; quantity: number }[]) =>
    items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const base = {
    orderNumber: 'WC-TEST01',
    trackingToken: 'tok',
    payer: { name: 'Ana Perez', email: 'ana@prueba.local' },
  };

  // El caso exacto que fallaba: 100 de producto y 1 de envio se cobraban 100.
  const conEnvio = buildPreferenceItems({
    ...base,
    lines: [{ id: 'A', title: 'Producto', quantity: 1, lineTotal: d(100) }],
    discount: d(0),
    shipping: d(1),
    tax: d(0),
    total: d(101),
  });
  check('el envio se cobra', suma(conEnvio) === 101, `suma=${suma(conEnvio)}`);
  check('el envio aparece como concepto propio', conEnvio.some((i) => i.title === 'Despacho'));

  // Sin descuento se conserva la cantidad real, que es lo que espera ver quien compra.
  const variasUnidades = buildPreferenceItems({
    ...base,
    lines: [{ id: 'A', title: 'Minipresso', quantity: 3, lineTotal: d(59_970) }],
    discount: d(0),
    shipping: d(0),
    tax: d(0),
    total: d(59_970),
  });
  check('mantiene la cantidad cuando no hay descuento', variasUnidades[0]?.quantity === 3);
  check('el total con varias unidades cuadra', suma(variasUnidades) === 59_970);

  // Un cupon: antes no se enviaba y Mercado Pago cobraba el precio de lista.
  const conCupon = buildPreferenceItems({
    ...base,
    lines: [
      { id: 'A', title: 'Uno', quantity: 1, lineTotal: d(30_000) },
      { id: 'B', title: 'Dos', quantity: 2, lineTotal: d(20_000) },
    ],
    discount: d(5_000),
    shipping: d(3_990),
    tax: d(0),
    total: d(48_990),
  });
  check('el descuento se descuenta de verdad', suma(conCupon) === 48_990, `suma=${suma(conCupon)}`);

  // Un descuento que no reparte redondo entre las lineas: el resto tiene que
  // caer en alguna, no perderse.
  const conResto = buildPreferenceItems({
    ...base,
    lines: [
      { id: 'A', title: 'Uno', quantity: 1, lineTotal: d(10_000) },
      { id: 'B', title: 'Dos', quantity: 1, lineTotal: d(10_000) },
      { id: 'C', title: 'Tres', quantity: 1, lineTotal: d(10_000) },
    ],
    discount: d(1_000),
    shipping: d(0),
    tax: d(0),
    total: d(29_000),
  });
  check('el redondeo del descuento no pierde pesos', suma(conResto) === 29_000, `suma=${suma(conResto)}`);

  // Los impuestos, cuando la tienda los cobra, tambien tienen que viajar.
  const conImpuestos = buildPreferenceItems({
    ...base,
    lines: [{ id: 'A', title: 'Producto', quantity: 1, lineTotal: d(10_000) }],
    discount: d(0),
    shipping: d(2_000),
    tax: d(1_900),
    total: d(13_900),
  });
  check('los impuestos se cobran', suma(conImpuestos) === 13_900, `suma=${suma(conImpuestos)}`);

  // Y si algo no cuadra, no se cobra: mejor un error que un cobro equivocado.
  let reventó = false;
  try {
    buildPreferenceItems({
      ...base,
      lines: [{ id: 'A', title: 'Producto', quantity: 1, lineTotal: d(100) }],
      discount: d(0),
      shipping: d(0),
      tax: d(0),
      total: d(999),
    });
  } catch {
    reventó = true;
  }
  check('un desglose que no cuadra no llega a cobrarse', reventó);
}

async function testStockReservation() {
  console.log('\nReserva de stock al crear el pedido');
  const { createOrderFromTotals, OrderError } = await import('../src/lib/orders');
  const fixture = await createFixture(5);

  try {
    const order = await createOrderFromTotals({
      totals: buildTotals(fixture, 3),
      email: 'prueba@wacaco.local',
      shipping: SHIPPING,
    });

    const product = await prisma.product.findUnique({ where: { id: fixture.productId } });
    const variant = await prisma.productVariant.findUnique({ where: { id: fixture.variantId } });

    check('descuenta el stock del producto', product?.stock === 2, `stock=${product?.stock}`);
    check('descuenta el stock de la variante', variant?.stock === 2, `stock=${variant?.stock}`);
    check('genera un numero de pedido legible', /^WC-[0-9A-F]{8}$/.test(order.number), order.number);
    check('genera un token de seguimiento largo', order.trackingToken.length >= 24);

    // Intentar comprar mas de lo que queda debe fallar y no dejar stock negativo.
    let rejected = false;
    try {
      await createOrderFromTotals({
        totals: buildTotals(fixture, 10),
        email: 'prueba@wacaco.local',
        shipping: SHIPPING,
      });
    } catch (error) {
      rejected = error instanceof OrderError;
    }

    const afterFail = await prisma.product.findUnique({ where: { id: fixture.productId } });
    check('rechaza una compra sin stock suficiente', rejected);
    check('no deja el stock en negativo', afterFail?.stock === 2, `stock=${afterFail?.stock}`);

    await prisma.order.delete({ where: { id: order.orderId } });
  } finally {
    await fixture.cleanup();
  }
}

async function testPaymentIdempotency() {
  console.log('\nAplicacion del pago (idempotencia y montos)');
  const { createOrderFromTotals, applyPaymentUpdate } = await import('../src/lib/orders');
  const fixture = await createFixture(10);

  const order = await createOrderFromTotals({
    totals: buildTotals(fixture, 2),
    email: 'prueba@wacaco.local',
    shipping: SHIPPING,
  });

  const paymentId = `9${Date.now()}`;

  const approved = {
    id: paymentId,
    status: 'approved',
    statusDetail: 'accredited',
    externalReference: order.number,
    transactionAmount: 20000,
    shippingAmount: null,
    currencyId: 'CLP',
    paymentTypeId: 'credit_card',
    paymentMethodId: 'visa',
    installments: 1,
    payerEmail: 'prueba@wacaco.local',
    raw: { id: paymentId },
  };

  try {
    const first = await applyPaymentUpdate(approved);
    check('aplica el pago aprobado', first.handled && first.status === 'PAID');

    const afterFirst = await prisma.order.findUnique({
      where: { id: order.orderId },
      include: { payments: true, events: true },
    });
    check('marca el pedido como pagado', afterFirst?.status === 'PAID');
    check('registra la fecha de pago', afterFirst?.paidAt !== null);

    // Reprocesar la misma notificacion no debe duplicar nada.
    await applyPaymentUpdate(approved);
    const afterSecond = await prisma.order.findUnique({
      where: { id: order.orderId },
      include: { payments: true, events: true },
    });

    check(
      'no duplica el registro de pago al reprocesar',
      afterSecond?.payments.length === 1,
      `pagos=${afterSecond?.payments.length}`,
    );
    check(
      'no duplica eventos al reprocesar',
      afterSecond?.events.length === afterFirst?.events.length,
      `eventos=${afterSecond?.events.length}`,
    );

    // Un pedido ya despachado no debe retroceder por una notificacion tardia.
    await prisma.order.update({ where: { id: order.orderId }, data: { status: 'SHIPPED' } });
    await applyPaymentUpdate(approved);
    const afterLate = await prisma.order.findUnique({ where: { id: order.orderId } });
    check('no retrocede un pedido ya despachado', afterLate?.status === 'SHIPPED');

    // Monto distinto al del pedido: se marca para revision, no se aprueba.
    const tampered = { ...approved, id: `${paymentId}1`, transactionAmount: 1 };
    await prisma.order.update({ where: { id: order.orderId }, data: { status: 'PENDING' } });
    await applyPaymentUpdate(tampered);

    const afterTamper = await prisma.order.findUnique({
      where: { id: order.orderId },
      include: { events: true },
    });
    check(
      'no aprueba un pago con monto alterado',
      afterTamper?.status === 'PENDING',
      `estado=${afterTamper?.status}`,
    );
    check(
      'deja un evento interno de revision manual',
      afterTamper?.events.some((event) => !event.isPublic && event.title.includes('Revision')) ?? false,
    );

    // Mercado Pago informa el despacho aparte del importe de los productos
    // cuando el envio viajo en `shipments`. Sumar solo el primero daba de
    // menos y mandaba a revision manual pagos que estaban perfectos.
    const total = Number(afterTamper!.total);
    const partido = {
      ...approved,
      id: `${paymentId}3`,
      transactionAmount: total - 1,
      shippingAmount: 1,
    };
    await prisma.order.update({ where: { id: order.orderId }, data: { status: 'PENDING' } });
    await applyPaymentUpdate(partido);

    const afterSplit = await prisma.order.findUnique({ where: { id: order.orderId } });
    check(
      'acepta un pago con el envio informado aparte',
      afterSplit?.status === 'PAID',
      `estado=${afterSplit?.status}`,
    );

    // Un pago rechazado devuelve el stock al inventario.
    const beforeRestore = await prisma.product.findUnique({ where: { id: fixture.productId } });
    await applyPaymentUpdate({
      ...approved,
      id: `${paymentId}2`,
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
    });
    const afterRestore = await prisma.product.findUnique({ where: { id: fixture.productId } });
    const restoredOrder = await prisma.order.findUnique({ where: { id: order.orderId } });

    check('marca el pedido como rechazado', restoredOrder?.status === 'FAILED');
    check(
      'devuelve el stock reservado',
      (afterRestore?.stock ?? 0) === (beforeRestore?.stock ?? 0) + 2,
      `antes=${beforeRestore?.stock} despues=${afterRestore?.stock}`,
    );

    // Sin external_reference no se puede asociar el pago a un pedido.
    const orphan = await applyPaymentUpdate({ ...approved, id: 'x1', externalReference: null });
    check('ignora un pago sin external_reference', !orphan.handled);
  } finally {
    await prisma.payment.deleteMany({ where: { orderId: order.orderId } });
    await prisma.orderEvent.deleteMany({ where: { orderId: order.orderId } });
    await prisma.order.delete({ where: { id: order.orderId } }).catch(() => undefined);
    await fixture.cleanup();
  }
}

async function testPricing() {
  console.log('\nCalculo de totales');
  const { priceCart } = await import('../src/lib/pricing');

  const empty = await priceCart(null);
  check('carrito vacio suma cero', empty.total.isZero() && empty.lines.length === 0);
  check('carrito vacio no cobra envio', empty.shippingTotal.isZero());

  const code = `TEST${Date.now().toString().slice(-6)}`;
  await prisma.coupon.create({
    data: { code, type: 'PERCENT', value: new Prisma.Decimal(150), active: true },
  });

  const fixture = await createFixture(10);
  const cart = await prisma.cart.create({
    data: {
      token: `test-${Date.now()}`,
      items: { create: { productId: fixture.productId, variantId: fixture.variantId, quantity: 1 } },
    },
    include: {
      items: { include: { product: { include: { images: true } }, variant: true } },
    },
  });

  try {
    const totals = await priceCart(cart, { couponCode: code });
    check(
      'un descuento excesivo nunca supera el subtotal',
      totals.discountTotal.lessThanOrEqualTo(totals.subtotal),
      `descuento=${totals.discountTotal} subtotal=${totals.subtotal}`,
    );
    check('el total nunca es negativo', totals.total.greaterThanOrEqualTo(0));

    const invalid = await priceCart(cart, { couponCode: 'NO-EXISTE' });
    check('un cupon inexistente no aplica descuento', invalid.discountTotal.isZero());
    check('un cupon inexistente informa el error', invalid.couponError !== null);
  } finally {
    await prisma.cart.delete({ where: { id: cart.id } });
    await prisma.coupon.deleteMany({ where: { code } });
    await fixture.cleanup();
  }
}

async function testCheckoutValidation() {
  console.log('\nValidacion del formulario de checkout');
  const { checkoutSchema, orderUpdateSchema } = await import('../src/lib/validation');

  // FormData.get() devuelve null para los campos que no existen en el
  // formulario; eso no debe invalidar un checkout correcto.
  const withNulls = checkoutSchema.safeParse({
    email: 'cliente@wacaco.local',
    fullName: 'Cliente Prueba',
    phone: '+56911112222',
    line1: 'Av. Siempre Viva 742',
    line2: null,
    city: 'Providencia',
    regionCode: 'CL-RM',
    postalCode: null,
    country: 'CL',
    notes: null,
    couponCode: null,
  });
  check(
    'acepta campos opcionales ausentes (null)',
    withNulls.success,
    withNulls.success ? '' : JSON.stringify(withNulls.error.errors),
  );

  check(
    'rechaza un correo invalido',
    !checkoutSchema.safeParse({
      email: 'no-es-un-correo',
      fullName: 'Cliente',
      phone: '+56911112222',
      line1: 'Calle 1',
      city: 'Santiago',
      regionCode: 'CL-RM',
      country: 'CL',
    }).success,
  );

  check(
    'rechaza una region inexistente',
    !checkoutSchema.safeParse({
      email: 'cliente@wacaco.local',
      fullName: 'Cliente',
      phone: '+56911112222',
      line1: 'Av. Siempre Viva 742',
      city: 'Santiago',
      regionCode: 'CL-XX',
      country: 'CL',
    }).success,
  );

  check(
    'rechaza una direccion demasiado corta',
    !checkoutSchema.safeParse({
      email: 'cliente@wacaco.local',
      fullName: 'Cliente',
      phone: '+56911112222',
      line1: 'a',
      city: 'Santiago',
      regionCode: 'CL-RM',
      country: 'CL',
    }).success,
  );

  check(
    'acepta un enlace de seguimiento vacio',
    orderUpdateSchema.safeParse({
      orderId: 'abc',
      status: 'SHIPPED',
      carrier: 'Chilexpress',
      trackingNumber: '123',
      trackingUrl: '',
      message: null,
    }).success,
  );

  check(
    'rechaza un enlace de seguimiento invalido',
    !orderUpdateSchema.safeParse({
      orderId: 'abc',
      status: 'SHIPPED',
      trackingUrl: 'no-es-url',
    }).success,
  );
}

async function testDiscardUnpaidOrder() {
  console.log('\nReversion de un pedido que no llego a la pasarela');
  const { createOrderFromTotals, discardUnpaidOrder, applyPaymentUpdate } = await import(
    '../src/lib/orders'
  );
  const fixture = await createFixture(8);

  try {
    const before = await prisma.product.findUnique({ where: { id: fixture.productId } });

    const order = await createOrderFromTotals({
      totals: buildTotals(fixture, 3),
      email: 'prueba@wacaco.local',
      shipping: SHIPPING,
    });

    const reserved = await prisma.product.findUnique({ where: { id: fixture.productId } });
    check('reserva el stock al crear el pedido', reserved?.stock === (before?.stock ?? 0) - 3);

    await discardUnpaidOrder(order.orderId);

    const after = await prisma.product.findUnique({ where: { id: fixture.productId } });
    const gone = await prisma.order.findUnique({ where: { id: order.orderId } });
    const variant = await prisma.productVariant.findUnique({ where: { id: fixture.variantId } });

    check('elimina el pedido sin pago', gone === null);
    check(
      'devuelve el stock del producto',
      after?.stock === before?.stock,
      `antes=${before?.stock} despues=${after?.stock}`,
    );
    check('devuelve el stock de la variante', variant?.stock === 8, `stock=${variant?.stock}`);

    // Un pedido que ya tiene un pago real no debe poder descartarse.
    const paid = await createOrderFromTotals({
      totals: buildTotals(fixture, 1),
      email: 'prueba@wacaco.local',
      shipping: SHIPPING,
    });
    await applyPaymentUpdate({
      id: `8${Date.now()}`,
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: paid.number,
      transactionAmount: 10000,
      shippingAmount: null,
      currencyId: 'CLP',
      paymentTypeId: 'credit_card',
      paymentMethodId: 'visa',
      installments: 1,
      payerEmail: 'prueba@wacaco.local',
      raw: {},
    });
    await discardUnpaidOrder(paid.orderId);
    const stillThere = await prisma.order.findUnique({ where: { id: paid.orderId } });
    check('no descarta un pedido ya pagado', stillThere !== null);

    await prisma.payment.deleteMany({ where: { orderId: paid.orderId } });
    await prisma.orderEvent.deleteMany({ where: { orderId: paid.orderId } });
    await prisma.order.delete({ where: { id: paid.orderId } }).catch(() => undefined);
  } finally {
    await fixture.cleanup();
  }
}

/**
 * El vencimiento de los pedidos por transferencia.
 *
 * Es lo que impide que un pedido que nadie pago deje inventario retenido para
 * siempre: sin esto, con una unidad en stock, un pedido abandonado deja el
 * producto agotado en la tienda.
 */
async function testTransferExpiry() {
  console.log('\nVencimiento de pedidos por transferencia');
  const { createOrderFromTotals, applyPaymentUpdate } = await import('../src/lib/orders');
  const { expireStaleTransferOrders } = await import('../src/lib/order-expiry');
  const { TRANSFER_KEYS } = await import('../src/lib/bank-transfer');

  const fixture = await createFixture(10);
  const key = TRANSFER_KEYS.holdHours;
  const previous = await prisma.setting.findUnique({ where: { key } });

  try {
    // Una hora de reserva, para no tener que esperar dos dias en la prueba.
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: '1' },
      update: { value: '1' },
    });

    const before = await prisma.product.findUnique({ where: { id: fixture.productId } });

    // Recien creado: dentro del plazo, no se toca.
    const fresco = await createOrderFromTotals({
      totals: buildTotals(fixture, 2),
      email: 'prueba@wacaco.local',
      shipping: SHIPPING,
      paymentMethod: 'transferencia',
    });

    await expireStaleTransferOrders();
    const sigueVivo = await prisma.order.findUnique({ where: { id: fresco.orderId } });
    check('un pedido dentro del plazo no se cancela', sigueVivo?.status === 'PENDING');

    // El mismo pedido, envejecido a mano dos horas.
    await prisma.order.update({
      where: { id: fresco.orderId },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    await expireStaleTransferOrders();

    const vencido = await prisma.order.findUnique({ where: { id: fresco.orderId } });
    const repuesto = await prisma.product.findUnique({ where: { id: fixture.productId } });
    check('el pedido vencido queda cancelado', vencido?.status === 'CANCELLED', vencido?.status);
    check(
      'el stock vuelve al inventario',
      repuesto?.stock === before?.stock,
      `antes=${before?.stock} despues=${repuesto?.stock}`,
    );

    const evento = await prisma.orderEvent.findFirst({
      where: { orderId: fresco.orderId, status: 'CANCELLED' },
    });
    check('deja constancia en el historial del pedido', evento !== null);

    // Un pedido por tarjeta, igual de viejo, no lo toca: la pasarela puede
    // acreditar tarde y cancelarlo seria mucho peor que retener una unidad.
    const conTarjeta = await createOrderFromTotals({
      totals: buildTotals(fixture, 1),
      email: 'prueba@wacaco.local',
      shipping: SHIPPING,
    });
    await prisma.order.update({
      where: { id: conTarjeta.orderId },
      data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    await expireStaleTransferOrders();
    const tarjeta = await prisma.order.findUnique({ where: { id: conTarjeta.orderId } });
    check('no toca los pedidos de Mercado Pago', tarjeta?.status === 'PENDING', tarjeta?.status);

    // Una transferencia que si llego (pago real asociado) tampoco vence.
    const pagado = await createOrderFromTotals({
      totals: buildTotals(fixture, 1),
      email: 'prueba@wacaco.local',
      shipping: SHIPPING,
      paymentMethod: 'transferencia',
    });
    await applyPaymentUpdate({
      id: `9${Date.now()}`,
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: pagado.number,
      transactionAmount: 10000,
      shippingAmount: null,
      currencyId: 'CLP',
      paymentTypeId: 'bank_transfer',
      paymentMethodId: 'transfer',
      installments: 1,
      payerEmail: 'prueba@wacaco.local',
      raw: {},
    });
    await prisma.order.update({
      where: { id: pagado.orderId },
      data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    await expireStaleTransferOrders();
    const acreditado = await prisma.order.findUnique({ where: { id: pagado.orderId } });
    check(
      'no cancela una transferencia ya acreditada',
      acreditado?.status !== 'CANCELLED',
      acreditado?.status,
    );

    for (const id of [fresco.orderId, conTarjeta.orderId, pagado.orderId]) {
      await prisma.payment.deleteMany({ where: { orderId: id } });
      await prisma.orderEvent.deleteMany({ where: { orderId: id } });
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } }).catch(() => undefined);
    }
  } finally {
    if (previous) {
      await prisma.setting.update({ where: { key }, data: { value: previous.value } });
    } else {
      await prisma.setting.delete({ where: { key } }).catch(() => undefined);
    }
    await fixture.cleanup();
  }
}

/**
 * Retiro en tienda.
 *
 * Lo que hay que asegurar es que el retiro no se pueda usar para saltarse el
 * costo del envio: quien manipule el formulario y mande "retiro" en una tienda
 * que no lo ofrece tiene que pagar el despacho igual.
 */
async function testPickup() {
  console.log('\nRetiro en tienda');
  const { PICKUP_KEYS, pickupIsUsable, pickupAddressLines } = await import('../src/lib/pickup');
  const { fulfillmentFlow } = await import('../src/lib/order-status');
  const { pickupCheckoutSchema, checkoutSchema } = await import('../src/lib/validation');

  const completo = {
    enabled: true,
    place: 'Tienda Nomad Brew',
    address: 'Av. Providencia 1234',
    commune: 'Providencia',
    region: 'Region Metropolitana',
    hours: 'Lunes a viernes de 10 a 18',
    notes: '',
  };

  check('con direccion y comuna el retiro se ofrece', pickupIsUsable(completo));
  check('sin direccion no se ofrece', !pickupIsUsable({ ...completo, address: '' }));
  check('sin comuna no se ofrece', !pickupIsUsable({ ...completo, commune: '' }));
  check('desactivado no se ofrece aunque este completo', !pickupIsUsable({ ...completo, enabled: false }));

  const lineas = pickupAddressLines(completo);
  check('la direccion arma sus lineas', lineas[1] === 'Av. Providencia 1234', lineas.join(' | '));
  check('el horario viaja con la direccion', lineas.some((l) => l.startsWith('Horario:')));

  // Al retirar no se pide direccion, pero si nombre, telefono y correo.
  const sinDireccion = {
    fullName: 'Ana Perez',
    phone: '+56900000000',
    email: 'ana@prueba.local',
    notes: '',
    couponCode: '',
  };
  check('el retiro no exige direccion', pickupCheckoutSchema.safeParse(sinDireccion).success);
  check(
    'el despacho si exige direccion',
    !checkoutSchema.safeParse(sinDireccion).success,
  );
  check(
    'el retiro sigue exigiendo telefono',
    !pickupCheckoutSchema.safeParse({ ...sinDireccion, phone: '' }).success,
  );

  check(
    'el recorrido de un retiro pasa por listo para retiro',
    fulfillmentFlow('retiro').includes('READY_FOR_PICKUP'),
  );
  check(
    'el recorrido de un despacho no lo incluye',
    !fulfillmentFlow('despacho').includes('READY_FOR_PICKUP'),
  );

  // El precio: pedir retiro en una tienda que no lo ofrece no exime del envio.
  const { priceCart } = await import('../src/lib/pricing');
  const fixture = await createFixture(5);
  const previas = await prisma.setting.findMany({
    where: { key: { in: Object.values(PICKUP_KEYS) } },
  });

  try {
    const cart = await prisma.cart.create({
      data: {
        token: `test-${Math.random().toString(36).slice(2, 10)}`,
        items: { create: { productId: fixture.productId, quantity: 1 } },
      },
      include: { items: { include: { product: { include: { images: true } }, variant: true } } },
    });

    await prisma.setting.deleteMany({ where: { key: { in: Object.values(PICKUP_KEYS) } } });

    const sinRetiro = await priceCart(cart, { pickup: true });
    check(
      'sin retiro configurado se cotiza el despacho igual',
      sinRetiro.shipping.source !== 'pickup',
      sinRetiro.shipping.source,
    );

    for (const [campo, valor] of Object.entries({
      [PICKUP_KEYS.enabled]: 'true',
      [PICKUP_KEYS.place]: completo.place,
      [PICKUP_KEYS.address]: completo.address,
      [PICKUP_KEYS.commune]: completo.commune,
      [PICKUP_KEYS.region]: completo.region,
      [PICKUP_KEYS.hours]: completo.hours,
    })) {
      await prisma.setting.create({ data: { key: campo, value: valor } });
    }

    const conRetiro = await priceCart(cart, { pickup: true });
    check('con retiro configurado no se cobra envio', Number(conRetiro.shippingTotal) === 0);
    check('el resumen dice que es retiro', conRetiro.shipping.source === 'pickup');
    check(
      'el total del retiro es solo el subtotal',
      conRetiro.total.equals(conRetiro.subtotal),
      `${conRetiro.total} vs ${conRetiro.subtotal}`,
    );

    const despacho = await priceCart(cart, {
      destination: { regionCode: 'CL-RM', commune: 'Providencia' },
    });
    check(
      'el despacho sigue cotizando su tarifa',
      despacho.shipping.source !== 'pickup',
      despacho.shipping.source,
    );

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cart.delete({ where: { id: cart.id } });
  } finally {
    await prisma.setting.deleteMany({ where: { key: { in: Object.values(PICKUP_KEYS) } } });
    for (const fila of previas) {
      await prisma.setting.create({ data: { key: fila.key, value: fila.value } });
    }
    await fixture.cleanup();
  }
}

async function testShipping() {
  console.log('\nCotizador de envios');
  const { quoteShipping, isBluexpressEnabled, trackingUrlFor } = await import('../src/lib/shipping');
  const { Prisma } = await import('@prisma/client');

  const items = [{ quantity: 1, weightGrams: 500, lengthCm: 20, widthCm: 12, heightCm: 12 }];

  // Sin credenciales de Blue Express la tienda debe seguir cobrando envio.
  check('detecta que Blue Express no esta configurado', !isBluexpressEnabled());

  const withoutDestination = await quoteShipping({
    items,
    payableSubtotal: new Prisma.Decimal(10000),
    destination: null,
  });
  check('sin direccion el envio queda por calcular', withoutDestination.source === 'pending');
  check('sin direccion no cobra envio', withoutDestination.cost.isZero());

  const flat = await quoteShipping({
    items,
    payableSubtotal: new Prisma.Decimal(10000),
    destination: { regionCode: 'CL-RM', commune: 'Providencia' },
  });
  check(
    'cae a la tarifa plana si Blue Express no responde',
    flat.source === 'flat' && flat.cost.greaterThan(0),
    `source=${flat.source} cost=${flat.cost}`,
  );

  // El umbral de envio gratis manda por sobre cualquier tarifa.
  process.env.FREE_SHIPPING_THRESHOLD = '50000';
  const free = await quoteShipping({
    items,
    payableSubtotal: new Prisma.Decimal(60000),
    destination: { regionCode: 'CL-RM', commune: 'Providencia' },
  });
  check('aplica envio gratis sobre el umbral', free.source === 'free' && free.cost.isZero());
  process.env.FREE_SHIPPING_THRESHOLD = '0';

  const empty = await quoteShipping({
    items: [],
    payableSubtotal: new Prisma.Decimal(0),
    destination: { regionCode: 'CL-RM', commune: 'Providencia' },
  });
  check('un carrito vacio no cobra envio', empty.cost.isZero());

  const badRegion = await quoteShipping({
    items,
    payableSubtotal: new Prisma.Decimal(10000),
    destination: { regionCode: 'CL-XX', commune: 'Providencia' },
  });
  check('una region invalida no rompe la cotizacion', badRegion.cost.greaterThanOrEqualTo(0));

  check(
    'arma el enlace de seguimiento de Blue Express',
    (trackingUrlFor('Blue Express', 'ABC123') ?? '').includes('ABC123'),
  );
  check('no inventa enlace para otro transportista', trackingUrlFor('Otro', 'ABC123') === null);
  check('sin numero de seguimiento no hay enlace', trackingUrlFor('Blue Express', '') === null);

  // --- Tarifas manuales por region -----------------------------------------
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();

  await db.shippingRate.deleteMany({ where: { regionCode: { in: ['CL-MA', 'CL-AI'] } } });
  await db.shippingRate.create({
    data: { regionCode: 'CL-MA', price: new Prisma.Decimal(12990), etaDays: 6, active: true },
  });
  await db.shippingRate.create({
    data: { regionCode: 'CL-AI', price: new Prisma.Decimal(0), active: false },
  });

  try {
    const magallanes = await quoteShipping({
      items,
      payableSubtotal: new Prisma.Decimal(10000),
      destination: { regionCode: 'CL-MA', commune: 'Punta Arenas' },
      carrierName: 'Starken',
    });
    check(
      'usa la tarifa manual de la region',
      magallanes.source === 'manual' && Number(magallanes.cost) === 12990,
      `source=${magallanes.source} cost=${magallanes.cost}`,
    );
    check('informa el plazo cargado a mano', magallanes.promiseDays === 6);
    check('usa el transportista configurado', magallanes.carrier === 'Starken');

    const sinDespacho = await quoteShipping({
      items,
      payableSubtotal: new Prisma.Decimal(10000),
      destination: { regionCode: 'CL-AI', commune: 'Coyhaique' },
    });
    check(
      'bloquea las regiones sin despacho',
      sinDespacho.source === 'unavailable',
      sinDespacho.source,
    );
    check('explica por que no se puede comprar', Boolean(sinDespacho.notice));

    const sinTarifa = await quoteShipping({
      items,
      payableSubtotal: new Prisma.Decimal(10000),
      destination: { regionCode: 'CL-VS', commune: 'Vina del Mar' },
    });
    check(
      'una region sin tarifa propia usa la general',
      sinTarifa.source === 'flat',
      sinTarifa.source,
    );

    // El envio gratis manda incluso sobre una region con tarifa propia cara.
    process.env.FREE_SHIPPING_THRESHOLD = '50000';
    const gratisEnMagallanes = await quoteShipping({
      items,
      payableSubtotal: new Prisma.Decimal(80000),
      destination: { regionCode: 'CL-MA', commune: 'Punta Arenas' },
    });
    check(
      'el envio gratis manda sobre la tarifa manual',
      gratisEnMagallanes.source === 'free' && gratisEnMagallanes.cost.isZero(),
    );
    process.env.FREE_SHIPPING_THRESHOLD = '0';
  } finally {
    await db.shippingRate.deleteMany({ where: { regionCode: { in: ['CL-MA', 'CL-AI'] } } });
    await db.$disconnect();
  }

  const { CHILE_REGIONS, isValidRegionCode, regionName } = await import('../src/lib/regions-cl');
  check('lista las 16 regiones de Chile', CHILE_REGIONS.length === 16);
  check('valida un codigo de region real', isValidRegionCode('CL-RM'));
  check('rechaza un codigo de region falso', !isValidRegionCode('CL-ZZ'));
  check('traduce el codigo a nombre', regionName('CL-VS').includes('Valpara'));
}

async function testSeo() {
  console.log('\nSEO por ficha');
  const {
    resolveSeoTitle,
    resolveSeoDescription,
    resolveSeoImage,
    absoluteUrl,
    truncate,
    searchPreview,
    SEO_TITLE_LIMIT,
    SEO_DESCRIPTION_LIMIT,
  } = await import('../src/lib/seo');

  const fallback = {
    name: 'Minipresso GR2',
    tagline: 'Cafetera espresso manual para cafe molido',
    body: 'Cafetera espresso manual para cafe molido de la linea Wacaco.',
    image: '/products/minipresso-gr2.svg',
    storeName: 'Wacaco Store',
  };

  // Sin campos propios se usa el respaldo, nunca una etiqueta vacia.
  const auto = resolveSeoTitle({}, fallback);
  check('genera un titulo automatico', auto.includes('Minipresso GR2'), auto);
  check('agrega el nombre de la tienda si cabe', auto.includes('Wacaco Store'), auto);
  check('el titulo automatico respeta el limite', auto.length <= SEO_TITLE_LIMIT);

  check(
    'respeta el titulo personalizado',
    resolveSeoTitle({ seoTitle: 'Compra Minipresso GR2 en Chile' }, fallback) ===
      'Compra Minipresso GR2 en Chile',
  );

  const longTitle = resolveSeoTitle({ seoTitle: 'a'.repeat(120) }, fallback);
  check('recorta un titulo demasiado largo', longTitle.length <= SEO_TITLE_LIMIT, longTitle);

  const autoDesc = resolveSeoDescription({}, fallback);
  check('genera una descripcion automatica', autoDesc.length > 0);
  check('la descripcion respeta el limite', autoDesc.length <= SEO_DESCRIPTION_LIMIT);
  check(
    'respeta la descripcion personalizada',
    resolveSeoDescription({ seoDescription: 'Envio a todo Chile.' }, fallback) ===
      'Envio a todo Chile.',
  );

  check(
    'no repite el subtitulo si la descripcion ya lo contiene',
    resolveSeoDescription({}, {
      name: 'Picopresso',
      tagline: 'Cafetera espresso manual',
      body: 'Cafetera espresso manual de la linea Wacaco.',
    }) === 'Cafetera espresso manual de la linea Wacaco.',
    resolveSeoDescription({}, {
      name: 'Picopresso',
      tagline: 'Cafetera espresso manual',
      body: 'Cafetera espresso manual de la linea Wacaco.',
    }),
  );

  check(
    'combina subtitulo y descripcion cuando aportan cosas distintas',
    resolveSeoDescription({}, {
      name: 'Picopresso',
      tagline: 'Nivel barista',
      body: 'Prepara espresso donde quieras.',
    }) === 'Nivel barista. Prepara espresso donde quieras.',
  );

  const noFallback = resolveSeoDescription({}, { name: 'Producto sin textos' });
  check('siempre devuelve algo, aunque no haya textos', noFallback === 'Producto sin textos');

  check(
    'usa la imagen del producto si no hay una propia',
    resolveSeoImage({}, fallback) === '/products/minipresso-gr2.svg',
  );
  check(
    'respeta la imagen propia',
    resolveSeoImage({ seoImage: '/og/custom.jpg' }, fallback) === '/og/custom.jpg',
  );

  check(
    'convierte rutas relativas en absolutas',
    absoluteUrl('/og/a.jpg', 'https://tienda.cl') === 'https://tienda.cl/og/a.jpg',
  );
  check(
    'deja intactas las URLs absolutas',
    absoluteUrl('https://cdn.cl/a.jpg', 'https://tienda.cl') === 'https://cdn.cl/a.jpg',
  );
  check('sin imagen devuelve null', absoluteUrl(null, 'https://tienda.cl') === null);

  // El recorte no debe partir palabras por la mitad.
  const cut = truncate('palabra '.repeat(40), 50);
  check('no corta una palabra a la mitad', cut.length <= 50 && !cut.includes('palab…'), cut);

  const preview = searchPreview({}, fallback, 'https://tienda.cl', 'productos/minipresso-gr2');
  check(
    'la vista previa arma la ruta como Google',
    preview.url === 'tienda.cl › productos › minipresso-gr2',
    preview.url,
  );
}

async function testPasswordHashing() {
  console.log('\nContrasenas');
  const bcrypt = (await import('bcryptjs')).default;

  const hash = await bcrypt.hash('Secreta123', 12);
  check('el hash no contiene la contrasena', !hash.includes('Secreta123'));
  check('valida la contrasena correcta', await bcrypt.compare('Secreta123', hash));
  check('rechaza una contrasena incorrecta', !(await bcrypt.compare('Secreta124', hash)));

  const { passwordSchema } = await import('../src/lib/validation');
  check('rechaza contrasenas cortas', !passwordSchema.safeParse('Ab1').success);
  check('rechaza contrasenas sin numero', !passwordSchema.safeParse('Abcdefgh').success);
  check('acepta una contrasena valida', passwordSchema.safeParse('Abcdefg1').success);
}

async function testVerificationCodes() {
  console.log('\nCodigos de verificacion');
  const { issueCode, consumeCode, generateCode, MAX_ATTEMPTS } = await import(
    '../src/lib/verification'
  );

  const email = `codigo-${Date.now()}@prueba.local`;

  check('el codigo generado tiene seis digitos', /^\d{6}$/.test(generateCode()));

  const { code } = await issueCode(email, 'EMAIL_VERIFICATION');
  const stored = await prisma.verificationCode.findFirst({
    where: { email, purpose: 'EMAIL_VERIFICATION' },
    orderBy: { createdAt: 'desc' },
  });
  check('el codigo no se guarda en claro', stored !== null && stored.codeHash !== code);

  const wrong = await consumeCode(email, 'EMAIL_VERIFICATION', code === '000000' ? '111111' : '000000');
  check('un codigo equivocado no pasa', !wrong.ok);

  const right = await consumeCode(email, 'EMAIL_VERIFICATION', code);
  check('el codigo correcto pasa', right.ok);

  const reused = await consumeCode(email, 'EMAIL_VERIFICATION', code);
  check('el codigo no sirve dos veces', !reused.ok && reused.reason === 'not_found');

  // Pedir uno nuevo invalida el anterior: solo vale el ultimo que le llego al
  // cliente.
  const first = await issueCode(email, 'PASSWORD_RESET');
  const second = await issueCode(email, 'PASSWORD_RESET');
  const oldOne = await consumeCode(email, 'PASSWORD_RESET', first.code);
  check('el codigo anterior queda invalidado', !oldOne.ok);
  check('el ultimo codigo sigue sirviendo', (await consumeCode(email, 'PASSWORD_RESET', second.code)).ok);

  // Fuerza bruta: al quinto intento fallido el codigo muere.
  const target = await issueCode(email, 'EMAIL_VERIFICATION');
  const decoy = target.code === '999999' ? '888888' : '999999';
  let lastReason = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = await consumeCode(email, 'EMAIL_VERIFICATION', decoy);
    if (!result.ok) lastReason = result.reason;
  }
  check('se bloquea tras los intentos permitidos', lastReason === 'too_many_attempts');
  const afterLock = await consumeCode(email, 'EMAIL_VERIFICATION', target.code);
  check('el codigo bloqueado ya no sirve ni con el numero correcto', !afterLock.ok);

  const expired = await issueCode(email, 'EMAIL_VERIFICATION');
  await prisma.verificationCode.updateMany({
    where: { email, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const vencido = await consumeCode(email, 'EMAIL_VERIFICATION', expired.code);
  check('un codigo vencido no pasa', !vencido.ok && vencido.reason === 'expired');

  await prisma.verificationCode.deleteMany({ where: { email } });
}

async function testTransactionalEmail() {
  console.log('\nCorreo transaccional');
  const { deliver } = await import('../src/lib/email/send');
  const { orderPaidEmail, orderStatusEmail } = await import('../src/lib/email/templates');
  const { escapeHtml } = await import('../src/lib/email/layout');
  const { statusIsNotifiable } = await import('../src/lib/email/notifications');

  const brand = {
    storeName: 'Tienda',
    logoUrl: null,
    appUrl: 'https://tienda.cl',
    contactEmail: 'hola@tienda.cl',
  };

  const order = {
    number: 'WC-TEST01',
    customerName: 'Ana',
    customerNameFull: 'Ana Perez',
    pickup: null,
    items: [{ name: 'Minipresso', variantName: 'Negro', quantity: 2, lineTotal: '$59.980' }],
    subtotal: '$59.980',
    discountTotal: null,
    shippingTotal: 'Gratis',
    taxTotal: null,
    total: '$59.980',
    couponCode: null,
    shippingAddress: ['Ana Perez', 'Calle 123', '', 'Nunoa, Region Metropolitana', '', '+56900000000'],
    shippingService: 'Blue Express',
    trackingUrl: 'https://tienda.cl/seguimiento/abc',
    carrier: 'Blue Express',
    trackingNumber: '123456789',
    carrierTrackingUrl: 'https://bluex.cl/123456789',
    paymentMethod: 'Tarjeta de credito',
    paidAt: '27 de julio de 2026, 10:30',
  };

  const receipt = orderPaidEmail(brand, order);
  check('el comprobante nombra el pedido', receipt.subject.includes('WC-TEST01'));
  check('el comprobante lleva el total', receipt.html.includes('$59.980'));
  check('el comprobante lleva el enlace de seguimiento', receipt.html.includes(order.trackingUrl));
  check('el comprobante trae version en texto plano', receipt.text.includes('WC-TEST01'));

  const shipped = orderStatusEmail(brand, order, 'SHIPPED', null);
  check('el aviso de despacho trae el numero de seguimiento', shipped.html.includes('123456789'));
  check('el aviso de despacho enlaza al transportista', shipped.html.includes('bluex.cl'));

  check('el HTML del correo escapa lo que escribe el cliente', escapeHtml('<script>') === '&lt;script&gt;');

  const injected = orderStatusEmail(
    brand,
    { ...order, customerName: '<script>alert(1)</script>' },
    'PREPARING',
    null,
  );
  check('un nombre con etiquetas no inyecta HTML', !injected.html.includes('<script>'));

  // El aviso de retiro es el unico que el cliente lee de pie, a punto de salir
  // a buscar el pedido: tiene que traer donde ir y con que nombre pedirlo.
  const retiro = orderStatusEmail(
    brand,
    {
      ...order,
      pickup: ['Tienda Nomad Brew', 'Av. Providencia 1234', 'Providencia, Region Metropolitana'],
    },
    'READY_FOR_PICKUP',
    'Toca el timbre 501.',
  );
  check('el aviso de retiro lleva la direccion', retiro.html.includes('Av. Providencia 1234'));
  check('el aviso de retiro lleva el numero de pedido', retiro.html.includes('WC-TEST01'));
  check('el aviso de retiro dice quien retira', retiro.html.includes('Ana Perez'));
  check('el aviso de retiro incluye las instrucciones', retiro.html.includes('timbre 501'));
  check('el aviso de retiro trae texto plano', retiro.text.includes('Av. Providencia 1234'));
  check(
    'el asunto del retiro se entiende sin abrirlo',
    retiro.subject.includes('listo para retirar'),
    retiro.subject,
  );

  // Un pedido que se retira no habla de despacho en el comprobante.
  const comprobanteRetiro = orderPaidEmail(brand, {
    ...order,
    pickup: ['Tienda Nomad Brew', 'Av. Providencia 1234'],
  });
  check('el comprobante de retiro no promete despacho', !comprobanteRetiro.html.includes('Despachamos a'));
  check('el comprobante de retiro dice donde retirar', comprobanteRetiro.html.includes('Lo retiras en'));

  check('el pago pendiente no genera correo', !statusIsNotifiable('PENDING'));
  check('el despacho si genera correo', statusIsNotifiable('SHIPPED'));

  // La clave de idempotencia es lo que impide que un reintento del webhook
  // mande el comprobante dos veces.
  const dedupeKey = `prueba:${Date.now()}`;
  const to = `dedupe-${Date.now()}@prueba.local`;
  const one = await deliver({ to, type: 'test', dedupeKey, email: receipt });
  const two = await deliver({ to, type: 'test', dedupeKey, email: receipt });
  check('el primer envio se procesa', one.outcome === 'sent' || one.outcome === 'skipped', one.outcome);
  check('el segundo envio con la misma clave se descarta', two.outcome === 'duplicate', two.outcome);

  const rejected = await deliver({ to: 'sin-arroba', type: 'test', email: receipt });
  check('un destinatario invalido no se intenta enviar', rejected.outcome === 'failed');

  await prisma.emailLog.deleteMany({ where: { to } });
}

/**
 * El destino de cualquier redireccion absoluta nunca puede quedar apuntando a
 * la direccion de escucha del contenedor: el navegador no puede abrir
 * `0.0.0.0:3000` y muestra una pagina de error.
 */
async function testPublicOrigin() {
  console.log('\nOrigen publico para redirecciones');
  const { publicOrigin } = await import('../src/lib/public-url');
  const previous = process.env.APP_URL;

  const withHeaders = (headers: Record<string, string>) =>
    new Request('http://0.0.0.0:3000/api/auth/logout', { method: 'POST', headers });

  process.env.APP_URL = 'https://tienda.wacaco.cl';
  check(
    'con APP_URL definida manda al dominio publico',
    publicOrigin(withHeaders({ host: '0.0.0.0:3000' })) === 'https://tienda.wacaco.cl',
  );

  delete process.env.APP_URL;
  check(
    'sin APP_URL usa las cabeceras del proxy',
    publicOrigin(withHeaders({ host: 'app:3000', 'x-forwarded-host': 'tienda.wacaco.cl', 'x-forwarded-proto': 'https' })) ===
      'https://tienda.wacaco.cl',
  );
  check(
    'toma solo el primer valor de una cadena de proxies',
    publicOrigin(withHeaders({ 'x-forwarded-host': 'tienda.wacaco.cl, interno', 'x-forwarded-proto': 'https, http' })) ===
      'https://tienda.wacaco.cl',
  );
  check(
    'descarta 0.0.0.0 y cae en localhost',
    publicOrigin(withHeaders({ host: '0.0.0.0:3000' })) === 'http://localhost:3000',
  );
  check(
    'descarta tambien la direccion comodin IPv6',
    publicOrigin(withHeaders({ host: '[::]:3000' })) === 'http://localhost:3000',
  );
  check(
    'respeta un host normal',
    publicOrigin(withHeaders({ host: 'localhost:3000' })) === 'http://localhost:3000',
  );

  if (previous === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previous;
}

async function main() {
  console.log('Ejecutando pruebas de la tienda Wacaco...');

  await testWebhookSignature();
  await testPreferenceBreakdown();
  await testCheckoutValidation();
  await testPricing();
  await testStockReservation();
  await testDiscardUnpaidOrder();
  await testTransferExpiry();
  await testPickup();
  await testPaymentIdempotency();
  await testShipping();
  await testSeo();
  await testPasswordHashing();
  await testVerificationCodes();
  await testTransactionalEmail();
  await testPublicOrigin();

  console.log(`\n${passed} pruebas correctas, ${failed} fallidas.`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
