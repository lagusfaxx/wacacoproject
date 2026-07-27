'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getClientIp, getCurrentUser, hashPassword, writeAuditLog } from '@/lib/auth';
import { notifyPasswordReset, notifyVerificationCode } from '@/lib/email/notifications';
import { rateLimit } from '@/lib/rate-limit';
import { consumeCode, issueCode, type CodeCheck } from '@/lib/verification';
import { emailSchema, fieldErrors, passwordResetSchema, confirmEmailSchema } from '@/lib/validation';

/**
 * Confirmacion de correo y recuperacion de contrasena.
 *
 * Las dos usan el mismo codigo de seis digitos (`lib/verification.ts`) y la
 * misma regla al responder: nunca se revela si un correo esta registrado. Ese
 * dato es el primer paso de cualquier ataque a cuentas ajenas.
 */

export type VerificationState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
  errors: Record<string, string>;
  /** El formulario de recuperacion avanza a pedir el codigo. */
  step?: 'request' | 'confirm';
};

const idle: VerificationState = { status: 'idle', message: '', errors: {} };

function messageFor(check: Exclude<CodeCheck, { ok: true }>): string {
  switch (check.reason) {
    case 'expired':
      return 'El codigo vencio. Pide uno nuevo.';
    case 'too_many_attempts':
      return 'Demasiados intentos con ese codigo. Pide uno nuevo.';
    case 'not_found':
      return 'No hay un codigo pendiente. Pide uno nuevo.';
    default:
      return 'El codigo no es correcto. Revisalo e intenta de nuevo.';
  }
}

// ---------------------------------------------------------------------------
// Confirmar el correo de la cuenta
// ---------------------------------------------------------------------------

/** Envia (o reenvia) el codigo al correo de la sesion activa. */
export async function sendEmailVerification(): Promise<VerificationState> {
  const user = await getCurrentUser();
  if (!user) {
    return { ...idle, status: 'error', message: 'Inicia sesion para confirmar tu correo.' };
  }
  if (user.emailVerified) {
    return { ...idle, status: 'ok', message: 'Tu correo ya estaba confirmado.' };
  }

  const limit = await rateLimit(`verify:send:${user.id}`, 5, 60 * 30);
  if (!limit.ok) {
    return {
      ...idle,
      status: 'error',
      message: 'Ya pediste varios codigos. Espera unos minutos antes de pedir otro.',
    };
  }

  const { code, minutes } = await issueCode(user.email, 'EMAIL_VERIFICATION');
  const sent = await notifyVerificationCode({
    email: user.email,
    name: user.name,
    code,
    minutes,
  });

  if (sent.outcome === 'failed' || sent.outcome === 'skipped') {
    return {
      ...idle,
      status: 'error',
      message:
        'No pudimos enviar el codigo en este momento. Intenta de nuevo en unos minutos o escribenos.',
    };
  }

  return {
    ...idle,
    status: 'ok',
    message: `Te enviamos un codigo a ${user.email}. Vence en ${minutes} minutos.`,
  };
}

/** Version para `useActionState`, que siempre recibe el estado previo. */
export async function resendEmailVerification(
  _prev: VerificationState,
  _formData: FormData,
): Promise<VerificationState> {
  return sendEmailVerification();
}

export async function confirmEmailVerification(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const user = await getCurrentUser();
  if (!user) {
    return { ...idle, status: 'error', message: 'Inicia sesion para confirmar tu correo.' };
  }
  if (user.emailVerified) {
    return { ...idle, status: 'ok', message: 'Tu correo ya estaba confirmado.' };
  }

  const parsed = confirmEmailSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) {
    return {
      ...idle,
      status: 'error',
      message: 'Revisa el codigo.',
      errors: fieldErrors(parsed.error),
    };
  }

  const limit = await rateLimit(`verify:try:${user.id}`, 10, 60 * 15);
  if (!limit.ok) {
    return { ...idle, status: 'error', message: 'Demasiados intentos. Espera unos minutos.' };
  }

  const check = await consumeCode(user.email, 'EMAIL_VERIFICATION', parsed.data.code);
  if (!check.ok) {
    return { ...idle, status: 'error', message: messageFor(check), errors: { code: ' ' } };
  }

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  await writeAuditLog({
    userId: user.id,
    action: 'account.email_verified',
    entity: 'User',
    entityId: user.id,
  });

  revalidatePath('/cuenta');
  return { ...idle, status: 'ok', message: 'Listo, tu correo quedo confirmado.' };
}

// ---------------------------------------------------------------------------
// Recuperar la contrasena
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return {
      ...idle,
      status: 'error',
      message: 'Ingresa un correo electronico valido.',
      step: 'request',
    };
  }

  const email = parsed.data;
  const ip = await getClientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`reset:ip:${ip}`, 10, 60 * 30),
    rateLimit(`reset:email:${email}`, 4, 60 * 30),
  ]);

  // La respuesta es la misma pase lo que pase: si dijeramos "ese correo no
  // existe", cualquiera podria averiguar quien tiene cuenta en la tienda.
  const acknowledged: VerificationState = {
    ...idle,
    status: 'ok',
    step: 'confirm',
    message: `Si ${email} tiene una cuenta, le enviamos un codigo. Revisa tambien la carpeta de correo no deseado.`,
  };

  if (!byIp.ok || !byEmail.ok) return acknowledged;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return acknowledged;

  const { code, minutes } = await issueCode(email, 'PASSWORD_RESET');
  await notifyPasswordReset({ email, name: user.name, code, minutes }).catch((error) => {
    console.error('[verification] no se pudo enviar el codigo de recuperacion', error);
  });

  return acknowledged;
}

export async function resetPassword(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const parsed = passwordResetSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      ...idle,
      status: 'error',
      step: 'confirm',
      message: 'Revisa los datos marcados.',
      errors: fieldErrors(parsed.error),
    };
  }

  const { email, code, password } = parsed.data;
  const ip = await getClientIp();
  const limit = await rateLimit(`reset:confirm:${ip}`, 15, 60 * 30);
  if (!limit.ok) {
    return {
      ...idle,
      status: 'error',
      step: 'confirm',
      message: 'Demasiados intentos. Espera unos minutos.',
    };
  }

  const check = await consumeCode(email, 'PASSWORD_RESET', code);
  if (!check.ok) {
    return { ...idle, status: 'error', step: 'confirm', message: messageFor(check) };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    // El codigo era valido, asi que esto solo pasa si la cuenta se desactivo
    // entremedio. No se crea ninguna cuenta nueva por las dudas.
    return {
      ...idle,
      status: 'error',
      step: 'request',
      message: 'No pudimos cambiar la contrasena. Escribenos y lo revisamos.',
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      // Quien recibio el codigo demostro que el correo es suyo.
      emailVerified: true,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'account.password_reset',
    entity: 'User',
    entityId: user.id,
  });

  return {
    ...idle,
    status: 'ok',
    step: 'confirm',
    message: 'Tu contrasena quedo cambiada. Ya puedes ingresar con la nueva.',
  };
}
