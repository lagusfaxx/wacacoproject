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
  const imageClass = `h-full w-auto object-contain ${inverted ? 'brightness-0 invert' : ''}`;
  const boxClass = `h-7 max-w-[130px] sm:h-8 sm:max-w-[190px] ${className}`;

  if (logoUrl && secondaryLogoUrl) {
    return (
      // Los dos comparten la misma celda de la reticula: el ancho lo marca el
      // mas ancho de los dos y la cabecera no da saltos al alternar.
      <span className={`logo-swap grid ${boxClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={storeName}
          className={`logo-swap-a col-start-1 row-start-1 ${imageClass}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={secondaryLogoUrl}
          alt={secondaryLogoAlt}
          aria-hidden={secondaryLogoAlt ? undefined : true}
          className={`logo-swap-b col-start-1 row-start-1 ${imageClass}`}
        />
      </span>
    );
  }

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={storeName} className={`${boxClass} ${imageClass}`} />
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
