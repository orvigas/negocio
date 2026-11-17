---
name: mysql-patterns
description: Patrones de esquema, consultas, índices, transacciones, replicación y pools de conexiones de MySQL y MariaDB para backends de producción. Úsalo al diseñar esquemas e índices de MySQL o MariaDB, o cuando una consulta, una transacción o una réplica se retrasa.
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/mysql-patterns/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# Patrones de MySQL

Usa esta skill al trabajar en el diseño de esquemas de MySQL o MariaDB, migraciones,
investigación de consultas lentas, transacciones de estilo cola, pools de conexiones o
configuración de bases de datos de producción. Prefiere comprobar la versión exacta antes de aplicar un
patrón específico de una funcionalidad, porque MySQL y MariaDB han divergido en varios
detalles de SQL.

## Activación

- Diseño de tablas, índices y restricciones de MySQL o MariaDB
- Revisión de migraciones antes de que se ejecuten sobre tablas grandes de producción
- Depuración de consultas lentas, esperas de bloqueo, interbloqueos (deadlocks) o agotamiento de conexiones
- Incorporación de paginación por keyset, upserts, búsqueda de texto completo, columnas JSON o colas
- Configuración de pools de conexiones de la aplicación, réplicas de lectura, TLS o registros de consultas lentas

## Comprobación de versión

Empieza identificando el motor y la versión:

```sql
SELECT VERSION();
SHOW VARIABLES LIKE 'version_comment';
```

Mantén por separado la guía de MySQL y la de MariaDB cuando la sintaxis difiera:

- MySQL documenta los alias de fila como el reemplazo de `VALUES(col)` en
  `ON DUPLICATE KEY UPDATE`; `VALUES(col)` está obsoleto allí.
- MariaDB documenta `VALUES(col)` como la forma admitida de hacer referencia a los valores
  insertados en `ON DUPLICATE KEY UPDATE`; úsalo para la compatibilidad entre motores.
- `SKIP LOCKED` es apropiado solo para trabajo de tipo cola. Omite las filas bloqueadas
  y puede devolver una vista inconsistente, así que no lo uses para contabilidad general
  ni para lecturas sensibles a la integridad.

## Valores por defecto del esquema

```sql
CREATE TABLE orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(32) NOT NULL,
    total DECIMAL(15, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_orders_account_status_created (account_id, status, created_at),
    KEY idx_orders_active (account_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Opciones por defecto:

| Caso de uso | Preferir | Evitar |
| --- | --- | --- |
| Claves primarias sustitutas | `BIGINT UNSIGNED AUTO_INCREMENT` | `INT` en tablas que pueden crecer más allá de 2 mil millones de filas |
| Claves de búsqueda UUID | `BINARY(16)` con funciones auxiliares de conversión | Claves primarias `VARCHAR(36)` en tablas de mucho uso |
| Dinero y cantidades exactas | `DECIMAL(p, s)` | `FLOAT` o `DOUBLE` |
| Texto visible para el usuario | Tablas e índices `utf8mb4` | Valores por defecto `utf8` / `utf8mb3` de MySQL |
| Marcas de tiempo de la aplicación | `DATETIME` con UTC gestionado por la aplicación | Suponer que `DATETIME` guarda metadatos de zona horaria |
| Borrados lógicos | `deleted_at DATETIME NULL` más índices acotados | Filtrar las filas borradas lógicamente sin un índice |
| Valores de estado extensibles | tabla de consulta o `VARCHAR` con restricción | `ENUM` cuando los valores cambian a menudo |

## Índices

El orden de un índice compuesto suele seguir primero los predicados de igualdad y después las
columnas de rango u ordenación:

```sql
CREATE INDEX idx_orders_account_status_created
    ON orders (account_id, status, created_at);

SELECT id, total
FROM orders
WHERE account_id = ?
  AND status = 'pending'
  AND created_at >= ?
ORDER BY created_at DESC
LIMIT 50;
```

Usa `EXPLAIN` antes de añadir o cambiar un índice:

```sql
EXPLAIN
SELECT id, total
FROM orders
WHERE account_id = 123 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;
```

Señales que investigar:

| Campo | Señal de riesgo |
| --- | --- |
| `type` | `ALL` en una tabla grande |
| `key` | `NULL` cuando existe un predicado selectivo |
| `rows` | Estimación de filas muy alta para una ruta interactiva |
| `Extra` | `Using temporary`, `Using filesort` o `Using where` amplio |

Evita añadir índices a ciegas. Cada índice aumenta el costo de escritura, el tiempo de migración,
el tamaño de los respaldos y la presión sobre el buffer pool.

## Patrones de consulta

### Upsert

Forma compatible entre motores:

```sql
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    updated_at = CURRENT_TIMESTAMP;
```

Forma con alias de fila de MySQL:

```sql
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (?, ?, ?) AS new
ON DUPLICATE KEY UPDATE
    setting_value = new.setting_value,
    updated_at = CURRENT_TIMESTAMP;
```

Usa la forma con alias de fila solo después de confirmar que el destino es MySQL. Usa
`VALUES(col)` para MariaDB o para flotas mixtas de MySQL/MariaDB.

### Paginación por keyset

```sql
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < (?, ?)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Respáldala con un índice que coincida con el cursor:

```sql
CREATE INDEX idx_products_created_id ON products (created_at, id);
```

No uses paginación con `OFFSET` profundo en tablas grandes; hace que el servidor recorra
y descarte filas antes de devolver la página.

### Campos JSON

Usa columnas JSON para datos de extensión, no para campos que necesiten un filtrado
relacional intenso o restricciones.

```sql
CREATE TABLE events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payload JSON NOT NULL,
    event_type VARCHAR(64)
        GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type'))) STORED,
    KEY idx_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Para las rutas JSON consultadas con frecuencia, expón una columna generada e indexa esa
columna. Mantén relacionales las claves foráneas, la propiedad, la multitenencia y los campos de ciclo de vida.

### Búsqueda de texto completo

```sql
ALTER TABLE articles ADD FULLTEXT KEY ft_articles_title_body (title, body);

SELECT id, title, MATCH(title, body) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
FROM articles
WHERE MATCH(title, body) AGAINST (? IN NATURAL LANGUAGE MODE)
ORDER BY score DESC
LIMIT 20;
```

Usa una búsqueda externa cuando necesites tolerancia a errores tipográficos, clasificación compleja, facetas
entre tablas o análisis específico de un idioma más allá del comportamiento de texto completo integrado.

## Transacciones

Mantén las transacciones cortas y bloquea las filas en un orden consistente:

```sql
START TRANSACTION;

SELECT id, balance
FROM accounts
WHERE id IN (?, ?)
ORDER BY id
FOR UPDATE;

UPDATE accounts SET balance = balance - ? WHERE id = ?;
UPDATE accounts SET balance = balance + ? WHERE id = ?;

COMMIT;
```

Lista de comprobación de interbloqueos y esperas de bloqueo:

- Bloquea las filas en un orden determinista en todos los caminos de código.
- Haz las llamadas a API externas antes de abrir la transacción, no dentro de ella.
- Añade índices para los predicados usados en `UPDATE`, `DELETE` y lecturas con bloqueo.
- Ante un interbloqueo, haz rollback y reintenta toda la transacción con un presupuesto de
  reintentos acotado.
- Captura `SHOW ENGINE INNODB STATUS\G` poco después de un interbloqueo; los eventos
  posteriores lo sobrescriben.

Reclamación de trabajo por un worker de tipo cola:

```sql
START TRANSACTION;

SELECT id
FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE jobs
SET status = 'processing', started_at = CURRENT_TIMESTAMP
WHERE id = ?;

COMMIT;
```

Usa `SKIP LOCKED` solo para cargas de trabajo de tipo cola donde omitir una fila bloqueada sea
aceptable. No sustituye a la consistencia transaccional normal.

## Pools de conexiones

Ejemplo con SQLAlchemy:

```python
from sqlalchemy import create_engine

engine = create_engine(
    "mysql+mysqlconnector://app:secret@db.internal/app",
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=240,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)
```

Ejemplo con `mysql2` de Node.js:

```javascript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});

const [rows] = await pool.execute(
  'SELECT id, total FROM orders WHERE account_id = ? LIMIT 50',
  [accountId],
);
```

Mantén el reciclado del pool de la aplicación por debajo del `wait_timeout` del servidor. Si el servidor
usa `wait_timeout = 300`, un `pool_recycle` de unos 240 segundos es coherente;
`pool_pre_ping` sigue ayudando a recuperarse de eventos de red y de conmutación por error.

## Diagnóstico

Comandos útiles para una primera pasada:

```sql
SHOW FULL PROCESSLIST;
SHOW ENGINE INNODB STATUS\G;
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
```

Activa el registro de consultas lentas en un entorno controlado:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

Usa `EXPLAIN ANALYZE` solo cuando sea seguro ejecutar la consulta. Ejecuta la
sentencia y puede ser costoso con datos del tamaño de producción.

## Replicación

Las réplicas de lectura pueden retrasarse. No dirijas a una réplica, inmediatamente después de
una escritura, los caminos de leer-lo-que-escribiste, los flujos de pago, las comprobaciones de
permisos ni las lecturas de claves de idempotencia.

```sql
-- Terminología antigua de MySQL, aún común en flotas existentes
SHOW SLAVE STATUS\G;

-- Terminología más nueva donde está disponible
SHOW REPLICA STATUS\G;
```

Comprueba el motor y la versión antes de estandarizar un comando. Monitorea la salud
del hilo SQL de la réplica, la del hilo IO y el retraso, no solo si la conexión TCP
sigue viva.

## Seguridad

```sql
CREATE USER 'app'@'%' IDENTIFIED BY 'use-a-secret-manager';
GRANT SELECT, INSERT, UPDATE, DELETE ON appdb.* TO 'app'@'%';

ALTER USER 'app'@'%' REQUIRE SSL;

SELECT user, host
FROM mysql.user
WHERE user = '';

DROP USER IF EXISTS ''@'localhost';
DROP USER IF EXISTS ''@'%';
```

Puntos de la revisión de seguridad:

- No concedas `ALL PRIVILEGES` ni `*.*` a los usuarios de la aplicación.
- Exige TLS a los usuarios de la aplicación cuando el tráfico cruce hosts o redes.
- Guarda las credenciales en el gestor de secretos de la plataforma, no en ejemplos, scripts ni
  archivos del repositorio.
- Separa los usuarios de migración/administración de los usuarios de la aplicación en ejecución.
- Audita la exposición a la red pública y las direcciones de enlace (bind) antes de ajustar el rendimiento.

## Configuración

Ejemplo de punto de partida para un host de base de datos dedicado:

```ini
[mysqld]
innodb_buffer_pool_size = 4G
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1

max_connections = 300
thread_cache_size = 50

wait_timeout = 300
interactive_timeout = 300
innodb_lock_wait_timeout = 10

slow_query_log = ON
long_query_time = 1
log_queries_not_using_indexes = ON

log_bin = mysql-bin
binlog_format = ROW
binlog_expire_logs_seconds = 604800
```

Trata los valores de configuración como un punto de partida para la revisión, no como un preajuste universal. Dimensiona
la memoria, las conexiones, la retención de registros y los ajustes de durabilidad según la carga de trabajo,
el hardware, la política de respaldos y los objetivos de recuperación.

## Antipatrones

| Antipatrón | Riesgo | Mejor patrón |
| --- | --- | --- |
| `SELECT *` en rutas de mucho uso | Sobrecarga de datos y clientes frágiles | Seleccionar columnas explícitas |
| Paginación con `OFFSET` profundo | Recorridos lineales y páginas lentas | Paginación por keyset |
| Sin índice en los joins de claves foráneas | Joins lentos y borrados con muchos bloqueos | Indexar intencionadamente las columnas FK |
| Transacciones largas | Esperas de bloqueo e historial de undo grande | Confirmar unidades de trabajo pequeñas |
| DML directo contra `mysql.user` | Riesgo de corrupción de las tablas de permisos | Usar `CREATE USER`, `ALTER USER`, `DROP USER` |
| Usuario de la aplicación con permisos de administrador | Radio de impacto alto | Usuario de ejecución con el mínimo privilegio |
| Reciclado del pool por encima de `wait_timeout` | Conexiones agrupadas obsoletas | Reciclar por debajo del tiempo límite y hacer pre-ping |
| Lecturas en réplica después de escrituras | Estado obsoleto visible para el usuario | Fijar a la primaria los flujos de leer-tras-escribir |

## Expectativas de salida

Cuando esta skill se use para una revisión, devuelve:

1. Las suposiciones de motor y versión.
2. Los problemas de mayor riesgo de corrección, bloqueos, seguridad y migración.
3. El SQL o los cambios de código exactos para el camino seguro.
4. El plan de validación: `EXPLAIN`, prueba en seco de la migración, comprobación de bloqueos/interbloqueos y
   criterios de rollback.
5. Cualquier diferencia de sintaxis entre MySQL y MariaDB que afecte a la recomendación.

## Relacionado

- Skill: `postgres-patterns` - patrones de esquema y consultas específicos de PostgreSQL
- Skill: `database-migrations` - planificación de migraciones y seguridad del despliegue
- Skill: `backend-patterns` - patrones de API y de capa de servicio
- Skill: `security-review` - manejo de secretos, autenticación y mínimo privilegio
- Agente: `database-reviewer` - flujo de revisión de bases de datos más amplio

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Motor:** MySQL 8.4 (no MariaDB), accedido con Prisma 7 y el adaptador `@prisma/adapter-mariadb` (`restaurante/packages/db/src/client.ts`). Las tablas y los índices son `utf8mb4`. Como el destino es MySQL, la forma con alias de fila del `upsert` es válida, pero el SQL lo genera Prisma: no lo escribas a mano sin necesidad.
- **No hay `mysql2`, SQLAlchemy ni pool propio.** Los ejemplos de esos clientes son ilustrativos: las conexiones las gestiona el cliente de Prisma de `packages/db`. En las pruebas, nunca abras conexiones por tu cuenta ni leas `DATABASE_URL`; usa `makeDatabase()` o `makeScratchDatabase()` de `restaurante/landing-pages/tests/support/database.ts` (`.claude/rules/testing.md`).
- **El esquema se cambia solo con migraciones de Prisma** (`restaurante/packages/db/prisma/migrations/`), aplicadas por el servicio `migrate` del despliegue. Nunca por SQL manual contra producción. Antes de una migración, lee la skill `database-migrations`.
- **Usuarios:** la aplicación usa un usuario solo de DML; el DDL es del usuario de administración o de migración (en las pruebas, `TEST_DATABASE_URL` y `TEST_ADMIN_DATABASE_URL`, solo contra `127.0.0.1`, `localhost`, `::1` o `mysql-dev` y bases con prefijo `restaurante_test`). No relajes esa salvaguarda.
- **Tiempos de espera:** el MySQL de pruebas corta una espera de bloqueo a los 5 s (`--innodb-lock-wait-timeout=5` en `restaurante/compose.yaml`) y producción, a los 10 s.
- **Nada de lo que describe esta skill se ejecuta contra producción** sin autorización explícita del usuario: ni `EXPLAIN ANALYZE`, ni `SET GLOBAL`, ni DDL. Las sondas de diagnóstico de solo lectura (`SHOW ...`) requieren, igualmente, el acceso autorizado al VPS.
- Las skills y el agente de la sección «Relacionado» que no estén instalados en `.claude/` (`postgres-patterns`, `backend-patterns`, `security-review`, `database-reviewer`) no están disponibles en este proyecto; solo lo están `database-migrations` y `prisma-patterns`.
- Las respuestas de la revisión van en español.
