/**
 * Armado del HTML de los correos.
 *
 * Los clientes de correo (Gmail, Outlook) no aplican hojas de estilo externas
 * ni CSS moderno, asi que todo va en tablas y en atributos `style` en linea.
 * No es como se escribe una pagina hoy, pero es lo unico que se ve igual en
 * todas partes.
 *
 * Este modulo es puro a proposito: no toca la base de datos ni el proveedor,
 * de modo que las plantillas se pueden probar sin enviar nada.
 */

export const COLORS = {
  ink: '#1C1B1A',
  inkSoft: '#4A4744',
  inkMuted: '#7A7570',
  brand: '#E1580E',
  sand: '#F5F1EA',
  sandDark: '#E2DBD0',
  white: '#FFFFFF',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ShellOptions = {
  storeName: string;
  /** Logo subido desde el panel. Sin logo se escribe el nombre de la tienda. */
  logoUrl: string | null;
  appUrl: string;
  /** Linea que la bandeja muestra junto al asunto. */
  preheader: string;
  content: string;
  /** Direccion de contacto que se muestra al pie. */
  contactEmail: string;
};

export function emailShell(options: ShellOptions): string {
  const { storeName, logoUrl, appUrl, preheader, content, contactEmail } = options;

  const brandMark = logoUrl
    ? `<img src="${escapeHtml(absolute(logoUrl, appUrl))}" alt="${escapeHtml(storeName)}" height="32" style="height:32px;width:auto;border:0;display:block" />`
    : `<span style="font-family:'Oswald',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.white}">${escapeHtml(storeName)}</span>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(storeName)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.sand};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.sand};padding:24px 12px">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${COLORS.white};border:1px solid ${COLORS.sandDark}">
        <tr>
          <td style="background-color:${COLORS.ink};padding:20px 28px">
            <a href="${escapeHtml(appUrl)}" style="text-decoration:none">${brandMark}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.inkSoft}">
${content}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid ${COLORS.sandDark};padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.inkMuted}">
            <p style="margin:0 0 6px">${escapeHtml(storeName)}</p>
            <p style="margin:0 0 6px">Escribenos a <a href="mailto:${escapeHtml(contactEmail)}" style="color:${COLORS.inkSoft}">${escapeHtml(contactEmail)}</a> y te respondemos.</p>
            <p style="margin:0">Este correo se envio automaticamente por una compra o una solicitud hecha en <a href="${escapeHtml(appUrl)}" style="color:${COLORS.inkSoft}">${escapeHtml(hostOf(appUrl))}</a>.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Las imagenes de un correo necesitan URL absoluta: no hay pagina de origen. */
export function absolute(url: string, appUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${appUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function hostOf(appUrl: string): string {
  try {
    return new URL(appUrl).host;
  } catch {
    return appUrl;
  }
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:'Oswald',Arial,sans-serif;font-size:24px;line-height:1.2;font-weight:700;text-transform:uppercase;letter-spacing:-0.01em;color:${COLORS.ink}">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px">${escapeHtml(text)}</p>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tr><td style="background-color:${COLORS.brand}">
  <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:'Oswald',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.white};text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** El codigo de un solo uso, grande y espaciado para poder copiarlo a mano. */
export function codeBlock(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0"><tr><td align="center" style="background-color:${COLORS.sand};border:1px solid ${COLORS.sandDark};padding:20px">
  <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:0.35em;color:${COLORS.ink}">${escapeHtml(code)}</span>
</td></tr></table>`;
}

export type Row = { label: string; value: string; strong?: boolean };

/** Filas etiqueta/valor: totales del pedido, datos del despacho. */
export function rows(items: Row[]): string {
  const body = items
    .map(
      (row) => `<tr>
    <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.inkMuted}">${escapeHtml(row.label)}</td>
    <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;${
      row.strong ? `font-weight:700;color:${COLORS.ink}` : `color:${COLORS.inkSoft}`
    }">${escapeHtml(row.value)}</td>
  </tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px">${body}</table>`;
}

export type LineItem = {
  name: string;
  variantName: string | null;
  quantity: number;
  lineTotal: string;
};

export function itemsTable(items: LineItem[]): string {
  const body = items
    .map(
      (item) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${COLORS.sandDark};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.ink}">
      ${escapeHtml(item.name)}${item.variantName ? `<br /><span style="font-size:12px;color:${COLORS.inkMuted}">${escapeHtml(item.variantName)}</span>` : ''}
      <br /><span style="font-size:12px;color:${COLORS.inkMuted}">Cantidad: ${item.quantity}</span>
    </td>
    <td align="right" valign="top" style="padding:10px 0;border-bottom:1px solid ${COLORS.sandDark};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.ink}">${escapeHtml(item.lineTotal)}</td>
  </tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px;border-top:1px solid ${COLORS.sandDark}">${body}</table>`;
}

export function addressBlock(lines: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px"><tr><td style="background-color:${COLORS.sand};padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${COLORS.inkSoft}">
${lines.filter(Boolean).map((line) => escapeHtml(line)).join('<br />')}
</td></tr></table>`;
}
