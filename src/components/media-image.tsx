import { mediaSrcSet } from '@/lib/media-url';

/**
 * Imagen de la tienda.
 *
 * Es un `<img>` normal con una sola diferencia: si la foto viene del panel,
 * ofrece la lista de anchos disponibles para que el navegador se baje el que
 * le sirve y no el original de dos mil pixeles. Para cualquier otra ruta se
 * comporta exactamente como un `<img>`.
 *
 * `sizes` le dice al navegador cuanto va a ocupar la imagen en pantalla, que
 * es lo que necesita para elegir bien antes de conocer el diseno. Sin el
 * asume el ancho completo, que para una tarjeta de catalogo es pasarse.
 */
export function MediaImage({
  src,
  sizes,
  alt = '',
  ...rest
}: {
  src: string;
  sizes?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'>) {
  const srcSet = mediaSrcSet(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} {...rest} />
  );
}
