import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized, claimJob, finishJob } from '@/lib/print/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function denied() {
  return NextResponse.json({ error: 'Credencial invalida.' }, { status: 401 });
}

/** Descarga el PDF de un trabajo y lo deja tomado por el agente. */
export async function GET(request: Request, { params }: Params) {
  if (!agentAuthorized(request.headers.get('authorization'))) return denied();
  const { id } = await params;
  const job = await claimJob(id);
  if (!job) return NextResponse.json({ error: 'El trabajo ya no esta pendiente.' }, { status: 409 });

  return new NextResponse(new Uint8Array(job.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${job.id}.pdf"`,
      'Cache-Control': 'no-store',
      'X-Copies': String(job.copies),
    },
  });
}

const resultSchema = z.object({ ok: z.boolean(), error: z.string().max(2000).optional() });

/** El agente avisa si imprimio o en que fallo. */
export async function POST(request: Request, { params }: Params) {
  if (!agentAuthorized(request.headers.get('authorization'))) return denied();
  const { id } = await params;
  const parsed = resultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });

  const job = await finishJob(id, parsed.data);
  if (!job) return NextResponse.json({ error: 'El trabajo ya no esta pendiente.' }, { status: 409 });
  return NextResponse.json({ id: job.id, status: job.status });
}
