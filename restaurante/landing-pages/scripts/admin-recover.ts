/**
 * Recuperación del acceso de administración por consola (REQ-F-007, D-5, R-5 y DT-14).
 *
 *   npm run admin:recover -- --usuario <nombre>
 *   docker exec -it <contenedor> node scripts/admin-recover.ts --usuario <nombre>
 *
 * Trabaja directamente sobre la base de DATABASE_URL (REQ-F-014, RF-11). No migra: antes verifica
 * que la base esté lista (conexión, colación y migraciones al día; hasta 10 s de espera).
 * - si el usuario no existe, crea un administrador activo con ese usuario;
 * - si existe, lo deja activo y con rol administrador y le cambia la contraseña.
 * Cierra sus sesiones abiertas aunque el servidor esté en marcha (cambia su sessionVersion) y
 * queda en la auditoría como `console_recovery`. Pide la contraseña sin mostrarla; nunca la
 * imprime ni la guarda en claro.
 */
import { stderr, stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';

import type { DatabaseConfig } from '@restaurante/db/database-config';
import { createPrismaClient } from '@restaurante/db/client';
import { DatabaseInitError, probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';
import { createUserRepository } from '@restaurante/db/user-repository';
import { hashPassword, normalizeUsername, passwordError, usernameError } from '@restaurante/core/identity';

import { ConfigError, loadDatabaseConfig } from '../src/config/env.ts';
import { readHidden } from './support/read-hidden.ts';

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

let usernameArg: string | undefined;
try {
  const { values } = parseArgs({ options: { usuario: { type: 'string' } }, strict: true });
  usernameArg = values.usuario;
} catch {
  fail('Uso: npm run admin:recover -- --usuario <nombre>');
}
const username = normalizeUsername(usernameArg);
const invalidUsername = usernameError(username);
if (invalidUsername) fail(`Usuario inválido: ${invalidUsername} Uso: npm run admin:recover -- --usuario <nombre>`);

/** Plazo de espera de la base (más corto que el de la app: es un comando interactivo). */
const RECOVER_WINDOW_MS = 10_000;

let databaseConfig: DatabaseConfig;
try {
  databaseConfig = loadDatabaseConfig();
} catch (err) {
  if (err instanceof ConfigError) fail(err.message);
  throw err;
}

const password = await readHidden(`Contraseña nueva para ${username}: `);
const invalidPassword = passwordError(password);
if (invalidPassword) fail(invalidPassword);
if (stdin.isTTY && (await readHidden('Repite la contraseña: ')) !== password) fail('Las contraseñas no coinciden.');

const prisma = createPrismaClient(databaseConfig);
try {
  await verifyDatabase({ probe: probeOf(databaseConfig), query: queryOf(prisma), windowMs: RECOVER_WINDOW_MS });
} catch (err) {
  await prisma.$disconnect();
  if (err instanceof DatabaseInitError) {
    fail(
      `No se pudo usar la base de datos (${err.code}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas.`,
    );
  }
  throw err;
}

try {
  const users = createUserRepository({ prisma });
  const { user, created } = await users.recover({ username, passwordHash: await hashPassword(password) });
  stdout.write(
    created
      ? `Se creó el administrador "${user.username}". Ya puede entrar en /admin con la contraseña nueva.\n`
      : `Se recuperó el acceso de "${user.username}": está activo, es administrador y tiene la contraseña nueva. Sus sesiones abiertas se cerraron.\n`,
  );
} catch {
  // Sin detalles técnicos (los errores de Prisma incluyen rutas e invocaciones).
  stderr.write('No se pudo recuperar el acceso: la base de datos no respondió.\n');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
