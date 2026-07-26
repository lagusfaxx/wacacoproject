/**
 * Carga inicial de datos. Es idempotente: se puede ejecutar tantas veces como
 * haga falta (por ejemplo en cada deploy) sin duplicar registros.
 *
 *   npm run db:seed
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
  features: string[];
  specs: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  sku: string;
  stock: number;
  weightGrams: number;
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
    description:
      'Pixapresso calienta el agua y extrae el espresso en un solo movimiento. Su bateria recargable entrega hasta cuatro shots por carga y su pantalla LED muestra la temperatura en tiempo real. Compatible con cafe molido y con capsulas Nespresso Original gracias al adaptador incluido.',
    features: [
      'Calienta y extrae en un solo paso',
      'Bateria recargable USB-C para hasta 4 shots',
      'Compatible con cafe molido y capsulas Nespresso Original',
      'Pantalla LED con temperatura en tiempo real',
      'Presion de extraccion de 18 bares',
    ],
    specs: {
      Capacidad: '80 ml',
      Presion: '18 bares',
      Bateria: '7.4V / 3000 mAh',
      Carga: 'USB-C',
      Peso: '820 g',
      Dimensiones: '8.5 x 8.5 x 24.5 cm',
    },
    price: 149900,
    sku: 'WC-PIXA-001',
    stock: 42,
    weightGrams: 820,
    featured: true,
    position: 1,
    collections: ['powered-espresso-maker'],
    images: ['/products/pixapresso.svg', '/products/pixapresso-burgundy.svg'],
    variants: [
      { name: 'Grafito', colorHex: '#4A3B3B', sku: 'WC-PIXA-001-GRA', stock: 18, image: '/products/pixapresso.svg' },
      { name: 'Burdeo', colorHex: '#7C2C34', sku: 'WC-PIXA-001-BUR', stock: 14, image: '/products/pixapresso-burgundy.svg' },
      { name: 'Oliva', colorHex: '#6B7042', sku: 'WC-PIXA-001-OLI', stock: 10, image: '/products/pixapresso-olive.svg' },
    ],
  },
  {
    slug: 'picopresso',
    name: 'Picopresso',
    subtitle: 'Cafetera espresso manual nivel barista',
    description:
      'Picopresso lleva la extraccion manual al nivel de una maquina profesional: portafiltro sin fondo de 52 mm, canasta de precision y hasta 18 bares de presion generados a mano. Para quienes persiguen la crema perfecta en cualquier lugar.',
    features: [
      'Portafiltro sin fondo de 52 mm',
      'Hasta 18 bares de presion manual',
      'Canasta de precision para 18 g de cafe',
      'Estuche de viaje acolchado incluido',
      'Sin electricidad ni baterias',
    ],
    specs: {
      Capacidad: '80 ml',
      Presion: '18 bares',
      'Dosis de cafe': '18 g',
      Portafiltro: '52 mm sin fondo',
      Peso: '350 g',
      Dimensiones: '7.5 x 7.5 x 10.5 cm',
    },
    price: 119900,
    sku: 'WC-PICO-001',
    stock: 55,
    weightGrams: 350,
    featured: true,
    award: 'Red Dot Winner 2022',
    position: 2,
    collections: ['manual-espresso-makers'],
    images: ['/products/picopresso.svg'],
  },
  {
    slug: 'minipresso-gr2',
    name: 'Minipresso GR2',
    subtitle: 'Cafetera espresso portatil facil de usar',
    description:
      'La segunda generacion del clasico Minipresso para cafe molido. Mas compacta, con boton de bombeo rediseñado y una canasta que rinde una dosis pareja taza tras taza.',
    features: [
      'Disenada para cafe molido',
      'Sistema de bombeo semiautomatico mejorado',
      'Se desarma para limpiar en segundos',
      'Taza integrada en el cuerpo',
      'Sin electricidad ni baterias',
    ],
    specs: {
      Capacidad: '70 ml',
      'Dosis de cafe': '8 g',
      Presion: '8 bares',
      Peso: '360 g',
      Dimensiones: '7 x 7 x 16 cm',
    },
    price: 54900,
    compareAtPrice: 59900,
    sku: 'WC-MGR2-001',
    stock: 80,
    weightGrams: 360,
    featured: true,
    award: 'Red Dot Winner 2024',
    position: 3,
    collections: ['manual-espresso-makers'],
    images: ['/products/minipresso-gr2.svg'],
    variants: [
      { name: 'Verde oliva', colorHex: '#8A8C7A', sku: 'WC-MGR2-001-OLI', stock: 30 },
      { name: 'Naranjo', colorHex: '#E1580E', sku: 'WC-MGR2-001-NAR', stock: 26 },
      { name: 'Mostaza', colorHex: '#D9A441', sku: 'WC-MGR2-001-MOS', stock: 24 },
    ],
  },
  {
    slug: 'minipresso-ns2',
    name: 'Minipresso NS2',
    subtitle: 'Cafetera de capsulas facil de usar',
    description:
      'Compatible con capsulas Nespresso Original. Cargas la capsula, agregas agua caliente y bombeas: espresso con crema en menos de un minuto, sin enchufes ni cables.',
    features: [
      'Compatible con capsulas Nespresso Original',
      'Listo en menos de un minuto',
      'Taza integrada en el cuerpo',
      'Sin electricidad ni baterias',
      'Facil de limpiar bajo el grifo',
    ],
    specs: {
      Capacidad: '70 ml',
      Capsulas: 'Nespresso Original',
      Presion: '8 bares',
      Peso: '340 g',
      Dimensiones: '7 x 7 x 15 cm',
    },
    price: 54900,
    compareAtPrice: 59900,
    sku: 'WC-MNS2-001',
    stock: 76,
    weightGrams: 340,
    featured: true,
    award: 'Red Dot Winner 2023',
    position: 4,
    collections: ['manual-espresso-makers'],
    images: ['/products/minipresso-ns2.svg'],
  },
  {
    slug: 'nanopresso',
    name: 'Nanopresso',
    subtitle: 'El espresso manual mas vendido',
    description:
      'Nanopresso usa el sistema de bombeo patentado de Wacaco para alcanzar 18 bares con la mitad del esfuerzo de la generacion anterior. Es el punto de partida perfecto para el cafe portatil.',
    features: [
      'Hasta 18 bares con el nuevo sistema de bombeo',
      'Compatible con adaptadores NS y Barista Kit',
      'Cuerpo resistente a golpes',
      'Menor esfuerzo de bombeo',
      'Sin electricidad ni baterias',
    ],
    specs: {
      Capacidad: '80 ml',
      'Dosis de cafe': '8 g',
      Presion: '18 bares',
      Peso: '336 g',
      Dimensiones: '15.6 x 6.1 x 6.2 cm',
    },
    price: 79900,
    sku: 'WC-NANO-001',
    stock: 95,
    weightGrams: 336,
    featured: true,
    position: 5,
    collections: ['manual-espresso-makers'],
    images: ['/products/nanopresso.svg', '/products/nanopresso-red.svg'],
    variants: [
      { name: 'Negro', colorHex: '#2C2C2C', sku: 'WC-NANO-001-NEG', stock: 55 },
      { name: 'Rojo patrol', colorHex: '#B4342C', sku: 'WC-NANO-001-ROJ', stock: 40 },
    ],
  },
  {
    slug: 'prestina',
    name: 'Prestina',
    subtitle: 'Prensa de cafe sin embolo',
    description:
      'Prestina reinventa la prensa francesa: sin embolo, sin complejidad. Agregas cafe y agua, esperas, y el filtro integrado separa el sedimento cuando inclinas la taza. El sabor de la simplicidad.',
    features: [
      'Sin embolo: filtro integrado en la tapa',
      'Doble pared que mantiene la temperatura',
      'Apta para cafe y para infusiones',
      'Tapa a prueba de derrames',
      'Piezas aptas para lavavajillas',
    ],
    specs: {
      Capacidad: '300 ml',
      Material: 'Acero inoxidable 304',
      Aislacion: 'Doble pared al vacio',
      Peso: '310 g',
      Dimensiones: '8 x 8 x 18 cm',
    },
    price: 44900,
    sku: 'WC-PRES-001',
    stock: 120,
    weightGrams: 310,
    featured: true,
    isNew: true,
    position: 6,
    collections: ['coffee-makers'],
    images: ['/products/prestina.svg'],
  },
  {
    slug: 'pipamoka',
    name: 'Pipamoka',
    subtitle: 'Cafetera portatil al vacio',
    description:
      'Pipamoka usa presion negativa para extraer una taza intensa en menos de cuatro minutos. Todo el proceso ocurre dentro del termo, asi que preparas y bebes en el mismo recipiente.',
    features: [
      'Extraccion por presion al vacio',
      'Termo de acero con doble pared',
      'Prepara y bebe en el mismo recipiente',
      'Filtro metalico reutilizable',
      'Listo en menos de 4 minutos',
    ],
    specs: {
      Capacidad: '330 ml',
      Material: 'Acero inoxidable 304',
      'Dosis de cafe': '20 g',
      Peso: '415 g',
      Dimensiones: '7.4 x 7.4 x 21 cm',
    },
    price: 59900,
    sku: 'WC-PIPA-001',
    stock: 48,
    weightGrams: 415,
    position: 7,
    collections: ['coffee-makers'],
    images: ['/products/pipamoka.svg'],
  },
  {
    slug: 'cuppamoka',
    name: 'Cuppamoka',
    subtitle: 'Cafetera de filtro por goteo',
    description:
      'Un dripper de acero inoxidable sobre un vaso Tritan resistente. Cuppamoka arma un pour over completo en cualquier parte y guarda todas sus piezas dentro del vaso para transportarlo.',
    features: [
      'Dripper de acero inoxidable de malla fina',
      'Vaso Tritan resistente a impactos',
      'Todas las piezas se guardan dentro del vaso',
      'No necesita filtros de papel',
      'Tapa que conserva el calor',
    ],
    specs: {
      Capacidad: '300 ml',
      Material: 'Tritan y acero inoxidable',
      'Dosis de cafe': '20 g',
      Peso: '295 g',
      Dimensiones: '8.5 x 8.5 x 19 cm',
    },
    price: 39900,
    sku: 'WC-CUPP-001',
    stock: 64,
    weightGrams: 295,
    position: 8,
    collections: ['coffee-makers'],
    images: ['/products/cuppamoka.svg'],
  },
  {
    slug: 'octaroma',
    name: 'Octaroma',
    subtitle: 'Vaso termico de doble pared',
    description:
      'Octaroma mantiene el cafe caliente durante horas gracias a su aislacion al vacio de doble pared. Su tapa a rosca es a prueba de derrames y su base entra en cualquier portavasos.',
    features: [
      'Aislacion al vacio de doble pared',
      'Mantiene la temperatura hasta 6 horas',
      'Tapa a rosca a prueba de derrames',
      'Base compatible con portavasos',
      'Interior de acero inoxidable 304',
    ],
    specs: {
      Capacidad: '180 ml',
      Material: 'Acero inoxidable 304',
      Aislacion: 'Doble pared al vacio',
      Peso: '220 g',
      Dimensiones: '6.5 x 6.5 x 13 cm',
    },
    price: 34900,
    sku: 'WC-OCTA-001',
    stock: 140,
    weightGrams: 220,
    position: 9,
    collections: ['coffee-gear'],
    images: ['/products/octaroma.svg'],
  },
  {
    slug: 'nanovessel',
    name: 'NanoVessel',
    subtitle: 'Vaso termico para Nanopresso',
    description:
      'Reemplaza la taza original de Nanopresso por un vaso de acero con doble pared. Duplica la capacidad y mantiene el shot caliente mientras lo preparas.',
    features: [
      'Compatible con Nanopresso y Minipresso',
      'Doble capacidad frente a la taza original',
      'Acero inoxidable de doble pared',
      'Se enrosca directamente al cuerpo',
      'Apto para lavavajillas',
    ],
    specs: {
      Capacidad: '80 ml',
      Material: 'Acero inoxidable 304',
      Compatibilidad: 'Nanopresso / Minipresso',
      Peso: '135 g',
    },
    price: 29900,
    sku: 'WC-NVES-001',
    stock: 90,
    weightGrams: 135,
    position: 10,
    collections: ['coffee-gear'],
    images: ['/products/nanovessel.svg'],
  },
  {
    slug: 'barista-kit',
    name: 'Barista Kit',
    subtitle: 'Accesorio para doble shot',
    description:
      'El Barista Kit amplia la canasta de tu Nanopresso para preparar un doble espresso de 16 g. Incluye taza extendida y tapa de transporte.',
    features: [
      'Prepara un doble espresso de 16 g',
      'Taza extendida incluida',
      'Compatible con Nanopresso',
      'Acero inoxidable y plastico alimentario',
      'Se guarda dentro del propio kit',
    ],
    specs: {
      Capacidad: '140 ml',
      'Dosis de cafe': '16 g',
      Compatibilidad: 'Nanopresso',
      Peso: '180 g',
    },
    price: 24900,
    sku: 'WC-BKIT-001',
    stock: 110,
    weightGrams: 180,
    position: 11,
    collections: ['coffee-gear'],
    images: ['/products/barista-kit.svg'],
  },
  {
    slug: 'travel-case',
    name: 'Travel Case',
    subtitle: 'Estuche de transporte acolchado',
    description:
      'Estuche rigido con interior acolchado y compartimentos para tu cafetera, el cafe molido y los accesorios. Cierre con cremallera y asa de transporte.',
    features: [
      'Interior acolchado con compartimentos',
      'Exterior resistente al agua',
      'Cierre con cremallera reforzada',
      'Compatible con toda la linea Wacaco',
      'Asa de transporte',
    ],
    specs: {
      Material: 'EVA y poliester 600D',
      Compatibilidad: 'Linea completa Wacaco',
      Peso: '160 g',
      Dimensiones: '19 x 10 x 9 cm',
    },
    price: 19900,
    sku: 'WC-CASE-001',
    stock: 150,
    weightGrams: 160,
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
      update: {
        name: data.name,
        subtitle: data.subtitle,
        description: data.description,
        features: data.features,
        specs: data.specs,
        price: data.price,
        compareAtPrice: data.compareAtPrice ?? null,
        sku: data.sku,
        weightGrams: data.weightGrams,
        featured: data.featured ?? false,
        isNew: data.isNew ?? false,
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
    'store.announcement':
      'Envio gratis en compras sobre $60.000 - Despacho a todo Chile en 24/48 h',
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
