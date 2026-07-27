'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveBanner } from '@/app/actions/admin';
import { ImageField } from './image-field';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/** Fondos preparados, para no pedirle CSS al propietario. */
const BACKGROUNDS = [
  { label: 'Cafe oscuro', value: 'linear-gradient(120deg, #2A2622 0%, #4A3F35 55%, #6B5B48 100%)' },
  { label: 'Negro', value: 'linear-gradient(120deg, #1C1B1A 0%, #3A342E 60%, #5C5348 100%)' },
  { label: 'Verde oliva', value: 'linear-gradient(120deg, #23281F 0%, #3E4B3F 55%, #6C7A5E 100%)' },
  { label: 'Naranjo', value: 'linear-gradient(120deg, #6E2806 0%, #C1470A 60%, #E1580E 100%)' },
  { label: 'Arena', value: 'linear-gradient(120deg, #6E6A62 0%, #8A8C7A 60%, #B9B5A7 100%)' },
];

export type BannerFormValues = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  background: string;
  position: number;
  active: boolean;
};

export function BannerForm({ values }: { values: BannerFormValues }) {
  const [state, formAction] = useActionState(saveBanner, initialState);
  const [background, setBackground] = useState(values.background || BACKGROUNDS[0]!.value);
  const [eyebrow, setEyebrow] = useState(values.eyebrow);
  const [title, setTitle] = useState(values.title);
  const [subtitle, setSubtitle] = useState(values.subtitle);
  const [ctaLabel, setCtaLabel] = useState(values.ctaLabel);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values.id ? <input type="hidden" name="bannerId" value={values.id} /> : null}
      <input type="hidden" name="background" value={background} />

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
          Vista previa
        </h2>
        <div
          className="relative flex min-h-56 items-center overflow-hidden px-8 py-10"
          style={{ background }}
        >
          <div className="relative z-10 max-w-lg">
            {eyebrow ? (
              <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <p className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight text-white">
                {title}
              </p>
            ) : null}
            {subtitle ? <p className="mt-3 text-sm text-white/80">{subtitle}</p> : null}
            {ctaLabel ? (
              <span className="mt-5 inline-block bg-brand px-6 py-3 font-display text-xs font-bold uppercase tracking-widest text-white">
                {ctaLabel}
              </span>
            ) : null}
          </div>
          {values.image ? (
            <div className="absolute right-8 top-1/2 hidden aspect-square h-[80%] -translate-y-1/2 items-center justify-center rounded-full bg-sand/95 p-6 sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.image} alt="" className="h-full w-full object-contain" />
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="border border-sand-dark bg-white">
          <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
            Contenido
          </h2>
          <div className="space-y-5 p-6">
            <Field
              label="Texto pequeno superior"
              name="eyebrow"
              value={eyebrow}
              onChange={(event) => setEyebrow(event.target.value)}
              placeholder="Nuevo"
              error={state.errors.eyebrow}
            />
            <Field
              label="Titular"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Prestina"
              error={state.errors.title}
            />
            <div>
              <label className="label" htmlFor="banner-subtitle">
                Bajada
              </label>
              <textarea
                id="banner-subtitle"
                name="subtitle"
                rows={2}
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                maxLength={200}
                className="field"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Texto del boton"
                name="ctaLabel"
                value={ctaLabel}
                onChange={(event) => setCtaLabel(event.target.value)}
                placeholder="Comprar ahora"
                error={state.errors.ctaLabel}
              />
              <Field
                label="Destino del boton"
                name="ctaHref"
                defaultValue={values.ctaHref}
                placeholder="/productos/prestina"
                error={state.errors.ctaHref}
                hint="Ruta interna o URL completa."
              />
            </div>

            <ImageField
              name="image"
              label="Imagen del banner"
              defaultValue={values.image}
              aspect="wide"
              hint="Se muestra a la derecha, dentro de un circulo claro. Fondo transparente (PNG o WEBP) queda mejor."
            />
          </div>
        </section>

        <div className="space-y-6">
          <section className="border border-sand-dark bg-white">
            <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
              Fondo
            </h2>
            <div className="space-y-2 p-6">
              {BACKGROUNDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBackground(option.value)}
                  className={`flex w-full items-center gap-3 border-2 p-2 text-left transition-colors ${
                    background === option.value ? 'border-ink' : 'border-transparent hover:border-sand-dark'
                  }`}
                >
                  <span className="h-8 w-16 shrink-0" style={{ background: option.value }} />
                  <span className="text-sm">{option.label}</span>
                </button>
              ))}
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
              <Field
                label="Orden"
                name="position"
                type="number"
                min="0"
                defaultValue={String(values.position)}
                error={state.errors.position}
              />
            </div>
          </section>
        </div>
      </div>

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
      {pending ? 'Guardando...' : isNew ? 'Crear banner' : 'Guardar cambios'}
    </button>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  type = 'text',
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `banner-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className={`field ${error ? 'field-error' : ''}`}
        {...rest}
      />
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </div>
  );
}
