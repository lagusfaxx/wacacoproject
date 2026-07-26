/** Cinta desplazandose con los mensajes de marca, como en la web original. */
export function Marquee({
  items,
  className = 'bg-olive text-white',
}: {
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;
  // El contenido se duplica para que el bucle de la animacion sea continuo.
  const track = [...items, ...items];

  return (
    <div className={`relative overflow-hidden py-4 ${className}`}>
      <div className="flex w-max animate-marquee items-center gap-10">
        {track.map((item, index) => (
          <span key={`${item}-${index}`} className="flex shrink-0 items-center gap-10">
            <span className="font-display text-sm font-semibold uppercase tracking-[0.16em] sm:text-base">
              {item}
            </span>
            <span aria-hidden="true" className="block h-1.5 w-1.5 rotate-45 bg-current opacity-60" />
          </span>
        ))}
      </div>
    </div>
  );
}
