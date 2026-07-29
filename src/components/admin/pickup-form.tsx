'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, savePickupSettings } from '@/app/actions/admin';
import type { PickupSettings } from '@/lib/pickup';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/**
 * El punto donde el comprador pasa a buscar su pedido.
 *
 * Se edita aqui y no en el codigo porque es lo que mas cambia de una tienda:
 * el local se muda, el horario cambia en verano, un feriado altera todo.
 */
export function PickupForm({ values }: { values: PickupSettings }) {
  const [state, formAction] = useActionState(savePickupSettings, initialState);
  const [enabled, setEnabled] = useState(values.enabled);

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

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#E1580E]"
        />
        <span>
          <span className="font-semibold">Ofrecer retiro en tienda</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Aparece en el checkout junto al despacho a domicilio, sin cobrar envio. Solo se
            muestra si la direccion y la comuna estan cargadas.
          </span>
        </span>
      </label>

      <Campo
        label="Nombre del lugar"
        name="place"
        defaultValue={values.place}
        placeholder="Tienda Nomad Brew"
        hint="Como se llama el local u oficina. Opcional."
      />

      <Campo
        label="Direccion"
        name="address"
        defaultValue={values.address}
        placeholder="Av. Providencia 1234, oficina 501"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Comuna" name="commune" defaultValue={values.commune} placeholder="Providencia" />
        <Campo
          label="Region"
          name="region"
          defaultValue={values.region}
          placeholder="Region Metropolitana"
        />
      </div>

      <Campo
        label="Horario de atencion"
        name="hours"
        defaultValue={values.hours}
        placeholder="Lunes a viernes de 10:00 a 18:00"
        hint="Se muestra en el checkout y va en el correo de retiro."
      />

      <label className="block">
        <span className="label">Preparacion</span>
        <span className="mt-1 flex items-center gap-3">
          <input
            name="prepDays"
            type="number"
            min={0}
            max={30}
            step={1}
            defaultValue={values.prepDays}
            className="field w-28"
          />
          <span className="text-sm text-ink-soft">dias habiles</span>
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          Cuanto tardas en dejar un pedido listo para retirar. Con esto la ficha del producto
          muestra la fecha estimada; se cuentan dias habiles, asi que un pedido del viernes con un
          dia de preparacion queda para el lunes. Cero = el mismo dia.
        </span>
      </label>

      <label className="block">
        <span className="label">Instrucciones (opcional)</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={values.notes}
          maxLength={500}
          className="field"
          placeholder="Toca el timbre 501. Trae tu cedula y el numero de pedido. Guardamos el pedido 7 dias."
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Se muestra bajo la direccion en el checkout, en el seguimiento y en el correo que avisa
          que el pedido esta listo.
        </span>
      </label>

      <Guardar />
    </form>
  );
}

function Campo({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={160}
        className="field"
      />
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-sm py-3">
      {pending ? 'Guardando...' : 'Guardar retiro'}
    </button>
  );
}
