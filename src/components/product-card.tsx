import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { PlaneIcon } from './icons';
import { MediaImage } from './media-image';
import { Stars } from './stars';

export type ProductCardData = {
  slug: string;
  name: string;
  subtitle: string | null;
  price: string;
  compareAtPrice: string | null;
  image: string | null;
  award: string | null;
  isNew: boolean;
  /** Reposicion en camino: cambia el aviso de agotado por uno de espera. */
  incoming: boolean;
  stock: number;
  colors: { name: string; hex: string | null }[];
  /** Nota media de las opiniones publicadas. null = todavia no tiene. */
  rating?: { average: number; count: number } | null;
};

export function ProductCard({
  product,
  compact = false,
  className = '',
}: {
  product: ProductCardData;
  /** Recuadro de la foto un 15% mas bajo, para las tiras de la portada. */
  compact?: boolean;
  /** Ancho y encaje de la tarjeta cuando la tira es un carrusel. */
  className?: string;
}) {
  const hasDiscount =
    product.compareAtPrice !== null && Number(product.compareAtPrice) > Number(product.price);
  const soldOut = product.stock <= 0;

  return (
    <article
      className={`group relative flex h-full flex-col border-b border-r border-sand-dark bg-white ${className}`}
    >
      <Link href={`/products/${product.slug}`} className="flex flex-1 flex-col">
        <div
          className={`relative overflow-hidden bg-sand ${
            compact ? 'aspect-[20/17]' : 'aspect-square'
          }`}
        >
          {product.image ? (
            <MediaImage
              src={product.image}
              alt={product.name}
              loading="lazy"
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 78vw"
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-sm uppercase tracking-widest text-ink-muted">
              Sin imagen
            </div>
          )}

          <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
            {product.isNew ? <span className="badge bg-ink text-white">Nuevo</span> : null}
            {hasDiscount ? <span className="badge bg-brand text-white">Oferta</span> : null}
            {/* Sin stock pero con reposicion en camino, se anuncia la espera en
                lugar del agotado: dice lo mismo sin cerrar la puerta. */}
            {soldOut && product.incoming ? (
              <span className="badge flex items-center gap-1.5 bg-ink text-white">
                <PlaneIcon className="h-3 w-3" />
                En camino
              </span>
            ) : soldOut ? (
              <span className="badge bg-white text-ink">Agotado</span>
            ) : null}
          </div>

          {product.award ? (
            <span className="absolute bottom-4 left-4 max-w-[60%] rounded-sm bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {product.award}
            </span>
          ) : null}

          {product.colors.length > 0 ? (
            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
              {product.colors.slice(0, 4).map((color) => (
                <span
                  key={color.name}
                  title={color.name}
                  className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
                  style={{ backgroundColor: color.hex ?? '#CCCCCC' }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="font-display text-xl font-bold uppercase leading-none tracking-tight text-ink transition-colors group-hover:text-brand">
            {product.name}
          </h3>
          {product.subtitle ? (
            <p className="mt-2 text-[13px] uppercase tracking-wide text-ink-muted">
              {product.subtitle}
            </p>
          ) : null}

          {product.rating ? (
            <span className="mt-2 flex items-center gap-1.5">
              <Stars rating={product.rating.average} size="sm" />
              <span className="text-xs text-ink-muted">({product.rating.count})</span>
            </span>
          ) : null}

          <div className="mt-auto flex items-baseline gap-2.5 pt-5">
            {hasDiscount ? (
              <span className="text-sm text-ink-muted line-through">
                {formatMoney(product.compareAtPrice!)}
              </span>
            ) : null}
            <span
              className={`font-display text-lg font-semibold ${hasDiscount ? 'text-brand' : 'text-ink'}`}
            >
              {formatMoney(product.price)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
