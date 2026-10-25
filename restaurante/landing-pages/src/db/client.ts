import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { PoolConfig } from 'mariadb';

import type { DatabaseConfig } from '../config/env.ts';
import { PrismaClient } from '../generated/prisma/client.ts';

/**
 * Cliente de Prisma sobre MySQL 8.4 (REQ-F-014) con el adaptador oficial @prisma/adapter-mariadb.
 *
 * - Pool pequeño: una sola instancia de la app, landings servidas desde la caché.
 * - Conexión en utf8mb4 (D-4). La colación de la conexión es la utf8mb4 por defecto de MySQL 8
 *   (`UTF8MB4_0900_AI_CI`, índice 255): las comparaciones y el orden usan la colación de cada
 *   columna (utf8mb4_es_0900_as_cs), no la de la conexión.
 * - Sin consultas de inicio de sesión (`sessionVariables`, ni una colación con índice > 255, que
 *   obligaría a un `SET NAMES`): en mariadb 3.4.5 un fallo de red durante esas consultas deja una
 *   promesa rechazada sin manejar, que tiraría el proceso con MySQL caído (RF-9). Por eso las fechas
 *   las pone siempre la app en UTC (RF-12). Una espera de bloqueo larga no la corta el `timeout` de
 *   la transacción de Prisma: la corta `innodb_lock_wait_timeout` del servidor (50 s por defecto en
 *   MySQL 8.4; 10 s en producción, deploy/compose.prod.yaml, REQ-F-016) y la respuesta es 503 sin
 *   cambios.
 * - `allowPublicKeyRetrieval`: caching_sha2_password sin TLS dentro de la red interna de Docker
 *   (la contraseña viaja cifrada con la clave RSA del servidor). En producción MySQL está en una red
 *   interna de Docker sin puertos publicados (REQ-F-016); con un MySQL remoto haría falta TLS.
 * - `errorFormat: 'minimal'` evita mensajes con rutas del código. Nunca se registra la configuración.
 */

export type Database = PrismaClient;

export function poolConfig(database: DatabaseConfig): PoolConfig {
  return {
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    database: database.database,
    connectionLimit: 5,
    connectTimeout: 3000,
    acquireTimeout: 5000,
    allowPublicKeyRetrieval: true,
    collation: 'UTF8MB4_0900_AI_CI',
  };
}

export function createPrismaClient(database: DatabaseConfig): Database {
  return new PrismaClient({
    adapter: new PrismaMariaDb(poolConfig(database), { database: database.database }),
    errorFormat: 'minimal',
  });
}
