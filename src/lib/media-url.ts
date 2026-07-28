/**
 * Ayudas para pedir una imagen del panel en el ancho justo.
 *
 * Vive aparte de `media.ts` porque eso es codigo de servidor y esto lo usan
 * tambien los componentes del navegador. Aqui no se toca la base ni se lee un
 * archivo: solo se arma la URL.
 */

/** Los mismos anchos que acepta la ruta que sirve las imagenes. */
export const MEDIA_WIDTHS = [320, 640, 960, 1280, 1920];

/** Solo las imagenes subidas al panel saben servirse en varios anchos. */
export function isMediaUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^\/api\/media\/[A-Za-z0-9_-]+$/.test(url.trim());
}

/**
 * Lista de anchos para el atributo `srcset`.
 *
 * El navegador elige el que le conviene segun su pantalla y su densidad, asi
 * que un telefono no se descarga la version de 1920. Devuelve cadena vacia
 * para cualquier URL que no sea del panel — una foto externa o un SVG del
 * repositorio se dejan como estan.
 */
export function mediaSrcSet(url: string | null | undefined): string | undefined {
  if (!isMediaUrl(url)) return undefined;
  return MEDIA_WIDTHS.map((width) => `${url}?w=${width} ${width}w`).join(', ');
}
