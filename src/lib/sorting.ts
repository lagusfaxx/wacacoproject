import type { Prisma } from '@prisma/client';

export const SORT_KEYS = ['destacados', 'precio-asc', 'precio-desc', 'nuevos', 'nombre'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function parseSort(value: string | undefined): SortKey {
  return SORT_KEYS.includes(value as SortKey) ? (value as SortKey) : 'destacados';
}

export function orderByForSort(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'precio-asc':
      return [{ price: 'asc' }, { name: 'asc' }];
    case 'precio-desc':
      return [{ price: 'desc' }, { name: 'asc' }];
    case 'nuevos':
      return [{ createdAt: 'desc' }, { position: 'asc' }];
    case 'nombre':
      return [{ name: 'asc' }];
    default:
      return [{ featured: 'desc' }, { position: 'asc' }];
  }
}
