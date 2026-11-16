import { expect } from 'vitest';

import type { BusinessId } from '@restaurante/core/shared';

import type { PageDataByBusiness, PageRepository } from '@restaurante/core/catalog';

import type { MenuRepository } from '../../src/repositories/menu-repository.ts';
import { login, type MemoryRepository, type SetupOptions, setupAdmin } from './admin.ts';

/**
 * Pruebas de /admin (REQ-F-001 y REQ-F-007) en los archivos admin-*.test.ts. REQ-F-041:
 * preparación compartida por los archivos en que se partió admin.test.ts, sin cambios.
 */

export const ADMIN_PAGES = ['/admin/molotes', '/admin/birria'];

export async function loggedIn<R extends MenuRepository = MemoryRepository>(options?: SetupOptions<R>) {
  const context = await setupAdmin(options);
  const browser = context.browser();
  const res = await login(browser);
  expect(res.status).toBe(303);
  return { ...context, browser };
}

/** Versión vigente de la página en MySQL (REQ-F-044): la que espera el formulario de /admin. */
export const versionOf = async (pages: Pick<PageRepository, 'get'>, businessId: BusinessId) => (await pages.get(businessId)).version;

/** Datos de página de un estado, con la forma de Molotes (los campos que leen las pruebas). */
export const pageOf = (state: { data: unknown }) => state.data as PageDataByBusiness['molotes'];
