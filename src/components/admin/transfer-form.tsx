'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveTransferSettings } from '@/app/actions/admin';
import type { TransferSettings } from '@/lib/bank-transfer';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/** Cuentas corrientes, vista y de ahorro son las tres que se usan en Chile. */
const TIPOS = ['Cuenta corriente', 'Cuenta vista', 'Cuenta de ahorro', 'Cuenta RUT'];

/**
 * Datos de la cuenta para pagar por transferencia.
 *
 * Se editan aqui y no en el codigo porque cambian: una cuenta nueva, otro
 * banco, otro correo para los comprobantes.
 */
export function TransferForm({ values }: { values: TransferSettings }) {
  const [state, formAction] = useActionState(saveTransferSettings, initialState);
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
          <span className="font-semibold">Aceptar pago por transferencia</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Aparece como segunda forma de pago en el checkout. Solo se muestra si el banco, el
            numero de cuenta y el titular estan cargados.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Banco" name="bank" defaultValue={values.bank} placeholder="Banco de Chile" />
        <label className="block">
          <span className="label">Tipo de cuenta</span>
          <select name="accountType" defaultValue={values.accountType} className="field">
            <option value="">Sin especificar</option>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Campo
        label="Numero de cuenta"
        name="accountNumber"
        defaultValue={values.accountNumber}
        placeholder="00012345678"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Titular de la cuenta"
          name="holder"
          defaultValue={values.holder}
          placeholder="Comercializadora Nomad Brew SpA"
        />
        <Campo label="RUT" name="taxId" defaultValue={values.taxId} placeholder="77.123.456-7" />
      </div>

      <Campo
        label="Correo para el comprobante"
        name="email"
        type="email"
        defaultValue={values.email}
        placeholder="pagos@tutienda.cl"
        hint="Donde el comprador manda la captura de la transferencia."
      />

      <label className="block">
        <span className="label">Reserva el pedido por</span>
        <span className="mt-1 flex items-center gap-3">
          <input
            name="holdHours"
            type="number"
            min={1}
            max={240}
            step={1}
            defaultValue={values.holdHours}
            className="field w-28"
          />
          <span className="text-sm text-ink-soft">horas</span>
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          Al elegir transferencia el pedido descuenta stock, igual que una compra pagada. Si no
          llega la transferencia dentro de este plazo, el pedido se cancela solo y las unidades
          vuelven a la tienda. Cuarenta y ocho horas es lo habitual.
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
          placeholder="Reservamos tu pedido por 48 horas. Escribe el numero de pedido en el mensaje de la transferencia."
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Se muestra bajo los datos de la cuenta, en el checkout y en el seguimiento del pedido.
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
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={120}
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
      {pending ? 'Guardando...' : 'Guardar datos'}
    </button>
  );
}
