import { describe, expect, it } from 'vitest';

import { reachedToken, blockRow } from '../support/api-double-bot.ts';
import { ANA, ELI, dom, startInventory } from '../support/browser.ts';
import { PHONE, botRequests, botWrites, csrfOf, signedIn } from '../support/bot-page.ts';

/**
 * Acceso a la pantalla "Bot" (REQ-F-043: RF-1, RF-13; CA-1, CA-2 y CA-21), contra el doble de la API.
 * Que el rol y el CSRF los impone la API real se prueba en `api/tests/integration/admin-bot-api.test.ts`.
 */

const ACTIONS: [string, Record<string, string>][] = [
  ['/bot/interruptor', { accion: 'pausar' }],
  ['/bot/bloqueos', { telefono: PHONE, duracion: '7d' }],
  ['/bot/bloqueos/101/quitar', {}],
  [`/bot/topes/${reachedToken(1)}/bloquear`, { duracion: '7d' }],
];

describe('administradores y editores (RF-1, CA-1)', () => {
  it('el enlace "Bot" solo lo ve un administrador, marcado como la sección actual', async () => {
    const { browser } = await signedIn();
    const page = dom(await (await browser.get('/bot')).text());
    const links = [...page.querySelectorAll('.admin-header__nav a')].map((link) => link.textContent);
    expect(links).toEqual(['Molotes', 'Birria El Muñeco', 'Usuarios', 'Bot']);
    expect(page.querySelector('.admin-header__nav a[aria-current="page"]')?.textContent).toBe('Bot');

    const editor = await signedIn(ELI);
    const home = dom(await (await editor.browser.get('/molotes/productos')).text());
    expect([...home.querySelectorAll('.admin-header__nav a')].map((link) => link.textContent)).toEqual(['Molotes']);
  });

  it('un editor recibe 403 sin datos en la pantalla y en cada acción, sin ninguna llamada de datos a la API', async () => {
    const { h, browser } = await signedIn(ELI);
    h.api.bot.state.blocks.push(blockRow(101, '4321'));
    const response = await browser.get('/bot');
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('No tienes permiso para gestionar el bot.');
    expect(body).not.toContain('4321');
    for (const [path, form] of ACTIONS) expect((await browser.post(path, form)).status, path).toBe(403);
    expect(botRequests(h)).toEqual([]);
  });

  it('sin sesión: al acceso con el retorno a /bot, y un POST avisa de la sesión caducada', async () => {
    const h = await startInventory();
    const browser = h.browser();
    const response = await browser.get('/bot');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/acceso?next=%2Fbot');
    for (const [path, form] of ACTIONS) {
      const post = await browser.post(path, form);
      expect(post.status, path).toBe(303);
      expect(post.headers.get('location')).toBe('/acceso?next=%2Fbot&expirada=1');
    }
    expect(botRequests(h)).toEqual([]);
  });

  it('si la API deja de aceptar la sesión al leer o escribir, se vuelve al acceso sin el teléfono en la URL', async () => {
    const { h, browser } = await signedIn();
    const csrf = await csrfOf(browser);
    h.api.bot.writeFailure = 'expired';
    const write = await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' });
    expect(write.status).toBe(303);
    expect(write.headers.get('location')).toBe('/acceso?next=%2Fbot&expirada=1');

    const again = await signedIn();
    again.h.api.bot.readFailure = 'expired';
    const read = await again.browser.get('/bot');
    expect(read.status).toBe(303);
    expect(read.headers.get('location')).toBe('/acceso?next=%2Fbot');
  });

  it('si el rol cambia entre la sesión y la acción, 403 sin datos (lo decide la API)', async () => {
    const { h, browser } = await signedIn();
    const csrf = await csrfOf(browser);
    h.api.bot.writeFailure = 'forbidden';
    const response = await browser.post('/bot/interruptor', { _csrf: csrf, accion: 'pausar' });
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('No tienes permiso para gestionar el bot.');
  });
});

describe('formularios (RF-1, CA-2)', () => {
  it('sin token CSRF válido, 403 en cada acción y nada cambia', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.blocks.push(blockRow(101, '4321'));
    for (const [path, form] of ACTIONS) {
      for (const token of ['', 'token-incorrecto']) {
        const response = await browser.post(path, { _csrf: token, ...form });
        expect(response.status, path).toBe(403);
        expect(await response.text()).not.toContain(PHONE);
      }
    }
    expect(h.api.bot.state.control.paused).toBe(false);
    expect(h.api.bot.state.blocks).toHaveLength(1);
  });

  it('otro origen: 403 sin llamar a la API', async () => {
    const { h, browser } = await signedIn();
    const csrf = await csrfOf(browser);
    const before = h.api.requests.length;
    for (const [path, form] of ACTIONS) {
      const response = await browser.post(path, { _csrf: csrf, ...form }, { origin: 'http://otro.example', 'sec-fetch-site': 'cross-site' });
      expect(response.status, path).toBe(403);
    }
    expect(h.api.requests.length).toBe(before);
  });

  it('un campo desconocido da 400 y una acción desconocida también, sin escribir', async () => {
    const { h, browser } = await signedIn();
    const csrf = await csrfOf(browser);
    for (const [path, form] of ACTIONS) expect((await browser.post(path, { _csrf: csrf, ...form, extra: '1' })).status, path).toBe(400);
    expect((await browser.post('/bot/interruptor', { _csrf: csrf, accion: 'apagar' })).status).toBe(400);
    expect(botWrites(h)).toEqual([]);
  });
});

describe('sin JavaScript y con teclado (RF-13, CA-21)', () => {
  it('HTML semántico: un h1, una sección por tema, sin tablas ni manejadores en línea', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push({ token: reachedToken(1), masked: '*********1111', cap: 'messages', at: '2026-11-05T09:00:00-06:00' });
    h.api.bot.state.blocks.push(blockRow(101, '4321'));
    const html = await (await browser.get('/bot')).text();
    const page = dom(html);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect([...page.querySelectorAll('main h2')].map((title) => title.textContent)).toEqual(['Estado', 'Uso', 'Alcanzaron un tope hoy', 'Lista negra', 'Bloquear un número']);
    for (const section of page.querySelectorAll('main section')) expect(page.getElementById(section.getAttribute('aria-labelledby') ?? '')?.tagName).toBe('H2');
    expect(page.querySelector('table')).toBeNull();
    expect(html).not.toMatch(/\son[a-z]+="/);
  });

  it('cada formulario funciona solo con HTML: POST al mismo origen, con CSRF y botón de envío', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push({ token: reachedToken(1), masked: '*********1111', cap: 'messages', at: '2026-11-05T09:00:00-06:00' });
    h.api.bot.state.blocks.push(blockRow(101, '4321'));
    const page = dom(await (await browser.get('/bot')).text());
    const forms = [...page.querySelectorAll<HTMLFormElement>('main form')];
    expect(forms.map((form) => form.getAttribute('action'))).toEqual(['/bot/interruptor', `/bot/topes/${reachedToken(1)}/bloquear`, '/bot/bloqueos/101/quitar', '/bot/bloqueos']);
    for (const form of forms) {
      expect(form.getAttribute('method')).toBe('post');
      expect(form.querySelector('input[name="_csrf"]')).not.toBeNull();
      expect(form.querySelector('button[type="submit"]')?.textContent?.trim()).not.toBe('');
    }
  });

  it('todos los controles tienen etiqueta propia, ids únicos y ninguno sale del orden del teclado', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push(
      { token: reachedToken(1), masked: '*********1111', cap: 'messages', at: '2026-11-05T09:00:00-06:00' },
      { token: reachedToken(2), masked: '*********1111', cap: 'burst', at: '2026-11-05T09:01:00-06:00' },
    );
    const page = dom(await (await browser.get('/bot')).text());
    const controls = [...page.querySelectorAll<HTMLInputElement>('main input:not([type="hidden"]), main select')];
    const labels = controls.map((control) => page.querySelector(`label[for="${control.id}"]`)?.textContent?.trim());
    expect(labels.every(Boolean)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
    const ids = [...page.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(page.querySelector('[tabindex]:not([tabindex="-1"])')).toBeNull();
    const buttons = [...page.querySelectorAll('.bot-row__form button')].map((button) => button.textContent);
    expect(new Set(buttons).size).toBe(2);
  });

  it('el campo de teléfono no recuerda valores y pide teclado numérico', async () => {
    const { browser } = await signedIn(ANA);
    const input = dom(await (await browser.get('/bot')).text()).querySelector<HTMLInputElement>('input[name="telefono"]');
    expect(input?.getAttribute('autocomplete')).toBe('off');
    expect(input?.getAttribute('inputmode')).toBe('tel');
    expect(input?.getAttribute('value')).toBe('');
  });
});
