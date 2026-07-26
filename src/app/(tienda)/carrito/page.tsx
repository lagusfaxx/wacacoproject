import type { Metadata } from 'next';
import Link from 'next/link';
import { removeCartItem, updateCartItem } from '@/app/actions/cart';
import { CouponForm } from '@/components/coupon-form';
import { OrderSummary } from '@/components/order-summary';
import { TrashIcon } from '@/components/icons';
import { getCart } from '@/lib/cart';
import { getCouponCode } from '@/lib/coupon';
import { priceCart } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi carrito',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [cart, couponCode] = await Promise.all([getCart(), getCouponCode()]);
  const totals = await priceCart(cart, { couponCode });

  if (totals.lines.length === 0) {
    return (
      <div className="container-site py-24 text-center">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight">
          Tu carrito esta vacio
        </h1>
        <p className="mt-4 text-ink-muted">
          Explora el catalogo y encuentra la cafetera que te acompanara a todas partes.
        </p>
        <Link href="/productos" className="btn-primary mt-8">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="container-site py-12">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-5xl">
        Mi carrito
      </h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <section aria-label="Productos en el carrito">
          <ul className="divide-y divide-sand-dark border-y border-sand-dark">
            {totals.lines.map((line) => {
              const item = cart?.items.find(
                (entry) =>
                  entry.productId === line.productId && entry.variantId === line.variantId,
              );
              if (!item) return null;

              return (
                <li key={item.id} className="flex gap-5 py-6">
                  <Link
                    href={`/productos/${line.slug}`}
                    className="h-28 w-28 shrink-0 bg-sand sm:h-32 sm:w-32"
                  >
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.image}
                        alt={line.name}
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </Link>

                  <div className="flex flex-1 flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/productos/${line.slug}`}
                          className="font-display text-lg font-bold uppercase leading-tight tracking-tight hover:text-brand"
                        >
                          {line.name}
                        </Link>
                        {line.variantName ? (
                          <p className="mt-1 text-xs uppercase tracking-widest text-ink-muted">
                            {line.variantName}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-ink-muted">SKU {line.sku}</p>
                      </div>
                      <p className="font-display text-lg font-semibold">
                        {formatMoney(line.lineTotal)}
                      </p>
                    </div>

                    {!line.inStock ? (
                      <p className="mt-2 text-xs font-semibold text-red-600">
                        {line.available === 0
                          ? 'Sin stock disponible. Quita este producto para continuar.'
                          : `Solo quedan ${line.available} unidades. Ajusta la cantidad.`}
                      </p>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
                      <div className="flex items-center border border-sand-dark">
                        <QuantityButton
                          itemId={item.id}
                          quantity={line.quantity - 1}
                          label="Disminuir cantidad"
                          disabled={line.quantity <= 1}
                        >
                          &minus;
                        </QuantityButton>
                        <span className="min-w-10 text-center text-sm tabular-nums">
                          {line.quantity}
                        </span>
                        <QuantityButton
                          itemId={item.id}
                          quantity={line.quantity + 1}
                          label="Aumentar cantidad"
                          disabled={line.quantity >= 99}
                        >
                          +
                        </QuantityButton>
                      </div>

                      <span className="text-xs text-ink-muted">
                        {formatMoney(line.unitPrice)} c/u
                      </span>

                      <form action={removeCartItem} className="ml-auto">
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted transition-colors hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Quitar
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-8">
            <Link
              href="/productos"
              className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
            >
              Seguir comprando
            </Link>
          </div>
        </section>

        <div>
          <OrderSummary
            totals={{
              subtotal: totals.subtotal.toString(),
              discountTotal: totals.discountTotal.toString(),
              shippingTotal: totals.shippingTotal.toString(),
              taxTotal: totals.taxTotal.toString(),
              total: totals.total.toString(),
              couponCode: totals.couponCode,
              missingForFreeShipping: totals.missingForFreeShipping.toString(),
              freeShippingThreshold: totals.freeShippingThreshold,
              shippingPending: totals.shipping.source === 'pending',
            }}
          >
            {totals.couponError ? (
              <p className="mt-4 text-xs text-red-600">{totals.couponError}</p>
            ) : null}

            {totals.hasStockIssues ? (
              <p className="mt-5 border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                Ajusta las cantidades marcadas antes de continuar al pago.
              </p>
            ) : (
              <Link href="/checkout" className="btn-primary mt-6 w-full">
                Ir a pagar
              </Link>
            )}

            <div className="mt-6">
              <CouponForm currentCode={totals.couponCode ?? couponCode} />
            </div>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}

function QuantityButton({
  itemId,
  quantity,
  label,
  disabled,
  children,
}: {
  itemId: string;
  quantity: number;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={updateCartItem}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="quantity" value={Math.max(0, quantity)} />
      <button
        type="submit"
        aria-label={label}
        disabled={disabled}
        className="px-3.5 py-2.5 text-base text-ink-soft transition-colors hover:text-brand disabled:opacity-40"
      >
        {children}
      </button>
    </form>
  );
}
