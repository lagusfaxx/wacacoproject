/**
 * Estrellas de una calificacion.
 *
 * Se dibujan con un SVG relleno por porcentaje en lugar de con estrellas
 * enteras: una nota de 4,3 tiene que verse distinta de un 4,0, o el promedio
 * no significa nada.
 */
export function Stars({
  rating,
  className = '',
  size = 'md',
}: {
  rating: number;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const porcentaje = Math.max(0, Math.min(100, (rating / 5) * 100));
  const alto = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <span
      className={`relative inline-flex ${className}`}
      role="img"
      aria-label={`${rating.toFixed(1)} de 5 estrellas`}
    >
      <span className="flex text-sand-dark">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={alto} />
        ))}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex overflow-hidden text-brand"
        style={{ width: `${porcentaje}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={`${alto} shrink-0`} />
        ))}
      </span>
    </span>
  );
}

function Star({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
    </svg>
  );
}
