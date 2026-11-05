import { expect } from 'vitest';

import { ANA, dom, startInventory, type Browser, type Harness } from './browser.ts';

/** Atajos de las pruebas de la pantalla "Bot" (REQ-F-043). */

/** Número de prueba conocido: no debe aparecer completo en ningún HTML, URL ni log (CA-15). */
export const PHONE = '5215512345678';
export const PHONE_LOCAL = '5512345678';

export async function signedIn(user = ANA, options: Parameters<typeof startInventory>[0] = {}): Promise<{ h: Harness; browser: Browser }> {
  const h = await startInventory(options);
  const browser = h.browser();
  expect((await browser.login(user)).status).toBe(303);
  return { h, browser };
}

export async function csrfOf(browser: Browser): Promise<string> {
  const page = dom(await (await browser.get('/bot')).text());
  return page.querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';
}

export const botRequests = (h: Harness) => h.api.requests.filter((request) => request.path.includes('/bot'));
export const botWrites = (h: Harness) => botRequests(h).filter((request) => request.method !== 'GET');
export const textOf = (html: string): string => dom(html).body.textContent?.replace(/\s+/g, ' ') ?? '';
export const phoneInput = (html: string) => dom(html).querySelector<HTMLInputElement>('input[name="telefono"]');
export const durationOf = (html: string, selector = 'select[name="duracion"]'): string | undefined => dom(html).querySelector<HTMLSelectElement>(selector)?.value;
export const reasonOf = (html: string, selector = '.bot-add input[name="motivo"]'): string | undefined => dom(html).querySelector<HTMLInputElement>(selector)?.value;
