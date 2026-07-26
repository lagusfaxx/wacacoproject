/** Marca grafica: escudo Wacaco + logotipo. */
export function WacacoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <path
        d="M8 6h32v22c0 8.837-7.163 14-16 14S8 36.837 8 28V6Z"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path d="M17 15v13M24 15v17M31 15v13" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function WacacoLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <WacacoMark className="h-7 w-7 shrink-0" />
      <span className="font-display text-2xl font-bold uppercase leading-none tracking-[0.12em]">
        Wacaco
      </span>
    </span>
  );
}
