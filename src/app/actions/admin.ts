'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser, writeAuditLog } from '@/lib/auth';
import { restoreStock } from '@/lib/orders';
import { trackingUrlFor } from '@/lib/shipping';
import { CARRIER_SETTING_KEY, LOGO_SETTING_KEY } from '@/lib/store-settings';
import { CHILE_REGIONS } from '@/lib/regions-cl';
import { orderStatusLabel } from '@/lib/order-status';
import {
  collectionSchema,
  couponSchema,
  fieldErrors,
  orderUpdateSchema,
  productSchema,
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

  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${order.number}`);
  return { status: 'ok', message: 'Pedido actualizado.', errors: {} };
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
    award: formData.get('award'),
    position: formData.get('position') || 0,
    collectionIds: formData.getAll('collectionIds').map(String),
    images: formData.get('images'),
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
    award: data.award || null,
    position: data.position,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    seoImage: data.seoImage || null,
    noIndex: data.noIndex,
  };

  const images = parseLines(data.images);
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
  revalidatePath('/productos');
  revalidatePath(`/productos/${data.slug}`);

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
  revalidatePath('/productos');
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
  revalidatePath('/productos');
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

const MAX_LOGO_BYTES = 256 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/**
 * Guarda el logotipo de la tienda como data URI en la base de datos.
 *
 * Se evita el sistema de archivos a proposito: el contenedor de Coolify es
 * efimero y un logo escrito en disco desapareceria en el siguiente despliegue.
 */
export async function uploadLogo(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();
  const file = formData.get('logo');

  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Selecciona un archivo de imagen.', errors: {} };
  }

  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return {
      status: 'error',
      message: 'Formato no admitido. Usa PNG, JPG, WEBP o SVG.',
      errors: {},
    };
  }

  if (file.size > MAX_LOGO_BYTES) {
    return {
      status: 'error',
      message: `La imagen pesa ${Math.round(file.size / 1024)} KB. El maximo es 256 KB.`,
      errors: {},
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Un SVG puede traer scripts. Se muestra dentro de una etiqueta <img>, donde
  // no se ejecutan, pero se rechaza igualmente para no guardarlo en la base.
  if (file.type === 'image/svg+xml') {
    const source = buffer.toString('utf8').toLowerCase();
    if (source.includes('<script') || source.includes('javascript:') || /\son\w+\s*=/.test(source)) {
      return {
        status: 'error',
        message: 'El SVG contiene codigo ejecutable y no se puede usar como logo.',
        errors: {},
      };
    }
  }

  const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

  await prisma.setting.upsert({
    where: { key: LOGO_SETTING_KEY },
    create: { key: LOGO_SETTING_KEY, value: dataUri },
    update: { value: dataUri },
  });

  await writeAuditLog({ userId: admin.id, action: 'settings.logo_updated', entity: 'Setting' });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/ajustes');
  return { status: 'ok', message: 'Logo actualizado.', errors: {} };
}

export async function removeLogo(): Promise<void> {
  const admin = await assertAdmin();
  await prisma.setting.deleteMany({ where: { key: LOGO_SETTING_KEY } });
  await writeAuditLog({ userId: admin.id, action: 'settings.logo_removed', entity: 'Setting' });
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
