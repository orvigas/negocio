/**
 * Recuperación del acceso de administración por consola (REQ-F-007, D-5, R-5 y DT-14).
 *
 *   npm run admin:recover -- --usuario <nombre>
 *   docker exec -it <contenedor> node scripts/admin-recover.ts --usuario <nombre>
 *
 * Trabaja directamente sobre DATA_DIR/restaurante.db (aplica antes las migraciones pendientes):
 * - si el usuario no existe, crea un administrador activo con ese usuario;
 * - si existe, lo deja activo y con rol administrador y le cambia la contraseña.
 * Cierra sus sesiones abiertas aunque el servidor esté en marcha (cambia su sessionVersion) y
 * queda en la auditoría como `console_recovery`. Pide la contraseña sin mostrarla; nunca la
 * imprime ni la guarda en claro.
 */
import { stderr, stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';

import { ConfigError, loadDataDir } from '../src/config/env.ts';
import { openDatabase } from '../src/db/client.ts';
import { DatabaseInitError } from '../src/db/migrate.ts';
import { createUserRepository } from '../src/repositories/user-repository.ts';
import { hashPassword } from '../src/services/admin-auth.ts';
import { normalizeUsername, passwordError, usernameError } from '../src/services/user-schema.ts';
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

let dataDir: string;
try {
  dataDir = loadDataDir();
} catch (err) {
  if (err instanceof ConfigError) fail(err.message);
  throw err;
}

const password = await readHidden(`Contraseña nueva para ${username}: `);
const invalidPassword = passwordError(password);
if (invalidPassword) fail(invalidPassword);
if (stdin.isTTY && (await readHidden('Repite la contraseña: ')) !== password) fail('Las contraseñas no coinciden.');

let database: Awaited<ReturnType<typeof openDatabase>>;
try {
  database = await openDatabase({ dataDir });
} catch (err) {
  if (err instanceof DatabaseInitError) {
    fail(`No se pudo preparar la base de datos en DATA_DIR (${err.code}): revisa permisos, espacio libre y que el archivo no esté dañado.`);
  }
  throw err;
}

try {
  const users = createUserRepository({ prisma: database.prisma });
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
  await database.prisma.$disconnect();
}
