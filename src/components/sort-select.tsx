'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'nuevos', label: 'Mas nuevos' },
  { value: 'nombre', label: 'Nombre A-Z' },
];

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'destacados') params.delete('orden');
    else params.set('orden', next);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-3">
      <span className="font-display text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Ordenar
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-sand-dark bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
