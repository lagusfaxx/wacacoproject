'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type MlActionState, runMlOperation } from '@/app/actions/mercadolibre';

const initialState: MlActionState = { status: 'idle', message: '' };

/**
 * Formulario para una operacion de Mercado Libre. `op` es el nombre de la
 * herramienta (las mismas que usa Claude) y los campos hijos, sus argumentos.
 */
export function MlForm({
  op,
  hidden = {},
  children,
  submitLabel,
  className = '',
  inline = false,
  danger = false,
}: {
  op: string;
  hidden?: Record<string, string | number>;
  children?: React.ReactNode;
  submitLabel: string;
  className?: string;
  inline?: boolean;
  danger?: boolean;
}) {
  const [state, formAction] = useActionState(runMlOperation, initialState);

  return (
    <form action={formAction} className={className} noValidate>
      <input type="hidden" name="op" value={op} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={inline ? 'flex flex-wrap items-end gap-2' : 'space-y-4'}>
        {children}
        <Submit label={submitLabel} inline={inline} danger={danger} />
      </div>
      {state.message ? (
        <p
          role="status"
          className={`mt-2 text-xs ${state.status === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Submit({ label, inline, danger }: { label: string; inline: boolean; danger: boolean }) {
  const { pending } = useFormStatus();
  const base = inline ? 'btn-ghost btn-sm' : 'btn-primary';
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${danger ? 'text-red-700' : ''}`}
    >
      {pending ? 'Aplicando...' : label}
    </button>
  );
}
