/**
 * Importación única de datos maestros del inventario (REQ-F-050, A5):
 *
 *   npm run inventory:import -- --archivo <ruta|-> [--escribir] [--produccion]
 *   (en el contenedor api: node scripts/inventory-import.ts --archivo - --produccion < archivo.json)
 *
 * - Sin --escribir es un ensayo: valida el archivo contra el inventario y dice qué crearía, qué ya
 *   existe igual y qué choca, sin escribir nada. Con --escribir, una sola transacción: todo o nada.
 * - Salvaguardas: con NODE_ENV=production exige --produccion; fuera de producción, solo contra una base
 *   local; un archivo marcado como ficticio nunca se importa en producción; 2 MB como máximo.
 * - Usa DATABASE_URL (el usuario solo DML: la importación solo inserta) y no migra: antes verifica
 *   que la base esté lista.
 * - El JSON real se genera fuera del repositorio y nunca se versiona (`npm run lint` lo impide). La
 *   salida solo lleva conteos y, por problema, la fila del origen, el campo y el mensaje.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stderr, stdin, stdout } from 'node:process';

import { IMPORT_MAX_BYTES, InventoryBusyError, runMasterImport } from '@restaurante/core/inventory';
import { createPrismaClient } from '@restaurante/db/client';
import type { DatabaseConfig } from '@restaurante/db/database-config';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';
import { DatabaseInitError, probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { ApiConfigError, loadDatabaseConfig } from '../src/config.ts';
import { fictitiousRefusal, formatImportReport, importExitCode, importRefusal, parseImportArgs, parseJson, readLimited } from './support/inventory-import-cli.ts';

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

const WINDOW_MS = 10_000;
/** La importación escribe todo en una transacción: más margen que las escrituras de la app (10 s). */
const IMPORT_TIMEOUT_MS = 60_000;

const parsedArgs = parseImportArgs(process.argv.slice(2));
if (!parsedArgs.ok) fail(parsedArgs.message);
const { args } = parsedArgs;

let databaseConfig: DatabaseConfig;
try {
  databaseConfig = loadDatabaseConfig();
} catch (err) {
  if (err instanceof ApiConfigError) fail(err.message);
  throw err;
}

const refusal = importRefusal({ nodeEnv: process.env.NODE_ENV, host: databaseConfig.host, production: args.production });
if (refusal) fail(refusal);

// Una ruta relativa se lee desde la carpeta donde se lanzó npm (INIT_CWD), no desde `api/`.
const path = args.file === '-' ? '-' : resolve(process.env.INIT_CWD ?? process.cwd(), args.file);
if (path !== '-') {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) fail('No se encontró el archivo indicado en --archivo.');
  if (info.size > IMPORT_MAX_BYTES) fail(`El archivo pasa de ${IMPORT_MAX_BYTES / (1024 * 1024)} MB.`);
}
const read = await readLimited(path === '-' ? stdin : createReadStream(path));
if (!read.ok) fail(read.message);
const json = parseJson(read.text);
if (!json.ok) fail(json.message);
const ficticio = typeof json.data === 'object' && json.data !== null && (json.data as Record<string, unknown>).ficticio === true;
const fictitious = fictitiousRefusal({ production: args.production, ficticio });
if (fictitious) fail(fictitious);

const prisma = createPrismaClient(databaseConfig);
try {
  await verifyDatabase({ probe: probeOf(databaseConfig), query: queryOf(prisma), windowMs: WINDOW_MS });
} catch (err) {
  await prisma.$disconnect();
  if (err instanceof DatabaseInitError) fail(`No se pudo usar la base de datos (${err.code}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas.`);
  throw err;
}

try {
  const report = await runMasterImport({ store: createPrismaInventoryStore({ prisma, writeTimeoutMs: IMPORT_TIMEOUT_MS }), input: json.data, write: args.write });
  stdout.write(formatImportReport(report));
  process.exitCode = importExitCode(report);
} catch (err) {
  // Sin detalles técnicos (los errores de Prisma incluyen rutas e invocaciones) ni contenido del archivo.
  stderr.write(
    err instanceof InventoryBusyError
      ? 'El inventario está ocupado con otra escritura: no se escribió nada. Inténtalo de nuevo.\n'
      : 'No se pudo importar: la base de datos no respondió o rechazó los datos. No se escribió nada.\n',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
