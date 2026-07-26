/**
 * Regiones de Chile con su codigo ISO 3166-2.
 *
 * Blue Express espera el codigo de region en `regionCode` al resolver una
 * comuna. Las comunas no se listan aqui a proposito: en lugar de mantener un
 * padron de 346 comunas que envejece, la comuna que escribe el comprador se
 * resuelve contra el servicio geografico de Blue Express, que devuelve el
 * codigo de distrito que usa su cotizador.
 */
export type Region = { code: string; name: string };

export const CHILE_REGIONS: Region[] = [
  { code: 'CL-AP', name: 'Arica y Parinacota' },
  { code: 'CL-TA', name: 'Tarapaca' },
  { code: 'CL-AN', name: 'Antofagasta' },
  { code: 'CL-AT', name: 'Atacama' },
  { code: 'CL-CO', name: 'Coquimbo' },
  { code: 'CL-VS', name: 'Valparaiso' },
  { code: 'CL-RM', name: 'Metropolitana de Santiago' },
  { code: 'CL-LI', name: "Libertador General Bernardo O'Higgins" },
  { code: 'CL-ML', name: 'Maule' },
  { code: 'CL-NB', name: 'Nuble' },
  { code: 'CL-BI', name: 'Biobio' },
  { code: 'CL-AR', name: 'La Araucania' },
  { code: 'CL-LR', name: 'Los Rios' },
  { code: 'CL-LL', name: 'Los Lagos' },
  { code: 'CL-AI', name: 'Aysen del General Carlos Ibanez del Campo' },
  { code: 'CL-MA', name: 'Magallanes y de la Antartica Chilena' },
];

const BY_CODE = new Map(CHILE_REGIONS.map((region) => [region.code, region]));

export function regionByCode(code: string): Region | undefined {
  return BY_CODE.get(code);
}

export function regionName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

export function isValidRegionCode(code: string): boolean {
  return BY_CODE.has(code);
}
