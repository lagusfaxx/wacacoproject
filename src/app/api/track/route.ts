import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { purgeOldPageViews, recordPageView, SESSION_MINUTES } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Nombre de la cookie con el identificador anonimo de la visita. */
const VISIT_COOKIE = 'wc_visita';

/**
 * Cadenas que delatan a un robot.
 *
 * No es una lista exhaustiva ni pretende serlo: filtra a los que se presentan
 * con su nombre, que son la mayoria del trafico automatico, para que el
 * propietario no vea visitas que no son personas.
 */
const BOTS = ['bot', 'crawler', 'spider', 'headlesschrome', 'lighthouse', 'preview', 'monitor'];

function isBot(userAgent: string | null): boolean {
  const agent = (userAgent ?? '').toLowerCase();
  return BOTS.some((mark) => agent.includes(mark));
}

/**
 * Recibe el aviso de que alguien vio una pagina de la tienda.
 *
 * Lo manda el navegador al cargar cada pagina. Responde siempre 204 y sin
 * cuerpo: es un aviso, no una consulta, y nada de lo que pase aqui debe
 * afectar a lo que la persona esta viendo.
 */
export async function POST(request: Request) {
  const respuesta = new NextResponse(null, { status: 204 });

  if (isBot(request.headers.get('user-agent'))) return respuesta;

  let body: { path?: string; referrer?: string; device?: string; productSlug?: string };
  try {
    body = await request.json();
  } catch {
    return respuesta;
  }

  if (typeof body.path !== 'string' || !body.path.startsWith('/')) return respuesta;

  // La cookie dura media hora y se renueva en cada vista: mientras la persona
  // siga paseando es la misma visita, y al rato de irse se le olvida.
  const store = await cookies();
  const sessionId = store.get(VISIT_COOKIE)?.value ?? crypto.randomUUID();

  respuesta.cookies.set(VISIT_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.url.startsWith('https://'),
    path: '/',
    maxAge: SESSION_MINUTES * 60,
  });

  await recordPageView({
    sessionId,
    path: body.path,
    referrer: typeof body.referrer === 'string' ? body.referrer : null,
    device: body.device === 'movil' ? 'movil' : 'escritorio',
    productSlug: typeof body.productSlug === 'string' ? body.productSlug : null,
  }).catch(() => false);

  // La limpieza de visitas viejas se cuela de vez en cuando aqui, en lugar de
  // pedir un proceso aparte que en este despliegue no existe.
  if (Math.random() < 0.001) await purgeOldPageViews().catch(() => 0);

  return respuesta;
}
