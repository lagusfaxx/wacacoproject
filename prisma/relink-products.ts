/**
 * Actualiza los enlaces guardados en la base de datos despues de cambiar la
 * ruta del catalogo de `/productos` a `/products`.
 *
 *   npm run db:relink
 *
 * El codigo ya apunta a la ruta nueva, pero los destinos que el propietario
 * escribio desde el panel (enlaces del menu y botones de los banners) viven en
 * la base de datos y seguirian apuntando a la ruta vieja. Es idempotente: se
 * puede correr las veces que haga falta.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD = '/productos';
const NEW = '/products';

/** Solo el prefijo de ruta, para no tocar un `/admin/productos` ni un texto. */
function relink(href: string): string {
  return href === OLD || href.startsWith(`${OLD}/`) || href.startsWith(`${OLD}?`)
    ? NEW + href.slice(OLD.length)
    : href;
}

async function main() {
  const [menuItems, banners] = await Promise.all([
    prisma.menuItem.findMany({ select: { id: true, href: true } }),
    prisma.banner.findMany({ select: { id: true, ctaHref: true } }),
  ]);

  let updatedMenu = 0;
  for (const item of menuItems) {
    const href = relink(item.href);
    if (href === item.href) continue;
    await prisma.menuItem.update({ where: { id: item.id }, data: { href } });
    updatedMenu += 1;
  }

  let updatedBanners = 0;
  for (const banner of banners) {
    if (!banner.ctaHref) continue;
    const ctaHref = relink(banner.ctaHref);
    if (ctaHref === banner.ctaHref) continue;
    await prisma.banner.update({ where: { id: banner.id }, data: { ctaHref } });
    updatedBanners += 1;
  }

  console.log(
    `Enlaces actualizados: ${updatedMenu} del menu y ${updatedBanners} de banners.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
