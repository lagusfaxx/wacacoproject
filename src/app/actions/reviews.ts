'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export type ReviewState = { status: 'idle' | 'ok' | 'error'; message: string };

const initial: ReviewState = { status: 'idle', message: '' };

/**
 * Guarda la opinion de un cliente sobre algo que compro.
 *
 * Solo se acepta si el pedido es suyo, esta entregado y contiene ese producto:
 * son las tres condiciones que hacen que la opinion valga algo. Queda sin
 * publicar hasta que la tienda la apruebe.
 */
export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Inicia sesion para opinar.' };

  const orderId = String(formData.get('orderId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const rating = Number(formData.get('rating'));
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: 'error', message: 'Elige una nota de 1 a 5 estrellas.' };
  }
  if (body.length < 10) {
    return { status: 'error', message: 'Cuentanos un poco mas, al menos una frase.' };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id, status: 'DELIVERED' },
    select: { id: true, items: { select: { productId: true } } },
  });

  if (!order || !order.items.some((item) => item.productId === productId)) {
    return {
      status: 'error',
      message: 'Solo puedes opinar de un producto que compraste y ya recibiste.',
    };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) return { status: 'error', message: 'Ese producto ya no esta disponible.' };

  try {
    await prisma.productReview.create({
      data: {
        productId,
        orderId: order.id,
        userId: user.id,
        // Solo el nombre de pila: la ficha no es sitio para el apellido de
        // nadie, y con el nombre basta para que la opinion tenga cara.
        authorName: user.name.split(' ')[0]!.slice(0, 40) || 'Cliente',
        rating,
        title: title || null,
        body,
        source: 'cliente',
      },
    });
  } catch {
    return { status: 'error', message: 'Ya dejaste tu opinion de este producto en este pedido.' };
  }

  revalidatePath(`/products/${product.slug}`);
  revalidatePath('/admin/opiniones');

  return {
    status: 'ok',
    message: 'Gracias. Tu opinion se publicara en cuanto la revisemos.',
  };
}

export { initial as initialReviewState };
