// Configuración del CLI de Prisma (REQ-F-007 y REQ-F-014). Solo se usa en desarrollo, en el CI y en
// las etapas build/test/migrate de Docker: la imagen de producción no incluye el CLI ni este archivo.
//
// - MIGRATION_DATABASE_URL: usuario con DDL (migrate deploy, migrate dev). La app nunca la lee: usa
//   DATABASE_URL, con un usuario solo de datos.
// - SHADOW_DATABASE_URL: base sombra de `migrate dev` y de la comprobación de divergencia del CI.
// Sin ellas (p. ej. `prisma generate` en la etapa build), el CLI funciona sin base de datos.
import { join } from 'node:path';

import { defineConfig } from 'prisma/config';

// Prisma 7 no lee .env: se carga aquí si existe (igual que `npm start`).
try {
  process.loadEnvFile(join(import.meta.dirname, '.env'));
} catch {
  // Sin .env: se usan las variables del entorno.
}

const optional = (name: string): string | undefined => process.env[name]?.trim() || undefined;
const url = optional('MIGRATION_DATABASE_URL');
const shadowDatabaseUrl = optional('SHADOW_DATABASE_URL');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { ...(url ? { url } : {}), ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}) },
});
