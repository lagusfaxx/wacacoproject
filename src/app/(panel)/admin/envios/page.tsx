import type { Metadata } from 'next';
import {
  ShippingRatesForm,
  type RegionRate,
} from '@/components/admin/shipping-rates-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';
import { CHILE_REGIONS } from '@/lib/regions-cl';
import { isBluexpressEnabled } from '@/lib/shipping';
import { shippingCarrierName } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Envios' };

export default async function AdminShippingPage() {
  await requireAdmin();

  const [rates, carrier] = await Promise.all([
    prisma.shippingRate.findMany(),
    shippingCarrierName(),
  ]);

  const byRegion = new Map(rates.map((rate) => [rate.regionCode, rate]));
  const bluexReady = isBluexpressEnabled();

  const regions: RegionRate[] = CHILE_REGIONS.map((region) => {
    const rate = byRegion.get(region.code);
    return {
      code: region.code,
      name: region.name,
      price: rate ? String(Number(rate.price)) : '',
      etaDays: rate?.etaDays !== null && rate?.etaDays !== undefined ? String(rate.etaDays) : '',
      active: rate ? rate.active : true,
      usesDefault: !rate,
    };
  });

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Envios
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-muted">
        Define cuanto cobras por despachar a cada region. No necesitas contrato
        con ningun courier para vender.
      </p>

      <section className="mt-6 border-l-4 border-sand-dark bg-white p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-ink">
          Como se decide el costo
        </h2>
        <ol className="mt-3 space-y-1.5 text-sm text-ink-soft">
          <Step n={1} done={env.freeShippingThreshold > 0}>
            Si la compra supera{' '}
            {env.freeShippingThreshold > 0
              ? formatMoney(env.freeShippingThreshold)
              : 'el umbral configurado'}
            , el envio es gratis.
          </Step>
          <Step n={2} done={bluexReady}>
            {bluexReady
              ? 'Blue Express cotiza segun comuna, peso y medidas.'
              : 'Blue Express no esta configurado, asi que este paso se omite.'}
          </Step>
          <Step n={3} done={regions.some((region) => !region.usesDefault)}>
            Se aplica la tarifa que definas aqui para la region de destino.
          </Step>
          <Step n={4} done>
            Si la region no tiene tarifa propia, se cobra la tarifa general de{' '}
            {formatMoney(env.shippingFlatRate)}.
          </Step>
        </ol>
        <p className="mt-4 text-xs text-ink-muted">
          La tarifa general y el umbral de envio gratis se configuran con las
          variables SHIPPING_FLAT_RATE y FREE_SHIPPING_THRESHOLD.
        </p>
      </section>

      <div className="mt-6">
        <ShippingRatesForm
          regions={regions}
          carrier={carrier}
          currency={env.currency}
          flatRateLabel={formatMoney(env.shippingFlatRate)}
        />
      </div>
    </>
  );
}

function Step({
  n,
  done,
  children,
}: {
  n: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold ${
          done ? 'bg-brand text-white' : 'bg-sand-dark text-ink-muted'
        }`}
      >
        {n}
      </span>
      <span className={done ? '' : 'text-ink-muted'}>{children}</span>
    </li>
  );
}
