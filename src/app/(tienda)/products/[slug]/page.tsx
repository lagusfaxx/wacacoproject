import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartForm, type VariantOption } from '@/components/add-to-cart-form';
import { ProductBlocks } from '@/components/product-blocks';
import { ProductGallery } from '@/components/product-gallery';
import { ProductCard } from '@/components/product-card';
import { CheckIcon, PackageIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { getProductBySlug, getRelatedProducts, toBlockData } from '@/lib/catalog';
import { env } from '@/lib/env';
import { formatMoney, toDecimal, toNumber } from '@/lib/money';
import {
  absoluteUrl,
  resolveSeoDescription,
  resolveSeoImage,
  resolveSeoTitle,
} from '@/lib/seo';
import { getStoreSettings } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [product, store] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) return { title: 'Producto no encontrado' };

  const fallback = {
    name: product.name,
    tagline: product.subtitle,
    body: product.description,
    image: product.images[0]?.url ?? null,
    storeName: store.name,
  };

  const title = resolveSeoTitle(product, fallback);
  const description = resolveSeoDescription(product, fallback);
  const image = absoluteUrl(resolveSeoImage(product, fallback), env.appUrl);
  const canonical = `${env.appUrl}/products/${product.slug}`;

  return {
    // `absolute` evita que la plantilla del layout agregue de nuevo el nombre
    // de la tienda a un titulo que el propietario ya escribio completo.
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: product.noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      siteName: store.name,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(
    product.id,
    product.collections.map((entry) => entry.collectionId),
  );

  const hasDiscount =
    product.compareAtPrice !== null &&
    toDecimal(product.compareAtPrice).greaterThan(toDecimal(product.price));

  const variants: VariantOption[] = product.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    colorHex: variant.colorHex,
    stock: variant.stock,
    priceLabel: formatMoney(toDecimal(product.price).plus(toDecimal(variant.priceDelta))),
  }));

  const specs = (product.specs ?? {}) as Record<string, string>;
  const specEntries = Object.entries(specs).filter(([, value]) => typeof value === 'string');

  const store = await getStoreSettings();
  const canonical = `${env.appUrl}/products/${product.slug}`;
  const availableUnits = product.variants.length
    ? product.variants.reduce((total, variant) => total + variant.stock, 0)
    : product.stock;

  // Ficha para Google: precio, moneda y disponibilidad reales. Solo se publica
  // cuando la pagina es indexable, para no describir algo que pedimos ocultar.
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: resolveSeoDescription(product, {
      name: product.name,
      tagline: product.subtitle,
      body: product.description,
    }),
    sku: product.sku,
    url: canonical,
    image: product.images
      .map((image) => absoluteUrl(image.url, env.appUrl))
      .filter((url): url is string => Boolean(url)),
    ...(product.award ? { award: product.award } : {}),
    offers: {
      '@type': 'Offer',
      url: canonical,
      price: toNumber(product.price),
      priceCurrency: env.currency,
      availability:
        availableUnits > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: store.name },
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: env.appUrl },
      { '@type': 'ListItem', position: 2, name: 'Productos', item: `${env.appUrl}/products` },
      ...(product.collections[0]
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: product.collections[0].collection.name,
              item: `${env.appUrl}/coleccion/${product.collections[0].collection.slug}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: product.collections[0] ? 4 : 3,
        name: product.name,
        item: canonical,
      },
    ],
  };

  return (
    <>
      {!product.noIndex ? (
        <>
          <JsonLd data={productJsonLd} />
          <JsonLd data={breadcrumbJsonLd} />
        </>
      ) : null}
      <nav aria-label="Migas de pan" className="border-b border-sand-dark">
        <div className="container-site flex flex-wrap items-center gap-2 py-4 text-xs uppercase tracking-widest text-ink-muted">
          <Link href="/" className="hover:text-brand">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/products" className="hover:text-brand">
            Productos
          </Link>
          {product.collections[0] ? (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={`/coleccion/${product.collections[0].collection.slug}`}
                className="hover:text-brand"
              >
                {product.collections[0].collection.name}
              </Link>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <span className="text-ink">{product.name}</span>
        </div>
      </nav>

      <div className="container-site grid gap-12 py-12 lg:grid-cols-2 lg:gap-16">
        <ProductGallery
          images={product.images.map((image) => ({ url: image.url, alt: image.alt }))}
          productName={product.name}
        />

        <div className="lg:sticky lg:top-28 lg:self-start">
          {product.award ? (
            <span className="badge mb-4 bg-sand text-ink-soft">{product.award}</span>
          ) : null}

          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-ink lg:text-5xl">
            {product.name}
          </h1>
          {product.subtitle ? (
            <p className="mt-3 text-base uppercase tracking-wide text-ink-muted">
              {product.subtitle}
            </p>
          ) : null}

          <div className="mt-6 flex items-baseline gap-3">
            {hasDiscount ? (
              <span className="text-lg text-ink-muted line-through">
                {formatMoney(product.compareAtPrice!)}
              </span>
            ) : null}
            <span
              className={`font-display text-3xl font-semibold ${hasDiscount ? 'text-brand' : 'text-ink'}`}
            >
              {formatMoney(product.price)}
            </span>
          </div>

          <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">{product.description}</p>

          <AddToCartForm productId={product.id} variants={variants} stock={product.stock} />

          <ul className="mt-10 space-y-3 border-t border-sand-dark pt-8">
            <Perk icon={<TruckIcon className="h-5 w-5" />}>
              {env.freeShippingThreshold > 0
                ? `Envio gratis en compras sobre ${formatMoney(env.freeShippingThreshold)}`
                : 'El costo de despacho se calcula en el checkout'}
            </Perk>
            <Perk icon={<ShieldIcon className="h-5 w-5" />}>
              Pago seguro con Mercado Pago (tarjetas, transferencia y efectivo)
            </Perk>
            <Perk icon={<PackageIcon className="h-5 w-5" />}>
              Sigue tu pedido en linea desde el despacho hasta la entrega
            </Perk>
          </ul>
        </div>
      </div>

      {product.features.length > 0 || specEntries.length > 0 ? (
        <section className="border-t border-sand-dark bg-sand">
          <div className="container-site grid gap-12 py-16 lg:grid-cols-2">
            {product.features.length > 0 ? (
              <div>
                <h2 className="section-title">Caracteristicas</h2>
                <ul className="mt-6 space-y-4">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-[15px] text-ink-soft">
                      <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {specEntries.length > 0 ? (
              <div>
                <h2 className="section-title">Especificaciones</h2>
                <dl className="mt-6 divide-y divide-sand-dark border-y border-sand-dark">
                  {specEntries.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-6 py-3.5">
                      <dt className="font-display text-xs font-semibold uppercase tracking-widest text-ink-muted">
                        {key}
                      </dt>
                      <dd className="text-right text-sm text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Contenido editorial del producto: fotos de uso, relato de marca y
          video, en el orden que se definio en el panel. */}
      <ProductBlocks blocks={toBlockData(product.blocks)} />

      {related.length > 0 ? (
        <section className="border-t border-sand-dark">
          <div className="container-site py-12">
            <h2 className="section-title">Tambien te puede gustar</h2>
          </div>
          <div className="grid grid-cols-1 border-t border-sand-dark sm:grid-cols-2 xl:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.slug} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Perk({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-ink-soft">
      <span className="mt-0.5 shrink-0 text-brand">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
