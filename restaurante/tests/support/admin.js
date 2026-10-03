import { JSDOM } from 'jsdom';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { SCRYPT_DEFAULTS, hashPassword } from '../../src/services/admin-auth.js';
import { makeConfig, makeRecordingLogger, makeRepository } from '../helpers.js';

/** Credencial de pruebas (hash con el costo mínimo aceptado para que las pruebas sean rápidas). */
export const ADMIN_USER = 'dueno';
export const ADMIN_PASSWORD = 'clave-de-prueba-SECRETA-123';
export const ADMIN_PASSWORD_HASH = await hashPassword(ADMIN_PASSWORD, { ...SCRYPT_DEFAULTS, N: 2 ** 14 });
export const ADMIN_ENV = Object.freeze({ ADMIN_USER, ADMIN_PASSWORD_HASH });

export const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');

/** Reloj controlable para caducidades y bloqueos. */
export function makeClock(start = FRIDAY_NOON_MX) {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms) {
      current += ms;
    },
  };
}

/**
 * App de pruebas con administración habilitada y repositorio en memoria (CA-38).
 */
export async function setupAdmin({ env = {}, clock = makeClock(), repository, logger = makeRecordingLogger() } = {}) {
  const repo = repository ?? (await makeRepository({ now: clock.now }));
  const config = makeConfig({ ...ADMIN_ENV, ...env });
  const app = createApp({ config, repository: repo, logger, now: clock.now });
  const server = app.callback();
  return {
    app,
    clock,
    logger,
    repository: repo,
    /** Cliente nuevo con su propio almacén de cookies (un "navegador"). */
    browser: () => request.agent(server),
    request: () => request(server),
  };
}

/** Inicia sesión con un cliente con cookies. */
export async function login(browser, { username = ADMIN_USER, password = ADMIN_PASSWORD, next } = {}) {
  const fields = { username, password };
  if (next) fields.next = next;
  return browser.post('/admin/login').type('form').send(fields);
}

/**
 * Lee un formulario como lo enviaría el navegador: inputs, selects y textareas con nombre;
 * las casillas solo si están marcadas. Devuelve un objeto plano.
 */
export function formFields(html, selector = '#admin-form') {
  const { document } = new JSDOM(html).window;
  const form = document.querySelector(selector);
  if (!form) throw new Error(`No se encontró el formulario ${selector}`);
  const fields = {};
  for (const element of form.querySelectorAll('input[name], select[name], textarea[name]')) {
    if (element.type === 'checkbox' && !element.checked) continue;
    if (element.type === 'submit') continue;
    fields[element.name] = element.value;
  }
  return fields;
}

export function csrfFrom(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error('No hay token CSRF en la página');
  return match[1];
}

/** Abre la página de un negocio y devuelve sus campos listos para enviar. */
export async function openForm(browser, businessId) {
  const page = await browser.get(`/admin/${businessId}`);
  if (page.status !== 200) throw new Error(`GET /admin/${businessId} respondió ${page.status}`);
  return { page, fields: formFields(page.text) };
}

/**
 * Envía el formulario de un negocio con cambios. `action` es el botón pulsado
 * ("Guardar cambios" = save; "Guardar mis cambios de todos modos" = overwrite_after_conflict).
 */
export function submitForm(browser, businessId, fields, changes = {}) {
  const body = { action: 'save', ...fields, ...changes };
  for (const [name, value] of Object.entries(changes)) if (value === undefined) delete body[name];
  return browser.post(`/admin/${businessId}`).type('form').send(body);
}

export function textOf(html) {
  return new JSDOM(html).window.document.body.textContent.replace(/\s+/g, ' ');
}
