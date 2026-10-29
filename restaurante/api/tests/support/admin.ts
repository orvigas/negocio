import { CSRF_HEADER, type Freshness } from '@restaurante/contracts';
import { createProductRepository, type MemoryProductStore } from '@restaurante/core/catalog';
import {
  SCRYPT_DEFAULTS,
  hashPassword,
  type Role,
  type UserRecord,
  type UserRepository,
} from '@restaurante/core/identity';
import type { BusinessId, Logger } from '@restaurante/core/shared';
import { createImageChecker, createLogger } from '@restaurante/web';

import { createAdminRoutes } from '../../src/admin/index.ts';
import { createApiApp } from '../../src/app.ts';
import { API_DEFAULTS } from '../../src/config.ts';
import type { LandingNotifier } from '../../src/notifier.ts';
import { makeStore } from './fixtures.ts';
import { listenLocal } from './http.ts';

/**
 * Soporte de las pruebas de `/api/v1/admin` (REQ-F-039), en proceso: store de productos en memoria,
 * un doble del repositorio de usuarios (las reglas de usuarios se prueban con MySQL en landing-pages)
 * y un doble del aviso interno.
 */

export const TEST_HASH_PARAMS = Object.freeze({ ...SCRYPT_DEFAULTS, N: 2 ** 14 });
export const PASSWORD = 'contraseña-de-prueba-larga';
/** Imagen que sí existe en landing-pages/public/img (RF-11). */
export const EXISTING_IMAGE = '/img/molotes/molotes-artesanales.jpg';

export interface TestUser {
  username: string;
  displayName: string;
  role: Role;
  businesses: BusinessId[];
}

export const ADMIN: TestUser = { username: 'ana', displayName: 'Ana Admin', role: 'admin', businesses: [] };
export const MOLOTES_EDITOR: TestUser = { username: 'eli', displayName: 'Eli Molotes', role: 'editor', businesses: ['molotes'] };

/** Doble del repositorio de usuarios: solo lo que usa la API (y `findCredentials` contado). */
export function createFakeUsers(records: UserRecord[], hashes: Map<number, string>) {
  const calls = { findCredentials: 0, recordLogin: 0 };
  const byId = new Map(records.map((user) => [user.id, user]));
  const users: UserRepository = {
    hasUsers: async () => byId.size > 0,
    findById: async (id) => byId.get(id) ?? null,
    async findCredentials(username) {
      calls.findCredentials += 1;
      const user = [...byId.values()].find((candidate) => candidate.username.toLowerCase() === username.trim().toLowerCase());
      const passwordHash = user ? hashes.get(user.id) : undefined;
      return user && passwordHash ? { user, passwordHash } : null;
    },
    async recordLogin() {
      calls.recordLogin += 1;
    },
    findPasswordHash: async () => null,
    list: async () => [...byId.values()],
    create: () => Promise.reject(new Error('no se usa')),
    update: () => Promise.reject(new Error('no se usa')),
    setActive: () => Promise.reject(new Error('no se usa')),
    setPassword: () => Promise.reject(new Error('no se usa')),
    bootstrap: () => Promise.reject(new Error('no se usa')),
    recover: () => Promise.reject(new Error('no se usa')),
  };
  /** Cambia un usuario (desactivar, cambiar su sessionVersion...). */
  const change = (id: number, patch: Partial<UserRecord>) => {
    const user = byId.get(id);
    if (user) byId.set(id, { ...user, ...patch });
  };
  return { users, calls, change };
}

/** Doble del aviso interno: registra los negocios avisados y responde la frescura indicada. */
export function createFakeNotifier(freshness: Freshness = 'confirmed') {
  const notified: BusinessId[] = [];
  const notifier: LandingNotifier & { freshness: Freshness } = {
    freshness,
    async notify(business) {
      notified.push(business);
      return notifier.freshness;
    },
  };
  return { notifier, notified };
}

export function recordingLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  return { ...createLogger({ write: (line) => lines.push(line) }), lines };
}

export interface AdminHarness {
  url: string;
  store: MemoryProductStore;
  calls: { findCredentials: number; recordLogin: number };
  change: (id: number, patch: Partial<UserRecord>) => void;
  notified: BusinessId[];
  notifier: LandingNotifier & { freshness: Freshness };
  logger: Logger & { lines: string[] };
  clock: { now: Date };
  ids: Record<string, number>;
}

export async function startAdmin({ users: testUsers = [ADMIN, MOLOTES_EDITOR] }: { users?: TestUser[] } = {}): Promise<AdminHarness> {
  const clock = { now: new Date('2026-10-26T18:00:00Z') };
  const now = () => clock.now;
  const passwordHash = await hashPassword(PASSWORD, TEST_HASH_PARAMS);
  const records: UserRecord[] = testUsers.map((user, index) => ({
    id: index + 1,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: true,
    sessionVersion: 1,
    businesses: user.businesses,
    createdAt: clock.now,
    updatedAt: clock.now,
    lastLoginAt: null,
  }));
  const { users, calls, change } = createFakeUsers(records, new Map(records.map((user) => [user.id, passwordHash])));
  const store = await makeStore();
  const products = createProductRepository({ store, imageExists: createImageChecker(API_DEFAULTS.PRODUCT_IMAGES_DIR), now });
  await products.init();
  const { notifier, notified } = createFakeNotifier();
  const logger = recordingLogger();
  const admin = createAdminRoutes({ users, products, notifier, timeZone: 'America/Mexico_City', hashParams: TEST_HASH_PARAMS, now, logger });
  const { url } = await listenLocal(createApiApp({ store, admin, logger }));
  return { url, store, calls, change, notified, notifier, logger, clock, ids: Object.fromEntries(records.map((user) => [user.username, user.id])) };
}

export interface Session {
  id: string;
  csrfToken: string;
}

let ipCounter = 0;
/** IP distinta por llamada (el límite de intentos cuenta por IP). */
export const nextIp = (): string => `203.0.113.${(ipCounter++ % 250) + 1}`;

export function login(url: string, username: string, password = PASSWORD, ip = nextIp()): Promise<Response> {
  return fetch(`${url}/api/v1/admin/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ username, password }),
  });
}

export async function session(url: string, user: TestUser): Promise<Session> {
  const res = await login(url, user.username);
  if (res.status !== 201) throw new Error(`login falló: ${res.status}`);
  const body = (await res.json()) as { session: Session };
  return body.session;
}

/** Petición autenticada; en escrituras con el token CSRF de la sesión salvo que se indique otro. */
export function call(
  url: string,
  path: string,
  auth: Session | null,
  { method = 'GET', body, csrf, headers = {} }: { method?: string; body?: unknown; csrf?: string | null; headers?: Record<string, string> } = {},
): Promise<Response> {
  const all: Record<string, string> = { ...headers };
  if (auth) all.Authorization = `Bearer ${auth.id}`;
  const token = csrf === undefined ? auth?.csrfToken : csrf;
  if (method !== 'GET' && token) all[CSRF_HEADER] = token;
  if (body !== undefined) all['Content-Type'] = 'application/json';
  return fetch(`${url}${path}`, { method, headers: all, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
