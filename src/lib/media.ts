import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from './db';
import { MEDIA_WIDTHS } from './media-url';

/**
 * Imagenes subidas desde el panel.
 *
 * Se guardan en Postgres en lugar de en disco porque el contenedor de Coolify
 * es efimero: cualquier archivo escrito en el sistema de archivos se pierde en
 * el siguiente despliegue. Guardarlas en la base tambien las incluye en los
 * respaldos de la tienda sin configurar nada aparte.
 */

/**
 * Peso maximo de una imagen subida desde el panel.
 *
 * Si se toca, hay que subir tambien `serverActions.bodySizeLimit` en
 * `next.config.ts`: el logo viaja por una Server Action, que trae su propio
 * tope y cortaria el archivo antes de que esta comprobacion llegue a correr.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

export type MediaError = { error: string };
export type MediaResult = { url: string; id: string };

/** Un SVG puede traer scripts; se rechaza en lugar de guardarlo. */
function svgIsSafe(buffer: Buffer): boolean {
  const source = buffer.toString('utf8').toLowerCase();
  return (
    !source.includes('<script') &&
    !source.includes('javascript:') &&
    !/\son\w+\s*=/.test(source)
  );
}

export async function storeImage(file: File, alt = ''): Promise<MediaResult | MediaError> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No se recibio ningun archivo.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Formato no admitido. Usa JPG, PNG, WEBP, AVIF o SVG.' };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      error: `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el maximo son ${
        MAX_IMAGE_BYTES / 1024 / 1024
      } MB.`,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (file.type === 'image/svg+xml' && !svgIsSafe(bytes)) {
    return { error: 'El SVG contiene codigo ejecutable y no se puede usar.' };
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      filename: file.name.slice(0, 200) || 'imagen',
      mimeType: file.type,
      size: bytes.length,
      bytes,
      alt: alt.slice(0, 200),
    },
    select: { id: true },
  });

  // Se dejan preparadas las versiones optimizadas mientras el propietario
  // sigue llenando el formulario, para que ningun visitante las espere.
  warmVariants(asset.id, file.type);

  return { id: asset.id, url: `/api/media/${asset.id}` };
}

export async function getImage(id: string) {
  return prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, size: true },
  });
}

// ---------------------------------------------------------------------------
// Versiones optimizadas
// ---------------------------------------------------------------------------

/** Formatos modernos, del que mejor comprime al que menos. */
const MODERN_FORMATS = ['avif', 'webp'] as const;
export type MediaFormat = (typeof MODERN_FORMATS)[number];

/** Un SVG ya es texto y escala solo; reencodearlo no aporta nada. */
const NOT_OPTIMIZABLE = ['image/svg+xml'];

/**
 * La lista de anchos es cerrada a proposito: uno libre en la URL dejaria que
 * cualquiera pidiera mil tamanos distintos y llenara la base de versiones.
 */
export function toMediaWidth(value: string | null): number | null {
  const width = Number(value);
  return MEDIA_WIDTHS.includes(width) ? width : null;
}

/** Elige el mejor formato que el navegador dice aceptar. */
export function pickFormat(accept: string | null): MediaFormat | null {
  const header = (accept ?? '').toLowerCase();
  return MODERN_FORMATS.find((format) => header.includes(`image/${format}`)) ?? null;
}

/**
 * Devuelve la imagen en el ancho y formato pedidos, generandola la primera vez.
 *
 * Nunca modifica ni reemplaza el original: la version optimizada se guarda
 * aparte, como cache. Si algo falla — sharp no disponible, formato que no se
 * puede leer — se devuelve el original tal cual, que es exactamente el
 * comportamiento que habia antes de todo esto.
 */
export async function getOptimizedImage(
  id: string,
  width: number | null,
  format: MediaFormat | null,
): Promise<{ bytes: Buffer; mimeType: string; size: number } | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, size: true },
  });
  if (!asset) return null;

  const original = { bytes: Buffer.from(asset.bytes), mimeType: asset.mimeType, size: asset.size };
  if (NOT_OPTIMIZABLE.includes(asset.mimeType)) return original;
  if (!width && !format) return original;

  const key = { mediaId: id, width: width ?? 0, format: format ?? 'origen' };

  const cached = await prisma.mediaVariant
    .findUnique({
      where: { mediaId_width_format: key },
      select: { bytes: true, mimeType: true, size: true },
    })
    .catch(() => null);
  if (cached) {
    return { bytes: Buffer.from(cached.bytes), mimeType: cached.mimeType, size: cached.size };
  }

  // Nadie espera a que se genere. Comprimir una foto grande cuesta segundos, y
  // hacerlo mientras alguien mira la pantalla en blanco es exactamente el
  // problema que esto venia a resolver: se manda el original, que ya esta
  // listo, y las versiones quedan hechas para la siguiente visita.
  //
  // Se preparan todos los anchos de una vez, no solo el pedido: quien entra
  // despues pedira otro ancho segun su pantalla, y con esto una sola visita
  // deja la foto lista para todos.
  warmVariants(id, original.mimeType);
  return original;
}

/** Variantes que ya se estan calculando, para no repetir el trabajo. */
const enCurso = new Set<string>();

/**
 * Calcula y guarda una version, si no estaba ya.
 *
 * No devuelve nada a proposito: quien la pide no la espera. Los errores se
 * tragan porque esto es cache; si falla, la proxima peticion sirve el original
 * igual que ahora.
 */
async function ensureVariant(
  id: string,
  originalBytes: Buffer,
  width: number | null,
  format: MediaFormat | null,
): Promise<void> {
  const key = { mediaId: id, width: width ?? 0, format: format ?? 'origen' };
  const marca = `${key.mediaId}|${key.width}|${key.format}`;
  if (enCurso.has(marca)) return;
  enCurso.add(marca);

  try {
    const existe = await prisma.mediaVariant
      .findUnique({ where: { mediaId_width_format: key }, select: { id: true } })
      .catch(() => null);
    if (existe) return;

    const rendered = await render(originalBytes, width, format).catch(() => null);
    if (!rendered) return;

    // Si la version "optimizada" pesa mas que el original, no vale la pena:
    // pasa con fotos ya comprimidas al limite y con imagenes muy pequenas.
    if (!width && rendered.bytes.length >= originalBytes.length) return;

    // `createMany` con `skipDuplicates` en vez de `create`: entre la consulta de
    // arriba y esta linea puede haberse guardado la misma version desde otra
    // peticion (o desde otro proceso, donde `enCurso` no alcanza). Con `create`
    // eso terminaba en una violacion de la clave unica que Prisma escribe en el
    // registro como error aunque aqui se ignorara; asi la carrera simplemente no
    // inserta nada.
    await prisma.mediaVariant
      .createMany({
        data: [
          {
            ...key,
            mimeType: rendered.mimeType,
            size: rendered.bytes.length,
            bytes: rendered.bytes,
          },
        ],
        skipDuplicates: true,
      })
      .catch(() => undefined);
  } finally {
    enCurso.delete(marca);
  }
}

/**
 * Imagenes en espera de que se les preparen las versiones optimizadas.
 *
 * Es una fila, y se atiende de a una. Subir ocho fotos de la franja lanzaba
 * ocho preparaciones a la vez, y cada una son doce reencodeados: el servidor
 * de la tienda tiene uno o dos nucleos, asi que se quedaban sin procesador
 * entre ellas y con ellas la pagina, que es justo lo que se noto al subirlas.
 */
const enEspera: string[] = [];
let atendiendo = false;

/**
 * Deja preparadas las versiones de una imagen recien subida.
 *
 * Se lanza al subir, sin esperarla: para cuando el primer visitante llegue a
 * la portada, las fotos del banner ya estan comprimidas y salen al instante.
 */
export function warmVariants(id: string, mimeType: string): void {
  if (NOT_OPTIMIZABLE.includes(mimeType)) return;
  if (enEspera.includes(id)) return;

  enEspera.push(id);
  if (atendiendo) return;
  atendiendo = true;

  // Se espera un poco antes de empezar. Comprimir ocupa el procesador, y si
  // arranca en el mismo instante en que alguien esta cargando la portada le
  // roba el tiempo a la pagina que lo disparo: medido, la foto del banner
  // pasaba de 400 ms a 4 segundos. Este respiro basta para que la visita en
  // curso termine primero.
  setTimeout(() => void atenderEspera(), WARM_DELAY_MS).unref?.();
}

/**
 * Prepara las versiones de las imagenes en espera, de una en una.
 *
 * Los bytes se releen de la base al llegarle el turno a cada imagen, en lugar
 * de guardarlos en la fila: con diez fotos de diez megas encoladas eso serian
 * cien megas retenidos en memoria a la espera de su turno.
 */
async function atenderEspera(): Promise<void> {
  try {
    while (enEspera.length > 0) {
      const id = enEspera.shift()!;
      const asset = await prisma.mediaAsset
        .findUnique({ where: { id }, select: { bytes: true, mimeType: true } })
        .catch(() => null);
      // Puede haberse borrado mientras esperaba su turno; no es un error.
      if (!asset || NOT_OPTIMIZABLE.includes(asset.mimeType)) continue;

      const bytes = Buffer.from(asset.bytes);
      for (const format of MODERN_FORMATS) {
        for (const width of [null, ...MEDIA_WIDTHS]) {
          await ensureVariant(id, bytes, width, format).catch(() => undefined);
        }
      }
    }
  } finally {
    atendiendo = false;
  }
}

/** Respiro antes de empezar a comprimir en segundo plano. */
const WARM_DELAY_MS = 4000;

/**
 * Reencodea con sharp.
 *
 * Se importa aqui dentro y no arriba porque es un modulo nativo: si el
 * despliegue no lo trae, esta funcion falla y quien llama sirve el original,
 * en lugar de tumbar la tienda entera.
 */
async function render(
  bytes: Buffer,
  width: number | null,
  format: MediaFormat | null,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const sharp = (await import('sharp')).default;

  // Un solo hilo por operacion: el servidor de la tienda suele tener uno o dos
  // nucleos, y dejar que libvips se los quede todos deja la pagina esperando.
  sharp.concurrency(1);

  let pipeline = sharp(bytes, { failOn: 'none' });

  const meta = await pipeline.metadata();
  // Nunca se agranda una imagen: pedir 1920 de una foto de 800 devolveria una
  // version borrosa y mas pesada que el original.
  if (width && meta.width && width < meta.width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true });
  }

  // Calidades altas a proposito: el objetivo es que no se note la diferencia.
  // AVIF y WEBP a estos valores son visualmente indistinguibles del original y
  // aun asi pesan una fraccion.
  //
  // El esfuerzo de AVIF va al minimo porque el reparto es pesimo: medido sobre
  // una foto de 2400x1600 a 1920 de ancho, subirlo de 0 a 4 tarda 2927 ms en
  // vez de 446 y solo ahorra 2 KB de 10. No vale la pena ni siquiera
  // calculandolo en segundo plano, que igual es tiempo de servidor.
  if (format === 'avif') {
    return { bytes: await pipeline.avif({ quality: 62, effort: 0 }).toBuffer(), mimeType: 'image/avif' };
  }
  if (format === 'webp') {
    return { bytes: await pipeline.webp({ quality: 85 }).toBuffer(), mimeType: 'image/webp' };
  }

  // Sin formato moderno solo queda reducir el ancho, conservando el original.
  if (!width) return null;
  if (meta.format === 'png') {
    return { bytes: await pipeline.png({ compressionLevel: 9 }).toBuffer(), mimeType: 'image/png' };
  }
  return { bytes: await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer(), mimeType: 'image/jpeg' };
}

/**
 * Todas las imagenes que alguna fila de la tienda esta usando ahora mismo.
 *
 * No lleva una lista de sitios donde mirar, y es a proposito. La llevaba, y
 * costo caro: los bloques de contenido no estaban en ella, asi que para la
 * limpieza las fotos de una franja no las usaba nadie y las borraba en cuanto
 * pasaba su hora de gracia, dejando la ficha apuntando a una URL muerta.
 * Olvidarse de sumar un sitio nuevo no da error ni rompe ninguna prueba: se
 * nota semanas despues, cuando las fotos ya no estan.
 *
 * Asi que se le pregunta al propio esquema. Se recorre cada columna de texto
 * de cada tabla buscando cualquier `/api/media/<id>`, y con eso una columna
 * nueva queda cubierta desde el dia que se crea. Vale igual para una URL
 * pegada dentro de un texto o de un ajuste en JSON, que la version anterior
 * tampoco reconocia.
 */
async function usedMediaIds(): Promise<Set<string>> {
  // Estas dos guardan las imagenes, no las usan: contarlas seria decir que
  // toda imagen se referencia a si misma y no borrar ninguna nunca.
  const propias = ['MediaAsset', 'MediaVariant'];

  const consultas = Prisma.dmmf.datamodel.models
    .filter((model) => !propias.includes(model.name))
    .flatMap((model) => {
      const columnas = model.fields
        .filter((field) => field.kind === 'scalar' && field.type === 'String')
        // Una columna de lista se aplana a texto; para buscar una URL dentro
        // da igual donde termina un elemento y empieza el siguiente.
        .map((field) => {
          const columna = `"${field.dbName ?? field.name}"`;
          return field.isList ? `array_to_string(${columna}, ' ')` : columna;
        });
      if (columnas.length === 0) return [];

      const tabla = `"${model.dbName ?? model.name}"`;
      // concat_ws ignora los nulos, asi que una fila a medio llenar no anula
      // la busqueda en el resto de sus columnas.
      return [
        `SELECT DISTINCT hallazgo[1] AS id FROM ${tabla}, ` +
          `LATERAL regexp_matches(concat_ws(' ', ${columnas.join(', ')}), ` +
          `'/api/media/([A-Za-z0-9_-]{1,40})', 'g') AS hallazgo`,
      ];
    });

  const filas = await prisma.$queryRawUnsafe<{ id: string }[]>(consultas.join(' UNION '));
  return new Set(filas.map((fila) => fila.id));
}

/**
 * Borra las imagenes que ya no referencia nadie.
 *
 * Se llama al guardar un producto, coleccion o banner. Sin esto la base
 * acumularia cada imagen que el propietario subio y despues reemplazo.
 *
 * Ante la duda no borra: si la busqueda de referencias falla, se sale sin
 * tocar nada. Guardar imagenes de mas cuesta disco; borrar una que estaba en
 * uso no tiene vuelta atras, porque el original solo vive aqui.
 */
export async function purgeOrphanImages(): Promise<number> {
  const assets = await prisma.mediaAsset.findMany({ select: { id: true, createdAt: true } });
  if (assets.length === 0) return 0;

  const used = await usedMediaIds().catch(() => null);
  if (!used) return 0;

  // Se respeta una ventana de gracia amplia: una imagen recien subida puede
  // estar en un formulario todavia sin guardar, y llenar la ficha de un
  // producto con sus fotos, sus variantes y sus bloques lleva un buen rato.
  // La limpieza no corre prisa, que lo unico en juego es disco; borrar la
  // foto que alguien tenia a medio poner no se puede deshacer.
  const cutoff = Date.now() - GRACE_MS;
  const orphans = assets
    .filter((asset) => !used.has(asset.id) && asset.createdAt.getTime() < cutoff)
    .map((asset) => asset.id);

  if (orphans.length === 0) return 0;

  const removed = await prisma.mediaAsset.deleteMany({ where: { id: { in: orphans } } });
  return removed.count;
}

/** Cuanto se le respeta a una imagen recien subida antes de considerarla huerfana. */
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
