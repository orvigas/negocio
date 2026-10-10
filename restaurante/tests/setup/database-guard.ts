import { testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * Salvaguarda de REQ-F-014 (RF-13, CA-12), en cada archivo de pruebas: si TEST_DATABASE_URL o
 * TEST_ADMIN_DATABASE_URL apuntan a un host o a una base que no son de pruebas, el archivo falla
 * antes de abrir ninguna conexión. (globalSetup ya lo comprueba una vez para toda la suite.)
 */
testDatabaseConfigs();
