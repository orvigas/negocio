// Configuración del CLI de Prisma (REQ-F-007, DT-5). Solo se usa en desarrollo, en el CI y en
// las etapas build/test de Docker: la imagen de producción no incluye el CLI ni este archivo.
import { join, resolve } from 'node:path';

import { defineConfig } from 'prisma/config';

import { databaseFile } from './src/db/paths.ts';

// Prisma 7 no lee .env: se carga aquí si existe (igual que `npm start`).
try {
  process.loadEnvFile(join(import.meta.dirname, '.env'));
} catch {
  // Sin .env: se usan las variables del entorno.
}

const dataDir = process.env.DATA_DIR?.trim() || join(import.meta.dirname, 'data');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: `file:${databaseFile(resolve(import.meta.dirname, dataDir))}` },
});
