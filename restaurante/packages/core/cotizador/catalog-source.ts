import type { BusinessId } from '../shared/index.ts';
import type { QuoteCatalog } from './catalog.ts';

/**
 * Puerto del catálogo del cotizador (REQ-F-046, RF-12): el cálculo recibe el catálogo ya validado sin
 * saber de dónde viene. Hoy lo implementa un JSON de `api`; en la fase 2, la base de datos. Asíncrono
 * para no cambiar el contrato entonces.
 */
export interface QuoteCatalogSource {
  /**
   * Catálogo vigente del negocio. Lanza `QuoteNotFoundError` si el negocio no tiene cotizador y
   * `QuoteUnavailableError` si su catálogo no es válido o no se pudo leer.
   */
  load(business: BusinessId): Promise<QuoteCatalog>;
}

/** El negocio no tiene cotizador (Molotes). */
export class QuoteNotFoundError extends Error {
  constructor() {
    super('Este negocio no tiene cotizador');
    this.name = 'QuoteNotFoundError';
  }
}

/** El catálogo del negocio no es válido o no se pudo leer: el cotizador queda "no disponible". */
export class QuoteUnavailableError extends Error {
  constructor() {
    super('El cotizador no está disponible');
    this.name = 'QuoteUnavailableError';
  }
}
