'use client';

import { useRef, useState } from 'react';

/**
 * Campo de imagen con subida desde el equipo.
 *
 * Envia el archivo a /api/admin/media y deja la URL resultante en un input
 * oculto, de modo que el formulario que lo contiene no necesita saber nada del
 * proceso. Tambien admite pegar una URL externa, util si las fotos ya estan en
 * otro servidor.
 */
export function ImageField({
  name,
  label,
  defaultValue = '',
  hint,
  error,
  aspect = 'square',
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
  aspect?: 'square' | 'wide';
}) {
  const [url, setUrl] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);

    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/admin/media', { method: 'POST', body });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? 'No se pudo subir la imagen.');
        return;
      }
      setUrl(data.url);
    } catch {
      setMessage('No se pudo subir la imagen. Revisa tu conexion.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />

      <div className="mt-2 flex flex-wrap items-start gap-4">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden border border-sand-dark bg-sand ${
            aspect === 'wide' ? 'h-24 w-44' : 'h-24 w-24'
          }`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-[11px] uppercase tracking-widest text-ink-muted">
              Sin imagen
            </span>
          )}
        </div>

        <div className="min-w-56 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn-ghost btn-sm"
            >
              {uploading ? 'Subiendo...' : url ? 'Reemplazar' : 'Subir imagen'}
            </button>
            {url ? (
              <button type="button" onClick={() => setUrl('')} className="btn-ghost btn-sm">
                Quitar
              </button>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />

          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="o pega una URL"
            className="field py-2 text-xs"
          />
        </div>
      </div>

      {message ? <span className="error-text">{message}</span> : null}
      {error ? <span className="error-text">{error}</span> : null}
      {!message && !error && hint ? (
        <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>
      ) : null}
    </div>
  );
}

/**
 * Galeria de un producto: varias imagenes ordenadas.
 * Se envian como campos repetidos con el mismo nombre, y el orden del DOM es
 * el orden en que se muestran en la tienda.
 */
export function ImageGalleryField({
  name,
  label,
  defaultValue = [],
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string[];
  hint?: string;
}) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadMany(files: FileList) {
    setUploading(true);
    setMessage(null);

    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/admin/media', { method: 'POST', body });
        const data = await response.json();
        if (response.ok) added.push(data.url);
        else setMessage(data.error ?? 'No se pudo subir una de las imagenes.');
      } catch {
        setMessage('No se pudo subir una de las imagenes.');
      }
    }

    if (added.length) setUrls((current) => [...current, ...added]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(index: number, delta: number) {
    setUrls((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div>
      <span className="label">{label}</span>

      {urls.map((url) => (
        <input key={url} type="hidden" name={name} value={url} />
      ))}

      {urls.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="flex items-center gap-3 border border-sand-dark bg-white p-2"
            >
              <div className="h-14 w-14 shrink-0 bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-contain" />
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{url}</span>
              {index === 0 ? (
                <span className="badge bg-sand text-ink-muted">Principal</span>
              ) : null}
              <div className="flex shrink-0 gap-1">
                <IconButton label="Subir" onClick={() => move(index, -1)} disabled={index === 0}>
                  ↑
                </IconButton>
                <IconButton
                  label="Bajar"
                  onClick={() => move(index, 1)}
                  disabled={index === urls.length - 1}
                >
                  ↓
                </IconButton>
                <IconButton
                  label="Quitar"
                  onClick={() => setUrls((current) => current.filter((_, i) => i !== index))}
                >
                  ✕
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 border border-dashed border-sand-dark px-4 py-6 text-center text-sm text-ink-muted">
          Sin imagenes todavia.
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn-ghost btn-sm mt-3"
      >
        {uploading ? 'Subiendo...' : 'Agregar imagenes'}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void uploadMany(event.target.files);
        }}
      />

      {message ? <span className="error-text">{message}</span> : null}
      {!message && hint ? (
        <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center border border-sand-dark text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
