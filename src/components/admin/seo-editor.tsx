'use client';

import { useState } from 'react';
import {
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  searchPreview,
} from '@/lib/seo';

/**
 * Editor de SEO por ficha, con la vista previa del resultado de Google
 * actualizandose mientras se escribe.
 *
 * Los campos vacios no son un problema: la tienda calcula un titulo y una
 * descripcion de respaldo a partir del nombre y del texto de la ficha, y la
 * vista previa muestra exactamente ese respaldo.
 */
export function SeoEditor({
  siteUrl,
  storeName,
  pathPrefix,
  slug,
  fallbackName,
  fallbackTagline,
  fallbackBody,
  defaults,
  errors = {},
}: {
  siteUrl: string;
  storeName: string;
  /** Ej. "products" o "coleccion". */
  pathPrefix: string;
  slug: string;
  fallbackName: string;
  fallbackTagline: string;
  fallbackBody: string;
  defaults: {
    seoTitle: string;
    seoDescription: string;
    seoImage: string;
    noIndex: boolean;
  };
  errors?: Record<string, string>;
}) {
  const [seoTitle, setSeoTitle] = useState(defaults.seoTitle);
  const [seoDescription, setSeoDescription] = useState(defaults.seoDescription);
  const [noIndex, setNoIndex] = useState(defaults.noIndex);

  const preview = searchPreview(
    { seoTitle, seoDescription },
    {
      name: fallbackName || 'Nombre del producto',
      tagline: fallbackTagline,
      body: fallbackBody,
      storeName,
    },
    siteUrl,
    `${pathPrefix}/${slug || 'url-del-producto'}`,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Vista previa en Google</p>
        <div className="mt-2 border border-sand-dark bg-white p-4">
          <p className="truncate text-xs text-[#4d5156]">{preview.url}</p>
          <p className="mt-1 truncate text-[19px] leading-tight text-[#1a0dab]">{preview.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-[#4d5156]">{preview.description}</p>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Asi se veria el resultado. Google puede reescribirlo si considera que
          otro texto responde mejor a la busqueda.
        </p>
      </div>

      <Counter
        id="seoTitle"
        label="Titulo para buscadores"
        value={seoTitle}
        onChange={setSeoTitle}
        limit={SEO_TITLE_LIMIT}
        error={errors.seoTitle}
        placeholder={fallbackName}
        hint="Dejalo vacio y se usa el nombre mas el de la tienda."
      />

      <Counter
        id="seoDescription"
        label="Descripcion para buscadores"
        value={seoDescription}
        onChange={setSeoDescription}
        limit={SEO_DESCRIPTION_LIMIT}
        error={errors.seoDescription}
        placeholder={fallbackTagline || fallbackBody}
        hint="Dejalo vacio y se usa el subtitulo o el inicio de la descripcion."
        multiline
      />

      <div>
        <label className="label" htmlFor="seoImage">
          Imagen para compartir
        </label>
        <input
          id="seoImage"
          name="seoImage"
          defaultValue={defaults.seoImage}
          maxLength={500}
          className={`field ${errors.seoImage ? 'field-error' : ''}`}
          placeholder="/products/mi-producto.jpg"
        />
        {errors.seoImage ? <span className="error-text">{errors.seoImage}</span> : null}
        <p className="mt-1.5 text-xs text-ink-muted">
          Se usa al compartir el enlace en WhatsApp, Facebook o X. Vacio = la
          primera imagen. Ideal 1200 x 630 px.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="noIndex"
          checked={noIndex}
          onChange={(event) => setNoIndex(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#E1580E]"
        />
        <span>
          Ocultar de los buscadores
          <span className="mt-0.5 block text-xs text-ink-muted">
            Pide a Google no indexar esta pagina y la saca del sitemap. La ficha
            sigue visible para quien tenga el enlace.
          </span>
        </span>
      </label>
    </div>
  );
}

function Counter({
  id,
  label,
  value,
  onChange,
  limit,
  error,
  placeholder,
  hint,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  limit: number;
  error?: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  const length = value.trim().length;
  // Se avisa al pasar el limite, no se bloquea: Google recorta, no rechaza.
  const over = length > limit;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <span
          className={`font-display text-[11px] tabular-nums ${
            over ? 'text-red-600' : 'text-ink-muted'
          }`}
        >
          {length}/{limit}
        </span>
      </div>

      {multiline ? (
        <textarea
          id={id}
          name={id}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={320}
          className={`field ${error || over ? 'field-error' : ''}`}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={160}
          className={`field ${error || over ? 'field-error' : ''}`}
          placeholder={placeholder}
        />
      )}

      {error ? <span className="error-text">{error}</span> : null}
      {!error && over ? (
        <span className="error-text">Google recortara el texto a {limit} caracteres.</span>
      ) : null}
      {!error && !over && hint ? (
        <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      ) : null}
    </div>
  );
}
