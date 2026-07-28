'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveProductStrip } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/** Las mismas franjas anchas donde se pueden poner banners, sin el carrusel. */
const PLACEMENTS = [
  {
    value: 'destacado',
    label: 'Bajo "Mas vendidos"',
    hint: 'En medio de la portada, junto a las franjas de banner de esa zona.',
  },
  {
    value: 'inferior',
    label: 'Bajo "Colecciones"',
    hint: 'Mas abajo, antes de los beneficios.',
  },
];

const MAX_ITEMS = 8;

export type ProductOption = { id: string; name: string; active: boolean };

export type ProductStripFormValues = {
  id: string;
  title: string;
  placement: string;
  position: number;
  active: boolean;
  productIds: string[];
};

export function ProductStripForm({
  values,
  products,
}: {
  values: ProductStripFormValues;
  products: ProductOption[];
}) {
  const [state, formAction] = useActionState(saveProductStrip, initialState);
  const [placement, setPlacement] = useState(
    PLACEMENTS.some((option) => option.value === values.placement) ? values.placement : 'destacado',
  );
  // Una fila vacia de entrada para que el formulario nuevo ya invite a elegir.
  const [rows, setRows] = useState<string[]>(values.productIds.length ? values.productIds : ['']);

  function update(index: number, productId: string) {
    setRows((current) => current.map((row, i) => (i === index ? productId : row)));
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function remove(index: number) {
    setRows((current) => (current.length === 1 ? [''] : current.filter((_, i) => i !== index)));
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values.id ? <input type="hidden" name="stripId" value={values.id} /> : null}
      <input type="hidden" name="placement" value={placement} />

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

      <section className="border border-sand-dark bg-white">
        <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
          Titulo y lugar
        </h2>
        <div className="space-y-5 p-6">
          <div>
            <label className="label" htmlFor="strip-title">
              Titulo de la tira
            </label>
            <input
              id="strip-title"
              name="title"
              defaultValue={values.title}
              maxLength={60}
              placeholder="Productos estrella"
              className={`field ${state.errors.title ? 'field-error' : ''}`}
            />
            {state.errors.title ? (
              <span className="error-text">{state.errors.title}</span>
            ) : (
              <span className="mt-1 block text-xs text-ink-muted">
                Es el titulo que se lee sobre la fila, como &quot;Mas vendidos&quot;.
              </span>
            )}
          </div>

          <fieldset>
            <legend className="label">Donde se muestra</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {PLACEMENTS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 border-2 p-3 transition-colors ${
                    placement === option.value
                      ? 'border-ink bg-sand/40'
                      : 'border-sand-dark hover:border-ink-soft'
                  }`}
                >
                  <input
                    type="radio"
                    name="placementChoice"
                    value={option.value}
                    checked={placement === option.value}
                    onChange={() => setPlacement(option.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#E1580E]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="border border-sand-dark bg-white">
        <div className="border-b border-sand-dark px-6 py-4">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Productos de la tira
          </h2>
          <p className="mt-1.5 text-xs text-ink-muted">
            Eliges tu los productos y el orden de las filas es el orden en que
            aparecen. Se muestran hasta {MAX_ITEMS}.
          </p>
        </div>

        <ul className="divide-y divide-sand-dark">
          {rows.map((productId, index) => (
            <li key={index} className="flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-56 flex-1">
                <label className="label" htmlFor={`strip-product-${index}`}>
                  Producto {index + 1}
                </label>
                <select
                  id={`strip-product-${index}`}
                  name="productId"
                  value={productId}
                  onChange={(event) => update(index, event.target.value)}
                  className="field py-2"
                >
                  <option value="">Elige un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.active ? '' : ' (oculto)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 pb-1.5">
                <IconButton label="Subir" onClick={() => move(index, -1)} disabled={index === 0}>
                  ↑
                </IconButton>
                <IconButton
                  label="Bajar"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  ↓
                </IconButton>
                <IconButton label="Quitar" onClick={() => remove(index)}>
                  ×
                </IconButton>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-sand-dark p-4">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, ''])}
            disabled={rows.length >= MAX_ITEMS}
            className="btn border-2 border-ink px-5 py-2.5 text-ink transition-colors hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Agregar producto
          </button>
        </div>
      </section>

      <section className="border border-sand-dark bg-white">
        <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
          Visibilidad
        </h2>
        <div className="space-y-5 p-6">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={values.active}
              className="h-4 w-4 accent-[#E1580E]"
            />
            Mostrar en la portada
          </label>
          <div>
            <label className="label" htmlFor="strip-position">
              Orden
            </label>
            <input
              id="strip-position"
              name="position"
              type="number"
              min="0"
              defaultValue={String(values.position)}
              className={`field ${state.errors.position ? 'field-error' : ''}`}
            />
            {state.errors.position ? (
              <span className="error-text">{state.errors.position}</span>
            ) : (
              <span className="mt-1 block text-xs text-ink-muted">
                Decide el lugar de esta tira frente a las demas de su misma franja.
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 border-t border-sand-dark bg-white px-6 py-4">
        <SubmitButton isNew={!values.id} />
      </div>
    </form>
  );
}

function SubmitButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Guardando...' : isNew ? 'Crear tira' : 'Guardar cambios'}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center border border-sand-dark text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
