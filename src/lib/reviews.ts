import 'server-only';

import { prisma } from './db';

/**
 * Opiniones de los clientes sobre los productos.
 *
 * Son las que ponen las estrellas amarillas en el resultado de Google, y por
 * eso lo unico que se publica aqui son opiniones reales que la tienda recogio
 * de sus propios compradores. Copiar aqui la nota de la ficha de Google del
 * negocio seria declarar como opinion de un producto algo que no lo es, y eso
 * Google lo castiga quitando los resultados enriquecidos de todo el sitio.
 */

export type ReviewSummary = {
  average: number;
  count: number;
  /** Cuantas opiniones hay de cada nota, de 5 a 1. */
  breakdown: { rating: number; count: number }[];
};

export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  createdAt: Date;
};

export function toStars(rating: number): number {
  return Math.max(1, Math.min(5, Math.round(rating)));
}

/** Nota media y reparto de un producto, contando solo lo aprobado. */
export async function getReviewSummary(productId: string): Promise<ReviewSummary | null> {
  const grupos = await prisma.productReview.groupBy({
    by: ['rating'],
    where: { productId, approved: true },
    _count: { _all: true },
  });

  const count = grupos.reduce((total, row) => total + row._count._all, 0);
  if (count === 0) return null;

  const suma = grupos.reduce((total, row) => total + row.rating * row._count._all, 0);

  return {
    average: suma / count,
    count,
    breakdown: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: grupos.find((row) => row.rating === rating)?._count._all ?? 0,
    })),
  };
}

/** Las opiniones publicadas de un producto, de la mas nueva a la mas vieja. */
export async function getProductReviews(productId: string, limit = 20): Promise<PublicReview[]> {
  const reviews = await prisma.productReview.findMany({
    where: { productId, approved: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      authorName: true,
      rating: true,
      title: true,
      body: true,
      orderId: true,
      createdAt: true,
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    // Compra verificada es la que salio de un pedido de esta misma tienda.
    verified: Boolean(review.orderId),
    createdAt: review.createdAt,
  }));
}

/** Notas medias de varios productos a la vez, para las tarjetas del catalogo. */
export async function getRatingsByProduct(
  productIds: string[],
): Promise<Map<string, { average: number; count: number }>> {
  if (productIds.length === 0) return new Map();

  const grupos = await prisma.productReview.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, approved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return new Map(
    grupos
      .filter((row) => row._avg.rating !== null)
      .map((row) => [row.productId, { average: row._avg.rating!, count: row._count._all }]),
  );
}

/**
 * Productos de un pedido entregado que esta persona todavia no ha calificado.
 *
 * Solo se puede opinar de lo que se compro y se recibio: es lo que hace que la
 * opinion valga algo y lo que Google espera de una tienda.
 */
export async function getReviewableItems(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      items: {
        where: { productId: { not: null } },
        select: { productId: true, name: true, image: true },
      },
      reviews: { select: { productId: true } },
    },
  });

  if (!order || order.status !== 'DELIVERED') return [];

  const yaCalificados = new Set(order.reviews.map((review) => review.productId));
  const vistos = new Set<string>();

  return order.items.filter((item) => {
    const id = item.productId!;
    if (yaCalificados.has(id) || vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
}
