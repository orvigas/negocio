# REQ-F-015 — Configuración segura por defecto (`HOST` y `NODE_ENV`)

## Estado

READY_FOR_MERGE

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-10-10). Cita textual: "Aprobar".

Decisiones del usuario en las que se basa:

- Decisión previa (2026-10-09, anexo de REQ-F-014): "Si falta `NODE_ENV`, la app no arranca. `npm run dev` y las pruebas lo fijan de forma explícita".
- Respuestas al borrador v1 (2026-10-10):
  1. `HOST` por defecto: "127.0.0.1 siempre (Recomendado)".
  2. Formatos de `HOST`: "Solo IP literales (Recomendado)".
  3. Imagen `production`: "Sí, en este ticket (Recomendado)" (fijar `HOST=0.0.0.0`).
  4. Aviso con `TRUST_PROXY=true`: "No avisar (Recomendado)".
  5. `npm start`: "No lo fija (Recomendado)".

## Origen

Solicitud del usuario: "continua Requisito REQ-F-015 config segura". Es el ticket REQ-F-015 del roadmap de despliegue (anexo de `.claude/docs/done/REQ-F-014-migracion-mysql.md`).

Fuentes:

- `.claude/docs/reports/OWASP-2026-10-09-auditoria.md`: F-05 y la parte de `HOST` de F-01 (ticket provisional "REQ-F-014" de ese informe).
- `.claude/docs/reports/VPS-DOCKER-MYSQL-2026-10-09-analisis.md`: §4.1, filas F-01 y F-05.

## Objetivo

Que el servidor no arranque en un modo inseguro por omisión:

- hoy, sin `NODE_ENV`, la app arranca como `development` (stack traces en 5xx, cookie de sesión sin `Secure`, `/admin` sin exigir HTTPS, Twilio permitido, `DATA_DIR` relativa) (F-05);
- hoy escucha en todas las interfaces sin pedirlo, lo que, junto con `TRUST_PROXY=true`, permite falsificar `X-Forwarded-Proto` y `X-Forwarded-For` si el puerto queda accesible (F-01).

## Alcance

- `NODE_ENV` obligatorio al arrancar el servidor.
- Nueva variable `HOST` con loopback por defecto.
- `npm run dev` y las pruebas fijan su `NODE_ENV`.
- La imagen `production` fija `HOST=0.0.0.0`.
- Documentación afectada (`README.md`, `.env.example`, `docs/desarrollo.md`, `docs/despliegue.md`).

## Fuera de alcance

- Ejemplo de nginx y documentación de `X-Forwarded-Host` (REQ-F-017).
- Compose de producción (REQ-F-016).
- Reescritura de la guía de despliegue (REQ-F-023).
- Límite de intentos y sesión (REQ-F-024).
- Firewall de la VM (I-1, tarea del usuario).
- Cambios en el comportamiento de `TRUST_PROXY`.
- Avisos en el log por escuchar en todas las interfaces.

## Requisitos

### Confirmados

- C-1: si falta `NODE_ENV`, la app no arranca. `npm run dev` y las pruebas lo fijan de forma explícita.
- C-2: la app no escucha en todas las interfaces salvo petición explícita.
- C-3: en el contenedor de producción se escucha en `0.0.0.0` de forma explícita; la imagen `production` ya fija `NODE_ENV=production`.
- C-4: los valores admitidos de `NODE_ENV` siguen siendo `development`, `production` y `test`; un valor no válido impide arrancar (comportamiento actual).
- C-5: los mensajes de error de configuración nunca incluyen el valor recibido.
- C-6: `HOST` vale `127.0.0.1` por defecto en todos los entornos, sin importar `TRUST_PROXY`.
- C-7: `HOST` solo acepta IP literales IPv4 o IPv6; no acepta nombres de máquina (incluido `localhost`).
- C-8: la imagen `production` fija `HOST=0.0.0.0` en este ticket.
- C-9: no se avisa al escuchar en todas las interfaces con `TRUST_PROXY=true`; la dirección efectiva solo aparece en `server_started`.
- C-10: `npm start` no fija `NODE_ENV`; debe venir del `.env` o del entorno.

### Refinados

- **RF-1. `NODE_ENV` obligatorio.** Si al arrancar el servidor `NODE_ENV` no existe, está vacío o solo contiene espacios, el servidor no arranca: termina con código distinto de 0, escribe en stderr que `NODE_ENV` es obligatorio con la lista de valores admitidos, no abre ningún puerto y no toca la base de datos. El problema se informa junto con los demás problemas de configuración, con el mismo formato (`ConfigError`).
- **RF-2. `NODE_ENV` no válido.** Se mantiene el comportamiento actual: no arranca y muestra la lista de valores admitidos.
- **RF-3. Sin valor por defecto.** Ningún componente supone `development` cuando falta `NODE_ENV`.
- **RF-4. `npm run dev`** arranca siempre con `NODE_ENV=development`, aunque `.env` no lo defina o defina otro valor.
- **RF-5. Pruebas.** La suite (`npm test`, en local y en el contenedor) corre con `NODE_ENV=test` sin que el desarrollador lo exporte.
- **RF-6. Variable `HOST`.** Es la dirección en la que escucha el servidor. Si no está definida, está vacía o solo contiene espacios, vale `127.0.0.1` en todos los entornos. Escuchar en todas las interfaces exige pedirlo explícitamente (`0.0.0.0` o `::`).
- **RF-7. Validación de `HOST`.** Solo admite una IP literal IPv4 (p. ej. `127.0.0.1`, `0.0.0.0`) o IPv6 (p. ej. `::1`, `::`). Cualquier otro valor impide arrancar: nombres (`localhost`), IP mal formadas, valores con espacios internos o con puerto (`127.0.0.1:3000`). El mensaje nombra `HOST`, indica que debe ser una IP literal IPv4 o IPv6 y no repite el valor recibido.
- **RF-8. Log de arranque.** El evento `server_started` incluye la dirección efectiva (`host`) además del puerto.
- **RF-9. Imagen `production`.** Fija `HOST=0.0.0.0`, así que el puerto publicado y el healthcheck siguen funcionando. Si el entorno de ejecución (p. ej. el compose de REQ-F-016) define `HOST`, prevalece ese valor.
- **RF-10. Documentación.**
  - `README.md` (tabla de variables): `NODE_ENV` obligatorio; `HOST` nueva, con su valor por defecto y la restricción a IP literales (`localhost` no es válido).
  - `.env.example`: añadir `HOST`, comentado y con explicación.
  - `docs/desarrollo.md`: `npm run dev` fija `development`; para probar desde otro dispositivo de la red local, definir `HOST=0.0.0.0`.
  - `docs/despliegue.md`: eliminar "en todas las interfaces"; indicar que `NODE_ENV=production` es obligatorio (`npm start` no lo fija) y documentar `HOST`.
- **RF-11. Sin aviso.** No se emite ningún aviso específico por escuchar en todas las interfaces, tenga `TRUST_PROXY` el valor que tenga.
- **RF-12. `npm start`** no fija `NODE_ENV`.

## Historias de usuario

- **HU-1.** Como responsable del despliegue, quiero que la app se niegue a arrancar si olvido `NODE_ENV`, para no publicar sin saberlo una versión con stack traces y cookies sin `Secure`.
- **HU-2.** Como responsable del despliegue, quiero que la app solo escuche en loopback salvo que yo lo pida, para que nadie llegue directamente al puerto de la app saltándose el proxy y falsifique sus cabeceras.
- **HU-3.** Como desarrollador, quiero que `npm run dev` y `npm test` sigan funcionando sin pasos extra, para que el endurecimiento no estorbe en mi trabajo diario.

## Reglas de negocio

- No existe un `NODE_ENV` por defecto.
- `HOST` es `127.0.0.1` por defecto en todos los entornos.
- Escuchar en todas las interfaces solo si se pide explícitamente.
- `HOST` solo admite IP literales.
- Los mensajes de error de configuración nunca muestran los valores recibidos.

## Criterios de aceptación

- **CA-1.** Given un entorno sin `NODE_ENV` (o con `NODE_ENV=""` o `"  "`), When se arranca el servidor (`node src/server.ts` o `npm start`), Then el proceso termina con código distinto de 0, stderr contiene "NODE_ENV" y los valores `development, production, test`, no queda ningún puerto en escucha y no se intenta conectar a MySQL.
- **CA-2.** Given la configuración de CA-1 más otro problema (p. ej. `PORT=abc`), When se arranca, Then el mensaje lista los dos problemas.
- **CA-3.** `loadConfig` sin `NODE_ENV` lanza `ConfigError` con el problema de `NODE_ENV`. Con `NODE_ENV=staging` también lanza `ConfigError`. Ningún mensaje contiene el valor recibido.
- **CA-4.** Given un `.env` sin `NODE_ENV`, When se ejecuta `npm run dev`, Then el servidor arranca y `server_started` registra `nodeEnv: development`.
- **CA-5.** Sin `NODE_ENV` exportado en la terminal, `npm test` pasa en verde. `docker compose run --rm test` también.
- **CA-6.** Given `HOST` sin definir, con cualquier `NODE_ENV` (`development`, `production` o `test`) y cualquier valor de `TRUST_PROXY`, When el servidor arranca, Then:
  - responde en `127.0.0.1:<PORT>`;
  - no acepta conexiones por otras interfaces (verificable con `lsof`/`ss`: `127.0.0.1:<PORT>`, no `*:<PORT>`);
  - `server_started` registra `host: 127.0.0.1`.
- **CA-7.** Con `HOST=0.0.0.0`, el servidor escucha en todas las interfaces y `server_started` lo registra.
- **CA-8.** Con `HOST` igual a `localhost`, `999.1.1.1`, `abc def` o `127.0.0.1:3000`, el servidor no arranca: código distinto de 0, mensaje que nombra `HOST` e indica "IP literal IPv4 o IPv6", sin repetir el valor y sin abrir ningún puerto.
- **CA-9.** Given un contenedor de la imagen `production` sin `HOST` en tiempo de ejecución y con el puerto publicado, Then escucha en `0.0.0.0` dentro del contenedor, el healthcheck queda `healthy` y la landing responde desde el host a través del puerto publicado.
- **CA-10.** `README.md`, `.env.example`, `docs/desarrollo.md` y `docs/despliegue.md` reflejan RF-10. Ningún documento afirma que la app escucha en todas las interfaces por defecto ni que `NODE_ENV` es opcional.
- **CA-11.** Para quien ya define `NODE_ENV`, el comportamiento de `production`, `development` y `test` no cambia: cookie `Secure`, puerta HTTPS, stack solo en `development`, Twilio prohibido en `production` y `DATA_DIR` absoluta en `production`. La suite existente sigue en verde.
- **CA-12.** Con `HOST=::1` el servidor escucha solo en el loopback IPv6; con `HOST=::` escucha en todas las interfaces. Las dos direcciones se aceptan.
- **CA-13.** Con `HOST=0.0.0.0` y `TRUST_PROXY=true`, el servidor arranca sin ningún aviso adicional en el log y `server_started` incluye `host: 0.0.0.0`.
- **CA-14.** Given un `.env` sin `NODE_ENV` y sin `NODE_ENV` en el entorno, When se ejecuta `npm start`, Then no arranca (mismo resultado que CA-1). Con `NODE_ENV=production` en el `.env`, sí arranca.

## Casos límite

- `NODE_ENV` con mayúsculas (`Production`): se rechaza (no es un valor admitido); no se normaliza.
- `.env` con `NODE_ENV=production` y `npm run dev`: prevalece `development` (RF-4). Se documenta.
- `HOST=localhost`: se rechaza (C-7). La documentación indica usar `127.0.0.1` o `::1`.
- `HOST=::` (todas las interfaces en IPv6, normalmente también IPv4): se acepta como petición explícita.
- `HOST=::ffff:127.0.0.1` (IPv4 escrita como IPv6): se acepta, porque es una IP literal IPv6 válida.
- `HOST` con una IP literal que no existe en la máquina (p. ej. `10.9.9.9`): pasa la validación, pero falla al escuchar. El proceso termina con código distinto de 0 y un mensaje claro que nombra `HOST`, sin quedarse colgado.
- `scripts/bot-chat.ts` (fija `development`) y `admin:recover` (no usa `NODE_ENV`) siguen funcionando igual.
- La imagen `migrate` ya fija `NODE_ENV=production`, así que no le afecta.

## Dependencias

- Ninguna bloqueante.
- REQ-F-016 (compose de producción) depende de este ticket y debe fijar `NODE_ENV=production` y `HOST=0.0.0.0` en el compose.

## Riesgos

- Si `npm run dev` fija la variable dentro del script, puede no ser portable a shells de Windows. El equipo trabaja en macOS y Docker; la forma concreta la decide senior-fullstack.
- Un arranque existente que dependía del valor por defecto (p. ej. un `.env` de producción sin `NODE_ENV`) dejará de arrancar. Es el efecto buscado; debe quedar documentado.
- Un desarrollador que probaba la app desde otro dispositivo de la red local tendrá que definir `HOST=0.0.0.0` (documentado en `docs/desarrollo.md`).

## Action Plan

### Objetivo

Que el servidor falle cerrado ante un `NODE_ENV` ausente y escuche solo en loopback salvo petición explícita.

### Cambios requeridos

1. **Configuración:**
   - eliminar el valor por defecto de `NODE_ENV` y tratar como ausente el valor vacío o con solo espacios;
   - añadir `HOST`, validada como IP literal IPv4 o IPv6, con `127.0.0.1` por defecto en todos los entornos y sin aviso ligado a `TRUST_PROXY`.
2. **Arranque:**
   - escuchar en la dirección configurada;
   - incluir `host` en `server_started`;
   - terminar con un error claro si falla la escucha.
3. **Scripts:**
   - `npm run dev` fija `development`;
   - la ejecución de las pruebas garantiza `test`;
   - `npm start` no cambia.
4. **Imagen `production`:** fija `HOST=0.0.0.0`.
5. **Documentación:** según RF-10.
6. **Pruebas:**
   - unitarias de configuración: CA-3, CA-8, CA-12, y `HOST` por defecto y explícito;
   - de arranque: CA-1, CA-2, CA-6, CA-7, CA-13 y CA-14;
   - verificación de la imagen: CA-9.

### Integraciones

Docker (imagen `production` y healthcheck). El proxy futuro apuntará a `127.0.0.1:3000` o a la red interna del contenedor.

### Orden recomendado

1 → 2 → 3 → 6 → 4 → 5.

### Resultado esperado

- Es imposible arrancar sin `NODE_ENV`.
- La app solo es alcanzable desde la propia máquina salvo petición explícita.
- El desarrollo, las pruebas y la imagen de producción siguen funcionando.

## Trazabilidad

| Objetivo | Requisitos | Historia | Criterios | Action Plan |
|---|---|---|---|---|
| F-05 | RF-1, RF-2, RF-3 | HU-1 | CA-1, CA-2, CA-3, CA-11 | 1, 6 |
| F-05 | RF-4, RF-5 | HU-3 | CA-4, CA-5 | 3 |
| F-05 | RF-12 | HU-1 | CA-14 | 3 |
| F-01 | RF-6, RF-7, RF-8 | HU-2 | CA-6, CA-7, CA-8, CA-12 | 1, 2, 6 |
| F-01 | RF-11 | HU-2 | CA-13 | 1 |
| F-01 | RF-9 | HU-2 | CA-9 | 4 |
| — | RF-10 | HU-1, HU-2, HU-3 | CA-10 | 5 |

No implica diseño de `_stich_source_/` (no hay cambios visibles).

## Revisión técnica

Revisión de senior-fullstack (T1, 2026-10-10). Sin bloqueos: el requisito es coherente con la arquitectura y con las reglas. Hallazgos que el plan resuelve sin cambiar el alcance funcional:

- **Valor por defecto actual.** `loadConfig` (`src/config/env.ts:496`) usa `DEFAULTS.NODE_ENV = 'development'`. Nadie más depende de ese valor por defecto: `bot-chat.ts` fija `development`, `admin-recover.ts` usa `loadDatabaseConfig` (no lee `NODE_ENV`), las pruebas usan `VALID_ENV` (`NODE_ENV: 'test'`) y los procesos lanzados en las pruebas no heredan el entorno (`tests/support/process.ts`, `baseEnv`).
- **`--env-file` no sobrescribe el entorno.** Con `node --env-file-if-exists=.env`, una variable ya presente en el entorno gana a la del archivo, pero la del archivo gana a nada. Para que `npm run dev` use `development` aunque el `.env` diga otra cosa (RF-4), hay que fijarlo después de cargar el `.env`. Un `NODE_ENV=development node ...` dentro del script no funciona en `cmd.exe` (riesgo del ticket); se usa un punto de entrada de desarrollo en TypeScript (portable, sin dependencias).
- **Pruebas.** Vitest pone `NODE_ENV=test` solo si no está definido; si el desarrollador exportó `production`, se respetaría. Se fija de forma explícita en `vitest.config.ts`. La etapa `test` del Dockerfile ya fija `NODE_ENV=test`.
- **Validación de `HOST`.** `isIP` de `node:net` (Node 24.21) cumple CA-8 y CA-12: `127.0.0.1`, `0.0.0.0`, `::1`, `::` y `::ffff:127.0.0.1` son válidas; `localhost`, `999.1.1.1`, `abc def`, `127.0.0.1:3000`, `[::1]`, `127.000.0.1` y `01.2.3.4` no. Decisión técnica: también acepta una IPv6 con zona (`fe80::1%lo0`), que es una IP literal IPv6; no se filtra a mano.
- **Fallo al escuchar.** Hoy `app.listen` no tiene manejador de `error`: un `EADDRNOTAVAIL` o `EADDRINUSE` termina como excepción no capturada, con el stack en stderr y sin cerrar la base de datos. Se maneja de forma explícita (caso límite de la IP inexistente).
- **Pruebas de arranque.** `startServer` siempre mezcla `VALID_ENV` (con `NODE_ENV`) y solo lanza `src/server.ts`. Hay que poder quitar variables y lanzar otro punto de entrada. `npm start` y `npm run dev` leen el `.env` real del proyecto: las pruebas no pueden usarlo, así que toman los argumentos del script de `package.json` y solo sustituyen la ruta del `.env` por un archivo temporal.
- **IPv6 en contenedores.** Docker desactiva IPv6 en los contenedores de redes sin IPv6, así que `::1` puede no existir en `docker compose run --rm test`. La aceptación de `::1` y `::` se prueba siempre en unitarias; la escucha real en IPv6 solo donde exista el loopback IPv6 (macOS y el runner del CI lo tienen).
- **Lint de pruebas.** `eslint.config.ts` exige `listen(…, '127.0.0.1')` en `tests/`; las pruebas nuevas no abren servidores en otras direcciones (la detección de IPv6 usa `os.networkInterfaces()`, no un `listen`).
- **CA-9 en el CI.** La red `restaurante_db-test` es `internal: true`: un contenedor solo en esa red no publica puertos. El contenedor de producción se crea en la red por defecto (con el puerto publicado) y se conecta además a `restaurante_db-test` antes de arrancar.
- **Documentación desactualizada fuera de RF-10.** `README.md` (líneas 116-117) dice que las pruebas de arranque lanzan un proceso "que escucha en todas las interfaces"; la línea 209 describe las variables fijadas en la imagen; la tabla de comandos describe `npm run dev`. Se actualizan (CA-10: ningún documento afirma que escucha en todas las interfaces por defecto).
- **Riesgo menor (sin decisión requerida).** Algunos shells (p. ej. `tcsh`) exportan `HOST` con el nombre de la máquina. Como el entorno gana al `.env`, la app no arrancaría y diría que `HOST` debe ser una IP literal. Es un fallo seguro y explícito; se documenta en la tabla de problemas de `docs/desarrollo.md`. En zsh (macOS) `HOST` no se exporta.

## Technical Action Plan

### Objetivo técnico

Eliminar el valor por defecto de `NODE_ENV`, añadir `HOST` validada (IP literal, `127.0.0.1` por defecto), escuchar en esa dirección con un fallo controlado, fijar `NODE_ENV` en `npm run dev` y en Vitest, fijar `HOST=0.0.0.0` en la imagen `production` y documentarlo.

### Archivos o componentes afectados

- `restaurante/src/config/env.ts`: `NODE_ENV` sin valor por defecto, `HOST` nueva, `Config.host`.
- `restaurante/src/server.ts`: escucha en `config.host`, `host` en `server_started`, fallo de escucha controlado.
- `restaurante/scripts/dev-server.ts` (nuevo): punto de entrada de `npm run dev`.
- `restaurante/package.json`: script `dev`.
- `restaurante/vitest.config.ts`: `test.env.NODE_ENV = 'test'`.
- `restaurante/Dockerfile`: `ENV HOST=0.0.0.0` en la etapa `production`.
- `.github/workflows/ci.yml`: comprobación de CA-9 en el job `docker`.
- `restaurante/tests/support/process.ts`: `startServer` admite quitar variables y otro punto de entrada.
- `restaurante/tests/unit/config.test.ts`: casos de `NODE_ENV` y `HOST`.
- `restaurante/tests/integration/server-startup-config.test.ts` (nuevo): arranque real.
- Documentación: `restaurante/README.md`, `restaurante/.env.example`, `restaurante/docs/desarrollo.md`, `restaurante/docs/despliegue.md`.

### Backend

1. **`env.ts`**
   - Quitar `NODE_ENV` de `DEFAULTS` y añadir `HOST: '127.0.0.1'`.
   - `NODE_ENV` ausente, vacío o con solo espacios (`readVar` → `undefined`) agrega el problema `NODE_ENV es obligatorio: debe ser uno de development, production, test`. Un valor no admitido mantiene el mensaje actual (`NODE_ENV debe ser uno de: development, production, test`). Sin normalizar mayúsculas. Ninguno repite el valor.
   - `parseDataDir`, `parseBotProvider` y `parseChatBot` reciben `nodeEnv: string | undefined`. Sin `NODE_ENV` no se añaden problemas derivados (el de `NODE_ENV` ya impide arrancar) y se siguen recogiendo los demás (CA-2).
   - Nueva `parseHost(raw, issues)`: `undefined` → `DEFAULTS.HOST`; `isIP(raw) === 0` → problema `HOST debe ser una IP literal IPv4 o IPv6 (p. ej. 127.0.0.1, 0.0.0.0, ::1 o ::); localhost no se admite`. Sin relación con `TRUST_PROXY` (RF-11).
   - `Config` gana `readonly host: string`. La comprobación final de tipos incluye `host === undefined`.
2. **`server.ts`**
   - `const server = app.listen(config.port, config.host)` y `await once(server, 'listening')` (`node:events`). Si rechaza (`EADDRNOTAVAIL`, `EADDRINUSE`, `EACCES`…): `logger.error('server_listen_failed', { code })`, stderr `No se pudo escuchar en la dirección y el puerto configurados (<code>): revisa que HOST sea una IP de esta máquina y que PORT esté libre.` (sin valores), `prisma.$disconnect()` y `process.exit(1)`.
   - `server_started` añade `host: config.host` junto a `port`. Sin avisos nuevos.
   - El orden del arranque no cambia: la configuración se valida antes de tocar `DATA_DIR` o MySQL (RF-1).
3. **`scripts/dev-server.ts`** (nuevo, solo desarrollo; no entra en la imagen): `process.env.NODE_ENV = 'development'` y `await import('../src/server.ts')`. Se ejecuta después de que Node cargue el `.env`, así que gana siempre (RF-4). `node --watch` sigue los módulos importados de forma dinámica.

### Contenido / configuración

- `package.json`: `"dev": "node --watch --env-file-if-exists=.env scripts/dev-server.ts"`. `start` no cambia (RF-12).
- `vitest.config.ts`: `test.env: { NODE_ENV: 'test' }` (RF-5, también si el desarrollador exportó otro valor).
- `Dockerfile`, etapa `production`: `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000`. `docker run -e HOST=…` o el compose de REQ-F-016 lo sobrescriben (RF-9). El `HEALTHCHECK` (`wget http://127.0.0.1:…`) sigue funcionando con `0.0.0.0`. Las etapas `test` (ya fija `NODE_ENV=test`) y `migrate` no cambian.
- Documentación (RF-10, CA-10):
  - `README.md`: tabla de variables (`NODE_ENV` obligatoria y sin valor por defecto; fila `HOST`: `127.0.0.1` por defecto, solo IP literal IPv4/IPv6, `localhost` no válido, `0.0.0.0` o `::` para todas las interfaces); tabla de comandos (`npm run dev` fija `NODE_ENV=development`; `npm start` lo toma del `.env` o del entorno); sección Docker (la imagen fija `NODE_ENV=production`, `PORT=3000` y `HOST=0.0.0.0`); nota de "Pruebas HTTP" (las pruebas de arranque lanzan `src/server.ts`, que escucha en `127.0.0.1` por defecto).
  - `.env.example`: `NODE_ENV` obligatoria (con `npm run dev` siempre es `development`); `# HOST=127.0.0.1` comentada, con su explicación.
  - `docs/desarrollo.md`: `npm run dev` fija `development` aunque el `.env` diga otra cosa; para probar desde otro dispositivo de la red, `HOST=0.0.0.0`; filas nuevas en la tabla de problemas ("NODE_ENV es obligatorio" con `npm start`; "HOST debe ser una IP literal" por `localhost` o un `HOST` exportado por el shell).
  - `docs/despliegue.md`: sustituir "en todas las interfaces" por la regla de `HOST`; `NODE_ENV=production` obligatorio (`npm start` no lo fija); `HOST` en el `.env` de producción (sin Docker, `127.0.0.1` detrás de nginx; en la imagen, `0.0.0.0`).

### Validaciones

- `NODE_ENV`: obligatoria, uno de `development | production | test`, exacta (sin normalizar).
- `HOST`: recortada (`readVar`, como el resto), vacía → `127.0.0.1`, si no `isIP(value) !== 0`.
- Todos los problemas se acumulan en un único `ConfigError` (formato actual) y ningún mensaje incluye el valor recibido (C-5).

### Manejo de errores

- Configuración: sin cambios de formato (stderr con la lista de problemas, código 1), antes de abrir puertos, tocar `DATA_DIR` o conectar a MySQL.
- Escucha: error controlado con código 1, log `server_listen_failed` solo con el `code` del sistema y cierre de la base de datos. Nunca se queda colgado.

### Testing

Unitarias (`tests/unit/config.test.ts`):

- CA-3: `NODE_ENV` ausente, `''` y `'  '` → `ConfigError` con el problema de obligatoriedad; `staging` y `Production` → `ConfigError`; ningún mensaje contiene el valor. Se reemplaza la prueba actual "aplica valores por defecto para NODE_ENV…" (ahora `PORT`, `BUSINESS_TIMEZONE` y `HOST`).
- CA-2 (nivel de configuración): sin `NODE_ENV` y `PORT=abc` → los dos problemas.
- `HOST`: por defecto `127.0.0.1` con cada `NODE_ENV` y cada `TRUST_PROXY` (sin definir, `true`, `false`); `''` y `'  '` → `127.0.0.1`; acepta `127.0.0.1`, `0.0.0.0`, `::1`, `::`, `::ffff:127.0.0.1` (CA-12); rechaza `localhost`, `999.1.1.1`, `abc def`, `127.0.0.1:3000`, `[::1]` con un mensaje que nombra `HOST` e "IP literal IPv4 o IPv6" sin el valor (CA-8).
- CA-11: las pruebas existentes de cookie `Secure`, puerta HTTPS, stack solo en `development`, Twilio prohibido en `production` y `DATA_DIR` absoluta siguen en verde sin cambios.

Soporte (`tests/support/process.ts`):

- `startServer(env, timeoutMs, { args })`: un valor `undefined` en `env` quita esa variable de `VALID_ENV`; `args` (por defecto `['src/server.ts']`) permite lanzar los argumentos de un script de `package.json`.

Arranque real (`tests/integration/server-startup-config.test.ts`, procesos de Node reales sin heredar el entorno):

- CA-1: sin `NODE_ENV`, con `''` y con `'  '` → código 1, stderr con `NODE_ENV` y `development, production, test`, sin `server_started`. Para "no se intenta conectar a MySQL", `DATABASE_URL` apunta a un servidor TCP centinela de la prueba en `127.0.0.1` que cuenta conexiones: cero. Al terminar, el puerto configurado rechaza conexiones.
- CA-2: sin `NODE_ENV` y `PORT=abc` → los dos problemas en stderr.
- CA-8: `HOST` = `localhost`, `999.1.1.1`, `abc def`, `127.0.0.1:3000` → código 1, mensaje con `HOST` e "IP literal IPv4 o IPv6", sin el valor, y cero conexiones al centinela.
- CA-6: sin `HOST`, tres arranques: `development` + `TRUST_PROXY` sin definir, `production` (`DATA_DIR` absoluta temporal) + `TRUST_PROXY=true`, `test` + `TRUST_PROXY=false`. En cada uno, `GET http://127.0.0.1:<PORT>/` responde y `server_started` registra `host: "127.0.0.1"`. Además, si la máquina tiene una IPv4 no interna (`os.networkInterfaces()`; existe en el CI y en el contenedor de pruebas), una conexión a `<esa IP>:<PORT>` se rechaza. Esa parte va en su propio `it.runIf` para no saltar el resto.
- CA-7 y CA-13 (un arranque): `HOST=0.0.0.0` y `TRUST_PROXY=true` → `server_started` con `host: "0.0.0.0"`, respuesta en `127.0.0.1` (y en la IPv4 no interna, con `it.runIf`), y el conjunto de mensajes `warn` del log es igual al de un arranque de referencia sin `HOST` ni `TRUST_PROXY` (ningún aviso adicional).
- CA-12: si existe el loopback IPv6 (`os.networkInterfaces()`, `it.runIf`): `HOST=::1` responde en `http://[::1]:<PORT>/` y rechaza en `127.0.0.1`; `HOST=::` responde en `[::1]` y en `127.0.0.1`.
- Caso límite de la IP inexistente: `HOST=192.0.2.1` (TEST-NET-1, nunca asignada) → código 1 sin quedarse colgado, mensaje que nombra `HOST` y `server_listen_failed` con `code: "EADDRNOTAVAIL"`, sin el valor.
- CA-14: se leen los argumentos de `scripts.start` de `package.json` (se comprueba que no fijan `NODE_ENV`) y solo se cambia `--env-file-if-exists=.env` por un `.env` temporal. `.env` sin `NODE_ENV` → como CA-1. `.env` con `NODE_ENV=production` (y `DATA_DIR` absoluta) → `server_started` con `nodeEnv: "production"`.
- CA-4: igual con `scripts.dev` (incluido `--watch`; se detiene con `SIGTERM`). `.env` sin `NODE_ENV` → `nodeEnv: "development"`; `.env` con `NODE_ENV=production` → también `development` (caso límite de RF-4).
- CA-5: `npm test` sin `NODE_ENV` exportado (CI y local) y `docker compose run --rm test` en verde; además, una comprobación de que `process.env.NODE_ENV === 'test'` dentro de la suite.

Imagen (CA-9, nuevo paso del job `docker` en `.github/workflows/ci.yml`, tras "migrate sobre una base vacía", que deja `restaurante_test_ci` migrada):

- `docker create` de `restaurante:production` en la red por defecto con `-p 127.0.0.1:3000:3000`, sin `HOST`, con `DATABASE_URL` del usuario DML de pruebas hacia `mysql-dev:3306/restaurante_test_ci`, `DATA_DIR=/var/lib/restaurante` y `WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA` ficticios; `docker network connect restaurante_db-test`; `docker start`.
- Espera hasta 120 s a `State.Health.Status == healthy` (el intervalo de la imagen es 30 s; no se cambia), comprueba que `docker logs` contiene `server_started` con `"host":"0.0.0.0"` y que `curl -fsS http://127.0.0.1:3000/` responde desde el runner. Si algo falla, muestra `docker logs` y termina con error.

Comandos: `npm run typecheck`, `npm run lint`, `npm test` (con `npm run db:up`), `docker compose run --rm test` y `docker build --target production` con la comprobación de CA-9 en local antes del PR.

### Seguridad

- Falla cerrado: sin `NODE_ENV` no hay modo inseguro por omisión; `HOST` solo abre más interfaces si se pide.
- Ningún mensaje ni log incluye los valores recibidos (ni `NODE_ENV`, ni `HOST`, ni los de `server_listen_failed`). `server_started` solo lleva el `host` efectivo (RF-8), que no es secreto.
- `scripts/dev-server.ts` no se copia a la imagen `production` (el Dockerfile solo copia `admin-recover.ts`, `hash-password.ts` y `scripts/support`).
- Sin dependencias nuevas (`node:net`, `node:events`, `node:os`).

### Performance

Sin impacto en ejecución. La suite gana unos 15 arranques reales: los de configuración inválida terminan antes de conectar (sin base de datos) y el resto usa la base migrada del trabajador.

### Riesgos técnicos

- `node --watch` en la prueba de CA-4: si el proceso vigilante no se detiene con `SIGTERM` de forma fiable, la prueba lanza el proceso en su propio grupo (`detached`) y detiene el grupo completo. No se cambia el script por ello.
- IPv6: la escucha real en `::1`/`::` no se ejerce dentro del contenedor de pruebas si Docker no tiene IPv6; sí en macOS y en el runner del CI (`calidad`).
- Un `HOST` exportado por el shell (p. ej. `tcsh`) impide arrancar; documentado.
- Quien arranque con un `.env` sin `NODE_ENV` deja de arrancar (efecto buscado; documentado).

### Orden de implementación

1. `env.ts` + pruebas unitarias.
2. `server.ts` (escucha, `host` en el log, fallo de escucha).
3. `scripts/dev-server.ts`, `package.json` y `vitest.config.ts`.
4. `tests/support/process.ts` y `server-startup-config.test.ts`.
5. `Dockerfile` y paso de CA-9 en `ci.yml` (verificado en local con Docker).
6. Documentación.
7. Validación completa (`typecheck`, `lint`, `test`, `docker compose run --rm test`, imagen `production`).

### Criterios de finalización

- CA-1 a CA-14 cubiertos por las pruebas indicadas (CA-9 por el paso del CI y su verificación local; CA-10 por revisión de los cuatro documentos).
- `npm run typecheck`, `npm run lint` y `npm test` terminan con 0; `docker compose run --rm test` en verde.
- Ningún documento afirma que la app escucha en todas las interfaces por defecto ni que `NODE_ENV` es opcional.
- `git diff` sin cambios ajenos al ticket.

## Implementation Result

### Rama

`feature/REQ-F-015-configuracion-segura` (desde `main` en `ca270fd`). Sin commits (fase T2).

### Cambios realizados

- `src/config/env.ts`: se quita el valor por defecto de `NODE_ENV`. Si falta, está vacío o solo tiene espacios: `NODE_ENV es obligatorio: debe ser uno de development, production, test`. Con otro valor se mantiene el mensaje de siempre. Sin `NODE_ENV` no se añaden problemas derivados de producción (`DATA_DIR`, Twilio). Nueva `HOST` (`parseHost` con `isIP` de `node:net`; `127.0.0.1` por defecto; el mensaje nombra `HOST`, dice "IP literal IPv4 o IPv6" y no repite el valor). `Config.host`.
- `src/server.ts`: `app.listen(config.port, config.host)` + `await once(server, 'listening')`. Si falla: log `server_listen_failed` (solo `code`), stderr que nombra `HOST`/`PORT` sin valores, cierre de Prisma y código 1. `server_started` incluye `host`.
- `scripts/dev-server.ts` (nuevo) y `package.json`: `npm run dev` = `node --watch --env-file-if-exists=.env scripts/dev-server.ts` (fija `development` tras cargar el `.env`). `npm start` sin cambios.
- `vitest.config.ts`: `test.env.NODE_ENV = 'test'`.
- `Dockerfile` (`production`): `ENV HOST=0.0.0.0`.
- `.github/workflows/ci.yml`: paso "imagen production escucha en 0.0.0.0 y queda healthy" (CA-9).
- `tests/support/process.ts`: `startServer` acepta `undefined` para quitar variables y `{ args }`; el proceso va en su propio grupo y `stop()` detiene el grupo (`node --watch` y su hijo). Expone `port`.
- Pruebas: `tests/unit/config.test.ts` (`NODE_ENV`, `HOST`, CA-5) y `tests/integration/server-startup-config.test.ts` (arranque real).
- Documentación: `README.md` (tabla de variables con `NODE_ENV` obligatoria y `HOST`, tabla de comandos, Docker, CI, nota de pruebas de arranque, URLs locales a `127.0.0.1`), `.env.example`, `docs/desarrollo.md` (dev fija `development`, `HOST=0.0.0.0` para la red local, tres filas de problemas, URLs a `127.0.0.1`), `docs/despliegue.md` (sin "todas las interfaces", `NODE_ENV=production` obligatoria con `npm start`, `HOST`).

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | Cumple | Arranque real sin `NODE_ENV`, con `''` y con `'  '`: código 1, stderr con `NODE_ENV` y `development, production, test`, sin `server_started`, cero conexiones al centinela de MySQL, puerto cerrado |
| CA-2 | Cumple | Unitaria y arranque real (`PORT=abc`): los dos problemas |
| CA-3 | Cumple | Unitarias: ausente/vacío/espacios, `staging`, `Production`, `TEST`; sin el valor en el mensaje |
| CA-4 | Cumple | Args reales de `scripts.dev` (con `--watch`) y `.env` temporal sin `NODE_ENV` o con `production`: `nodeEnv: development` |
| CA-5 | Cumple | `env -u NODE_ENV npm test` en verde; `NODE_ENV=production npx vitest run …` sigue en `test`; `docker compose run --rm test` en verde |
| CA-6 | Cumple | Tres arranques (`development`/sin `TRUST_PROXY`, `production`/`true`, `test`/`false`): `host: 127.0.0.1`, 200 en `127.0.0.1`; conexión rechazada por la IPv4 no interna |
| CA-7 | Cumple | `HOST=0.0.0.0`: `host: 0.0.0.0`, acepta en `127.0.0.1` y en la IPv4 no interna |
| CA-8 | Cumple | Unitarias y arranque real con `localhost`, `999.1.1.1`, `abc def`, `127.0.0.1:3000`: código 1, sin el valor, sin MySQL ni puerto |
| CA-9 | Cumple (local); en CI al abrir el PR | Imagen construida en local: sin `HOST`, `healthy`, `server_started` con `"host":"0.0.0.0"`, `netstat` `0.0.0.0:3000`, 200 por el puerto publicado. Paso equivalente en el job `docker` |
| CA-10 | Cumple | Revisión de los cuatro documentos; ninguno dice que escucha en todas las interfaces por defecto ni que `NODE_ENV` es opcional |
| CA-11 | Cumple | Suite completa existente en verde sin cambios en esas pruebas |
| CA-12 | Cumple | Unitarias (`::1`, `::`, `::ffff:127.0.0.1`, `fe80::1%lo0`) y arranque real: `::1` solo IPv6; `::` en `::1` y `127.0.0.1` (corrió en macOS y en el contenedor de pruebas) |
| CA-13 | Cumple | `HOST=0.0.0.0` + `TRUST_PROXY=true`: mismos avisos que el arranque de referencia, `host: 0.0.0.0` |
| CA-14 | Cumple | Args reales de `scripts.start` (sin `NODE_ENV`): `.env` sin él → código 1; con `production` → arranca |
| IP inexistente | Cumple | `HOST=192.0.2.1`: código 1, `server_listen_failed` con `EADDRNOTAVAIL`, sin el valor |

### Validaciones ejecutadas

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin avisos.
- `npm run build:css`: correcto.
- `env -u NODE_ENV npm test`: 77 archivos; 1503 pasan + 1 fallo esperado (1504).
- `npx vitest run tests/integration/server-startup-config.test.ts --reporter=verbose`: 17/17, ninguno omitido en macOS.
- `docker compose run --rm test`: 77 archivos; 1502 pasan, 1 fallo esperado, 1 omitida (ya existente en `server-startup.test.ts`, no de este ticket).
- `docker build --target production` y `--target migrate` + el guion del paso de CA-9 contra una base `restaurante_test_ca9` (borrada después) con el puerto 3999: `healthy`, `host: 0.0.0.0` y 200.

### Archivos afectados

`.github/workflows/ci.yml`, `restaurante/.env.example`, `restaurante/Dockerfile`, `restaurante/README.md`, `restaurante/docs/desarrollo.md`, `restaurante/docs/despliegue.md`, `restaurante/package.json`, `restaurante/scripts/dev-server.ts` (nuevo), `restaurante/src/config/env.ts`, `restaurante/src/server.ts`, `restaurante/tests/support/process.ts`, `restaurante/tests/unit/config.test.ts`, `restaurante/tests/integration/server-startup-config.test.ts` (nuevo), `restaurante/vitest.config.ts`, y este ticket (`backlog/` → `in-progress/`).

### Riesgos o pendientes

- El paso de CA-9 en el CI se verá en verde al abrir el PR (T4); en local pasó con el mismo guion.
- El mensaje de `HOST` dice "no un nombre de máquina" en lugar de nombrar `localhost`, para no repetir el valor recibido cuando es `localhost` (C-5).
- Las URLs de ejemplo locales de `README.md` y `docs/desarrollo.md` pasan de `localhost:3000` a `127.0.0.1:3000`: algunas herramientas (p. ej. `cloudflared`) resuelven `localhost` a `::1`, donde la app ya no escucha por defecto.
- Hay un proceso `node --env-file=.env.example src/server.ts` del 2026-10-09 en marcha en esta máquina, que no es de esta tarea. No se tocó.

## QA Action Plan

### Objetivo

Validar con evidencia que el servidor falla cerrado sin `NODE_ENV`, escucha solo en `127.0.0.1` salvo petición explícita (`HOST`), que `npm run dev`, `npm test` y la imagen `production` siguen funcionando, y que no hay regresiones en el comportamiento por entorno (CA-11) ni en las landings.

### Requisito bajo prueba

RF-1 a RF-12 y CA-1 a CA-14 de este ticket (versión 2), más los casos límite (mayúsculas en `NODE_ENV`, `.env` con `production` y `npm run dev`, `localhost`, `::`, `::ffff:127.0.0.1`, IP inexistente, `bot-chat`, `admin:recover`, imagen `migrate`).

### Criterios de aceptación

| CA | Pruebas que lo cubren |
|---|---|
| CA-1 | F-1, F-2, F-3 (manual con `node src/server.ts`, `lsof`, centinela de MySQL) + integración `server-startup-config` |
| CA-2 | F-4 (manual) + unitaria e integración |
| CA-3 | Unitarias de `config.test.ts` + revisión de que los mensajes no contienen el valor (N-1) |
| CA-4 | F-7 (`npm run dev` real con `.env` temporal o sin `NODE_ENV`) + integración |
| CA-5 | A-1 (`env -u NODE_ENV npm test`), A-2 (`NODE_ENV=production npx vitest run tests/unit/config.test.ts`), A-3 (`docker compose run --rm test`) |
| CA-6 | F-8 (tres arranques manuales con `lsof -nP -iTCP:<PORT> -sTCP:LISTEN` mostrando `127.0.0.1:<PORT>` y no `*:<PORT>`; conexión por la IPv4 de la LAN rechazada) + integración |
| CA-7 | F-9 (`HOST=0.0.0.0`: `lsof` con `*:<PORT>`, `host` en `server_started`) |
| CA-8 | N-2 (cuatro valores, manual) + unitarias e integración |
| CA-9 | D-1 (imagen `production` en local, puerto publicado libre, healthcheck `healthy`, log, `netstat` dentro del contenedor, HTTP 200 desde el host) + revisión del paso del CI |
| CA-10 | DOC-1 (revisión de los cuatro documentos y `grep` de "todas las interfaces", "por defecto: development", `localhost:3000`) |
| CA-11 | A-1 (suite completa) + R-1 (pruebas existentes de cookie `Secure`, puerta HTTPS, stack solo en `development`, Twilio prohibido, `DATA_DIR` absoluta sin cambios frente a `main`) |
| CA-12 | F-10 (`HOST=::1` y `HOST=::` con `lsof` y `curl` a `[::1]` y `127.0.0.1`) + unitarias e integración |
| CA-13 | F-11 (`HOST=0.0.0.0 TRUST_PROXY=true`: comparación de líneas `warn` con un arranque de referencia) |
| CA-14 | F-5, F-6 (`npm start` con `.env` temporal sin `NODE_ENV` y con `production`) + integración |

### Riesgos identificados

- R1: el `.env` local actual no define `NODE_ENV`; tras el cambio, `npm start` con ese `.env` no arranca (efecto buscado). Las pruebas manuales usan `.env` temporales o variables explícitas y no modifican el `.env` real.
- R2: el `.env` real se lee en `npm start`/`npm run dev`; para no alterarlo, se lanzan los mismos argumentos de `package.json` con `--env-file-if-exists=<temporal>`, o se ejecuta desde una copia del proyecto si hace falta el script npm literal.
- R3: `node --watch` (dev) puede dejar procesos huérfanos: se verifica que `stop()` mate el grupo y que no queden procesos tras la suite (`pgrep -fl dev-server.ts`).
- R4: conflictos de puerto: hay un proceso ajeno escuchando en `*:3102` (no se toca). Las pruebas manuales usan puertos libres comprobados con `lsof` (p. ej. 3100, 3110-3119) y la de Docker un puerto publicado libre.
- R5: fallo de escucha (`EADDRNOTAVAIL`, `EADDRINUSE`): debe terminar con 1, sin stack, sin valores y cerrando Prisma; no debe quedarse colgado.
- R6: `server.ts` cambia de callback a `await once(...)`: verificar que el apagado con `SIGTERM`/`SIGINT` sigue cerrando limpio (regresión).
- R7: `startServer` en `tests/support/process.ts` es compartido por otras pruebas de arranque (`server-startup.test.ts` y otras): regresión en todas sus consumidoras; ahora usa `detached` y mata por grupo.
- R8: CA-9 en el CI no puede ejecutarse en QA local; se valida el mismo guion en local y se revisa el YAML. El resultado en el CI queda para el PR.
- R9: IPv6 en Docker: `::1` puede no existir en `docker compose run --rm test`; las pruebas con `it.runIf` no deben omitir nada en macOS.
- R10: la "1 prueba con fallo esperado" de la suite: verificado en Q1 que es `it.fails` intencional en `tests/integration/local-server.test.ts:87` (REQ-F-011), sin cambios respecto de `main`. Vitest la cuenta como "expected fail" (pasa). No es un defecto ni de este ticket.

### Pruebas funcionales

Todas desde `restaurante/`, con procesos reales y `DATABASE_URL` de la base de desarrollo/pruebas local solo cuando el arranque deba completarse.

- F-1: `env -i PATH=$PATH node src/server.ts` (sin `NODE_ENV`) → código ≠ 0, stderr con `NODE_ENV` y `development, production, test`, sin `server_started`.
- F-2: igual con `NODE_ENV=""` y `NODE_ENV="  "`.
- F-3: en F-1, `DATABASE_URL` hacia un centinela TCP local (`nc -l` o script Node en `127.0.0.1`) → cero conexiones; `lsof` no muestra el `PORT` configurado en escucha.
- F-4: sin `NODE_ENV` y `PORT=abc` → stderr lista ambos problemas.
- F-5: `npm start` (argumentos de `scripts.start`) con `.env` temporal sin `NODE_ENV` → como F-1.
- F-6: `.env` temporal con `NODE_ENV=production` (y `DATA_DIR` absoluta temporal) → `server_started` con `nodeEnv: production`, `host: 127.0.0.1`.
- F-7: `npm run dev` (argumentos de `scripts.dev`) con `.env` sin `NODE_ENV` y con `NODE_ENV=production` → en ambos `nodeEnv: development`; se detiene el grupo y se comprueba que no quedan procesos.
- F-8: sin `HOST`: `development`/sin `TRUST_PROXY`, `production`/`TRUST_PROXY=true`, `test`/`TRUST_PROXY=false` → `lsof` muestra `127.0.0.1:<PORT>`; `curl http://127.0.0.1:<PORT>/` 200; `curl http://<IPv4 LAN>:<PORT>/` rechazado; log `host: 127.0.0.1`.
- F-9: `HOST=0.0.0.0` → `lsof` `*:<PORT>`, `curl` por `127.0.0.1` y por la IPv4 de la LAN responden, log `host: 0.0.0.0`.
- F-10: `HOST=::1` → `curl -g http://[::1]:<PORT>/` 200 y `127.0.0.1` rechazado; `HOST=::` → ambos responden.
- F-11: `HOST=0.0.0.0 TRUST_PROXY=true` vs. arranque de referencia sin `HOST`/`TRUST_PROXY`: mismo conjunto de mensajes `warn`.
- F-12: `HOST=::ffff:127.0.0.1` → arranca (caso límite aceptado).

### Pruebas negativas y casos límite

- N-1: `NODE_ENV=staging`, `Production`, `TEST` → no arranca; el valor recibido no aparece en stderr.
- N-2: `HOST` = `localhost`, `999.1.1.1`, `abc def`, `127.0.0.1:3000`, `[::1]` → código ≠ 0, mensaje con `HOST` e "IP literal IPv4 o IPv6", sin el valor recibido, sin puerto abierto y sin conectar a MySQL (centinela).
- N-3: `HOST=192.0.2.1` (no asignada) → código 1 en pocos segundos, stderr que nombra `HOST`, log `server_listen_failed` con `code: EADDRNOTAVAIL`, sin la IP ni el puerto, sin stack.
- N-4: `PORT` ocupado (levantar un listener en `127.0.0.1:<PORT>` y arrancar con el mismo) → código 1, `EADDRINUSE`, sin stack ni valores, sin colgarse.
- N-5: `HOST` vacío o con espacios (`HOST=""`, `HOST="  "`) → `127.0.0.1`.
- N-6: `HOST` exportado por el shell con nombre de máquina (`HOST=$(hostname)`) → no arranca con el mensaje de `HOST` (riesgo documentado).

### Pruebas de integración (WhatsApp)

- I-1: humo en las landings `/molotes` y `/birria` del servidor de QA: el CTA de WhatsApp sigue presente con `href` según `WHATSAPP_*` (sin seguir el enlace). Solo regresión; el ticket no toca WhatsApp.

### Pruebas de regresión

- R-1: CA-11 — las pruebas existentes de `production`/`development`/`test` (cookie `Secure`, puerta HTTPS de `/admin`, stack solo en `development`, Twilio prohibido, `DATA_DIR` absoluta) siguen en verde y no fueron modificadas (`git diff main -- tests/` limitado a `config.test.ts`, `process.ts` y el archivo nuevo; revisión de que la prueba reemplazada de valores por defecto no debilitó cobertura).
- R-2: consumidores de `startServer` (`tests/support/process.ts`), p. ej. `server-startup.test.ts`, en verde.
- R-3: `scripts/bot-chat.ts` (fija `development` y usa `DEFAULTS.BUSINESS_TIMEZONE`): `npm run typecheck` y un arranque breve del simulador (sale sin error de configuración; se cierra con EOF).
- R-4: `admin:recover` usa `loadDatabaseConfig` (no lee `NODE_ENV`): ejecución con `--usuario` inválido y sin `NODE_ENV` → mensaje de uso, no de `NODE_ENV`.
- R-5: imagen `migrate` construye y no depende de `HOST` (ya fija `NODE_ENV=production`).
- R-6: apagado limpio con `SIGTERM` tras el cambio a `await once(...)`: código 0 y log de cierre como antes.
- R-7: `npm run typecheck`, `npm run lint` (0, sin avisos) y `npm run build:css`.
- R-8: `scripts/dev-server.ts` no se copia a la imagen `production` (`docker run --rm --entrypoint ls restaurante:production scripts`).

### Pruebas automatizadas

Existentes a ejecutar (sin crear ni modificar pruebas en QA salvo hallazgo que lo justifique, que se reportaría):

- A-1: `env -u NODE_ENV npm test` completa (esperado: 77 archivos en verde; el único "expected fail" es el `it.fails` intencional de `local-server.test.ts`).
- A-2: `NODE_ENV=production npx vitest run tests/unit/config.test.ts` (la suite fuerza `test`).
- A-3: `docker compose run --rm test` (verde; anotar omitidas e identificar cuáles: se espera solo la de `DATA_DIR` sin permisos por correr como root, preexistente, y las de IPv6 si el contenedor no tiene loopback IPv6).
- A-4: `npx vitest run tests/integration/server-startup-config.test.ts --reporter=verbose` en macOS: 17/17 sin omitidas.
- A-5: revisión de las pruebas nuevas: no reproducen la implementación, comprueban la ausencia del valor recibido, usan `listenLocal`/`127.0.0.1` según la regla de lint, y no dejan procesos (`pgrep` tras la suite).

### Pruebas en navegador

- B-1 (humo): servidor de QA con `NODE_ENV=development PORT=<libre> npm start` (o `npm run dev`) sin `HOST`. En Chrome, `http://127.0.0.1:<PORT>/molotes` y `/birria` cargan sin errores de consola, con estilos y CTA de WhatsApp visibles; `GET /` responde. Una vista móvil (375×812) y una de escritorio (1440×900) solo como humo, sin evaluación visual completa (no hay cambios visuales).
- Si la extensión no responde, se sustituye por `curl` (código 200, `<title>` y CTA presentes) y se marca la parte visual como pendiente de revisión manual; ningún CA depende de ella.

### Docker

- D-1 (CA-9): `docker build --target production -t restaurante:qa-015 .`; `docker create` sin `HOST` con un puerto publicado libre en `127.0.0.1`, `DATABASE_URL` del usuario DML hacia una base de pruebas migrada (`restaurante_test_*`, creada con el soporte de pruebas o la imagen `migrate` y borrada al terminar), `DATA_DIR` absoluta y WhatsApp ficticios; `docker network connect`; esperar `healthy`; `docker logs` con `"host":"0.0.0.0"`; `docker exec ... netstat -tln` (o `ss`) con `0.0.0.0:3000`; `curl` desde el host 200. Variante: `-e HOST=127.0.0.1` → el healthcheck sigue `healthy` (wget a `127.0.0.1`), pero el puerto publicado no responde (prevalece el valor del entorno, RF-9). Limpieza de contenedores, imagen y base.
- D-2: revisión del paso CA-9 de `.github/workflows/ci.yml` (orden respecto a "migrate", red, limpieza, salida con error y `docker logs` en fallo).

### Pruebas de documentación

- DOC-1 (CA-10): `README.md`, `.env.example`, `docs/desarrollo.md`, `docs/despliegue.md`: `NODE_ENV` obligatoria (sin "por defecto: development"), `HOST` con valor por defecto `127.0.0.1`, restricción a IP literales y `localhost` no válido, `npm run dev` fija `development`, `npm start` no lo fija, `HOST=0.0.0.0` para la red local, la imagen fija `HOST=0.0.0.0`; ningún documento dice que la app escucha en todas las interfaces por defecto. `grep -n "todas las interfaces\|por defecto: development\|localhost:3000"` y revisión de cada coincidencia en contexto.

### Pruebas responsive, accesibilidad, UX/UI, performance y SEO

No aplican: el ticket no modifica vistas, CSS, JS de navegador ni contenido. Solo el humo B-1 confirma que las landings siguen sirviéndose igual.

### Evidencia requerida

- Salidas de `npm test`, `typecheck`, `lint`, `build:css` y `docker compose run --rm test` (resúmenes con conteos).
- Para cada prueba manual: comando, código de salida, extracto de stderr/log (`server_started`, `server_listen_failed`) y salida de `lsof`/`curl`.
- Resultado del centinela de MySQL (número de conexiones).
- Docker: `docker inspect` (estado de salud), `docker logs` filtrado, `netstat` dentro del contenedor y `curl` desde el host.
- Captura o texto de página del humo en navegador (o `curl` como sustituto).
- Comprobación final de que no quedan procesos ni contenedores de QA, y de que `git status` solo cambió el ticket.

### Criterios de aprobación

- CA-1 a CA-14 en PASS con evidencia (CA-9: PASS en local; el paso del CI queda indicado para el PR).
- `npm test` en verde (el único "expected fail" admitido es el `it.fails` intencional preexistente), `typecheck` y `lint` con 0.
- Ningún mensaje de error de configuración ni de escucha repite valores recibidos.
- Sin defectos `BLOCKER` ni `CRITICAL`; `MAJOR` solo con decisión explícita del usuario.
- Sin regresiones en arranque/apagado, pruebas de arranque existentes, landings, `bot-chat`, `admin:recover` ni imágenes Docker.

## QA Report

### Ronda

1 (2026-10-10). QA Action Plan aprobado por el usuario: "Aprobar".

### Pruebas ejecutadas

- Rama `feature/REQ-F-015-configuracion-segura`. `npm run build:css` 0, `npm run typecheck` 0, `npm run lint` 0 (sin avisos).
- A-1 `env -u NODE_ENV npm test`: 77/77 archivos; 1503 pasan + 1 expected fail (el `it.fails` intencional de `tests/integration/local-server.test.ts:87`, REQ-F-011, idéntico en `main`).
- A-2 `NODE_ENV=production npx vitest run tests/unit/config.test.ts`: 115/115 (la suite fuerza `test`).
- A-3 `docker compose run --rm test` (imagen reconstruida): 77/77; 1502 pasan, 1 expected fail, 1 omitida (`server-startup.test.ts`, `DATA_DIR` sin permisos con root, preexistente).
- A-4 `npx vitest run tests/integration/server-startup-config.test.ts --reporter=verbose` en macOS: 17/17, ninguna omitida (incluidas CA-6 por interfaz no loopback y CA-12 IPv6).
- A-5 tras la suite: `pgrep -fl dev-server.ts` sin procesos.
- Manuales con `node src/server.ts` en entorno limpio (`env -i`) y `DATABASE_URL` hacia un centinela TCP en `127.0.0.1:3199`: F-1, F-2, F-4, N-1, N-2 (13 arranques) → código 1, ningún `server_started`, ningún puerto en `lsof`, centinela con `connections=0`, sin stack.
- Manuales con el `.env` real (sin modificarlo; el entorno gana al archivo), puertos 3110-3123: F-8a/b/c, F-9, F-10, F-11, F-12, N-3, N-4, N-5, `npm start` y `npm run dev` literales.
- D-1: imágenes `production` y `migrate` construidas en local (`restaurante:qa-015*`), base `restaurante_test_qa015` (`utf8mb4_es_0900_as_cs`) migrada con la imagen `migrate`, contenedor con `-p 127.0.0.1:3130:3000` sin `HOST`, y variante con `-e HOST=127.0.0.1`. Limpieza: contenedores, imágenes y base eliminados.
- B-1: humo en Chrome contra `http://127.0.0.1:3140`.

### Criterios de aceptación

| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | Sin `NODE_ENV`, `""` y `"  "`: exit 1, stderr "NODE_ENV es obligatorio: debe ser uno de development, production, test", 0 `server_started`, `lsof :3110` vacío, centinela MySQL `connections=0`; integración 3/3 |
| CA-2 | PASS | Sin `NODE_ENV` + `PORT=abc`: stderr lista ambos problemas; unitaria e integración |
| CA-3 | PASS | Unitarias (115/115); manual `staging`, `Production`, `TEST` → "NODE_ENV debe ser uno de: development, production, test", sin el valor |
| CA-4 | PASS | `npm run dev` literal con el `.env` real (sin `NODE_ENV`) y con `NODE_ENV=production` en el entorno: `server_started` con `nodeEnv: development`, `host: 127.0.0.1`; integración con `.env` temporal sin `NODE_ENV` y con `production` |
| CA-5 | PASS | A-1, A-2, A-3 |
| CA-6 | PASS | `development`/sin TRUST_PROXY, `production`/`TRUST_PROXY=true`, `test`/`false`: `lsof` `127.0.0.1:<PORT>`, 200 en `127.0.0.1`, conexión rechazada por `192.168.10.191` y `[::1]`, log `host: 127.0.0.1` |
| CA-7 | PASS | `HOST=0.0.0.0`: `lsof` `*:3113`, 200 por `127.0.0.1` y por `192.168.10.191`, log `host: 0.0.0.0` |
| CA-8 | PASS | `localhost`, `999.1.1.1`, `abc def`, `127.0.0.1:3000` (y `[::1]`, `MacBookPro.lan`): exit 1, "HOST debe ser una IP literal IPv4 o IPv6 (…), no un nombre de máquina", sin el valor recibido, sin puerto, 0 conexiones a MySQL |
| CA-9 | PASS (local) | Sin `HOST` en ejecución: `HOST=0.0.0.0` de la imagen, `healthy`, `server_started` con `host: 0.0.0.0`, `netstat` `0.0.0.0:3000`, `curl http://127.0.0.1:3130/molotes` 200. Variante `-e HOST=127.0.0.1`: `healthy`, log `host: 127.0.0.1`, puerto publicado rechazado (prevalece el entorno, RF-9). Paso del CI revisado; su ejecución real queda para el PR |
| CA-10 | PASS | Revisión de `README.md`, `.env.example`, `docs/desarrollo.md`, `docs/despliegue.md`: `NODE_ENV` obligatoria, `HOST` con `127.0.0.1` por defecto e IP literales, `npm run dev` fija `development`, `npm start` no, `HOST=0.0.0.0` para la red local. Las menciones de "todas las interfaces" se refieren a supertest, al contenedor o a `0.0.0.0`/`::` explícitos; ninguna dice que sea el valor por defecto |
| CA-11 | PASS | Suite completa en verde; el diff de pruebas frente a `main` solo reemplaza la prueba de valores por defecto de `NODE_ENV`; con `.env` real y `NODE_ENV=production` la app sigue rechazando Twilio ("twilio no se permite con NODE_ENV=production") |
| CA-12 | PASS | `HOST=::1`: `lsof` `[::1]:3114`, 200 por `[::1]`, rechazado por `127.0.0.1`; `HOST=::`: `*:3115`, 200 por `[::1]`, `127.0.0.1` y la IP de la LAN |
| CA-13 | PASS | `HOST=0.0.0.0` + `TRUST_PROXY=true`: mismos mensajes `warn` (`admin_bootstrap_ignored`) que el arranque de referencia; `host: 0.0.0.0`, `trustProxy: true` |
| CA-14 | PASS | `npm start` literal con el `.env` real (sin `NODE_ENV`): exit 1, "NODE_ENV es obligatorio…", sin puerto; integración con `.env` temporal con `NODE_ENV=production` → arranca con `nodeEnv: production` |

Casos límite: `::ffff:127.0.0.1` arranca y escucha en `127.0.0.1` (PASS); `HOST=""`/`"  "` → `127.0.0.1` (PASS); `HOST=192.0.2.1` → exit 1 inmediato, stderr "No se pudo escuchar … (EADDRNOTAVAIL): revisa que HOST …", log `server_listen_failed` con solo `code`, sin la IP ni el puerto (PASS); puerto ocupado → exit 1, `EADDRINUSE`, mismo formato (PASS); `HOST` con nombre de máquina → rechazado (PASS).

### Defectos encontrados

Ninguno.

### Regresión

- `startServer` compartido: `server-startup.test.ts` y demás pruebas de arranque en verde; sin procesos huérfanos.
- Apagado con `SIGTERM` tras el cambio a `await once(...)`: `server_stopping` y código 0 en todos los arranques manuales.
- `scripts/bot-chat.ts` sin `NODE_ENV`: arranca el simulador y termina con EOF sin error de configuración.
- `admin:recover` sin `NODE_ENV`: llega a la validación de contraseña (no pide `NODE_ENV`).
- Imagen `migrate`: construye y aplica migraciones. `scripts/dev-server.ts` no está en la imagen `production` (`ls scripts`: `admin-recover.ts`, `hash-password.ts`, `support`).
- Landings: `/molotes`, `/birria` y `/` (sábado → Birria) con 200, un `h1`, CTA de WhatsApp `https://wa.me/<número>?text=…` con `target="_blank"` y `rel="noopener noreferrer"`, sin errores de consola ni overflow horizontal.

### Responsive

No aplica (sin cambios visuales). Humo de escritorio sin overflow horizontal.

### Accesibilidad

No aplica (sin cambios de marcado). Un `h1` por landing.

### UX/UI

No aplica.

### Performance

Sin impacto en ejecución. La prueba de arranque nueva tarda ~13 s en total en macOS.

### SEO

No aplica; `title` de cada landing sin cambios.

### Pendientes de revisión manual

- Ejecución del paso CA-9 en GitHub Actions al abrir el PR (validado en local con el mismo guion).
- Nota del entorno (no es defecto): el `.env` local del usuario no define `NODE_ENV`, así que `npm start` con ese `.env` ya no arranca (efecto buscado y documentado); `npm run dev` sí.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Borrador inicial a partir de F-05 y de la parte de `HOST` de F-01, con cinco preguntas abiertas.

### Versión 2

Se incorporan las respuestas del usuario:

- `HOST` es `127.0.0.1` por defecto siempre y solo acepta IP literales;
- la imagen `production` fija `HOST=0.0.0.0`;
- no hay aviso con `TRUST_PROXY=true`;
- `npm start` no fija `NODE_ENV`.

Se ajustan RF-6, RF-7, RF-9 y CA-6, CA-8 y CA-9. Se añaden RF-11, RF-12 y CA-12 a CA-14, además de los casos límite de `localhost`, `::ffff:` e IP inexistente.

### Revisión técnica (T1, 2026-10-10)

senior-fullstack agrega la revisión técnica y el Technical Action Plan, sin bloqueos. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (T2, 2026-10-10)

senior-fullstack implementa el Technical Action Plan aprobado ("Aprobar", incluida la aceptación de IPv6 con zona). Ticket movido a `in-progress/`. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (Q1, 2026-10-10)

senior-qa analiza la implementación aprobada ("Aprobar") y agrega el QA Action Plan. Se verifica que el único "expected fail" de la suite es el `it.fails` intencional de `tests/integration/local-server.test.ts:87` (REQ-F-011), igual en `main`. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, ronda 1, 2026-10-10)

senior-qa ejecuta el QA Action Plan aprobado ("Aprobar"): CA-1 a CA-14 en PASS (CA-9 en local), sin defectos, suite, typecheck y lint en verde. Estado: `QA_APPROVED`.

### Commit y Pull Request (T4, 2026-10-10)

Commit `77b9201` (`feat: exige NODE_ENV al arrancar y escucha solo en 127.0.0.1 salvo HOST explícito`). Pull Request: https://github.com/orvigas/negocio/pull/40 hacia `main`. CI del PR (run 38110071102): `calidad` pass (7m55s), `docker` pass (3m48s), con el paso CA-9 "imagen production escucha en 0.0.0.0 y queda healthy" en verde. Estado: `READY_FOR_MERGE`.
