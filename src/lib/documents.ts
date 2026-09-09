/**
 * Envio manual de documentos desde el panel.
 *
 * La tienda ya manda correos sola (comprobantes de compra, avisos de estado),
 * pero hay papeles que no nacen de un pedido: una boleta que se emitio aparte,
 * una cotizacion, un certificado. Esto es la parte manual: se eligen archivos,
 * se escriben las direcciones y salen desde el mismo correo del negocio que
 * usa el resto de la tienda.
 *
 * Este modulo es solo reglas y formato: no toca la base ni el proveedor, para
 * poder probarlo sin ninguno de los dos.
 */

/**
 * Peso maximo de un adjunto y del envio completo.
 *
 * Resend acepta hasta 40 MB por mensaje, pero el archivo viaja en base64
 * dentro del JSON (un tercio mas de peso) y antes tiene que pasar por el limite
 * de la Server Action (`serverActions.bodySizeLimit` en next.config.ts). 15 MB
 * de adjuntos dejan margen para las dos cosas y siguen entrando en la bandeja
 * de casi cualquier destinatario.
 */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_DOCUMENT_BYTES = 15 * 1024 * 1024;

/** Cuantos archivos van en un mismo correo. */
export const MAX_DOCUMENTS = 5;

/** A cuantas direcciones se puede enviar de una vez. */
export const MAX_RECIPIENTS = 20;

/**
 * Formatos admitidos.
 *
 * La lista es cerrada a proposito: lo que se sube queda guardado y se puede
 * descargar despues desde el panel, asi que no tiene sentido aceptar
 * ejecutables ni HTML, que es lo que se aprovecharia si alguien entrara al
 * panel.
 */
export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WEBP',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/zip': 'ZIP',
};

export const ALLOWED_DOCUMENT_LABEL = Array.from(
  new Set(Object.values(ALLOWED_DOCUMENT_TYPES)),
).join(', ');

export function documentTypeLabel(mimeType: string): string {
  return ALLOWED_DOCUMENT_TYPES[mimeType] ?? 'Archivo';
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;.]+(?:\.[^\s@,;.]+)+$/;

export type RecipientsResult =
  | { ok: true; recipients: string[] }
  | { ok: false; error: string };

/**
 * Convierte lo que se escribio en la caja de destinatarios en una lista limpia.
 *
 * Se aceptan comas, punto y coma, espacios y saltos de linea como separadores
 * porque las direcciones casi siempre llegan pegadas desde otro lado (una
 * planilla, un chat) y obligar a un formato exacto solo genera errores que el
 * programa puede resolver solo. Las repetidas se descartan: nadie quiere
 * recibir el mismo comprobante dos veces.
 */
export function parseRecipients(input: string): RecipientsResult {
  const parts = input
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    return { ok: false, error: 'Escribe al menos una direccion de correo.' };
  }

  const invalid = parts.find((value) => !EMAIL_PATTERN.test(value) || value.length > 254);
  if (invalid) {
    return { ok: false, error: `"${invalid}" no parece una direccion de correo valida.` };
  }

  const recipients = Array.from(new Set(parts));
  if (recipients.length > MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `Son ${recipients.length} direcciones y el maximo por envio son ${MAX_RECIPIENTS}.`,
    };
  }

  return { ok: true, recipients };
}

export type DocumentFile = {
  filename: string;
  mimeType: string;
  size: number;
  bytes: Buffer;
};

export type DocumentFilesResult =
  | { ok: true; files: DocumentFile[] }
  | { ok: false; error: string };

/** Deja el nombre en algo que se pueda guardar y adjuntar sin sorpresas. */
export function safeFilename(name: string): string {
  const clean = name
    .replace(/[\\/]/g, '-')
    // Caracteres de control: no se ven, pero ensucian la cabecera del adjunto.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
  return clean || 'documento';
}

/** Valida los archivos que llegan del formulario y los lee a memoria. */
export async function readDocumentFiles(input: File[]): Promise<DocumentFilesResult> {
  const uploads = input.filter((file) => file instanceof File && file.size > 0);

  if (uploads.length === 0) {
    return { ok: false, error: 'Adjunta al menos un documento.' };
  }
  if (uploads.length > MAX_DOCUMENTS) {
    return { ok: false, error: `Puedes adjuntar hasta ${MAX_DOCUMENTS} archivos por envio.` };
  }

  const files: DocumentFile[] = [];
  let total = 0;

  for (const file of uploads) {
    if (!ALLOWED_DOCUMENT_TYPES[file.type]) {
      return {
        ok: false,
        error: `"${safeFilename(file.name)}" no es un formato admitido. Usa ${ALLOWED_DOCUMENT_LABEL}.`,
      };
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return {
        ok: false,
        error: `"${safeFilename(file.name)}" pesa ${formatBytes(file.size)} y el maximo por archivo son ${formatBytes(MAX_DOCUMENT_BYTES)}.`,
      };
    }

    total += file.size;
    if (total > MAX_TOTAL_DOCUMENT_BYTES) {
      return {
        ok: false,
        error: `Los adjuntos suman mas de ${formatBytes(MAX_TOTAL_DOCUMENT_BYTES)}. Envialos en dos correos.`,
      };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    files.push({
      filename: safeFilename(file.name),
      mimeType: file.type,
      size: bytes.length,
      bytes,
    });
  }

  return { ok: true, files };
}
