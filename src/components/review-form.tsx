'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitReview, type ReviewState } from '@/app/actions/reviews';

const initialState: ReviewState = { status: 'idle', message: '' };

/**
 * Formulario para calificar un producto ya recibido.
 *
 * Aparece en el detalle del pedido, que es el unico sitio donde se sabe que
 * esta persona compro esto de verdad.
 */
export function ReviewForm({
  orderId,
  productId,
  productName,
}: {
  orderId: string;
  productId: string;
  productName: string;
}) {
  const [state, formAction] = useActionState(submitReview, initialState);
  const [rating, setRating] = useState(0);
  const [encima, setEncima] = useState(0);

  if (state.status === 'ok') {
    return (
      <p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {state.message}
      </p>
    );
  }

  const marcadas = encima || rating;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />

      <fieldset>
        <legend className="label">Tu nota para {productName}</legend>
        <div className="mt-2 flex gap-1" onMouseLeave={() => setEncima(0)}>
          {[1, 2, 3, 4, 5].map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setRating(valor)}
              onMouseEnter={() => setEncima(valor)}
              aria-label={`${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`}
              aria-pressed={rating === valor}
              className={`text-3xl leading-none transition-colors ${
                valor <= marcadas ? 'text-brand' : 'text-sand-dark hover:text-brand/50'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Titulo (opcional)</span>
        <input
          name="title"
          maxLength={120}
          className="field"
          placeholder="Justo lo que buscaba"
        />
      </label>

      <label className="block">
        <span className="label">Tu opinion</span>
        <textarea
          name="body"
          rows={4}
          maxLength={2000}
          required
          className="field"
          placeholder="Como te resulto, para que lo usas, que le mejorarias."
        />
      </label>

      {state.status === 'error' ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <Enviar disabled={rating === 0} />

      <p className="text-xs text-ink-muted">
        Se publica con tu nombre de pila y la marca de compra verificada, en cuanto la revisemos.
      </p>
    </form>
  );
}

function Enviar({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="btn-primary btn-sm py-3">
      {pending ? 'Enviando...' : 'Enviar opinion'}
    </button>
  );
}
