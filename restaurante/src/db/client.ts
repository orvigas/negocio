import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client.ts';
import { DEFAULT_MIGRATIONS_DIR, prepareDatabase } from './migrate.ts';
import { databaseFile } from './paths.ts';

/**
 * Cliente de Prisma sobre SQLite (REQ-F-007, DT-1). Una sola conexión por proceso, en modo WAL
 * (lo deja activado prepareDatabase) y con espera de 5 s si otro proceso (el comando de
 * recuperación) está escribiendo. `errorFormat: 'minimal'` evita mensajes con rutas del código.
 */

export type Database = PrismaClient;

export function createPrismaClient(file: string): Database {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}`, timeout: 5000 }), errorFormat: 'minimal' });
}

export interface OpenDatabaseOptions {
  dataDir: string;
  migrationsDir?: string;
  now?: () => Date;
}

/**
 * Prepara el .db de DATA_DIR (escritura, integridad y migraciones) y devuelve el cliente.
 * @throws {import('./migrate.ts').DatabaseInitError}
 */
export async function openDatabase({ dataDir, migrationsDir = DEFAULT_MIGRATIONS_DIR, now }: OpenDatabaseOptions): Promise<{
  prisma: Database;
  applied: string[];
}> {
  const file = databaseFile(dataDir);
  const applied = await prepareDatabase({ file, migrationsDir, ...(now ? { now } : {}) });
  return { prisma: createPrismaClient(file), applied };
}
