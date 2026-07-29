'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, syncPaymentFromMercadoPago } from '@/app/actions/admin';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

/**
 * "Consultar el pago en Mercado Pago".
 *
 * Para los pedidos que quedaron esperando porque la notificacion no llego.
 * Pregunta por el pago con el numero de pedido y aplica lo que Mercado Pago
 * responda, sea aprobado o rechazado.
 */
export function PaymentSyncForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(syncPaymentFromMercadoPago, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />

      {state.message ? (
        <p
          role="status"
          className={`border px-4 py-3 text-sm ${
            state.status === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <Boton />

      <p className="text-xs text-ink-muted">
        Le pregunta a Mercado Pago por el pago de este pedido y aplica lo que responda. Sirve
        cuando el cliente pago pero el pedido sigue como pendiente.
      </p>
    </form>
  );
}

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-outline btn-sm w-full py-3">
      {pending ? 'Consultando...' : 'Consultar el pago en Mercado Pago'}
    </button>
  );
}
