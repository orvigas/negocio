import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import * as nodeFs from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { BUSINESS_IDS } from '../config/businesses.js';
import { createMenuRepository } from './menu-repository.js';

/**
 * Repositorio de menús sobre archivos JSON (REQ-F-001, RF-6 y RF-8).
 *
 * DATA_DIR/
 *   <negocio>/current.json          versión vigente
 *   <negocio>/previous.json         versión anterior
 *   <negocio>/damaged-<fecha>.json  archivo dañado aislado
 *   <negocio>/damaged.marker.json   estado "dañado" persistente
 *   changes.jsonl                   registro de cambios (una línea JSON por entrada)
 *
 * Escritura atómica: archivo temporal en el mismo directorio + fsync + rename + fsync del
 * directorio. Si algo falla, el archivo de destino conserva su versión completa anterior.
 */

const FILE_NAMES = Object.freeze({
  current: 'current.json',
  previous: 'previous.json',
  marker: 'damaged.marker.json',
});

export const CHANGE_LOG_FILE = 'changes.jsonl';

const FILE_MODE = 0o600;

/** fsync del directorio para que el rename sobreviva a un corte de energía (best effort). */
async function syncDirectory(fs, directory) {
  let handle;
  try {
    handle = await fs.open(directory, 'r');
    await handle.sync();
  } catch {
    // Algunas plataformas no permiten sincronizar directorios; el rename ya es atómico.
  } finally {
    await handle?.close().catch(() => {});
  }
}

/**
 * Escribe `text` en `path` de forma atómica.
 * @param {typeof import('node:fs/promises')} fs
 */
export async function writeFileAtomic(fs, path, text) {
  const directory = dirname(path);
  const temporary = join(directory, `.${basename(path)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', FILE_MODE);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, path);
  } catch (err) {
    await handle?.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw err;
  }
  await syncDirectory(fs, directory);
}

/**
 * @param {{ dataDir: string, fs?: typeof import('node:fs/promises') }} options
 */
export function createFileStorage({ dataDir, fs = nodeFs }) {
  if (typeof dataDir !== 'string' || dataDir === '') throw new TypeError('createFileStorage requiere dataDir');

  const businessDir = (businessId) => join(dataDir, businessId);
  const pathOf = (businessId, name) => {
    if (!Object.hasOwn(FILE_NAMES, name)) throw new TypeError(`Archivo desconocido: ${name}`);
    return join(businessDir(businessId), FILE_NAMES[name]);
  };

  return Object.freeze({
    async init() {
      for (const businessId of BUSINESS_IDS) {
        await fs.mkdir(businessDir(businessId), { recursive: true, mode: 0o700 });
        await fs.access(businessDir(businessId), fsConstants.R_OK | fsConstants.W_OK);
      }
    },

    async read(businessId, name) {
      try {
        return await fs.readFile(pathOf(businessId, name), 'utf8');
      } catch (err) {
        if (err?.code === 'ENOENT') return null;
        throw err;
      }
    },

    write(businessId, name, text) {
      return writeFileAtomic(fs, pathOf(businessId, name), text);
    },

    async remove(businessId, name) {
      await fs.rm(pathOf(businessId, name), { force: true });
    },

    async isolate(businessId, stamp) {
      const target = `damaged-${stamp}-${randomBytes(3).toString('hex')}.json`;
      try {
        await fs.rename(pathOf(businessId, 'current'), join(businessDir(businessId), target));
        await syncDirectory(fs, businessDir(businessId));
        return target;
      } catch (err) {
        if (err?.code === 'ENOENT') return null;
        throw err;
      }
    },

    async appendChange(line) {
      const handle = await fs.open(join(dataDir, CHANGE_LOG_FILE), 'a', FILE_MODE);
      try {
        await handle.writeFile(`${line}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    },
  });
}

/**
 * @param {{
 *   dataDir: string,
 *   timezone: string,
 *   now?: () => Date,
 *   logger?: object,
 *   fs?: typeof import('node:fs/promises'),
 *   seeds?: Record<string, object>,
 * }} options
 */
export function createFileMenuRepository({ dataDir, fs, ...options }) {
  return createMenuRepository({ ...options, storage: createFileStorage({ dataDir, fs }) });
}
