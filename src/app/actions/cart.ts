'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { addQuantity, getOrCreateCart } from '@/lib/cart';
import { COUPON_COOKIE } from '@/lib/coupon';
import { cartItemSchema, quantitySchema } from '@/lib/validation';

export type CartActionState = { status: 'idle' | 'ok' | 'error'; message: string };

export async function addToCart(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const parsed = cartItemSchema.safeParse({
    productId: formData.get('productId'),
    variantId: formData.get('variantId') || null,
    quantity: formData.get('quantity') ?? 1,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'No pudimos agregar el producto.' };
  }

  const { productId, variantId, quantity } = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    include: { variants: true },
  });
  if (!product) {
    return { status: 'error', message: 'El producto ya no esta disponible.' };
  }

  // La variante debe pertenecer al producto: sin esta comprobacion se podria
  // enviar el id de una variante de otro producto mas barato.
  const variant = variantId ? product.variants.find((v) => v.id === variantId && v.active) : null;
  if (variantId && !variant) {
    return { status: 'error', message: 'La opcion seleccionada ya no esta disponible.' };
  }
  if (product.variants.some((v) => v.active) && !variant) {
    return { status: 'error', message: 'Selecciona una opcion antes de agregar al carrito.' };
  }

  const cart = await getOrCreateCart();
  const existing = cart.items.find(
    (item) => item.productId === productId && item.variantId === (variant?.id ?? null),
  );

  const stock = variant ? variant.stock : product.stock;
  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > stock) {
    return {
      status: 'error',
      message:
        stock === 0
          ? 'Producto sin stock por el momento.'
          : `Solo quedan ${stock} unidades disponibles.`,
    };
  }

  await addQuantity(cart.id, productId, variant?.id ?? null, quantity);
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

  revalidatePath('/', 'layout');
  return { status: 'ok', message: `${product.name} se agrego a tu carrito.` };
}

export async function updateCartItem(formData: FormData): Promise<void> {
  const parsed = quantitySchema.safeParse({
    itemId: formData.get('itemId'),
    quantity: formData.get('quantity'),
  });
  if (!parsed.success) return;

  const cart = await getOrCreateCart();
  const item = cart.items.find((entry) => entry.id === parsed.data.itemId);
  // Solo se puede modificar una linea del propio carrito.
  if (!item) return;

  if (parsed.data.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    const stock = item.variant ? item.variant.stock : item.product.stock;
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: Math.min(parsed.data.quantity, Math.max(stock, 1)) },
    });
  }

  revalidatePath('/carrito');
  revalidatePath('/', 'layout');
}

export async function removeCartItem(formData: FormData): Promise<void> {
  const itemId = String(formData.get('itemId') ?? '');
  if (!itemId) return;

  const cart = await getOrCreateCart();
  if (!cart.items.some((entry) => entry.id === itemId)) return;

  await prisma.cartItem.delete({ where: { id: itemId } });
  revalidatePath('/carrito');
  revalidatePath('/', 'layout');
}

export async function applyCoupon(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const raw = String(formData.get('couponCode') ?? '').trim().toUpperCase();
  const store = await cookies();

  if (!raw) {
    store.delete(COUPON_COOKIE);
    revalidatePath('/carrito');
    return { status: 'ok', message: 'Cupon eliminado.' };
  }

  if (raw.length > 40 || !/^[A-Z0-9_-]+$/.test(raw)) {
    return { status: 'error', message: 'El codigo ingresado no es valido.' };
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: raw } });
  if (!coupon || !coupon.active) {
    return { status: 'error', message: 'El cupon no existe o ya no esta disponible.' };
  }

  store.set(COUPON_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  revalidatePath('/carrito');
  return { status: 'ok', message: `Cupon ${raw} aplicado.` };
}
