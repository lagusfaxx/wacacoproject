/**
 * Genera public/favicon.ico (48x48) sin dependencias externas.
 *
 * Los navegadores piden /favicon.ico aunque la pagina declare un icono SVG,
 * y un 404 en cada carga ensucia la consola y los registros del servidor.
 *
 * El tamano no es casual: Google pide que el icono sea cuadrado y multiplo de
 * 48 pixeles para mostrarlo junto al enlace en sus resultados. A 32 no
 * cumplia, y este archivo es justo el que Google busca cuando no encuentra
 * otra cosa.
 *
 * Uso: node scripts/generate-favicon.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 48;
/** El dibujo esta trazado sobre una reja de 32; se escala a lo que pida SIZE. */
const GRID = 32;
const BACKGROUND = [0x1a, 0x1b, 0x1c, 0xff]; // BGRA de #1C1B1A
const BRAND = [0x0e, 0x58, 0xe1, 0xff]; // BGRA de #E1580E

/** Marca simplificada de Wacaco: arco superior y tres barras. */
function isBrandPixel(x, y) {
  const topBar = y >= 6 && y <= 8 && x >= 7 && x <= 24;
  const sideLeft = x >= 7 && x <= 9 && y >= 6 && y <= 21;
  const sideRight = x >= 22 && x <= 24 && y >= 6 && y <= 21;
  const bottomCurve = y >= 22 && y <= 25 && x >= 10 && x <= 21;
  const bars =
    y >= 11 &&
    y <= 20 &&
    ((x >= 12 && x <= 13) || (x >= 15 && x <= 16) || (x >= 18 && x <= 19));
  return topBar || sideLeft || sideRight || bottomCurve || bars;
}

/** Lleva un pixel del lienzo final a su casilla en la reja del dibujo. */
function isBrandAt(x, y) {
  const escala = GRID / SIZE;
  return isBrandPixel(Math.floor(x * escala), Math.floor(y * escala));
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
// El BMP dentro de un ICO se guarda de abajo hacia arriba.
for (let row = 0; row < SIZE; row += 1) {
  const y = SIZE - 1 - row;
  for (let x = 0; x < SIZE; x += 1) {
    const color = isBrandAt(x, y) ? BRAND : BACKGROUND;
    const offset = (row * SIZE + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }
}

// Mascara AND: todo opaco.
const mask = Buffer.alloc((SIZE / 8) * SIZE, 0);

const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0); // tamano de la cabecera
dib.writeInt32LE(SIZE, 4); // ancho
dib.writeInt32LE(SIZE * 2, 8); // alto = imagen + mascara
dib.writeUInt16LE(1, 12); // planos
dib.writeUInt16LE(32, 14); // bits por pixel
dib.writeUInt32LE(0, 16); // sin compresion
dib.writeUInt32LE(pixels.length + mask.length, 20);

const image = Buffer.concat([dib, pixels, mask]);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reservado
header.writeUInt16LE(1, 2); // tipo: icono
header.writeUInt16LE(1, 4); // cantidad de imagenes

const entry = Buffer.alloc(16);
entry.writeUInt8(SIZE, 0);
entry.writeUInt8(SIZE, 1);
entry.writeUInt8(0, 2); // paleta
entry.writeUInt8(0, 3); // reservado
entry.writeUInt16LE(1, 4); // planos
entry.writeUInt16LE(32, 6); // bits por pixel
entry.writeUInt32LE(image.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);

const outPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'favicon.ico',
);
writeFileSync(outPath, Buffer.concat([header, entry, image]));
console.log(`favicon.ico generado (${header.length + entry.length + image.length} bytes)`);
