import { Stars } from './stars';
import type { PublicReview, ReviewSummary } from '@/lib/reviews';

/**
 * Opiniones bajo la ficha del producto.
 *
 * Si no hay ninguna no se dibuja nada: una seccion vacia que dice "todavia no
 * hay opiniones" resta mas de lo que suma.
 */
export function ProductReviews({
  summary,
  reviews,
}: {
  summary: ReviewSummary | null;
  reviews: PublicReview[];
}) {
  if (!summary || reviews.length === 0) return null;

  const fecha = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });

  return (
    <section id="opiniones" className="border-t border-sand-dark bg-sand">
      <div className="container-site py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="section-title">Opiniones</h2>
          <div className="flex items-center gap-3">
            <Stars rating={summary.average} />
            <span className="font-display text-lg font-semibold">
              {summary.average.toFixed(1)}
            </span>
            <span className="text-sm text-ink-muted">
              {summary.count} {summary.count === 1 ? 'opinion' : 'opiniones'}
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_1fr]">
          {/* Reparto de notas: dice de un vistazo si el promedio es parejo o
              si hay opiniones muy repartidas. */}
          <ul className="space-y-2">
            {summary.breakdown.map((row) => (
              <li key={row.rating} className="flex items-center gap-3 text-sm">
                <span className="w-10 shrink-0 tabular-nums text-ink-muted">{row.rating} ★</span>
                <span className="h-1.5 flex-1 bg-white">
                  <span
                    className="block h-1.5 bg-brand"
                    style={{ width: `${(row.count / summary.count) * 100}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right tabular-nums text-ink-muted">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>

          <ul className="space-y-6">
            {reviews.map((review) => (
              <li key={review.id} className="border-b border-sand-dark pb-6 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars rating={review.rating} size="sm" />
                  <span className="font-display text-sm font-bold uppercase tracking-wide">
                    {review.authorName}
                  </span>
                  {review.verified ? (
                    <span className="badge bg-emerald-100 text-emerald-800">Compra verificada</span>
                  ) : null}
                  <span className="text-xs text-ink-muted">{fecha.format(review.createdAt)}</span>
                </div>
                {review.title ? (
                  <p className="mt-3 font-display text-base font-bold uppercase tracking-tight">
                    {review.title}
                  </p>
                ) : null}
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{review.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
