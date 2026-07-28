'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BannerVideo as BannerVideoSource,
  type HeroImageMode,
  type HeroOverlay,
  isSplitMode,
  OVERLAY_CLASS,
  subtitleWeightClass,
} from '@/lib/banner-style';
import { BannerVideo } from './banner-video';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';

export type HeroSlide = {
  eyebrow: string;
  title: string;
  highlight?: string;
  subtitle: string;
  /** La bajada va en negrita y sin transparencia, para que se lea sobre la foto. */
  subtitleBold?: boolean;
  ctaLabel: string;
  ctaHref: string;
  image: string | null;
  video?: BannerVideoSource | null;
  imageMode?: HeroImageMode;
  overlay?: HeroOverlay;
  /** Color o degradado detras de la imagen. */
  gradient: string;
};

const AUTOPLAY_MS = 7000;

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[index]!;
  const mode: HeroImageMode = slide.imageMode ?? 'background';

  return (
    <section
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrusel"
      aria-label="Destacados"
    >
      <div
        className="relative flex min-h-[420px] items-center transition-[background] duration-700 sm:min-h-[520px] lg:min-h-[640px]"
        style={{ background: slide.gradient }}
      >
        {!isSplitMode(mode) && (slide.video || (slide.image && mode === 'background')) ? (
          // El video manda sobre la foto. La foto cubre toda la diapositiva y
          // el degradado elegido queda solo como color de respaldo mientras el
          // medio carga.
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {slide.video ? (
              <BannerVideo key={slide.video.src} video={slide.video} poster={slide.image} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slide.image}
                src={slide.image!}
                alt=""
                className="h-full w-full animate-fadeIn object-cover object-center"
              />
            )}
            <div className={`absolute inset-0 ${OVERLAY_CLASS[slide.overlay ?? 'medium']}`} />
          </div>
        ) : null}

        {(slide.image || slide.video) && isSplitMode(mode) ? (
          // Mitad y mitad: la foto ocupa media diapositiva a sangre y el texto
          // se corre a la otra mitad. En telefono no se parte, la foto queda de
          // fondo con su velo, que es lo unico legible a ese ancho.
          <div
            aria-hidden="true"
            className={`absolute inset-0 md:inset-y-0 md:w-1/2 ${
              mode === 'splitLeft' ? 'md:left-0' : 'md:right-0'
            }`}
          >
            {slide.video ? (
              <BannerVideo key={slide.video.src} video={slide.video} poster={slide.image} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slide.image}
                src={slide.image!}
                alt=""
                className="h-full w-full animate-fadeIn object-cover object-center"
              />
            )}
            <div className={`absolute inset-0 md:hidden ${OVERLAY_CLASS[slide.overlay ?? 'medium']}`} />
          </div>
        ) : null}

        {slide.image && mode === 'side' ? (
          // Producto recortado sobre fondo transparente: se apoya sobre un
          // disco claro para que un trazo oscuro no se pierda. En telefono va
          // recortado en la esquina inferior derecha, detras del texto:
          // escondido del todo dejaba la diapositiva medio vacia.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 -right-14 flex aspect-square h-[46%] items-center justify-center rounded-full bg-sand/95 p-6 shadow-2xl md:bottom-auto md:right-[6%] md:top-1/2 md:h-[72%] md:-translate-y-1/2 md:p-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.image} alt="" className="h-full w-full object-contain" />
          </div>
        ) : null}

        <div className="container-site relative z-10 py-14 sm:py-20">
          <div
            key={index}
            className={`max-w-2xl animate-slideUp ${
              isSplitMode(mode)
                ? mode === 'splitLeft'
                  ? 'md:ml-auto md:w-[46%] md:pl-6'
                  : 'md:w-[46%] md:pr-6'
                : ''
            }`}
          >
            <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand sm:text-sm">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-[0.92] tracking-tight text-white sm:mt-4 sm:text-6xl lg:text-8xl">
              {slide.highlight ? <span className="block text-brand">{slide.highlight}</span> : null}
              {slide.title ? <span className="block">{slide.title}</span> : null}
            </h1>
            {slide.subtitle ? (
              <p
                className={`mt-4 max-w-md text-sm sm:mt-6 sm:text-base ${subtitleWeightClass(
                  slide.subtitleBold ?? false,
                )}`}
              >
                {slide.subtitle}
              </p>
            ) : null}
            <Link href={slide.ctaHref} className="btn-primary mt-7 sm:mt-9">
              {slide.ctaLabel}
            </Link>
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="absolute bottom-8 right-6 z-10 flex items-center gap-5 lg:right-12">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="text-white/80 transition-colors hover:text-white"
              aria-label="Anterior"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className="text-white/80 transition-colors hover:text-white"
              aria-label="Siguiente"
            >
              <ArrowRightIcon className="h-6 w-6" />
            </button>
            <span className="font-display text-sm tabular-nums text-white/80">
              {index + 1}/{slides.length}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
