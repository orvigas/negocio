/**
 * Lectura de una contraseña en la consola sin mostrarla (REQ-F-001 DT-2 y REQ-F-007 R-5).
 * Compartida por `npm run admin:hash-password` y `npm run admin:recover`.
 *
 * Con terminal interactiva lee en modo raw sin eco. Sin terminal (p. ej. una tubería o las
 * pruebas) devuelve la primera línea de stdin. La contraseña nunca se escribe en archivos.
 */
import { stdin, stderr } from 'node:process';

export function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      // Sin terminal interactiva (p. ej. tubería): lee la primera línea de stdin.
      let data = '';
      stdin.setEncoding('utf8');
      // Tras setEncoding('utf8'), cada fragmento llega como string.
      stdin.on('data', (chunk: string) => {
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
