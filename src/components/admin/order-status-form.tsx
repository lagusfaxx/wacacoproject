'use client';

import type { OrderStatus } from '@prisma/client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState, updateOrderStatus } from '@/app/actions/admin';
import { ALL_ORDER_STATUSES, orderStatusLabel } from '@/lib/order-status';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

export function OrderStatusForm({
  orderId,
  status,
  carrier,
  trackingNumber,
  trackingUrl,
}: {
  orderId: string;
  status: OrderStatus;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}) {
  const [state, formAction] = useActionState(updateOrderStatus, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="orderId" value={orderId} />

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
        <label className="label" htmlFor="order-status">
          Estado del pedido
        </label>
        {/* La `key` fuerza a React a rehacer el desplegable cuando el estado
            cambia desde otro lado (el boton de "listo para retiro", por
            ejemplo). Sin ella el campo se queda mostrando el estado viejo, y
            guardar de nuevo lo haria retroceder. */}
        <select
          key={status}
          id="order-status"
          name="status"
          defaultValue={status}
          className="field"
        >
          {ALL_ORDER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {orderStatusLabel(option)}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-ink-muted">
          Cancelar o reembolsar devuelve automaticamente el stock al inventario.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="order-carrier">
            Transportista
          </label>
          <input
            id="order-carrier"
            name="carrier"
            defaultValue={carrier}
            placeholder="Chilexpress, Starken..."
            className="field"
            maxLength={80}
          />
        </div>
        <div>
          <label className="label" htmlFor="order-tracking">
            Numero de seguimiento
          </label>
          <input
            id="order-tracking"
            name="trackingNumber"
            defaultValue={trackingNumber}
            className="field"
            maxLength={80}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="order-tracking-url">
          Enlace de seguimiento
        </label>
        <input
          id="order-tracking-url"
          name="trackingUrl"
          type="url"
          defaultValue={trackingUrl}
          placeholder="https://..."
          className={`field ${state.errors.trackingUrl ? 'field-error' : ''}`}
          maxLength={400}
        />
        {state.errors.trackingUrl ? (
          <span className="error-text">{state.errors.trackingUrl}</span>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="order-message">
          Nota visible para el cliente (opcional)
        </label>
        <textarea
          id="order-message"
          name="message"
          rows={3}
          maxLength={500}
          className="field"
          placeholder="Tu pedido salio de bodega esta manana."
        />
      </div>

      <div className="border border-sand-dark bg-sand p-4">
        <label className="flex items-start gap-3 text-sm" htmlFor="order-notify">
          <input
            id="order-notify"
            name="notify"
            type="checkbox"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            Avisar al cliente por correo
            <span className="mt-1 block text-xs text-ink-muted">
              Se envia solo si el estado cambia, e incluye la nota de arriba y el numero de
              seguimiento. El pago pendiente y el pago en revision nunca se avisan.
            </span>
          </span>
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Guardando...' : 'Actualizar pedido'}
    </button>
  );
}
