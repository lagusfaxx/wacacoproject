import { z } from 'zod';

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

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contrasena.').max(120),
});

export const shippingSchema = z.object({
  fullName: trimmed(3, 100, 'Ingresa el nombre de quien recibe.'),
  phone: trimmed(6, 30, 'Ingresa un telefono de contacto.'),
  line1: trimmed(4, 160, 'Ingresa la direccion.'),
  line2: optionalText(160),
  city: trimmed(2, 80, 'Ingresa la comuna o ciudad.'),
  region: trimmed(2, 80, 'Ingresa la region o estado.'),
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
  stock: z.coerce.number().int().min(0).max(1_000_000),
  weightGrams: z.coerce.number().int().min(0).max(100_000).default(500),
  active: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  isNew: z.coerce.boolean().default(false),
  award: optionalText(80),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  collectionIds: z.array(z.string()).default([]),
  images: optionalText(4000),
});

export const orderUpdateSchema = z.object({
  orderId: z.string().min(1).max(40),
  status: z.enum([
    'PENDING',
    'PAID',
    'IN_PROCESS',
    'PREPARING',
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
