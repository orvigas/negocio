import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createImageChecker } from '@restaurante/web';

import { DEFAULT_PUBLIC_DIR } from '../../src/app.ts';

/**
 * createImageChecker (@restaurante/web): implementación con el disco del puerto ImageExists de
 * core/catalog. Solo acepta archivos dentro de `<publicDir>/img`.
 */
describe('createImageChecker', () => {
  let publicDir: string;
  let imageExists: (src: string) => Promise<boolean>;

  beforeAll(() => {
    publicDir = mkdtempSync(join(tmpdir(), 'image-checker-'));
    mkdirSync(join(publicDir, 'img', 'molotes'), { recursive: true });
    writeFileSync(join(publicDir, 'img', 'molotes', 'foto.jpg'), 'jpg');
    writeFileSync(join(publicDir, 'secreto.txt'), 'fuera de img');
    imageExists = createImageChecker(publicDir);
  });

  afterAll(() => rmSync(publicDir, { recursive: true, force: true }));

  it('un archivo existente dentro de img: true', async () => {
    expect(await imageExists('/img/molotes/foto.jpg')).toBe(true);
  });

  it('un archivo inexistente: false', async () => {
    expect(await imageExists('/img/molotes/no-existe.jpg')).toBe(false);
  });

  it('un directorio: false', async () => {
    expect(await imageExists('/img/molotes')).toBe(false);
  });

  it.each(['/img/../secreto.txt', '/img/molotes/../../secreto.txt', '/img/../../etc/passwd'])('salirse de img con .. (%s): false', async (src) => {
    expect(await imageExists(src)).toBe(false);
  });

  it.each(['/img', '/img/'])('%s a secas: false', async (src) => {
    expect(await imageExists(src)).toBe(false);
  });

  it('encuentra las imágenes reales de public/img de las landings', async () => {
    expect(await createImageChecker(DEFAULT_PUBLIC_DIR)('/img/molotes/molotes-queso-oaxaca.jpg')).toBe(true);
  });
});
