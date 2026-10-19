import 'server-only';

import { PDFDocument } from 'pdf-lib';

/**
 * Acomoda las etiquetas de Mercado Envios en hojas carta.
 *
 * Mercado Libre entrega cada etiqueta en una pagina del tamano de la etiqueta
 * (unos 10 x 15 cm), pensada para impresoras termicas. En una impresora de
 * hoja eso sale ampliado a una carta completa por etiqueta. Aqui se ponen
 * varias por hoja, a tamano real (o casi: se permite achicar hasta un 5% para
 * que entren), y las que ya vienen del tamano de una hoja pasan tal cual.
 */

const SHEET: [number, number] = [612, 792]; // carta, en puntos
const MARGIN = 18; // ~6 mm: el borde que no imprimen las impresoras de hoja
const GAP = 12;
/** Achicar mas que esto arriesga que el codigo de barras no se lea bien. */
const MIN_SCALE = 0.95;

type Layout = { cols: number; rows: number; scale: number };

export function bestLayout(width: number, height: number): Layout {
  const usableW = SHEET[0] - 2 * MARGIN;
  const usableH = SHEET[1] - 2 * MARGIN;
  let best: Layout = { cols: 1, rows: 1, scale: 1 };
  for (let cols = 1; cols <= 4; cols++) {
    for (let rows = 1; rows <= 4; rows++) {
      const scale = Math.min(
        1,
        (usableW - (cols - 1) * GAP) / (cols * width),
        (usableH - (rows - 1) * GAP) / (rows * height),
      );
      if (scale < MIN_SCALE) continue;
      const count = cols * rows;
      const bestCount = best.cols * best.rows;
      if (count > bestCount || (count === bestCount && scale > best.scale)) best = { cols, rows, scale };
    }
  }
  return best;
}

export async function labelsOnSheets(pdf: Buffer): Promise<Buffer> {
  try {
    return await impose(pdf);
  } catch (error) {
    // Si el PDF trae algo que no se puede rearmar, mejor imprimir el original que nada.
    console.error('[mercadolibre] no se pudieron acomodar las etiquetas en hojas', error);
    return pdf;
  }
}

async function impose(pdf: Buffer): Promise<Buffer> {
  const source = await PDFDocument.load(pdf);
  const pages = source.getPages();
  if (!pages.length) return pdf;

  const { width, height } = pages[0]!.getSize();
  const layout = bestLayout(width, height);
  const perSheet = layout.cols * layout.rows;
  if (perSheet < 2) return pdf;

  const out = await PDFDocument.create();
  const embedded = await out.embedPages(pages);
  const w = width * layout.scale;
  const h = height * layout.scale;
  // Centra la grilla en la hoja.
  const left = (SHEET[0] - (layout.cols * w + (layout.cols - 1) * GAP)) / 2;
  const top = SHEET[1] - (SHEET[1] - (layout.rows * h + (layout.rows - 1) * GAP)) / 2;

  embedded.forEach((page, i) => {
    const slot = i % perSheet;
    const sheet = slot === 0 ? out.addPage(SHEET) : out.getPage(out.getPageCount() - 1);
    const col = slot % layout.cols;
    const row = Math.floor(slot / layout.cols);
    sheet.drawPage(page, {
      x: left + col * (w + GAP),
      y: top - (row + 1) * h - row * GAP,
      width: w,
      height: h,
    });
  });
  return Buffer.from(await out.save());
}
