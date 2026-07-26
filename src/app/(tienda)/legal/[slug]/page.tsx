import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/store-settings';

export const dynamic = 'force-dynamic';

type Doc = { title: string; intro: string; sections: { heading: string; body: string[] }[] };

function documents(storeEmail: string): Record<string, Doc> {
  return {
    terminos: {
      title: 'Terminos y condiciones',
      intro:
        'Estas condiciones describen como funciona la compra en esta tienda. Los plazos comerciales y las condiciones de garantia se informan al momento de la compra o escribiendo al correo de contacto.',
      sections: [
        {
          heading: '1. Precios y disponibilidad',
          body: [
            `Los precios se expresan en ${env.currency} y son los publicados en cada ficha de producto al momento de comprar.`,
            'La disponibilidad se descuenta del inventario al confirmar el pedido. Si un producto queda sin stock despues de acreditado el pago, nos contactaremos para ofrecer el reembolso o una alternativa.',
          ],
        },
        {
          heading: '2. Formacion del pedido',
          body: [
            'El pedido se considera confirmado cuando Mercado Pago acredita el pago. Hasta entonces queda en estado pendiente y puede reintentarse.',
            'Al comprar recibes un numero de pedido y un enlace privado para seguir su estado en cualquier momento.',
          ],
        },
        {
          heading: '3. Pagos',
          body: [
            'Los pagos se procesan a traves de Mercado Pago. Esta tienda no recibe ni almacena datos de tarjetas.',
            'El monto cobrado se calcula en el servidor a partir de los precios publicados, el descuento aplicado y el costo de despacho cotizado para la direccion ingresada.',
          ],
        },
        {
          heading: '4. Despacho',
          body: [
            'El costo del despacho se cotiza con el transportista antes de pagar, segun la comuna de destino y las caracteristicas de los productos.',
            'El plazo de entrega es el informado por el transportista y puede variar segun la zona.',
          ],
        },
        {
          heading: '5. Contacto',
          body: [
            `Para consultas sobre un pedido, cambios, devoluciones o garantia, escribe a ${storeEmail} indicando tu numero de pedido.`,
          ],
        },
      ],
    },
    privacidad: {
      title: 'Politica de privacidad',
      intro:
        'Que datos recopilamos, para que los usamos y como puedes ejercer tus derechos sobre ellos.',
      sections: [
        {
          heading: 'Datos que recopilamos',
          body: [
            'Datos de contacto y despacho: nombre, correo, telefono y direccion, necesarios para procesar y entregar tu pedido.',
            'Datos de cuenta: correo y contrasena cifrada, si decides registrarte.',
            'Datos tecnicos: direccion IP y registros de actividad, usados para prevenir fraude y abuso.',
          ],
        },
        {
          heading: 'Con quien se comparten',
          body: [
            'Con Mercado Pago, para procesar el pago.',
            'Con el transportista, para cotizar y realizar la entrega: comuna de destino, direccion y datos de contacto de quien recibe.',
          ],
        },
        {
          heading: 'Datos de pago',
          body: [
            'No almacenamos numeros de tarjeta. El procesamiento lo realiza integramente Mercado Pago.',
            'De cada transaccion guardamos el identificador del pago, su estado, el medio utilizado y el monto, para soporte y conciliacion contable.',
          ],
        },
        {
          heading: 'Conservacion y derechos',
          body: [
            'Los datos de pedidos se conservan mientras sean necesarios para efectos contables, tributarios y de garantia.',
            `Puedes solicitar el acceso, la rectificacion o la eliminacion de tus datos escribiendo a ${storeEmail}.`,
          ],
        },
        {
          heading: 'Cookies',
          body: [
            'Se usan cookies estrictamente necesarias para mantener la sesion iniciada y recordar el contenido del carrito. No se utilizan cookies publicitarias de terceros.',
          ],
        },
      ],
    },
    despacho: {
      title: 'Politica de despacho',
      intro: 'Como se calcula el costo del envio y como se sigue la entrega.',
      sections: [
        {
          heading: 'Cotizacion',
          body: [
            'El costo se cotiza antes de pagar, a partir de la comuna de destino y del peso y las medidas de los productos del carrito.',
            'Si el servicio de cotizacion no esta disponible en ese momento, se aplica una tarifa unica y se informa en el resumen del pedido.',
          ],
        },
        {
          heading: 'Plazos',
          body: [
            'El plazo estimado lo informa el transportista al cotizar y se muestra en el checkout y en el detalle del pedido.',
            'El plazo se cuenta desde que el pedido sale de bodega, no desde la compra.',
          ],
        },
        {
          heading: 'Seguimiento',
          body: [
            'Al despachar se registra el numero de seguimiento en el pedido, junto con el enlace del transportista para rastrear el envio.',
          ],
        },
        {
          heading: 'Problemas con la entrega',
          body: [
            `Si el envio no llega o presenta un problema, escribe a ${storeEmail} con tu numero de pedido y el numero de seguimiento.`,
          ],
        },
      ],
    },
  };
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const settings = await getStoreSettings();
  const doc = documents(settings.email)[slug];
  if (!doc) return { title: 'Documento no encontrado' };
  return { title: doc.title, description: doc.intro };
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  const settings = await getStoreSettings();
  const doc = documents(settings.email)[slug];
  if (!doc) notFound();

  return (
    <div className="container-site max-w-3xl py-16">
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight lg:text-5xl">
        {doc.title}
      </h1>
      <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">{doc.intro}</p>

      <div className="mt-12 space-y-10">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-[15px] leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-14 border-t border-sand-dark pt-6 text-xs text-ink-muted">
        Ultima actualizacion: {new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date())}
        . Consultas a {settings.email}.
      </p>
    </div>
  );
}
