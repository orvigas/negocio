import { describe, expect, it } from 'vitest';

import { csrfOf, textOf } from '../support/bot-page.ts';
import { ELI, dom, startInventory } from '../support/browser.ts';
import { MOLOTES, MOLOTES_RESTORE, closedSession, expectClosed, pageRequests } from '../support/page-browser.ts';

/** REQ-F-044, CA-18 y RF-4: lo único que ve el personal hasta el corte (`PAGE_CUTOVER = false`). */

const WRITES: readonly [string, Record<string, string>][] = [
  [MOLOTES, { action: 'save', expectedVersion: '2@x', 'hero.showcase.title': 'Otro título' }],
  [MOLOTES, { action: 'overwrite', expectedVersion: '2@x', 'hero.showcase.title': 'Otro título' }],
  [MOLOTES_RESTORE, { expectedVersion: '2@x' }],
];

describe('sin importar: lectura', () => {
  it.each(['/birria/pagina', '/molotes/pagina/restaurar'])('administrador en %s: 200 con el aviso, sin formulario ni acciones', async (path) => {
    const { browser } = await closedSession();
    const response = await browser.get(path);
    expect(response.status).toBe(200);
    expectClosed(await response.text());
  });

  it('el editor lo ve en su negocio', async () => {
    const { browser } = await closedSession(ELI);
    const response = await browser.get(MOLOTES);
    expect(response.status).toBe(200);
    expectClosed(await response.text());
  });

  it('no parece una avería: es un estado, sin alerta ni tono de error', async () => {
    const { browser } = await closedSession();
    const html = await (await browser.get(MOLOTES)).text();
    expect(dom(html).querySelector('[role="alert"]')).toBeNull();
    expect(dom(html).querySelector('.notice--error')).toBeNull();
    expect(dom(html).querySelector('h1')?.textContent).toBe('Página');
    expect(dom(html).title).toBe('Página de Molotes | Administración');
  });

  it('nunca dice que se guardó, aunque la URL lo pida', async () => {
    const { browser } = await closedSession();
    const response = await browser.get(`${MOLOTES}?ok=saved&landing=confirmed`);
    expect(response.status).toBe(200);
    expectClosed(await response.text());
  });
});

describe('sin importar: escrituras', () => {
  it.each(WRITES)('POST %s: 409 con el mismo aviso y nada escrito', async (path, form) => {
    const { h, browser } = await closedSession();
    const csrf = await csrfOf(browser);
    const response = await browser.post(path, { _csrf: csrf, ...form });
    expect(response.status).toBe(409);
    expectClosed(await response.text());
    expect(h.api.page.writes).toEqual([]);
  });

  it('sin CSRF válido: 403, no el aviso', async () => {
    const { h, browser } = await closedSession();
    const response = await browser.post(MOLOTES, { _csrf: 'otro', action: 'save', expectedVersion: '2@x' });
    expect(response.status).toBe(403);
    expect(textOf(await response.text())).not.toContain('aún no está activa');
    expect(h.api.page.writes).toEqual([]);
  });

  it('de otro origen: 403 sin llamar a la API', async () => {
    const { h, browser } = await closedSession();
    const before = pageRequests(h).length;
    const response = await browser.post(MOLOTES, { _csrf: 'x', action: 'save' }, { origin: 'https://otro.example', 'sec-fetch-site': 'cross-site' });
    expect(response.status).toBe(403);
    expect(pageRequests(h)).toHaveLength(before);
  });

  it('una acción desconocida se rechaza antes de llamar a la API', async () => {
    const { h, browser } = await closedSession();
    const csrf = await csrfOf(browser);
    const response = await browser.post(MOLOTES, { _csrf: csrf, action: 'restore_seed' });
    expect(response.status).toBe(400);
    expect(pageRequests(h)).toEqual([]);
  });
});

describe('permisos, con la puerta cerrada', () => {
  it('editor de Molotes en otro negocio: 403 sin pedirlo a la API', async () => {
    const { h, browser } = await closedSession(ELI);
    const response = await browser.get('/birria/pagina');
    expect(response.status).toBe(403);
    const text = textOf(await response.text());
    expect(text).toContain('No tienes permiso sobre este negocio.');
    expect(text).not.toContain('aún no está activa');
    expect(pageRequests(h)).toEqual([]);
  });

  it('negocio desconocido: 404', async () => {
    const { h, browser } = await closedSession();
    expect((await browser.get('/tacos/pagina')).status).toBe(404);
    expect(pageRequests(h)).toEqual([]);
  });

  it('sin sesión: al acceso, conservando la pantalla', async () => {
    const h = await startInventory();
    const response = await h.browser().get(MOLOTES);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fpagina');
  });

  it('el POST sin sesión avisa de la sesión caducada y no escribe', async () => {
    const h = await startInventory();
    const response = await h.browser().post(MOLOTES, { _csrf: 'x', action: 'save', expectedVersion: 'x' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('expirada=1');
    expect(h.api.page.writes).toEqual([]);
  });
});

describe('una avería real no se disfraza de "aún no activa"', () => {
  it.each(['503', 'network', 'legacy'] as const)('lectura con %s: 503 común', async (failure) => {
    const { h, browser } = await closedSession();
    h.api.page.open = true;
    h.api.page.readFailure = failure;
    const response = await browser.get(MOLOTES);
    expect(response.status).toBe(503);
    const text = textOf(await response.text());
    expect(text).toContain('Servicio no disponible');
    expect(text).not.toContain('aún no está activa');
  });
});

describe('navegación', () => {
  it('"Página" aparece en cada pantalla del negocio y no fuera de él', async () => {
    const { browser } = await closedSession();
    const products = dom(await (await browser.get('/molotes/productos')).text());
    expect(products.querySelector('nav[aria-label="Secciones de Molotes"] a[href="/molotes/pagina"]')?.textContent).toBe('Página');
    expect(products.querySelector('nav[aria-label="Secciones de Molotes"] a[aria-current="true"]')?.textContent).toBe('Productos');
    const home = dom(await (await browser.get('/')).text());
    expect(home.querySelector('a[href$="/pagina"]')).toBeNull();
  });

  it('en "Página" la marca actual es de esa sección y del negocio', async () => {
    const { browser } = await closedSession();
    const page = dom(await (await browser.get('/birria/pagina')).text());
    expect(page.querySelector('nav[aria-label="Secciones de Birria El Muñeco"] a[aria-current="true"]')?.textContent).toBe('Página');
    expect(page.querySelector('nav[aria-label="Secciones"] a[aria-current="page"]')?.getAttribute('href')).toBe('/birria/productos');
    expect(page.querySelector('body')?.className).toContain('admin-shell--birria');
  });

  it('el editor solo ve la sección de su negocio', async () => {
    const { browser } = await closedSession(ELI);
    const page = dom(await (await browser.get(MOLOTES)).text());
    expect(page.querySelector('a[href="/birria/pagina"]')).toBeNull();
    expect(page.querySelector('a[href="/birria/productos"]')).toBeNull();
  });
});
