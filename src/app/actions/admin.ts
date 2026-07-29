'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser, writeAuditLog } from '@/lib/auth';
import { applyPaymentUpdate, restoreStock } from '@/lib/orders';
import { findPaymentByOrderNumber } from '@/lib/mercadopago';
import { trackingUrlFor } from '@/lib/shipping';
import {
  CARRIER_SETTING_KEY,
  FAVICON_SETTING_KEY,
  LOGO_SETTING_KEY,
  PAYMENT_LOGO_SETTING_KEY,
  SECONDARY_LOGO_ALT_SETTING_KEY,
  SECONDARY_LOGO_SETTING_KEY,
} from '@/lib/store-settings';
import { purgeOrphanImages, storeImage } from '@/lib/media';
import { parseHoldHours, TRANSFER_KEYS } from '@/lib/bank-transfer';
import { parsePrepDays, PICKUP_KEYS, pickupDataIsComplete } from '@/lib/pickup';
import { normalizeInstagram, normalizeWhatsapp, SOCIAL_KEYS } from '@/lib/social';
import { POLICY_KEYS } from '@/lib/store-policies';
import { CHILE_REGIONS } from '@/lib/regions-cl';
import { orderStatusLabel } from '@/lib/order-status';
import { notifyOrderStatus, statusIsNotifiable } from '@/lib/email/notifications';
import { toBannerVideo } from '@/lib/banner-style';
import { blockIsEmpty } from '@/lib/product-blocks';
import {
  bannerSchema,
  collectionSchema,
  couponSchema,
  fieldErrors,
  orderUpdateSchema,
  menuItemSchema,
  productSchema,
  productStripSchema,
  safeHref,
  slugify,
} from '@/lib/validation';

export type AdminState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
  errors: Record<string, string>;
};

/** Toda accion del panel pasa por aqui antes de tocar la base de datos. */
async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new Error('No autorizado.');
  }
  return user;
}

function checkboxValue(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on' || formData.get(name) === 'true';
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/** Estados que liberan el stock reservado al aplicarse. */
const STOCK_RELEASING: OrderStatus[] = ['CANCELLED', 'REFUNDED', 'FAILED'];

export async function updateOrderStatus(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const parsed = orderUpdateSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
    carrier: formData.get('carrier'),
    trackingNumber: formData.get('trackingNumber'),
    trackingUrl: formData.get('trackingUrl'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Revisa los datos.', errors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!order) {
    return { status: 'error', message: 'El pedido no existe.', errors: {} };
  }

  const now = new Date();
  const statusChanged = order.status !== data.status;

  // Si el pedido viaja por Blue Express y no se pego un enlace manual, se
  // arma el de seguimiento publico con el numero ingresado.
  const carrier = data.carrier || order.shipCarrier || '';
  const trackingUrl =
    data.trackingUrl ||
    (data.trackingNumber ? (trackingUrlFor(carrier, data.trackingNumber) ?? '') : '');

  await prisma.$transaction(async (tx) => {
    // Al cancelar o reembolsar se devuelven las unidades al inventario, y solo
    // una vez: si el pedido ya estaba en un estado liberado no se repite.
    if (
      statusChanged &&
      STOCK_RELEASING.includes(data.status) &&
      !STOCK_RELEASING.includes(order.status)
    ) {
      await restoreStock(order.id, tx);
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: data.status,
        carrier: data.carrier || null,
        trackingNumber: data.trackingNumber || null,
        trackingUrl: trackingUrl || null,
        paidAt: data.status === 'PAID' ? (order.paidAt ?? now) : order.paidAt,
        readyAt: data.status === 'READY_FOR_PICKUP' ? (order.readyAt ?? now) : order.readyAt,
        shippedAt: data.status === 'SHIPPED' ? (order.shippedAt ?? now) : order.shippedAt,
        deliveredAt: data.status === 'DELIVERED' ? (order.deliveredAt ?? now) : order.deliveredAt,
        cancelledAt: STOCK_RELEASING.includes(data.status)
          ? (order.cancelledAt ?? now)
          : order.cancelledAt,
      },
    });

    if (statusChanged || data.message) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: data.status,
          title: orderStatusLabel(data.status),
          message: data.message || null,
          createdBy: admin.email,
        },
      });
    }
  });

  await writeAuditLog({
    userId: admin.id,
    action: 'order.status_updated',
    entity: 'Order',
    entityId: order.id,
    metadata: { from: order.status, to: data.status },
  });

  // El aviso al cliente es opcional y lo decide quien atiende: hay cambios de
  // estado que se hacen para ordenar la bodega y no valen un correo.
  const notify = checkboxValue(formData, 'notify');
  let emailNote = '';

  if (notify && statusChanged && statusIsNotifiable(data.status)) {
    const result = await notifyOrderStatus(order.id, data.status, data.message || null).catch(
      (error) => {
        console.error('[admin] no se pudo avisar el cambio de estado', error);
        return { outcome: 'failed' as const };
      },
    );

    if (result.outcome === 'sent') emailNote = ' Se aviso al cliente por correo.';
    else if (result.outcome === 'skipped') {
      emailNote = ' No se envio el correo: falta configurar Resend en el servidor.';
    } else if (result.outcome === 'failed') {
      emailNote = ' El correo al cliente no pudo enviarse; el cambio si quedo guardado.';
    }
  }

  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${order.number}`);
  return { status: 'ok', message: `Pedido actualizado.${emailNote}`, errors: {} };
}

/**
 * Vuelve a preguntarle a Mercado Pago por el pago de un pedido.
 *
 * Existe porque la notificacion puede no llegar: un webhook mal configurado,
 * una caida, un reintento agotado. Sin esto la unica salida es tocar la base
 * de datos a mano. El estado sigue saliendo de la API de Mercado Pago, nunca
 * de lo que decida quien aprieta el boton.
 */
export async function syncPaymentFromMercadoPago(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const orderId = String(formData.get('orderId') ?? '');
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { status: 'error', message: 'El pedido no existe.', errors: {} };

  const payment = await findPaymentByOrderNumber(order.number);

  if (!payment) {
    return {
      status: 'error',
      message:
        'Mercado Pago no tiene ningun pago asociado a este pedido. Si el cliente dice haber pagado, revisa el numero de operacion en tu panel de Mercado Pago.',
      errors: {},
    };
  }

  const result = await applyPaymentUpdate(payment);

  await writeAuditLog({
    userId: admin.id,
    action: 'payment.sync_manual',
    entity: 'Order',
    entityId: order.id,
    metadata: { paymentId: payment.id, mpStatus: payment.status },
  });

  revalidatePath(`/admin/pedidos/${order.number}`);

  if (!result.handled) {
    return { status: 'error', message: `No se pudo aplicar: ${result.reason}`, errors: {} };
  }

  return {
    status: 'ok',
    message: `Mercado Pago informa "${payment.status}". El pedido quedo como ${orderStatusLabel(
      result.status,
    ).toLowerCase()}.`,
    errors: {},
  };
}

/**
 * "Listo para retiro" de un solo clic.
 *
 * Es la accion que mas se repite en una tienda con retiro: el pedido se armo,
 * esta en el meson y hay que avisarle al cliente. Hacerlo desde el desplegable
 * de estados funciona igual, pero son tres pasos para algo que se hace veinte
 * veces al dia.
 */
export async function markReadyForPickup(formData: FormData): Promise<void> {
  const admin = await assertAdmin();

  const orderId = String(formData.get('orderId') ?? '');
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === 'READY_FOR_PICKUP') return;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'READY_FOR_PICKUP', readyAt: order.readyAt ?? new Date() },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: 'READY_FOR_PICKUP',
        title: orderStatusLabel('READY_FOR_PICKUP'),
        message: 'El pedido esta en tienda, listo para que lo retiren.',
        createdBy: admin.email,
      },
    });
  });

  await notifyOrderStatus(order.id, 'READY_FOR_PICKUP').catch((error) => {
    console.error('[admin] no se pudo avisar que el pedido esta listo', error);
  });

  await writeAuditLog({
    userId: admin.id,
    action: 'order.ready_for_pickup',
    entity: 'Order',
    entityId: order.id,
    metadata: { from: order.status },
  });

  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${order.number}`);
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

/** Convierte el textarea de imagenes/caracteristicas en una lista limpia. */
function parseLines(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
}

/**
 * Las variantes y los bloques de contenido viajan como JSON en un solo campo
 * del formulario. Aqui solo se comprueba que sea una lista: de validar cada
 * fila se encarga zod despues.
 */
function parseJsonListField(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveProduct(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();

  const productId = String(formData.get('productId') ?? '');
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const rawName = String(formData.get('name') ?? '').trim();

  const parsed = productSchema.safeParse({
    name: rawName,
    slug: rawSlug || slugify(rawName),
    subtitle: formData.get('subtitle'),
    description: formData.get('description'),
    features: formData.get('features'),
    price: formData.get('price'),
    compareAtPrice: formData.get('compareAtPrice') || null,
    sku: formData.get('sku'),
    stock: formData.get('stock'),
    weightGrams: formData.get('weightGrams') || 500,
    lengthCm: formData.get('lengthCm') || 20,
    widthCm: formData.get('widthCm') || 12,
    heightCm: formData.get('heightCm') || 12,
    active: checkboxValue(formData, 'active'),
    featured: checkboxValue(formData, 'featured'),
    isNew: checkboxValue(formData, 'isNew'),
    incoming: checkboxValue(formData, 'incoming'),
    award: formData.get('award'),
    position: formData.get('position') || 0,
    collectionIds: formData.getAll('collectionIds').map(String),
    images: formData.getAll('images').map(String).filter(Boolean),
    variants: parseJsonListField(formData.get('variants')),
    blocks: parseJsonListField(formData.get('blocks')),
    gtin: formData.get('gtin'),
    brand: formData.get('brand'),
    seoTitle: formData.get('seoTitle'),
    seoDescription: formData.get('seoDescription'),
    seoImage: formData.get('seoImage'),
    noIndex: checkboxValue(formData, 'noIndex'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los campos marcados.',
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  // El slug y el SKU son unicos: se comprueba antes para dar un mensaje claro
  // en lugar de dejar que Prisma lance un error de restriccion.
  const clash = await prisma.product.findFirst({
    where: {
      OR: [{ slug: data.slug }, { sku: data.sku }],
      ...(productId ? { NOT: { id: productId } } : {}),
    },
  });
  if (clash) {
    return {
      status: 'error',
      message: 'Ya existe otro producto con ese slug o SKU.',
      errors: clash.slug === data.slug ? { slug: 'Slug en uso.' } : { sku: 'SKU en uso.' },
    };
  }

  // El SKU de una variante tambien es unico en toda la tienda, y ademas no
  // puede repetirse dentro del mismo formulario.
  const variantSkus = data.variants.map((variant) => variant.sku);
  const duplicated = variantSkus.find((sku, index) => variantSkus.indexOf(sku) !== index);
  if (duplicated) {
    return {
      status: 'error',
      message: `Hay dos variantes con el SKU ${duplicated}.`,
      errors: { variants: 'Cada variante necesita un SKU distinto.' },
    };
  }

  if (variantSkus.length > 0) {
    const variantClash = await prisma.productVariant.findFirst({
      where: {
        sku: { in: variantSkus },
        ...(productId ? { NOT: { productId } } : {}),
      },
      select: { sku: true },
    });
    if (variantClash) {
      return {
        status: 'error',
        message: `El SKU ${variantClash.sku} ya lo usa la variante de otro producto.`,
        errors: { variants: 'Cambia el SKU repetido.' },
      };
    }
  }

  // El boton de un bloque de contenido lleva a donde diga el propietario, asi
  // que pasa por el mismo filtro que los banners: solo rutas internas o URLs
  // http(s), nunca un `javascript:`.
  const badHref = data.blocks.find((block) => block.ctaHref && !safeHref(block.ctaHref));
  if (badHref) {
    return {
      status: 'error',
      message: `El enlace del boton del bloque "${badHref.title || badHref.kind}" no es valido.`,
      errors: { blocks: 'Usa una ruta interna como /products o una URL completa.' },
    };
  }

  const compareAt =
    data.compareAtPrice && data.compareAtPrice > 0 ? new Prisma.Decimal(data.compareAtPrice) : null;

  const payload = {
    name: data.name,
    slug: data.slug,
    subtitle: data.subtitle || null,
    description: data.description || '',
    features: parseLines(data.features),
    price: new Prisma.Decimal(data.price),
    compareAtPrice: compareAt,
    sku: data.sku,
    stock: data.stock,
    weightGrams: data.weightGrams,
    lengthCm: data.lengthCm,
    widthCm: data.widthCm,
    heightCm: data.heightCm,
    active: data.active,
    featured: data.featured,
    isNew: data.isNew,
    incoming: data.incoming,
    award: data.award || null,
    position: data.position,
    gtin: data.gtin || null,
    brand: data.brand || null,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    seoImage: data.seoImage || null,
    noIndex: data.noIndex,
  };

  const images = data.images.slice(0, 12);
  let savedId = productId;

  if (productId) {
    await prisma.product.update({ where: { id: productId }, data: payload });
  } else {
    const created = await prisma.product.create({ data: payload });
    savedId = created.id;
  }

  await prisma.productImage.deleteMany({ where: { productId: savedId } });
  if (images.length > 0) {
    await prisma.productImage.createMany({
      data: images.map((url, index) => ({
        productId: savedId,
        url,
        alt: `${data.name} - vista ${index + 1}`,
        position: index,
      })),
    });
  }

  // Variantes: se borran las que el propietario quito, se actualizan las que
  // ya existian y se crean las filas nuevas. El orden de la lista manda.
  const existingVariantIds = new Set(
    (
      await prisma.productVariant.findMany({
        where: { productId: savedId },
        select: { id: true },
      })
    ).map((variant) => variant.id),
  );

  const keptVariantIds = data.variants
    .map((variant) => variant.id)
    .filter((id) => id && existingVariantIds.has(id));

  await prisma.productVariant.deleteMany({
    where: { productId: savedId, id: { notIn: keptVariantIds } },
  });

  for (const [index, variant] of data.variants.entries()) {
    const variantPayload = {
      name: variant.name,
      colorHex: variant.colorHex || null,
      sku: variant.sku,
      priceDelta: new Prisma.Decimal(variant.priceDelta),
      stock: variant.stock,
      position: index,
      active: variant.active,
    };

    // Un id que no pertenece a este producto se trata como fila nueva: asi una
    // peticion manipulada no puede reescribir la variante de otro producto.
    if (variant.id && existingVariantIds.has(variant.id)) {
      await prisma.productVariant.update({ where: { id: variant.id }, data: variantPayload });
    } else {
      await prisma.productVariant.create({ data: { productId: savedId, ...variantPayload } });
    }
  }

  // Bloques de contenido: mismo criterio que las variantes. Los que quedaron
  // sin nada que mostrar se descartan en vez de guardarse vacios, para que la
  // pagina de la tienda no dibuje una franja en blanco.
  const blocks = data.blocks.filter((block) => !blockIsEmpty(block));

  const existingBlockIds = new Set(
    (
      await prisma.productBlock.findMany({
        where: { productId: savedId },
        select: { id: true },
      })
    ).map((block) => block.id),
  );

  const keptBlockIds = blocks
    .map((block) => block.id)
    .filter((id) => id && existingBlockIds.has(id));

  await prisma.productBlock.deleteMany({
    where: { productId: savedId, id: { notIn: keptBlockIds } },
  });

  for (const [index, block] of blocks.entries()) {
    const blockPayload = {
      kind: block.kind,
      eyebrow: block.eyebrow || null,
      title: block.title || null,
      body: block.body || null,
      image: block.image || null,
      images: block.kind === 'gallery' ? block.images.slice(0, 12) : [],
      video: block.video || null,
      theme: block.theme,
      imageSize: block.imageSize,
      imageSide: block.imageSide,
      imageFit: block.imageFit,
      ctaLabel: block.ctaLabel || null,
      ctaHref: safeHref(block.ctaHref) || null,
      position: index,
      active: block.active,
    };

    // Un id ajeno a este producto se trata como bloque nuevo: asi una peticion
    // manipulada no puede reescribir el contenido de otra ficha.
    if (block.id && existingBlockIds.has(block.id)) {
      await prisma.productBlock.update({ where: { id: block.id }, data: blockPayload });
    } else {
      await prisma.productBlock.create({ data: { productId: savedId, ...blockPayload } });
    }
  }

  await prisma.productCollection.deleteMany({ where: { productId: savedId } });
  if (data.collectionIds.length > 0) {
    const validCollections = await prisma.collection.findMany({
      where: { id: { in: data.collectionIds } },
      select: { id: true },
    });
    await prisma.productCollection.createMany({
      data: validCollections.map((collection) => ({
        productId: savedId,
        collectionId: collection.id,
      })),
    });
  }

  await writeAuditLog({
    userId: admin.id,
    action: productId ? 'product.updated' : 'product.created',
    entity: 'Product',
    entityId: savedId,
    metadata: { slug: data.slug },
  });

  revalidatePath('/admin/productos');
  revalidatePath('/products');
  revalidatePath(`/products/${data.slug}`);

  if (!productId) redirect(`/admin/productos/${savedId}?creado=1`);
  return { status: 'ok', message: 'Producto guardado.', errors: {} };
}

export async function toggleProductActive(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const productId = String(formData.get('productId') ?? '');
  if (!productId) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  await prisma.product.update({
    where: { id: productId },
    data: { active: !product.active },
  });

  await writeAuditLog({
    userId: admin.id,
    action: product.active ? 'product.deactivated' : 'product.activated',
    entity: 'Product',
    entityId: productId,
  });

  revalidatePath('/admin/productos');
  revalidatePath('/products');
}

export async function updateStock(formData: FormData): Promise<void> {
  await assertAdmin();
  const productId = String(formData.get('productId') ?? '');
  const stock = Number(formData.get('stock'));

  if (!productId || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return;

  await prisma.product.update({ where: { id: productId }, data: { stock } });
  revalidatePath('/admin/productos');
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const productId = String(formData.get('productId') ?? '');
  if (!productId) return;

  const soldUnits = await prisma.orderItem.count({ where: { productId } });

  // Un producto que ya se vendio no se borra: se desactiva, para no romper el
  // historial de pedidos ni las estadisticas.
  if (soldUnits > 0) {
    await prisma.product.update({ where: { id: productId }, data: { active: false } });
    await writeAuditLog({
      userId: admin.id,
      action: 'product.archived',
      entity: 'Product',
      entityId: productId,
    });
  } else {
    await prisma.product.delete({ where: { id: productId } });
    await writeAuditLog({
      userId: admin.id,
      action: 'product.deleted',
      entity: 'Product',
      entityId: productId,
    });
  }

  revalidatePath('/admin/productos');
  revalidatePath('/products');
  redirect('/admin/productos');
}

// ---------------------------------------------------------------------------
// Colecciones
// ---------------------------------------------------------------------------

export async function saveCollection(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();

  const collectionId = String(formData.get('collectionId') ?? '');
  const rawName = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();

  const parsed = collectionSchema.safeParse({
    name: rawName,
    slug: rawSlug || slugify(rawName),
    tagline: formData.get('tagline'),
    description: formData.get('description'),
    image: formData.get('image'),
    position: formData.get('position') || 0,
    active: checkboxValue(formData, 'active'),
    seoTitle: formData.get('seoTitle'),
    seoDescription: formData.get('seoDescription'),
    seoImage: formData.get('seoImage'),
    noIndex: checkboxValue(formData, 'noIndex'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los campos marcados.',
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  const clash = await prisma.collection.findFirst({
    where: { slug: data.slug, ...(collectionId ? { NOT: { id: collectionId } } : {}) },
  });
  if (clash) {
    return {
      status: 'error',
      message: 'Ya existe otra coleccion con ese slug.',
      errors: { slug: 'Slug en uso.' },
    };
  }

  const payload = {
    name: data.name,
    slug: data.slug,
    tagline: data.tagline || null,
    description: data.description || null,
    image: data.image || null,
    position: data.position,
    active: data.active,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    seoImage: data.seoImage || null,
    noIndex: data.noIndex,
  };

  let savedId = collectionId;
  if (collectionId) {
    await prisma.collection.update({ where: { id: collectionId }, data: payload });
  } else {
    const created = await prisma.collection.create({ data: payload });
    savedId = created.id;
  }

  await writeAuditLog({
    userId: admin.id,
    action: collectionId ? 'collection.updated' : 'collection.created',
    entity: 'Collection',
    entityId: savedId,
    metadata: { slug: data.slug },
  });

  revalidatePath('/admin/colecciones');
  revalidatePath('/', 'layout');
  revalidatePath(`/coleccion/${data.slug}`);

  if (!collectionId) redirect(`/admin/colecciones/${savedId}?creada=1`);
  return { status: 'ok', message: 'Coleccion guardada.', errors: {} };
}

export async function deleteCollection(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const collectionId = String(formData.get('collectionId') ?? '');
  if (!collectionId) return;

  // Al borrar solo se pierde la agrupacion; los productos siguen existiendo.
  await prisma.collection.delete({ where: { id: collectionId } }).catch(() => undefined);
  await writeAuditLog({
    userId: admin.id,
    action: 'collection.deleted',
    entity: 'Collection',
    entityId: collectionId,
  });

  revalidatePath('/admin/colecciones');
  revalidatePath('/', 'layout');
  redirect('/admin/colecciones');
}

// ---------------------------------------------------------------------------
// Cupones
// ---------------------------------------------------------------------------

export async function saveCoupon(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();

  const parsed = couponSchema.safeParse({
    code: formData.get('code'),
    type: formData.get('type'),
    value: formData.get('value'),
    minSubtotal: formData.get('minSubtotal') || 0,
    maxRedemtions: formData.get('maxRedemtions') || null,
    active: checkboxValue(formData, 'active'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los campos del cupon.',
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  if (data.type === 'PERCENT' && data.value > 100) {
    return {
      status: 'error',
      message: 'Un descuento porcentual no puede superar el 100%.',
      errors: { value: 'Maximo 100.' },
    };
  }

  await prisma.coupon.upsert({
    where: { code: data.code },
    create: {
      code: data.code,
      type: data.type,
      value: new Prisma.Decimal(data.value),
      minSubtotal: new Prisma.Decimal(data.minSubtotal),
      maxRedemtions: data.maxRedemtions ? data.maxRedemtions : null,
      active: data.active,
    },
    update: {
      type: data.type,
      value: new Prisma.Decimal(data.value),
      minSubtotal: new Prisma.Decimal(data.minSubtotal),
      maxRedemtions: data.maxRedemtions ? data.maxRedemtions : null,
      active: data.active,
    },
  });

  await writeAuditLog({
    userId: admin.id,
    action: 'coupon.saved',
    entity: 'Coupon',
    entityId: data.code,
  });

  revalidatePath('/admin/cupones');
  return { status: 'ok', message: `Cupon ${data.code} guardado.`, errors: {} };
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const code = String(formData.get('code') ?? '');
  if (!code) return;

  await prisma.coupon.deleteMany({ where: { code } });
  await writeAuditLog({ userId: admin.id, action: 'coupon.deleted', entity: 'Coupon', entityId: code });
  revalidatePath('/admin/cupones');
}

// ---------------------------------------------------------------------------
// Banners de la portada
// ---------------------------------------------------------------------------

export async function saveBanner(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();
  const bannerId = String(formData.get('bannerId') ?? '');

  const parsed = bannerSchema.safeParse({
    placement: formData.get('placement'),
    eyebrow: formData.get('eyebrow'),
    title: formData.get('title'),
    subtitle: formData.get('subtitle'),
    ctaLabel: formData.get('ctaLabel'),
    ctaHref: formData.get('ctaHref'),
    image: formData.get('image'),
    video: formData.get('video'),
    imageMode: formData.get('imageMode'),
    overlay: formData.get('overlay'),
    background: formData.get('background'),
    subtitleBold: checkboxValue(formData, 'subtitleBold'),
    position: formData.get('position') || 0,
    active: checkboxValue(formData, 'active'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los campos marcados.',
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const href = safeHref(data.ctaHref);
  if (data.ctaHref && !href) {
    return {
      status: 'error',
      message: 'El enlace del boton no es valido.',
      errors: { ctaHref: 'Usa una ruta interna como /products o una URL completa.' },
    };
  }

  // El video se guarda solo si se puede reproducir: asi el propietario se
  // entera al guardar y no descubre el banner vacio en la portada.
  if (data.video && !toBannerVideo(data.video)) {
    return {
      status: 'error',
      message: 'El enlace del video no es valido.',
      errors: {
        video: 'Usa un archivo .mp4 o .webm, o un enlace de YouTube o Vimeo.',
      },
    };
  }

  const payload = {
    placement: data.placement,
    eyebrow: data.eyebrow || null,
    title: data.title || null,
    subtitle: data.subtitle || null,
    ctaLabel: data.ctaLabel || null,
    ctaHref: href || null,
    image: data.image || null,
    video: data.video || null,
    imageMode: data.imageMode,
    overlay: data.overlay,
    background: data.background || null,
    subtitleBold: data.subtitleBold,
    position: data.position,
    active: data.active,
  };

  let savedId = bannerId;
  if (bannerId) {
    await prisma.banner.update({ where: { id: bannerId }, data: payload });
  } else {
    const created = await prisma.banner.create({ data: payload });
    savedId = created.id;
  }

  await purgeOrphanImages().catch(() => 0);
  await writeAuditLog({
    userId: admin.id,
    action: bannerId ? 'banner.updated' : 'banner.created',
    entity: 'Banner',
    entityId: savedId,
  });

  revalidatePath('/admin/banners');
  revalidatePath('/');
  if (!bannerId) redirect(`/admin/banners/${savedId}?creado=1`);
  return { status: 'ok', message: 'Banner guardado.', errors: {} };
}

export async function deleteBanner(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const bannerId = String(formData.get('bannerId') ?? '');
  if (!bannerId) return;

  await prisma.banner.delete({ where: { id: bannerId } }).catch(() => undefined);
  await purgeOrphanImages().catch(() => 0);
  await writeAuditLog({ userId: admin.id, action: 'banner.deleted', entity: 'Banner', entityId: bannerId });

  revalidatePath('/admin/banners');
  revalidatePath('/');
  redirect('/admin/banners');
}

// ---------------------------------------------------------------------------
// Tiras de productos de la portada
// ---------------------------------------------------------------------------

export async function saveProductStrip(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();
  const stripId = String(formData.get('stripId') ?? '');

  const parsed = productStripSchema.safeParse({
    title: formData.get('title'),
    placement: formData.get('placement'),
    position: formData.get('position') || 0,
    active: checkboxValue(formData, 'active'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los campos marcados.',
      errors: fieldErrors(parsed.error),
    };
  }

  // El orden de la fila es el orden en que llegan los select del formulario.
  // Se ignoran los vacios y los repetidos: un mismo producto dos veces en la
  // misma tira no aporta nada y chocaria con el indice unico.
  const seen = new Set<string>();
  const productIds = formData
    .getAll('productId')
    .map(String)
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  if (productIds.length === 0) {
    return {
      status: 'error',
      message: 'Elige al menos un producto para la tira.',
      errors: {},
    };
  }

  // Solo se guardan productos que existan de verdad: un id inventado en el
  // formulario reventaria la clave foranea al guardar.
  const existing = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const valid = productIds.filter((id) => existing.some((product) => product.id === id));

  if (valid.length === 0) {
    return {
      status: 'error',
      message: 'Ninguno de los productos elegidos existe todavia.',
      errors: {},
    };
  }

  const data = parsed.data;
  const items = valid.map((productId, index) => ({ productId, position: index }));

  let savedId = stripId;
  if (stripId) {
    // Se reemplazan los productos completos, como en el menu: es mas simple y
    // predecible que casar filas del formulario con registros existentes.
    await prisma.$transaction([
      prisma.productStrip.update({ where: { id: stripId }, data }),
      prisma.productStripItem.deleteMany({ where: { stripId } }),
      prisma.productStripItem.createMany({
        data: items.map((item) => ({ ...item, stripId })),
      }),
    ]);
  } else {
    const created = await prisma.productStrip.create({
      data: { ...data, items: { create: items } },
    });
    savedId = created.id;
  }

  await writeAuditLog({
    userId: admin.id,
    action: stripId ? 'strip.updated' : 'strip.created',
    entity: 'ProductStrip',
    entityId: savedId,
  });

  revalidatePath('/admin/tiras');
  revalidatePath('/');
  if (!stripId) redirect(`/admin/tiras/${savedId}?creado=1`);

  return { status: 'ok', message: 'Tira guardada.', errors: {} };
}

export async function deleteProductStrip(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const stripId = String(formData.get('stripId') ?? '');
  if (!stripId) return;

  await prisma.productStrip.delete({ where: { id: stripId } }).catch(() => undefined);
  await writeAuditLog({
    userId: admin.id,
    action: 'strip.deleted',
    entity: 'ProductStrip',
    entityId: stripId,
  });

  revalidatePath('/admin/tiras');
  revalidatePath('/');
  redirect('/admin/tiras');
}

// ---------------------------------------------------------------------------
// Pago por transferencia
// ---------------------------------------------------------------------------

/** Guarda los datos de la cuenta que se muestran al comprador. */
export async function saveTransferSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const texto = (name: string, max = 120) =>
    String(formData.get(name) ?? '').trim().slice(0, max);

  const valores: Record<string, string> = {
    [TRANSFER_KEYS.enabled]: checkboxValue(formData, 'enabled') ? 'true' : 'false',
    [TRANSFER_KEYS.bank]: texto('bank'),
    [TRANSFER_KEYS.accountType]: texto('accountType'),
    [TRANSFER_KEYS.accountNumber]: texto('accountNumber'),
    [TRANSFER_KEYS.holder]: texto('holder'),
    [TRANSFER_KEYS.taxId]: texto('taxId'),
    [TRANSFER_KEYS.email]: texto('email', 180),
    [TRANSFER_KEYS.notes]: texto('notes', 500),
    [TRANSFER_KEYS.holdHours]: String(parseHoldHours(texto('holdHours', 5))),
  };

  // Activarlo sin los datos dejaria al comprador eligiendo un metodo que no
  // puede completar, asi que se avisa en vez de guardar a medias.
  const activo = valores[TRANSFER_KEYS.enabled] === 'true';
  const faltan = activo && (!valores[TRANSFER_KEYS.bank] || !valores[TRANSFER_KEYS.accountNumber] || !valores[TRANSFER_KEYS.holder]);

  for (const [key, value] of Object.entries(valores)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  await writeAuditLog({ userId: admin.id, action: 'settings.transfer_updated', entity: 'Setting' });
  revalidatePath('/admin/ajustes');
  revalidatePath('/checkout');

  if (faltan) {
    return {
      status: 'error',
      message:
        'Datos guardados, pero faltan el banco, el numero de cuenta o el titular: hasta completarlos la transferencia no se ofrece en el checkout.',
      errors: {},
    };
  }

  return { status: 'ok', message: 'Datos de transferencia guardados.', errors: {} };
}

/**
 * Punto de retiro en tienda.
 *
 * Se guarda aunque falten datos: el propietario puede estar a medio llenarlo.
 * Lo que no se hace es ofrecerlo en el checkout sin direccion, y de eso avisa
 * el mensaje de vuelta.
 */
export async function savePickupSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const texto = (name: string, max = 160) =>
    String(formData.get(name) ?? '').trim().slice(0, max);

  const valores: Record<string, string> = {
    [PICKUP_KEYS.enabled]: checkboxValue(formData, 'enabled') ? 'true' : 'false',
    [PICKUP_KEYS.place]: texto('place'),
    [PICKUP_KEYS.address]: texto('address'),
    [PICKUP_KEYS.commune]: texto('commune'),
    [PICKUP_KEYS.region]: texto('region'),
    [PICKUP_KEYS.hours]: texto('hours'),
    [PICKUP_KEYS.notes]: texto('notes', 500),
    [PICKUP_KEYS.prepDays]: String(parsePrepDays(texto('prepDays', 4))),
  };

  for (const [key, value] of Object.entries(valores)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  await writeAuditLog({ userId: admin.id, action: 'settings.pickup_updated', entity: 'Setting' });
  revalidatePath('/admin/ajustes');
  revalidatePath('/checkout');

  const activo = valores[PICKUP_KEYS.enabled] === 'true';
  const completo = pickupDataIsComplete({
    enabled: activo,
    place: valores[PICKUP_KEYS.place],
    address: valores[PICKUP_KEYS.address],
    commune: valores[PICKUP_KEYS.commune],
    region: valores[PICKUP_KEYS.region],
    hours: valores[PICKUP_KEYS.hours],
    notes: valores[PICKUP_KEYS.notes],
    prepDays: parsePrepDays(valores[PICKUP_KEYS.prepDays]),
  });

  if (activo && !completo) {
    return {
      status: 'error',
      message:
        'Datos guardados, pero faltan la direccion o la comuna: hasta completarlas el retiro no se ofrece en el checkout.',
      errors: {},
    };
  }

  return { status: 'ok', message: 'Datos del retiro guardados.', errors: {} };
}

/** Plazos de despacho y devolucion, que son los que Google necesita saber. */
export async function savePolicySettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const entero = (name: string, max: number) => {
    const parsed = Number.parseInt(String(formData.get(name) ?? ''), 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(max, Math.max(0, parsed));
  };

  const min = entero('deliveryMin', 90);
  const max = entero('deliveryMax', 90);

  const valores: Record<string, string> = {
    [POLICY_KEYS.returnDays]: String(entero('returnDays', 365)),
    [POLICY_KEYS.returnsFree]: checkboxValue(formData, 'returnsFree') ? 'true' : 'false',
    [POLICY_KEYS.deliveryMin]: String(Math.min(min, max)),
    [POLICY_KEYS.deliveryMax]: String(Math.max(min, max)),
    [POLICY_KEYS.handlingDays]: String(entero('handlingDays', 30)),
  };

  for (const [key, value] of Object.entries(valores)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  await writeAuditLog({ userId: admin.id, action: 'settings.policies_updated', entity: 'Setting' });
  revalidatePath('/admin/ajustes');
  revalidatePath('/products', 'layout');

  if (min > max) {
    return {
      status: 'ok',
      message: 'Plazos guardados. El minimo era mayor que el maximo, asi que se ordenaron.',
      errors: {},
    };
  }

  return { status: 'ok', message: 'Plazos guardados.', errors: {} };
}

/** Numero de WhatsApp y perfil de Instagram. */
export async function saveSocialSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const texto = (name: string, max = 200) =>
    String(formData.get(name) ?? '').trim().slice(0, max);

  const whatsapp = normalizeWhatsapp(texto('whatsapp', 30));
  const instagram = normalizeInstagram(texto('instagram'));

  const valores: Record<string, string> = {
    [SOCIAL_KEYS.whatsapp]: whatsapp,
    [SOCIAL_KEYS.whatsappMessage]: texto('whatsappMessage', 300),
    [SOCIAL_KEYS.instagram]: instagram.url,
  };

  for (const [key, value] of Object.entries(valores)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  await writeAuditLog({ userId: admin.id, action: 'settings.social_updated', entity: 'Setting' });
  revalidatePath('/', 'layout');

  const escrito = texto('whatsapp', 30);
  if (escrito && !whatsapp) {
    return {
      status: 'error',
      message: 'El numero de WhatsApp no tiene digitos validos, asi que el boton no se mostrara.',
      errors: {},
    };
  }

  return { status: 'ok', message: 'Canales guardados.', errors: {} };
}

// ---------------------------------------------------------------------------
// Opiniones de producto
// ---------------------------------------------------------------------------

/** Publica o retira una opinion. */
export async function setReviewApproval(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const reviewId = String(formData.get('reviewId') ?? '');
  const approved = formData.get('approved') === 'true';
  if (!reviewId) return;

  const review = await prisma.productReview
    .update({
      where: { id: reviewId },
      data: { approved },
      select: { product: { select: { slug: true } } },
    })
    .catch(() => null);

  await writeAuditLog({
    userId: admin.id,
    action: approved ? 'review.approved' : 'review.hidden',
    entity: 'ProductReview',
    entityId: reviewId,
  });

  if (review) revalidatePath(`/products/${review.product.slug}`);
  revalidatePath('/admin/opiniones');
}

export async function deleteReview(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const reviewId = String(formData.get('reviewId') ?? '');
  if (!reviewId) return;

  const review = await prisma.productReview
    .delete({ where: { id: reviewId }, select: { product: { select: { slug: true } } } })
    .catch(() => null);

  await writeAuditLog({
    userId: admin.id,
    action: 'review.deleted',
    entity: 'ProductReview',
    entityId: reviewId,
  });

  if (review) revalidatePath(`/products/${review.product.slug}`);
  revalidatePath('/admin/opiniones');
}

/**
 * Carga a mano una opinion que llego por otra via.
 *
 * Sirve para las que la tienda recibe por correo o por mensaje y el cliente
 * autoriza a publicar. No sirve para copiar aqui resenas de otro sitio: eso es
 * declarar como opinion de un producto algo que no lo es, y Google lo castiga
 * quitando los resultados enriquecidos de toda la tienda.
 */
export async function addManualReview(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const productId = String(formData.get('productId') ?? '');
  const authorName = String(formData.get('authorName') ?? '').trim().slice(0, 40);
  const rating = Number(formData.get('rating'));
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);

  if (!productId || !authorName || body.length < 10) {
    return { status: 'error', message: 'Faltan el producto, el nombre o el texto.', errors: {} };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: 'error', message: 'La nota va de 1 a 5.', errors: {} };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) return { status: 'error', message: 'Ese producto no existe.', errors: {} };

  await prisma.productReview.create({
    data: { productId, authorName, rating, title: title || null, body, source: 'manual', approved: true },
  });

  await writeAuditLog({
    userId: admin.id,
    action: 'review.created_manual',
    entity: 'ProductReview',
  });

  revalidatePath(`/products/${product.slug}`);
  revalidatePath('/admin/opiniones');

  return { status: 'ok', message: 'Opinion publicada.', errors: {} };
}

// ---------------------------------------------------------------------------
// Menu principal
// ---------------------------------------------------------------------------

export async function saveMenu(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();

  const labels = formData.getAll('label').map(String);
  const hrefs = formData.getAll('href').map(String);
  const actives = formData.getAll('active').map(String);

  const items: { label: string; href: string; position: number; active: boolean }[] = [];

  for (let index = 0; index < labels.length; index += 1) {
    const label = (labels[index] ?? '').trim();
    const rawHref = (hrefs[index] ?? '').trim();

    // Una fila sin texto ni destino es una fila vacia del formulario.
    if (!label && !rawHref) continue;

    const parsed = menuItemSchema.safeParse({
      label,
      href: rawHref,
      position: index,
      active: actives[index] === 'on' || actives[index] === 'true',
    });

    if (!parsed.success) {
      return {
        status: 'error',
        message: `Revisa la fila ${index + 1} del menu.`,
        errors: fieldErrors(parsed.error),
      };
    }

    const href = safeHref(parsed.data.href);
    if (!href) {
      return {
        status: 'error',
        message: `El destino de "${label}" no es valido. Usa /products o una URL completa.`,
        errors: {},
      };
    }

    items.push({ ...parsed.data, href });
  }

  // Se reemplaza el menu completo: es mas simple y predecible que intentar
  // casar filas del formulario con registros existentes.
  await prisma.$transaction([
    prisma.menuItem.deleteMany({}),
    ...(items.length ? [prisma.menuItem.createMany({ data: items })] : []),
  ]);

  await writeAuditLog({ userId: admin.id, action: 'menu.updated', entity: 'MenuItem' });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/menu');

  return {
    status: 'ok',
    message: items.length
      ? `Menu guardado con ${items.length} enlace${items.length === 1 ? '' : 's'}.`
      : 'Menu vaciado: se muestran los enlaces por defecto.',
    errors: {},
  };
}

// ---------------------------------------------------------------------------
// Tarifas de envio
// ---------------------------------------------------------------------------

/**
 * Guarda de una vez las tarifas de todas las regiones.
 *
 * El formulario envia una fila por region: precio, plazo y si se despacha.
 * Una region sin precio se interpreta como "sin tarifa propia" y se borra,
 * de modo que vuelve a aplicarse la tarifa plana general.
 */
export async function saveShippingRates(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const carrier = String(formData.get('carrier') ?? '').trim().slice(0, 80);
  await prisma.setting.upsert({
    where: { key: CARRIER_SETTING_KEY },
    create: { key: CARRIER_SETTING_KEY, value: carrier || 'Despacho estandar' },
    update: { value: carrier || 'Despacho estandar' },
  });

  let saved = 0;
  let cleared = 0;

  for (const region of CHILE_REGIONS) {
    const rawPrice = String(formData.get(`price_${region.code}`) ?? '').trim();
    const rawDays = String(formData.get(`days_${region.code}`) ?? '').trim();
    const active = formData.get(`active_${region.code}`) === 'on';

    // Sin precio y despachando: no hay tarifa propia, se usa la general.
    if (rawPrice === '' && active) {
      const removed = await prisma.shippingRate.deleteMany({
        where: { regionCode: region.code },
      });
      cleared += removed.count;
      continue;
    }

    const price = Number(rawPrice || 0);
    if (!Number.isFinite(price) || price < 0 || price > 99_999_999) {
      return {
        status: 'error',
        message: `El precio de ${region.name} no es valido.`,
        errors: { [`price_${region.code}`]: 'Precio invalido.' },
      };
    }

    const days = rawDays === '' ? null : Number(rawDays);
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 60)) {
      return {
        status: 'error',
        message: `El plazo de ${region.name} no es valido.`,
        errors: { [`days_${region.code}`]: 'Plazo invalido.' },
      };
    }

    await prisma.shippingRate.upsert({
      where: { regionCode: region.code },
      create: {
        regionCode: region.code,
        price: new Prisma.Decimal(price),
        etaDays: days,
        active,
      },
      update: { price: new Prisma.Decimal(price), etaDays: days, active },
    });
    saved += 1;
  }

  await writeAuditLog({
    userId: admin.id,
    action: 'shipping.rates_updated',
    entity: 'ShippingRate',
    metadata: { saved, cleared },
  });

  revalidatePath('/admin/envios');
  return {
    status: 'ok',
    message: `Tarifas guardadas: ${saved} region${saved === 1 ? '' : 'es'} con tarifa propia.`,
    errors: {},
  };
}

// ---------------------------------------------------------------------------
// Clientes y ajustes
// ---------------------------------------------------------------------------

export async function toggleCustomerActive(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const userId = String(formData.get('userId') ?? '');
  if (!userId || userId === admin.id) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await prisma.user.update({ where: { id: userId }, data: { active: !user.active } });
  await writeAuditLog({
    userId: admin.id,
    action: user.active ? 'customer.disabled' : 'customer.enabled',
    entity: 'User',
    entityId: userId,
  });

  revalidatePath('/admin/clientes');
}

/**
 * Guarda el logotipo de la tienda.
 *
 * Se almacena como el resto de las imagenes, servido desde /api/media, y no
 * como data URI incrustada: el logo aparece en todas las paginas y una imagen
 * en base64 dentro del HTML pesaria en cada carga.
 */
/**
 * El mismo formulario sube las tres imagenes de la marca y el campo `slot`
 * decide cual se esta cambiando: el logo principal, el de la empresa que opera
 * la tienda (se turnan en la cabecera) y el icono de la pestana.
 */
function logoKeyFor(formData: FormData): string {
  const slot = String(formData.get('slot') ?? '');
  if (slot === 'secundario') return SECONDARY_LOGO_SETTING_KEY;
  if (slot === 'favicon') return FAVICON_SETTING_KEY;
  if (slot === 'pago') return PAYMENT_LOGO_SETTING_KEY;
  return LOGO_SETTING_KEY;
}

export async function uploadLogo(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();
  const file = formData.get('logo');
  const key = logoKeyFor(formData);
  const isFavicon = key === FAVICON_SETTING_KEY;

  const result = await storeImage(
    file as File,
    isFavicon ? 'Icono de la tienda' : `Logo de ${admin.name}`,
  );
  if ('error' in result) {
    return { status: 'error', message: result.error, errors: {} };
  }

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: result.url },
    update: { value: result.url },
  });

  // El texto alternativo solo acompana al segundo logo: es de otra marca y sin
  // el, un lector de pantalla no tiene forma de nombrarla.
  if (key === SECONDARY_LOGO_SETTING_KEY) {
    const alt = String(formData.get('logoAlt') ?? '').trim().slice(0, 120);
    if (alt) {
      await prisma.setting.upsert({
        where: { key: SECONDARY_LOGO_ALT_SETTING_KEY },
        create: { key: SECONDARY_LOGO_ALT_SETTING_KEY, value: alt },
        update: { value: alt },
      });
    } else {
      await prisma.setting.deleteMany({ where: { key: SECONDARY_LOGO_ALT_SETTING_KEY } });
    }
  }

  await purgeOrphanImages().catch(() => 0);
  await writeAuditLog({
    userId: admin.id,
    action: isFavicon ? 'settings.favicon_updated' : 'settings.logo_updated',
    entity: 'Setting',
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/ajustes');
  return {
    status: 'ok',
    message: isFavicon
      ? 'Icono actualizado. El navegador puede tardar en soltar el anterior: recarga con Ctrl+F5 si sigues viendo el viejo.'
      : 'Logo actualizado.',
    errors: {},
  };
}

export async function removeLogo(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const key = logoKeyFor(formData);

  await prisma.setting.deleteMany({ where: { key } });
  if (key === SECONDARY_LOGO_SETTING_KEY) {
    await prisma.setting.deleteMany({ where: { key: SECONDARY_LOGO_ALT_SETTING_KEY } });
  }

  await purgeOrphanImages().catch(() => 0);
  await writeAuditLog({
    userId: admin.id,
    action: key === FAVICON_SETTING_KEY ? 'settings.favicon_removed' : 'settings.logo_removed',
    entity: 'Setting',
  });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/ajustes');
}

export async function saveSettings(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();

  const entries: Record<string, string> = {
    'store.name': String(formData.get('storeName') ?? '').trim().slice(0, 120),
    'store.email': String(formData.get('storeEmail') ?? '').trim().slice(0, 180),
    'store.announcement': String(formData.get('announcement') ?? '').trim().slice(0, 200),
    'store.heroHeadline': String(formData.get('heroHeadline') ?? '').trim().slice(0, 80),
    'store.metaDescription': String(formData.get('metaDescription') ?? '').trim().slice(0, 320),
    'store.brand': String(formData.get('brand') ?? '').trim().slice(0, 60),
    'store.seoTitle': String(formData.get('seoTitle') ?? '').trim().slice(0, 70),
    'store.seoHeading': String(formData.get('seoHeading') ?? '').trim().slice(0, 120),
    'store.seoText': String(formData.get('seoText') ?? '').trim().slice(0, 900),
    // Una frase por linea; se muestran en la cinta desplazante de la portada.
    'store.marquee': String(formData.get('marquee') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8)
      .join('\n'),
  };

  for (const [key, value] of Object.entries(entries)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  await writeAuditLog({ userId: admin.id, action: 'settings.updated', entity: 'Setting' });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/ajustes');
  return { status: 'ok', message: 'Ajustes guardados.', errors: {} };
}
