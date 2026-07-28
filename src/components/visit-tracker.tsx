'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Avisa al servidor de cada pagina que se ve en la tienda.
 *
 * Va en el layout, asi que se entera tambien de los cambios de ruta sin
 * recarga. El aviso se manda con `keepalive` para que salga aunque la persona
 * cierre la pestana en ese momento, y si falla no pasa nada: una visita sin
 * contar es preferible a un error en pantalla.
 *
 * No dibuja nada.
 */
export function VisitTracker() {
  const pathname = usePathname();
  // Evita contar dos veces la misma ruta cuando React monta el efecto de nuevo.
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || ultima.current === pathname) return;
    ultima.current = pathname;

    const producto = /^\/products\/([^/?#]+)/.exec(pathname);

    const cuerpo = JSON.stringify({
      path: pathname,
      // Solo el referente externo: entre paginas de la tienda ya se sabe que
      // el visitante viene de la propia tienda.
      referrer: document.referrer && !document.referrer.includes(location.host)
        ? document.referrer
        : '',
      device: window.matchMedia('(max-width: 767px)').matches ? 'movil' : 'escritorio',
      productSlug: producto ? producto[1] : '',
    });

    fetch('/api/track', {
      method: 'POST',
      body: cuerpo,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
