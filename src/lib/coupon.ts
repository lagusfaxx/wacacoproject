import 'server-only';

import { cookies } from 'next/headers';

/**
 * El cupon vive en una cookie hasta que se confirma el pedido. No se guarda en
 * el carrito para que un cupon vencido no bloquee la compra: al momento de
 * cobrar se vuelve a validar en `priceCart`.
 */
export const COUPON_COOKIE = 'wc_coupon';

export async function getCouponCode(): Promise<string | null> {
  return (await cookies()).get(COUPON_COOKIE)?.value ?? null;
}
