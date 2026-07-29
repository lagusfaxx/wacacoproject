'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addManualReview, type AdminState } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/**
 * Carga una opinion que la tienda recibio por fuera.
 *
 * Es para las que llegan por correo o por mensaje y el cliente autoriza a
 * publicar. Se publica directa, porque quien la carga es quien la aprobaria.
 */
export function ManualReviewForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(addManualReview, initialState);
  const [rating, setRating] = useState(5);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="rating" value={rating} />

      {state.message ? (
        <p
          role="status"
          className={`border px-4 py-3 text-sm ${
            state.status === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Producto</span>
          <select name="productId" className="field" required>
            <option value="">Elige un producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Nombre de quien opina</span>
          <input name="authorName" maxLength={40} required className="field" placeholder="Antony" />
        </label>
      </div>

      <fieldset>
        <legend className="label">Nota</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setRating(valor)}
              aria-label={`${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`}
              aria-pressed={rating === valor}
              className={`text-3xl leading-none transition-colors ${
                valor <= rating ? 'text-brand' : 'text-sand-dark hover:text-brand/50'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Titulo (opcional)</span>
        <input name="title" maxLength={120} className="field" placeholder="Increible" />
      </label>

      <label className="block">
        <span className="label">Texto de la opinion</span>
        <textarea name="body" rows={4} maxLength={2000} required className="field" />
      </label>

      <Guardar />

      <p className="text-xs text-ink-muted">
        Se publica al instante y sin la marca de compra verificada, que se reserva para las
        opiniones que salen de un pedido de la tienda.
      </p>
    </form>
  );
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-sm py-3">
      {pending ? 'Publicando...' : 'Publicar opinion'}
    </button>
  );
}
