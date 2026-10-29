import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

/**
 * Comprobación de que una ruta de imagen (`/img/...`) corresponde a un archivo dentro de
 * `<publicDir>/img` (DT-6 de REQ-F-001; RF-7.1 de REQ-F-008). La usan landing-pages (menús) y la
 * API, que lleva una copia de `public/img` de las landings (REQ-F-039, RF-11).
 *
 * Es la implementación con el disco del puerto `ImageExists` de `@restaurante/core/catalog`
 * (restaurante/docs/arquitectura.md §3): web no importa core, así que la firma se declara aquí y es
 * compatible estructuralmente.
 */
export type ImageChecker = (src: string) => Promise<boolean>;

export function createImageChecker(publicDir: string): ImageChecker {
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
