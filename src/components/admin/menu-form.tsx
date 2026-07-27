'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveMenu } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export type MenuRow = { label: string; href: string; active: boolean };

const MAX_ITEMS = 8;

export function MenuForm({
  items,
  suggestions,
}: {
  items: MenuRow[];
  suggestions: { label: string; href: string }[];
}) {
  const [state, formAction] = useActionState(saveMenu, initialState);
  const [rows, setRows] = useState<MenuRow[]>(
    items.length ? items : [{ label: '', href: '', active: true }],
  );

  function update(index: number, patch: Partial<MenuRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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

  return (
    <form action={formAction} className="space-y-6">
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
        <div className="border-b border-sand-dark px-6 py-4">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Enlaces de la cabecera
          </h2>
          <p className="mt-1.5 text-xs text-ink-muted">
            El orden de las filas es el orden en que aparecen. Si borras todas,
            la tienda vuelve a mostrar los enlaces por defecto.
          </p>
        </div>

        <ul className="divide-y divide-sand-dark">
          {rows.map((row, index) => (
            <li key={index} className="flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-40 flex-1">
                <label className="label" htmlFor={`menu-label-${index}`}>
                  Texto
                </label>
                <input
                  id={`menu-label-${index}`}
                  name="label"
                  value={row.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  maxLength={40}
                  placeholder="Ofertas"
                  className="field py-2"
                />
              </div>

              <div className="min-w-56 flex-[2]">
                <label className="label" htmlFor={`menu-href-${index}`}>
                  Destino
                </label>
                <input
                  id={`menu-href-${index}`}
                  name="href"
                  value={row.href}
                  onChange={(event) => update(index, { href: event.target.value })}
                  maxLength={300}
                  placeholder="/coleccion/coffee-gear"
                  className="field py-2"
                  list="menu-destinos"
                />
              </div>

              <label className="flex items-center gap-2 pb-2.5 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  checked={row.active}
                  onChange={(event) => update(index, { active: event.target.checked })}
                  className="h-4 w-4 accent-[#E1580E]"
                />
                Visible
              </label>

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
                <IconButton
                  label="Quitar"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                >
                  ✕
                </IconButton>
              </div>
            </li>
          ))}
        </ul>

        <datalist id="menu-destinos">
          {suggestions.map((suggestion) => (
            <option key={suggestion.href} value={suggestion.href}>
              {suggestion.label}
            </option>
          ))}
        </datalist>

        <div className="border-t border-sand-dark px-6 py-4">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { label: '', href: '', active: true }])}
            disabled={rows.length >= MAX_ITEMS}
            className="btn-ghost btn-sm"
          >
            Agregar enlace
          </button>
          {rows.length >= MAX_ITEMS ? (
            <span className="ml-3 text-xs text-ink-muted">
              Maximo {MAX_ITEMS} enlaces: mas no caben en la cabecera.
            </span>
          ) : null}
        </div>
      </section>

      <section className="border border-sand-dark bg-white p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest">
          Destinos disponibles
        </h2>
        <p className="mt-2 text-xs text-ink-muted">
          Haz clic para copiar la ruta en el ultimo enlace de la lista.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.href}
              type="button"
              onClick={() =>
                update(rows.length - 1, {
                  href: suggestion.href,
                  label: rows[rows.length - 1]?.label || suggestion.label,
                })
              }
              className="border border-sand-dark px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {suggestion.label}
              <span className="ml-2 font-mono text-[10px] text-ink-muted">{suggestion.href}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 border-t border-sand-dark bg-white px-6 py-4">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Guardando...' : 'Guardar menu'}
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
      className="flex h-9 w-9 items-center justify-center border border-sand-dark text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
