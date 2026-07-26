import 'server-only';

import { prisma } from './db';
import { LOGO_SETTING_KEY } from './store-settings';

/**
 * Revision de contenido pendiente antes de publicar la tienda.
 *
 * El catalogo inicial se carga con lo minimo verificable: nombre, categoria y
 * SKU. Precios, descripciones, especificaciones y stock son informacion del
 * negocio y del fabricante, y deben cargarse a mano. Este resumen deja claro
 * en el panel que falta, en lugar de que datos de relleno pasen por definitivos.
 */
export type ContentChecklist = {
  productsWithoutDescription: number;
  productsWithoutFeatures: number;
  productsWithoutStock: number;
  hasLogo: boolean;
  totalProducts: number;
  /** true cuando no queda nada pendiente. */
  ready: boolean;
};

export async function getContentChecklist(): Promise<ContentChecklist> {
  const [totalProducts, withoutDescription, withoutStock, logo, products] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, description: '' } }),
    prisma.product.count({ where: { active: true, stock: 0 } }),
    prisma.setting.findUnique({ where: { key: LOGO_SETTING_KEY } }),
    prisma.product.findMany({ where: { active: true }, select: { features: true } }),
  ]);

  // `features` es un array de Postgres; contar los vacios en SQL exigiria raw,
  // y el catalogo es pequeno.
  const withoutFeatures = products.filter((product) => product.features.length === 0).length;

  return {
    totalProducts,
    productsWithoutDescription: withoutDescription,
    productsWithoutFeatures: withoutFeatures,
    productsWithoutStock: withoutStock,
    hasLogo: Boolean(logo?.value),
    ready:
      withoutDescription === 0 && withoutFeatures === 0 && withoutStock === 0 && Boolean(logo?.value),
  };
}
