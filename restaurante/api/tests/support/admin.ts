import { CSRF_HEADER, type Freshness } from '@restaurante/contracts';
import { createProductRepository, type MemoryProductStore } from '@restaurante/core/catalog';
import {
  LastAdminError,
  SCRYPT_DEFAULTS,
  UserNotFoundError,
  UsernameTakenError,
  hashPassword,
  type Actor,
  type Role,
  type UserRecord,
  type UserRepository,
} from '@restaurante/core/identity';
import { DatabaseUnavailableError, type BusinessId, type Logger } from '@restaurante/core/shared';
import { createImageChecker, createLogger } from '@restaurante/web';

import { createAdminRoutes } from '../../src/admin/index.ts';
import { createApiApp } from '../../src/app.ts';
import { API_DEFAULTS } from '../../src/config.ts';
import type { LandingNotifier } from '../../src/notifier.ts';
import { makeStore } from './fixtures.ts';
import { listenLocal } from './http.ts';

/**
 * Soporte de las pruebas de `/api/v1/admin` (REQ-F-039 y REQ-F-040), en proceso: store de productos en
 * memoria, un doble del repositorio de usuarios (las reglas de usuarios se prueban con MySQL en landing-pages)
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

/** Entrada de auditoría del doble (misma forma que la de `user_audit`, sin hashes). */
export interface FakeAudit {
  action: string;
  actorId: number | null;
  targetId: number;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

/**
 * Doble del repositorio de usuarios con las reglas mínimas del real (REQ-F-040): usuario de acceso
 * único sin distinguir mayúsculas, D-7 (siempre un administrador activo), D-8 (`sessionVersion`) y
 * auditoría. Las reglas reales se prueban con MySQL en landing-pages (users-api-process.test.ts y
 * user-repository.test.ts); aquí se prueba el HTTP de la API.
 */
export function createFakeUsers(records: UserRecord[], hashes: Map<number, string>) {
  const calls = { findCredentials: 0, recordLogin: 0, writes: 0 };
  const audit: FakeAudit[] = [];
  const failing = { list: false };
  const byId = new Map(records.map((user) => [user.id, user]));
  let nextId = Math.max(0, ...records.map((user) => user.id)) + 1;
  const copy = (user: UserRecord): UserRecord => ({ ...user, businesses: [...user.businesses] });
  const actorId = (actor: Actor) => (actor.kind === 'user' ? actor.id : null);
  const load = (id: number) => {
    const user = byId.get(id);
    if (!user) throw new UserNotFoundError();
    return user;
  };
  const assertUnique = (username: string, exceptId?: number) => {
    if ([...byId.values()].some((user) => user.id !== exceptId && user.username.toLowerCase() === username.toLowerCase())) throw new UsernameTakenError();
  };
  /** Aplica el cambio solo si queda un administrador activo (D-7). */
  const commit = (next: UserRecord) => {
    const after = new Map(byId).set(next.id, next);
    if (![...after.values()].some((user) => user.role === 'admin' && user.active)) throw new LastAdminError();
    byId.set(next.id, next);
    calls.writes += 1;
  };
  const users: UserRepository = {
    hasUsers: async () => byId.size > 0,
    findById: async (id) => {
      const user = byId.get(id);
      return user ? copy(user) : null;
    },
    async findCredentials(username) {
      calls.findCredentials += 1;
      const user = [...byId.values()].find((candidate) => candidate.username.toLowerCase() === username.trim().toLowerCase());
      const passwordHash = user ? hashes.get(user.id) : undefined;
      return user && passwordHash ? { user: copy(user), passwordHash } : null;
    },
    async recordLogin(id, at) {
      calls.recordLogin += 1;
      const user = byId.get(id);
      if (user) byId.set(id, { ...user, lastLoginAt: at });
    },
    findPasswordHash: async (id) => hashes.get(id) ?? null,
    async list() {
      if (failing.list) {
        failing.list = false;
        throw new DatabaseUnavailableError({ name: 'PrismaClientKnownRequestError', code: 'P1001', originalCode: undefined });
      }
      return [...byId.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.username.toLowerCase().localeCompare(b.username.toLowerCase())).map(copy);
    },
    async create({ passwordHash, ...data }, actor) {
      assertUnique(data.username);
      const at = new Date('2026-10-26T18:00:00Z');
      const user: UserRecord = { id: nextId++, ...data, businesses: data.role === 'admin' ? [] : [...data.businesses], active: true, sessionVersion: 1, createdAt: at, updatedAt: at, lastLoginAt: null };
      commit(user);
      hashes.set(user.id, passwordHash);
      audit.push({ action: 'create', actorId: actorId(actor), targetId: user.id });
      return copy(user);
    },
    async update(id, data, actor) {
      const before = load(id);
      assertUnique(data.username, id);
      const businesses = data.role === 'admin' ? [] : [...data.businesses];
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (before.username !== data.username) changes.username = { from: before.username, to: data.username };
      if (before.displayName !== data.displayName) changes.displayName = { from: before.displayName, to: data.displayName };
      if (before.role !== data.role) changes.role = { from: before.role, to: data.role };
      if (before.businesses.join() !== businesses.join()) changes.businesses = { from: before.businesses, to: businesses };
      const closes = 'role' in changes || 'businesses' in changes;
      commit({ ...before, ...data, businesses, sessionVersion: before.sessionVersion + (closes ? 1 : 0) });
      if (Object.keys(changes).length > 0) audit.push({ action: 'update', actorId: actorId(actor), targetId: id, changes });
      return copy(load(id));
    },
    async setActive(id, active, actor) {
      const before = load(id);
      if (before.active === active) return copy(before);
      commit({ ...before, active, sessionVersion: before.sessionVersion + 1 });
      audit.push({ action: active ? 'reactivate' : 'deactivate', actorId: actorId(actor), targetId: id });
      return copy(load(id));
    },
    async setPassword(id, passwordHash, actor, action) {
      const before = load(id);
      commit({ ...before, sessionVersion: before.sessionVersion + 1 });
      hashes.set(id, passwordHash);
      audit.push({ action, actorId: actorId(actor), targetId: id });
      return copy(load(id));
    },
    bootstrap: () => Promise.reject(new Error('no se usa')),
    recover: () => Promise.reject(new Error('no se usa')),
  };
  /** Cambia un usuario (desactivar, cambiar su sessionVersion...). */
  const change = (id: number, patch: Partial<UserRecord>) => {
    const user = byId.get(id);
    if (user) byId.set(id, { ...user, ...patch });
  };
  /** Falla la próxima llamada a `list` como una base caída (503). */
  const failNext = () => {
    failing.list = true;
  };
  return { users, calls, change, audit, hashes, failNext };
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
  calls: { findCredentials: number; recordLogin: number; writes: number };
  change: (id: number, patch: Partial<UserRecord>) => void;
  audit: FakeAudit[];
  hashes: Map<number, string>;
  failNext: () => void;
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
  const { users, calls, change, audit, hashes, failNext } = createFakeUsers(records, new Map(records.map((user) => [user.id, passwordHash])));
  const store = await makeStore();
  const products = createProductRepository({ store, imageExists: createImageChecker(API_DEFAULTS.PRODUCT_IMAGES_DIR), now });
  await products.init();
  const { notifier, notified } = createFakeNotifier();
  const logger = recordingLogger();
  const admin = createAdminRoutes({ users, products, notifier, timeZone: 'America/Mexico_City', hashParams: TEST_HASH_PARAMS, now, logger });
  const { url } = await listenLocal(createApiApp({ store, admin, logger }));
  return { url, store, calls, change, audit, hashes, failNext, notified, notifier, logger, clock, ids: Object.fromEntries(records.map((user) => [user.username, user.id])) };
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
