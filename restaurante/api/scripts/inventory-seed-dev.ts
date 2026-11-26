/**
 * Semilla de desarrollo del inventario (REQ-F-049, RF-10 y PV-5):
 *
 *   npm run inventory:seed-dev
 *
 * Carga los artículos, categorías, recetas, proveedores y documentos del Kardex ficticios de
 * `support/inventory-dev-seed.ts` (REQ-F-051: con su propia comprobación de idempotencia) en la base de
 * DATABASE_URL, solo si es local (127.0.0.1, localhost, ::1 o mysql-dev) y NODE_ENV no es
 * production. Es idempotente: si ya hay artículos o categorías, no hace nada. No migra: antes
 * verifica que la base esté lista. La `api` nunca la ejecuta al arrancar, así que una instalación de
 * producción queda con el inventario vacío.
 */
import { stderr, stdout } from 'node:process';

import { businessDate, createInventoryRepository, createKardexRepository, createRecipeRepository, createSupplierRepository } from '@restaurante/core/inventory';
import { createPrismaClient } from '@restaurante/db/client';
import type { DatabaseConfig } from '@restaurante/db/database-config';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';
import { DatabaseInitError, probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { API_DEFAULTS, ApiConfigError, loadDatabaseConfig } from '../src/config.ts';
import { devSeedRefusal, seedInventoryDev, seedKardexDev } from './support/inventory-dev-seed.ts';

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
  const store = createPrismaInventoryStore({ prisma });
  const inventory = createInventoryRepository({ store });
  const { created, recipes } = await seedInventoryDev({ inventory, recipes: createRecipeRepository({ store }) });
  stdout.write(created > 0 ? `Semilla de desarrollo cargada: ${created} artículos y ${recipes} recetas.\n` : 'El inventario ya tiene datos: no se cargó la semilla.\n');
  // REQ-F-051 (RF-15): el Kardex ficticio, con su propia comprobación (sirve también en una base ya sembrada con T2).
  const timeZone = process.env.BUSINESS_TIMEZONE?.trim() || API_DEFAULTS.BUSINESS_TIMEZONE;
  const kardex = createKardexRepository({ store, timeZone });
  const seeded = await seedKardexDev({ inventory, suppliers: createSupplierRepository({ store }), kardex }, businessDate(new Date(), timeZone));
  stdout.write(seeded.documents > 0 ? `Kardex de desarrollo cargado: ${seeded.suppliers} proveedores y ${seeded.documents} documentos.\n` : 'El Kardex ya tiene datos: no se cargó su semilla.\n');
} catch {
  // Sin detalles técnicos (los errores de Prisma incluyen rutas e invocaciones).
  stderr.write('No se pudo cargar la semilla: la base de datos no respondió o rechazó los datos.\n');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
