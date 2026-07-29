import type { Metadata } from 'next';
import Link from 'next/link';
import { ManualReviewForm } from '@/components/admin/manual-review-form';
import { Stars } from '@/components/stars';
import { deleteReview, setReviewApproval } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Opiniones' };

export default async function AdminReviewsPage() {
  await requireAdmin();

  const [reviews, products] = await Promise.all([
    prisma.productReview.findMany({
      orderBy: [{ approved: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        product: { select: { name: true, slug: true } },
        order: { select: { number: true } },
      },
    }),
    prisma.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const pendientes = reviews.filter((review) => !review.approved);
  const publicadas = reviews.filter((review) => review.approved);
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' });

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          Opiniones
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          Las opiniones de tus clientes sobre cada producto. Nada se publica sin que lo apruebes,
          y lo publicado es lo que pone las estrellas en el resultado de Google.
        </p>
      </div>

      <section className="mt-8 border-l-4 border-amber-500 bg-amber-50 p-6">
        <h2 className="font-display text-base font-bold uppercase tracking-tight text-amber-900">
          Que puedes publicar aqui
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-amber-900/80">
          Solo opiniones reales de gente que compro el producto: las que dejan tus clientes desde
          su pedido entregado, y las que te llegan por correo o mensaje y te autorizan a publicar.
          Las resenas de tu ficha de Google son de tu negocio, no del producto: copiarlas aqui es
          declararle a Google algo falso, y el castigo es que quite los resultados enriquecidos de
          toda la tienda.
        </p>
      </section>

      <Grupo
        titulo={`Por revisar (${pendientes.length})`}
        vacio="No hay opiniones esperando revision."
        reviews={pendientes}
        fecha={fecha}
      />

      <Grupo
        titulo={`Publicadas (${publicadas.length})`}
        vacio="Todavia no has publicado ninguna opinion."
        reviews={publicadas}
        fecha={fecha}
      />

      <section className="mt-12 border border-sand-dark bg-white">
        <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
          Cargar una opinion que recibiste
        </h2>
        <div className="p-6">
          <ManualReviewForm products={products} />
        </div>
      </section>
    </>
  );
}

type ReviewRow = Awaited<ReturnType<typeof prisma.productReview.findMany>>[number] & {
  product: { name: string; slug: string };
  order: { number: string } | null;
};

function Grupo({
  titulo,
  vacio,
  reviews,
  fecha,
}: {
  titulo: string;
  vacio: string;
  reviews: ReviewRow[];
  fecha: Intl.DateTimeFormat;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold uppercase leading-none tracking-tight">
        {titulo}
      </h2>

      {reviews.length === 0 ? (
        <p className="mt-4 border border-dashed border-sand-dark bg-white px-6 py-10 text-center text-sm text-ink-muted">
          {vacio}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="border border-sand-dark bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars rating={review.rating} size="sm" />
                    <span className="font-display text-sm font-bold uppercase tracking-wide">
                      {review.authorName}
                    </span>
                    {review.orderId ? (
                      <span className="badge bg-emerald-100 text-emerald-800">
                        Compra verificada{review.order ? ` · ${review.order.number}` : ''}
                      </span>
                    ) : (
                      <span className="badge bg-sand-dark text-ink-soft">Cargada a mano</span>
                    )}
                    <span className="text-xs text-ink-muted">{fecha.format(review.createdAt)}</span>
                  </div>

                  <p className="mt-2 text-xs uppercase tracking-wide text-ink-muted">
                    <Link href={`/products/${review.product.slug}`} className="hover:text-brand">
                      {review.product.name}
                    </Link>
                  </p>

                  {review.title ? (
                    <p className="mt-3 font-display text-base font-bold uppercase tracking-tight">
                      {review.title}
                    </p>
                  ) : null}
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
                    {review.body}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <form action={setReviewApproval}>
                    <input type="hidden" name="reviewId" value={review.id} />
                    <input type="hidden" name="approved" value={String(!review.approved)} />
                    <button
                      type="submit"
                      className={review.approved ? 'btn-ghost btn-sm w-full' : 'btn-primary btn-sm w-full py-3'}
                    >
                      {review.approved ? 'Ocultar' : 'Publicar'}
                    </button>
                  </form>
                  <form action={deleteReview}>
                    <input type="hidden" name="reviewId" value={review.id} />
                    <button
                      type="submit"
                      className="w-full text-xs font-semibold uppercase tracking-widest text-red-600 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
