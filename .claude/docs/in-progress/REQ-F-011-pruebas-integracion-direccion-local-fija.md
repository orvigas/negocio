# REQ-F-011 — Pruebas de integración estables en macOS con dirección local fija

## Estado

QA_APPROVED (Q2, ronda 1, 2026-10-06; ver `## QA Report`. CA-8 se verifica en el PR)

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-05). Cita textual: "Apruebo REQ-F-011 con las tres propuestas".

Decisiones confirmadas en la aprobación:

- **D-1.** CA-2: 30 ejecuciones seguidas de la suite completa. CA-3: 50 ejecuciones seguidas de la matriz de autorización.
- **D-2.** Se incluye RF-7: un control automático contra la forma antigua de crear el cliente de prueba.
- **D-3.** CA-10: el tiempo de `npm test` no puede empeorar más de un 10 % frente a la base.

## Origen

OBS-1 del QA Report de REQ-F-007 (`.claude/docs/in-progress/REQ-F-007-control-usuarios-roles.md`). Petición del usuario (cita textual): "Corrige DEF-001 a DEF-004 en esta rama y abre ticket para OBS-1".

## Objetivo

Que `npm test` dé el mismo resultado en cada ejecución, también en macOS y con las pruebas en paralelo. Las pruebas de integración hablan siempre con el servidor que crean ellas mismas y nunca con otro proceso de la máquina.

Es un cambio solo de la infraestructura de pruebas: la app se comporta igual que hoy.

## Problema

- En macOS, algunas pruebas de integración fallan de vez en cuando:
  - En `main` fallaron 2 de 12 ejecuciones completas.
  - En la rama de REQ-F-007 fallaron 4 de 25 ejecuciones en paralelo.
  - La matriz de autorización, ejecutada sola, falló 2 o 3 veces en 25.
- Causa diagnosticada por QA:
  - Las pruebas pasan la app a supertest sin servidor propio (`request(app.callback())`). supertest abre entonces un servidor en todas las interfaces (`::`), y el cliente conecta a `127.0.0.1`.
  - Si otro proceso local usa ese mismo puerto en IPv4, recibe la petición. Se capturó la respuesta "Client sent an HTTP request to an HTTPS server", que venía de un servicio ajeno.
- No pasa con `--maxWorkers=1` ni en Docker. En el CI de GitHub (Linux) no se ha visto.
- Impacto:
  - Fallos falsos que hacen perder tiempo en QA y restan confianza en la suite.
  - REQ-F-008 y REQ-F-009 añadirán más pruebas de integración, así que el problema irá a más.

## Alcance

1. Todas las pruebas que hacen peticiones HTTP a la app usan un servidor que escucha solo en `127.0.0.1`. El cliente conecta a esa misma dirección y puerto.
2. Una sola forma compartida, en `tests/support/`, de crear ese servidor y su cliente. La usan todas las pruebas de integración actuales.
3. Se aplica a todos los usos actuales de la forma antigua:
   - `tests/support/admin.ts` (lo usan `admin-db-security.test.ts` y `admin-file-repository.test.ts`);
   - `tests/integration/app.test.ts`;
   - `tests/integration/icons.test.ts`;
   - `tests/integration/admin.test.ts`;
   - `tests/integration/admin-auth.test.ts`;
   - `tests/integration/admin-authorization-matrix.test.ts`.
4. Un control automático que impide volver a usar la forma antigua (RF-7).
5. La convención queda documentada para que la sigan las pruebas nuevas, como las de REQ-F-008 y REQ-F-009.

## Fuera de alcance

- Cambios en `src/` o en el comportamiento de la app.
- Cambios en la configuración de producción, el Dockerfile o las variables de entorno.
- Ejecutar las pruebas en serie (`--maxWorkers=1` o equivalente) como solución. Eso esconde el problema, no lo corrige.
- Reintentar automáticamente las pruebas que fallan.
- Cambiar lo que comprueba cada prueba, o quitar, saltar o debilitar pruebas.
- Cambiar el framework de pruebas o la librería de peticiones HTTP.
- Cambios en el workflow de CI, salvo que hagan falta para mantenerlo en verde (no se espera).

## Requisitos

- **RF-1.** Ninguna prueba de integración abre un servidor en todas las interfaces (`::` o `0.0.0.0`). Todas escuchan en `127.0.0.1`, en un puerto libre que asigna el sistema operativo.
- **RF-2.** El cliente de cada prueba conecta exactamente a la dirección y el puerto del servidor que creó esa prueba.
- **RF-3.** Un único sitio compartido en `tests/support/` crea el servidor y su cliente. Ningún archivo de prueba repite esa lógica.
- **RF-4.** Cada servidor de prueba se cierra al terminar su prueba o su archivo, también si la prueba falla. No quedan servidores abiertos que impidan a Vitest terminar o que dejen puertos ocupados.
- **RF-5.** Todo lo que hacen hoy las pruebas sigue funcionando:
  - peticiones sueltas;
  - agentes con cookies (sesión y CSRF de admin);
  - varias apps en el mismo archivo, con configuración o reloj distintos.
- **RF-6.** Las pruebas comprueban lo mismo que antes. El número de pruebas no baja.
- **RF-7.** Un control automático impide escribir la forma antigua (`request(app.callback())` o `request.agent(app.callback())`) en `tests/`. Puede ser una regla de lint o una prueba que revise el código. Si alguien la vuelve a usar, el control falla.

## Historias de usuario

**Como** desarrollador o QA del proyecto **quiero** que `npm test` dé el mismo resultado en cada ejecución en macOS **para** que un fallo indique un defecto real y no un choque con otro proceso local.

## Criterios de aceptación

- **CA-1.** En `tests/` no queda ningún `request(<app>.callback())`, `request.agent(<app>.callback())` ni `listen()` sin dirección. Se comprueba buscando en el código.
- **CA-2.** En macOS, en una máquina con servicios locales activos (la misma de QA), 30 ejecuciones seguidas de `npm test` en paralelo, con la configuración por defecto, terminan las 30 en verde.
- **CA-3.** En macOS, 50 ejecuciones seguidas de solo `admin-authorization-matrix.test.ts` terminan las 50 en verde.
- **CA-4.** Una comprobación demuestra que el servidor de prueba escucha en `127.0.0.1` y no en `::`.
- **CA-5.** Se reproduce la causa de forma controlada: con un proceso ajeno escuchando en `127.0.0.1`, las pruebas no le envían ninguna petición.
- **CA-6.** El número de pruebas no baja respecto a la base. Ninguna prueba se salta, se marca `skip` o `todo`, ni se debilita.
- **CA-7.** `npm run lint` y `npm run typecheck` terminan sin errores.
- **CA-8.** El CI de GitHub (`calidad` y `docker`) sale en verde en el PR.
- **CA-9.** El `git diff` no toca `src/`, `public/`, el Dockerfile ni la configuración de producción.
- **CA-10.** El tiempo de `npm test` en paralelo no empeora más de un 10 % frente a la base.
- **CA-11.** La convención está documentada. El control de RF-7 falla cuando se le pasa un ejemplo de la forma antigua.

## Casos límite

- **Agentes con cookies.** El agente mantiene la sesión contra el mismo servidor durante toda la prueba. Si se crea un servidor nuevo por petición, la sesión se pierde.
- **Varias apps en el mismo archivo** (por ejemplo, relojes distintos en `app.test.ts`). Cada app tiene su propio servidor y se cierra al terminar.
- **Una prueba falla a mitad.** Su servidor se cierra igual (RF-4).
- **Ejecución en paralelo.** El sistema asigna puertos libres en `127.0.0.1`, así que los procesos de prueba no chocan entre sí.
- **Entornos sin IPv4 en la interfaz local.** No aplica en macOS, en el CI de Linux ni en Docker. Riesgo bajo.

## Dependencias

- **REQ-F-007 debe estar mergeado antes de empezar.** La matriz de autorización y los cambios en `tests/support/admin.ts`, `admin.test.ts`, `app.test.ts` e `icons.test.ts` solo existen en esa rama.
- No depende funcionalmente de REQ-F-008, REQ-F-009 ni REQ-F-010.

## Orden de implementación

Va justo después del merge de REQ-F-007 y antes de REQ-F-008. Orden completo:

1. REQ-F-007
2. REQ-F-011
3. REQ-F-008
4. REQ-F-009

Motivo: REQ-F-008 y REQ-F-009 añaden muchas pruebas de integración. Si la convención ya existe, esas pruebas se escriben bien desde el principio y su QA no se llena de fallos falsos.

## Riesgos

- **Muchas pruebas cambian a la vez.** Puede cambiar sin querer lo que comprueban. Se mitiga con CA-6 y revisando el diff.
- **Fallos intermitentes con otra causa** (orden de ejecución, base de datos compartida, relojes). CA-2 y CA-3 los sacarían a la luz. En ese caso se informa como hallazgo aparte y este ticket no se amplía sin aprobación.
- **Validación estadística.** CA-2 y CA-3 bajan mucho el riesgo, pero no prueban que el fallo sea imposible. Con la tasa actual, que salgan en verde por casualidad tiene una probabilidad menor del 1 %. CA-5 completa la prueba.
- **Servidores sin cerrar.** Pueden dejar Vitest colgado. Se mitiga con RF-4.

## Action Plan

### Objetivo

Que las pruebas de integración solo hablen con su propio servidor en `127.0.0.1`, sin cambios funcionales.

### Cambios requeridos

1. Medir la base en macOS: tasa de fallos, tiempo de `npm test` y número de pruebas.
2. Crear en `tests/support/` una utilidad única que:
   - abra el servidor de prueba en `127.0.0.1` con un puerto libre;
   - devuelva el cliente o agente apuntando a ese servidor;
   - lo cierre al terminar.
3. Pasar a la utilidad todos los usos actuales (lista en Alcance).
4. Revisar si `tests/support/process.ts` se puede alinear con la utilidad. Es opcional: ya escucha en `127.0.0.1`.
5. Añadir el control automático de RF-7.
6. Documentar la convención.
7. Validar CA-1 a CA-11.

### Orden recomendado

1. Medir la base.
2. Crear la utilidad.
3. Migrar archivo por archivo, con la suite en verde después de cada paso.
4. Añadir el control de RF-7.
5. Documentar.
6. Validar con las ejecuciones repetidas.

### Resultado esperado

- La suite es estable en macOS en paralelo.
- `src/` no cambia.
- Hay una convención documentada y un control que evita que el fallo vuelva.

## Trazabilidad

| Origen | Criterios de aceptación |
| --- | --- |
| Objetivo, RF-1, RF-2 | CA-1, CA-2, CA-3, CA-4, CA-5 |
| RF-3 | CA-1, CA-11 |
| RF-4 | CA-2, CA-10 |
| RF-5, RF-6 | CA-6, CA-8 |
| Sin cambios funcionales | CA-9 |
| RF-7 | CA-11 |

## Revisión técnica

Revisión T1 (senior-fullstack, 2026-10-05, sobre `main` en 8cb07a0). Sin cambios en el repositorio: las pruebas de diagnóstico se hicieron en una carpeta temporal fuera del proyecto.

### Causa raíz verificada en esta máquina

- supertest 7.3.0 (`node_modules/supertest/lib/test.js`, `serverAddress`): si recibe una función (`app.callback()`), crea un `http.Server` y llama a `listen(0)` **sin dirección**, es decir, en `::` (doble pila). Después reescribe la URL `::` a `127.0.0.1`. Abre y cierra un servidor así **en cada petición** (también con `request.agent(fn)`).
- Reproducción controlada (CA-5, script temporal):
  - Un servidor "ajeno" escucha en `127.0.0.1:P`. Otro servidor hace `listen(P)` sin dirección: **macOS lo acepta** (`{ address: '::', port: P }`) y `fetch('http://127.0.0.1:P')` responde el ajeno (`AJENO`).
  - Con `listen(P, '127.0.0.1')` el sistema responde `EADDRINUSE`: con la dirección fija es imposible compartir puerto con otro proceso en IPv4.
  - Lo mismo con los servicios reales de esta máquina en el rango efímero (Code Helper en 127.0.0.1:49661/49662, Ollama en 127.0.0.1:49264, Docker en 127.0.0.1:51901): `listen(puerto)` en `::` funciona; `listen(puerto, '127.0.0.1')` da `EADDRINUSE`.
  - El choque necesita que el sistema asigne a `::` un puerto que otro proceso ya tiene en 127.0.0.1. En 3.000 intentos sintéticos no se dio, pero la suite real (cientos de servidores efímeros por ejecución) lo sufre con frecuencia (ver línea base). El mecanismo es el mismo.

### Línea base medida (macOS, 10 núcleos, `npx vitest run`, configuración por defecto)

| Medida | Resultado |
| --- | --- |
| Suite completa, 20 ejecuciones | **3 fallos (15 %)**. Archivos y pruebas: 40 archivos, **626 pruebas** |
| Duración (campo `Duration` de Vitest) | media 8,03 s; **mediana 7,91 s**; mín. 7,67 s; máx. 9,12 s |
| Solo la matriz, 25 ejecuciones | **2 fallos (8 %)**; duración ~4,3 s |

Fallos observados (todos de respuestas que no son de la app): `expected 400 to be 403` (el "Client sent an HTTP request to an HTTPS server" de un servicio ajeno), `expected 404 to be 303`, `expected 200 to be 303`, `No hay token CSRF en la página`. Afectan a `admin.test.ts`, `admin-account.test.ts` y `admin-authorization-matrix.test.ts`: todos pasan por `setupAdmin` (`tests/support/admin.ts`), que usan 13 archivos; migrar `setupAdmin` los cubre a todos.

### Inventario de la forma antigua (CA-1)

| Archivo | Uso |
| --- | --- |
| `tests/support/admin.ts` | `request.agent(app.callback())` y `request(app.callback())` en `setupAdmin` (13 archivos lo usan) |
| `tests/integration/app.test.ts` | 3 helpers: `agent()`, `agentWith()`, `start()` (51 llamadas) |
| `tests/integration/icons.test.ts` | helper `agent()` (13 llamadas) |
| `tests/integration/admin.test.ts` | 1 (CA-24, app sin usuarios) |
| `tests/integration/admin-auth.test.ts` | 1 (`request.agent(app.callback())`) |
| `tests/support/process.ts` | ya usa `listen(0, '127.0.0.1')` en `freePort` (correcto) |

### Hallazgos que requieren decisión

**P-1. Las pruebas de arranque lanzan el servidor real, que escucha en todas las interfaces.**

- Problema: `tests/integration/server-startup.test.ts` arranca `node src/server.ts` (con `startServer` de `tests/support/process.ts`). `src/server.ts` hace `app.listen(config.port)` sin dirección, es decir, en `::`. Una de esas pruebas (`fetch(server.url)` a `http://127.0.0.1:<puerto>`) tiene la misma clase de riesgo: `freePort` comprueba que el puerto está libre en 127.0.0.1, lo suelta y el proceso hijo lo abre en `::` milisegundos después.
- Requisito afectado: RF-1 ("Ninguna prueba de integración abre un servidor en todas las interfaces") contra Fuera de alcance ("Cambios en `src/`", "las variables de entorno"). Para que el proceso real escuche en 127.0.0.1 haría falta tocar `src/server.ts` o añadir una variable `HOST`.
- Impacto: riesgo mucho menor que el actual (un solo servidor por prueba, con el puerto comprobado libre justo antes), pero no es cero. En producción escuchar en todas las interfaces es lo correcto (Docker publica el puerto).
- Alternativas:
  - **A (recomendada).** Excepción documentada: RF-1 se aplica a los servidores que crean las pruebas en su propio proceso. Las pruebas de arranque prueban el proceso de producción tal cual y conservan su forma actual. Se deja anotado en el ticket y en la documentación de la convención. Sin cambios en `src/`.
  - B. Ampliar el alcance con una variable opcional `HOST` en `src/config/env.ts` y `src/server.ts` (por defecto, todas las interfaces). Rompe "Fuera de alcance" (src y variables de entorno); mejor como ticket aparte si se quiere.
- **Decisión del usuario (2026-10-06): A.** Cita textual: "P-1 A y P-2 A".

**P-2. Dónde se documenta la convención.**

- Problema: el ticket pide documentarla "para que la sigan las pruebas nuevas" (REQ-F-008 y REQ-F-009), que escribirán los agentes. Los agentes leen `.claude/rules/`; el README es para personas.
- Alternativas:
  - **A (recomendada).** Las tres: comentario de uso en `tests/support/http.ts`, un párrafo en la sección "Pruebas" de `restaurante/README.md` y un párrafo corto en `.claude/rules/testing.md` (es una regla del proyecto: se modifica solo con esta aprobación).
  - B. Solo README y el comentario del módulo (sin tocar `.claude/rules/`).
- **Decisión del usuario (2026-10-06): A.** Incluye la aprobación explícita para modificar `.claude/rules/testing.md`.

El resto del ticket es coherente y viable.

Con P-1 = A, RF-1 se lee así: se aplica a los servidores que las pruebas crean en su propio proceso. `server-startup.test.ts` sigue arrancando el proceso de producción tal cual (`src/server.ts`, sin cambios) y queda como excepción documentada.

## Technical Action Plan

> Versión final con las decisiones P-1 = A y P-2 = A. Pendiente de la aprobación del usuario.

### Objetivo técnico

Un único módulo `tests/support/http.ts` es dueño del ciclo de vida de los servidores de prueba: los abre en `127.0.0.1` con puerto 0, entrega a supertest **solo la URL** (`http://127.0.0.1:<puerto>`), de modo que supertest nunca abre servidores, y los cierra al terminar cada prueba aunque falle. ESLint impide volver a la forma antigua.

### Archivos o componentes afectados

- Nuevo: `restaurante/tests/support/http.ts`.
- Nuevo: `restaurante/tests/integration/local-server.test.ts` (CA-4, CA-5, RF-4).
- Nuevo: `restaurante/tests/unit/http-test-convention.test.ts` (RF-7, CA-11).
- Modificados: `tests/support/admin.ts`, `tests/integration/app.test.ts`, `tests/integration/icons.test.ts`, `tests/integration/admin.test.ts`, `tests/integration/admin-auth.test.ts`.
- Modificados: `restaurante/eslint.config.ts`, `restaurante/README.md`, `.claude/rules/testing.md` (P-2 = A).
- Sin cambios: `src/`, `public/`, `Dockerfile`, `compose.yaml`, `.env.example`, `.github/workflows/ci.yml`, `vitest.config.ts`, `package.json` (sin dependencias nuevas). `tests/support/process.ts` se queda igual: ya usa `127.0.0.1` y sirve a procesos hijos, otro ciclo de vida. `tests/integration/server-startup.test.ts` tampoco cambia: es la excepción de P-1 = A.

### Cambios requeridos

**1. `tests/support/http.ts` (utilidad única, RF-1 a RF-4)**

```ts
export type Browser = ReturnType<typeof request.agent>;
export interface LocalServer {
  readonly url: string;            // http://127.0.0.1:<puerto>
  readonly address: AddressInfo;   // para CA-4
  request(): ReturnType<typeof request>; // peticiones sueltas, sin cookies
  browser(): Browser;              // agente nuevo con su propio almacén de cookies
  close(): Promise<void>;          // idempotente
}
export async function listenLocal(app: Koa): Promise<LocalServer>;
```

- Abre con `app.listen(0, '127.0.0.1')` y espera a `listening` o a `error` (falla rápido). La espera es necesaria: comprobado que `server.address()` es `null` justo después de `listen` con dirección (Node resuelve la dirección de forma asíncrona). Por eso la utilidad es `async`.
- Comprueba que la dirección es `127.0.0.1` en IPv4 y lanza un error si no.
- supertest recibe la URL (`request(url)`, `request.agent(url)`): con una cadena no abre ni cierra servidores. Comprobado: el agente conserva las cookies entre peticiones contra el mismo servidor, y otro cliente no las ve.
- Ciclo de vida: registra el cierre con `onTestFinished` de Vitest. Comprobado en Vitest 5: se ejecuta también si la prueba falla. Fuera de una prueba (nivel de módulo o `beforeAll`) Vitest lanza "Hook onTestFinished() can only be called inside a test": la utilidad falla rápido con ese mensaje y no deja servidores huérfanos. Hoy ningún uso está fuera de una prueba (`setupAdmin` y los helpers se llaman dentro de cada `it`). Si una prueba futura necesita un servidor por archivo, se decide entonces (YAGNI).
- `close()` hace `server.close()` y `server.closeAllConnections()` (las conexiones keep-alive del agente HTTP de Node no retrasan el cierre). Comprobado: cierra en 0 ms y deja 0 conexiones.
- **Agentes con cookies:** el servidor vive toda la prueba. `browser()` crea agentes nuevos contra la misma URL, así que varios "navegadores" de una prueba comparten la app y la sesión no se pierde. Cada `setupAdmin` o helper crea su propia app y su propio servidor (caso "varias apps en el mismo archivo").

**2. Migración (sin cambiar lo que comprueba cada prueba, RF-5 y RF-6)**

- `tests/support/admin.ts`: `setupAdmin` (ya es `async`) llama a `listenLocal(app)` y expone `browser` y `request` desde el servidor local, con la misma forma que hoy. Ningún consumidor cambia. `Browser` se reexporta desde `http.ts`.
- `app.test.ts` e `icons.test.ts`: los helpers `agent()`, `agentWith()` y `start()` pasan a `async` y devuelven `(await listenLocal(app)).request()`. Las llamadas cambian de forma mecánica: `await agent(...).get(...)` pasa a `await (await agent(...)).get(...)`, o a `const client = await agent(...)` donde ya había variable. No cambia ninguna aserción.
- `admin.test.ts` (CA-24) y `admin-auth.test.ts`: una línea cada uno con `listenLocal`.
- Efecto colateral sin impacto: la app ve la IP del cliente como `127.0.0.1` en lugar de `::ffff:127.0.0.1`. Ninguna prueba compara esa IP (revisado); el límite de intentos por IP sigue viendo una sola IP por prueba.

**3. Control automático RF-7 (ESLint, en `eslint.config.ts`, solo para `tests/**/*.ts`)**

- `no-restricted-imports`, opción `paths`: `supertest` prohibido con `allowTypeImports: true` (se permiten `import type`, p. ej. `Test` en `admin.ts`). Mensaje: "Usa listenLocal de tests/support/http.ts". Así solo `http.ts` puede crear clientes (RF-3).
- `no-restricted-syntax`:
  - `CallExpression[callee.property.name='callback']`: ningún `.callback()` en `tests/` (la utilidad usa `app.listen`, así que no necesita excepción).
  - `CallExpression[callee.property.name='listen']:not([arguments.1.value='127.0.0.1'])`: todo `listen` lleva `'127.0.0.1'` como dirección (CA-1; `process.ts` ya cumple).
- Excepción por archivo solo para `tests/support/http.ts`, y solo en el import de `supertest`.
- Como un bloque posterior sustituye las opciones de la regla, los patrones actuales de imports `.js` se extraen a constantes y se repiten en cada bloque (sin perder la regla de REQ-F-005).
- Cada mensaje explica la causa (macOS, `::` frente a `127.0.0.1`) y remite a `tests/support/http.ts`.
- Por qué ESLint y no una prueba con expresiones regulares: trabaja sobre el AST (no le afectan saltos de línea, alias ni comentarios), avisa en el editor y ya corre en `npm run lint` y en el CI.

**4. Prueba del control (CA-11)**: `tests/unit/http-test-convention.test.ts` usa la API de ESLint con la **configuración real** (`new ESLint({ cwd })`, `lintText(..., { filePath })`). Usa como `filePath` el propio archivo de la prueba, porque el servicio de proyectos de typescript-eslint rechaza rutas que no existen (comprobado).

- Falla con `request(app.callback())`, con `request.agent(app.callback())`, con `import request from 'supertest'` fuera de `http.ts` y con `server.listen(0)` sin dirección.
- No falla con `import type { Test } from 'supertest'`, con `listen(0, '127.0.0.1')` ni con el uso correcto de `listenLocal`.
- Con la ruta `tests/support/http.ts`, el import de supertest está permitido.
- Costo medido: unos 1,5 s en un solo worker (carga de la configuración más un `lintText` con tipos), en paralelo con el resto de archivos.

**5. Documentación (P-2 = A)**: README (sección "Pruebas"), `.claude/rules/testing.md` y el comentario del módulo. Contenido: "Las pruebas HTTP crean el servidor con `listenLocal(app)` de `tests/support/http.ts` (o con `setupAdmin`). Nunca `request(app.callback())`: en macOS supertest escucharía en `::` y el cliente podría hablar con otro proceso local. `npm run lint` lo impide." Más la excepción de P-1 = A: "Las pruebas de arranque (`server-startup.test.ts`) lanzan el proceso de producción, que escucha en todas las interfaces; es una excepción deliberada para probarlo tal cual".

### Validaciones

- La utilidad valida la dirección real del servidor (`127.0.0.1`, IPv4) y propaga el error de `listen`.
- `close()` es idempotente: se puede llamar a mano y también se llama sola al final de la prueba.

### Manejo de errores

- Si `listen` falla, la promesa se rechaza con el error original y la prueba falla con un mensaje claro.
- Si se llama fuera de una prueba, falla el error de Vitest (fallo rápido) y no queda ningún servidor abierto.

### Testing

`tests/integration/local-server.test.ts`:

- **CA-4:** `address` es `{ address: '127.0.0.1', family: 'IPv4' }` con puerto mayor que 0, y `url` coincide con esa dirección y ese puerto.
- **CA-5:** se levanta un servidor HTTP "ajeno" en `127.0.0.1:0` que cuenta las peticiones que recibe.
  - Se hacen peticiones con `request()` y con `browser()` contra varias apps de prueba: el ajeno recibe **0** y todas las respuestas son de la app.
  - Además, `listen(<puerto del ajeno>, '127.0.0.1')` da `EADDRINUSE`: el sistema nunca puede dar ese puerto a un servidor de prueba.
  - El contraste con `::` (que en macOS sí acepta el puerto ocupado) queda documentado en esta revisión y no se automatiza, porque en Linux se comporta distinto.
- **RF-4:** tras una prueba que crea servidores, se comprueba en la prueba siguiente que el puerto anterior ya no acepta conexiones (`ECONNREFUSED`). Lo mismo cuando la prueba falla a propósito: con `it.fails`, que hace pasar la prueba solo si su cuerpo falla, sin `skip` ni `todo`. Además, `close()` dos veces no da error.
- **RF-5:** un agente mantiene la sesión de admin (acceso, CSRF y POST) durante toda la prueba. Ya lo cubren de sobra las pruebas de admin migradas.

Ejecución:

- **Durante la migración:** `npm test` en verde después de cada archivo.
- **Al final:**
  - `npm run typecheck`, `npm run lint` y `npm test`.
  - CA-1: `grep -rnE "\.callback\(\)|request(\.agent)?\(|\.listen\(" tests/`, revisando que solo `http.ts` cree clientes y que todo `listen` lleve `127.0.0.1`.
  - CA-2: 30 ejecuciones seguidas de `npx vitest run`.
  - CA-3: 50 ejecuciones de `npx vitest run tests/integration/admin-authorization-matrix.test.ts`.
  - CA-6: el número de pruebas es mayor o igual que 626, más las nuevas; sin `skip`, `only` ni `todo` (`grep`).
  - CA-9: `git diff --stat` sin `src/`, `public/`, `Dockerfile` ni `compose.yaml`.
  - CA-10: mediana de `Duration` de las 30 ejecuciones de CA-2 **≤ 8,70 s** (mediana base 7,91 s + 10 %).
- **Si en CA-2 o CA-3 aparece un fallo con otra causa:** se informa como hallazgo aparte, sin ampliar el ticket.

### Seguridad

Solo cambia la infraestructura de pruebas. Escuchar en `127.0.0.1` reduce la exposición: hoy los servidores de prueba aceptan conexiones de toda la red local mientras viven. Sin cambios en CSP, cabeceras ni en la app.

### Performance

Hoy supertest abre y cierra un servidor **por petición**. Con la utilidad se abre **uno por app de prueba** y el agente HTTP de Node reutiliza las conexiones. Se espera igual o menos tiempo. El nuevo archivo de lint añade unos 1,5 s en paralelo. Se mide en CA-10.

### Riesgos técnicos

- Muchas llamadas cambian en `app.test.ts` e `icons.test.ts` (64). El cambio es mecánico y se revisa con `git diff --word-diff`, más el conteo de pruebas (CA-6).
- Conexiones keep-alive al cerrar: mitigado con `closeAllConnections()`.
- Si la prueba de lint (carga de typescript-eslint) se vuelve el archivo más lento y supera el margen de CA-10, el plan B es probar las reglas con `Linter` sin información de tipos, usando las constantes exportadas de `eslint.config.ts`, más `calculateConfigForFile` para confirmar que están conectadas. Se informaría en el resultado.
- Riesgo residual de las pruebas de arranque del proceso real (P-1 = A).

### Orden de implementación

1. Rama `feature/REQ-F-011-pruebas-integracion-direccion-local-fija` desde `main`. El ticket, hoy sin versionar, se añade y se mueve a `in-progress/` en la rama.
2. `tests/support/http.ts` y `local-server.test.ts`.
3. Migración: `admin.ts`, después `admin.test.ts` y `admin-auth.test.ts`, después `icons.test.ts` y por último `app.test.ts`, con `npm test` en verde después de cada paso.
4. Reglas de ESLint y `http-test-convention.test.ts`.
5. Documentación.
6. Validación completa: CA-1 a CA-7, CA-9 y CA-10 en local. CA-8 en el PR, en la fase T4.

### Criterios de finalización

- CA-1 a CA-7, CA-9, CA-10 y CA-11 comprobados con resultados reales en `## Implementation Result`.
- CA-8 queda para el PR.
- Diff limitado a `tests/`, `eslint.config.ts`, `README.md`, `.claude/rules/testing.md` y el ticket.

## Implementation Result

### Rama

`feature/REQ-F-011-pruebas-integracion-direccion-local-fija`, creada desde `main` (8cb07a0). Sin commits: los cambios están en el árbol de trabajo. El ticket está añadido al índice y movido a `in-progress/`.

### Cambios realizados

- **`tests/support/http.ts` (nuevo).** `listenLocal(app)` devuelve `{ url, address, server, request(), browser(), close() }`.
  - Abre el servidor con `app.listen(0, '127.0.0.1')`, espera a `listening` y comprueba que la dirección es 127.0.0.1 en IPv4.
  - supertest recibe solo la URL.
  - El cierre se registra con `onTestFinished`, así que se ejecuta también si la prueba falla. Fuera de una prueba da error, y antes cierra el servidor.
  - `close()` es idempotente y cierra también las conexiones keep-alive.
  - Respecto al plan, se añadió `server` (el `http.Server` de Node) para comprobar `listening` en las pruebas de RF-4 de forma determinista. Conectar al puerto liberado podría dar un falso positivo si otro worker reutiliza ese puerto.
- **Migración, sin cambiar ninguna aserción:**
  - `tests/support/admin.ts`: `setupAdmin` usa `listenLocal` y conserva la misma interfaz. `Browser` se reexporta desde `http.ts`.
  - `app.test.ts`: los helpers `agent`, `agentWith` y `start` usan `listenLocal`; `agent` pasa a ser asíncrona. Cambian 38 llamadas a `agent()` de forma mecánica (`await (await agent(...)).get(...)` o `const client = await agent(...)`).
  - `icons.test.ts`: `agent` pasa a ser asíncrona, con 12 llamadas.
  - `admin.test.ts` y `admin-auth.test.ts`: una línea cada uno.
  - Ninguna línea con `expect(` cambia en el diff.
- **`eslint.config.ts` (RF-7):** bloque para `tests/**/*.ts`.
  - `no-restricted-imports` de `supertest`, con `allowTypeImports`.
  - `no-restricted-syntax` contra `.callback()` y contra cualquier `listen` sin `'127.0.0.1'` como segundo argumento.
  - Excepción solo para el import en `tests/support/http.ts`.
  - Las reglas de imports `.js` de REQ-F-005 pasan a constantes y se repiten en cada bloque, así que no se pierden.
- **Pruebas nuevas:**
  - `tests/integration/local-server.test.ts`: CA-4, CA-5, RF-4 (incluida una prueba que falla a propósito con `it.fails`), `close()` idempotente y error fuera de una prueba.
  - `tests/unit/http-test-convention.test.ts`: CA-11, con la configuración real de ESLint.
- **Documentación (P-2 = A):**
  - Comentario en `tests/support/http.ts`.
  - README: subsección nueva "Pruebas HTTP: servidor en 127.0.0.1", dentro de "Scripts", junto a las notas de lint. La sección "Pruebas" que ya existía trata de Docker, así que la convención va aparte.
  - `.claude/rules/testing.md`: sección "Pruebas HTTP".
  - La excepción de P-1 queda documentada en el README y en el módulo.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `grep` en `tests/`: no queda ningún `.callback()`. `supertest` solo se importa con valor en `tests/support/http.ts` (en `admin.ts`, solo `import type`). Los 3 `listen` llevan `'127.0.0.1'` (`http.ts`, `process.ts` y la prueba de CA-5) |
| CA-2 | Cumple | 30 de 30 ejecuciones seguidas de `npx vitest run` en verde (configuración por defecto, en paralelo, 10 núcleos) |
| CA-3 | Cumple | 50 de 50 ejecuciones de `admin-authorization-matrix.test.ts` en verde (9 pruebas, mediana 4,26 s) |
| CA-4 | Cumple | `local-server.test.ts`: `address` es `127.0.0.1`/`IPv4` y la `url` coincide |
| CA-5 | Cumple | `local-server.test.ts`: con un servidor ajeno en 127.0.0.1, 20 apps de prueba (con `request()` y `browser()`) no le envían ninguna petición. Abrir su puerto en 127.0.0.1 da `EADDRINUSE` |
| CA-6 | Cumple | La base tenía 626 pruebas; ahora hay 642 (641 pasan y 1 es el fallo esperado de `it.fails`). Sin `skip`, `only` ni `todo` nuevos. Los 5 `skipIf` que ya había (permisos con root en Docker) no cambian |
| CA-7 | Cumple | `npm run typecheck` y `npm run lint` terminan con 0, sin errores ni avisos |
| CA-8 | Pendiente | Se comprueba en el PR (fase T4) |
| CA-9 | Cumple | `git diff --stat -- src public Dockerfile compose.yaml .env.example ../.github` sale vacío. El diff solo toca `tests/`, `eslint.config.ts`, `README.md`, `.claude/rules/testing.md` y el ticket |
| CA-10 | Cumple | Mediana de las 30 ejecuciones: 8,07 s (base 7,91 s; +2,0 %; límite 8,70 s). Media 8,20 s (base 8,03 s) |
| CA-11 | Cumple | Documentado en el README, en `.claude/rules/testing.md` y en el módulo. `http-test-convention.test.ts` falla con los 6 ejemplos de la forma antigua y acepta la forma correcta. A mano: un archivo temporal con `request(createApp(...).callback())` en `tests/integration/` hace fallar `npx eslint` con 2 errores (archivo borrado después) |

### Validaciones ejecutadas

- `npm run typecheck`: código 0.
- `npm run lint` (`eslint . --max-warnings 0`): código 0.
- `npx vitest run`, 30 veces seguidas: 30 de 30 en verde, `Tests 641 passed | 1 expected fail (642)`. Duraciones: mediana 8,07 s, mínimo 7,80 s, máximo 9,52 s.
- `npx vitest run tests/integration/admin-authorization-matrix.test.ts`, 50 veces: 50 de 50 en verde.
- `COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test` (Linux, sin red): 42 archivos; `636 passed | 1 expected fail | 5 skipped (642)`. Los 5 omitidos son los `skipIf` de root que ya existían.
- Durante la migración, `npx vitest run` en verde después de cada paso: `admin.ts`, `admin.test.ts` + `admin-auth.test.ts`, `icons.test.ts`, `app.test.ts`.
- Comparación con la línea base de T1: antes fallaban 3 de 20 ejecuciones de la suite y 2 de 25 de la matriz.

### Archivos afectados

- Nuevos:
  - `restaurante/tests/support/http.ts`
  - `restaurante/tests/integration/local-server.test.ts`
  - `restaurante/tests/unit/http-test-convention.test.ts`
- Modificados:
  - `restaurante/tests/support/admin.ts`
  - `restaurante/tests/integration/app.test.ts`
  - `restaurante/tests/integration/icons.test.ts`
  - `restaurante/tests/integration/admin.test.ts`
  - `restaurante/tests/integration/admin-auth.test.ts`
  - `restaurante/eslint.config.ts`
  - `restaurante/README.md`
  - `.claude/rules/testing.md`
- Ticket: movido de `backlog/` a `in-progress/`.

### Riesgos o pendientes

- CA-8 (CI de GitHub) queda para el PR.
- **Riesgo residual aceptado (P-1 = A):** la prueba de arranque que hace `fetch` al proceso real (`server-startup.test.ts`) sigue escuchando en todas las interfaces.
- La prueba de CA-11 carga ESLint con información de tipos: unos 1,3 s en su worker, en paralelo con el resto. Está dentro del margen de CA-10.
- La prueba "fuera de una prueba" comprueba el mensaje de Vitest ("only be called inside a test"). Si Vitest cambia ese texto en una versión mayor, habrá que ajustarla.

## QA Action Plan

> Q1 (senior-qa, 2026-10-06). Implementación aprobada por el usuario (cita textual: "Apruebo la implementación"). Ticket de infraestructura de pruebas, sin cambios funcionales: **no requiere navegador**, ni pruebas responsive, UX/UI, SEO o de accesibilidad (no se toca `src/` ni `public/`). Todos los comandos se ejecutan desde `restaurante/`, en la rama del ticket, sin modificar archivos del proyecto.

### Objetivo

Verificar de forma independiente que las pruebas HTTP solo hablan con su propio servidor en `127.0.0.1`, que la suite es estable en macOS en paralelo, que ninguna prueba cambió lo que comprueba y que el control de RF-7 funciona sin falsos positivos.

### Requisito bajo prueba

REQ-F-011: RF-1 a RF-7, CA-1 a CA-11, decisiones D-1 a D-3, P-1 = A (excepción de `server-startup.test.ts`) y P-2 = A (documentación en módulo, README y `.claude/rules/testing.md`).

### Criterios de aceptación

| CA | Pruebas que lo cubren |
| --- | --- |
| CA-1 | QA-01 |
| CA-2 | QA-05, QA-07 |
| CA-3 | QA-06, QA-07 |
| CA-4 | QA-03 (prueba automatizada de `local-server.test.ts`), QA-08 |
| CA-5 | QA-07 (reproducción propia), QA-03 |
| CA-6 | QA-02, QA-04 |
| CA-7 | QA-10 |
| CA-8 | Fuera de Q2: se verifica en el PR (fase T4). Queda como pendiente |
| CA-9 | QA-11 |
| CA-10 | QA-05, QA-09 |
| CA-11 | QA-12, QA-13 |

### Riesgos identificados

- **R-1. Cambio involuntario de aserciones** en la migración mecánica (64 llamadas en `app.test.ts` e `icons.test.ts`).
- **R-2. Pérdida o renombre de pruebas**: el conteo puede cuadrar (626 → 642) aunque una prueba antigua haya desaparecido y otra nueva la compense.
- **R-3. Estabilidad estadística**: 30/50 en verde reduce el riesgo, no lo elimina; la colisión depende de qué puertos estén ocupados en 127.0.0.1 en cada momento.
- **R-4. Servidores sin cerrar** (keep-alive, pruebas que fallan, `onTestFinished`): Vitest colgado o puertos ocupados al terminar.
- **R-5. Regla de ESLint**: falsos positivos (p. ej. `listen` o `.callback()` legítimos fuera de tests, `src/server.ts`) o pérdida de la regla de imports `.js` de REQ-F-005 al reorganizar `no-restricted-imports`/`no-restricted-syntax`.
- **R-6. Brechas de la regla** (alias como `const cb = app.callback`, `import('supertest')` dinámico, `listen` con la dirección en una constante). Se documentan como observaciones, no como defectos, salvo que contradigan un CA.
- **R-7. Tiempo**: el archivo de lint con información de tipos añade carga; el margen de CA-10 es del 10 %.
- **R-8. `admin-authorization-matrix.test.ts`** figura en el Alcance pero no aparece en el diff: debe quedar cubierto por `setupAdmin`.

### Pruebas funcionales

- **QA-01 (CA-1).** `grep -rnE "\.callback\(|request(\.agent)?\(|\.listen\(|from 'supertest'" tests/`: ningún `.callback()`; `supertest` con valor solo en `tests/support/http.ts` (en el resto, solo `import type`); todo `listen` lleva `'127.0.0.1'`. Confirmar que `admin-authorization-matrix.test.ts` usa solo `setupAdmin` (R-8).
- **QA-02 (CA-6, R-1).** Revisión del diff contra `main` de los 5 archivos migrados y `tests/support/admin.ts`:
  - `git diff main -- tests | grep -E '^[-+].*expect'` vacío (ninguna línea con `expect` añadida ni quitada en archivos existentes);
  - `git diff main --word-diff -- tests/integration/app.test.ts tests/integration/icons.test.ts`: solo cambia la forma de obtener el cliente (`agent(...)` → `await agent(...)`), sin cambios de rutas, cabeceras, cuerpos ni valores esperados;
  - `grep` de `.skip`, `.only`, `.todo`, `skipIf` e `it.fails` en el diff: solo el `it.fails` de `local-server.test.ts`; los 5 `skipIf` previos sin cambios.
- **QA-03 (CA-4, CA-5, RF-4).** Revisar `local-server.test.ts` y comprobar que sus pruebas pasan y verifican lo que dicen: dirección `127.0.0.1`/`IPv4`, 0 peticiones al servidor ajeno, `EADDRINUSE`, cierre tras prueba que pasa y que falla (`it.fails`), `close()` idempotente y error fuera de una prueba.
- **QA-04 (CA-6, R-2). Lista de pruebas, no solo el número.** En un `git worktree` de `main` en el scratchpad (con `node_modules` enlazado al del proyecto), `npx vitest list --json` en `main` y en la rama; comparar los identificadores (archivo + nombre completo):
  - todas las pruebas de `main` existen en la rama con el mismo nombre;
  - las únicas nuevas son las de `local-server.test.ts` y `http-test-convention.test.ts`;
  - totales: 626 en `main`, 642 en la rama.
  - El worktree se elimina al terminar. Si `vitest list` no se puede ejecutar en el worktree, se usa `--reporter=json` de una ejecución completa.

### Pruebas negativas y casos límite

- **QA-07 (CA-2, CA-3, CA-5). Reproducción propia de la causa con puertos ocupados.** Script temporal en el scratchpad (fuera del proyecto) que ocupa en `127.0.0.1` un bloque grande de puertos del rango efímero de macOS (`sysctl net.inet.ip.portrange.first/last`, p. ej. 300 puertos repartidos) y responde `AJENO` contando las peticiones recibidas. Con él activo:
  - **Control negativo en `main`** (worktree): matriz de autorización 10 veces y suite completa 5 veces. Se espera ver fallos o peticiones recibidas por el ajeno, lo que demuestra que el escenario reproduce el problema. Si no aparece ninguno, se registra y se aumenta el bloque de puertos una vez.
  - **Rama**: matriz 20 veces y suite completa 10 veces. Se espera 0 fallos y **0 peticiones** recibidas por el ajeno.
  - El script se detiene al terminar y se comprueba con `lsof` que no queda escuchando.
- **Casos límite ya cubiertos por pruebas automáticas** (se verifican en QA-03): prueba que falla a mitad, `close()` repetido con keep-alive, llamada fuera de una prueba, varias apps en el mismo archivo (`app.test.ts`, 20 apps en CA-5), agentes con cookies (suites de admin).

### Pruebas de regresión

- **QA-05 (CA-2, CA-10).** 30 ejecuciones seguidas de `npx vitest run` (configuración por defecto, en paralelo), con los servicios locales habituales activos (verificados con `lsof -nP -iTCP -sTCP:LISTEN`: Ollama, Code Helper, Docker en 127.0.0.1). Se registra por ejecución: código de salida, `Tests ... (N)` y `Duration`. Criterio: 30/30 en verde con `641 passed | 1 expected fail (642)`.
- **QA-06 (CA-3).** 50 ejecuciones seguidas de `npx vitest run tests/integration/admin-authorization-matrix.test.ts`. Criterio: 50/50 en verde.
- **QA-08 (RF-4, R-4). Cierre limpio.** En una ejecución completa:
  - Vitest termina sin el aviso "close timed out" ni "something prevents Vite server from exiting", y el proceso sale por sí mismo;
  - una ejecución con `--reporter=hanging-process` (o equivalente disponible en la versión instalada) no reporta handles abiertos atribuibles a servidores HTTP;
  - antes y después de la suite, `lsof -nP -iTCP -sTCP:LISTEN -c node` no muestra puertos de procesos de Vitest.
- **Docker (Linux), opcional como regresión**: `COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test` una vez; se espera `636 passed | 1 expected fail | 5 skipped (642)`. No sustituye a CA-8.
- `server-startup.test.ts` y `tests/support/process.ts` sin cambios (`git diff main --stat`), conforme a P-1 = A.

### Pruebas de performance

- **QA-09 (CA-10, D-3).** Mediana del campo `Duration` de las 30 ejecuciones de QA-05 **≤ 8,70 s** (base T1: 7,91 s + 10 %). Para descartar que la máquina esté hoy más rápida o más lenta que en T1, se miden además 10 ejecuciones de la suite en el worktree de `main`, en las mismas condiciones, y se compara la mediana de la rama con esta base del mismo momento (también ≤ +10 %). Si el criterio se cumple frente a una base y no frente a la otra, se informa como `REQUIREMENT_AMBIGUITY`. Se anota también la duración de `http-test-convention.test.ts`.

### Pruebas automatizadas

- **QA-10 (CA-7).** `npm run typecheck` y `npm run lint` con código 0, sin errores ni avisos. No se ejecuta `npm run lint:fix`.
- **QA-11 (CA-9).** `git diff main --name-only` y `git status --porcelain`: solo `restaurante/tests/**`, `restaurante/eslint.config.ts`, `restaurante/README.md`, `.claude/rules/testing.md` y el ticket. `git diff main --stat -- src public Dockerfile compose.yaml .env.example package.json package-lock.json vitest.config.ts ../.github` vacío.
- **QA-12 (CA-11, R-5, R-6). Regla de ESLint, por mi cuenta y sin crear archivos en el proyecto.** Con `npx eslint --max-warnings 0 --stdin --stdin-filename <ruta existente>` (rutas reales para que el servicio de proyectos de typescript-eslint las acepte):
  - Debe fallar en `tests/integration/app.test.ts` (ruta simulada) con: `request(app.callback())`, `request.agent(app.callback())`, `import request from 'supertest'`, `app.listen(0)`, `app.listen()`, `app.listen(0, '0.0.0.0')`, `app.listen(0, '::')`; y el mensaje remite a `tests/support/http.ts`.
  - No debe fallar con: `import type { Test } from 'supertest'`, `listenLocal(app)`, `app.listen(0, '127.0.0.1')`.
  - Con `tests/support/http.ts` como ruta: el import de `supertest` está permitido, pero `.callback()` y `listen` sin dirección siguen prohibidos.
  - Sin efecto fuera de `tests/`: `src/server.ts` (que hace `app.listen(config.port)`) y un `import request from 'supertest'` simulado en `src/app.ts` no disparan esta regla (`npm run lint` en verde lo confirma para el código real).
  - Regla de REQ-F-005 intacta: `import x from './x.js'` y `await import('./x.js')` siguen fallando tanto en `tests/` como en `src/`.
  - Brechas (R-6): se prueban alias (`const cb = app.callback; request(cb())`), `await import('supertest')` y `listen(0, HOST)` con constante. Si alguna no se detecta, se registra como observación (RF-7 pide impedir la forma literal `request(app.callback())`/`request.agent(app.callback())`).
- **QA-13 (CA-11). Documentación.** Revisar el comentario de `tests/support/http.ts`, la subsección del README y la sección de `.claude/rules/testing.md`: describen la convención, la causa, el control de lint y la excepción de P-1, y coinciden con el código (nombres de funciones, rutas).
- No se crean ni modifican pruebas en `restaurante/tests/` durante Q2: la cobertura añadida por la implementación es suficiente para los CA; la verificación adicional se hace con scripts temporales en el scratchpad.

### Evidencia requerida

- Salida resumida (código de salida, líneas `Tests` y `Duration`) de cada ejecución de QA-05, QA-06 y QA-07, con totales y mediana.
- Diferencia de listas de pruebas `main` frente a rama (QA-04).
- Salida de los `grep` y `git diff` de QA-01, QA-02 y QA-11.
- Salida de ESLint por cada caso de QA-12.
- Salida de `lsof` antes y después (QA-07, QA-08) y de `npm run typecheck` / `npm run lint`.

### Criterios de aprobación

- CA-1 a CA-7, CA-9, CA-10 y CA-11 en PASS con evidencia propia; CA-8 queda pendiente para el PR.
- 30/30 suite y 50/50 matriz en verde; 0 peticiones al servidor ajeno en QA-07 en la rama.
- Ninguna línea con `expect` cambia en archivos existentes y las 626 pruebas de `main` siguen en la rama con el mismo nombre.
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR`, si los hay, con decisión del usuario.
- Un fallo intermitente con otra causa distinta de la dirección de escucha se informa como hallazgo aparte (según Riesgos del ticket), no amplía el ticket; se clasifica según su impacto en CA-2/CA-3.

## QA Report

### Ronda

1 (Q2, senior-qa, 2026-10-06). QA Action Plan aprobado por el usuario (cita textual: "Apruebo el plan de QA").

### Pruebas ejecutadas

Rama `feature/REQ-F-011-pruebas-integracion-direccion-local-fija`, macOS, 10 núcleos, desde `restaurante/`. Base de comparación: `main` (8cb07a0) en un `git worktree` temporal en el scratchpad, que se eliminó al terminar.

| ID | Comando o acción | Resultado |
| --- | --- | --- |
| QA-10 | `npm run typecheck` / `npm run lint` | Código 0 / código 0 (`--max-warnings 0`) |
| QA-01 | `grep` de `.callback(`, `from 'supertest'`, `.listen(`, `createServer` en `tests/` | `.callback()` solo aparece en cadenas de ejemplo de `http-test-convention.test.ts` y en un comentario de `http.ts`. Supertest se importa con valor solo en `http.ts`; `admin.ts` usa `import type`. Los 4 `listen` reales llevan `'127.0.0.1'`: `http.ts:52`, `process.ts:48` y `local-server.test.ts:44/52`. `admin-authorization-matrix.test.ts` solo usa `setupAdmin` |
| QA-02 | `git diff main -- tests` filtrado por `expect` | **0** líneas con `expect` añadidas o quitadas |
| QA-02 | `git diff main --word-diff=porcelain` de `app.test.ts` e `icons.test.ts` | Solo cambia la forma de obtener el cliente: `agent().get(x)` pasa a `(await agent()).get(x)`, y `request(app.callback())` / `request(createApp(...).callback())` pasan a `(await listenLocal(...)).request()`. Rutas, cabeceras y valores esperados, idénticos |
| QA-02 | `grep` de `skip`, `only`, `todo`, `skipIf` y `fails` | Solo se añade el `it.fails` de `local-server.test.ts`. `skipIf`: 5 en `main` y 5 en la rama |
| QA-04 | `vitest run --reporter=json` en `main` y en la rama; comparación por archivo + nombre completo | `main` 626, rama 642. **0 pruebas de `main` faltan en la rama.** Las 16 nuevas son 8 de `local-server.test.ts` y 8 de `http-test-convention.test.ts`. 0 no superadas |
| QA-05 | 30 × `npx vitest run` en la rama (Ollama, Code Helper y Docker escuchando en 127.0.0.1) | **30/30 en verde**, todas `641 passed \| 1 expected fail (642)` |
| QA-09 | 10 × `npx vitest run` en `main`, intercaladas con QA-05 | 8/10 en verde. Fallos naturales en `admin-authorization-matrix` y `admin-users` (problema de origen) |
| QA-06 | 50 × `npx vitest run tests/integration/admin-authorization-matrix.test.ts` | **50/50 en verde** (9 pruebas; mediana 4,24 s) |
| QA-07 | Script temporal con **500 puertos ocupados** en 127.0.0.1 (rango 49152–65535), que responde `AJENO` y cuenta las peticiones | `main`, matriz 10 veces: **10/10 fallan** (3–8 pruebas por ejecución; 4–9 peticiones al ajeno). `main`, suite 5 veces: **5/5 fallan** (18–25 pruebas; 20–29 peticiones al ajeno). Rama, matriz 20 veces: **20/20 en verde, 0 peticiones al ajeno**. Rama, suite 10 veces: **10/10 en verde, 0 peticiones al ajeno**. El script terminó con código 0 |
| QA-08 | `npx vitest run --reporter=default --reporter=hanging-process`, más `lsof -nP -iTCP -sTCP:LISTEN` antes y después | Código 0 en 8 s. El reporter no muestra handles colgados ni avisos de cierre. Los puertos en escucha antes y después son idénticos (`diff` vacío). Ningún proceso `node` de Vitest ni del script queda en escucha |
| QA-12 | `npx eslint --max-warnings 0 --stdin --stdin-filename <ruta real>`, 22 casos | Ver CA-11 |
| QA-11 | `git diff main --name-only` + archivos sin versionar; `git diff main --stat` de `src`, `public`, `Dockerfile`, `compose.yaml`, `.env.example`, `package*.json`, `vitest.config.ts`, `server-startup.test.ts`, `process.ts` y `.github` | Solo `tests/**`, `eslint.config.ts`, `README.md`, `.claude/rules/testing.md` y el ticket. Las rutas prohibidas no tienen cambios |
| Docker | `COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test` (la imagen `restaurante:test` ya coincidía con la rama, verificado con md5; la caché no generó una imagen nueva) | Código 0. `42 passed (42)`; `636 passed \| 1 expected fail \| 5 skipped (642)`. Contenedor eliminado (`--rm`) |
| QA-13 | Lectura del comentario de `http.ts`, del README ("Pruebas HTTP: servidor en 127.0.0.1") y de `.claude/rules/testing.md` ("Pruebas HTTP") | Explican la convención, la causa, el control de lint y la excepción de P-1. Coinciden con el código: `listenLocal`, `request()`, `browser()`, `setupAdmin` y las rutas |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | QA-01: ningún `request(<app>.callback())`, `request.agent(<app>.callback())` ni `listen()` sin dirección en código ejecutable de `tests/` |
| CA-2 | PASS | QA-05: 30/30 en verde con los servicios locales activos. Además, QA-07: 10/10 con 500 puertos ocupados |
| CA-3 | PASS | QA-06: 50/50. Además, QA-07: 20/20 con 500 puertos ocupados |
| CA-4 | PASS | La prueba CA-4 de `local-server.test.ts` pasa en todas las ejecuciones (`address` `127.0.0.1`/`IPv4`, la URL coincide) |
| CA-5 | PASS | Reproducción propia (QA-07). En las mismas condiciones, `main` envía **185 peticiones** al proceso ajeno (58 en las 10 de la matriz y 127 en las 5 de la suite) y la rama **0** (en 30 ejecuciones). La prueba automática de CA-5 también pasa |
| CA-6 | PASS | QA-04: las 626 pruebas de `main` siguen con el mismo nombre, más 16 nuevas (642). QA-02: 0 cambios en líneas con `expect`, sin `skip`, `only` ni `todo` nuevos |
| CA-7 | PASS | QA-10: `typecheck` y `lint` con código 0 |
| CA-8 | Pendiente (fuera de Q2) | Se verifica en el PR (`calidad` y `docker`). Indicio favorable: la suite en Docker (Linux) sale en verde |
| CA-9 | PASS | QA-11 |
| CA-10 | PASS | Mediana de la rama: **8,07 s** (media 8,14; mín. 7,78; máx. 9,39). Frente a la base de T1 (7,91 s), +2,0 %; frente a la base de hoy en `main` (mediana 7,89 s, 10 ejecuciones), +2,3 %. Ambas por debajo del límite del 10 % (8,70 s) |
| CA-11 | PASS | **Rechaza** en `tests/integration/app.test.ts`: `request(app.callback())` e `request.agent(app.callback())` (2 errores cada uno: import y sintaxis), `import request from 'supertest'`, `listen(0)`, `listen()`, `listen(0, '0.0.0.0')` y `listen(0, '::')`. Todos los mensajes remiten a `tests/support/http.ts`. **Acepta**: `import type { Test }`, `listenLocal(app)` y `listen(0, '127.0.0.1')`. En `tests/support/http.ts` se permite importar supertest, pero `.callback()` y `listen(0)` siguen prohibidos. **Sin falsos positivos fuera de `tests/`**: `src/server.ts` con `app.listen(3000)` pasa, y en `src/` no se aplica la regla de supertest/`.callback()`. **Regla de REQ-F-005 intacta**: los imports `.js` estáticos y dinámicos siguen fallando en `tests/` y en `src/`. La documentación cumple (QA-13) |

### Defectos encontrados

Ninguno.

Observaciones (no son defectos, no bloquean):

- **OBS-1. Huecos de la regla de lint.** La regla no detecta:
  - un alias como `const cb = app.callback.bind(app); request(cb())`;
  - `await import('supertest')` dinámico.

  RF-7 pide impedir la forma literal `request(app.callback())` / `request.agent(app.callback())`, y esa sí se rechaza. Usar cualquiera de estas variantes requiere evitar la regla a propósito.
- **OBS-2. La regla es más estricta de lo necesario con constantes.** `listen(0, HOST)`, con `const HOST = '127.0.0.1'`, también se rechaza porque la regla exige el literal. Es conservador y está documentado ("todo `listen` lleva `'127.0.0.1'`").
- **OBS-3. Riesgo residual aceptado (P-1 = A).** `server-startup.test.ts` sigue arrancando el proceso real en todas las interfaces. No falló en ninguna de las 40 ejecuciones de la suite en la rama, tampoco con 500 puertos ocupados.

### Regresión

Las 626 pruebas de `main` siguen presentes y pasan en todas las ejecuciones de la rama. La suite pasa también en Docker (Linux). No se tocan `src/`, `public/` ni la configuración de producción. La regla de imports `.js` de REQ-F-005 sigue activa.

### Responsive

No aplica: sin cambios de UI.

### Accesibilidad

No aplica: sin cambios de UI.

### UX/UI

No aplica: sin cambios de UI.

### Performance

CA-10 cumple (+2,0 % frente a T1 y +2,3 % frente a `main` hoy). La matriz tarda una mediana de 4,24 s (T1: unos 4,3 s).

### SEO

No aplica.

### Pendientes de revisión manual

- CA-8: comprobar en el PR que el CI de GitHub (`calidad` y `docker`) sale en verde.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Versión inicial, creada a partir de OBS-1 del QA Report de REQ-F-007. Aprobada el 2026-10-05 con las tres propuestas confirmadas (D-1 a D-3).

### Revisión técnica T1 (2026-10-05)

senior-fullstack.

- Causa raíz verificada en macOS y línea base medida: la suite falla 3 de 20 veces, con mediana de 7,91 s y 626 pruebas; la matriz falla 2 de 25.
- Dos decisiones pendientes:
  - P-1: el servidor real de las pruebas de arranque escucha en todas las interfaces.
  - P-2: dónde se documenta la convención.
- Borrador del Technical Action Plan escrito. Estado: `NEEDS_TECHNICAL_CLARIFICATION`.

### Technical Action Plan final (2026-10-06)

senior-fullstack.

- El usuario responde "P-1 A y P-2 A":
  - Queda documentada la excepción de las pruebas de arranque del proceso real.
  - La convención se documenta en el comentario de `tests/support/http.ts`, en el README y en `.claude/rules/testing.md`, que el usuario aprueba modificar.
- Technical Action Plan finalizado. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Inicio de implementación (2026-10-06)

senior-fullstack. El usuario aprueba el Technical Action Plan (cita textual: "Apruebo el plan"). Se crea la rama `feature/REQ-F-011-pruebas-integracion-direccion-local-fija` y el ticket pasa a `in-progress/`. Estado: `IN_PROGRESS`.

### Implementación (2026-10-06)

senior-fullstack.

- Utilidad `listenLocal` creada, todos los usos migrados y control de ESLint con su prueba.
- Documentación actualizada en el README, en `.claude/rules/testing.md` y en el módulo.
- Resultados: CA-2 30 de 30, CA-3 50 de 50, CA-10 con mediana de 8,07 s.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (Q1, 2026-10-06)

senior-qa. El usuario aprueba la implementación (cita textual: "Apruebo la implementación"). QA Action Plan escrito: verificación independiente de la estabilidad (30 suite, 50 matriz y reproducción propia con puertos ocupados en 127.0.0.1, con control negativo en `main`), lista de pruebas frente a `main`, aserciones sin cambios, regla de ESLint (casos positivos, negativos, falsos positivos y regla de REQ-F-005), cierre limpio de Vitest, alcance del diff y tiempo frente a la base. Sin navegador. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA Report, ronda 1 (Q2, 2026-10-06)

senior-qa. El usuario aprueba el QA Action Plan (cita textual: "Apruebo el plan de QA").

- Ejecución completa: 30/30 de la suite y 50/50 de la matriz.
- Reproducción con 500 puertos ocupados: `main` 15/15 ejecuciones con fallos y 185 peticiones al proceso ajeno; la rama 30/30 en verde y 0 peticiones.
- Las 626 pruebas de `main` siguen presentes; 0 líneas con `expect` cambiadas.
- La regla de ESLint funciona en los 22 casos.
- Mediana de 8,07 s (+2,0 %).
- Sin defectos; tres observaciones.
- CA-8 queda pendiente para el PR.

Estado: `QA_APPROVED`.
