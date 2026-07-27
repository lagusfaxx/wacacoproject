'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser, hashPassword, verifyPassword, writeAuditLog } from '@/lib/auth';
import { regionName } from '@/lib/regions-cl';
import { fieldErrors, passwordSchema, shippingSchema } from '@/lib/validation';
import { z } from 'zod';

export type AccountState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
  errors: Record<string, string>;
};

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre.').max(80),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

export async function updateProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Tu sesion expiro.', errors: {} };

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Revisa los datos.', errors: fieldErrors(parsed.error) };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });

  revalidatePath('/cuenta');
  revalidatePath('/cuenta/datos');
  revalidatePath('/', 'layout');
  return { status: 'ok', message: 'Datos actualizados.', errors: {} };
}

export async function saveAddress(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Tu sesion expiro.', errors: {} };

  const parsed = shippingSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    line1: formData.get('line1'),
    line2: formData.get('line2'),
    city: formData.get('city'),
    regionCode: formData.get('regionCode'),
    postalCode: formData.get('postalCode'),
    country: formData.get('country') || 'CL',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los datos de la direccion.',
      errors: fieldErrors(parsed.error),
    };
  }

  const data = {
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    line1: parsed.data.line1,
    line2: parsed.data.line2 || null,
    city: parsed.data.city,
    region: regionName(parsed.data.regionCode),
    regionCode: parsed.data.regionCode,
    postalCode: parsed.data.postalCode || '',
    country: parsed.data.country,
    isDefault: true,
  };

  const existing = await prisma.address.findFirst({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  if (existing) {
    await prisma.address.update({ where: { id: existing.id }, data });
  } else {
    await prisma.address.create({ data: { ...data, userId: user.id } });
  }

  revalidatePath('/cuenta');
  revalidatePath('/cuenta/direccion');
  return { status: 'ok', message: 'Direccion guardada.', errors: {} };
}

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contrasena actual.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden.',
    path: ['confirmPassword'],
  });

export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Tu sesion expiro.', errors: {} };

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Revisa los datos.', errors: fieldErrors(parsed.error) };
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return {
      status: 'error',
      message: 'La contrasena actual no es correcta.',
      errors: { currentPassword: 'Contrasena incorrecta.' },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'auth.password_changed',
    entity: 'User',
    entityId: user.id,
  });

  return { status: 'ok', message: 'Contrasena actualizada.', errors: {} };
}
