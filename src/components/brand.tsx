/**
 * Identidad de la tienda.
 *
 * No se dibuja ningun isotipo inventado: el logotipo real lo sube el
 * propietario desde el panel (Ajustes > Marca) y se guarda como imagen. Sin
 * logo cargado se muestra unicamente el nombre en la tipografia de la marca,
 * que es una solucion valida y honesta en lugar de un simbolo generico.
 *
 * Si ademas hay un segundo logo, los dos se turnan con un giro corto. Sirve
 * para dejar claro que una empresa opera la tienda de otra marca: se ven las
 * dos y ninguna suplanta a la otra. La animacion es solo CSS, asi que no
 * necesita JavaScript, y se detiene sola en los equipos configurados para
 * reducir el movimiento.
 */

import { MediaImage } from './media-image';
export function StoreLogo({
  logoUrl,
  secondaryLogoUrl = null,
  secondaryLogoAlt = '',
  storeName,
  className = '',
  inverted = false,
}: {
  logoUrl: string | null;
  secondaryLogoUrl?: string | null;
  secondaryLogoAlt?: string;
  storeName: string;
  className?: string;
  inverted?: boolean;
}) {
  // La altura se fija en la propia imagen y no con un `h-full` heredado: un
  // SVG sin ancho ni alto propios no puede resolver un porcentaje contra la
  // celda, resuelve contra su ancho y se sale del hueco. Como la cabecera esta
  // fija, ese sobrante quedaba flotando encima del contenido de la pagina.
  const sizeClass = 'h-7 sm:h-8';
  const widthClass = 'max-w-[130px] sm:max-w-[190px]';
  const imageClass = `${sizeClass} w-auto max-w-full object-contain object-left ${
    inverted ? 'brightness-0 invert' : ''
  }`;

  if (logoUrl && secondaryLogoUrl) {
    return (
      // Los dos comparten la misma celda de la reticula: el ancho lo marca el
      // mas ancho de los dos y la cabecera no da saltos al alternar.
      <span className={`logo-swap grid ${sizeClass} ${widthClass} ${className}`}>
        <MediaImage
          src={logoUrl}
          alt={storeName}
          sizes="320px"
          className={`logo-swap-a col-start-1 row-start-1 justify-self-start ${imageClass}`}
        />
        <MediaImage
          src={secondaryLogoUrl}
          alt={secondaryLogoAlt}
          aria-hidden={secondaryLogoAlt ? undefined : true}
          sizes="320px"
          className={`logo-swap-b col-start-1 row-start-1 justify-self-start ${imageClass}`}
        />
      </span>
    );
  }

  if (logoUrl) {
    return (
      <MediaImage
        src={logoUrl}
        alt={storeName}
        sizes="320px"
        className={`${imageClass} ${widthClass} ${className}`}
      />
    );
  }

  return (
    <span
      className={`block truncate font-display text-lg font-bold uppercase leading-none tracking-[0.1em] sm:text-2xl sm:tracking-[0.14em] ${className}`}
    >
      {storeName}
    </span>
  );
}
