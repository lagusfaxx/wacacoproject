import { NextResponse } from 'next/server';
import { getOptimizedImage, pickFormat, toMediaWidth } from '@/lib/media';

export const runtime = 'nodejs';

/**
 * Sirve una imagen subida desde el panel.
 *
 * El id se genera al subir y nunca se reutiliza, asi que el contenido de una
 * URL no cambia jamas y puede cachearse de forma indefinida. Reemplazar la
 * imagen de un producto crea un id nuevo, y con el una URL nueva.
 *
 * Con `?w=` se pide una version mas estrecha, para no mandarle a un telefono
 * la foto de 2000 pixeles que solo hace falta en un monitor. Ademas, si el
 * navegador dice aceptar AVIF o WEBP, se le manda en ese formato: la misma
 * imagen, a la misma medida, pesando bastante menos.
 *
 * El original nunca se toca. Todo esto son copias guardadas aparte y, si algo
 * falla, se devuelve el archivo tal como se subio.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const width = toMediaWidth(new URL(request.url).searchParams.get('w'));
  const format = pickFormat(request.headers.get('accept'));

  // Un fallo pasajero (la base ocupada, una conexion que se agoto) no es
  // una imagen que no existe. Devolverlo como 404 hacia que un tropiezo de un
  // segundo se viera igual que una foto borrada: el navegador ya no reintenta
  // y la pagina queda con el hueco hasta que alguien la recarga. Un 500 dice
  // lo que pasa, y sin guardar en cache para que el siguiente intento vaya de
  // nuevo al servidor.
  let image;
  try {
    image = await getOptimizedImage(id, width, format);
  } catch {
    return new NextResponse('Error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!image) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(image.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // La respuesta cambia segun lo que el navegador acepte, asi que un cache
      // compartido no puede servirle AVIF a quien no lo entiende.
      Vary: 'Accept',
      // Evita que un SVG subido se interprete como documento en el dominio.
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
