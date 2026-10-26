# REQ-F-037 — Extraer `core`, `contracts` y `db` del `src/` de `landing-pages/` sin cambios funcionales

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-10-26). Respuesta textual: "Si lo apruebo".

Decisiones del usuario incorporadas (2026-10-26, citas textuales):

- Decisión C de `restaurante/docs/arquitectura.md` §9 (validación de esquemas en `contracts`): "Zod (Recomendado)". Se aplica desde el paso 3. En el paso 2 no se migra ningún validador ni se instala Zod.
- Contenido de `contracts` en el paso 2: "Paquete vacío (Recomendado)". Es un esqueleto con su regla de lint.
- Control del bot: "Módulo nuevo en core (Recomendado)". La interfaz y la implementación en memoria van a `core`, la implementación Prisma va a `db`, y el módulo se añade al árbol de §4.
- Regla de transición para `landing-pages`: "Sí, regla de transición (Recomendado)". En el paso 2, `landing-pages` puede importar `core`, `db` y `contracts`. Se registra como desviación en §4, y la restricción se activa en el paso 3 (landings) y en el paso 4 (`/admin`).

## Objetivo

Paso 2 del plan de migración (`restaurante/docs/arquitectura.md` §8): separar el dominio (`packages/core`), la persistencia (`packages/db`) y los contratos (`packages/contracts`) del `src/` actual de `restaurante/landing-pages/`. Se mueven archivos y se ajustan imports, sin reescribir lógica y sin ningún cambio observable para clientes, personal, administradores ni el bot. Así la épica queda preparada para crear `api/` en el paso 3. El PR va a `epic/arquitectura` (`.claude/rules/git.md`).

## Alcance

- Los workspaces `packages/core`, `packages/contracts` (esqueleto) y `packages/db`, con un único lockfile.
- **A `core`:**
  - el módulo `catalog`: `product-schema`, `menu-schema`, `visible-menu`, `price` y `slug`;
  - el módulo `schedule`: `business-schedule`;
  - el módulo `identity`: `authorization`, `user-schema` y `admin-auth`;
  - un módulo nuevo de control del bot (bloqueos, pausa y uso), con la interfaz de `bot-control-store.ts` y `memory-bot-control-store.ts`;
  - las interfaces de `product-repository.ts` y `user-repository.ts`, con `memory-product-store.ts` junto a la suya;
  - lo compartido que esos módulos necesitan: los identificadores de negocio de `config/businesses.ts`, `DatabaseUnavailableError`, el tipo `Logger` con `silentLogger`, y `errorProp`.
- **Partición de archivos mixtos** por fronteras que ya existen, sin cambiar el cuerpo de ninguna función:
  - `user-repository.ts`: la interfaz por un lado y la implementación Prisma por otro;
  - `product-repository.ts`: las interfaces del store por un lado y el servicio por otro.
- **A `db`:** `prisma/schema.prisma`, `prisma/migrations`, `prisma.config.ts`, el cliente generado (hoy en `src/generated/prisma`), `src/db/client.ts`, `errors.ts` (salvo `DatabaseUnavailableError`) y `verify.ts`, la implementación Prisma de usuarios, `prisma-product-store.ts` y `prisma-bot-control-store.ts`.
- `tsconfig.base.json` en la raíz y un lint común en la raíz con la regla de dependencias y la regla de transición. Es lo que REQ-F-036 dejó pendiente para este paso.
- Ajustes en los imports de `landing-pages` (`src`, `scripts` y `tests`), en los scripts de la raíz, el `Dockerfile`, `.github/workflows/ci.yml` y `.github/dependabot.yml`, y en la documentación.

## Fuera de alcance

- Crear `api/`, o mover el bot, `/admin` o la API de productos.
- Instalar o usar Zod.
- Migrar o reescribir validadores.
- Tocar la suma de `deploy/` (`compose.prod.yaml`, `deploy.sh`, `mysql/initdb/01-usuarios.sh`), las vistas, el contenido o `public/`.
- **Lo que se queda en `landing-pages/` en este paso** porque la tabla no lo asigna:
  - `menu-repository.ts`, `file-menu-repository.ts` y `memory-menu-repository.ts` (`menu-repository.ts` depende de `content/seeds.ts`);
  - `bot-control.ts`, `bot-usage.ts`, `session-store.ts`, `login-throttle.ts`, `menu-diff.ts`, `admin-form.ts`, `product-form.ts`, `admin-bootstrap.ts` y `whatsapp.ts`;
  - `services/whatsapp-bot/`, `config/env.ts` y el resto de `utils/`.

## Requisitos

- **RF-1. Paquetes.** `packages/core`, `packages/contracts` y `packages/db` son workspaces declarados en el `package.json` de la raíz, con un único `package-lock.json`. `landing-pages` los consume como dependencias del workspace.
- **RF-2. `core`.**
  - Contiene los módulos y las piezas compartidas del Alcance.
  - Cada módulo expone solo su `index.ts`.
  - No declara dependencias de Koa, de Prisma ni de ningún otro paquete del proyecto.
- **RF-3. `db`.**
  - Contiene la persistencia Prisma del Alcance.
  - Solo importa `core`, para implementar sus interfaces.
- **RF-4. `contracts`.**
  - Es un workspace esqueleto: `package.json` sin dependencias, un `index.ts` sin exportaciones y su `tsconfig.json`, que extiende la base.
  - Su regla de lint ya está activa.
  - Los primeros esquemas, ya con Zod, llegan en el paso 3.
- **RF-5. Solo movimiento.**
  - Los archivos se mueven conservando su contenido; solo cambian las líneas de import y export.
  - Los archivos mixtos se parten sin cambiar el cuerpo de ninguna función, clase ni tipo.
- **RF-6. Regla de dependencias en el lint.** `npm run lint` rechaza estos imports:
  - de `core`: Koa, Prisma, `contracts`, `db`, `landing-pages` o cualquier paquete del proyecto;
  - de `contracts`: `core`, `db`, Koa o `landing-pages`;
  - de `db`: Koa, `contracts` o `landing-pages`;
  - entre módulos de `core`: cualquiera que no pase por el `index.ts` del módulo.

  La **regla de transición** permite a `landing-pages` importar `core`, `db` y `contracts`, y la configuración del lint la marca como temporal, citando REQ-F-037 y los pasos 3 y 4.
- **RF-7. Configuración común en la raíz.**
  - `tsconfig.base.json` con `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` y `verbatimModuleSyntax`. Todos los workspaces lo extienden.
  - Un único `eslint.config.ts` cubre todos los workspaces y conserva las reglas actuales: imports `./x.js`, `listenLocal`, justificación obligatoria en cada `eslint-disable` y las reglas de `public/js`.
- **RF-8. Imágenes y despliegue.**
  - `ghcr.io/orvigas/restaurante` y `restaurante-migrate` se construyen desde la nueva estructura, con los mismos nombres, entrypoints y estructura interna. `restaurante-migrate` conserva `prisma/migrations` y `prisma.config.ts` en el WORKDIR.
  - No se toca ningún archivo de la suma de `deploy/`.
- **RF-9. Documentación.**
  - `arquitectura.md` §4:
    - se quita la nota "en el paso 1 no hay `tsconfig.base.json`";
    - se añade al árbol el módulo de control del bot en `core`;
    - se registra la desviación de la regla de transición.
  - `arquitectura.md` §8: el detalle del paso 2, incluidas las piezas compartidas de `core` y lo que se queda en `landing-pages/`.
  - `arquitectura.md` §9: la decisión C, tomada.
  - `restaurante/README.md` y las guías de `docs/` cuyos comandos o rutas cambien.
  - `.claude/rules/typescript.md` y `.claude/rules/codegraph.md`: añadir las rutas de `packages/`.

## Reglas de negocio

No hay reglas nuevas. El comportamiento de las landings, los avisos, `/admin`, la API de productos y el bot no cambia.

## Criterios de aceptación

- **CA-1.** `npm ci` en la raíz instala todos los workspaces con un único `package-lock.json`, y `packages/core`, `packages/contracts` y `packages/db` figuran como workspaces.
- **CA-2.** `git diff -M` contra `epic/arquitectura` muestra cada archivo movido como renombrado. El contenido solo cambia en líneas de import y export y en la partición de `user-repository.ts` y `product-repository.ts`. Ningún cuerpo de función, clase o tipo cambia.
- **CA-3.** Las migraciones de `packages/db` son idénticas byte a byte a las de antes: mismos nombres de carpeta, mismo SQL y el mismo `migration_lock.toml`.
- **CA-4.** `npm test` en la raíz pasa con al menos el mismo número de pruebas que antes. Se anotan la cifra de antes y la de después, y ninguna prueba se borra ni se marca con `skip`.
- **CA-5.** Las pruebas de integración de `/`, `/birria` y `/molotes` pasan sin cambiar sus expectativas, incluido `?dia=` en desarrollo para los 7 días. Lo mismo vale para `/admin`, la API de productos y el webhook del bot. `smoke.sh` pasa en el CI.
- **CA-6.** `npm run lint` falla con un import de prueba en cada uno de estos casos, y la verificación queda documentada en el Implementation Result:
  - `core` → `koa`, Prisma, `contracts`, `db` o `landing-pages`;
  - `contracts` → `core`, `db` o `koa`;
  - `db` → `koa`, `contracts` o `landing-pages`;
  - un módulo de `core` → un archivo interno de otro módulo.

  Un import de `core`, `db` o `contracts` desde `landing-pages` pasa el lint (regla de transición).
- **CA-7.** El `package.json` de `packages/core` no declara `koa`, `prisma` ni ningún paquete `@prisma/*`. El de `packages/contracts` no declara ninguna dependencia.
- **CA-8.** Existe `tsconfig.base.json` en la raíz, con las opciones de RF-7, y todos los `tsconfig.json` de los workspaces lo extienden. `npm run typecheck` en la raíz cubre todos los workspaces y termina con 0.
- **CA-9.** Hay un único `eslint.config.ts` en la raíz y `npm run lint` termina con 0, sin errores ni avisos. Las reglas anteriores siguen activas.
- **CA-10.** Los scripts `db:generate`, `db:migrate`, `db:migrate:dev`, `db:up`, `dev`, `start`, `test`, `lint` y `typecheck` funcionan desde la raíz con los mismos nombres.
- **CA-11.** (Reescrito el 2026-10-26, P-3.) No hay medición de cobertura en el proyecto. El código movido a `packages/` lo siguen ejercitando las mismas pruebas, y CA-4 lo comprueba con el número de pruebas. No se instala ninguna dependencia de cobertura.
- **CA-12.** El CI construye `ghcr.io/orvigas/restaurante` y `restaurante-migrate` con sus nombres actuales. En `restaurante-migrate` siguen existiendo `prisma/migrations` y `prisma.config.ts` en el WORKDIR, con el mismo entrypoint.
- **CA-13.** `git diff` no muestra cambios en `deploy/compose.prod.yaml`, `deploy/deploy.sh` ni `deploy/mysql/initdb/01-usuarios.sh`.
- **CA-14.** El PR va contra `epic/arquitectura` con el CI en verde (`cambios`, `calidad`, `docker`, `despliegue` y `auditoria`), y la detección de cambios incluye `packages/**`.
- **CA-15.** `arquitectura.md` §9 registra la decisión C:
  - fecha: 2026-10-26;
  - respuesta del usuario: "Zod (Recomendado)";
  - opción elegida: Zod;
  - cuándo se aplica: desde el paso 3; en el paso 2 no se instala ni se migra ningún validador.

  El encabezado y §9 dejan de contar C como pendiente; solo B sigue pendiente.
- **CA-16.** `packages/contracts` es un esqueleto: su `index.ts` no exporta nada, no tiene dependencias y su regla de lint está activa (CA-6). Ningún `package.json` ni el lockfile incluyen `zod`.
- **CA-17.** `core` contiene un módulo de control del bot con la interfaz del store y su implementación en memoria. La implementación Prisma está en `db` y las pruebas actuales del control del bot pasan sin cambiar sus expectativas.
- **CA-18.** `arquitectura.md` §4 incluye ese módulo en el árbol y registra la regla de transición: qué permite, que la introduce REQ-F-037 y que la restricción se activa en el paso 3 (landings) y en el paso 4 (`/admin`).
- **CA-19.** La documentación de RF-9 está actualizada y no describe funciones que no existen.

## Casos límite

- **Imagen de migraciones:** `deploy/ci/smoke.sh` copia una migración a `prisma/migrations` dentro de la imagen y espera `prisma.config.ts` en el WORKDIR. Esa estructura no cambia aunque `prisma/` se mueva a `packages/db` en el repositorio.
- **Type stripping de Node 24:** Node no quita tipos a los `.ts` que están dentro de `node_modules`. Hay que verificar que los paquetes del workspace, enlazados como symlinks, se resuelven a su ruta real en desarrollo, en las pruebas y en la imagen Docker.
- **Cliente Prisma generado:** cambia de ubicación, así que `db:generate`, el `Dockerfile` y el CI tienen que usar la nueva.
- **Cobertura:** el código movido no debe salir de la medición.
- **CI y Dependabot:** la detección de cambios y los directorios de Dependabot tienen que incluir `packages/**`.

## Dependencias

- REQ-F-036 está mergeado en `epic/arquitectura` (merge `8a595e1`).
- MySQL 8.4 de pruebas (`npm run db:up`) para las pruebas de integración.

## Riesgos

- **Pipeline de producción:** se tocan el `Dockerfile` y el cliente Prisma. Se mitiga con el CI completo y `smoke.sh` en el PR a `epic/arquitectura`, que valida sin desplegar.
- **Dependencias circulares** entre `core` y `db` al partir los archivos mixtos. Se revisan con el blast radius de CodeGraph.
- **Resolución de los `.ts`** de los paquetes del workspace con type stripping (ver Casos límite).
- **Diff grande:** muchos imports cambian. Se mitiga exigiendo renombrados que git detecte (CA-2).

## Action Plan

### Objetivo

Separar el dominio, la persistencia y los contratos en paquetes del workspace sin cambiar el comportamiento.

### Orden recomendado

Ejecutar `npm run typecheck`, `npm run lint` y `npm test` después de cada bloque.

1. Registrar la decisión C en `arquitectura.md` §9.
2. Crear los tres workspaces (`contracts` como esqueleto) y `tsconfig.base.json`.
3. Mover a `core` las piezas compartidas: identificadores de negocio, `DatabaseUnavailableError`, `Logger`/`silentLogger` y `errorProp`.
4. Mover a `core` los módulos `catalog`, `schedule`, `identity` y control del bot, con sus interfaces, sus implementaciones en memoria y sus `index.ts`. Aquí se parten `user-repository.ts` y `product-repository.ts`.
5. Mover a `db` el schema, las migraciones, `prisma.config.ts`, el cliente generado, `src/db/*` y las implementaciones Prisma.
6. Ajustar los imports de `landing-pages` (`src`, `scripts` y `tests`).
7. Crear el lint común con la regla de dependencias y la regla de transición, y verificar CA-6.
8. Ajustar los scripts de la raíz, el `Dockerfile`, el CI y Dependabot.
9. Actualizar la documentación de RF-9.

### Resultado esperado

El repositorio queda con `core`, `contracts` y `db` separados y la regla de dependencias impuesta por el lint, con la transición documentada. Producción no cambia y la épica queda lista para el paso 3.

## Revisión técnica

Revisión del 2026-10-26 (senior-fullstack, fase T1). Se exploraron con CodeGraph los archivos del Alcance, sus imports y su blast radius. Se comprobó en una prueba aparte, con el Node 24.22.1 y el `tsc` del repositorio, cómo se resuelven los paquetes del workspace.

### Comprobaciones sin problemas

- **Type stripping (caso límite):** npm enlaza cada workspace en `node_modules/@restaurante/*` con un symlink, y Node lo resuelve a su ruta real (`packages/...`), así que los `.ts` se ejecutan sin error. Solo fallaría con `--preserve-symlinks` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), que el proyecto no usa. Vitest también trabaja con la ruta real y transforma los `.ts`. `tsc` (NodeNext) sigue un `exports` que apunta a `.ts` y rechaza los imports profundos que `exports` no declara. En Docker vale lo mismo: `npm ci` crea los symlinks hacia `/app/packages/*`.
- **Ciclos:** no hay. `core/shared` no importa nada del proyecto, los módulos de `core` solo importan `shared`, y `db` solo importa `core`. No hay nombres exportados repetidos dentro de un mismo módulo, así que los `index.ts` pueden usar `export *`.
- **Partición de `user-repository.ts`:** el corte es limpio. A `core/identity` van `UserRecord`, `Actor`, `AUDIT_ACTIONS`/`AuditAction`, los tres errores y la interfaz `UserRepository`. Todo lo demás se queda en `db`, que pasa a ser su archivo renombrado: comentario de cabecera, `DOMAIN_ERRORS`, `WRITE_TX`, `MAX_ATTEMPTS`, helpers y `createUserRepository`.
- **Detección de cambios del CI (CA-14):** el job `cambios` ya trata como código todo lo que no sea documentación, así que `packages/**` dispara las validaciones sin tocar la lógica. Solo se actualiza el comentario.
- **Dependabot:** la entrada npm de `/restaurante` usa el lockfile único y actualiza el `package.json` de todos los workspaces, `packages/*` incluidos. La entrada docker sigue en `/restaurante/landing-pages`, porque el `Dockerfile` no se mueve. Solo cambian los comentarios.
- **`smoke.sh` e imagen `migrate`:** la etapa sigue con `WORKDIR /app/landing-pages` y copia `schema.prisma`, `migrations` y `prisma.config.ts` desde `packages/db` a las mismas rutas de destino. Así se mantienen el entrypoint, la estructura interna y lo que `smoke.sh` espera, sin tocar `deploy/`.
- **`deploy/`:** ningún archivo de `deploy/` hace referencia a rutas internas de la imagen. CA-13 se cumple sin tocar nada.

### Puntos que requieren decisión

**P-1. `ChangeEntry` depende de `menu-diff.ts`, que según el ticket se queda en `landing-pages` (bloqueante).**
- Problema: la interfaz del store de productos, que va a `core`, contiene `ChangeEntry.changes: FieldChange[]`, y `FieldChange` está en `services/menu-diff.ts`. Si `menu-diff.ts` se queda en `landing-pages`, `core` tendría que importar `landing-pages`, lo que RF-6 prohíbe.
- Afecta a: RF-2, RF-6, el Alcance (`ProductStore`, `ProductStoreTx`, `ChangeEntry` a `core`) y Fuera de alcance (`menu-diff.ts` se queda).
- Alternativas:
  - **(A, recomendada)** Mover `menu-diff.ts` entero a `core/catalog`. Son 32 líneas, sin imports, y es lógica pura de catálogo. El servicio de productos y `menu-repository.ts` lo importan desde `core`, como permite la regla de transición.
  - (B) Mover a `core` solo la interfaz `FieldChange` y que `menu-diff.ts` la importe. Eso supone partir un tercer archivo.
- Decisión requerida: A o B.

**P-2. Cambios que no son líneas de import y que no se pueden evitar (RF-5 y CA-2).**
- Problema: estos casos no se pueden resolver cambiando solo imports y exports.
  1. `db/verify.ts` calcula `DEFAULT_MIGRATIONS_DIR` con `PROJECT_DIR` de `config/env.ts`, que se queda en `landing-pages`. Además, `db/client.ts` y `verify.ts` importan el tipo `DatabaseConfig` de `env.ts`.
  2. `tests/support/database-admin.ts` ejecuta el CLI de Prisma con `cwd: PROJECT_DIR` (necesita `prisma.config.ts`) y resuelve el CLI desde el `package.json` de `landing-pages`. `tests/unit/http-test-convention.test.ts` crea ESLint con `cwd: PROJECT_DIR`, pero la configuración pasa a la raíz.
  3. Hay comentarios dentro de archivos movidos que citan rutas antiguas, por ejemplo `schema.prisma` ("mismos ids que src/config/businesses.ts").
- Afecta a: RF-5 y CA-2.
- Propuesta:
  - (1) La declaración de `DatabaseConfig` se mueve entera a `packages/db/src/database-config.ts`, y `env.ts` la importa y la reexporta (líneas de import y export). Se añade `packages/db/src/paths.ts` con `DB_PACKAGE_DIR` (la carpeta del paquete). La línea de `DEFAULT_MIGRATIONS_DIR` pasa de `join(PROJECT_DIR, 'prisma', 'migrations')` a `join(DB_PACKAGE_DIR, 'prisma', 'migrations')`. Es una constante de módulo, no el cuerpo de una función.
  - (2) En el soporte de pruebas se ajustan esas rutas (`cwd` del CLI de Prisma, base de `createRequire` y `cwd` de ESLint), sin cambiar ninguna expectativa.
  - (3) Los comentarios de los archivos movidos no se tocan. `schema.prisma` queda idéntico byte a byte (su `output = "../src/generated/prisma"` sigue siendo válido dentro de `packages/db`).
  - Cada excepción se enumera en el Implementation Result.
- Decisión requerida: aceptar esta lista cerrada de excepciones a CA-2 o indicar otra cosa.

**P-3. CA-11 (cobertura): no existe medición de cobertura que conservar.**
- Problema: el proyecto no tiene `@vitest/coverage-*` instalado, ni `coverage` en `vitest.config.ts`, ni umbrales, ni un paso de cobertura en el CI. "Los mismos umbrales que antes" no tiene referencia.
- Afecta a: CA-11 y el caso límite "Cobertura".
- Alternativas:
  - **(A, recomendada)** Redactar CA-11 así: "No hay medición de cobertura. El código movido a `packages/` sigue ejercitado por las mismas pruebas, que Vitest transforma por su ruta real, y CA-4 lo comprueba con el número de pruebas". Instalar cobertura queda fuera de alcance.
  - (B) Añadir `@vitest/coverage-v8` (devDependency nueva, a justificar según `dependencias.md`), con `include` sobre `landing-pages/src` y `packages/**` y sin umbrales. Esto amplía el alcance.
- Decisión requerida: A o B.

**P-4. RF-8 y CA-12, "misma estructura interna" de la imagen `production`.**
- Problema: la imagen de la app necesita ahora `/app/packages/core` y `/app/packages/db` (código, cliente generado y migraciones), porque `landing-pages` los importa. `verify.ts` leería las migraciones en `/app/packages/db/prisma/migrations`, no en `/app/landing-pages/prisma/migrations`.
- Afecta a: RF-8 (solo `production`; `migrate` queda idéntica).
- Propuesta: "misma estructura interna" significa que se mantienen el nombre, `WORKDIR /app/landing-pages`, `CMD node src/server.ts`, `scripts/admin-recover.ts` y `hash-password.ts` en la misma ruta, el usuario `node`, `ENV`, `HEALTHCHECK`, `EXPOSE` y `/var/lib/restaurante`. Se añaden `/app/packages/*` y las migraciones cambian de ruta dentro de la imagen. Ningún archivo de `deploy/` ni de `ops/` usa esa ruta.
- Decisión requerida: confirmar esta interpretación.

**P-5. `.env` del CLI de Prisma.**
- Problema: `prisma.config.ts` carga el `.env` de su propia carpeta. Al moverse a `packages/db`, ya no leería `landing-pages/.env`, que es donde cada desarrollador tiene hoy `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL`. `npm run db:migrate` y `db:migrate:dev` fallarían con un error de URL ausente hasta mover esas dos líneas.
- Afecta a: CA-10 y la guía de desarrollo.
- Alternativas:
  - **(A, recomendada)** `packages/db/.env.example` con solo esas dos variables (la app nunca las lee), que se quitan de `landing-pages/.env.example`. `prisma.config.ts` queda sin cambios. El README y `docs/desarrollo.md` indican que hay que copiar esas dos líneas a `packages/db/.env`.
  - (B) Cambiar `prisma.config.ts` para que lea `../../landing-pages/.env`. Funciona sin pasos manuales, pero `db` dependería de un archivo de `landing-pages` y cambiaría una línea que no es de import.
- Decisión requerida: A o B.

### Interpretaciones que no requieren decisión (salvo objeción)

- **Servicio de productos:** `createProductRepository`, la interfaz `ProductRepository`, `ProductView`, `PublishedProducts`, `ImportSource`, `toPublished`, `withProducts`, `productsFromMenuData` y `LIMIT_MESSAGE` se quedan en `landing-pages/src/repositories/product-repository.ts`. El ticket solo asigna a `core` "las interfaces del store", y §8 solo asigna las interfaces de `repositories/*`. Pasan a `core/catalog/product-store.ts`, sin cambiar sus cuerpos, `PRODUCT_ACTIONS`/`ProductAction`, `ChangeEntry`, `ChangeSummary`, `ImportSourceName`, la sección "Store" (`NewProduct`, `ProductStoreTx`, `ProductStore`) y la sección "Errores de dominio", que usan los dos stores.
- **`config/businesses.ts`:** el archivo se mueve a `core/shared/businesses.ts` sin `BUSINESS_PATHS` (rutas de las landings). `BUSINESS_PATHS` pasa a `landing-pages/src/config/business-paths.ts`.
- **Archivos que se mueven enteros:** `utils/logger.ts` (`silentLogger` se crea con `createLogger`, así que no se puede partir sin reescribir) y `utils/errors.ts` (solo contiene `errorProp`).
- **`db/errors.ts`:** `DatabaseUnavailableError` va a `core/shared` junto con `DatabaseErrorDetails`, que es el tipo de su constructor.
- **Pruebas:** se quedan en `landing-pages/tests`. Solo cambian sus imports (y las rutas de P-2), así que CA-4 y CA-5 se comparan con la misma suite. Moverlas a cada paquete queda para un paso posterior.
- **`.claude/agents/senior-fullstack.md`:** cita rutas que cambiarán (`src/db/verify.ts`, `src/generated/prisma`, `prisma/`). No está en RF-9 y es configuración de agentes: queda como pendiente, para que el usuario decida si se actualiza.

### Respuestas del usuario y aprobación del plan (2026-10-26)

- **P-1:** "Mover menu-diff.ts a core (Recomendado)". `menu-diff.ts` va entero a `core/catalog`.
- **P-2:** "P-2: excepciones a 'solo imports'". Se acepta la lista cerrada de excepciones propuesta.
- **P-3:** "Reescribir CA-11 (Recomendado)". CA-11 queda reescrito y no se instala cobertura.
- **P-4:** "P-4: imagen production". Se acepta la interpretación propuesta.
- **P-5:** "Nuevo packages/db/.env (Recomendado)". `packages/db/.env.example` solo con `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL`. `prisma.config.ts` no cambia.
- **Agente:** "Actualizar senior-fullstack.md". Se actualizan solo las rutas de `.claude/agents/senior-fullstack.md`, sin tocar su contenido normativo.
- **Plan:** "Aprobar el plan e implementar". El Technical Action Plan queda aprobado con estas respuestas, sin otra vuelta.

## Technical Action Plan

> Borrador sujeto a las respuestas de la Revisión técnica: supone las opciones recomendadas (P-1 A, P-2 propuesta, P-3 A, P-4 propuesta, P-5 A). Si alguna respuesta es distinta, se ajusta el plan antes de pedir su aprobación. El PR va a `epic/arquitectura`.

### Objetivo técnico

Crear los workspaces `@restaurante/core`, `@restaurante/contracts` y `@restaurante/db`. Mover a ellos los archivos asignados con `git mv`, cambiando solo los imports y exports y las excepciones de P-2. Unificar `tsconfig` y ESLint en la raíz e imponer la regla de dependencias con `no-restricted-imports`, sin dependencias nuevas.

### Archivos o componentes afectados (estructura final)

```text
restaurante/
├── package.json             workspaces: packages/core, packages/contracts, packages/db, landing-pages
│                            devDependencies comunes (desde landing-pages): typescript, @types/node, eslint,
│                            @eslint/js, typescript-eslint, globals, @eslint-community/eslint-plugin-eslint-comments
├── tsconfig.base.json       opciones comunes (strict, noUncheckedIndexedAccess, erasableSyntaxOnly,
│                            verbatimModuleSyntax, NodeNext, noEmit, allowImportingTsExtensions, ...)
├── tsconfig.json            solo eslint.config.ts (raíz)
├── eslint.config.ts         ← git mv de landing-pages/eslint.config.ts + regla de dependencias
├── packages/
│   ├── core/                @restaurante/core, sin dependencias
│   │   ├── package.json     exports: ./shared, ./catalog, ./schedule, ./identity, ./bot-control (cada uno → index.ts)
│   │   ├── tsconfig.json    extiende ../../tsconfig.base.json
│   │   ├── shared/          businesses.ts (BUSINESS, BusinessId, BUSINESS_IDS, isBusinessId), logger.ts,
│   │   │                    errors.ts (errorProp), database-errors.ts (DatabaseUnavailableError,
│   │   │                    DatabaseErrorDetails), index.ts
│   │   ├── catalog/         product-schema.ts, menu-schema.ts, visible-menu.ts, price.ts, slug.ts, menu-diff.ts,
│   │   │                    product-store.ts (parte store/errores de product-repository.ts),
│   │   │                    memory-product-store.ts, index.ts
│   │   ├── schedule/        business-schedule.ts, index.ts
│   │   ├── identity/        authorization.ts, user-schema.ts, admin-auth.ts,
│   │   │                    user-repository.ts (interfaz, tipos y errores), index.ts
│   │   └── bot-control/     bot-control-store.ts, memory-bot-control-store.ts, index.ts
│   ├── contracts/           @restaurante/contracts: package.json sin dependencias, index.ts sin exportaciones,
│   │                        tsconfig.json
│   └── db/                  @restaurante/db
│       ├── package.json     dependencies: @restaurante/core, @prisma/client 7.10.1, @prisma/adapter-mariadb 7.10.1,
│       │                    mariadb 3.5.4; devDependencies: prisma 7.10.1. Scripts db:generate, db:migrate,
│       │                    db:migrate:dev, typecheck. exports por archivo: ./client, ./errors, ./verify,
│       │                    ./database-config, ./paths, ./user-repository, ./prisma-product-store,
│       │                    ./prisma-bot-control-store, ./generated/* (solo tipos y enums, para las pruebas)
│       ├── tsconfig.json    src/**/*.ts y prisma.config.ts
│       ├── .gitignore       src/generated/
│       ├── .env.example     MIGRATION_DATABASE_URL, SHADOW_DATABASE_URL (P-5)
│       ├── prisma.config.ts ← git mv (sin cambios)
│       ├── prisma/          ← git mv de schema.prisma y migrations/ (idénticos byte a byte)
│       └── src/             client.ts, errors.ts (sin DatabaseUnavailableError), verify.ts, database-config.ts,
│                            paths.ts, user-repository.ts (implementación Prisma), prisma-product-store.ts,
│                            prisma-bot-control-store.ts, generated/prisma (no se versiona)
└── landing-pages/           depende de @restaurante/core, @restaurante/db y @restaurante/contracts (transición)
    ├── src/config/business-paths.ts   BUSINESS_PATHS
    ├── src/repositories/product-repository.ts   servicio de productos (sin la parte store/errores)
    └── tsconfig.json        extiende ../tsconfig.base.json (+ DOM, allowJs)
```

Se quedan en `landing-pages`: todo lo que el ticket lista en "Fuera de alcance", salvo `menu-diff.ts` (P-1).

### Cambios requeridos

1. **Movimientos con `git mv`**. Cada archivo movido solo cambia en sus imports, así que `git diff -M` lo detecta como renombrado (similitud muy superior al 50 %). Cuando se parte un archivo, el trozo mayor conserva el historial con `git mv`: `user-repository.ts` → `db`, `businesses.ts` → `core/shared`, `db/errors.ts` → `db`. Lo que se extrae va a un archivo nuevo con las declaraciones copiadas tal cual: `core/identity/user-repository.ts`, `core/catalog/product-store.ts`, `core/shared/database-errors.ts`, `config/business-paths.ts` y `db/src/database-config.ts`.
2. **Imports:** unas 300 líneas de import en unos 136 archivos (68 de `src`, 3 de `scripts` y 65 de `tests`). Hacia fuera, siempre por el nombre del paquete (`@restaurante/core/catalog`, `@restaurante/db/client`). Entre módulos de `core`, por `../<módulo>/index.ts`.
3. **`index.ts`** de cada módulo de `core` con `export * from './x.ts'`. Es seguro porque no hay nombres repetidos dentro de un módulo.

### Backend

- No cambia el cuerpo de ninguna función, clase ni tipo. Las excepciones son las de P-2, enumeradas en el Implementation Result.
- `server.ts`, `app.ts` y los controladores solo cambian imports. La composición (Prisma, stores y repositorios) no cambia.

### Contenido / configuración

- **`package.json` de la raíz:**
  - `workspaces` con los cuatro;
  - `typecheck`: `npm run typecheck --workspaces --if-present && tsc -p tsconfig.json`;
  - `lint` y `lint:fix`: `eslint . --max-warnings 0` en la raíz;
  - `db:generate`, `db:migrate` y `db:migrate:dev`: `npm run <x> -w @restaurante/db --`;
  - el resto, igual. Los nombres no cambian (CA-10).
- **`allowScripts`:** sin cambios (mismos paquetes y versiones).
- **Lockfile:** se regenera con `npm install`. Se revisa que solo cambien las entradas de los workspaces, sin subidas de versión.
- **`.dockerignore`:** `packages/db/src/generated`. **`.gitignore` de `landing-pages`:** se quita `src/generated/`.
- **`.env.example`:** P-5 (A).

### Validaciones (regla de dependencias, RF-6)

Se usa `no-restricted-imports` (y `no-restricted-syntax` para `import()`) por bloques de archivos en el `eslint.config.ts` de la raíz. Es lo que §4 ya prevé, sin plugins nuevos (`eslint-plugin-import` o `eslint-plugin-boundaries` serían dependencias sin necesidad, según `dependencias.md`). Cada bloque repite los patrones `./x.js` actuales, porque un bloque posterior sustituye las opciones de la misma regla.

| Archivos | Rechaza |
| --- | --- |
| `packages/core/**/*.ts` | Cualquier import que no sea relativo ni `node:*` (Koa, Prisma, `mariadb`, `@restaurante/*`, `landing-pages`, cualquier paquete npm). Los relativos que salen del paquete (`^\.\./\.\./`). Los relativos a otro módulo que no apuntan a su `index.ts` (`^\.\./[^/]+/(?!index\.ts$)`). |
| `packages/contracts/**/*.ts` | `@restaurante/*`, `koa`, `koa-*`, `@koa/*`, `landing-pages`, `prisma`, `@prisma/*`, `mariadb`, y los relativos que salen del paquete. |
| `packages/db/**/*.ts` | `koa`, `koa-*`, `@koa/*`, `@restaurante/contracts`, `landing-pages`, `@restaurante/core/<módulo>/<archivo>` (import profundo), y los relativos que salen del paquete. |
| `landing-pages/**` | Nada nuevo. **Regla de transición** comentada en la configuración ("TEMPORAL — REQ-F-037: landing-pages puede importar core, db y contracts; la restricción se activa en el paso 3 para las landings y en el paso 4 para /admin"). |

- Segunda barrera: el `exports` de cada `package.json` impide en `tsc` y en Node importar un archivo interno desde fuera del paquete.
- Supuesto declarado: los módulos de `core` y `db/src` son planos (sin subcarpetas). Una subcarpeta exigiría ajustar los patrones, y la prueba de la regla lo detectaría.
- Las reglas actuales se conservan con rutas desde la raíz: `.js` relativos, `listenLocal` en `landing-pages/tests/**`, la excepción `landing-pages/tests/support/http.ts`, `require-description`, `no-unlimited-disable`, E-1, E-2 y `landing-pages/public/js/**`. Se ignoran `landing-pages/public/css/`, `landing-pages/data/`, `**/coverage/` y `packages/db/src/generated/`.

### Manejo de errores

Sin cambios: `DatabaseUnavailableError` conserva su clase, su `status` 503 y `expose` en false, y solo cambia de archivo.

### Testing

- **Línea base:** antes de mover nada, se ejecuta `npm test` y se anota el número de archivos y pruebas (CA-4).
- **Prueba nueva** `landing-pages/tests/unit/dependency-rule.test.ts`, con el mismo patrón que `http-test-convention.test.ts`: `ESLint.lintText` con la configuración real "como si" el código estuviera en un archivo existente de cada paquete. Comprueba cada caso de CA-6 (falla) y que un import de `core`, `db` y `contracts` desde `landing-pages` pasa. Así CA-6 queda automatizado, además de documentado.
- Las pruebas existentes solo cambian imports (y las rutas de P-2). No se borra ni se salta ninguna, ni cambia ninguna expectativa.
- `migrations-collation.test.ts` y `support/migrations.ts` leen `DEFAULT_MIGRATIONS_DIR`, que ya apunta a `packages/db/prisma/migrations`.

### Docker (`landing-pages/Dockerfile`, contexto `restaurante/`)

- **`deps`:** copia además `packages/{core,contracts,db}/package.json` a `/app/packages/...`, porque `npm ci` con workspaces los necesita.
- **`build`:** copia `packages/`, `tsconfig.base.json`, `tsconfig.json` y `eslint.config.ts` a `/app`. Ejecuta `cd /app && npm run db:generate && npm run typecheck`, para verificar todos los workspaces, y después `build:css`.
- **`test`:** sin cambios aparte de heredar `packages/`.
- **`migrate`:** copia los `package.json` de los workspaces y `npm ci` igual que hoy. `COPY packages/db/prisma/schema.prisma ./prisma/schema.prisma`, `packages/db/prisma/migrations ./prisma/migrations` y `packages/db/prisma.config.ts ./`. Mismos `WORKDIR` y `ENTRYPOINT` (CA-12, `smoke.sh`).
- **`production`:** copia los `package.json` de los workspaces y `npm ci --omit=dev --omit=optional`. `COPY --from=build` de `/app/packages/core` (sin `package.json` duplicado), de `/app/packages/db/src` (con el cliente generado) y de `/app/packages/db/prisma/migrations`. `landing-pages/src`, `public` y `scripts` siguen como hoy. Mismos `WORKDIR`, `CMD`, `USER`, `ENV` y `HEALTHCHECK` (P-4).

### CI (`.github/workflows/ci.yml`)

- **`calidad`:** los pasos no cambian, porque los scripts de la raíz delegan. La comprobación de divergencia pasa a `working-directory: restaurante/packages/db` con `../../node_modules/.bin/prisma migrate diff ...`.
- **`docker` (contenido de las imágenes):** los bucles de `production` y `migrate` incluyen también `/app/packages/core/node_modules` y `/app/packages/db/node_modules`. Se añaden estas comprobaciones:
  - en `production`, `test -d /app/packages/db/prisma/migrations && test -e /app/packages/db/src/generated/prisma/client.ts`;
  - en `migrate`, `test -e /app/landing-pages/prisma.config.ts && test -d /app/landing-pages/prisma/migrations` (CA-12).
- **`cambios`:** solo se actualiza el comentario (ya cuenta `packages/**` como código).
- **`dependabot.yml`:** solo comentarios. Dependabot no toca `engines.node`, y su comentario pasa a citar también los `package.json` de `packages/*` si lo declaran. Propuesta: no declarar `engines` en los paquetes, para no multiplicar los sitios que hay que subir.

### Seguridad

- `core` queda sin dependencias externas.
- La imagen `production` sigue sin el CLI de Prisma (lo comprueba el CI).
- No se relaja ninguna regla de lint, CSP ni salvaguarda de pruebas.

### Performance

Sin impacto en ejecución: los mismos módulos, con otra ruta. Node resuelve los symlinks una sola vez por módulo.

### Riesgos técnicos

- **Lockfile:** `npm install` podría subir versiones. Mitigación: revisar el diff del lockfile y, si sube algo, regenerarlo partiendo del lockfile actual.
- **Diff grande** (unos 190 archivos). Mitigación: renombrados con `git mv` y comprobación con `git diff -M --stat` antes de T4 (CA-2).
- **ESLint con la configuración en la raíz:** `projectService` necesita un `tsconfig.json` que cubra cada `.ts` (raíz, paquetes y `landing-pages`). Un archivo fuera de todos falla al parsear, lo que sirve de control.
- **`http-test-convention.test.ts`:** depende de dónde está la configuración (P-2).
- **Desarrolladores con `.env` antiguo:** P-5 (documentado).
- **Imagen `production`:** cambia la ruta de las migraciones (P-4). Lo cubren el paso `migrate sobre una base vacía`, el arranque *healthy* y `smoke.sh`.

### Orden de implementación

1. Línea base de `npm test`, `typecheck` y `lint`.
2. §9 decisión C (CA-15).
3. Raíz: `tsconfig.base.json`, `tsconfig.json`, workspaces y devDependencies comunes. Esqueletos de los tres paquetes.
4. `git mv` de todo lo asignado. No se hace commit hasta T4: git detecta los renombrados en el diff final porque cada archivo movido conserva casi todo su contenido.
5. Particiones, `index.ts`, `exports` e imports de `core` → `db` → `landing-pages` (`src`, `scripts`, `tests`). Ejecutar `db:generate`, `typecheck` y `test`.
6. `eslint.config.ts` en la raíz con la regla de dependencias y la prueba `dependency-rule.test.ts`. Ejecutar `lint`.
7. `Dockerfile`, `.dockerignore`, `.gitignore`, `ci.yml` y `dependabot.yml`. Construir las imágenes `production` y `migrate` en local y ejecutar `smoke.sh`.
8. Documentación de RF-9: §4 (árbol con `bot-control/`, `shared/` y `contracts/`, quitar la nota del paso 1, desviación de transición), §8 (detalle del paso 2), §9 y su encabezado, `README.md`, `docs/desarrollo.md`, `.claude/rules/typescript.md` y `.claude/rules/codegraph.md`.
9. Validación final y comprobación de cada CA.

### Criterios de finalización (cómo se verifica cada CA)

| CA | Verificación |
| --- | --- |
| 1 | `npm ci` en la raíz y `npm query .workspace` listan los 4. Un solo `package-lock.json` |
| 2 | `git diff -M --stat epic/arquitectura` muestra los renombrados. Revisión del diff de cada archivo movido: solo imports y exports, más las excepciones de P-2 enumeradas |
| 3 | `git diff -M epic/arquitectura -- packages/db/prisma/migrations` muestra solo renombrados al 100 %. `sha256sum` antes y después |
| 4 | Número de pruebas de antes y de después en el Implementation Result. `git grep -n "\.skip\|\.only"` sin novedades |
| 5 | `npm test`, con las suites de landings (`?dia=`, 7 días), `/admin`, API de productos y webhook, sin cambios de expectativas. `smoke.sh` en el CI del PR |
| 6 | `dependency-rule.test.ts` y una ejecución manual de `npm run lint` con imports de prueba, con la salida en el Implementation Result |
| 7 | Lectura de `packages/core/package.json` (sin `dependencies`) y de `packages/contracts/package.json` |
| 8 | `tsconfig.base.json` con las 4 opciones. `grep extends` en cada `tsconfig.json`. `npm run typecheck` termina con 0 |
| 9 | Un solo `eslint.config.ts`. `npm run lint` termina con 0. `http-test-convention.test.ts` sigue pasando |
| 10 | Ejecución de cada script desde la raíz (`db:up`, `db:generate`, `db:migrate`, `db:migrate:dev` contra la base local con un nombre de prueba y su reversión, `dev`, `start`, `test`, `lint` y `typecheck`) |
| 11 | Según P-3 |
| 12 | Comprobaciones nuevas de contenido de las imágenes en el job `docker` |
| 13 | `git diff --stat epic/arquitectura -- restaurante/deploy` vacío para los 3 archivos |
| 14 | `gh pr checks` en verde (`cambios`, `calidad`, `docker`, `despliegue` y `auditoria`), con el PR contra `epic/arquitectura` |
| 15 | §9 y el encabezado de `arquitectura.md` |
| 16 | `packages/contracts/index.ts` con `export {};`. `grep -c zod package-lock.json` da 0 |
| 17 | `core/bot-control/` y `db/src/prisma-bot-control-store.ts`. `bot-control-store.test.ts` y `admin-bot.test.ts` pasan sin cambios de expectativas |
| 18 y 19 | Revisión de §4, §8, el README, `desarrollo.md` y las reglas: rutas existentes y sin funciones inventadas |

**Tamaño estimado:**
- unos 190 archivos tocados: unos 32 renombrados, unos 140 con cambios de imports (unas 300 líneas), unos 20 nuevos (paquetes, `tsconfig`, `index.ts`, archivos extraídos y la prueba de la regla) y unos 10 de configuración y documentación;
- sin contar el contenido de los renombrados, unas +900 / −700 líneas, incluido el lockfile.

## Implementation Result

### Rama

`feature/REQ-F-037-extraer-core-contracts-db`, creada desde `epic/arquitectura` (`dc02106`, al día con `origin`). Sin commit (se hace en T4). El PR irá contra `epic/arquitectura`.

### Cambios realizados

- **Workspaces:** `packages/core` (`@restaurante/core`), `packages/contracts` (`@restaurante/contracts`) y `packages/db` (`@restaurante/db`), declarados en el `package.json` de la raíz junto a `landing-pages`, con un único `package-lock.json`. El lockfile solo añade las entradas de los workspaces y sus enlaces: no cambia ninguna versión.
- **`core`** (sin dependencias). `exports` solo hacia el `index.ts` de cada módulo:
  - `shared/`: `businesses.ts` (sin `BUSINESS_PATHS`), `logger.ts`, `errors.ts` y `database-errors.ts` (`DatabaseUnavailableError` y `DatabaseErrorDetails`);
  - `catalog/`: `product-schema`, `menu-schema`, `visible-menu`, `price`, `slug`, `menu-diff` (P-1), `product-store.ts` (extraído de `product-repository.ts`) y `memory-product-store.ts`;
  - `schedule/`: `business-schedule`;
  - `identity/`: `authorization`, `user-schema`, `admin-auth` y `user-repository.ts` (contrato extraído de la implementación Prisma);
  - `bot-control/`: `bot-control-store` y `memory-bot-control-store`.
- **`db`**:
  - con `git mv`: `prisma/` (schema y migraciones), `prisma.config.ts`, `client.ts`, `errors.ts`, `verify.ts`, `user-repository.ts` (implementación Prisma), `prisma-product-store.ts` y `prisma-bot-control-store.ts`;
  - archivos nuevos: `database-config.ts` (el tipo `DatabaseConfig`, movido de `config/env.ts`) y `paths.ts` (`DB_PACKAGE_DIR`);
  - el cliente generado queda en `packages/db/src/generated/prisma`, sin tocar `schema.prisma`;
  - `.env.example` con `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL` (P-5), que salen de `landing-pages/.env.example`.
- **`contracts`:** `package.json` sin dependencias, `index.ts` con `export {}` y `tsconfig.json`.
- **`landing-pages`:**
  - `config/business-paths.ts` (`BUSINESS_PATHS`);
  - `repositories/product-repository.ts` conserva el servicio de productos;
  - los imports de `src`, `scripts` y `tests` (123 archivos `.ts` modificados) pasan a `@restaurante/core/<módulo>` y `@restaurante/db/<archivo>`, agrupados como en el resto del proyecto (node:, paquetes npm, `@restaurante/*`, relativos);
  - dependencias: `@restaurante/{core,db,contracts}`; Prisma y `mariadb` pasan a `db` (`mariadb` queda como devDependency para el soporte de pruebas).
- **Raíz:**
  - `tsconfig.base.json` (lo extienden los 4 workspaces) y `tsconfig.json` (para `eslint.config.ts`);
  - `eslint.config.ts`, movido con `git mv`, con la regla de dependencias (`no-restricted-imports` y `no-restricted-syntax` por paquete, sin plugins nuevos) y la regla de transición comentada como temporal;
  - devDependencies comunes (TypeScript y ESLint) y `"type": "module"`;
  - scripts: `typecheck` (todos los workspaces más la raíz), `lint` (raíz) y `db:*` (delegan en `@restaurante/db`).
- **Docker** (`landing-pages/Dockerfile`):
  - `deps`, `migrate` y `production` copian los `package.json` de `packages/*`;
  - `build` copia `packages/` y la configuración común, y ejecuta `db:generate` y `typecheck` desde `/app`;
  - `migrate` copia schema, migraciones y `prisma.config.ts` de `packages/db` al mismo WORKDIR de siempre;
  - `production` copia `packages/core`, `packages/db/src` y `packages/db/prisma/migrations`;
  - `.dockerignore` y `.gitignore` actualizados.
- **CI** (`ci.yml`):
  - la divergencia se comprueba en `restaurante/packages/db`;
  - la revisión del contenido de las imágenes cubre `packages/*/node_modules` y comprueba CA-12;
  - comentarios de cabecera y de `cambios`.
- **Dependabot:** solo comentarios.
- **Prueba nueva:** `landing-pages/tests/unit/dependency-rule.test.ts` (31 casos de CA-6).
- **Documentación:**
  - `docs/arquitectura.md`: encabezado; §4 (árbol con `shared/` y `bot-control/`, sin la nota del paso 1, lint, paquetes y regla de transición); §8 (paso 2 aplicado); §9 (decisión C tomada);
  - `README.md`, `docs/desarrollo.md` y `docs/despliegue.md`;
  - `.claude/rules/typescript.md` y `.claude/rules/codegraph.md`;
  - `.claude/agents/senior-fullstack.md`, solo rutas.

### Excepciones a "solo imports" (P-2, lista cerrada)

1. `packages/db/src/verify.ts`: `DEFAULT_MIGRATIONS_DIR = join(DB_PACKAGE_DIR, 'prisma', 'migrations')`, antes con `PROJECT_DIR`.
2. Declaraciones movidas enteras, sin cambiar su cuerpo:
   - `DatabaseConfig` (de `env.ts` a `db/src/database-config.ts`);
   - `BUSINESS_PATHS` (a `config/business-paths.ts`);
   - `DatabaseUnavailableError` y `DatabaseErrorDetails` (a `core/shared/database-errors.ts`);
   - las declaraciones de store y errores de `product-repository.ts` y de contrato de `user-repository.ts`.

   Se comprobó con un script que cada línea de los archivos extraídos existe tal cual en el original. Solo son nuevas las cabeceras de `product-store.ts` y `core/identity/user-repository.ts`.
3. `landing-pages/tests/support/database-admin.ts`: el `cwd` del CLI de Prisma y la base de `createRequire` pasan a `DB_PACKAGE_DIR`, con sus dos comentarios.
4. Dos `import()` dinámicos en pruebas (`admin-products*.test.ts`) cambian de ruta.
5. Los comentarios de los archivos movidos no se tocaron: `schema.prisma` y `prisma.config.ts` son idénticos byte a byte. `http-test-convention.test.ts` no necesitó cambios.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| 1 | Cumple | `npm install` en la raíz enlaza `node_modules/@restaurante/{core,contracts,db}`. Un solo `package-lock.json`, con los 4 workspaces |
| 2 | Cumple | `git diff -M epic/arquitectura` detecta 28 renombrados. El análisis de las líneas cambiadas de todos los `.ts` solo encuentra imports y exports más las excepciones de P-2 enumeradas |
| 3 | Cumple | Las 3 migraciones son renombrados con 0 cambios. sha256 de antes y de después idénticos (`migration_lock.toml`, `20261009223102_inicial_mysql`, `20261015024103_bot_proteccion`) |
| 4 | Cumple | Antes: 93 archivos, 1980 pruebas que pasan + 1 *expected fail* (1981). Después: 94 archivos, 2011 + 1 *expected fail* (2012). Las 31 nuevas son de `dependency-rule.test.ts`. Ninguna prueba borrada; `.skip`, `.only` y `.fails` igual que antes (solo el `it.fails` intencional de `local-server.test.ts`) |
| 5 | Cumple en local; `smoke.sh`, pendiente del CI | Suites de landings (`?dia=`), `/admin`, API de productos y webhook en verde sin cambiar expectativas. Imagen `production` *healthy* con `/` y `/molotes` en 200, contra una base migrada con la imagen `migrate`. `smoke.sh` necesita las herramientas GNU de Linux: lo ejecuta el job `despliegue` del CI del PR |
| 6 | Cumple | `dependency-rule.test.ts` (31 casos). Además, ejecución manual de ESLint con imports de prueba en archivos reales: 15 errores (`core`: koa, @prisma/client, contracts, db, relativo a landing-pages, archivo interno de otro módulo; `contracts`: core, db, koa; `db`: koa, contracts, relativo a landing-pages, archivo interno de core) y 0 en `landing-pages` (transición). Archivos restaurados después |
| 7 | Cumple | `packages/core/package.json` sin `dependencies`. `packages/contracts/package.json` sin dependencias |
| 8 | Cumple | `tsconfig.base.json` con `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` y `verbatimModuleSyntax`. Los 4 `tsconfig.json` de los workspaces (y el de la raíz) lo extienden. `npm run typecheck` termina con 0 |
| 9 | Cumple | Un único `eslint.config.ts`, en la raíz. `npm run lint` termina con 0. Se conservan las reglas `.js`, `listenLocal`, `require-description`, E-1, E-2 y `public/js` (`http-test-convention.test.ts` pasa) |
| 10 | Cumple | Desde la raíz: `db:up`, `db:generate`, `db:migrate` ("No pending migrations"), `db:migrate:dev` ("Already in sync"), `start` y `dev` (200 en `/`), `test`, `lint` y `typecheck` |
| 11 | Cumple (reescrito) | No hay medición de cobertura. El código movido lo ejercitan las mismas pruebas (CA-4) |
| 12 | Cumple en local; CI pendiente | Comprobaciones del job `docker` ejecutadas en local: `production` sin el CLI de Prisma, con `/app/packages/db/prisma/migrations` y el cliente generado; `migrate` con WORKDIR `/app/landing-pages`, `prisma.config.ts`, schema y migraciones, y ENTRYPOINT `/app/node_modules/.bin/prisma migrate deploy` |
| 13 | Cumple | `git diff epic/arquitectura` vacío para `deploy/compose.prod.yaml`, `deploy/deploy.sh` y `deploy/mysql/initdb/01-usuarios.sh` |
| 14 | Pendiente (T4) | El PR contra `epic/arquitectura` y su CI se hacen en T4. El job `cambios` ya trata `packages/**` como código |
| 15 | Cumple | §9, "Decisión C: tomada": fecha, respuesta textual, opción y cuándo se aplica. El encabezado y §9 dejan solo B como pendiente |
| 16 | Cumple | `contracts/index.ts` con `export {}`. `zod` no aparece en ningún `package.json` ni en el lockfile (0 coincidencias) |
| 17 | Cumple | `core/bot-control/` (interfaz y memoria) y `db/src/prisma-bot-control-store.ts`. `bot-control-store.test.ts` y `admin-bot.test.ts` pasan sin cambiar expectativas |
| 18 | Cumple | §4: árbol con `bot-control/` (y `shared/`) y el párrafo "Regla de transición" (qué permite, REQ-F-037, pasos 3 y 4) |
| 19 | Cumple | RF-9 actualizada. Las rutas citadas existen |

### Validaciones ejecutadas

- `npm run db:up`: MySQL *healthy*. Antes hubo que arrancar Docker Desktop.
- `npm run db:generate`: genera en `./src/generated/prisma` de `packages/db`.
- `npm run typecheck`: 0 (core, contracts, db, landing-pages y raíz).
- `npm run lint`: 0, sin errores ni avisos.
- `npm test`: 94 archivos; 2011 pasan y 1 *expected fail* (antes, 93 archivos y 1980 + 1).
- `docker compose run --rm --build test`: 94 archivos; 2010 pasan, 1 *expected fail* y 1 omitida. La omitida es el `skipIf(runningAsRoot())` de `server-startup.test.ts`, que depende del entorno del contenedor y ya existía.
- `npm run build:css`: 0, con el CSS idéntico (mismo sha1).
- `npm run audit:deps`: sin bloqueos.
- `docker build` de `production` y `migrate`: correctos. Comprobaciones de contenido del CI: correctas. La imagen `migrate` sobre una base vacía termina con 0 y la imagen `production` queda *healthy*, con 200 en `/` y `/molotes`.
- La divergencia `prisma migrate diff` desde `packages/db` da "No difference detected".

### Archivos afectados (`git diff -M --shortstat epic/arquitectura`)

193 archivos: 28 renombrados, 141 modificados (123 `.ts` solo con imports, más configuración y documentación) y 24 nuevos. +1911 / −751 líneas, sin contar el contenido de los renombrados (incluye el lockfile, el ticket y la prueba nueva).

### Riesgos o pendientes

- `smoke.sh` y el CI completo (CA-5, CA-12 y CA-14) se validan en el PR de T4.
- Cada desarrollador debe copiar `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL` a `packages/db/.env` (documentado en el README y en `desarrollo.md`). En esta máquina se creó `packages/db/.env` local, que no se versiona.
- El ticket nunca estuvo versionado: pasó a `in-progress/` con `mv` y se añade en T4.
- Desviaciones del plan: ninguna funcional. Detalles de implementación que el plan no fijaba: (a) los imports de `@restaurante/*` de un mismo módulo se unieron en una sola declaración, ordenada, en su propio grupo (solo cambian líneas de import); (b) `mariadb` sigue como devDependency de `landing-pages` (`tests/support/database-admin.ts` la usa directamente), además de dependencia de `db`.

## QA Action Plan

senior-qa, fase Q1 (2026-10-26). La implementación fue aprobada por el usuario con la respuesta textual "Apruebo".

Plan aprobado por el usuario el 2026-10-26. Respuesta textual: "Lo apruebo".

### Objetivo

Demostrar con evidencia que la extracción de `packages/core`, `packages/contracts` y `packages/db` no cambia ningún comportamiento observable y que se cumplen CA-1 a CA-19. El foco es la regresión. Lo que solo puede comprobarse en el CI del PR se identifica por separado. La línea base de todas las comparaciones es `epic/arquitectura` (`dc02106`, igual a `HEAD`, porque la rama todavía no tiene commits), no `main`.

### Requisito bajo prueba

RF-1 a RF-9 de REQ-F-037: workspaces, solo movimiento de archivos, regla de dependencias en el lint con la regla de transición, configuración común en la raíz, imágenes sin cambios de contrato, `deploy/` intacto y documentación.

### Criterios de aceptación (cada uno, con las pruebas que lo cubren)

| CA | Pruebas |
| --- | --- |
| 1 | R-1, D-1 (`npm ci` dentro del `docker build`), R-9 |
| 2 | X-1, X-2, X-3 |
| 3 | M-1, M-2, M-3 |
| 4 | R-2, R-3, X-4 |
| 5 | R-2 (suites de landings, `/admin`, API de productos y webhook), D-4, B-1 a B-6. `smoke.sh`: CI |
| 6 | L-1, L-2, L-3 |
| 7 | L-4 |
| 8 | R-4 |
| 9 | R-5, L-5 |
| 10 | S-1 |
| 11 | Sin prueba propia (reescrito, P-3); queda cubierto por R-2 y X-4 |
| 12 | D-1, D-2, D-3 en local; confirmación en el CI |
| 13 | M-4 |
| 14 | Solo en el CI (T4); en Q2 se verifica únicamente que `ci.yml` incluye las comprobaciones (C-1) |
| 15, 18, 19 | DOC-1 |
| 16 | L-4 |
| 17 | R-2 (`bot-control-store.test.ts`, `admin-bot.test.ts`), X-1 |

### Riesgos identificados

1. Que un cambio que no es de import se cuele en los 123 `.ts` modificados o en los 28 renombrados, fuera de la lista cerrada de P-2.
2. Que la regla de dependencias tenga huecos no cubiertos por `dependency-rule.test.ts`, como `export ... from`, `import()` en `db`/`contracts`, imports profundos o `mariadb`/`prisma` en `contracts`.
3. Que la resolución por symlink de los workspaces falle con type stripping en algún punto de entrada (`server.ts`, `scripts/*`, la imagen).
4. Imagen `production`: que falten `packages/core` o `packages/db/src/generated` o que cambie la ruta de las migraciones que lee `verify.ts`. Imagen `migrate`: que cambie su WORKDIR o su ENTRYPOINT.
5. Que el lockfile suba alguna versión.
6. Que `PROJECT_DIR` o `DB_PACKAGE_DIR` apunten mal en Docker y la app no arranque.
7. Que el HTML servido difiera entre la línea base y la rama (regresión funcional silenciosa).

### Pruebas funcionales y de regresión automatizadas (R)

- **R-1.** `npm query .workspace` y los symlinks de `node_modules/@restaurante/{core,contracts,db}` hacia `packages/*`. Hay un único `package-lock.json` en `restaurante/` (no hay ninguno en los workspaces).
- **R-2.** `npm run build:css` y `npm test` desde `restaurante/`, con MySQL de pruebas levantado. Esperado: 94 archivos, 2011 pruebas que pasan y 1 *expected fail* (2012).
- **R-3.** `docker compose run --rm --build test`. Esperado: lo mismo que en R-2, salvo el `skipIf(runningAsRoot())` que ya existía.
- **R-4.** `npm run typecheck` termina con 0. Comprobar que `tsconfig.base.json` tiene las 4 opciones de RF-7 y que `extends` aparece en los `tsconfig.json` de `core`, `contracts`, `db`, `landing-pages` y la raíz.
- **R-5.** `npm run lint` termina con 0, sin avisos, y solo hay un `eslint.config.ts`, en la raíz. Nunca se ejecuta `lint:fix`.
- **R-6.** `npm run audit:deps`, sin bloqueos.
- **R-9.** Diff del lockfile contra `epic/arquitectura`: comparar con un script `name@version` de cada entrada de `packages`. Esperado: solo se añaden entradas de workspaces y enlaces, sin cambios de versión. `zod` no aparece.

### Regla de dependencias (L) — pruebas negativas

Sin modificar archivos: `npx eslint --stdin --stdin-filename <archivo real del paquete>` desde `restaurante/`.

- **L-1.** Se ejecuta `dependency-rule.test.ts` (31 casos) como parte de R-2.
- **L-2.** Sondeos manuales adicionales, todos con al menos un error esperado:
  - **`core`** (como `packages/core/catalog/price.ts`):
    - `koa`, `@prisma/client`, `@restaurante/contracts`, `@restaurante/db/client`, `../../../landing-pages/src/app.ts` y `../shared/businesses.ts`;
    - `export { x } from 'koa'` (reexportación) e `import('@prisma/client')`;
    - un paquete npm cualquiera (`supertest`) y `../../db/src/paths.ts` (relativo que sale del paquete).
  - **`contracts`** (como `packages/contracts/index.ts`): `@restaurante/core/shared`, `@restaurante/db/client`, `koa`, `@koa/router`, `@prisma/client`, `mariadb`, `../../landing-pages/src/app.ts` e `import('koa')`.
  - **`db`** (como `packages/db/src/paths.ts`): `koa`, `@restaurante/contracts`, `../../../landing-pages/src/app.ts`, `@restaurante/core/catalog/price.ts`, `export * from 'koa'` e `import('koa')`.
  - **Positivos** (0 errores): `landing-pages/src/app.ts` importando `@restaurante/core/shared`, `@restaurante/db/client` y `@restaurante/contracts`; `db` importando `@restaurante/core/identity` y `@prisma/client`; `core` importando `node:path` y `../shared/index.ts`.
- **L-3.** Segunda barrera (`exports`): desde `landing-pages`, `node -e "import('@restaurante/core/catalog/price.ts')"` debe fallar con `ERR_PACKAGE_PATH_NOT_EXPORTED`, e `import('@restaurante/core/catalog')` debe resolver.
- **L-4.** Lectura de `packages/core/package.json` (sin `dependencies`, `devDependencies` ni `peerDependencies` con `koa`, `prisma` ni `@prisma/*`) y de `packages/contracts/package.json` (sin dependencias de ningún tipo). `contracts/index.ts` no exporta nada. `grep -c zod` sobre todos los `package.json` y el lockfile da 0.
- **L-5.** Las reglas previas siguen activas: `http-test-convention.test.ts` (R-2), un sondeo de `import './x.js'` en `landing-pages/src/app.ts` (falla), un `// eslint-disable-next-line no-console` sin justificación (falla) y `public/js` sigue revisado con un sondeo de una variable global no definida.
- **Observación, no criterio:** si un import relativo desde `landing-pages` a un archivo interno de `packages/core` pasa el lint, se registra como observación para el paso 3. El ticket no lo prohíbe en el paso 2.

### Diff "solo imports" (X)

- **X-1.** Script sobre `git diff -M -U0 epic/arquitectura -- '*.ts'` (renombrados y modificados de `src`, `scripts`, `tests` y `packages`): descarta las líneas `import`/`export ... from`, sus continuaciones multilínea y las líneas en blanco, y lista lo que queda. Esperado: solo las excepciones 1, 3 y 4 de P-2.
- **X-2.** En los archivos extraídos (`core/identity/user-repository.ts`, `core/catalog/product-store.ts`, `core/shared/database-errors.ts`, `config/business-paths.ts` y `db/src/database-config.ts`), cada línea, salvo imports y cabecera, existe tal cual en el original de `epic/arquitectura` (`git show`). Y, al revés, toda declaración que desaparece del original aparece en el extraído.
- **X-3.** `git diff -M --stat epic/arquitectura` detecta los 28 renombrados. `schema.prisma` y `prisma.config.ts` son idénticos byte a byte.
- **X-4.** `git diff epic/arquitectura -- 'restaurante/landing-pages/tests'`: ningún `expect`, `it` ni `describe` cambia salvo en `dependency-rule.test.ts` (nuevo). No hay ningún `.skip`, `.only`, `.todo` ni `.fails` nuevo.

### Migraciones y `deploy/` (M)

- **M-1.** `sha256sum` de cada archivo de `packages/db/prisma/migrations/**` comparado con `git show epic/arquitectura:restaurante/landing-pages/prisma/migrations/...`. Mismos nombres de carpeta, mismo SQL y mismo `migration_lock.toml`.
- **M-2.** `git diff -M epic/arquitectura --stat -- restaurante/packages/db/prisma`: renombrados al 100 %.
- **M-3.** Divergencia: `prisma migrate diff` desde `packages/db` (el comando del job `calidad`) da "No difference detected".
- **M-4.** `git diff epic/arquitectura -- restaurante/deploy restaurante/ops` vacío (todo `deploy/`, no solo los 3 archivos de CA-13) y sin archivos sin seguimiento en esas carpetas.

### Scripts desde la raíz (S)

- **S-1.** Desde `restaurante/`:
  - `db:up` y `db:generate` (genera en `packages/db/src/generated/prisma`);
  - `db:migrate` ("No pending migrations");
  - `db:migrate:dev`, solo si `prisma migrate status` indica que la base local está al día; si no, se registra como bloqueo de entorno y no se ejecuta, para no arriesgar un reset;
  - `start` y `dev` (200 en `/`), `test`, `lint` y `typecheck`;
  - `admin:hash-password` y `bot:chat` solo se arrancan para comprobar que resuelven sus imports (se cancelan sin introducir datos).

### Imágenes Docker (D)

- **D-1.** `docker build --target production` y `--target migrate` de la rama (contexto `restaurante/`, como en el CI). Los dos ejecutan `npm ci` con el lockfile único.
- **D-2.** Comprobaciones de contenido del job `docker` de `ci.yml`, reproducidas en local:
  - `production`: no contiene el CLI de Prisma; sí contiene `/app/packages/db/prisma/migrations` y `/app/packages/db/src/generated/prisma/client.ts`;
  - `migrate`: tiene `/app/landing-pages/prisma.config.ts` y `/app/landing-pages/prisma/migrations`;
  - se recorren los `node_modules` de los workspaces.
- **D-3.** `docker image inspect` de las dos imágenes de la rama comparado con el de las mismas imágenes construidas desde la línea base (`git archive epic/arquitectura restaurante`, extraído en una carpeta temporal fuera del repositorio, sin tocar el estado de git). Deben coincidir `WorkingDir`, `Cmd`, `Entrypoint`, `User`, `Env`, `Healthcheck` y `ExposedPorts`.
- **D-4.** Ejecución en una red Docker temporal con un MySQL 8.4 desechable:
  - la imagen `migrate` sobre la base vacía termina con 0;
  - la imagen `production` queda *healthy*;
  - `curl` de `/`, `/birria`, `/molotes` y `/admin` (página de acceso) con los códigos esperados.

  Contra la misma base, la imagen `production` de la línea base: el HTML de esas rutas se compara con el de la rama, normalizando nonces de CSP, tokens CSRF y fechas. Esperado: sin diferencias.

  Al terminar, se borran los contenedores, la red, el volumen y las imágenes de la línea base.

### Pruebas en navegador (B)

Contra la app local, con `PORT=3100 npm run dev` desde `restaurante/` (el `.env` de desarrollo tiene `NODE_ENV=development`, así que `?dia=` funciona). El servidor se detiene al terminar. Se usa Claude in Chrome en una pestaña nueva, que se cierra al final.

- **B-1.** `/` sin `?dia=` (hoy, lunes 2026-10-26): Birria con el aviso "Descanso" y enlace a `/molotes`. Después, `/?dia=martes` (aviso "Molotes") y `/?dia=sabado` (sin aviso). El aviso se cierra y la página se puede consultar.
- **B-2.** `/molotes?dia=lunes` (aviso "Descanso"), `/molotes?dia=miercoles` (sin aviso) y `/molotes?dia=domingo` (aviso "Hoy toca birria", con enlace a `/birria` y botón para quedarse).
- **B-3.** `/birria`: sin aviso.
- **B-4.** CTA de WhatsApp en `/birria` y en `/molotes`:
  - visible sin scroll a 375×812;
  - `href` con el dominio de WhatsApp, el número y el `text` codificado de la configuración, más `target` y `rel`;
  - se puede enfocar con el teclado.

  No se sigue el enlace.
- **B-5.** `/admin`: la página de acceso se muestra con estilos y sin errores. No se inicia sesión: los flujos de `/admin` los cubren las suites de integración de R-2.
- **B-6.** En cada página, la consola sin errores y las peticiones de red sin 4xx/5xx en CSS, JS e imágenes. Desplazamiento horizontal inexistente a 375×812 y a 1440×900 (`scrollWidth <= clientWidth`).
- Si la extensión no responde tras 2 o 3 intentos, B-1 a B-6 quedan pendientes de revisión manual del usuario. Ningún CA depende solo de ellas, porque D-4 y R-2 cubren las rutas.

### Pruebas responsive, de accesibilidad, UX/UI, performance y SEO

No hay cambios en vistas, `public/` ni CSS (el `build:css` da el mismo sha1). Se limitan a:
- B-6 (responsive);
- el foco visible sobre el CTA en B-4 (accesibilidad);
- el diff de HTML de D-4, que cubre título, meta description, canonical, Open Graph y encabezados (SEO y UX/UI);
- la comparación de `git diff epic/arquitectura --stat -- restaurante/landing-pages/src/views restaurante/landing-pages/public`, que debe salir vacía salvo el CSS generado (no versionado).

No se hace una revisión visual completa frente a `_stich_source_/`, porque el ticket no cambia nada visual.

### Documentación (DOC)

- **DOC-1.** `arquitectura.md`:
  - encabezado y §9: decisión C con la fecha, la cita "Zod (Recomendado)", la opción y cuándo se aplica; solo B sigue pendiente;
  - §4: árbol con `bot-control/`, sin la nota del paso 1, y la regla de transición (qué permite, REQ-F-037, pasos 3 y 4);
  - §8: el paso 2.

  Además, las rutas citadas en `README.md`, `docs/desarrollo.md`, `docs/despliegue.md`, `.claude/rules/typescript.md`, `.claude/rules/codegraph.md` y `.claude/agents/senior-fullstack.md` existen (se comprueban con un script), y no se describen funciones inexistentes.

### Configuración del CI (C)

- **C-1.** Lectura de `ci.yml` y `dependabot.yml`: la divergencia se comprueba en `packages/db`, se comprueba el contenido de las imágenes de CA-12, `cambios` trata `packages/**` como código y los cambios de Dependabot son solo comentarios.

### Pruebas automatizadas

- Existentes: toda la suite (R-2 y R-3), incluida `dependency-rule.test.ts`.
- Nuevas: ninguna. Los sondeos de L-2, X-1, X-2, M-1, R-9 y D-3 son scripts de un solo uso en una carpeta temporal fuera del repositorio; no se añaden a `tests/`.

### Lo que queda para el CI del PR (T4)

- `deploy/ci/smoke.sh` y `ops/backup/ci/smoke.sh` (job `despliegue`; necesitan las herramientas GNU de Linux) → CA-5 (parte de `smoke.sh`).
- La construcción y las comprobaciones de las imágenes en el job `docker` → CA-12 (confirmación).
- Los jobs `cambios`, `calidad`, `docker`, `despliegue` y `auditoria` en verde, con el PR contra `epic/arquitectura` → CA-14.
- `shellcheck` de `deploy/` (sin cambios, se espera verde).

Q2 no puede dar estos puntos como PASS. Se marcan como "Pendiente del CI del PR" y no bloquean `QA_APPROVED`, porque el usuario ya los aceptó como pendientes de T4 al aprobar la implementación. senior-fullstack debe confirmarlos en T4 antes de `READY_FOR_MERGE`.

### Evidencia requerida

- La salida resumida de cada comando (código de salida y cifras de pruebas).
- La lista de líneas residuales de X-1 y el resultado de X-2.
- Las tablas de sha256 (M-1).
- El resultado de cada sondeo de L-2 y L-3.
- Los campos comparados de `docker image inspect` (D-3).
- El resumen del diff de HTML (D-4).
- Los `href` del CTA y el texto o capturas de B-1 a B-6.

Todo se resume en el QA Report.

### Criterios de aprobación

- CA-1 a CA-13 y CA-15 a CA-19 en PASS con evidencia local (CA-5 y CA-12, salvo la parte que depende del CI).
- `npm test` completo en verde (2012), `typecheck` y `lint` en 0.
- Ningún cambio fuera de imports, salvo la lista cerrada de P-2.
- Migraciones idénticas y `deploy/` sin cambios.
- Ningún sondeo negativo de L-2 pasa el lint, salvo los casos que el ticket no prohíbe (observaciones).
- Sin diferencias de HTML entre la línea base y la rama (D-4).
- Sin defectos `BLOCKER` ni `CRITICAL`, y los `MAJOR` aceptados por el usuario.

## QA Report

### Ronda

1 (2026-10-26). Línea base de todas las comparaciones: `epic/arquitectura` (`dc02106`, igual a `HEAD`). El estado de git es idéntico antes y después de Q2: solo cambia este ticket, que es parte de los cambios sin commit.

### Pruebas ejecutadas

| Id | Comando o acción | Resultado |
| --- | --- | --- |
| R-1 | `npm query .workspace`, symlinks y lockfiles | 4 workspaces (`landing-pages`, `@restaurante/{contracts,core,db}`). `node_modules/@restaurante/*` son symlinks a `../../packages/*`. Hay un único `package-lock.json`, en `restaurante/` |
| R-2 | `npm run build:css` y `npm test` | `build:css` termina con 0. 94 archivos, **2011 pasan y 1 es *expected fail* (2012)** |
| R-3 | `docker compose run --rm --build test` | Termina con 0. 94 archivos: 2010 pasan, 1 *expected fail* y 1 omitida (2012). La omitida es el `skipIf(runningAsRoot())` de `server-startup.test.ts`, que ya existía |
| R-4 | `npm run typecheck` | Termina con 0. Revisa core, contracts, db, landing-pages y la raíz. `tsconfig.base.json` tiene `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` y `verbatimModuleSyntax`. Los 5 `tsconfig.json` lo extienden |
| R-5 | `npm run lint` | Termina con 0, sin avisos. Hay un único `eslint.config.ts`, en la raíz |
| R-6 | `npm run audit:deps` | Termina con 0, sin bloqueos |
| R-9 | Lockfile contra la línea base (script) | Solo se añaden 6 entradas (los 3 workspaces y sus enlaces). No se quita ni cambia ninguna versión, y el multiconjunto `nombre@versión` es idéntico. `zod`: 0 |
| L-1 | `dependency-rule.test.ts` | 31 casos en verde (dentro de R-2) |
| L-2 | 34 sondeos con `eslint --stdin --stdin-filename <archivo real>`, sin modificar archivos | **34/34 con el resultado esperado** y sin errores de parseo. Detalle en "Regresión" |
| L-3 | Imports con `node` desde `landing-pages` | `@restaurante/core/catalog/price.ts` da `ERR_PACKAGE_PATH_NOT_EXPORTED`. `@restaurante/core/catalog` resuelve (59 exportaciones) y `@restaurante/db/client` también |
| L-4 | `package.json` de `core` y `contracts` | `core`: sin `dependencies`, `devDependencies` ni `peerDependencies`. `contracts`: sin dependencias, e `index.ts` solo con `export {};`. `zod` no aparece en ningún `package.json` ni en el lockfile |
| X-1 | Script: los 147 `.ts` modificados o renombrados comparados con su original, ignorando los imports y los `export ... from` | 10 archivos con otros cambios, todos esperados: las excepciones 1, 3 y 4 de P-2 (`verify.ts`, `database-admin.ts` y los dos `import()` de pruebas), solo líneas quitadas en los 5 originales partidos (`env.ts`, `product-repository.ts`, `businesses.ts`, `db/errors.ts` y `db/user-repository.ts`) y `eslint.config.ts`, con la regla de dependencias y las rutas desde la raíz (RF-6 y RF-7) |
| X-2 | Archivos extraídos comparados con los originales, en los dos sentidos | Las 5 extracciones: cada línea existe en el original, salvo 2 y 3 líneas de cabecera en `core/identity/user-repository.ts` y `core/catalog/product-store.ts`. Cada línea quitada de los originales aparece en un archivo extraído (0 perdidas) |
| X-3 | `git diff -M --summary` | 28 renombrados. `schema.prisma`, `prisma.config.ts` y las migraciones, al 100 % |
| X-4 | Diff de `tests/` sin `dependency-rule.test.ts` | 0 líneas cambiadas de `it`, `test`, `describe` o `expect`. Ningún `.skip`, `.only`, `.todo` ni `.fails` nuevo |
| M-1 | sha256 de cada archivo de `packages/db/prisma` comparado con `git show epic/arquitectura:` | **Iguales**: `20261009223102_inicial_mysql/migration.sql` (e5e1f184…), `20261015024103_bot_proteccion/migration.sql` (52eab62f…), `migration_lock.toml` (2af88c61…), `schema.prisma` (2bfe3c4b…). `prisma.config.ts` es idéntico (`cmp`) |
| M-3 | `prisma migrate diff --from-migrations … --to-schema … --exit-code` desde `packages/db`, como el CI | "No difference detected." |
| M-4 | `git diff epic/arquitectura -- restaurante/deploy restaurante/ops` y archivos sin seguimiento | Vacío en los dos casos |
| S-1 | Scripts desde la raíz | Todos funcionan. `db:up` (*healthy*). `db:generate` (genera en `./src/generated/prisma` de `packages/db`). `migrate status` ("up to date"). `db:migrate` ("No pending migrations to apply."). `db:migrate:dev` ("Already in sync"). `start` en `:3101` (200 en `/`, `/birria` y `/molotes`; 303 en `/admin`). `dev` en `:3100` (200, `nodeEnv: development`). `test`, `lint` y `typecheck`. `admin:hash-password` con una contraseña por stdin devuelve un hash `scrypt$…` y sin stdin sale con el mensaje de uso de siempre. `bot:chat` arranca el simulador |
| D-1 | `docker build` de `production` y `migrate`, de la rama y de la línea base (`git archive`) | Las 4 se construyen sin error. La etapa `build` de la rama ejecuta `db:generate` y `typecheck` |
| D-2 | Las comprobaciones de contenido del job `docker` de `ci.yml`, tal cual | `production`: termina con 0 (sin el CLI de Prisma ni SQLite, con `adapter-mariadb`, `/app/packages/db/prisma/migrations` y el cliente generado). `migrate`: termina con 0 (WORKDIR `/app/landing-pages`, `prisma.config.ts`, schema y migraciones) |
| D-3 | `docker image inspect` de la línea base comparado con el de la rama | **Iguales** en las dos imágenes: `WorkingDir`, `Cmd`, `Entrypoint`, `User`, `Env`, `Healthcheck`, `ExposedPorts` y `Volumes`. Contenido de `/app`: `production` cambia como se aceptó en P-4 (los módulos pasan de `landing-pages/src` a `packages/*` y las migraciones a `packages/db`); `migrate` solo añade los 3 `package.json` de `packages/*`. En `production`, `/app/node_modules/@restaurante/*` son symlinks y el usuario es `node` |
| D-4 | Base vacía (MySQL de desarrollo, base `restaurante_test_qa037`), `migrate` de la rama y `production` de la línea base y de la rama a la vez | `migrate` aplica las 2 migraciones. Las dos `production` quedan *healthy* (la de la rama, tras un reinicio; ver la observación O-1). Se comparan 8 rutas (`/`, `/birria`, `/molotes`, `/admin`, `/admin/login`, `/robots.txt`, `/sitemap.xml` y `/no-existe`): **mismos códigos, cabeceras y cuerpos** (normalizando el nonce). Los 27 recursos que enlazan las landings (CSS, JS, imágenes, manifiestos): 200 y **mismo sha1**. `/admin/api/products` da 503 y `/api/products` y `/webhook/whatsapp` dan 404 en las dos |
| B-1 a B-6 | Claude in Chrome contra `npm run dev` (`:3100`), ventana de 1280×906 | Ver "Criterios de aceptación" (CA-5) y las secciones siguientes |
| DOC-1 | Revisión de `arquitectura.md` y un script de rutas citadas en 7 documentos | Ver CA-15, CA-18 y CA-19 |
| C-1 | Lectura de `ci.yml` | La divergencia se comprueba en `restaurante/packages/db`. El job `docker` recorre los `node_modules` de `packages/*` y comprueba CA-12. El comentario de `cambios` cita `packages/**` |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| 1 | PASS | R-1. `npm ci` con el lockfile único dentro de los 4 `docker build` (D-1). R-9 |
| 2 | PASS | X-1, X-2, X-3 y X-4. Los únicos cambios que no son imports están en la lista cerrada de P-2 o son configuración (`eslint.config.ts`, RF-6 y RF-7) |
| 3 | PASS | M-1 (sha256 iguales), X-3 (renombrados al 100 %) y M-3 |
| 4 | PASS | Antes, 1981; ahora, 2012 (R-2 y R-3). Las 31 nuevas son de `dependency-rule.test.ts`. X-4: ninguna prueba borrada, omitida ni con expectativas cambiadas |
| 5 | PASS en local; `smoke.sh`, pendiente del CI | R-2 (suites de landings con `?dia=`, `/admin`, API de productos y webhook). D-4: HTML y cabeceras idénticos a la línea base en `production`. Navegador: `/` (lunes real: aviso "Descanso" con enlace a `/molotes`, se cierra con "Cerrar" y guarda la marca de sesión), `/?dia=martes` (aviso de Molotes con enlace a `/molotes`), `/?dia=sabado` (sin aviso), `/molotes?dia=lunes` ("Descanso"), `/molotes?dia=miercoles` (sin aviso), `/molotes?dia=domingo` ("Hoy toca birria", enlace a `/birria` y botón "Quedarme en Molotes"), `/birria?dia=lunes` (sin aviso), `/admin` (redirige a `/admin/login`, formulario con etiquetas y CSS cargado). Un solo `h1` por página |
| 6 | PASS | L-1 (31 casos), L-2 (34/34) y L-3 |
| 7 | PASS | L-4 |
| 8 | PASS | R-4 |
| 9 | PASS | R-5. Siguen activas las reglas anteriores: `./x.js` rechazado, `eslint-disable` sin justificación rechazado (`require-description`), `public/js` con `no-undef` y `http-test-convention.test.ts` en verde (R-2) |
| 10 | PASS | S-1 |
| 11 | PASS (reescrito, P-3) | No hay medición de cobertura. El código movido lo ejercitan las mismas pruebas (CA-4 y X-4) |
| 12 | PASS en local; confirmación pendiente del CI | D-1, D-2 y D-3 |
| 13 | PASS | M-4: todo `deploy/` y `ops/` sin cambios |
| 14 | PENDIENTE DEL CI DEL PR | No es verificable antes de T4. C-1: la configuración del CI ya contempla `packages/**` |
| 15 | PASS | `arquitectura.md` §9, "Decisión C: tomada": fecha 2026-10-26, respuesta "Zod (Recomendado)", opción Zod, se aplica desde el paso 3 y en el paso 2 no se instala nada. El encabezado dice "Decisiones A (2026-10-24) y C (2026-10-26) tomadas; queda abierta B", y §9, "B sigue pendiente" |
| 16 | PASS | L-4 |
| 17 | PASS | `packages/core/bot-control/` (interfaz y memoria, renombrados al 100 % y al 99 %) y `packages/db/src/prisma-bot-control-store.ts`. `bot-control-store.test.ts` y `admin-bot.test.ts` en verde, sin cambios de expectativas (R-2 y X-4) |
| 18 | PASS | §4: árbol con `bot-control/` ("desde el paso 2"), `tsconfig.base.json` en el árbol, sin la nota del paso 1 (0 coincidencias) y el párrafo "Regla de transición" (qué permite, REQ-F-037, paso 3 para las landings y paso 4 para `/admin`) |
| 19 | PASS | Script de rutas citadas en `arquitectura.md`, `README.md`, `desarrollo.md`, `despliegue.md`, `typescript.md`, `codegraph.md` y `senior-fullstack.md`: las únicas no resueltas son rutas históricas a propósito (la tabla "Dónde queda el código actual" de §8, con el origen de cada archivo), rutas internas de la imagen (`/app/...`), nombres de tablas (`_prisma_migrations`), marcadores (`prisma@x.y.z`) y abreviaturas de una ruta existente (`db/src/verify.ts`). No se describen funciones inexistentes |

### Defectos encontrados

Ninguno.

**Observaciones** (no son defectos y no bloquean):

- **O-1. Ya existía; no es una regresión.** Si dos contenedores `production` arrancan a la vez contra una base recién migrada, uno de los dos sale con `products_init_failed` (`SlugTakenError`) al importar los productos semilla. Reproducido igual con dos contenedores de la línea base (`epic/arquitectura`) y con dos de la rama. Un contenedor solo arranca bien en los dos casos, y al reiniciar el que falló, queda *healthy*. Producción usa un solo contenedor `app`, así que el impacto actual es nulo. Puede ser relevante en el paso 3, si `api` y `landing-pages` comparten la importación inicial. Queda fuera del alcance de este ticket.
- **O-2.** Un import relativo desde `landing-pages` a un archivo interno de un paquete (`../../packages/core/catalog/price.ts`) pasa el lint. El paso 2 no lo prohíbe (regla de transición) y `exports` solo protege los imports por el nombre del paquete. Conviene cerrarlo cuando se retire la regla de transición (pasos 3 y 4).
- **O-3.** La imagen `production` solo lleva el `package.json` de `contracts`, sin su `index.ts`. Es intencional (comentario del `Dockerfile`; hoy nada importa `@restaurante/contracts` en ejecución). En el paso 3, cuando `contracts` tenga código, habrá que copiarlo.

### Regresión

- La suite completa pasa en local y en Docker (R-2 y R-3).
- `production` de la rama y de la línea base: mismo HTML, mismas cabeceras y mismos recursos (D-4).
- Regla de dependencias, sondeos L-2:
  - **`core` rechaza:** `koa`, `@prisma/client`, `@restaurante/contracts`, `@restaurante/db/client`, el relativo a `landing-pages`, `../shared/businesses.ts`, `export { default } from 'koa'`, `export * from 'koa'`, `import('@prisma/client')`, `supertest` y `../../db/src/paths.ts`.
  - **`contracts` rechaza:** `core`, `db`, `koa`, `@koa/router`, `@prisma/client`, `mariadb`, el relativo a `landing-pages`, `import('koa')` y `export * from '@restaurante/core/shared'`.
  - **`db` rechaza:** `koa`, `contracts`, el relativo a `landing-pages`, `@restaurante/core/catalog/price.ts`, `export * from 'koa'`, `import('koa')` y `../../core/shared/index.ts`.
  - **Se permiten:** `core`, `db` y `contracts` desde `landing-pages` (regla de transición); `@restaurante/core/identity` y `@prisma/client` desde `db`; `node:path` y `../shared/index.ts` desde `core`.
  - **Reglas anteriores:** siguen rechazando `./x.js`, el `eslint-disable` sin justificación y una global no definida en `public/js`.

### Responsive

- A 1280×906: sin desplazamiento horizontal en las 8 páginas visitadas, y el CTA de WhatsApp visible sin scroll (`top` 24 px en `/`).
- Las pruebas a 375×812 y a 1440×900 quedan **pendientes de revisión manual**:
  - `resize_window` no cambia el viewport de la ventana de Chrome (sigue en 1280);
  - la app impide cargarse en un iframe, por su política de seguridad;
  - una captura con Chrome en modo headless no da un viewport de diseño de 375 px fiable.
- Ningún CA depende de ellas: el ticket no cambia vistas, CSS ni JS, y el HTML, el CSS, el JS y las imágenes servidos son idénticos byte a byte a los de la línea base (D-4).

### Accesibilidad

- El CTA de WhatsApp de `/molotes` se alcanza con Tab (posición 7 entre los elementos enfocables), con `:focus-visible` y `outline: auto 3px` blanco.
- Un `h1` por página.
- El formulario de `/admin/login` tiene etiquetas ("Usuario" y "Contraseña") y tipos `text` y `password`.
- Los avisos usan `<dialog>`, con enlaces para navegar y botones para cerrar.
- Sin cambios respecto a la línea base (D-4).

### UX/UI

Sin cambios visuales: HTML y recursos idénticos a la línea base (D-4). Las capturas a 1280 muestran los avisos y `/admin/login` con su estilo habitual. No aplica una comparación nueva con `_stich_source_/`.

### Performance

- Mismos recursos y mismo tamaño que en la línea base (D-4).
- En el navegador: 16 peticiones en `/birria` y 18 en `/molotes`, todas con 200, y sin errores en la consola en ninguna página.

### SEO

- El `title`, la meta description, el canonical (`/` apunta a `/birria`) y `og:title` corresponden al negocio mostrado.
- Son idénticos a la línea base (D-4).

### Pendientes de revisión manual

- La vista a 375×812 y a 1440×900 en el navegador. No afecta a ningún CA porque el contenido servido es idéntico a la línea base.

### Pendientes del CI del PR (T4)

senior-fullstack debe confirmarlos antes de `READY_FOR_MERGE`:

- `deploy/ci/smoke.sh` y `ops/backup/ci/smoke.sh` en el job `despliegue`: completan CA-5.
- La construcción y las comprobaciones de las imágenes en el job `docker`: confirman CA-12.
- Los jobs `cambios`, `calidad`, `docker`, `despliegue` y `auditoria` en verde, con el PR contra `epic/arquitectura`: CA-14.
- `shellcheck` de `deploy/` y `ops/`.

### Limpieza

- Servidores de `:3100` y `:3101` detenidos, incluido el proceso padre de `node --watch`.
- Borrados: los contenedores, las imágenes `qa037-*`, las bases `restaurante_test_qa037*`, la carpeta temporal (con la copia de la línea base) y los registros.
- La pestaña del navegador está cerrada.
- `restaurante-mysql-dev-1` sigue en marcha, como estaba antes de Q2.

### Resultado final

QA_APPROVED

## Trazabilidad

| Origen | Requisito | Criterios | Action Plan |
| --- | --- | --- | --- |
| Paso 2 de §8 | RF-1, RF-2, RF-3 y RF-5 | CA-1 a CA-5 y CA-17 | 2 a 6 |
| Regla de dependencias (§4) | RF-6 | CA-6, CA-7 y CA-18 | 7 |
| Pendiente de REQ-F-036 | RF-7 | CA-8 y CA-9 | 2 y 7 |
| Decisión C (§9) | RF-4 | CA-15 y CA-16 | 1 y 2 |
| Despliegue sin cambios | RF-8 | CA-10 a CA-14 | 8 |
| Documentación | RF-9 | CA-15, CA-18 y CA-19 | 9 |

## Historial de cambios

### Versión 1

Borrador inicial del paso 2, con cuatro preguntas abiertas: la decisión C, el contenido de `contracts`, el control del bot y la regla de transición.

### Versión 2

Incorpora las respuestas del usuario del 2026-10-26:
- Zod, aplicado desde el paso 3;
- `contracts` como esqueleto;
- un módulo nuevo de control del bot en `core`;
- la regla de transición para `landing-pages`.

Quedan resueltas las contradicciones C-1, C-2 y C-3. Aprobada por el usuario el 2026-10-26.

### Revisión técnica (2026-10-26)

senior-fullstack (T1): se añaden la Revisión técnica, con cinco puntos de decisión (P-1 a P-5), y un borrador de Technical Action Plan que supone las opciones recomendadas. Estado: NEEDS_TECHNICAL_CLARIFICATION. El ticket sigue en `backlog/`.

### Aprobación del plan e inicio (2026-10-26)

Respuestas P-1 a P-5 registradas, CA-11 reescrito y Technical Action Plan aprobado por el usuario. El ticket pasa a `in-progress/` con el estado IN_PROGRESS, en la rama `feature/REQ-F-037-extraer-core-contracts-db`, creada desde `epic/arquitectura`.

### Implementación (2026-10-26)

senior-fullstack (T2): implementado el Technical Action Plan con las respuestas P-1 a P-5. typecheck, lint y test en verde (2011 + 1 *expected fail*; antes, 1980 + 1). Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### QA Action Plan (2026-10-26)

senior-qa (Q1): la implementación fue aprobada por el usuario ("Apruebo"). Se añade el QA Action Plan, centrado en la regresión, con la línea base `epic/arquitectura` y los pendientes del CI del PR identificados. Estado: NEEDS_QA_PLAN_APPROVAL.

### Aprobación del QA Action Plan (2026-10-26)

El usuario aprueba el QA Action Plan ("Lo apruebo"). senior-qa inicia Q2.

### QA, ronda 1 (2026-10-26)

senior-qa (Q2): QA Action Plan ejecutado. Todos los CA verificables en local pasan (CA-5 y CA-12 en su parte local; CA-14, pendiente del CI del PR). Sin defectos. Observaciones O-1 (condición de carrera en la importación semilla, que ya existía), O-2 y O-3. Pendientes: `smoke.sh` y el CI completo en T4, y la revisión manual a 375 y 1440. Estado: QA_APPROVED.
