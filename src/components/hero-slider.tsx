'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';

export type HeroSlide = {
  eyebrow: string;
  title: string;
  highlight?: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string | null;
  /** Degradado de fondo, ya que no usamos fotografia de stock. */
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

  return (
    <section
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrusel"
      aria-label="Destacados"
    >
      <div
        className="relative flex min-h-[520px] items-center transition-[background] duration-700 lg:min-h-[640px]"
        style={{ background: slide.gradient }}
      >
        {slide.image ? (
          // La ilustracion es de trazo oscuro, asi que necesita un disco claro
          // detras para leerse sobre el degradado del hero.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[6%] top-1/2 hidden aspect-square h-[72%] -translate-y-1/2 items-center justify-center rounded-full bg-sand/95 p-10 shadow-2xl md:flex"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.image} alt="" className="h-full w-full object-contain" />
          </div>
        ) : null}

        <div className="container-site relative z-10 py-20">
          <div key={index} className="max-w-2xl animate-slideUp">
            <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-brand">
              {slide.eyebrow}
            </p>
            <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-8xl">
              {slide.highlight ? <span className="block text-brand">{slide.highlight}</span> : null}
              {slide.title ? <span className="block">{slide.title}</span> : null}
            </h1>
            {slide.subtitle ? (
              <p className="mt-6 max-w-md text-base text-white/80">{slide.subtitle}</p>
            ) : null}
            <Link href={slide.ctaHref} className="btn-primary mt-9">
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
