import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { env } from '@/lib/env';
import { isBluexpressEnabled } from '@/lib/shipping';
import { getStoreSettings } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centro de ayuda',
  description: 'Como comprar, medios de pago, despacho y seguimiento de pedidos.',
};

/**
 * Solo se responde lo que la tienda hace de verdad: medios de pago, como se
 * calcula el envio y como seguir un pedido. Los plazos, las condiciones de
 * garantia y la politica de devoluciones son decisiones del negocio y se
 * derivan al correo de contacto en lugar de inventarlas aqui.
 */
export default async function HelpPage() {
  const [settings] = await Promise.all([getStoreSettings()]);
  const bluexEnabled = isBluexpressEnabled();

  const sections = [
    {
      id: 'compra',
      title: 'Como comprar',
      items: [
        {
          q: 'Necesito crear una cuenta?',
          a: 'No. Puedes comprar como invitado ingresando solo tu correo y direccion de despacho. Crear una cuenta sirve para guardar tus datos y ver el historial de tus pedidos.',
        },
        {
          q: 'Como aplico un codigo de descuento?',
          a: 'En el carrito, en el campo "Codigo de descuento". El descuento se refleja en el total antes de ir a pagar.',
        },
        {
          q: 'Que pasa si un producto queda sin stock mientras compro?',
          a: 'El stock se reserva al confirmar el pedido. Si otra persona compro la ultima unidad antes que tu, te avisamos en el carrito para que ajustes la cantidad.',
        },
      ],
    },
    {
      id: 'pagos',
      title: 'Medios de pago',
      items: [
        {
          q: 'Con que puedo pagar?',
          a: 'Con todos los medios habilitados en tu cuenta de Mercado Pago: tarjetas de credito y debito, transferencia, saldo en cuenta y pago en efectivo en los puntos de la red.',
        },
        {
          q: 'Es seguro pagar aqui?',
          a: 'El cobro se realiza dentro del entorno de Mercado Pago. Esta tienda nunca recibe ni almacena los datos de tu tarjeta.',
        },
        {
          q: 'Mi pago fue rechazado, que hago?',
          a: 'El pedido queda guardado. Entra al enlace de seguimiento que te enviamos, o a tu cuenta, y usa "Reintentar el pago" para pagarlo con otro medio.',
        },
      ],
    },
    {
      id: 'envios',
      title: 'Despacho',
      items: [
        {
          q: 'Cuanto cuesta el envio?',
          a: bluexEnabled
            ? 'Se cotiza con Blue Express al momento de comprar, segun la comuna de destino y el peso y las medidas de los productos de tu carrito. Veras el valor exacto antes de pagar.'
            : 'El valor se calcula en el checkout y se muestra antes de confirmar el pago.',
        },
        ...(env.freeShippingThreshold > 0
          ? [
              {
                q: 'Hay envio gratis?',
                a: `Si tu compra supera ${formatMoney(env.freeShippingThreshold)} el despacho no tiene costo.`,
              },
            ]
          : []),
        {
          q: 'Como sigo mi pedido?',
          a: 'Cuando despachamos, cargamos el numero de seguimiento del transportista en tu pedido. Lo encuentras en la pagina de seguimiento junto con el enlace para rastrear el envio.',
        },
        {
          q: 'Cuanto demora la entrega?',
          a: bluexEnabled
            ? 'Al cotizar, Blue Express informa el plazo estimado para tu comuna y lo mostramos en el checkout y en el detalle del pedido.'
            : `El plazo depende de tu comuna. Escribenos a ${settings.email} si necesitas una fecha estimada.`,
        },
      ],
    },
    {
      id: 'devoluciones',
      title: 'Cambios, devoluciones y garantia',
      items: [
        {
          q: 'Puedo cambiar o devolver un producto?',
          a: `Escribenos a ${settings.email} indicando tu numero de pedido y el motivo, y te respondemos con el procedimiento y los plazos vigentes.`,
        },
        {
          q: 'Como hago efectiva la garantia?',
          a: `Contactanos a ${settings.email} con tu numero de pedido y una descripcion del problema. Te indicaremos los pasos a seguir.`,
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
            Como comprar, medios de pago, despacho y seguimiento de pedidos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/seguimiento" className="btn-dark btn-sm py-3">
              Seguir mi pedido
            </Link>
            <a href={`mailto:${settings.email}`} className="btn-ghost">
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
