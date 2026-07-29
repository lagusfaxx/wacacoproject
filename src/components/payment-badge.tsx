import { MediaImage } from './media-image';

/**
 * Sello del medio de pago.
 *
 * Si el propietario subio el logo oficial se muestra; mientras no lo haga, se
 * escribe el nombre. El archivo no viaja en el repositorio a proposito: es
 * marca de un tercero y quien la usa tiene que traerla de la pagina oficial,
 * no de una copia de dudosa procedencia.
 */
export function PaymentBadge({
  logoUrl,
  name = 'Mercado Pago',
  variant = 'light',
  className = '',
}: {
  logoUrl: string | null;
  name?: string;
  /** "dark" para fondos oscuros, como el pie de pagina. */
  variant?: 'light' | 'dark';
  className?: string;
}) {
  if (logoUrl) {
    return (
      <MediaImage
        src={logoUrl}
        alt={`Pagos procesados por ${name}`}
        sizes="320px"
        className={`h-7 w-auto max-w-[160px] object-contain ${
          // Sobre el fondo oscuro del pie, un logo con fondo blanco necesita su
          // propia caja clara para no quedar como un recorte pegado.
          variant === 'dark' ? 'rounded bg-white px-2 py-1' : ''
        } ${className}`}
      />
    );
  }

  return (
    <span
      className={`rounded px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest ${
        variant === 'dark' ? 'bg-white/10 text-white' : 'bg-ink text-white'
      } ${className}`}
    >
      {name}
    </span>
  );
}
