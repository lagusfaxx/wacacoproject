'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  confirmEmailVerification,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  type VerificationState,
} from '@/app/actions/verification';

const initialState: VerificationState = { status: 'idle', message: '', errors: {} };

function Notice({ state }: { state: VerificationState }) {
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

/** Campo del codigo: seis digitos, ancho y espaciado para leerlo de un vistazo. */
function CodeField({ error }: { error?: string }) {
  return (
    <div>
      <label className="label" htmlFor="verification-code">
        Codigo de 6 digitos
      </label>
      <input
        id="verification-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        // El navegador y el telefono ofrecen pegar el codigo del correo cuando
        // el campo se declara como "one-time-code".
        pattern="[0-9]*"
        maxLength={7}
        required
        placeholder="000000"
        className={`field text-center font-mono text-2xl tracking-[0.4em] ${error ? 'field-error' : ''}`}
      />
      {error && error.trim() ? <span className="error-text">{error}</span> : null}
    </div>
  );
}

function SubmitButton({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'ghost' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={variant === 'primary' ? 'btn-primary w-full' : 'btn-ghost w-full'}
    >
      {pending ? 'Enviando...' : label}
    </button>
  );
}

export function VerifyEmailForm({ email, next }: { email: string; next: string }) {
  const [confirmState, confirmAction] = useActionState(confirmEmailVerification, initialState);
  const [resendState, resendAction] = useActionState(resendEmailVerification, initialState);

  const verified = confirmState.status === 'ok';

  if (verified) {
    return (
      <div className="space-y-6">
        <Notice state={confirmState} />
        <Link href={next} className="btn-primary w-full">
          Continuar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Enviamos un codigo a <span className="font-semibold text-ink">{email}</span>. Si no lo ves,
        revisa la carpeta de correo no deseado.
      </p>

      <form action={confirmAction} className="space-y-5" noValidate>
        <Notice state={confirmState} />
        <CodeField error={confirmState.errors.code} />
        <SubmitButton label="Confirmar mi correo" />
      </form>

      <form action={resendAction} className="space-y-3">
        <Notice state={resendState} />
        <SubmitButton label="Enviarme otro codigo" variant="ghost" />
      </form>

      <p className="text-center text-sm text-ink-muted">
        <Link href={next} className="underline underline-offset-2">
          Lo hago mas tarde
        </Link>
      </p>
    </div>
  );
}

export function PasswordResetForm() {
  const [requestState, requestAction] = useActionState(requestPasswordReset, initialState);
  const [confirmState, confirmAction] = useActionState(resetPassword, initialState);
  const [email, setEmail] = useState('');

  // Se pasa a pedir el codigo en cuanto la solicitud se acepta, y se queda ahi
  // aunque el codigo se escriba mal.
  const step = confirmState.step === 'request' ? 'request' : (requestState.step ?? 'request');
  const done = confirmState.status === 'ok';

  if (done) {
    return (
      <div className="space-y-6">
        <Notice state={confirmState} />
        <Link href="/cuenta/ingresar" className="btn-primary w-full">
          Iniciar sesion
        </Link>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <form action={confirmAction} className="space-y-5" noValidate>
        <Notice state={requestState} />
        <Notice state={confirmState} />
        <input type="hidden" name="email" value={email} />

        <CodeField error={confirmState.errors.code} />

        <div>
          <label className="label" htmlFor="reset-password">
            Nueva contrasena
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={`field ${confirmState.errors.password ? 'field-error' : ''}`}
          />
          {confirmState.errors.password ? (
            <span className="error-text">{confirmState.errors.password}</span>
          ) : (
            <span className="mt-1 block text-xs text-ink-muted">
              Minimo 8 caracteres, con mayuscula, minuscula y un numero.
            </span>
          )}
        </div>

        <div>
          <label className="label" htmlFor="reset-confirm">
            Repetir contrasena
          </label>
          <input
            id="reset-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className={`field ${confirmState.errors.confirmPassword ? 'field-error' : ''}`}
          />
          {confirmState.errors.confirmPassword ? (
            <span className="error-text">{confirmState.errors.confirmPassword}</span>
          ) : null}
        </div>

        <SubmitButton label="Cambiar mi contrasena" />
      </form>
    );
  }

  return (
    <form action={requestAction} className="space-y-5" noValidate>
      <Notice state={requestState} />

      <div>
        <label className="label" htmlFor="reset-email">
          Correo de tu cuenta
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field"
        />
      </div>

      <SubmitButton label="Enviarme un codigo" />

      <p className="text-center text-sm text-ink-muted">
        <Link href="/cuenta/ingresar" className="underline underline-offset-2">
          Volver a iniciar sesion
        </Link>
      </p>
    </form>
  );
}
