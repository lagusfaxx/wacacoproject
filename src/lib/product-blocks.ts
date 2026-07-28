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

/** Como encaja la foto en el hueco que le toca. */
export type ProductBlockImageFit = 'cover' | 'contain';

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

/**
 * Encaje de la foto.
 *
 * "Recortada" es lo de siempre: la foto llena su hueco y lo que sobra por los
 * lados o por arriba se corta. Con fotos altas o muy apaisadas ese recorte se
 * come media imagen, asi que se puede pedir que se vea entera; entonces la foto
 * se ajusta al hueco y queda aire del color del bloque alrededor.
 */
export const BLOCK_IMAGE_FITS: { value: ProductBlockImageFit; label: string }[] = [
  { value: 'cover', label: 'Recortada para llenar el hueco' },
  { value: 'contain', label: 'Entera, sin recortar' },
];

export const BLOCK_IMAGE_FIT_CLASS: Record<ProductBlockImageFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
};

/** Los tipos de bloque en los que la foto puede quedar recortada. */
export function blockUsesImageFit(kind: ProductBlockKind): boolean {
  return kind === 'gallery' || kind === 'split';
}

export const BLOCK_IMAGE_SIDES: { value: ProductBlockImageSide; label: string }[] = [
  { value: 'auto', label: 'Alternar automaticamente' },
  { value: 'left', label: 'Siempre a la izquierda' },
  { value: 'right', label: 'Siempre a la derecha' },
];

/**
 * Como se traduce cada tamano a la pagina.
 *
 * Las clases viven aqui, junto a los valores, para que anadir un tamano sea un
 * solo sitio que tocar. El tamano se nota en todas las pantallas: en el
 * telefono no se puede jugar con el alto de una franja a lo ancho, asi que lo
 * que cambia es la proporcion de la foto, y en la fila de fotos tambien cuanto
 * ocupa cada una del ancho de la pantalla.
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
    sm: 'aspect-[4/3] sm:aspect-auto sm:h-36 lg:h-44',
    md: 'aspect-square sm:aspect-auto sm:h-52 lg:h-64',
    lg: 'aspect-[3/4] sm:aspect-auto sm:h-72 lg:h-96',
  },
  // La altura va fijada, no como minimo: la foto comparte fila con el texto y
  // un minimo lo gana siempre la columna mas alta, con lo que las tres medidas
  // acababan dibujandose iguales.
  split: {
    sm: 'aspect-[16/9] lg:aspect-auto lg:h-[360px]',
    md: 'aspect-[4/3] lg:aspect-auto lg:h-[520px]',
    lg: 'aspect-square lg:aspect-auto lg:h-[680px]',
  },
};

/**
 * Cuanto ocupa cada foto de la franja en el telefono, donde la fila se desliza
 * de lado. Con el tamano pequeno caben dos y media en pantalla; con el grande,
 * una sola bien visible.
 */
export const BLOCK_GALLERY_ITEM_CLASS: Record<ProductBlockImageSize, string> = {
  sm: 'w-[46%]',
  md: 'w-[72%]',
  lg: 'w-[88%]',
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
  imageFit: ProductBlockImageFit;
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

export function toBlockImageFit(value: string | null | undefined): ProductBlockImageFit {
  return value === 'contain' ? 'contain' : 'cover';
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
    imageFit: 'cover',
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
