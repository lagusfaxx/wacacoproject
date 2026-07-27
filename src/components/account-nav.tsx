'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Barra de secciones de la cuenta.
 *
 * Cada seccion vive en su propia pagina y tiene un unico boton de guardar, en
 * lugar de apilar tres formularios con tres botones en la misma pantalla. La
 * barra es lo que mantiene la sensacion de estar en un solo lugar.
 */
const SECTIONS = [
  { href: '/cuenta', label: 'Resumen' },
  { href: '/cuenta/pedidos', label: 'Pedidos' },
  { href: '/cuenta/datos', label: 'Mis datos' },
  { href: '/cuenta/direccion', label: 'Direccion' },
  { href: '/cuenta/seguridad', label: 'Seguridad' },
];

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de mi cuenta">
      {/*
        En pantallas anchas los enlaces de servicio van al final de la misma
        linea. En el telefono la fila de secciones ya se desplaza a lo ancho,
        asi que compartirla con "Cerrar sesion" recortaria las dos: bajan a su
        propia linea.
      */}
      <div className="flex items-end gap-6 border-b border-sand-dark">
        <ul className="no-scrollbar -mb-px flex min-w-0 flex-1 gap-6 overflow-x-auto">
          {SECTIONS.map((section) => {
            // "Resumen" solo se marca en la ruta exacta; el resto tambien
            // cuando se esta en una pagina hija, como el detalle de un pedido.
            const active =
              section.href === '/cuenta'
                ? pathname === '/cuenta'
                : pathname === section.href || pathname.startsWith(`${section.href}/`);

            return (
              <li key={section.href} className="shrink-0">
                <Link
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block border-b-2 pb-3 font-display text-sm font-bold uppercase tracking-widest transition-colors ${
                    active
                      ? 'border-brand text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <SessionLinks isAdmin={isAdmin} className="hidden shrink-0 items-center gap-5 pb-3 sm:flex" />
      </div>

      <SessionLinks isAdmin={isAdmin} className="mt-4 flex items-center gap-5 sm:hidden" />
    </nav>
  );
}

function SessionLinks({ isAdmin, className }: { isAdmin: boolean; className: string }) {
  return (
    <div className={className}>
      {isAdmin ? (
        <Link
          href="/admin"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-muted hover:text-brand"
        >
          Panel admin
        </Link>
      ) : null}
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="font-display text-xs font-bold uppercase tracking-widest text-ink-muted hover:text-brand"
        >
          Cerrar sesion
        </button>
      </form>
    </div>
  );
}
