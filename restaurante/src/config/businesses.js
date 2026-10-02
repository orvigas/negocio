/**
 * Identificadores de los negocios servidos por la aplicación.
 * Fuente única para config, servicios, contenido, rutas y vistas.
 */
export const BUSINESS = Object.freeze({
  MOLOTES: 'molotes',
  BIRRIA: 'birria',
});

export const BUSINESS_IDS = Object.freeze(Object.values(BUSINESS));

/** Ruta dedicada (y URL canónica) de cada landing. */
export const BUSINESS_PATHS = Object.freeze({
  [BUSINESS.MOLOTES]: '/molotes',
  [BUSINESS.BIRRIA]: '/birria',
});
