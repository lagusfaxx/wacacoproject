'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  type AccountState,
  changePassword,
  saveAddress,
  updateProfile,
} from '@/app/actions/account';
import { CHILE_REGIONS } from '@/lib/regions-cl';

const initialState: AccountState = { status: 'idle', message: '', errors: {} };

export type AddressDefaults = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  regionCode: string;
  postalCode: string;
  country: string;
};

export function ProfileForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  /** Se muestra bloqueado: identifica la cuenta y no se cambia desde aqui. */
  email?: string;
}) {
  const [state, formAction] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <StatusMessage state={state} />
      <Field label="Nombre" name="name" defaultValue={name} required error={state.errors.name} />
      <Field label="Telefono" name="phone" type="tel" defaultValue={phone} error={state.errors.phone} />
      {email ? (
        <div>
          <label className="label" htmlFor="account-email">
            Correo
          </label>
          <input
            id="account-email"
            type="email"
            value={email}
            readOnly
            disabled
            className="field bg-sand text-ink-muted"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            El correo identifica tu cuenta. Escribenos si necesitas cambiarlo.
          </span>
        </div>
      ) : null}
      <SubmitButton label="Guardar datos" />
    </form>
  );
}

export function AddressForm({ defaults }: { defaults: AddressDefaults }) {
  const [state, formAction] = useActionState(saveAddress, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <StatusMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            label="Nombre de quien recibe"
            name="fullName"
            defaultValue={defaults.fullName}
            required
            error={state.errors.fullName}
          />
        </div>
        <Field
          label="Telefono"
          name="phone"
          type="tel"
          defaultValue={defaults.phone}
          required
          error={state.errors.phone}
        />
        <Field
          label="Codigo postal"
          name="postalCode"
          defaultValue={defaults.postalCode}
          error={state.errors.postalCode}
        />
        <div className="sm:col-span-2">
          <Field
            label="Calle y numero"
            name="line1"
            defaultValue={defaults.line1}
            required
            error={state.errors.line1}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Departamento, oficina (opcional)"
            name="line2"
            defaultValue={defaults.line2}
            error={state.errors.line2}
          />
        </div>
        <Field
          label="Comuna"
          name="city"
          defaultValue={defaults.city}
          required
          error={state.errors.city}
        />
        <div>
          <label className="label" htmlFor="account-regionCode">
            Region
          </label>
          <select
            id="account-regionCode"
            name="regionCode"
            defaultValue={defaults.regionCode}
            className={`field ${state.errors.regionCode ? 'field-error' : ''}`}
            required
          >
            <option value="">Selecciona tu region</option>
            {CHILE_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
          {state.errors.regionCode ? (
            <span className="error-text">{state.errors.regionCode}</span>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="account-country">
            Pais
          </label>
          <select
            id="account-country"
            name="country"
            defaultValue={defaults.country || 'CL'}
            className="field"
          >
            <option value="CL">Chile</option>
          </select>
        </div>
      </div>
      <SubmitButton label="Guardar direccion" />
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <StatusMessage state={state} />
      <Field
        label="Contrasena actual"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors.currentPassword}
      />
      <Field
        label="Nueva contrasena"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors.password}
        hint="Minimo 8 caracteres, con mayuscula, minuscula y un numero."
      />
      <Field
        label="Repetir nueva contrasena"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors.confirmPassword}
      />
      <SubmitButton label="Cambiar contrasena" />
    </form>
  );
}

function StatusMessage({ state }: { state: AccountState }) {
  if (!state.message) return null;
  return (
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
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-dark">
      {pending ? 'Guardando...' : label}
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
  const id = `account-${name}`;
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
        {...rest}
      />
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </div>
  );
}
