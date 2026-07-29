import { WhatsappIcon } from './icons';

/**
 * El boton de WhatsApp que acompana toda la tienda.
 *
 * Va fijo abajo a la derecha, donde lo espera cualquiera que haya comprado en
 * linea antes. Es un enlace y nada mas: sin estado, sin JavaScript propio y
 * sin recargar nada, asi que no le cuesta nada a la pagina.
 *
 * En el telefono se respeta el area segura de la barra de gestos, que si no se
 * come la mitad del boton en los iPhone. En pantallas grandes crece con una
 * etiqueta al pasar el cursor, porque ahi hay sitio de sobra.
 */
export function WhatsappButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribenos por WhatsApp"
      className="group fixed right-4 z-40 flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-all hover:bg-[#1FB855] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:right-6 sm:h-auto sm:w-auto sm:rounded-full sm:px-5 sm:py-4"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <WhatsappIcon className="h-7 w-7 shrink-0 sm:h-6 sm:w-6" />
      <span className="hidden font-display text-sm font-semibold uppercase tracking-widest sm:inline">
        Escribenos
      </span>
    </a>
  );
}
