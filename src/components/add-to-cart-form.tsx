'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addToCart, type CartActionState } from '@/app/actions/cart';
import { PlaneIcon } from './icons';

export type VariantOption = {
  id: string;
  name: string;
  colorHex: string | null;
  stock: number;
  priceLabel: string;
};

const initialState: CartActionState = { status: 'idle', message: '' };

export function AddToCartForm({
  productId,
  variants,
  stock,
  incoming = false,
}: {
  productId: string;
  variants: VariantOption[];
  stock: number;
  /** Reposicion en camino: cambia el aviso de agotado, no la posibilidad de comprar. */
  incoming?: boolean;
}) {
  const [state, formAction] = useActionState(addToCart, initialState);
  const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState<string | null>(firstAvailable?.id ?? null);
  const [quantity, setQuantity] = useState(1);

  const selected = variants.find((variant) => variant.id === selectedId) ?? null;
  const availableStock = variants.length > 0 ? (selected?.stock ?? 0) : stock;
  const soldOut = availableStock <= 0;

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="productId" value={productId} />
      {selectedId ? <input type="hidden" name="variantId" value={selectedId} /> : null}
      <input type="hidden" name="quantity" value={quantity} />

      {variants.length > 0 ? (
        <fieldset className="mb-8">
          <legend className="label">
            Color{selected ? `: ${selected.name}` : ''}
          </legend>
          <div className="flex flex-wrap gap-3">
            {variants.map((variant) => {
              const isSelected = variant.id === selectedId;
              const unavailable = variant.stock <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  aria-pressed={isSelected}
                  title={unavailable ? `${variant.name} - agotado` : variant.name}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all ${
                    isSelected ? 'border-ink' : 'border-transparent hover:border-sand-dark'
                  } ${unavailable ? 'opacity-40' : ''}`}
                >
                  <span
                    className="h-8 w-8 rounded-full border border-black/10"
                    style={{ backgroundColor: variant.colorHex ?? '#CCCCCC' }}
                  />
                  {unavailable ? (
                    <span
                      aria-hidden="true"
                      className="absolute h-[2px] w-9 rotate-45 bg-ink"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex items-center border border-sand-dark">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="px-4 py-3 text-lg text-ink-soft transition-colors hover:text-brand disabled:opacity-40"
            disabled={quantity <= 1}
            aria-label="Disminuir cantidad"
          >
            &minus;
          </button>
          <span className="min-w-10 text-center font-display text-base tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(availableStock || 1, value + 1))}
            className="px-4 py-3 text-lg text-ink-soft transition-colors hover:text-brand disabled:opacity-40"
            disabled={quantity >= availableStock}
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>

        <SubmitButton soldOut={soldOut} incoming={incoming} />
      </div>

      {soldOut && incoming ? (
        <p className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest text-ink-soft">
          <PlaneIcon className="h-4 w-4 shrink-0 text-brand" />
          En camino, llega pronto
        </p>
      ) : (
        <p className="mt-4 text-xs uppercase tracking-widest text-ink-muted">
          {soldOut
            ? 'Sin stock por el momento'
            : availableStock <= 5
              ? `Quedan ${availableStock} unidades`
              : 'Disponible para envio inmediato'}
        </p>
      )}

      {state.message ? (
        <div
          role="status"
          className={`mt-4 border px-4 py-3 text-sm ${
            state.status === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{state.message}</span>
          {state.status === 'ok' ? (
            <Link href="/carrito" className="ml-2 font-semibold underline underline-offset-2">
              Ver carrito
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function SubmitButton({ soldOut, incoming }: { soldOut: boolean; incoming: boolean }) {
  const { pending } = useFormStatus();
  // El boton sigue apagado aunque venga reposicion: no hay unidades que
  // reservar todavia, y prometer una compra que no se puede completar seria
  // peor que decir que no hay.
  return (
    <button type="submit" disabled={soldOut || pending} className="btn-primary flex-1">
      {soldOut
        ? incoming
          ? 'En camino'
          : 'Agotado'
        : pending
          ? 'Agregando...'
          : 'Agregar al carrito'}
    </button>
  );
}
