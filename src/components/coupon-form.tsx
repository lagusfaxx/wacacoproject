'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { applyCoupon, type CartActionState } from '@/app/actions/cart';

const initialState: CartActionState = { status: 'idle', message: '' };

export function CouponForm({ currentCode }: { currentCode: string | null }) {
  const [state, formAction] = useActionState(applyCoupon, initialState);

  return (
    <form action={formAction} className="border-t border-sand-dark pt-5">
      <label htmlFor="couponCode" className="label">
        Codigo de descuento
      </label>
      <div className="flex gap-2">
        <input
          id="couponCode"
          name="couponCode"
          defaultValue={currentCode ?? ''}
          placeholder="Ej: BIENVENIDO10"
          maxLength={40}
          className="field flex-1 uppercase"
        />
        <SubmitButton />
      </div>
      {state.message ? (
        <p
          role="status"
          className={`mt-2 text-xs ${state.status === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-ghost shrink-0">
      {pending ? '...' : 'Aplicar'}
    </button>
  );
}
