'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Vuelve a pedir la pagina cada pocos segundos.
 *
 * La vista en vivo se dibuja entera en el servidor; esto solo la refresca, que
 * evita tener que duplicar cada consulta en una ruta aparte para el navegador.
 * Se detiene cuando la pestana no esta a la vista: nadie necesita datos al
 * segundo de una pantalla que no esta mirando.
 */
export function LiveRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    const alCambiar = () => setActivo(!document.hidden);
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [activo, router, seconds]);

  return (
    <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted">
      <span
        className={`h-2 w-2 rounded-full ${activo ? 'animate-pulse bg-emerald-500' : 'bg-ink-muted'}`}
      />
      {activo ? `En vivo, cada ${seconds}s` : 'En pausa'}
    </span>
  );
}
