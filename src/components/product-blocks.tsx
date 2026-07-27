import Link from 'next/link';
import { toBannerVideo } from '@/lib/banner-style';
import type { ProductBlockData, ProductBlockTheme } from '@/lib/product-blocks';
import { blockIsEmpty } from '@/lib/product-blocks';
import { safeHref } from '@/lib/validation';

/**
 * Contenido editorial bajo la ficha del producto.
 *
 * Cada bloque ocupa el ancho completo de la pantalla y se apila en el orden
 * que definio el propietario en el panel. La pagina no sabe que hay dentro:
 * pide la lista y aqui se decide como se dibuja cada tipo.
 */
export function ProductBlocks({ blocks }: { blocks: ProductBlockData[] }) {
  const visible = blocks.filter((block) => block.active && !blockIsEmpty(block));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((block, index) => (
        <ProductBlockSection key={block.id || `bloque-${index}`} block={block} index={index} />
      ))}
    </>
  );
}

const THEME: Record<ProductBlockTheme, { section: string; title: string; body: string; eyebrow: string }> = {
  dark: {
    section: 'bg-ink text-white',
    title: 'text-white',
    body: 'text-white/75',
    eyebrow: 'text-white/50',
  },
  light: {
    section: 'bg-white text-ink',
    title: 'text-ink',
    body: 'text-ink-soft',
    eyebrow: 'text-ink-muted',
  },
  sand: {
    section: 'bg-sand text-ink',
    title: 'text-ink',
    body: 'text-ink-soft',
    eyebrow: 'text-ink-muted',
  },
};

function ProductBlockSection({ block, index }: { block: ProductBlockData; index: number }) {
  const theme = THEME[block.theme];

  if (block.kind === 'gallery') {
    return (
      <section aria-label={block.title || 'Galeria del producto'} className={theme.section}>
        {block.title || block.eyebrow ? (
          <div className="container-site py-14 text-center">
            <BlockHeading block={block} />
          </div>
        ) : null}

        {/*
          En el telefono la franja se desliza a lo ancho, porque ocho fotos en
          columna serian una pagina entera de scroll. Desde tablet se reparten
          el ancho completo en una sola fila: las fotos se estrechan segun
          cuantas haya, en vez de saltar a una segunda linea a medio llenar.
        */}
        <ul className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto sm:overflow-visible">
          {block.images.map((url, imageIndex) => (
            <li
              key={`${url}-${imageIndex}`}
              className="w-[72%] shrink-0 snap-start bg-sand sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={block.title ? `${block.title} ${imageIndex + 1}` : ''}
                loading="lazy"
                className="aspect-square w-full object-cover sm:aspect-auto sm:h-52 lg:h-64"
              />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (block.kind === 'video') {
    return (
      <section aria-label={block.title || 'Video del producto'} className={theme.section}>
        {block.title || block.eyebrow || block.body ? (
          <div className="container-site py-14 text-center">
            <BlockHeading block={block} />
            {block.body ? (
              <p className={`mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed ${theme.body}`}>
                {block.body}
              </p>
            ) : null}
          </div>
        ) : null}

        <BlockVideo block={block} />
        <BlockCta block={block} className="container-site pb-14 pt-10 text-center" />
      </section>
    );
  }

  if (block.kind === 'split') {
    // Los bloques partidos alternan el lado de la foto para que dos seguidos
    // no se lean como una sola columna de texto.
    const imageFirst = index % 2 === 0;

    return (
      <section className={theme.section}>
        <div className="grid items-center gap-0 lg:grid-cols-2">
          {block.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.image}
              alt={block.title || ''}
              loading="lazy"
              className={`aspect-[4/3] h-full w-full object-cover lg:aspect-auto lg:min-h-[520px] ${
                imageFirst ? '' : 'lg:order-2'
              }`}
            />
          ) : null}

          <div className="px-6 py-14 sm:px-12 lg:px-16 lg:py-20">
            <BlockHeading block={block} />
            {block.body ? (
              <p className={`mt-6 max-w-xl text-[15px] leading-relaxed ${theme.body}`}>
                {block.body}
              </p>
            ) : null}
            <BlockCta block={block} className="mt-8" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={theme.section}>
      <div className="container-site py-20 text-center sm:py-24">
        {block.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.image}
            alt={block.title || ''}
            loading="lazy"
            className="mx-auto mb-10 h-16 w-auto max-w-full object-contain sm:h-20"
          />
        ) : null}

        <BlockHeading block={block} size="lg" />

        {block.body ? (
          <p className={`mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed ${theme.body}`}>
            {block.body}
          </p>
        ) : null}

        <BlockCta block={block} className="mt-10" />
      </div>
    </section>
  );
}

function BlockHeading({ block, size = 'md' }: { block: ProductBlockData; size?: 'md' | 'lg' }) {
  const theme = THEME[block.theme];
  if (!block.title && !block.eyebrow) return null;

  return (
    <>
      {block.eyebrow ? (
        <p
          className={`font-display text-xs font-bold uppercase tracking-[0.25em] ${theme.eyebrow}`}
        >
          {block.eyebrow}
        </p>
      ) : null}
      {block.title ? (
        <h2
          className={`font-display font-bold uppercase leading-none tracking-tight ${theme.title} ${
            block.eyebrow ? 'mt-4' : ''
          } ${size === 'lg' ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}
        >
          {block.title}
        </h2>
      ) : null}
    </>
  );
}

function BlockCta({ block, className = '' }: { block: ProductBlockData; className?: string }) {
  // El destino se filtra tambien al dibujar, no solo al guardar: un dato que
  // llegue de un respaldo viejo o de una edicion directa a la base tampoco
  // debe poder poner un `javascript:` en el boton.
  const href = safeHref(block.ctaHref);
  if (!block.ctaLabel || !href) return null;

  return (
    <div className={className}>
      <Link href={href} className={block.theme === 'dark' ? 'btn-primary' : 'btn-dark'}>
        {block.ctaLabel}
      </Link>
    </div>
  );
}

/**
 * Video del bloque: se reproduce solo, en silencio, en bucle y sin controles.
 *
 * Es la misma idea que el video de fondo de un banner, pero ocupando su propia
 * franja en lugar de ir detras del texto. Los navegadores solo permiten el
 * autoplay si el video esta silenciado, de ahi `muted`. Sin controles no hay
 * nada que pulsar, asi que tampoco captura clics: la franja se comporta como
 * una imagen en movimiento.
 */
function BlockVideo({ block }: { block: ProductBlockData }) {
  const video = toBannerVideo(block.video);
  if (!video) return null;

  if (video.kind === 'file') {
    return (
      <video
        aria-hidden="true"
        tabIndex={-1}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={block.image || undefined}
        className="pointer-events-none aspect-video w-full bg-black object-cover"
      >
        <source src={video.src} />
      </video>
    );
  }

  // El iframe llega en 16:9 y la franja tambien lo es, asi que llena el hueco
  // exacto sin recortes. Se le quitan los eventos del raton para que la
  // interfaz de YouTube o Vimeo no asome al pasar por encima.
  return (
    <div aria-hidden="true" className="pointer-events-none relative aspect-video w-full bg-black">
      <iframe
        src={video.src}
        title=""
        tabIndex={-1}
        allow="autoplay; encrypted-media; picture-in-picture"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
