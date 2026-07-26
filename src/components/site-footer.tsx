import Link from 'next/link';
import { WacacoLogo } from './brand';
import { NewsletterForm } from './newsletter-form';

const COLUMNS = [
  {
    title: 'Tienda',
    links: [
      { href: '/productos', label: 'Catalogo completo' },
      { href: '/coleccion/powered-espresso-maker', label: 'Espresso electrico' },
      { href: '/coleccion/manual-espresso-makers', label: 'Espresso manual' },
      { href: '/coleccion/coffee-makers', label: 'Cafeteras' },
      { href: '/coleccion/coffee-gear', label: 'Accesorios' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { href: '/ayuda', label: 'Centro de ayuda' },
      { href: '/seguimiento', label: 'Seguir mi pedido' },
      { href: '/ayuda#envios', label: 'Envios y plazos' },
      { href: '/ayuda#devoluciones', label: 'Cambios y devoluciones' },
      { href: '/ayuda#garantia', label: 'Garantia' },
    ],
  },
  {
    title: 'Cuenta',
    links: [
      { href: '/cuenta/ingresar', label: 'Iniciar sesion' },
      { href: '/cuenta/registro', label: 'Crear cuenta' },
      { href: '/cuenta/pedidos', label: 'Mis pedidos' },
      { href: '/carrito', label: 'Mi carrito' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/terminos', label: 'Terminos y condiciones' },
      { href: '/legal/privacidad', label: 'Politica de privacidad' },
      { href: '/legal/despacho', label: 'Politica de despacho' },
    ],
  },
];

export function SiteFooter({ storeName }: { storeName: string }) {
  return (
    <footer className="mt-24 border-t border-sand-dark bg-ink text-white">
      <div className="container-site grid gap-12 py-16 lg:grid-cols-[1.4fr_2.6fr]">
        <div>
          <WacacoLogo className="text-white" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Cafe de especialidad en cualquier lugar. Cafeteras portatiles disenadas para acompanarte
            al trabajo, al camping o al otro lado del mundo.
          </p>
          <div className="mt-8">
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              Suscribete y recibe novedades
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                {column.title}
              </p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/75 transition-colors hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-site flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} {storeName}. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span>Pagos procesados por</span>
            <span className="rounded bg-white/10 px-2.5 py-1 font-display font-bold uppercase tracking-widest text-white">
              Mercado Pago
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
