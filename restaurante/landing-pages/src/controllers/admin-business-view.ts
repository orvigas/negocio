import { toZonedIsoString, type BusinessId } from '@restaurante/core/shared';
import { canEditBusiness } from '@restaurante/core/identity';
import type { PageRepository, PageState, ProductRepository } from '@restaurante/core/catalog';
import type { Renderer } from '@restaurante/web';

import type { Config } from '../config/env.ts';
import { businessName, type AdminBusinessOptions, type LastChange } from '../views/admin/index.ts';
import { renderProductsSection } from '../views/admin/products.ts';
import type { AdminAccess, Authenticated, Permission } from './admin-access.ts';

/**
 * Página de un negocio en /admin, compartida por los controladores de menús y de productos
 * (REQ-F-008, RF-6.1): lista de productos, formulario de hero y promociones y "Último cambio".
 * Desde REQ-F-044 los datos de página salen de MySQL (`pages`), nunca de los JSON; con ADMIN_NEW_URL,
 * en solo lectura (RF-10).
 */

/** Permiso sobre un negocio (REQ-F-007, R-7). */
export const businessPermission =
  (businessId: BusinessId): Permission =>
  (user) =>
    canEditBusiness(user, businessId) ? null : `No tienes permiso para administrar ${businessName(businessId)}.`;

/** Autor verificado de un cambio: el usuario de la sesión (REQ-F-007, D-11; REQ-F-008, D-7′). */
export const authorOf = ({ user }: Authenticated): { id: number; name: string } => ({ id: user.id, name: user.displayName });

export type BusinessView = (businessId: BusinessId, auth: Authenticated, extra?: Partial<AdminBusinessOptions>) => Promise<AdminBusinessOptions>;

export function createBusinessView({
  config,
  renderer,
  pages,
  products,
  access,
}: {
  config: Config;
  renderer: Renderer;
  pages: PageRepository;
  products: ProductRepository;
  access: Pick<AdminAccess, 'pageContext'>;
}): BusinessView {
  /** "Último cambio": el más reciente entre hero/promociones (fila vigente) y productos (RF-8.4). */
  async function lastChangeOf(businessId: BusinessId, state: PageState): Promise<LastChange | null> {
    const page = state.updatedAt && state.updatedBy ? { at: state.updatedAt, by: state.updatedBy } : null;
    const product = await products.getLastChange(businessId);
    const productChange = product ? { at: toZonedIsoString(product.at, config.timezone), by: product.actorName } : null;
    if (!page) return productChange;
    if (!productChange) return page;
    return Date.parse(productChange.at) > Date.parse(page.at) ? productChange : page;
  }

  return async function businessView(businessId, auth, extra = {}) {
    // Sin datos válidos lanza PageUnavailableError: admin-guard responde 503.
    const state = await pages.get(businessId);
    const context = access.pageContext(auth);
    return {
      ...context,
      businessId,
      timezone: config.timezone,
      page: state.data,
      version: state.version,
      movedTo: config.adminNewUrl,
      lastChange: await lastChangeOf(businessId, state),
      products: renderProductsSection(renderer, { businessId, products: await products.list(businessId), csrfToken: context.csrfToken, movedTo: config.adminNewUrl }),
      ...extra,
    };
  };
}
