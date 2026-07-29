import { z } from 'zod';
import { isValidRegionCode } from './regions-cl';

const trimmed = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, `Maximo ${max} caracteres.`);

/**
 * Campo de texto opcional tolerante a `null`.
 *
 * `FormData.get()` devuelve `null` cuando el campo no existe en el formulario
 * (por ejemplo un cupon que solo se aplica desde el carrito), y `null` no es
 * lo mismo que `undefined` para zod. Normalizarlo aqui evita que un formulario
 * valido se rechace por un campo que nunca se envio.
 */
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? '' : value),
    z.string().trim().max(max, `Maximo ${max} caracteres.`),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ingresa un correo electronico valido.')
  .max(180);

export const passwordSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres.')
  .max(120, 'La contrasena es demasiado larga.')
  .regex(/[a-z]/, 'Incluye al menos una letra minuscula.')
  .regex(/[A-Z]/, 'Incluye al menos una letra mayuscula.')
  .regex(/[0-9]/, 'Incluye al menos un numero.');

export const registerSchema = z
  .object({
    name: trimmed(2, 80, 'Ingresa tu nombre.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    phone: optionalText(30),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden.',
    path: ['confirmPassword'],
  });

/** Codigo de un solo uso: seis digitos, tolerando espacios o guiones. */
export const verificationCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 6, 'El codigo tiene seis digitos.');

export const confirmEmailSchema = z.object({
  code: verificationCodeSchema,
});

export const passwordResetSchema = z
  .object({
    email: emailSchema,
    code: verificationCodeSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contrasena.').max(120),
});

export const shippingSchema = z.object({
  fullName: trimmed(3, 100, 'Ingresa el nombre de quien recibe.'),
  phone: trimmed(6, 30, 'Ingresa un telefono de contacto.'),
  line1: trimmed(4, 160, 'Ingresa la direccion.'),
  line2: optionalText(160),
  city: trimmed(2, 80, 'Ingresa tu comuna.'),
  /// Se pide el codigo ISO de la region porque es lo que espera el cotizador
  /// de Blue Express; el nombre visible se deriva de el.
  regionCode: z
    .string()
    .trim()
    .refine(isValidRegionCode, 'Selecciona tu region.'),
  postalCode: optionalText(20),
  country: z.preprocess(
    (value) => (value === null || value === undefined || value === '' ? 'CL' : value),
    z.string().trim().length(2),
  ),
  notes: optionalText(500),
});

export const checkoutSchema = shippingSchema.extend({
  email: emailSchema,
  couponCode: optionalText(40),
});

/**
 * Checkout con retiro en tienda.
 *
 * No se pide direccion porque no hay nada que despachar: solo quien retira,
 * como ubicarlo y el correo donde avisarle que el pedido esta listo. Pedir una
 * direccion que nadie va a usar solo agrega pasos para abandonar la compra.
 */
export const pickupCheckoutSchema = z.object({
  fullName: trimmed(3, 100, 'Ingresa el nombre de quien retira.'),
  phone: trimmed(6, 30, 'Ingresa un telefono de contacto.'),
  email: emailSchema,
  notes: optionalText(500),
  couponCode: optionalText(40),
});

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const quantitySchema = z.object({
  itemId: z.string().min(1).max(40),
  quantity: z.coerce.number().int().min(0).max(99),
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Variante de un producto (color o version).
 *
 * `id` viene vacio en las filas que el propietario acaba de agregar en el
 * panel: son las que hay que crear. `priceDelta` se suma al precio base, y
 * admite negativos para vender una version mas barata.
 */
export const productVariantSchema = z.object({
  id: optionalText(40),
  name: trimmed(1, 80, 'Ingresa el nombre de la variante.'),
  colorHex: z.preprocess(
    (value) => (value === null || value === undefined ? '' : value),
    z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color en formato #RRGGBB.'),
    ]),
  ),
  sku: trimmed(2, 60, 'Ingresa el SKU de la variante.'),
  priceDelta: z.coerce.number().min(-99_999_999).max(99_999_999).default(0),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  active: z.coerce.boolean().default(true),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

/**
 * Bloque de contenido bajo la ficha del producto.
 *
 * Todos los campos de texto son opcionales porque cada tipo de bloque usa
 * unos pocos: la franja de fotos no lleva titular y el video no lleva
 * galeria. Un bloque que quedo vacio no se guarda, de eso se encarga la
 * accion que lo persiste.
 */
export const productBlockSchema = z.object({
  id: optionalText(40),
  kind: z.enum(['gallery', 'story', 'video', 'split']).default('story'),
  eyebrow: optionalText(120),
  title: optionalText(160),
  body: optionalText(2000),
  image: optionalText(500),
  images: z.array(z.string().trim().max(500)).max(12).default([]),
  video: optionalText(500),
  theme: z.enum(['dark', 'light', 'sand']).default('dark'),
  imageSize: z.enum(['sm', 'md', 'lg']).catch('md').default('md'),
  imageSide: z.enum(['auto', 'left', 'right']).catch('auto').default('auto'),
  imageFit: z.enum(['cover', 'contain']).catch('cover').default('cover'),
  ctaLabel: optionalText(60),
  ctaHref: optionalText(300),
  active: z.coerce.boolean().default(true),
});

export type ProductBlockInput = z.infer<typeof productBlockSchema>;

export const productSchema = z.object({
  name: trimmed(2, 120, 'Ingresa el nombre del producto.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(slugPattern, 'El slug solo admite minusculas, numeros y guiones.'),
  subtitle: optionalText(160),
  description: optionalText(6000),
  features: optionalText(3000),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.').max(99_999_999),
  compareAtPrice: z.coerce.number().min(0).max(99_999_999).optional().nullable(),
  sku: trimmed(2, 60, 'Ingresa un SKU.'),
  /** Codigo de barras: solo digitos, y de los largos que existen de verdad. */
  gtin: z
    .string()
    .trim()
    .max(14)
    .refine(
      (value) => value === '' || /^\d{8}$|^\d{12,14}$/.test(value),
      'El codigo de barras debe tener 8, 12, 13 o 14 digitos.',
    )
    .default(''),
  brand: optionalText(80),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  weightGrams: z.coerce.number().int().min(0).max(100_000).default(500),
  lengthCm: z.coerce.number().int().min(1).max(200).default(20),
  widthCm: z.coerce.number().int().min(1).max(200).default(12),
  heightCm: z.coerce.number().int().min(1).max(200).default(12),
  active: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  isNew: z.coerce.boolean().default(false),
  incoming: z.coerce.boolean().default(false),
  award: optionalText(80),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  collectionIds: z.array(z.string()).default([]),
  images: z.array(z.string().trim().max(500)).default([]),
  variants: z.array(productVariantSchema).max(24, 'Maximo 24 variantes.').default([]),
  blocks: z.array(productBlockSchema).max(12, 'Maximo 12 bloques de contenido.').default([]),
  // SEO por ficha. Se permite pasarse del limite recomendado: Google recorta,
  // no rechaza, y bloquear al usuario por dos caracteres es peor.
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
  seoImage: optionalText(500),
  noIndex: z.coerce.boolean().default(false),
});

export const collectionSchema = z.object({
  name: trimmed(2, 120, 'Ingresa el nombre de la coleccion.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(slugPattern, 'El slug solo admite minusculas, numeros y guiones.'),
  tagline: optionalText(160),
  description: optionalText(2000),
  image: optionalText(500),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.coerce.boolean().default(true),
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
  seoImage: optionalText(500),
  noIndex: z.coerce.boolean().default(false),
});

export const orderUpdateSchema = z.object({
  orderId: z.string().min(1).max(40),
  status: z.enum([
    'PENDING',
    'PAID',
    'IN_PROCESS',
    'PREPARING',
    'READY_FOR_PICKUP',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
    'FAILED',
  ]),
  carrier: optionalText(80),
  trackingNumber: optionalText(80),
  trackingUrl: z.preprocess(
    (value) => (value === null || value === undefined ? '' : value),
    z.union([z.literal(''), z.string().trim().url('Ingresa una URL valida.').max(400)]),
  ),
  message: optionalText(500),
});

export const bannerSchema = z.object({
  placement: z.enum(['hero', 'destacado', 'inferior']).catch('hero'),
  eyebrow: optionalText(60),
  title: optionalText(80),
  subtitle: optionalText(200),
  ctaLabel: optionalText(40),
  ctaHref: optionalText(300),
  image: optionalText(500),
  video: optionalText(500),
  imageMode: z.enum(['background', 'side', 'split', 'splitLeft']).catch('background'),
  overlay: z.enum(['none', 'soft', 'medium', 'strong']).catch('medium'),
  background: optionalText(300),
  subtitleBold: z.coerce.boolean().default(false),
  position: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(true),
});

export const productStripSchema = z.object({
  title: trimmed(1, 60, 'Ingresa el titulo de la tira.'),
  placement: z.enum(['destacado', 'inferior']).catch('destacado'),
  position: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(true),
});

export const menuItemSchema = z.object({
  label: trimmed(1, 40, 'Ingresa el texto del enlace.'),
  href: trimmed(1, 300, 'Ingresa la direccion.'),
  position: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(true),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'El codigo debe tener al menos 3 caracteres.')
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Solo letras mayusculas, numeros, guion y guion bajo.'),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.coerce.number().min(0.01, 'El valor debe ser mayor a cero.').max(99_999_999),
  minSubtotal: z.coerce.number().min(0).max(99_999_999).default(0),
  maxRedemtions: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  active: z.coerce.boolean().default(true),
});

/**
 * Enlace que el propietario escribe en el panel (menu, banner, boton de un
 * bloque). Solo se aceptan rutas internas o URLs http(s) completas: devuelve
 * cadena vacia para cualquier otra cosa, de modo que un `javascript:` nunca
 * llega a un atributo href.
 */
export function safeHref(value: string): string {
  const href = value.trim();
  if (!href) return '';
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return '';
}

/** Convierte errores de zod al formato usado por los formularios. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.errors) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
