import 'server-only';

import { prisma } from './db';

/**
 * Punto de retiro en tienda.
 *
 * Vive en los ajustes y no en el codigo por lo mismo que la cuenta bancaria:
 * la direccion cambia, el horario cambia, y el propietario tiene que poder
 * corregirlo sin esperar un despliegue.
 */

export const PICKUP_KEYS = {
  enabled: 'retiro.activo',
  place: 'retiro.lugar',
  address: 'retiro.direccion',
  commune: 'retiro.comuna',
  region: 'retiro.region',
  hours: 'retiro.horario',
  notes: 'retiro.instrucciones',
  prepDays: 'retiro.diasPreparacion',
} as const;

/** Dias habiles que tarda la tienda en dejar un pedido listo para retirar. */
export const DEFAULT_PREP_DAYS = 1;
export const MAX_PREP_DAYS = 30;

export function parsePrepDays(value: string | undefined | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_PREP_DAYS;
  return Math.min(MAX_PREP_DAYS, Math.max(0, parsed));
}

export type PickupSettings = {
  enabled: boolean;
  /** Nombre del local u oficina, ej. "Tienda Nomad Brew". */
  place: string;
  address: string;
  commune: string;
  region: string;
  hours: string;
  notes: string;
  /** Dias habiles de preparacion antes de que se pueda retirar. */
  prepDays: number;
};

export const EMPTY_PICKUP: PickupSettings = {
  enabled: false,
  place: '',
  address: '',
  commune: '',
  region: '',
  hours: '',
  notes: '',
  prepDays: DEFAULT_PREP_DAYS,
};

/**
 * Los datos minimos para que el retiro sea util: direccion y comuna. Sin ellos
 * el comprador elegiria "retiro" sin saber a donde ir, que es peor que no
 * ofrecerlo.
 */
export function pickupDataIsComplete(pickup: PickupSettings): boolean {
  return Boolean(pickup.address.trim() && pickup.commune.trim());
}

export function pickupIsUsable(pickup: PickupSettings): boolean {
  return pickup.enabled && pickupDataIsComplete(pickup);
}

/** El punto de retiro en lineas, para direcciones y correos. */
export function pickupAddressLines(pickup: PickupSettings): string[] {
  return [
    pickup.place,
    pickup.address,
    [pickup.commune, pickup.region].filter(Boolean).join(', '),
    pickup.hours ? `Horario: ${pickup.hours}` : '',
  ].filter((line) => line.trim());
}

export async function getPickupSettings(): Promise<PickupSettings> {
  let rows: { key: string; value: string }[] = [];

  try {
    rows = await prisma.setting.findMany({
      where: { key: { in: Object.values(PICKUP_KEYS) } },
      select: { key: true, value: true },
    });
  } catch {
    return EMPTY_PICKUP;
  }

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    enabled: map.get(PICKUP_KEYS.enabled) === 'true',
    place: map.get(PICKUP_KEYS.place) ?? '',
    address: map.get(PICKUP_KEYS.address) ?? '',
    commune: map.get(PICKUP_KEYS.commune) ?? '',
    region: map.get(PICKUP_KEYS.region) ?? '',
    hours: map.get(PICKUP_KEYS.hours) ?? '',
    notes: map.get(PICKUP_KEYS.notes) ?? '',
    prepDays: parsePrepDays(map.get(PICKUP_KEYS.prepDays)),
  };
}

const SANTIAGO = 'America/Santiago';

/**
 * Cuando estaria listo un pedido que se encarga ahora.
 *
 * Cuenta dias habiles y no dias corridos: prometer el sabado un retiro "en un
 * dia" es prometer el domingo, y el domingo no abre nadie. Se calcula en la
 * hora de Chile y no en la del servidor, que corre en UTC y a partir de las
 * nueve de la noche ya esta en el dia siguiente.
 *
 * Devuelve el texto listo para mostrar: "hoy", "manana" o "el martes 5 de
 * agosto".
 */
export function pickupReadyLabel(prepDays: number, now = new Date()): string {
  const hoy = startOfDayInSantiago(now);
  const objetivo = new Date(hoy);

  let restantes = Math.max(0, prepDays);
  while (restantes > 0) {
    objetivo.setUTCDate(objetivo.getUTCDate() + 1);
    if (esHabil(objetivo)) restantes -= 1;
  }

  // Encargar un sabado algo "para hoy" tampoco sirve: corre al lunes.
  while (!esHabil(objetivo)) objetivo.setUTCDate(objetivo.getUTCDate() + 1);

  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';

  const texto = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(objetivo);

  return `el ${texto}`;
}

/** Medianoche del dia de hoy en Chile, representada como fecha UTC. */
function startOfDayInSantiago(now: Date): Date {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: SANTIAGO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);

  return new Date(Date.UTC(year!, month! - 1, day!));
}

function esHabil(date: Date): boolean {
  const dia = date.getUTCDay();
  return dia !== 0 && dia !== 6;
}
