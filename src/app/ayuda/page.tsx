import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centro de ayuda',
  description: 'Envios, devoluciones, garantia y medios de pago de la tienda Wacaco.',
};

export default function HelpPage() {
  const sections = [
    {
      id: 'pagos',
      title: 'Medios de pago',
      items: [
        {
          q: 'Que formas de pago aceptan?',
          a: 'Todos los medios habilitados por Mercado Pago: tarjetas de credito y debito, transferencia bancaria, saldo en cuenta y pago en efectivo en puntos habilitados.',
        },
        {
          q: 'Es seguro pagar en la tienda?',
          a: 'Si. El cobro se realiza dentro del entorno de Mercado Pago y nunca almacenamos los datos de tu tarjeta en nuestros servidores.',
        },
        {
          q: 'Puedo pagar en cuotas?',
          a: 'Si, hasta en 12 cuotas segun tu banco y el medio de pago que elijas en Mercado Pago.',
        },
      ],
    },
    {
      id: 'envios',
      title: 'Envios y plazos',
      items: [
        {
          q: 'Cuanto cuesta el envio?',
          a:
            env.freeShippingThreshold > 0
              ? `El costo es de ${formatMoney(env.shippingFlatRate)} y es gratis en compras sobre ${formatMoney(env.freeShippingThreshold)}.`
              : `El costo de envio es de ${formatMoney(env.shippingFlatRate)}.`,
        },
        {
          q: 'Cuanto demora en llegar?',
          a: 'Preparamos el pedido en 24 horas habiles despues de confirmado el pago. La entrega demora entre 2 y 5 dias habiles segun la region.',
        },
        {
          q: 'Como sigo mi pedido?',
          a: 'Cuando despachamos tu pedido cargamos el numero de seguimiento. Puedes consultarlo en la seccion Seguir mi pedido con tu numero de orden y tu correo.',
        },
      ],
    },
    {
      id: 'devoluciones',
      title: 'Cambios y devoluciones',
      items: [
        {
          q: 'Puedo devolver un producto?',
          a: 'Tienes 30 dias corridos desde la recepcion para solicitar un cambio o devolucion, siempre que el producto este sin uso y en su empaque original.',
        },
        {
          q: 'Como inicio una devolucion?',
          a: `Escribenos a ${env.storeEmail} indicando tu numero de pedido y el motivo. Te responderemos con las instrucciones de retiro.`,
        },
      ],
    },
    {
      id: 'garantia',
      title: 'Garantia',
      items: [
        {
          q: 'Que cubre la garantia?',
          a: 'Todos los productos tienen 2 anos de garantia oficial contra defectos de fabricacion. No cubre danos por mal uso, caidas o desgaste normal de los sellos.',
        },
        {
          q: 'Hay repuestos disponibles?',
          a: 'Si. Mantenemos stock de sellos, filtros y piezas de recambio para toda la linea.',
        },
      ],
    },
  ];

  return (
    <>
      <header className="border-b border-sand-dark bg-sand">
        <div className="container-site py-14">
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-6xl">
            Centro de ayuda
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-muted">
            Respuestas rapidas sobre pagos, envios, devoluciones y garantia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/seguimiento" className="btn-dark btn-sm py-3">
              Seguir mi pedido
            </Link>
            <a href={`mailto:${env.storeEmail}`} className="btn-ghost">
              Escribirnos
            </a>
          </div>
        </div>
      </header>

      <div className="container-site grid gap-12 py-16 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Secciones de ayuda" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="space-y-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="font-display text-sm font-semibold uppercase tracking-widest text-ink-soft hover:text-brand"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-14">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-32">
              <h2 className="section-title">{section.title}</h2>
              <dl className="mt-6 divide-y divide-sand-dark border-y border-sand-dark">
                {section.items.map((item) => (
                  <div key={item.q} className="py-5">
                    <dt className="font-display text-base font-semibold uppercase tracking-tight">
                      {item.q}
                    </dt>
                    <dd className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
