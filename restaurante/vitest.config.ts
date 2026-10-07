import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ninguna prueba llama a Meta (REQ-F-009, RF-11.1).
    setupFiles: ['tests/setup/no-meta.ts'],
  },
});
