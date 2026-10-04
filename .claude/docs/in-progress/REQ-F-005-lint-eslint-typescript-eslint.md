# REQ-F-005 — Lint con ESLint y typescript-eslint

## Estado

READY_FOR_MERGE

Pull Request: https://github.com/orvigas/negocio/pull/11

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Cita: "apruebo todo".

La aprobación incluye las propuestas P-1 a P-5, que pasan a ser decisiones confirmadas (D-1 a D-5).

Origen: trabajo aparte listado como fuera de alcance en REQ-F-004 (D-6). El usuario pidió (cita textual): "al finalizar crear los tickets para el trabajo aparte".

## Objetivo

Sustituir el `npm run lint` de relleno (`echo ... && exit 0`) por un lint real. Debe detectar los errores que `typecheck` no ve, como promesas sin manejar, variables o imports sin usar y `any` sin justificar. Se aplica al backend en TypeScript y al frontend en Vanilla JS.

## Decisiones confirmadas por el usuario

- D-1 (P-1). También se revisa `public/js`, con las reglas recomendadas de ESLint para JavaScript (navegador, módulos ES) y sin TypeScript.
- D-2 (P-2). El formato del código (Prettier) queda fuera de alcance.
- D-3 (P-3). Hay un script `npm run lint:fix` que aplica las correcciones automáticas.
- D-4 (P-4). El lint **no** se añade al Dockerfile. Lo hace obligatorio el CI (REQ-F-006).
- D-5 (P-5). No se admiten avisos (warnings): cada regla es error o está desactivada.

## Alcance

- Configuración de ESLint en `restaurante/`.
- Backend con información de tipos: `src/`, `tests/`, `scripts/` y la configuración de Vitest.
- `public/js` con reglas de JavaScript (D-1).
- Corrección del código existente hasta tener 0 errores.
- Scripts `lint` y `lint:fix`.
- Documentación y gobierno del proyecto:
  - `restaurante/README.md`;
  - `.claude/rules/typescript.md`;
  - `.claude/rules/javascript.md`;
  - `.claude/agents/senior-fullstack.md` (tabla de comandos y verificación final).

## Fuera de alcance

- Prettier y el formato del código (D-2).
- Lint de CSS y de HTML.
- CI (REQ-F-006).
- Lint en el Dockerfile (D-4).
- Cambios funcionales.

## Requisitos

- R-1. `npm run lint` revisa todo lo que está en alcance y no modifica archivos. Termina con 0 si no hay errores y con un código distinto de 0 si los hay.
- R-2. **Backend.** Usa las reglas recomendadas de ESLint y de typescript-eslint **con información de tipos**, apoyadas en el `tsconfig` de REQ-F-004. Como mínimo detecta promesas sin manejar y `any` explícito.
- R-3. **Excepciones.**
  - Una regla solo se desactiva en una línea concreta, con un comentario que incluya la justificación (la descripción después de `--`).
  - El `any` justificado de REQ-F-004 D-2 se expresa de esta forma.
  - No se desactivan reglas recomendadas de forma global, salvo con una justificación comentada en la configuración.
- R-4. **Frontend.** `public/js` usa las reglas recomendadas de ESLint para JavaScript con los globales del navegador (D-1).
- R-5. **Archivos ignorados.**
  - `node_modules/`;
  - los CSS generados en `public/css/`;
  - `data/`;
  - el código generado (por ejemplo, el futuro cliente de Prisma);
  - la cobertura.
- R-6. **Sin cambio de comportamiento.**
  - Las correcciones no cambian rutas, HTML, cabeceras ni logs.
  - `npm test` mantiene la misma cantidad de pruebas o más, sin `skip`, `only` ni `todo` nuevos y sin cambios en los snapshots.
  - `npm run typecheck` sigue en verde.
- R-7. **Dependencias.**
  - Solo se añaden dependencias de desarrollo (ESLint, typescript-eslint y lo mínimo necesario), cada una justificada según `.claude/rules/dependencias.md`.
  - No hay dependencias nuevas de producción y la imagen `production` no cambia.
- R-8. **Gobierno.**
  - `typescript.md` y `javascript.md` indican que hay que ejecutar `npm run lint` y cómo se justifican las excepciones.
  - `senior-fullstack.md` incluye `lint` en la tabla de comandos y en la verificación previa a terminar.
  - El README documenta `lint` y `lint:fix`.

## Historias de usuario

- HU-1. **Como** responsable técnico, **quiero** que el lint detecte errores reales, **para** no depender de la revisión manual.
- HU-2. **Como** agente o desarrollador, **quiero** que las reglas y los comandos documentados coincidan con la herramienta real, **para** no trabajar con instrucciones falsas.

## Criterios de aceptación

- CA-1. Sobre el código final, `npm run lint` termina con 0 y no muestra errores ni avisos.
- CA-2. Con una promesa sin `await` ni `catch` añadida a propósito en `src/` (cambio temporal), `npm run lint` termina con un código distinto de 0 e indica el archivo y la línea.
- CA-3. Un `any` explícito sin justificación en `src/` hace fallar el lint. Con la desactivación de la regla en esa línea y su justificación, el lint pasa.
- CA-4. Una variable sin usar en `public/js` hace fallar el lint.
- CA-5. `npm run lint` no modifica ningún archivo: `git status` queda igual que antes de ejecutarlo. `npm run lint:fix` sí aplica las correcciones automáticas.
- CA-6. El lint no analiza los CSS generados, `data/` ni `node_modules/`.
- CA-7. `npm test` y `npm run typecheck` pasan:
  - con al menos las mismas pruebas que había al cerrarse REQ-F-004;
  - sin snapshots modificados;
  - sin `skip`, `only` ni `todo` nuevos.
- CA-8. El diff no contiene desactivaciones de reglas sin justificación. Se comprueba buscando en el diff.
- CA-9. `package.json` no tiene `dependencies` nuevas, y la imagen `production` se construye y arranca igual que antes.
- CA-10. README, `typescript.md`, `javascript.md` y `senior-fullstack.md` cumplen R-8, y los comandos documentados funcionan tal como están escritos.

## Casos límite

- Pruebas `.ts` que importan módulos `.js` de `public/js` sin tipos (REQ-F-004 D-4).
- Archivos de configuración (Vitest, ESLint) que quedan dentro o fuera del `tsconfig`.
- El lint con información de tipos puede ser lento sobre todo el proyecto.

## Dependencias

- REQ-F-004 (backend en TypeScript, `tsconfig.json` y `npm run typecheck`).

## Riesgos

- Muchas correcciones mecánicas pueden introducir regresiones sutiles. Se mitiga con la suite completa y los snapshots.
- Desactivar reglas solo para que el lint pase daría una falsa seguridad. Se mitiga con R-3 y CA-8.

## Action Plan

### Objetivo

Que `npm run lint` sea una puerta de calidad real para el backend en TypeScript y el frontend en JavaScript.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Añadir las dependencias de desarrollo y la configuración de ESLint (R-2, R-4, R-5, R-7).
2. Crear los scripts `lint` y `lint:fix` (R-1, D-3).
3. Corregir los hallazgos por carpeta, con la suite en verde tras cada paso (R-6).
4. Actualizar el gobierno y el README (R-8).

### Reglas de negocio

No aplica: no hay cambios funcionales.

### UX/UI

No aplica.

### Integraciones

Ninguna.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-10.

### Dependencias

REQ-F-004.

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. Configuración.
2. `src/`.
3. `tests/` y `scripts/`.
4. `public/js`.
5. Documentación.
6. Verificación de CA-1 a CA-10.

### Resultado esperado

`npm run lint` es una puerta de calidad real y queda listo para que el CI (REQ-F-006) lo ejecute.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Lint real | R-1, R-2, R-4, R-5, D-1, D-3, D-5 | HU-1 | CA-1, CA-2, CA-4, CA-5, CA-6 |
| Excepciones justificadas | R-3 | HU-1 | CA-3, CA-8 |
| Sin regresiones | R-6, R-7, D-4 | HU-1 | CA-7, CA-9 |
| Gobierno coherente | R-8 | HU-2 | CA-10 |

No hay diseño ni UI asociados en `_stich_source_/`.

## Technical Action Plan

Revisión técnica hecha el 2026-10-04 sobre `main` (3d47f57). Los datos de esta sección salen de una prueba real: se copió `restaurante/` al scratchpad, se instalaron ahí las dependencias propuestas y se ejecutó la configuración propuesta. En el repositorio no se instaló nada.

### Objetivo técnico

Sustituir el `lint` de relleno por ESLint 10 con flat config. El backend en TypeScript se revisa con las reglas recomendadas de ESLint y de typescript-eslint **con información de tipos** (`recommendedTypeChecked` y `projectService`). `public/js` se revisa con las reglas recomendadas de JavaScript y los globales del navegador. Además se añade una regla que detecta los imports relativos con extensión `.js` que apuntan a un `.ts` (observación del QA de REQ-F-004).

### Dependencias (solo `devDependencies`, R-7)

| Paquete | Versión | Justificación |
| --- | --- | --- |
| `eslint` | `^10.12.0` | El motor de lint. Pide Node `^20.19 \|\| ^22.13 \|\| >=24` y el proyecto usa Node 24.21. Carga `eslint.config.ts` sin ningún paso extra (verificado). |
| `@eslint/js` | `^10.0.1` | Trae `js.configs.recommended`. Desde ESLint 9 es un paquete aparte. |
| `typescript-eslint` | `^8.71.0` | Parser, plugin y presets con información de tipos. Su peer `typescript` es `>=4.8.4 <6.1.0`, así que admite el `~6.0.3` del proyecto (en la prueba, `npm ls` no mostró conflictos de peers). |
| `globals` | `^17.13.0` | Da los globales de `browser` (para `public/js`) y de `node` (para el backend). Sin este paquete habría que mantener la lista a mano. |
| `@eslint-community/eslint-plugin-eslint-comments` | `^4.8.1` | Hace que R-3 se compruebe solo: con `require-description`, una desactivación sin justificación después de `--` es un error, y con `no-unlimited-disable`, `/* eslint-disable */` sin reglas también lo es. Así CA-8 deja de depender únicamente de buscar en el diff. Es un paquete mantenido por eslint-community (última versión de 2026-09), con peer `eslint ^10` y dos dependencias pequeñas. |

- No hay `dependencies` nuevas.
- `package-lock.json` pasa de 287 a 376 entradas, todas de desarrollo.
- La etapa `production` del Dockerfile usa `npm ci --omit=dev`, así que no cambia.
- `jiti` no se añade: ESLint 10 carga el `.ts` directamente.

### Archivos o componentes afectados

- Nuevos: `restaurante/eslint.config.ts`.
- Configuración: `restaurante/package.json` (scripts y devDependencies), `restaurante/package-lock.json`, `restaurante/tsconfig.json` (se añade `eslint.config.ts` a `include`).
- Correcciones en `src/`: `controllers/icons.ts`, `controllers/landing.ts`, `views/render.ts`, `middleware/admin-guard.ts`, `utils/form-body.ts`, `repositories/menu-repository.ts`, `services/admin-form.ts`, `services/menu-schema.ts`.
- Correcciones en `scripts/`: `scripts/hash-password.ts`.
- Correcciones en `tests/`: `tests/helpers.ts`.
- Documentación: `restaurante/README.md`, `.claude/rules/typescript.md`, `.claude/rules/javascript.md`, `.claude/agents/senior-fullstack.md`.
- `public/js` no cambia: hoy tiene 0 hallazgos.

### Configuración propuesta (`eslint.config.ts`)

Se escribe en TypeScript, en línea con `typescript.md`, que no admite `.js` propios fuera de `public/`. Queda dentro del `tsconfig`, así que `typecheck` también lo revisa. Bloques, en orden:

1. **Ignorados globales (R-5).**
   - Se ignoran `public/css/`, `data/`, `coverage/` y `src/generated/`.
   - `src/generated/` se reserva para el código generado, como el futuro cliente de Prisma. Si REQ-F-007 lo genera en otra ruta, ese ticket ajusta la entrada.
   - ESLint ya ignora `node_modules/` por defecto.
   - ESLint 10 no lee `.gitignore`, por eso la lista es explícita.
2. **`linterOptions`.**
   - `reportUnusedDisableDirectives: 'error'`: una desactivación que ya no hace falta es un error.
   - `reportUnusedInlineConfigs: 'error'`.
3. **Comentarios de desactivación.** Se usa `comments.recommended`, más `require-description` y `no-unlimited-disable`, todo como error.
4. **`**/*.ts` (backend, pruebas, scripts y configuraciones).**
   - `extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked]`.
   - `parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }`.
   - `globals.node`.
   - Si un `.ts` queda fuera del `tsconfig`, ESLint da un error de parseo. Eso protege que `typecheck` y `lint` revisen siempre los mismos archivos.
5. **Detección de `./x.js` que apunta a un `.ts`** (observación del QA de REQ-F-004). Ver la subsección siguiente.
6. **`tests/**/*.ts`.** Excepción E-2.
7. **`public/js/**/*.js`.**
   - `extends: [js.configs.recommended]`, `sourceType: 'module'` y `globals.browser`.
   - No usa información de tipos (D-1).

Comprobado con `--print-config`: ninguna regla queda como `warn`, ni en `.ts` ni en `public/js` (D-5). Aun así, el script usa `--max-warnings 0` como protección.

### Detección de imports `.js` que apuntan a `.ts`

Es viable con reglas propias de ESLint, sin plugins de resolución:

- **Imports y re-exports estáticos** (`import … from`, `export … from`, `export * from`). Se usa `no-restricted-imports` con el patrón `regex: ^\.{1,2}/(?!(?:\.\./)*public/js/).*\.js$`.
- **`import()` dinámico.** `no-restricted-imports` no lo cubre, así que se usa `no-restricted-syntax` con el selector `ImportExpression > Literal.source[value=/^\.{1,2}\/.*\.js$/]:not([value=/public\/js\//])`.
- **Mensaje de error, en español:** «Los imports relativos del backend llevan la extensión .ts: Node no resuelve ./x.js hacia x.ts (ERR_MODULE_NOT_FOUND). Solo public/js se importa con .js.»
- **Excepción legítima.** Los imports de `public/js/...js` desde las pruebas (REQ-F-004 D-4) quedan permitidos.

Verificado en el scratchpad:

| Import | Resultado |
| --- | --- |
| `import … from './config/env.js'` | Error |
| `export … from './utils/logger.js'` | Error |
| `export * from './utils/datetime.js'` | Error |
| `import('./utils/errors.js')` | Error |
| `import('../helpers.js')` | Error |
| `import … from '../../public/js/modules/promo-form.js'` | Permitido |
| `import('../../public/js/…js')` | Permitido |
| Imports con `.ts` | Permitido |

Límites y alternativas:

- Detecta el patrón (un relativo `.js` fuera de `public/js`), no si el archivo existe.
- En este backend no hay `.js` propios (`typescript.md`), así que el patrón equivale al error.
- El import sin extensión (`./x`) ya lo rechaza `tsc` con NodeNext (TS2835), por eso no se añade una regla para ese caso.
- Se descartó `eslint-plugin-import-x` con `no-unresolved`. Comprueba que el archivo existe, pero añade más dependencias y la configuración de un resolver, para el mismo resultado en este proyecto.

### Excepciones propuestas (R-3: una justificación comentada en la configuración por cada una)

**E-1. `@typescript-eslint/require-await: 'off'` en todo el proyecto.**

Hoy hay 13 hallazgos de esta regla:

| Dónde | Cuántos |
| --- | --- |
| `memory-menu-repository.ts` | 5 |
| `menu-repository.ts` | 2 |
| `controllers/admin.ts` | 2 |
| `tests/` | 4 |

- En todos los casos el `async` sin `await` es intencional: la función cumple un contrato asíncrono (la interfaz del repositorio, el `next` de Koa o los dobles de prueba).
- Además, el `async` convierte un `throw` síncrono (p. ej. `ensureReady`, `JSON.parse`) en una promesa rechazada.
- Quitar `async` cambiaría ese comportamiento, y R-6 no lo permite.
- Los riesgos reales con promesas siguen cubiertos por `no-floating-promises`, `no-misused-promises` y `await-thenable`, que permanecen activas.
- Alternativa: mantener la regla y añadir 13 desactivaciones en línea, cada una con su justificación. Es más ruido y la justificación sería la misma en todas.

**E-2. Se desactivan `@typescript-eslint/no-unsafe-assignment`, `-member-access`, `-argument`, `-call` y `-return`, solo en `tests/**`.**

- Son 143 de los 168 hallazgos iniciales.
- Su origen son valores `any` por diseño:
  - `res.body` de Supertest, que está tipado como `any`;
  - `JSON.parse` sobre los archivos que escriben las pruebas;
  - `CorruptibleData`, el `any` justificado de REQ-F-004 D-2.
- Las propias aserciones de las pruebas comprueban la forma de esos datos.
- `no-explicit-any` **sigue activa** en las pruebas: no se puede añadir un `any` nuevo sin justificarlo.
- En `src/` y `scripts/` estas reglas siguen activas.
- Alternativa: tipar unas 140 expresiones con `as` en las pruebas. Es mucho cambio mecánico y no aporta seguridad real: es otra forma de afirmar el tipo.

Fuera de E-1 y E-2 no se desactiva ninguna regla recomendada de forma global.

### Estimación de correcciones (39 hallazgos tras E-1 y E-2)

Todas se corrigen sin cambiar el comportamiento.

| Regla | Hallazgos | Archivos | Corrección |
| --- | --- | --- | --- |
| `unbound-method` | 13 (2 en `src/routes/index.ts` y 11 en `tests/unit/render.test.ts`) | `src/views/render.ts`, `src/controllers/icons.ts` | Solo cambian los tipos. En las interfaces `Renderer` e `IconsController`, las firmas de método pasan a ser propiedades función (`render: (…) => SafeHtml`). Las implementaciones no usan `this`. Probado: `tsc` en verde y 0 hallazgos. |
| `require-await` | 13 | — | Los cubre E-1. |
| `restrict-template-expressions` | 6 | `controllers/icons.ts`, `controllers/landing.ts`, `repositories/menu-repository.ts` (2), `services/admin-form.ts`, `services/menu-schema.ts` | Cambiar `${x}` por `${String(x)}` en los mensajes de `TypeError`/`Error` de las ramas imposibles. El texto que resulta es el mismo. |
| `no-unsafe-return` (`Promise<any>` del `Next` de Koa) | 3 | `src/middleware/admin-guard.ts` | Cambiar `return next();` por `await next(); return;`. Para koa-compose es equivalente. |
| `no-unsafe-member-access` y `no-unsafe-argument` | 2 | `src/utils/form-body.ts` | Tipar el iterable de `ctx.req` como `AsyncIterable<Buffer>`, con un comentario que lo justifique: sin `setEncoding`, el stream de `http` emite `Buffer`. |
| `restrict-plus-operands` | 1 | `scripts/hash-password.ts` | Anotar `chunk: string` en el listener de `data`. Tras `setEncoding('utf8')`, cada fragmento es un `string`. |
| `no-explicit-any` | 1 | `tests/helpers.ts` | Convertir la justificación actual de `CorruptibleData` en `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <justificación>`. |

- `public/js` tiene 0 hallazgos con `js.configs.recommended`.
- No hay hallazgos de `no-unused-vars` ni de `no-floating-promises` en el código actual.

### Scripts (`package.json`)

- `"lint": "eslint . --max-warnings 0"`. Sin `--cache`, para no escribir `.eslintcache` (CA-5).
- `"lint:fix": "eslint . --fix --max-warnings 0"` (D-3).

### Rendimiento

En la prueba, el lint completo con información de tipos tardó unos **2,8 s de reloj** (5,3 s de CPU) sobre 25 archivos de pruebas, todo `src/`, `scripts/` y `public/js`. No hace falta caché ni dividir el lint.

### Contenido / configuración

- `tsconfig.json`: se añade `"eslint.config.ts"` a `include`.
- No hay variables de entorno nuevas.
- El Dockerfile no cambia (D-4). La etapa `build` ejecuta `typecheck`, que ahora también revisa `eslint.config.ts`. Funciona porque la etapa `deps` instala todas las dependencias, incluidas las de desarrollo.

### Documentación (R-8)

- **README:** la fila de `lint` y una nueva de `lint:fix` en la tabla de comandos, más una nota sobre las excepciones (`-- justificación`).
- **`typescript.md`:**
  - en "Antes de terminar", `npm run lint`;
  - en "Tipos", el formato del `any` justificado (`eslint-disable-next-line … -- motivo`);
  - en "Imports", la regla que rechaza `./x.js` hacia `.ts`.
- **`javascript.md`:** `npm run lint` y el formato de las excepciones.
- **`senior-fullstack.md`:** en la tabla de comandos, `lint` y `lint:fix` sustituyen a la nota de "placeholder". En la validación de T2/T3 y en "Modo directo", `npm run lint` pasa a ser obligatorio, con salida 0.

### Testing y verificación

- **Antes de empezar:** registrar el número de archivos y de pruebas de `npm test`. Al cerrar REQ-F-004 eran 25 archivos y 468 pruebas.
- **Por cada carpeta corregida** (`src/`, `scripts/`, `tests/`): ejecutar `npm run typecheck` y `npm test`, con los snapshots sin cambios.
- **CA-1:** `npm run lint` termina con 0 y sin salida de errores ni avisos.
- **CA-2, CA-3 y CA-4** se prueban con cambios temporales que se revierten, y se registra la salida real de cada uno:
  - una promesa flotante en `src/` da `no-floating-promises`, con el archivo y la línea;
  - un `any` sin justificar da error;
  - el mismo `any` con su desactivación justificada pasa;
  - una variable sin usar en `public/js` da error.
  - Además: un import `./x.js` en `src/` da error, y una desactivación sin `--` da error.
- **CA-5:** comparar `git status --porcelain` antes y después de `npm run lint`. `lint:fix` se prueba con un caso que se arregla solo, por ejemplo `prefer-const`, y luego se revierte.
- **CA-6:** colocar un `.js` con errores en `public/css/` y en `data/` (los dos están en `.gitignore`), comprobar que el lint no lo reporta y borrarlo.
- **CA-7:** el mismo número de pruebas o más, `git diff --stat tests/snapshots` vacío y una búsqueda de `.skip|.only|.todo` en el diff.
- **CA-8:** buscar en el diff `eslint-disable` sin `--`. Lo cubre también `require-description`.
- **CA-9:**
  - `package.json` no tiene `dependencies` nuevas;
  - `docker build --target production` y `docker compose run --rm test` funcionan;
  - el contenedor de producción arranca y su healthcheck responde.
- **CA-10:** ejecutar tal cual los comandos documentados.

### Seguridad

- Las dependencias nuevas son solo de desarrollo y la imagen de producción no las incluye.
- Las correcciones no tocan CSP, cabeceras, sesiones, CSRF ni logs.
- En `form-body.ts` se conservan el límite de tamaño y los errores 413.

### Riesgos técnicos

- **Cambio en las interfaces `Renderer` e `IconsController`** (de métodos a propiedades función). Las comprobaciones de tipos se vuelven más estrictas (contravarianza de parámetros). Ya está probado sin errores, y no hay cambio en tiempo de ejecución.
- **`await next(); return;` en `admin-guard.ts`.** Es equivalente para Koa. Lo cubren las pruebas de integración de `/admin`.
- **Futuras versiones de typescript-eslint.** Al subir TypeScript a 6.1 o más, habrá que esperar a que typescript-eslint amplíe su peer. El `~6.0.3` actual lo evita.
- **E-1 y E-2 reducen la cobertura de reglas.** Quedan documentadas en la configuración y en este ticket. Se pueden revertir en un ticket posterior.

### Orden de implementación

1. Rama `feature/REQ-F-005-lint-eslint-typescript-eslint` y movimiento del ticket a `in-progress/`.
2. Instalación de las dependencias, `eslint.config.ts`, `tsconfig.json` y los scripts.
3. Correcciones en `src/`; después, `typecheck` y `test`.
4. `scripts/` y `tests/`; después, `typecheck` y `test`.
5. `public/js` (sin cambios previstos).
6. Documentación.
7. Verificación de CA-1 a CA-10, Docker incluido.

### Criterios de finalización

- `npm run lint`, `npm run typecheck` y `npm test` terminan con 0.
- El número de pruebas es igual o mayor y los snapshots no cambian.
- CA-1 a CA-10 están verificados con su salida real en `## Implementation Result`.
- No hay cambios fuera del alcance.

## Implementation Result

El usuario aprobó el Technical Action Plan, con E-1, E-2 y la dependencia `@eslint-community/eslint-plugin-eslint-comments` (cita: "Apruebo el plan"). Implementado el 2026-10-04. No hay commit todavía.

### Rama

`feature/REQ-F-005-lint-eslint-typescript-eslint`, creada desde `main` (3d47f57, igual que `origin/main`). El ticket se movió con `git mv` de `backlog/` a `in-progress/`.

### Cambios realizados

**Dependencias de desarrollo:**
- `eslint` ^10.12.0
- `@eslint/js` ^10.0.1
- `typescript-eslint` ^8.71.0
- `globals` ^17.13.0
- `@eslint-community/eslint-plugin-eslint-comments` ^4.8.1

**`eslint.config.ts` (nuevo), según el plan:**
- ignorados explícitos;
- `reportUnusedDisableDirectives` y `reportUnusedInlineConfigs` como error;
- reglas de comentarios (`require-description`, `no-unlimited-disable`);
- `recommendedTypeChecked` con `projectService` para `**/*.ts`;
- `no-restricted-imports` y `no-restricted-syntax` contra `./x.js` fuera de `public/js`;
- E-1 y E-2, cada una con su justificación comentada;
- `public/js` con `js.configs.recommended` y `globals.browser`.

**Configuración:**
- `package.json`: `lint` = `eslint . --max-warnings 0` y `lint:fix` = `eslint . --fix --max-warnings 0`.
- `tsconfig.json`: se añade `eslint.config.ts` a `include`.

**Correcciones sin cambio de comportamiento (26):**

| Regla | Hallazgos | Corrección |
| --- | --- | --- |
| `unbound-method` | 13 | En las interfaces `Renderer` (`src/views/render.ts`) e `IconsController` (`src/controllers/icons.ts`), las firmas de método pasan a ser propiedades función. Solo cambian los tipos. |
| `restrict-template-expressions` | 6 | `${String(x)}` en los mensajes de error de las ramas imposibles: `icons.ts`, `landing.ts`, `menu-repository.ts` (2), `admin-form.ts` y `menu-schema.ts`. |
| `no-unsafe-return` | 3 | En `src/middleware/admin-guard.ts`, `return next()` pasa a `await next(); return …`. En `requireSession` se devuelve `undefined`: los callbacks `next` del controlador no devuelven nada y Koa ignora el valor. |
| `no-unsafe-*` | 2 | En `src/utils/form-body.ts`, `ctx.req as AsyncIterable<Buffer>`, con un comentario que lo justifica. |
| `restrict-plus-operands` | 1 | En `scripts/hash-password.ts`, `chunk: string` en el listener de `data`, con un comentario que lo justifica. |
| `no-explicit-any` | 1 | En `tests/helpers.ts`, la justificación de `CorruptibleData` pasa a ser `eslint-disable-next-line … -- <justificación>`. |

**Documentación:**
- `restaurante/README.md`: las filas de `lint` y `lint:fix`, una nota sobre las excepciones y `eslint.config.ts` en el árbol de archivos.
- `.claude/rules/typescript.md`: la sección "Lint", el formato del `any` justificado, la regla de imports `.js` y `lint` en "Antes de terminar".
- `.claude/rules/javascript.md`: la sección "Lint".
- `.claude/agents/senior-fullstack.md`:
  - en la tabla de comandos, `lint` y `lint:fix` en lugar del placeholder;
  - `lint` en "Modo directo" y en la validación de T2/T3;
  - `eslint.config.ts` en la estructura.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | `npm run lint` → salida 0, sin errores ni avisos. |
| CA-2 | PASS | Se añadió temporalmente `Promise.resolve(1);` en `src/app.ts`. Resultado: `src/app.ts 88:3 error … @typescript-eslint/no-floating-promises`, salida 1. Revertido. |
| CA-3 | PASS | `export const zzAny: any = 1;` en `src/app.ts` da `87:21 error Unexpected any … no-explicit-any`, salida 1. Con `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- prueba temporal de CA-3` la salida es 0. Revertido. |
| CA-4 | PASS | `const zzUnused = 1;` en `public/js/molotes/main.js` da `12:7 error 'zzUnused' is assigned a value but never used no-unused-vars`, salida 1. Revertido. |
| CA-5 | PASS | `git status --porcelain` es idéntico antes y después de `npm run lint`. Con un `src/zz-fix.ts` temporal (`let` que no se reasigna): `lint` da `prefer-const` y salida 1; `lint:fix` lo convierte en `const` y sale con 0. Archivo borrado. |
| CA-6 | PASS | Se colocaron `zz-bad.js` (con error de sintaxis) y `zz-bad.ts` (con `any`) en `public/css/`, `data/` y `node_modules/`. `npm run lint` salió con 0, sin reportarlos. Con la ruta directa, ESLint solo avisa de que el archivo está ignorado. Archivos borrados. |
| CA-7 | PASS | `npm test`: 25 archivos y 468 pruebas, igual que al cerrar REQ-F-004. `git diff --stat restaurante/tests/snapshots` está vacío y no hay `.skip`, `.only` ni `.todo` añadidos en el diff. `npm run typecheck` sale con 0. |
| CA-8 | PASS | No hay ningún `eslint-disable` sin `-- ` en el diff ni en `eslint.config.ts`. Además, se probó a propósito una desactivación sin justificación: da `require-description`, salida 1. Revertido. |
| CA-9 | PASS | Detalle debajo de la tabla. |
| CA-10 | PASS | `npm run lint`, `npm run lint:fix`, `npm run typecheck` y `npm test` funcionan tal como están documentados. Los cuatro documentos cumplen R-8. |

Detalle de CA-9:
- `package.json` no tiene `dependencies` nuevas.
- Los paquetes de producción del lockfile son idénticos a los de `main` (55).
- `docker build --target production` funciona.
- En la imagen no hay paquetes `eslint` ni `typescript`.
- El contenedor arranca con `WHATSAPP_MOLOTES`, `WHATSAPP_BIRRIA` y `DATA_DIR` ficticios: `GET /` → 200, healthcheck `healthy`.
- `docker compose run --rm test` → 25 archivos y 468 pruebas superadas. La etapa `build`, que ejecuta `typecheck` y ahora incluye `eslint.config.ts`, también funciona.

Prueba adicional (observación del QA de REQ-F-004): un `export … from './utils/logger.js'` en `src/app.ts` da error de `no-restricted-imports` con el mensaje en español, salida 1. Revertido.

### Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Salida 0. |
| `npm run lint` | Salida 0, sin errores ni avisos. Tarda unos 3 s. |
| `npm test` (`CI=true`) | 25 archivos, 468 pruebas superadas. |
| `npm run build:css` | No se ejecutó: no se tocaron estilos, plantillas ni clases. |
| `echo … \| npm run admin:hash-password` | Imprime el hash `scrypt$…`. |
| `node -e "import('./src/app.ts')"` | Sin `ERR_MODULE_NOT_FOUND`. |
| `docker build --target production`, ejecución del contenedor y `docker compose run --rm test` | Ver CA-9. |
| `git status` tras las pruebas temporales | Idéntico al de antes. |

### Archivos afectados

- Nuevo: `restaurante/eslint.config.ts`.
- Configuración: `restaurante/package.json`, `restaurante/package-lock.json`, `restaurante/tsconfig.json`.
- Backend:
  - `restaurante/src/views/render.ts`
  - `restaurante/src/controllers/icons.ts`
  - `restaurante/src/controllers/landing.ts`
  - `restaurante/src/middleware/admin-guard.ts`
  - `restaurante/src/utils/form-body.ts`
  - `restaurante/src/repositories/menu-repository.ts`
  - `restaurante/src/services/admin-form.ts`
  - `restaurante/src/services/menu-schema.ts`
- Scripts y pruebas: `restaurante/scripts/hash-password.ts`, `restaurante/tests/helpers.ts`.
- Documentación: `restaurante/README.md`, `.claude/rules/typescript.md`, `.claude/rules/javascript.md`, `.claude/agents/senior-fullstack.md` y `.claude/agents/senior-qa.md` (ampliación aprobada por el usuario).
- Ticket: este archivo (movido a `in-progress/`).

### Ampliación de alcance aprobada por el usuario

El usuario aprobó ampliar el alcance (cita: "apruebo el plan de QA e incluye la corrección de senior-qa.md"):

- **Origen.** QA detectó que `.claude/agents/senior-qa.md`, en "Herramientas de prueba existentes", seguía describiendo `npm run lint` como un placeholder.
- **Cambio.** Solo esa línea: ahora describe el lint real (ESLint con typescript-eslint e información de tipos, más las reglas de JavaScript para `public/js`), que debe terminar con 0, no modifica archivos y cuenta como evidencia.
- **Coherencia con `senior-fullstack.md`.** La línea añade que QA no ejecuta `npm run lint:fix`, porque modifica archivos.
- No se cambió nada más del archivo.

### Riesgos o pendientes

- **Desviación menor respecto al plan.** En `requireSession` se escribió `await next(); return undefined;` en lugar de `return;`, por coherencia con la otra rama de la función, que ya devuelve `undefined`. Es equivalente.
- **`String(x)` frente a `${x}`.** El texto es el mismo para cualquier valor salvo un `Symbol`: antes la plantilla lanzaba un `TypeError` propio; ahora se forma el mensaje. Esas ramas son imposibles por diseño.
- **Lockfile.** `package-lock.json` crece con unas 88 entradas, todas de desarrollo.
- **Fuera de este ticket.** El lint no está en el Dockerfile (D-4); el CI lo hará obligatorio en REQ-F-006.

## QA Action Plan

Preparado por senior-qa el 2026-10-04, tras la aprobación de la implementación por el usuario (cita: "Apruebo la implementación"). Todavía no se ha ejecutado ninguna prueba definitiva.

### Objetivo

Confirmar con evidencia propia (no la del Implementation Result) que `npm run lint` es una puerta de calidad real: detecta lo que debe, ignora lo que debe y no modifica archivos; que las 26 correcciones no cambian el comportamiento observable respecto de `main`; y que producción y Docker no cambian.

### Requisito bajo prueba

R-1 a R-8 y D-1 a D-5 de este ticket, con las excepciones aprobadas E-1 (`require-await` desactivada globalmente) y E-2 (`no-unsafe-*` desactivadas solo en `tests/**`).

### Criterios de aceptación

| CA | Pruebas que lo cubren |
| --- | --- |
| CA-1 | F-1 |
| CA-2 | N-1 |
| CA-3 | N-2, N-3 |
| CA-4 | N-4 |
| CA-5 | F-2, F-3 |
| CA-6 | N-6 |
| CA-7 | R-1, R-2, R-3 |
| CA-8 | N-5, G-1 |
| CA-9 | D-1 a D-4 |
| CA-10 | G-2, G-3 |

### Riesgos identificados

1. **Cambio de `return next()` a `await next()` en `admin-guard.ts`** (`adminGate` y `requireSession`). `controllers/admin.ts` hace `return requireSession(...)`; el valor resuelto pasa a ser siempre `undefined`. Riesgo bajo, pero toca la frontera de seguridad de `/admin` (cabeceras `no-store`/`noindex`, 503 sin HTTPS, redirecciones 303 sin sesión, propagación de errores del `next`).
2. **Interfaces `Renderer` e `IconsController`** pasan de métodos a propiedades función. Solo tipos; CodeGraph muestra 30 consumidores de `Renderer` (landing, admin, rutas, vistas). Se valida con `typecheck` y con la comparación HTTP con `main`.
3. **`form-body.ts`** con `ctx.req as AsyncIterable<Buffer>`: debe conservar el límite y el 413.
4. **`String(x)` en mensajes de error** de ramas imposibles: el texto debe ser igual.
5. **Falsa seguridad del lint**: reglas desactivadas de más, ignorados demasiado amplios (que oculten `src/`), o archivos `.ts` que queden fuera del análisis.
6. **Regex de imports `.js`**: falsos positivos (bloquear imports legítimos de `public/js`) o falsos negativos.
7. **`eslint.config.ts` dentro del `tsconfig`**: la etapa `build` del Dockerfile ejecuta `typecheck` sobre él; debe seguir funcionando.

### Pruebas funcionales

- **F-1 (CA-1).** `npm run lint`; registrar código de salida y salida completa (debe ser vacía de errores y avisos). Además `npx eslint . --format json` para contar archivos analizados y confirmar que incluye `src/`, `tests/`, `scripts/`, `vitest.config.ts`, `eslint.config.ts` y los 4 archivos de `public/js` (R-1, D-1).
- **F-2 (CA-5, no modifica).** `git status --porcelain` y `git diff | shasum` antes y después de `npm run lint`; también comprobar que no aparece `.eslintcache`.
- **F-3 (CA-5, `lint:fix`).** Un archivo temporal con un caso autocorregible (`prefer-const`): `lint` falla, `lint:fix` lo corrige y sale con 0; luego se borra.
- **F-4 (D-5).** `npx eslint --print-config` sobre un `.ts` de `src/`, uno de `tests/` y uno de `public/js`: ninguna regla en `warn` (severidad 1); confirmar que `no-floating-promises`, `no-misused-promises`, `await-thenable` y `no-explicit-any` siguen en error en las tres zonas que aplican y que E-2 solo se aplica en `tests/`.

### Pruebas negativas y casos límite

Todas con cambios temporales que se revierten. Se ejecutan preferentemente en una copia de `restaurante/` en el scratchpad (con `node_modules` enlazado) para no tocar el árbol de trabajo; si la copia no reproduce el resultado del repositorio (F-1), se hacen en el repositorio y se verifica con F-2 que todo queda igual.

- **N-1 (CA-2).** Promesa flotante en `src/` → `no-floating-promises`, archivo y línea, salida ≠ 0.
- **N-2 (CA-3).** `any` explícito sin justificar en `src/` → `no-explicit-any`, salida ≠ 0. También en `tests/` (E-2 no debe cubrirlo).
- **N-3 (CA-3).** El mismo `any` con `eslint-disable-next-line @typescript-eslint/no-explicit-any -- motivo` → salida 0.
- **N-4 (CA-4).** Variable sin usar en `public/js` → `no-unused-vars`, salida ≠ 0. Además, un global de Node (p. ej. `process`) en `public/js` → `no-undef` (confirma globales de navegador, D-1).
- **N-5 (CA-8, R-3).** Desactivación sin `--` → `require-description`; `/* eslint-disable */` sin reglas → `no-unlimited-disable`; desactivación innecesaria → error por `reportUnusedDisableDirectives`.
- **N-6 (CA-6, R-5).** Archivos con errores en `public/css/`, `data/`, `coverage/`, `src/generated/` y `node_modules/` → `npm run lint` sale con 0 y no los reporta. Control positivo: el mismo archivo en `src/` sí falla (el ignorado no es demasiado amplio).
- **N-7 (imports).** `import … from './x.js'`, `export … from`, `export * from` e `import('./x.js')` en `src/` → error con el mensaje en español. Control: `import … from '../../public/js/modules/promo-form.js'` desde `tests/` y los imports `.ts` pasan.
- **N-8 (casos límite del ticket).** Un `.ts` fuera del `tsconfig` (p. ej. en la raíz no incluida) → error de parseo, como documenta la configuración. Medir el tiempo de `npm run lint` (`time`) para el caso de rendimiento.
- **N-9.** `async` sin `await` en `src/` no da error (E-1 vigente) y una promesa mal usada en un `if` sigue fallando con `no-misused-promises`.

### Pruebas de regresión

- **R-1 (CA-7).** `npm test` completo: número de archivos y pruebas ≥ 25 / 468; registrar salida.
- **R-2 (CA-7).** `npm run typecheck` → 0.
- **R-3 (CA-7).** `git diff main --stat -- restaurante/tests/snapshots` vacío; búsqueda de `.skip`, `.only`, `.todo`, `it.skip`, `describe.only` en las líneas añadidas de `git diff main -- restaurante/tests`.
- **R-4 (R-6, comparación con `main`).** Siguiendo el método de REQ-F-004: copia de `main` con `git archive` en el scratchpad y un script que monta `createApp` de `main` y de la rama con la misma fecha simulada (un viernes y un sábado) y compara código HTTP, cuerpo y cabeceras (excluyendo `date` y `last-modified`) de: `/`, `/molotes`, `/birria`, 404, CSS, JS, iconos y manifests; y en `/admin`: `/admin`, `/admin/login`, `/admin/molotes` sin sesión (303 con `next`), POST sin sesión (303 con `expirada=1`), `/admin/molotes` con sesión válida (200), un POST de guardado con sesión y CSRF válidos, un formulario mayor que el límite (413), y `/admin` sin HTTPS cuando la configuración lo exige (503). Resultado esperado: idéntico.
- **R-5.** Mensajes de error de `String(x)`: comparar con `main` el texto de `TypeError` al llamar `createLandingController` y `iconsController.manifest` con un negocio desconocido (p. ej. `'x'`, `undefined`, `42`).
- **R-6.** `echo secreto | npm run admin:hash-password` en `main` y en la rama: ambos imprimen un hash `scrypt$…` y salen con 0 (`hash-password.ts`).
- **R-7.** `git diff main --stat -- restaurante/public restaurante/src/styles restaurante/src/views/**/*.html` vacío (sin cambios de frontend), y `git diff main --name-only` limitado a los archivos declarados en el Technical Action Plan (sin cambios fuera de alcance).

### Pruebas de integración / Docker y dependencias (CA-9, R-7)

- **D-1.** `git diff main -- restaurante/package.json`: `dependencies` sin cambios; solo 5 `devDependencies` nuevas, las aprobadas.
- **D-2.** Comparar el conjunto de paquetes no-dev del `package-lock.json` en `main` y en la rama (entradas sin `"dev": true`): idéntico.
- **D-3.** `docker build --target production` y comprobar que la imagen no contiene `eslint`, `typescript-eslint` ni `typescript` en `node_modules`; arrancar el contenedor con variables ficticias y comprobar `GET /` 200 y healthcheck `healthy`. Comparar el listado de `node_modules` de la imagen con el de `main` si el tiempo de build lo permite.
- **D-4.** `docker compose run --rm test` (incluye la etapa `build` con `typecheck` sobre `eslint.config.ts`) → todas las pruebas en verde.

Si Docker no está disponible en el momento de la ejecución, D-3 y D-4 se registran como bloqueo de entorno y se devolverá `NEEDS_USER_DECISION`, ya que CA-9 depende de ellas.

### Gobierno y documentación (CA-8, CA-10)

- **G-1 (CA-8).** Buscar `eslint-disable` en todo el diff y en todo `src/`, `tests/`, `scripts/` y `public/js`: cada aparición con `-- <motivo>`. Revisar que en `eslint.config.ts` solo E-1 y E-2 desactivan reglas recomendadas, cada una con su justificación comentada.
- **G-2 (CA-10).** Revisar `README.md`, `.claude/rules/typescript.md`, `.claude/rules/javascript.md` y `.claude/agents/senior-fullstack.md` contra R-8 punto por punto, y que no queden referencias a "placeholder" o "lint no configurado" en `.claude/` ni en el README (incluido `senior-qa.md`, que aún lo menciona: se registrará como observación si está fuera del alcance R-8, no como defecto).
- **G-3 (CA-10).** Ejecutar tal cual, desde `restaurante/`, los comandos documentados: `npm run lint`, `npm run lint:fix` (en árbol limpio, verificando que no produce diff), `npm run typecheck`, `npm test`.

### Pruebas de performance

- Tiempo de `npm run lint` con `time` (referencia del plan: ~3 s). Solo informativo; no se convierte en defecto salvo que sea desproporcionado.

### Pruebas no aplicables

- **Responsive, accesibilidad, UX/UI frente a Stitch, SEO y WhatsApp:** no hay cambios en `public/`, estilos, plantillas ni contenido (se confirma con R-7). La igualdad byte a byte del HTML con `main` (R-4) cubre la regresión de SEO, CTA y estructura de ambas landings.
- **Navegador (Claude in Chrome):** no aporta evidencia adicional, porque el HTML, CSS y JS servidos se comparan byte a byte con `main` en R-4. No se usará salvo que R-4 muestre diferencias.

### Pruebas automatizadas

- Existentes: toda la suite (`npm test`), sin modificaciones.
- Nuevas: ninguna en `restaurante/tests/`. Las sondas del lint (N-1 a N-9) son cambios temporales que se revierten, y la comparación con `main` (R-4, R-5) es un script temporal en el scratchpad, no versionado.

### Evidencia requerida

- Salida y código de salida de cada comando (lint, lint:fix, typecheck, test, eslint sobre cada sonda).
- Hash/diff de `git status --porcelain` y `git diff` antes y después de las pruebas.
- Resultado de la comparación con `main` (rutas, códigos, hashes) y de los mensajes de error.
- Salidas de Docker (build, inspección de `node_modules`, healthcheck, compose test).

### Criterios de aprobación

- CA-1 a CA-10 en PASS con evidencia propia.
- R-4 y R-5 idénticos a `main` (cualquier diferencia no explicada es defecto).
- `npm test`, `npm run typecheck` y `npm run lint` con salida 0.
- Árbol de trabajo igual al inicial al terminar (sin restos de sondas).
- Sin defectos `BLOCKER`/`CRITICAL`; los `MAJOR`, si los hay, requieren decisión del usuario.

## QA Report

### Ronda

1 (2026-10-04). El usuario aprobó el QA Action Plan con la ampliación de `senior-qa.md` (cita: "apruebo el plan de QA e incluye la corrección de senior-qa.md").

### Pruebas ejecutadas

Rama `feature/REQ-F-005-lint-eslint-typescript-eslint`, Node v24.21.0. Las sondas se ejecutaron en una copia de `restaurante/` en el scratchpad, con `node_modules` enlazado. Antes de usar la copia comprobé que su `npm run lint` da 0, igual que el repositorio, y al terminar comprobé con `diff -rq` que sigue siendo idéntica al repositorio. En el repositorio solo se ejecutaron `lint`, `typecheck`, `test`, `admin:hash-password` y Docker.

| Prueba | Comando o acción | Resultado real |
| --- | --- | --- |
| F-1 | `time npm run lint` | Salida 0, sin errores ni avisos. 3,1 s de reloj. |
| F-1 | `npx eslint . --format json` | 77 archivos analizados: `src` 42, `tests` 28, `scripts` 1, `public/js` 4, `vitest.config.ts` y `eslint.config.ts`. Son los 75 `.ts`/`.js` versionados de esas zonas más `vitest.config.ts` y `eslint.config.ts`. 0 errores y 0 avisos. |
| F-2 | `git status --porcelain` y `git diff \| shasum`, antes y después | Idénticos. No se crea `.eslintcache`. |
| F-3 | `src/zz-fix.ts` con un `let` que no se reasigna (copia) | `lint`: `2:7 error … prefer-const`, salida 1. `lint:fix` sale con 0 y lo convierte en `const`. Después, `lint` da 0. |
| F-4 | `npx eslint --print-config` en `src/app.ts`, `tests/helpers.ts` y `public/js/molotes/main.js` | Hay 0 reglas en `warn` en los tres. `no-floating-promises`, `no-misused-promises`, `await-thenable` y `no-explicit-any` dan error en `src` y `tests`. `no-unsafe-*` da error en `src` y está desactivada solo en `tests` (E-2). `require-await` está desactivada (E-1). En `public/js`, `no-unused-vars` y `no-undef` dan error. `reportUnusedDisableDirectives` y `reportUnusedInlineConfigs` dan error. |
| N-1 | `Promise.resolve(1);` en `src/app.ts` | `src/app.ts 87:1 error … @typescript-eslint/no-floating-promises`, salida 1. |
| N-2 | `export const zzAny: any = 1;` en `src/app.ts` y en `tests/helpers.ts` | `87:21` y `54:21 error Unexpected any … no-explicit-any`, salida 1. E-2 no lo cubre. |
| N-3 | El mismo `any` con `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- prueba QA CA-3` | Salida 0. |
| N-4 | `const zzUnused = 1;` en `public/js/molotes/main.js` | `12:7 error 'zzUnused' is assigned a value but never used no-unused-vars`, salida 1. |
| N-4b | `console.log(process.env);` en `public/js` | `12:13 error 'process' is not defined no-undef`, salida 1: rige el entorno del navegador. |
| N-5a | Desactivación sin `--` | `require-description`, salida 1. |
| N-5b | `/* eslint-disable */` | `no-unlimited-disable`, `require-description` y `disable-enable-pair`, salida 1. |
| N-5c | Desactivación innecesaria | `Unused eslint-disable directive`, salida 1. |
| N-6 | `zz-bad.js` (sintaxis inválida) y `zz-bad.ts` (`any`) en `public/css/`, `data/`, `coverage/`, `src/generated/` y `node_modules/` | Salida 0, sin reportarlos. |
| N-6 (control) | Los mismos archivos en `src/` | `.js`: `Parsing error`. `.ts`: `no-explicit-any`. Salida 1 en los dos. |
| N-7 | En `src/app.ts`: `import … from './config/env.js'`, `export { … } from './utils/logger.js'`, `export * from './utils/datetime.js'` e `import('./utils/errors.js')`. En `tests/`: `import('../helpers.js')` | Los cinco dan error (`no-restricted-imports` o `no-restricted-syntax`) con el mensaje en español, salida 1. |
| N-7 (control) | `import('../public/js/modules/promo-form.js')` desde `tests/`, más los imports estáticos existentes de `public/js` en 3 pruebas | Salida 0. |
| N-8 | `zz-root.ts` fuera del `tsconfig` | `Parsing error: … was not found by the project service`, salida 1. |
| N-9a | `async` sin `await` en `src/` | Salida 0 (E-1). |
| N-9b | `if (p)` con `p: Promise<boolean>` | `no-misused-promises`, salida 1. |
| G-3 | `npm run lint:fix` sobre la copia sin cambios | Salida 0. `diff -rq` con el repositorio: sin diferencias. |
| R-1 | `CI=true npm test` | 25 archivos y 468 pruebas superadas, igual que al cerrar REQ-F-004. |
| R-2 | `npm run typecheck` | Salida 0. |
| R-3 | `git diff main --stat -- restaurante/tests/snapshots` y búsqueda de `.skip`, `.only` y `.todo` en las líneas añadidas de `tests/` | Vacío y 0 coincidencias. |
| R-4 | Script temporal (scratchpad): `createApp` de `main` (`git archive`) y de la rama, con supertest y `tests/support/admin.ts` | 92 respuestas comparadas (estado, hash de cabeceras sin `date`/`last-modified`, hash del cuerpo con CSRF/nonce/cookie normalizados y `Location`). **Idénticas.** Detalle en "Regresión". |
| R-5 | El mismo script: `TypeError` de `createLandingController` e `icons.manifest` con `'x'`, `undefined`, `42`, `null` y `{a:1}` | Idénticos a `main`, por ejemplo `TypeError: Negocio desconocido: 42`. |
| R-6 | `echo … \| node scripts/hash-password.ts` en `main` y en la rama; `npm run admin:hash-password` | Salida 0 en los dos casos y hash `scrypt$32768$8$1$…` en ambos. |
| R-7 | `git diff main --name-only` y archivos sin seguimiento | Solo los archivos declarados, más `senior-qa.md` (ampliación aprobada). Sin cambios en `public/`, `src/styles/` ni plantillas. |
| D-1 | `package.json` de `main` frente a la rama | `dependencies` idénticas. Hay 5 `devDependencies` nuevas, las aprobadas, y ninguna existente cambia. |
| D-2 | Paquetes de producción del lockfile, sin `dev` ni `devOptional`, por nombre, versión e integridad | 55 en `main` y 55 en la rama: **idénticos**. Entradas totales: 288 → 376. |
| D-3 | `docker build --target production` de la rama y de `main`, y listado de `node_modules` más `sha256sum` de `src/` y `public/` dentro de cada imagen | Las dos construyen. `node_modules` es idéntico y no contiene eslint, typescript ni globals. `public/`, CSS compilado incluido, es idéntico. Solo difieren los 8 `.ts` de `src/` corregidos. |
| D-3 | `docker run` de la rama con `WHATSAPP_*` ficticios y `DATA_DIR=/var/lib/restaurante` | `healthy`. `/`, `/molotes`, `/birria`, CSS y favicon dan 200; `/admin/login` da 503 (administración deshabilitada sin credenciales); logs JSON normales. Contenedor eliminado. |
| D-4 | `docker compose run --rm test` | 25 archivos y 468 pruebas superadas. La etapa `build`, que ejecuta `typecheck` sobre `eslint.config.ts`, funciona. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | F-1: salida 0, sin errores ni avisos. |
| CA-2 | PASS | N-1: archivo y línea (`src/app.ts 87:1`), salida 1. |
| CA-3 | PASS | N-2 da salida 1 en `src` y en `tests`; N-3 da salida 0. |
| CA-4 | PASS | N-4: `no-unused-vars`, salida 1. |
| CA-5 | PASS | F-2: sin cambios en git ni `.eslintcache`. F-3: `lint:fix` corrige. |
| CA-6 | PASS | N-6: 0 reportes en los ignorados, con control positivo en `src/`. |
| CA-7 | PASS | R-1 a R-3: 25 archivos y 468 pruebas, snapshots sin cambios, sin `skip`/`only`/`todo`, `typecheck` en 0. |
| CA-8 | PASS | G-1: la única desactivación en código (`tests/helpers.ts:8`) lleva `-- <justificación>`. En `eslint.config.ts`, solo E-1 (1 regla) y E-2 (5 reglas, solo en `tests/**`), cada una con su justificación comentada. N-5 confirma que se exige por herramienta. |
| CA-9 | PASS | D-1 a D-4. |
| CA-10 | PASS | G-2: R-8 se cumple en README (`lint`, `lint:fix`, excepciones), `typescript.md` ("Lint", formato del `any`, regla de imports `.js`, "Antes de terminar"), `javascript.md` ("Lint") y `senior-fullstack.md` (tabla de comandos, "Modo directo" y validación T2/T3). `senior-qa.md` (ampliación) describe `lint` como evidencia real. Ninguna referencia a "placeholder" o "pendiente de configurar" en `.claude/` (fuera de tickets) ni en el README. G-3: los comandos documentados funcionan tal como están escritos. |

### Defectos encontrados

Ninguno.

### Regresión

R-4 es idéntico a `main` en 92 respuestas:
- `/`, `/molotes`, `/birria`, 404, manifests, `favicon.ico`, `apple-touch-icon.png`, los 3 CSS y los 4 JS, en viernes 12:00, sábado 12:00, domingo 23:59 y lunes 00:00 (hora de México). `/` sirve Molotes de lunes a viernes y Birria el fin de semana, con las transiciones correctas.
- `/admin`:
  - sin sesión: 303 a `/admin/login`, incluido el POST con `expirada=1`, y 404;
  - acceso: correcto (303) e incorrecto (401);
  - con sesión: los dos negocios (200);
  - guardado con CSRF válido (303 `?ok=save`) y su efecto en `/molotes`;
  - CSRF inválido (403);
  - cuerpo grande declarado (413);
  - cuerpo grande `chunked`: la conexión se cierra (ECONNRESET), igual en `main`;
  - administración deshabilitada (503);
  - producción sin HTTPS (503 y log `admin_requires_https`);
  - error de un middleware posterior propagado a través de `adminGate` y `requireSession` (500 y log `request_error`).

Mismas cabeceras (`no-store`, `noindex`, `Referrer-Policy`, CSP) y mismo cuerpo.

### Responsive / Accesibilidad / UX/UI / SEO

No aplica: no hay cambios en `public/`, estilos ni plantillas (R-7). El HTML, CSS y JS servidos son idénticos byte a byte a los de `main` (R-4, D-3), así que no hay regresión de SEO, CTA ni estructura. No se usó navegador, según el plan.

### Performance

`npm run lint` tarda 3,1 s de reloj (5,1 s de CPU) en todo el proyecto. No requiere caché.

### Pendientes de revisión manual

Ninguno.

### Observaciones (no son defectos)

- El Technical Action Plan dice "287 → 376 entradas" del lockfile. Medido: 288 → 376, contando la entrada raíz. No tiene impacto.
- `docker compose run --rm test` reconstruye la etiqueta local `restaurante:test` (comportamiento normal del servicio, `pull_policy: build`). Las imágenes temporales de QA (`restaurante:qa-005-main` y `restaurante:qa-005-rama`) y el contenedor `qa-005-rama` se eliminaron.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-03 (cita: "apruebo todo"), incluidas las propuestas P-1 a P-5 como D-1 a D-5.

### Revisión técnica (senior-fullstack), 2026-10-04

Se añade el Technical Action Plan, que incluye las excepciones propuestas E-1 y E-2 y la regla contra los imports `./x.js` que apuntan a `.ts`. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (senior-fullstack), 2026-10-04

El usuario aprobó el plan ("Apruebo el plan"). Se creó la rama `feature/REQ-F-005-lint-eslint-typescript-eslint`, se movió el ticket a `in-progress/` (pasó por `IN_PROGRESS`), se implementó el plan y se verificaron CA-1 a CA-10, Docker incluido. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (senior-qa), 2026-10-04

El usuario aprobó la implementación ("Apruebo la implementación"). Se añade el QA Action Plan. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### Ampliación (senior-fullstack), 2026-10-04

El usuario aprobó corregir `.claude/agents/senior-qa.md` (cita: "apruebo el plan de QA e incluye la corrección de senior-qa.md"): la línea de `npm run lint` ya no lo describe como placeholder. No hay commit.

### QA (senior-qa), ronda 1, 2026-10-04

El usuario aprobó el QA Action Plan ("apruebo el plan de QA e incluye la corrección de senior-qa.md"). Se ejecutó la ronda 1: CA-1 a CA-10 en PASS, sin defectos, e idéntico a `main` en HTTP, en mensajes de error y en la imagen de producción. Estado: `QA_APPROVED`.

### Commit y Pull Request (senior-fullstack), 2026-10-04

QA aprobó el ticket (`QA_APPROVED`, ronda 1, sin defectos). Antes del commit se volvió a verificar: `typecheck` y `lint` dan 0, y `npm test` pasa 25 archivos y 468 pruebas. Se hizo el commit en la rama `feature/REQ-F-005-lint-eslint-typescript-eslint` y se abrió el Pull Request https://github.com/orvigas/negocio/pull/11 contra `main`. Estado: `READY_FOR_MERGE`.
