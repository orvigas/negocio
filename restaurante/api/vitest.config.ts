import { defineConfig } from 'vitest/config';

// Pruebas de la API (REQ-F-038): en proceso, con el store de productos en memoria; sin MySQL ni red
// externa. Las pruebas con MySQL real arrancan el proceso de la API desde
// landing-pages/tests/integration/api-process.test.ts (soporte de bases de pruebas compartido).
export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
  },
});
