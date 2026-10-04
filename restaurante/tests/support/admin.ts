import { JSDOM } from 'jsdom';
import request from 'supertest';

import type { Test } from 'supertest';

import { createApp } from '../../src/app.ts';
import type { Env } from '../../src/config/env.ts';
import type { MenuRepository } from '../../src/repositories/menu-repository.ts';
import type { createMemoryMenuRepository } from '../../src/repositories/memory-menu-repository.ts';

export type MemoryRepository = ReturnType<typeof createMemoryMenuRepository>;

export interface SetupOptions<R extends MenuRepository> {
  env?: Env;
  clock?: Clock;
  repository?: R;
  logger?: RecordingLogger;
}
import { SCRYPT_DEFAULTS, hashPassword } from '../../src/services/admin-auth.ts';
import { makeConfig, makeRecordingLogger, makeRepository, type RecordingLogger } from '../helpers.ts';

/** Cliente con su propio almacén de cookies (un "navegador"). */
export type Browser = ReturnType<typeof request.agent>;
export type FormFields = Record<string, string>;

/** Credencial de pruebas (hash con el costo mínimo aceptado para que las pruebas sean rápidas). */
export const ADMIN_USER = 'dueno';
export const ADMIN_PASSWORD = 'clave-de-prueba-SECRETA-123';
export const ADMIN_PASSWORD_HASH = await hashPassword(ADMIN_PASSWORD, { ...SCRYPT_DEFAULTS, N: 2 ** 14 });
export const ADMIN_ENV = Object.freeze({ ADMIN_USER, ADMIN_PASSWORD_HASH });

export const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');

/** Reloj controlable para caducidades y bloqueos. */
export interface Clock {
  now: () => Date;
  advance(ms: number): void;
}

export function makeClock(start = FRIDAY_NOON_MX): Clock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current += ms;
    },
  };
}

/**
 * App de pruebas con administración habilitada y repositorio en memoria (CA-38).
 */
export async function setupAdmin<R extends MenuRepository = MemoryRepository>({
  env = {},
  clock = makeClock(),
  repository,
  logger = makeRecordingLogger(),
}: SetupOptions<R> = {}) {
  // Sin repositorio propio se usa el de memoria, que es el tipo por defecto de R.
  const repo = (repository ?? (await makeRepository({ now: clock.now }))) as R;
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
export async function login(
  browser: Browser,
  { username = ADMIN_USER, password = ADMIN_PASSWORD, next }: { username?: string; password?: string; next?: string } = {},
) {
  const fields: FormFields = { username, password };
  if (next) fields.next = next;
  return browser.post('/admin/login').type('form').send(fields);
}

/**
 * Lee un formulario como lo enviaría el navegador: inputs, selects y textareas con nombre;
 * las casillas solo si están marcadas. Devuelve un objeto plano.
 */
export function formFields(html: string, selector = '#admin-form'): FormFields {
  const { document } = new JSDOM(html).window;
  const form = document.querySelector(selector);
  if (!form) throw new Error(`No se encontró el formulario ${selector}`);
  const fields: FormFields = {};
  for (const element of form.querySelectorAll<HTMLInputElement>('input[name], select[name], textarea[name]')) {
    if (element.type === 'checkbox' && !element.checked) continue;
    if (element.type === 'submit') continue;
    fields[element.name] = element.value;
  }
  return fields;
}

export function csrfFrom(html: string): string {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error('No hay token CSRF en la página');
  // El grupo 1 es obligatorio en el patrón: existe si hubo coincidencia.
  return match[1] as string;
}

/** Abre la página de un negocio y devuelve sus campos listos para enviar. */
export async function openForm(browser: Browser, businessId: string) {
  const page = await browser.get(`/admin/${businessId}`);
  if (page.status !== 200) throw new Error(`GET /admin/${businessId} respondió ${page.status}`);
  return { page, fields: formFields(page.text) };
}

/**
 * Envía el formulario de un negocio con cambios. `action` es el botón pulsado
 * ("Guardar cambios" = save; "Guardar mis cambios de todos modos" = overwrite_after_conflict).
 */
export function submitForm(
  browser: Browser,
  businessId: string,
  fields: FormFields,
  changes: Record<string, string | undefined> = {},
): Test {
  const body: Record<string, string | undefined> = { action: 'save', ...fields, ...changes };
  for (const [name, value] of Object.entries(changes)) if (value === undefined) delete body[name];
  return browser.post(`/admin/${businessId}`).type('form').send(body);
}

export function textOf(html: string): string {
  return new JSDOM(html).window.document.body.textContent.replace(/\s+/g, ' ');
}
