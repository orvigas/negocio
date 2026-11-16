import { expect } from 'vitest';

import { signedIn, textOf } from './bot-page.ts';
import { ANA, dom, formFields, startInventory, type Browser, type Harness } from './browser.ts';

/** Atajos de las pruebas de la pantalla "Página" (REQ-F-044). */

export const CLOSED_TITLE = 'La página no está disponible en este momento.';
export const CLOSED_TEXT = 'No se cambió nada. Inténtalo en unos minutos; si sigue igual, avisa al administrador.';
export const UNCONFIRMED = 'No pudimos confirmar el cambio. Revisa la página antes de repetirlo.';
export const MOLOTES = '/molotes/pagina';
export const MOLOTES_RESTORE = `${MOLOTES}/restaurar`;
export const TITLE = 'hero.showcase.title';

type Options = Parameters<typeof startInventory>[0];

/** Sesión con la página "no disponible" (datos sin importar o fila dañada). */
export const closedSession = (user = ANA, options: Options = {}): Promise<{ h: Harness; browser: Browser }> => signedIn(user, options);

/** Sesión con la página disponible en el doble. */
export async function openSession(user = ANA, options: Options = {}): Promise<{ h: Harness; browser: Browser }> {
  const session = await signedIn(user, options);
  session.h.api.page.open = true;
  return session;
}

/** Abre el formulario y devuelve sus campos como los enviaría el navegador. */
export async function formOf(browser: Browser, path = MOLOTES): Promise<Record<string, string>> {
  const response = await browser.get(path);
  expect(response.status).toBe(200);
  return formFields(await response.text(), '#page-form');
}

export const save = (fields: Record<string, string>, action = 'save') => ({ ...fields, action });

export const pageRequests = (h: Harness) => h.api.requests.filter((request) => request.path.endsWith('/pagina') || request.path.endsWith('/pagina/restaurar'));

export const fieldValue = (html: string, name: string): string | undefined => dom(html).querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value;

export const noticeRole = (html: string): string | null | undefined => dom(html).querySelector('main .notice')?.getAttribute('role');

/** Lo que no debe ver quien abre la pantalla cerrada, ni en la respuesta a una escritura. */
export function expectClosed(html: string): void {
  const page = dom(html);
  const main = page.querySelector('main');
  const text = textOf(html);
  expect(text).toContain(CLOSED_TITLE);
  expect(text).toContain(CLOSED_TEXT);
  expect(noticeRole(html)).toBe('status');
  expect(main?.querySelectorAll('form, input, textarea, button')).toHaveLength(0);
  // Sin enlace: la edición no está en otro sitio.
  expect(main?.querySelector('a')).toBeNull();
  expect(text).not.toContain('Servicio no disponible');
  expect(text).not.toContain('Cambios guardados');
}
