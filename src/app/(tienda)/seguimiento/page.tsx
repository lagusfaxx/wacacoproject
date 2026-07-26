import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seguir mi pedido',
  description: 'Consulta el estado y el seguimiento de tu pedido con tu numero de orden.',
};

type PageProps = { searchParams: Promise<{ error?: string }> };

async function findOrder(formData: FormData) {
  'use server';

  const number = String(formData.get('number') ?? '')
    .trim()
    .toUpperCase();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  // El par numero + correo es adivinable por fuerza bruta, asi que se limita
  // la cantidad de consultas por IP.
  const ip = await getClientIp();
  const limit = await rateLimit(`tracking:${ip}`, 15, 60 * 10);
  if (!limit.ok) redirect('/seguimiento?error=rate');

  if (!number || !email) redirect('/seguimiento?error=1');

  const order = await prisma.order.findFirst({
    where: { number, email },
    select: { trackingToken: true },
  });

  if (!order) redirect('/seguimiento?error=1');
  redirect(`/seguimiento/${order.trackingToken}`);
}

export default async function TrackingPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <div className="container-site max-w-xl py-16">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
        Seguir mi pedido
      </h1>
      <p className="mt-4 text-sm text-ink-muted">
        Ingresa el numero de pedido que recibiste al comprar y el correo que usaste.
      </p>

      {error ? (
        <p role="alert" className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error === 'rate'
            ? 'Demasiadas consultas. Intenta nuevamente en unos minutos.'
            : 'No encontramos un pedido con esos datos. Revisa el numero y el correo.'}
        </p>
      ) : null}

      <form action={findOrder} className="mt-8 space-y-5">
        <div>
          <label className="label" htmlFor="number">
            Numero de pedido
          </label>
          <input
            id="number"
            name="number"
            required
            maxLength={20}
            placeholder="WC-1A2B3C4D"
            className="field uppercase"
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Correo electronico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={180}
            placeholder="tu@correo.com"
            className="field"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Buscar pedido
        </button>
      </form>
    </div>
  );
}
