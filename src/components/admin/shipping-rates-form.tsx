'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveShippingRates } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export type RegionRate = {
  code: string;
  name: string;
  price: string;
  etaDays: string;
  active: boolean;
  /** true cuando la region no tiene tarifa propia y usa la general. */
  usesDefault: boolean;
};

export function ShippingRatesForm({
  regions,
  carrier,
  currency,
  flatRateLabel,
}: {
  regions: RegionRate[];
  carrier: string;
  currency: string;
  flatRateLabel: string;
}) {
  const [state, formAction] = useActionState(saveShippingRates, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <p
          role="status"
          className={`border px-4 py-3 text-sm ${
            state.status === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <section className="border border-sand-dark bg-white">
        <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
          Transportista
        </h2>
        <div className="p-6">
          <label className="label" htmlFor="carrier">
            Nombre que ve el cliente
          </label>
          <input
            id="carrier"
            name="carrier"
            defaultValue={carrier}
            maxLength={80}
            className="field max-w-sm"
            placeholder="Chilexpress, Starken, Despacho propio..."
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Aparece en el checkout y en el detalle del pedido cuando el envio no
            lo cotiza un courier integrado.
          </p>
        </div>
      </section>

      <section className="border border-sand-dark bg-white">
        <div className="border-b border-sand-dark px-6 py-4">
          <h2 className="font-display text-base font-bold uppercase tracking-tight">
            Tarifas por region
          </h2>
          <p className="mt-1.5 text-xs text-ink-muted">
            Deja el precio vacio para que esa region use la tarifa general de{' '}
            <strong>{flatRateLabel}</strong>. Desmarca &quot;Despacha&quot; para
            impedir compras hacia esa region.
          </p>
        </div>

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Region</th>
                <th className="w-44">Precio ({currency})</th>
                <th className="w-40">Dias habiles</th>
                <th className="w-28">Despacha</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr key={region.code}>
                  <td>
                    <span className="font-semibold">{region.name}</span>
                    {region.usesDefault ? (
                      <span className="ml-2 badge bg-sand text-ink-muted">General</span>
                    ) : null}
                    {!region.active ? (
                      <span className="ml-2 badge bg-red-100 text-red-700">Sin despacho</span>
                    ) : null}
                  </td>
                  <td>
                    <input
                      type="number"
                      name={`price_${region.code}`}
                      defaultValue={region.price}
                      min="0"
                      step="1"
                      placeholder="General"
                      aria-label={`Precio de envio a ${region.name}`}
                      className={`w-full border px-2 py-1.5 text-sm tabular-nums focus:outline-none ${
                        state.errors[`price_${region.code}`]
                          ? 'border-red-500'
                          : 'border-sand-dark focus:border-ink'
                      }`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      name={`days_${region.code}`}
                      defaultValue={region.etaDays}
                      min="0"
                      max="60"
                      placeholder="—"
                      aria-label={`Plazo de entrega a ${region.name}`}
                      className={`w-full border px-2 py-1.5 text-sm tabular-nums focus:outline-none ${
                        state.errors[`days_${region.code}`]
                          ? 'border-red-500'
                          : 'border-sand-dark focus:border-ink'
                      }`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      name={`active_${region.code}`}
                      defaultChecked={region.active}
                      aria-label={`Despachar a ${region.name}`}
                      className="h-4 w-4 accent-[#E1580E]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sticky bottom-0 border-t border-sand-dark bg-white px-6 py-4">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Guardando...' : 'Guardar tarifas'}
    </button>
  );
}
