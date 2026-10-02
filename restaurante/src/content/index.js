import { birriaContent } from './birria/index.js';
import { commonContent } from './common/index.js';
import { molotesContent } from './molotes/index.js';

export { commonContent };

const CONTENT_BY_BUSINESS = Object.freeze({
  [molotesContent.id]: molotesContent,
  [birriaContent.id]: birriaContent,
});

/**
 * @param {'molotes'|'birria'} businessId
 * @throws {Error} Si el negocio no existe.
 */
export function getBusinessContent(businessId) {
  if (!Object.hasOwn(CONTENT_BY_BUSINESS, businessId)) {
    throw new Error(`No hay contenido para el negocio: ${businessId}`);
  }
  return CONTENT_BY_BUSINESS[businessId];
}
