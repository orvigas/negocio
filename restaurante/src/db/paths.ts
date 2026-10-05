import { join } from 'node:path';

/**
 * Ubicación de la base de datos SQLite (REQ-F-007, DT-1). Compartida por la app, el comando de
 * recuperación y prisma.config.ts.
 */

export const DATABASE_FILE_NAME = 'restaurante.db';

export const databaseFile = (dataDir: string): string => join(dataDir, DATABASE_FILE_NAME);
