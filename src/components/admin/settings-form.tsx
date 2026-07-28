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
  brand,
  seoTitle,
  seoHeading,
  seoText,
}: {
  storeName: string;
  storeEmail: string;
  announcement: string;
  marquee: string;
  heroHeadline: string;
  metaDescription: string;
  brand: string;
  seoTitle: string;
  seoHeading: string;
  seoText: string;
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
        <label className="label" htmlFor="brand">
          Marca que vendes
        </label>
        <input
          id="brand"
          name="brand"
          defaultValue={brand}
          maxLength={60}
          className="field"
          placeholder="Wacaco"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Si vendes productos de otra marca, escribela aqui. Se declara en cada
          ficha como la marca del producto, se muestra bajo el nombre y entra en
          los textos de la portada. Sin esto, si tu tienda se llama distinto que
          la marca, esa palabra no aparece en ninguna parte de tu sitio y nadie
          te encuentra buscandola.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="seoTitle">
          Titulo de la portada en Google
        </label>
        <input
          id="seoTitle"
          name="seoTitle"
          defaultValue={seoTitle}
          maxLength={70}
          className="field"
          placeholder="Wacaco Chile | Minipresso, Nanopresso y Picopresso"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Es el titulo azul del resultado de Google. Aqui van las palabras por
          las que quieres que te encuentren, la marca primero y despues los
          modelos. Google corta cerca de los 60 caracteres. Si lo dejas vacio se
          arma solo con el nombre de la tienda y tus productos.
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
        <label className="label" htmlFor="seoHeading">
          Encabezado del texto de portada
        </label>
        <input
          id="seoHeading"
          name="seoHeading"
          defaultValue={seoHeading}
          maxLength={120}
          className="field"
          placeholder="Wacaco Chile: Minipresso, Nanopresso y Picopresso"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Es el titulo principal de la portada, el que mas peso tiene para
          Google. Se ve al final de la pagina, sobre el texto.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="seoText">
          Texto de portada
        </label>
        <textarea
          id="seoText"
          name="seoText"
          rows={4}
          defaultValue={seoText}
          maxLength={900}
          className="field"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          El unico texto largo de la portada. Escribe con normalidad quien eres
          y que vendes, nombrando las marcas y los modelos: es lo que Google lee
          para decidir si tu tienda responde a esa busqueda. Vacio se arma solo
          con tus productos y colecciones.
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
