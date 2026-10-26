import type { BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import type { MenuRepository } from '../repositories/menu-repository.ts';
import type { ProductRepository } from '../repositories/product-repository.ts';
import { canEditBusiness } from '../services/authorization.ts';
import { toZonedIsoString } from '../utils/datetime.ts';
import { businessName, type AdminBusinessOptions, type LastChange } from '../views/admin/index.ts';
import { renderProductsSection } from '../views/admin/products.ts';
import type { Renderer } from '../views/render.ts';
import type { AdminAccess, Authenticated, Permission } from './admin-access.ts';

/**
 * Página de un negocio en /admin, compartida por los controladores de menús y de productos
 * (REQ-F-008, RF-6.1): lista de productos, formulario de hero y promociones y "Último cambio".
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
  repository,
  products,
  access,
}: {
  config: Config;
  renderer: Renderer;
  repository: MenuRepository;
  products: ProductRepository;
  access: Pick<AdminAccess, 'pageContext'>;
}): BusinessView {
  /** "Último cambio": el más reciente entre hero/promociones (JSON) y productos (RF-8.4). */
  async function lastChangeOf(businessId: BusinessId): Promise<LastChange | null> {
    const page = await repository.getLastChange(businessId);
    const product = await products.getLastChange(businessId);
    const productChange = product ? { at: toZonedIsoString(product.at, config.timezone), by: product.actorName } : null;
    if (!page) return productChange;
    if (!productChange) return page;
    return Date.parse(productChange.at) > Date.parse(page.at) ? productChange : page;
  }

  return async function businessView(businessId, auth, extra = {}) {
    const edit = await repository.getForEdit(businessId);
    const context = access.pageContext(auth);
    return {
      ...context,
      businessId,
      timezone: config.timezone,
      document: edit.document,
      version: edit.version,
      damaged: edit.damaged,
      lastChange: await lastChangeOf(businessId),
      products: renderProductsSection(renderer, { businessId, products: await products.list(businessId), csrfToken: context.csrfToken }),
      ...extra,
    };
  };
}
