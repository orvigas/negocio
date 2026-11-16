import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // REQ-F-015 (RF-5): la suite corre siempre con NODE_ENV=test, aunque se haya exportado otro valor.
    env: { NODE_ENV: 'test' },
    // Base de pruebas MySQL (REQ-F-014): salvaguarda, MySQL disponible e id de ejecución.
    globalSetup: ['tests/setup/database-global.ts'],
    // Ninguna prueba usa una base que no sea de pruebas. La red de seguridad contra Meta y Twilio
    // (no-meta.ts) está en la api, con el bot (REQ-F-042).
    setupFiles: ['tests/setup/database-guard.ts'],
    // La primera base de cada trabajador se migra con el CLI de Prisma (unos segundos).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
