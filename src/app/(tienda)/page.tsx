import Link from 'next/link';
import { HeroSlider, type HeroSlide } from '@/components/hero-slider';
import { Marquee } from '@/components/marquee';
import { ProductCard } from '@/components/product-card';
import { LeafIcon, PackageIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { prisma } from '@/lib/db';
import { getFeaturedProducts } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/store-settings';
import { isBluexpressEnabled } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [settings, featured, collections, newest] = await Promise.all([
    getStoreSettings(),
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

  // Los textos del hero salen del catalogo: nombre, subtitulo y descripcion de
  // coleccion son campos que el propietario edita desde el panel. Asi la
  // portada no afirma nada que no este cargado como dato real de la tienda.
  const slides: HeroSlide[] = [];

  if (newest) {
    slides.push({
      eyebrow: 'Nuevo',
      highlight: newest.name,
      title: settings.heroHeadline ?? '',
      subtitle: newest.subtitle ?? '',
      ctaLabel: 'Ver producto',
      ctaHref: `/productos/${newest.slug}`,
      image: newest.images[0]?.url ?? null,
      gradient: 'linear-gradient(120deg, #2A2622 0%, #4A3F35 55%, #6B5B48 100%)',
    });
  }

  if (heroProduct) {
    slides.push({
      eyebrow: 'Destacado',
      highlight: heroProduct.name,
      title: '',
      subtitle: heroProduct.subtitle ?? '',
      ctaLabel: 'Ver producto',
      ctaHref: `/productos/${heroProduct.slug}`,
      image: heroProduct.image,
      gradient: 'linear-gradient(120deg, #1C1B1A 0%, #3A342E 60%, #5C5348 100%)',
    });
  }

  const heroCollection = collections[0];
  if (heroCollection) {
    slides.push({
      eyebrow: 'Coleccion',
      highlight: heroCollection.name,
      title: '',
      subtitle: heroCollection.tagline ?? '',
      ctaLabel: 'Explorar coleccion',
      ctaHref: `/coleccion/${heroCollection.slug}`,
      image: heroCollection.image,
      gradient: 'linear-gradient(120deg, #23281F 0%, #3E4B3F 55%, #6C7A5E 100%)',
    });
  }

  return (
    <>
      <HeroSlider slides={slides} />

      <Marquee items={settings.marquee} />

      <section className="border-t border-sand-dark">
        <div className="container-site py-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="section-title">Mas vendidos</h2>
            <Link
              href="/productos"
              className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-brand hover:underline"
            >
              Ver todo el catalogo
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 border-t border-sand-dark sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      {newest ? (
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#2A2622] via-[#4A3F35] to-[#7A6A55]">
          <div className="container-site relative z-10 flex min-h-[440px] flex-col justify-center py-20">
            <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-brand">
              Nuevo
            </p>
            <h2 className="mt-3 font-display text-6xl font-bold uppercase leading-none tracking-tight text-white lg:text-8xl">
              {newest.name}
            </h2>
            {newest.subtitle ? (
              <p className="mt-4 max-w-md text-lg text-white/80">{newest.subtitle}</p>
            ) : null}
            <div className="mt-9">
              <Link href={`/productos/${newest.slug}`} className="btn-primary">
                Comprar ahora
              </Link>
            </div>
          </div>
          {newest.images[0] ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[8%] top-1/2 hidden aspect-square h-[68%] -translate-y-1/2 items-center justify-center rounded-full bg-sand/95 p-10 shadow-2xl lg:flex"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newest.images[0].url} alt="" className="h-full w-full object-contain" />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="border-t border-sand-dark">
        <div className="container-site py-12">
          <h2 className="section-title">Colecciones</h2>
        </div>
        <div className="grid grid-cols-1 border-t border-sand-dark sm:grid-cols-2 xl:grid-cols-4">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/coleccion/${collection.slug}`}
              className="group flex flex-col border-b border-r border-sand-dark bg-sand p-8 transition-colors hover:bg-white"
            >
              {/* Altura fija en el icono para que todos los titulos queden
                  alineados, aunque una descripcion ocupe dos lineas. */}
              <div className="flex h-56 items-center justify-center">
                {collection.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collection.image}
                    alt=""
                    aria-hidden="true"
                    className="h-40 w-40 object-contain transition-transform duration-500 group-hover:scale-105"
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
