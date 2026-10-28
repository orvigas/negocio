import { defineConfig } from 'vitest/config';

// Pruebas del admin nuevo (REQ-F-039, PR 2): en proceso, contra un doble de /api/v1/admin que cumple
// el contrato de packages/contracts (tests/support/api-double.ts); sin MySQL ni red externa.
export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
  },
});
