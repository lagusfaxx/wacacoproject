/**
 * Presentacion de la imagen de un banner de portada.
 *
 * Vive aparte del componente porque lo usan tanto la portada (servidor) como
 * el formulario del panel (cliente).
 */

/** En que parte de la portada aparece el banner. */
export type BannerPlacement = 'hero' | 'destacado' | 'inferior';

/** Como se coloca la imagen dentro de la diapositiva. */
export type HeroImageMode = 'background' | 'side' | 'split' | 'splitLeft';

/** Los modos que parten el banner en dos mitades, texto y foto. */
export function isSplitMode(mode: HeroImageMode): boolean {
  return mode === 'split' || mode === 'splitLeft';
}

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
    hint: 'Banner ancho en medio de la portada. Si hay varios se apilan por orden.',
  },
  {
    value: 'inferior',
    label: 'Franja bajo "Colecciones"',
    hint: 'Mas abajo en la portada, tras la tira de colecciones. Si hay varios se apilan por orden.',
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
  {
    value: 'split',
    label: 'Mitad y mitad, foto a la derecha',
    hint: 'El texto ocupa la mitad izquierda sobre el color de fondo y la foto llena la otra mitad. En telefono la foto va arriba.',
  },
  {
    value: 'splitLeft',
    label: 'Mitad y mitad, foto a la izquierda',
    hint: 'Lo mismo pero al reves. Sirve para alternar cuando pones varias franjas seguidas.',
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
 * Peso de la bajada del banner.
 *
 * Sobre una foto con mucho detalle la bajada gris clara se pierde, asi que el
 * propietario puede pedirla en negrita: ahi va tambien en blanco puro, porque
 * la transparencia es la mitad del problema de legibilidad. El titular no
 * cambia, siempre lleva el mismo peso.
 */
export function subtitleWeightClass(bold: boolean): string {
  return bold ? 'font-semibold text-white' : 'text-white/80';
}

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

/**
 * De donde sale el video, antes de decidir con que parametros se incrusta.
 *
 * El mismo enlace sirve para un fondo mudo y para un video con controles, y
 * lo unico que cambia entre ambos son los parametros de la URL: separar el
 * reconocimiento del proveedor evita repetir estas expresiones regulares.
 */
export type VideoSource =
  | { kind: 'file'; src: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string };

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

export function parseVideoSource(value: string | null | undefined): VideoSource | null {
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
  if (youtube) return { kind: 'youtube', id: youtube };

  const vimeo = vimeoId(url);
  if (vimeo) return { kind: 'vimeo', id: vimeo };

  return { kind: 'file', src: raw };
}

export function toBannerVideo(value: string | null | undefined): BannerVideo | null {
  const source = parseVideoSource(value);
  if (!source) return null;

  if (source.kind === 'youtube') {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      controls: '0',
      loop: '1',
      playlist: source.id,
      playsinline: '1',
      modestbranding: '1',
      rel: '0',
      disablekb: '1',
      iv_load_policy: '3',
    });
    return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${source.id}?${params}` };
  }

  if (source.kind === 'vimeo') {
    const params = new URLSearchParams({
      autoplay: '1',
      muted: '1',
      loop: '1',
      background: '1',
      controls: '0',
    });
    return { kind: 'embed', src: `https://player.vimeo.com/video/${source.id}?${params}` };
  }

  return { kind: 'file', src: source.src };
}

export function toPlacement(value: string | null | undefined): BannerPlacement {
  const known = PLACEMENTS.find((option) => option.value === value);
  return known?.value ?? 'hero';
}

export function toImageMode(value: string | null | undefined): HeroImageMode {
  const known = IMAGE_MODES.find((option) => option.value === value);
  return known?.value ?? 'background';
}

export function toOverlay(value: string | null | undefined): HeroOverlay {
  return value === 'none' || value === 'soft' || value === 'strong' || value === 'medium'
    ? value
    : 'medium';
}
