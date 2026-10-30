import { expect } from 'vitest';

import { formFields, login, setupAdmin, type Browser, type FormFields } from './admin.ts';

/**
 * Productos en /admin (REQ-F-008) en los archivos admin-products-*.test.ts. REQ-F-041: preparación
 * compartida por los archivos en que se partió admin-products.test.ts, sin cambios.
 */

export const PRODUCT_FORM = '#product-form';

export async function loggedIn(options: Parameters<typeof setupAdmin>[0] = {}) {
  const context = await setupAdmin(options);
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  return { ...context, browser };
}

/** Id de un producto por su slug. */
export async function idOf(products: Awaited<ReturnType<typeof setupAdmin>>['products'], business: 'molotes' | 'birria', slug: string): Promise<number> {
  const product = (await products.list(business, { includeDeleted: true })).find((candidate) => candidate.slug === slug);
  if (!product) throw new Error(`No existe ${slug}`);
  return product.id;
}

/** Abre el formulario de un producto y devuelve sus campos tal como los enviaría el navegador. */
export async function openProduct(browser: Browser, path: string) {
  const page = await browser.get(path);
  expect(page.status, path).toBe(200);
  return { page, fields: formFields(page.text, PRODUCT_FORM) };
}

export function send(browser: Browser, path: string, fields: FormFields, changes: Record<string, string | undefined> = {}) {
  const body: Record<string, string | undefined> = { ...fields, ...changes };
  for (const [name, value] of Object.entries(changes)) if (value === undefined) delete body[name];
  return browser.post(path).type('form').send(body);
}

export const editPath = (business: string, id: number) => `/admin/${business}/productos/${id}`;
export const updateAction = { action: 'update' };
