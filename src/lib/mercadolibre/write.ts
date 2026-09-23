import 'server-only';

import { writeAuditLog } from '@/lib/audit';
import { invalidateCache, MlApiError, mlFetch } from './client';
import type { MlItem } from './types';

/**
 * Cambios sobre la cuenta de Mercado Libre.
 *
 * Los usan tanto el panel como las herramientas MCP, asi que las reglas de
 * seguridad viven aqui y no en cada pantalla:
 *   - un cambio de precio de mas del 40% exige confirmacion explicita;
 *   - finalizar una publicacion (irreversible) tambien;
 *   - cada cambio queda en la bitacora con quien lo hizo y por que via.
 */

export type WriteContext = {
  userId: string | null;
  /** Por donde llego el cambio: el panel o Claude (MCP). */
  via: 'panel' | 'mcp';
  /** Nombre de la clave MCP, para distinguir conexiones en la bitacora. */
  client?: string;
};

export class MlGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MlGuardError';
  }
}

export const PRICE_CHANGE_GUARD = 0.4;

async function audit(ctx: WriteContext, action: string, entityId: string, metadata: Record<string, unknown>) {
  invalidateCache('ml:');
  await writeAuditLog({
    userId: ctx.userId,
    action: `ml.${action}`,
    entity: 'MercadoLibre',
    entityId,
    metadata: { via: ctx.via, ...(ctx.client ? { client: ctx.client } : {}), ...metadata },
  });
}

async function fetchItem(itemId: string) {
  return mlFetch<MlItem>(`/items/${itemId}`, {
    query: { attributes: 'id,title,price,available_quantity,status,variations,sold_quantity' },
  });
}

export async function updatePrice(
  ctx: WriteContext,
  input: { itemId: string; price: number; forzar?: boolean },
) {
  const item = await fetchItem(input.itemId);
  const change = item.price > 0 ? Math.abs(input.price - item.price) / item.price : 1;
  if (change > PRICE_CHANGE_GUARD && !input.forzar) {
    throw new MlGuardError(
      `El precio pasaria de ${item.price} a ${input.price} (${Math.round(change * 100)}% de cambio). ` +
        'Por seguridad, un cambio de mas del 40% necesita confirmacion: repite con forzar = true.',
    );
  }

  // Con variaciones el precio vive en cada una y tiene que ser el mismo en todas.
  const body = item.variations?.length
    ? { variations: item.variations.map((v) => ({ id: v.id, price: input.price })) }
    : { price: input.price };

  const updated = await mlFetch<MlItem>(`/items/${input.itemId}`, { method: 'PUT', body });
  await audit(ctx, 'item.price', input.itemId, { title: item.title, from: item.price, to: input.price });
  return { id: updated.id, title: updated.title, antes: item.price, ahora: updated.price };
}

export async function updateStock(
  ctx: WriteContext,
  input: { itemId: string; quantity: number; variationId?: number },
) {
  const item = await fetchItem(input.itemId);
  let body: unknown;

  if (item.variations?.length) {
    if (!input.variationId) {
      const options = item.variations
        .map((v) => {
          const name = (v.attribute_combinations ?? []).map((a) => a.value_name).join(' / ');
          return `${v.id} (${name || 'sin nombre'}: ${v.available_quantity} u.)`;
        })
        .join(', ');
      throw new MlGuardError(`La publicacion tiene variaciones; indica cual: ${options}.`);
    }
    if (!item.variations.some((v) => v.id === input.variationId)) {
      throw new MlGuardError('Esa variacion no pertenece a la publicacion.');
    }
    // Al actualizar variaciones hay que mandarlas TODAS: la que no se envia,
    // Mercado Libre la elimina.
    body = {
      variations: item.variations.map((v) =>
        v.id === input.variationId ? { id: v.id, available_quantity: input.quantity } : { id: v.id },
      ),
    };
  } else {
    body = { available_quantity: input.quantity };
  }

  const updated = await mlFetch<MlItem>(`/items/${input.itemId}`, { method: 'PUT', body });
  await audit(ctx, 'item.stock', input.itemId, {
    title: item.title,
    variationId: input.variationId ?? null,
    to: input.quantity,
  });
  return { id: updated.id, title: updated.title, stock_total: updated.available_quantity };
}

export async function setStatus(
  ctx: WriteContext,
  input: { itemId: string; status: 'active' | 'paused' | 'closed'; confirmar?: boolean },
) {
  if (input.status === 'closed' && !input.confirmar) {
    throw new MlGuardError(
      'Finalizar una publicacion es irreversible (no se puede volver a activar). Repite con confirmar = true si es lo que quieres.',
    );
  }
  const item = await fetchItem(input.itemId);
  const updated = await mlFetch<MlItem>(`/items/${input.itemId}`, {
    method: 'PUT',
    body: { status: input.status },
  });
  await audit(ctx, 'item.status', input.itemId, { title: item.title, from: item.status, to: input.status });
  return { id: updated.id, title: updated.title, antes: item.status, ahora: updated.status };
}

export async function updateTitle(ctx: WriteContext, input: { itemId: string; title: string }) {
  const item = await fetchItem(input.itemId);
  const updated = await mlFetch<MlItem>(`/items/${input.itemId}`, {
    method: 'PUT',
    body: { title: input.title },
  }).catch((error: unknown) => {
    if (error instanceof MlApiError && item.sold_quantity > 0) {
      throw new MlApiError(
        error.status,
        `${error.message} (Mercado Libre no permite cambiar el titulo de una publicacion con ventas.)`,
      );
    }
    throw error;
  });
  await audit(ctx, 'item.title', input.itemId, { from: item.title, to: input.title });
  return { id: updated.id, antes: item.title, ahora: updated.title };
}

export async function updateDescription(ctx: WriteContext, input: { itemId: string; text: string }) {
  await mlFetch(`/items/${input.itemId}/description`, {
    method: 'PUT',
    query: { api_version: 2 },
    body: { plain_text: input.text },
  }).catch(async (error: unknown) => {
    // Publicacion sin descripcion: se crea en vez de actualizarse.
    if (error instanceof MlApiError && error.status === 404) {
      return mlFetch(`/items/${input.itemId}/description`, {
        method: 'POST',
        body: { plain_text: input.text },
      });
    }
    throw error;
  });
  await audit(ctx, 'item.description', input.itemId, { length: input.text.length });
  return { id: input.itemId, ok: true };
}

export async function answerQuestion(ctx: WriteContext, input: { questionId: number; text: string }) {
  const result = await mlFetch<{ id: number; status: string; item_id?: string }>('/answers', {
    method: 'POST',
    body: { question_id: input.questionId, text: input.text },
  });
  await audit(ctx, 'question.answer', String(input.questionId), {
    itemId: result.item_id ?? null,
    text: input.text.slice(0, 500),
  });
  return { question_id: input.questionId, status: result.status };
}

/** Fecha en el formato que pide la API de promociones. */
function promoDate(date: string, endOfDay: boolean): string {
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

export async function createPriceDiscount(
  ctx: WriteContext,
  input: {
    itemId: string;
    dealPrice: number;
    topDealPrice?: number;
    startDate: string;
    finishDate: string;
  },
) {
  const item = await fetchItem(input.itemId);
  if (input.dealPrice >= item.price) {
    throw new MlGuardError(`El precio con descuento (${input.dealPrice}) debe ser menor al actual (${item.price}).`);
  }
  if (input.topDealPrice !== undefined && input.topDealPrice > input.dealPrice) {
    throw new MlGuardError('El precio para Mercado Puntos debe ser igual o menor al precio con descuento.');
  }
  const start = new Date(`${input.startDate}T00:00:00`);
  const finish = new Date(`${input.finishDate}T00:00:00`);
  const spanDays = (finish.getTime() - start.getTime()) / 86_400_000;
  if (!(spanDays >= 0) || spanDays > 14) {
    throw new MlGuardError('La promocion debe durar entre 1 y 14 dias (limite de Mercado Libre).');
  }

  const result = await mlFetch('/seller-promotions/items/' + input.itemId, {
    method: 'POST',
    query: { app_version: 'v2' },
    body: {
      promotion_type: 'PRICE_DISCOUNT',
      deal_price: input.dealPrice,
      ...(input.topDealPrice !== undefined ? { top_deal_price: input.topDealPrice } : {}),
      start_date: promoDate(input.startDate, false),
      finish_date: promoDate(input.finishDate, true),
    },
  });
  await audit(ctx, 'promotion.discount', input.itemId, {
    title: item.title,
    price: item.price,
    dealPrice: input.dealPrice,
    topDealPrice: input.topDealPrice ?? null,
    startDate: input.startDate,
    finishDate: input.finishDate,
  });
  return result;
}

export async function joinPromotion(
  ctx: WriteContext,
  input: {
    itemId: string;
    promotionId: string;
    promotionType: string;
    dealPrice?: number;
    topDealPrice?: number;
    offerId?: string;
  },
) {
  const result = await mlFetch('/seller-promotions/items/' + input.itemId, {
    method: 'POST',
    query: { app_version: 'v2' },
    body: {
      promotion_id: input.promotionId,
      promotion_type: input.promotionType,
      ...(input.dealPrice !== undefined ? { deal_price: input.dealPrice } : {}),
      ...(input.topDealPrice !== undefined ? { top_deal_price: input.topDealPrice } : {}),
      ...(input.offerId ? { offer_id: input.offerId } : {}),
    },
  });
  await audit(ctx, 'promotion.join', input.itemId, { ...input });
  return result;
}

export async function leavePromotion(
  ctx: WriteContext,
  input: { itemId: string; promotionType: string; promotionId?: string; offerId?: string },
) {
  const result = await mlFetch('/seller-promotions/items/' + input.itemId, {
    method: 'DELETE',
    query: {
      promotion_type: input.promotionType,
      promotion_id: input.promotionId,
      offer_id: input.offerId,
      app_version: 'v2',
    },
  });
  await audit(ctx, 'promotion.leave', input.itemId, { ...input });
  return result ?? { ok: true };
}
