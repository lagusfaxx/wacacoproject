import Link from 'next/link';
import {
  type BannerVideo as BannerVideoSource,
  type HeroImageMode,
  type HeroOverlay,
  OVERLAY_CLASS,
  subtitleWeightClass,
} from '@/lib/banner-style';
import { BannerVideo } from './banner-video';

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
  /** La bajada va en negrita y sin transparencia, para que se lea sobre la foto. */
  subtitleBold?: boolean;
  ctaLabel: string;
  ctaHref: string;
  image: string | null;
  video: BannerVideoSource | null;
  imageMode: HeroImageMode;
  overlay: HeroOverlay;
  /** Color o degradado detras del texto, en CSS. */
  background: string;
};

export function FeatureBanner({ content }: { content: FeatureBannerContent }) {
  return (
    <section className="relative isolate overflow-hidden" style={{ background: content.background }}>
      {content.video || (content.image && content.imageMode === 'background') ? (
        // El video manda sobre la foto; la foto cubre toda la franja y el
        // fondo elegido queda de respaldo mientras el medio carga.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {content.video ? (
            <BannerVideo video={content.video} poster={content.image} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content.image!} alt="" className="h-full w-full object-cover object-center" />
          )}
          <div className={`absolute inset-0 ${OVERLAY_CLASS[content.overlay]}`} />
        </div>
      ) : null}

      <div className="container-site relative z-10 flex min-h-[360px] flex-col justify-center py-14 sm:min-h-[440px] sm:py-20">
        {content.eyebrow ? (
          <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand sm:text-sm">
            {content.eyebrow}
          </p>
        ) : null}
        {content.title ? (
          <h2 className="mt-3 font-display text-4xl font-bold uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-8xl">
            {content.title}
          </h2>
        ) : null}
        {content.subtitle ? (
          <p
            className={`mt-4 max-w-md text-base sm:text-lg ${subtitleWeightClass(
              content.subtitleBold ?? false,
            )}`}
          >
            {content.subtitle}
          </p>
        ) : null}
        {content.ctaLabel ? (
          <div className="mt-7 sm:mt-9">
            <Link href={content.ctaHref} className="btn-primary">
              {content.ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>

      {content.image && content.imageMode === 'side' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -right-14 flex aspect-square h-[44%] items-center justify-center rounded-full bg-sand/95 p-6 shadow-2xl lg:bottom-auto lg:right-[8%] lg:top-1/2 lg:h-[68%] lg:-translate-y-1/2 lg:p-10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.image} alt="" className="h-full w-full object-contain" />
        </div>
      ) : null}
    </section>
  );
}
