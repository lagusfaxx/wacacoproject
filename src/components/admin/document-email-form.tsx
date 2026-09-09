'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AdminState } from '@/app/actions/admin';
import { sendDocumentEmail } from '@/app/actions/documents';

const initialState: AdminState = { status: 'idle', message: '', errors: {} };

type Props = {
  /** Direccion desde la que salen los correos (EMAIL_FROM). */
  from: string;
  /** false = faltan RESEND_API_KEY o EMAIL_FROM. */
  enabled: boolean;
  formatsLabel: string;
  maxFiles: number;
  maxTotalLabel: string;
  /** Direcciones usadas antes, para no reescribirlas cada vez. */
  suggestions: string[];
};

export function DocumentEmailForm({
  from,
  enabled,
  formatsLabel,
  maxFiles,
  maxTotalLabel,
  suggestions,
}: Props) {
  const [state, formAction] = useActionState(sendDocumentEmail, initialState);
  const [files, setFiles] = useState<File[]>([]);
  const recipientsRef = useRef<HTMLTextAreaElement>(null);

  function addRecipient(email: string) {
    const field = recipientsRef.current;
    if (!field) return;
    const current = field.value.trim();
    if (current.toLowerCase().includes(email)) return;
    field.value = current ? `${current}, ${email}` : email;
    field.focus();
  }

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

      {!enabled ? (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El correo de la tienda todavia no esta configurado. Completa{' '}
          <code>RESEND_API_KEY</code> y <code>EMAIL_FROM</code> en las variables de entorno para
          que los documentos salgan de verdad.
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="doc-recipients">
          Para
        </label>
        <textarea
          id="doc-recipients"
          name="recipients"
          ref={recipientsRef}
          rows={2}
          required
          placeholder="cliente@correo.cl, contador@correo.cl"
          className={`field ${state.errors.recipients ? 'field-error' : ''}`}
        />
        {state.errors.recipients ? (
          <span className="error-text">{state.errors.recipients}</span>
        ) : (
          <span className="mt-1 block text-xs text-ink-muted">
            Separa las direcciones con coma, espacio o salto de linea. Cada persona recibe su
            propio correo, sin ver a las demas.
          </span>
        )}

        {suggestions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((email) => (
              <button
                key={email}
                type="button"
                onClick={() => addRecipient(email)}
                className="border border-sand-dark px-2 py-1 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                {email}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="doc-subject">
          Asunto
        </label>
        <input
          id="doc-subject"
          name="subject"
          required
          maxLength={200}
          placeholder="Comprobante de tu compra"
          className={`field ${state.errors.subject ? 'field-error' : ''}`}
        />
        {state.errors.subject ? <span className="error-text">{state.errors.subject}</span> : null}
      </div>

      <div>
        <label className="label" htmlFor="doc-message">
          Mensaje
        </label>
        <textarea
          id="doc-message"
          name="message"
          rows={6}
          required
          maxLength={5000}
          placeholder={'Hola,\n\nAdjuntamos el comprobante de tu compra.\n\nGracias por preferirnos.'}
          className={`field ${state.errors.message ? 'field-error' : ''}`}
        />
        {state.errors.message ? <span className="error-text">{state.errors.message}</span> : null}
      </div>

      <div>
        <label className="label" htmlFor="doc-files">
          Documentos
        </label>
        <input
          id="doc-files"
          name="files"
          type="file"
          multiple
          required
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          className="block w-full text-sm text-ink-soft file:mr-4 file:border file:border-sand-dark file:bg-sand file:px-4 file:py-2 file:font-display file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-ink"
        />
        {state.errors.files ? (
          <span className="error-text">{state.errors.files}</span>
        ) : (
          <span className="mt-1 block text-xs text-ink-muted">
            Hasta {maxFiles} archivos, {maxTotalLabel} en total. Formatos: {formatsLabel}.
          </span>
        )}

        {files.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-ink-soft">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`} className="flex justify-between gap-4">
                <span className="truncate">{file.name}</span>
                <span className="tabular-nums text-ink-muted">
                  {file.size < 1024 * 1024
                    ? `${Math.round(file.size / 1024)} KB`
                    : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-xs text-ink-muted">
        Sale desde <span className="font-semibold text-ink-soft">{from}</span>, el mismo remitente
        de los correos de la tienda.
      </p>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Enviando...' : 'Enviar documentos'}
    </button>
  );
}
