/**
 * Genera las ilustraciones SVG del catalogo.
 *
 * El diseno de referencia usa fotografia de producto, que no podemos
 * redistribuir aqui. En su lugar se dibujan siluetas de linea con el mismo
 * lenguaje visual que los iconos de coleccion de Wacaco. Al ser SVG generado
 * el sitio no depende de ningun host de imagenes externo.
 *
 * Uso: node scripts/generate-art.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/products');
const iconDir = resolve(root, 'public/collections');

const INK = '#1C1B1A';

/**
 * Envuelve las figuras en un lienzo cuadrado.
 *
 * El fondo se deja transparente a proposito: el color lo pone el contenedor
 * (tarjeta de producto, hero, miniatura del carrito), asi que la misma
 * ilustracion sirve sobre arena, blanco o un degradado oscuro sin dejar un
 * recuadro visible.
 */
function canvas(children, { size = 480 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
  <g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
${children.map((line) => `    ${line}`).join('\n')}
  </g>
</svg>
`;
}

function ribs(x, y, width, count, gap) {
  return Array.from(
    { length: count },
    (_, i) => `<line x1="${x}" y1="${y + i * gap}" x2="${x + width}" y2="${y + i * gap}"/>`,
  );
}

/** Maquina de espresso vertical: cuerpo alto con estrias y tapa. */
function towerMachine({ accent, ribCount = 7, badge = null }) {
  return [
    `<rect x="168" y="92" width="144" height="292" rx="26"/>`,
    `<path d="M168 150h144"/>`,
    ...ribs(184, 236, 112, ribCount, 18),
    `<rect x="196" y="60" width="88" height="34" rx="14"/>`,
    accent ? `<rect x="168" y="150" width="144" height="20" fill="${accent}" stroke="none"/>` : '',
    badge ?? `<circle cx="240" cy="196" r="20"/>`,
    `<path d="M150 384h180"/>`,
  ].filter(Boolean);
}

/** Maquina compacta: cuerpo bajo y ancho con dial frontal. */
function compactMachine({ accent }) {
  return [
    `<rect x="140" y="176" width="200" height="176" rx="30"/>`,
    `<circle cx="240" cy="264" r="46"/>`,
    `<circle cx="240" cy="264" r="18"/>`,
    `<rect x="188" y="128" width="104" height="52" rx="18"/>`,
    accent ? `<rect x="140" y="330" width="200" height="22" rx="11" fill="${accent}" stroke="none"/>` : '',
    `<path d="M124 352h232"/>`,
  ].filter(Boolean);
}

/** Cafetera manual horizontal con taza acoplada. */
function handheldMachine({ accent }) {
  return [
    `<rect x="96" y="196" width="196" height="112" rx="42"/>`,
    ...ribs(120, 224, 148, 4, 22),
    `<path d="M292 224h44a26 26 0 0 1 0 56h-44"/>`,
    `<path d="M336 252h32"/>`,
    `<path d="M348 236v32"/>`,
    accent ? `<rect x="96" y="286" width="196" height="22" rx="11" fill="${accent}" stroke="none"/>` : '',
    `<path d="M120 344h240"/>`,
    `<path d="M170 344l16 44h108l16-44"/>`,
  ].filter(Boolean);
}

/** Prensa/vaso tipo tumbler. */
function tumbler({ accent }) {
  return [
    `<path d="M172 100h136l-16 284a20 20 0 0 1-20 18h-64a20 20 0 0 1-20-18z"/>`,
    `<rect x="160" y="70" width="160" height="34" rx="16"/>`,
    `<path d="M178 200h124"/>`,
    accent ? `<path d="M180 232h120l-4 60h-112z" fill="${accent}" stroke="none"/>` : '',
    `<path d="M196 292h88"/>`,
  ].filter(Boolean);
}

/** Cafetera de goteo: cono sobre jarra de vidrio. */
function pourOver({ accent }) {
  return [
    `<path d="M140 128h200l-72 96h-56z"/>`,
    `<path d="M212 224h56v28h-56z"/>`,
    `<path d="M168 252h144l-14 116a24 24 0 0 1-24 22h-68a24 24 0 0 1-24-22z"/>`,
    accent ? `<path d="M176 320h128l-8 48h-112z" fill="${accent}" stroke="none"/>` : '',
    `<path d="M186 300h108"/>`,
  ].filter(Boolean);
}

/** Molinillo / termo cilindrico esbelto. */
function slimTube({ accent }) {
  return [
    `<rect x="192" y="84" width="96" height="312" rx="44"/>`,
    `<path d="M192 148h96"/>`,
    `<path d="M192 324h96"/>`,
    ...ribs(206, 190, 68, 5, 24),
    accent ? `<rect x="192" y="148" width="96" height="18" fill="${accent}" stroke="none"/>` : '',
  ].filter(Boolean);
}

/** Grupo de accesorios: tres piezas pequenas. */
function gearSet({ accent }) {
  return [
    `<rect x="76" y="196" width="96" height="160" rx="22"/>`,
    `<path d="M76 240h96"/>`,
    `<rect x="196" y="152" width="104" height="204" rx="26"/>`,
    ...ribs(214, 210, 68, 5, 22),
    `<rect x="324" y="212" width="88" height="144" rx="20"/>`,
    accent ? `<rect x="196" y="334" width="104" height="22" rx="10" fill="${accent}" stroke="none"/>` : '',
    `<path d="M60 356h368"/>`,
  ].filter(Boolean);
}

const PRODUCT_ART = {
  pixapresso: towerMachine({ accent: '#4A3B3B', ribCount: 6 }),
  'pixapresso-burgundy': towerMachine({ accent: '#7C2C34', ribCount: 6 }),
  'pixapresso-olive': towerMachine({ accent: '#6B7042', ribCount: 6 }),
  picopresso: compactMachine({ accent: '#2C2C2C' }),
  'minipresso-gr2': compactMachine({ accent: '#8A8C7A' }),
  'minipresso-ns2': compactMachine({ accent: '#C8C3B4' }),
  nanopresso: handheldMachine({ accent: '#2C2C2C' }),
  'nanopresso-red': handheldMachine({ accent: '#B4342C' }),
  prestina: tumbler({ accent: '#B08968' }),
  pipamoka: slimTube({ accent: '#3E4B3F' }),
  cuppamoka: pourOver({ accent: '#C08A4E' }),
  octaroma: slimTube({ accent: '#8A8C7A' }),
  nanovessel: gearSet({ accent: '#6E6A62' }),
  'barista-kit': gearSet({ accent: '#E1580E' }),
  'travel-case': gearSet({ accent: '#3A3A3A' }),
};

const COLLECTION_ART = {
  'powered-espresso-maker': towerMachine({ accent: null, ribCount: 6 }),
  'manual-espresso-makers': handheldMachine({ accent: null }),
  'coffee-makers': pourOver({ accent: null }),
  'coffee-gear': gearSet({ accent: null }),
};

mkdirSync(outDir, { recursive: true });
mkdirSync(iconDir, { recursive: true });

for (const [name, shapes] of Object.entries(PRODUCT_ART)) {
  writeFileSync(resolve(outDir, `${name}.svg`), canvas(shapes));
}

for (const [name, shapes] of Object.entries(COLLECTION_ART)) {
  writeFileSync(resolve(iconDir, `${name}.svg`), canvas(shapes));
}

console.log(
  `Generadas ${Object.keys(PRODUCT_ART).length} ilustraciones de producto y ${
    Object.keys(COLLECTION_ART).length
  } iconos de coleccion.`,
);
