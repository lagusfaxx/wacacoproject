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
      /**
       * `/api/media/` va permitido a proposito, y es importante: por ahi se
       * sirven TODAS las imagenes que se suben desde el panel. Las fotos de
       * los productos, las de los banners y el icono de la pestana.
       *
       * Con `/api` bloqueado entero, Google no podia descargar ninguna. El
       * sintoma visible era el favicon, que sale en la pestana del navegador
       * (al navegador el robots.txt no le incumbe) pero nunca en los
       * resultados de busqueda. Lo que no se veia es que tampoco entraba
       * ninguna foto a Google Imagenes, y que la imagen declarada en la ficha
       * de cada producto apuntaba a una direccion que Google tenia prohibido
       * mirar.
       *
       * La regla mas larga es la que manda, asi que esta gana sobre el
       * `/api` de abajo y el resto de la API sigue cerrado.
       */
      allow: ['/', '/api/media/'],
      disallow: ['/admin', '/api', '/cuenta', '/checkout', '/carrito', '/seguimiento'],
    },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
