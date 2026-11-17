---
name: database-migrations
description: "Patrones seguros y reversibles de migración de bases de datos: cambios de producción solo hacia adelante, renombrados expand-contract sin tiempo de inactividad, índices concurrentes, rellenados (backfills) por lotes y flujos por herramienta para PostgreSQL y Prisma. Úsalo al escribir una migración de esquema o de datos, al añadir una columna o un índice a una tabla grande, al planificar un rollback o al preparar un despliegue sin tiempo de inactividad."
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/database-migrations/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. Se omiten, porque este proyecto no usa esas herramientas, las secciones de Drizzle, Kysely, Django y golang-migrate, y los scripts de ejemplo de PostgreSQL (`examples/`) que el original enlaza. -->

# Patrones de migración de bases de datos

Cambios de esquema de base de datos seguros y reversibles para sistemas en producción.

## Cuándo activarla

- Crear o alterar tablas de bases de datos
- Añadir o quitar columnas o índices
- Ejecutar migraciones de datos (rellenado, transformación)
- Planificar cambios de esquema sin tiempo de inactividad
- Configurar herramientas de migración para un proyecto nuevo

## Principios básicos

1. **Todo cambio es una migración** — nunca alteres manualmente las bases de datos de producción
2. **Las migraciones son solo hacia adelante en producción** — los rollbacks usan nuevas migraciones hacia adelante
3. **Las migraciones de esquema y de datos van por separado** — nunca mezcles DDL y DML en una misma migración
4. **Prueba las migraciones con datos del tamaño de producción** — una migración que funciona con 100 filas puede bloquear con 10 millones
5. **Las migraciones son inmutables una vez desplegadas** — nunca edites una migración que ya se ejecutó en producción

## Lista de comprobación de seguridad de la migración

Antes de aplicar cualquier migración:

- [ ] La migración tiene tanto UP como DOWN (o está marcada explícitamente como irreversible)
- [ ] Se revisaron los modos de bloqueo y los tiempos de retención esperados; usa operaciones concurrentes donde se admitan
- [ ] En tablas con datos, las columnas nuevas admiten nulos o tienen valores por defecto compatibles con sus restricciones
- [ ] Los índices se crean de forma concurrente (no en línea con CREATE TABLE para tablas existentes)
- [ ] El rellenado de datos es una migración separada del cambio de esquema
- [ ] Probada contra una copia de los datos de producción
- [ ] Plan de rollback documentado

## Patrones de PostgreSQL

### Añadir una columna de forma segura

```sql
-- Columna que admite nulos: sin reescritura de la tabla, pero toma un bloqueo ACCESS EXCLUSIVE
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- PostgreSQL 11+: un valor por defecto no volátil evita la reescritura de la tabla
-- Sigue tomando un bloqueo ACCESS EXCLUSIVE y puede esperar a otras transacciones
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- MAL en una tabla con datos: las filas existentes tendrían NULL en la columna nueva
ALTER TABLE users ADD COLUMN role TEXT NOT NULL;
-- Falla con not_null_violation (SQLSTATE 23502); no rellena las filas existentes
```

Evitar la reescritura de la tabla no significa evitar los bloqueos. Estas operaciones
`ADD COLUMN` toman un bloqueo `ACCESS EXCLUSIVE`, que se mantiene hasta que termina la
transacción. Mantén la transacción corta y usa un `lock_timeout` adecuado para acotar las
esperas de adquisición del bloqueo. Un valor por defecto volátil como `clock_timestamp()`
requiere una reescritura de la tabla; la vía rápida de PostgreSQL 11+ se aplica a los valores
por defecto no volátiles. Añadir una columna `NOT NULL` sin valor por defecto puede tener éxito
en una tabla vacía.

Referencia: [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html).

### Añadir un índice sin tiempo de inactividad

```sql
-- MAL: Bloquea las escrituras en tablas grandes
CREATE INDEX idx_users_email ON users (email);

-- BIEN: No bloquea, permite escrituras concurrentes
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Nota: CONCURRENTLY no puede ejecutarse dentro de un bloque de transacción
-- La mayoría de las herramientas de migración necesitan un manejo especial para esto
```

### Renombrar una columna (sin tiempo de inactividad)

Para un renombrado puro (ambas columnas representan el mismo valor), usa expand-contract.
Mantén `username` como la columna autoritativa hasta el cambio de lectura:

```sql
-- Paso 1: Expandir (migración 001)
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Paso 2: Despliega la app v2: lee username, escribe en AMBAS columnas de forma atómica.
-- Cubre cada ruta de INSERT/UPDATE, incluidos los trabajos, las importaciones y las herramientas de administración.
-- Drena los escritores que solo escriben en la columna antigua y sus transacciones en curso antes de rellenar.

-- Paso 3: Rellena en rangos de clave primaria acotados (migración de datos separada).
-- Rango de ejemplo; avanza los límites para cubrir todos los id existentes.
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '2s';
UPDATE users SET display_name = username
WHERE id > 0 AND id <= 10000
  AND display_name IS DISTINCT FROM username;
COMMIT;

-- Paso 4: Valida DESPUÉS de completar todos los rangos, mientras continúan las escrituras dobles.
-- Exige cero discrepancias antes de cambiar las lecturas.
SELECT count(*) AS mismatched_rows FROM users
WHERE display_name IS DISTINCT FROM username;

-- Paso 5: Despliega la app v3: lee display_name, sigue escribiendo en AMBAS columnas.
-- Mantén las escrituras dobles durante toda la ventana de rollback.

-- Paso 6: Tras la ventana de rollback, detén los workers de rellenado/reconciliación.
-- Transfiere las restricciones/índices/dependencias necesarios a la columna nueva.
-- Haz que las restricciones de la columna antigua sean compatibles con los INSERT/UPDATE que solo usan la nueva.
-- Antes, drena los lectores que no son la app de username y sus transacciones en curso.
-- Después despliega la app v4 usando SOLO display_name; drena a los usuarios restantes de la columna antigua.

-- Paso 7: Contraer en una migración separada tras comprobar las dependencias.
ALTER TABLE users DROP COLUMN username;
```

Confirma cada rango de forma independiente; fija el punto de control solo después de confirmar,
y reintenta las transacciones de lote fallidas. Elige los límites según el espacio de claves
real (incluidos los ID cero o negativos si existen). `IS DISTINCT FROM` repara los valores
obsoletos que no son nulos y maneja los pares de NULL sin actualizarlos repetidamente. No traigas
`username` a la memoria de la aplicación para escribir más tarde esa instantánea obsoleta: copia
el valor actual de la fila de destino en el mismo `UPDATE`. En Read Committed, las actualizaciones
concurrentes se serializan sobre la fila y PostgreSQL vuelve a comprobar el predicado tras esperar.

Desplegar escrituras dobles no repara por sí solo la deriva anterior. Termina de drenar los
escritores que solo usan la columna antigua antes del rellenado y valida la paridad antes del
cambio de lectura. Cuando empiezan las escrituras que solo usan la columna nueva, la columna
antigua puede quedar obsoleta: no reinicies este rellenado ni vuelvas atrás a lectores de la
columna antigua sin un plan de reconciliación. La cronología siguiente representa puertas de
despliegue, no tiempos transcurridos garantizados ni un DDL sin bloqueos.

Referencia: [Comportamiento de Read Committed en PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED).

### Eliminar una columna de forma segura

```sql
-- Paso 1: Elimina todas las referencias de la aplicación a la columna
-- Paso 2: Despliega la aplicación sin la referencia a la columna
-- Paso 3: Elimina la columna en la migración siguiente
ALTER TABLE orders DROP COLUMN legacy_status;

-- Para Django: usa SeparateDatabaseAndState para quitarla del modelo
-- sin generar DROP COLUMN (y elimínala en la migración siguiente)
```

### Migraciones de datos grandes

```sql
-- MAL: Actualiza todas las filas en una sola transacción (bloquea la tabla)
UPDATE users SET normalized_email = LOWER(email);

-- BIEN: Actualización por lotes con progreso
DO $$
DECLARE
  batch_size INT := 10000;
  rows_updated INT;
BEGIN
  LOOP
    UPDATE users
    SET normalized_email = LOWER(email)
    WHERE id IN (
      SELECT id FROM users
      WHERE normalized_email IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    );
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows', rows_updated;
    EXIT WHEN rows_updated = 0;
    COMMIT;
  END LOOP;
END $$;
```

## Prisma (TypeScript/Node.js)

### Flujo de trabajo

```bash
# Crea la migración a partir de los cambios del esquema
npx prisma migrate dev --name add_user_avatar

# Aplica las migraciones pendientes en producción
npx prisma migrate deploy

# Reinicia la base de datos (solo desarrollo)
npx prisma migrate reset

# Genera el cliente tras los cambios del esquema
npx prisma generate
```

### Ejemplo de esquema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  orders    Order[]

  @@map("users")
  @@index([email])
}
```

### Migración con SQL personalizado

Para las operaciones que Prisma no puede expresar (índices concurrentes, rellenados de datos):

```bash
# Crea una migración vacía y luego edita el SQL manualmente
npx prisma migrate dev --create-only --name add_email_index
```

```sql
-- migrations/20240115_add_email_index/migration.sql
-- Prisma no puede generar CONCURRENTLY, así que lo escribimos manualmente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
```

## Estrategia de migración sin tiempo de inactividad

Para los cambios críticos de producción, sigue el patrón expand-contract:

```
Fase 1: EXPANDIR
  - Añade la columna/tabla nueva (que admita nulos o con valor por defecto)
  - Despliega: la app lee la ANTIGUA y escribe en AMBAS de forma atómica
  - Drena los escritores que solo usan la antigua y las transacciones en curso
  - Rellena en lotes confirmados y luego verifica la paridad

Fase 2: MIGRAR
  - Despliega: la app lee de la NUEVA y escribe en AMBAS
  - Monitorea la paridad y conserva las escrituras dobles durante toda la ventana de rollback

Fase 3: CONTRAER
  - Termina la ventana de rollback; detén el rellenado y migra las restricciones/dependencias
  - Drena los lectores de la columna antigua que no son la app y sus transacciones en curso
  - Despliega: la app solo usa la NUEVA; drena a los usuarios restantes de la columna antigua
  - Elimina la columna/tabla antigua en una migración separada
```

### Ejemplo de cronología

```
Día 1: La migración añade la columna new_status (admite nulos)
Día 1: Despliega la app v2 — lee status, escribe en ambas columnas de forma atómica
Día 2: Drena los escritores que solo usan la antigua; rellena en lotes; exige cero discrepancias
Día 3: Despliega la app v3 — lee new_status, sigue escribiendo en ambas columnas
Día 7: Termina la ventana de rollback; detén el rellenado; migra las restricciones/dependencias
Día 7: Drena los lectores de la columna antigua que no son la app y sus transacciones en curso
Día 7: Despliega la app v4 — solo usa new_status; drena a los usuarios restantes de la columna antigua
Después: Una migración separada elimina status una vez superadas todas las puertas de contracción
```

## Antipatrones

| Antipatrón | Por qué falla | Mejor enfoque |
|-------------|-------------|-----------------|
| SQL manual en producción | Sin rastro de auditoría, no repetible | Usa siempre archivos de migración |
| Editar migraciones ya desplegadas | Causa deriva entre entornos | Crea una migración nueva en su lugar |
| Añadir una columna NOT NULL sin valor por defecto a una tabla con datos | Falla porque las filas existentes contendrían NULL | Añádela admitiendo nulos, rellena y luego establece NOT NULL |
| Índice en línea en una tabla grande | Bloquea las escrituras durante la construcción | CREATE INDEX CONCURRENTLY |
| Esquema + datos en una sola migración | Difícil de revertir, transacciones largas | Migraciones separadas |
| Eliminar la columna antes de quitar el código | Errores de la aplicación por columna inexistente | Quita primero el código y elimina la columna en el despliegue siguiente |

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga. Los puntos marcados con «(MySQL 8)» son conocimiento general del motor, no del texto original.

- **Motor y herramienta:** MySQL 8.4 con **Prisma 7**. Las migraciones están en `restaurante/packages/db/prisma/migrations/` (hoy `20261009223102_inicial_mysql`, `20261015024103_bot_proteccion` y `20261105200300_pagina`). Los ejemplos de PostgreSQL de esta skill (`CONCURRENTLY`, `lock_timeout`, `DO $$`, `IS DISTINCT FROM`, `ACCESS EXCLUSIVE`) son ilustrativos del patrón, **no se pueden copiar a MySQL**.
- **Equivalentes en MySQL (MySQL 8):**
  - No existe `CREATE INDEX CONCURRENTLY`. Se pide el DDL en línea con `ALGORITHM=INPLACE, LOCK=NONE` (o `ALGORITHM=INSTANT` donde se admita, por ejemplo al añadir una columna al final) y se comprueba que el motor lo acepta; si no puede, falla en lugar de bloquear.
  - El DDL de MySQL **no es transaccional**: una migración que falla a mitad puede dejar el esquema a medias. Una migración, un cambio.
  - El equivalente de `IS DISTINCT FROM` es `<=>` (comparación segura ante NULL).
  - Los rellenados por lotes se hacen con `UPDATE ... LIMIT n` o por rangos de clave, en una migración o script aparte, nunca en el mismo archivo que el DDL.
- **Qué aplica tal cual de la skill:** los cinco principios, la lista de comprobación, expand-contract, y los antipatrones. Respeta además las trampas de `prisma-patterns` (`migrate dev` puede reiniciar la base; no se edita una migración aplicada).
- **La vuelta atrás automática de `deploy.sh` condiciona el esquema.** El despliegue migra, y si algo falla, vuelve a la versión anterior de la `api` arrancándola con `DATABASE_ALLOW_NEWER_SCHEMA=true` sobre el esquema **ya migrado**. Por eso un cambio de esquema debe ser **compatible con la versión anterior de la `api`** (expand-contract): añadir columnas que admitan nulos o tengan valor por defecto, y eliminar o renombrar solo en un despliegue posterior, cuando ninguna versión desplegable dependa de lo viejo. Detalle y códigos de salida en `restaurante/docs/despliegue.md`.
- **Producción:** las migraciones solo las aplica el servicio `migrate` del despliegue (`migrate deploy`), con el usuario de administración o de migración; el usuario de la aplicación es solo de DML. Nunca se ejecuta SQL manual contra producción ni `migrate dev`/`migrate reset` fuera de la base local de desarrollo o de bases con el prefijo `restaurante_test` (`.claude/rules/testing.md`). Cualquier acción en producción necesita la autorización explícita del usuario.
- **Tamaño de los datos:** el volumen actual es pequeño (decenas de productos y pocos usuarios), pero el principio de probar con una copia sigue valiendo: para eso existen los respaldos y la prueba de restauración (`restaurante/ops/backup/verify-backup.sh --drill`).
- **Qué se omitió del original:** las secciones de Drizzle, Kysely, Django y golang-migrate, y los dos scripts de ejemplo de PostgreSQL (`examples/postgres-add-column.sql` y `examples/postgres-column-rename.sql`), porque este proyecto no usa esas herramientas ni PostgreSQL. Las referencias a ellos en el texto se retiraron del cuerpo traducido.
- Las skills `postgres-patterns` y `backend-patterns` no están instaladas; para el diseño de MySQL, usa `mysql-patterns`.
