import { describe, expect, it } from 'vitest';

import { reachedToken, blockRow, type BotFailure } from '../support/api-double-bot.ts';
import { dom, startInventory, type Browser, type Harness } from '../support/browser.ts';
import { PHONE, PHONE_LOCAL, csrfOf, durationOf, phoneInput, reasonOf, signedIn, textOf } from '../support/bot-page.ts';
import { freePortUrl } from '../support/ports.ts';

/**
 * Fallos de la pantalla "Bot" (REQ-F-043: RF-9, RF-12, D-4 y H-10; CA-15, CA-18), contra el doble de la
 * API. Una escritura sin confirmar nunca afirma que no se guardó, y el teléfono no vuelve a aparecer
 * por ninguna salida, ni con la API caída.
 */

const UNCONFIRMED = 'No pudimos confirmar el cambio. Revisa el estado antes de repetirlo.';
const FAILURES: BotFailure[] = ['503', '500', 'network', 'invalid', 'legacy'];

const allWrites = (csrf: string): [string, Record<string, string>][] => [
  ['/bot/interruptor', { _csrf: csrf, accion: 'pausar', motivo: 'Prueba' }],
  ['/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '30d', motivo: 'Prueba' }],
  ['/bot/bloqueos/101/quitar', { _csrf: csrf }],
  [`/bot/topes/${reachedToken(1)}/bloquear`, { _csrf: csrf, duracion: '30d', motivo: 'Prueba' }],
];

function expectNoPhone(content: string): void {
  for (const piece of [PHONE, PHONE_LOCAL, PHONE.slice(0, -4)]) expect(content).not.toContain(piece);
}

function expectLooseForm(html: string): void {
  expect(phoneInput(html)?.value).toBe('');
  expect(durationOf(html, '#b-duracion')).toBe('30d');
  expect(reasonOf(html)).toBe('Prueba');
  expectNoPhone(html);
}

async function expectUnconfirmed(response: Response, path: string): Promise<string> {
  expect(response.status, path).toBe(503);
  const html = await response.text();
  expect(dom(html).querySelector('[role="alert"]')?.textContent, path).toContain(UNCONFIRMED);
  expect(dom(html).querySelector('main a[href="/bot"]')?.textContent, path).toBe('Revisar el estado del bot');
  expect(textOf(html).toLowerCase(), path).not.toContain('no se guardó');
  return html;
}

async function preparedAdmin(options: Parameters<typeof startInventory>[0] = {}): Promise<{ h: Harness; browser: Browser; csrf: string }> {
  const { h, browser } = await signedIn(undefined, options);
  h.api.bot.state.reached.push({ token: reachedToken(1), masked: '*********1111', cap: 'messages', at: '2026-11-05T09:00:00-06:00' });
  h.api.bot.state.blocks.push(blockRow(101, '4321'));
  return { h, browser, csrf: await csrfOf(browser) };
}

describe('leer con la API caída (CA-18)', () => {
  it.each<BotFailure>(['503', '500', 'network', 'invalid', 'legacy'])('%s: 503 con aviso, sin detalles internos', async (failure) => {
    const { h, browser } = await signedIn();
    h.api.bot.readFailure = failure;
    const response = await browser.get('/bot');
    expect(response.status).toBe(503);
    const html = await response.text();
    expect(html).toContain('Servicio no disponible.');
    expect(html).not.toContain('SELECT');
    expect(html).not.toContain('No encontramos');
  });

  it('con la sesión sin poder comprobarse, también 503', async () => {
    const { h, browser } = await signedIn();
    h.api.mode = 'down';
    expect((await browser.get('/bot')).status).toBe(503);
  });
});

describe('escritura sin confirmar (RF-12, CA-18)', () => {
  it.each(FAILURES)('%s en cada acción: 503, invita a revisar y no afirma que no se guardó', async (failure) => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.bot.writeFailure = failure;
    for (const [path, form] of allWrites(csrf)) {
      const html = await expectUnconfirmed(await browser.post(path, form), path);
      expect(html).not.toContain('SELECT');
    }
  });

  it('tiempo agotado: mismo aviso', async () => {
    const { h, browser, csrf } = await preparedAdmin({ apiTimeoutMs: 250 });
    h.api.bot.writeFailure = 'slow';
    await expectUnconfirmed(await browser.post('/bot/interruptor', { _csrf: csrf, accion: 'pausar' }), 'interruptor');
  });

  it('`writes-down`: la sesión responde y la escritura no', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.mode = 'writes-down';
    await expectUnconfirmed(await browser.post('/bot/bloqueos/101/quitar', { _csrf: csrf }), 'quitar');
  });

  it('el fallo se registra sin datos: solo la ruta y el motivo técnico', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.bot.writeFailure = '503';
    await browser.post('/bot/interruptor', { _csrf: csrf, accion: 'pausar' });
    const line = h.logger.lines.find((entry) => entry.includes('api_unavailable'));
    expect(line).toContain('"reason":"http_503"');
    expect(line).toContain('"path":"/bot/interruptor"');
  });
});

describe('API anterior, sin estas rutas (H-10)', () => {
  it('un 404 `NOT_FOUND` no se confunde con "no encontrado"', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.bot.readFailure = 'legacy';
    h.api.bot.writeFailure = 'legacy';
    for (const [path, form] of allWrites(csrf)) {
      const html = await expectUnconfirmed(await browser.post(path, form), path);
      expect(html).not.toContain('ya no está en la lista');
      expect(html).not.toContain('No encontramos');
    }
  });
});

describe('teléfono tras un alta fallida (D-4)', () => {
  it.each(FAILURES)('%s: formulario suelto con teléfono vacío, y duración y motivo conservados', async (failure) => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.bot.writeFailure = failure;
    const html = await expectUnconfirmed(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '30d', motivo: 'Prueba' }), 'alta');
    expectLooseForm(html);
    expect(dom(html).querySelector('input[name="_csrf"]')?.getAttribute('value')).toBe(csrf);
  });

  it('API caída, sin poder comprobar la sesión: igual, sin cabecera y con el `_csrf` recibido', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.mode = 'down';
    const html = await expectUnconfirmed(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '30d', motivo: 'Prueba' }), 'alta');
    expectLooseForm(html);
    expect(dom(html).querySelector('.admin-header')).toBeNull();
    expect(dom(html).querySelector('input[name="_csrf"]')?.getAttribute('value')).toBe(csrf);
  });

  it('API inaccesible de verdad: igual', async () => {
    const { browser: signed, csrf } = await preparedAdmin();
    const browser = (await startInventory({ apiUrl: await freePortUrl(), apiTimeoutMs: 500 })).browser();
    for (const [name, value] of signed.cookies) browser.cookies.set(name, value);
    expectLooseForm(await expectUnconfirmed(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '30d', motivo: 'Prueba' }), 'alta'));
  });

  it('error de validación y, además, estado sin poder leer: igual', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.bot.readFailure = '503';
    const response = await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: '123', duracion: '30d', motivo: 'Prueba' });
    expect(response.status).toBe(503);
    expect(phoneInput(await response.text())?.value).toBe('');
  });

  it('un motivo con un posible teléfono tampoco se conserva con la API caída', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    h.api.mode = 'down';
    const html = await (await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '30d', motivo: `avisar a ${PHONE_LOCAL}` })).text();
    expect(reasonOf(html)).toBe('');
    expectNoPhone(html);
  });
});

describe('privacidad en inventory-manager (CA-15)', () => {
  it('un alta correcta y otra fallida no dejan el número en HTML, URL ni logs', async () => {
    const { h, browser, csrf } = await preparedAdmin();
    const seen: string[] = [];
    const record = async (response: Response) => {
      seen.push(response.headers.get('location') ?? '', await response.text());
    };
    await record(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' }));
    await record(await browser.get('/bot?ok=blocked&n=5678'));
    await record(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' }));
    await record(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: `+${PHONE}x`, duracion: 'nope' }));
    h.api.bot.writeFailure = '503';
    await record(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' }));
    h.api.mode = 'down';
    await record(await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' }));

    expect(seen.join('')).toContain('/bot?ok=blocked&n=5678');
    expectNoPhone(seen.join('\n'));
    expect(h.logger.lines.length).toBeGreaterThan(0);
    expectNoPhone(h.logger.lines.join('\n'));
    expect(h.logger.lines.join('\n')).not.toContain('"telefono"');
  });
});
