# REQ-F-006 — CI: typecheck, lint, pruebas y build de Docker en cada PR

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Cita: "apruebo todo".

La aprobación incluye las propuestas P-1 a P-5, que pasan a ser decisiones confirmadas (D-1 a D-5).

Origen: trabajo aparte listado como fuera de alcance en REQ-F-004 (D-5). REQ-F-003 (D-8) también dejó el CI fuera de alcance.

## Objetivo

Que cada PR hacia `main` y cada push a `main` ejecuten automáticamente `typecheck`, `lint`, las pruebas y la construcción de la imagen `production`, y que el resultado se vea en el PR.

## Decisiones confirmadas por el usuario

- D-1 (P-1). La plataforma es GitHub Actions. El repositorio está en GitHub: los PR #6 y #7 son de `orvigas/...`.
- D-2 (P-2). Hay dos comprobaciones independientes:
  - **"calidad":** con Node 24, ejecuta `npm ci`, `npm run typecheck`, `npm run lint` y `npm test`, en ese orden.
  - **"docker":** construye el target `production` del Dockerfile, cuya etapa `build` ya ejecuta `typecheck`. Solo amd64 y sin publicar la imagen.
- D-3 (P-3). El CI se ejecuta en dos casos:
  - un PR hacia `main`, al abrirlo, actualizarlo o reabrirlo;
  - cada push a `main`.
- D-4 (P-4).
  - Un push nuevo al mismo PR cancela la ejecución anterior.
  - Cada ejecución tiene un tiempo máximo de 15 minutos.
- D-5 (P-5). Marcar las comprobaciones como obligatorias para el merge (protección de rama) lo hace el usuario a mano en GitHub. El README explica cómo hacerlo y el ticket no lo automatiza.

## Alcance

- Definición del workflow de CI.
- Sección "CI" en `restaurante/README.md`.
- En `.claude/agents/senior-fullstack.md`, una mención de que el PR debe tener el CI en verde antes de pasar a `READY_FOR_MERGE`.

## Fuera de alcance

- Despliegue (CD).
- Publicación de imágenes en un registry.
- Build de arm64 en CI.
- Dependabot.
- Informes de cobertura.
- Notificaciones.
- Configuración automática de la protección de rama (D-5).
- Cambios en la app.

## Requisitos

- R-1. Las comprobaciones de D-2 se ejecutan con los eventos de D-3 y aparecen por separado en el PR, cada una con su nombre.
- R-2. Si falla cualquier paso (instalación, `typecheck`, `lint`, pruebas o build de Docker), su comprobación queda en rojo y no se ejecutan los pasos siguientes de esa comprobación.
- R-3. La versión de Node es la que exige el proyecto (`engines`, Node 24) y la que usa el Dockerfile.
- R-4. **Sin secretos.**
  - El CI no necesita secretos ni `.env`. Las pruebas usan la configuración de prueba que ya existe.
  - El workflow tiene permisos mínimos: solo lectura del repositorio.
  - Los PR que llegan desde forks se ejecutan sin acceso a secretos.
- R-5. Las acciones de terceros se usan con una versión fija.
- R-6. Se cachean las dependencias de npm. Un cambio en `package-lock.json` invalida la caché.
- R-7. Se cancelan las ejecuciones anteriores y se aplica el tiempo máximo de D-4.
- R-8. El README documenta:
  - qué comprueba el CI;
  - cuándo se ejecuta;
  - cómo reproducirlo en local con los mismos comandos;
  - cómo marcar las comprobaciones como obligatorias (D-5).

## Historias de usuario

- HU-1. **Como** dueño del repositorio, **quiero** ver en cada PR si el código pasa los tipos, el lint y las pruebas, y si se construye la imagen, **para** no hacer merge de algo roto.

## Criterios de aceptación

- CA-1. En un PR sin errores hacia `main`, las comprobaciones "calidad" y "docker" quedan en verde.
- CA-2. En un PR de prueba (temporal) con un error de tipo:
  - "calidad" falla en `typecheck`;
  - "docker" falla en la etapa `build`.
- CA-3. Con un error de lint (temporal), "calidad" falla en `lint`.
- CA-4. Con una prueba que falla (temporal), "calidad" falla en `test`.
- CA-5. Con un Dockerfile roto (temporal), "docker" falla y "calidad" no se ve afectada.
- CA-6. Un push a `main` ejecuta las dos comprobaciones.
- CA-7. Si se hacen dos pushes seguidos al mismo PR, la ejecución del primero queda cancelada.
- CA-8. Revisando el workflow se comprueba que no usa secretos, que sus permisos son de solo lectura y que todas sus acciones tienen una versión fija.
- CA-9. El README cumple R-8.

Los PR y las ramas de prueba de CA-2 a CA-5 y de CA-7 son temporales y no se mergean.

## Casos límite

- PR desde un fork.
- Pruebas que dependen de la zona horaria o de la fecha. El runner usa UTC, así que deben pasar igual que en Docker (REQ-F-003).
- Fallos de red de npm o de Docker Hub: el CI falla y se puede volver a ejecutar a mano.

## Dependencias

- REQ-F-004 (`npm run typecheck` y `typecheck` en la etapa `build` del Dockerfile).
- REQ-F-005 (`npm run lint` real). Si no está terminado, el paso `lint` ejecutaría el script de relleno.
- REQ-F-003 (Dockerfile con el target `production`).

## Riesgos

- La imagen base `node:24-alpine` puede cambiar entre ejecuciones. Se acepta, igual que en REQ-F-003.
- En repositorios privados, los minutos de GitHub Actions son limitados. Se mitiga con la caché y la cancelación de ejecuciones anteriores.

## Action Plan

### Objetivo

Que cada PR muestre comprobaciones automáticas fiables de tipos, lint, pruebas e imagen de producción.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Crear el workflow de CI (R-1 a R-7).
2. Documentarlo en el README (R-8).
3. Añadir la mención en `senior-fullstack.md`.
4. Verificar CA-1 a CA-8 con PR y ramas temporales que no se mergean.

### Reglas de negocio

No aplica.

### UX/UI

No aplica.

### Integraciones

GitHub Actions.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-9.

### Dependencias

REQ-F-004 y REQ-F-005.

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

Implementar después de REQ-F-005.

### Resultado esperado

Ningún PR llega al merge sin que se haya comprobado de forma automática y visible.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Comprobaciones automáticas | R-1, R-2, R-3, D-1, D-2, D-3 | HU-1 | CA-1 a CA-6 |
| Seguridad y coste | R-4 a R-7, D-4 | HU-1 | CA-7, CA-8 |
| Documentación | R-8, D-5 | HU-1 | CA-9 |

No hay diseño ni UI asociados en `_stich_source_/`.

## Revisión técnica

Revisión de senior-fullstack (fase T1, 2026-10-04) sobre `main` en `948dc2c`. No se modificó código ni la configuración de GitHub: `gh` se usó solo para leer.

### Comprobaciones hechas

- **Clon limpio sin `.env`** (Node 24.21.0, npm 11.19.0):
  - `npm ci`, `npm run typecheck` (0) y `npm run lint` (0) pasan.
  - `TZ=UTC CI=true npm test` **sin** ejecutar antes `npm run build:css`: 4 pruebas fallan en 2 archivos (464/468). Ver TC-2.
  - Con `npm run build:css` antes: 468/468 pasan, con `TZ=UTC` y también con `TZ=Pacific/Kiritimati`.
  - Las pruebas no leen `.env`: usan `VALID_ENV`/`makeConfig` de `tests/helpers.ts`. GitHub Actions pone `CI=true`, así que Vitest no escribe los snapshots que falten. `tests/unit/content.test.ts` lee `../_stich_source_/`, que está versionado y llega con el checkout.
- **Docker:** `docker buildx build --platform linux/amd64 --target production restaurante/` construye sin el contexto adicional `design`. BuildKit no ejecuta la etapa `test`, que es la única que lo usa. Tardó unos 20 s con la caché local.
- **GitHub (`orvigas/negocio`):**
  - Repositorio privado y no es un fork.
  - Actions habilitado (`allowed_actions: all`, `sha_pinning_required: false`).
  - Permisos por defecto del `GITHUB_TOKEN`: `read`.
  - `branches/main/protection` y `rulesets` responden **403: "Upgrade to GitHub Pro or make this repository public to enable this feature"**. Ver TC-1.
- **Acciones (última versión publicada y su SHA):**

  | Acción | Versión | SHA | Runtime |
  | --- | --- | --- | --- |
  | `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | node24 |
  | `actions/setup-node` | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` | node24 |
  | `docker/setup-buildx-action` | v4.4.1 | `f87e5991a6d7451dcb8d9637bfbc97413f497069` | node24 |
  | `docker/build-push-action` | v7.4.0 | `c3c9e263c25d99ce0380d002d59b67737d91b0dc` | node24 |

- **Borrador del workflow:** se validó con `actionlint` 1.7.12 (imagen Docker `rhysd/actionlint`, incluye shellcheck), sin agregarlo como dependencia. Resultado: 0 errores. El borrador está más abajo.

### TC-1. La protección de rama no está disponible en este repositorio (D-5, R-8, CA-9)

- **Problema:** D-5 da por hecho que el usuario podrá marcar "calidad" y "docker" como obligatorias. En un repositorio privado con plan Free, GitHub no ofrece protección de rama ni rulesets: la API responde 403.
- **Requisito afectado:** D-5 y el último punto de R-8 ("cómo marcar las comprobaciones como obligatorias").
- **Impacto:** el CI se ejecuta y se ve en cada PR (R-1 y CA-1 a CA-8 no cambian), pero GitHub no puede bloquear el merge si está en rojo. El README no puede dar un procedimiento que hoy no se puede aplicar.
- **Opciones:**
  - **A (recomendada).** El README explica:
    - que hoy GitHub no bloquea el merge, por el plan del repositorio;
    - los pasos para marcar las comprobaciones como obligatorias, que se aplicarán si el repositorio pasa a GitHub Pro o se hace público;
    - que, mientras tanto, la regla es de proceso: nadie hace merge con el CI en rojo. Esto ya lo cubre la mención en `senior-fullstack.md` (ver el plan T4 más abajo).
  - **B.** El usuario contrata GitHub Pro y el README documenta los pasos como se pidió en D-5.
  - **C.** Hacer público el repositorio. No es recomendable: contiene el diseño fuente y la configuración del negocio.
- **Decisión requerida:** A, B o C.

### TC-2. Falta `npm run build:css` antes de `npm test` en la comprobación "calidad" (D-2)

- **Problema:** D-2 fija los pasos "`npm ci`, `typecheck`, `lint`, `test`, en ese orden". Pero hay pruebas que leen el CSS que genera Tailwind, y ese CSS no se versiona:
  - `tests/unit/landing-dom.test.ts:112` lee `public/css/<negocio>/main.css`;
  - `tests/integration/app.test.ts:268-269` sirve `/css/<negocio>/main.css`.

  Sin compilar el CSS antes, fallan 4 pruebas. Se comprobó en el clon limpio.
- **Requisito afectado:** D-2 (y, por consecuencia, CA-1).
- **Impacto:** con los pasos al pie de la letra, "calidad" quedaría siempre en rojo.
- **Propuesta (recomendada):** usar este orden: `npm ci` → `typecheck` → `lint` → `build:css` → `test`. Es el mismo orden del Dockerfile (`typecheck` y luego `build:css`). El README documentará este orden para reproducir el CI en local.
- **Decisión requerida:** confirmar que se agrega el paso `build:css`.

### TC-3. Para verificar CA-1 a CA-7 hay que hacer commits y pushes antes de T4, y CA-6 solo se puede comprobar después del merge

- **Problema:**
  - El flujo solo permite commits en T4. Pero los PR de prueba de CA-2 a CA-5 y de CA-7 necesitan, ya en la implementación, ramas con commits, pushes a GitHub y PR hacia `main`: el evento `pull_request` solo se dispara con la base `main`.
  - CA-6 ("un push a `main` ejecuta las dos comprobaciones") solo ocurre cuando el usuario hace merge del PR del ticket. El agente nunca hace push a `main`.
- **Requisito afectado:** CA-1 a CA-7 y las reglas de commit de `.claude/rules/git.md` y del agente.
- **Propuesta (recomendada):**
  - **En T2,** autorizar de forma explícita commits y pushes **solo** en ramas temporales `ci-tmp/REQ-F-006-<caso>`, creadas desde `main`. Cada una contiene el workflow y, si toca, el defecto inducido. Los casos son:
    - `ok` (CA-1);
    - `tipo` (CA-2);
    - `lint` (CA-3);
    - `test` (CA-4);
    - `dockerfile` (CA-5);
    - `cancelacion` (CA-7: dos pushes seguidos).
  - Cada rama tiene un PR **en borrador** hacia `main`. Las URL de las ejecuciones se anotan en el ticket. Después, los PR se cierran **sin merge** y las ramas se borran, en local y en remoto.
  - La rama `feature/REQ-F-006-ci-github-actions` no tiene commits hasta T4.
  - **CA-1** se confirma de nuevo en el PR real de T4.
  - **CA-6** se verifica en T5, después del merge del usuario: `gh run list --branch main --event push`. Antes del merge solo se puede revisar estáticamente (`on.push.branches: [main]`).
  - **Coste:** unos 6 PR × 2 jobs × 2-3 min, entre 30 y 40 minutos de Actions de los 2000 mensuales del plan Free.
- **Alternativa:** que T2 solo valide en local (`actionlint` y los comandos del CI) y que QA haga los PR temporales. QA tiene la misma restricción de commits, así que la autorización haría falta igual.
- **Decisión requerida:** autorizar (o no) los commits, pushes y PR en borrador temporales en `ci-tmp/REQ-F-006-*` durante T2/T3, y aceptar que CA-6 se verifique en T5.

### Sin problemas (decisiones técnicas propuestas, para el Technical Action Plan)

- **Node (R-3):** `node-version-file: restaurante/.nvmrc`, que contiene `24`. Así coincide con `node:24-alpine` del Dockerfile (las dos flotan dentro de la versión 24) y cumple `engines >=24.3.0`: la última 24.x es la 24.21. La versión queda en un solo sitio.
- **Fijación de acciones (R-5):** SHA completo del commit, con la versión en un comentario (`@<sha> # v7.0.1`). Una etiqueta se puede mover y un SHA no. El comentario mantiene la versión legible.
- **Caché de npm (R-6):** `setup-node` con `cache: npm` y `cache-dependency-path: restaurante/package-lock.json`. Cachea `~/.npm` con una clave que incluye el hash del lockfile, así que un cambio en el lockfile la invalida. `npm ci` sigue instalando desde cero.
- **Caché de Docker:** `cache-from/cache-to: type=gha` con `mode=max` y su propio `scope`. Sin cambios en `package*.json`, se reutiliza la capa `npm ci`. Comparte el límite de 10 GB de caché de Actions con la caché de npm: es aceptable.
- **Permisos (R-4):**
  - `permissions: contents: read` a nivel de workflow;
  - `persist-credentials: false` en `checkout`;
  - ningún `secrets.*`;
  - evento `pull_request`, no `pull_request_target`, así que los PR desde forks se ejecutan sin secretos y con un token de solo lectura. En repositorios privados, GitHub además desactiva por defecto los workflows de PR desde forks. El README lo menciona.
- **Concurrencia (R-7, D-4):**
  - En un PR, el grupo es `ci-pr-<número>`, con `cancel-in-progress: true`.
  - En un push a `main`, el grupo es `ci-<sha>`: no se cancela ni se descarta ninguna ejecución de `main`. Con un grupo compartido, GitHub reemplazaría las ejecuciones pendientes, y CA-6 pide que cada push se ejecute.
- **Tiempo máximo:** `timeout-minutes: 15` en cada job. Los dos jobs van en paralelo y son independientes (sin `needs`), así que un fallo de "docker" no afecta a "calidad" (CA-5).
- **Fallo rápido (R-2):** cada comando es un paso propio. Si un paso falla, los siguientes de ese job no se ejecutan, porque es el comportamiento por defecto de Actions. Cada paso tiene nombre (`install`, `typecheck`, `lint`, `build:css`, `test`), así que en el PR se ve cuál falló.
- **Job "docker":** `context: restaurante`, `target: production`, `platforms: linux/amd64`, `push: false`, `provenance: false`. Sin `outputs`, la imagen queda solo en la caché del builder: no se publica ni se carga.
- **Zona horaria:** el runner `ubuntu-24.04` usa UTC. Las pruebas pasan con UTC y con otras zonas porque controlan la zona con `BUSINESS_TIMEZONE` y la fecha con los fake timers.
- **Runner:** `ubuntu-24.04` fijo, no `ubuntu-latest`, para que un cambio de imagen del runner no cambie el CI sin aviso.
- **npm 11.19:** avisa de que no ejecuta el script de instalación de `@parcel/watcher` (dependencia de `@tailwindcss/cli`). No afecta a `build:css`: el clon limpio compiló correctamente. No hace falta ninguna acción.
- **`senior-fullstack.md` (alcance):** en T4, después de `gh pr create`, ejecutar `gh pr checks <n> --watch --fail-fast`, que solo lee. Si alguna comprobación queda en rojo, no se devuelve `READY_FOR_MERGE` y se informa con el enlace a la ejecución.
- **README:** nueva sección `## CI`. Además, la nota de la tabla de scripts que dice que `lint` "no forma parte de `npm test` ni del Dockerfile" se completa indicando que sí forma parte del CI.

### Borrador del workflow (`.github/workflows/ci.yml`, en la raíz del repositorio; validado con actionlint)

```yaml
# CI (REQ-F-006): tipos, lint, pruebas y build de la imagen production.
name: CI

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
  push:
    branches: [main]

# Solo lectura del repositorio; ningún otro permiso ni secreto.
permissions:
  contents: read

# En un PR, un push nuevo cancela la ejecución anterior; cada push a main se ejecuta siempre.
concurrency:
  group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.sha }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  calidad:
    name: calidad
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    defaults:
      run:
        working-directory: restaurante
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: restaurante/.nvmrc
          cache: npm
          cache-dependency-path: restaurante/package-lock.json
      - name: install
        run: npm ci --no-audit --no-fund
      - name: typecheck
        run: npm run typecheck
      - name: lint
        run: npm run lint
      - name: build:css
        run: npm run build:css
      - name: test
        run: npm test

  docker:
    name: docker
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      - name: build production
        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: restaurante
          target: production
          platforms: linux/amd64
          push: false
          provenance: false
          cache-from: type=gha,scope=production
          cache-to: type=gha,scope=production,mode=max
```

### Respuestas del usuario (2026-10-04)

Cita textual: "TC-1 A, TC-2 sí, TC-3 autorizo las ramas temporales".

- **TC-1 → A.** No se configura protección de rama: el repositorio es privado y está en el plan Free. El README documenta:
  - la limitación;
  - los pasos para activar la protección si el repositorio pasa a GitHub Pro o se hace público.

  La regla "no se entrega `READY_FOR_MERGE` con el CI en rojo" se cumple por proceso, en `senior-fullstack.md`.
- **TC-2 → sí.** El orden de "calidad" es `npm ci` → `typecheck` → `lint` → `build:css` → `test`.
- **TC-3 → autorizado.** Se permiten commits y pushes en T2/T3, **solo** en las ramas temporales `ci-tmp/REQ-F-006-<caso>`, creadas desde `main`. Los casos son `ok`, `tipo`, `lint`, `test`, `dockerfile` y `cancelacion`.
  - Cada rama tiene un PR en borrador hacia `main`.
  - Las URL de las ejecuciones se anotan en el ticket.
  - Al terminar, los PR se cierran sin merge y las ramas se borran.
  - La rama del ticket no tiene commits hasta T4.
  - CA-6 se verifica en T5, después del merge del usuario.

## Technical Action Plan

### Objetivo técnico

Agregar un workflow de GitHub Actions con dos jobs independientes:

- **`calidad`:** `npm ci`, `typecheck`, `lint`, `build:css` y `test`, con Node 24.
- **`docker`:** build del target `production`, solo amd64 y sin publicar la imagen.

El workflow se ejecuta en los PR hacia `main` y en cada push a `main`, con permisos de solo lectura, acciones fijadas por SHA, caché de npm y de buildx, cancelación de las ejecuciones anteriores de un mismo PR y un tiempo máximo de 15 minutos por job. Además, se documenta en el README y se exige el CI en verde en la fase T4 del agente.

### Archivos o componentes afectados

| Archivo | Cambio |
| --- | --- |
| `.github/workflows/ci.yml` (raíz del repositorio) | Nuevo: el workflow de CI. |
| `restaurante/README.md` | Nueva sección `## CI`. Además, en la tabla de scripts, la fila de `lint` indica que sí forma parte del CI. |
| `.claude/agents/senior-fullstack.md` | En T4: esperar a los checks del PR (`gh pr checks`) antes de devolver `READY_FOR_MERGE`. Mención en las reglas críticas. |
| Este ticket | Estado, `Implementation Result` y evidencias (URL de las ejecuciones). |

No cambian: el código de la app (`src/`, `public/`, `tests/`), `package.json`, `package-lock.json`, el Dockerfile, `compose.yaml` ni las dependencias.

### Cambios requeridos

1. **Workflow.** Será el borrador de la sección "Revisión técnica", ya validado con actionlint y con el paso `build:css` incluido:
   - **Eventos:**
     - `pull_request` hacia `main`, con los tipos `opened`, `synchronize` y `reopened`;
     - `push` a `main`;
     - sin filtros de rutas: cualquier cambio dispara el CI.
   - **Permisos:** `permissions: contents: read` a nivel de workflow.
   - **Concurrencia:**
     - en un PR, el grupo es `ci-pr-<número>`, con `cancel-in-progress: true`;
     - en un push a `main`, el grupo es `ci-<sha>`, sin cancelación.
   - **Job `calidad`** (`ubuntu-24.04`, `timeout-minutes: 15`, `working-directory: restaurante`):
     - `checkout` (`persist-credentials: false`);
     - `setup-node` (`node-version-file: restaurante/.nvmrc`, `cache: npm`, `cache-dependency-path: restaurante/package-lock.json`);
     - los pasos `install`, `typecheck`, `lint`, `build:css` y `test`.
   - **Job `docker`** (`ubuntu-24.04`, `timeout-minutes: 15`):
     - `checkout`;
     - `setup-buildx-action`;
     - `build-push-action`, con `context: restaurante`, `target: production`, `platforms: linux/amd64`, `push: false`, `provenance: false` y caché `type=gha` (`scope=production`, `mode=max`).
   - **Acciones fijadas por SHA completo, con la versión en un comentario:**
     - `actions/checkout` v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`);
     - `actions/setup-node` v7.0.0 (`820762786026740c76f36085b0efc47a31fe5020`);
     - `docker/setup-buildx-action` v4.4.1 (`f87e5991a6d7451dcb8d9637bfbc97413f497069`);
     - `docker/build-push-action` v7.4.0 (`c3c9e263c25d99ce0380d002d59b67737d91b0dc`).

     Antes de escribir el archivo se comprobará de nuevo, con `gh api` en modo lectura, que cada SHA corresponde a su etiqueta.
2. **README, sección `## CI` (R-8):**
   - **Qué comprueba:** los jobs `calidad` y `docker`, con sus pasos y en orden.
   - **Cuándo se ejecuta:** en los PR hacia `main` (al abrirlos, actualizarlos o reabrirlos) y en cada push a `main`. También se explica la cancelación de las ejecuciones anteriores y el tiempo máximo de 15 minutos.
   - **Cómo se reproduce en local:**
     - calidad: `npm ci && npm run typecheck && npm run lint && npm run build:css && npm test`;
     - docker: `docker buildx build --platform linux/amd64 --target production .`, desde `restaurante/`.
   - **Seguridad:**
     - sin secretos ni `.env`;
     - solo lectura;
     - PR desde forks: el evento `pull_request` no da acceso a secretos, y en los repositorios privados GitHub desactiva por defecto esos workflows;
     - acciones fijadas por SHA y cómo actualizarlas;
     - runner en UTC.
   - **Checks obligatorios (D-5, TC-1 A):**
     - hoy no se pueden marcar, por el plan del repositorio;
     - pasos para cuando el repositorio sea Pro o público: Settings → Rules → Rulesets (o Branches → Branch protection rule) para `main` → "Require status checks to pass" → `calidad` y `docker`;
     - mientras tanto, la regla es de proceso: no se hace merge con el CI en rojo.
   - **Fallos de red de npm o Docker Hub:** se vuelve a ejecutar desde la pestaña Actions ("Re-run failed jobs").
3. **`senior-fullstack.md`:**
   - En T4, después de `gh pr create`, ejecutar `gh pr checks <n> --watch --fail-fast`, que solo lee. Solo se devuelve `READY_FOR_MERGE` si `calidad` y `docker` están en verde. Si no, se informa del fallo con el enlace a la ejecución y no se avanza.
   - Una línea en "Reglas críticas".

### Validaciones

- `actionlint` sobre `.github/workflows/ci.yml` (imagen Docker `rhysd/actionlint`; no se agrega como dependencia): 0 errores.
- Revisión estática para CA-8:
  - `grep -n 'secrets\.' .github/workflows/ci.yml` no devuelve nada;
  - `permissions` solo tiene `contents: read`;
  - cada `uses:` lleva un SHA de 40 caracteres.

### Manejo de errores

- Cada comando va en su propio paso. Un fallo detiene el resto del job (R-2) y en el PR se ve qué paso falló.
- Los jobs no dependen entre sí: un fallo en uno no afecta al otro (CA-5).
- Los fallos transitorios de red se resuelven volviendo a ejecutar a mano (documentado).

### Testing (verificación de CA-1 a CA-9)

No hay pruebas de Vitest nuevas porque no cambia la app. Igualmente se ejecutan `npm run typecheck`, `npm run lint` y `npm test` en local, para confirmar que no hay regresiones.

La verificación del CI se hace con ramas temporales autorizadas en TC-3. Todas se crean desde `main`. Cada una contiene `ci.yml` y el defecto inducido, y tiene un **PR en borrador** hacia `main`:

| Rama `ci-tmp/REQ-F-006-…` | Defecto inducido | Resultado esperado | CA |
| --- | --- | --- | --- |
| `ok` | ninguno | `calidad` y `docker` en verde | CA-1 |
| `tipo` | un error de tipo en un `.ts` de `src/` | `calidad` falla en `typecheck` (no se ejecutan `lint`, `build:css` ni `test`); `docker` falla en la etapa `build` (`npm run typecheck`) | CA-2, R-2 |
| `lint` | una violación de lint sin error de tipo (p. ej. una variable sin usar) | `calidad` falla en `lint` | CA-3 |
| `test` | una aserción que falla, en una prueba temporal | `calidad` falla en `test` | CA-4 |
| `dockerfile` | una instrucción inválida en el Dockerfile | `docker` falla y `calidad` queda en verde | CA-5 |
| `cancelacion` | dos pushes seguidos (el segundo, un commit vacío) | la ejecución del primer push queda `cancelled` | CA-7 |

- **Comprobaciones de cada caso:**
  - se espera con `gh run watch` o `gh pr checks`;
  - el estado de cada job y de cada paso se consulta con `gh run view <id> --json jobs`;
  - en el ticket se anotan la URL de la ejecución, el job, el paso que falló y la conclusión;
  - en la primera ejecución con caché ya guardada (la de `ok`, segundo intento o cualquier ejecución posterior), los logs muestran la caché de npm restaurada (R-6).
- **Limpieza:**
  - `gh pr close <n> --delete-branch`, sin merge, para cada PR temporal;
  - se borra la rama local;
  - se comprueba que no queda ninguna rama `ci-tmp/REQ-F-006-*` ni en local ni en el remoto.
- **CA-1, de nuevo:** en el PR real de T4, `gh pr checks --watch`.
- **CA-6:** en T5, después del merge del usuario, `gh run list --branch main --event push --workflow CI` muestra una ejecución con `calidad` y `docker`. Antes de eso, solo la revisión estática de `on.push.branches: [main]`.
- **CA-8:** la revisión estática descrita en "Validaciones".
- **CA-9:** revisión del README contra R-8.

### Seguridad

- `permissions: contents: read`, `persist-credentials: false` y ningún `secrets.*`. No se usa `pull_request_target`.
- Acciones de terceros fijadas por SHA completo (R-5).
- Las ramas temporales no contienen secretos y nunca se mergean.
- No se cambia ninguna configuración de GitHub (permisos, Actions, protección).

### Performance

- **Caché de npm:** `~/.npm`, con una clave que incluye el hash del lockfile.
- **Caché de buildx `gha`:** la capa `npm ci` se reutiliza mientras no cambien `package*.json`.
- **Ejecución:** los jobs van en paralelo y se cancelan las ejecuciones obsoletas de los PR.
- **Coste:** unos 2-3 min por job. La verificación con PR temporales cuesta entre 30 y 40 minutos de los 2000 mensuales.

### Riesgos técnicos

- **Imágenes que cambian:** `node:24-alpine` y la imagen `ubuntu-24.04` del runner pueden cambiar entre ejecuciones. Es aceptado en el ticket.
- **Límite de caché:** la caché `gha` comparte el límite de 10 GB por repositorio con la de npm. GitHub expulsa las entradas antiguas; a lo sumo, la build es más lenta.
- **Caché en ramas temporales:** las cachés que crean las ramas `ci-tmp/*` quedan acotadas a su ref y caducan solas, a los 7 días sin uso.
- **CI no obligatorio:** el CI no bloquea el merge (TC-1 A). La regla es de proceso.
- **Versiones fijas:** con las acciones fijadas por SHA, no llegan solas las correcciones de seguridad (no hay Dependabot: fuera de alcance). Hay que actualizarlas a mano. Se documenta en el README.

### Orden de implementación

1. **T2.** Rama `feature/REQ-F-006-ci-github-actions` desde `main` actualizado. `git mv` del ticket a `in-progress/` con el estado `IN_PROGRESS`.
2. Escribir `.github/workflows/ci.yml` y verificar de nuevo los SHA. Ejecutar `actionlint`.
3. README (`## CI` y la fila de `lint`).
4. `senior-fullstack.md` (T4 y reglas críticas).
5. Validación local: `npm run typecheck`, `npm run lint`, `npm run build:css`, `npm test` y `docker buildx build --platform linux/amd64 --target production`.
6. Ramas y PR temporales de la tabla de "Testing", una por una. Anotar las evidencias en el ticket. Cerrar los PR sin merge y borrar las ramas.
7. Escribir `## Implementation Result` y devolver `NEEDS_IMPLEMENTATION_APPROVAL`, sin hacer commit en la rama del ticket.

### Criterios de finalización

- `ci.yml` pasa `actionlint` y cumple la revisión estática de CA-8.
- CA-1 a CA-5 y CA-7 verificados en GitHub, con las URL de las ejecuciones anotadas en el ticket.
- CA-6 pendiente, de forma explícita, de T5.
- CA-9: el README cumple R-8, con la limitación de TC-1 A documentada.
- `senior-fullstack.md` exige el CI en verde antes de `READY_FOR_MERGE`.
- `typecheck`, `lint` y `test` en local terminan en 0, y `git diff` solo contiene los archivos del plan.
- No queda ninguna rama ni PR `ci-tmp/REQ-F-006-*` abierto.

## Implementation Result

### Rama

`feature/REQ-F-006-ci-github-actions`, creada desde `main` (`948dc2c`, actualizado con `git pull --ff-only`: ya estaba al día). Sin commits hasta T4, como pide el plan.

### Cambios realizados

- **`.github/workflows/ci.yml` (nuevo).** El workflow del plan, sin desviaciones:
  - eventos `pull_request` hacia `main` (`opened`, `synchronize`, `reopened`) y `push` a `main`;
  - `permissions: contents: read`;
  - concurrencia: grupo `ci-pr-<n>` con cancelación en los PR y `ci-<sha>` en `main`;
  - jobs `calidad` y `docker` en `ubuntu-24.04`, con `timeout-minutes: 15` y sin dependencias entre ellos;
  - acciones fijadas por SHA completo, con la versión en un comentario. Antes de escribir el archivo comprobé que cada SHA corresponde a su etiqueta y que sigue siendo la última versión publicada:
    - checkout v7.0.1, `3d3c42e5…`;
    - setup-node v7.0.0, `82076278…`;
    - setup-buildx-action v4.4.1, `f87e5991…`;
    - build-push-action v7.4.0, `c3c9e263…`.
- **`restaurante/README.md`:**
  - nueva sección `## CI` (cuándo se ejecuta, qué comprueba, cómo reproducirlo en local, seguridad y forks, actualización de las acciones, fallos de red y comprobaciones obligatorias según TC-1 A);
  - en la tabla de scripts, la fila de `lint` indica que sí forma parte del CI.
- **`.claude/agents/senior-fullstack.md`:**
  - T4, nuevo paso 8: `gh pr checks <n> --watch --fail-fast`; no se devuelve `READY_FOR_MERGE` si `calidad` o `docker` están en rojo;
  - regla crítica 7 ampliada con lo mismo.

### Criterios de aceptación

Verificados con PR en borrador temporales (TC-3). Todos se cerraron sin merge.

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | PR #13 (`ok`), ejecución https://github.com/orvigas/negocio/actions/runs/37226009374: `calidad` y `docker` en verde y visibles por separado en el PR (`gh pr checks 13`). Se confirmará otra vez en el PR real de T4. |
| CA-2 | Cumple | PR #14 (`tipo`), https://github.com/orvigas/negocio/actions/runs/37226015292: `calidad` falla en `typecheck` (TS2322) y se saltan `lint`, `build:css` y `test`; `docker` falla en `[build 2/3] RUN npm run typecheck`. |
| CA-3 | Cumple | PR #15 (`lint`), https://github.com/orvigas/negocio/actions/runs/37226020720: `calidad` falla en `lint` (`@typescript-eslint/no-unused-vars`) con `typecheck` en verde; se saltan `build:css` y `test`. `docker` en verde. |
| CA-4 | Cumple | PR #16 (`test`), https://github.com/orvigas/negocio/actions/runs/37226024838: `calidad` falla en `test` (1 fallada, 468 pasadas). `docker` en verde. |
| CA-5 | Cumple | PR #17 (`dockerfile`), https://github.com/orvigas/negocio/actions/runs/37226031223: `docker` falla (`dockerfile parse error on line 26: unknown instruction: RUNN`) y `calidad` queda en verde. |
| CA-6 | Pendiente (T5) | Se verifica después del merge del usuario, con `gh run list --branch main --event push --workflow CI`. Revisión estática: `on.push.branches: [main]` y grupo de concurrencia propio por SHA. |
| CA-7 | Cumple | PR #18 (`cancelacion`): la ejecución del primer push (https://github.com/orvigas/negocio/actions/runs/37226043234) queda `cancelled`; la del segundo (https://github.com/orvigas/negocio/actions/runs/37226052969) queda en verde. |
| CA-8 | Cumple | Revisión estática de `ci.yml`: 0 apariciones de `secrets.`; `permissions` solo con `contents: read`; los 4 `uses:` llevan un SHA de 40 caracteres y un comentario de versión. Evento `pull_request`, no `pull_request_target`. |
| CA-9 | Cumple | La sección `## CI` del README cubre los cuatro puntos de R-8. Por TC-1 A, explica que hoy no se puede bloquear el merge y da los pasos para cuando el repositorio sea Pro o público. |

Otras evidencias:

- **R-3:** el runner usa Node v24.21.0 (de `.nvmrc`), con npm 11.19.0.
- **R-6:** en el segundo intento de la ejecución `ok` (`gh run rerun 37226009374`, attempt 2), el log muestra `Cache restored from key: node-cache-Linux-x64-npm-<hash del lockfile>` y la caché de buildx `gha` reutiliza las capas (`CACHED`). En el primer intento, la caché se creó (`npm cache is not found` y luego `Cache saved`).
- **Caché entre PR:** las cachés de un PR no se comparten con otros PR, así que los PR en paralelo no reutilizaron la caché de npm entre sí. Es el comportamiento esperado de GitHub. Los PR sí podrán usar la caché de `main` una vez que el workflow esté mergeado.
- **Duración:** cada job tardó entre 1 y 1,5 min.

### Validaciones ejecutadas

Desde `restaurante/`, con el resultado real:

- `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -no-color .github/workflows/ci.yml` (actionlint 1.7.12, desde la raíz del repositorio): salida 0, sin errores.
- `npm run typecheck`: salida 0.
- `npm run lint`: salida 0.
- `npm run build:css`: salida 0.
- `npm test`: 25 archivos, 468/468 pruebas pasadas. También con `TZ=UTC CI=true`: 468/468.
- `docker buildx build --platform linux/amd64 --target production .`: salida 0. La imagen local se borró después.
- **Limpieza:**
  - PR #13 a #18: `CLOSED`, `mergedAt=null`;
  - ramas remotas `ci-tmp/REQ-F-006-*`: borradas con `git push origin --delete`, porque `gh pr close --delete-branch` no las borró mientras los worktrees locales seguían activos;
  - ramas y worktrees locales: borrados.
- **Comprobación final:**
  - `git branch --list 'ci-tmp/*'` y `git branch -r --list 'origin/ci-tmp/*'` vacíos;
  - `gh api repos/orvigas/negocio/branches` sin ninguna `ci-tmp`;
  - el único PR abierto es el #12, que no se tocó.
- **`git diff`:** solo los archivos del plan.

### Archivos afectados

- `.github/workflows/ci.yml` (nuevo)
- `restaurante/README.md`
- `.claude/agents/senior-fullstack.md`
- `.claude/docs/in-progress/REQ-F-006-ci-github-actions.md` (movido desde `backlog/`)

### Riesgos o pendientes

- **CA-6:** pendiente de T5, después del merge del usuario.
- **Merge sin bloqueo:** GitHub no bloquea el merge con el CI en rojo (plan Free). La regla es de proceso (README y `senior-fullstack.md`).
- **Caché de las ramas temporales:** quedan cachés `gha` de las ramas temporales (npm y buildx), acotadas a sus refs. Caducan solas a los 7 días sin uso; no se borraron a mano.
- **Check de GitGuardian:** en los PR también aparece "GitGuardian Security Checks", una integración externa del repositorio que ya existía y que es ajena a este ticket.
- **Desviaciones del plan:**
  - pasos `checkout`, `setup-node` y `setup-buildx` con nombre explícito, para que se lean mejor en el PR;
  - un intento extra (rerun) del caso `ok`, para demostrar R-6;
  - por lo demás, ninguna.

## QA Action Plan

Fase Q1 de senior-qa (2026-10-04). Implementación aprobada por el usuario (cita: "Apruebo la implementación"). No se ha ejecutado nada todavía.

### Objetivo

Confirmar, con evidencia independiente de la aportada por senior-fullstack, que el workflow `.github/workflows/ci.yml`, la sección `## CI` del README y el paso de espera del CI en `senior-fullstack.md` cumplen CA-1 a CA-9, sin regresiones y sin cambios fuera de alcance.

### Requisito bajo prueba

R-1 a R-8 y D-1 a D-5, con las decisiones TC-1 A (sin protección de rama; regla de proceso), TC-2 (paso `build:css` antes de `test`) y TC-3 (ramas temporales; CA-6 en T5).

### Criterios de aceptación

| CA | Cómo se verifica | Tipo de evidencia |
| --- | --- | --- |
| CA-1 | V-1 + V-2 sobre la ejecución 37226009374 (PR #13): `calidad` y `docker` con `conclusion=success`, los 5 pasos de `calidad` en `success`; `gh pr checks 13` muestra ambas por separado. | `gh run view`/`gh pr checks` |
| CA-2 | V-1 + V-2 sobre 37226015292 (PR #14): `calidad` → paso `typecheck` `failure`, `lint`/`build:css`/`test` `skipped`; `docker` → `failure` con log `[build …] RUN npm run typecheck`. | `gh run view --json jobs`, `--log-failed` |
| CA-3 | V-1 + V-2 sobre 37226020720 (PR #15): `typecheck` `success`, `lint` `failure`, `build:css`/`test` `skipped`; `docker` `success`. | ídem |
| CA-4 | V-1 + V-2 sobre 37226024838 (PR #16): `lint` y `build:css` `success`, `test` `failure` con 1 prueba fallida; `docker` `success`. | ídem |
| CA-5 | V-1 + V-2 sobre 37226031223 (PR #17): `docker` `failure` (error de parseo del Dockerfile); `calidad` `success` en todos sus pasos. | ídem |
| CA-6 | Solo revisión estática (S-2: `on.push.branches: [main]`, grupo de concurrencia por SHA, sin `cancel-in-progress` en push). La verificación en GitHub queda **diferida a T5** (decisión TC-3 del usuario). Ver "Criterios de aprobación". | estática |
| CA-7 | V-1 sobre 37226043234 (`conclusion=cancelled`) y 37226052969 (`success`): mismo PR #18, misma rama, `headSha` distintos y el cancelado es el más antiguo (`createdAt`). | `gh run view --json` |
| CA-8 | S-1 a S-6 (revisión estática) + actionlint (L-1). | salida de comandos |
| CA-9 | D-1: revisión del README contra los 4 puntos de R-8 y de la coherencia con `ci.yml`. | texto del README |

### Riesgos identificados

- **RQ-1. La evidencia podría no corresponder al `ci.yml` que se va a entregar.** Las ejecuciones son de ramas temporales ya borradas. Se mitiga con V-2: comparar el SHA del blob `.github/workflows/ci.yml` en el `headSha` de cada ejecución con `git hash-object` del archivo de trabajo.
- **RQ-2. Commits de ramas borradas inaccesibles.** Si `gh api …/contents?ref=<headSha>` ya no responde, se usa como evidencia alternativa el log de la ejecución (líneas de los pasos y SHAs de acciones descargadas: "Download action repository 'actions/checkout@3d3c…'"). Si tampoco basta, ver "Pruebas en GitHub (opcionales)".
- **RQ-3. Falsos pasos en rojo/verde.** Que un job falle por otro motivo (red, caché) y se tome como evidencia del CA. Se mitiga revisando el paso exacto y el mensaje de error (`--log-failed`).
- **RQ-4. `gh pr checks --watch --fail-fast` en `senior-fullstack.md`** también vigila checks ajenos (GitGuardian); si GitGuardian falla, el agente se detendría. Se valora como observación de proceso, no como defecto, salvo que contradiga el requisito.
- **RQ-5. Concurrencia:** la expresión del grupo y `cancel-in-progress` deben evaluar distinto en `pull_request` y `push`. Solo el lado PR tiene evidencia dinámica (CA-7); el lado push se revisa estáticamente.
- **RQ-6. Alcance:** que el diff incluya archivos fuera del plan o cambios en la app.

### Pruebas funcionales (evidencia existente en GitHub, solo lectura)

- **V-1.** Para cada una de las 7 ejecuciones listadas: `gh run view <id> --json event,headBranch,headSha,status,conclusion,createdAt,workflowName,attempt,jobs` y comprobar `workflowName=CI`, `event=pull_request`, `headBranch=ci-tmp/REQ-F-006-<caso>`, jobs `calidad` y `docker`, conclusión por job y por paso según la tabla de CA.
- **V-2.** Identidad del workflow (RQ-1): `gh api repos/orvigas/negocio/contents/.github/workflows/ci.yml?ref=<headSha> --jq .sha` frente a `git hash-object .github/workflows/ci.yml`. Mismo SHA en las 7 ejecuciones = mismo `ci.yml` que el de la rama del ticket. Si difiere, `diff` del contenido y valorar si la diferencia afecta al CA.
- **V-3.** Defecto inducido: para cada rama de fallo, `gh api repos/orvigas/negocio/compare/<base>...<headSha>` (o `gh pr diff <n>`) para confirmar que el commit de prueba solo introduce el defecto declarado (y el `ci.yml`).
- **V-4.** `gh run view <id> --log-failed` en CA-2 a CA-5 para ver el mensaje de error real del paso que falla.
- **V-5.** `gh pr checks 13` (y `gh pr view 13..18 --json state,mergedAt,isDraft,headRefName`): checks separados `calidad` y `docker`; PR cerrados, `mergedAt=null`, borradores.
- **V-6. R-3 y R-6:** en el log de `calidad` de 37226009374 (intento 2): versión de Node 24.x y `Cache restored from key: node-cache-Linux-x64-npm-…`; en el intento 1, caché no encontrada y guardada.

### Pruebas negativas y casos límite

- Fallo en cada paso (CA-2 a CA-5): cubiertos por V-1/V-4 (pasos siguientes `skipped`, el otro job no afectado).
- PR desde fork: no reproducible (repositorio privado, sin forks). Se valida estáticamente (evento `pull_request`, no `pull_request_target`; ningún `secrets.*`; permisos de solo lectura) y la nota del README.
- Zona horaria: el runner usa UTC (V-6, campo de entorno del log) y `npm test` pasó en él (CA-1).
- Fallos de red: solo documental (README, "Re-run failed jobs").
- Evento `reopened` y `timeout-minutes`: solo estático (no se justifica gastar minutos en provocar un timeout de 15 min).

### Pruebas estáticas del workflow (CA-8, R-1 a R-7)

- **L-1.** `actionlint` con la imagen `rhysd/actionlint` (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color=false .github/workflows/ci.yml`): salida 0. No se agrega como dependencia.
- **S-1.** `grep -n 'secrets\.' .github/workflows/ci.yml` vacío; ningún `env:` con credenciales; ningún `.env`.
- **S-2.** `on`: solo `pull_request` (branches `[main]`, types `opened/synchronize/reopened`) y `push` (branches `[main]`); sin `pull_request_target`, `workflow_run` ni `workflow_dispatch` con permisos ampliados.
- **S-3.** `permissions` a nivel de workflow solo `contents: read`; ningún `permissions:` a nivel de job que lo amplíe; `persist-credentials: false` en ambos `checkout`.
- **S-4.** Cada `uses:` con SHA de 40 caracteres y comentario de versión; con `gh api repos/<owner>/<acción>/commits/<tag> --jq .sha` (solo lectura) confirmar que cada SHA corresponde a la etiqueta del comentario.
- **S-5.** `timeout-minutes: 15` en ambos jobs; sin `needs` entre jobs; concurrencia con grupo por PR y cancelación solo en `pull_request`.
- **S-6.** `node-version-file: restaurante/.nvmrc` (`24`) coincide con `FROM node:24-alpine` y `engines >=24.3.0`; `cache: npm` con `cache-dependency-path: restaurante/package-lock.json`; job `docker` con `target: production`, `platforms: linux/amd64`, `push: false`, sin `outputs`/`load`/login a registry.
- **S-7.** Orden de pasos de `calidad`: `install` → `typecheck` → `lint` → `build:css` → `test` (TC-2), sin `continue-on-error` ni `|| true`.

### Pruebas de documentación (CA-9)

- **D-1.** `restaurante/README.md`, sección `## CI`: qué comprueba, cuándo se ejecuta, cómo reproducir en local, cómo marcar los checks como obligatorios (TC-1 A con la limitación del plan Free). Coherencia con `ci.yml` (nombres de jobs, orden, eventos, cancelación, timeout). El enlace `[CI](#ci)` de la tabla de scripts apunta a un ancla existente.
- **D-2.** Ejecutar en local los comandos de "Reproducirlo en local" tal como están escritos (ver "Pruebas de regresión"), para comprobar que el procedimiento documentado funciona.
- **D-3.** `.claude/agents/senior-fullstack.md`: el paso T4 nuevo y la regla crítica 7 exigen el CI en verde antes de `READY_FOR_MERGE`; la numeración del T4 queda coherente y la referencia "regla crítica 8" apunta a la regla correcta.

### Pruebas de regresión

- **R-1.** `git status` y `git diff main --stat` (más los no rastreados): solo `ci.yml`, README, `senior-fullstack.md` y el ticket movido. Nada en `src/`, `public/`, `tests/`, `package*.json`, Dockerfile ni `compose.yaml`.
- **R-2.** Desde `restaurante/`: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build:css`, `npm test` (todo con salida 0; `npm test` completo). Además `TZ=UTC CI=true npm test` para reproducir las condiciones del runner.
- **R-3.** `docker buildx build --platform linux/amd64 --target production restaurante/` (sin publicar; la imagen no se etiqueta ni se carga). Salida 0.
- **R-4.** Repositorio remoto limpio: sin ramas `ci-tmp/*` (`git ls-remote --heads origin 'ci-tmp/*'`), PR #13–#18 cerrados sin merge, PR #12 abierto y sin cambios (solo lectura).

### Pruebas automatizadas

No se crean ni modifican pruebas en `restaurante/tests/`: el ticket no cambia la app. La suite existente sirve como regresión (R-2).

### Pruebas en GitHub (nuevas ejecuciones)

**Propuesta: ninguna.** Las 7 ejecuciones existentes cubren CA-1 a CA-5 y CA-7, y V-1 a V-4 permiten verificarlas de forma independiente sin gastar minutos. Las validaciones que no tienen evidencia dinámica (fork, `reopened`, timeout, push a `main`) no se pueden o no merece la pena provocarlas con ramas temporales: CA-6 necesita un push a `main`, que no está autorizado y queda para T5.

**Contingencia (solo si V-2 o V-3 fallan,** es decir, si no puede demostrarse que la evidencia corresponde al `ci.yml` final o al defecto declarado): repetir únicamente los casos afectados con ramas `ci-tmp/REQ-F-006-<caso>` autorizadas (PR en borrador, cerrar sin merge y borrar rama local y remota), con el `ci.yml` del árbol de trabajo copiado tal cual. Coste estimado: ~3 min de Actions por caso (2 jobs × 1–1,5 min), máximo ~20 min si hubiera que repetir los 6 casos. Si se activa, se informará en el QA Report de qué caso y por qué.

### Pruebas no aplicables

Responsive, accesibilidad, UX/UI frente a `_stich_source_/`, WhatsApp, SEO, performance de la web y pruebas en navegador: el ticket no cambia la app ni la UI (no hay diseño asociado). No se levanta el servidor.

### Evidencia requerida

- Salida JSON resumida de `gh run view` para las 7 ejecuciones (job, paso, conclusión, `headSha`).
- SHAs de blob de `ci.yml` (remoto por `headSha` y local).
- Fragmentos de `--log-failed` de CA-2 a CA-5.
- Salida de actionlint, de los greps de S-1 a S-7 y de la verificación de SHAs de etiquetas.
- Salida de `npm run typecheck`, `lint`, `build:css`, `npm test` y del `docker buildx build`.
- Salida de `git diff --stat` y del estado de ramas/PR remotos.

### Criterios de aprobación

- `QA_APPROVED` si: CA-1 a CA-5, CA-7, CA-8 y CA-9 en PASS con evidencia; CA-6 en PASS estático y marcado **"diferido a T5"** según la decisión TC-3 del usuario (no se considera FAIL ni BLOCKED); actionlint en 0; regresión local (R-2, R-3) en verde; diff limitado al alcance; sin defectos `BLOCKER`/`CRITICAL` ni `MAJOR` sin decisión del usuario.
- `QA_REJECTED` si falla cualquiera de los CA anteriores, si la evidencia no corresponde al `ci.yml` final y la contingencia confirma el fallo, o si hay cambios fuera de alcance.
- `NEEDS_USER_DECISION` si aparece un defecto `MAJOR`, una ambigüedad del requisito, o si la contingencia es necesaria pero no se puede ejecutar.

## QA Report

### Ronda

1 (2026-10-04). Plan aprobado por el usuario (cita: "Apruebo el plan, acepto CA-6 diferido y autorizo la contingencia"). La contingencia **no se activó**: V-2 y V-3 pasaron, así que no se crearon ramas ni PR ni se gastaron minutos de Actions.

### Pruebas ejecutadas

| Id | Comando o acción | Resultado real |
| --- | --- | --- |
| V-1 | `gh run view <id> --json event,headBranch,headSha,conclusion,attempt,jobs` en las 7 ejecuciones | Todas: `workflowName=CI`, `event=pull_request`, rama `ci-tmp/REQ-F-006-<caso>`, jobs `calidad` y `docker`. Conclusiones por paso en la tabla de CA. |
| V-2 | `gh api repos/orvigas/negocio/contents/.github/workflows/ci.yml?ref=<headSha> --jq .sha` frente a `git hash-object .github/workflows/ci.yml` | Las 7 ejecuciones: blob `e0f52559758475151814531d04cd677b64c25dff`, idéntico al `ci.yml` local. **PASS**. |
| V-3 | `gh api repos/orvigas/negocio/compare/948dc2c...<headSha>` | `ok` y `cancelacion` (push 1): solo `ci.yml`. `tipo`: `ci.yml` + `src/utils/errors.ts` (`export const ciTmpTypeError: number = 'texto'`). `lint`: `ci.yml` + `errors.ts` (`const ciTmpUnused = 1`). `test`: `ci.yml` + `tests/unit/ci-tmp.test.ts` (`expect(1).toBe(2)`). `dockerfile`: `ci.yml` + `Dockerfile` (`RUN` → `RUNN`, línea 26). `cancelacion` push 2: commit vacío (0 archivos). **PASS**. |
| V-4 | `gh run view <id> --log-failed` | Mensajes de error reales: ver la tabla de CA. |
| V-5 | `gh pr checks 13`; `gh pr view 13..18 --json state,mergedAt,isDraft,headRefName,baseRefName` | `calidad pass 46s`, `docker pass 26s` (además de `GitGuardian Security Checks pass`, una integración externa). PR #13 a #18: `CLOSED`, `mergedAt=null`, `isDraft=true`, base `main`. |
| V-6 | `gh run view 37226009374 --attempt 1/2 --log` | Intento 1: `npm cache is not found` y `Cache saved with the key: node-cache-Linux-x64-npm-7020388a…`. Intento 2: `Cache restored from key: node-cache-Linux-x64-npm-7020388a…`, `node: v24.21.0`, `npm: 11.19.0`, `Image: ubuntu-24.04`; capas de Docker `CACHED`. Los SHA de las acciones descargadas coinciden con los de `ci.yml`. |
| L-1 | `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color=false .github/workflows/ci.yml` (actionlint 1.7.12) | Salida 0, sin mensajes. |
| S-1 | `grep -nE 'secrets\.\|env:\|GITHUB_TOKEN\|token'` | Ninguna coincidencia. |
| S-2 | `grep -nE 'pull_request_target\|workflow_run\|workflow_dispatch\|schedule'` | Ninguna coincidencia. `on` solo tiene `pull_request` (`branches: [main]`, `types: [opened, synchronize, reopened]`) y `push` (`branches: [main]`). |
| S-3 | Revisión de `permissions` | Solo `contents: read` a nivel de workflow; sin `permissions` por job; `persist-credentials: false` en los 2 `checkout`. |
| S-4 | `gh api repos/<acción>/commits/<etiqueta> --jq .sha` y `releases/latest` | Los 5 `uses:` llevan SHA de 40 caracteres con comentario de versión. checkout v7.0.1 → `3d3c42e5…`, setup-node v7.0.0 → `82076278…`, setup-buildx-action v4.4.1 → `f87e5991…`, build-push-action v7.4.0 → `c3c9e263…`: los cuatro coinciden y son la última versión publicada. |
| S-5 | Revisión de jobs y concurrencia | `timeout-minutes: 15` en los 2 jobs, sin `needs`. El grupo es `ci-pr-<n>` en los PR y `ci-<sha>` en push; `cancel-in-progress` solo es verdadero con `pull_request`. |
| S-6 | `.nvmrc`, Dockerfile, `package.json` | `.nvmrc` = `24`, `FROM node:24-alpine`, `engines.node >=24.3.0`; runner con v24.21.0. `cache-dependency-path: restaurante/package-lock.json`. Job `docker`: `target: production`, `platforms: linux/amd64`, `push: false`, sin `outputs`/`load`/login. |
| S-7 | `grep -nE 'continue-on-error\|\|\| true\|if:'` | Ninguna coincidencia. Orden: `install` → `typecheck` → `lint` → `build:css` → `test`. |
| R-1 | `git diff 948dc2c --stat` y `git ls-files --others` | Solo `senior-fullstack.md`, `README.md`, el ticket (de `backlog/` a `in-progress/`) y `.github/workflows/ci.yml` (sin seguimiento). 0 archivos en `src/`, `public/`, `tests/`, `package*.json`, `Dockerfile` o `compose.yaml`. `origin/main` (`8480331`, PR #12) solo cambió el ticket de REQ-F-005: no hay solapamiento con esta rama. |
| R-2 / D-2 | Desde `restaurante/`, con Node v24.21.0: `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm run lint`, `npm run build:css`, `npm test`, `TZ=UTC CI=true npm test` | Todos con salida 0. Pruebas: 25/25 archivos y 468/468, igual con `TZ=UTC CI=true`. |
| R-3 / D-2 | `docker buildx build --platform linux/amd64 --target production .` | Salida 0. La imagen sin etiqueta resultante se borró. |
| R-4 | `git ls-remote --heads origin 'ci-tmp/*'`, `git branch --list 'ci-tmp/*'`, `git worktree list`, `gh pr list --state open` | 0 ramas remotas, 0 locales, un solo worktree (el principal), 0 PR abiertos. |
| D-1 / D-3 | Revisión del README (`## CI`, ancla `#ci`) y de `senior-fullstack.md` (T4 paso 8, regla crítica 7) | Ver CA-9 y DEF-001. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Ejecución 37226009374 (PR #13, `headSha 9fe5db5`, mismo `ci.yml`): `calidad` y `docker` en `success`, con todos los pasos en `success`. `gh pr checks 13` muestra `calidad` y `docker` por separado. Se reconfirmará en el PR real de T4. |
| CA-2 | PASS | 37226015292 (PR #14): `calidad` → `typecheck=failure` (`src/utils/errors.ts(10,14): error TS2322`), y `lint`, `build:css` y `test` en `skipped`. `docker` → `build production=failure`: `process "/bin/sh -c npm run typecheck" did not complete successfully: exit code: 2` (etapa `build`). |
| CA-3 | PASS | 37226020720 (PR #15): `typecheck=success`, `lint=failure` (`'ciTmpUnused' is assigned a value but never used @typescript-eslint/no-unused-vars`), y `build:css` y `test` en `skipped`. `docker=success`. |
| CA-4 | PASS | 37226024838 (PR #16): `typecheck`, `lint` y `build:css` en `success`; `test=failure` (`Tests 1 failed | 468 passed (469)`, `AssertionError: expected 1 to be 2`). `docker=success`. |
| CA-5 | PASS | 37226031223 (PR #17): `docker` → `dockerfile parse error on line 26: unknown instruction: RUNN`. `calidad=success` en todos sus pasos. |
| CA-6 | PASS estático, **diferido a T5** (decisión TC-3, aceptada por el usuario en Q2) | `on.push.branches: [main]`; concurrencia por SHA sin cancelación en push (S-2, S-5). La verificación en GitHub se hará en T5 con `gh run list --branch main --event push --workflow CI`. |
| CA-7 | PASS | PR #18, misma rama `ci-tmp/REQ-F-006-cancelacion`: la ejecución 37226043234 (`395e900`, creada 18:51:34Z, la más antigua) termina en `cancelled` (`install=cancelled` en `calidad` y `setup-buildx=cancelled` en `docker`). La 37226052969 (`aea6bf5`, 18:51:44Z, commit vacío) termina en `success`. |
| CA-8 | PASS | S-1 a S-4 y L-1: sin secretos, solo `contents: read`, `pull_request` (no `pull_request_target`) y las 5 referencias `uses:` con SHA completo verificado contra su etiqueta. |
| CA-9 | PASS | En la `## CI` del README: **qué comprueba** ("Qué comprueba", tabla con los pasos en orden, coherente con `ci.yml`); **cuándo** ("Cuándo se ejecuta": eventos, cancelación y 15 min); **reproducir en local** (comandos verificados en R-2 y R-3); **checks obligatorios** (limitación del plan Free según TC-1 A y pasos para Pro o repositorio público). El ancla `[CI](#ci)` apunta al encabezado `## CI` (línea 134). |

### Defectos encontrados

#### DEF-001

- Severidad: MINOR
- Criterio de aceptación afectado: ninguno (alcance: "mención en `senior-fullstack.md` de que el PR debe tener el CI en verde antes de pasar a `READY_FOR_MERGE`").
- Descripción: en T4 de `senior-fullstack.md`, el paso 3 (que ya existía) pone el estado del ticket en `READY_FOR_MERGE` **antes** del commit y del push. El paso 8 nuevo espera el CI **después** de crear el PR. Si el CI falla, el agente no devuelve `READY_FOR_MERGE`, pero el ticket ya está confirmado y publicado en la rama con `READY_FOR_MERGE`.
- Pasos para reproducir: leer T4, pasos 3 a 9, en `.claude/agents/senior-fullstack.md`.
- Resultado esperado: el estado `READY_FOR_MERGE` solo queda registrado cuando el CI está en verde.
- Resultado actual: el archivo del ticket puede decir `READY_FOR_MERGE` con el CI en rojo, aunque el estado que se devuelve sea correcto.
- Evidencia: `.claude/agents/senior-fullstack.md`, T4 paso 3 ("Pon el estado del ticket en `READY_FOR_MERGE`") frente al paso 8 nuevo.
- Impacto: bajo. La orquestación usa el estado que devuelve el agente, que es correcto. Solo afecta a la coherencia del ticket en la rama mientras se corrige el fallo.
- Recomendación: alinear en qué momento se registra `READY_FOR_MERGE` en el ticket con la espera del CI. Puede hacerse en este ticket o como ajuste menor posterior.

#### Observaciones (no son defectos)

- OBS-1: `gh pr checks --watch --fail-fast` también vigila checks externos (GitGuardian). Si uno de ellos falla, el agente se detiene, lo que es coherente con la regla "si cualquier validación falla, detén el flujo".
- OBS-2: sin verificar. Justo después de `gh pr create`, `gh pr checks` podría responder "no checks reported" antes de que GitHub registre las ejecuciones. En ese caso el agente reportaría un fallo inexistente. No afecta a ningún CA y se verá en T4.

### Regresión

Sin regresiones. No cambia ningún archivo de la app. `typecheck`, `lint`, `build:css` y `npm test` (468/468, también en UTC) dan 0, y el build `production` de Docker da 0. `origin/main` avanzó con el PR #12, que solo toca el ticket de REQ-F-005 y no tiene solapamiento.

### Responsive / Accesibilidad / UX/UI / Performance / SEO

No aplican: el ticket no cambia la app ni la UI y no tiene diseño en `_stich_source_/`. Rendimiento del CI: los jobs tardan 26 s a 1,5 min y la caché funciona (V-6).

### Pendientes de revisión manual

- CA-6: en T5, después del merge del usuario (diferido por decisión TC-3).
- CA-1: se reconfirma en el PR real de T4.
- Las cachés `gha` de las ramas temporales caducan solas (riesgo ya aceptado en el Implementation Result).

### Resultado final

QA_APPROVED

## Historial de cambios

### T4: correcciones antes del commit (2026-10-04)

senior-fullstack:

- **DEF-001 corregido.** En T4 de `senior-fullstack.md`, el ticket se confirma con el estado `QA_APPROVED`. `READY_FOR_MERGE` se registra en el commit `docs: registra el Pull Request…`, que se hace solo con el CI del PR en verde, y después se espera de nuevo el CI del último commit.
- **OBS-2 atendida.** Reintento breve si `gh pr checks` responde `no checks reported`.
- **Base actualizada.** Los cambios se llevaron sin pérdidas a `main` en `8480331` (PR #12).
- **Validaciones.** `typecheck`, `lint` y `build:css` dan 0; `npm test` da 468/468; actionlint da 0.

### QA Q2, ronda 1 (2026-10-04)

senior-qa: plan aprobado (cita: "Apruebo el plan, acepto CA-6 diferido y autorizo la contingencia"). Se verifican de forma independiente las 7 ejecuciones (mismo `ci.yml`, blob `e0f5255`), se hace la revisión estática, se ejecuta actionlint, se revisa la documentación y se pasa la regresión local. No hizo falta la contingencia. CA-1 a CA-5 y CA-7 a CA-9 en PASS; CA-6 en PASS estático, diferido a T5. DEF-001 (MINOR, no bloqueante). Estado `QA_APPROVED`.

### QA Action Plan Q1 (2026-10-04)

senior-qa: con la implementación aprobada por el usuario (cita: "Apruebo la implementación"), se escribe el `## QA Action Plan`: verificación independiente de las 7 ejecuciones existentes, revisión estática y actionlint, documentación y regresión local; sin nuevas ejecuciones en GitHub salvo contingencia. Estado `NEEDS_QA_PLAN_APPROVAL`.

### Implementación T2 (2026-10-04)

senior-fullstack: aprobación del plan por el usuario (cita: "Apruebo el plan"). Se crean la rama `feature/REQ-F-006-ci-github-actions` y `ci.yml`, y se modifican el README y `senior-fullstack.md`. Se verifican CA-1 a CA-5, CA-7, CA-8 y CA-9 con los PR temporales #13 a #18, que se cerraron sin merge y cuyas ramas se borraron. CA-6 queda pendiente de T5. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Technical Action Plan (2026-10-04)

senior-fullstack: se registran las respuestas del usuario ("TC-1 A, TC-2 sí, TC-3 autorizo las ramas temporales") y se escribe el `## Technical Action Plan`. Estado `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Revisión técnica T1 (2026-10-04)

senior-fullstack: revisión técnica sin cambios de código. Estado `NEEDS_TECHNICAL_CLARIFICATION` por TC-1 (protección de rama no disponible en un repositorio privado con plan Free), TC-2 (falta `build:css` antes de `test`) y TC-3 (autorización de ramas y PR temporales; CA-6 se verifica en T5). Se incluye el borrador del workflow, validado con actionlint.

### Versión 1

Descripción inicial. Aprobada por el usuario el 2026-10-03 (cita: "apruebo todo"), incluidas las propuestas P-1 a P-5 como D-1 a D-5.
