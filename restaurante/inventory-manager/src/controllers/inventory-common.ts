import { randomBytes } from 'node:crypto';

import { INVENTORY_ROLES, type AdminApiError, type AdminApiResult } from '@restaurante/contracts';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId } from '../session.ts';
import type { HeaderSection, PageContext, Views } from '../views/index.ts';
import { CATEGORIES_PATH, ITEMS_PATH } from '../views/inventory.ts';
import { RECIPES_PATH } from '../views/inventory-recipes.ts';
import type { ControllerKit, Ctx, Session } from './common.ts';

/**
 * Piezas comunes de las pantallas del inventario (REQ-F-049 y REQ-F-050): sesión con rol administrador
 * o gerente, respuestas de la API que no son de dominio (401, 403, 404 y 503) y textos compartidos.
 */

export const FORBIDDEN = 'No tienes permiso para gestionar el inventario.';
export const UNAVAILABLE = { tone: 'error' as const, title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema: no se guardó nada. Lo que escribiste sigue en el formulario; inténtalo de nuevo en unos minutos.'] };

export const queryText = (value: unknown): string => (typeof value === 'string' ? value : '');
export const newRequestId = (): string => randomBytes(18).toString('base64url');

type HttpFailure = { ok: false; kind: 'http'; status: number; error: AdminApiError };
export const httpFailure = (result: AdminApiResult<unknown>, status: number): result is HttpFailure => !result.ok && result.kind === 'http' && result.status === status;

/** Sección del inventario -> enlace de vuelta de los avisos. */
const BACK: Readonly<Partial<Record<HeaderSection, { backHref: string; backLabel: string }>>> = Object.freeze({
  inventory: { backHref: ITEMS_PATH, backLabel: 'Volver a artículos' },
  'inventory-categories': { backHref: CATEGORIES_PATH, backLabel: 'Volver a categorías' },
  'inventory-recipes': { backHref: RECIPES_PATH, backLabel: 'Volver a recetas' },
});
const backOf = (section: HeaderSection) => BACK[section] ?? { backHref: ITEMS_PATH, backLabel: 'Volver a artículos' };

export function createInventoryAccess({ config, kit, views }: { config: InventoryConfig; kit: ControllerKit; views: Views }) {
  const notFound = (ctx: Ctx, context?: PageContext, section: HeaderSection = 'inventory') => kit.notFound(ctx, { context, section, ...backOf(section) });

  /** Sesión y rol administrador o gerente (RF-9 de REQ-F-049). null si ya respondió. */
  async function inventorySession(ctx: Ctx, returnTo: string, onUnavailable?: () => boolean): Promise<Session | null> {
    const auth = await kit.session(ctx, returnTo, onUnavailable);
    if (!auth) return null;
    if (!INVENTORY_ROLES.includes(auth.user.role)) {
      kit.forbidden(ctx, auth, FORBIDDEN);
      return null;
    }
    return auth;
  }

  /** Respuestas de la API que no son de dominio: 401 -> acceso, 403, 404 y el resto -> 503. */
  function apiFailure(ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, returnTo: string, section: HeaderSection = 'inventory'): void {
    if (!result.ok && result.kind === 'http') {
      if (result.status === 401) {
        clearSessionId(ctx, config.isProduction);
        return kit.toLogin(ctx, returnTo);
      }
      if (result.status === 403 && result.error.code === 'FORBIDDEN_ROLE') return kit.forbidden(ctx, auth, FORBIDDEN);
      if (result.status === 403) {
        return kit.send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message }, context: auth, section, backHref: backOf(section).backHref, backLabel: 'Volver' }));
      }
      if (result.status === 404) return notFound(ctx, auth, section);
    }
    return kit.unavailable(ctx, kit.failureReason(result), auth, undefined, section);
  }

  return Object.freeze({ notFound, inventorySession, apiFailure });
}
