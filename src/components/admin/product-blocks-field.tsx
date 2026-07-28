'use client';

import { useState } from 'react';
import {
  BLOCK_IMAGE_SIDES,
  BLOCK_IMAGE_SIZES,
  BLOCK_KINDS,
  BLOCK_THEMES,
  type ProductBlockData,
  type ProductBlockImageSide,
  type ProductBlockImageSize,
  type ProductBlockKind,
  type ProductBlockTheme,
  blockKindLabel,
  blockUsesImageSize,
  emptyProductBlock,
} from '@/lib/product-blocks';
import { ImageField, ImageGalleryField } from './image-field';

/**
 * Editor de los bloques que se muestran bajo la ficha del producto.
 *
 * Como las variantes, la lista viaja al servidor en un unico campo oculto en
 * formato JSON: son un numero variable de registros con campos distintos
 * segun el tipo, y nombrarlos uno por uno seria mas fragil.
 *
 * Cada tarjeta muestra solo los campos que su tipo usa, para que quien
 * escribe el contenido no tenga delante ocho casillas que no le sirven.
 */
export function ProductBlocksField({
  name,
  defaultValue,
  error,
}: {
  name: string;
  defaultValue: ProductBlockData[];
  error?: string;
}) {
  const [rows, setRows] = useState<ProductBlockData[]>(defaultValue);
  const [open, setOpen] = useState<number | null>(defaultValue.length === 0 ? null : 0);

  function update(index: number, patch: Partial<ProductBlockData>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row!);
      return next;
    });
    setOpen((current) => (current === index ? target : current === target ? index : current));
  }

  function add(kind: ProductBlockKind) {
    setRows((current) => [...current, emptyProductBlock(kind)]);
    setOpen(rows.length);
  }

  function remove(index: number) {
    setRows((current) => current.filter((_, position) => position !== index));
    setOpen(null);
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />

      <p className="text-xs text-ink-muted">
        Lo que se ve al bajar en la pagina del producto, debajo de la descripcion y antes de
        los productos relacionados. Se muestran en este orden.
      </p>

      {error ? <span className="error-text mt-2 block">{error}</span> : null}

      {rows.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {rows.map((row, index) => (
            <li key={row.id || `nuevo-${index}`} className="border border-sand-dark">
              <div className="flex flex-wrap items-center gap-3 bg-sand px-4 py-3">
                <span className="badge bg-white text-ink-soft">{index + 1}</span>
                <button
                  type="button"
                  onClick={() => setOpen((current) => (current === index ? null : index))}
                  className="flex-1 text-left"
                  aria-expanded={open === index}
                >
                  <span className="font-display text-sm font-bold uppercase tracking-tight">
                    {blockKindLabel(row.kind)}
                  </span>
                  <span className="ml-2 text-xs text-ink-muted">
                    {row.title || summaryFor(row) || 'Sin contenido todavia'}
                  </span>
                </button>

                {!row.active ? (
                  <span className="badge bg-white text-ink-muted">Oculto</span>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="btn-ghost btn-sm disabled:opacity-40"
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    className="btn-ghost btn-sm disabled:opacity-40"
                  >
                    Bajar
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen((current) => (current === index ? null : index))}
                    className="btn-ghost btn-sm"
                  >
                    {open === index ? 'Cerrar' : 'Editar'}
                  </button>
                </div>
              </div>

              {open === index ? (
                <BlockEditor
                  index={index}
                  row={row}
                  onChange={(patch) => update(index, patch)}
                  onRemove={() => remove(index)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 border border-dashed border-sand-dark px-4 py-8 text-center text-sm text-ink-muted">
          Este producto todavia no tiene contenido extra.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {BLOCK_KINDS.map((kind) => (
          <button
            key={kind.value}
            type="button"
            onClick={() => add(kind.value)}
            className="btn-ghost btn-sm"
            title={kind.hint}
          >
            + {kind.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Resumen corto para el encabezado plegado de la tarjeta. */
function summaryFor(row: ProductBlockData): string {
  if (row.kind === 'gallery') {
    return row.images.length === 1 ? '1 foto' : `${row.images.length} fotos`;
  }
  if (row.kind === 'video') return row.video || '';
  return row.body.slice(0, 60);
}

function BlockEditor({
  index,
  row,
  onChange,
  onRemove,
}: {
  index: number;
  row: ProductBlockData;
  onChange: (patch: Partial<ProductBlockData>) => void;
  onRemove: () => void;
}) {
  const kind = BLOCK_KINDS.find((entry) => entry.value === row.kind);
  const uses = kind?.uses ?? {};

  return (
    <div className="space-y-5 border-t border-sand-dark p-4">
      {kind ? <p className="text-xs text-ink-muted">{kind.hint}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Tipo de bloque</span>
          <select
            className="field"
            value={row.kind}
            onChange={(event) => onChange({ kind: event.target.value as ProductBlockKind })}
          >
            {BLOCK_KINDS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Fondo</span>
          <select
            className="field"
            value={row.theme}
            onChange={(event) => onChange({ theme: event.target.value as ProductBlockTheme })}
          >
            {BLOCK_THEMES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {uses.text ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Antetitulo (opcional)</span>
              <input
                className="field"
                value={row.eyebrow}
                onChange={(event) => onChange({ eyebrow: event.target.value })}
                placeholder="Electric portable espresso maker"
                maxLength={120}
              />
            </label>

            <label className="block">
              <span className="label">Titular</span>
              <input
                className="field"
                value={row.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Como en casa"
                maxLength={160}
              />
            </label>
          </div>

          <label className="block">
            <span className="label">Texto</span>
            <textarea
              className="field"
              rows={5}
              value={row.body}
              onChange={(event) => onChange({ body: event.target.value })}
              maxLength={2000}
              placeholder="Un parrafo corto que cuente para que sirve el producto."
            />
          </label>
        </>
      ) : (
        <label className="block">
          <span className="label">Titulo interno (opcional)</span>
          <input
            className="field"
            value={row.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Fotos de uso"
            maxLength={160}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Se usa como encabezado sobre la franja y como texto alternativo de las fotos.
          </span>
        </label>
      )}

      {uses.images ? (
        <ImageGalleryField
          label="Fotos de la franja"
          defaultValue={row.images}
          onChange={(images) => onChange({ images })}
          emptyLabel="La franja todavia no tiene fotos."
          addLabel="Agregar fotos"
          showPrimaryBadge={false}
          hint="Se ven en fila a lo ancho de la pantalla. Lo habitual son entre cuatro y ocho fotos cuadradas."
        />
      ) : null}

      {uses.video ? (
        <label className="block">
          <span className="label">Video</span>
          <input
            className="field"
            value={row.video}
            onChange={(event) => onChange({ video: event.target.value })}
            placeholder="https://www.youtube.com/watch?v=... o /media/video.mp4"
            maxLength={500}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Admite un enlace de YouTube o Vimeo, o un archivo .mp4 o .webm. Se reproduce
            solo, sin sonido y en bucle, asi que conviene uno corto y sin voz.
          </span>
        </label>
      ) : null}

      {uses.image ? (
        <ImageField
          label={imageLabelFor(row.kind)}
          defaultValue={row.image}
          onChange={(image) => onChange({ image })}
          aspect="wide"
          hint={imageHintFor(row.kind)}
        />
      ) : null}

      {blockUsesImageSize(row.kind) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">{imageSizeLabelFor(row.kind)}</span>
            <select
              className="field"
              value={row.imageSize}
              onChange={(event) =>
                onChange({ imageSize: event.target.value as ProductBlockImageSize })
              }
            >
              {BLOCK_IMAGE_SIZES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-muted">
              {imageSizeHintFor(row.kind)}
            </span>
          </label>

          {row.kind === 'split' ? (
            <label className="block">
              <span className="label">Lado de la foto</span>
              <select
                className="field"
                value={row.imageSide}
                onChange={(event) =>
                  onChange({ imageSide: event.target.value as ProductBlockImageSide })
                }
              >
                {BLOCK_IMAGE_SIDES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink-muted">
                Alternar deja la foto a un lado distinto en cada bloque partido, para que dos
                seguidos no se lean como una sola columna.
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Texto del boton (opcional)</span>
          <input
            className="field"
            value={row.ctaLabel}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Ver accesorios"
            maxLength={60}
          />
        </label>

        <label className="block">
          <span className="label">Enlace del boton</span>
          <input
            className="field"
            value={row.ctaHref}
            onChange={(event) => onChange({ ctaHref: event.target.value })}
            placeholder="/coleccion/accesorios"
            maxLength={300}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-dark pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={row.active}
            onChange={(event) => onChange({ active: event.target.checked })}
            className="h-4 w-4 accent-[#E1580E]"
          />
          Mostrar en la tienda
        </label>

        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold uppercase tracking-widest text-red-600 hover:text-red-700"
          aria-label={`Eliminar el bloque ${index + 1}`}
        >
          Eliminar bloque
        </button>
      </div>
    </div>
  );
}

function imageLabelFor(kind: ProductBlockKind): string {
  if (kind === 'story') return 'Logo o imagen sobre el titular';
  if (kind === 'video') return 'Cartel del video';
  return 'Fotografia del bloque';
}

function imageSizeLabelFor(kind: ProductBlockKind): string {
  if (kind === 'story') return 'Tamano del logo';
  if (kind === 'gallery') return 'Alto de la fila de fotos';
  return 'Alto de la fotografia';
}

function imageSizeHintFor(kind: ProductBlockKind): string {
  if (kind === 'story') return 'Que tan alto se ve el logo sobre el titular.';
  if (kind === 'gallery') {
    return 'Cuanto ocupan las fotos de alto en computador. En telefono se ven cuadradas.';
  }
  return 'Cuanto ocupa de alto en computador. En telefono va apaisada sobre el texto.';
}

function imageHintFor(kind: ProductBlockKind): string {
  if (kind === 'story') return 'Se muestra centrada encima del titular. Un PNG con fondo transparente queda mejor.';
  if (kind === 'video') return 'Se ve mientras el video carga. Solo se usa con archivos .mp4 o .webm.';
  return 'Ocupa la mitad del bloque; el texto va al otro lado.';
}
