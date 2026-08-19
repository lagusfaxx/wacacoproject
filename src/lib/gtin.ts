/**
 * El codigo de barras, escrito como lo espera Google.
 *
 * Es el dato que le dice a Google que el articulo de esta tienda es el mismo
 * que vende otra, y de ahi salen las notas y las comparaciones de precio que
 * muestra junto al resultado. Google acepta la propiedad generica `gtin`, pero
 * su documentacion pide ademas la que corresponde al largo del codigo —
 * `gtin13` para el EAN europeo, `gtin12` para el UPC de Estados Unidos — y con
 * las dos declaradas el emparejamiento con su catalogo es mas seguro.
 *
 * Un codigo de largo raro se declara solo como `gtin`: sera invalido y Google
 * lo ignorara, pero eso es problema del dato y no de como se escribe.
 */
export function gtinProperties(raw: string | null | undefined): Record<string, string> {
  const gtin = (raw ?? '').trim();
  if (!gtin) return {};

  // Los codigos reales son solo digitos; los guiones se ven a veces al
  // copiarlos a mano y no cambian el numero.
  const digits = gtin.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return { gtin };

  const specific = { 8: 'gtin8', 12: 'gtin12', 13: 'gtin13', 14: 'gtin14' }[digits.length];

  return specific ? { gtin: digits, [specific]: digits } : { gtin: digits };
}
