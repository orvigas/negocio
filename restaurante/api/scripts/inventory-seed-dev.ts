/**
 * Semilla de desarrollo del inventario (REQ-F-049, RF-10 y PV-5):
 *
 *   npm run inventory:seed-dev
 *
 * Carga los artículos y categorías ficticios de `support/inventory-dev-seed.ts` en la base de
 * DATABASE_URL, solo si es local (127.0.0.1, localhost, ::1 o mysql-dev) y NODE_ENV no es
 * production. Es idempotente: si ya hay artículos o categorías, no hace nada. No migra: antes
 * verifica que la base esté lista. La `api` nunca la ejecuta al arrancar, así que una instalación de
 * producción queda con el inventario vacío.
 */
import { stderr, stdout } from 'node:process';

import { createInventoryRepository } from '@restaurante/core/inventory';
import { createPrismaClient } from '@restaurante/db/client';
import type { DatabaseConfig } from '@restaurante/db/database-config';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';
import { DatabaseInitError, probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { ApiConfigError, loadDatabaseConfig } from '../src/config.ts';
import { devSeedRefusal, seedInventoryDev } from './support/inventory-dev-seed.ts';

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

const WINDOW_MS = 10_000;

let databaseConfig: DatabaseConfig;
try {
  databaseConfig = loadDatabaseConfig();
} catch (err) {
  if (err instanceof ApiConfigError) fail(err.message);
  throw err;
}

const refusal = devSeedRefusal({ nodeEnv: process.env.NODE_ENV, host: databaseConfig.host });
if (refusal) fail(refusal);

const prisma = createPrismaClient(databaseConfig);
try {
  await verifyDatabase({ probe: probeOf(databaseConfig), query: queryOf(prisma), windowMs: WINDOW_MS });
} catch (err) {
  await prisma.$disconnect();
  if (err instanceof DatabaseInitError) fail(`No se pudo usar la base de datos (${err.code}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas.`);
  throw err;
}

try {
  const { created } = await seedInventoryDev(createInventoryRepository({ store: createPrismaInventoryStore({ prisma }) }));
  stdout.write(created > 0 ? `Semilla de desarrollo cargada: ${created} artículos.\n` : 'El inventario ya tiene datos: no se cargó la semilla.\n');
} catch {
  // Sin detalles técnicos (los errores de Prisma incluyen rutas e invocaciones).
  stderr.write('No se pudo cargar la semilla: la base de datos no respondió o rechazó los datos.\n');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
