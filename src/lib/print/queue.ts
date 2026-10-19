import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import type { PrintJob } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Cola de impresion.
 *
 * El servidor no ve la impresora: esta en el PC de la tienda. Claude encola
 * documentos (PDF ya listos) y el agente de print-agent/ los pide cada pocos
 * segundos, los imprime y avisa el resultado. Si el agente descarga un
 * trabajo y no avisa en 10 minutos (se corto la luz, se cerro el PC), el
 * trabajo vuelve a la cola.
 */

export const CLAIM_TIMEOUT_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;
const KEEP_DAYS = 30;
const SEEN_KEY = 'print_agent_seen';

export class PrintQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrintQueueError';
  }
}

export function printQueueEnabled(): boolean {
  return env.printAgentToken.length >= 24;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Compara la cabecera `Authorization: Bearer ...` con PRINT_AGENT_TOKEN. */
export function agentAuthorized(header: string | null): boolean {
  if (!printQueueEnabled()) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  if (!match) return false;
  return timingSafeEqual(digest(match[1]!), digest(env.printAgentToken));
}

export async function enqueuePrint(input: {
  kind: string;
  title: string;
  refs: string[];
  pdf: Buffer;
  copies?: number;
  createdBy?: string;
}): Promise<PrintJob> {
  if (!printQueueEnabled()) {
    throw new PrintQueueError(
      'La cola de impresion esta apagada: define PRINT_AGENT_TOKEN (minimo 24 caracteres) en el servidor y configura el agente de impresion.',
    );
  }
  // Limpieza oportunista: lo viejo ya no se va a reimprimir.
  await prisma.printJob
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } })
    .catch(() => undefined);

  return prisma.printJob.create({
    data: {
      kind: input.kind,
      title: input.title,
      refs: input.refs,
      pdf: input.pdf,
      copies: input.copies ?? 1,
      createdBy: input.createdBy,
    },
  });
}

/** Referencias que ya esperan en la cola, para no encolarlas dos veces. */
export async function queuedRefs(kind: string): Promise<Set<string>> {
  const rows = await prisma.printJob.findMany({
    where: { kind, status: 'PENDING' },
    select: { refs: true },
  });
  return new Set(rows.flatMap((r) => r.refs));
}

// ---------------------------------------------------------------------------
// Lo que usa el agente
// ---------------------------------------------------------------------------

export async function markAgentSeen(name: string) {
  const value = JSON.stringify({ at: new Date().toISOString(), name: name.slice(0, 80) });
  await prisma.setting
    .upsert({ where: { key: SEEN_KEY }, create: { key: SEEN_KEY, value }, update: { value } })
    .catch(() => undefined);
}

/** Pendientes que nadie tiene tomados, o cuyo agente no volvio a avisar. */
function available() {
  return {
    status: 'PENDING' as const,
    OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) } }],
  };
}

export async function jobsForAgent() {
  return prisma.printJob.findMany({
    where: available(),
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, kind: true, title: true, copies: true, createdAt: true },
  });
}

/** Entrega el PDF y marca el trabajo como tomado. null si ya no esta disponible. */
export async function claimJob(id: string): Promise<PrintJob | null> {
  const claimed = await prisma.printJob.updateMany({
    where: { id, ...available() },
    data: { claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return null;
  return prisma.printJob.findUnique({ where: { id } });
}

export async function finishJob(id: string, result: { ok: boolean; error?: string }) {
  const job = await prisma.printJob.findUnique({ where: { id }, select: { status: true, attempts: true } });
  if (!job || job.status !== 'PENDING') return null;
  if (result.ok) {
    return prisma.printJob.update({
      where: { id },
      data: { status: 'PRINTED', printedAt: new Date(), error: null },
    });
  }
  // Un error de impresion se reintenta solo hasta MAX_ATTEMPTS veces.
  return prisma.printJob.update({
    where: { id },
    data: {
      status: job.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
      claimedAt: null,
      error: (result.error ?? 'Error sin detalle').slice(0, 500),
    },
  });
}

// ---------------------------------------------------------------------------
// Estado, para Claude
// ---------------------------------------------------------------------------

export async function agentStatus() {
  if (!printQueueEnabled()) return { activo: false, mensaje: 'Falta PRINT_AGENT_TOKEN en el servidor.' };
  const row = await prisma.setting.findUnique({ where: { key: SEEN_KEY } });
  if (!row) return { activo: true, conectado: false, mensaje: 'El agente de impresion nunca se ha conectado.' };
  const seen = JSON.parse(row.value) as { at: string; name: string };
  const seconds = Math.round((Date.now() - new Date(seen.at).getTime()) / 1000);
  return {
    activo: true,
    conectado: seconds < 120,
    agente: seen.name,
    visto_hace_segundos: seconds,
    mensaje:
      seconds < 120
        ? 'El agente esta conectado: imprimira en unos segundos.'
        : 'El agente no se conecta hace rato: lo encolado se imprimira cuando el PC vuelva a estar encendido con el agente corriendo.',
  };
}

export async function queueOverview(limit = 20) {
  const jobs = await prisma.printJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      refs: true,
      copies: true,
      status: true,
      attempts: true,
      error: true,
      createdAt: true,
      printedAt: true,
    },
  });
  return { agente: await agentStatus(), trabajos: jobs };
}

export async function cancelJob(id: string) {
  const res = await prisma.printJob.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  return res.count === 1;
}
