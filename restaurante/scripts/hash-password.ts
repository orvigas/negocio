/**
 * Genera el valor de ADMIN_PASSWORD_HASH (REQ-F-001, DT-2).
 *
 *   npm run admin:hash-password
 *
 * Pide la contraseña sin mostrarla en pantalla e imprime solo el hash. La contraseña no se
 * guarda en ningún archivo ni en el historial de la terminal.
 */
import { stdin, stdout, stderr } from 'node:process';

import { hashPassword } from '../src/services/admin-auth.ts';
import { PASSWORD_MIN_LENGTH as MIN_LENGTH } from '../src/services/user-schema.ts';
import { readHidden } from './support/read-hidden.ts';

const password = await readHidden('Contraseña de administración: ');
if (password.length < MIN_LENGTH) {
  stderr.write(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.\n`);
  process.exit(1);
}
if (stdin.isTTY) {
  const confirmation = await readHidden('Repite la contraseña: ');
  if (confirmation !== password) {
    stderr.write('Las contraseñas no coinciden.\n');
    process.exit(1);
  }
}

stdout.write(`${await hashPassword(password)}\n`);
