import type { OrderStatus } from '@prisma/client';
import { orderStatusDescription, orderStatusLabel } from '../order-status';
import {
  addressBlock,
  button,
  codeBlock,
  emailShell,
  heading,
  itemsTable,
  paragraph,
  rows,
  type LineItem,
  type Row,
} from './layout';

/**
 * Plantillas de los correos de la tienda.
 *
 * Cada una devuelve asunto, HTML y texto plano. El texto no es un adorno: hay
 * clientes que lo prefieren, y los filtros de correo desconfian de un mensaje
 * que solo trae HTML.
 *
 * Son funciones puras sobre datos ya formateados (importes como texto, fechas
 * como texto) para poder revisarlas sin base de datos ni proveedor.
 */

export type EmailBrand = {
  storeName: string;
  logoUrl: string | null;
  appUrl: string;
  contactEmail: string;
};

export type OrderEmailData = {
  number: string;
  /** Solo el nombre de pila, para saludar. */
  customerName: string;
  /** Nombre completo, el que hay que dar al retirar el pedido. */
  customerNameFull: string;
  items: LineItem[];
  subtotal: string;
  discountTotal: string | null;
  shippingTotal: string;
  taxTotal: string | null;
  total: string;
  couponCode: string | null;
  shippingAddress: string[];
  shippingService: string | null;
  /** Enlace publico al seguimiento, sin necesidad de cuenta. */
  trackingUrl: string;
  carrier: string | null;
  trackingNumber: string | null;
  carrierTrackingUrl: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  /**
   * Punto de retiro, en lineas, cuando el pedido no se despacha. `null` = va
   * con un courier a la direccion del cliente.
   */
  pickup: string[] | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

function shell(brand: EmailBrand, preheader: string, content: string): string {
  return emailShell({
    storeName: brand.storeName,
    logoUrl: brand.logoUrl,
    appUrl: brand.appUrl,
    contactEmail: brand.contactEmail,
    preheader,
    content,
  });
}

function totalsRows(order: OrderEmailData): Row[] {
  const list: Row[] = [{ label: 'Subtotal', value: order.subtotal }];
  if (order.discountTotal) {
    list.push({
      label: order.couponCode ? `Descuento (${order.couponCode})` : 'Descuento',
      value: `- ${order.discountTotal}`,
    });
  }
  list.push({
    label: order.pickup ? 'Retiro en tienda' : 'Despacho',
    value: order.pickup ? 'Sin costo' : order.shippingTotal,
  });
  if (order.taxTotal) list.push({ label: 'Impuestos', value: order.taxTotal });
  list.push({ label: 'Total', value: order.total, strong: true });
  return list;
}

function itemsAsText(order: OrderEmailData): string {
  return order.items
    .map(
      (item) =>
        `- ${item.name}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity}  ${item.lineTotal}`,
    )
    .join('\n');
}

function totalsAsText(order: OrderEmailData): string {
  return totalsRows(order)
    .map((row) => `${row.label}: ${row.value}`)
    .join('\n');
}

function footerText(brand: EmailBrand): string {
  return `\n\n${brand.storeName}\nEscribenos a ${brand.contactEmail} si necesitas ayuda.`;
}

// ---------------------------------------------------------------------------
// Codigos de un solo uso
// ---------------------------------------------------------------------------

export function verificationCodeEmail(
  brand: EmailBrand,
  data: { code: string; name: string; minutes: number },
): RenderedEmail {
  const content = [
    heading('Confirma tu correo'),
    paragraph(`Hola ${data.name}, este es el codigo para confirmar tu correo en ${brand.storeName}:`),
    codeBlock(data.code),
    paragraph(`El codigo vence en ${data.minutes} minutos y sirve una sola vez.`),
    paragraph('Si no creaste una cuenta, puedes ignorar este mensaje.'),
  ].join('\n');

  return {
    subject: `Tu codigo para confirmar el correo: ${data.code}`,
    html: shell(brand, `Codigo ${data.code}`, content),
    text: `Hola ${data.name},\n\nTu codigo para confirmar el correo en ${brand.storeName} es: ${data.code}\n\nVence en ${data.minutes} minutos y sirve una sola vez. Si no creaste una cuenta, ignora este mensaje.${footerText(brand)}`,
  };
}

export function passwordResetEmail(
  brand: EmailBrand,
  data: { code: string; name: string; minutes: number },
): RenderedEmail {
  const content = [
    heading('Recupera tu contrasena'),
    paragraph(`Hola ${data.name}, pediste cambiar la contrasena de tu cuenta. Usa este codigo:`),
    codeBlock(data.code),
    paragraph(`Vence en ${data.minutes} minutos y sirve una sola vez.`),
    paragraph(
      'Si no fuiste tu, no hace falta que hagas nada: sin el codigo nadie puede cambiar la contrasena. Escribenos si quieres que revisemos la cuenta.',
    ),
  ].join('\n');

  return {
    // El codigo no va en el asunto: se lee en la pantalla de bloqueo del
    // telefono y esta es la llave para entrar a la cuenta.
    subject: 'Codigo para recuperar tu contrasena',
    html: shell(brand, 'Tu codigo para cambiar la contrasena', content),
    text: `Hola ${data.name},\n\nTu codigo para cambiar la contrasena es: ${data.code}\n\nVence en ${data.minutes} minutos y sirve una sola vez. Si no lo pediste, ignora este mensaje: sin el codigo nadie puede cambiar la contrasena.${footerText(brand)}`,
  };
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export function orderPlacedEmail(brand: EmailBrand, order: OrderEmailData): RenderedEmail {
  const content = [
    heading(`Recibimos tu pedido ${order.number}`),
    paragraph(
      `Hola ${order.customerName}, tu pedido quedo registrado y estamos esperando la confirmacion del pago. Te avisamos apenas se acredite.`,
    ),
    itemsTable(order.items),
    rows(totalsRows(order)),
    button(order.trackingUrl, 'Seguir mi pedido'),
    paragraph('Guarda este enlace: con el puedes revisar el estado cuando quieras, sin cuenta.'),
  ].join('\n');

  return {
    subject: `Recibimos tu pedido ${order.number}`,
    html: shell(brand, `Pedido ${order.number} registrado, esperando el pago`, content),
    text: `Hola ${order.customerName},\n\nRecibimos tu pedido ${order.number} y estamos esperando la confirmacion del pago.\n\n${itemsAsText(order)}\n\n${totalsAsText(order)}\n\nSigue tu pedido: ${order.trackingUrl}${footerText(brand)}`,
  };
}

export function orderPaidEmail(brand: EmailBrand, order: OrderEmailData): RenderedEmail {
  const detail: Row[] = [
    { label: 'Pedido', value: order.number },
    ...(order.paidAt ? [{ label: 'Fecha de pago', value: order.paidAt }] : []),
    ...(order.paymentMethod ? [{ label: 'Medio de pago', value: order.paymentMethod }] : []),
  ];

  const content = [
    heading('Tu pago fue acreditado'),
    paragraph(
      `Hola ${order.customerName}, confirmamos el pago de tu pedido. Este correo es tu comprobante de compra.`,
    ),
    rows(detail),
    itemsTable(order.items),
    rows(totalsRows(order)),
    ...(order.pickup
      ? [
          paragraph('Lo retiras en:'),
          addressBlock(order.pickup),
          paragraph('Te avisamos por correo apenas este listo para que lo pases a buscar.'),
        ]
      : [
          paragraph('Despachamos a:'),
          addressBlock(order.shippingAddress),
          ...(order.shippingService ? [paragraph(`Despacho: ${order.shippingService}`)] : []),
        ]),
    button(order.trackingUrl, 'Seguir mi pedido'),
    paragraph(
      'Este comprobante no reemplaza a la boleta o factura, que se emite por separado segun corresponda.',
    ),
  ].join('\n');

  const entregaTexto = order.pickup
    ? `Lo retiras en:\n${order.pickup.filter(Boolean).join('\n')}\n\nTe avisamos apenas este listo.`
    : `Despachamos a:\n${order.shippingAddress.filter(Boolean).join('\n')}`;

  return {
    subject: `Comprobante de tu pedido ${order.number}`,
    html: shell(brand, `Pago acreditado: ${order.total}`, content),
    text: `Hola ${order.customerName},\n\nConfirmamos el pago de tu pedido ${order.number}. Este correo es tu comprobante de compra.\n\n${itemsAsText(order)}\n\n${totalsAsText(order)}\n\n${entregaTexto}\n\nSigue tu pedido: ${order.trackingUrl}\n\nEste comprobante no reemplaza a la boleta o factura.${footerText(brand)}`,
  };
}

/**
 * Aviso de cambio de estado. El texto sale de `order-status.ts`, que es el
 * mismo que ve el cliente en la pagina de seguimiento: si algun dia cambia la
 * redaccion, cambia en los dos lados a la vez.
 */
export function orderStatusEmail(
  brand: EmailBrand,
  order: OrderEmailData,
  status: OrderStatus,
  note: string | null,
): RenderedEmail {
  // El aviso de retiro es el unico que el cliente lee de pie, a punto de salir
  // de la casa: lo que necesita es la direccion, el horario y con que nombre
  // pedirlo, no un parrafo.
  if (status === 'READY_FOR_PICKUP') return readyForPickupEmail(brand, order, note);

  const label = orderStatusLabel(status);
  const shipping =
    status === 'SHIPPED' && order.trackingNumber
      ? [
          rows([
            ...(order.carrier ? [{ label: 'Transportista', value: order.carrier }] : []),
            { label: 'Numero de seguimiento', value: order.trackingNumber },
          ]),
          ...(order.carrierTrackingUrl
            ? [button(order.carrierTrackingUrl, 'Seguir el envio')]
            : []),
        ]
      : [];

  const content = [
    heading(`${order.number}: ${label.toLowerCase()}`),
    paragraph(
      `Hola ${order.customerName}, ${orderStatusDescription(status, {
        deliveryMethod: order.pickup ? 'retiro' : 'despacho',
      }).toLowerCase()}`,
    ),
    ...(note ? [paragraph(note)] : []),
    ...shipping,
    button(order.trackingUrl, 'Ver el detalle del pedido'),
  ].join('\n');

  const descripcion = orderStatusDescription(status, {
    deliveryMethod: order.pickup ? 'retiro' : 'despacho',
  });

  const trackingText =
    status === 'SHIPPED' && order.trackingNumber
      ? `\n\nSeguimiento: ${order.trackingNumber}${order.carrier ? ` (${order.carrier})` : ''}${
          order.carrierTrackingUrl ? `\n${order.carrierTrackingUrl}` : ''
        }`
      : '';

  return {
    subject: `Pedido ${order.number}: ${label.toLowerCase()}`,
    html: shell(brand, descripcion, content),
    text: `Hola ${order.customerName},\n\n${descripcion}${note ? `\n\n${note}` : ''}${trackingText}\n\nDetalle del pedido: ${order.trackingUrl}${footerText(brand)}`,
  };
}

/** "Ya puedes pasar a buscarlo": direccion, horario y con que nombre pedirlo. */
function readyForPickupEmail(
  brand: EmailBrand,
  order: OrderEmailData,
  note: string | null,
): RenderedEmail {
  const lugar = order.pickup ?? [];

  const content = [
    heading('Tu pedido esta listo para retirar'),
    paragraph(
      `Hola ${order.customerName}, ya puedes pasar a buscar tu pedido ${order.number}. Estos son los datos del retiro:`,
    ),
    addressBlock(lugar),
    rows([
      { label: 'Numero de pedido', value: order.number, strong: true },
      { label: 'Retira', value: order.customerNameFull },
    ]),
    paragraph('Pidelo con ese numero. Trae tu cedula por si te la piden.'),
    ...(note ? [paragraph(note)] : []),
    button(order.trackingUrl, 'Ver el detalle del pedido'),
  ].join('\n');

  return {
    subject: `Tu pedido ${order.number} esta listo para retirar`,
    html: shell(brand, 'Ya puedes pasar a buscarlo', content),
    text: `Hola ${order.customerName},\n\nYa puedes pasar a buscar tu pedido ${order.number}.\n\n${lugar.filter(Boolean).join('\n')}\n\nRetira: ${order.customerNameFull}\nPidelo con el numero ${order.number} y trae tu cedula por si te la piden.${note ? `\n\n${note}` : ''}\n\nDetalle del pedido: ${order.trackingUrl}${footerText(brand)}`,
  };
}

/** Aviso interno: la tienda se entera de la venta sin mirar el panel. */
export function adminNewOrderEmail(
  brand: EmailBrand,
  order: OrderEmailData,
  adminUrl: string,
): RenderedEmail {
  const content = [
    heading(`Nuevo pedido pagado: ${order.number}`),
    rows([
      { label: 'Cliente', value: order.customerName },
      { label: 'Total', value: order.total, strong: true },
      ...(order.paymentMethod ? [{ label: 'Medio de pago', value: order.paymentMethod }] : []),
    ]),
    itemsTable(order.items),
    paragraph(order.pickup ? `Lo retira ${order.customerNameFull} en tienda.` : 'Despachar a:'),
    ...(order.pickup ? [] : [addressBlock(order.shippingAddress)]),
    button(adminUrl, 'Abrir en el panel'),
  ].join('\n');

  const entregaTexto = order.pickup
    ? `Retiro en tienda. Lo retira ${order.customerNameFull}.`
    : `Despachar a:\n${order.shippingAddress.filter(Boolean).join('\n')}`;

  return {
    subject: order.pickup
      ? `Nuevo pedido para retiro ${order.number} por ${order.total}`
      : `Nuevo pedido pagado ${order.number} por ${order.total}`,
    html: shell(brand, `${order.customerName} - ${order.total}`, content),
    text: `Nuevo pedido pagado ${order.number}\n\nCliente: ${order.customerName}\nTotal: ${order.total}\n\n${itemsAsText(order)}\n\n${entregaTexto}\n\nPanel: ${adminUrl}`,
  };
}
