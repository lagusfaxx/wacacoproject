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
} as const;

export type PickupSettings = {
  enabled: boolean;
  /** Nombre del local u oficina, ej. "Tienda Nomad Brew". */
  place: string;
  address: string;
  commune: string;
  region: string;
  hours: string;
  notes: string;
};

export const EMPTY_PICKUP: PickupSettings = {
  enabled: false,
  place: '',
  address: '',
  commune: '',
  region: '',
  hours: '',
  notes: '',
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
  };
}
