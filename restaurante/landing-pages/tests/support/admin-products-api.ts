import { expect } from 'vitest';

import { login, setupAdmin, type Browser } from './admin.ts';
import { VALID_INPUTS } from './products.ts';

/**
 * API JSON de productos (REQ-F-008) en los archivos admin-products-api-*.test.ts (no confundir con
 * admin-products-api-permissions). REQ-F-041: preparación compartida por los archivos en que se
 * partió admin-products-api.test.ts, sin cambios.
 */

export const API = '/admin/api';
export const products = (business: string) => `${API}/${business}/productos`;

/** Sesión iniciada y token CSRF leído de GET /admin/api/sesion. */
export async function apiSession(browser: Browser) {
  const res = await browser.get(`${API}/sesion`);
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

export async function adminApi(options: Parameters<typeof setupAdmin>[0] = {}) {
  const context = await setupAdmin(options);
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  const csrf = await apiSession(browser);
  const send = (method: 'post' | 'put' | 'delete', path: string, body?: unknown) => {
    const req = browser[method](path).set('X-CSRF-Token', csrf);
    return body === undefined ? req : req.send(body as object);
  };
  /** Total de cambios registrados (para comprobar que algo no escribió). */
  const changeCount = () => context.prisma.productChange.count();
  return { ...context, browser, csrf, send, changeCount };
}

export const molotesDrink = { category: 'bebida', ...VALID_INPUTS.molotesBebida };
