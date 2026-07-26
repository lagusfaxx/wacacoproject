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
  const ts = String(Date.now());
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

  const oldTs = String(Date.now() - 60 * 60 * 1000);
  const oldManifest = `id:${dataId};request-id:${requestId};ts:${oldTs};`;
  check(
    'rechaza una firma antigua (replay)',
    !verifyWebhookSignature({
      signatureHeader: `ts=${oldTs},v1=${signature(oldManifest, secret)}`,
      requestId,
      dataId,
    }).valid,
  );

  // El manifiesto omite los pares sin valor.
  const tsOnly = String(Date.now());
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
  };
}

const SHIPPING = {
  fullName: 'Cliente de Prueba',
  phone: '+56900000000',
  line1: 'Calle Falsa 123',
  city: 'Santiago',
  region: 'Metropolitana',
  postalCode: '8320000',
  country: 'CL',
};

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
    region: 'Metropolitana',
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
      region: 'RM',
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
      region: 'RM',
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

async function main() {
  console.log('Ejecutando pruebas de la tienda Wacaco...');

  await testWebhookSignature();
  await testCheckoutValidation();
  await testPricing();
  await testStockReservation();
  await testDiscardUnpaidOrder();
  await testPaymentIdempotency();
  await testPasswordHashing();

  console.log(`\n${passed} pruebas correctas, ${failed} fallidas.`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
