import { SEO_DESCRIPTION_LIMIT, SEO_TITLE_LIMIT, truncate } from './seo';

/**
 * SEO de la portada.
 *
 * La portada es la pagina por la que se busca el nombre de la marca, y era la
 * unica sin texto propio: solo el carrusel, las tarjetas del catalogo y los
 * pies de las secciones. Para un buscador eso es una pagina casi muda, por muy
 * bien escritas que esten las fichas de los productos.
 *
 * Aqui se arma lo que ve Google. Si el propietario escribio su titulo o su
 * texto, mandan los suyos. Si no, se construyen con lo que la tienda ya sabe
 * de si misma: su nombre y los productos que vende, que son justamente las
 * palabras por las que la buscan.
 */

export type HomeSeoInput = {
  storeName: string;
  seoTitle: string | null;
  seoHeading: string | null;
  seoText: string | null;
  metaDescription: string | null;
  /** Nombres de producto, en el orden en que se quieren nombrar. */
  productNames: string[];
  /** Nombres de las colecciones activas. */
  collectionNames: string[];
};

export type HomeSeo = {
  title: string;
  description: string;
  heading: string;
  text: string;
};

/** Une una lista en castellano: "a, b y c". */
function listar(items: string[]): string {
  const limpio = items.map((item) => item.trim()).filter(Boolean);
  if (limpio.length === 0) return '';
  if (limpio.length === 1) return limpio[0]!;
  return `${limpio.slice(0, -1).join(', ')} y ${limpio[limpio.length - 1]}`;
}

export function buildHomeSeo(input: HomeSeoInput): HomeSeo {
  const productos = input.productNames.filter(Boolean).slice(0, 5);
  const colecciones = input.collectionNames.filter(Boolean).slice(0, 3);

  // El titulo nombra la tienda y despues los productos, que es el orden en que
  // se busca: primero la marca, y quien ya sabe que quiere busca el modelo.
  const titulo =
    input.seoTitle?.trim() ||
    (productos.length > 0
      ? `${input.storeName} | ${listar(productos.slice(0, 3))}`
      : `${input.storeName} | Cafeteras portatiles`);

  const descripcion =
    input.metaDescription?.trim() ||
    (productos.length > 0
      ? `${input.storeName}: ${listar(productos)} y mas cafeteras portatiles. Despacho a todo Chile y pago seguro.`
      : `${input.storeName}. Compra en linea con despacho a todo Chile y pago seguro.`);

  const encabezado =
    input.seoHeading?.trim() ||
    (productos.length > 0
      ? `${input.storeName}, cafeteras portatiles: ${productos.slice(0, 3).join(', ')}`
      : `${input.storeName}, cafeteras portatiles`);

  const texto =
    input.seoText?.trim() ||
    [
      productos.length > 0
        ? `En ${input.storeName} encuentras ${listar(productos)}: cafeteras y maquinas de espresso portatiles para preparar cafe donde estes, sin electricidad y sin perder calidad.`
        : `En ${input.storeName} encuentras cafeteras y maquinas de espresso portatiles para preparar cafe donde estes.`,
      colecciones.length > 0
        ? `Tenemos ${listar(colecciones)}, con despacho a todo Chile y pago seguro con Mercado Pago.`
        : 'Despacho a todo Chile y pago seguro con Mercado Pago.',
    ].join(' ');

  return {
    title: truncate(titulo, SEO_TITLE_LIMIT),
    description: truncate(descripcion, SEO_DESCRIPTION_LIMIT),
    heading: encabezado,
    text: texto,
  };
}
