'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser, writeAuditLog } from '@/lib/auth';
import { restoreStock } from '@/lib/orders';
import { orderStatusLabel } from '@/lib/order-status';
import {
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
        trackingUrl: data.trackingUrl || null,
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
    active: checkboxValue(formData, 'active'),
    featured: checkboxValue(formData, 'featured'),
    isNew: checkboxValue(formData, 'isNew'),
    award: formData.get('award'),
    position: formData.get('position') || 0,
    collectionIds: formData.getAll('collectionIds').map(String),
    images: formData.get('images'),
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
    active: data.active,
    featured: data.featured,
    isNew: data.isNew,
    award: data.award || null,
    position: data.position,
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

export async function saveSettings(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();

  const entries: Record<string, string> = {
    'store.name': String(formData.get('storeName') ?? '').trim().slice(0, 120),
    'store.email': String(formData.get('storeEmail') ?? '').trim().slice(0, 180),
    'store.announcement': String(formData.get('announcement') ?? '').trim().slice(0, 200),
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
