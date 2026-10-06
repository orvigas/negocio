import { JSDOM } from 'jsdom';
import request from 'supertest';
import { afterAll } from 'vitest';

import type { Test } from 'supertest';

import { createApp } from '../../src/app.ts';
import type { Env } from '../../src/config/env.ts';
import type { MenuRepository } from '../../src/repositories/menu-repository.ts';
import type { createMemoryMenuRepository } from '../../src/repositories/memory-menu-repository.ts';
import { createUserRepository, type UserRepository } from '../../src/repositories/user-repository.ts';
import { bootstrapAdmin } from '../../src/services/admin-bootstrap.ts';
import { makeDatabase } from './database.ts';

export type MemoryRepository = ReturnType<typeof createMemoryMenuRepository>;

export interface SetupOptions<R extends MenuRepository> {
  env?: Env;
  clock?: Clock;
  repository?: R;
  logger?: RecordingLogger;
  /** Sustituye al repositorio de usuarios real (p. ej. un doble que falla, CA-5). */
  wrapUsers?: (users: UserRepository) => UserRepository;
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
/** Costo de scrypt de las contraseñas creadas en las pruebas (el mínimo aceptado). */
export const TEST_HASH_PARAMS = Object.freeze({ ...SCRYPT_DEFAULTS, N: 2 ** 14 });

// Cada setupAdmin crea una base de datos temporal; se borran al terminar el archivo de pruebas.
const databaseCleanups: (() => Promise<void>)[] = [];
afterAll(async () => {
  while (databaseCleanups.length > 0) await databaseCleanups.pop()?.();
});

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
 * App de pruebas con administración habilitada, repositorio de menús en memoria (CA-38) y una
 * base de datos SQLite temporal con el primer administrador creado desde ADMIN_ENV (REQ-F-007).
 */
export async function setupAdmin<R extends MenuRepository = MemoryRepository>({
  env = {},
  clock = makeClock(),
  repository,
  logger = makeRecordingLogger(),
  wrapUsers = (users) => users,
}: SetupOptions<R> = {}) {
  // Sin repositorio propio se usa el de memoria, que es el tipo por defecto de R.
  const repo = (repository ?? (await makeRepository({ now: clock.now }))) as R;
  const config = makeConfig({ ...ADMIN_ENV, ...env });
  const database = await makeDatabase();
  databaseCleanups.push(database.cleanup);
  const realUsers = createUserRepository({ prisma: database.prisma, now: clock.now });
  await bootstrapAdmin({ users: realUsers, bootstrap: config.adminBootstrap, logger });
  const users = wrapUsers(realUsers);
  const app = createApp({ config, repository: repo, users, hashParams: TEST_HASH_PARAMS, logger, now: clock.now });
  const server = app.callback();
  return {
    app,
    clock,
    logger,
    repository: repo,
    users: realUsers,
    prisma: database.prisma,
    dataDir: database.dataDir,
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

export const USER_PASSWORD = 'clave-de-usuario-12345';

/** Crea un usuario directamente en la base de datos (contraseña USER_PASSWORD por defecto). */
export async function createUser(
  users: UserRepository,
  {
    username,
    displayName = username,
    role = 'editor',
    businesses = role === 'editor' ? ['molotes'] : [],
    password = USER_PASSWORD,
  }: { username: string; displayName?: string; role?: 'admin' | 'editor'; businesses?: ('molotes' | 'birria')[]; password?: string },
) {
  const passwordHash = await hashPassword(password, TEST_HASH_PARAMS);
  return users.create({ username, displayName, role, businesses, passwordHash }, { kind: 'system' });
}

/** Navegador con la sesión iniciada de un usuario creado con createUser. */
export async function loginAs(browser: Browser, username: string, password = USER_PASSWORD): Promise<Browser> {
  const res = await login(browser, { username, password });
  if (res.status !== 303) throw new Error(`El acceso de ${username} respondió ${res.status}`);
  return browser;
}
