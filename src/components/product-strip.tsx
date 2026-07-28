import { ProductCard, type ProductCardData } from './product-card';

/**
 * Fila de productos elegidos a mano en el panel.
 *
 * Se dibuja igual que la tira de "Mas vendidos" de la portada, con el mismo
 * deslizamiento lateral en telefono, para que la portada no parezca hecha de
 * piezas distintas.
 */
export function ProductStrip({
  title,
  products,
}: {
  title: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-sand-dark">
      <div className="bg-sand">
        <div className="container-site py-12">
          <h2 className="section-title">{title}</h2>
        </div>
      </div>

      {/* En telefono la fila se desliza de lado: la tarjeta no ocupa todo el
          ancho a proposito, para que se asome la siguiente y se entienda que
          hay mas. */}
      <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto border-t border-sand-dark sm:grid sm:grid-cols-2 sm:overflow-x-visible xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            compact
            className="w-[78%] shrink-0 snap-start sm:w-auto"
          />
        ))}
      </div>
    </section>
  );
}
