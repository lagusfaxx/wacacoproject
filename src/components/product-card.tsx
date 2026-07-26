import Link from 'next/link';
import { formatMoney } from '@/lib/money';

export type ProductCardData = {
  slug: string;
  name: string;
  subtitle: string | null;
  price: string;
  compareAtPrice: string | null;
  image: string | null;
  award: string | null;
  isNew: boolean;
  stock: number;
  colors: { name: string; hex: string | null }[];
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const hasDiscount =
    product.compareAtPrice !== null && Number(product.compareAtPrice) > Number(product.price);
  const soldOut = product.stock <= 0;

  return (
    <article className="group relative flex h-full flex-col border-b border-r border-sand-dark bg-white">
      <Link href={`/productos/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden bg-sand">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
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
            {soldOut ? <span className="badge bg-white text-ink">Agotado</span> : null}
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
