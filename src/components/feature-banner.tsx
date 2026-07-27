import Link from 'next/link';
import { type HeroImageMode, type HeroOverlay, OVERLAY_CLASS } from '@/lib/banner-style';

/**
 * Franja ancha del medio de la portada, bajo "Mas vendidos".
 *
 * A diferencia del carrusel de arriba, aqui siempre se muestra un solo banner,
 * asi que no necesita estado ni interactividad: se resuelve en el servidor.
 */
export type FeatureBannerContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string | null;
  imageMode: HeroImageMode;
  overlay: HeroOverlay;
  /** Color o degradado detras del texto, en CSS. */
  background: string;
};

export function FeatureBanner({ content }: { content: FeatureBannerContent }) {
  return (
    <section className="relative isolate overflow-hidden" style={{ background: content.background }}>
      {content.image && content.imageMode === 'background' ? (
        // La foto cubre toda la franja; el fondo elegido queda de respaldo
        // mientras la imagen carga.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.image} alt="" className="h-full w-full object-cover object-center" />
          <div className={`absolute inset-0 ${OVERLAY_CLASS[content.overlay]}`} />
        </div>
      ) : null}

      <div className="container-site relative z-10 flex min-h-[440px] flex-col justify-center py-20">
        {content.eyebrow ? (
          <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-brand">
            {content.eyebrow}
          </p>
        ) : null}
        {content.title ? (
          <h2 className="mt-3 font-display text-6xl font-bold uppercase leading-none tracking-tight text-white lg:text-8xl">
            {content.title}
          </h2>
        ) : null}
        {content.subtitle ? (
          <p className="mt-4 max-w-md text-lg text-white/80">{content.subtitle}</p>
        ) : null}
        {content.ctaLabel ? (
          <div className="mt-9">
            <Link href={content.ctaHref} className="btn-primary">
              {content.ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>

      {content.image && content.imageMode === 'side' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[8%] top-1/2 hidden aspect-square h-[68%] -translate-y-1/2 items-center justify-center rounded-full bg-sand/95 p-10 shadow-2xl lg:flex"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.image} alt="" className="h-full w-full object-contain" />
        </div>
      ) : null}
    </section>
  );
}
