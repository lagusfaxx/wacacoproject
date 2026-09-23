import type { Metadata } from 'next';
import Link from 'next/link';
import { MlForm } from '@/components/admin/ml/ml-form';
import { Empty, MlError, Panel } from '@/components/admin/ml/ml-ui';
import { requireAdmin } from '@/lib/auth';
import { listQuestions } from '@/lib/mercadolibre/read';
import { safeMl } from '@/lib/mercadolibre/safe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Preguntas de Mercado Libre' };

type PageProps = { searchParams: Promise<{ estado?: string; item?: string }> };

export default async function MlQuestionsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const estado = sp.estado === 'ANSWERED' ? 'ANSWERED' : 'UNANSWERED';
  const item = sp.item && /^[A-Z]{3}\d{5,15}$/.test(sp.item) ? sp.item : undefined;

  const result = await safeMl(() => listQuestions({ estado, itemId: item, limit: 50 }));
  if (!result.ok) return <MlError error={result.error} notConnected={result.notConnected} />;
  const { questions, total } = result.data;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['UNANSWERED', 'ANSWERED'] as const).map((e) => (
          <Link
            key={e}
            href={`/admin/mercadolibre/preguntas?estado=${e}${item ? `&item=${item}` : ''}`}
            className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest ${estado === e ? 'border-ink bg-ink text-white' : 'border-sand-dark text-ink-soft'}`}
          >
            {e === 'UNANSWERED' ? 'Sin responder' : 'Respondidas'}
          </Link>
        ))}
        {item ? (
          <Link href={`/admin/mercadolibre/preguntas?estado=${estado}`} className="btn-ghost btn-sm">
            Quitar filtro {item}
          </Link>
        ) : null}
      </div>

      <Panel title={`${total} preguntas`}>
        {questions.length === 0 ? (
          <Empty>{estado === 'UNANSWERED' ? 'No hay preguntas pendientes.' : 'Sin preguntas respondidas.'}</Empty>
        ) : (
          <ul className="divide-y divide-sand-dark">
            {questions.map((q) => (
              <li key={q.id} className="space-y-3 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/admin/mercadolibre/publicaciones/${q.item_id}`} className="text-xs font-semibold text-ink-soft hover:text-brand">
                    {q.item_title || q.item_id}
                  </Link>
                  <span className="text-xs text-ink-muted">{new Date(q.date_created).toLocaleString('es-CL')}</span>
                </div>
                <p className="text-sm">{q.text}</p>
                {q.answer ? (
                  <p className="border-l-2 border-brand pl-3 text-sm text-ink-soft">{q.answer.text}</p>
                ) : q.status === 'UNANSWERED' ? (
                  <MlForm op="ml_responder_pregunta" hidden={{ question_id: q.id }} submitLabel="Responder">
                    <textarea
                      name="respuesta"
                      rows={3}
                      maxLength={2000}
                      required
                      placeholder="Hola! ..."
                      aria-label="Respuesta"
                      className="field text-sm"
                    />
                  </MlForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="text-xs text-ink-muted">
        Las respuestas son publicas y no se pueden editar. Mercado Libre no permite datos de contacto ni enlaces externos.
      </p>
    </div>
  );
}
