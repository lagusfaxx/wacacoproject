/**
 * Reglas de SEO de la tienda.
 *
 * Cada producto y cada coleccion pueden llevar su propio titulo, descripcion e
 * imagen para buscadores. Cuando el campo esta vacio se usa una cadena de
 * respaldo, igual que hace Shopify: nunca se publica una etiqueta vacia.
 *
 * Este modulo es puro y sin dependencias de servidor para poder reutilizar los
 * mismos limites y respaldos en la vista previa del panel.
 */

/** Google corta el titulo alrededor de los 60 caracteres. */
export const SEO_TITLE_LIMIT = 60;
/** Y la descripcion alrededor de los 160. */
export const SEO_DESCRIPTION_LIMIT = 160;

export type SeoInput = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImage?: string | null;
  noIndex?: boolean;
};

export type SeoFallback = {
  /** Nombre del producto o de la coleccion. */
  name: string;
  /** Subtitulo o gancho corto. */
  tagline?: string | null;
  /** Texto largo del que extraer una descripcion si no hay nada mejor. */
  body?: string | null;
  image?: string | null;
  /** Nombre de la tienda, se agrega al titulo cuando este es corto. */
  storeName?: string | null;
};

/** Recorta sin partir una palabra por la mitad. */
export function truncate(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;

  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[.,;:\-–—]$/, '')}…`;
}

/**
 * Titulo final para la etiqueta `<title>` y para Google.
 *
 * Si el propietario escribio uno, se respeta tal cual. Si no, se arma con el
 * nombre y, cuando queda espacio, el nombre de la tienda.
 */
export function resolveSeoTitle(seo: SeoInput, fallback: SeoFallback): string {
  const custom = seo.seoTitle?.trim();
  if (custom) return truncate(custom, SEO_TITLE_LIMIT);

  const store = fallback.storeName?.trim();
  const suffix = store ? ` | ${store}` : '';

  if (store && fallback.name.length + suffix.length <= SEO_TITLE_LIMIT) {
    return `${fallback.name}${suffix}`;
  }
  return truncate(fallback.name, SEO_TITLE_LIMIT);
}

export function resolveSeoDescription(seo: SeoInput, fallback: SeoFallback): string {
  const custom = seo.seoDescription?.trim();
  if (custom) return truncate(custom, SEO_DESCRIPTION_LIMIT);

  const tagline = fallback.tagline?.trim();
  const body = fallback.body?.trim();

  // Se combina el gancho con el texto largo para no dejar una descripcion de
  // tres palabras, que Google suele descartar. Pero si la descripcion ya
  // empieza por el subtitulo, unirlos repetiria la misma frase dos veces.
  if (tagline && body && tagline.length < 70) {
    const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const overlaps = normalized(body).startsWith(normalized(tagline));
    if (!overlaps) {
      return truncate(`${tagline}. ${body}`, SEO_DESCRIPTION_LIMIT);
    }
    return truncate(body, SEO_DESCRIPTION_LIMIT);
  }
  return truncate(tagline || body || fallback.name, SEO_DESCRIPTION_LIMIT);
}

export function resolveSeoImage(seo: SeoInput, fallback: SeoFallback): string | null {
  return seo.seoImage?.trim() || fallback.image || null;
}

/** Convierte una ruta relativa en absoluta, que es lo que exige Open Graph. */
export function absoluteUrl(path: string | null, baseUrl: string): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Como se veria el resultado en Google, usado por la vista previa del panel. */
export function searchPreview(
  seo: SeoInput,
  fallback: SeoFallback,
  siteUrl: string,
  path: string,
): { title: string; description: string; url: string } {
  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const crumbs = path.split('/').filter(Boolean).join(' › ');

  return {
    title: resolveSeoTitle(seo, fallback),
    description: resolveSeoDescription(seo, fallback),
    url: crumbs ? `${host} › ${crumbs}` : host,
  };
}
