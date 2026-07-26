import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Novedades',
  description: 'Guias de preparacion, lanzamientos y consejos para tu cafe portatil.',
};

const POSTS = [
  {
    slug: 'guia-espresso-portatil',
    title: 'Guia rapida: como sacar un buen espresso portatil',
    excerpt:
      'Molienda, dosis, temperatura y presion. Los cuatro ajustes que separan un shot correcto de uno memorable, sin importar donde estes.',
    tag: 'Guias',
    readingTime: '6 min',
  },
  {
    slug: 'molido-vs-capsulas',
    title: 'Cafe molido o capsulas: cual conviene para viajar',
    excerpt:
      'Comparamos sabor, peso, costo por taza y residuos para ayudarte a elegir entre la linea GR y la linea NS.',
    tag: 'Comparativas',
    readingTime: '5 min',
  },
  {
    slug: 'mantencion-y-limpieza',
    title: 'Mantencion: como alargar la vida util de tu cafetera',
    excerpt:
      'Rutina de limpieza semanal, cambio de sellos y los errores mas comunes que acortan la vida del embolo.',
    tag: 'Cuidado',
    readingTime: '4 min',
  },
  {
    slug: 'cafe-en-camping',
    title: 'Cafe de especialidad en camping: el equipo minimo',
    excerpt:
      'Que llevar en la mochila para preparar un espresso decente a 3.000 metros sin cargar peso de mas.',
    tag: 'Aventura',
    readingTime: '7 min',
  },
];

export default function BlogPage() {
  return (
    <>
      <header className="border-b border-sand-dark bg-sand">
        <div className="container-site py-14">
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-6xl">
            Novedades
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-muted">
            Guias de preparacion, comparativas y consejos para aprovechar tu equipo al maximo.
          </p>
        </div>
      </header>

      <div className="container-site grid gap-8 py-14 sm:grid-cols-2">
        {POSTS.map((post) => (
          <article key={post.slug} className="border border-sand-dark p-8">
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-muted">
              <span className="badge bg-sand text-ink-soft">{post.tag}</span>
              <span>{post.readingTime} de lectura</span>
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold uppercase leading-tight tracking-tight">
              {post.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{post.excerpt}</p>
            <Link
              href="/productos"
              className="mt-6 inline-block font-display text-xs font-bold uppercase tracking-widest text-brand underline-offset-4 hover:underline"
            >
              Ver productos relacionados
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
