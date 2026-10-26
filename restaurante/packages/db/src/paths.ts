import { join } from 'node:path';

/** Carpeta del paquete db (REQ-F-037): contiene prisma/ (schema y migraciones) y prisma.config.ts. */
export const DB_PACKAGE_DIR = join(import.meta.dirname, '..');
