'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveSettings } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export function SettingsForm({
  storeName,
  storeEmail,
  announcement,
  marquee,
  heroHeadline,
  metaDescription,
}: {
  storeName: string;
  storeEmail: string;
  announcement: string;
  marquee: string;
  heroHeadline: string;
  metaDescription: string;
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

      <div>
        <label className="label" htmlFor="metaDescription">
          Descripcion para buscadores (portada)
        </label>
        <textarea
          id="metaDescription"
          name="metaDescription"
          rows={3}
          defaultValue={metaDescription}
          maxLength={320}
          className="field"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Es el texto que Google muestra bajo el titulo de la portada. Lo ideal
          son unos 160 caracteres. Cada producto puede tener el suyo propio.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="heroHeadline">
          Titular de la portada
        </label>
        <input
          id="heroHeadline"
          name="heroHeadline"
          defaultValue={heroHeadline}
          maxLength={80}
          className="field"
          placeholder="Tu cafe, donde quieras"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Se muestra bajo el nombre del producto destacado, en grande. Dejalo vacio para mostrar
          solo el producto.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="marquee">
          Frases de la cinta desplazante
        </label>
        <textarea
          id="marquee"
          name="marquee"
          rows={5}
          defaultValue={marquee}
          maxLength={600}
          className="field"
          placeholder={'Envio a todo Chile con Blue Express\nPago seguro con Mercado Pago'}
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Una frase por linea, hasta ocho. Son los mensajes que giran en la portada.
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
