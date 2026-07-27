'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  createSession,
  getClientIp,
  hashPassword,
  verifyPassword,
  writeAuditLog,
} from '@/lib/auth';
import { notifyVerificationCode } from '@/lib/email/notifications';
import { issueCode } from '@/lib/verification';
import { rateLimit } from '@/lib/rate-limit';
import { fieldErrors, loginSchema, registerSchema } from '@/lib/validation';

export type AuthState = {
  status: 'idle' | 'error';
  message: string;
  errors: Record<string, string>;
};

/** Solo se aceptan rutas internas para evitar redirecciones abiertas. */
function safeRedirect(value: FormDataEntryValue | null, fallback: string): string {
  const target = String(value ?? '');
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  return fallback;
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los datos ingresados.',
      errors: fieldErrors(parsed.error),
    };
  }

  const ip = await getClientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 20, 60 * 15),
    rateLimit(`login:email:${parsed.data.email}`, 8, 60 * 15),
  ]);

  if (!byIp.ok || !byEmail.ok) {
    return {
      status: 'error',
      message: 'Demasiados intentos fallidos. Intenta nuevamente en unos minutos.',
      errors: {},
    };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // El mismo mensaje para usuario inexistente y clave incorrecta evita
  // revelar que correos estan registrados.
  const genericError: AuthState = {
    status: 'error',
    message: 'Correo o contrasena incorrectos.',
    errors: {},
  };

  if (!user || !user.active) {
    // Se ejecuta un hash igualmente para no filtrar informacion por el tiempo
    // de respuesta.
    await hashPassword(parsed.data.password);
    return genericError;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return genericError;

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  await writeAuditLog({ userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });

  const next = safeRedirect(formData.get('next'), user.role === 'ADMIN' ? '/admin' : '/cuenta');
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    phone: formData.get('phone'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los datos marcados.',
      errors: fieldErrors(parsed.error),
    };
  }

  const ip = await getClientIp();
  const limit = await rateLimit(`register:${ip}`, 5, 60 * 30);
  if (!limit.ok) {
    return {
      status: 'error',
      message: 'Demasiadas cuentas creadas desde esta conexion. Intenta mas tarde.',
      errors: {},
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return {
      status: 'error',
      message: 'Ya existe una cuenta con ese correo.',
      errors: { email: 'Este correo ya esta registrado.' },
    };
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      passwordHash: await hashPassword(parsed.data.password),
      // El rol siempre se fija en el servidor: nunca se toma del formulario.
      role: 'CUSTOMER',
    },
  });

  await createSession(user);
  await writeAuditLog({ userId: user.id, action: 'auth.register', entity: 'User', entityId: user.id });

  // El codigo se envia al crear la cuenta, pero no se obliga a confirmarlo
  // para seguir comprando: la pagina de verificacion deja continuar.
  const { code, minutes } = await issueCode(user.email, 'EMAIL_VERIFICATION');
  await notifyVerificationCode({ email: user.email, name: user.name, code, minutes }).catch(
    (error) => {
      console.error('[auth] no se pudo enviar el codigo de verificacion', error);
    },
  );

  const next = safeRedirect(formData.get('next'), '/cuenta');
  revalidatePath('/', 'layout');
  redirect(`/cuenta/verificar?next=${encodeURIComponent(next)}`);
}
