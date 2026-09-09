'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, writeAuditLog } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  parseRecipients,
  readDocumentFiles,
  type DocumentFile,
} from '@/lib/documents';
import { sendDocumentsByEmail, type DocumentDelivery } from '@/lib/email/notifications';
import type { AdminState } from './admin';

/**
 * Envio de documentos desde el panel.
 *
 * Vive aparte de `admin.ts` porque es lo unico del panel que manda correos con
 * archivos adjuntos, y esa parte tiene sus propios limites de peso y formato.
 */

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new Error('No autorizado.');
  }
  return user;
}

function fail(message: string, errors: Record<string, string> = {}): AdminState {
  return { status: 'error', message, errors };
}

/** Resume el resultado del envio en una sola frase para el panel. */
function summarize(results: DocumentDelivery[]): AdminState {
  const sent = results.filter((r) => r.outcome === 'sent');
  const skipped = results.filter((r) => r.outcome === 'skipped');
  const failed = results.filter((r) => r.outcome === 'failed');

  if (skipped.length === results.length) {
    return fail(
      'La tienda todavia no tiene el correo configurado (RESEND_API_KEY y EMAIL_FROM), asi que no se envio nada. El envio quedo guardado y puedes reenviarlo cuando este listo.',
    );
  }

  if (failed.length === 0) {
    return {
      status: 'ok',
      message:
        sent.length === 1
          ? `Documentos enviados a ${sent[0].recipient}.`
          : `Documentos enviados a ${sent.length} direcciones.`,
      errors: {},
    };
  }

  const detail = failed[0].detail ? ` Primer error: ${failed[0].detail}` : '';
  return fail(
    `Se envio a ${sent.length} de ${results.length} direcciones. Fallaron: ${failed
      .map((r) => r.recipient)
      .join(', ')}.${detail}`,
  );
}

async function send(input: {
  adminId: string;
  adminEmail: string;
  subject: string;
  message: string;
  recipients: string[];
  files: DocumentFile[];
  /** Envio previo del que salen los archivos, cuando es un reenvio. */
  resendOf?: string;
}): Promise<AdminState> {
  const results = await sendDocumentsByEmail({
    recipients: input.recipients,
    subject: input.subject,
    message: input.message,
    files: input.files,
  });

  const failed = results.filter((r) => r.outcome === 'failed');
  const sent = results.filter((r) => r.outcome === 'sent');

  // El envio se guarda pase lo que pase: si fallo, el archivo sigue ahi para
  // reintentarlo sin volver a buscarlo en el computador.
  const record = await prisma.documentEmail.create({
    data: {
      subject: input.subject,
      message: input.message,
      recipients: input.recipients,
      sentBy: input.adminEmail,
      sentCount: sent.length,
      failedCount: failed.length,
      error: failed[0]?.detail?.slice(0, 500) ?? null,
      files: {
        create: input.files.map((file) => ({
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          bytes: file.bytes,
        })),
      },
    },
    select: { id: true },
  });

  await writeAuditLog({
    userId: input.adminId,
    action: input.resendOf ? 'document.resent' : 'document.sent',
    entity: 'DocumentEmail',
    entityId: record.id,
    metadata: {
      recipients: input.recipients,
      files: input.files.length,
      sent: sent.length,
      failed: failed.length,
      ...(input.resendOf ? { resendOf: input.resendOf } : {}),
    },
  });

  revalidatePath('/admin/documentos');
  return summarize(results);
}

export async function sendDocumentEmail(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (subject.length < 3 || subject.length > 200) {
    return fail('Revisa los datos del envio.', {
      subject: 'El asunto debe tener entre 3 y 200 caracteres.',
    });
  }
  if (message.length === 0 || message.length > 5000) {
    return fail('Revisa los datos del envio.', {
      message: 'Escribe un mensaje de hasta 5000 caracteres.',
    });
  }

  const recipients = parseRecipients(String(formData.get('recipients') ?? ''));
  if (!recipients.ok) {
    return fail('Revisa los datos del envio.', { recipients: recipients.error });
  }

  const files = await readDocumentFiles(formData.getAll('files') as File[]);
  if (!files.ok) {
    return fail('Revisa los adjuntos.', { files: files.error });
  }

  return send({
    adminId: admin.id,
    adminEmail: admin.email,
    subject,
    message,
    recipients: recipients.recipients,
    files: files.files,
  });
}

/** Vuelve a mandar un envio guardado, a las mismas direcciones o a otras. */
export async function resendDocumentEmail(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await assertAdmin();

  const id = String(formData.get('id') ?? '');
  const original = await prisma.documentEmail.findUnique({
    where: { id },
    include: { files: true },
  });
  if (!original) return fail('Ese envio ya no existe.');

  const typed = String(formData.get('recipients') ?? '').trim();
  const recipients = typed
    ? parseRecipients(typed)
    : ({ ok: true, recipients: original.recipients } as const);
  if (!recipients.ok) {
    return fail('Revisa las direcciones.', { [`recipients:${id}`]: recipients.error });
  }
  if (recipients.recipients.length === 0) {
    return fail('Ese envio no tiene direcciones guardadas. Escribe una.');
  }

  return send({
    adminId: admin.id,
    adminEmail: admin.email,
    subject: original.subject,
    message: original.message,
    recipients: recipients.recipients,
    files: original.files.map((file) => ({
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      bytes: Buffer.from(file.bytes),
    })),
    resendOf: original.id,
  });
}

/** Borra un envio del historial junto con sus archivos guardados. */
export async function deleteDocumentEmail(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await prisma.documentEmail.deleteMany({ where: { id } });
  await writeAuditLog({
    userId: admin.id,
    action: 'document.deleted',
    entity: 'DocumentEmail',
    entityId: id,
  });
  revalidatePath('/admin/documentos');
}
