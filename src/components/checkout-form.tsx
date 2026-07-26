'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { startCheckout, type CheckoutState } from '@/app/actions/checkout';

const initialState: CheckoutState = { status: 'idle', message: '', errors: {} };

export type CheckoutDefaults = {
  email: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export function CheckoutForm({
  defaults,
  totalLabel,
}: {
  defaults: CheckoutDefaults;
  totalLabel: string;
}) {
  const [state, formAction] = useActionState(startCheckout, initialState);
  const errors = state.errors;

  return (
    <form action={formAction} className="space-y-10" noValidate>
      {state.message ? (
        <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-tight">Contacto</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label="Correo electronico"
            name="email"
            type="email"
            defaultValue={defaults.email}
            error={errors.email}
            autoComplete="email"
            required
            hint="Ahi te enviaremos la confirmacion y el seguimiento."
          />
          <Field
            label="Telefono"
            name="phone"
            type="tel"
            defaultValue={defaults.phone}
            error={errors.phone}
            autoComplete="tel"
            required
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-tight">
          Direccion de envio
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Nombre de quien recibe"
              name="fullName"
              defaultValue={defaults.fullName}
              error={errors.fullName}
              autoComplete="name"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Calle y numero"
              name="line1"
              defaultValue={defaults.line1}
              error={errors.line1}
              autoComplete="address-line1"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Departamento, oficina (opcional)"
              name="line2"
              defaultValue={defaults.line2}
              error={errors.line2}
              autoComplete="address-line2"
            />
          </div>
          <Field
            label="Comuna o ciudad"
            name="city"
            defaultValue={defaults.city}
            error={errors.city}
            autoComplete="address-level2"
            required
          />
          <Field
            label="Region"
            name="region"
            defaultValue={defaults.region}
            error={errors.region}
            autoComplete="address-level1"
            required
          />
          <Field
            label="Codigo postal (opcional)"
            name="postalCode"
            defaultValue={defaults.postalCode}
            error={errors.postalCode}
            autoComplete="postal-code"
          />
          <div>
            <label className="label" htmlFor="country">
              Pais
            </label>
            <select
              id="country"
              name="country"
              defaultValue={defaults.country || 'CL'}
              className="field"
            >
              <option value="CL">Chile</option>
              <option value="AR">Argentina</option>
              <option value="MX">Mexico</option>
              <option value="CO">Colombia</option>
              <option value="PE">Peru</option>
              <option value="UY">Uruguay</option>
              <option value="BR">Brasil</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Notas para el despacho (opcional)
            </label>
            <textarea id="notes" name="notes" rows={3} maxLength={500} className="field" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-tight">Pago</h2>
        <div className="mt-5 border border-sand-dark bg-sand p-5">
          <p className="font-display text-sm font-semibold uppercase tracking-widest text-ink">
            Mercado Pago
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Al confirmar te llevaremos al entorno seguro de Mercado Pago, donde puedes pagar con
            tarjeta de credito, debito, transferencia o efectivo. Nunca almacenamos los datos de tu
            tarjeta.
          </p>
        </div>
      </section>

      <SubmitButton totalLabel={totalLabel} />

      <p className="text-xs leading-relaxed text-ink-muted">
        Al confirmar tu pedido aceptas los terminos y condiciones y la politica de privacidad de la
        tienda.
      </p>
    </form>
  );
}

function SubmitButton({ totalLabel }: { totalLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Redirigiendo a Mercado Pago...' : `Pagar ${totalLabel}`}
    </button>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  type = 'text',
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className={`field ${error ? 'field-error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <span id={`${id}-error`} className="error-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1 block text-xs text-ink-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
