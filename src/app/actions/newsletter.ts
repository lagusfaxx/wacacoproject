'use server';

import { prisma } from '@/lib/db';
import { getClientIp } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { emailSchema } from '@/lib/validation';

export type NewsletterState = { status: 'idle' | 'ok' | 'error'; message: string };

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return { status: 'error', message: 'Ingresa un correo electronico valido.' };
  }

  const ip = await getClientIp();
  const limit = await rateLimit(`newsletter:${ip}`, 5, 60 * 10);
  if (!limit.ok) {
    return { status: 'error', message: 'Demasiados intentos. Intenta nuevamente en unos minutos.' };
  }

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data },
      create: { email: parsed.data },
      update: {},
    });
    return { status: 'ok', message: 'Listo, ya estas suscrito.' };
  } catch {
    return { status: 'error', message: 'No pudimos registrar tu correo. Intenta mas tarde.' };
  }
}
