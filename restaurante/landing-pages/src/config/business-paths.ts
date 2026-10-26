import { BUSINESS, type BusinessId } from '@restaurante/core/shared';

/** Ruta dedicada (y URL canónica) de cada landing. */
export const BUSINESS_PATHS: Readonly<Record<BusinessId, string>> = Object.freeze({
  [BUSINESS.MOLOTES]: '/molotes',
  [BUSINESS.BIRRIA]: '/birria',
});
