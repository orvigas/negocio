import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

/**
 * Comprobación de que una ruta de imagen (`/img/...`) corresponde a un archivo dentro de
 * `<publicDir>/img` (DT-6 de REQ-F-001; RF-7.1 de REQ-F-008). En core desde REQ-F-039: la usa
 * landing-pages (menús) y la API, que lleva una copia de `public/img` de las landings (RF-11).
 */

export type ImageExists = (src: string) => Promise<boolean>;

export function createImageChecker(publicDir: string): ImageExists {
  const imgDir = resolve(publicDir, 'img');
  return async function imageExists(src) {
    const file = resolve(publicDir, `.${src}`);
    const rel = relative(imgDir, file);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return false;
    try {
      return (await stat(join(imgDir, rel))).isFile();
    } catch {
      return false;
    }
  };
}
