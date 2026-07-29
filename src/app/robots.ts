import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * Se calcula en cada peticion, no al construir la imagen.
 *
 * La direccion de la tienda llega por variable de entorno al arrancar el
 * contenedor, no durante el build: dejando esto estatico, el `robots.txt`
 * publicado apuntaba el sitemap a `http://localhost:3000`, que para Google es
 * como no declararlo.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/cuenta', '/checkout', '/carrito', '/seguimiento'],
    },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
