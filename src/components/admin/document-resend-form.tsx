'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState } from '@/app/actions/admin';
import { resendDocumentEmail } from '@/app/actions/documents';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/**
 * Reenvia un envio ya guardado.
 *
 * Los archivos quedaron en la base, asi que mandarle el mismo comprobante a
 * otra direccion no obliga a buscarlo de nuevo en el computador, que es lo que
 * pasa siempre un mes despues.
 */
export function DocumentResendForm({ id, recipients }: { id: string; recipients: string[] }) {
  const [state, formAction] = useActionState(resendDocumentEmail, initialState);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      {state.message ? (
        <p
          role="status"
          className={`mb-2 border px-3 py-2 text-xs ${
            state.status === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-start gap-2">
        <input type="hidden" name="id" value={id} />

        {open ? (
          <input
            name="recipients"
            autoFocus
            placeholder="otra@correo.cl"
            className="field flex-1 py-1.5 text-sm"
            aria-label="Direcciones para el reenvio"
          />
        ) : null}

        <SubmitButton
          label={
            open
              ? 'Enviar'
              : recipients.length === 1
                ? `Reenviar a ${recipients[0]}`
                : `Reenviar a las ${recipients.length} direcciones`
          }
        />

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="border border-sand-dark px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-ink-soft hover:text-brand"
        >
          {open ? 'Usar las originales' : 'Otra direccion'}
        </button>
      </form>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-brand bg-brand px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-60"
    >
      {pending ? 'Enviando...' : label}
    </button>
  );
}
