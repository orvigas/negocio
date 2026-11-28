/**
 * Verificación del Kardex (REQ-F-051, RF-13 y CA-15):
 *
 *   npm run inventory:verify
 *   (en el contenedor api: node scripts/inventory-verify.ts)
 *
 * - Solo lectura: recorre por lotes, en una lectura consistente, la cadena de movimientos de cada
 *   artículo y la compara con su existencia guardada (seq contiguo, existencias anterior y nueva, CPP
 *   recalculado, existencia, CPP y último seq). Ver `packages/core/inventory/kardex-verify.ts`.
 * - Sale con 0 si todo cuadra, con 1 si hay descuadres y con 2 si no se pudo verificar (configuración
 *   o base de datos).
 * - Usa DATABASE_URL (el usuario solo DML) y no migra: antes verifica que la base esté lista.
 * - La salida solo lleva conteos, ids y el nombre de cada comprobación: nunca costos, cantidades ni nombres.
 * - Forma parte del simulacro de restauración (`ops/backup/verify-backup.sh --drill`).
 */
import { stderr, stdout } from 'node:process';

import { verifyKardex } from '@restaurante/core/inventory';
import { createPrismaClient } from '@restaurante/db/client';
import type { DatabaseConfig } from '@restaurante/db/database-config';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';
import { DatabaseInitError, probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { ApiConfigError, loadDatabaseConfig } from '../src/config.ts';
import { VERIFY_EXIT, formatVerifyReport, verifyExitCode } from './support/inventory-verify-cli.ts';

const WINDOW_MS = 10_000;
/** Una sola lectura consistente de todo el Kardex: más margen que las lecturas de la app (10 s). */
const VERIFY_TIMEOUT_MS = 120_000;

function unverified(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(VERIFY_EXIT.UNVERIFIED);
}

let databaseConfig: DatabaseConfig;
try {
  databaseConfig = loadDatabaseConfig();
} catch (err) {
  if (err instanceof ApiConfigError) unverified(err.message);
  throw err;
}

const prisma = createPrismaClient(databaseConfig);
try {
  await verifyDatabase({ probe: probeOf(databaseConfig), query: queryOf(prisma), windowMs: WINDOW_MS });
} catch (err) {
  await prisma.$disconnect();
  if (err instanceof DatabaseInitError) unverified(`No se pudo usar la base de datos (${err.code}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas.`);
  throw err;
}

try {
  const store = createPrismaInventoryStore({ prisma, readTimeoutMs: VERIFY_TIMEOUT_MS });
  const report = await store.read(async (reader) => ({ ...(await verifyKardex(reader)), documents: await reader.countDocuments() }));
  stdout.write(formatVerifyReport(report));
  process.exitCode = verifyExitCode(report);
} catch {
  // Sin detalles técnicos (los errores de Prisma incluyen rutas e invocaciones).
  stderr.write('No se pudo verificar el Kardex: la base de datos no respondió.\n');
  process.exitCode = VERIFY_EXIT.UNVERIFIED;
} finally {
  await prisma.$disconnect();
}
