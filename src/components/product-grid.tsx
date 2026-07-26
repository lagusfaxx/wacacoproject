import { ProductCard, type ProductCardData } from './product-card';

export function ProductGrid({
  products,
  emptyMessage = 'No encontramos productos que coincidan con tu busqueda.',
}: {
  products: ProductCardData[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="border-y border-sand-dark bg-sand px-6 py-24 text-center">
        <p className="font-display text-lg uppercase tracking-widest text-ink-muted">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 border-t border-sand-dark sm:grid-cols-2 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
