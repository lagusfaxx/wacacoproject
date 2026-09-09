import type { Metadata } from 'next';
import { deleteDocumentEmail } from '@/app/actions/documents';
import { DocumentEmailForm } from '@/components/admin/document-email-form';
import { DocumentResendForm } from '@/components/admin/document-resend-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  ALLOWED_DOCUMENT_LABEL,
  MAX_DOCUMENTS,
  MAX_TOTAL_DOCUMENT_BYTES,
  formatBytes,
} from '@/lib/documents';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Documentos por correo' };

/** Cuantos envios se listan: el historial es de consulta, no un archivo. */
const HISTORY_SIZE = 25;

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(value);
}

export default async function AdminDocumentsPage() {
  await requireAdmin();

  const sends = await prisma.documentEmail.findMany({
    orderBy: { createdAt: 'desc' },
    take: HISTORY_SIZE,
    include: {
      files: { select: { id: true, filename: true, mimeType: true, size: true } },
    },
  });

  // Las direcciones usadas antes se ofrecen como atajo: casi siempre se manda
  // al mismo contador o al mismo cliente varias veces seguidas.
  const suggestions = Array.from(new Set(sends.flatMap((send) => send.recipients))).slice(0, 8);

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Documentos por correo
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Envia comprobantes, boletas, cotizaciones o cualquier archivo desde el correo del negocio a
        las direcciones que escribas. Cada envio queda guardado con sus adjuntos para poder
        reenviarlo o descargarlo despues.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="border border-sand-dark bg-white lg:order-2">
          <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
            Nuevo envio
          </h2>
          <div className="p-6">
            <DocumentEmailForm
              from={env.emailFrom || env.storeEmail}
              enabled={env.emailEnabled}
              formatsLabel={ALLOWED_DOCUMENT_LABEL}
              maxFiles={MAX_DOCUMENTS}
              maxTotalLabel={formatBytes(MAX_TOTAL_DOCUMENT_BYTES)}
              suggestions={suggestions}
            />
          </div>
        </section>

        <section className="border border-sand-dark bg-white lg:order-1">
          <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
            Enviados
          </h2>

          {sends.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-ink-muted">
              Todavia no has enviado ningun documento.
            </p>
          ) : (
            <ul className="divide-y divide-sand-dark">
              {sends.map((send) => (
                <li key={send.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{send.subject}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatDate(send.createdAt)} · {send.sentBy}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        send.failedCount > 0
                          ? 'bg-red-100 text-red-800'
                          : send.sentCount > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sand-dark text-ink-soft'
                      }`}
                    >
                      {send.failedCount > 0
                        ? `${send.sentCount} de ${send.recipients.length} enviados`
                        : send.sentCount > 0
                          ? `Enviado a ${send.sentCount}`
                          : 'No enviado'}
                    </span>
                  </div>

                  <p className="mt-2 break-words text-sm text-ink-soft">
                    {send.recipients.join(', ')}
                  </p>

                  {send.error ? (
                    <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {send.error}
                    </p>
                  ) : null}

                  <ul className="mt-2 flex flex-wrap gap-2">
                    {send.files.map((file) => (
                      <li key={file.id}>
                        <a
                          href={`/api/admin/documentos/${file.id}`}
                          className="inline-flex items-center gap-2 border border-sand-dark px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
                        >
                          <span className="truncate">{file.filename}</span>
                          <span className="tabular-nums text-ink-muted">
                            {formatBytes(file.size)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>

                  <DocumentResendForm id={send.id} recipients={send.recipients} />

                  <form action={deleteDocumentEmail} className="mt-2">
                    <input type="hidden" name="id" value={send.id} />
                    <button
                      type="submit"
                      className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-red-600"
                    >
                      Borrar del historial
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
