'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, removeLogo, uploadLogo } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export function BrandForm({ logoUrl, storeName }: { logoUrl: string | null; storeName: string }) {
  const [state, formAction] = useActionState(uploadLogo, initialState);

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Logo actual</p>
        <div className="mt-2 flex min-h-24 items-center justify-center border border-sand-dark bg-sand p-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={storeName} className="max-h-16 w-auto object-contain" />
          ) : (
            <span className="font-display text-2xl font-bold uppercase tracking-[0.14em] text-ink">
              {storeName}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {logoUrl
            ? 'Este es el logo que ve el cliente en la cabecera y el pie de pagina.'
            : 'Sin logo cargado se muestra el nombre de la tienda en la tipografia de la marca.'}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
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
          <label className="label" htmlFor="logo">
            Subir logo
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            required
            className="w-full border border-sand-dark bg-white px-4 py-2.5 text-sm file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-display file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-white"
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            PNG, JPG, WEBP o SVG. Maximo 256 KB. Se recomienda fondo transparente y una altura de
            al menos 64 px.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <SubmitButton />
          {logoUrl ? (
            <button
              type="submit"
              formAction={removeLogo}
              className="btn-ghost"
              formNoValidate
            >
              Quitar logo
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-sm py-3">
      {pending ? 'Subiendo...' : 'Guardar logo'}
    </button>
  );
}
