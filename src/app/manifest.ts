import type { MetadataRoute } from 'next';

import { getStoreSettings } from '@/lib/store-settings';

// El nombre y el icono salen de la base de datos, no del build.
export const dynamic = 'force-dynamic';

/**
 * Manifiesto de la aplicacion web, en `/manifest.webmanifest`.
 *
 * Existe sobre todo por el icono: es una de las fuentes de las que Google saca
 * el dibujo que muestra junto al enlace en sus resultados, y la unica que pide
 * PNG grande en vez de un `.ico`. Declarando aqui el icono de la tienda, los
 * tres caminos por los que Google puede llegar — `/favicon.ico`, el `<head>` y
 * este archivo — terminan en la misma imagen.
 *
 * De paso, es lo que hace que la tienda se pueda guardar en la pantalla de
 * inicio del telefono con su nombre y su icono.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getStoreSettings().catch(() => null);

  return {
    name: settings?.name ?? 'Tienda',
    short_name: settings?.name ?? 'Tienda',
    description: settings?.metaDescription ?? undefined,
    start_url: '/',
    display: 'standalone',
    background_color: '#1C1B1A',
    theme_color: '#1C1B1A',
    icons: [
      { src: '/icono/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
