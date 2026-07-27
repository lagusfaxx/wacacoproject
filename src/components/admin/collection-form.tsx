'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveCollection } from '@/app/actions/admin';
import { ImageField } from './image-field';
import { SeoEditor } from './seo-editor';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export type CollectionFormValues = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  image: string;
  position: number;
  active: boolean;
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
  noIndex: boolean;
};

export function CollectionForm({
  values,
  siteUrl,
  storeName,
}: {
  values: CollectionFormValues;
  siteUrl: string;
  storeName: string;
}) {
  const [state, formAction] = useActionState(saveCollection, initialState);
  // El slug alimenta la vista previa de Google, asi que se sigue en vivo.
  const [slug, setSlug] = useState(values.slug);
  const [name, setName] = useState(values.name);
  const [tagline, setTagline] = useState(values.tagline);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values.id ? <input type="hidden" name="collectionId" value={values.id} /> : null}

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

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel title="Informacion">
            <div className="space-y-5">
              <Field
                label="Nombre"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                error={state.errors.name}
              />
              <Field
                label="Slug (URL)"
                name="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                error={state.errors.slug}
                placeholder="manual-espresso-makers"
                hint="Cambiarlo rompe los enlaces existentes a esta coleccion."
              />
              <Field
                label="Bajada"
                name="tagline"
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                error={state.errors.tagline}
                placeholder="Nada sabe como un shot Wacaco"
              />
              <div>
                <label className="label" htmlFor="collection-description">
                  Descripcion
                </label>
                <textarea
                  id="collection-description"
                  name="description"
                  rows={5}
                  defaultValue={values.description}
                  maxLength={2000}
                  className="field"
                />
              </div>
              <ImageField
                name="image"
                label="Imagen de la categoria"
                defaultValue={values.image}
                error={state.errors.image}
                hint="Se muestra en la cuadricula de colecciones de la portada."
              />
            </div>
          </Panel>

          <Panel title="SEO en buscadores">
            <SeoEditor
              siteUrl={siteUrl}
              storeName={storeName}
              pathPrefix="coleccion"
              slug={slug}
              fallbackName={name}
              fallbackTagline={tagline}
              fallbackBody={values.description}
              defaults={{
                seoTitle: values.seoTitle,
                seoDescription: values.seoDescription,
                seoImage: values.seoImage,
                noIndex: values.noIndex,
              }}
              errors={state.errors}
            />
          </Panel>
        </div>

        <Panel title="Visibilidad">
          <div className="space-y-5">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={values.active}
                className="h-4 w-4 accent-[#E1580E]"
              />
              Coleccion visible en la tienda
            </label>
            <Field
              label="Orden de aparicion"
              name="position"
              type="number"
              min="0"
              defaultValue={String(values.position)}
              error={state.errors.position}
            />
          </div>
        </Panel>
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
      {pending ? 'Guardando...' : isNew ? 'Crear coleccion' : 'Guardar cambios'}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-sand-dark bg-white">
      <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
        {title}
      </h2>
      <div className="p-6">{children}</div>
    </section>
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
  const id = `collection-${name}`;
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
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </div>
  );
}
