'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Resumen', exact: true },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/colecciones', label: 'Colecciones' },
  { href: '/admin/envios', label: 'Envios' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/cupones', label: 'Cupones' },
  { href: '/admin/ajustes', label: 'Ajustes' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-sand-dark bg-white" aria-label="Secciones del panel">
      <div className="container-site flex gap-1 overflow-x-auto no-scrollbar">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-3.5 font-display text-xs font-bold uppercase tracking-widest transition-colors ${
                active
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
