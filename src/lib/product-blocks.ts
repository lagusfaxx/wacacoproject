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

/** Que tan grande se dibuja la imagen del bloque. */
export type ProductBlockImageSize = 'sm' | 'md' | 'lg';

/** De que lado va la foto en el bloque partido. */
export type ProductBlockImageSide = 'auto' | 'left' | 'right';

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
    hint: 'Video a lo ancho que se reproduce solo, en silencio, en bucle y sin controles.',
    uses: { video: true, image: true, text: true },
  },
  {
    value: 'split',
    label: 'Imagen y texto',
    hint: 'Una fotografia a un costado y el texto al otro. Se alterna el lado en cada bloque.',
    uses: { image: true, text: true },
  },
];

/**
 * Tamanos de la imagen.
 *
 * La etiqueta cambia con el tipo de bloque porque el ajuste no mide lo mismo
 * en cada uno: en el relato es la altura del logo, en la franja el alto de la
 * fila y en el bloque partido el alto de la fotografia.
 */
export const BLOCK_IMAGE_SIZES: { value: ProductBlockImageSize; label: string }[] = [
  { value: 'sm', label: 'Pequena' },
  { value: 'md', label: 'Mediana' },
  { value: 'lg', label: 'Grande' },
];

export const BLOCK_IMAGE_SIDES: { value: ProductBlockImageSide; label: string }[] = [
  { value: 'auto', label: 'Alternar automaticamente' },
  { value: 'left', label: 'Siempre a la izquierda' },
  { value: 'right', label: 'Siempre a la derecha' },
];

/**
 * Como se traduce cada tamano a la pagina.
 *
 * Las clases viven aqui, junto a los valores, para que anadir un tamano sea un
 * solo sitio que tocar. En el telefono la franja de fotos y la foto del bloque
 * partido no cambian de alto: a ese ancho ya ocupan lo que pueden.
 */
export const BLOCK_IMAGE_SIZE_CLASS: Record<
  'story' | 'gallery' | 'split',
  Record<ProductBlockImageSize, string>
> = {
  story: {
    sm: 'h-10 sm:h-12',
    md: 'h-16 sm:h-20',
    lg: 'h-24 sm:h-32',
  },
  gallery: {
    sm: 'sm:h-36 lg:h-44',
    md: 'sm:h-52 lg:h-64',
    lg: 'sm:h-72 lg:h-96',
  },
  split: {
    sm: 'lg:min-h-[360px]',
    md: 'lg:min-h-[520px]',
    lg: 'lg:min-h-[680px]',
  },
};

/** Los tipos de bloque en los que el tamano de la imagen cambia algo. */
export function blockUsesImageSize(kind: ProductBlockKind): boolean {
  return kind === 'story' || kind === 'gallery' || kind === 'split';
}

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
  imageSize: ProductBlockImageSize;
  imageSide: ProductBlockImageSide;
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

export function toBlockImageSize(value: string | null | undefined): ProductBlockImageSize {
  return value === 'sm' || value === 'lg' ? value : 'md';
}

export function toBlockImageSide(value: string | null | undefined): ProductBlockImageSide {
  return value === 'left' || value === 'right' ? value : 'auto';
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
    imageSize: 'md',
    imageSide: 'auto',
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
