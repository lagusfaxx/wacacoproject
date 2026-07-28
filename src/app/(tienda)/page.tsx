import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroSlider, type HeroSlide } from '@/components/hero-slider';
import { FeatureBanner, type FeatureBannerContent } from '@/components/feature-banner';
import { toBannerVideo, toImageMode, toOverlay, toPlacement } from '@/lib/banner-style';
import { JsonLd } from '@/components/json-ld';
import { Marquee } from '@/components/marquee';
import { ProductCard } from '@/components/product-card';
import { LeafIcon, PackageIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { prisma } from '@/lib/db';
import { ProductStrip } from '@/components/product-strip';
import { getFeaturedProducts, getProductStrips } from '@/lib/catalog';
import { buildHomeSeo } from '@/lib/home-seo';
import { absoluteUrl } from '@/lib/seo';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/store-settings';
import { isBluexpressEnabled } from '@/lib/shipping';
import { MediaImage } from '@/components/media-image';

export const dynamic = 'force-dynamic';

/**
 * Nombres del catalogo con los que se arma el SEO de la portada cuando el
 * propietario no escribio el suyo. Son las palabras por las que se busca la
 * tienda, asi que tienen que estar en el titulo y en el texto.
 */
async function loadSeoNames() {
  try {
    const [products, collections] = await Promise.all([
      prisma.product.findMany({
        where: { active: true, noIndex: false },
        orderBy: [{ featured: 'desc' }, { position: 'asc' }],
        select: { name: true, slug: true },
        take: 8,
      }),
      prisma.collection.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
        select: { name: true, slug: true },
        take: 4,
      }),
    ]);
    return { products, collections };
  } catch {
    return { products: [], collections: [] };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [store, { products, collections }] = await Promise.all([
    getStoreSettings(),
    loadSeoNames(),
  ]);

  const seo = buildHomeSeo({
    storeName: store.name,
    brand: store.brand,
    seoTitle: store.seoTitle,
    seoHeading: store.seoHeading,
    seoText: store.seoText,
    metaDescription: store.metaDescriptionCustom,
    productNames: products.map((product) => product.name),
    collectionNames: collections.map((collection) => collection.name),
  });

  return {
    // Absoluto: la plantilla del layout agrega el nombre de la tienda al final
    // y aqui ya esta escrito donde corresponde.
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: env.appUrl },
    openGraph: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: env.appUrl,
      siteName: store.name,
      ...(store.logoUrl ? { images: [{ url: absoluteUrl(store.logoUrl, env.appUrl)! }] } : {}),
    },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description },
  };
}

type BannerRow = Awaited<ReturnType<typeof prisma.banner.findMany>>[number];

/** Pasa un banner guardado a la franja ancha que se dibuja en la portada. */
function toFeature(banner: BannerRow): FeatureBannerContent {
  return {
    eyebrow: banner.eyebrow ?? '',
    title: banner.title ?? '',
    subtitle: banner.subtitle ?? '',
    subtitleBold: banner.subtitleBold,
    ctaLabel: banner.ctaLabel || 'Comprar ahora',
    ctaHref: banner.ctaHref || '/products',
    image: banner.image,
    video: toBannerVideo(banner.video),
    imageMode: toImageMode(banner.imageMode),
    overlay: toOverlay(banner.overlay),
    background:
      banner.background ?? 'linear-gradient(to bottom right, #2A2622 0%, #4A3F35 55%, #7A6A55 100%)',
  };
}

export default async function HomePage() {
  const [settings, banners, strips, featured, collections, newest] = await Promise.all([
    getStoreSettings(),
    prisma.banner.findMany({ where: { active: true }, orderBy: { position: 'asc' } }),
    getProductStrips(),
    getFeaturedProducts(4),
    prisma.collection.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      take: 4,
    }),
    prisma.product.findFirst({
      where: { active: true, isNew: true },
      orderBy: { position: 'asc' },
      include: { images: { orderBy: { position: 'asc' } } },
    }),
  ]);

  const heroProduct = featured[0];
  const bluexEnabled = isBluexpressEnabled();

  // El mismo texto que ve Google en el titulo lo ve tambien el visitante mas
  // abajo: es contenido de la pagina, no una etiqueta escondida.
  const seoNames = await loadSeoNames();
  const seo = buildHomeSeo({
    storeName: settings.name,
    brand: settings.brand,
    seoTitle: settings.seoTitle,
    seoHeading: settings.seoHeading,
    seoText: settings.seoText,
    metaDescription: settings.metaDescriptionCustom,
    productNames: seoNames.products.map((product) => product.name),
    collectionNames: seoNames.collections.map((collection) => collection.name),
  });

  // Cada banner declara donde va: el carrusel de arriba o alguna de las
  // franjas anchas que bajan por la portada.
  const heroBanners = banners.filter((banner) => toPlacement(banner.placement) === 'hero');
  const featureBanners = banners.filter((banner) => toPlacement(banner.placement) === 'destacado');
  const bottomBanners = banners.filter((banner) => toPlacement(banner.placement) === 'inferior');

  // Las tiras de productos elegidos a mano comparten las dos franjas anchas
  // con los banners: van justo despues de ellos.
  const featureStrips = strips.filter((strip) => strip.placement !== 'inferior');
  const bottomStrips = strips.filter((strip) => strip.placement === 'inferior');

  // Si el propietario creo banners, mandan ellos. Si no, la portada se arma
  // sola con el catalogo para que nunca se vea vacia.
  const slides: HeroSlide[] = heroBanners.map((banner) => ({
    eyebrow: banner.eyebrow ?? '',
    highlight: banner.title ?? '',
    title: '',
    subtitle: banner.subtitle ?? '',
    subtitleBold: banner.subtitleBold,
    ctaLabel: banner.ctaLabel || 'Ver mas',
    ctaHref: banner.ctaHref || '/products',
    image: banner.image,
    video: toBannerVideo(banner.video),
    imageMode: toImageMode(banner.imageMode),
    overlay: toOverlay(banner.overlay),
    gradient: banner.background ?? 'linear-gradient(120deg, #1C1B1A 0%, #3A342E 60%, #5C5348 100%)',
  }));

  if (heroBanners.length === 0 && newest) {
    slides.push({
      eyebrow: 'Nuevo',
      highlight: newest.name,
      title: settings.heroHeadline ?? '',
      subtitle: newest.subtitle ?? '',
      ctaLabel: 'Ver producto',
      ctaHref: `/products/${newest.slug}`,
      image: newest.images[0]?.url ?? null,
      imageMode: 'side',
      gradient: 'linear-gradient(120deg, #2A2622 0%, #4A3F35 55%, #6B5B48 100%)',
    });
  }

  if (heroBanners.length === 0 && heroProduct) {
    slides.push({
      eyebrow: 'Destacado',
      highlight: heroProduct.name,
      title: '',
      subtitle: heroProduct.subtitle ?? '',
      ctaLabel: 'Ver producto',
      ctaHref: `/products/${heroProduct.slug}`,
      image: heroProduct.image,
      imageMode: 'side',
      gradient: 'linear-gradient(120deg, #1C1B1A 0%, #3A342E 60%, #5C5348 100%)',
    });
  }

  const heroCollection = collections[0];
  if (heroBanners.length === 0 && heroCollection) {
    slides.push({
      eyebrow: 'Coleccion',
      highlight: heroCollection.name,
      title: '',
      subtitle: heroCollection.tagline ?? '',
      ctaLabel: 'Explorar coleccion',
      ctaHref: `/coleccion/${heroCollection.slug}`,
      image: heroCollection.image,
      imageMode: 'side',
      gradient: 'linear-gradient(120deg, #23281F 0%, #3E4B3F 55%, #6C7A5E 100%)',
    });
  }

  // Las franjas anchas se apilan en el orden que el propietario les dio, asi
  // que una misma ubicacion puede llevar varias, como en las portadas de las
  // tiendas de referencia.
  const features = featureBanners.map((banner) => ({ key: banner.id, content: toFeature(banner) }));
  const bottomFeatures = bottomBanners.map((banner) => ({
    key: banner.id,
    content: toFeature(banner),
  }));

  // Si no hay ningun banner bajo "Mas vendidos", esa franja se sigue armando
  // sola con el producto marcado como "Nuevo" para que no quede un hueco.
  if (features.length === 0 && newest) {
    features.push({
      key: newest.id,
      content: {
        eyebrow: 'Nuevo',
        title: newest.name,
        subtitle: newest.subtitle ?? '',
        ctaLabel: 'Comprar ahora',
        ctaHref: `/products/${newest.slug}`,
        image: newest.images[0]?.url ?? null,
        video: null,
        imageMode: 'side',
        overlay: 'medium',
        background: 'linear-gradient(to bottom right, #2A2622 0%, #4A3F35 55%, #7A6A55 100%)',
      },
    });
  }

  // Identidad del sitio para Google: nombre, dominio y el buscador interno,
  // que puede aparecer como caja de busqueda en el resultado.
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // "OnlineStore" es mas preciso que "Organization" y le dice a Google
        // que esto vende, que marcas y donde despacha.
        '@type': 'OnlineStore',
        '@id': `${env.appUrl}/#organizacion`,
        name: settings.name,
        description: seo.description,
        url: env.appUrl,
        email: settings.email,
        areaServed: { '@type': 'Country', name: 'Chile' },
        ...(settings.brand ? { brand: { '@type': 'Brand', name: settings.brand } } : {}),
        currenciesAccepted: env.currency,
        ...(settings.logoUrl ? { logo: absoluteUrl(settings.logoUrl, env.appUrl) } : {}),
        ...(seoNames.products.length > 0
          ? {
              makesOffer: seoNames.products.map((product) => ({
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Product',
                  name: product.name,
                  ...(settings.brand ? { brand: { '@type': 'Brand', name: settings.brand } } : {}),
                  url: `${env.appUrl}/products/${product.slug}`,
                },
              })),
            }
          : {}),
      },
      // La lista con los productos de la portada, en su orden: ayuda a que
      // Google entienda que la portada lleva a cada ficha.
      ...(seoNames.products.length > 0
        ? [
            {
              '@type': 'ItemList',
              '@id': `${env.appUrl}/#catalogo`,
              name: `Productos de ${settings.name}`,
              itemListElement: seoNames.products.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: product.name,
                url: `${env.appUrl}/products/${product.slug}`,
              })),
            },
          ]
        : []),
      {
        '@type': 'WebSite',
        '@id': `${env.appUrl}/#sitio`,
        name: settings.name,
        url: env.appUrl,
        inLanguage: 'es-CL',
        publisher: { '@id': `${env.appUrl}/#organizacion` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${env.appUrl}/buscar?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={siteJsonLd} />
      <HeroSlider slides={slides} />

      <Marquee items={settings.marquee} />

      <section className="border-t border-sand-dark">
        {/* La franja del titular va en arena, como la de beneficios del pie. */}
        <div className="bg-sand">
          <div className="container-site py-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="section-title">Mas vendidos</h2>
              <Link
                href="/products"
                className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
              >
                Ver todo el catalogo
              </Link>
            </div>
          </div>
        </div>

        {/* En telefono la tira se desliza de lado: una lista vertical de
            tarjetas a pantalla completa obligaba a recorrer media portada
            para pasar de un producto al siguiente. La tarjeta no ocupa todo
            el ancho a proposito, para que se asome la siguiente y se entienda
            que hay mas. */}
        <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto border-t border-sand-dark sm:grid sm:grid-cols-2 sm:overflow-x-visible xl:grid-cols-4">
          {featured.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              compact
              className="w-[78%] shrink-0 snap-start sm:w-auto"
            />
          ))}
        </div>
      </section>

      {features.map((feature) => (
        <FeatureBanner key={feature.key} content={feature.content} />
      ))}

      {featureStrips.map((strip) => (
        <ProductStrip key={strip.id} title={strip.title} products={strip.products} />
      ))}

      <section className="border-t border-sand-dark">
        <div className="bg-sand">
          <div className="container-site py-12">
            <h2 className="section-title">Colecciones</h2>
          </div>
        </div>
        <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto border-t border-sand-dark sm:grid sm:grid-cols-2 sm:overflow-x-visible xl:grid-cols-4">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/coleccion/${collection.slug}`}
              className="group flex w-[78%] shrink-0 snap-start flex-col border-b border-r border-sand-dark bg-sand p-8 transition-colors hover:bg-white sm:w-auto"
            >
              {/* Altura fija en el icono para que todos los titulos queden
                  alineados, aunque una descripcion ocupe dos lineas. */}
              <div className="flex h-[11.9rem] items-center justify-center">
                {collection.image ? (
                  <MediaImage
                    src={collection.image}
                    alt=""
                    aria-hidden="true"
                    sizes="320px"
                    className="h-[8.5rem] w-[8.5rem] object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="mt-auto pt-6">
                <h3 className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-ink transition-colors group-hover:text-brand">
                  {collection.name}
                </h3>
                <p className="mt-2 text-sm uppercase tracking-wide text-ink-muted">
                  {collection.tagline}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {bottomFeatures.map((feature) => (
        <FeatureBanner key={feature.key} content={feature.content} />
      ))}

      {bottomStrips.map((strip) => (
        <ProductStrip key={strip.id} title={strip.title} products={strip.products} />
      ))}

      {/*
        El unico texto largo de la portada, y su h1.
        Una portada de tienda es casi toda imagen: para un buscador, sin un
        parrafo que diga que se vende y sin enlaces con el nombre de cada
        producto, no hay nada que leer. Esto se edita en Ajustes; si esta
        vacio, se arma solo con el catalogo.
      */}
      <section className="border-t border-sand-dark bg-white">
        <div className="container-site py-16">
          <h1 className="max-w-3xl font-display text-3xl font-bold uppercase leading-tight tracking-tight sm:text-4xl">
            {seo.heading}
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{seo.text}</p>

          {seoNames.products.length > 0 ? (
            <nav aria-label="Productos de la tienda" className="mt-8">
              <ul className="flex flex-wrap gap-2">
                {seoNames.products.map((product) => (
                  <li key={product.slug}>
                    <Link
                      href={`/products/${product.slug}`}
                      className="inline-block border border-sand-dark px-4 py-2 text-sm transition-colors hover:border-ink hover:text-brand"
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </section>

      <section className="border-t border-sand-dark bg-sand">
        <div className="container-site grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <Benefit
            icon={<TruckIcon className="h-7 w-7" />}
            title="Envio a todo Chile"
            description={
              bluexEnabled
                ? 'El costo se cotiza con Blue Express segun tu comuna antes de pagar.'
                : 'El costo de despacho se calcula antes de confirmar tu compra.'
            }
          />
          <Benefit
            icon={<ShieldIcon className="h-7 w-7" />}
            title="Pago seguro"
            description="El cobro lo procesa Mercado Pago. Nunca almacenamos los datos de tu tarjeta."
          />
          <Benefit
            icon={<PackageIcon className="h-7 w-7" />}
            title="Seguimiento del pedido"
            description="Sigue el estado de tu compra con tu numero de pedido, con o sin cuenta."
          />
          <Benefit
            icon={<LeafIcon className="h-7 w-7" />}
            title="Compra sin registro"
            description="Puedes comprar como invitado o crear una cuenta para guardar tus datos."
          />
        </div>
      </section>
    </>
  );
}

function Benefit({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <span className="text-brand">{icon}</span>
      <h3 className="mt-4 font-display text-base font-bold uppercase tracking-wide text-ink">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}
