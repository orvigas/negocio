# REQ-F-030 — Identificar en GitHub Actions el commit de cada despliegue

## Estado

READY_FOR_MERGE

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-15): "Si apruebo todo lo sugerido". Incluye aceptar "commit anterior no disponible" en el estado Revertido si obtenerlo obligara a cambiar `deploy.sh`.

Solicitud original: "quiero que modifiques el pipeline para identificar cada deployment con el hash del commit o algo que sirva para saber que fue desplegado en GH".

Decisiones del usuario durante el análisis:

1. Dónde ver: "Ejecución de Actions" (título de la ejecución con el commit corto y resumen del job `deploy` siempre escrito). No se eligieron Environments/Deployments ni Releases/tags como vista principal.
2. Versión en la app: "No, solo GitHub (Recomendado)".
3. Regla de "desplegado": "Sí, confirmo (Recomendado)". Aplica también a los registros que el environment `production` genera en Deployments.
4. Formato: "SHA corto + enlace (Recomendado)": 7 caracteres mostrados, SHA completo en el resumen y en el enlace.

## Objetivo

Saber, desde la ejecución de GitHub Actions, qué commit se intentó desplegar y con qué resultado (desplegado, omitido, fallido o revertido), sin entrar al VPS y sin que GitHub muestre como desplegado algo que no quedó en producción.

## Situación de partida

- GHCR ya etiqueta las imágenes con `sha-<SHA completo>` y la etiqueta OCI `revision`. No cambia.
- El resumen del job `deploy` solo se escribe tras un despliegue exitoso (`.github/workflows/ci.yml`, paso `resumen`). El caso "ya no es la punta de `main`" deja una línea suelta. Un fallo o una vuelta atrás no dejan resumen.
- El environment `production` del job `deploy` crea un registro en Deployments en cada ejecución del job. Un commit omitido por no ser la punta queda como exitoso (contradicción C1, que este requisito corrige).
- Los títulos de las ejecuciones no incluyen el commit. Las manuales aparecen solo como "CI".
- `deploy.sh` devuelve códigos de salida distintos (21 = revertido, 22 = la versión anterior tampoco arrancó, 20 = primer despliegue sin versión anterior, y otros), y se propagan por SSH al job.
- C2: `restaurante/docs/despliegue.md` describe `release.env` como "digests actuales", pero también guarda `RESTAURANTE_COMMIT`.

## Alcance

- Título de las ejecuciones del workflow CI con el commit corto.
- Resumen del job `deploy` en todos los resultados.
- Registro de Deployments del environment `production` coherente con la regla de "desplegado".
- Documentación: `restaurante/README.md` (sección CI), `restaurante/docs/despliegue.md` y la corrección de C2.

## Fuera de alcance

- Git tags y GitHub Releases. No se piden permisos nuevos de escritura en el repositorio.
- Versión visible en la app: cabecera, ruta, panel o HTML.
- Cambios en la publicación de imágenes en GHCR, en la estrategia de despliegue o en la vuelta atrás.
- Notificaciones externas y métricas.

## Requisitos

- **RF-1. Título de la ejecución.** Toda ejecución del workflow CI muestra en su título el SHA corto (7 caracteres) del commit evaluado, junto a un texto descriptivo:
  - push a `main`: el mensaje del commit;
  - PR: el título del PR, con el commit de la punta de la rama del PR (no el commit de merge de prueba);
  - `workflow_dispatch`: un texto que la identifique como ejecución manual, con el commit de la punta de `main` que se ejecuta.
- **RF-2. Resumen de `deploy` siempre presente.** Cada vez que el job `deploy` se ejecuta, su resumen incluye un encabezado con uno de los estados siguientes, el SHA corto enlazado a la página del commit en GitHub y el SHA completo:
  - **Desplegado:** además, los digests de app y migrate.
  - **Omitido:** el commit ya no era la punta de `main`. Incluye el SHA corto, enlazado, del commit vigente de `main` y la explicación de que lo desplegará su propia ejecución.
  - **Revertido:** la versión nueva no quedó sana y producción volvió a la anterior (código 21). Indica que producción sigue con la versión anterior. Si el commit anterior se puede conocer sin ampliar permisos ni secretos y sin cambiar `deploy.sh`, lo muestra; si no, indica explícitamente "commit anterior no disponible".
  - **Fallido:** cualquier otro error, incluidos los códigos 22 y 20. Indica el código de salida y si producción pudo quedar afectada. En el 22 y el 20 remite a la sección de errores de `docs/despliegue.md`.
  - **Cancelado o interrumpido:** si el job se cancela o agota el tiempo después de empezar el despliegue, indica que el resultado no está confirmado y remite a `state/releases.log`. Esto se cumple en la medida en que GitHub ejecute los pasos de cierre.
- **RF-3. Regla de "desplegado".** Un commit solo cuenta como desplegado con éxito si quedó sirviendo en producción. El estado final del job `deploy` y el registro de Deployments del environment `production` coinciden con el resumen:
  - Desplegado: éxito.
  - Revertido o Fallido: fallido.
  - Omitido: no figura como despliegue exitoso o activo del environment (puede no aparecer o aparecer como no desplegado).
- **RF-4. Documentación.** `restaurante/README.md` (sección CI) y `restaurante/docs/despliegue.md` explican dónde ver el commit desplegado (título y resumen de la ejecución) y qué significa cada estado. Se corrige C2: `release.env` guarda los digests y el commit desplegado.

## Historias de usuario

- **HU-1.** Como dueño del proyecto, quiero ver en la lista de ejecuciones de Actions el commit de cada una, para identificar rápido cuál corresponde a un despliegue.
- **HU-2.** Como dueño del proyecto, quiero que el resumen de `deploy` diga siempre si el commit quedó en producción, para no tener que entrar por SSH al VPS.

## Reglas de negocio

- **RN-1.** "Desplegado" significa que el commit quedó sirviendo en producción, nada más.
- **RN-2.** El identificador que se muestra es el SHA de 7 caracteres. El SHA completo siempre queda en el resumen y en el enlace.
- **RN-3.** No se amplían los permisos del token ni el acceso a secretos de ningún job.

## Criterios de aceptación

- **CA-1.** Given un push de código a `main` que se despliega sano, When termina el workflow, Then:
  - el título de la ejecución en Actions muestra el SHA corto de ese commit;
  - el resumen de `deploy` muestra "Desplegado", el SHA corto enlazado a la página del commit, el SHA completo y los dos digests;
  - el job termina en éxito.
- **CA-2.** Given un commit que ya no es la punta de `main` cuando corre su `deploy`, Then:
  - el resumen muestra "Omitido" con el commit vigente de `main`;
  - en Deployments del environment `production` ese commit no figura como despliegue exitoso o activo;
  - el despliegue activo sigue siendo el anterior.
- **CA-3.** Given un despliegue en el que `deploy.sh` revierte (código 21), Then:
  - el resumen muestra "Revertido" y que producción sigue con la versión anterior, con su commit o con "commit anterior no disponible";
  - el job y su registro de Deployments quedan como fallidos.
- **CA-4.** Given un despliegue que falla con cualquier otro código, Then el resumen muestra "Fallido" con el código de salida, y el job y su registro de Deployments quedan como fallidos.
- **CA-5.** Given una ejecución manual (`workflow_dispatch`), Then:
  - el título la identifica como manual e incluye el SHA corto de la punta de `main`;
  - si se despliega, se cumple CA-1;
  - un redespliegue del mismo commit se distingue por su propia ejecución y fecha.
- **CA-6.** Given un PR, Then el título de la ejecución incluye el título del PR y el SHA corto de la punta de su rama.
- **CA-7.** Given un push que solo cambia documentación, Then:
  - el título muestra el SHA corto;
  - `deploy` no se ejecuta y no se crea ningún registro nuevo en Deployments;
  - el resumen de `cambios` sigue indicando la omisión.
- **CA-8.** Los permisos (`permissions`) de los jobs y los secretos accesibles no aumentan respecto a la versión actual.
- **CA-9.** La documentación describe dónde ver el commit desplegado y los estados del resumen, y `docs/despliegue.md` indica que `release.env` guarda los digests y el commit.

## Casos límite

- Commit superado por otro antes de desplegar: Omitido (CA-2).
- Vuelta atrás: Revertido (CA-3). Si la versión anterior tampoco arranca (código 22): Fallido.
- Primer despliegue sin versión anterior (código 20): Fallido.
- Redespliegue manual del mismo commit (CA-5).
- Push solo de documentación (CA-7).
- Job cancelado o con tiempo agotado a mitad del despliegue: resultado no confirmado (RF-2).

## Dependencias

- REQ-F-016: workflow, `deploy.sh` con comando forzado, códigos de salida y prueba de humo `deploy/ci/smoke.sh`.
- No se espera cambiar `deploy.sh`. Si se cambiara, cambia la suma de `deploy/` y hay que reinstalar `deploy/` en el VPS.

## Riesgos

- **Asociación del environment al job (RF-3):** cambiarla puede afectar a la protección del environment y al acceso a los secretos `VPS_*`. Los secretos deben seguir visibles solo para lo que despliega.
- **Resumen "siempre":** depende de pasos que corran aunque fallen los anteriores. Se debe validar con fallos simulados.
- **Estados difíciles de provocar en producción:** Omitido y Revertido. Hay que acordar con QA cómo verificarlos (prueba de humo, ejecución controlada o revisión del workflow).

## Action Plan

### Objetivo

Commit y resultado de cada despliegue visibles y fiables en la ejecución de Actions.

### Alcance

RF-1 a RF-4.

### Fuera de alcance

- Tags y Releases.
- Versión en la app.
- Permisos nuevos.
- Cambios en la publicación de imágenes o en la estrategia de despliegue.

### Cambios requeridos

1. Título de las ejecuciones con el SHA corto según el tipo de evento.
2. Resumen de `deploy` con los estados definidos y el enlace al commit.
3. Distinguir Revertido de Fallido por el resultado del despliegue.
4. Que un commit omitido no quede como despliegue exitoso del environment `production`.
5. Documentación y corrección de C2.

### Orden recomendado

RF-2 → RF-3 → RF-1 → RF-4.

### Resultado esperado

- En la lista de Actions se ve el SHA corto de cada ejecución.
- En el resumen de `deploy` se sabe si ese commit quedó en producción, con enlace al commit.
- Deployments nunca muestra como exitoso un commit omitido.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios | Action Plan |
| --- | --- | --- | --- | --- |
| Ver el commit en Actions | RF-1 | HU-1 | CA-1, CA-5, CA-6, CA-7 | Cambio 1 |
| Saber el resultado del despliegue | RF-2 | HU-2 | CA-1 a CA-5 | Cambios 2 y 3 |
| Registro fiable | RF-3 | HU-2 | CA-2, CA-3, CA-4, CA-8 | Cambio 4 |
| Documentación | RF-4 | — | CA-9 | Cambio 5 |

Sin elementos de UI: no aplica `_stich_source_/`.

## Revisión técnica

Revisión de senior-fullstack (2026-10-15) sobre `.github/workflows/ci.yml` (tras el PR #62), `restaurante/deploy/deploy.sh`, `restaurante/deploy/ci/smoke.sh`, `restaurante/README.md` (sección CI) y `restaurante/docs/despliegue.md`. Hay un bloqueo (P-1) y dos ajustes que conviene confirmar (P-2 y P-3). El Technical Action Plan de abajo ya está escrito con las alternativas recomendadas; si se aceptan, queda listo para aprobar.

### P-1. El título no puede llevar el SHA de 7 caracteres (RF-1, RN-2, CA-1, CA-5, CA-6, CA-7). Bloqueante

- **Problema.** El título se define con `run-name`, que solo admite expresiones con los contextos `github` e `inputs`. Las expresiones de GitHub Actions no tienen función para recortar texto (solo `format`, `contains`, `startsWith`, `join`, `toJSON`, etc.), y el título no se puede cambiar una vez iniciada la ejecución. Con esas expresiones solo se puede poner el SHA completo de 40 caracteres.
- **Lo que ya muestra GitHub.** En la lista de ejecuciones, debajo del título, GitHub escribe una línea propia:
  - push: `CI #N: Commit abc1234 pushed by …`, con el SHA corto y enlazado;
  - PR: `Pull request #N synchronize by …`, sin SHA;
  - manual: `Manually run by …`, sin SHA.
- **Impacto.** RF-1 no se puede cumplir al pie de la letra con 7 caracteres.
- **Alternativas:**
  - **A (recomendada).**
    - Push: el título sigue siendo el mensaje del commit, y el SHA corto lo pone GitHub en la línea de debajo.
    - PR: `<título del PR> · <SHA completo de la punta de la rama>`.
    - Manual: `Ejecución manual · <SHA completo de main>`.
    - Los 7 primeros caracteres del SHA completo son el SHA corto, así que se puede comparar a simple vista con el resumen.
  - **B (uniforme).** `<texto> · <SHA completo>` en los tres eventos, también en el push. En la lista, un título largo puede verse truncado por el ancho. En la página de la ejecución se ve entero.
  - **C.** Dejar el título como está y mostrar el SHA corto solo en el resumen. No cumple HU-1 en PR ni en ejecuciones manuales.
- **Decisión requerida.** A, B o C.

### P-2. "Omitido" se escribe en un job previo, no en `deploy` (RF-2, RF-3, CA-2)

- **Problema.** Hoy la comprobación de la punta de `main` es el primer paso de `deploy`, que corre en el environment `production`. Por eso un commit omitido crea un registro en Deployments y termina en éxito (C1). Un paso no puede dejar el job como omitido: solo como éxito o fallo.
- **Solución propuesta.** Un job nuevo, `vigente`, sin environment y con `contents: read` (los mismos permisos que usa hoy la comprobación). Si el commit ya no es la punta, escribe el resumen **Omitido** y `deploy` queda omitido (*skipped*). Un job omitido no crea registro en Deployments y no ve los secretos `VPS_*`.
- **Consecuencias:**
  - el resumen "Omitido" aparece en la página de la ejecución como resumen del job `vigente`, no de `deploy`. Es la misma página que el resto de los resúmenes;
  - se mantiene una segunda comprobación dentro de `deploy`, justo antes del SSH. Cubre dos casos:
    - main avanzó mientras `deploy` esperaba al despliegue en curso;
    - alguien vuelve a ejecutar solo `deploy` (*Re-run failed jobs*) de un commit antiguo: con `vigente` reutilizado, desplegaría una versión vieja encima de la nueva.
  - En esos casos raros el resumen dice "Omitido" y el job termina en **fallo**. Así el registro de Deployments queda fallido y nunca como exitoso o activo, que es lo que exige RF-3. No hay forma de dejarlo omitido desde dentro del job.
- **Decisión requerida.** Confirmar que se acepta:
  - el resumen "Omitido" en el job `vigente`;
  - el fallo (en lugar de omisión) en el caso raro de la segunda comprobación.

### P-3. Revertido: commit anterior (RF-2, CA-3)

- **Situación.** `deploy.sh` no devuelve el commit anterior. En el error del código 21 solo imprime la imagen anterior por digest.
- **Por qué no se puede obtener de otra forma:**
  - traducir ese digest a un commit exige leer GHCR (`packages: read`), lo que amplía los permisos (RN-3);
  - leer `release.env.previous` exige cambiar `deploy.sh`.
- **Plan.** "commit anterior no disponible", como permite la aprobación. El resumen remite al log del paso `desplegar`, que ya muestra el digest anterior, y a `state/release.env` en el VPS.
- **Sin decisión nueva salvo objeción.** `deploy.sh` no cambia y no hay que reinstalar `deploy/`.

### Otros hallazgos (sin decisión)

- **Verificación.** En este equipo no están instalados `actionlint`, `act` ni `shellcheck`. `actionlint` ya se ha ejecutado aquí con Docker (imagen `rhysd/actionlint:1.7.12`) y se usará así. `act` no reproduce environments ni el comportamiento de cancelación, así que no se usará. La verificación se plantea en el apartado Testing del plan.

### Decisiones del usuario (2026-10-15)

- **P-1:** "Opción A (Recomendado)".
  - Push: el título es el mensaje del commit y GitHub muestra el SHA corto.
  - PR: "título del PR · SHA completo de la punta de la rama".
  - Manual: "Ejecución manual · SHA completo".
- **P-2:** "Sí (Recomendado)".
  - El job `vigente`, sin environment, escribe "Omitido".
  - El caso raro de la segunda comprobación dentro de `deploy` termina en fallo con el resumen "Omitido".
- **P-3:** sin objeción. Se muestra "commit anterior no disponible", ya aceptado al aprobar el requisito ("Si apruebo todo lo sugerido").
- **Códigos de salida.** `deploy/ci/smoke.sh` ya comprueba los códigos de `deploy.sh`, incluido el 21. Falta probar la traducción de código a estado del resumen.

## Technical Action Plan

Definitivo, con las decisiones del usuario: P-1 alternativa A, P-2 aceptada y P-3 "commit anterior no disponible".

### Objetivo técnico

Que cada ejecución del CI identifique su commit y que el resultado del despliegue quede escrito y sea coherente con Deployments. Todo ello sin ampliar permisos ni secretos y sin cambiar `deploy.sh`.

### Archivos o componentes afectados

- `.github/workflows/ci.yml`:
  - `run-name`;
  - job nuevo `vigente`;
  - job `deploy`: condición, segunda comprobación, captura del código de salida y paso `resumen`;
  - comentario de cabecera.
- `restaurante/deploy/ci/resumen.sh` (nuevo): genera el Markdown del resumen a partir del estado. Fuera de `DEPLOY_FILES`, así que no cambia la suma de `deploy/` ni hay que reinstalar nada en el VPS.
- `restaurante/deploy/ci/resumen-test.sh` (nuevo): pruebas del generador con entradas simuladas.
- Job `despliegue` del CI:
  - `shellcheck` también de los dos scripts nuevos;
  - un paso que ejecuta `resumen-test.sh`.
- `restaurante/README.md`: sección CI, en "Redespliegue manual" y en una subsección nueva "Qué se desplegó", más la fila `despliegue` de "Qué comprueba".
- `restaurante/docs/despliegue.md`:
  - "Cómo llega una versión a producción";
  - tabla 1.2 (C2);
  - sección 8, comprobaciones;
  - sección 10, diagnóstico.

### Cambios requeridos

1. **`run-name`** (alternativa A):
   - PR: `format('{0} · {1}', github.event.pull_request.title, github.event.pull_request.head.sha)`. Usa la punta de la rama, no `github.sha`, que en un PR es el commit de merge de prueba.
   - Manual: `format('Ejecución manual · {0}', github.sha)`.
   - Push: `github.event.head_commit.message`, el mismo texto que pone GitHub hoy.
   - `run-name` no ejecuta shell, así que el título del PR no permite inyección.
2. **Job `vigente`:**
   - `needs: publish` e `if: !cancelled() && needs.publish.result == 'success'`, la condición actual de `deploy`;
   - `permissions: contents: read`, `timeout-minutes: 5`, sin environment;
   - consulta `gh api repos/$GITHUB_REPOSITORY/commits/main --jq .sha` y valida que la respuesta tenga 40 caracteres hexadecimales;
   - salidas `deploy` (`true` o `false`) y `main`;
   - si `deploy=false`, escribe el resumen **Omitido** con `resumen.sh`;
   - si la API falla, el job falla: `deploy` no corre y no se crea registro en Deployments. Es un fallo visible antes de tocar producción.
3. **Job `deploy`:**
   - `needs: [publish, vigente]` e `if: !cancelled() && needs.publish.result == 'success' && needs.vigente.outputs.deploy == 'true'`;
   - el environment, la concurrencia y los permisos no cambian.
   - Pasos:
     1. `checkout` (sparse, `restaurante/deploy`).
     2. `commit vigente de main` (`id: head`): la segunda comprobación descrita en P-2. Si `main` avanzó, sale con código 1 y salida `omitido=true` sin tocar el VPS.
     3. `desplegar` (`id: ssh`):
        - `timeout-minutes: 17`, menor que los 20 del job, para que un SSH colgado agote el tiempo del paso y el resumen corra con margen;
        - en el shell: `rc=0; ssh … || rc=$?; echo "codigo=$rc" >> "$GITHUB_OUTPUT"; exit "$rc"`. El fallo del job se conserva;
        - los secretos `VPS_*` siguen solo en el `env` de este paso.
     4. `resumen`, con `if: always()`, sin secretos. Recibe:
        - `steps.ssh.outcome`, `steps.ssh.outputs.codigo`, `steps.head.outputs.omitido` y `job.status`;
        - los digests, `GITHUB_SHA`, `GITHUB_SERVER_URL` y `GITHUB_REPOSITORY`.

        Llama a `resumen.sh`. Si `checkout` falló y el script no existe, escribe en línea un resumen mínimo "Fallido: el despliegue no empezó; producción no se tocó".
4. **Reglas de `resumen.sh`** (la entrada se valida; nunca imprime secretos). Todos los resúmenes llevan:
   - un encabezado `### <Estado>`;
   - el SHA corto enlazado a `<server>/<repo>/commit/<SHA>`;
   - el SHA completo.

   | Entrada | Estado | Contenido adicional |
   | --- | --- | --- |
   | `omitido` (de `vigente` o de la segunda comprobación) | **Omitido** | SHA corto enlazado del commit vigente de `main`; "lo desplegará su propia ejecución" |
   | `ssh` = success | **Desplegado** | Digests de app y migrate |
   | código 21 | **Revertido** | "Producción sigue con la versión anterior; commit anterior no disponible (ver el log de `desplegar` y `state/release.env`)" |
   | códigos 2, 3, 4, 5, 10, 11, 12 | **Fallido** | Código; "producción no se tocó" |
   | código 13 | **Fallido** | Código; "la app no se tocó; la migración pudo quedar a medias" y enlace a la sección 9 |
   | códigos 20 y 22 | **Fallido** | Código; "producción pudo quedar sin servicio" y enlace a la sección 10 de `docs/despliegue.md` |
   | código 255 u otro | **Fallido** | Código; "error de conexión o desconocido: no se puede asegurar si producción cambió; revisa `state/releases.log`" |
   | paso no ejecutado (fallo antes del SSH) | **Fallido** | "El despliegue no empezó; producción no se tocó" |
   | SSH cancelado o sin código con el job cancelado o el tiempo agotado | **Cancelado o interrumpido** | "Resultado no confirmado; revisa `state/releases.log`" |

5. **Estado final del job y de Deployments** (RF-3):
   - Desplegado: éxito.
   - Revertido, Fallido y "Omitido" en la segunda comprobación: fallo, porque el paso que falló propaga su código.
   - Omitido en `vigente`: `deploy` omitido, sin registro.
   - Cancelado: cancelado.
6. **Documentación (RF-4, CA-9):**
   - **Dónde ver el commit desplegado.** En el título de la ejecución y en los resúmenes de `vigente` y `deploy`.
   - **Tabla de los cinco estados.** Qué significa cada uno y qué hacer.
   - **Deployments.** Solo registra los despliegues intentados; un omitido no aparece.
   - **C2.** `release.env` guarda los digests y el commit desplegado (`RESTAURANTE_COMMIT`).
   - **Sección 8 de `docs/despliegue.md`.** "`deploy` en verde con el resumen **Desplegado**".
   - **Comentario de cabecera de `ci.yml`.**

### Contenido / configuración

Sin variables de entorno ni secretos nuevos. El environment `production` y sus reglas de protección no cambian.

### Validaciones

- `resumen.sh` acepta solo:
  - estados conocidos;
  - SHA de 40 caracteres hexadecimales;
  - digests `sha256:` con 64 caracteres hexadecimales;
  - códigos numéricos.
- Cualquier otra entrada produce un resumen "Fallido (entrada no válida)", nunca texto sin validar.
- La URL del servidor y el repositorio vienen de variables de GitHub.

### Manejo de errores

- El fallo del SSH sigue haciendo fallar el job. El resumen nunca convierte un fallo en éxito: `resumen.sh` termina con 0, pero el estado del job lo decide el paso `desplegar`.
- Un error de la API en `vigente` hace fallar ese job antes de tocar producción.

### Testing

1. **`resumen-test.sh`** (CI, job `despliegue`). Ejecuta `resumen.sh` con entradas simuladas y comprueba el encabezado, el enlace, el SHA completo y los textos clave de cada caso:
   - éxito;
   - omitido;
   - códigos 21, 22, 20, 13, 4 y 255;
   - paso no ejecutado;
   - cancelado;
   - entrada no válida.

   Cubre Omitido y Revertido sin tocar producción. Que `deploy.sh` devuelve 21 al revertir ya lo prueba `smoke.sh`.
2. **`shellcheck`** de los scripts nuevos en el job `despliegue`.
3. **`actionlint`** sobre `ci.yml` en local con Docker (`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color`), como ya se hizo en este equipo. No se agrega al repositorio ni al CI, porque sería una herramienta nueva que habría que aprobar. `shellcheck` tampoco está instalado aquí: los scripts nuevos se revisan en el job `despliegue` del CI. Revisa:
   - la sintaxis de `run-name`;
   - las expresiones;
   - los `needs` y las salidas;
   - el shell embebido.
4. **Revisión del workflow:**
   - `vigente` no tiene environment ni secretos;
   - los `permissions` de cada job son iguales o menores que en `main` (CA-8): se comparan con `git diff`.
5. **Verificación real tras el merge (CA-1 y CA-7):**
   - el propio merge del PR despliega y debe mostrar el título y el resumen **Desplegado**, con `deploy` en verde;
   - en el PR, el título debe llevar el título del PR y el SHA de la punta (CA-6).
6. **Omitido real sin riesgo, opcional (CA-2 y CA-5):**
   1. Lanzar `gh workflow run ci.yml --ref main`.
   2. Mientras valida, mergear un PR de solo documentación.
   3. Resultado esperado:
      - la ejecución manual muestra **Omitido** en `vigente`;
      - `deploy` queda omitido;
      - Deployments no agrega registro;
      - producción sigue con el mismo código, porque el commit nuevo solo cambia documentación.

   Revertido y Fallido no se provocan en producción: los cubren el punto 1 y `smoke.sh`.

### Seguridad

- No cambian los `permissions` de ningún job; `vigente` usa `contents: read`.
- Los secretos `VPS_*` siguen visibles solo en el job con environment `production` y solo en el paso `desplegar`.
- Las acciones siguen fijadas por SHA. No se agregan acciones de terceros.
- `resumen.sh` no recibe secretos.

### Performance

- Un job más, de segundos, en los push y ejecuciones manuales que publican.
- En un PR no corre.

### Riesgos técnicos

- **Pasos de cierre en una cancelación.** El resumen de una cancelación depende de que GitHub ejecute los pasos `always()`. GitHub lo hace salvo en una cancelación forzada; el tiempo propio del paso `desplegar` reduce el riesgo cuando se agota el tiempo.
- **Cola de concurrencia.** Si `deploy` queda pendiente en `deploy-production` y llega otro, GitHub cancela el pendiente: el resultado es "Cancelado", sin despliegue, como hoy.
- **Registro de un job pendiente cancelado.** Puede aparecer en Deployments como cancelado o inactivo, nunca como exitoso.

### Orden de implementación

1. `resumen.sh` y `resumen-test.sh`.
2. Job `vigente` y cambios en `deploy` (RF-2 y RF-3).
3. `run-name` (RF-1).
4. Pasos del job `despliegue`.
5. Documentación (RF-4).
6. `actionlint` en local (Docker, `rhysd/actionlint:1.7.12`) y `resumen-test.sh` con bash, más `npm run typecheck`, `npm run lint` y `npm test`, que no deben cambiar.

### Criterios de finalización

- CA-1 a CA-9 cubiertos según el apartado Testing:
  - CA-1, CA-6 y CA-7: se verifican en el PR y tras el merge;
  - CA-2 a CA-4: con `resumen-test.sh` y la revisión, y CA-2 opcionalmente con el procedimiento del punto 6.
- `deploy.sh` y `DEPLOY_FILES` sin cambios.
- CI del PR en verde (`calidad`, `docker`, `despliegue` y `auditoria`).

## Implementation Result

### Rama

`feature/REQ-F-030-identificar-despliegue-en-actions`, creada desde `origin/main` (`7da4c4a`) en el worktree `/Users/orvigas/Desktop/Negocio-REQ-F-030` (en paralelo se trabaja REQ-F-031 en el directorio principal). Sin upstream, sin commit ni push.

### Cambios realizados

- **`run-name`** (RF-1, alternativa A): PR `<título del PR> · <head.sha>`; manual `Ejecución manual · <github.sha>`; push: la expresión da cadena vacía y GitHub usa su título por defecto (el mensaje del commit, con el SHA corto enlazado debajo). Desviación menor del plan: en lugar de `github.event.head_commit.message` (que es el mensaje completo, con varias líneas) se deja vacío, que según la documentación de GitHub produce exactamente el título actual.
- **Job `vigente`** (nuevo): `needs: publish`, misma condición que tenía `deploy`, `permissions: contents: read`, 5 min, sin environment ni secretos. Consulta `main` con `gh api`, valida 40 hex (si no, falla), salidas `deploy` y `main`; si el commit no es la punta, checkout disperso de `restaurante/deploy/ci` y resumen **Omitido** con `resumen.sh vigente`.
- **Job `deploy`**: `needs: [publish, vigente]`, `if` con `needs.vigente.result == 'success' && needs.vigente.outputs.deploy == 'true'`; environment, concurrencia y permisos sin cambios. Pasos: `checkout` → `commit vigente de main` (segunda comprobación: si `main` avanzó, salida `omitido=true` y `exit 1` sin tocar el VPS) → `desplegar` (`id: ssh`, `timeout-minutes: 17`, `rc=0; ssh … || rc=$?; codigo=$rc; exit $rc`; secretos `VPS_*` solo aquí) → `resumen` (`if: always()`, sin secretos; llama a `resumen.sh deploy` o, si falta el checkout, escribe un "Fallido: el despliegue no empezó" mínimo).
- **`restaurante/deploy/ci/resumen.sh`** (nuevo, fuera de `DEPLOY_FILES`): genera el Markdown de los estados de la tabla del plan; valida todas las entradas (SHA, digests, código, resultado del paso, estado del job, servidor y repositorio) y ante cualquier valor inesperado escribe "Fallido (entrada no válida)" sin reproducirlo; termina siempre con 0. Casos añadidos al plan: `failure` sin código (tiempo agotado del paso) y cancelación antes del SSH → **Cancelado o interrumpido**. Los enlaces a `docs/despliegue.md` apuntan al archivo del propio commit (`blob/<SHA>`). Tras **Revertido** indica "Commit anterior no disponible" y remite al log de `desplegar` y a `state/release.env` (que `deploy.sh` no reescribe en una vuelta atrás).
- **`restaurante/deploy/ci/resumen-test.sh`** (nuevo): 55 comprobaciones de los casos del plan (desplegado, omitido en `vigente` y en `deploy`, 21, 22, 20, 13, 4, 255, paso no ejecutado, cancelado, tiempo agotado, cancelado antes del SSH y seis entradas no válidas).
- **Job `despliegue`**: `shellcheck` también de `ci/resumen.sh` y `ci/resumen-test.sh`, y paso nuevo `prueba del resumen`.
- **Documentación**: cabecera de `ci.yml`; `README.md` (tiempo de `vigente`, "Redespliegue manual", subsección nueva "Qué se desplegó" con la tabla de estados y Deployments, fila `despliegue` de "Qué comprueba"); `docs/despliegue.md` ("Cómo llega una versión a producción" con `vigente` y el resumen, subsección nueva "Qué commit está desplegado", tabla 1.2 con C2 corregida, sección 8 con **Desplegado**, sección 10 con tres filas nuevas).

### Criterios de aceptación

- **CA-1**: implementado (título por defecto con SHA corto en push; resumen **Desplegado** con enlace, SHA completo y digests; éxito). Verificación real pendiente tras el merge.
- **CA-2**: implementado (`vigente` escribe **Omitido** y `deploy` queda *skipped*, sin registro en Deployments; la segunda comprobación falla sin tocar el VPS). Cubierto por `resumen-test.sh` y revisión del workflow; prueba real opcional según el punto 6 del Testing.
- **CA-3**: implementado (código 21 → **Revertido**, "commit anterior no disponible", job en fallo). Cubierto por `resumen-test.sh`; el 21 de `deploy.sh` ya lo prueba `smoke.sh`.
- **CA-4**: implementado (cualquier otro código → **Fallido** con el código; job en fallo). Cubierto por `resumen-test.sh`.
- **CA-5**: implementado (`Ejecución manual · <SHA>`). Verificable con una ejecución manual tras el merge.
- **CA-6**: implementado (`<título del PR> · <head.sha>`). Verificable en el propio PR.
- **CA-7**: sin cambios en `cambios`; en un push de solo documentación `publish` no corre, así que `vigente` y `deploy` quedan omitidos y no hay registro. Verificable tras el merge de un cambio de documentación.
- **CA-8**: cumplido. `git diff` solo agrega `permissions: contents: read` en `vigente` (el mismo permiso que usaba la comprobación dentro de `deploy`); los `secrets.VPS_*` siguen solo en el paso `desplegar` del job con environment `production`.
- **CA-9**: cumplido (README "Qué se desplegó", `docs/despliegue.md` "Qué commit está desplegado" y tabla 1.2).

### Validaciones ejecutadas

- `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color` (incluye shellcheck del shell embebido): 0, sin hallazgos.
- `bash restaurante/deploy/ci/resumen-test.sh` (bash 3.2 de macOS): 0, 55 comprobaciones `ok`. Comprobado que detecta un fallo: con un `resumen.sh` alterado (encabezado `Revertidx`) termina con 1.
- `shellcheck` (imagen `koalaman/shellcheck:stable`, con `LC_ALL=C.UTF-8`) de `ci/resumen.sh`, `ci/resumen-test.sh`, `ci/smoke.sh`, `deploy.sh` y `mysql/initdb/01-usuarios.sh`: 0. SC2016 se desactiva en los dos scripts nuevos con su justificación (comillas invertidas de Markdown entre comillas simples a propósito).
- `npx vitest run tests/unit/whatsapp-bot-free-text.test.ts` (lee el README): 57/57.
- `npm run typecheck`: 0. `npm run lint`: 0.
- `npm test` completo no se ejecutó: no hay cambios en código TypeScript ni en archivos que lean las pruebas, salvo el README, cubierto por la prueba anterior.
- `git diff`: solo archivos del ticket; `deploy.sh`, `compose.prod.yaml`, `mysql/initdb/01-usuarios.sh` y la suma de `deploy/` sin cambios.

### Archivos afectados

- `.github/workflows/ci.yml`
- `restaurante/deploy/ci/resumen.sh` (nuevo)
- `restaurante/deploy/ci/resumen-test.sh` (nuevo)
- `restaurante/README.md`
- `restaurante/docs/despliegue.md`
- `.claude/docs/in-progress/REQ-F-030-identificar-despliegue-en-actions.md`

### Riesgos o pendientes

- El título vacío en push depende de que GitHub aplique su título por defecto cuando `run-name` es vacío (comportamiento documentado). Se confirma en el primer push a `main` tras el merge.
- La verificación real de CA-1, CA-5, CA-6 y CA-7 solo es posible en el PR y tras el merge (Testing, puntos 5 y 6).
- Un `deploy` cancelado mientras espera en la cola `deploy-production` no ejecuta pasos y no deja resumen (igual que hoy; riesgo ya aceptado en el plan).

## QA Action Plan

### Objetivo

Validar, antes del merge, que el workflow y `resumen.sh` cumplen RF-1 a RF-4 y CA-1 a CA-9 sin ampliar permisos ni secretos ni cambiar lo instalado en el VPS. Dejar definidas las comprobaciones que solo GitHub puede dar (en el PR y tras el merge).

Sin UI: no aplican navegador, responsive, accesibilidad visual, `_stich_source_/`, SEO ni performance web.

### Requisito bajo prueba

RF-1 a RF-4 con las decisiones P-1 (alternativa A), P-2 y P-3.

Archivos bajo prueba:

- `.github/workflows/ci.yml`;
- `restaurante/deploy/ci/resumen.sh`;
- `restaurante/deploy/ci/resumen-test.sh`;
- `restaurante/README.md` (sección CI);
- `restaurante/docs/despliegue.md`.

Base de comparación: `7da4c4a` (`HEAD` = `origin/main`). El trabajo está sin commit, así que se compara el árbol de trabajo con `HEAD`, no `main...HEAD`: el `main` local está desfasado.

### Criterios de aceptación

| CA | Pruebas que lo cubren | Cuándo se verifica |
| --- | --- | --- |
| CA-1 | W-1, W-4, W-5, R-1 (Desplegado), S-2 | Antes del merge: estático y simulado. En GitHub: tras el merge (G-2) |
| CA-2 | W-3, W-4, W-6, R-1 (Omitido en `vigente` y en `deploy`), S-1 | Antes del merge. En GitHub: opcional (G-4) |
| CA-3 | W-5, R-1 (21), S-2 | Antes del merge. No se provoca en producción |
| CA-4 | W-5, R-1 (22, 20, 13, 4, 255, sin código, no ejecutado), S-2 | Antes del merge. No se provoca en producción |
| CA-5 | W-1 | Antes del merge: estático. En GitHub: G-3 (ejecución manual) |
| CA-6 | W-1 | Antes del merge: estático. En GitHub: en el propio PR (G-1) |
| CA-7 | W-2 | Antes del merge: estático. En GitHub: con el primer push de solo documentación (G-5) |
| CA-8 | W-6, W-7 | Antes del merge |
| CA-9 | D-1, D-2 | Antes del merge |

### Riesgos identificados

1. **Título vacío en push.** `run-name` da `''` en un push. Se confía en que GitHub use entonces su título por defecto. No se puede comprobar en local.
2. **Captura del código de salida.** El shell por defecto de GitHub es `bash -eo pipefail`. Hay que comprobar con ese mismo modo que `|| rc=$?` no corta el script antes de escribir `codigo`, y que el paso sale con el mismo código.
3. **Resumen siempre.** `if: always()` debe cubrir los casos de error:
   - falla `checkout`;
   - falla la segunda comprobación;
   - se agota el tiempo del paso `desplegar` (17 min, sin `codigo`);
   - se cancela el job.
4. **Coherencia con Deployments (RF-3).**
   - `deploy` solo debe correr con `vigente` en éxito y `deploy == 'true'`.
   - Omitido en la segunda comprobación debe terminar en fallo.
   - Ningún camino que no sea Desplegado puede terminar en éxito.
5. **Inyección en el resumen.** Las entradas llegan a Markdown en `$GITHUB_STEP_SUMMARY`: salidas de pasos, outputs de `publish` y variables de GitHub. Un valor no validado podría:
   - inyectar enlaces o encabezados;
   - partir líneas;
   - mostrar texto engañoso, por ejemplo un falso "Desplegado".

   El regex de `GITHUB_REPOSITORY` admite `.` y `..`. Se comprueba el efecto, aunque el valor lo pone GitHub.
6. **Secretos.**
   - `vigente` no debe tener environment ni secretos.
   - El paso `resumen` no debe recibir `VPS_*`.
   - `resumen.sh` nunca debe imprimir el entorno.
7. **Suma de `deploy/`.** Si cambia `DEPLOY_FILES` o alguno de sus archivos, hay que reinstalar `deploy/` en el VPS.
8. **Anclas de la documentación.** Los enlaces `#10-diagnóstico` y `#9-restaurar-la-base-desde-un-volcado` deben existir en `docs/despliegue.md`.
9. **Regresión del CI.**
   - Ni el job `despliegue` ni la cadena `cambios` → `validado` → `publish` deben romperse.
   - La concurrencia `deploy-production` y el rechazo de `workflow_dispatch` fuera de `main` no deben cambiar.
10. **Entorno.** CodeGraph no tiene índice en el worktree; se usan Read y Grep. `npm test` usa el contenedor `restaurante-mysql-dev-1`, compartido con el directorio principal, donde avanza REQ-F-031. Si ambas suites corren a la vez pueden pisarse las bases `restaurante_test*`. Se ejecuta una sola vez y, si falla por colisión, se repite sin tocar el otro directorio.

### Pruebas funcionales

**Revisión del workflow (W)**, con `git diff HEAD -- .github/workflows/ci.yml` y lectura dirigida:

- **W-1. `run-name`.**
  - PR: `<título> · head.sha`, no `github.sha`.
  - Manual: `Ejecución manual · github.sha`.
  - Push: `''`.
  - Precedencia de `&&` y `||`: un título de PR vacío no puede caer en la rama manual. GitHub no permite títulos de PR vacíos, así que se anota y no es defecto.
  - Sin interpolación en shell.
- **W-2. Push de solo documentación.**
  - `publish` no corre, así que `vigente` (`needs.publish.result == 'success'`) y `deploy` quedan omitidos.
  - El resumen de `cambios` no cambia (diff vacío en ese job).
- **W-3. Job `vigente`.**
  - `needs: publish`, la condición actual, `permissions: contents: read`, sin `environment` y sin `secrets.*`.
  - Valida 40 hex y falla si no.
  - Outputs `deploy` y `main`.
  - El `checkout` disperso de `restaurante/deploy/ci` y el resumen solo corren si `deploy == 'false'`.
- **W-4. `deploy`.**
  - `needs: [publish, vigente]` y la condición con `needs.vigente.result == 'success' && needs.vigente.outputs.deploy == 'true'`.
  - `environment`, `concurrency`, `permissions` y `timeout-minutes: 20` iguales a `HEAD`.
  - Orden de pasos: checkout → segunda comprobación (falla con `omitido=true` y `main`) → `desplegar` (`id: ssh`, `timeout-minutes: 17`) → `resumen` (`if: always()`).
- **W-5. Captura del código, simulada en local** (scripts temporales en el scratchpad, no en el repositorio):
  - se ejecuta el cuerpo del paso `desplegar` con `bash --noprofile --norc -eo pipefail`, con `ssh` sustituido por un falso que sale con 0, 21, 22, 255 y 4;
  - `GITHUB_OUTPUT` es un archivo temporal;
  - se espera `codigo=<rc>` escrito y salida del paso igual a `<rc>`.
- **W-6. Segunda comprobación y `vigente`, simulados igual,** con un `gh` falso que devuelve:
  - el mismo SHA: `deploy=true`, sin fallo;
  - otro SHA: `omitido=true` y salida 1 en `deploy`, `deploy=false` y salida 0 en `vigente`;
  - vacío, texto o un SHA con salto de línea: salida 1 con `::error::`;
  - un error de `gh` (salida distinta de 0): falla.
- **W-7. Permisos y secretos (CA-8).**
  - Se comparan los bloques `permissions:` de cada job y el de nivel superior entre `HEAD` y el árbol de trabajo: solo se agrega `vigente` con `contents: read`.
  - `secrets.` solo aparece en el `env` del paso `desplegar`.
  - No hay acciones nuevas y todas siguen fijadas por SHA.
  - `GH_TOKEN` solo con `github.token`.
- **W-8. `actionlint`.** `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color` en la raíz del worktree. Esperado: 0 sin hallazgos. Incluye shellcheck del shell embebido.

**`resumen.sh` (R)**:

- **R-1.** `bash restaurante/deploy/ci/resumen-test.sh`: 0 y todas las comprobaciones `ok`.
- **R-2. Prueba de que la prueba detecta fallos.** Sobre una copia en el scratchpad de `resumen.sh` y `resumen-test.sh`, se introducen tres mutaciones por separado:
  - encabezado de Revertido cambiado;
  - código 21 tratado como Fallido;
  - Desplegado sin digest.

  Esperado: `resumen-test.sh` termina con distinto de 0 en cada una.
- **R-3. Tabla del Technical Action Plan.** Se ejecuta `resumen.sh` directamente con cada combinación y se compara el encabezado y el texto con la tabla del plan:
  - `SSH_OUTCOME`: success, failure, cancelled, skipped y vacío;
  - `SSH_CODE`: vacío, 0, 2, 3, 4, 5, 10, 11, 12, 13, 20, 21, 22, 255 y 1;
  - `JOB_STATUS`: success, failure y cancelled;
  - `OMITIDO`: true y vacío;
  - modo `vigente` y `deploy`.

  Debe comprobarse:
  - que nunca sale "Desplegado" salvo con `success` y digests válidos;
  - que todo resumen lleva el enlace `<server>/<repo>/commit/<SHA>` y el SHA completo, salvo "entrada no válida".

### Pruebas negativas y casos límite

**S-1. Inyección en `resumen.sh`.** Cada entrada lleva un valor malicioso y se exige:

- salida 0;
- encabezado "Fallido (entrada no válida)";
- que el valor (o su parte peligrosa) no aparezca en la salida;
- ninguna ejecución de comandos (archivo testigo no creado).

Entradas por variable:

- **`GITHUB_SHA`, `MAIN_SHA`:**
  - `$(touch <testigo>)`;
  - un SHA válido seguido de `\n### Desplegado`;
  - 39 y 41 caracteres;
  - mayúsculas;
  - `](javascript:alert(1))`.
- **`SSH_CODE`:**
  - `21; touch <testigo>`;
  - `21\n### Desplegado`;
  - `1000`, `-1`, ` 21`, `0x15`.
- **`APP_DIGEST`, `MIGRATE_DIGEST`** con `SSH_OUTCOME=success`:
  - vacío;
  - `sha256:` con 63 o 65 hex;
  - un digest válido más `\n- extra`;
  - `sha512:…`.
- **`GITHUB_SERVER_URL`:**
  - `http://…`;
  - `https://evil.example)[x](https://evil`;
  - `javascript:…`;
  - con barra final;
  - vacío.
- **`GITHUB_REPOSITORY`:**
  - `a/b/c`;
  - `a/b)[x](y`;
  - vacío;
  - `../..`, del que se anota el efecto en el enlace.
- **`SSH_OUTCOME`, `JOB_STATUS`, `OMITIDO`:** `Success`, `TRUE`, `yes` y valores con saltos de línea.
- **Modo:** vacío, `otro`, `deploy extra`.
- **Secretos:** con `VPS_SSH_KEY=SECRETO-QA` en el entorno, `SECRETO-QA` no aparece en ninguna salida.

**S-2. Combinaciones límite:**

- `failure` sin código: Cancelado o interrumpido (tiempo agotado del paso);
- `cancelled` con código;
- `success` sin digests: entrada no válida, nunca Desplegado;
- `skipped` con el job cancelado: Cancelado o interrumpido;
- `skipped` con el job en fallo: Fallido, "no empezó";
- `OMITIDO=true` con `MAIN_SHA` vacío: entrada no válida;
- código `0` con `failure`: Fallido, desconocido.

**S-3. Resumen mínimo en línea del paso `resumen` de `deploy`** (sin `resumen.sh`, por fallo del checkout): se ejecuta el bloque `else` en local y se comprueba que el Markdown tiene el encabezado, el enlace y el SHA completo.

**S-4. Compatibilidad de bash.** R-1 y S-1 se ejecutan con el bash 3.2 de macOS. Se ejecutan además con bash 5 en Docker, usando la imagen `bash:5.2` (requiere descargarla) como el runner `ubuntu-24.04`. Si la descarga no es posible, se anota y basta con bash 3.2 más el job `despliegue` del CI del PR.

### Pruebas de integración

- **I-1. Shellcheck.** Con `docker run --rm -e LC_ALL=C.UTF-8 -v "$PWD:/mnt" -w /mnt/restaurante/deploy koalaman/shellcheck:stable` sobre los cinco archivos del paso `shellcheck` del job `despliegue`: 0.
  - Se revisa que `SC2016` esté desactivado solo con justificación.
- **I-2. Paso `prueba del resumen`.** Corre desde la raíz del repositorio con `bash restaurante/deploy/ci/resumen-test.sh`. La ruta se resuelve con `BASH_SOURCE`, así que se ejecuta también desde otro directorio.
- **I-3. Rutas de `resumen.sh` en el workflow.** El `checkout` disperso de `vigente` (`restaurante/deploy/ci`) y el de `deploy` (`restaurante/deploy`) deben incluir `ci/resumen.sh`.

### Pruebas de regresión

- **X-1. Suma de `deploy/`.**
  - `git diff --quiet HEAD -- restaurante/deploy/deploy.sh restaurante/deploy/compose.prod.yaml restaurante/deploy/mysql/initdb/01-usuarios.sh` debe terminar con 0.
  - `DEPLOY_FILES` no cambia.
  - La suma calculada con el comando del paso `desplegar` es igual en `HEAD` y en el árbol de trabajo. En `HEAD` se calcula con `git show HEAD:<archivo>`, sin `git stash`.
- **X-2. Jobs que no se tocan.** `git diff HEAD -- .github/workflows/ci.yml` limitado a `cambios`, `validado`, `calidad`, `docker`, `auditoria` y `publish`:
  - sin cambios fuera del job `despliegue` (dos líneas) y de `vigente` y `deploy`;
  - `on:`, `concurrency` y la guarda de `workflow_dispatch` sin cambios.
- **X-3. Suite y estáticos.** Desde `restaurante/`, en el worktree:
  - `npm run typecheck`, `npm run lint` y `npm test` completos, con 0;
  - `npm test` incluye la prueba que lee el README (`tests/unit/whatsapp-bot-free-text.test.ts`).
- **X-4. Alcance.** `git status` del worktree: solo los archivos del ticket. Sin cambios en `restaurante/src`, `public/` ni `tests/`.

### Pruebas de documentación

- **D-1. README (sección CI).**
  - "Qué se desplegó": dónde ver el commit (título y resúmenes de `vigente` y `deploy`), los cinco estados y Deployments.
  - "Redespliegue manual" y la fila `despliegue` de "Qué comprueba" coherentes con el workflow.
- **D-2. `docs/despliegue.md`.**
  - "Cómo llega una versión a producción" con `vigente`.
  - "Qué commit está desplegado".
  - Tabla 1.2 con `release.env` = digests y commit (`RESTAURANTE_COMMIT`), que corrige C2.
  - Sección 8 con **Desplegado**.
  - Sección 10 con las filas nuevas.
  - Anclas `#10-diagnóstico` y `#9-restaurar-la-base-desde-un-volcado` coherentes con los encabezados `## 10. Diagnóstico` y `## 9. Restaurar la base desde un volcado` (slug de GitHub).
  - Nada documentado que no exista en el workflow.

### Verificación en GitHub (G), fuera del alcance local

No se pueden ejecutar antes del merge sin publicar la rama. Las ejecuta el usuario o senior-fullstack al abrir el PR y tras el merge. QA las deja como pendientes de revisión manual:

- **G-1. CA-6, en el PR.**
  - El título de la ejecución es `<título del PR> · <SHA de la punta de la rama>`.
  - `calidad`, `docker`, `despliegue` (con `prueba del resumen`) y `auditoria` en verde.
  - `vigente` y `deploy` no corren.
- **G-2. CA-1, tras el merge.**
  - El título es el mensaje del commit con el SHA corto debajo (confirma el riesgo 1).
  - `vigente` en verde sin resumen.
  - `deploy` en verde con **Desplegado**, el enlace, el SHA completo y los dos digests.
  - Deployments con un registro exitoso de ese commit.
- **G-3. CA-5.** `gh workflow run ci.yml --ref main`: el título es `Ejecución manual · <SHA>` y, si despliega, se cumple G-2.
- **G-4. CA-2 real, opcional.** Procedimiento del punto 6 del Testing del Technical Action Plan.
- **G-5. CA-7.**
  - En el siguiente push de solo documentación, el título lleva el SHA corto.
  - `vigente` y `deploy` quedan omitidos y no hay registro nuevo en Deployments.
  - `cambios` indica la omisión.

### Evidencia requerida

- Salida de `actionlint`, `shellcheck`, `resumen-test.sh`, `typecheck`, `lint` y `npm test` (resumen de resultados).
- Salida de los scripts de simulación W-5, W-6, R-2, R-3, S-1, S-2 y S-3: tabla de entrada → encabezado y código de salida.
- Fragmentos de `git diff` de los bloques `permissions`, `environment` y `secrets.` y de los jobs no tocados.
- La suma de `deploy/` antes y después.

Los scripts temporales viven en el scratchpad de la sesión. No se agregan pruebas nuevas a `restaurante/tests/`: el plan no lo requiere, porque `resumen-test.sh` ya cubre los casos y forma parte del CI.

### Criterios de aprobación

- W-1 a W-8, R-1 a R-3, S-1 a S-4 (S-4 al menos con bash 3.2), I-1 a I-3, X-1 a X-4 y D-1 y D-2 pasan con evidencia.
- Ningún camino de entrada produce "Desplegado" sin `success` y digests válidos.
- Ninguna entrada maliciosa aparece en el Markdown ni ejecuta comandos.
- Sin defectos `BLOCKER` ni `CRITICAL`. Los `MAJOR`, si los hay, se resuelven con una decisión del usuario.
- CA-8 y CA-9 se cumplen por completo antes del merge.
- **Al aprobar este plan, el usuario acepta** que CA-1, CA-5, CA-6 y CA-7 se aprueben antes del merge con evidencia estática y simulada, y que su parte en GitHub (G-1 a G-5) quede como pendiente de revisión manual en el PR y tras el merge. Las reglas de QA lo exigen, porque esas comprobaciones dependen de un entorno al que QA no tiene acceso. Sin esta aceptación, el resultado sería `NEEDS_USER_DECISION`.

### Aprobación del QA Action Plan

"si" (2026-10-15). Incluye:

- aceptar que CA-1, CA-5, CA-6 y CA-7 se aprueben antes del merge con pruebas locales y revisión del workflow;
- G-1 a G-5 como revisión manual en GitHub;
- autorización para descargar la imagen `bash:5.2`.

## QA Report

### Ronda

1 (2026-10-15). Worktree `/Users/orvigas/Desktop/Negocio-REQ-F-030`, rama `feature/REQ-F-030-identificar-despliegue-en-actions`, sin commit. Base `HEAD` = `origin/main` = `7da4c4a`.

### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| W-8 | `docker run … rhysd/actionlint:1.7.12 -color` | 0, sin hallazgos |
| I-1 | `koalaman/shellcheck:stable` (`LC_ALL=C.UTF-8`) sobre `deploy.sh`, `01-usuarios.sh`, `ci/smoke.sh`, `ci/resumen.sh`, `ci/resumen-test.sh` | 0 |
| R-1, I-2 | `bash restaurante/deploy/ci/resumen-test.sh`, desde la raíz y desde `/` | 0; 55 `ok`, 0 `FALLO` |
| R-2 | 3 mutaciones de `resumen.sh` en copias del scratchpad | `resumen-test.sh` con 1 en las tres |
| R-3 | Matriz de 37 combinaciones de modo, `OMITIDO`, `SSH_OUTCOME`, `SSH_CODE`, `JOB_STATUS` y digests | Todo conforme a la tabla del plan |
| W-5 | Cuerpo del paso `desplegar` extraído del YAML y ejecutado con `bash --noprofile --norc -eo pipefail`, con un `ssh` falso | Ver W-5 abajo |
| W-6 | Cuerpos de `commit vigente de main` de `vigente` y `deploy` con un `gh` falso | Ver W-6 abajo |
| S-1 | 55 entradas maliciosas | Sin inyección (ver Seguridad) |
| S-2 | Combinaciones límite (dentro de la matriz R-3) | Conformes |
| S-3 | Paso `resumen` de `deploy` sin `resumen.sh` (fallo del checkout) y pasos `resumen` de `deploy` (21) y de `vigente` | Markdown correcto, salida 0 |
| S-4 | `bash:5.2` (5.2.37) en Docker: `resumen-test.sh`, matriz e inyección | Iguales que con bash 3.2.57 |
| W-7, X-2 | Comparación con PyYAML de los workflows en `HEAD` y en el árbol de trabajo | Ver Regresión |
| X-1 | `git diff --quiet HEAD --` de los tres archivos de `DEPLOY_FILES`, más la suma de `deploy/` | Ver Regresión |
| X-3 | `npm run typecheck`, `npm run lint`, `npm run build:css` y `npm test` con el candado de MySQL | 0 / 0 / 0 / 0 |
| D-1, D-2 | Revisión del diff de `README.md` y `docs/despliegue.md` contra el workflow y `deploy.sh` | Conformes |

**W-5. Captura del código de salida.** Para el `ssh` falso con 0, 21, 22, 20, 13, 4 y 255, el paso escribe `codigo=<rc>` en `GITHUB_OUTPUT` y sale con el mismo `<rc>` en los siete casos.

**W-6. Comprobación de la punta de `main`.**

- `vigente`:
  - mismo SHA: `main=…` y `deploy=true`, salida 0;
  - otro SHA: `deploy=false`, salida 0;
  - respuesta vacía, texto, SHA en mayúsculas o dos líneas: `::error::` y salida 1, sin outputs;
  - error de `gh`: salida 1.
- `deploy`:
  - mismo SHA: salida 0, sin outputs;
  - otro SHA: `main=…`, `omitido=true` y salida 1;
  - entradas no válidas: salida 1.

Nota de la primera ejecución de `npm test`: falló 4 pruebas porque el worktree no tenía el CSS generado (`public/css/*/main.css`, ENOENT y 404). Fue un fallo de preparación de QA: el plan exige `build:css` antes de las pruebas. Después de `npm run build:css` (genera archivos ignorados por git, `git status` sin cambios), la suite completa pasó: 89 archivos, 1778 pruebas y 1 fallo esperado.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS (local); GitHub pendiente (G-2) | `run-name` da `''` en push. Con `success` y digests válidos, el resumen es **Desplegado** con enlace, SHA completo y los dos digests (R-3, R-1). Un `ssh` con 0 deja el paso en 0, así que el job termina en éxito (W-5) |
| CA-2 | PASS (local) | Ver detalle abajo |
| CA-3 | PASS | Con 21, el resumen es **Revertido**: "producción sigue con la versión anterior" y "Commit anterior no disponible" (R-3, S-3). El paso sale con 21, así que el job y su registro quedan fallidos (W-5) |
| CA-4 | PASS | Con 1, 2, 3, 4, 5, 10, 11, 12, 13, 20, 22 y 255, el resumen es **Fallido** con el código y el texto de la tabla del plan. Sin código, es Cancelado o interrumpido. El paso sale con el mismo código (W-5) |
| CA-5 | PASS (estático); GitHub pendiente (G-3) | `run-name` da `format('Ejecución manual · {0}', github.sha)` con `workflow_dispatch`. El despliegue usa el mismo camino que CA-1 |
| CA-6 | PASS (estático); GitHub pendiente (G-1) | `run-name` da `format('{0} · {1}', pull_request.title, pull_request.head.sha)`: la punta de la rama, no `github.sha`. `vigente` y `deploy` dependen de `publish`, que no corre en un PR |
| CA-7 | PASS (estático); GitHub pendiente (G-5) | Ver detalle abajo |
| CA-8 | PASS | Ver detalle abajo |
| CA-9 | PASS | Ver detalle abajo |

**CA-2.**

- `vigente`, con otro SHA en `main`: `deploy=false` y salida 0 (W-6).
- Su resumen es **Omitido** con el `main` vigente enlazado y "lo desplegará su propia ejecución" (S-3).
- `deploy` exige `needs.vigente.outputs.deploy == 'true'`, así que queda omitido: no hay registro en Deployments ni acceso a secretos.
- La segunda comprobación sale con 1 y el resumen es **Omitido**, con "El job termina en fallo para que Deployments no lo registre como desplegado" (W-6, R-3).
- G-4 (real) es opcional.

**CA-7.**

- El job `cambios` no cambia (X-2).
- `vigente` exige `needs.publish.result == 'success'` y `deploy` depende de `vigente`, así que en un push de solo documentación ninguno de los dos corre.
- `run-name` vacío en push.

**CA-8.**

- `permissions` de nivel superior y de todos los jobs existentes iguales a `HEAD`; `vigente` es nuevo con `contents: read`.
- `secrets.` solo aparece en el paso `desplegar` de `deploy` y en `login ghcr` de `publish`, este último sin cambios.
- `github.token` aparece en `validado` (sin cambios) y en los dos pasos `commit vigente de main`.
- `vigente` no tiene `environment`.
- No hay acciones nuevas: el conjunto de `uses` es el mismo.

**CA-9.**

- README "Qué se desplegó":
  - título por evento;
  - tabla de los cinco estados, con dónde aparece cada uno y el resultado del job;
  - Deployments.
- `docs/despliegue.md`:
  - "Qué commit está desplegado";
  - tabla 1.2: `release.env (digests y commit desplegados: RESTAURANTE_COMMIT)`, coherente con la línea 205 de `deploy.sh`;
  - sección 8 con **Desplegado**;
  - sección 10 con tres filas nuevas.
- Las anclas `#10-diagnóstico`, `#9-restaurar-la-base-desde-un-volcado` y `#qué-se-desplegó` corresponden a sus encabezados.

### Defectos encontrados

Ninguno.

Observaciones, que no son defectos:

1. **`GITHUB_REPOSITORY=../..`.** El regex de `resumen.sh` acepta ese valor y el enlace queda como `https://github.com/../../commit/<SHA>`. Sin impacto: el valor lo pone GitHub y nunca tiene esa forma. Además, no permite inyectar Markdown, porque los paréntesis, los corchetes, los espacios y los saltos de línea se rechazan.
2. **Desplegar en verde con el job cancelado.** Con `SSH_OUTCOME=success` y `JOB_STATUS=cancelled`, el resumen dice **Desplegado**. Es correcto: el commit sí quedó sirviendo. Solo podría pasar si la cancelación llegara entre el final del SSH y el paso `resumen`, y en ese caso el job quedaría cancelado aunque el resumen diga Desplegado.
3. **Inyección con comillas invertidas.** Dos casos de S-1 salieron FAIL en el primer guion de QA por un falso positivo del propio guion: buscaba la comilla invertida, y el texto fijo de "entrada no válida" la contiene. Se volvieron a comprobar a mano: el archivo testigo no se creó y `touch` no aparece en la salida.

### Regresión

- **Jobs sin cambios:** `cambios`, `validado`, `calidad`, `auditoria`, `docker` y `publish` son idénticos a `HEAD`, como objetos YAML. También `on:` y `concurrency` de nivel superior.
- **`despliegue`:** solo cambian la lista de shellcheck y el paso nuevo `prueba del resumen`.
- **`deploy`:** `environment` (`production`, url), `concurrency` (`deploy-production`, sin cancelar en curso), `permissions` y `timeout-minutes: 20` iguales.
- **Suma de `deploy/` sin cambios:**
  - `git diff --quiet HEAD --` de `deploy.sh`, `compose.prod.yaml` y `mysql/initdb/01-usuarios.sh` termina con 0;
  - `DEPLOY_FILES` es idéntico (línea 24);
  - la suma calculada como en el paso `desplegar` da `dd2dc90d7d71b07ce53d8ecd5ddecfa6a6b678b7de56b65b56170980d9c72b30` tanto en `HEAD` como en el árbol de trabajo.
  - No hay que reinstalar `deploy/` en el VPS.
- **Suite:** `npm test` completo: 89/89 archivos y 1778 pruebas, más 1 fallo esperado. `typecheck` y `lint` terminan con 0.
- **Alcance:** `git status` muestra solo los seis archivos del ticket. Sin cambios en `src/`, `public/` ni `tests/`.

### Seguridad

- **S-1 con bash 3.2 y 5.2, sobre 55 entradas maliciosas:**
  - SHA y commit de `main` con `$(…)`, comillas invertidas, saltos de línea con `### Desplegado`, longitud 39 y 41, mayúsculas y `](javascript:…)`;
  - código con `;`, saltos de línea, 1000, -1, espacios y hexadecimal;
  - digests vacíos, con 63 o 65 caracteres, con saltos de línea, `sha512` o mayúsculas;
  - servidor con `http`, `javascript:`, `)[x](`, barra final, vacío o saltos de línea;
  - repositorio con tres segmentos, `)[x](`, espacios o saltos de línea;
  - estados en mayúsculas o con saltos de línea, y modo vacío o desconocido.
- **Resultado en todos los casos:**
  - salida 0;
  - un solo encabezado, "Fallido (entrada no válida)";
  - el valor no se reproduce;
  - el archivo testigo nunca se crea.
- **Secretos:** con `VPS_SSH_PRIVATE_KEY` y `VPS_HOST` puestos a `SECRETO-QA` en el entorno, el texto no aparece en ninguna salida, ni en los estados válidos ni en los inválidos.
- **Título del PR:** `run-name` no ejecuta shell, así que el título del PR no permite inyección de comandos.

### Responsive / Accesibilidad / UX/UI / Performance / SEO

No aplican: sin UI ni cambios en la app. Performance del CI: un job `vigente` más, de segundos, solo cuando `publish` corre.

### Pendientes de revisión manual

Aceptados por el usuario al aprobar el plan:

- **G-1 (CA-6), en el PR:**
  - el título es `<título del PR> · <SHA de la punta>`;
  - `calidad`, `docker`, `despliegue` (con `prueba del resumen`) y `auditoria` en verde.
- **G-2 (CA-1), tras el merge:**
  - el título del push es el mensaje del commit con el SHA corto debajo, lo que confirma que el `run-name` vacío funciona;
  - `deploy` en verde con **Desplegado**;
  - registro exitoso en Deployments.
- **G-3 (CA-5):** `gh workflow run ci.yml --ref main` da el título `Ejecución manual · <SHA>`.
- **G-4 (CA-2), opcional:** el procedimiento del punto 6 del Testing del Technical Action Plan.
- **G-5 (CA-7):** en el siguiente push de solo documentación, el título lleva el SHA corto y no corren ni `vigente` ni `deploy`.

### Resultado final

QA_APPROVED

## Pull Request

- PR: https://github.com/orvigas/negocio/pull/64 (`feature/REQ-F-030-identificar-despliegue-en-actions` → `main`).
- Commit: `ffa8f7e3ed96dfb719ea402e7e80e8063db68683` (`ci: identifica en GitHub Actions el commit y el resultado de cada despliegue`), con la rama al día con `origin/main` (`7da4c4a`).
- CI del PR (ejecución 38778621127, https://github.com/orvigas/negocio/actions/runs/38778621127), en `success`:
  - en verde: `cambios`, `calidad` (8m46s), `docker` (2m28s), `despliegue` (4m27s) y `auditoria` (9s);
  - en el job `despliegue`, los pasos `shellcheck` y `prueba del resumen` en verde;
  - omitidos, como corresponde a un PR: `publish`, `vigente`, `deploy` y `validado`;
  - GitGuardian en verde.
- **G-1 (CA-6) superado.** `gh run list --branch feature/REQ-F-030-identificar-despliegue-en-actions --json displayTitle,headSha` devuelve:
  - `displayTitle`: `ci: identifica en GitHub Actions el commit y el resultado de cada despliegue · ffa8f7e3ed96dfb719ea402e7e80e8063db68683`;
  - `headSha`: `ffa8f7e3ed96dfb719ea402e7e80e8063db68683`.

  Coincide con `<título del PR> · <SHA de la punta>`. El SHA aparece completo, como estaba previsto en la alternativa A, porque las expresiones de `run-name` no pueden recortar texto.
- Pendientes tras el merge: G-2 a G-5 (ver `## QA Report`).

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-15).

### Revisión técnica (senior-fullstack, 2026-10-15)

Estado `NEEDS_TECHNICAL_CLARIFICATION`.

- Bloqueante P-1: `run-name` no puede recortar el SHA a 7 caracteres.
- Confirmaciones P-2 y P-3.
- Technical Action Plan en borrador, con las alternativas recomendadas.

### Plan técnico cerrado (senior-fullstack, 2026-10-15)

Estado `NEEDS_TECHNICAL_PLAN_APPROVAL`.

- Decisiones registradas: P-1 opción A, P-2 sí y P-3 sin objeción.
- Technical Action Plan definitivo.
- `actionlint` se ejecutará con Docker (`rhysd/actionlint:1.7.12`).

### Implementación (senior-fullstack, 2026-10-15)

Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

- Aprobación del Technical Action Plan: "Si los apruebo" (2026-10-15).
- Ticket movido a `in-progress/`; rama `feature/REQ-F-030-identificar-despliegue-en-actions` en un worktree propio.
- Implementado el plan: `run-name`, job `vigente`, `deploy` con resumen siempre, `resumen.sh` y `resumen-test.sh`, job `despliegue` y documentación. Validado con actionlint, shellcheck, `resumen-test.sh`, typecheck, lint y la prueba que lee el README.

### QA Action Plan (senior-qa, 2026-10-15)

Estado `NEEDS_QA_PLAN_APPROVAL`.

- Aprobación de la implementación: "Si la apruebo" (2026-10-15).
- QA Action Plan registrado:
  - revisión estática del workflow;
  - simulación local del shell de los pasos;
  - pruebas de `resumen.sh` con entradas maliciosas;
  - comprobación de permisos, secretos y suma de `deploy/`;
  - documentación y suite completa.
- CA-1, CA-5, CA-6 y CA-7 en GitHub quedan como verificación posterior en el PR y tras el merge.

### QA ronda 1 (senior-qa, 2026-10-15)

Estado `QA_APPROVED`.

- Aprobación del QA Action Plan: "si" (2026-10-15). Incluye:
  - aceptar que CA-1, CA-5, CA-6 y CA-7 se aprueben con pruebas locales y revisión del workflow;
  - G-1 a G-5 como revisión manual en GitHub;
  - autorización para descargar `bash:5.2`.
- Ejecutado el plan completo, sin defectos. Ver `## QA Report`.

### T4 (senior-fullstack, 2026-10-15)

Estado `READY_FOR_MERGE`.

- Commit `ffa8f7e`.
- PR #64 hacia `main`, con el CI en verde.
- G-1 superado. Ver `## Pull Request`.
