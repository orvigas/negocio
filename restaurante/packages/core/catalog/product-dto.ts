import { toZonedIsoString } from '../shared/index.ts';
import { pesos, toInput } from './product-schema.ts';
import type { ProductView } from './product-repository.ts';

/**
 * Producto -> JSON de las APIs de administración (REQ-F-008, RF-5.3): los campos de su combinación
 * con los precios en pesos (como se escriben) y en centavos, y las fechas en la zona del negocio.
 * Extraído de landing-pages/src/controllers/admin-products-api.ts (REQ-F-039): lo comparten
 * `/admin/api` y `/api/v1/admin`; `packages/contracts` (admin.ts) valida esta forma en la API.
 */
export function toProductDto(product: ProductView, timeZone: string): Record<string, unknown> {
  const zoned = (date: Date): string => toZonedIsoString(date, timeZone);
  const input = toInput(product);
  const prices: Record<string, unknown> = {};
  if ('price' in input) prices.priceCents = product.priceCents;
  if ('orderPrice' in input) prices.orderPriceCents = product.orderPriceCents;
  if ('variants' in input) {
    input.variants = product.variants.map((variant) => ({ ...variant, price: pesos(variant.priceCents) }));
  }
  return {
    id: product.id,
    business: product.business,
    category: product.category,
    detailsType: product.detailsType,
    slug: product.slug,
    ...input,
    ...prices,
    available: product.available,
    position: product.position,
    version: product.version,
    deleted: product.deleted,
    deletedAt: product.deletedAt ? zoned(product.deletedAt) : null,
    createdAt: zoned(product.createdAt),
    updatedAt: zoned(product.updatedAt),
    updatedBy: product.updatedBy ? { id: product.updatedBy.actorId, name: product.updatedBy.actorName } : null,
  };
}
