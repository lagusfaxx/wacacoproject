import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';
import { round, toDecimal } from './money';
import type { CartWithItems } from './cart';
import {
  pendingShipping,
  pickupShipping,
  quoteShipping,
  type ShipmentDestination,
  type ShippingResult,
} from './shipping';
import { getPickupSettings, pickupIsUsable } from './pickup';
import { shippingCarrierName } from './store-settings';

export type PricedLine = {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  slug: string;
  sku: string;
  image: string | null;
  unitPrice: Prisma.Decimal;
  quantity: number;
  lineTotal: Prisma.Decimal;
  /** Unidades realmente disponibles; menor que `quantity` si falta stock. */
  available: number;
  inStock: boolean;
};

export type CartTotals = {
  lines: PricedLine[];
  itemCount: number;
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  shippingTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  couponCode: string | null;
  couponError: string | null;
  freeShippingThreshold: number;
  missingForFreeShipping: Prisma.Decimal;
  hasStockIssues: boolean;
  /** Transportista, servicio y origen de la tarifa aplicada. */
  shipping: ShippingResult;
};

/**
 * Unica fuente de verdad de los importes.
 *
 * Los precios se leen siempre de la base de datos: el cliente solo puede
 * elegir *que* compra y *cuanto*, nunca a que precio.
 */
export async function priceCart(
  cart: CartWithItems | null,
  options: {
    couponCode?: string | null;
    destination?: ShipmentDestination | null;
    /** true = el comprador retira en tienda, asi que no se cobra envio. */
    pickup?: boolean;
  } = {},
): Promise<CartTotals> {
  const lines: PricedLine[] = [];
  const parcelItems: { quantity: number; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number }[] = [];

  for (const item of cart?.items ?? []) {
    if (!item.product.active) continue;

    const variant = item.variant && item.variant.active ? item.variant : null;
    const unitPrice = round(
      toDecimal(item.product.price).plus(variant ? toDecimal(variant.priceDelta) : 0),
    );
    const stock = variant ? variant.stock : item.product.stock;
    const quantity = Math.max(1, Math.min(item.quantity, 99));
    const available = Math.max(0, Math.min(quantity, stock));

    lines.push({
      productId: item.productId,
      variantId: variant?.id ?? null,
      name: item.product.name,
      variantName: variant?.name ?? null,
      slug: item.product.slug,
      sku: variant?.sku ?? item.product.sku,
      image: item.product.images[0]?.url ?? null,
      unitPrice,
      quantity,
      lineTotal: round(unitPrice.times(quantity)),
      available,
      inStock: available >= quantity,
    });

    parcelItems.push({
      quantity,
      weightGrams: item.product.weightGrams,
      lengthCm: item.product.lengthCm,
      widthCm: item.product.widthCm,
      heightCm: item.product.heightCm,
    });
  }

  const subtotal = round(
    lines.reduce((acc, line) => acc.plus(line.lineTotal), new Prisma.Decimal(0)),
  );

  const { discount, couponCode, couponError } = await resolveCoupon(options.couponCode, subtotal);
  const discountedSubtotal = subtotal.minus(discount);

  const shipping =
    lines.length === 0
      ? pendingShipping()
      : await resolveShipping({
          pickup: options.pickup === true,
          items: parcelItems,
          payableSubtotal: discountedSubtotal,
          destination: options.destination ?? null,
        });

  const shippingTotal = round(shipping.cost);
  const taxTotal = round(discountedSubtotal.times(env.taxRate).dividedBy(100));
  const total = round(discountedSubtotal.plus(shippingTotal).plus(taxTotal));

  const threshold = env.freeShippingThreshold;
  const qualifiesFreeShipping =
    threshold > 0 && discountedSubtotal.greaterThanOrEqualTo(threshold);

  const missingForFreeShipping =
    threshold > 0 && !qualifiesFreeShipping && lines.length > 0
      ? round(toDecimal(threshold).minus(discountedSubtotal))
      : new Prisma.Decimal(0);

  return {
    lines,
    itemCount: lines.reduce((acc, line) => acc + line.quantity, 0),
    subtotal,
    discountTotal: discount,
    shippingTotal,
    taxTotal,
    total,
    couponCode,
    couponError,
    freeShippingThreshold: threshold,
    missingForFreeShipping,
    hasStockIssues: lines.some((line) => !line.inStock),
    shipping,
  };
}

/**
 * Elige entre retiro y despacho.
 *
 * Que el comprador pida retiro no basta: se comprueba contra los ajustes, de
 * modo que un formulario manipulado no pueda saltarse el costo del envio de
 * una tienda que no ofrece retiro.
 */
async function resolveShipping(input: {
  pickup: boolean;
  items: { quantity: number; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number }[];
  payableSubtotal: Prisma.Decimal;
  destination: ShipmentDestination | null;
}): Promise<ShippingResult> {
  if (input.pickup) {
    const pickup = await getPickupSettings();
    if (pickupIsUsable(pickup)) {
      return pickupShipping(pickup.place || pickup.address);
    }
  }

  return quoteShipping({
    items: input.items,
    payableSubtotal: input.payableSubtotal,
    destination: input.destination,
    carrierName: await shippingCarrierName(),
  });
}

async function resolveCoupon(
  code: string | null | undefined,
  subtotal: Prisma.Decimal,
): Promise<{ discount: Prisma.Decimal; couponCode: string | null; couponError: string | null }> {
  const none = { discount: new Prisma.Decimal(0), couponCode: null, couponError: null };
  if (!code) return none;

  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.active) {
    return { ...none, couponError: 'El cupon no existe o ya no esta disponible.' };
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ...none, couponError: 'El cupon todavia no esta vigente.' };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { ...none, couponError: 'El cupon ya expiro.' };
  }
  if (coupon.maxRedemtions !== null && coupon.timesRedeemed >= coupon.maxRedemtions) {
    return { ...none, couponError: 'El cupon alcanzo su limite de usos.' };
  }
  if (subtotal.lessThan(toDecimal(coupon.minSubtotal))) {
    return { ...none, couponError: 'Tu carrito no alcanza el minimo requerido por el cupon.' };
  }

  const raw =
    coupon.type === 'PERCENT'
      ? subtotal.times(toDecimal(coupon.value)).dividedBy(100)
      : toDecimal(coupon.value);

  // El descuento nunca puede superar el subtotal.
  const discount = round(Prisma.Decimal.min(raw, subtotal));
  return { discount, couponCode: coupon.code, couponError: null };
}
