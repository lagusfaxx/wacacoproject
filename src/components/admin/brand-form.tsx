'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, removeLogo, uploadLogo } from '@/app/actions/admin';
import { StoreLogo } from '@/components/brand';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export function BrandForm({
  logoUrl,
  secondaryLogoUrl,
  secondaryLogoAlt,
  storeName,
}: {
  logoUrl: string | null;
  secondaryLogoUrl: string | null;
  secondaryLogoAlt: string;
  storeName: string;
}) {
  return (
    <div className="space-y-10">
      <LogoSlot
        slot="principal"
        title="Logo principal"
        logoUrl={logoUrl}
        storeName={storeName}
        hint={
          logoUrl
            ? 'Es el logo que ve el cliente en la cabecera y el pie de pagina.'
            : 'Sin logo cargado se muestra el nombre de la tienda en la tipografia de la marca.'
        }
      />

      <LogoSlot
        slot="secundario"
        title="Segundo logo"
        logoUrl={secondaryLogoUrl}
        storeName={storeName}
        altValue={secondaryLogoAlt}
        hint="Opcional. Si lo cargas, la cabecera alterna entre los dos con un giro corto: sirve para mostrar la marca de la empresa que opera la tienda junto a la de los productos."
      />

      {logoUrl && secondaryLogoUrl ? (
        <div>
          <p className="label">Asi se ve el relevo</p>
          <div className="mt-2 flex min-h-24 items-center justify-center border border-sand-dark bg-sand p-6">
            <StoreLogo
              logoUrl={logoUrl}
              secondaryLogoUrl={secondaryLogoUrl}
              secondaryLogoAlt={secondaryLogoAlt}
              storeName={storeName}
            />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Cada logo se queda casi seis segundos y el giro dura menos de medio segundo. En los
            equipos configurados para reducir el movimiento no hay giro: se muestran los dos, uno
            al lado del otro.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function LogoSlot({
  slot,
  title,
  logoUrl,
  storeName,
  hint,
  altValue,
}: {
  slot: 'principal' | 'secundario';
  title: string;
  logoUrl: string | null;
  storeName: string;
  hint: string;
  altValue?: string;
}) {
  const [state, formAction] = useActionState(uploadLogo, initialState);
  const fieldId = `logo-${slot}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="label">{title}</p>
        <div className="mt-2 flex min-h-24 items-center justify-center border border-sand-dark bg-sand p-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={altValue || storeName} className="max-h-16 w-auto object-contain" />
          ) : (
            <span className="font-display text-sm uppercase tracking-widest text-ink-muted">
              {slot === 'principal' ? storeName : 'Sin segundo logo'}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{hint}</p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="slot" value={slot} />

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
          <label className="label" htmlFor={fieldId}>
            {logoUrl ? 'Reemplazar imagen' : 'Subir imagen'}
          </label>
          <input
            id={fieldId}
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

        {slot === 'secundario' ? (
          <div>
            <label className="label" htmlFor={`${fieldId}-alt`}>
              Nombre de la marca
            </label>
            <input
              id={`${fieldId}-alt`}
              name="logoAlt"
              defaultValue={altValue}
              maxLength={120}
              placeholder="Operado por NomadBrew"
              className="field"
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Es lo que leen los buscadores y los lectores de pantalla donde va este logo. Se
              guarda junto con la imagen.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <SubmitButton />
          {logoUrl ? (
            <button type="submit" formAction={removeLogo} className="btn-ghost" formNoValidate>
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
