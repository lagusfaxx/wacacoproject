import type { BannerVideo } from '@/lib/banner-style';

/**
 * Video de fondo de un banner, sin controles y sin sonido.
 *
 * Va detras del texto y no debe capturar clics: el banner completo se
 * comporta como una imagen. El autoplay solo lo permiten los navegadores si
 * el video esta silenciado, de ahi `muted`.
 */
export function BannerVideo({ video, poster }: { video: BannerVideo; poster?: string | null }) {
  if (video.kind === 'embed') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* El iframe llega en 16:9: se agranda hasta cubrir el banner y se
            centra, para que no queden franjas negras a los costados. */}
        <iframe
          src={video.src}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
        />
      </div>
    );
  }

  return (
    <video
      aria-hidden="true"
      tabIndex={-1}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster ?? undefined}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
    >
      <source src={video.src} />
    </video>
  );
}
