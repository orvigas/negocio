import { join } from 'node:path';

import { afterEach } from 'vitest';

import { CSRF_HEADER, adminPaths } from '@restaurante/contracts';
import { createUserRepository } from '@restaurante/db/user-repository';
import { SCRYPT_DEFAULTS, hashPassword, type UserRepository } from '@restaurante/core/identity';
import type { BotKeys } from '@restaurante/core/bot-control';

import { appDatabaseUrl, makeDatabase } from './database.ts';
import { startServer } from './process.ts';

/**
 * Credenciales y utilidades de administración para las pruebas con MySQL. Desde REQ-F-045 la
 * administración vive en la api (y en inventory-manager, que habla con ella): las pruebas que
 * necesitan una sesión arrancan el proceso real de la api (`startApiAdmin`), sin importar su código.
 */

/** Credencial de pruebas (hash con el costo mínimo aceptado para que las pruebas sean rápidas). */
export const ADMIN_USER = 'dueno';
export const ADMIN_PASSWORD = 'clave-de-prueba-SECRETA-123';
export const ADMIN_PASSWORD_HASH = await hashPassword(ADMIN_PASSWORD, { ...SCRYPT_DEFAULTS, N: 2 ** 14 });
export const ADMIN_ENV = Object.freeze({ ADMIN_USER, ADMIN_PASSWORD_HASH });
/** Costo de scrypt de las contraseñas creadas en las pruebas (el mínimo aceptado). */
export const TEST_HASH_PARAMS = Object.freeze({ ...SCRYPT_DEFAULTS, N: 2 ** 14 });

/** Clave de prueba para la lista negra sin bot (REQ-F-025). */
export const TEST_BOT_KEYS: BotKeys = Object.freeze({ current: Buffer.alloc(32, 7), previous: undefined });

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

/** Sesión de la api (REQ-F-039): id que se envía como Bearer y token CSRF de las escrituras. */
export interface ApiSession {
  id: string;
  csrfToken: string;
}

/** Entrada del proceso de la api, relativa a landing-pages (cwd de los procesos de prueba). */
const API_ENTRY = join('..', 'api', 'src', 'server.ts');

// Procesos y bases de startApiAdmin: se liberan al terminar cada prueba (primero el proceso).
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

/**
 * Proceso real de la api sobre una base de pruebas migrada y vacía: prepara la instalación (semilla y
 * primer administrador desde ADMIN_ENV; REQ-F-045, RF-4) y atiende /api/v1/admin. Devuelve la base
 * (Prisma y repositorio de usuarios sobre la misma conexión) y un cliente mínimo de la API.
 */
export async function startApiAdmin() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const api = await startServer({ ...ADMIN_ENV, INTERNAL_NOTIFY_TOKEN: undefined, DATABASE_URL: appDatabaseUrl(database.name) }, 30_000, { args: [API_ENTRY] });
  cleanups.push(async () => void (await api.stop()));
  if (!api.started) throw new Error(`La api no arrancó: ${api.output().stderr}`);

  /** POST /sesion con la IP del visitante, como la reenvía el admin nuevo. */
  const login = (username: string, password: string, ip = '203.0.113.7') =>
    fetch(`${api.url}${adminPaths.session}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ username, password }),
    });

  /** Sesión iniciada o error (la prueba no sigue sin ella). */
  async function loginAs(username: string, password = USER_PASSWORD): Promise<ApiSession> {
    const res = await login(username, password);
    if (res.status !== 201) throw new Error(`El acceso de ${username} respondió ${res.status}`);
    return ((await res.json()) as { session: ApiSession }).session;
  }

  /** Petición con la sesión (Bearer) y, en escrituras, el token CSRF. */
  const request = (session: ApiSession, method: string, path: string, body?: unknown) =>
    fetch(`${api.url}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${session.id}`,
        ...(method === 'GET' ? {} : { [CSRF_HEADER]: session.csrfToken }),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return {
    url: api.url,
    prisma: database.prisma,
    users: createUserRepository({ prisma: database.prisma }),
    /** Base de pruebas (nombre y conexión del usuario de la app). */
    database: { name: database.name, config: database.config },
    login,
    loginAs,
    request,
    /** Desactiva un usuario por la API (POST /usuarios/:id/desactivar, cuerpo vacío). */
    deactivateUser: (session: ApiSession, id: number) => request(session, 'POST', adminPaths.userStatus(id, 'desactivar'), {}),
  };
}
