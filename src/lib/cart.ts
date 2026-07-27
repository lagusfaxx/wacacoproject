import 'server-only';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { getSessionPayload, isSecureRequest } from './auth';
import { CART_COOKIE } from './session-token';

const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 dias

export type CartWithItems = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        product: { include: { images: true } };
        variant: true;
      };
    };
  };
}>;

const cartInclude = {
  items: {
    include: {
      product: { include: { images: { orderBy: { position: 'asc' } } } },
      variant: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CartInclude;

function newCartToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Carrito para renderizar (solo lectura). Los Server Components no pueden
 * escribir cookies, asi que aqui nunca se crea un carrito nuevo.
 */
export async function getCart(): Promise<CartWithItems | null> {
  const session = await getSessionPayload();
  const token = (await cookies()).get(CART_COOKIE)?.value;

  if (session) {
    const userCart = await prisma.cart.findFirst({
      where: { userId: session.sub },
      include: cartInclude,
      orderBy: { updatedAt: 'desc' },
    });
    if (userCart) return userCart;
  }

  if (!token) return null;
  return prisma.cart.findUnique({ where: { token }, include: cartInclude });
}

/**
 * Carrito para mutar. Solo debe llamarse desde Server Actions o Route
 * Handlers, ya que puede necesitar escribir la cookie del carrito.
 */
export async function getOrCreateCart(): Promise<CartWithItems> {
  const session = await getSessionPayload();
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;

  const anonymousCart = token
    ? await prisma.cart.findUnique({ where: { token }, include: cartInclude })
    : null;

  if (!session) {
    if (anonymousCart) return anonymousCart;
    const created = await prisma.cart.create({
      data: { token: newCartToken() },
      include: cartInclude,
    });
    await setCartCookie(store, created.token);
    return created;
  }

  const userCart = await prisma.cart.findFirst({
    where: { userId: session.sub },
    include: cartInclude,
    orderBy: { updatedAt: 'desc' },
  });

  // Al iniciar sesion, lo que el visitante habia agregado como invitado se
  // fusiona con su carrito guardado en lugar de perderse.
  if (userCart && anonymousCart && anonymousCart.id !== userCart.id) {
    await mergeCarts(anonymousCart, userCart.id);
    await prisma.cart.delete({ where: { id: anonymousCart.id } }).catch(() => undefined);
    const merged = await prisma.cart.findUnique({
      where: { id: userCart.id },
      include: cartInclude,
    });
    await setCartCookie(store, merged!.token);
    return merged!;
  }

  if (userCart) {
    await setCartCookie(store, userCart.token);
    return userCart;
  }

  if (anonymousCart) {
    const claimed = await prisma.cart.update({
      where: { id: anonymousCart.id },
      data: { userId: session.sub },
      include: cartInclude,
    });
    return claimed;
  }

  const created = await prisma.cart.create({
    data: { token: newCartToken(), userId: session.sub },
    include: cartInclude,
  });
  await setCartCookie(store, created.token);
  return created;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

async function setCartCookie(store: CookieStore, token: string) {
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isSecureRequest(),
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

async function mergeCarts(source: CartWithItems, targetCartId: string) {
  for (const item of source.items) {
    await addQuantity(targetCartId, item.productId, item.variantId, item.quantity);
  }
}

/**
 * Suma unidades de una linea creandola si no existe.
 *
 * No se usa `upsert` sobre el indice unico compuesto porque en Postgres dos
 * filas con `variantId = NULL` se consideran distintas, y los productos sin
 * variante se duplicarian en el carrito.
 */
export async function addQuantity(
  cartId: string,
  productId: string,
  variantId: string | null,
  quantity: number,
): Promise<void> {
  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productId, variantId },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
    return;
  }

  await prisma.cartItem.create({ data: { cartId, productId, variantId, quantity } });
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

export function cartItemCount(cart: CartWithItems | null): number {
  if (!cart) return 0;
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}
