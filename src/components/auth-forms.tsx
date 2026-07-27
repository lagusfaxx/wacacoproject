'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AuthState, loginAction, registerAction } from '@/app/actions/auth';

const initialState: AuthState = { status: 'idle', message: '', errors: {} };

export function LoginForm({ next, isAdmin = false }: { next?: string; isAdmin?: boolean }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.message ? (
        <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <Field
        label="Correo electronico"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.errors.email}
      />
      <Field
        label="Contrasena"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors.password}
      />

      <SubmitButton label="Iniciar sesion" />

      {!isAdmin ? (
        <p className="text-sm text-ink-muted">
          Olvidaste tu contrasena?{' '}
          <Link
            href="/cuenta/recuperar"
            className="font-semibold text-ink underline underline-offset-2"
          >
            Recuperala con un codigo
          </Link>
        </p>
      ) : null}

      {!isAdmin ? (
        <p className="text-sm text-ink-muted">
          No tienes cuenta?{' '}
          <Link href="/cuenta/registro" className="font-semibold text-ink underline underline-offset-2">
            Crea una gratis
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.message ? (
        <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <Field label="Nombre completo" name="name" autoComplete="name" required error={state.errors.name} />
      <Field
        label="Correo electronico"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.errors.email}
      />
      <Field
        label="Telefono (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        error={state.errors.phone}
      />
      <Field
        label="Contrasena"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors.password}
        hint="Minimo 8 caracteres, con mayuscula, minuscula y un numero."
      />
      <Field
        label="Repetir contrasena"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors.confirmPassword}
      />

      <SubmitButton label="Crear cuenta" />

      <p className="text-sm text-ink-muted">
        Ya tienes cuenta?{' '}
        <Link href="/cuenta/ingresar" className="font-semibold text-ink underline underline-offset-2">
          Inicia sesion
        </Link>
      </p>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Procesando...' : label}
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
  const id = `auth-${name}`;
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
