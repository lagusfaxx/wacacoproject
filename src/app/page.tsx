import Link from 'next/link';
import { HeroSlider, type HeroSlide } from '@/components/hero-slider';
import { Marquee } from '@/components/marquee';
import { ProductCard } from '@/components/product-card';
import { LeafIcon, PackageIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { prisma } from '@/lib/db';
import { getFeaturedProducts } from '@/lib/catalog';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

const SUSTAINABILITY_CLAIMS = [
  'Minimiza el consumo energetico',
  'Reduce el impacto ambiental',
  'Menores emisiones de carbono',
  'Ahorra en cafeterias',
];

const BRAND_CLAIMS = [
  '"Rendimiento reconocido"',
  '"Cafe premium donde sea"',
  '"Innovacion constante"',
  '"Durabilidad probada"',
];

export default async function HomePage() {
  const [featured, collections, newest] = await Promise.all([
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

  const slides: HeroSlide[] = [
    {
      eyebrow: 'Nuevo lanzamiento',
      highlight: newest?.name ?? 'Prestina',
      title: 'Tu taza. Tu prensa.',
      subtitle: 'Sin embolo. Sin complejidad. Solo un cafe excelente.',
      ctaLabel: 'Comprar ahora',
      ctaHref: newest ? `/productos/${newest.slug}` : '/productos',
      image: newest?.images[0]?.url ?? null,
      gradient: 'linear-gradient(120deg, #2A2622 0%, #4A3F35 55%, #6B5B48 100%)',
    },
    {
      eyebrow: heroProduct?.name ?? 'Pixapresso',
      title: 'Potencia tu espresso',
      subtitle: 'Calienta y extrae en un solo paso, con bateria para todo el dia.',
      ctaLabel: 'Ver producto',
      ctaHref: heroProduct ? `/productos/${heroProduct.slug}` : '/productos',
      image: heroProduct?.image ?? null,
      gradient: 'linear-gradient(120deg, #1C1B1A 0%, #3A342E 60%, #5C5348 100%)',
    },
    {
      eyebrow: 'Coleccion manual',
      title: 'Presion en tus manos',
      subtitle: 'Hasta 18 bares generados a pulso, sin cables ni enchufes.',
      ctaLabel: 'Explorar coleccion',
      ctaHref: '/coleccion/manual-espresso-makers',
      image: '/products/nanopresso.svg',
      gradient: 'linear-gradient(120deg, #23281F 0%, #3E4B3F 55%, #6C7A5E 100%)',
    },
  ];

  return (
    <>
      <HeroSlider slides={slides} />

      <Marquee items={SUSTAINABILITY_CLAIMS} />

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
            <p className="mt-4 max-w-md text-lg text-white/80">
              {newest.subtitle ?? 'El sabor de la simplicidad.'}
            </p>
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

      <Marquee items={BRAND_CLAIMS} />

      <section className="border-t border-sand-dark bg-sand">
        <div className="container-site grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <Benefit
            icon={<TruckIcon className="h-7 w-7" />}
            title="Envio a todo el pais"
            description={
              env.freeShippingThreshold > 0
                ? `Gratis en compras sobre ${formatMoney(env.freeShippingThreshold)}.`
                : 'Despacho en 24 a 48 horas habiles.'
            }
          />
          <Benefit
            icon={<ShieldIcon className="h-7 w-7" />}
            title="Pago seguro"
            description="Procesado por Mercado Pago. Nunca almacenamos datos de tu tarjeta."
          />
          <Benefit
            icon={<PackageIcon className="h-7 w-7" />}
            title="Garantia oficial"
            description="2 anos de garantia y repuestos disponibles para toda la linea."
          />
          <Benefit
            icon={<LeafIcon className="h-7 w-7" />}
            title="Menos residuos"
            description="Filtros reutilizables y piezas de repuesto para alargar la vida util."
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
