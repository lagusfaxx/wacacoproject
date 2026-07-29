import type { Metadata, Viewport } from 'next';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource-variable/inter';
import '../globals.css';

import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { VisitTracker } from '@/components/visit-tracker';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getSessionPayload } from '@/lib/auth';
import { cartItemCount, getCart } from '@/lib/cart';
import { getNavLinks, getStoreSettings, storeIcons } from '@/lib/store-settings';
import { getSocialSettings, whatsappUrl } from '@/lib/social';
import { WhatsappButton } from '@/components/whatsapp-button';

// La cabecera muestra el carrito y la sesion del visitante, asi que el layout
// no puede cachearse de forma estatica.
export const dynamic = 'force-dynamic';

/**
 * Los metadatos base salen de los ajustes de la tienda, no de constantes: el
 * propietario cambia el nombre o la descripcion desde el panel y se refleja en
 * el titulo de todas las paginas y en lo que ven las redes al compartir.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();

  return {
    metadataBase: new URL(env.appUrl),
    title: {
      default: settings.name,
      template: `%s | ${settings.name}`,
    },
    description: settings.metaDescription,
    applicationName: settings.name,
    icons: storeIcons(settings.faviconUrl),
    openGraph: {
      type: 'website',
      siteName: settings.name,
      locale: 'es_CL',
      description: settings.metaDescription,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#1C1B1A',
  width: 'device-width',
  initialScale: 1,
};

async function loadHeaderData() {
  try {
    const [collections, products] = await Promise.all([
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
    ]);
    return { collections, products };
  } catch {
    // Si la base de datos aun no responde el sitio debe seguir renderizando.
    return { collections: [], products: [] };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ collections, products }, settings, navLinks, session, cart, social] = await Promise.all([
    loadHeaderData(),
    getStoreSettings(),
    getNavLinks(),
    getSessionPayload(),
    getCart().catch(() => null),
    getSocialSettings(),
  ]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col">
        <VisitTracker />
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
          announcement={settings.announcement}
          storeName={settings.name}
          logoUrl={settings.logoUrl}
          secondaryLogoUrl={settings.secondaryLogoUrl}
          secondaryLogoAlt={settings.secondaryLogoAlt}
          navLinks={navLinks}
        />

        <main id="contenido" className="flex-1">
          {children}
        </main>

        <SiteFooter
          storeName={settings.name}
          logoUrl={settings.logoUrl}
          secondaryLogoUrl={settings.secondaryLogoUrl}
          secondaryLogoAlt={settings.secondaryLogoAlt}
          paymentLogoUrl={settings.paymentLogoUrl}
          instagramUrl={social.instagram}
          instagramHandle={social.instagramHandle}
          floatingButton={Boolean(social.whatsapp)}
        />

        {social.whatsapp ? (
          <WhatsappButton href={whatsappUrl(social.whatsapp, social.whatsappMessage)} />
        ) : null}
      </body>
    </html>
  );
}
