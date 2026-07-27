'use client';

import { useState } from 'react';

/**
 * Editor de variantes de un producto (colores o versiones).
 *
 * Las filas viajan al servidor como JSON en un campo oculto: son un numero
 * variable de registros y cada uno tiene seis campos, asi que nombrarlos uno
 * por uno en el formulario seria mas fragil que serializarlos.
 *
 * Una fila sin `id` es una variante nueva; las que el propietario elimina
 * desaparecen del JSON y el servidor las borra.
 */
export type VariantRow = {
  id: string;
  name: string;
  colorHex: string;
  sku: string;
  priceDelta: string;
  stock: string;
  active: boolean;
};

export function emptyVariant(): VariantRow {
  return { id: '', name: '', colorHex: '#000000', sku: '', priceDelta: '0', stock: '0', active: true };
}

export function VariantsField({
  name,
  defaultValue,
  currency,
  error,
}: {
  name: string;
  defaultValue: VariantRow[];
  currency: string;
  error?: string;
}) {
  const [rows, setRows] = useState<VariantRow[]>(defaultValue);

  function update(index: number, patch: Partial<VariantRow>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row!);
      return next;
    });
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />

      <p className="text-xs text-ink-muted">
        Cada variante es un color o version con su propio SKU y stock. Si el producto
        no tiene variantes, deja la lista vacia y se vende con el stock general.
      </p>

      {error ? <span className="error-text mt-2 block">{error}</span> : null}

      {rows.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {rows.map((row, index) => (
            <li key={row.id || `nueva-${index}`} className="border border-sand-dark p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_auto_1.2fr_1fr_0.8fr]">
                <label className="block">
                  <span className="label">Nombre</span>
                  <input
                    className="field"
                    value={row.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    placeholder="Negro"
                    maxLength={80}
                  />
                </label>

                <label className="block">
                  <span className="label">Color</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-[46px] w-14 shrink-0 cursor-pointer border border-sand-dark bg-white p-1"
                      value={/^#[0-9a-fA-F]{6}$/.test(row.colorHex) ? row.colorHex : '#000000'}
                      onChange={(event) => update(index, { colorHex: event.target.value })}
                      aria-label={`Color de la variante ${index + 1}`}
                    />
                    {row.colorHex ? (
                      <button
                        type="button"
                        onClick={() => update(index, { colorHex: '' })}
                        className="text-xs text-ink-muted underline underline-offset-2 hover:text-brand"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </span>
                </label>

                <label className="block">
                  <span className="label">SKU</span>
                  <input
                    className="field"
                    value={row.sku}
                    onChange={(event) => update(index, { sku: event.target.value })}
                    placeholder="MP-GR2-NEG"
                    maxLength={60}
                  />
                </label>

                <label className="block">
                  <span className="label">Diferencia ({currency})</span>
                  <input
                    className="field"
                    type="number"
                    step="0.01"
                    value={row.priceDelta}
                    onChange={(event) => update(index, { priceDelta: event.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="label">Stock</span>
                  <input
                    className="field"
                    type="number"
                    min="0"
                    value={row.stock}
                    onChange={(event) => update(index, { stock: event.target.value })}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(event) => update(index, { active: event.target.checked })}
                    className="h-4 w-4 accent-[#E1580E]"
                  />
                  Variante activa
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="btn-ghost btn-sm disabled:opacity-40"
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    className="btn-ghost btn-sm disabled:opacity-40"
                  >
                    Bajar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    className="text-xs font-semibold uppercase tracking-widest text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 border border-dashed border-sand-dark px-4 py-8 text-center text-sm text-ink-muted">
          Este producto no tiene variantes.
        </p>
      )}

      <button
        type="button"
        onClick={() => setRows((current) => [...current, emptyVariant()])}
        className="btn-ghost btn-sm mt-5"
      >
        Agregar variante
      </button>

      <p className="mt-4 text-xs text-ink-muted">
        Al comprar, el stock se descuenta de la variante elegida y tambien del stock
        general del producto, asi que manten los dos numeros al dia.
      </p>
    </div>
  );
}
