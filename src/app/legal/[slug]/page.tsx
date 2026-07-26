import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Doc = { title: string; intro: string; sections: { heading: string; body: string[] }[] };

function documents(): Record<string, Doc> {
  return {
    terminos: {
      title: 'Terminos y condiciones',
      intro:
        'Estas condiciones regulan la compra de productos en esta tienda. Al realizar un pedido aceptas los terminos descritos a continuacion.',
      sections: [
        {
          heading: '1. Precios y disponibilidad',
          body: [
            `Todos los precios se expresan en ${env.currency} e incluyen los impuestos aplicables, salvo que se indique lo contrario.`,
            'La disponibilidad se actualiza en tiempo real. Si un producto queda sin stock despues de confirmado el pago, te contactaremos para ofrecerte el reembolso o un producto equivalente.',
          ],
        },
        {
          heading: '2. Proceso de compra',
          body: [
            'El pedido se considera confirmado una vez que Mercado Pago acredita el pago. Hasta ese momento el pedido permanece en estado pendiente.',
            'Recibiras un correo con el numero de pedido y un enlace privado para seguir su estado.',
          ],
        },
        {
          heading: '3. Pagos',
          body: [
            'Los pagos se procesan a traves de Mercado Pago. Esta tienda no almacena datos de tarjetas de credito o debito.',
            'Si el pago es rechazado, el pedido queda registrado y puedes reintentarlo desde tu cuenta o desde el enlace de seguimiento.',
          ],
        },
        {
          heading: '4. Garantia legal',
          body: [
            'Los productos cuentan con la garantia legal vigente y con 2 anos de garantia del fabricante contra defectos de fabricacion.',
            'La garantia no cubre danos por mal uso, caidas, ni el desgaste normal de sellos y filtros.',
          ],
        },
      ],
    },
    privacidad: {
      title: 'Politica de privacidad',
      intro:
        'Explicamos que datos recopilamos, para que los usamos y como puedes ejercer tus derechos sobre ellos.',
      sections: [
        {
          heading: 'Datos que recopilamos',
          body: [
            'Datos de contacto y envio: nombre, correo, telefono y direccion, necesarios para procesar y despachar tu pedido.',
            'Datos de cuenta: correo y contrasena cifrada, si decides registrarte.',
            'Datos tecnicos: direccion IP y registros de actividad, usados para prevenir fraude y abuso.',
          ],
        },
        {
          heading: 'Datos de pago',
          body: [
            'No almacenamos numeros de tarjeta. El procesamiento del pago lo realiza integramente Mercado Pago, que actua como responsable de esos datos.',
            'De cada transaccion guardamos unicamente el identificador del pago, su estado, el medio utilizado y el monto, para fines de soporte y conciliacion contable.',
          ],
        },
        {
          heading: 'Conservacion y derechos',
          body: [
            'Conservamos los datos de pedidos durante el plazo legal exigido para efectos tributarios y de garantia.',
            `Puedes solicitar el acceso, la rectificacion o la eliminacion de tus datos escribiendo a ${env.storeEmail}.`,
          ],
        },
        {
          heading: 'Cookies',
          body: [
            'Usamos cookies estrictamente necesarias para mantener tu sesion iniciada y recordar el contenido de tu carrito. No utilizamos cookies publicitarias de terceros.',
          ],
        },
      ],
    },
    despacho: {
      title: 'Politica de despacho',
      intro: 'Plazos, coberturas y condiciones de entrega de los pedidos.',
      sections: [
        {
          heading: 'Preparacion',
          body: [
            'Los pedidos pagados antes de las 15:00 horas de un dia habil se preparan el mismo dia. El resto se prepara al dia habil siguiente.',
          ],
        },
        {
          heading: 'Plazos de entrega',
          body: [
            'Region Metropolitana: 2 a 3 dias habiles.',
            'Regiones: 3 a 5 dias habiles.',
            'Zonas extremas y localidades apartadas pueden requerir hasta 8 dias habiles.',
          ],
        },
        {
          heading: 'Costos',
          body: [
            env.freeShippingThreshold > 0
              ? `El envio tiene un costo fijo y es gratuito para compras que superen el monto minimo publicado en la tienda.`
              : 'El envio tiene un costo fijo publicado en el carrito antes de confirmar la compra.',
          ],
        },
        {
          heading: 'Entregas fallidas',
          body: [
            'Si el transportista no encuentra a nadie en el domicilio realizara un segundo intento. Tras el segundo intento fallido el paquete regresa a bodega y te contactaremos para coordinar un nuevo envio.',
          ],
        },
      ],
    },
  };
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = documents()[slug];
  if (!doc) return { title: 'Documento no encontrado' };
  return { title: doc.title, description: doc.intro };
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = documents()[slug];
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
        . Consultas a {env.storeEmail}.
      </p>
    </div>
  );
}
