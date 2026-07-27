import Link from 'next/link';
import { StoreLogo } from './brand';
import { NewsletterForm } from './newsletter-form';

const COLUMNS = [
  {
    title: 'Tienda',
    links: [
      { href: '/products', label: 'Catalogo completo' },
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
      { href: '/ayuda#envios', label: 'Despacho' },
      { href: '/ayuda#pagos', label: 'Medios de pago' },
      { href: '/ayuda#devoluciones', label: 'Cambios y garantia' },
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

export function SiteFooter({
  storeName,
  logoUrl,
  secondaryLogoUrl,
  secondaryLogoAlt,
}: {
  storeName: string;
  logoUrl: string | null;
  secondaryLogoUrl: string | null;
  secondaryLogoAlt: string;
}) {
  return (
    <footer className="mt-24 border-t border-sand-dark bg-ink text-white">
      <div className="container-site grid gap-12 py-16 lg:grid-cols-[1.4fr_2.6fr]">
        <div>
          <StoreLogo
            logoUrl={logoUrl}
            secondaryLogoUrl={secondaryLogoUrl}
            secondaryLogoAlt={secondaryLogoAlt}
            storeName={storeName}
            className="text-white"
            inverted
          />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Tienda oficial de cafeteras portatiles Wacaco. Despacho a todo Chile y pago seguro con
            Mercado Pago.
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
