'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveSettings } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export function SettingsForm({
  storeName,
  storeEmail,
  announcement,
}: {
  storeName: string;
  storeEmail: string;
  announcement: string;
}) {
  const [state, formAction] = useActionState(saveSettings, initialState);

  return (
    <form action={formAction} className="space-y-5">
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

      <div>
        <label className="label" htmlFor="storeName">
          Nombre de la tienda
        </label>
        <input
          id="storeName"
          name="storeName"
          defaultValue={storeName}
          maxLength={120}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="storeEmail">
          Correo de contacto
        </label>
        <input
          id="storeEmail"
          name="storeEmail"
          type="email"
          defaultValue={storeEmail}
          maxLength={180}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="announcement">
          Barra de anuncio
        </label>
        <input
          id="announcement"
          name="announcement"
          defaultValue={announcement}
          maxLength={200}
          className="field"
          placeholder="Envio gratis en compras sobre $60.000"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Se muestra en la franja superior de la tienda. Dejalo vacio para ocultarla.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Guardando...' : 'Guardar ajustes'}
    </button>
  );
}
