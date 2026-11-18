# REQ-F-047 — Limpieza posterior a REQ-F-045

## Estado

READY_FOR_MERGE (PR 3 de 3: `deploy.sh`, https://github.com/orvigas/negocio/pull/169). PR 1 (#165) y PR 2 (#167) mergeados en `main`. El ticket sigue en `in-progress/` hasta el merge del PR 3. Tras el merge: reinstalar `deploy/` en el VPS y volver a ejecutar el job `deploy` (RN-4, CA-7).

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-11-17). Cita textual: "si apruebo con tus recomendaciones", en respuesta a la presentación del requisito (RN-1 a RN-7, CA-1 a CA-12, Action Plan de 3 PR) con las preguntas P1 a P7. Se aprueban las opciones recomendadas:

- **P1 A:** QA-37 se prueba sin corregir DEF-002 de REQ-F-043 (con el conjunto lleno, volver a marcar un hash ya marcado expulsa otro). DEF-002 queda como defecto TRIVIAL conocido.
- **P2 A:** los comentarios desfasados adicionales (`content/molotes/index.ts`, `content/birria/index.ts`, `core/catalog/published.ts`) entran en el PR 1.
- **P3 A:** `docs/arquitectura.md`, tabla "Dónde queda el código actual": se conserva como histórica, con nota.
- **P4 A:** 3 PR a `main`, en el orden del Action Plan.
- **P5 A:** las dos variantes de degradación cruzada van a `landing-pages/tests/integration/user-repository.test.ts`, bloque D-7, una ejecución cada una.
- **P6 A:** se retiran de `page-import.ts` las ramas muertas y lo que solo las sirve, conservando el tipo leído de `page_import.source`.
- **P7 No:** no se amplía la autorización a `.claude/agents/senior-fullstack.md` ni a `.claude/rules/testing.md` (según la sesión principal, ya corregidos en el PR #164).

### Autorización para `.claude/agents/`

Autorizada por el usuario (2026-11-17, cita textual: "tienes mi autorización") la edición de `.claude/agents/senior-qa.md` y `.claude/agents/business-analyst.md`, **solo** en las líneas de RF-1 y solo para corregir referencias desfasadas. Ningún otro archivo de `.claude/agents/`, ni `.claude/rules/`, ni `.claude/CLAUDE.md`. El cambio lo hace `senior-fullstack` en el PR 1.

## Objetivo

Cerrar los cabos que dejó la retirada del `/admin` actual (REQ-F-045, sección "Seguimiento", puntos b, c y d, y la parte autorizada de a):

- documentación, mensajes y comentarios que describen comportamiento retirado;
- una rama de `deploy.sh` que ya no aporta nada y puede inducir a error;
- cuatro casos de lógica que se quedaron sin prueba permanente;
- código de `core` que solo usan las pruebas.

Sin cambios de comportamiento de producción fuera del punto de `deploy.sh`.

## Hechos comprobados (2026-11-17)

1. **`protect_running_app` (`deploy/deploy.sh:307-329`) no recrea la app.**
   - La configuración de `app` en `compose.prod.yaml:100-178` no depende de `DATABASE_ALLOW_NEWER_SCHEMA` (solo la recibe la `api`, línea 202) ni de las imágenes de api, migrate o inventory. El `up -d --no-deps app` de `deploy.sh:319` no cambia nada, y `deploy/ci/smoke.sh:552` ya comprueba que el contenedor de la app conserva su id.
   - Efectos reales de esa rama:
     - (a) el log (`:317`), el mensaje final (`:325`) y el resumen del CI (`resumen.sh:137`, `:140`) dicen "se recrea" o "recreada" cuando no hubo recreación;
     - (b) añade una espera de salud y una sonda de Traefik (`:320`). Si la app o Traefik fallan en ese momento, un 15 o un 16 se convierte en un **22** engañoso, con la instrucción innecesaria de restaurar la base desde el volcado;
     - (c) exporta una variable que no le llega a la app.
2. **`docs/despliegue.md:653` y `:720` son correctas.**
   - La 653 se usa tras reinstalar el `deploy/` anterior a la limpieza, cuyo compose sí pasa la variable a la app antigua.
   - La 720 trata de recrear la `api`.
   - Lo desfasado está en `despliegue.md:122-133` (pasos 6 y 7) y en las filas de los códigos 15 y 16 de la tabla de diagnóstico (`:910-911`).
3. **`landing-pages/src/content/` sigue existiendo**, con el contenido estático de cada negocio: textos, horarios, contacto e imágenes de sección. Los datos editables (productos, hero, texto destacado y promociones) están en MySQL y se sirven por la `api`. Sus semillas están en `packages/core/catalog/seeds/{molotes,birria}.json`.
4. **Pruebas HTTP.** `landing-pages` sigue usando Supertest (con `listenLocal`). `api` e `inventory-manager` usan `fetch` sobre su propio `listenLocal`. Las tres apps tienen `tests/unit/` y `tests/integration/`.
5. **Modo `'panel'` de `createBotControl`.**
   - Solo aparece en `packages/core/bot-control/bot-control.ts`: la opción en `:104`, `loadUsageFromStore` en `:342`, y las ramas de `:454` y `:553`.
   - Solo lo usa `api/tests/unit/bot-control-timers.test.ts:29`.
   - Ni `api/src/server.ts` ni `api/scripts/bot-chat.ts` lo pasan.
6. **`planPageImport`.**
   - Su único uso en producción es `seedPages` (`packages/core/catalog/page-import.ts:137`), siempre con `seedCandidates` (`seeded: true`, `existing: false`).
   - Son código muerto: las ramas `current` y `previous`, la negativa por `existing` / `PAGE_IMPORT_SEED_REFUSED`, `storable` y `choosePageSource`.
   - De los 11 casos de `landing-pages/tests/unit/page-import.test.ts`, solo el CA-5 (línea 85) recorre el camino de producción.
7. **QA-37 y QA-65** se describen en REQ-F-043 (líneas 897 y 937). Sus sondas (`bot-control-qa-req-f-043`) y las de degradación cruzada (`users-api-qa-req-f-040-ultimo-admin`) se retiraron en REQ-F-045 sin sustituto (O-1 del QA Report del PR 2).
8. **DEF-002 de REQ-F-043 sigue presente:** `markReleased` (`bot-control.ts:294-300`) expulsa la marca más antigua antes de comprobar si el hash ya estaba.

## Alcance

- **A. Textos y referencias (PR 1)**
  - `.claude/agents/senior-qa.md:50` y `:54`;
  - `.claude/agents/business-analyst.md:49` y `:98`;
  - `restaurante/README.md:1690` y `:1832`;
  - `restaurante/docs/arquitectura.md:356-369`;
  - `restaurante/deploy/ci/smoke.sh:217`;
  - los comentarios de `landing-pages/src/content/molotes/index.ts:9-13`, `landing-pages/src/content/birria/index.ts:11-13` y `packages/core/catalog/published.ts:5-10`.
- **B. Pruebas permanentes y código de `core` (PR 2):** QA-37, QA-65 y las dos variantes de degradación cruzada; retirada del modo `'panel'` y de las ramas muertas de `planPageImport`, con la adaptación de sus pruebas.
- **C. `deploy.sh` (PR 3)**
  - Retirar la recreación de la app de `protect_running_app` y actualizar la cabecera de `deploy.sh` (`:9-19`).
  - Actualizar los textos que dependen de ella: `deploy/ci/resumen.sh:137` y `:140`, `deploy/ci/smoke.sh:550-551` (comentario), `docs/despliegue.md:122-133` y las filas 15 y 16 de la tabla de diagnóstico.

Verificar cada número de línea al implementar: pueden haber cambiado.

## Fuera de alcance

- Cualquier otro cambio de comportamiento de producción. En particular, corregir DEF-002 (P1 A).
- `.claude/agents/senior-fullstack.md`, `.claude/rules/*` y `.claude/CLAUDE.md` (P7).
- `docs/despliegue.md:653` y `:720` (correctas, hecho 2).
- `docs/arquitectura.md:445` y las demás secciones históricas fechadas, que son correctas como historia.
- Las exportaciones de `DATABASE_ALLOW_NEWER_SCHEMA=true` para la `api` en `deploy.sh` (`:355` y `:401`): se quedan.
- Retirar `DATABASE_ALLOW_NEWER_SCHEMA` de la `api`.
- Mover a otra app las pruebas de `core`/`db` que viven en `landing-pages/tests/`.
- `Cotizador_Taquiza_Birria.xlsx`.

## Reglas de negocio

- **RN-1.** Cuando falla la api nueva (código 15) o inventory-manager (código 16), `deploy.sh` no toca la app, haya o no migraciones nuevas. El mensaje de salida, el registro y el resumen del CI dicen "la app no se tocó" y no mencionan ninguna recreación ni `DATABASE_ALLOW_NEWER_SCHEMA` para la app.
- **RN-2.** Un fallo de la api o de inventory-manager ya no puede terminar en 22 por la salud de la app. Los demás caminos del 22 no cambian: fallo de la vuelta atrás de la app y "la api anterior no quedó healthy".
- **RN-3.** No cambian:
  - la vuelta atrás completa (21);
  - la vuelta de la api con `DATABASE_ALLOW_NEWER_SCHEMA=true`;
  - el orden api → inventory-manager → app;
  - el router del webhook;
  - los demás códigos de salida.
- **RN-4.** Cambiar `deploy.sh` cambia la suma de control de `deploy/`. Tras el merge del PR 3 a `main`, el job `deploy` falla con el código 4 hasta que el usuario reinstale `deploy/` en el VPS (`docs/despliegue.md` §1.3) y lo vuelva a ejecutar. Es esperado y debe constar en el PR.
- **RN-5.** Las cuatro pruebas nuevas protegen comportamiento que ya existe en producción y no cambian código de producción.
- **RN-6.** Retirar código de `core` no cambia lo observable:
  - **siembra de una instalación nueva (`seedPages`):** la vigente y la anterior son la semilla sin las listas congeladas, con la marca `seed` y el log `page_seeded`. Es idempotente y, ante concurrencia, registra `page_seed_skipped`;
  - **control del bot de la `api`:** funciona en un modo único, con el mantenimiento y la auditoría de caducidades.
- **RN-7.** El tipo de `page_import.source` que se lee de la base sigue aceptando `'current' | 'previous' | 'seed'` (`packages/core/catalog/page-store.ts:53`): producción tiene marcas históricas con esos valores.

## Requisitos

**RF-1. Agentes (autorizados)**
- `senior-qa.md:50`: el contenido estático de cada negocio está en `restaurante/landing-pages/src/content/`. Los datos editables (productos y datos de página) están en MySQL y se sirven por la `api`, con semillas en `restaurante/packages/core/catalog/seeds/`.
- `senior-qa.md:54`: `npm test` ejecuta Vitest en las tres apps, con pruebas en `tests/unit/` y `tests/integration/` de cada una. Las pruebas HTTP usan `listenLocal`: Supertest en `landing-pages`, `fetch` en `api` e `inventory-manager`. Los módulos de `public/js` se prueban con jsdom.
- `business-analyst.md:49` y `:98`: la misma precisión sobre el contenido.
- Solo esas líneas.

**RF-2. README**
- `:1832`: las imágenes de cada platillo van con el platillo en los datos editables (MySQL; semilla en `packages/core/catalog/seeds/<negocio>.json`).
- `:1690`: precisar que es la `api` la que verifica la base y la que usa `DATABASE_ALLOW_NEWER_SCHEMA=true` en la vuelta atrás.

**RF-3. `docs/arquitectura.md`.** La tabla "Dónde queda el código actual" se conserva como histórica. Una nota, o el cambio de la columna "Hoy" por "Antes del paso 2", deja claro que describe el punto de partida del plan y no el estado actual.

**RF-4. Etiqueta y comentarios**
- `smoke.sh:217`: la etiqueta describe lo que se comprueba ("la app enlaza al admin nuevo"), sin "modo de solo lectura de productos".
- Los comentarios de A citan el estado actual: datos editables en la `api` y semillas en `core`, sin `/admin/<negocio>`, `./seed.json` ni `landing-pages/src/repositories/`.

**RF-5. `deploy.sh` y dependientes**
- Se cumplen RN-1 a RN-4.
- El escenario de `smoke.sh` "api rota tras una migración nueva" sigue comprobando el código 15 y que la app no cambia (mismo contenedor y misma imagen), con el comentario actualizado.

**RF-6. Pruebas permanentes**

Las cuatro llevan nombre de dominio y ninguna lleva el sufijo `qa-req-f-*`.

- **QA-37 (límite de marcas de "bloqueo quitado")**
  - Ubicación: `api/tests/unit/bot-control.test.ts`, con el store en memoria y una clave.
  - Preparación: 1001 números distintos, cada uno con alta manual y baja, en orden.
  - Resultado esperado:
    - `takeReleased` del primero devuelve `false` (la marca se olvidó);
    - `takeReleased` del segundo y del último devuelven `true`;
    - un segundo `takeReleased` del último devuelve `false` (de un solo uso).
  - Por P1 A, la prueba no exige el caso de DEF-002.
- **QA-65 (escritura durante un refresco)**
  - Ubicación: el mismo archivo. El store en memoria se envuelve para que las lecturas del refresco (`activeBlocks`, `getControl` y `automaticBlocksSince`) esperen hasta que la prueba las libere.
  - Secuencia:
    1. empieza un refresco con la copia ya vieja;
    2. la escritura termina mientras el refresco está pendiente;
    3. el refresco se libera con el estado leído antes de la escritura;
    4. la copia en memoria refleja la escritura.
  - Escrituras que se comprueban:
    - (a) `setPaused(true, …)`: `isPaused()` es `true`;
    - (b) `blockManual`: `isBlocked` es `true`;
    - (c) `unblock` de un bloqueo existente: `isBlocked` es `false`.
  - El reloj lo controla la prueba, con temporizadores falsos o la opción `now`.
- **Degradación cruzada 1**
  - Ubicación: `landing-pages/tests/integration/user-repository.test.ts`, bloque "D-7", MySQL real.
  - Preparación: A y B son los dos únicos administradores activos. A la vez, A cambia a B a editor y B cambia a A a editor.
  - Resultado esperado:
    - exactamente una operación se cumple y la otra falla con `LastAdminError`;
    - queda exactamente un administrador activo;
    - la auditoría registra un solo `update` de rol.
- **Degradación cruzada 2**
  - Ubicación: el mismo archivo y el mismo bloque.
  - Preparación: a la vez, A pasa a editor y B se desactiva.
  - Resultado esperado: exactamente una operación se cumple, la otra falla con `LastAdminError` y queda exactamente un administrador activo.
- Condiciones comunes:
  - antes de añadir cada prueba se comprueba que no existe una equivalente;
  - en QA se comprueba que cada una falla si se quita la protección que cubre. La mutación no se queda en el repositorio;
  - las dos de degradación cruzada siguen el patrón de la prueba existente "dos desactivaciones simultáneas" (`user-repository.test.ts:99`).

**RF-7. Retirada del modo `'panel'`**
- Se retiran la opción `mode` de `createBotControl`, sus ramas, `loadUsageFromStore` y la cabecera que los describe (`bot-control.ts:38-42`).
- `api/tests/unit/bot-control-timers.test.ts` se adapta:
  - el "otro proceso" que escribe (pausa, alta y baja) pasa a ser una segunda instancia en modo normal sobre el mismo store;
  - se mantienen los tres casos de refresco periódico;
  - el caso "el panel no audita" se reformula para que siga cubierto que cada caducidad se audita una sola vez con el mantenimiento horario.
- La cabecera de la prueba ya no habla del "/admin actual".

**RF-8. Retirada de las ramas muertas de `planPageImport`**
- Se retiran:
  - las ramas `current` y `previous`;
  - el parámetro `existing` y la negativa con `PAGE_IMPORT_SEED_REFUSED`;
  - `storable`, `choosePageSource`, `seedCandidates` y `PageImportCandidates`.
- Se conservan `toStored` (que quita las listas congeladas), `allMarked` y la lógica de concurrencia de `seedPages`.
- `seedPages` no cambia lo que escribe (RN-6 y RN-7).
- Se actualizan los comentarios del módulo.
- `landing-pages/tests/unit/page-import.test.ts`:
  - se retiran los 10 casos de ramas muertas;
  - se conserva el CA-5, adaptado;
  - queda cubierto que la página sembrada no lleva las listas congeladas.
  - Si el archivo queda vacío, se borra y sus casos válidos pasan a una prueba existente de `seedPages` o de la instalación.

## Criterios de aceptación

- **CA-1.** `senior-qa.md` y `business-analyst.md` solo cambian en las líneas de RF-1. `git diff` no toca otros archivos de `.claude/` (salvo este ticket).
- **CA-2.** Una búsqueda en `restaurante/` (sin `node_modules`, sin `.claude/docs/` y sin las secciones históricas fechadas de `docs/arquitectura.md`) no encuentra ninguno de estos textos:
  - `seed.json` fuera de un contexto histórico;
  - `src/repositories/` como ubicación vigente;
  - "solo lectura de productos";
  - "recreada con `DATABASE_ALLOW_NEWER_SCHEMA`";
  - "recrea la app";
  - `/admin/molotes` o `/admin/birria` en comentarios.

  Cada excepción que quede se justifica una a una en el PR.
- **CA-3.** Fallos de la api o de inventory-manager con una migración nueva, comprobados con `deploy/ci/smoke.sh` real en verde:
  - **api nueva rota:** `deploy.sh` termina con 15, la app conserva el mismo contenedor y la misma imagen, el log no contiene "se recrea" y el mensaje dice "la app no se tocó";
  - **inventory-manager roto:** lo mismo, con el código 16.
- **CA-4.** En esos dos casos ningún camino lleva al código 22, y `deploy.sh` ya no contiene el registro `${result}_app_unhealthy`.
- **CA-5.** Siguen en verde:
  - en `smoke.sh` real, la vuelta atrás tras una migración nueva (21) y el resto de escenarios: 22 con la api anterior rota, webhook, y `.env` con la bandera, que da el código 3;
  - `deploy/ci/resumen-test.sh`;
  - `shellcheck`.
- **CA-6.** Los resúmenes del CI de los códigos 15 y 16 no mencionan recreación ni `DATABASE_ALLOW_NEWER_SCHEMA`. `resumen-test.sh` comprueba "la app no se tocó" en los dos.
- **CA-7.** Documentación y despliegue del PR 3:
  - `docs/despliegue.md` describe lo de CA-3 y CA-4;
  - el PR 3 incluye el aviso de RN-4;
  - tras el merge, la reinstalación de `deploy/` en el VPS y la nueva ejecución del job `deploy` terminan en 0, o queda registrado como pendiente del usuario.
- **CA-8.** Las cuatro pruebas de RF-6 existen y pasan, y fallan con su mutación:
  - **QA-37:** quitar el límite, o expulsar la marca más reciente;
  - **QA-65:** quitar la comprobación de `localVersion` en `load`;
  - **degradación cruzada:** quitar el bloqueo o la recomprobación de "último administrador" en `update` y `setActive`.
- **CA-9.** No queda ninguna referencia a `mode`/`'panel'` en `createBotControl` ni en sus pruebas. Las pruebas de refresco periódico y la de una única auditoría por caducidad siguen en verde.
- **CA-10.** `planPageImport` (o lo que lo sustituya) no tiene ramas `current`, `previous` ni `existing`. Siguen en verde las pruebas de la instalación nueva:
  - `api/tests/unit/admin-bootstrap.test.ts`;
  - `landing-pages/tests/integration/server-startup-base.test.ts`;
  - la de `seedPages`.

  Una prueba comprueba que la página sembrada no lleva las listas congeladas.
- **CA-11.** `npm run typecheck`, `npm run lint` y `npm test` (tres apps y paquetes) en verde. En cada PR, el CI (`calidad`, `docker`, `auditoria` y `pruebas`) está en `pass`, no en `skipping`.
- **CA-12.** Sin cambios en el HTML ni las cabeceras de `/`, `/molotes` y `/birria`, ni en las respuestas de la `api` y de `inventory-manager`. Se comprueba antes y después en el PR 2.
- **CA-13.** Ningún archivo de pruebas pasa de 20 s en el CI.

## Casos límite

- Fallo de la api con una migración nueva y la app ya caída antes de desplegar: antes podía acabar en 22; ahora termina en 15 y la app sigue como estaba. Su salud se diagnostica aparte.
- Primer despliegue sin la app en marcha: sin cambios.
- PR pendientes de desplegar cuando se hace el merge del PR 3: todos fallan con 4 hasta reinstalar `deploy/`.
- Marcas históricas `current` o `previous` en `page_import` de producción: se siguen leyendo (RN-7).
- QA-65 con el refresco perezoso y el temporizador a la vez: la prueba controla el reloj.

## Dependencias

- REQ-F-045 (DONE).
- Acceso del usuario al VPS para reinstalar `deploy/` (RN-4).
- El MySQL de pruebas, para la degradación cruzada.
- Rama destino: `main` (no es un paso de la épica, `.claude/rules/git.md`). Si `epic/arquitectura` sigue viva, después se integra `main` en ella.

## Riesgos

- **R-1.** El job `deploy` queda en rojo (código 4) entre el merge del PR 3 y la reinstalación de `deploy/`. Mitigación: hacer el merge cuando el usuario pueda reinstalar enseguida.
- **R-2.** Un 15 o un 16 con la app enferma ya no avisa con un 22. Mitigación: este despliegue no toca la app, y su salud se ve en el sitio.
- **R-3.** Simplificar `planPageImport` puede romper la siembra de una instalación nueva. Mitigación: CA-10, RN-6 y las pruebas que se conservan ("no arranca con base inválida" y la cadena de punta a punta).
- **R-4.** Las pruebas de concurrencia pueden ser inestables. Mitigación: el patrón existente, sin esperas fijas ni `retry`.
- **R-5.** Se puede perder la cobertura de "una sola auditoría por caducidad" al quitar el caso del panel. Mitigación: CA-9.

## Action Plan

Tres PR a `main`, en este orden:

1. **PR 1. Textos y referencias, sin cambio de comportamiento (A; RF-1 a RF-4).**
   - Contenido: los agentes autorizados, el README, la nota de `arquitectura.md`, la etiqueta de `smoke.sh:217` y los comentarios de código.
   - `smoke.sh` no forma parte de la suma de `deploy/`: no hace falta reinstalar.
   - QA: CA-1, CA-2 (parte de textos) y CA-11.
2. **PR 2. Pruebas y código de `core` (B; RF-6 a RF-8).**
   - Orden: primero las cuatro pruebas, en verde sobre el código actual; después la retirada del modo `'panel'` y de las ramas de `planPageImport`, con sus pruebas adaptadas.
   - QA: CA-8 a CA-13, con mutaciones que no se commitean.
3. **PR 3. `deploy.sh` (C; RF-5).**
   - Contenido: `deploy.sh`, `resumen.sh`, `smoke.sh` y `docs/despliegue.md`.
   - QA: `smoke.sh` real completo (incluidas la vuelta atrás y los 22), `resumen-test.sh`, `shellcheck`, CA-2 (parte de despliegue) y CA-3 a CA-7.
   - Tras el merge: el usuario reinstala `deploy/` y vuelve a ejecutar el job (CA-7).
   - Va el último y solo, para que el código 4 no se mezcle con otros cambios y se pueda revertir por separado.

En todos los PR, las sondas y mutaciones de QA no se commitean, y la limpieza sigue `.claude/rules/testing.md`.

## Trazabilidad

| Origen | Requisito | CA | PR |
| --- | --- | --- | --- |
| REQ-F-045, Seguimiento (a), parte autorizada | RF-1 | CA-1, CA-2 | 1 |
| Textos desfasados detectados y comentarios adicionales (P2) | RF-2 a RF-4 | CA-2 | 1 |
| REQ-F-045, Seguimiento (b); hecho 1 | RF-5, RN-1 a RN-4 | CA-3 a CA-7 | 3 |
| REQ-F-045, Seguimiento (c); O-1 del QA PR 2; REQ-F-043, QA-37 y QA-65 | RF-6, RN-5 | CA-8, CA-13 | 2 |
| REQ-F-045, Seguimiento (d); hechos 5 y 6 | RF-7, RF-8, RN-6, RN-7 | CA-9, CA-10, CA-12 | 2 |

## Revisión técnica

Revisión de `senior-fullstack` (2026-11-17) contra `main` en `914ab18`. CodeGraph para el código indexado; lecturas dirigidas para shell, Markdown y `.claude/`. NotebookLM no se consultó: las herramientas MCP del servidor `notebooklm` no están expuestas en esta sesión.

### Hechos del ticket comprobados

- **Números de línea:** todos siguen vigentes (`deploy.sh` 9-19, 307-329, 317, 319-320, 325, 355 y 401; `compose.prod.yaml` 100-178 y 202; `smoke.sh` 217 y 550-552; `resumen.sh` 137 y 140; `despliegue.md` 122-133, 653, 720 y 910-911; `README.md` 1690 y 1832; `arquitectura.md` 356-370; `bot-control.ts` 38-42, 104, 294-300, 342, 454 y 553; `bot-control-timers.test.ts:29`; `page-import.ts:137`; `page-import.test.ts:85`; `page-store.ts:53`; `user-repository.test.ts:99`; `senior-qa.md` 50 y 54; `business-analyst.md` 49 y 98; REQ-F-043 897 y 937).
- **Hecho 1, `protect_running_app`:** confirmado. El servicio `app` solo interpola `RESTAURANTE_APP_IMAGE`, dominios, el token interno y las `WHATSAPP_*`, y solo depende de `mysql`. Con `--no-deps`, `up -d app` no cambia su configuración y compose no lo recrea: la rama no hace nada útil. Hoy hay **cuatro caminos al 22**: (1) 15 con migraciones nuevas y la app enferma o sin Traefik (`api_failed_app_unhealthy`); (2) lo mismo con 16 (`inventory_failed_app_unhealthy`); (3) `health_failed_api_not_restored` (`:419`); (4) `health_failed_rollback_failed` (`:426`). El cambio quita (1) y (2); (3) y (4) siguen igual (RN-2).
- **Hechos 5 y 6:** confirmados. `mode: 'panel'` solo aparece en `bot-control.ts` y en `bot-control-timers.test.ts:29`; `api/src/server.ts`, `api/scripts/bot-chat.ts`, `webhook-app.ts` y los soportes de prueba no lo pasan. `planPageImport` solo lo llama `seedPages`, con `seedCandidates` (`seeded: true`): `choosePageSource` siempre devuelve `seed`/`missing` y `previous = current`. `choosePageSource`, `PAGE_IMPORT_SEED_REFUSED`, `PageImportCandidates`, `PageImportDecision`, `PageImportProblem` y `PageImportSource` no se usan fuera de `page-import.ts` y de `landing-pages/tests/unit/page-import.test.ts`.
- **Hecho 8 (DEF-002):** confirmado en `bot-control.ts:294-300`.
- **QA-37, QA-65 y degradación cruzada sin prueba equivalente:** confirmado.
  - `takeReleased` solo se prueba en `api/tests/unit/bot-control-reached.test.ts:100-118` (uso único, número que no es el quitado, id inexistente). Nada prueba el límite de 1000.
  - Ninguna prueba cubre una escritura durante un refresco pendiente (`localVersion` no aparece en ninguna prueba).
  - `user-repository.test.ts:99` y `last-admin-concurrency.test.ts` cubren dos `setActive` simultáneos y `setActive` contra `recover`. Ninguna cubre `update` contra `update` ni `update` contra `setActive`.

### Hallazgos (no bloquean; cada uno lleva una recomendación en el plan)

- **H-1. Lo que queda muerto en `deploy.sh`.** Sin la rama, `MIGRATIONS_BEFORE` y `MIGRATIONS_AFTER` (`:246`, `:252`) y `applied_migrations()` (`:182-195`) ya no se usan. `shellcheck` avisaría de las variables sin usar (SC2034) y fallaría el paso del CI, así que se retiran. De paso, cada despliegue hace dos `exec` menos en MySQL. Sin efecto observable. También dejan de existir los resultados `api_failed_app_unhealthy` e `inventory_failed_app_unhealthy` de `releases.log`; nada los lee (`ops/`, `docs/` y CI revisados).
- **H-2. `resumen-test.sh` ya pasa hoy.** Ya comprueba "la app no se tocó" en 15 y 16 (`:116`, `:158`), y los textos actuales lo contienen ("…la app no se tocó, salvo que…"). Para que CA-6 detecte algo, hay que añadir `no_contiene` de `recreada` y de `DATABASE_ALLOW_NEWER_SCHEMA` en los dos casos.
- **H-3. `smoke.sh` no tiene el caso "inventory-manager roto con una migración nueva"** que pide CA-3. La comprobación del id del contenedor (`:552`) da lo mismo antes y después del cambio, porque compose nunca recreó la app. Lo que sí distingue el cambio es el log (`$WORK/deploy-<n>.log`): sin "se recrea" y con "la app no se tocó".
  - Para el caso de inventory hacen falta una segunda migración compatible y dos imágenes derivadas más (`migrate` con las dos migraciones y una `api` que las conozca). Además tiene que ser el último escenario: una base con esa migración rompe la `api` de los escenarios siguientes.
  - Tras el cambio, ese camino ya no depende de las migraciones: el escenario solo demuestra que la rama desapareció. Ver P-T3.
- **H-4. Dónde poner QA-37.** Las pruebas de la marca de bloqueo quitado están en `bot-control-reached.test.ts` (bloque "marca de bloqueo quitado (DT-1)", con su `setup`), no en `bot-control.test.ts`. Ver P-T2.
- **H-5. Mutaciones de la degradación cruzada (CA-8).** Hay dos protecciones: la transacción `Serializable` (`WRITE_TX`) y la recomprobación `assertActiveAdmin`. No hay un `FOR UPDATE` explícito.
  - Quitar `assertActiveAdmin` de `update` o de `setActive` hace fallar la prueba siempre.
  - Bajar el aislamiento depende de que las dos transacciones se solapen. Con una sola ejecución (P5 A) la mutación puede no detectarse en cada vuelta. El QA debe repetir esa mutación en una sonda que no se commitea; la protección del aislamiento con 50 repeticiones ya la cubre `last-admin-concurrency.test.ts`.
- **H-6. Comentarios desfasados fuera de la lista aprobada (P2).** Ver P-T1.
  - `landing-pages/src/views/landings/index.ts:22-24` ("repositorio de menús");
  - `packages/core/bot-control/index.ts:2`, `bot-config.ts:7-8` y `api/src/bot/chat-bot.ts:13` ("la página "Bot" de /admin", "en landing-pages");
  - `inventory-manager/tests/unit/product-form.test.ts:7` ("el /admin actual");
  - `packages/core/catalog/memory-page-store.ts:12` y `:20` ("`changes.jsonl`", "la importación").
  - Los de `bot-control.ts` (`:23-24`, `:31`, `:38-42`) y `page-import.ts:6-16` y `:29` ya entran en el PR 2 con RF-7 y RF-8.
- **H-7. La concurrencia de `seedPages` (`page_seed_skipped`) no tiene prueba permanente.** RF-8 no la toca (la conserva tal cual), así que no se añade. El QA la comprueba con una sonda que no se commitea (dos `seedPages` a la vez sobre MySQL).
- **H-8. Excepciones previsibles de CA-2,** a justificar en el PR:
  - `packages/core/catalog/seeds.ts:9` ("antes en …/seed.json", histórico);
  - `docs/arquitectura.md` 358-370 (P3) y 445 y 470-476 (secciones fechadas);
  - `docs/despliegue.md:677` (`PAGE_IMPORT_SEED_REFUSED` en el procedimiento de vuelta a una app anterior a REQ-F-045);
  - `packages/core/catalog/product-form-fields.ts:5` ("movidos del /admin de landing-pages … retirado", histórico);
  - las URL `/api/v1/admin/molotes|birria/...` de las pruebas de `api` e `inventory-manager` (no son comentarios).
- **H-9. `epic/arquitectura` sigue viva** (un commit por delante de `main`). Según `.claude/rules/git.md`, tras cada PR de este ticket a `main` toca integrar `main` en la épica con un PR propio. No es parte de este ticket.

### Preguntas (con recomendación; aprobar el plan las acepta)

- **P-T1.** ¿Entran en el PR 1 los comentarios de H-6? Solo son comentarios y no tienen riesgo. **Recomendado: sí.**
- **P-T2.** ¿QA-37 va en `bot-control-reached.test.ts`, junto a las pruebas de DT-1 (H-4), en vez de `bot-control.test.ts`? QA-65 se queda en `bot-control.test.ts`. **Recomendado: sí.**
- **P-T3.** El caso "inventory-manager roto con una migración nueva" de CA-3 (H-3):
  - **A (recomendada):** el QA lo ejecuta en una copia de `smoke.sh` que no se commitea. El `smoke.sh` del PR solo añade al escenario existente (run 9) las comprobaciones del log y cambia sus textos.
  - **B:** se queda en `smoke.sh`, como último escenario, con las dos imágenes derivadas. Cuesta unos 1-2 minutos más en el job `docker` de los PR a `main`.

## Technical Action Plan

### Objetivo técnico

Cerrar REQ-F-045 sin cambiar el comportamiento de producción, salvo en `deploy.sh`:

- textos y comentarios con el estado actual (PR 1);
- cuatro pruebas funcionales y la retirada del código muerto de `core` (PR 2);
- `deploy.sh` sin la falsa recreación de la app ni el 22 engañoso (PR 3).

Tres PR a `main`, en orden y cada uno desde `main` actualizado:

- `feature/REQ-F-047-limpieza-posterior-req-f-045-1-textos`;
- `feature/REQ-F-047-limpieza-posterior-req-f-045-2-core`;
- `feature/REQ-F-047-limpieza-posterior-req-f-045-3-deploy`.

El ticket pasa a `in-progress/` en la rama del PR 1 y va en los tres.

### PR 1. Textos y referencias (RF-1 a RF-4)

**Archivos**

- `.claude/agents/senior-qa.md`: solo las líneas 50 y 54 (texto de RF-1).
- `.claude/agents/business-analyst.md`: solo las líneas 49 y 98.
- `restaurante/README.md`:
  - `:1687-1690`: es la `api` la que verifica la base y no arranca sobre una migrada más nueva, salvo en la vuelta atrás con `DATABASE_ALLOW_NEWER_SCHEMA=true`;
  - `:1832`: imágenes de cada platillo en los datos editables (MySQL; semilla en `packages/core/catalog/seeds/<negocio>.json`).
- `restaurante/docs/arquitectura.md` 356-370: el título pasa a "Dónde quedó el código (punto de partida del plan)", con una nota de que describe el `src/` anterior al paso 2, y la columna "Hoy" pasa a "Antes del paso 2". Las filas no cambian.
- `restaurante/deploy/ci/smoke.sh:217`: la etiqueta pasa a `'la app enlaza al admin nuevo'`. No está en la suma de `deploy/` (`DEPLOY_FILES`), así que no hay que reinstalar nada.
- Comentarios de `landing-pages/src/content/molotes/index.ts:9-13`, `landing-pages/src/content/birria/index.ts:11-15` y `packages/core/catalog/published.ts:5-10`: los datos editables están en MySQL y los sirve la `api` (la landing los recibe con caché y, si no responde, usa la semilla de `packages/core/catalog/seeds/`); quitar `/admin/<negocio>`, `./seed.json` y `landing-pages/src/repositories/`, y "caché del bot y de /admin".
- Con P-T1, los comentarios de H-6.

**Orden:** agentes → README → `arquitectura.md` → `smoke.sh` → comentarios → búsqueda de CA-2 → validación.

**Pruebas:** ninguna nueva. `npm run typecheck`, `npm run lint`, `npm test`, `shellcheck` sobre `deploy/ci/smoke.sh` y `bash -n`.

**Riesgos:** mínimos. Que `git diff -- .claude/` toque algo más que las cuatro líneas autorizadas y el ticket: se comprueba con `git diff -U0 -- .claude/agents/`.

**Comprobaciones que pediría al QA:**

- CA-1: `git diff -U0 main -- .claude/` solo con esas cuatro líneas y el ticket;
- CA-2 (textos) con la búsqueda del criterio y las excepciones de H-8;
- CA-11, con el CI en `pass` y no en `skipping` (el PR toca `.ts`, así que las validaciones corren).

### PR 2. Pruebas y código de `core` (RF-6 a RF-8)

**Orden obligatorio:** primero las cuatro pruebas, en verde sobre el código actual (prueban comportamiento que ya existe, RN-5). Después, la retirada del modo `'panel'` y la de las ramas de `planPageImport`, cada una con sus pruebas adaptadas.

**1. QA-37.** Con P-T2, en `api/tests/unit/bot-control-reached.test.ts`, bloque "marca de bloqueo quitado (DT-1)".

- Usa su `setup` (store en memoria, reloj fijo, una clave).
- Para 1001 números distintos y válidos (`52155` + 8 dígitos, ninguno del personal): `blockManual` → id del bloqueo (de `store.activeBlocks` o `snapshot().blocks[0]`) → `unblock`.
- Espera:
  - `takeReleased(primero) === false`;
  - `takeReleased(segundo) === true`;
  - `takeReleased(último) === true` y, otra vez, `false`.
- No ejercita DEF-002 (P1 A). Duración esperada: menos de 1 s.

**2. QA-65.** En `api/tests/unit/bot-control.test.ts`, bloque "base de datos caída (RF-3.8, CA-13)" o uno nuevo, "copia en memoria".

- Envoltorio del store en memoria: `activeBlocks`, `automaticBlocksSince` y `getControl` leen del store real en el momento de la llamada y, solo si la prueba "armó" la puerta, esperan a que la libere antes de devolver lo leído (el estado de antes de la escritura).
- Secuencia, con reloj fijo (opción `now`):
  1. `init`;
  2. armar la puerta;
  3. `const pending = control.refresh()`;
  4. la escritura completa (`setPaused(true)`, `blockManual` o `unblock` de un bloqueo creado antes de armar);
  5. liberar y `await pending`;
  6. comprobar `isPaused()` (`true`) o `isBlocked` (`true` en el alta, `false` en la baja).
- Tres casos, con `it.each` o tres `it`.
- La puerta se desarma al liberarla: así ningún refresco perezoso posterior se queda colgado.

**3. Degradación cruzada.** En `landing-pages/tests/integration/user-repository.test.ts`, bloque "D-7", una ejecución cada una (P5 A), con el patrón de `:99`.

- **Caso 1:** `Promise.allSettled([users.update(b.id, editor('b'), actorA), users.update(a.id, editor('a'), actorB)])`.
  - Exactamente una se cumple y la otra falla con `LastAdminError`.
  - `prisma.user.count({ role: 'admin', active: true }) === 1`.
  - `userAudit` con `action: 'update'` = 1.
- **Caso 2:** `update(a → editor)` en paralelo con `setActive(b, false)`.
  - Exactamente una se cumple y la otra falla con `LastAdminError`.
  - Un administrador activo.

**4. RF-7. Retirada del modo `'panel'`** (`packages/core/bot-control/bot-control.ts`).

- Se quitan `mode` de `BotControlOptions` y del destructurado, `loadUsageFromStore`, la línea `:454` y la rama de `:553`. Así `maintenance()` siempre audita, purga y refresca.
- Se reescribe la cabecera (`:22-44`) con el estado actual: la usa la `api`, el bot y la administración (`/api/v1/admin/.../bot`) en el mismo proceso. Se quitan la viñeta "Dos papeles" y las menciones a la página "Bot" de `/admin`.
- Se ajustan los comentarios de `:451`, `:469` y `:549-550`: "panel" pasa a "administración".
- `api/tests/unit/bot-control-timers.test.ts`:
  - `twoProcesses` crea `writer` (una segunda instancia sin `mode`) y `bot` sobre el mismo store;
  - los tres casos de refresco periódico no cambian salvo el nombre (`panel` pasa a `writer`) y los textos "/admin" ("la administración");
  - el caso del mantenimiento pasa a llamarse "cada hora audita cada caducidad una sola vez": sin `panel.maintenance()`, con `expiredBefore === 1` tras 25 h de temporizadores y 1 tras dos pasadas más;
  - la cabecera ya no habla del "/admin actual".

**5. RF-8** (`packages/core/catalog/page-import.ts`).

- Se quitan `choosePageSource`, `planPageImport`, `seedCandidates`, `storable`, `PAGE_IMPORT_SEED_REFUSED`, `PageImportCandidates`, `PageImportDecision`, `PageImportProblem` y `PageImportSource`, y las constantes y los imports que solo usaban ellos (`MAX_REVISION`, `MAX_DATE_LENGTH`, `wellFormed`, `AUTHOR_MAX_LENGTH`, `textLength`).
- `seedPages` construye cada plan con una función interna, `seedPlan(business, seed)`:
  - `current = toStored(seed)`;
  - `previous = current`;
  - `source: 'seed'`;
  - `sourceVersion = versionOf(seed)`.
- `PageImportPlan` se queda sin `problem`. La transacción, `markImported`, `allMarked`, `confirmedByOther`, `page_seeded` y `page_seed_skipped` no cambian.
- `PageImportMark.source` (`page-store.ts:53`) y `isImportSource` de Prisma siguen aceptando `'current' | 'previous' | 'seed'` (RN-7).
- Se reescribe la cabecera del módulo.
- `landing-pages/tests/unit/page-import.test.ts` sustituye sus casos por uno de `seedPages` sobre `createMemoryPageStore()` (instalación nueva):
  - devuelve los dos negocios;
  - `current` y `previous` de cada negocio son iguales;
  - `JSON.parse(current.data)` es `pickPageData(seed)`: no lleva las listas congeladas (ni `menu.items`, ni bebidas, ni platillos);
  - la marca tiene `source: 'seed'` y `sourceVersion: '0@seed'`;
  - el log `page_seeded` sale con `source: 'seed'`.
- No se mueve de app (fuera de alcance). La idempotencia ya la cubre `server-startup-base.test.ts:84`.

**Pruebas que se ejecutan:**

- `npm run typecheck`, `npm run lint` y `npm test` completos;
- en particular `bot-control*.test.ts`, `admin-bootstrap.test.ts`, `server-startup-base.test.ts`, `api-process.test.ts`, `user-repository.test.ts`, `last-admin-concurrency.test.ts` y `page-import.test.ts`;
- la duración por archivo con `--reporter=verbose` (CA-13).

**Riesgos:**

- Inestabilidad de la degradación cruzada (R-4). Mitigación: el patrón existente, sin esperas fijas ni `retry`.
- Que una prueba de QA-65 se quede colgada. Mitigación: la puerta se desarma y la prueba siempre libera en `finally`.
- Pérdida de cobertura de la auditoría única (R-5). Mitigación: el caso se reformula, no se borra.
- Que la siembra cambie (R-3). Mitigación: la prueba nueva de `seedPages` y CA-10.

**Comprobaciones que pediría al QA:**

- CA-8 con mutaciones que no se commitean:
  - QA-37: quitar el límite, y expulsar la marca más reciente;
  - QA-65: quitar `if (version !== localVersion) return;` en `load`;
  - degradación cruzada: quitar `assertActiveAdmin` en `update` y en `setActive`; y bajar `isolationLevel`, repetido en una sonda (H-5);
- CA-9 y CA-10;
- la concurrencia de `seedPages` (H-7) con una sonda;
- CA-12: HTML y cabeceras de `/`, `/molotes` y `/birria`, y las respuestas de `api` e `inventory-manager`, iguales antes y después;
- CA-13.

### PR 3. `deploy.sh` (RF-5)

**`restaurante/deploy/deploy.sh`**

- `protect_running_app` pasa a ser `fail_before_app <resultado> <código> <mensaje>`: `record "$result"` y `fail "$code" "$message; la app no se tocó"`. Se ajustan las dos llamadas (`:362` y `:375`).
- Se quitan:
  - el comentario DEF-001 (`:307-312`);
  - `MIGRATIONS_BEFORE` y `MIGRATIONS_AFTER`, y `applied_migrations()` con su comentario (H-1).
- Se revisa la cabecera (`:9-19`). Ya dice "si falla antes del cambio de la app, no la toca"; se añade que en 15 y 16 la app no se toca nunca, haya o no migraciones.
- No cambian:
  - el `export DATABASE_ALLOW_NEWER_SCHEMA=true` de `:355` y de `:401`;
  - `unset` de `:128`;
  - la vuelta atrás, el router del webhook ni los demás códigos (RN-3).

**`restaurante/deploy/ci/resumen.sh` (`:137` y `:140`)**

- "La api nueva no quedó sana: volvió a la anterior (si la había) y la app no se tocó. Causa y solución…"
- "El admin nuevo (inventory-manager) no quedó sano: volvió al anterior (o se detuvo si no lo había) y la app no se tocó. La api nueva sigue en marcha. Causa y solución…"

**`restaurante/deploy/ci/resumen-test.sh`:** en los casos 15 y 16, `no_contiene` de `recreada` y de `DATABASE_ALLOW_NEWER_SCHEMA` (H-2).

**`restaurante/deploy/ci/smoke.sh`, escenario "api rota tras una migración nueva"**

- Comentario `:550-551` actualizado y nombre de la comprobación `:552` ("la app no se tocó").
- Dos comprobaciones nuevas sobre `$WORK/deploy-9.log`: no contiene `se recrea` y contiene `la app no se tocó`.
- Con P-T3 B, además, el escenario final con inventory-manager roto y una segunda migración (H-3).

**`restaurante/docs/despliegue.md`**

- Pasos 6 y 7 (`:122-133`): en 15 y 16 la app nunca se toca, haya o no migraciones.
- Filas de los códigos 15 y 16 (`:910-911`): sin el paréntesis de la recreación.
- No se tocan `:653` ni `:720`.

**`restaurante/README.md:613`:** solo si cambia lo que comprueba `smoke.sh` (P-T3 B), una frase con el caso de inventory-manager tras una migración nueva.

**El PR lleva el aviso de RN-4:** tras el merge, el job `deploy` falla con 4 hasta reinstalar `deploy/` (§1.3) y volver a ejecutarlo.

**Orden:** `deploy.sh` → `resumen.sh` y `resumen-test.sh` → `smoke.sh` → `despliegue.md` (y README) → validación.

**Pruebas que se ejecutan:**

- `shellcheck deploy.sh mysql/initdb/01-usuarios.sh ci/smoke.sh ci/resumen.sh ci/resumen-test.sh`;
- `bash deploy/ci/resumen-test.sh`;
- `deploy/ci/smoke.sh` real en local, si Docker lo permite (si no, el job `docker` del PR a `main` lo ejecuta y se anota en Riesgos o pendientes);
- `npm run typecheck`, `npm run lint` y `npm test`.

**Riesgos:**

- R-1 (job `deploy` en rojo hasta reinstalar): hacer el merge cuando el usuario pueda reinstalar enseguida.
- R-2 (un 15 o un 16 con la app enferma ya no avisa con un 22): documentado en la tabla de diagnóstico.
- Si `smoke.sh` no puede correr en local, la evidencia es solo la del CI.

**Comprobaciones que pediría al QA:**

- `smoke.sh` real completo, incluidos los 21 y 22 y el código 3 (CA-5);
- el log y el mensaje del run 9 (CA-3);
- con P-T3 A, el caso de inventory-manager con una migración nueva en una copia que no se commitea;
- `grep` de `_app_unhealthy`, `se recrea` y `recreada` en `deploy/` (CA-4 y CA-2);
- `resumen-test.sh` (CA-6);
- `shellcheck`;
- `despliegue.md` frente al comportamiento (CA-7).

**Pendiente del usuario tras el merge:** reinstalar `deploy/` en el VPS y volver a ejecutar el job (CA-7).

### Criterios de finalización

- Cada PR con su QA aprobado y el CI (`calidad`, `docker`, `auditoria` y `pruebas`) en `pass`, no en `skipping`.
- CA-1 a CA-13 comprobados en el PR que los cubre.
- Limpieza verificada tras cada ejecución de pruebas y sondas: bases `restaurante_test*`, procesos, `git worktree` y copias de `smoke.sh`.

## Implementation Result

### PR 1. Textos y referencias

#### Rama

`feature/REQ-F-047-limpieza-posterior-req-f-045-1-textos`, creada desde `origin/main` (`914ab18`). Sin commit todavía.

El ticket no estaba en git (no tenía seguimiento), así que se movió de `backlog/` a `in-progress/` con `mv` en lugar de `git mv`. Entrará al repositorio en el commit del PR 1.

#### Cambios realizados

- **RF-1 (agentes):** solo cambian `senior-qa.md:50` y `:54`, y `business-analyst.md:49` y `:98`.
  - Contenido estático en `landing-pages/src/content/`; datos editables en MySQL, servidos por la `api`, con semillas en `packages/core/catalog/seeds/`.
  - `npm test` corre en las tres apps; las pruebas HTTP usan `listenLocal` (Supertest en `landing-pages`, `fetch` en `api` e `inventory-manager`).
- **RF-2 (`README.md`):**
  - 1687-1691: la `api` es la que verifica la base y la que recibe `DATABASE_ALLOW_NEWER_SCHEMA=true` en la vuelta atrás;
  - 1833-1834: imágenes de platillo en los datos editables, con la semilla en `packages/core/catalog/seeds/<negocio>.json`.
- **RF-3 (`docs/arquitectura.md`):** título "Dónde quedó el código (punto de partida del plan)", nota de tabla histórica que remite al §4, y columna "Antes del paso 2". Las filas no cambian.
- **RF-4:**
  - etiqueta de `smoke.sh:217`;
  - comentarios de `content/molotes/index.ts`, `content/birria/index.ts` y `core/catalog/published.ts`. Este último cita a quien de verdad llama a `toPublished`: `product-repository.ts` y `api/src/app.ts`.
- **H-6 (P-T1):** comentarios de `views/landings/index.ts`, `core/bot-control/index.ts`, `bot-config.ts`, `api/src/bot/chat-bot.ts`, `inventory-manager/tests/unit/product-form.test.ts` y `core/catalog/memory-page-store.ts` (`:12` decía "`changes.jsonl`"; es la marca de `page_import` de cada negocio).

- **Extra aprobado por el usuario** ("si lo apruebo e incluyelos"):
  - `README.md:1803`: los datos editables llegan de la `api` (MySQL) y, si no responde, de la semilla;
  - `api/.env.example:111`: la página "Bot" es la del admin nuevo (`inventory-manager`).
  - `api/.env.example` no está en la suma de `deploy/` y ninguna prueba ni el CI lo leen; `deploy/env.production.example` solo lo cita en comentarios.

#### Criterios de aceptación

- **CA-1:** cumplido. `git diff -U0 -- .claude/` solo toca esas cuatro líneas; además está el ticket, sin seguimiento.
- **CA-2 (textos):** cumplido, con estas excepciones justificadas:
  - `core/catalog/seeds.ts:9`: histórico ("antes en …/seed.json");
  - `docs/arquitectura.md:367-369` (tabla histórica, P3) y `:449`: sección fechada;
  - `api/tests` y `inventory-manager/tests`: las URL `/api/v1/admin/molotes|birria`, que no son comentarios.
  - Siguen, por estar previstos en otros PR:
    - `deploy/ci/resumen.sh:137` y `:140` y `docs/despliegue.md:126` (PR 3);
    - `page-import.ts:29`, `bot-control.ts:23` y la cabecera de `bot-control-timers.test.ts` (PR 2).
- **CA-11:** cumplido en local. El CI se comprueba en T4.
- **Suma de `deploy/`** (`compose.prod.yaml`, `deploy.sh`, `mysql/initdb/01-usuarios.sh`): la misma antes y después, `34c2ee77…f30946eeb2`.

#### Validaciones ejecutadas

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin errores ni avisos.
- `npm test` contra el MySQL local: 0. Pasan las tres apps: 49 archivos y 1162 pruebas; 58 y 896; 16 y 278.
- `bash -n deploy/ci/smoke.sh`: correcto.
- `shellcheck deploy.sh mysql/initdb/01-usuarios.sh ci/smoke.sh ci/resumen.sh ci/resumen-test.sh` con `koalaman/shellcheck:stable` en Docker (no está instalado en local): sin avisos.
- Búsqueda de CA-2: resultado arriba.
- Con los dos textos extra: `typecheck` 0, `lint` 0 y la suma de `deploy/` sin cambios (`34c2ee77…`). No se repite `npm test`: solo cambian un Markdown y un comentario de `.env.example`, que ninguna prueba lee.

#### Archivos afectados

- `.claude/agents/senior-qa.md` y `.claude/agents/business-analyst.md`;
- `restaurante/README.md`, `restaurante/docs/arquitectura.md` y `restaurante/deploy/ci/smoke.sh`;
- `restaurante/landing-pages/src/content/molotes/index.ts`, `landing-pages/src/content/birria/index.ts` y `landing-pages/src/views/landings/index.ts`;
- `restaurante/packages/core/catalog/published.ts` y `packages/core/catalog/memory-page-store.ts`;
- `restaurante/packages/core/bot-control/index.ts` y `packages/core/bot-control/bot-config.ts`;
- `restaurante/api/src/bot/chat-bot.ts`, `restaurante/api/.env.example` y `restaurante/inventory-manager/tests/unit/product-form.test.ts`.

#### Riesgos o pendientes

- `docs/arquitectura.md:41` describe el código anterior al plan ("El código ya tenía…"): es histórico y es correcto.
- `README.md:1143` ("la página "Bot"") es correcto: `inventory-manager` tiene esa página.
- **Limpieza:**
  - el MySQL local se levantó para `npm test` y se volvió a detener, como estaba;
  - no queda ninguna base `restaurante_test*` ni ningún proceso de Vitest;
  - la imagen `koalaman/shellcheck:stable` se borró después de usarla;
  - se borraron los registros temporales;
  - `git worktree list` solo muestra el árbol principal.

#### Correcciones tras la ronda 1 de QA (decisión del usuario: "Tu recomendación, no quiero la ruta corta")

- **DEF-001 (`docs/arquitectura.md`, nota de la tabla histórica).** Comprobado con `test -e` en `landing-pages/`:
  - siguen existiendo `src/views`, `src/content`, `src/styles`, `public` y `src/config/env.ts`;
  - ya no existen `src/services/{product-schema,visible-menu,menu-schema,price,slug,business-schedule,authorization,user-schema,admin-auth}.ts`, `src/repositories`, `prisma`, `src/controllers/admin-products-api.ts`, `src/routes/admin-api.ts`, `src/services/whatsapp-bot`, `src/controllers/whatsapp-webhook.ts` ni `src/views/admin`.
  - La nota dice ahora que el `src/` ya estaba en `landing-pages/` desde el paso 1, que lo que se movió a `packages/`, `api/` o `inventory-manager/` ya no está ahí (y que el `/admin` se retiró en REQ-F-045), y que lo que se quedó sigue, con esas cinco rutas. Las filas de la tabla no cambian.
- **O-1 (`packages/core/catalog/product-repository.ts`, solo comentarios).**
  - `:33-35`: en producción solo lo crea `api/src/server.ts:60`. Lo escribe la administración de la `api` y su caché la leen la API pública y el catálogo del bot.
  - `:194`: a `productsFromMenuData` solo la llama `importOnce`, con la semilla ya validada (`validateMenuDocument` en `api/src/install/index.ts:57`).
- **O-3** (`landing-pages/package.json` declara `@restaurante/db`, que su `src/` no usa): no entra en este PR. Queda como hallazgo para otro ticket.
- **Validación:**
  - `npm run typecheck` 0, `npm run lint` 0 y `npm test` 0 contra el MySQL local (1162, 896 y 278 pruebas);
  - el AST sin comentarios de los diez `.ts` del PR es idéntico al de `origin/main` (printer de TypeScript con `removeComments`);
  - la suma de `deploy/` sigue en `34c2ee77…f30946eeb2`.
- **Limpieza:**
  - el MySQL local se levantó y se volvió a detener, sin ninguna base `restaurante_test*`;
  - no quedan procesos de Vitest;
  - se vació el scratchpad (copia de `main`, script de comparación y registros);
  - `git worktree list` solo muestra el árbol principal.

#### Correcciones tras la ronda 2 de QA (DEF-003)

- **`packages/core/catalog/product-repository.ts:34-36`.** La caché la usan el bot (`getPublished`, `api/src/bot/orchestrator.ts:204`) y la administración (`isCacheFresh`, `api/src/admin/product-routes.ts:157`). La API pública no la usa: lee el store en cada petición (`api/src/app.ts:21` y `:107`).
- **`packages/core/catalog/published.ts:8`.** Por coherencia, "la leen" pasa a "la usan".
- **Repaso de todos los comentarios nuevos del PR contra el código:**
  - `api/.env.example:111`: la página "Bot" de `inventory-manager` muestra `previousKeyBlocks` (`inventory-manager/src/views/bot.ts:153-157`).
  - `api/src/bot/chat-bot.ts:13`: `BotProvider` también lo usa la administración (`api/src/admin/index.ts:2` y `bot-routes.ts:12`).
  - `inventory-manager/tests/unit/product-form.test.ts:7`: `/admin` retirado en REQ-F-045.
  - `landing-pages/src/content/{molotes,birria}/index.ts` y `views/landings/index.ts`: datos de la `api` con caché (`landing-products.ts` y `landing-page.ts`, sobre `landing-cache.ts`) y semilla de `loadSeedDocument`, en `packages/core/catalog/seeds/`.
  - `packages/core/bot-control/bot-config.ts` e `index.ts`: ni `landing-pages/src` ni `inventory-manager/src` importan `@restaurante/core/bot-control`; la configuración la lee `api/src/bot/config.ts`.
  - `memory-page-store.ts:12` y `:20`: `imports` es el mapa de las marcas `PageImportMark`, una por negocio; `seed()` deja versiones ya guardadas.
  - `product-repository.ts:194`: `productsFromMenuData` solo la llama `importOnce`, con la semilla validada por `validateMenuDocument` (`api/src/install/index.ts:57`).
  - `published.ts`: `toPublished` lo usan `product-repository.ts` y `api/src/app.ts:107`.
- **Validación:**
  - `npm run typecheck` 0, `npm run lint` 0 y `npm test` 0 contra el MySQL local (1162, 896 y 278 pruebas);
  - el código sin comentarios de los diez `.ts` es idéntico al de `origin/main`;
  - la suma de `deploy/` sigue en `34c2ee77…f30946eeb2`.
- **Limpieza:** MySQL detenido y sin bases `restaurante_test*`, sin procesos de Vitest, scratchpad vacío y un solo `git worktree`.

#### Pull Request del PR 1

- **PR:** https://github.com/orvigas/negocio/pull/165, de `feature/REQ-F-047-limpieza-posterior-req-f-045-1-textos` hacia `main`.
- **Commits:** `af4da63` (`docs: corrige textos y referencias desfasados tras REQ-F-045`) y el de este registro (`docs: registra el Pull Request de REQ-F-047 (PR 1)`).
- **Base:** `origin/main` no había avanzado desde `914ab18`. Suma de `deploy/` sin cambios (`34c2ee77…f30946eeb2`).
- **CI:** se comprueba con `gh pr checks` tras marcar el PR como listo. Este registro se commitea antes, así que el resultado (`calidad`, `docker`, `auditoria` y `pruebas` en `pass`) consta en el PR y en el informe de la fase; se añadirá al ticket en el primer commit del PR 2.
- **Pendiente para el PR 2:** O-4, `restaurante/api/src/bot/config.ts:15-16` ("la página "Bot" de /admin", partido entre dos líneas).
- **Hallazgo para otro ticket:** O-3, `landing-pages/package.json` declara `@restaurante/db` en `dependencies` aunque `landing-pages/src` no lo importe (lo usan sus pruebas).

- **CI del PR 1 (#165, ejecución 44158028233 sobre `967fb70`, con el PR listo):**
  - `calidad`, `docker`, `auditoria`, `pruebas (1/2)`, `pruebas (2/2)`, `verificacion`, `cambios` y GitGuardian: `pass`;
  - `deploy`, `publish`, `vigente` y `validado`: omitidos, lo esperado en un PR.
  - Mergeado en `main` como `4991aa1`.

### PR 2. Pruebas y código de `core`

#### Rama

`feature/REQ-F-047-limpieza-posterior-req-f-045-2-core`, creada desde `origin/main` (`30d322c`, que incluye el PR 1 y el #166). Sin commit.

#### Pruebas añadidas (primero, en verde sobre el código anterior)

Antes de añadirlas se comprobó que ninguna prueba cubría estos casos (revisión técnica).

- **QA-37:** `api/tests/unit/bot-control-reached.test.ts`, bloque "marca de bloqueo quitado (DT-1)" (P-T2): "guarda como mucho 1000 marcas: con 1001 bajas se olvida solo la más antigua".
  - 1001 altas y bajas; `takeReleased` del primero es `false`, del segundo `true` y del último `true`, y una segunda vez `false`.
  - No ejercita DEF-002 (P1 A). Tarda unos 40 ms.
- **QA-65:** `api/tests/unit/bot-control.test.ts`, bloque nuevo "copia en memoria con un refresco en curso (D-T5, RF-3.8)", con tres casos: pausa, alta manual y baja.
  - El store en memoria va envuelto: las lecturas del refresco leen al llamarse y retienen lo leído hasta que la prueba abre la puerta.
  - La prueba espera a que el refresco haya leído (`reading()`) antes de escribir. Sin esa espera, la escritura llegaba al store antes que las lecturas y la prueba no detectaba nada.
- **Degradación cruzada:** `landing-pages/tests/integration/user-repository.test.ts`, bloque D-7 (P5 A), una ejecución cada una, sin esperas fijas ni `retry`.
  - "los dos únicos administradores se degradan el uno al otro a la vez: solo una se aplica", con una sola auditoría `update`;
  - "degradar a un administrador y desactivar al otro a la vez: solo una se aplica".
- Los nombres de las pruebas no llevan "QA-" ni el sufijo `qa-req-f-*`.

#### Mutaciones temporales (no se commitean; revertidas con `git checkout`)

- **M1:** sin `if (version !== localVersion) return;` en `load` → fallan los 3 casos de QA-65.
- **M2:** sin el límite de `MAX_RELEASED` → falla QA-37.
- **M3:** expulsar la marca más reciente en vez de la más antigua → falla QA-37.
- **M4:** `update` sin `assertActiveAdmin` → falla la degradación cruzada 1.
- **M5:** `setActive` sin `assertActiveAdmin` → las dos pruebas nuevas pasan. En la 2, el `setActive` nunca espera al otro y confirma primero, así que la recomprobación de `update` decide. Fallan las existentes CA-10 (`:83`) y "dos desactivaciones simultáneas" (`:99`), que ya cubren esa protección.
- **M4 y M5 juntas** → fallan las dos pruebas nuevas.
- **M6:** aislamiento `ReadCommitted` en vez de `Serializable` → en 10 de 10 ejecuciones falla la degradación cruzada 2 (y la existente de `:99`). La 1 no lo detecta en esas ejecuciones.
- **M7:** la siembra guarda las listas congeladas → falla la prueba de `seedPages`.
- **M8:** la versión anterior distinta de la vigente → falla la prueba de `seedPages`.
- **Equivalencia:** la prueba nueva de `seedPages` pasa con el `page-import.ts` de `main`. La siembra no cambia (RN-6).

#### Retiradas

- **RF-7 (`packages/core/bot-control/bot-control.ts`):**
  - salen la opción `mode`, `loadUsageFromStore`, la rama de `snapshot()` y la de `maintenance()`;
  - la cabecera describe un solo proceso: el bot y su administración (`/api/v1/admin/bot`) en la `api`;
  - "panel" pasa a "administración" en los comentarios de `snapshot` y `blockManual`.
  - Producción nunca pasó `mode`, así que el comportamiento es el del modo `bot` de siempre.
- **`api/tests/unit/bot-control-timers.test.ts`:**
  - la instancia "panel" pasa a ser `writer`, una segunda instancia normal sobre el mismo store, y la cabecera ya no habla del "/admin actual";
  - los tres casos de refresco periódico no cambian;
  - el del mantenimiento pasa a "cada hora audita cada caducidad una sola vez": 1 tras 25 h y sigue en 1 tras dos pasadas más.
- **RF-8 (`packages/core/catalog/page-import.ts`):**
  - salen `choosePageSource`, `planPageImport`, `seedCandidates`, `storable`, `PAGE_IMPORT_SEED_REFUSED`, `PageImportCandidates`, `PageImportDecision`, `PageImportProblem`, `PageImportSource` y sus constantes e imports;
  - `seedPages` usa la función interna `seedPlan`: vigente = anterior = `toStored(seed)`, `source: 'seed'` y `sourceVersion = versionOf(seed)`;
  - la transacción, `allMarked`, `confirmedByOther`, `page_seeded` y `page_seed_skipped` no cambian;
  - `PageImportPlan.source` es `PageImportMark['source']`, que sigue aceptando `'current' | 'previous' | 'seed'` (RN-7).
- **`landing-pages/tests/unit/page-import.test.ts`:** sus 12 casos de las ramas retiradas se sustituyen por uno de `seedPages` sobre `createMemoryPageStore()`. Comprueba:
  - que se siembran los dos negocios;
  - vigente = anterior, con revisión 0;
  - que los datos son `pickPageData(seed)`, sin las listas congeladas;
  - la marca `seed` con `0@seed`;
  - el log `page_seeded`.
- **O-4:** `api/src/bot/config.ts:13-18` ya no cita "la página "Bot" de /admin".
- **Búsqueda multilínea** (uniendo las líneas de comentario) de "página "Bot" de /admin", "/admin actual", "repositorio de menús", `seed.json`, `src/repositories`, "modo panel", "solo lectura de productos" y "recrea":
  - solo quedan textos históricos (`arquitectura.md`, `seeds.ts`, `product-form-fields.ts`);
  - frases correctas sobre el `/admin` retirado (`compose.prod.yaml`, `smoke.sh`, `landing-pages/.env.example` y `admin-moved.ts`);
  - y lo del PR 3 (`deploy.sh`, `resumen.sh` y `despliegue.md`).

#### Criterios de aceptación

- **CA-8:** cumplido (mutaciones arriba). Para la protección de `setActive`, ver M5 y M6.
- **CA-9:** cumplido. Ninguna referencia a `mode` ni a `'panel'` en `createBotControl` ni en sus pruebas; el refresco periódico y la auditoría única, en verde.
- **CA-10:** cumplido. No queda ninguna rama `current`, `previous` ni `existing`. En verde `admin-bootstrap.test.ts`, `server-startup-base.test.ts` y la prueba nueva de `seedPages`, que comprueba que no se guardan las listas congeladas.
- **CA-11:** cumplido en local. El CI se comprueba en T4.
- **CA-12:** no cambia código de las rutas de las landings ni de las respuestas de la `api` o de `inventory-manager`. La comparación de antes y después la hace el QA.
- **CA-13:** en local, los archivos tocados tardan como mucho unos 4 s (`user-repository.test.ts`).

#### Validaciones ejecutadas

- `npm run typecheck`: 0. `npm run lint`: 0.
- `npm test` contra el MySQL local: 0.
  - `api`: 1166 pruebas (+4).
  - `landing-pages`: 887 (+2 de la degradación cruzada, +1 de `seedPages`, −12 de `planPageImport`).
  - `inventory-manager`: 278.
- Suma de `deploy/` sin cambios (`34c2ee77…f30946eeb2`).

#### Archivos afectados

- `restaurante/packages/core/bot-control/bot-control.ts` y `restaurante/packages/core/catalog/page-import.ts`;
- `restaurante/api/src/bot/config.ts`;
- `restaurante/api/tests/unit/bot-control.test.ts`, `bot-control-reached.test.ts` y `bot-control-timers.test.ts`;
- `restaurante/landing-pages/tests/integration/user-repository.test.ts` y `restaurante/landing-pages/tests/unit/page-import.test.ts`.

#### Riesgos o pendientes

- **Cobertura de la degradación cruzada:** detectar la mutación del aislamiento depende del orden de bloqueo de MySQL. En 10 de 10 ejecuciones lo detectó la prueba 2. La protección con 50 repeticiones sigue en `last-admin-concurrency.test.ts`.
- **Concurrencia de `seedPages`** (`page_seed_skipped`): sin prueba permanente (H-7). El QA la comprueba con una sonda.
- **Limpieza:**
  - MySQL local detenido y sin bases `restaurante_test*`;
  - sin procesos de Vitest;
  - scratchpad vacío (la copia temporal de `page-import.ts` se borró);
  - un solo `git worktree`.

#### Pull Request del PR 2

- **PR:** https://github.com/orvigas/negocio/pull/167, de `feature/REQ-F-047-limpieza-posterior-req-f-045-2-core` hacia `main`.
- **Commits:** `66d31f9` (`refactor: retira el modo panel y las ramas muertas de la importación de página (REQ-F-047, PR 2)`) y el de este registro (`docs: registra el Pull Request de REQ-F-047 (PR 2)`).
- **Base:** `origin/main` no había avanzado desde `30d322c`. Suma de `deploy/` sin cambios (`34c2ee77…f30946eeb2`).
- **CI y O-5:** se comprueban con `gh pr checks` tras marcar el PR como listo. El resultado del CI y la duración en el CI de `product-repository-contract-prisma-*` (O-5) constan en el PR y en el informe de la fase, y se añadirán al ticket en el primer commit del PR 3.

### PR 3. `deploy.sh`

#### Rama

`feature/REQ-F-047-limpieza-posterior-req-f-045-3-deploy`, desde `origin/main` en `d06f5d6` (merge del PR #167). Sin commits todavía.

#### Cambios realizados

- **`restaurante/deploy/deploy.sh`:**
  - `protect_running_app` pasa a `fail_before_app <resultado> <código> <mensaje>`: `record "$1"` y `fail "$2" "$3; la app no se tocó"`. Las dos llamadas (15 y 16) la usan.
  - Retirados el comentario DEF-001, `MIGRATIONS_BEFORE`, `MIGRATIONS_AFTER` y `applied_migrations()` con su comentario (H-1): cada despliegue hace dos `exec` menos en MySQL. Desaparecen los resultados `api_failed_app_unhealthy` e `inventory_failed_app_unhealthy` de `releases.log` (nada los lee).
  - Cabecera: en 15 y 16 la app nunca se toca, haya o no migraciones nuevas.
  - Sin cambios (RN-3): el `export DATABASE_ALLOW_NEWER_SCHEMA=true` de la vuelta de la api (15) y de la vuelta atrás (21), el `unset` inicial, la vuelta atrás, el router del webhook, el orden api → inventory-manager → app y los demás códigos. Los dos 22 que quedan son `health_failed_api_not_restored` y `health_failed_rollback_failed` (RN-2).
- **`restaurante/deploy/ci/resumen.sh` (15 y 16):** sin la frase de la recreación ni `DATABASE_ALLOW_NEWER_SCHEMA`; terminan en "…y la app no se tocó."
- **`restaurante/deploy/ci/resumen-test.sh`:** en los casos 15 y 16, `no_contiene` de `recreada` y de `DATABASE_ALLOW_NEWER_SCHEMA` (H-2). Con el `resumen.sh` de `main`, las cuatro comprobaciones nuevas fallan; con el del PR, pasan.
- **`restaurante/deploy/ci/smoke.sh`, escenario run 9:** título "(REQ-F-047)", comentario actualizado, comprobación renombrada a "la app no se tocó (mismo contenedor)" y dos nuevas sobre `$WORK/deploy-9.log`: no contiene `se recrea` y contiene `la app no se tocó` (P-T3 A: sin escenario nuevo).
- **`restaurante/docs/despliegue.md`:** pasos 6 y 7 (en 15 y 16 la app nunca se toca, haya o no migraciones) y filas de los códigos 15 y 16 de la tabla de diagnóstico (sin el paréntesis de la recreación; la del 15 dice que ya no pasa a 22 por la salud de la app y que una app caída se diagnostica aparte, R-2). `:653` y `:720` sin cambios.
- **`restaurante/README.md:613`:** sin cambios (P-T3 A). Ya dice que una `api` rota termina con 15 sin tocar la app, también con migraciones nuevas.

#### Criterios de aceptación

- **CA-2 (parte de despliegue):** `grep` de `se recrea`, `recreada`, `_app_unhealthy`, `protect_running_app`, `applied_migrations`, `MIGRATIONS_BEFORE` y "recrea la app" en `deploy/`, `docs/despliegue.md`, `README.md` y `ops/`. Solo quedan las comprobaciones negativas de `resumen-test.sh` y `smoke.sh` y "una `api` recreada a mano" (`despliegue.md`, fila del 502; no es la app). Cumple.
- **CA-3:** api rota con migración nueva → 15, mismo contenedor y misma imagen, log sin "se recrea" y con "la app no se tocó" (`smoke.sh` real, run 9). El caso de inventory-manager con una migración nueva queda para el QA en una copia que no se commitea (P-T3 A). Cumple en lo que toca al desarrollo.
- **CA-4:** `deploy.sh` ya no contiene `_app_unhealthy` y `fail_before_app` no tiene ningún camino al 22. Cumple.
- **CA-5:** `smoke.sh` real en verde, incluidos 21 (también tras una migración nueva), "22, no 21" con la api anterior sin arrancar, el webhook y `DATABASE_ALLOW_NEWER_SCHEMA en .env -> 3`; `resumen-test.sh` y `shellcheck` en verde. Cumple.
- **CA-6:** cumple (ver `resumen-test.sh`).
- **CA-7:** `despliegue.md` actualizado. El aviso de RN-4 va en el PR (ver "Riesgos o pendientes"). La reinstalación de `deploy/` y la nueva ejecución del job quedan pendientes del usuario tras el merge.
- **CA-11:** `typecheck`, `lint` y `test` en verde en local; el CI se comprobará en T4.

#### Validaciones ejecutadas

- `shellcheck deploy.sh mysql/initdb/01-usuarios.sh ci/smoke.sh ci/resumen.sh ci/resumen-test.sh` (`koalaman/shellcheck-alpine:stable`, ShellCheck 0.11.0, en Docker: no hay `shellcheck` en el host): 0, sin avisos.
- `bash deploy/ci/resumen-test.sh`: "todas las comprobaciones pasaron".
- `deploy/ci/smoke.sh` real, en un contenedor `docker:cli` con el socket de Docker, `--network host` y `SMOKE_WORKDIR` en el scratchpad, con las cuatro imágenes construidas desde la rama: **194 ok, "todas las comprobaciones pasaron"** (salida 0). Run 9: `-> 15`, mismo contenedor, sin "se recrea", con "la app no se tocó", misma imagen v2, sin la bandera, healthy tras reiniciar y 200. Log del run 9: `ERROR: la api nueva no quedó healthy o Traefik no le enruta el webhook; la app no se tocó`.
- `npm ci --strict-allow-scripts`, `npm run db:generate`, `npm run build:css`: 0.
- `npm run typecheck`: 0. `npm run lint`: 0.
- `npm test` (MySQL local): 49 archivos / 1166 pruebas, 58 / 887 y 16 / 278, todo en verde.
- **Suma de control de `deploy/`** (`sha256sum compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh | sha256sum`): `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0` (antes `34c2ee77…f30946eeb2`). Cambia como prevé RN-4.

#### O-5 (CI del PR #167)

Duración en el CI (`pruebas (1/2)` y `pruebas (2/2)` de la ejecución 44263597599): `product-repository-contract-prisma-crear` 11,4 s, `-importacion` 7,2 s y `-actualizar` 7,9 s. Ninguno pasa de 20 s (CA-13): las medidas de O-5 eran de reloj en local, con la suite completa en paralelo.

#### Archivos afectados

- `restaurante/deploy/deploy.sh`
- `restaurante/deploy/ci/resumen.sh`
- `restaurante/deploy/ci/resumen-test.sh`
- `restaurante/deploy/ci/smoke.sh`
- `restaurante/docs/despliegue.md`
- este ticket

#### Riesgos o pendientes

- **Aviso RN-4 (debe ir en el PR):** cambiar `deploy.sh` cambia la suma de `deploy/`. Tras el merge del PR 3 a `main`, el job `deploy` falla con el código 4 hasta que el usuario reinstale `deploy/` en el VPS (`docs/despliegue.md` §1.3) y lo vuelva a ejecutar. Conviene hacer el merge cuando se pueda reinstalar enseguida (R-1).
- **R-2:** un 15 o un 16 con la app ya enferma no avisa con un 22; consta en la tabla de diagnóstico.
- **QA (P-T3 A):** el caso de inventory-manager roto con una migración nueva se ejecuta en una copia de `smoke.sh` que no se commitea.
- **Limpieza:** comprobada. Contenedores, redes y volúmenes de `restaurante-smoke`/`smoke-*` los retiró el propio `smoke.sh` (`docker ps -a`, `docker volume ls`: ninguno); borradas las imágenes `req047-smoke:*`, `smoke/*` y `localhost:5000/orvigas/*`; sin `traefik` ni `registry` descargados. Sin bases `restaurante_test*` (comprobado con `SHOW DATABASES` antes de `npm run db:down`; MySQL de desarrollo detenido, como estaba). Sin procesos de Vitest ni de las apps. Scratchpad: borrados `smoke-work`, `smoke.log` y `test.log`. `git worktree list`: el principal y este worktree de la tarea.

#### Pull Request del PR 3

- **PR:** https://github.com/orvigas/negocio/pull/169, de `feature/REQ-F-047-limpieza-posterior-req-f-045-3-deploy` hacia `main`, abierto en borrador.
- **Commits:** `4298bb3` (`fix: el despliegue deja la app intacta cuando falla la api o inventory-manager (REQ-F-047, PR 3)`) y el de este registro (`docs: registra el Pull Request de REQ-F-047 (PR 3)`).
- **Base:** rebase sobre `origin/main` en `fd557ab` (merge del #168, que solo toca pruebas de `landing-pages`). Suma de `deploy/`: `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`.
- **Aviso RN-4:** en el cuerpo del PR.
- **CI:** se comprueba con `gh pr checks` tras marcar el PR como listo (sin más commits después); el resultado consta en el informe de la fase.

## QA Action Plan

### PR 1. Textos y referencias

#### Objetivo

Comprobar con evidencia que el PR 1 solo cambia textos (documentación, comentarios, una etiqueta de `smoke.sh` y un comentario de `.env.example`), que cada afirmación nueva es verdadera frente al repositorio, que respeta la autorización sobre `.claude/` y que no hay regresión. No hay impacto visual ni de comportamiento: no aplican las pruebas de navegador, responsive, accesibilidad, UX/UI, WhatsApp, performance ni SEO (CA-12 se comprueba en el PR 2).

#### Requisito bajo prueba

RF-1 a RF-4, H-6 (P-T1 sí) y los dos textos extra aprobados por el usuario (`README.md:1803`, `api/.env.example:111`). Base: `main` = `914ab18`. Decisiones vigentes: P1-A (DEF-002 no es defecto de este PR), P2-A, P3-A, P4-A, P-T1, P-T2, P-T3 A.

#### Criterios de aceptación (cada uno → pruebas)

| CA | Pruebas |
| --- | --- |
| CA-1 | Q-1 |
| CA-2 (textos) | Q-2 |
| CA-11 (local; el CI se comprueba en T4) | Q-7, Q-8 |
| RF-2 a RF-4 y H-6 (afirmaciones verdaderas) | Q-4, Q-5 |
| "Sin cambio de comportamiento" (Action Plan, PR 1) | Q-3, Q-6 |

#### Riesgos identificados

- **QR-1.** Un texto nuevo afirma algo falso o impreciso. Candidatos concretos a verificar:
  - `README.md:1688`: "la `api` (la única app que usa MySQL)": comprobar que `landing-pages` e `inventory-manager` no abren conexión a MySQL en tiempo de ejecución (sus `src/` y `package.json`), y que lo que verifica la base al arrancar y recibe `DATABASE_ALLOW_NEWER_SCHEMA=true` en la vuelta atrás es la `api` (`deploy.sh`, `compose.prod.yaml`).
  - `content/molotes|birria/index.ts`: `src/services/landing-*.ts` existe, sirve esos datos "con caché" y la semilla es `packages/core/catalog/seeds/<negocio>.json`; y la lista de datos editables (productos, bebidas, showcase, texto destacado, promoción / platillos, showcase, textos del club) coincide con lo que trae la `api`.
  - `views/landings/index.ts` y `README.md:1803`: "de la `api` (o de la semilla)" y "sin respuesta, la semilla" corresponden al respaldo real.
  - `published.ts`: `toPublished` lo usan `product-repository.ts` y la API pública; "su caché la leen el bot y la administración" es cierto (ubicación real de `product-repository.ts` y sus consumidores, con el blast radius de CodeGraph).
  - `bot-config.ts`: "desde REQ-F-045 solo la usa la `api`": ningún importador fuera de `api` y `core`.
  - `core/bot-control/index.ts` y `chat-bot.ts`: el estado compartido y la administración del bot están en la `api`.
  - `memory-page-store.ts`: `imports` guarda las marcas de `page_import`, una por negocio; `seed` deja versiones guardadas "como tras la siembra".
  - `api/.env.example:111`: la página "Bot" de `inventory-manager` indica cuándo quitar la clave anterior.
  - `arquitectura.md`: la nota dice "las rutas de la columna izquierda ya no existen"; la fila `src/views/`, `src/content/`, `src/styles/`, `public/` y la de `src/config/env.ts` tienen hoy equivalentes en `landing-pages/`. Se evalúa si la frase es correcta leída como el `src/` de la app única (que no existe) o si induce a error.
- **QR-2.** Un cambio que parece comentario altera código (un `*/` mal cerrado, un import tocado).
- **QR-3.** La etiqueta de `smoke.sh:217` la lee otro script (p. ej. `resumen.sh`) o el CI y cambia un resultado.
- **QR-4.** Se cuelan archivos ajenos (`Cotizador_Taquiza_Birria.xlsx`) o cambios en `.claude/` fuera de las cuatro líneas autorizadas.
- **QR-5.** Un enlace o ancla interna de `README.md` o `arquitectura.md` se rompe por el cambio de título.
- **QR-6.** Líneas de Markdown o comentario más largas que el estilo del archivo (observación de forma; solo se informa si incumple una regla del proyecto).

#### Pruebas funcionales (de texto y de diff)

- **Q-1 (CA-1).** `git diff -U0 main -- .claude/` y `git status --short -- .claude/`: solo `senior-qa.md:50`, `:54`, `business-analyst.md:49`, `:98` y el ticket sin seguimiento; nada en `.claude/rules/`, `.claude/CLAUDE.md` ni `senior-fullstack.md`. El texto de cada línea coincide con RF-1.
- **Q-2 (CA-2).** `grep -rnE` en `restaurante/` (sin `node_modules`, `.git`) de `seed\.json`, `src/repositories/`, `solo lectura de productos`, `recreada con`, `recrea la app` y `/admin/(molotes|birria)`. Cada coincidencia se clasifica: excepción justificada de H-8, previsto en el PR 2 o 3 (lista del Implementation Result), o hallazgo. También se buscan los textos que retiran H-6 (`página "Bot" de /admin`, `repositorio de menús`, `/admin actual`, `changes.jsonl`) para confirmar que no queda ninguno fuera de lo previsto.
- **Q-3 (sin código ejecutable).**
  - Archivos `.ts`: script temporal en el scratchpad que, con el `typescript` del monorepo, imprime cada archivo sin comentarios (`createPrinter({ removeComments: true })`) en su versión de `main` y en la del árbol, y compara: deben ser idénticas.
  - `smoke.sh`: el único cambio es el primer argumento (la etiqueta) de una llamada a `check`; el comando comprobado no cambia (diff por palabras).
  - `api/.env.example`: las líneas que no son comentario son idénticas (`grep -v '^#'` en ambas versiones).
- **Q-4 (afirmaciones verdaderas).** Cada ruta, archivo, función o variable que citan los textos nuevos existe (`test -e`) y hace lo que dice (CodeGraph para el código indexado; lecturas dirigidas para shell, compose y Markdown). Cubre QR-1 punto por punto.
- **Q-5 (enlaces y anclas).** Script temporal que extrae los enlaces relativos `](…)` de `restaurante/README.md` y `restaurante/docs/arquitectura.md` y comprueba que el destino existe y, si lleva `#ancla`, que hay un encabezado que la genera. Búsqueda en el repositorio (sin `node_modules`) de referencias al título anterior "Dónde queda el código actual"; solo se admiten las de tickets en `done/` (históricas).
- **Q-6 (QR-3).** `grep` de "modo de solo lectura" y de la etiqueta en `deploy/`, `.github/` y las pruebas: nadie depende del texto. `bash -n deploy/ci/smoke.sh`.

#### Pruebas negativas y casos límite

- Q-3 sobre un archivo con un comentario mal cerrado haría fallar la comparación: se valida el script de Q-3 contra una copia temporal alterada a propósito en el scratchpad (no en el repositorio), para no aprobar con un comparador que no detecta nada.
- La suma de `deploy/`: con el método de `DEPLOY_FILES` del CI, `compose.prod.yaml`, `deploy.sh` y `mysql/initdb/01-usuarios.sh` dan `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`, igual en `main` (`git show main:…`) y en el árbol.

#### Pruebas de regresión

- **Q-7.** Desde `restaurante/`: `npm run typecheck`, `npm run lint` (0, sin avisos) y `npm test` completo (tres apps y paquetes) con el MySQL de pruebas (`npm run db:up` antes y `npm run db:down` al terminar si estaba detenido). Se registra el número de archivos y pruebas por app y se compara con el Implementation Result (49/1162, 58/896, 16/278).
- **Q-8.** `shellcheck` con la imagen `koalaman/shellcheck:stable` sobre los mismos archivos que revisa el CI (`deploy.sh`, `mysql/initdb/01-usuarios.sh`, `ci/smoke.sh`, `ci/resumen.sh`, `ci/resumen-test.sh`; se confirma la lista en el workflow). La imagen se borra al terminar si no estaba antes.
- **Q-9.** Archivos ajenos: `git status --short` y `git diff main --stat` solo muestran los 15 archivos del Implementation Result y el ticket; `Cotizador_Taquiza_Birria.xlsx` sigue sin seguimiento y no se añade.

#### Pruebas automatizadas

Solo las existentes (Q-7). Los scripts de Q-3 y Q-5 son sondas temporales en el scratchpad de la sesión; no se escriben en `restaurante/` ni se commitean.

#### Evidencia requerida

Salida de cada comando (diff de `.claude/`, búsqueda de CA-2 con su clasificación, comparación sin comentarios, enlaces, suma de `deploy/`, `typecheck`, `lint`, `npm test`, `shellcheck`) y, para Q-4, la ubicación en el código que respalda cada afirmación.

#### Criterios de aprobación

- Q-1 a Q-9 en verde.
- Ninguna afirmación nueva falsa. Una imprecisión se clasifica por impacto (normalmente `MINOR` o `TRIVIAL` en un comentario; `MAJOR` si induce a una operación incorrecta en el README) y se decide según la tabla de resultados del agente.
- Ningún cambio de código ejecutable; suma de `deploy/` sin cambios; `.claude/` dentro de la autorización.
- Limpieza comprobada: bases `restaurante_test*`, procesos de Vitest, contenedor e imagen de `shellcheck`, MySQL de pruebas en su estado inicial, scripts temporales y `git worktree list`.

### PR 2. Pruebas y código de `core`

#### Objetivo

Comprobar con evidencia que el PR 2 añade las cuatro pruebas de RF-6 (y que detectan lo que dicen proteger), retira el modo `'panel'` (RF-7) y las ramas muertas de `planPageImport` (RF-8) sin cambiar nada observable (RN-6, RN-7, CA-12), y que no hay regresión. Sin impacto visual: no aplican navegador, responsive, accesibilidad, UX/UI, WhatsApp, performance ni SEO; CA-12 se comprueba por comparación de HTML y cabeceras, no visualmente.

#### Requisito bajo prueba

RF-6 a RF-8, RN-5 a RN-7, CA-8 a CA-13 y O-4. Base: `main` = `30d322c`; rama `feature/REQ-F-047-limpieza-posterior-req-f-045-2-core` sin commit (8 archivos y el ticket). Decisiones vigentes: P1-A (DEF-002 de REQ-F-043 no es defecto de este PR), P5-A, P6-A, P-T2; en este PR no se toca `.claude/` salvo el ticket. NotebookLM: el servidor MCP `notebooklm` no expone herramientas en esta sesión; no se consultó.

#### Criterios de aceptación (cada uno → pruebas)

| CA / regla | Pruebas |
| --- | --- |
| CA-8 | T-1 a T-4 |
| CA-9 | T-5, T-11 |
| CA-10 | T-6, T-7, T-11 |
| CA-11 (local; el CI lo comprueba senior-fullstack en T4) | T-11 |
| CA-12 | T-8 |
| CA-13 (local, como estimación del CI) | T-12 |
| RN-5 (las pruebas pasan sobre el código anterior) | T-4 |
| RN-6 (siembra y control del bot sin cambios) | T-6, T-7, T-9, T-11 |
| RN-7 | T-6 |
| RF-6 (condiciones comunes: nombres, sin esperas ni `retry`, sin duplicados) | T-10 |
| Comentarios nuevos verdaderos (incluida O-4) | T-13 |
| Alcance del diff | T-14 |

#### Riesgos identificados

- **QR-1.** La siembra cambia de forma sutil: `previous` antes era `current` solo con `problem === 'missing'`, que `seedCandidates` siempre daba; hay que confirmarlo con datos, no por lectura (filas de `page_version` y `page_import`, logs).
- **QR-2.** Un consumidor fuera del grafo usaba lo retirado (`mode`, `choosePageSource`, `planPageImport`, `PAGE_IMPORT_SEED_REFUSED`, `PageImport*`), p. ej. `ops/`, `deploy/`, scripts o documentación operativa.
- **QR-3.** Las pruebas nuevas no detectan su mutación (falsos verdes): en especial QA-65 depende de `reading()` y la degradación cruzada del orden de bloqueo de MySQL.
- **QR-4.** Inestabilidad de las pruebas nuevas (R-4): degradación cruzada con interbloqueos o reintentos; QA-65 colgada si la puerta no se abre.
- **QR-5.** Pérdida de cobertura de "una auditoría por caducidad" al quitar `panel.maintenance()` (R-5): la prueba reformulada debe fallar si el mantenimiento audita dos veces o no audita.
- **QR-6.** M5 no la detectan las pruebas nuevas: hay que confirmar que otras pruebas la detectan, para decidir si es aceptable.
- **QR-7.** Mutaciones o sondas que quedan en el árbol de trabajo. **Los cambios de la rama no están commiteados: `git checkout -- <archivo>` en el árbol principal borraría la implementación.** Por eso todas las mutaciones y sondas se hacen en copias temporales (T-0), nunca en el árbol principal.
- **QR-8.** Que la prueba nueva de `seedPages` sea equivalente a la anterior solo por coincidencia con la implementación (reproducir la implementación interna).

#### Preparación

- **T-0. Entorno.**
  - `git status`, `git worktree list`, `docker ps` y las bases `restaurante_test*` existentes antes de empezar (estado inicial para la limpieza).
  - MySQL de pruebas con `npm run db:up` (y `npm run db:down` al terminar si estaba detenido).
  - Dos worktrees temporales en el scratchpad de la sesión:
    - `qa047-main`: `main` (`30d322c`) tal cual;
    - `qa047-rama`: `30d322c` más el parche `git diff` de la rama (sin el ticket), comprobado con `git diff --stat` igual al de la rama.
  - `npm ci` y `npm run db:generate` en cada uno (sus propios `node_modules`; no se enlazan los del árbol principal porque los paquetes `@restaurante/*` resolverían al árbol equivocado).
  - Las variables `TEST_DATABASE_URL` / `TEST_ADMIN_DATABASE_URL` las de siempre (MySQL local, prefijo `restaurante_test`).
  - El árbol principal no se modifica en ningún momento (solo el ticket).

#### Pruebas funcionales

- **T-1. CA-8, QA-37** (en `qa047-rama`, revirtiendo cada mutación con `git checkout` dentro del worktree):
  - M2: sin el límite `MAX_RELEASED` → debe fallar "guarda como mucho 1000 marcas…";
  - M3: expulsar la más reciente → debe fallar;
  - control: sin mutación, pasa.
- **T-2. CA-8, QA-65:**
  - M1: sin `if (version !== localVersion) return;` en `load` → deben fallar los tres casos (pausa, alta, baja);
  - sondas negativas del propio diseño de la prueba (QR-3): sin `await reading()` la prueba debe seguir pasando sobre el código bueno, y se registra si con M1 la detecta o no (justifica la espera);
  - se comprueba que la puerta siempre se abre (`finally`) y que ningún caso supera el `testTimeout`.
- **T-3. CA-8, degradación cruzada** (MySQL real):
  - M4 (`update` sin `assertActiveAdmin`) → debe fallar la 1;
  - M5 (`setActive` sin `assertActiveAdmin`) → se registra qué falla; se confirma que fallan las existentes CA-10 (`user-repository.test.ts:83`) y "dos desactivaciones simultáneas" (`:99`) y/o `last-admin-concurrency.test.ts`;
  - M4+M5 → deben fallar las dos nuevas;
  - M6 (`ReadCommitted` en vez de `Serializable`) en un bucle de **20 ejecuciones** del archivo: se cuenta cuántas veces falla cada prueba (nueva 1, nueva 2, `:99`) y si alguna ejecución pasa entera;
  - M6 también con `last-admin-concurrency.test.ts` (1 ejecución, 50 repeticiones internas) para confirmar que esa protección sigue cubierta;
  - **QR-6 (M5):** se considera aceptable si al menos una prueba existente falla siempre con M5; si no, es hallazgo.
- **T-4. CA-8 y RN-5, siembra y equivalencia:**
  - M7 (la siembra guarda también las listas congeladas) → debe fallar la prueba nueva de `seedPages`;
  - M8 (versión anterior distinta de la vigente) → debe fallar;
  - M7+M8 → debe fallar;
  - las cuatro pruebas nuevas de RF-6 (QA-37, QA-65, las dos de degradación) y la nueva de `seedPages`, copiadas a `qa047-main`, pasan sobre el código de `main` (prueban comportamiento ya existente).
- **T-5. CA-9 y QR-5:**
  - `bot-control-timers.test.ts` en verde;
  - mutación M9 (temporal): el mantenimiento audita dos veces la misma caducidad, o no la audita → la prueba "cada hora audita cada caducidad una sola vez" debe fallar en ambos casos;
  - mutación M10: `refresh` del temporizador desactivado → deben fallar los casos de refresco periódico.
- **T-6. RN-6, RN-7 y CA-10, siembra real:**
  - `server-startup-base.test.ts`, `api-process.test.ts`, `admin-bootstrap.test.ts` y `page-import.test.ts` en `qa047-main` y en `qa047-rama`;
  - sonda temporal (worktree, no se commitea): instalación nueva sobre una base `restaurante_test_qa047_*` con la `api` real de cada árbol; volcado de `page_version` y `page_import` (sin `imported_at`/fechas de alta) igual en los dos;
  - RN-7: una marca histórica `current` y otra `previous` insertadas en `page_import` se siguen leyendo (`readImports`) y la `api` arranca sin sembrar.
- **T-7. Idempotencia y H-7 (sonda sin commitear, MySQL real, en `qa047-rama`):**
  - segundo `seedPages` tras el primero: devuelve `[]`, sin logs `page_seeded` y sin cambios en las filas;
  - dos `seedPages` a la vez sobre la misma base, con una puerta en `readImports` para que ambos lean antes de escribir: uno siembra los dos negocios y el otro devuelve `[]` con `page_seed_skipped` ×2 (`reason: 'concurrent'`); 10 repeticiones; ninguna excepción; filas finales iguales a una siembra simple;
  - con un error que no es de concurrencia, `seedPages` lanza (no se traga el error).

#### Pruebas de regresión

- **T-8. CA-12, comparación `main` ↔ rama.** Con cada worktree, procesos reales de `api`, `landing-pages` e `inventory-manager` (puertos libres, `127.0.0.1`), cada uno sobre su base `restaurante_test_qa047_{main,rama}` sembrada desde cero con la misma semilla y el mismo administrador de arranque:
  - `landing-pages`: `/`, `/molotes` y `/birria` con la fecha del negocio fijada en lunes, martes y sábado (precarga de Node en el scratchpad que fija `Date` solo en ese proceso), más un 404 y un recurso estático; se comparan estado, cabeceras y cuerpo tras normalizar lo que varía por ejecución (fecha `Date`, nonces/ids si los hubiera);
  - `api`: `/api/v1/public/...` (productos y página de ambos negocios), `/health` y `/api/v1/admin/bot` (GET autenticado; sin sesión, 401) y `/api/v1/admin/<negocio>/page`;
  - `inventory-manager`: `/login`, y con sesión, productos, página, bot y usuarios de un negocio; se normalizan CSRF, cookies y fechas;
  - resultado esperado: diff vacío tras la normalización (cada normalización se lista en el informe).
- **T-9. Control del bot y webhook:** `bot-control*.test.ts`, `admin-bot-api.test.ts`, `admin-bot-effects.test.ts`, `bot-webhook-app.test.ts` y `whatsapp-webhook*.test.ts` en verde (dentro de T-11), y `bot-chat.test.ts` (el simulador crea el control sin `mode`).
- **T-10. Calidad de las pruebas nuevas (`.claude/rules/testing.md`):**
  - nombres de dominio, sin `QA-` ni `qa-req-f-*`;
  - sin `setTimeout`/esperas fijas, `retry`, ni cambios de `testTimeout`/`hookTimeout` en el diff;
  - cada comportamiento una vez: búsqueda de pruebas existentes de `takeReleased`, `localVersion`, `update`×`update`/`update`×`setActive` y de la siembra sin listas congeladas, para confirmar que no duplican otra;
  - estabilidad: 20 ejecuciones seguidas de `bot-control.test.ts` y `bot-control-reached.test.ts`, y 20 de `user-repository.test.ts` sobre el código de la rama (en el worktree), sin ningún fallo.
- **T-11. CA-9/CA-10 por búsqueda y suite completa (árbol principal, solo lectura):**
  - búsqueda en `restaurante/` (sin `node_modules`) y en `.github/`, `ops/`, `deploy/` y `docs/` de `'panel'`, `mode:`/`mode =` en `bot-control`, `loadUsageFromStore`, `planPageImport`, `choosePageSource`, `seedCandidates`, `PAGE_IMPORT_SEED_REFUSED`, `storable`, `PageImportCandidates`, `PageImportDecision`, `PageImportProblem`, `PageImportSource`; cada coincidencia se clasifica (histórica justificada, p. ej. `despliegue.md:677`, o hallazgo);
  - `npm run build:css`, `npm run typecheck`, `npm run lint` (0, sin avisos) y `npm test` completo; número de archivos y pruebas por app frente al Implementation Result (api 1166, landing-pages 887, inventory-manager 278).
- **T-12. CA-13:** `npm test` con el reporter JSON de Vitest para registrar la duración de cada archivo; ninguno se acerca a 20 s (se señala cualquiera > 10 s en local). El CI real lo comprueba senior-fullstack con el PR.
- **T-13. Comentarios nuevos contrastados con el código** (CodeGraph): cabecera y comentarios de `bot-control.ts` (un solo proceso, administración en `/api/v1/admin/bot`, mantenimiento solo en la `api`), cabecera, `PageImportPlan`, `toStored` y `seedPlan` de `page-import.ts`, `api/src/bot/config.ts:13-18` (O-4: las reglas están en `core/bot-control/bot-config.ts`) y la cabecera de `bot-control-timers.test.ts`.
- **T-14. Alcance del diff:**
  - `git status --short` y `git diff --stat`: solo los 8 archivos y el ticket; `Cotizador_Taquiza_Birria.xlsx` sin seguimiento; nada más de `.claude/`;
  - suma de `deploy/` con el método de `DEPLOY_FILES` del CI: `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`, igual en `main` y en el árbol.

#### Pruebas automatizadas

- Existentes: la suite completa (T-11) y las listadas en T-5, T-6 y T-9.
- Sondas y mutaciones temporales (no se commitean; solo en los worktrees del scratchpad): M1 a M10 y sus combinaciones, la comparación de T-8, las sondas de siembra de T-6 y T-7 y los bucles de T-3 y T-10.

#### Evidencia requerida

Salida de cada comando: resultado de cada mutación (qué prueba falla y con qué mensaje), recuentos de los bucles, volcados de filas comparados, diff normalizado de T-8 con la lista de normalizaciones, búsquedas de T-11 clasificadas, `typecheck`, `lint`, `npm test` con recuentos, duraciones por archivo, suma de `deploy/` y la ubicación en el código que respalda cada comentario de T-13.

#### Criterios de aprobación

- T-1 a T-14 en verde; cada mutación de CA-8 la detecta al menos una prueba nueva (M5: una existente, QR-6) y M6 se detecta en la mayoría de las 20 vueltas por la suite del archivo.
- Ninguna diferencia observable entre `main` y la rama (CA-12, RN-6), salvo normalizaciones justificadas.
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR` se elevan al usuario.
- Limpieza comprobada: worktrees `qa047-*` y sus `node_modules` borrados (`git worktree list` con una sola entrada y `git worktree prune`), bases `restaurante_test*` creadas por el QA borradas, procesos de `api`/`landing-pages`/`inventory-manager`/Vitest detenidos y puertos libres, MySQL de pruebas en su estado inicial, scripts temporales del scratchpad borrados, árbol principal idéntico al de antes del QA (salvo el ticket). No se usa navegador.

### PR 3. `deploy.sh`

Aprobado por el usuario (2026-11-18, cita textual: "Si", junto con las 5 autorizaciones: Docker, tres ejecuciones de smoke más D-2 y D-3, `npm run db:up`, limpieza y guardar el plan en el ticket).

#### Objetivo

Demostrar con evidencia que en 15 y 16 `deploy.sh` no toca la app, haya o no migraciones nuevas, y lo dice en el log, el mensaje y el resumen del CI; que ningún fallo de la api o de inventory-manager termina en 22; que nada más cambia (RN-3); que la documentación coincide con el comportamiento; y que la suma de `deploy/` es la anunciada (RN-4).

#### Requisito bajo prueba

RF-5 (RN-1 a RN-4), P-T3 A. CA-2 (despliegue), CA-3 a CA-7 y CA-11 (local).

#### Criterios de aceptación (cada uno → pruebas)

- CA-2 → F-6. CA-3 → F-4 (run 9) y F-5 A. CA-4 → F-1, F-5 y F-6. CA-5 → F-2, F-3 y F-4. CA-6 → F-3 y D-2. CA-7 → F-7 y F-8 (reinstalación en el VPS: pendiente del usuario). CA-11 → R-1 (el CI, en la fase del PR).

#### Riesgos identificados

- Tocar sin querer la vuelta atrás, la vuelta de la api con la bandera, el router o los códigos (RN-3).
- Remanentes de la rama retirada.
- H-3: el id del contenedor no distingue el cambio; solo el log. Hace falta un diferencial con el `deploy.sh` de `main`.
- R-2: con la app ya caída, 15/16 no deben arrancarla ni recrearla.
- RN-4: la suma cambia (código 4 tras el merge hasta reinstalar).

#### Pruebas funcionales

- **F-1.** `git diff -U0 main` frente a RN-3: fragmentos solo en la cabecera, `applied_migrations`, `MIGRATIONS_*`, `protect_running_app` → `fail_before_app` y sus dos llamadas; `compose.prod.yaml` sin cambios; mismos `fail <código>` salvo el 22 retirado; los 22 que quedan son `health_failed_api_not_restored` y `health_failed_rollback_failed`; `unset`, los dos `export`, `restore_inventory`, `probe_webhook` y `probe_traefik` intactos.
- **F-2.** `shellcheck` en Docker (`koalaman/shellcheck-alpine:stable`) con los argumentos del CI, más `shellcheck -x` de `ops/backup`.
- **F-3.** `bash deploy/ci/resumen-test.sh`.
- **F-4.** `smoke.sh` real sin modificar, en `docker:cli` con el socket, `--network host` y `SMOKE_WORKDIR` en el scratchpad, con las cuatro imágenes construidas desde el worktree (`qa047/restaurante:*`).
- **F-5.** Copia descartable de `smoke.sh` (scratchpad, con `deploy/` y `docs/` copiados) que añade: run 9 ampliado (api vuelta a la de `release.env`, healthy y con `DATABASE_ALLOW_NEWER_SCHEMA=true`; `releases.log` en `api_failed`); **A** (run 19: inventory-manager roto con la migración nueva `29990102…` → 16, app intacta, log sin recreación y con "la app no se tocó", api nueva healthy, inventory-manager v1 healthy, `inventory_failed`, sin `_app_unhealthy`, landings 200); **B** (run 20: app parada, api rota y migración nueva `29990103…` → 15, la app sigue parada con el mismo id, api anterior healthy con la bandera, `api_failed`).
- **F-6.** Búsqueda de `_app_unhealthy`, `protect_running_app`, `applied_migrations`, `MIGRATIONS_BEFORE/AFTER`, `se recrea`, `recreada`, "recrea la app" y "solo lectura de productos" en `restaurante/` y `.github/` (sin `node_modules`).
- **F-7.** `despliegue.md` (pasos 6 y 7, filas 15 y 16) frente a los logs reales; anclajes citados por `resumen.sh` y `deploy.sh`; `:653`, `:720` y `README.md:613`.
- **F-8.** Suma de `deploy/` con la fórmula del CI y la de `main`.

#### Pruebas negativas, mutaciones y diferenciales (no se commitean)

- **D-1.** La copia de F-5 con el `deploy.sh` de `main`: deben fallar solo las comprobaciones de log (run 9, A y B) y "la app sigue parada" (B), con los mismos códigos 15/16.
- **D-2.** `resumen-test.sh` con el `resumen.sh` de `main`: fallan exactamente las cuatro `no_contiene` nuevas.
- **D-3.** Mutación de `resumen.sh` (15 con la bandera, 16 con "recreada"): cada `no_contiene` la detecta por separado.

#### Pruebas de regresión

- **R-1.** `npm run typecheck`, `npm run lint` y `npm test` (tres apps; MySQL de pruebas).
- **R-2.** Todos los escenarios de `smoke.sh` en F-4.

#### Evidencia requerida

Recuentos `ok`/`FALLO` de cada smoke, extractos de `deploy-9/19/20.log` y `releases.log`, fallos esperados frente a obtenidos en D-1 a D-3, suma de control, búsquedas clasificadas y salidas de `typecheck`, `lint` y `npm test`.

#### Criterios de aprobación

CA-2 a CA-6 en PASS; F-4 y F-5 en verde; D-1 a D-3 fallan exactamente donde se espera; shellcheck, `resumen-test.sh`, `typecheck`, `lint` y `npm test` en 0; sin `BLOCKER`/`CRITICAL` ni `MAJOR` sin decisión. CA-7 (VPS) y el CI quedan pendientes sin bloquear. Limpieza comprobada: contenedores, redes y volúmenes de smoke, `traefik-public`, imágenes `qa047/*`, `smoke/*`, `localhost:5000/orvigas/*`, `traefik` y `registry` (no estaban antes), copias y logs del scratchpad, bases `restaurante_test*` y el MySQL de desarrollo como estaba.

## QA Report

### PR 1. Textos y referencias

#### Ronda

1 (2026-11-17). Plan aprobado por el usuario ("si", con las autorizaciones de MySQL de pruebas y Docker para `shellcheck`). Rama `feature/REQ-F-047-limpieza-posterior-req-f-045-1-textos`, cambios sin commit sobre `main` = `914ab18`.

#### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Q-1 | `git diff -U0 main -- .claude/` y `git status --short -- .claude/` | Solo `business-analyst.md` @@ -49 y @@ -98, `senior-qa.md` @@ -50 y @@ -54, y el ticket sin seguimiento. Nada en `rules/`, `CLAUDE.md` ni `senior-fullstack.md`. El texto coincide con RF-1. PASS |
| Q-2 | `grep -rnE` en `restaurante/` (sin `node_modules`, `.git`) de los textos de CA-2 y de H-6 | Ver "Clasificación de CA-2". Sin coincidencias no previstas de los textos de CA-2. PASS |
| Q-3 (`.ts`) | Script temporal con `typescript` del monorepo: `createPrinter({ removeComments: true })` sobre la versión de `main` y la del árbol | Los 9 `.ts` modificados: `IGUAL`, sin errores de análisis. Control negativo: una copia con `const zz = 1;` añadida tras un `*/` da `DISTINTO`. PASS |
| Q-3 (shell, env) | `git diff --word-diff=porcelain main -- deploy/ci/smoke.sh`; `diff` de `api/.env.example` sin líneas `#` | `smoke.sh`: solo cambia la etiqueta (`-nuevo (modo de solo lectura de productos)'` → `+nuevo'`). `.env.example`: líneas que no son comentario idénticas. PASS |
| Q-4 | CodeGraph, `grep` y lecturas dirigidas (ver "Afirmaciones verificadas") | Todas verdaderas salvo la nota de `arquitectura.md` (DEF-001). PASS con DEF-001 |
| Q-5 | Script temporal: enlaces relativos `](…)` de `README.md` y `docs/arquitectura.md`, destino y ancla (slug de GitHub) | 81 enlaces relativos, 0 rotos. El título anterior "Dónde queda el código actual" solo aparece en `.claude/docs/done/REQ-F-037-…md:794` (histórico, sin enlace). El "§4" de la nota existe. PASS |
| Q-6 | `grep` de "solo lectura" y de la etiqueta en `deploy/`, `.github/`, pruebas y `packages`; `bash -n deploy/ci/smoke.sh` | Nadie lee la etiqueta (solo `smoke.sh:217`); `bash -n` correcto. PASS |
| Suma de `deploy/` | `shasum -a 256` de `compose.prod.yaml deploy.sh mysql/initdb/01-usuarios.sh` encadenado (método de `deploy.sh:51`), en el árbol y en `git show main:` | Ambas `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`; `git diff --quiet main` de los tres: sin cambios. PASS |
| Q-7 | `npm run typecheck`; `npm run lint`; `npm run db:up` + `npm test` | `typecheck` 0; `lint` 0 (`--max-warnings 0`, sin avisos); `npm test` 0: 49 archivos / 1162 pruebas, 58 / 896, 16 / 278, igual que el Implementation Result. PASS |
| Q-8 | `docker run koalaman/shellcheck:stable deploy.sh mysql/initdb/01-usuarios.sh ci/smoke.sh ci/resumen.sh ci/resumen-test.sh` (lista de `ci.yml:556`) | 0, sin avisos. PASS |
| Q-9 | `git status --short`, `git diff main --stat` | Los 15 archivos del Implementation Result y el ticket; `Cotizador_Taquiza_Birria.xlsx` sigue sin seguimiento. PASS |

#### Clasificación de CA-2

- **Excepciones de H-8 (justificadas):** `packages/core/catalog/seeds.ts:9` (histórico); `docs/arquitectura.md:367-369` (tabla histórica, P3) y `:41`, `:432`, `:449`, `:481-491` (contexto o secciones fechadas); las URL `/api/v1/admin/molotes|birria/…` de `api/tests` e `inventory-manager/tests` (no son comentarios).
- **Previstas en el PR 2:** `packages/core/catalog/page-import.ts:29` y `:73`; `bot-control.ts:23`; `api/tests/unit/bot-control-timers.test.ts:12`.
- **Previstas en el PR 3:** `deploy/ci/resumen.sh:137` y `:140`; `docs/despliegue.md:126`.
- **`changes.jsonl` legítimos (dato histórico, no ubicación vigente):** `README.md:1630` ("Desde REQ-F-045 ninguna app lee ni escribe…"), `docs/despliegue.md:803-807` (procedimiento de REQ-F-044 marcado como aplicado), `packages/core/catalog/page-store.ts:14`, `packages/db/prisma/schema.prisma:340` y `:346` y el cliente generado.
- **Fuera de la lista aprobada (ver O-1):** `packages/core/catalog/product-repository.ts:33-35` y `:194`.

#### Afirmaciones verificadas (Q-4)

- `README.md:1688-1690`: `api/src/server.ts:49` llama a `verifyDatabase` con `allowNewerSchema`; `deploy.sh:401` exporta `DATABASE_ALLOW_NEWER_SCHEMA=true` en la vuelta atrás; en `compose.prod.yaml` solo la `api` recibe `DATABASE_URL` (`:200`) y la variable (`:202`), y la `app` lo dice expresamente (`:108`). `landing-pages/src`, `landing-pages/scripts`, `inventory-manager/src` y `inventory-manager/scripts` no importan `@restaurante/db`, `mariadb` ni `DATABASE_URL`. Verdadera.
- `content/molotes|birria/index.ts`: existen `landing-pages/src/services/landing-cache.ts` (caché con respaldo `seed`, `:89` y `:110`), `landing-page.ts` y `landing-products.ts`; las semillas son `packages/core/catalog/seeds/{molotes,birria}.json` (`seeds.ts:17-19`, reexportadas por `landing-pages/src/content/seeds.ts`). Los campos citados coinciden con `PageDataByBusiness` (`menu-schema.ts:331-332`) más los productos. Verdadera.
- `views/landings/index.ts` y `README.md:1803` ("de la `api` (o de la semilla)"): respaldo de `landing-cache.ts` con `source: 'seed'`. Verdadera.
- `published.ts`: `toPublished` lo llaman `product-repository.ts` y `api/src/app.ts:107` (blast radius de CodeGraph); la caché del repositorio la leen el bot (`getPublished`, `api/src/bot/orchestrator.ts:204`) y la administración (`isCacheFresh`, `api/src/admin/product-routes.ts:157`). Verdadera.
- `bot-config.ts` ("solo la usa la `api`") e `index.ts`/`chat-bot.ts` ("su administración, en la `api`"): los únicos importadores de `@restaurante/core/bot-control` fuera de `packages/` están en `api/` (`api/src/admin/index.ts:2` importa `BotProvider`). Verdadera.
- `memory-page-store.ts`: `imports` es `Map<BusinessId, PageImportMark>` y rechaza una segunda marca por negocio (`:62-63`). Verdadera.
- `api/.env.example:111`: `inventory-manager/src/views/bot.ts:153-158` avisa de no retirar `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS` mientras queden bloqueos con la clave anterior. Verdadera.
- `product-form.test.ts:7` ("el /admin retirado en REQ-F-045"): coherente con `arquitectura.md` §8. Verdadera.
- `docs/arquitectura.md`, nota nueva: **parcialmente falsa** (DEF-001).

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Q-1 |
| CA-2 (textos) | PASS | Q-2 y su clasificación; quedan solo las excepciones justificadas y lo previsto para los PR 2 y 3 |
| CA-11 (local) | PASS | Q-7 y Q-8. El CI (`calidad`, `docker`, `auditoria`, `pruebas` en `pass`) queda para T4, con el PR abierto |
| RF-1 a RF-4, H-6 y extras | PASS con DEF-001 | Q-3, Q-4, Q-5 y Q-6 |

#### Defectos encontrados

##### DEF-001

- Severidad: MINOR.
- Criterio de aceptación afectado: ninguno falla. Afecta a RF-3 (la nota sí deja claro que la tabla es el punto de partida, pero añade una afirmación falsa) y al objetivo del PR (textos que describan el estado actual).
- Descripción: la nota nueva de `docs/arquitectura.md:358-360` dice "las rutas de la columna izquierda ya no existen", pero tras el paso 1 la app única ya estaba en `landing-pages/`, y varias rutas de esa columna siguen existiendo allí, precisamente las de las filas cuyo destino es la propia `landing-pages/`.
- Pasos para reproducir: desde `restaurante/landing-pages/`, `test -e` de cada ruta de la columna izquierda.
- Resultado esperado: que la nota solo afirme lo que es cierto (p. ej., que la tabla describe el origen de cada parte y que la estructura vigente está en el §4).
- Resultado actual: existen `src/views`, `src/content`, `src/styles`, `public` y `src/config/env.ts`. No existen `src/services/{product-schema,visible-menu,business-schedule,authorization}.ts`, `src/repositories`, `src/controllers/admin-products-api.ts`, `src/routes/admin-api.ts`, `src/services/whatsapp-bot`, `src/controllers/whatsapp-webhook.ts`, `src/views/admin` ni `prisma`. Según el §8 (paso 1), "la app actual pasa tal cual a `landing-pages/`".
- Evidencia: salida de Q-4 (bucle `test -e`) y `arquitectura.md:349`.
- Impacto: documental. Un lector puede creer que `landing-pages/src/content/` ya no existe, justo la confusión que corrige el hecho 3 de este ticket. Lo mitiga la remisión al §4. No afecta al código, al despliegue ni a las pruebas.
- Recomendación: matizar la frase (que solo dejaron de existir las rutas que se movieron, o quitar la afirmación), sin tocar las filas (P3 A).

#### Observaciones (no son defectos de este PR)

- **O-1.** `packages/core/catalog/product-repository.ts` tiene dos comentarios desfasados que no están en la lista aprobada (A, P2 ni H-6) y que ningún texto de CA-2 detecta:
  - `:33-35`: "`landing-pages` (caché del bot y vistas de solo lectura de /admin)" y "`ADMIN_NEW_URL` en landing-pages". Hoy la caché la leen el bot y la administración de la `api`, y contradice el comentario nuevo de `published.ts`.
  - `:194`: "validado por el repositorio de menús" (el repositorio de menús se retiró en REQ-F-045, `arquitectura.md:432`).
  Incluirlos amplía el alcance aprobado: requiere la decisión del usuario. Encajarían en este PR o en el PR 2, que ya toca comentarios de `core/catalog`.
- **O-2.** Diez líneas añadidas pasan de 100 caracteres (p. ej. `README.md:1803`, `bot-config.ts:7`). El README ya tiene 287 líneas así y ninguna regla ni el lint lo limitan: solo es informativa.
- **O-3.** `landing-pages/package.json` declara `@restaurante/db` en `dependencies` aunque `landing-pages/src` no lo importe (lo usan sus pruebas). No lo introduce este PR y no hace falsa la afirmación del README (en tiempo de ejecución la app no usa MySQL). Fuera de alcance.

#### Regresión

Sin regresión: código ejecutable idéntico (Q-3), suma de `deploy/` igual, `typecheck`, `lint`, `npm test` (2336 pruebas) y `shellcheck` en verde.

#### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican: no hay cambios de HTML, CSS, JS de navegador ni de respuestas (código idéntico sin comentarios). CA-12 se comprueba en el PR 2.

#### Pendientes de revisión manual

- CI del PR en `pass` (no `skipping`) en T4.
- Decisión del usuario sobre DEF-001 (MINOR) y O-1. Si se corrigen, hace falta una ronda 2 de QA. Si solo cambia `arquitectura.md`: Q-1, Q-2, Q-5, Q-9 y la revisión del texto nuevo, sin repetir la suite. Si cambia un `.ts` (O-1): además Q-3, `typecheck`, `lint` y `npm test`.

#### Limpieza

- MySQL de pruebas: estaba detenido (`Exited`); se levantó con `npm run db:up` y se volvió a detener con `npm run db:down` (`Exited (0)`). Sin bases `restaurante_test*` tras la suite (`SHOW DATABASES`: solo `restaurante` y `restaurante_shadow`, preexistentes).
- La imagen `koalaman/shellcheck:stable`, que no estaba antes, se descargó y se borró (`docker images` sin resultados). El contenedor se ejecutó con `--rm`.
- Sin procesos de Vitest ni servidores; `git worktree list` solo muestra el árbol principal.
- Se borraron los scripts y registros temporales (`scratchpad/q3`). No se creó nada en `restaurante/`.

#### Resultado final

QA_APPROVED

### PR 1. Ronda 2

#### Qué cambió

El usuario aprobó corregir DEF-001 y O-1 ("Tu recomendación, no quiero la ruta corta") y esta ronda ("si la apruebo"). Cambian `docs/arquitectura.md` (nota de la tabla histórica) y `packages/core/catalog/product-repository.ts` (`:33-35` y `:194`, solo comentarios). O-3 queda fuera de alcance.

#### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Q-1 | `git diff -U0 main -- .claude/`, `git status --short -- .claude/` | Igual que en la ronda 1: `@@ -49`, `@@ -98` (business-analyst), `@@ -50`, `@@ -54` (senior-qa) y el ticket. PASS |
| Q-2 | La misma búsqueda, más `vistas de solo lectura` | `product-repository.ts` ya no aparece. Quedan solo las excepciones de H-8 (`seeds.ts:9`, `arquitectura.md:41`, `:370-372`, `:435`, `:452`, `:494`) y lo previsto para el PR 2 (`page-import.ts:29`, `bot-control.ts:23`, `bot-control-timers.test.ts:12`) y el PR 3 (`resumen.sh:137`, `:140`, `despliegue.md:126`). PASS |
| Nota de `arquitectura.md` | `diff` de las filas de la tabla entre `main` y el árbol; bucle `test -e` en `landing-pages/` sobre las 21 rutas de la columna izquierda | Filas idénticas (`FILAS_IGUALES`). Existen `src/views`, `src/content`, `src/styles`, `public` y `src/config/env.ts` (las cinco que cita la nota). No existen las 16 restantes (`src/services/{product-schema,visible-menu,menu-schema,price,slug,business-schedule,authorization,user-schema,admin-auth}.ts`, `src/repositories`, `prisma`, `src/controllers/admin-products-api.ts`, `src/routes/admin-api.ts`, `src/services/whatsapp-bot`, `src/controllers/whatsapp-webhook.ts`, `src/views/admin`). El paso 1 (`arquitectura.md:349`) confirma "ya en `landing-pages/` desde el paso 1". La frase ya es cierta: DEF-001 corregido. PASS |
| Q-3 | Script de la ronda 1 (printer de TypeScript sin comentarios) sobre los `.ts` de `git diff main --name-only` | 10 archivos, los 10 `IGUAL`, incluido `product-repository.ts`. Controles: `void 0;` añadido en `product-repository.ts` → `DISTINTO`; cambiar solo el texto del comentario → `IGUAL`. PASS |
| Comentarios de `product-repository.ts` | CodeGraph (flujo `createProductRepository` → `importBusiness` → `importOnce` → `productsFromMenuData`) y lecturas dirigidas | `:194`: cierto. `:33-35`: **parcialmente falso** (DEF-003). |
| Q-5 | Script de enlaces de la ronda 1 | 81 enlaces relativos, 0 rotos. El título anterior solo aparece en `done/REQ-F-037…md:794` (histórico). PASS |
| Suma de `deploy/` | Método de `deploy.sh:51` | `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`; `git diff --quiet main` de los tres archivos. PASS |
| Q-7 | `npm run typecheck`, `npm run lint`, `npm run db:up` + `npm test` | 0, 0 (sin avisos), 0: 49/1162, 58/896, 16/278. PASS |
| Q-9 | `git status --short`, `git diff main --stat` | 16 archivos (los 15 de la ronda 1 más `product-repository.ts`) y el ticket; el `.xlsx` sigue sin seguimiento. PASS |

**No se repitieron:**
- Q-6 y Q-8 (`smoke.sh`, `bash -n`, `shellcheck`): ningún script de shell cambió desde la ronda 1. Por eso no se descargó la imagen de `shellcheck`.
- La comprobación de las demás afirmaciones de Q-4: sus archivos no cambiaron desde la ronda 1.

#### Afirmaciones de `product-repository.ts`

- `:194` ("ya validado (la semilla, con validateMenuDocument en la instalación de la api)"): cierto.
  - El único llamador de `productsFromMenuData` es `importOnce` (`:379`), a través de `importBusiness` desde `init(sources)`.
  - El único `init` con fuentes es `prepareInstallation` (`api/src/install/index.ts:100-103`), con `documents` de `loadSeeds`, que valida cada semilla con `validateMenuDocument` (`:57`).
- `:33-35`, primera parte ("desde REQ-F-045 solo lo usa la `api`: lo escribe su administración (`/api/v1/admin`, que usa el admin nuevo)"): cierto. Solo lo crea `api/src/server.ts:60`, y se pasa a `createAdminRoutes` (`:111`).
- `:33-35`, segunda parte ("su caché la leen la API pública de productos y el catálogo del bot"): **falso para la API pública**. Ver DEF-003.

#### Defectos encontrados

##### DEF-003

(Se numera 003 para no confundirlo con el DEF-002 de REQ-F-043 que cita este ticket.)

- Severidad: MINOR.
- Criterio de aceptación afectado: RF-4 (los comentarios citan el estado actual), aplicado a O-1, que el usuario decidió corregir en este PR.
- Descripción: el comentario nuevo de `packages/core/catalog/product-repository.ts:34-35` dice que la caché del repositorio "la leen la API pública de productos y el catálogo del bot". La API pública no usa el repositorio ni su caché: lee la base en cada petición.
- Pasos para reproducir: ver cómo se construye `createApiApp` en `api/src/server.ts:120` y la ruta pública en `api/src/app.ts`.
- Resultado esperado: que el comentario nombre a quien de verdad lee la caché: el catálogo del bot (`getPublished`, `api/src/bot/orchestrator.ts:204`) y la administración (`isCacheFresh`, `api/src/admin/product-routes.ts:157`). Así lo dice ya el comentario de `published.ts` de este PR ("su caché la leen el bot y la administración") y lo confirma `api/src/server.ts:99` ("El bot usa la misma caché de productos que /api/v1/admin").
- Resultado actual:
  - `createApiApp({ store, pages, admin, logger })` (`api/src/server.ts:120`) recibe el *store*, no `products`.
  - La ruta pública hace `toPublished(business, await store.listBusiness(business))` (`api/src/app.ts:107`).
  - `api/src/app.ts:21` lo documenta: "Sin caché propia: cada petición lee el estado confirmado en la base (CA-3 de REQ-F-038)".
- Evidencia: las líneas citadas (CodeGraph, `codegraph_explore` de `createApiApp` y `createProductRepository`).
- Impacto: solo documental, sin efecto en la ejecución (Q-3 igual). Contradice el comentario de `published.ts` del mismo PR, y puede inducir a error a quien cambie la caché o el endpoint público (p. ej., a creer que la API pública sirve datos de una caché de hasta 60 s).
- Recomendación: corregir la segunda parte de la frase para que nombre a los lectores reales de la caché.

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Q-1 |
| CA-2 (textos) | PASS | Q-2 |
| CA-11 (local) | PASS | Q-7 (`shellcheck` de la ronda 1 sigue vigente: ningún script cambió) |
| RF-3 (DEF-001) | PASS | Nota de `arquitectura.md` |
| RF-4 aplicado a O-1 | **FAIL** | DEF-003 |

#### Regresión

Sin regresión: código ejecutable idéntico al de `main` en los 10 `.ts`, suma de `deploy/` sin cambios y `typecheck`, `lint` y `npm test` (2336 pruebas) en verde.

#### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican (sin cambios de HTML, CSS, JS de navegador ni de respuestas).

#### Pendientes de revisión manual

- CI del PR en `pass` (no `skipping`) en T4.
- Ronda 3, tras corregir DEF-003. Como solo cambia un comentario de un `.ts`, se repiten Q-3 sobre los 10 `.ts`, la comprobación de esa frase, `typecheck`, `lint` y `npm test`, además de Q-1, Q-2 y Q-9. No se repiten los enlaces ni la nota de `arquitectura.md` si no cambian.

#### Limpieza

- MySQL de pruebas: estaba detenido (`Exited (137)`). Se levantó con `npm run db:up` y se detuvo con `npm run db:down`, y quedó otra vez `Exited`. `SHOW DATABASES` tras la suite: sin `restaurante_test*` (solo `restaurante` y `restaurante_shadow`, que ya estaban).
- No se usó Docker para `shellcheck`, y no queda la imagen `koalaman/shellcheck`.
- Sin procesos de Vitest; `git worktree list` solo muestra el árbol principal.
- Se borraron los scripts y registros de la ronda (`scratchpad/q3r2`). Nada escrito en `restaurante/`; sin commits.

#### Resultado final

QA_REJECTED

### PR 1. Ronda 3

#### Qué cambió

Corrección de DEF-003, aprobada por el usuario ("la paruebo"):
- `packages/core/catalog/product-repository.ts:33-36` nombra a quien usa de verdad la caché y dice que la API pública no la usa;
- `published.ts:8`: "la leen" pasa a "la usan".

El resto de archivos no cambió desde la ronda 2 (16 archivos más el ticket, `43 insertions(+), 33 deletions(-)`).

#### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Comentario `product-repository.ts:33-36` | Lectura de los cuatro sitios y de `api/src/server.ts` | "su caché la usan el bot (`getPublished`)": `api/src/bot/orchestrator.ts:204` (`products.getPublished(business)`). "y la administración (`isCacheFresh`)": `api/src/admin/product-routes.ts:157`. "La API pública no la usa: lee el store en cada petición": `api/src/app.ts:21` ("Sin caché propia…"), `:107` (`toPublished(business, await store.listBusiness(business))`) y `api/src/server.ts:120` (`createApiApp` recibe `store`, no `products`). "solo lo usa la `api`" y "lo escribe su administración": `api/src/server.ts:60` y `:111`. Cierto. DEF-003 corregido. PASS |
| `published.ts:8` | Diff y comparación con el código | "su caché la usan el bot y la administración": coherente con lo anterior y con `api/src/server.ts:99`. "lo usan … y la API pública": `toPublished` en `api/src/app.ts:107`. PASS |
| Q-3 | Script de las rondas anteriores sobre los `.ts` de `git diff main --name-only` | 10 archivos, los 10 `IGUAL`. Control negativo: `const zz = 0;` añadido en `published.ts` → `DISTINTO`. Control positivo: solo cambia un comentario → `IGUAL`. PASS |
| Repaso independiente de los nueve comentarios del Implementation Result | Lecturas y `grep` propios (no se usó la lista del desarrollador como evidencia) | Ver la tabla siguiente. Los nueve, ciertos. PASS |
| Q-1 | `git diff -U0 main -- .claude/` | `@@ -49`, `@@ -98` (business-analyst), `@@ -50`, `@@ -54` (senior-qa) y el ticket. PASS |
| Q-2 | La búsqueda de las rondas anteriores, más `la leen la API` | Solo las excepciones de H-8 (`seeds.ts:9`, `arquitectura.md:41`, `:370-372`, `:435`, `:452`, `:494`) y lo previsto para el PR 2 (`page-import.ts:29`, `bot-control.ts:23`, `bot-control-timers.test.ts:12`) y el PR 3 (`resumen.sh:137`, `:140`, `despliegue.md:126`). PASS |
| Q-9 | `git status --short`, `git diff main --stat` | 16 archivos y el ticket; `Cotizador_Taquiza_Birria.xlsx` sin seguimiento. PASS |
| Suma de `deploy/` | Método de `deploy.sh:51` | `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`; `git diff --quiet main` de los tres. PASS |
| Q-7 | `npm run typecheck`, `npm run lint`, `npm run db:up` + `npm test` | 0, 0 (sin avisos), 0: 49/1162, 58/896, 16/278. PASS |

**Repaso independiente de los nueve comentarios**

| Comentario | Evidencia propia | Resultado |
| --- | --- | --- |
| `api/.env.example:111` | `inventory-manager/src/views/bot.ts:153-158`: avisa con `previousKeyBlocks` de no retirar `WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS` | Cierto |
| `api/src/bot/chat-bot.ts:13` | `api/src/admin/index.ts:2` y `api/src/admin/bot-routes.ts:12` importan `BotProvider` de `core/bot-control` | Cierto |
| `inventory-manager/tests/unit/product-form.test.ts:7` | `/admin` retirado en REQ-F-045 (`arquitectura.md` §8; `landing-pages/src/app.ts:38`: "Sin base de datos ni administración (REQ-F-045)") | Cierto |
| `content/molotes/index.ts`, `content/birria/index.ts` | `landing-products.ts:5-6` y `landing-page.ts:5-6` usan `createLandingCache` (`landing-cache.ts:76`) y `loadSeedDocument`, que lee `packages/core/catalog/seeds/<negocio>.json` | Cierto |
| `views/landings/index.ts` | Lo mismo: datos de la `api` en caché, con la semilla como respaldo (`landing-cache.ts:89` y `:110`) | Cierto |
| `core/bot-control/bot-config.ts` e `index.ts` | `grep` de `core/bot-control` en `landing-pages/src` e `inventory-manager/src`: sin resultados; `api/src/bot/config.ts:11` lo importa | Cierto |
| `memory-page-store.ts:12` y `:20` | `imports: Map<BusinessId, PageImportMark>`, con rechazo de una segunda marca (`:62-63`); `seed()` hace `state.pages.set(business, structuredClone(pages))` (`:70-71`) | Cierto |
| `product-repository.ts:194` | `productsFromMenuData` → solo `importOnce` (`:379`); el único `init` con fuentes es `prepareInstallation` (`api/src/install/index.ts:100-103`), con semillas de `loadSeeds` validadas por `validateMenuDocument` (`:57`) | Cierto |
| `published.ts:6-8` | Llamadores de `toPublished`: `product-repository.ts` y `api/src/app.ts:107` (blast radius de CodeGraph, ronda 1) | Cierto |

#### Observaciones

- **O-4.** `api/src/bot/config.ts:15-16` (archivo que no toca este PR) dice: 'Las reglas comunes con la página "Bot" de /admin…'. Está desfasado, como los de H-6, pero no está en la lista aprobada. Las búsquedas de CA-2 y de H-6 no lo detectaron porque el texto está partido entre dos líneas. No es un defecto de este PR. Se recomienda incluirlo en el PR 2 (que ya toca comentarios del control del bot), con la decisión del usuario.
- O-2 y O-3 siguen como en la ronda 1.

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Q-1 |
| CA-2 (textos) | PASS | Q-2 |
| CA-11 (local) | PASS | Q-7; el `shellcheck` de la ronda 1 sigue vigente porque ningún script cambió |
| RF-3 (DEF-001) | PASS | Ronda 2, sin cambios desde entonces |
| RF-4 y O-1 (DEF-003) | PASS | Comentario de `product-repository.ts:33-36` y `published.ts:8` |

#### Defectos

Ninguno abierto. DEF-001 (ronda 2) y DEF-003 (esta ronda) están corregidos.

#### Regresión

Sin regresión: código ejecutable de los 10 `.ts` idéntico al de `main`, suma de `deploy/` sin cambios y `typecheck`, `lint` y `npm test` (2336 pruebas) en verde.

**No se repitieron:**
- Q-5 (enlaces) ni la nota de `arquitectura.md`: los Markdown no cambiaron desde la ronda 2.
- Q-6 y Q-8 (`smoke.sh` y `shellcheck`): ningún script cambió desde la ronda 1.

#### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican.

#### Pendientes de revisión manual

- CI del PR en `pass` (no `skipping`) en T4.
- Decisión del usuario sobre O-4.

#### Limpieza

- MySQL de pruebas: estaba detenido. Se levantó con `npm run db:up` y se detuvo con `npm run db:down` (`Exited`). Tras la suite no hay bases `restaurante_test*` (solo `restaurante` y `restaurante_shadow`, que ya estaban).
- No se usó Docker para `shellcheck`, y no hay imagen `koalaman/shellcheck`.
- Sin procesos de Vitest; un solo `git worktree`.
- Se borraron los scripts y registros (`scratchpad/q3r3`). Nada escrito en `restaurante/`; sin commits.

#### Resultado final

QA_APPROVED

### PR 2. Pruebas y código de `core` — Ronda 1

#### Pruebas ejecutadas

El plan se aprobó con la cita "Apruebo el plan y las 4 autorizaciones". Las mutaciones y sondas se hicieron en dos worktrees temporales: `qa047-main` (`30d322c`) y `qa047-rama` (`30d322c` más el parche de la rama, revertido desde copias de seguridad, no con `git checkout`). El árbol principal no se tocó, salvo este ticket.

- **T-0, entorno.** MySQL de pruebas levantado con `db:up` (al empezar estaba detenido) y sin bases `restaurante_test*`. `npm ci` y `db:generate` en cada worktree.
- **T-1, QA-37.**
  - M2 (sin límite): falla "guarda como mucho 1000 marcas…".
  - M3 (expulsa la marca más reciente): falla la misma prueba.
- **T-2, QA-65.**
  - M1 (sin `if (version !== localVersion) return;`): fallan los 3 casos.
  - Sonda sobre el diseño de la prueba: sin `await reading()`, los 16 casos pasan con el código bueno y también con M1. La espera es imprescindible, y la prueba la tiene.
- **T-3, degradación cruzada.**
  - M4: fallan la nueva 1 y CA-10 (`:83`).
  - M5: las dos nuevas pasan; fallan CA-10 y "dos desactivaciones simultáneas" (`:99`) en `user-repository.test.ts` y la de 50 repeticiones de `last-admin-concurrency.test.ts`. La protección queda cubierta por pruebas existentes, así que es aceptable (QR-6).
  - M4+M5: fallan las 4 de D-7.
  - M6 (`ReadCommitted`), 20 vueltas: la nueva 2 y `:99` fallan 20 de 20; la nueva 1 no falla ninguna vez (como anticipaba H-5). `last-admin-concurrency` también falla.
- **T-4, siembra y RN-5.**
  - M7, M8 y M7+M8: falla la prueba de `seedPages`.
  - Equivalencia: las 5 pruebas nuevas o adaptadas, copiadas a `main`, pasan sobre el código de `main` (api 31/31; landing-pages 17/17).
- **T-5, CA-9 y R-5.**
  - M9a (el mantenimiento no audita) y M9b (audita en cada pasada): falla "cada hora audita cada caducidad una sola vez".
  - M10 (el temporizador no refresca): fallan los 2 casos de refresco periódico.
- **T-6, RN-6 y RN-7.**
  - `server-startup-base`, `api-process`, `page-import` y `admin-bootstrap` en verde en `main` y en la rama.
  - Instalación nueva real con la `api` de cada árbol: las filas de `page_version` (4: vigente = anterior, revisión 0, sin listas congeladas) y de `page_import` (2: `seed`, `0@seed`), y los logs `page_seeded`, son idénticos.
  - RN-7: marcas históricas `current` y `previous` insertadas en MySQL. `readImports` las devuelve con su origen y `seedPages` no siembra.
- **T-7, siembra sobre MySQL.**
  - Idempotencia: el segundo `seedPages` devuelve `[]`, sin `page_seeded`, y las filas no cambian.
  - H-7: dos `seedPages` a la vez (puerta en `readImports`), 10 de 10 sin excepción. Uno siembra los 2 negocios, el otro devuelve `[]` con `page_seed_skipped` ×2 (`concurrent`); quedan 4 + 2 filas.
  - Un error que no es de concurrencia se propaga.
- **T-8, CA-12.** Procesos reales de las tres apps de cada árbol, con su base recién sembrada. Las landings se probaron en lunes, martes y sábado con una precarga que fija la fecha.
  - Se compararon 59 respuestas entre `main` y la rama (estado, cabeceras y cuerpo):
    - landing: `/`, `/molotes`, `/birria`, un 404, un CSS y `/admin`;
    - `api`: productos y página públicos, 404, `/api/v1/admin/bot` con y sin sesión, usuarios, página, productos y cotizador;
    - `inventory-manager`: acceso, inicio, bot, usuarios, cuenta, productos, página y cotizador.
  - Resultado: **idénticas** tras normalizar solo puertos, fechas ISO de la ejecución, `Date`, `ETag`, `Last-Modified`, `Set-Cookie` y los tokens de sesión y CSRF.
  - Los avisos coinciden con las reglas: lunes y martes en `/`, lunes y sábado en `/molotes` ("toca birria" el sábado), ninguno el martes en `/molotes`.
- **T-9.** Control del bot, webhook y `bot-chat` en verde, dentro de la suite.
- **T-10.**
  - Nombres de dominio, sin `QA-` ni `qa-req-f-*`.
  - El diff de pruebas no añade `setTimeout`, esperas fijas, `retry` ni cambios de `testTimeout`/`hookTimeout`.
  - Sin duplicados: no había prueba de `takeReleased` con el límite, ni de escrituras durante un refresco, ni de `update`×`update` o `update`×`setActive`.
  - Estabilidad, 20 vueltas: `bot-control*.test.ts` 0 fallos; `user-repository.test.ts` 0 fallos.
- **T-11.**
  - `build:css`, `typecheck`, `lint` y `npm test`: 0.
  - Recuentos: api 49 archivos y 1166 pruebas; landing-pages 58 y 887; inventory-manager 16 y 278. Coinciden con el Implementation Result.
  - Búsqueda de lo retirado: no queda en el código. Solo aparece en `docs/despliegue.md:677` (procedimiento de vuelta a una app anterior a REQ-F-045, ya en H-8) y `docs/arquitectura.md:483` (sección histórica fechada). Ningún `mode` en `bot-control.ts` ni en sus pruebas.
- **T-12, CA-13 (local).** Archivos del PR: `user-repository.test.ts` 3,2 s y el resto menos de 1,2 s.
- **T-13.** Los comentarios nuevos se contrastaron con el código y son ciertos:
  - administración en `/api/v1/admin/bot` (`api/src/admin/router.ts:52`);
  - el mantenimiento solo lo ejecuta la `api` (`server.ts:97` y `control-timers.ts:34`);
  - la siembra la hace la `api` (`api/src/install/index.ts:98`);
  - las marcas históricas se leen (`prisma-page-store.ts:16`);
  - las reglas de proveedor, personal, claves y umbrales están en `bot-config.ts` (O-4).
- **T-14.**
  - `git diff --name-only HEAD`: los 8 archivos y el ticket. `Cotizador_Taquiza_Birria.xlsx` sigue sin seguimiento.
  - Suma de `deploy/`: `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`, sin cambios.

#### Criterios de aceptación

- CA-8: PASS (T-1 a T-4; M5 la cubren pruebas existentes).
- CA-9: PASS (T-5, T-11).
- CA-10: PASS (T-6, T-11).
- CA-11: PASS en local. El CI lo comprueba senior-fullstack con el PR.
- CA-12: PASS (T-8).
- CA-13: PASS en local para los archivos del PR (T-12). El CI se comprueba con el PR.
- RN-5: PASS (T-4).
- RN-6: PASS (T-6, T-7, T-9).
- RN-7: PASS (T-6).

#### Defectos encontrados

Ninguno.

#### Observaciones (no son defectos de este PR)

- **O-5.** Con la suite completa en local, `landing-pages/tests/unit/product-repository-contract-prisma-actualizar.test.ts` (21,4 s) y `…-importacion.test.ts` (20,6 s) superan los 20 s. El PR no los toca y la medida es de reloj con trabajadores en paralelo. Conviene vigilarlo en el CI (CA-13 y `.claude/rules/testing.md`).
- **O-6.** La degradación cruzada 1 no detecta M6 en ninguna de las 20 vueltas. La protección del aislamiento la detectan siempre la nueva 2, `:99` y `last-admin-concurrency.test.ts`.

#### Regresión, responsive, accesibilidad, UX/UI, performance y SEO

Sin cambios observables (T-8: HTML y cabeceras idénticos). Sin navegador: no hay impacto visual.

#### Pendientes de revisión manual

Ninguno. El CI del PR (`calidad`, `docker`, `auditoria`, `pruebas` en `pass`) lo comprueba senior-fullstack.

#### Limpieza

- Worktrees `qa047-main` y `qa047-rama` borrados, con sus `node_modules`, y `git worktree prune` ejecutado (`git worktree list`: solo el principal).
- Sin bases `restaurante_test*`, comprobado antes de detener MySQL.
- MySQL de pruebas detenido con `db:down`, como estaba al empezar.
- Sin procesos de Vitest ni de las apps.
- Scratchpad vacío.
- Árbol principal sin cambios, salvo este ticket.

#### Resultado final

QA_APPROVED

### PR 3. `deploy.sh` — Ronda 1

Worktree `.claude/worktrees/agent-af8ef744c0e4c3d99`, rama `feature/REQ-F-047-limpieza-posterior-req-f-045-3-deploy` (HEAD `d06f5d6`, cambios sin commit). Todo en local; ni VPS ni producción.

#### Pruebas ejecutadas

- **F-1 (diff frente a RN-3):** `git diff -U0 main -- deploy/deploy.sh` da 7 fragmentos, todos en zonas permitidas: cabecera (`-14,2 +14,3`), `applied_migrations` (`-182,15`), `MIGRATIONS_BEFORE` (`-246`), `MIGRATIONS_AFTER` (`-252`), `protect_running_app` → `fail_before_app` (`-307,22 +291,6`) y las dos llamadas (`-362 +330`, `-375 +343`). Sin diferencias en `compose.prod.yaml`, `mysql/` ni `README.md`.
  - Los `fail <código>` de `main` y de la rama coinciden, salvo dos cambios: `fail 22` pasa de 3 a 2 (sale el de `protect_running_app`) y `fail "$code"` ×2 pasa a `fail "$2"` ×1.
  - En los `record`, sale `"${result}_app_unhealthy"`.
  - Quedan los dos 22 previstos: `health_failed_api_not_restored` (386) y `health_failed_rollback_failed` (393).
  - Siguen intactos `unset DATABASE_ALLOW_NEWER_SCHEMA` (129), los `export …=true` (323 en la vuelta de la api y 369 en la vuelta atrás), `probe_traefik`, `probe_webhook` y `restore_inventory`.
  - `fail_before_app` es `record "$1"; fail "$2" "$3; la app no se tocó"`: no tiene ningún camino al 22.
- **F-2 (shellcheck 0.11.0, `koalaman/shellcheck-alpine:stable`):** `shellcheck deploy.sh mysql/initdb/01-usuarios.sh ci/smoke.sh ci/resumen.sh ci/resumen-test.sh` → 0, sin avisos. `shellcheck -x` de `ops/backup` (lib, backup, env-backup, restore, verify-backup y ci/smoke) → 0.
- **F-3:** `bash deploy/ci/resumen-test.sh` → 0, "todas las comprobaciones pasaron". En 15 y 16 pasan "la app no se tocó", "sin recreación" y "sin la bandera".
- **F-4 (`smoke.sh` real sin modificar):** en `docker:cli` con el socket, `--network host` y `SMOKE_WORKDIR` en el scratchpad, con las cuatro imágenes construidas desde el worktree (`qa047/restaurante:{production,migrate,api,inventory-manager}`). Resultado: **194 ok, 0 FALLO, salida 0**, "todas las comprobaciones pasaron". Pasan:
  - los rechazos 2, 4 y 3, incluido "`DATABASE_ALLOW_NEWER_SCHEMA` en .env → 3";
  - 13; 21 en los runs 4, 12 y 7 (este, tras una migración nueva); "22, no 21" (run 17);
  - 15 en los runs 8, 13 y 15; 16 en el run 10;
  - el webhook, el router y los procedimientos documentados.
  - Run 9: `deploy: ERROR: la api nueva no quedó healthy o Traefik no le enruta el webhook; la app no se tocó`, `-> 15`, mismo contenedor, sin "se recrea", con "la app no se tocó", imagen v2, sin la bandera, healthy tras reiniciar y 200.
- **F-5 (copia descartable de `smoke.sh` con el `deploy.sh` de la rama; P-T3 A):** **228 ok (194 + 34 de QA), 0 FALLO, salida 0.**
  - **Run 9 ampliado:** la api vuelve a la de `release.env`, queda healthy y tiene `DATABASE_ALLOW_NEWER_SCHEMA=true` en su entorno; `releases.log` termina en `api_failed`.
  - **A (run 19: inventory-manager roto con la migración nueva `29990102000000_smoke_otra`):**
    - antes no estaba aplicada y después sí;
    - `-> 16`, con `deploy: ERROR: inventory-manager no quedó healthy; la api nueva sigue; la app no se tocó`;
    - mismo contenedor de la app, imagen v2 y sin la bandera; log sin "se recrea" ni "recreada";
    - la api nueva (`api-newest`) sigue y queda healthy; inventory-manager vuelve a v1 y queda healthy;
    - `releases.log` termina en `inventory_failed`, sin ningún `_app_unhealthy`;
    - `/`, `/molotes` y `/birria` responden 200.
  - **B (run 20, caso límite R-2: app parada, api rota y migración nueva `29990103000000_smoke_tercera`):**
    - `-> 15` (no 22), con "la app no se tocó" y sin recreación;
    - la app conserva el mismo id y sigue parada (`State.Running=false`);
    - la api vuelve a la de `release.env`, queda healthy y tiene la bandera; `releases.log` termina en `api_failed`;
    - arrancada a mano, la app queda healthy y el sitio responde 200.
- **F-6 (remanentes):** `grep -rnE '_app_unhealthy|protect_running_app|applied_migrations|MIGRATIONS_BEFORE|MIGRATIONS_AFTER|se recrea|recreada|recrea la app|solo lectura de productos'` en `restaurante/` y `.github/` (sin `node_modules`). Solo 4 apariciones, todas justificadas:
  - `resumen-test.sh:117` y `:161` (`no_contiene … 'recreada'`) y `smoke.sh:553` (`! grep 'se recrea'`) son las comprobaciones negativas;
  - `despliegue.md:912` ("una `api` recreada a mano", fila del 502) se refiere a la api, no a la app.
- **F-7 (`despliegue.md` frente al comportamiento):**
  - Los pasos 6 y 7 y las filas 15 y 16 coinciden con los mensajes reales de los runs 9, 19 y 20 y con el caso de la app parada, que sigue igual (la fila 15 dice "si ya estaba caída, sigue igual").
  - Existe el anclaje `#10-diagnóstico` que usa `resumen.sh` (`## 10. Diagnóstico`, línea 887).
  - `:653` y `:720` están sin cambios y son correctas (hecho 2). `README.md:613` sigue siendo coherente ("una `api` rota termina con 15 sin tocar la app, también si hubo migraciones nuevas").
- **F-8 (suma de `deploy/` con la fórmula de `ci.yml:798`):** rama `591de8e7f259073f79ff34418c8b7a3a2680d465ef3bc7378c620221455cc7f0`, que coincide con la anunciada; `main` `34c2ee77b94cf4d59b744eb53c44aa9e8e8fa34fe0362d77cc4513f30946eeb2`. Cambia, como prevé RN-4, y el aviso consta en "Implementation Result › PR 3 › Riesgos o pendientes".
- **D-1 (la copia de F-5 con el `deploy.sh` de `main`):** **221 ok, 7 FALLO**, exactamente los esperados:
  - run 9: "el log no anuncia ninguna recreación" y "el log dice que la app no se tocó";
  - A: las mismas dos;
  - B: "la app sigue parada" (con `main` la app se recrea y se arranca) y las dos de log.
  - Los códigos son los mismos que con la rama (15 en el run 9, 16 en A y 15 en B), y "la app no se tocó (mismo contenedor)" pasa también con `main`: confirma H-3.
  - Log de `main`: `hubo migraciones nuevas: la app en marcha (…) se recrea con su misma imagen` y `…; la app sigue con su versión, recreada por las migraciones nuevas`.
- **D-2 (`resumen-test.sh` con el `resumen.sh` de `main`):** salida 1, con exactamente 4 FALLO: "15: sin recreación", "15: sin la bandera", "inventory 16: sin recreación" e "inventory 16: sin la bandera".
- **D-3 (mutación de `resumen.sh`: 15 con "(DATABASE_ALLOW_NEWER_SCHEMA)" y 16 con "recreada"):** salida 1, con exactamente "15: sin la bandera" e "inventory 16: sin recreación". Cada `no_contiene` detecta su caso por separado. La mutación de `deploy.sh` queda cubierta por D-1.
- **R-1 (regresión):** `npm run typecheck` → 0. `npm run lint` → 0. `npm run build:css` → 0. `npm test` (MySQL de pruebas con `npm run db:up`) → 0: 49 archivos / 1166 pruebas, 58 / 887 y 16 / 278.

#### Criterios de aceptación

- **CA-2 (despliegue):** PASS (F-6).
- **CA-3:** PASS. api rota con migración nueva → 15 (F-4 run 9). inventory-manager roto con migración nueva → 16 (F-5 A). En ambos: mismo contenedor y misma imagen, log sin "se recrea" y mensaje "la app no se tocó".
- **CA-4:** PASS. Sin 22 en esos dos casos (también con la app parada, F-5 B) y sin `_app_unhealthy` en `deploy.sh` (F-1 y F-6).
- **CA-5:** PASS. `smoke.sh` real en verde: 21, "22, no 21", webhook y `.env` con la bandera → 3. `resumen-test.sh` y `shellcheck` también en verde.
- **CA-6:** PASS (F-3; D-2 y D-3 demuestran que las comprobaciones detectan la regresión).
- **CA-7:** PASS en lo verificable en local: `despliegue.md` describe CA-3 y CA-4 (F-7) y el aviso de RN-4 consta para el PR. PENDIENTE DEL USUARIO: incluir el aviso en el PR, y tras el merge reinstalar `deploy/` en el VPS y volver a ejecutar el job `deploy` hasta que dé 0.
- **CA-11:** PASS en local (R-1). El CI (`calidad`, `docker`, `auditoria` y `pruebas` en `pass`) se comprueba en la fase del PR.

#### Defectos encontrados

Ninguno.

#### Observaciones (no son defectos de este PR; código sin cambios en el diff)

- **O-7.** La limpieza de `smoke.sh` (`docker rm -f smoke-traefik smoke-registry …`, línea 62) no borra el volumen anónimo del registro (`/var/lib/registry`): queda un volumen por ejecución en una máquina persistente. En el CI el runner es efímero. Aquí se borraron a mano (3). Si se quiere corregir, irá en otro ticket (`docker rm -fv`).
- **O-8.** El `fail 4` de `deploy.sh` (línea 97) remite a "docs/despliegue.md, 'Actualizar deploy/'", pero la sección se llama "1.3 Instalar `deploy/`". Es anterior a este PR y queda fuera de alcance.

#### Regresión

`npm test` completo en verde y los 194 casos de `smoke.sh` (rechazos, 13, 21, 22, 15 y 16 sin migración, webhook, router y procedimientos documentados) en verde.

#### Responsive, accesibilidad, UX/UI, performance y SEO

No aplican: el PR solo toca scripts de despliegue y documentación, sin HTML, CSS, JS de navegador ni respuestas HTTP de las apps. No se usó navegador.

#### Pendientes de revisión manual

- CA-7 tras el merge: reinstalar `deploy/` en el VPS (`docs/despliegue.md` §1.3) y volver a ejecutar el job `deploy` hasta obtener 0 (RN-4 y R-1).
- El CI del PR en `pass`, no en `skipping`.

#### Limpieza

- **Docker:**
  - borradas las imágenes `qa047/restaurante:*`, `smoke/*` y `localhost:5000/orvigas/*`, y `traefik@sha256:575fa15b…` y `registry@sha256:ddf75434…` (no estaban antes);
  - borrados los 3 volúmenes anónimos del registro (O-7);
  - `docker images`, las redes y los volúmenes son idénticos al inventario inicial; solo queda `restaurante-mysql-dev-1`, detenido como estaba;
  - no se borraron `mysql@sha256:6ea90827…` ni `ghcr.io/orvigas/restaurante@sha256:8348a84f…`, porque no se pudo demostrar que los descargara este QA (no se descarga nada de GHCR).
- **MySQL de pruebas:** sin bases `restaurante_test*` (comprobado con `SHOW DATABASES`) y detenido con `npm run db:down`.
- **Procesos:** sin procesos de Vitest, smoke ni `docker events`.
- **Scratchpad:** borradas las copias (`f5`, `d1`, `d2`, `d3`), los `SMOKE_WORKDIR`, los logs y el script lanzador; queda vacío.
- **git:** `git worktree list` muestra el principal y este worktree, como al empezar. `git status` del worktree igual que al empezar, salvo este ticket.

#### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-11-17), aprobada con las opciones recomendadas P1 A a P6 A y P7 "no".

### Revisión técnica (senior-fullstack, 2026-11-17)

Hechos y números de línea comprobados contra `main` (`914ab18`). Se añaden "Revisión técnica" (hallazgos H-1 a H-9 y preguntas P-T1 a P-T3, con recomendación) y "Technical Action Plan" (un plan por PR). Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### PR 1 implementado (senior-fullstack, 2026-11-17)

Plan aprobado por el usuario ("SI lo apruebo"; P-T1 sí, P-T2 sí, P-T3 A). Rama `feature/REQ-F-047-limpieza-posterior-req-f-045-1-textos`; ticket en `in-progress/`. PR 1 implementado y validado, sin commit. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

PR 1: se añaden `README.md:1803` y `api/.env.example:111` (aprobado: "si lo apruebo e incluyelos"). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 1 (senior-qa, 2026-11-17)

Implementación del PR 1 aprobada por el usuario ("si lo apruebo e incluyelos"). Se añade "QA Action Plan" (Q-1 a Q-9). Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 1, ronda 1 (senior-qa, 2026-11-17)

Plan aprobado por el usuario ("si"). Q-1 a Q-9 en verde; DEF-001 (MINOR, nota de `arquitectura.md`) y observaciones O-1 a O-3. Se añade "QA Report". Estado: `QA_APPROVED`.

PR 1, ronda 1 de QA: corregidos DEF-001 (nota de `arquitectura.md`) y O-1 (comentarios de `product-repository.ts`); O-3 queda para otro ticket. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA del PR 1, ronda 2 (senior-qa, 2026-11-17)

Ronda aprobada por el usuario ("si la apruebo"). DEF-001 corregido; Q-1, Q-2, Q-3 (10 `.ts`), Q-5, Q-7, Q-9 y la suma de `deploy/` en verde. DEF-003 (MINOR): el comentario nuevo de `product-repository.ts:34-35` dice que la API pública lee la caché del repositorio, y no la lee. Estado: `QA_REJECTED`.

PR 1, ronda 2 de QA (`QA_REJECTED` por DEF-003): corregido el comentario de `product-repository.ts:34-36` y repasados todos los comentarios nuevos. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA del PR 1, ronda 3 (senior-qa, 2026-11-17)

Ronda aprobada por el usuario ("la paruebo"). DEF-003 corregido; nueve comentarios contrastados de forma independiente; Q-1, Q-2, Q-3 (10 `.ts`), Q-7, Q-9 y la suma de `deploy/` en verde. Observación O-4 (`api/src/bot/config.ts:15-16`, fuera de alcance). Estado: `QA_APPROVED`.

PR 1: commit `af4da63` y PR #165 a `main` (https://github.com/orvigas/negocio/pull/165). O-4 queda para el PR 2 y O-3 para otro ticket. Estado: `READY_FOR_MERGE` (PR 1 de 3).

PR 2 implementado: cuatro pruebas nuevas, retirada del modo `panel` y de las ramas de `planPageImport`, y O-4. Se registra el CI del PR 1 (#165, mergeado como `4991aa1`). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 2 (senior-qa, 2026-11-17)

Implementación del PR 2 aprobada por el usuario ("si apruebo"). Se añade "QA Action Plan › PR 2" (T-0 a T-14, mutaciones M1 a M10 en worktrees temporales). Estado: `NEEDS_QA_PLAN_APPROVAL`.

QA del PR 2 sin ejecutar (senior-qa, 2026-11-18): la respuesta del usuario ("Olvida lo que te dije y continúa") no aprueba explícitamente el QA Action Plan ni las autorizaciones de entorno. Se pide una aprobación explícita. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 2, ronda 1 (senior-qa, 2026-11-18)

Plan aprobado por el usuario ("Apruebo el plan y las 4 autorizaciones"). T-0 a T-14 en verde:
- mutaciones M1 a M10 detectadas (M5 por pruebas existentes);
- CA-12 sin diferencias en 59 respuestas;
- siembra igual en `main` y en la rama, idempotente y con `page_seed_skipped` ante concurrencia.

Sin defectos; observaciones O-5 y O-6. Limpieza completa. Estado: `QA_APPROVED`.

PR 2: commit `66d31f9` y PR #167 a `main` (https://github.com/orvigas/negocio/pull/167). Estado: `READY_FOR_MERGE` (PR 2 de 3).

### PR 3 implementado (senior-fullstack, 2026-11-18)

Usuario: "Si, sigue". `deploy.sh` sin la recreación de la app en 15 y 16 (`fail_before_app`), `resumen.sh`, `resumen-test.sh`, `smoke.sh` (run 9) y `despliegue.md`. `shellcheck`, `resumen-test.sh`, `smoke.sh` real (194 ok), `typecheck`, `lint` y `test` en verde. Nueva suma de `deploy/`: `591de8e7…5cc7f0`. O-5 resuelta en el CI del PR #167 (máximo 11,4 s). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan del PR 3 (senior-qa, 2026-11-18)

Plan aprobado por el usuario ("Si"), junto con sus 5 autorizaciones. Se añade "QA Action Plan › PR 3. `deploy.sh`".

### QA del PR 3, ronda 1 (senior-qa, 2026-11-18)

Resultados:
- `shellcheck`, `resumen-test.sh`, `typecheck`, `lint` y `npm test` en verde.
- `smoke.sh` real: 194 ok.
- Copia de P-T3 A: 228 ok, con inventory-manager roto tras una migración nueva → 16 y el caso límite con la app parada → 15.
- Diferenciales que fallan exactamente donde se espera: D-1, 7 FALLO con el `deploy.sh` de `main`; D-2, 4 FALLO; D-3, 2 FALLO.
- Suma `591de8e7…5cc7f0`.

Sin defectos; observaciones O-7 y O-8, fuera de alcance. Limpieza comprobada. Estado: `QA_APPROVED`.

### PR 3: commit y Pull Request (senior-fullstack, 2026-11-18)

Usuario: "Si apruebo el commit y el PR". Commit `4298bb3` y PR #169 a `main` (https://github.com/orvigas/negocio/pull/169), con el aviso de RN-4. Estado: `READY_FOR_MERGE` (PR 3 de 3), con el CI comprobado tras marcarlo como listo.
