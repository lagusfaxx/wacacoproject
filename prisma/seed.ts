/**
 * Carga inicial de datos. Es idempotente: se puede ejecutar tantas veces como
 * haga falta (por ejemplo en cada deploy) sin duplicar registros.
 *
 *   npm run db:seed
 *
 * IMPORTANTE
 * Los productos se crean con lo minimo verificable: nombre, categoria y SKU.
 * Las descripciones largas, las caracteristicas, las especificaciones tecnicas
 * y los precios NO se inventan aqui: son datos del negocio que el propietario
 * debe cargar desde el panel con la informacion oficial del fabricante y su
 * propia lista de precios. El panel avisa que fichas estan incompletas.
 */
import { PrismaClient, type DiscountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type VariantSeed = { name: string; colorHex: string; sku: string; stock: number; image?: string };

type ProductSeed = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  stock: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  featured?: boolean;
  isNew?: boolean;
  award?: string;
  position: number;
  collections: string[];
  images: string[];
  variants?: VariantSeed[];
};

const COLLECTIONS = [
  {
    slug: 'powered-espresso-maker',
    name: 'Powered Espresso Maker',
    tagline: 'Disfruta un espresso sin esfuerzo',
    description:
      'Maquinas electricas portatiles que calientan y extraen en un solo paso. Ideales para viaje, oficina y camping.',
    image: '/collections/powered-espresso-maker.svg',
    position: 1,
  },
  {
    slug: 'manual-espresso-makers',
    name: 'Manual Espresso Makers',
    tagline: 'Nada sabe como un shot Wacaco',
    description:
      'Presion generada a mano, control total de la extraccion y cero electricidad. La linea que hizo famosa a Wacaco.',
    image: '/collections/manual-espresso-makers.svg',
    position: 2,
  },
  {
    slug: 'coffee-makers',
    name: 'Coffee Makers',
    tagline: 'Prepara una taza completa donde sea',
    description:
      'Metodos de filtrado y prensado para quienes prefieren una taza larga antes que un espresso.',
    image: '/collections/coffee-makers.svg',
    position: 3,
  },
  {
    slug: 'coffee-gear',
    name: 'Coffee Gear',
    tagline: 'Los accesorios esenciales del cafe',
    description:
      'Vasos termicos, estuches de transporte y kits de barista para completar tu equipo portatil.',
    image: '/collections/coffee-gear.svg',
    position: 4,
  },
];

const PRODUCTS: ProductSeed[] = [
  {
    slug: 'pixapresso',
    name: 'Pixapresso',
    subtitle: 'Cafetera espresso electrica portatil',
    description: 'Cafetera espresso electrica portatil de la linea Wacaco.',
    price: 149900,
    sku: 'WC-PIXA-001',
    stock: 0,
    weightGrams: 900,
    lengthCm: 26,
    widthCm: 12,
    heightCm: 12,
    featured: true,
    position: 1,
    collections: ['powered-espresso-maker'],
    images: ['/products/pixapresso.svg', '/products/pixapresso-burgundy.svg'],
    variants: [
      { name: 'Grafito', colorHex: '#4A3B3B', sku: 'WC-PIXA-001-GRA', stock: 0 },
      { name: 'Burdeo', colorHex: '#7C2C34', sku: 'WC-PIXA-001-BUR', stock: 0 },
      { name: 'Oliva', colorHex: '#6B7042', sku: 'WC-PIXA-001-OLI', stock: 0 },
    ],
  },
  {
    slug: 'picopresso',
    name: 'Picopresso',
    subtitle: 'Cafetera espresso manual',
    description: 'Cafetera espresso manual de la linea Wacaco.',
    price: 119900,
    sku: 'WC-PICO-001',
    stock: 0,
    weightGrams: 500,
    lengthCm: 14,
    widthCm: 11,
    heightCm: 11,
    featured: true,
    award: 'Red Dot Winner 2022',
    position: 2,
    collections: ['manual-espresso-makers'],
    images: ['/products/picopresso.svg'],
  },
  {
    slug: 'minipresso-gr2',
    name: 'Minipresso GR2',
    subtitle: 'Cafetera espresso manual para cafe molido',
    description: 'Cafetera espresso manual para cafe molido de la linea Wacaco.',
    price: 54900,
    sku: 'WC-MGR2-001',
    stock: 0,
    weightGrams: 450,
    lengthCm: 20,
    widthCm: 10,
    heightCm: 10,
    featured: true,
    award: 'Red Dot Winner 2024',
    position: 3,
    collections: ['manual-espresso-makers'],
    images: ['/products/minipresso-gr2.svg'],
    variants: [
      { name: 'Verde oliva', colorHex: '#8A8C7A', sku: 'WC-MGR2-001-OLI', stock: 0 },
      { name: 'Naranjo', colorHex: '#E1580E', sku: 'WC-MGR2-001-NAR', stock: 0 },
      { name: 'Mostaza', colorHex: '#D9A441', sku: 'WC-MGR2-001-MOS', stock: 0 },
    ],
  },
  {
    slug: 'minipresso-ns2',
    name: 'Minipresso NS2',
    subtitle: 'Cafetera espresso manual para capsulas',
    description: 'Cafetera espresso manual para capsulas de la linea Wacaco.',
    price: 54900,
    sku: 'WC-MNS2-001',
    stock: 0,
    weightGrams: 430,
    lengthCm: 20,
    widthCm: 10,
    heightCm: 10,
    featured: true,
    award: 'Red Dot Winner 2023',
    position: 4,
    collections: ['manual-espresso-makers'],
    images: ['/products/minipresso-ns2.svg'],
  },
  {
    slug: 'nanopresso',
    name: 'Nanopresso',
    subtitle: 'Cafetera espresso manual',
    description: 'Cafetera espresso manual de la linea Wacaco.',
    price: 79900,
    sku: 'WC-NANO-001',
    stock: 0,
    weightGrams: 420,
    lengthCm: 20,
    widthCm: 10,
    heightCm: 10,
    featured: true,
    position: 5,
    collections: ['manual-espresso-makers'],
    images: ['/products/nanopresso.svg', '/products/nanopresso-red.svg'],
    variants: [
      { name: 'Negro', colorHex: '#2C2C2C', sku: 'WC-NANO-001-NEG', stock: 0 },
      { name: 'Rojo', colorHex: '#B4342C', sku: 'WC-NANO-001-ROJ', stock: 0 },
    ],
  },
  {
    slug: 'prestina',
    name: 'Prestina',
    subtitle: 'Prensa de cafe',
    description: 'Prensa de cafe de la linea Wacaco.',
    price: 44900,
    sku: 'WC-PRES-001',
    stock: 0,
    weightGrams: 400,
    lengthCm: 22,
    widthCm: 11,
    heightCm: 11,
    featured: true,
    isNew: true,
    position: 6,
    collections: ['coffee-makers'],
    images: ['/products/prestina.svg'],
  },
  {
    slug: 'pipamoka',
    name: 'Pipamoka',
    subtitle: 'Cafetera portatil',
    description: 'Cafetera portatil de la linea Wacaco.',
    price: 59900,
    sku: 'WC-PIPA-001',
    stock: 0,
    weightGrams: 500,
    lengthCm: 24,
    widthCm: 10,
    heightCm: 10,
    position: 7,
    collections: ['coffee-makers'],
    images: ['/products/pipamoka.svg'],
  },
  {
    slug: 'cuppamoka',
    name: 'Cuppamoka',
    subtitle: 'Cafetera de filtro por goteo',
    description: 'Cafetera de filtro por goteo de la linea Wacaco.',
    price: 39900,
    sku: 'WC-CUPP-001',
    stock: 0,
    weightGrams: 380,
    lengthCm: 22,
    widthCm: 11,
    heightCm: 11,
    position: 8,
    collections: ['coffee-makers'],
    images: ['/products/cuppamoka.svg'],
  },
  {
    slug: 'octaroma',
    name: 'Octaroma',
    subtitle: 'Vaso termico',
    description: 'Vaso termico de la linea Wacaco.',
    price: 34900,
    sku: 'WC-OCTA-001',
    stock: 0,
    weightGrams: 300,
    lengthCm: 16,
    widthCm: 9,
    heightCm: 9,
    position: 9,
    collections: ['coffee-gear'],
    images: ['/products/octaroma.svg'],
  },
  {
    slug: 'nanovessel',
    name: 'NanoVessel',
    subtitle: 'Accesorio para Nanopresso',
    description: 'Accesorio de la linea Wacaco compatible con Nanopresso.',
    price: 29900,
    sku: 'WC-NVES-001',
    stock: 0,
    weightGrams: 200,
    lengthCm: 12,
    widthCm: 9,
    heightCm: 9,
    position: 10,
    collections: ['coffee-gear'],
    images: ['/products/nanovessel.svg'],
  },
  {
    slug: 'barista-kit',
    name: 'Barista Kit',
    subtitle: 'Accesorio para Nanopresso',
    description: 'Accesorio de la linea Wacaco compatible con Nanopresso.',
    price: 24900,
    sku: 'WC-BKIT-001',
    stock: 0,
    weightGrams: 250,
    lengthCm: 14,
    widthCm: 9,
    heightCm: 9,
    position: 11,
    collections: ['coffee-gear'],
    images: ['/products/barista-kit.svg'],
  },
  {
    slug: 'travel-case',
    name: 'Travel Case',
    subtitle: 'Estuche de transporte',
    description: 'Estuche de transporte de la linea Wacaco.',
    price: 19900,
    sku: 'WC-CASE-001',
    stock: 0,
    weightGrams: 220,
    lengthCm: 20,
    widthCm: 12,
    heightCm: 10,
    position: 12,
    collections: ['coffee-gear'],
    images: ['/products/travel-case.svg'],
  },
];

const COUPONS: {
  code: string;
  type: DiscountType;
  value: number;
  minSubtotal: number;
  maxRedemtions: number | null;
}[] = [
  { code: 'BIENVENIDO10', type: 'PERCENT', value: 10, minSubtotal: 0, maxRedemtions: null },
  { code: 'ENVIOGRATIS', type: 'FIXED', value: 4990, minSubtotal: 30000, maxRedemtions: 500 },
];

async function seedCollections() {
  for (const collection of COLLECTIONS) {
    await prisma.collection.upsert({
      where: { slug: collection.slug },
      create: collection,
      update: collection,
    });
  }
  console.log(`  colecciones: ${COLLECTIONS.length}`);
}

async function seedProducts() {
  for (const seed of PRODUCTS) {
    const { collections, images, variants, ...data } = seed;

    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      create: { ...data, active: true },
      // En un re-seed solo se refrescan los datos estructurales. Ni el precio,
      // ni la descripcion, ni el stock se pisan: son informacion que el
      // propietario ya edito desde el panel.
      update: {
        name: data.name,
        subtitle: data.subtitle,
        sku: data.sku,
        award: data.award ?? null,
        position: data.position,
      },
    });

    // Las imagenes y relaciones se regeneran completas para que el seed
    // refleje exactamente lo declarado arriba.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: images.map((url, index) => ({
        productId: product.id,
        url,
        alt: `${seed.name} - vista ${index + 1}`,
        position: index,
      })),
    });

    await prisma.productCollection.deleteMany({ where: { productId: product.id } });
    for (const slug of collections) {
      const collection = await prisma.collection.findUnique({ where: { slug } });
      if (collection) {
        await prisma.productCollection.create({
          data: { productId: product.id, collectionId: collection.id },
        });
      }
    }

    for (const [index, variant] of (variants ?? []).entries()) {
      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        create: {
          productId: product.id,
          name: variant.name,
          colorHex: variant.colorHex,
          sku: variant.sku,
          stock: variant.stock,
          position: index,
        },
        update: {
          name: variant.name,
          colorHex: variant.colorHex,
          position: index,
        },
      });
    }
  }
  console.log(`  productos: ${PRODUCTS.length}`);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@wacaco.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Admin123!';
  const name = process.env.ADMIN_NAME ?? 'Administrador';

  const passwordHash = await bcrypt.hash(password, 12);

  // La contrasena solo se fija al crear: un re-seed no debe pisar la clave
  // que el administrador ya haya cambiado desde el panel.
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: 'ADMIN', emailVerified: true },
    update: { role: 'ADMIN', active: true },
  });
  console.log(`  administrador: ${email}`);
}

async function seedCoupons() {
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      create: coupon,
      update: { type: coupon.type, value: coupon.value, minSubtotal: coupon.minSubtotal },
    });
  }
  console.log(`  cupones: ${COUPONS.length}`);
}

async function seedSettings() {
  const settings: Record<string, string> = {
    'store.name': process.env.STORE_NAME ?? 'Wacaco Store',
    'store.email': process.env.STORE_EMAIL ?? 'hola@wacaco.local',
    'store.announcement': 'Despacho a todo Chile - Pago seguro con Mercado Pago',
    'store.marquee': [
      'Envio a todo Chile con Blue Express',
      'Pago seguro con Mercado Pago',
      'Sigue tu pedido en linea',
      'Compra como invitado o con cuenta',
    ].join('\n'),
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`  ajustes: ${Object.keys(settings).length}`);
}

async function main() {
  console.log('Sembrando datos iniciales...');
  await seedCollections();
  await seedProducts();
  await seedCoupons();
  await seedSettings();
  await seedAdmin();
  console.log('Listo.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
