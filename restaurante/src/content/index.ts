import type { BusinessId } from '../config/businesses.ts';
import { birriaContent } from './birria/index.ts';
import { commonContent } from './common/index.ts';
import { molotesContent } from './molotes/index.ts';

export { commonContent };

const CONTENT_BY_BUSINESS = Object.freeze({
  [molotesContent.id]: molotesContent,
  [birriaContent.id]: birriaContent,
});

export type BusinessContentById = typeof CONTENT_BY_BUSINESS;
export type BusinessContent = BusinessContentById[BusinessId];

/** @throws {Error} Si el negocio no existe. */
export function getBusinessContent<Id extends BusinessId>(businessId: Id): (typeof CONTENT_BY_BUSINESS)[Id] {
  if (!Object.hasOwn(CONTENT_BY_BUSINESS, businessId)) {
    throw new Error(`No hay contenido para el negocio: ${businessId}`);
  }
  return CONTENT_BY_BUSINESS[businessId];
}
