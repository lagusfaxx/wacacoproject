'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/mercadolibre', label: 'Resumen', exact: true },
  { href: '/admin/mercadolibre/publicaciones', label: 'Publicaciones' },
  { href: '/admin/mercadolibre/ventas', label: 'Ventas' },
  { href: '/admin/mercadolibre/preguntas', label: 'Preguntas' },
  { href: '/admin/mercadolibre/promociones', label: 'Promociones' },
  { href: '/admin/mercadolibre/conexion', label: 'Conexion y Claude' },
];

export function MlNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Secciones de Mercado Libre">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              active ? 'border-ink bg-ink text-white' : 'border-sand-dark text-ink-soft hover:border-ink-soft'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
