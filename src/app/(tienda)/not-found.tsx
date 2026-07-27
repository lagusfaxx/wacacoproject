import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-site py-32 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-brand">
        Error 404
      </p>
      <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-none tracking-tight lg:text-7xl">
        Pagina no encontrada
      </h1>
      <p className="mx-auto mt-6 max-w-md text-ink-muted">
        La pagina que buscas no existe o fue movida. Vuelve al inicio o explora el catalogo.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Ir al inicio
        </Link>
        <Link href="/products" className="btn-outline">
          Ver productos
        </Link>
      </div>
    </div>
  );
}
