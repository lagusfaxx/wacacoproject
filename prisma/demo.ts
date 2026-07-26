/**
 * Carga datos de DEMOSTRACION para poder recorrer la tienda completa antes de
 * tener el inventario real.
 *
 *   npm run db:demo
 *
 * Pone stock ficticio en todos los productos activos. NO usar en la tienda de
 * produccion: el stock debe reflejar lo que hay realmente en bodega, si no se
 * venden unidades que no existen.
 *
 * Para volver al estado seguro:
 *
 *   npm run db:demo -- --reset
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_STOCK = 25;
const reset = process.argv.includes('--reset');

async function main() {
  const stock = reset ? 0 : DEMO_STOCK;

  const products = await prisma.product.updateMany({ data: { stock } });
  const variants = await prisma.productVariant.updateMany({ data: { stock } });

  console.log(
    reset
      ? `Stock puesto en 0 en ${products.count} productos y ${variants.count} variantes.`
      : `Stock de demostracion (${DEMO_STOCK}) cargado en ${products.count} productos y ${variants.count} variantes.`,
  );

  if (!reset) {
    console.log('Recuerda ajustar el stock real desde el panel antes de vender.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
