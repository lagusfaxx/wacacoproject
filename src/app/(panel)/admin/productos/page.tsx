import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { toggleProductActive, updateStock } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Productos' };

type PageProps = { searchParams: Promise<{ q?: string; estado?: string }> };

export default async function AdminProductsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { q, estado } = await searchParams;
  const term = (q ?? '').trim().slice(0, 80);

  const where: Prisma.ProductWhereInput = {
    ...(estado === 'inactivos' ? { active: false } : estado === 'activos' ? { active: true } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { sku: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ active: 'desc' }, { position: 'asc' }],
    include: {
      images: { orderBy: { position: 'asc' }, take: 1 },
      _count: { select: { orderItems: true, variants: true } },
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          Productos
        </h1>
        <Link href="/admin/productos/nuevo" className="btn-primary btn-sm py-3">
          Nuevo producto
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action="/admin/productos" method="get" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={term}
            placeholder="Nombre, SKU o slug"
            className="field w-64 py-2.5"
            maxLength={80}
          />
          <button type="submit" className="btn-dark btn-sm">
            Buscar
          </button>
        </form>

        <div className="flex gap-2">
          <Chip href="/admin/productos" active={!estado}>
            Todos
          </Chip>
          <Chip href="/admin/productos?estado=activos" active={estado === 'activos'}>
            Activos
          </Chip>
          <Chip href="/admin/productos?estado=inactivos" active={estado === 'inactivos'}>
            Inactivos
          </Chip>
        </div>
      </div>

      <div className="mt-6 border border-sand-dark bg-white">
        {products.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-muted">
            No hay productos que coincidan.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th className="text-right">Precio</th>
                  <th>Stock</th>
                  <th className="text-right">Vendidos</th>
                  <th>SEO</th>
                  <th>Google</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 bg-sand">
                          {product.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.images[0].url}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/productos/${product.id}`}
                            className="block truncate font-semibold hover:text-brand"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-ink-muted">
                            /{product.slug}
                            {product._count.variants > 0
                              ? ` · ${product._count.variants} variantes`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs">{product.sku}</td>
                    <td className="text-right tabular-nums">{formatMoney(product.price)}</td>
                    <td>
                      <form action={updateStock} className="flex items-center gap-1.5">
                        <input type="hidden" name="productId" value={product.id} />
                        <input
                          type="number"
                          name="stock"
                          defaultValue={product.stock}
                          min={0}
                          max={1000000}
                          className="w-20 border border-sand-dark px-2 py-1 text-sm tabular-nums focus:border-ink focus:outline-none"
                          aria-label={`Stock de ${product.name}`}
                        />
                        <button
                          type="submit"
                          className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-brand"
                        >
                          Guardar
                        </button>
                      </form>
                    </td>
                    <td className="text-right tabular-nums">{product._count.orderItems}</td>
                    <td>
                      <span
                        className={`badge ${
                          product.noIndex
                            ? 'bg-amber-100 text-amber-800'
                            : product.seoTitle || product.seoDescription
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sand text-ink-muted'
                        }`}
                      >
                        {product.noIndex
                          ? 'Oculto'
                          : product.seoTitle || product.seoDescription
                            ? 'Personalizado'
                            : 'Automatico'}
                      </span>
                    </td>
                    <td>
                      {/* Sin codigo de barras Google no puede reconocer que
                          este articulo es el mismo que vende otra tienda, y sin
                          eso no le presta al producto la ficha ni las opiniones
                          que ya tiene reunidas. Es el dato que mas rinde por lo
                          poco que cuesta cargarlo, asi que conviene verlo de un
                          vistazo en la lista. */}
                      <span
                        className={`badge ${
                          product.gtin
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                        title={
                          product.gtin
                            ? `Codigo de barras: ${product.gtin}`
                            : 'Sin codigo de barras: Google no puede reconocer el producto'
                        }
                      >
                        {product.gtin ? 'Identificado' : 'Sin codigo'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          product.active ? 'bg-emerald-100 text-emerald-800' : 'bg-sand-dark text-ink-soft'
                        }`}
                      >
                        {product.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <form action={toggleProductActive}>
                        <input type="hidden" name="productId" value={product.id} />
                        <button
                          type="submit"
                          className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-brand"
                        >
                          {product.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`border px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-sand-dark bg-white text-ink-soft hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
