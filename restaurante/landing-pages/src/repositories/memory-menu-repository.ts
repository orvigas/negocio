import type { BusinessId } from '@restaurante/core/shared';

import {
  createMenuRepository,
  type MenuRepository,
  type MenuRepositoryOptions,
  type MenuStorage,
} from './menu-repository.ts';

export interface MemoryStorage extends MenuStorage {
  readonly files: Map<string, string>;
  readonly changes: unknown[];
}

/**
 * Repositorio de menús en memoria: mismas reglas que el de archivos, sin tocar el disco.
 * Se usa en las pruebas de controladores y landings (CA-38) y sirve de referencia del contrato.
 *
 * `storage.files` expone el contenido para que las pruebas puedan inspeccionarlo o dañarlo.
 */
export function createMemoryStorage(): MemoryStorage {
  const files = new Map<string, string>();
  const changes: unknown[] = [];
  const key = (businessId: BusinessId, name: string): string => `${businessId}/${name}`;

  return Object.freeze<MemoryStorage>({
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
      // Existe: comprobado con has() justo arriba.
      files.set(key(businessId, target), files.get(current) as string);
      files.delete(current);
      return target;
    },
    async appendChange(line) {
      changes.push(JSON.parse(line));
    },
  });
}

export function createMemoryMenuRepository({
  storage = createMemoryStorage(),
  timezone = 'America/Mexico_City',
  ...options
}: Partial<Omit<MenuRepositoryOptions, 'storage'>> & { storage?: MemoryStorage } = {}): MenuRepository & {
  storage: MemoryStorage;
} {
  const repository = createMenuRepository({ ...options, timezone, storage });
  return Object.freeze({ ...repository, storage });
}
