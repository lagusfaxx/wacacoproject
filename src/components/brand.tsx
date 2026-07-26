/**
 * Identidad de la tienda.
 *
 * No se dibuja ningun isotipo inventado: el logotipo real lo sube el
 * propietario desde el panel (Ajustes > Marca) y se guarda como imagen. Sin
 * logo cargado se muestra unicamente el nombre en la tipografia de la marca,
 * que es una solucion valida y honesta en lugar de un simbolo generico.
 */
export function StoreLogo({
  logoUrl,
  storeName,
  className = '',
  inverted = false,
}: {
  logoUrl: string | null;
  storeName: string;
  className?: string;
  inverted?: boolean;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={storeName}
        className={`h-7 w-auto max-w-[130px] object-contain sm:h-8 sm:max-w-[190px] ${
          inverted ? 'brightness-0 invert' : ''
        } ${className}`}
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
