import { describe, expect, it } from 'vitest';

import { STAFF_PHONE, blockRow, masked, reachedToken } from '../support/api-double-bot.ts';
import { dom } from '../support/browser.ts';
import { PHONE, botWrites, csrfOf, durationOf, phoneInput, reasonOf, signedIn, textOf } from '../support/bot-page.ts';

/**
 * Acciones de la pantalla "Bot" sin JavaScript, con POST/redirect/GET (REQ-F-043: RF-2 a RF-8; CA-3 a
 * CA-8, CA-10, CA-12 a CA-14, CA-19 y CA-20), contra el doble de la API. El efecto real en el bot, la
 * auditoría y las reglas de core se prueban en `api/tests` y `landing-pages/tests`.
 */

const ENTRY = { token: reachedToken(1), masked: masked('1111'), cap: 'messages' as const, at: '2026-11-05T09:30:00-06:00' };

describe('estado y uso (RF-2, RF-4; CA-12, CA-20)', () => {
  it('muestra el proveedor real y, sin configurar, "Desactivado" con la pausa disponible', async () => {
    const { h, browser } = await signedIn();
    expect(textOf(await (await browser.get('/bot')).text())).toContain('Habilitado (Meta)');
    h.api.bot.state.status = { enabled: true, provider: 'twilio' };
    expect(textOf(await (await browser.get('/bot')).text())).toContain('Habilitado (Twilio)');

    h.api.bot.state.status = { enabled: false, provider: null };
    const html = await (await browser.get('/bot')).text();
    expect(textOf(html)).toContain('Desactivado');
    expect(dom(html).querySelector('.bot-switch input[name="accion"]')?.getAttribute('value')).toBe('pausar');
    const csrf = await csrfOf(browser);
    expect((await browser.post('/bot/interruptor', { _csrf: csrf, accion: 'pausar' })).headers.get('location')).toBe('/bot?ok=paused');
    expect(h.api.bot.state.control.paused).toBe(true);
  });

  it('muestra los 5 contadores con usado, tope y estado en texto, periodos y zona, sin ningún control de topes', async () => {
    const { browser } = await signedIn();
    const page = dom(await (await browser.get('/bot')).text());
    const cards = [...page.querySelectorAll('.bot-usage__item')].map((card) => card.textContent?.replace(/\s+/g, ' ').trim());
    expect(cards).toEqual([
      'Avisos al personal (hoy) Usado: 3 de 50 Disponible',
      'Avisos al personal (mes) Usado: 900 de 900 Alcanzado',
      'Mensajes del bot (hoy) Usado: 120 de 500 Disponible',
      'Mensajes del bot (mes) Usado: 4000 de 9000 Disponible',
      'Gasto estimado del mes (USD) Usado: 12.50 de 25.00 Disponible',
    ]);
    const usage = page.querySelector('section[aria-labelledby="bot-usage-title"]');
    expect(usage?.textContent).toContain('Día 2026-11-05, mes 2026-11, zona horaria America/Mexico_City');
    expect(usage?.querySelector('input, select, button, form')).toBeNull();
  });
});

describe('pausa y reanudación (RF-3; CA-3, CA-4)', () => {
  it('pausa con motivo y muestra autor, fecha y motivo; después reanuda', async () => {
    const { h, browser } = await signedIn();
    const pause = await browser.post('/bot/interruptor', { _csrf: await csrfOf(browser), accion: 'pausar', motivo: 'Gasto raro' });
    expect(pause.status).toBe(303);
    expect(pause.headers.get('location')).toBe('/bot?ok=paused');
    expect(botWrites(h).at(-1)).toMatchObject({ method: 'PUT', body: { paused: true, reason: 'Gasto raro' } });

    const html = await (await browser.get('/bot?ok=paused')).text();
    const text = textOf(html);
    expect(dom(html).querySelector('[role="status"]')?.textContent).toContain('Bot pausado');
    expect(text).toContain('Pausado');
    expect(text).toContain('Ana Admin, 05/11/2026 12:00');
    expect(text).toContain('Motivo: Gasto raro');
    expect(dom(html).querySelector('.bot-switch button')?.textContent).toBe('Reanudar bot');

    const resume = await browser.post('/bot/interruptor', { _csrf: await csrfOf(browser), accion: 'reanudar', motivo: '' });
    expect(resume.headers.get('location')).toBe('/bot?ok=resumed');
    expect(botWrites(h).at(-1)?.body).toEqual({ paused: false });
    expect(h.api.bot.state.control.paused).toBe(false);
  });

  it('un motivo con teléfono da 422 junto al campo, no se vuelve a pintar y el estado no cambia', async () => {
    const { h, browser } = await signedIn();
    const response = await browser.post('/bot/interruptor', { _csrf: await csrfOf(browser), accion: 'pausar', motivo: `llamar al ${PHONE}` });
    expect(response.status).toBe(422);
    const html = await response.text();
    const field = dom(html).querySelector<HTMLInputElement>('#b-motivo-interruptor');
    expect(field?.value).toBe('');
    expect(field?.getAttribute('aria-invalid')).toBe('true');
    expect(field?.getAttribute('aria-describedby')).toBe('b-motivo-interruptor-error');
    expect(dom(html).querySelector('[role="alert"] a')?.getAttribute('href')).toBe('#b-motivo-interruptor');
    expect(html).not.toContain(PHONE);
    expect(h.api.bot.state.control.paused).toBe(false);
  });

  it('un motivo demasiado largo da 422 y se conserva para corregirlo', async () => {
    const { browser } = await signedIn();
    const long = 'x'.repeat(201);
    const response = await browser.post('/bot/interruptor', { _csrf: await csrfOf(browser), accion: 'pausar', motivo: long });
    expect(response.status).toBe(422);
    expect(dom(await response.text()).querySelector<HTMLInputElement>('#b-motivo-interruptor')?.value).toBe(long);
  });
});

describe('alta manual (RF-7; CA-5, CA-6, CA-13)', () => {
  it('bloquea por 7 días: el teléfono solo va en el cuerpo y la lista lo muestra enmascarado', async () => {
    const { h, browser } = await signedIn();
    const response = await browser.post('/bot/bloqueos', { _csrf: await csrfOf(browser), telefono: PHONE, duracion: '7d', motivo: 'Abuso' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/bot?ok=blocked&n=5678');
    expect(botWrites(h).at(-1)).toMatchObject({ method: 'POST', body: { phone: PHONE, duration: '7d', reason: 'Abuso' } });

    const html = await (await browser.get('/bot?ok=blocked&n=5678')).text();
    expect(dom(html).querySelector('[role="status"]')?.textContent).toContain(`Número bloqueado. (${masked('5678')})`);
    const row = dom(html).querySelector('.bot-row');
    expect(row?.textContent).toContain(masked('5678'));
    expect(row?.textContent).toContain('Abuso');
    expect(row?.textContent).toContain('Ana Admin');
    expect(html).not.toContain(PHONE);
  });

  it.each([
    ['inválido', '123', 422],
    ['del personal', STAFF_PHONE, 422],
  ])('un número %s: error en el campo, teléfono vacío y duración y motivo conservados', async (_name, telefono, status) => {
    const { h, browser } = await signedIn();
    const response = await browser.post('/bot/bloqueos', { _csrf: await csrfOf(browser), telefono, duracion: '30d', motivo: 'Abuso' });
    expect(response.status).toBe(status);
    const html = await response.text();
    expect(phoneInput(html)?.value).toBe('');
    expect(phoneInput(html)?.getAttribute('aria-invalid')).toBe('true');
    expect(dom(html).querySelector('#b-telefono-error')).not.toBeNull();
    expect(durationOf(html, '#b-duracion')).toBe('30d');
    expect(reasonOf(html)).toBe('Abuso');
    expect(html).not.toContain(telefono);
    expect(h.api.bot.state.blocks).toEqual([]);
  });

  it('un número ya bloqueado da 409 con el error en el teléfono, que vuelve vacío', async () => {
    const { h, browser } = await signedIn();
    const csrf = await csrfOf(browser);
    await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' });
    const response = await browser.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '24h', motivo: 'Otra vez' });
    expect(response.status).toBe(409);
    const html = await response.text();
    expect(dom(html).querySelector('#b-telefono-error')?.textContent).toContain('ya está en la lista');
    expect(phoneInput(html)?.value).toBe('');
    expect(durationOf(html, '#b-duracion')).toBe('24h');
    expect(reasonOf(html)).toBe('Otra vez');
    expect(html).not.toContain(PHONE);
    expect(h.api.bot.state.blocks).toHaveLength(1);
  });

  it('una duración desconocida da 422 y no se vuelve a pintar: queda la de por defecto', async () => {
    const { browser } = await signedIn();
    const response = await browser.post('/bot/bloqueos', { _csrf: await csrfOf(browser), telefono: PHONE, duracion: '99d' });
    expect(response.status).toBe(422);
    const html = await response.text();
    expect(durationOf(html, '#b-duracion')).toBe('7d');
    expect(dom(html).querySelector('#b-duracion-error')).not.toBeNull();
    expect(html).not.toContain('99d');
  });

  it('un motivo con teléfono no se vuelve a pintar', async () => {
    const { browser } = await signedIn();
    const response = await browser.post('/bot/bloqueos', { _csrf: await csrfOf(browser), telefono: PHONE, duracion: '7d', motivo: 'es el 55 1234 5678' });
    expect(response.status).toBe(422);
    const html = await response.text();
    expect(reasonOf(html)).toBe('');
    expect(html).not.toContain('1234 5678');
  });

  it('sin clave: no hay formulario, se explica el motivo y un POST directo da 409 con aviso, sin guardar', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.canBlock = false;
    const html = await (await browser.get('/bot')).text();
    expect(dom(html).querySelector('.bot-add')).toBeNull();
    expect(textOf(html)).toContain('WHATSAPP_BOT_BLOCKLIST_KEY');
    const response = await browser.post('/bot/bloqueos', { _csrf: await csrfOf(browser), telefono: PHONE, duracion: '7d' });
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(dom(body).querySelector('[role="alert"]')?.textContent).toContain('No se guardó nada');
    expect(dom(body).querySelector('.bot-add')).toBeNull();
    expect(body).not.toContain(PHONE);
    expect(h.api.bot.state.blocks).toEqual([]);
  });
});

describe('lista negra (RF-6, RF-8; CA-7, CA-14)', () => {
  it('muestra cada dato, quita un bloqueo y da 303 con los 4 últimos dígitos', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.blocks.push(blockRow(101, '4321', { origin: 'tope', author: null, reason: null, until: null }));
    const html = await (await browser.get('/bot')).text();
    const row = dom(html).querySelector('.bot-row')?.textContent?.replace(/\s+/g, ' ');
    for (const piece of [masked('4321'), 'Origen: Tope diario', 'Motivo: —', 'Autor: Sistema', 'Desde: 05/11/2026 10:00', 'Hasta: Permanente']) expect(row).toContain(piece);
    const response = await browser.post('/bot/bloqueos/101/quitar', { _csrf: await csrfOf(browser) });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/bot?ok=unblocked&n=4321');
    expect(h.api.bot.state.blocks).toEqual([]);
    expect(textOf(await (await browser.get('/bot?ok=unblocked&n=4321')).text())).toContain('No hay números bloqueados.');
  });

  it('un bloqueo que ya no existe da 404 con aviso y la lista actual', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.blocks.push(blockRow(101, '4321'));
    const response = await browser.post('/bot/bloqueos/999/quitar', { _csrf: await csrfOf(browser) });
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(dom(html).querySelector('[role="alert"]')?.textContent).toContain('Ese bloqueo ya no está en la lista.');
    expect(dom(html).querySelector('.bot-row')?.textContent).toContain(masked('4321'));
  });

  it('un id que no es un número da 404 sin llamar a la API', async () => {
    const { h, browser } = await signedIn();
    expect((await browser.post('/bot/bloqueos/abc/quitar', { _csrf: await csrfOf(browser) })).status).toBe(404);
    expect(botWrites(h)).toEqual([]);
  });

  it('un alta automática sin guardar dice "Pendiente de guardar" y no se puede quitar', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.blocks.push(blockRow(1, '4321', { id: null, pending: true, origin: 'repeticion' }));
    const page = dom(await (await browser.get('/bot')).text());
    expect(page.querySelector('.bot-row__pending')?.textContent).toBe('Pendiente de guardar');
    expect(page.querySelector('.bot-row form')).toBeNull();
  });

  it('avisa de la rotación solo si quedan bloqueos con la clave anterior', async () => {
    const { h, browser } = await signedIn();
    expect(textOf(await (await browser.get('/bot')).text())).not.toContain('WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS');
    h.api.bot.state.previousKeyBlocks = 3;
    const text = textOf(await (await browser.get('/bot')).text());
    expect(text).toContain('3 bloqueo(s) siguen calculados con la clave anterior.');
    expect(text).toContain('No retires WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS');
  });

  it('con la base en fallo parcial, avisa de la última copia conocida sin ocultar los datos (CA-19)', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.storeHealthy = false;
    h.api.bot.state.blocks.push(blockRow(101, '4321'));
    const response = await browser.get('/bot');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(dom(html).querySelector('[role="status"]')?.textContent).toContain('última copia conocida');
    expect(html).toContain(masked('4321'));
  });
});

describe('alcanzaron un tope hoy (RF-5; CA-8, CA-10)', () => {
  it('sin entradas tiene su propio texto', async () => {
    const { browser } = await signedIn();
    expect(textOf(await (await browser.get('/bot')).text())).toContain('Hoy ningún número ha alcanzado un tope.');
  });

  it('muestra número enmascarado, tope y hora; al bloquear sale de la lista y pasa a la lista negra', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push(ENTRY);
    const row = dom(await (await browser.get('/bot')).text()).querySelector('.bot-row');
    for (const piece of [masked('1111'), 'Mensajes del día', '05/11/2026 09:30']) expect(row?.textContent).toContain(piece);
    expect(row?.querySelector<HTMLSelectElement>('select[name="duracion"]')?.value).toBe('7d');

    const response = await browser.post(`/bot/topes/${ENTRY.token}/bloquear`, { _csrf: await csrfOf(browser), duracion: '24h', motivo: 'Ráfagas' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/bot?ok=blocked&n=1111');
    expect(botWrites(h).at(-1)?.body).toEqual({ duration: '24h', reason: 'Ráfagas' });
    const page = dom(await (await browser.get('/bot')).text());
    expect(page.querySelector('.bot-row__form')).toBeNull();
    expect(page.querySelector('.bot-row')?.textContent).toContain(masked('1111'));
  });

  it('un token usado o inexistente da 404 con aviso y la lista actual', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push(ENTRY);
    const response = await browser.post(`/bot/topes/${reachedToken(9)}/bloquear`, { _csrf: await csrfOf(browser), duracion: '7d' });
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(dom(html).querySelector('[role="alert"]')?.textContent).toContain('Esa entrada ya no está en la lista.');
    expect(dom(html).querySelector('.bot-row')?.textContent).toContain(masked('1111'));
    expect(h.api.bot.state.blocks).toEqual([]);
  });

  it('un número ya bloqueado da 409 con aviso, sin duplicar', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push(ENTRY);
    h.api.bot.state.blocks.push(blockRow(101, '1111'));
    const response = await browser.post(`/bot/topes/${ENTRY.token}/bloquear`, { _csrf: await csrfOf(browser), duracion: '7d' });
    expect(response.status).toBe(409);
    expect(dom(await response.text()).querySelector('[role="alert"]')?.textContent).toContain('ya está en la lista');
    expect(h.api.bot.state.blocks).toHaveLength(1);
  });

  it('un error de validación queda junto al campo de su fila, con la duración conservada', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.reached.push({ ...ENTRY, token: reachedToken(2), masked: masked('2222') }, ENTRY);
    const response = await browser.post(`/bot/topes/${ENTRY.token}/bloquear`, { _csrf: await csrfOf(browser), duracion: '30d', motivo: PHONE });
    expect(response.status).toBe(422);
    const html = await response.text();
    expect(html).not.toContain(PHONE);
    expect(durationOf(html, '#b-duracion-tope-1')).toBe('30d');
    expect(durationOf(html, '#b-duracion-tope-0')).toBe('7d');
    expect(dom(html).querySelector('#b-motivo-tope-1')?.getAttribute('aria-invalid')).toBe('true');
    expect(dom(html).querySelector('[role="alert"] a')?.getAttribute('href')).toBe('#b-motivo-tope-1');
  });

  it('un error de una entrada que ya no está sigue visible en el resumen', async () => {
    const { browser } = await signedIn();
    const response = await browser.post(`/bot/topes/${ENTRY.token}/bloquear`, { _csrf: await csrfOf(browser), duracion: 'x' });
    expect(response.status).toBe(422);
    const html = await response.text();
    expect(dom(html).querySelector('[role="alert"]')?.textContent).toContain('Elige una duración de la lista.');
    expect(dom(html).querySelector('[role="alert"] a')).toBeNull();
  });
});

describe('avisos de resultado', () => {
  it('`ok` es una lista cerrada, y `n` solo se acepta con 4 dígitos', async () => {
    const { browser } = await signedIn();
    for (const query of ['?ok=constructor', '?ok=<b>x</b>', '?n=1234']) expect(dom(await (await browser.get(`/bot${query}`)).text()).querySelector('main [role="status"]'), query).toBeNull();
    const html = await (await browser.get('/bot?ok=blocked&n=<script>')).text();
    expect(dom(html).querySelector('[role="status"]')?.textContent?.trim()).toBe('Número bloqueado.');
  });

  it('escapa los textos que vienen de la API', async () => {
    const { h, browser } = await signedIn();
    h.api.bot.state.control = { paused: true, changedAt: '2026-11-05T12:00:00-06:00', changedByName: '<b>Ana</b>', reason: '<script>x</script>' };
    const html = await (await browser.get('/bot')).text();
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<b>Ana</b>');
  });
});
