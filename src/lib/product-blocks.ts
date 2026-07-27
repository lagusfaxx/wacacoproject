/**
 * Bloques de contenido que se muestran bajo la ficha del producto.
 *
 * Vive aparte del componente porque lo usan los tres lados: la pagina de la
 * tienda (servidor), el editor del panel (cliente) y la validacion de la
 * accion que los guarda.
 */

/** Que forma tiene el bloque en la pagina. */
export type ProductBlockKind = 'gallery' | 'story' | 'video' | 'split';

/** Paleta con la que se pinta el bloque. */
export type ProductBlockTheme = 'dark' | 'light' | 'sand';

export const BLOCK_KINDS: {
  value: ProductBlockKind;
  label: string;
  hint: string;
  /** Campos que el editor muestra para este tipo. */
  uses: { images?: true; image?: true; video?: true; text?: true };
}[] = [
  {
    value: 'gallery',
    label: 'Franja de fotos',
    hint: 'Fila de fotografias de uso a lo ancho de la pantalla, sin texto encima.',
    uses: { images: true },
  },
  {
    value: 'story',
    label: 'Relato de marca',
    hint: 'Logo, titular grande y un parrafo centrado. Es la seccion tipo "Feel like home".',
    uses: { image: true, text: true },
  },
  {
    value: 'video',
    label: 'Video',
    hint: 'Video a lo ancho con sus controles. La imagen se usa como cartel mientras carga.',
    uses: { video: true, image: true, text: true },
  },
  {
    value: 'split',
    label: 'Imagen y texto',
    hint: 'Una fotografia a un costado y el texto al otro. Se alterna el lado en cada bloque.',
    uses: { image: true, text: true },
  },
];

export const BLOCK_THEMES: { value: ProductBlockTheme; label: string }[] = [
  { value: 'dark', label: 'Fondo oscuro' },
  { value: 'light', label: 'Fondo blanco' },
  { value: 'sand', label: 'Fondo arena' },
];

/** Datos de un bloque tal como viajan entre el panel y el servidor. */
export type ProductBlockData = {
  id: string;
  kind: ProductBlockKind;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  images: string[];
  video: string;
  theme: ProductBlockTheme;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
};

export function toBlockKind(value: string | null | undefined): ProductBlockKind {
  return value === 'gallery' || value === 'video' || value === 'split' ? value : 'story';
}

export function toBlockTheme(value: string | null | undefined): ProductBlockTheme {
  return value === 'light' || value === 'sand' ? value : 'dark';
}

export function blockKindLabel(kind: ProductBlockKind): string {
  return BLOCK_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

export function emptyProductBlock(kind: ProductBlockKind = 'story'): ProductBlockData {
  return {
    id: '',
    kind,
    eyebrow: '',
    title: '',
    body: '',
    image: '',
    images: [],
    video: '',
    theme: kind === 'story' ? 'dark' : 'light',
    ctaLabel: '',
    ctaHref: '',
    active: true,
  };
}

/**
 * Un bloque sin nada que mostrar no se dibuja: es preferible que la pagina
 * termine antes a que aparezca una franja vacia porque quedo a medio llenar.
 */
export function blockIsEmpty(block: ProductBlockData): boolean {
  switch (block.kind) {
    case 'gallery':
      return block.images.length === 0;
    case 'video':
      return !block.video.trim();
    case 'split':
      return !block.image.trim() && !block.title.trim() && !block.body.trim();
    default:
      return !block.title.trim() && !block.body.trim() && !block.image.trim();
  }
}
