'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, savePolicySettings } from '@/app/actions/admin';
import type { StorePolicies } from '@/lib/store-policies';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/**
 * Los plazos que Google necesita para mostrar el precio en sus resultados.
 *
 * Se avisa de que son promesas publicas, porque lo son: quedan escritas en la
 * ficha que Google lee y en lo que el comprador ve antes de entrar.
 */
export function PoliciesForm({ values }: { values: StorePolicies }) {
  const [state, formAction] = useActionState(savePolicySettings, initialState);
  const [returnsFree, setReturnsFree] = useState(values.returnsFree);

  return (
    <form action={formAction} className="space-y-5">
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

      <p className="border border-sand-dark bg-sand px-4 py-3 text-xs leading-relaxed text-ink-soft">
        Google no muestra el precio de un producto en sus resultados solo porque este en la pagina:
        pide ademas saber cuanto cuesta el envio, cuanto demora y que pasa si el cliente devuelve.
        Revisa que esto coincida con lo que de verdad ofreces, porque queda declarado en publico.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Numero
          label="Preparacion del despacho"
          name="handlingDays"
          defaultValue={values.handlingDays}
          max={30}
          unidad="dias habiles"
          hint="Del pago a la entrega al courier."
        />
        <div />
        <Numero
          label="Entrega, minimo"
          name="deliveryMin"
          defaultValue={values.deliveryMin}
          max={90}
          unidad="dias habiles"
        />
        <Numero
          label="Entrega, maximo"
          name="deliveryMax"
          defaultValue={values.deliveryMax}
          max={90}
          unidad="dias habiles"
        />
      </div>

      <Numero
        label="Plazo para devolver"
        name="returnDays"
        defaultValue={values.returnDays}
        max={365}
        unidad="dias"
        hint="Cero significa que no aceptas devoluciones, y asi se declara. La ley chilena da diez dias de retracto en las ventas a distancia."
      />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="returnsFree"
          checked={returnsFree}
          onChange={(event) => setReturnsFree(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#E1580E]"
        />
        <span>
          <span className="font-semibold">La tienda paga el envio de la devolucion</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Sin marcar, se declara que el costo de devolver lo asume el comprador.
          </span>
        </span>
      </label>

      <Guardar />
    </form>
  );
}

function Numero({
  label,
  name,
  defaultValue,
  max,
  unidad,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  max: number;
  unidad: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="mt-1 flex items-center gap-3">
        <input
          name={name}
          type="number"
          min={0}
          max={max}
          step={1}
          defaultValue={defaultValue}
          className="field w-24"
        />
        <span className="text-sm text-ink-soft">{unidad}</span>
      </span>
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-sm py-3">
      {pending ? 'Guardando...' : 'Guardar plazos'}
    </button>
  );
}
