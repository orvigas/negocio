import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Base de pruebas MySQL (REQ-F-014): salvaguarda, MySQL disponible e id de ejecución.
    globalSetup: ['tests/setup/database-global.ts'],
    // Ninguna prueba llama a Meta (REQ-F-009, RF-11.1); ninguna usa una base que no sea de pruebas.
    setupFiles: ['tests/setup/no-meta.ts', 'tests/setup/database-guard.ts'],
    // La primera base de cada trabajador se migra con el CLI de Prisma (unos segundos).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
