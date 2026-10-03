import { createMenuRepository } from './menu-repository.js';

/**
 * Repositorio de menús en memoria: mismas reglas que el de archivos, sin tocar el disco.
 * Se usa en las pruebas de controladores y landings (CA-38) y sirve de referencia del contrato.
 *
 * `storage.files` expone el contenido para que las pruebas puedan inspeccionarlo o dañarlo.
 */
export function createMemoryStorage() {
  const files = new Map();
  const changes = [];
  const key = (businessId, name) => `${businessId}/${name}`;

  return Object.freeze({
    files,
    changes,
    async init() {},
    async read(businessId, name) {
      return files.get(key(businessId, name)) ?? null;
    },
    async write(businessId, name, text) {
      files.set(key(businessId, name), text);
    },
    async remove(businessId, name) {
      files.delete(key(businessId, name));
    },
    async isolate(businessId, stamp) {
      const current = key(businessId, 'current');
      if (!files.has(current)) return null;
      const target = `damaged-${stamp}.json`;
      files.set(key(businessId, target), files.get(current));
      files.delete(current);
      return target;
    },
    async appendChange(line) {
      changes.push(JSON.parse(line));
    },
  });
}

/**
 * @param {{ timezone?: string, now?: () => Date, logger?: object, seeds?: Record<string, object>, storage?: object }} [options]
 */
export function createMemoryMenuRepository({ storage = createMemoryStorage(), timezone = 'America/Mexico_City', ...options } = {}) {
  const repository = createMenuRepository({ ...options, timezone, storage });
  return Object.freeze({ ...repository, storage });
}
