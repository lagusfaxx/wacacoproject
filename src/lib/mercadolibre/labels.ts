import 'server-only';

import { chunk, mapLimit, MlApiError, mlFetch, mlFetchBinary } from './client';
import { allOrders } from './read';
import type { MlOrder } from './types';

/**
 * Etiquetas de envio de Mercado Envios.
 *
 * Una etiqueta esta "pendiente" cuando el envio esta listo para despachar
 * (`ready_to_ship`) y nadie la ha impreso (`ready_to_print`). Descargarla la
 * marca como impresa en Mercado Libre (`printed`), por eso listar y descargar
 * son pasos separados: mirar no cambia nada.
 *
 * Las ventas de un mismo carrito (pack) comparten envio y etiqueta.
 */

/** Mercado Libre acepta hasta 50 envios por descarga. */
const LABELS_PER_REQUEST = 50;

type MlShipment = {
  id: number;
  status?: string;
  substatus?: string | null;
  /** Formato nuevo (x-format-new). */
  logistic?: { type?: string; mode?: string };
  /** Formato antiguo. */
  logistic_type?: string;
  mode?: string;
};

export type PendingLabel = {
  envio_id: string;
  ventas: number[];
  comprador?: string;
  fecha_venta: string;
  productos: { titulo: string; cantidad: number; sku?: string }[];
  estado: string;
  sub_estado: string | null;
  logistica: string | null;
};

async function getShipment(id: string): Promise<MlShipment | null> {
  return mlFetch<MlShipment>(`/shipments/${id}`, { headers: { 'x-format-new': 'true' } }).catch(() => null);
}

function logisticType(s: MlShipment): string | null {
  return s.logistic?.type ?? s.logistic_type ?? null;
}

function printable(s: MlShipment, includePrinted: boolean): boolean {
  if (s.status !== 'ready_to_ship') return false;
  // Full lo despacha Mercado Libre: no hay etiqueta que imprimir.
  if (logisticType(s) === 'fulfillment') return false;
  return s.substatus === 'ready_to_print' || (includePrinted && s.substatus === 'printed');
}

/** Agrupa ventas por envio (un pack trae varias ventas con el mismo envio). */
function byShipment(orders: MlOrder[]): Map<string, MlOrder[]> {
  const map = new Map<string, MlOrder[]>();
  for (const order of orders) {
    const id = order.shipping?.id;
    if (!id) continue;
    const key = String(id);
    map.set(key, [...(map.get(key) ?? []), order]);
  }
  return map;
}

function describe(id: string, shipment: MlShipment, orders: MlOrder[]): PendingLabel {
  return {
    envio_id: id,
    ventas: orders.map((o) => o.id),
    comprador: orders[0]?.buyer?.nickname,
    fecha_venta: orders[0]?.date_created ?? '',
    productos: orders.flatMap((o) =>
      o.order_items.map((line) => ({
        titulo: line.item.title,
        cantidad: line.quantity,
        sku: line.item.seller_sku ?? undefined,
      })),
    ),
    estado: shipment.status ?? '',
    sub_estado: shipment.substatus ?? null,
    logistica: logisticType(shipment),
  };
}

/**
 * Busca las etiquetas pendientes entre las ventas pagadas de los ultimos
 * `days` dias (un envio listo para despachar nunca es mas viejo que eso).
 */
export async function findPendingLabels(input: { days: number; includePrinted?: boolean }) {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - input.days * 86_400_000);
  const orders = (await allOrders(desde, hasta, 1000)).filter((o) => o.status === 'paid');
  const groups = byShipment(orders);

  const ids = [...groups.keys()];
  const shipments = await mapLimit(ids, 4, getShipment);

  const labels: PendingLabel[] = [];
  ids.forEach((id, i) => {
    const shipment = shipments[i];
    if (shipment && printable(shipment, Boolean(input.includePrinted))) {
      labels.push(describe(id, shipment, groups.get(id)!));
    }
  });
  return labels.sort((a, b) => a.fecha_venta.localeCompare(b.fecha_venta));
}

/** Revisa envios nombrados a mano: devuelve los que se pueden imprimir y por que no los demas. */
export async function checkShipments(ids: string[]) {
  const shipments = await mapLimit(ids, 4, getShipment);
  const ok: string[] = [];
  const rejected: { envio_id: string; motivo: string }[] = [];
  ids.forEach((id, i) => {
    const s = shipments[i];
    if (!s) rejected.push({ envio_id: id, motivo: 'No existe o no es de esta cuenta.' });
    else if (!printable(s, true)) {
      rejected.push({ envio_id: id, motivo: `Estado ${s.status}/${s.substatus ?? '-'}: no tiene etiqueta para imprimir.` });
    } else ok.push(id);
  });
  return { ok, rejected };
}

/**
 * Descarga las etiquetas en PDF, una descarga por cada 50 envios.
 * Ojo: Mercado Libre las marca como impresas en ese momento.
 */
export async function downloadLabels(ids: string[]): Promise<{ ids: string[]; pdf: Buffer }[]> {
  const out: { ids: string[]; pdf: Buffer }[] = [];
  for (const batch of chunk(ids, LABELS_PER_REQUEST)) {
    const { data } = await mlFetchBinary('/shipment_labels', {
      query: { shipment_ids: batch.join(','), response_type: 'pdf' },
    });
    if (data.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new MlApiError(502, 'Mercado Libre no devolvio un PDF de etiquetas.');
    }
    out.push({ ids: batch, pdf: data });
  }
  return out;
}
