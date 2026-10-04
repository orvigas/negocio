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

const MIN_LENGTH = 12;

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      // Sin terminal interactiva (p. ej. tubería): lee la primera línea de stdin.
      let data = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => {
        data += chunk;
      });
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0] ?? ''));
      stdin.on('error', reject);
      return;
    }
    stderr.write(prompt);
    let value = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stderr.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          stderr.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on('data', onData);
  });
}

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
