'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type NewsletterState, subscribeToNewsletter } from '@/app/actions/newsletter';

const initialState: NewsletterState = { status: 'idle', message: '' };

export function NewsletterForm() {
  const [state, formAction] = useActionState(subscribeToNewsletter, initialState);

  return (
    <form action={formAction} className="max-w-md">
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Correo electronico
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          maxLength={180}
          placeholder="tu@correo.com"
          className="w-full border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
        />
        <SubmitButton />
      </div>
      {state.message ? (
        <p
          className={`mt-2 text-xs ${state.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          role="status"
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
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 bg-brand px-6 font-display text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? '...' : 'Enviar'}
    </button>
  );
}
