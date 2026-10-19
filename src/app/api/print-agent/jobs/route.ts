import { NextResponse } from 'next/server';
import { agentAuthorized, jobsForAgent, markAgentSeen } from '@/lib/print/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que el agente de impresion (print-agent/) consulta cada pocos segundos.
 * Necesita `Authorization: Bearer <PRINT_AGENT_TOKEN>`.
 */
export async function GET(request: Request) {
  if (!agentAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Credencial invalida.' }, { status: 401 });
  }
  await markAgentSeen(request.headers.get('x-agent-name') ?? 'agente');
  const jobs = await jobsForAgent();
  return NextResponse.json({ jobs }, { headers: { 'Cache-Control': 'no-store' } });
}
