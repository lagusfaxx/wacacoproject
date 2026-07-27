'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveProduct } from '@/app/actions/admin';
import { ImageGalleryField } from './image-field';
import { SeoEditor } from './seo-editor';
import { VariantsField, type VariantRow } from './variants-field';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export type ProductFormValues = {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  features: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  stock: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  active: boolean;
  featured: boolean;
  isNew: boolean;
  award: string;
  position: number;
  images: string[];
  variants: VariantRow[];
  collectionIds: string[];
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
  noIndex: boolean;
};

export function ProductForm({
  values,
  collections,
  currency,
  siteUrl,
  storeName,
}: {
  values: ProductFormValues;
  collections: { id: string; name: string }[];
  currency: string;
  siteUrl: string;
  storeName: string;
}) {
  const [state, formAction] = useActionState(saveProduct, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values.id ? <input type="hidden" name="productId" value={values.id} /> : null}

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
          <Panel title="Informacion basica">
            <div className="space-y-5">
              <Field
                label="Nombre"
                name="name"
                defaultValue={values.name}
                required
                error={state.errors.name}
              />
              <Field
                label="Slug (URL)"
                name="slug"
                defaultValue={values.slug}
                error={state.errors.slug}
                hint="Se genera automaticamente desde el nombre si lo dejas vacio."
                placeholder="minipresso-gr2"
              />
              <Field
                label="Subtitulo"
                name="subtitle"
                defaultValue={values.subtitle}
                error={state.errors.subtitle}
                placeholder="Cafetera espresso portatil facil de usar"
              />
              <div>
                <label className="label" htmlFor="product-description">
                  Descripcion
                </label>
                <textarea
                  id="product-description"
                  name="description"
                  rows={6}
                  defaultValue={values.description}
                  maxLength={6000}
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="product-features">
                  Caracteristicas (una por linea)
                </label>
                <textarea
                  id="product-features"
                  name="features"
                  rows={5}
                  defaultValue={values.features}
                  maxLength={3000}
                  className="field"
                  placeholder={'Una caracteristica por linea, tomada de la ficha oficial'}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Imagenes">
            <ImageGalleryField
              name="images"
              label="Fotos del producto"
              defaultValue={values.images}
              hint="Sube las fotos desde tu equipo o pega una URL. La primera es la principal; usa las flechas para reordenarlas."
            />
          </Panel>

          <Panel title="Variantes">
            <VariantsField
              name="variants"
              defaultValue={values.variants}
              currency={currency}
              error={state.errors.variants}
            />
          </Panel>

          <Panel title="SEO en buscadores">
            <SeoEditor
              siteUrl={siteUrl}
              storeName={storeName}
              pathPrefix="products"
              slug={values.slug}
              fallbackName={values.name}
              fallbackTagline={values.subtitle}
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

        <div className="space-y-6">
          <Panel title="Precio e inventario">
            <div className="space-y-5">
              <Field
                label={`Precio (${currency})`}
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={values.price}
                required
                error={state.errors.price}
              />
              <Field
                label={`Precio de comparacion (${currency})`}
                name="compareAtPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={values.compareAtPrice}
                error={state.errors.compareAtPrice}
                hint="Se muestra tachado. Dejalo vacio si no hay oferta."
              />
              <Field
                label="SKU"
                name="sku"
                defaultValue={values.sku}
                required
                error={state.errors.sku}
              />
              <Field
                label="Stock"
                name="stock"
                type="number"
                min="0"
                defaultValue={String(values.stock)}
                required
                error={state.errors.stock}
              />
            </div>
          </Panel>

          <Panel title="Bulto para el envio">
            <p className="mb-5 text-xs text-ink-muted">
              Blue Express cotiza con el peso y las medidas de la caja. Si son incorrectos, el
              costo de despacho que ve el cliente tambien lo sera.
            </p>
            <div className="space-y-5">
              <Field
                label="Peso (gramos)"
                name="weightGrams"
                type="number"
                min="0"
                defaultValue={String(values.weightGrams)}
                error={state.errors.weightGrams}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Largo (cm)"
                  name="lengthCm"
                  type="number"
                  min="1"
                  defaultValue={String(values.lengthCm)}
                  error={state.errors.lengthCm}
                />
                <Field
                  label="Ancho (cm)"
                  name="widthCm"
                  type="number"
                  min="1"
                  defaultValue={String(values.widthCm)}
                  error={state.errors.widthCm}
                />
                <Field
                  label="Alto (cm)"
                  name="heightCm"
                  type="number"
                  min="1"
                  defaultValue={String(values.heightCm)}
                  error={state.errors.heightCm}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Visibilidad">
            <div className="space-y-4">
              <Checkbox name="active" label="Producto activo" defaultChecked={values.active} />
              <Checkbox
                name="featured"
                label="Destacado en la portada"
                defaultChecked={values.featured}
              />
              <Checkbox name="isNew" label='Marcar como "Nuevo"' defaultChecked={values.isNew} />
              <Field
                label="Premio o distincion"
                name="award"
                defaultValue={values.award}
                placeholder="Red Dot Winner 2024"
                error={state.errors.award}
              />
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

          <Panel title="Colecciones">
            <div className="space-y-3">
              {collections.map((collection) => (
                <Checkbox
                  key={collection.id}
                  name="collectionIds"
                  value={collection.id}
                  label={collection.name}
                  defaultChecked={values.collectionIds.includes(collection.id)}
                />
              ))}
            </div>
          </Panel>
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
      {pending ? 'Guardando...' : isNew ? 'Crear producto' : 'Guardar cambios'}
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

function Checkbox({
  name,
  label,
  value,
  defaultChecked,
}: {
  name: string;
  label: string;
  value?: string;
  defaultChecked: boolean;
}) {
  const id = `check-${name}-${value ?? 'single'}`;
  return (
    <label htmlFor={id} className="flex items-center gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[#E1580E]"
      />
      {label}
    </label>
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
  const id = `product-${name}`;
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
