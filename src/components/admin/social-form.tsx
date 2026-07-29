'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveSocialSettings } from '@/app/actions/admin';
import type { SocialSettings } from '@/lib/social';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/**
 * WhatsApp e Instagram.
 *
 * El numero se guarda como se escriba: el formato internacional lo arma la
 * tienda. Pedirle a alguien que recuerde que WhatsApp quiere "56912345678" y
 * no "+56 9 1234 5678" es pedirle que haga el trabajo del programa.
 */
export function SocialForm({ values }: { values: SocialSettings }) {
  const [state, formAction] = useActionState(saveSocialSettings, initialState);

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

      <label className="block">
        <span className="label">Numero de WhatsApp</span>
        <input
          name="whatsapp"
          type="text"
          defaultValue={values.whatsapp}
          placeholder="+56 9 1234 5678"
          maxLength={30}
          className="field"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Escribelo como quieras, con o sin +56. Vacio = no aparece el boton flotante.
          {values.whatsapp ? ` Guardado como ${values.whatsapp}.` : ''}
        </span>
      </label>

      <label className="block">
        <span className="label">Mensaje con el que se abre el chat</span>
        <textarea
          name="whatsappMessage"
          rows={2}
          defaultValue={values.whatsappMessage}
          maxLength={300}
          className="field"
          placeholder="Hola, tengo una consulta sobre un producto"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Va escrito de antemano en la conversacion, para que al cliente le cueste menos empezar.
        </span>
      </label>

      <label className="block">
        <span className="label">Instagram</span>
        <input
          name="instagram"
          type="text"
          defaultValue={values.instagramHandle || values.instagram}
          placeholder="@nomadbrew"
          maxLength={200}
          className="field"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          El usuario o el enlace completo del perfil. Aparece en el pie de la tienda.
        </span>
      </label>

      <Guardar />
    </form>
  );
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-sm py-3">
      {pending ? 'Guardando...' : 'Guardar canales'}
    </button>
  );
}
