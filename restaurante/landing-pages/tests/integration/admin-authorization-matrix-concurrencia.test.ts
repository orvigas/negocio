import { describe } from 'vitest';

import { LAST_ADMIN_RACES, lastAdminRaces } from '../support/admin-authorization-matrix.ts';

/**
 * Matriz de autorización de /admin (REQ-F-007): siempre queda un administrador activo, también con
 * peticiones simultáneas (D-7, CA-10). REQ-F-041: parte de admin-authorization-matrix.test.ts; las
 * carreras están en tests/support/admin-authorization-matrix.ts.
 */

describe('siempre queda un administrador activo, también con peticiones simultáneas (D-7, CA-10)', () => {
  lastAdminRaces(LAST_ADMIN_RACES.slice(0, 2));
});
