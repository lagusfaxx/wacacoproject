/**
 * Presentacion de la imagen de un banner de portada.
 *
 * Vive aparte del componente porque lo usan tanto la portada (servidor) como
 * el formulario del panel (cliente).
 */

/** En que parte de la portada aparece el banner. */
export type BannerPlacement = 'hero' | 'destacado';

/** Como se coloca la imagen dentro de la diapositiva. */
export type HeroImageMode = 'background' | 'side';

/** Cuanto se oscurece la foto para que el texto blanco se lea encima. */
export type HeroOverlay = 'none' | 'soft' | 'medium' | 'strong';

export const PLACEMENTS: { value: BannerPlacement; label: string; hint: string }[] = [
  {
    value: 'hero',
    label: 'Carrusel principal',
    hint: 'Arriba de todo, en la primera pantalla. Si hay varios se turnan solos.',
  },
  {
    value: 'destacado',
    label: 'Franja bajo "Mas vendidos"',
    hint: 'Banner ancho en medio de la portada. Se muestra el primero por orden.',
  },
];

export const IMAGE_MODES: { value: HeroImageMode; label: string; hint: string }[] = [
  {
    value: 'background',
    label: 'Fondo completo',
    hint: 'La foto ocupa todo el banner. Es lo habitual para fotografias.',
  },
  {
    value: 'side',
    label: 'A un costado',
    hint: 'La imagen se apoya a la derecha sobre un circulo claro. Para productos recortados con fondo transparente.',
  },
];

export const OVERLAYS: { value: HeroOverlay; label: string }[] = [
  { value: 'none', label: 'Sin velo' },
  { value: 'soft', label: 'Suave' },
  { value: 'medium', label: 'Medio' },
  { value: 'strong', label: 'Fuerte' },
];

/**
 * Velo sobre la fotografia. El texto del hero es blanco, asi que una foto
 * clara sin velo lo deja ilegible.
 *
 * En pantallas grandes se oscurece mas por la izquierda, que es donde va el
 * titular, y la foto respira por la derecha. En el telefono el texto ocupa
 * todo el ancho, asi que el velo va de abajo hacia arriba.
 */
export const OVERLAY_CLASS: Record<HeroOverlay, string> = {
  none: '',
  soft: 'bg-gradient-to-t from-black/60 via-black/35 to-black/25 md:bg-gradient-to-r md:from-black/55 md:via-black/30 md:to-black/10',
  medium:
    'bg-gradient-to-t from-black/80 via-black/55 to-black/40 md:bg-gradient-to-r md:from-black/75 md:via-black/50 md:to-black/20',
  strong:
    'bg-gradient-to-t from-black/90 via-black/75 to-black/60 md:bg-gradient-to-r md:from-black/90 md:via-black/70 md:to-black/40',
};

/**
 * Video de fondo de un banner.
 *
 * Un archivo directo se reproduce con `<video>`, que es la unica forma de
 * garantizar que no aparezca ningun control. YouTube y Vimeo solo se pueden
 * incrustar por iframe, asi que se les pasan los parametros que ocultan la
 * interfaz y se les quitan los eventos del raton para que tampoco asome al
 * pasar por encima.
 */
export type BannerVideo =
  | { kind: 'file'; src: string }
  | { kind: 'embed'; src: string };

function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
  if (!url.hostname.endsWith('youtube.com')) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const embedded = url.pathname.match(/^\/(?:embed|shorts|v)\/([^/]+)/);
  return embedded?.[1] ?? null;
}

function vimeoId(url: URL): string | null {
  if (!url.hostname.endsWith('vimeo.com')) return null;
  return url.pathname.match(/\/(\d+)/)?.[1] ?? null;
}

export function toBannerVideo(value: string | null | undefined): BannerVideo | null {
  const raw = value?.trim();
  if (!raw) return null;

  // Una ruta interna solo puede ser un archivo servido por la propia tienda.
  if (raw.startsWith('/') && !raw.startsWith('//')) return { kind: 'file', src: raw };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const youtube = youtubeId(url);
  if (youtube) {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      controls: '0',
      loop: '1',
      playlist: youtube,
      playsinline: '1',
      modestbranding: '1',
      rel: '0',
      disablekb: '1',
      iv_load_policy: '3',
    });
    return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${youtube}?${params}` };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    const params = new URLSearchParams({
      autoplay: '1',
      muted: '1',
      loop: '1',
      background: '1',
      controls: '0',
    });
    return { kind: 'embed', src: `https://player.vimeo.com/video/${vimeo}?${params}` };
  }

  return { kind: 'file', src: raw };
}

export function toPlacement(value: string | null | undefined): BannerPlacement {
  return value === 'destacado' ? 'destacado' : 'hero';
}

export function toImageMode(value: string | null | undefined): HeroImageMode {
  return value === 'side' ? 'side' : 'background';
}

export function toOverlay(value: string | null | undefined): HeroOverlay {
  return value === 'none' || value === 'soft' || value === 'strong' || value === 'medium'
    ? value
    : 'medium';
}
