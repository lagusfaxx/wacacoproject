import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { storeImage } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recibe una imagen del panel y devuelve la URL con la que referenciarla. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Peticion invalida.' }, { status: 400 });
  }

  const file = formData.get('file');
  const alt = String(formData.get('alt') ?? '');

  const result = await storeImage(file as File, alt);
  if ('error' in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
