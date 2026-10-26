import { describe, expect, it } from 'vitest';

import { DEFAULT_TEST_ADMIN_DATABASE_URL, DEFAULT_TEST_DATABASE_URL, testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * Salvaguarda de la base de pruebas (REQ-F-014, RF-13 y CA-12): las URL de prueba solo pueden
 * apuntar a un host local o a `mysql-dev` y a bases con el prefijo `restaurante_test`.
 */

const env = (overrides: Record<string, string>) => ({ TEST_DATABASE_URL: DEFAULT_TEST_DATABASE_URL, TEST_ADMIN_DATABASE_URL: DEFAULT_TEST_ADMIN_DATABASE_URL, ...overrides });

describe('salvaguarda de la base de pruebas', () => {
  it('acepta las URL locales por defecto y las del contenedor de pruebas', () => {
    expect(testDatabaseConfigs({})).toMatchObject({ app: { host: '127.0.0.1', port: 3307, database: 'restaurante_test' }, admin: { user: 'restaurante_test_admin' } });
    expect(testDatabaseConfigs(env({ TEST_DATABASE_URL: 'mysql://u:p@mysql-dev:3306/restaurante_test' })).app.host).toBe('mysql-dev');
    expect(testDatabaseConfigs(env({ TEST_DATABASE_URL: 'mysql://u:p@localhost/restaurante_test_x' })).app.database).toBe('restaurante_test_x');
  });

  it.each([
    ['otro host', 'TEST_DATABASE_URL', 'mysql://u:clave-real@db.produccion.mx:3306/restaurante_test', /host que no es de pruebas/],
    ['el servicio mysql de producción', 'TEST_ADMIN_DATABASE_URL', 'mysql://u:clave-real@mysql:3306/restaurante_test', /host que no es de pruebas/],
    ['una base sin el prefijo', 'TEST_DATABASE_URL', 'mysql://u:clave-real@127.0.0.1:3307/restaurante', /sin el prefijo "restaurante_test"/],
    ['un prefijo parecido', 'TEST_ADMIN_DATABASE_URL', 'mysql://u:clave-real@127.0.0.1:3307/restaurante_testing', /sin el prefijo/],
    ['una URL inválida', 'TEST_DATABASE_URL', 'postgres://u:clave-real@127.0.0.1/restaurante_test', /no es válida/],
  ])('rechaza %s antes de conectar, sin mostrar la URL', (_case, name, value, message) => {
    let error: unknown;
    try {
      testDatabaseConfigs(env({ [name]: value }));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(message);
    expect((error as Error).message).not.toContain('clave-real');
  });
});
