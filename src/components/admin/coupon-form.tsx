'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, saveCoupon } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export function CouponAdminForm({ currency }: { currency: string }) {
  const [state, formAction] = useActionState(saveCoupon, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
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

      <div>
        <label className="label" htmlFor="coupon-code">
          Codigo
        </label>
        <input
          id="coupon-code"
          name="code"
          required
          maxLength={40}
          placeholder="VERANO20"
          className={`field uppercase ${state.errors.code ? 'field-error' : ''}`}
        />
        {state.errors.code ? <span className="error-text">{state.errors.code}</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="coupon-type">
            Tipo
          </label>
          <select id="coupon-type" name="type" className="field" defaultValue="PERCENT">
            <option value="PERCENT">Porcentaje (%)</option>
            <option value="FIXED">Monto fijo ({currency})</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="coupon-value">
            Valor
          </label>
          <input
            id="coupon-value"
            name="value"
            type="number"
            step="0.01"
            min="0.01"
            required
            className={`field ${state.errors.value ? 'field-error' : ''}`}
          />
          {state.errors.value ? <span className="error-text">{state.errors.value}</span> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="coupon-min">
            Subtotal minimo ({currency})
          </label>
          <input
            id="coupon-min"
            name="minSubtotal"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="coupon-max">
            Limite de usos
          </label>
          <input
            id="coupon-max"
            name="maxRedemtions"
            type="number"
            min="0"
            placeholder="Sin limite"
            className="field"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[#E1580E]" />
        Cupon activo
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Guardando...' : 'Guardar cupon'}
    </button>
  );
}
