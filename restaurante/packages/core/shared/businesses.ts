/**
 * Identificadores de los negocios servidos por la aplicación.
 * Fuente única para config, servicios, contenido, rutas y vistas.
 */
export const BUSINESS = Object.freeze({
  MOLOTES: 'molotes',
  BIRRIA: 'birria',
});

export type BusinessId = (typeof BUSINESS)[keyof typeof BUSINESS];

export const BUSINESS_IDS: readonly BusinessId[] = Object.freeze(Object.values(BUSINESS));

export function isBusinessId(value: unknown): value is BusinessId {
  // Se amplía el tipo de la lista para poder buscar un string cualquiera.
  return typeof value === 'string' && (BUSINESS_IDS as readonly string[]).includes(value);
}

/**
 * Nombre visible de cada negocio (REQ-F-042, H-5): lo usan el contenido de las landings y los
 * textos del bot de WhatsApp. Es el único lugar donde se edita.
 */
export const BUSINESS_NAMES: { readonly [Id in BusinessId]: string } = Object.freeze({
  [BUSINESS.MOLOTES]: 'Moloteando',
  [BUSINESS.BIRRIA]: 'Birria El Muñeco',
});
