import type { Metadata, Viewport } from 'next';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource-variable/inter';
import '../globals.css';

import { getStoreSettings, storeIcons } from '@/lib/store-settings';

/**
 * Layout raiz del panel de administracion.
 *
 * Es independiente del de la tienda a proposito: el panel no debe arrastrar la
 * cabecera, el buscador ni el pie de pagina del sitio publico.
 */
// El icono sale de la base de datos, asi que el panel se arma en cada visita.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();

  return {
    title: { default: 'Panel', template: '%s | Panel' },
    robots: { index: false, follow: false },
    // El panel comparte el icono de la tienda: es la misma pestana para quien
    // atiende el negocio.
    icons: storeIcons(settings.faviconUrl),
  };
}

export const viewport: Viewport = {
  themeColor: '#1C1B1A',
  width: 'device-width',
  initialScale: 1,
};

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-sand">{children}</body>
    </html>
  );
}
