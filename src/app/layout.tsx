import type { Metadata, Viewport } from 'next';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource-variable/inter';
import './globals.css';

import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getSessionPayload } from '@/lib/auth';
import { cartItemCount, getCart } from '@/lib/cart';

// La cabecera muestra el carrito y la sesion del visitante, asi que el layout
// no puede cachearse de forma estatica.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: 'Wacaco Store | Cafe de especialidad en cualquier lugar',
    template: '%s | Wacaco Store',
  },
  description:
    'Cafeteras espresso portatiles, manuales y electricas. Envio a todo el pais y pago seguro con Mercado Pago.',
  openGraph: {
    type: 'website',
    siteName: 'Wacaco Store',
    locale: 'es_CL',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1C1B1A',
  width: 'device-width',
  initialScale: 1,
};

async function loadHeaderData() {
  try {
    const [collections, products, announcementSetting] = await Promise.all([
      prisma.collection.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
        select: { slug: true, name: true },
      }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
        select: { slug: true, name: true },
        take: 24,
      }),
      prisma.setting.findUnique({ where: { key: 'store.announcement' } }),
    ]);
    return { collections, products, announcement: announcementSetting?.value ?? null };
  } catch {
    // Si la base de datos aun no responde el sitio debe seguir renderizando.
    return { collections: [], products: [], announcement: null };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ collections, products, announcement }, session, cart] = await Promise.all([
    loadHeaderData(),
    getSessionPayload(),
    getCart().catch(() => null),
  ]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>

        <SiteHeader
          collections={collections}
          productLinks={products}
          cartCount={cartItemCount(cart)}
          userName={session?.name ?? null}
          isAdmin={session?.role === 'ADMIN'}
          currency={env.currency}
          announcement={announcement}
        />

        <main id="contenido" className="flex-1">
          {children}
        </main>

        <SiteFooter storeName={env.storeName} />
      </body>
    </html>
  );
}
