---
name: prisma-patterns
description: Patrones de Prisma ORM para backends en TypeScript — diseño de esquemas, optimización de consultas, transacciones, paginación y trampas críticas como updateMany que devuelve un conteo y no registros, tiempos de espera de $transaction, migrate dev que reinicia la base de datos, @updatedAt omitido en escrituras masivas y agotamiento de conexiones en serverless. Úsalo al escribir un esquema o una consulta de Prisma, o al depurar transacciones, migraciones o límites de conexiones en serverless.
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/prisma-patterns/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# Patrones de Prisma

Patrones de producción y trampas poco evidentes de Prisma ORM en backends de TypeScript.

> **Comprueba tu versión antes de aplicar los patrones.** La superficie de la API de Prisma ha evolucionado entre versiones mayores:
>
> ```bash
> npx prisma --version
> ```
>
> Diferencias notables de la API entre versiones:
> - `relationJoins` puede cargar las relaciones mediante JOIN en lugar de consultas separadas, pero puede causar una explosión de filas en relaciones 1:N grandes o en `include` profundos — compara ambos enfoques con una medición
> - Se añadieron el modificador de campo `omit` y la API de Client Extensions `prisma.$extends`
> - **Instalaciones más nuevas**: el paquete puede llamarse `prisma` en lugar de `@prisma/client`; `PrismaClient` puede requerir un adaptador de controlador (por ejemplo, `@prisma/adapter-pg`); `datasource.url` puede estar en `prisma.config.ts` en lugar de `schema.prisma`
> - Los comandos de la CLI (`migrate dev`, `migrate deploy`, `generate`) no cambian entre versiones

## Cuándo activarla

- Diseñar o modificar modelos y relaciones del esquema de Prisma
- Escribir consultas, transacciones o lógica de paginación
- Usar `updateMany`, `deleteMany` o cualquier operación masiva
- Ejecutar o planificar migraciones de base de datos
- Desplegar en entornos serverless (Vercel, Lambda, Cloudflare Workers)
- Implementar el borrado lógico o el filtrado de filas multitenencia

## Conceptos básicos

### Estrategia de ID

| Estrategia | Úsala cuando | Evítala cuando |
|---|---|---|
| `@default(cuid())` | Opción por defecto — seguro para URL, ordenable, sin colisiones | Se necesitan IDs secuenciales para sistemas externos |
| `@default(uuid())` | Se requiere interoperabilidad con sistemas que no son Prisma | Tablas con muchas escrituras (los UUID aleatorios fragmentan los índices B-tree) |
| `@default(autoincrement())` | Tablas de unión internas, registros de auditoría | IDs de cara al público (expone el número de registros) |

### Valores por defecto del esquema

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique  // @unique ya crea un índice — no hace falta @@index
  name      String
  role      Role      @default(USER)
  posts     Post[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([createdAt])
  @@index([deletedAt, createdAt]) // compuesto para consultas de borrado lógico + ordenación
}
```

- Añade `@@index` en cada clave foránea y en cada columna usada en `WHERE` o `ORDER BY`.
- Declara `deletedAt DateTime?` desde el principio cuando el borrado lógico sea un requisito previsible — añadirlo más tarde requiere una migración sobre una tabla en producción.
- `updatedAt @updatedAt` lo establece Prisma automáticamente solo en `update` y `upsert` (consulta Antipatrones para la trampa de la actualización masiva).

### `include` frente a `select`

| | `include` | `select` |
|---|---|---|
| Devuelve | Todos los campos escalares + las relaciones indicadas | Solo los campos indicados |
| Úsalo cuando | Necesitas la mayoría de los campos más una relación | Rutas de mucho uso, tablas grandes, evitar traer de más |
| Rendimiento | Puede traer de más en tablas anchas | Carga mínima, más rápido en conjuntos de datos grandes |
| Nota de Prisma 5 | Usa JOIN por defecto (`relationJoins`) | Igual |

```ts
// include — todas las columnas + la relación
const user = await prisma.user.findUnique({
  where: { id },
  include: { posts: { select: { id: true, title: true } } },
});

// select — lista de permitidos explícita
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true },
});
```

Nunca devuelvas entidades de Prisma crudas en las respuestas de la API — mapéalas a DTO de respuesta para controlar los campos expuestos:

```ts
// MAL: filtra passwordHash, deletedAt y campos internos
return await prisma.user.findUniqueOrThrow({ where: { id } });

// BIEN: mapeo explícito a un DTO
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
return { id: user.id, name: user.name, email: user.email };
```

### Selección de la forma de la transacción

| Situación | Usa |
|---|---|
| Operaciones independientes, sin dependencia entre ellas | Forma de arreglo |
| Un paso posterior depende del resultado de uno anterior | Forma interactiva |
| Hay llamadas externas (correo, HTTP) | Totalmente fuera de la transacción |

```ts
// Forma de arreglo — agrupada en un solo viaje de ida y vuelta
const [user, post] = await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { name } }),
  prisma.post.create({ data: { title, authorId: id } }),
]);

// Forma interactiva — usa solo el cliente tx, nunca el cliente prisma externo
const post = await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id } });
  if (user.role !== 'ADMIN') throw new Error('Forbidden');
  return tx.post.create({ data: { title, authorId: user.id } });
});
```

### Singleton de PrismaClient

Cada instancia de `PrismaClient` abre su propio pool de conexiones. Instancia una sola vez.

```ts
// lib/prisma.ts

// Opción A — inicialización con adaptador (requerida por las instalaciones más nuevas de Prisma)
import { PrismaClient } from '@prisma/client'; // o la ruta del cliente generado para tu configuración
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Opción B — inicialización directa (instalaciones antiguas, sin necesidad de adaptador)
// import { PrismaClient } from '@prisma/client';
// export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... });
```

Usa la Opción A si tu instalación de Prisma requiere un argumento `adapter` en el constructor de `PrismaClient`.
Usa la Opción B si `new PrismaClient()` funciona sin argumentos. Deja que el compilador te diga cuál es la correcta.

El patrón `globalThis` evita instancias duplicadas durante la recarga en caliente (Next.js, nodemon, ts-node-dev).

### Problema N+1

Cargar relaciones dentro de un bucle emite una consulta por fila.

```ts
// MAL: N+1 — una consulta extra por usuario
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// BIEN: una sola consulta
const users = await prisma.user.findMany({ include: { posts: true } });
```

Con `relationJoins` de Prisma 5+, la forma con `include` usa un único JOIN. En conjuntos 1:N grandes esto puede aumentar el tamaño del resultado — compara ambos enfoques con una medición si la relación puede devolver muchas filas por padre.

## Ejemplos de código

### Paginación por cursor (preferida para feeds y conjuntos de datos grandes)

```ts
async function getPosts(cursor?: string, limit = 20) {
  const items = await prisma.post.findMany({
    where: { published: true },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }, // la ordenación secundaria evita una paginación inestable con marcas de tiempo duplicadas
    ],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasNextPage = items.length > limit;
  if (hasNextPage) items.pop();

  return { items, nextCursor: hasNextPage ? items[items.length - 1].id : null };
}
```

Trae `limit + 1` y haz pop — es la forma canónica de detectar `hasNextPage` sin una consulta de conteo adicional. Incluye siempre un campo único (por ejemplo, `id`) como `orderBy` secundario para evitar una paginación inestable cuando varias filas comparten la misma marca de tiempo. Usa la paginación por offset solo cuando los usuarios necesiten saltar a páginas arbitrarias (tablas de administración).

### Borrado lógico

```ts
// Filtra siempre de forma explícita — no dependas de un middleware (oculta el comportamiento y es difícil de depurar)
const activeUsers = await prisma.user.findMany({ where: { deletedAt: null } });

await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
await prisma.user.update({ where: { id }, data: { deletedAt: null } }); // restaurar
```

### Manejo de errores

```ts
import { Prisma } from '@prisma/client'; // o la ruta del cliente generado para tu configuración

try {
  await prisma.user.create({ data: { email } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictError('Email already exists');
    if (e.code === 'P2025') throw new NotFoundError('Record not found');
    if (e.code === 'P2003') throw new BadRequestError('Referenced record does not exist');
  }
  throw e;
}
```

Códigos comunes: `P2002` violación de unicidad · `P2025` no encontrado · `P2003` violación de clave foránea.

Captura en el límite del servicio y traduce a errores de dominio. Nunca expongas los mensajes crudos de Prisma a los consumidores de la API.

### Pool de conexiones — Serverless

Incrusta los parámetros de conexión directamente en `DATABASE_URL` — la concatenación de cadenas falla si la URL ya tiene parámetros de consulta (por ejemplo, `?schema=public`):

```bash
# .env — preferido: incrustar los parámetros en la URL
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=1&pool_timeout=20"

# Con un pooler externo (PgBouncer, pooler de Supabase)
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=1"
```

```ts
// Vercel, AWS Lambda y entornos serverless similares:
// limita el pool a 1 por instancia; connection_limit y pool_timeout se controlan mediante DATABASE_URL

// Configuración con adaptador (si tu instalación de Prisma requiere un adaptador):
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Configuración directa (si tu instalación de Prisma no requiere un adaptador):
// const prisma = new PrismaClient();
```

## Antipatrones

### `updateMany` devuelve un conteo, no registros

```ts
// MAL: el resultado es { count: 2 } — users[0] es undefined
const users = await prisma.user.updateMany({ where: { role: 'GUEST' }, data: { role: 'USER' } });

// BIEN: captura primero los IDs, luego actualiza y después trae solo las filas afectadas
const targets = await prisma.user.findMany({
  where: { role: 'GUEST' },
  select: { id: true },
});
const ids = targets.map((u) => u.id);
await prisma.user.updateMany({ where: { id: { in: ids } }, data: { role: 'USER' } });
const updated = await prisma.user.findMany({ where: { id: { in: ids } } });
```

Lo mismo se aplica a `deleteMany` — devuelve `{ count: n }`, nunca las filas borradas.

### La forma interactiva de `$transaction` agota el tiempo a los 5 segundos

```ts
// MAL: una llamada externa dentro de la transacción supera los 5s por defecto → "Transaction already closed"
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id } });
  await sendWelcomeEmail(user.email); // llamada externa
  await tx.user.update({ where: { id }, data: { emailSent: true } });
});

// BIEN: las llamadas externas fuera de la transacción
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
await sendWelcomeEmail(user.email);
await prisma.user.update({ where: { id }, data: { emailSent: true } });

// Sube el tiempo límite solo cuando el procesamiento masivo realmente lo necesite
await prisma.$transaction(async (tx) => { ... }, { timeout: 30_000 });
```

### `migrate dev` puede reiniciar la base de datos

`migrate dev` detecta la deriva del esquema (schema drift) y puede pedir reiniciar la base de datos, eliminando todos los datos.

```bash
# NUNCA en desarrollo compartido, staging o producción
npx prisma migrate dev --name add_column

# Seguro en todas partes excepto en desarrollo local en solitario
npx prisma migrate deploy

# Comprueba la deriva sin aplicar nada
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
```

### Editar a mano un archivo de migración rompe los despliegues futuros

Prisma calcula una suma de verificación de cada archivo de migración. Editarlo después de aplicarlo provoca `P3006 checksum mismatch` en cada entorno donde ya se ejecutó el original. Crea una migración nueva en su lugar.

### Los cambios de esquema que rompen la compatibilidad requieren una migración en varios pasos

Añadir `NOT NULL` a una columna existente o renombrar una columna en una sola migración bloqueará la tabla o perderá datos. Usa expandir y contraer (expand-and-contract):

```bash
# Paso 1: crea la migración localmente y luego despliégala
npx prisma migrate dev --name add_new_column   # solo local
npx prisma migrate deploy                       # staging / producción
```

```ts
// Paso 2: rellena los datos (backfill; ejecútalo en un script o en un trabajo de migración, no en la consola)
await prisma.user.updateMany({ data: { newColumn: derivedValue } });
```

```bash
# Paso 3: crea localmente la migración de la restricción NOT NULL y luego despliégala
npx prisma migrate dev --name make_new_column_required  # solo local
npx prisma migrate deploy                               # staging / producción
```

### `@updatedAt` no se dispara en `updateMany`

`@updatedAt` se establece automáticamente solo en `update` y `upsert`. Las escrituras masivas lo dejan obsoleto.

```ts
// MAL: updatedAt conserva su valor antiguo
await prisma.post.updateMany({ where: { authorId }, data: { published: true } });

// BIEN
await prisma.post.updateMany({
  where: { authorId },
  data: { published: true, updatedAt: new Date() },
});
```

### Borrado lógico + `findUniqueOrThrow` filtra registros borrados

`findUniqueOrThrow` lanza `P2025` solo cuando la fila no existe en la base de datos. Las filas borradas lógicamente siguen existiendo y se devuelven sin error.

`findUniqueOrThrow` requiere un campo con restricción única en `where` — añadir `deletedAt: null` junto a `id` rompe el tipo porque `{ id, deletedAt }` no es una restricción única compuesta. Usa `findFirstOrThrow` en su lugar.

```ts
// MAL: devuelve un usuario borrado lógicamente
const user = await prisma.user.findUniqueOrThrow({ where: { id } });

// MAL: error de tipo de Prisma — { id, deletedAt } no es una restricción única
const user = await prisma.user.findUniqueOrThrow({ where: { id, deletedAt: null } });

// BIEN: findFirstOrThrow admite condiciones where arbitrarias
const user = await prisma.user.findFirstOrThrow({ where: { id, deletedAt: null } });
```

### `deleteMany` sin `where` borra todas las filas

```ts
// MAL: vacía la tabla en silencio
await prisma.post.deleteMany();

// BIEN
await prisma.post.deleteMany({ where: { authorId: userId } });
```

## Buenas prácticas

| Regla | Motivo |
|---|---|
| `migrate deploy` en CI/CD, `migrate dev` solo en local | `migrate dev` puede reiniciar la base de datos ante una deriva |
| Mapear las entidades a DTO de respuesta | Evita filtrar campos internos |
| Capturar `PrismaClientKnownRequestError` en el límite del servicio | Traducir a errores de dominio |
| Preferir los métodos `*OrThrow` a las comprobaciones manuales de null | Lanzan P2025 automáticamente; usa `findFirstOrThrow` al filtrar campos no únicos |
| `connection_limit=1` + pooler externo en serverless | Evita el agotamiento de conexiones |
| Proporcionar siempre `where` en `deleteMany` | Evita el vaciado accidental de la tabla |
| Establecer `updatedAt: new Date()` manualmente en `updateMany` | `@updatedAt` se omite en las escrituras masivas |

## Skills relacionadas

- `nestjs-patterns` — capa de servicio de NestJS que integra Prisma
- `postgres-patterns` — índices y ajuste de conexiones a nivel de PostgreSQL
- `database-migrations` — planificación de migraciones en varios pasos para producción
- `backend-patterns` — diseño general de API y de la capa de servicio

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Versión y configuración reales:** Prisma 7.10.1 con el generador `prisma-client`, sobre **MySQL 8.4** y el adaptador `@prisma/adapter-mariadb` (no `@prisma/adapter-pg`). El esquema y las migraciones están en `restaurante/packages/db/prisma/`, la configuración en `restaurante/packages/db/prisma.config.ts` y el cliente en `restaurante/packages/db/src/client.ts`. Comprueba la versión con `npx prisma --version` desde `restaurante/packages/db`.
- **No son aplicables aquí:** los ejemplos de `PrismaPg`, PgBouncer, `?schema=public` y toda la sección «Pool de conexiones — Serverless» (el despliegue es de contenedores de larga duración con Docker Compose). Léelos como ilustración, no como configuración.
- **Singleton:** ya existe. No instancies otro `PrismaClient`: usa la fábrica de `@restaurante/db` (`createPrismaClient`). En las pruebas, nunca abras conexiones por tu cuenta ni leas `DATABASE_URL`; usa `makeDatabase()` o `makeScratchDatabase()` (`.claude/rules/testing.md`).
- **`migrate dev` y `migrate reset`:** solo contra la base de desarrollo local (`npm run db:up`, `npm run db:migrate:dev`). **Nunca** contra producción ni contra una base que no tenga el prefijo `restaurante_test`. Producción solo recibe `migrate deploy`, que ejecuta el servicio `migrate` del despliegue (`restaurante/deploy/deploy.sh`). No edites ninguna migración ya aplicada (hoy hay tres, la última `20261105200300_pagina`): crea una nueva.
- **DTO:** las respuestas de la `api` se mapean a los contratos de `restaurante/packages/contracts` (Zod); no devuelvas entidades de Prisma crudas (`.claude/rules/frontend-backend.md`).
- **Errores:** los errores de Prisma se traducen en el límite del servicio y nunca se exponen al cliente (`.claude/rules/manejo-de-errores.md`); el proyecto ya convierte los errores inesperados de la base en `DatabaseUnavailableError`.
- **Borrado lógico:** el repositorio de productos lo usa; filtra siempre de forma explícita y no dependas de un middleware.
- **Transacciones:** no pongas llamadas externas (por ejemplo, a la API de WhatsApp) dentro de una transacción interactiva.
- Lo que cambie el esquema de una base en producción debe seguir la skill `database-migrations` (compatibilidad con la versión anterior de la `api`, por la vuelta atrás automática).
- Las skills de la sección «Skills relacionadas» que no estén instaladas en `.claude/skills/` (`nestjs-patterns`, `postgres-patterns`, `backend-patterns`) no están disponibles en este proyecto.
