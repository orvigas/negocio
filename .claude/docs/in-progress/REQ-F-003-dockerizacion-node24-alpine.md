# REQ-F-003 — Dockerización de la app con Node 24 Alpine y pruebas con Docker Compose

## Estado

READY_FOR_MERGE

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-02). Cita: "Apruebo, confirmo los supuestos S-1 a S-4".

## Objetivo

Contenerizar la app `restaurante/` con una imagen Docker basada en Node 24 Alpine, construida por capas (multi-stage), con:

- un target de pruebas;
- una etapa de producción lista para un despliegue futuro.

Además, un Docker Compose que use esa imagen para ejecutar localmente la suite de pruebas sin requerir Node/npm en el equipo.

## Alcance

Todo dentro de `restaurante/`:

- `Dockerfile` multi-stage;
- `.dockerignore`;
- `compose.yaml` con un único servicio `test`;
- sección Docker en `README.md`.

## Fuera de alcance

- Despliegue con Docker en la VM (el despliegue actual no cambia).
- CI/CD (p. ej. GitHub Actions).
- Publicación de imágenes en un registry.
- Configuración de lint.
- Servicio de app (dev o prod) en el compose.
- Montar el código local como volumen.
- Cambios funcionales en la app o en `src/config/env.js`.

## Decisiones confirmadas por el usuario

- D-1. Propósito: pruebas locales más una etapa `production` lista para un despliegue futuro. El despliegue en la VM no cambia.
- D-2. Compose: solo el servicio `test`.
- D-3. Las pruebas usan el target `test` del mismo Dockerfile, que comparte capas con `production`.
- D-4. Código bajo prueba: horneado en la imagen (sin volumen de código).
- D-5. Se ejecuta `npm test` completo (`vitest run`: unit + integration). El build de CSS queda validado al construir la imagen (etapa `build`), no como paso aparte del servicio.
- D-6. Los archivos Docker van dentro de `restaurante/`.
- D-7. Imagen base `node:24-alpine`, flotante dentro de la versión mayor 24.
- D-8. CI/CD, registry y lint quedan fuera de alcance.

## Requisitos

- R-1. Dockerfile multi-stage; todas las etapas parten de `node:24-alpine`:
  - `base`: imagen base y directorio de trabajo.
  - `deps`: copia solo `package.json` y `package-lock.json` y ejecuta `npm ci`, antes de copiar el código, para que los cambios de código no invaliden la caché de dependencias.
  - `build`: copia el código y ejecuta `npm run build:css` (genera `public/css/{molotes,birria,admin}/main.css`).
  - `test`: incluye devDependencies; su comando por defecto es `npm test`.
  - `production`: solo dependencias de producción, el código y el CSS compilado de `build`; `NODE_ENV=production`; usuario no root; expone el puerto de la app; arranca con `node src/server.js`.
- R-2. `.dockerignore` que excluya como mínimo:
  - `node_modules/`;
  - `.env` y `.env.*` (salvo `.env.example`);
  - `data/`;
  - `coverage/`;
  - logs;
  - `.git`;
  - archivos de editor y del sistema operativo.

  Ningún secreto ni dato editable entra en el contexto de build ni en las imágenes.
- R-3. `compose.yaml` en `restaurante/` con un único servicio `test` que construye el target `test` y ejecuta la suite completa. El código de salida es 0 si todas las pruebas pasan y distinto de 0 si alguna falla.
- R-4. Las pruebas en el contenedor no dependen de `.env`, de la zona horaria del host ni de la red, y pasan con la zona horaria por defecto del contenedor (UTC).
- R-5. La imagen `production` no contiene devDependencies, `.env` ni `data/`. La configuración se inyecta por variables de entorno en tiempo de ejecución. `DATA_DIR` debe ser una ruta absoluta montable, fuera de `src/` y `public/`. Las validaciones de `src/config/env.js` no cambian.
- R-6. El `README.md` de `restaurante/` documenta:
  - cómo construir la imagen;
  - cómo ejecutar las pruebas con compose;
  - cómo construir y ejecutar la etapa `production`;
  - que el despliegue actual en la VM no cambia.

  Las instrucciones actuales sin Docker siguen siendo válidas.

## Historias de usuario

- HU-1. **Como** desarrollador, **quiero** ejecutar todas las pruebas con un comando de Docker Compose, **para** verificar la app sin instalar Node 24 localmente y con un entorno idéntico para todos.
- HU-2. **Como** responsable del negocio, **quiero** una imagen de producción mínima y segura, **para** poder desplegar con contenedores en el futuro sin rehacer el trabajo.

## Reglas de negocio

- RN-1. No se hornean secretos (`.env`, `ADMIN_PASSWORD_HASH`, números de WhatsApp) ni datos editables (`DATA_DIR`) en ninguna imagen.
- RN-2. La configuración sigue siendo por variables de entorno validadas al arrancar. Si falta una obligatoria, el proceso termina con código 1 sin mostrar valores.
- RN-3. Sin cambios funcionales en las landings, la administración ni la selección por día.

## Criterios de aceptación

- CA-1. Given un equipo con Docker y Compose v2 y sin Node, When ejecuto `docker compose run --rm test` en `restaurante/`, Then la imagen se construye desde el target `test`, se ejecuta `vitest run` con todas las pruebas unitarias y de integración, todas pasan y el comando termina con código 0.
- CA-2. Given una prueba que falla a propósito (verificación temporal, no versionada), When ejecuto el mismo comando, Then termina con un código distinto de 0.
- CA-3. Todas las etapas parten de `node:24-alpine`, y `node --version` en los contenedores `test` y `production` devuelve `v24.x`.
- CA-4. Given que solo cambió un archivo de `src/`, When reconstruyo, Then la capa de `npm ci` se reutiliza desde la caché (CACHED en la salida del build).
- CA-5. `docker build --target production` produce una imagen que:
  - no tiene `vitest`, `jsdom`, `supertest`, `tailwindcss` ni `@tailwindcss/cli` en `node_modules`;
  - no tiene `.env` ni `data/`;
  - sí tiene `public/css/{molotes,birria,admin}/main.css`;
  - se ejecuta con un usuario distinto de root.
- CA-6. Given la imagen `production` con `WHATSAPP_MOLOTES` (o `_URL`), `WHATSAPP_BIRRIA` (o `_URL`) y `DATA_DIR` absoluta sobre un volumen montado, When arranca, Then:
  - `GET /` responde 200 con la landing del día;
  - `GET /css/molotes/main.css` responde 200;
  - la semilla se copia a `DATA_DIR` en el primer arranque.
- CA-7. Given la imagen `production` sin las variables de WhatsApp o sin `DATA_DIR`, When arranca, Then el contenedor termina con código 1 y lista los problemas sin exponer valores.
- CA-8. Con `.env` y `data/` presentes localmente, ninguno aparece dentro de las imágenes `test` ni `production`.
- CA-9. La imagen se construye y las pruebas pasan en arm64 (Apple Silicon) y en amd64.
- CA-10. El README contiene la sección Docker descrita en R-6, y `npm test` fuera de Docker sigue pasando (sin regresión).

## Casos límite

- Tailwind v4 usa un binario nativo (`@tailwindcss/oxide`) que debe funcionar en Alpine (musl).
- Las pruebas con snapshots HTML o lógica de fechas deben pasar con TZ=UTC y el locale mínimo de Alpine.
- Un `.env` o un `data/` locales no deben entrar en el contexto de build (CA-8).
- Al repetir la ejecución no deben quedar contenedores huérfanos (`--rm`).
- Con la base flotante `node:24-alpine`, una actualización de la imagen puede cambiar el entorno entre builds.

## Dependencias

- Docker Engine y Docker Compose v2 en el equipo local.
- `package-lock.json` versionado (existe) para `npm ci`.

## Riesgos

- Incompatibilidad de Tailwind v4 o jsdom con musl.
- Pruebas que dependan implícitamente de la zona horaria o el locale del host.
- Confusión entre la imagen `test` y la `production`; se mitiga con el README.
- Un despliegue futuro con Docker en la VM requerirá un ticket aparte (volumen de `DATA_DIR`, nginx, reinicio, `TRUST_PROXY`).

## Action Plan

### Objetivo

Imagen multi-stage sobre `node:24-alpine` con targets `test` y `production`, y un compose cuyo servicio `test` ejecuta la suite completa localmente.

### Alcance

`Dockerfile`, `.dockerignore`, `compose.yaml` y sección Docker del README, todo dentro de `restaurante/`.

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Crear `restaurante/.dockerignore` (R-2).
2. Crear `restaurante/Dockerfile` con las etapas `base`, `deps`, `build`, `test` y `production` (R-1, R-5).
3. Crear `restaurante/compose.yaml` con el servicio `test` (R-3).
4. Actualizar `restaurante/README.md` (R-6).
5. Solo si se detecta una prueba dependiente de la zona horaria o el locale del host: hacerla determinista sin cambiar lo que valida (R-4).

### Reglas de negocio

RN-1 a RN-3.

### UX/UI

No aplica.

### Integraciones

Ninguna externa.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-10.

### Dependencias

Docker y Compose v2; `package-lock.json`.

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. `.dockerignore`.
2. Etapas `base` y `deps`.
3. Etapa `build` (CSS).
4. Etapa `test`.
5. `compose.yaml`.
6. Verificar CA-1 a CA-4, CA-8 y CA-9.
7. Etapa `production`.
8. Verificar CA-5 a CA-7.
9. README y CA-10.

### Resultado esperado

- `docker compose run --rm test` (en `restaurante/`) ejecuta todas las pruebas en un contenedor Node 24 Alpine con un código de salida fiable.
- `docker build --target production` produce una imagen mínima, sin root y sin secretos ni datos, que arranca con la configuración inyectada en tiempo de ejecución.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Pruebas locales en Docker | R-1 (`deps`/`build`/`test`), R-3, R-4 | HU-1 | CA-1, CA-2, CA-3, CA-4, CA-9 |
| Imagen de producción mínima y segura | R-1 (`production`), R-5 | HU-2 | CA-3, CA-5, CA-6, CA-7 |
| Sin secretos ni datos en las imágenes | R-2, RN-1 | HU-1, HU-2 | CA-5, CA-8 |
| Documentación | R-6 | HU-1, HU-2 | CA-10 |

Sin diseño/UI asociado en `_stich_source_/`.

## Technical Action Plan

### Objetivo técnico

Un `Dockerfile` multi-stage en `restaurante/` (todas las etapas desde `node:24-alpine`) con los targets `test` y `production`, un `.dockerignore` que deje fuera secretos, datos y artefactos locales, y un `compose.yaml` con un único servicio `test` que ejecuta `npm test` con código de salida fiable. Sin cambios en `src/`, `public/` ni `tests/` salvo que una prueba resulte depender del entorno del host (R-4).

### Hallazgos de la revisión técnica (sin bloqueos)

- H-1. **Binarios nativos en musl:** `package-lock.json` (lockfile v3) ya registra las variantes `linux-arm64-musl` y `linux-x64-musl` de `@tailwindcss/oxide`, `lightningcss` (también la anidada en `vite`), `@rolldown/binding` y `@parcel/watcher`. `npm ci` en Alpine instala la correcta para cada arquitectura; no hace falta regenerar el lockfile ni agregar `libc6-compat`. Se verifica en T2 (CA-9).
- H-2. **Las pruebas dependen del CSS compilado:** `tests/unit/landing-dom.test.js` lee `public/css/<negocio>/main.css` y `tests/integration/app.test.js` pide `/css/molotes/main.css` y `/css/birria/main.css`. Por eso `test` debe partir de `build` (no de `deps`), lo que además cumple D-5.
- H-3. **Tailwind es determinista dentro del contenedor:** las tres hojas usan `@import "tailwindcss" source(none)` con `@source` explícitos, así que la ausencia de `.git`/`.gitignore` en la imagen no cambia qué archivos se escanean.
- H-4. **Zona horaria y locale:** la app usa `BUSINESS_TIMEZONE` (no `TZ`) y las pruebas fijan la hora con `vi.setSystemTime` y `VALID_ENV.BUSINESS_TIMEZONE`. El binario de Node de las imágenes oficiales incluye ICU completo (`Intl` con `es-MX` y zonas IANA), por lo que no se necesitan `tzdata` ni paquetes de locale. Los tests de permisos (`EACCES`) usan mocks, no permisos reales, así que no cambian al ejecutarse como root. No se detectaron pruebas dependientes de red (los `https://` son literales). Si alguna falla en UTC, se corrige según el punto 5 del Action Plan.
- H-5. **Snapshots de archivo:** `landing-snapshot.test.js` usa `toMatchFileSnapshot`. En la etapa `test` se define `CI=true` para que Vitest nunca escriba un snapshot ausente y falle en su lugar (resultado honesto).
- H-6. **Imagen obsoleta con `docker compose run`:** con el código horneado (D-4), `docker compose run --rm test` reutilizaría una imagen ya construida aunque el código haya cambiado. Se mitiga con `pull_policy: build` en el servicio (fuerza el build en cada ejecución, que es casi instantáneo gracias a la caché, CA-4). Si en T2 se comprueba que la versión de Compose no lo respeta en `run`, el README documentará `docker compose run --build --rm test` y se informará antes de cerrar.
- H-7. **Healthcheck (decisión del usuario, 2026-10-02):** se incluye `HEALTHCHECK` en `production` con el `wget` de busybox contra `http://127.0.0.1:${PORT:-3000}/` (sin endpoints nuevos en la app). Cada comprobación genera una línea `request` en el log; queda documentado en el README.
- H-8. **Docker local:** cliente Docker 29.6.1 y Compose v5.3.0 instalados (darwin/arm64), pero el daemon no está corriendo. Docker Desktop debe estar iniciado para T2.
- H-9. **Línea suelta del README (decisión del usuario, 2026-10-02):** se elimina la línea `# restaurant` del final de `README.md`.
- H-10. **Hallado en T2: pruebas dependientes del entorno del host** (punto 5 del Action Plan):
  - `tests/unit/config.test.js` esperaba que `DATA_DIR` por defecto terminara en `restaurante/data` (nombre de la carpeta clonada). Se compara con `join(PROJECT_DIR, 'data')`: valida lo mismo (carpeta `data/` del proyecto) sin depender del nombre de la carpeta.
  - `tests/unit/content.test.js` lee `../_stich_source_/<diseño>/code.html`, fuera de `restaurante/`. Sin tocar la prueba, compose pasa `../_stich_source_` como contexto adicional `design` y la etapa `test` copia solo los `*/code.html` a `/_stich_source_/`. No entra en `production` (que no necesita ese contexto para construirse).
- H-11. **Hallado en T2: Compose interpola el `.env` local.** Compose lee `restaurante/.env` solo para interpolar (no lo pasa al contenedor), pero un `ADMIN_PASSWORD_HASH` sin comillas hace que muestre avisos `variable is not set` con fragmentos del hash. Mitigación documentada en el README: escribir el hash entre comillas simples (Node lo lee igual; verificado) o usar `COMPOSE_DISABLE_ENV_FILE=true`. No se modifica el `.env` local. A petición del usuario (2026-10-02), `.env.example` indica escribir `ADMIN_PASSWORD_HASH` entre comillas simples.

### Archivos o componentes afectados

- Nuevo: `restaurante/Dockerfile`.
- Nuevo: `restaurante/.dockerignore`.
- Nuevo: `restaurante/compose.yaml`.
- Modificado: `restaurante/README.md` (sección `## Docker`, mención en `## Requisitos`, archivos Docker en `## Estructura` y eliminación de la línea suelta `# restaurant`).
- Modificado: `restaurante/tests/unit/config.test.js` (H-10).
- Modificado: `restaurante/.env.example` (comentario sobre comillas simples en `ADMIN_PASSWORD_HASH`, H-11).
- Sin cambios: `src/`, `public/`, `package.json`, `package-lock.json`.

### Cambios requeridos

1. **`.dockerignore`** (R-2, CA-8):
   - `node_modules`, `**/node_modules`;
   - `.env`, `**/.env`, `.env.*`, `**/.env.*`, `!.env.example`;
   - `data` (la carpeta raíz de datos editables);
   - `coverage`, `*.log`, `npm-debug.log*`;
   - `.git`, `.gitignore`;
   - `.DS_Store`, `**/.DS_Store`, `.vscode`, `.idea`, `*.swp`, `Thumbs.db`;
   - `public/css/*/` (CSS generado localmente: la imagen siempre lo compila en `build`; se conserva `public/css/.gitkeep`);
   - `Dockerfile`, `compose.yaml`, `.dockerignore` (no los necesita la imagen; cambiar el compose no invalida la caché).
2. **`Dockerfile`** (`# syntax=docker/dockerfile:1`):
   - `base`: `FROM node:24-alpine AS base`, `WORKDIR /app`.
   - `deps`: `FROM base`; `COPY package.json package-lock.json ./`; `RUN npm ci --no-audit --no-fund` (todas las dependencias). Solo depende del manifiesto y del lockfile (CA-4).
   - `build`: `FROM deps`; `COPY . .`; `RUN npm run build:css` (genera `public/css/{molotes,birria,admin}/main.css`; si Tailwind falla, el build de la imagen falla).
   - `test`: `FROM build`; `COPY --from=design --parents */code.html /_stich_source_/` (H-10); `ENV NODE_ENV=test CI=true`; `CMD ["npm", "test"]` (`npm` propaga el código de salida de `vitest run`). Se ejecuta como root: el contenedor es efímero, sin red ni puertos, y así Vitest puede escribir su caché en `node_modules/.vite`.
   - `production`: `FROM base`; `ENV NODE_ENV=production PORT=3000`; `COPY package.json package-lock.json ./`; `RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force` (capa cacheable, sin devDependencies); `COPY --from=build /app/src ./src`; `COPY --from=build /app/public ./public`; `RUN mkdir -p /var/lib/restaurante && chown node:node /var/lib/restaurante && chmod 700 /var/lib/restaurante`; `USER node`; `EXPOSE 3000`; `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/" || exit 1` (H-7); `CMD ["node", "src/server.js"]` (forma exec: Node es PID 1 y `src/server.js` ya maneja `SIGTERM`/`SIGINT`).
   - No se definen `DATA_DIR`, `WHATSAPP_*`, `ADMIN_*` ni `TRUST_PROXY` en la imagen (RN-1, RN-2, CA-7). `/var/lib/restaurante` solo es el punto de montaje sugerido: al montar un volumen con nombre ahí, hereda el dueño `node` y el modo `700`.
   - El código (`src/`, `public/`, `node_modules`) queda propiedad de root y solo lectura para `node` (menor privilegio).
   - `tests/`, `scripts/`, `.env.example` y `README.md` no se copian a `production`.
3. **`compose.yaml`** (R-3, R-4):
   ```yaml
   services:
     test:
       build:
         context: .
         target: test
         additional_contexts:
           design: ../_stich_source_
       image: restaurante:test
       pull_policy: build
       network_mode: none
   ```
   Sin `env_file`, `environment`, `ports` ni `volumes` (D-4). `network_mode: none` garantiza que las pruebas no usan la red (el build sí la usa para `npm ci`).
4. **`README.md`** (R-6): en `## Requisitos`, una línea que indique que Docker es opcional. Nueva sección `## Docker` tras `## Scripts` con:
   - qué contiene cada etapa y que `test` y `production` comparten `base`, y `test` reutiliza `deps` y `build`;
   - pruebas: `docker compose run --rm test` (y el código de salida);
   - producción: `docker build --target production -t restaurante:prod .` y un `docker run` de ejemplo con `-e WHATSAPP_MOLOTES=… -e WHATSAPP_BIRRIA=… -e DATA_DIR=/var/lib/restaurante -v restaurante-data:/var/lib/restaurante -p 3000:3000` (o `--env-file .env` en tiempo de ejecución, nunca en el build);
   - que en un bind mount del host la carpeta debe ser escribible por el UID 1000 (`node`);
   - que el contenedor usa UTC y que eso no afecta la selección de landing (`BUSINESS_TIMEZONE`);
   - que `node:24-alpine` es flotante dentro de la versión 24;
   - que el despliegue actual en la VM no cambia y que las instrucciones sin Docker siguen vigentes;
   - el `HEALTHCHECK` (H-7), el contexto adicional `design` (H-10) y la interpolación del `.env` por Compose (H-11);
   - los archivos Docker en `## Estructura` y la eliminación de la línea suelta `# restaurant` (H-9).

### Backend

Sin cambios de código. La validación de `src/config/env.js` se reutiliza tal cual en el contenedor (CA-7).

### Contenido / configuración

La configuración se inyecta solo en tiempo de ejecución (`-e`/`--env-file`). Ningún `ARG`/`ENV` del Dockerfile contiene secretos.

### Validaciones

Verificación en T2 (requiere Docker Desktop iniciado), desde `restaurante/`:

| CA | Verificación |
| --- | --- |
| CA-1 | `docker compose run --rm test; echo $?` -> todas las pruebas pasan y `0`. |
| CA-2 | Crear temporalmente `tests/unit/zz-falla-a-proposito.test.js` con `expect(1).toBe(2)`, repetir el comando (debe reconstruir por `pull_policy: build`) -> código distinto de `0`; borrar el archivo y comprobar con `git status` que no queda rastro. |
| CA-3 | `grep -c '^FROM node:24-alpine\|^FROM base\|^FROM deps\|^FROM build' Dockerfile`; `docker run --rm restaurante:test node --version` y `docker run --rm restaurante:prod node --version` -> `v24.x`. |
| CA-4 | Tocar un archivo de `src/` (cambio temporal) y reconstruir `docker build --target test --progress=plain .` -> el paso `npm ci` aparece `CACHED`; revertir el cambio. |
| CA-5 | `docker run --rm --entrypoint sh restaurante:prod -c '…'` para comprobar que no existen `node_modules/{vitest,jsdom,supertest,tailwindcss,@tailwindcss/cli}`, ni `.env` ni `data/`; que existen `public/css/{molotes,birria,admin}/main.css`; y que `id -u` no es `0`. |
| CA-6 | `docker volume create restaurante-data-qa` y `docker run -d` con `WHATSAPP_MOLOTES`, `WHATSAPP_BIRRIA` (números ficticios), `DATA_DIR=/var/lib/restaurante` y el volumen; `curl` a `/` (200) y `/css/molotes/main.css` (200); `docker exec … ls /var/lib/restaurante/{molotes,birria}` muestra `current.json`; limpiar contenedor y volumen. |
| CA-7 | `docker run --rm restaurante:prod; echo $?` -> `1` y lista de problemas; repetir con WhatsApp pero sin `DATA_DIR` -> `1`; comprobar que la salida no contiene los valores ficticios. |
| CA-8 | Con `.env` y `data/` locales presentes (ya existen), comprobar con `docker run --rm --entrypoint sh` que `/app/.env` y `/app/data` no existen en `restaurante:test` ni en `restaurante:prod`. |
| CA-9 | arm64 nativo (CA-1). amd64: `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test` y `docker build --platform linux/amd64 --target production .` (emulación de Docker Desktop). |
| Healthcheck | Contenedor `production` con configuración válida -> `docker inspect -f '{{.State.Health.Status}}'` = `healthy` (también con `PORT` distinto de 3000). |
| CA-10 | Revisar la sección del README y ejecutar `npm test` y `npm run build:css` fuera de Docker. |

También: `npm run lint` (placeholder, se reportará como "lint no configurado") y `git diff`/`git status` para confirmar que solo cambian los cuatro archivos del alcance.

### Manejo de errores

- Fallo de `npm ci` o de Tailwind -> el build de la imagen falla con código distinto de 0.
- Fallo de pruebas -> `docker compose run` devuelve el código de `vitest run`.
- Configuración inválida en `production` -> el proceso termina con código 1 (comportamiento existente de `src/server.js`).
- `DATA_DIR` sin permisos de escritura -> el proceso termina con código 1 y el mensaje existente; el README explica el UID 1000.

### Testing

No se agregan pruebas de Vitest: el cambio es de infraestructura y se verifica con los comandos de la tabla anterior. La suite existente se ejecuta completa dentro (CA-1, CA-9) y fuera (CA-10) de Docker. Si alguna prueba depende de la zona horaria del host, se hará determinista sin cambiar lo que valida (Action Plan, punto 5) y se informará.

### Seguridad

- Ningún secreto ni dato en el contexto de build ni en las imágenes (`.dockerignore`, sin `ENV` sensibles).
- `production` como usuario `node` (UID 1000), código propiedad de root, sin devDependencies y con caché de npm limpia.
- Las pruebas se ejecutan sin red (`network_mode: none`).
- CSP, cabeceras y validaciones de la app no cambian.

### Performance

- Caché de capas: `npm ci` depende solo de `package*.json` (CA-4); en `production`, la capa de dependencias tampoco se invalida por cambios de código.
- `.dockerignore` reduce el contexto (sin `node_modules`, `.git` ni datos).

### Riesgos técnicos

- R-T1. Base flotante `node:24-alpine`: una actualización puede cambiar el entorno entre builds (aceptado en D-7; documentado).
- R-T2. Emulación amd64 en Apple Silicon (QEMU/Rosetta) más lenta o inestable; si falla por la emulación y no por la imagen, se reportará con evidencia.
- R-T3. `pull_policy: build` con `docker compose run`: se verifica en T2 (H-6).
- R-T4. Bind mounts de `DATA_DIR` en Linux con un dueño distinto del UID 1000 fallan al arrancar (fail fast existente); documentado.
- R-T5. Se necesita Docker Desktop corriendo para verificar los CA (H-8).

### Orden de implementación

1. `.dockerignore`.
2. `Dockerfile`: `base`, `deps`, `build`, `test`.
3. `compose.yaml`; verificar CA-1 a CA-4, CA-8 (test) y CA-9.
4. `Dockerfile`: `production`; verificar CA-3, CA-5 a CA-8.
5. README (R-6) y CA-10.
6. Revisión final de `git diff` y `git status`.

### Criterios de finalización

- CA-1 a CA-10 verificados con la salida real de los comandos.
- Solo cambian los archivos de "Archivos o componentes afectados".
- `npm test` pasa dentro y fuera de Docker; lint reportado como no configurado.
- Sin contenedores, volúmenes ni archivos temporales de verificación remanentes.

## Implementation Result

### Rama

`feature/REQ-F-003-dockerizacion-node24-alpine` (desde `main` actualizado, `d644316`). Sin commits (T2).

### Cambios realizados

- `restaurante/Dockerfile`: etapas `base`, `deps`, `build`, `test` y `production` sobre `node:24-alpine`; `test` copia los `code.html` del diseño desde el contexto `design`; `production` sin devDependencies, usuario `node`, `/var/lib/restaurante` (dueño `node`, 700), `EXPOSE 3000`, `HEALTHCHECK` con `wget` y `CMD ["node","src/server.js"]`.
- `restaurante/.dockerignore`: excluye `node_modules`, `.env*` (salvo `.env.example`), `data`, CSS generado, cobertura, logs, `.git`, archivos de editor/SO y los propios archivos Docker.
- `restaurante/compose.yaml`: servicio `test` (target `test`, contexto adicional `design`, `pull_policy: build`, `network_mode: none`).
- `restaurante/README.md`: Docker opcional en Requisitos, sección `## Docker` (etapas, pruebas, producción, `DATA_DIR`, healthcheck, avisos de Compose con `.env`), archivos Docker en Estructura y línea suelta `# restaurant` eliminada.
- `restaurante/tests/unit/config.test.js`: aserción de `DATA_DIR` por defecto independiente del nombre de la carpeta (H-10).
- `restaurante/.env.example`: indica escribir `ADMIN_PASSWORD_HASH` entre comillas simples (H-11; pedido por el usuario al aprobar la implementación). Sin valores reales.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `docker compose run --rm test` -> `Test Files 25 passed (25)`, `Tests 468 passed (468)`, código 0. (La primera ejecución falló con 3 pruebas dependientes del host; corregido según H-10.) |
| CA-2 | Cumple | Con `tests/unit/zz-falla-a-proposito.test.js` temporal: `1 failed / 468 passed`, código 1. El archivo se borró; `git status` sin rastro. Confirma además que `pull_policy: build` reconstruye en `run`. |
| CA-3 | Cumple | Todos los `FROM` derivan de `node:24-alpine`; `node --version` = `v24.21.0` en `restaurante:test` y `restaurante:prod`. |
| CA-4 | Cumple | Con un cambio temporal en `src/utils/logger.js` (revertido): `[deps 2/2] RUN npm ci --no-audit --no-fund` -> `CACHED`; solo se repite `build:css`. |
| CA-5 | Cumple | En `restaurante:prod`: ausentes `vitest`, `jsdom`, `supertest`, `tailwindcss`, `@tailwindcss/cli`, `@tailwindcss/forms`, `.env`, `data`, `tests`, `scripts`; presentes `public/css/{admin,birria,molotes}/main.css`; `uid=1000 user=node`; `touch /app/x` -> Permission denied. |
| CA-6 | Cumple | Volumen `restaurante-data-qa` en `/var/lib/restaurante`: `GET /` 200 (`<title>Moloteando…`, viernes en CDMX), `GET /css/molotes/main.css` 200 `text/css`; `molotes/` y `birria/` con `current.json` y `previous.json` (dueño `node`, 600); logs `menu_data_seeded` y `server_started` (`nodeEnv: production`). `docker stop` -> `server_stopping` SIGTERM, código 0. |
| CA-7 | Cumple | Sin variables: lista de 3 problemas, código 1. Con WhatsApp y sin `DATA_DIR`: código 1, la salida no contiene los valores ficticios. `DATA_DIR=data` (relativa): código 1. |
| CA-8 | Cumple | Con `.env` y `data/` locales presentes, `/app/.env` y `/app/data` no existen en `restaurante:test` ni en `restaurante:prod`. |
| CA-9 | Cumple | arm64 nativo (CA-1). amd64: `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test` -> 468/468, código 0 (`uname -m` = `x86_64`); `docker build --platform linux/amd64 --target production` OK (Node v24.21.0, UID 1000, CSS presente). |
| CA-10 | Cumple | Sección `## Docker` en el README; fuera de Docker `npm run build:css` OK y `npm test` -> 468/468. |
| Healthcheck | Cumple | `production` -> `healthy` (ExitCode 0 del `wget`); con `PORT=8080` también `healthy`. |

### Validaciones ejecutadas

- `docker compose run --rm test` (arm64): 25 archivos, 468 pruebas, código 0.
- `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test`: 468/468, código 0.
- `docker build --target production -t restaurante:prod .` y su variante amd64: OK.
- `docker compose config -q`: OK (con avisos de interpolación del `.env` local, ver H-11).
- `npm run build:css`: OK. `npm test`: 25 archivos, 468 pruebas, OK.
- `npm run lint`: lint no configurado (placeholder).
- Tras el ajuste de `.env.example`: `npm test` -> 25 archivos, 468 pruebas, OK; `docker compose config -q` OK; un `.env` copiado de `.env.example` no produce avisos de interpolación en Compose.
- Limpieza: sin contenedores ni volúmenes `restaurante*` remanentes; quedan las imágenes locales `restaurante:test` y `restaurante:prod`.

### Archivos afectados

- `restaurante/Dockerfile` (nuevo)
- `restaurante/.dockerignore` (nuevo)
- `restaurante/compose.yaml` (nuevo)
- `restaurante/README.md`
- `restaurante/tests/unit/config.test.js`
- `restaurante/.env.example`
- `.claude/docs/in-progress/REQ-F-003-dockerizacion-node24-alpine.md` (movido desde `backlog/`; estaba sin versionar, por eso se movió con `mv` y no con `git mv`)

### Riesgos o pendientes

- H-11: el `.env` local actual tiene `ADMIN_PASSWORD_HASH` sin comillas, así que Compose muestra avisos con fragmentos del hash (no el hash completo ni la contraseña; el valor no entra al contenedor). Recomendación: poner el hash entre comillas simples en el `.env` local (el agente no modifica el `.env` del usuario). `.env.example` ya lo indica.
- `docker build --target test` sin compose requiere `--build-context design=../_stich_source_` (documentado).
- Imagen `test` como root (efímera, sin red); `production` como `node`.
- Base flotante `node:24-alpine` (D-7).

## QA Action Plan

### Objetivo

Validar con evidencia de comandos reales que la dockerización (targets `test` y `production` sobre `node:24-alpine`, `.dockerignore`, `compose.yaml` y README) cumple CA-1 a CA-10 y el healthcheck (H-7), que no introduce secretos ni datos en las imágenes y que no hay regresión en la app ni en la suite fuera de Docker.

### Requisito bajo prueba

R-1 a R-6, RN-1 a RN-3, D-1 a D-8, H-7 (healthcheck), H-10 (cambio en `tests/unit/config.test.js` y contexto `design`) y H-11 (comentario en `.env.example`).

### Reglas de ejecución (entorno)

- Todos los comandos de Compose se ejecutan desde `restaurante/` con `COMPOSE_DISABLE_ENV_FILE=true` para que el `.env` local no se interpole ni aparezcan fragmentos de `ADMIN_PASSWORD_HASH` en la salida. El `.env` local no se modifica ni se lee, y nunca se usa `--env-file .env` en las pruebas: solo valores ficticios por `-e`.
- Las imágenes y recursos que cree QA usan etiquetas/nombres propios (`restaurante:qa-test`, `restaurante:qa-prod`, `restaurante:qa-prod-amd64`, contenedores y volúmenes `restaurante-qa-*`) y se eliminan al terminar. Las imágenes `restaurante:test`/`restaurante:prod` existentes se reconstruyen desde cero (`--no-cache` en la primera construcción) para no validar artefactos previos del desarrollador.
- Los cambios temporales (prueba que falla a propósito, cambio en `src/`) se revierten y se comprueba con `git status` y `git diff` que no quedan rastros.
- Limitación conocida de CA-1: el equipo tiene Node instalado; se valida que el flujo no usa el Node del host (todo corre en el contenedor, `node --version` dentro = `v24.x`, `network_mode: none`), lo que se considera evidencia suficiente de "sin Node".

### Criterios de aceptación

| CA | Pruebas |
| --- | --- |
| CA-1 | F-1 |
| CA-2 | N-1 |
| CA-3 | F-2 |
| CA-4 | F-3 |
| CA-5 | S-1, S-2 |
| CA-6 | F-4, F-5 |
| CA-7 | N-2, N-3, N-4 |
| CA-8 | S-3, S-4 |
| CA-9 | F-6 |
| CA-10 | D-1, R-1, R-2 |
| Healthcheck (H-7) | F-7, F-8 |

### Riesgos identificados

- Imagen obsoleta: `docker compose run` sin reconstrucción validaría código viejo (mitigado con `pull_policy: build`; se verifica en N-1).
- Fuga de secretos: `.env`/`data/` en el contexto de build, en capas intermedias o en `ENV`/`history` de la imagen.
- `COPY --from=design --parents` requiere la sintaxis de Dockerfile 1.7+; `# syntax=docker/dockerfile:1` la descarga de la red al construir.
- `production` con devDependencies o ejecutándose como root.
- Permisos de `DATA_DIR` (volumen con nombre hereda `node:node 700`); bind mount con otro UID debe fallar de forma controlada (código 1).
- El cambio en `config.test.js` podría debilitar la aserción original.
- Pruebas dependientes de TZ/locale del host que pasen en macOS y fallen en UTC (o viceversa).
- Healthcheck con `PORT` distinto de 3000.
- Emulación amd64 lenta o inestable (R-T2): un fallo por emulación se reporta como bloqueo de entorno, no como defecto.

### Pruebas funcionales

- F-1 (CA-1): `COMPOSE_DISABLE_ENV_FILE=true docker compose build --no-cache test` y luego `COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test; echo "exit=$?"`. Esperado: 25 archivos y 468 pruebas pasan (o el total actual, igual al de fuera de Docker), `exit=0`. Comprobar con `docker ps -a` que no queda contenedor huérfano.
- F-2 (CA-3): todas las líneas `FROM` del Dockerfile derivan de `node:24-alpine`; `docker run --rm restaurante:test node --version` y `docker run --rm --entrypoint node restaurante:qa-prod --version` devuelven `v24.x`; `cat /etc/alpine-release` confirma Alpine en ambas.
- F-3 (CA-4): cambio temporal en un archivo de `src/` y `docker build --target test --build-context design=../_stich_source_ --progress=plain .` -> el paso `npm ci` de `deps` y el `npm ci --omit=dev` de `production` aparecen `CACHED`; revertir. Complemento: un cambio temporal en `package.json` (solo `description`) sí invalida `npm ci` (comprueba que la caché depende del manifiesto); revertir.
- F-4 (CA-6): `docker build --target production -t restaurante:qa-prod .`; volumen `restaurante-qa-data`; `docker run -d -p 3100:3000` con `WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA` ficticios y `DATA_DIR=/var/lib/restaurante`. `curl` a `/`, `/molotes`, `/birria` (200, `<title>` del negocio correspondiente; `/` acorde al día en `America/Mexico_City`), `/css/molotes/main.css`, `/css/birria/main.css` (200, `text/css`), un recurso de `public/img` y un favicon (200). `ls -l` del volumen: `molotes/` y `birria/` con `current.json`; log `menu_data_seeded`.
- F-5 (CA-6, variante): segundo arranque con el mismo volumen no vuelve a sembrar (sin `menu_data_seeded`) y conserva los datos; arranque con `WHATSAPP_MOLOTES_URL`/`WHATSAPP_BIRRIA_URL` en lugar de números -> 200 y `href` del CTA con la URL configurada.
- F-6 (CA-9): `DOCKER_DEFAULT_PLATFORM=linux/amd64 COMPOSE_DISABLE_ENV_FILE=true docker compose run --rm test` (pruebas pasan, `uname -m` = `x86_64`) y `docker build --platform linux/amd64 --target production -t restaurante:qa-prod-amd64 .` + arranque con `node --version` y `GET /` 200.
- F-7 (healthcheck): contenedor de F-4 -> `docker inspect -f '{{.State.Health.Status}}'` llega a `healthy`; el log muestra las líneas `request` del healthcheck.
- F-8 (healthcheck): `-e PORT=8080 -p 3101:8080` -> `healthy` y `GET /` 200 en 3101. Además, `docker image inspect` confirma la configuración del `Healthcheck` (intervalo 30 s, timeout 5 s, start-period 10 s, retries 3). Caso negativo: un contenedor de `restaurante:qa-prod` cuyo comando no arranca la app (`--entrypoint sleep ... 300`, con el healthcheck heredado) pasa a `unhealthy` (se acorta con `--health-interval=2s --health-retries=1 --health-start-period=0s` para no esperar 90 s).
- F-9 (apagado): `docker stop` del contenedor de F-4 -> log `server_stopping` con `SIGTERM` y `ExitCode` 0 en menos del tiempo de gracia.

### Pruebas negativas y casos límite

- N-1 (CA-2): crear temporalmente `tests/unit/zz-qa-falla.test.js` con `expect(1).toBe(2)`, repetir F-1 sin reconstruir manualmente -> se reconstruye (`pull_policy: build`), 1 prueba falla, `exit` distinto de 0. Borrar el archivo y verificar `git status`.
- N-2 (CA-7): `docker run --rm restaurante:qa-prod; echo $?` sin variables -> `1` y lista de problemas.
- N-3 (CA-7): con WhatsApp ficticios y sin `DATA_DIR` -> `1`; con `DATA_DIR=data` (relativa) -> `1`; con `DATA_DIR=/app/src/x` (dentro de `src/`) -> `1`. Comprobar con `grep` que la salida no contiene los valores ficticios inyectados.
- N-4 (CA-7 / R-T4): `DATA_DIR` sobre un bind mount de una carpeta temporal del scratchpad no escribible por UID 1000 (o `--user` con `--tmpfs` de solo lectura) -> termina con código 1 y mensaje controlado, sin stack trace con valores.
- N-5 (snapshots, H-5): confirmar `CI=true` y `NODE_ENV=test` en `docker image inspect restaurante:test` (`Config.Env`); con un snapshot de `tests/snapshots` renombrado temporalmente (revertido), la suite en el contenedor falla en lugar de escribirlo.
- N-6 (build sin compose): `docker build --target test .` sin `--build-context design` falla de forma clara (documentado en el README), y con `--build-context design=../_stich_source_` funciona.
- N-7 (TZ): `docker run --rm restaurante:test date` y `node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"` -> UTC; la suite pasa en ese entorno (F-1). `Intl` con `es-MX` y `America/Mexico_City` funciona en el contenedor (`node -e` con `toLocaleString`).
- N-8 (re-ejecución): repetir F-1 dos veces seguidas: sin contenedores huérfanos ni imágenes colgantes adicionales del servicio.

### Pruebas de seguridad (secretos e imágenes)

- S-1 (CA-5): en `restaurante:qa-prod` (`--entrypoint sh`): no existen `node_modules/{vitest,jsdom,supertest,tailwindcss,@tailwindcss/cli,@tailwindcss/forms}`; `npm ls --omit=dev` coincide con las `dependencies` de `package.json`; existen `public/css/{molotes,birria,admin}/main.css`; no existen `tests/`, `scripts/`, `.env*`, `data/`, `README.md`.
- S-2 (CA-5): `id` -> `uid=1000(node)`; `docker image inspect` -> `Config.User=node`; `touch /app/x` y `touch /app/src/x` fallan; `/var/lib/restaurante` dueño `node`, modo `700`.
- S-3 (CA-8): con `.env` y `data/` locales presentes, `find / -xdev \( -name '.env' -o -name '.env.*' \) -not -path '/proc/*'` en `restaurante:test` y `restaurante:qa-prod` -> solo `.env.example` en `test` (permitido) y nada en `production`; `/app/data` no existe en ninguna.
- S-4 (CA-8 / RN-1): `docker image inspect` (`Config.Env`) y `docker history --no-trunc` de ambas imágenes no contienen `WHATSAPP_`, `ADMIN_`, `DATA_DIR` ni `TRUST_PROXY`. Para el contexto de build: crear temporalmente `restaurante/.env.qa-sentinel` y `restaurante/data/qa-sentinel` con contenido ficticio, construir y verificar que no aparecen en la imagen; borrarlos.
- S-5 (pruebas sin red): `docker run --rm --network none` implícito por compose; verificar en `docker compose config` (`network_mode: none`) y que la suite pasa así (F-1).

### Pruebas de regresión

- R-1 (CA-10): fuera de Docker, desde `restaurante/`: `npm run build:css` y `npm test` -> todo pasa con el mismo total que dentro de Docker.
- R-2 (H-10): revisar que la nueva aserción de `config.test.js` sigue validando el valor por defecto: `PROJECT_DIR` ya se exportaba en `main` (sin cambio en `src/`) y equivale a la raíz de `restaurante/`; la aserción `join(PROJECT_DIR, 'data')` es igual o más estricta que la expresión regular anterior. Comprobación de mutación temporal (no versionada, revertida): cambiar en una copia local el valor esperado a `join(PROJECT_DIR, 'datos')` y verificar que la prueba falla. Confirmar con `git diff main -- src public package.json package-lock.json` que no hay cambios de producción (RN-3).
- R-3 (`.env.example`, H-11): la app arranca localmente con un `.env` de prueba en el scratchpad que usa `ADMIN_PASSWORD_HASH='scrypt$...'` entre comillas simples (hash generado con `npm run admin:hash-password` para una contraseña ficticia) y la administración queda habilitada; `COMPOSE_DISABLE_ENV_FILE` no es necesario con ese formato (`docker compose --env-file <copia> config -q` sin avisos). No se usa el `.env` real.
- R-4: `git status`/`git diff --stat` final: solo los 6 archivos del alcance más el ticket; sin archivos temporales de QA.
- R-5: `npm run lint` se ejecuta solo para registrar que es un placeholder (no cuenta como evidencia).

### Pruebas en navegador (regresión mínima de la imagen `production`)

Sin cambios de UI; se valida solo que la landing servida por la imagen funciona igual:

- Con el contenedor de F-4 (puerto 3100): `/molotes` y `/birria` en 375x812 y 1440x900: CSS aplicado, imágenes cargadas, sin overflow horizontal, sin errores en consola (incluida CSP) ni requests fallidas.
- CTA de WhatsApp en ambas: `href` con el número ficticio y `text` codificado, `target`/`rel` correctos (sin seguir el enlace).
- Si la extensión no responde tras 2-3 intentos: queda como revisión manual; no bloquea la aprobación porque ningún CA depende exclusivamente del navegador (CA-6 se cubre con `curl`).

### Documentación

- D-1 (CA-10, R-6): el README contiene cómo construir la imagen, ejecutar pruebas con compose, construir y ejecutar `production`, y que el despliegue en la VM no cambia; las instrucciones sin Docker siguen presentes. Se ejecutan literalmente los comandos documentados (`docker compose run --rm test`, `docker build --target test --build-context ...`, `docker build --target production ...` y el `docker run` de ejemplo con nombres QA) para comprobar que funcionan como están escritos. Enlaces internos `#docker` y `#seguridad` resuelven a encabezados existentes. La línea suelta `# restaurant` ya no existe (H-9).

### Pruebas de performance

- Tamaño de `restaurante:qa-prod` frente a `restaurante:test` (`docker image ls`): `production` debe ser notablemente menor (sin devDependencies); se registra el valor, sin umbral (no definido en el requisito).
- Tiempo de reconstrucción con caché en F-3 (solo informativo).

### Pruebas automatizadas

No se crean ni modifican pruebas versionadas. Se ejecuta la suite existente dentro (arm64 y amd64) y fuera de Docker. Las pruebas temporales de N-1 y R-2 no se versionan y se eliminan.

### Evidencia requerida

Salida (resumida) de cada comando con su código de salida; `docker inspect`/`history` filtrados; listados de archivos de las imágenes; `git status` final. Ninguna salida incluirá el contenido del `.env` local ni fragmentos de `ADMIN_PASSWORD_HASH`.

### Criterios de aprobación

- CA-1 a CA-10 y el healthcheck en PASS con evidencia.
- Ningún secreto ni dato en imágenes, `ENV` o historial (S-1 a S-4).
- `npm test` pasa dentro (arm64 y amd64) y fuera de Docker.
- Sin cambios en `src/`, `public/`, `package*.json`; sin defectos `BLOCKER`/`CRITICAL`; `MAJOR` solo con decisión del usuario.
- Limpieza completa de contenedores, volúmenes, imágenes QA y archivos temporales.

## QA Report

### Ronda

1 (2026-10-02). QA Action Plan aprobado por el usuario (cita: "Si").

### Pruebas ejecutadas

Entorno: Docker 29.6.1 (arm64, Docker Desktop), rama `feature/REQ-F-003-dockerizacion-node24-alpine`. Todos los comandos de Compose con `COMPOSE_DISABLE_ENV_FILE=true` (0 avisos de interpolación en las salidas de QA). El `.env` real no se leyó ni se modificó; solo se usaron valores ficticios.

| ID | Comando / acción | Resultado |
| --- | --- | --- |
| R-1 | `npm run build:css`; `npm test` (fuera de Docker) | OK; 25 archivos, 468 pruebas pasan |
| R-5 | `npm run lint` | Placeholder ("pendiente de configurar"); no cuenta como evidencia |
| F-1 | `docker compose build --no-cache test`; `docker compose run --rm test` | build 0; 25/25 archivos, 468/468 pruebas; exit 0; 0 contenedores remanentes |
| F-2 | `FROM` del Dockerfile; `node --version`, `/etc/alpine-release` en `test` y `production` | `base` = `node:24-alpine`, resto deriva de `base`; v24.21.0 y Alpine 3.24.2 en ambas |
| F-3 | Cambio temporal en `src/utils/logger.js` + build `test` y `production` (`--progress=plain`) | `[deps 2/2] RUN npm ci` CACHED y `[production 2/5] RUN npm ci --omit=dev` CACHED; solo se repiten `COPY . .`/`build:css`. Contraprueba: cambio temporal en `package.json` -> ambos `npm ci` se reejecutan (DONE 7.7 s / 2.0 s). Revertido |
| N-1 | Prueba temporal `tests/unit/zz-qa-falla.test.js` (`expect(1).toBe(2)`) + `docker compose run --rm test` | exit 1, la prueba nueva aparece como FAIL (confirma reconstrucción por `pull_policy: build`). Archivo borrado |
| F-4 | `production` (`--no-cache`) con volumen `restaurante-qa-data`, WhatsApp ficticios, `DATA_DIR=/var/lib/restaurante`, puerto 3100 | `/`, `/molotes`, `/birria` 200 (`/` = Moloteando, viernes 20:46 en CDMX); CSS molotes/birria/admin 200 `text/css`; logo webp y favicons 200; `molotes/` y `birria/` con `current.json`/`previous.json` (node:node, 600; carpeta 700); logs `menu_data_seeded` x2 |
| F-5 | Segundo arranque con el mismo volumen y `WHATSAPP_*_URL` | 0 `menu_data_seeded` (no resiembra); CTA `href` = URL configurada en cada landing; 200 |
| F-7 | `docker inspect` health + `image inspect` | `healthy` (ExitCode 0); Healthcheck: 30 s / 5 s / start 10 s / 3 reintentos |
| F-8 | `PORT=8080 -p 3101:8080`; contenedor con `--entrypoint sleep` y health acortado | `healthy` y `GET /` 200; caso negativo -> `unhealthy` |
| F-9 | `docker stop` | log `server_stopping` SIGTERM; ExitCode 0 |
| N-2 | `docker run --rm` sin variables | exit 1; 3 problemas listados |
| N-3 | sin `DATA_DIR`; `DATA_DIR=data`; `DATA_DIR=/app/src/x` | exit 1 en los tres con el mensaje correspondiente; 0 apariciones de los valores ficticios |
| N-4 | `DATA_DIR` en tmpfs de root (0755) no escribible por UID 1000 | exit 1; `menu_repository_init_failed` `EACCES` + mensaje controlado; sin stack trace ni valores |
| N-5 | `image inspect restaurante:test`; snapshot renombrado temporalmente | Env `NODE_ENV=test`, `CI=true`; la suite falla (2 snapshots mismatched, exit 1) en lugar de escribirlo. Restaurado |
| N-6 | `docker build --target test .` sin `--build-context design` | exit 1 (ver OBS-1) |
| N-7 | `date`, `Intl` en el contenedor | UTC; `es-MX` + `America/Mexico_City` correctos (sábado 05:59 UTC -> "viernes 11:59 p.m.") |
| N-8 | Dos `docker compose run --rm test` seguidos | 468/468 y exit 0 ambos (8.99 s y 8.38 s con caché); 0 contenedores remanentes |
| S-1 | Contenido de `production` | ausentes vitest, jsdom, supertest, tailwindcss, @tailwindcss/{cli,forms,oxide}; `npm ls --omit=dev` = las 5 `dependencies`; `/app` solo `node_modules`, `package*.json`, `public`, `src`; CSS de los 3 negocios presente |
| S-2 | Usuario y permisos | `uid=1000(node)`, `Config.User=node`; `touch /app/x` y `/app/src/x` Permission denied; `/app` y `/app/src` root 755; `/var/lib/restaurante` node:node 700 |
| S-3 | Centinelas temporales (`.env.qa-sentinel`, `data/qa-sentinel`, `tests/qa-sub/.env`) + build de ambas imágenes + `find /` | Ningún centinela ni `.env` en `production`; en `test` solo `/app/.env.example` (permitido); `/app/data` no existe en ninguna. Centinelas borrados |
| S-4 | `Config.Env` y `docker history --no-trunc` | Solo PATH, NODE_VERSION, YARN_VERSION, NODE_ENV y CI/PORT; 0 coincidencias de WHATSAPP_/ADMIN_/DATA_DIR/TRUST_PROXY/scrypt |
| S-5 | `docker compose config` | `target: test`, `network_mode: none`, `pull_policy: build`; la suite pasa sin red |
| F-6 | `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose run --rm test`; build + run `production` amd64 | 468/468, exit 0, imagen amd64 (`x86_64`, v24.21.0); `production` amd64: `GET /` 200, `x86_64`, v24.21.0, UID 1000 |
| R-2 | Mutación temporal de `config.test.js` (`'data'` -> `'datos'`) | La prueba falla (1 failed / 33); restaurada byte a byte (`cmp`) y 34/34. `PROJECT_DIR` ya se exportaba en `main`; `git diff main -- src public package*.json` vacío |
| R-3 | `.env` de prueba en el scratchpad con hash ficticio entre comillas simples | Node arranca con administración habilitada (`/admin` 303, sin `admin_disabled`); `docker compose --env-file` con comillas: 0 avisos; sin comillas: 8 avisos (confirma H-11) |
| Regresión HTML | Misma configuración en el contenedor `production` y con `node src/server.js` local | `/molotes`, `/birria`, `/css/molotes/main.css` y `/css/birria/main.css` idénticos byte a byte (mismo SHA-1); cabeceras CSP/HSTS/nosniff presentes |
| D-1 | Revisión del README y ejecución de sus comandos | Ver CA-10 |
| Performance | `docker image ls` | `test` 331 MB; `production` 172 MB (arm64) / 176 MB (amd64) |

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | F-1, N-8: 468/468, exit 0, imagen del target `test`. El equipo tiene Node instalado; las pruebas no lo usan (corren en el contenedor, sin red) |
| CA-2 | PASS | N-1: exit 1 |
| CA-3 | PASS | F-2, F-6: v24.21.0 en `test` y `production` (arm64 y amd64) |
| CA-4 | PASS | F-3: `npm ci` CACHED en `deps` y `production` tras cambiar `src/` |
| CA-5 | PASS | S-1, S-2 |
| CA-6 | PASS | F-4, F-5 |
| CA-7 | PASS | N-2, N-3, N-4 |
| CA-8 | PASS | S-3, S-4 (con `.env` y `data/` locales presentes, más centinelas) |
| CA-9 | PASS | F-1 (arm64) y F-6 (amd64 emulado) |
| CA-10 | PASS | README: Docker opcional en Requisitos; sección `## Docker` con construcción, pruebas con compose, `production` y despliegue en la VM sin cambios; instrucciones sin Docker intactas; enlaces `#docker` y `#seguridad` resuelven; la línea `# restaurant` se eliminó. Comandos documentados ejecutados (compose, build con `--build-context`, build y run de `production`). R-1: `npm test` fuera de Docker 468/468 |
| Healthcheck (H-7) | PASS | F-7, F-8 |

### Defectos encontrados

Ninguno.

Observación (no es defecto; ningún criterio lo define):

- OBS-1. `docker build --target test .` sin `--build-context design=../_stich_source_` falla (exit 1) con un error de BuildKit poco descriptivo ("pull access denied..."), porque intenta resolver `design` como imagen del registry. Está documentado en el README y en el comentario del Dockerfile, y `docker compose` lo resuelve solo. Mejora opcional de documentación.

### Regresión

- `npm test` fuera de Docker: 468/468. Sin cambios en `src/`, `public/` ni `package*.json` (RN-3).
- El HTML y el CSS servidos por la imagen `production` son idénticos byte a byte a los de la app local con la misma configuración.
- `config.test.js` sigue detectando un valor por defecto incorrecto (R-2).
- `git status` final: solo los 6 archivos del alcance más el ticket.

### Responsive

Sin cambios de UI. El HTML y el CSS son idénticos a los de la app sin Docker, así que el comportamiento responsive no cambia. La verificación visual en 375x812 y 1440x900 queda pendiente (ver más abajo).

### Accesibilidad

No aplica (sin cambios de marcado). Mismo HTML que sin Docker.

### UX/UI

No aplica (sin diseño asociado en `_stich_source_/`).

### Performance

`production` ocupa 172 MB frente a 331 MB de `test` (sin devDependencies, caché de npm limpia). Reconstrucción con caché más pruebas: unos 9 s.

### SEO

Sin cambios. Los `<title>` por negocio se sirven correctamente desde la imagen (F-4).

### Pendientes de revisión manual

- Revisión visual en el navegador de `/molotes` y `/birria` servidas por la imagen `production` (375x812 y 1440x900, consola sin errores): la extensión Claude in Chrome no estaba conectada (3 intentos). No bloquea: ningún CA depende solo del navegador y el HTML/CSS son idénticos byte a byte a los de la app sin Docker.
- Los logs del scratchpad de la sesión que dejó la fase de implementación (`ca1.log`, `ca9.log`) contienen los avisos de Compose con fragmentos del hash del `.env` local. Recomendación: borrarlos y poner el hash entre comillas simples en el `.env` local (H-11).

### Limpieza

Se eliminaron las imágenes `restaurante:qa-*`, el volumen `restaurante-qa-data`, los contenedores QA, los procesos locales (puertos 3100 a 3104) y los archivos temporales. 0 contenedores y 0 volúmenes `restaurante*`. Se conservan `restaurante:test` (reconstruida en arm64) y `restaurante:prod` (ya existía).

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-02). Decisiones D-1 a D-4 elegidas por el usuario; D-5 a D-8, propuestas como supuestos S-1 a S-4, confirmadas por el usuario al aprobar.

### Revisión técnica (senior-fullstack)

2026-10-02: revisión técnica sin bloqueos; se agrega el Technical Action Plan. Estado: NEEDS_TECHNICAL_PLAN_APPROVAL.

### Implementación (senior-fullstack)

2026-10-02: el usuario aprueba el Technical Action Plan pidiendo incluir el HEALTHCHECK y eliminar la línea suelta del README (cita: "Si, y tambien el healt check y la línea"). Rama `feature/REQ-F-003-dockerizacion-node24-alpine`, ticket movido a `in-progress/`, implementación y verificación de CA-1 a CA-10 y del healthcheck. Hallazgos H-10 y H-11. Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### Aprobación de la implementación

2026-10-02: el usuario aprueba la implementación y pide que `.env.example` indique las comillas simples en `ADMIN_PASSWORD_HASH` (cita: "SI a ambas cosas"). Ajuste aplicado y verificado (`npm test` 468/468, `docker compose config -q` OK). Implementación aprobada; lista para QA (senior-qa). Estado: NEEDS_IMPLEMENTATION_APPROVAL (aprobado).

### QA Action Plan (senior-qa)

2026-10-02: análisis de la implementación aprobada (cita: "SI a ambas cosas") y redacción del QA Action Plan. Sin ejecución de pruebas definitivas. Estado: NEEDS_QA_PLAN_APPROVAL.

### QA (senior-qa), ronda 1

2026-10-02: el usuario aprueba el QA Action Plan (cita: "Si"). Se ejecuta el plan: CA-1 a CA-10 y el healthcheck en PASS, sin defectos (OBS-1 informativa) y con la revisión visual en el navegador pendiente de revisión manual (extensión no conectada). Estado: QA_APPROVED.

### Commit y Pull Request (senior-fullstack)

2026-10-02: commit de los 6 archivos del alcance y el ticket en `feature/REQ-F-003-dockerizacion-node24-alpine`, push y Pull Request contra `main`. Verificado que ningún archivo incluido contiene el hash ni valores sensibles del `.env` local. Estado: READY_FOR_MERGE.
