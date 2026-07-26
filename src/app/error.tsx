'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] error no controlado', error);
  }, [error]);

  return (
    <div className="container-site py-32 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-brand">
        Algo salio mal
      </p>
      <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-6xl">
        No pudimos cargar esta pagina
      </h1>
      <p className="mx-auto mt-6 max-w-md text-ink-muted">
        Ocurrio un error inesperado. Puedes reintentar o volver al inicio.
        {error.digest ? (
          <span className="mt-2 block font-mono text-xs">Referencia: {error.digest}</span>
        ) : null}
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Reintentar
        </button>
        <Link href="/" className="btn-outline">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
