# REQ-F-014 — Migración de la base de datos a MySQL 8.4

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-10-09). Cita textual: "apruebo REQ-F-014 v2". La aprobación incluye el plazo máximo de 60 s de reintentos al arrancar (RF-6 y CA-7), que se presentó al usuario de forma explícita.

Decisiones del usuario en las que se basa:

- Respuesta al análisis técnico (2026-10-09): "todas las recomendadas, la colación de la BD debe soportar idioma español con todos sus simbolos".
- Respuesta al borrador v1 (2026-10-09): "todas las recomendadas, español moderno, mi dominio es birriaelmuneco.com".

## Origen

Solicitud textual del usuario: "Voy a usar un VPS en hostinger con docker, y necesito cambiar la base de datos a MySQL y preparar todos los detalles para poder desplegar la aplicación ahí, quiero que me hagas un analisis de lo que debe tener el VPS con docker para el despliegue de la ap considerando el reporte owasp y todas las medidas de seguridad para poder tener un entorno de producción".

Fuentes:

- `.claude/docs/reports/VPS-DOCKER-MYSQL-2026-10-09-analisis.md` (análisis técnico de senior-fullstack; no versionado);
- `.claude/docs/reports/OWASP-2026-10-09-auditoria.md` (auditoría de seguridad; no versionada).

Es el primer ticket del roadmap de despliegue (ver el anexo).

## Objetivo

Sustituir SQLite por MySQL 8.4 LTS como única base de la aplicación. Debe guardar y devolver intacto cualquier texto en español con todos sus símbolos y emojis. Las landings, `/admin`, la API y el bot no cambian, y la base queda lista para el despliegue en el VPS con Docker.

## Decisiones confirmadas

| ID | Decisión |
|----|----------|
| D-1 | MySQL 8.4 LTS, en un contenedor del VPS (no gestionado). |
| D-2 | No hay datos reales que migrar: se empieza con MySQL vacío. Se descarta `data/restaurante.db` y no hay ticket de migración de datos. |
| D-3 | Un proceso aparte (`migrate`) aplica las migraciones con un usuario de esquema (DDL). La app usa un usuario solo de datos (DML), no migra al arrancar y solo verifica el estado. |
| D-4 | `utf8mb4` en servidor, base, tablas, columnas, conexión y respaldos. Ningún texto puede usar `utf8`/`utf8mb3`. |
| D-5 | Colación **`utf8mb4_es_0900_as_cs`** (español moderno): la ñ va después de la n, y distingue acentos y mayúsculas. |
| D-6 | SQLite desaparece por completo: dependencias, migraciones, código y documentación. El store de productos en memoria se queda para las pruebas unitarias. |
| D-7 | El usuario de acceso sigue siendo único sin distinguir mayúsculas, como hoy. Lo garantiza la aplicación al normalizar a NFC y minúsculas, no la colación. "jose" y "josé" son usuarios distintos. senior-fullstack lo verifica en la revisión técnica. |
| D-8 | Una sola instancia de la app. |
| D-9 | Desarrollar y probar requiere Docker o un MySQL 8.4 local. |
| D-10 | Este ticket modifica `.claude/agents/senior-fullstack.md` (stack de base de datos) y añade a `.claude/rules/testing.md` la regla de la base de pruebas. El usuario ve el cambio exacto al aprobar la implementación. |

## Alcance

- Proveedor MySQL en Prisma con un adaptador y su driver (versiones exactas), y retirada de SQLite.
- Una migración inicial nueva para MySQL. Las de SQLite se retiran y quedan en el historial de git.
- Configuración: `DATABASE_URL` (app) y `MIGRATION_DATABASE_URL` (solo `migrate`), validadas y secretas.
- Verificación de la base al arrancar, en lugar de migrar.
- Invariante del último administrador (D-7 de REQ-F-007) correcto con concurrencia real.
- `admin:recover` sobre MySQL.
- Pruebas contra MySQL 8.4 real, en local y en el CI, con una salvaguarda contra bases que no son de prueba.
- MySQL local para desarrollo y pruebas en `compose.yaml`, solo en `127.0.0.1`.
- Etapa `migrate` del Dockerfile. El CI la construye junto con `production`.
- Documentación: README, `docs/desarrollo.md` y `.env.example`. En `docs/despliegue.md` se retiran o se marcan las instrucciones de SQLite. También `.claude/agents/senior-fullstack.md` y `.claude/rules/testing.md` (D-10).

## Fuera de alcance

- El compose de producción, las redes, los secretos de Docker, la creación de usuarios de MySQL en el VPS y la configuración endurecida de MySQL (REQ-F-016).
- Proxy, TLS y dominio (REQ-F-017); respaldos (REQ-F-019); publicación y despliegue (REQ-F-021).
- `HOST` y `NODE_ENV` obligatorio (REQ-F-015).
- Migrar datos de SQLite (D-2).
- Funciones nuevas, cambios de UI y tablas nuevas.
- Varias réplicas.
- `CLAUDE.md`: no menciona SQLite y no cambia en este ticket.

## Requisitos

- **RF-1. Persistencia.** Todo lo que hoy guarda SQLite pasa a MySQL con los mismos datos y relaciones: usuarios, negocios por usuario, auditoría de usuarios, productos, variantes, chips, cambios de productos e importación. Los JSON de página y `changes.jsonl` siguen en `DATA_DIR`.
- **RF-2. Sin cambios funcionales.** Landings, `/admin`, la API y el bot responden igual: mismos códigos HTTP, mensajes, validaciones, permisos, CSRF, conflictos de versión (409) y snapshots de las landings. La única excepción aceptada es el orden alfabético en español (RF-3).
- **RF-3. Español completo.** Cualquier texto con ñ, vocales acentuadas, ü, ¿, ¡, «», €, otros símbolos y emojis (caracteres de 4 bytes) se guarda y se devuelve idéntico por todas las vías: formulario, API, landing, auditoría y bot. Todo usa utf8mb4 con la colación de D-5, sin excepciones por tabla ni por columna. Los listados ordenados por texto siguen el orden del español moderno.
- **RF-4. Longitudes.** Cada campo de texto acepta al menos el máximo que hoy permite la validación de la app, incluso escrito solo con emojis. Algunos ejemplos son el usuario y el nombre visible (60), el nombre de producto y la descripción (400); senior-fullstack hace el inventario exacto. El JSON de cambios de auditoría se guarda completo. Un texto demasiado largo nunca se recorta en silencio: o lo rechaza la validación o la base devuelve un error.
- **RF-5. Configuración.** `DATABASE_URL` es obligatoria en todos los entornos y se valida (esquema, host, puerto y nombre de base). Ni su valor ni la contraseña aparecen en logs, errores ni respuestas; el error solo dice que la variable no es válida o falta. `MIGRATION_DATABASE_URL` solo la usa el proceso de migración. Se documenta cómo escribir contraseñas con caracteres especiales.
- **RF-6. Migraciones.** Se aplican con un proceso aparte y con el usuario de esquema. La app funciona con un usuario solo de DML. Al arrancar, la app verifica el estado de la base. Si encuentra alguno de estos casos, termina con código 1 y un log `database_init_failed` con un código estable, sin SQL, URL, credenciales ni stack:
  - base inalcanzable tras reintentos durante un máximo de 60 s;
  - credenciales inválidas;
  - charset o colación incorrectos en la base, las tablas o las columnas;
  - modo estricto ausente;
  - migración pendiente;
  - base más nueva que el código;
  - migración modificada;
  - migración incompleta o fallida.
- **RF-7. Último administrador con concurrencia.** Ninguna combinación de operaciones simultáneas deja cero administradores activos. Esto incluye dos peticiones HTTP y una petición en paralelo con `admin:recover`. La operación rechazada recibe el aviso de hoy (409, "Debe quedar al menos un administrador activo.") y no cambia nada. Si el conflicto no se resuelve tras reintentos acotados, devuelve 503 sin cambios.
- **RF-8. Productos.** La atomicidad (producto, variantes, chips y registro de cambios en una misma transacción) y el control optimista de versiones se mantienen.
- **RF-9. Fallo de la base en marcha.** Se mantiene el comportamiento de REQ-F-008:
  - landings en 200 desde la caché;
  - `/admin` en 503 HTML;
  - API en 503 JSON `DATABASE_UNAVAILABLE`;
  - log `database_unavailable` solo con códigos;
  - se recupera sola sin reiniciar.
- **RF-10. Primer arranque.** Con la base vacía y migrada, la app importa los productos (de `current.json`, `previous.json` o la semilla) y crea el primer administrador con `ADMIN_USER` y `ADMIN_PASSWORD_HASH`, como hoy.
- **RF-11. `admin:recover`.** Funciona con `DATABASE_URL` y no migra. Con una base sin migrar o inalcanzable termina con código 1 y un mensaje controlado.
- **RF-12. Fechas.** Las fechas se guardan en UTC con milisegundos. Las fechas que se muestran y el orden de la auditoría no cambian.
- **RF-13. Pruebas.** La suite corre contra MySQL 8.4 real, en local y en el CI:
  - si MySQL no está disponible, falla con un mensaje que dice cómo levantarlo; nunca se salta;
  - una salvaguarda rechaza cualquier conexión de prueba a un host o a una base que no sean de prueba;
  - el CI comprueba que el esquema y las migraciones no divergen.
- **RF-14. Desarrollo local.** MySQL local se levanta con un comando documentado, escucha solo en `127.0.0.1` y aplica las migraciones con un comando.
- **RF-15. Imágenes.** La imagen `production` no contiene SQLite ni el CLI de Prisma. Existe una imagen `migrate` que solo aplica migraciones. El CI construye las dos.
- **RF-16. Instrucciones del proyecto.** `.claude/agents/senior-fullstack.md` describe MySQL, el proceso `migrate` y la verificación al arrancar. `.claude/rules/testing.md` incluye la regla de la base de pruebas: solo bases de prueba, nunca una real.

## Historias de usuario

- **HU-1.** **Como** dueño **quiero** escribir nombres y descripciones con ñ, acentos, signos y emojis **para** que el menú se vea exactamente como lo escribí.
- **HU-2.** **Como** dueño **quiero** que la app use una base MySQL con un usuario de privilegios mínimos **para** desplegarla con seguridad en el VPS.
- **HU-3.** **Como** administrador **quiero** que nunca pueda quedarme sin administradores activos, ni siquiera con acciones simultáneas, **para** no perder el acceso a `/admin`.
- **HU-4.** **Como** desarrollador **quiero** probar contra el mismo motor que en producción **para** detectar las regresiones antes del VPS.

## Reglas de negocio

- **RN-1.** Siempre hay al menos un administrador activo.
- **RN-2.** El usuario de acceso es único sin distinguir mayúsculas, con normalización NFC. "jose" y "josé" son distintos.
- **RN-3.** Ningún texto válido se altera, se recorta ni se sustituye al guardarlo.
- **RN-4.** La app nunca modifica el esquema de la base.

## Criterios de aceptación

- **CA-1 (español y emojis de punta a punta).**
  - **Given** la app sobre MySQL, **When** un administrador guarda por `/admin`, y por la API, un producto con nombre `Ñandú ¿Qué? ¡Sí! «Pingüino» 🌮` y una descripción que incluye `€`, **Then:**
    - la API, el formulario de edición y la landing devuelven exactamente esa cadena (mismos code points, en NFC);
    - el valor guardado, leído en hexadecimal, es su UTF-8 exacto (🌮 = `F09F8CAE`);
    - el registro de cambios lo conserva igual.
  - **And** lo mismo se cumple para el nombre visible de un usuario.
- **CA-2 (charset y colación).** El catálogo de MySQL muestra `utf8mb4` y `utf8mb4_es_0900_as_cs` en la base, en **todas** las tablas de la aplicación y en **todas** sus columnas de texto. La única excepción es `_prisma_migrations`, la tabla interna de Prisma: solo debe ser `utf8mb4` (Prisma la crea siempre con `utf8mb4_unicode_ci`). Si la base o alguna tabla o columna no cumple, la app no arranca (código 1, `database_init_failed` con el código de charset o colación inválidos). *(Ajustado por P-1, aprobado por el usuario el 2026-10-09.)*
- **CA-3 (longitudes).** Para cada campo de texto se guardan completos y se leen idénticos:
  - un valor con la longitud máxima que permite la app, escrito solo con emojis;
  - otro escrito con letras acentuadas.

  También se guarda completo el registro de cambios de la edición más grande posible (6 variantes con descripciones de longitud máxima). Ningún caso recorta el texto.

  Además (P-3): una sal de `ADMIN_PASSWORD_HASH` de más de 64 bytes da el error de configuración de siempre, y una ruta de imagen de más de 255 caracteres da 422 "La ruta es demasiado larga".
- **CA-4 (usuarios y orden).**
  - Crear `jose` y después `josé` → los dos existen.
  - Crear `Jose`, `  JOSE  ` o `José` en NFD cuando ya existe `jose` o `josé` en NFC → 422 de CA-9 (REQ-F-007), sin guardar nada.
  - El listado ordenado de `ana`, `zoe`, `ñandu` y `oscar` queda `ana`, `ñandu`, `oscar`, `zoe`.
- **CA-5 (último administrador con concurrencia).**
  - Dos desactivaciones simultáneas de los dos únicos administradores, ejecutadas al menos 50 veces seguidas contra MySQL real → en todas las repeticiones queda exactamente un administrador activo. Una recibe el éxito y la otra el 409 (o un 503 sin cambios).
  - Con la desactivación por HTTP en paralelo con `admin:recover`, en todas las repeticiones queda al menos un administrador activo, el resultado es equivalente a alguna ejecución en serie y la auditoría registra exactamente lo aplicado. *(Ajustado por P-2, aprobado por el usuario el 2026-10-09.)*
- **CA-6 (menor privilegio).** La app arranca y pasa la suite con un usuario sin privilegios DDL (`CREATE`, `ALTER`, `DROP`). El proceso de migración, con el usuario de esquema, crea el esquema en una base vacía y termina con código 0.
- **CA-7 (verificación al arrancar).** Cada caso termina con código 1, un `database_init_failed` con un código estable y ningún secreto, SQL ni stack en la salida:
  - inalcanzable (en un máximo de 60 s);
  - credenciales inválidas;
  - migración pendiente;
  - base más nueva que el código;
  - migración modificada;
  - migración incompleta;
  - colación incorrecta;
  - modo estricto ausente.
- **CA-8 (configuración y secretos).** Si falta `DATABASE_URL`, o no es válida (otro esquema, sin host o sin base), se produce un error de configuración que no incluye el valor. En los logs de toda la suite y de un recorrido completo (acceso, edición, cambio de contraseña y pedido del bot) no aparecen la URL, contraseñas, hashes ni tokens.
- **CA-9 (primer arranque).** Con la base vacía y migrada:
  - se registran `products_imported` (10 Molotes y 6 Birria desde la semilla) y `admin_bootstrap_created`;
  - `/molotes` y `/birria` coinciden byte a byte con los snapshots actuales.
- **CA-10 (fallo en marcha).** Con MySQL detenido y el servidor en marcha, se cumple RF-9. Al volver MySQL, `/admin` y la API responden 200 sin reiniciar la app.
- **CA-11 (`admin:recover`).** Sobre una base migrada restablece el acceso y deja la auditoría (CA-15 de REQ-F-007). Sobre una base sin migrar termina con código 1 y un mensaje controlado.
- **CA-12 (pruebas).**
  - `npm run typecheck`, `npm run lint` y `npm test` terminan en verde en local y en el CI, contra MySQL 8.4.
  - Sin MySQL, `npm test` falla con un mensaje que dice cómo levantarlo.
  - Con una URL de prueba hacia otro host o hacia una base sin el prefijo de prueba, la suite se niega a ejecutarse.
  - El CI falla si el esquema y las migraciones divergen.
  - Se entrega la lista de cada prueba de SQLite eliminada y su sustituta.
- **CA-13 (sin SQLite).** `package.json`, el lockfile y las imágenes `production` y `migrate` no contienen `better-sqlite3` ni su adaptador. La imagen `production` no contiene el CLI de Prisma. El CI construye las dos imágenes, y la de `migrate` aplica el esquema sobre un MySQL de prueba con código 0.
- **CA-14 (desarrollo).** Con los comandos de `docs/desarrollo.md`, un desarrollador levanta MySQL local (solo en `127.0.0.1`), aplica las migraciones y arranca la app.
- **CA-15 (documentación e instrucciones).** README, `docs/desarrollo.md`, `.env.example`, `docs/despliegue.md`, `.claude/agents/senior-fullstack.md` y `.claude/rules/testing.md` ya no describen SQLite como vigente y documentan `DATABASE_URL`, utf8mb4 con `utf8mb4_es_0900_as_cs`, el proceso de migración y la regla de la base de pruebas.

## Casos límite

- Texto en NFD frente a NFC: el usuario se normaliza; el resto de textos se devuelven como se enviaron.
- Emojis compuestos (familias, banderas, tonos de piel): deben volver idénticos.
- La longitud se mide distinto en JavaScript (UTF-16; un emoji cuenta 2) y en MySQL (caracteres): la columna debe aceptar siempre lo que la validación deja pasar.
- MySQL todavía arrancando cuando arranca la app: debe reintentar hasta 60 s antes de fallar.
- MySQL que se reinicia a mitad de una operación, interbloqueo, espera de bloqueo prolongada: 503 sin cambios a medias.
- Migración que falla a mitad (el DDL no es transaccional): la app se niega a arrancar y la salida es restaurar el respaldo (runbook en REQ-F-019).
- Contraseña de la base con `@`, `:`, `/` o `%`.
- `DATABASE_URL` hacia otro motor o hacia una base sin migrar.
- Huecos en los ids autoincrementales: nada depende de ids consecutivos.
- Dos ejecuciones de la suite en paralelo en la misma máquina: las bases no se pisan.

## Dependencias

- Ninguna con otro ticket. Desbloquea REQ-F-016, REQ-F-019, REQ-F-020 y REQ-F-021.
- Docker (o MySQL 8.4 local) en desarrollo; servicio MySQL en el CI.
- **Por verificar en la revisión técnica (senior-fullstack):**
  - el adaptador MySQL oficial de Prisma 7.10 (nombre, versión exacta, compatibilidad con MySQL 8.4 y `caching_sha2_password`) y que no traiga scripts de instalación;
  - la colación que Prisma escribe en los `CREATE TABLE` generados.

## Riesgos

| Riesgo | Impacto | Mitigación esperada |
|--------|---------|---------------------|
| **Último administrador con concurrencia (write skew).** Hoy es correcto porque SQLite tiene un único escritor. En MySQL (REPEATABLE READ), dos desactivaciones simultáneas pueden dejar cero administradores | Pérdida del acceso a `/admin` | Aislamiento serializable o bloqueo explícito, con reintento acotado ante interbloqueo. CA-5 repetido ≥ 50 veces |
| **DDL no transaccional** | Una migración fallida queda a medias | Respaldo antes de migrar, migraciones pequeñas de tipo expandir y contraer, prueba en el CI, detección al arrancar (CA-7) |
| **Colación de tabla impuesta por Prisma** (`utf8mb4_unicode_ci`, que no distingue acentos ni mayúsculas) | "jose" y "josé" chocarían, el orden no sería el del español y no se cumpliría D-5 | Revisar a mano la migración generada y comprobar las columnas al arrancar (CA-2) |
| **Longitud de los textos** (`String` pasa a `VARCHAR(191)` por defecto) | Descripciones de 400 caracteres y JSON de auditoría rechazados | Longitudes explícitas y CA-3 |
| **Pruebas contra MySQL real** | Suite más lenta (estimación: +20 a 60 s), dependencia de Docker, pruebas de concurrencia intermitentes | Base por trabajador con vaciado entre pruebas, salvaguarda, fallo explícito sin MySQL, repeticiones en CA-5 |
| Adaptador o autenticación incompatibles | Bloqueo técnico | Revisión técnica de senior-fullstack |
| Orden alfabético en español | Listados ordenados de otra forma | Aceptado (D-5, CA-4) |

## Action Plan

### Objetivo

MySQL 8.4 con utf8mb4 y `utf8mb4_es_0900_as_cs` como única base, sin regresiones funcionales y listo para el despliegue.

### Alcance y fuera de alcance

Ver las secciones anteriores.

### Cambios requeridos

1. Cambiar el proveedor a MySQL y añadir el adaptador y el driver con versiones exactas, evaluados según `dependencias.md`. Retirar `better-sqlite3`, su adaptador, sus tipos y su `allowScripts`.
2. Fijar en el esquema longitudes explícitas para cada texto según el inventario de máximos.
3. Crear una migración inicial nueva para MySQL y revisarla a mano: utf8mb4, `utf8mb4_es_0900_as_cs` en tablas y columnas, índices y longitudes. Retirar las migraciones de SQLite.
4. Configuración: `DATABASE_URL` y `MIGRATION_DATABASE_URL` validadas y nunca registradas, y `.env.example`.
5. Sustituir la migración al arrancar por la verificación de RF-6 (reintentos de hasta 60 s), conservando los códigos actuales y añadiendo los nuevos.
6. Repositorio de usuarios: hacer cumplir RN-1 con concurrencia real y reintento acotado.
7. `admin:recover` sobre `DATABASE_URL`, sin migrar.
8. Soporte de pruebas sobre MySQL: base por trabajador, salvaguarda y fallo explícito sin MySQL. Adaptar o sustituir las pruebas específicas de SQLite.
9. `compose.yaml`: MySQL de desarrollo y pruebas solo en `127.0.0.1`. El servicio de pruebas sigue sin salida a internet.
10. Dockerfile: etapa `migrate` y `production` sin SQLite. CI: servicio MySQL 8.4, comprobación de divergencia, build de las dos imágenes.
11. Documentación e instrucciones del proyecto (CA-15, D-10).

### Reglas de negocio

RN-1 a RN-4.

### UX/UI

Sin cambios visuales. Solo cambia el orden alfabético en español de los listados ordenados por texto. No hay diseño de `_stich_source_/` implicado.

### Integraciones

MySQL 8.4 y GitHub Actions (servicio MySQL). El bot de WhatsApp no cambia.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-15.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. Esquema y migración.
2. Configuración.
3. Verificación al arrancar.
4. Soporte de pruebas y adaptación de la suite.
5. Último administrador.
6. `admin:recover`.
7. Docker y CI.
8. Documentación e instrucciones.

### Resultado esperado

La app corre sobre MySQL con un usuario de privilegios mínimos y conserva cualquier texto en español con emojis. La suite pasa contra MySQL en local y en el CI, y no queda rastro de SQLite.

## Trazabilidad

| Objetivo | Requisitos | Historia | Criterios | Action Plan |
|----------|-----------|----------|-----------|-------------|
| Español completo | RF-3, RF-4, D-4, D-5 | HU-1 | CA-1, CA-2, CA-3, CA-4 | 2, 3 |
| Menor privilegio y despliegue | RF-5, RF-6, RF-15, D-3 | HU-2 | CA-6, CA-7, CA-8, CA-13 | 4, 5, 10 |
| Integridad de usuarios | RF-7, RF-11, RN-1, RN-2 | HU-3 | CA-4, CA-5, CA-11 | 6, 7 |
| Sin regresiones | RF-1, RF-2, RF-8, RF-9, RF-10, RF-12, RF-13, RF-14 | HU-4 | CA-9, CA-10, CA-12, CA-14 | 8, 9 |
| Documentación e instrucciones | RF-16, D-10 | — | CA-15 | 11 |

## Anexo: roadmap de despliegue en el VPS (contexto)

Este anexo es solo contexto. Los tickets REQ-F-015 a REQ-F-027 **todavía no existen**. Cada uno pasará por su propio ciclo BA → senior-fullstack → QA, y las decisiones registradas aquí se validarán de nuevo cuando se redacte su ticket.

Los números de los informes eran provisionales: REQ-F-014 a 020 en el de OWASP y REQ-F-021 a 028 en el del VPS. Los definitivos son los de esta tabla.

| ID | Título | Objetivo | Depende de | Decisiones del usuario ya tomadas (2026-10-09) | Correspondencia en los informes |
|----|--------|----------|------------|-------------------------------------------------|----------------------------------|
| REQ-F-014 | Migración de la base de datos a MySQL 8.4 | Este ticket | — | Este ticket | VPS #2 (REQ-F-021) |
| REQ-F-015 | Configuración segura por defecto (`HOST` y `NODE_ENV`) | Que la app no arranque en modo inseguro ni escuche en todas las interfaces sin pedirlo | — (en paralelo o justo después de 014) | **Si falta `NODE_ENV`, la app no arranca.** `npm run dev` y las pruebas lo fijan de forma explícita | OWASP REQ-F-014 |
| REQ-F-016 | Imagen y compose de producción endurecidos | App, MySQL y migrate en el VPS con privilegios mínimos | 014, 015 | VPS de Hostinger con 2 vCPU, 4 GB de RAM y 50 GB NVMe, Ubuntu 24.04 LTS. MySQL 8.4 en un contenedor sin puertos publicados. Usuarios de BD separados: app solo DML, migrator con DDL y backup de solo lectura. Imágenes por digest. Una sola réplica | VPS #3 (REQ-F-023) |
| REQ-F-017 | Proxy nginx con TLS (certbot) | Cerrar F-01, F-03 y F-06 en el borde | 016 | nginx con certbot. **Dominio `birriaelmuneco.com`, `www` redirigido con 301 al dominio raíz, todo en HTTPS**, sin otros subdominios. Sin Cloudflare o solo DNS. **`/admin` sin restricción por IP**, con límites de peticiones en nginx | VPS #4 (REQ-F-024) |
| REQ-F-018 | Webhook resistente a DoS y logs sin ruido | Defensa en profundidad de F-03 y F-13 | — (antes de salir a producción) | Según OWASP | OWASP REQ-F-016 |
| REQ-F-019 | Respaldos cifrados y restauración probada | Recuperación ante desastres probada | 016 | Respaldo diario cifrado con age en **Backblaze B2 con bloqueo de objetos o versionado**. Clave privada en el gestor de contraseñas de **dos personas**. Restauración de prueba mensual. Dumps en utf8mb4. Retención de 7 diarios, 4 semanales y 6 mensuales (propuesta del análisis, a validar en su ticket) | VPS #6 (REQ-F-025) |
| REQ-F-020 | Cadena de suministro en el CI | `npm audit --omit=dev` con excepciones y Dependabot (npm, actions y docker) | 014 | — | OWASP REQ-F-020 (parte) |
| REQ-F-021 | Publicación en GHCR y despliegue manual | Imágenes verificables y `deploy.sh` con respaldo previo, migración, comprobación de salud y rollback | 016, 019 | GHCR (paquete privado, token de solo lectura en el VPS). **Despliegue manual con deploy.sh**, sin llave del VPS en GitHub. Ventana de mantenimiento de **04:00 a 05:00, hora de México** (también para los reinicios automáticos del SO) | VPS #7 (REQ-F-026) |
| REQ-F-022 | Alertas y monitorización | Que alguien se entere de los fallos | 016 | Alertas por **ntfy y al correo del dueño**. Monitor externo de disponibilidad y aviso si falta el respaldo diario | VPS #8 (REQ-F-027) |
| REQ-F-023 | Guía de despliegue en el VPS y checklist de salida | Documentación final coherente con lo ejecutado | 016 a 022 | Actualiza `CLAUDE.md` y el agente donde cambien hechos, con aprobación en su momento | VPS #13 (REQ-F-028) |
| REQ-F-024 | Límite de intentos robusto y sesión | F-02 y F-12 | — (antes de anunciar el bot) | Necesario porque `/admin` no tendrá restricción por IP. Los umbrales se definen con el BA | OWASP REQ-F-015 |
| REQ-F-025 | Topes de coste y abuso del bot | F-04 | — (antes de anunciar el bot) | Los topes se definen con el BA | OWASP REQ-F-017 |
| REQ-F-026 | scrypt y permisos de `DATA_DIR` | F-07 (la parte del `.db` de F-08 desaparece) | 016 | Medir en el VPS con el `mem_limit` de la app | OWASP REQ-F-019 |
| REQ-F-027 | Cabeceras de seguridad y fuentes | F-09 y F-10 | — | Según OWASP | OWASP REQ-F-018 |

- **Mínimo para salir a producción:** 014, 015, 016, 017, 018, 019, 021, 022 y 023 (020 recomendado), más el límite de gasto en Meta (I-5, lo hace el usuario).
- **Antes de anunciar el bot:** 024 y 025.
- **Descartados:** la migración de datos de SQLite (D-2) y la persistencia de ids del webhook (F-15).
- **Observación para REQ-F-017 y REQ-F-023:** el dominio `birriaelmuneco.com` también servirá la landing de Molotes de lunes a viernes. No cambia ningún comportamiento; puede influir en la percepción de la marca y en el SEO de Molotes.

## Revisión técnica

2026-10-09, senior-fullstack (fase T1, sin cambios de código). Se leyeron `CLAUDE.md`, `.claude/rules/` y el análisis `VPS-DOCKER-MYSQL-2026-10-09-analisis.md`. También se revisaron con CodeGraph y lectura directa: `prisma/`, `prisma.config.ts`, `src/db/*`, `src/server.ts`, `src/config/env.ts`, los repositorios y stores de usuarios y productos, `src/services/{user,product,menu}-schema.ts`, `slug.ts`, `admin-auth.ts`, `scripts/admin-recover.ts`, `tests/support/{database,admin,process}.ts`, las pruebas que usan SQLite, el `Dockerfile`, `compose.yaml`, `.dockerignore`, `.github/workflows/ci.yml` y `package.json`. Hubo red: se consultó el registro de npm con `npm view`, y los tarballs del adaptador y del driver se descargaron con `npm pack` a un directorio temporal, solo para leerlos. No se instaló nada en el proyecto.

### V-1. Adaptador MySQL de Prisma 7.10 (verificado)

| Punto | Resultado |
|-------|-----------|
| Paquete | **`@prisma/adapter-mariadb@7.10.0`** (Apache-2.0, 57 kB). Es el adaptador oficial para `provider = "mysql"`: no existe `@prisma/adapter-mysql` (404 en npm). Declara `provider = "mysql"` y sirve para MySQL y MariaDB. |
| Driver | **`mariadb@3.4.5`**: el adaptador lo fija con versión exacta. Licencia **LGPL-2.1-or-later**: se usa sin modificar como dependencia, y la imagen se publica de forma privada, así que no impone obligaciones prácticas, pero queda anotado. Sus dependencias son `denque`, `lru-cache`, `iconv-lite`, `@types/node` y `@types/geojson` (estos dos son solo tipos, mal clasificados por el autor como dependencias de ejecución). Hay versiones más nuevas (3.4.7 y 3.5.4), pero el adaptador exige 3.4.5. Subirla con `overrides` queda para REQ-F-020 si aparece un aviso de seguridad. |
| Scripts de instalación | **Ninguno** en el adaptador, en `@prisma/driver-adapter-utils` ni en `mariadb` (sus `scripts` son solo de desarrollo: build, test y lint). Se retira la entrada `better-sqlite3@12.11.1` de `allowScripts`. `prisma` y `@prisma/engines` siguen aprobados (el CLI descarga el schema engine). |
| MySQL 8.4 y `caching_sha2_password` | El driver implementa `caching_sha2_password`. El camino rápido (contraseña en la caché del servidor) no necesita RSA. El camino completo (el primero tras reiniciar MySQL) necesita TLS, la clave pública RSA en el cliente (`cachingRsaPublicKey`) **o** `allowPublicKeyRetrieval: true`. Sin ninguna de las tres, falla con `ER_CANNOT_RETRIEVE_RSA_KEY` (45044). **Decisión técnica:** `allowPublicKeyRetrieval: true`, fijado en el código y no en la URL. Así la contraseña viaja cifrada con la clave RSA del servidor. El riesgo (un MITM activo que suplante la clave) solo existe dentro de la red interna de Docker. Si MySQL pasa a ser remoto, TLS será obligatorio (REQ-F-016). |
| Colación de la conexión | El driver conoce `UTF8MB4_ES_0900_AS_CS` (índice 286), así que la conexión se abre en utf8mb4 con esa colación (D-4). |
| Errores | El adaptador traduce los errores del driver a `originalCode` = `errno` (por ejemplo `1062` a `UniqueConstraintViolation`/P2002, `1213` a `TransactionWriteConflict`/P2034, `1045` a `AuthenticationFailed`, y los de conexión del driver, 450xx, a `mysql`). `databaseErrorDetails` sigue sirviendo (solo códigos). Las pruebas que esperan `SQLITE_*` cambian. |
| Transacciones | `startTransaction(isolationLevel)` ejecuta `SET TRANSACTION ISOLATION LEVEL …` y después `BEGIN`: `isolationLevel: 'Serializable'` funciona por transacción. |
| Fechas | El adaptador escribe las fechas en UTC con milisegundos y las lee como texto UTC (`dateStrings`), sin depender de la zona del servidor. Para los `DEFAULT CURRENT_TIMESTAMP(3)`, la sesión fija `time_zone = '+00:00'` (RF-12). |

Evaluación según `dependencias.md`: no hay alternativa nativa (Node no trae cliente MySQL). El driver es el que exige el adaptador oficial, está mantenido (última publicación el 2026-09-01) y no trae código nativo ni scripts de instalación. Sustituye a `better-sqlite3`, que es nativo y tenía script de instalación. Se añaden `@prisma/adapter-mariadb@7.10.0` y `mariadb@3.4.5` (exactas; la segunda, directa porque `src/db/client.ts` importa sus tipos `PoolConfig`). Se retiran `@prisma/adapter-better-sqlite3`, `better-sqlite3` y `@types/better-sqlite3`.

### V-2. Colación que escribe Prisma (verificado en el schema engine 7.10.0)

En el binario del schema engine de `node_modules/@prisma/engines` aparecen las cadenas que genera:

- cada `CREATE TABLE` de un modelo termina en **`) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`**;
- **`_prisma_migrations`** se crea con el mismo sufijo **`utf8mb4_unicode_ci`**, sin forma de configurarlo;
- la base sombra de `migrate dev` se crea con `CREATE DATABASE … CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`. No importa: es temporal.

Prisma no permite declarar la colación por columna en el esquema, y no existe `@db.Collate` para MySQL. Cómo se garantiza `utf8mb4_es_0900_as_cs`:

1. **Base:** `CREATE DATABASE … CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs`, en el script de inicio del MySQL local, en el soporte de pruebas y, en el VPS, en REQ-F-016.
2. **Tablas y columnas:** la migración inicial se genera con `migrate dev --create-only` y se **revisa a mano**: el sufijo de cada `CREATE TABLE` pasa a `utf8mb4_es_0900_as_cs`. Las columnas de texto y los `ENUM` heredan la colación de la tabla. Una prueba estática (`tests/unit/migrations-collation.test.ts`) recorre todos los `migration.sql` y falla si un `CREATE TABLE` no termina con esa colación, o si aparece otra colación u otro juego de caracteres (`utf8mb3`/`utf8`). Así una migración futura generada por Prisma no se cuela sin revisar.
3. **Arranque:** la verificación de RF-6 comprueba la base, las tablas y las columnas en `information_schema` (CA-2).
4. **Riesgo por comprobar en la fase 1:** que `prisma migrate diff --from-migrations … --to-schema …` no marque como divergencia la colación editada a mano (su comparador de MySQL no compara la colación de tablas). Si la marcara, el CI de divergencia se ajusta y lo aviso antes de seguir.

**Problema: `_prisma_migrations` (pregunta P-1).** CA-2 exige la colación en **todas** las tablas, pero esta tabla interna la crea `prisma migrate deploy` con `utf8mb4_unicode_ci`. Es utf8mb4 (cumple D-4) y solo guarda ids, checksums, nombres de migración ASCII y logs del CLI, nunca textos del negocio.

### V-3. Unicidad del usuario (D-7, RN-2) con `utf8mb4_es_0900_as_cs` (verificado)

- La aplicación ya garantiza la unicidad sin distinguir mayúsculas. `usernameKey()` normaliza a NFC y minúsculas, el índice único es sobre `username_key` y `findCredentials` busca por esa clave. La colación distingue acentos y mayúsculas (`as_cs`), así que `jose` y `josé` son claves distintas en el índice (CA-4). `Jose`, `  JOSE  ` y `José` en NFD se convierten en la clave `jose` o `josé` antes de llegar a la base y chocan en el índice: P2002, después `UsernameTakenError` y el 422 de siempre.
- El índice único sigue funcionando: `VARCHAR(128)` en utf8mb4 ocupa 512 bytes, dentro de los 3072 de InnoDB.
- Diferencia de borde aceptable: las colaciones UCA 0900 ignoran algunos caracteres (guion suave U+00AD, ZWJ U+200D, etc.). Por eso `jo­se` y `jose` serían iguales para el índice aunque la app las considere distintas. El efecto es solo un 422 "el usuario ya existe" ante un nombre casi idéntico, nunca dos cuentas que se confundan. Las comparaciones con el texto en NFD y en NFC dan igual, pero la app ya normaliza a NFC.
- El listado ordena por `username_key`: con `es_0900` queda `ana`, `ñandu`, `oscar`, `zoe` (CA-4).
- Los slugs son ASCII en minúsculas con guiones (no son ignorables en UCA 0900), así que el índice `(business, slug)` no cambia de comportamiento.

### V-4. Inventario de longitudes (RF-4)

La validación de la app mide en **puntos de código**: `textLength = [...value].length` en `menu-schema.ts` y `length` en `user-schema.ts`. No mide en unidades UTF-16. `VARCHAR(n)` en utf8mb4 también cuenta caracteres (puntos de código, hasta 4 bytes cada uno), así que **`VARCHAR(máximo de la app)` acepta siempre lo que la validación deja pasar**, también escrito solo con emojis. Los emojis compuestos (familias, banderas, tonos) son varios puntos de código para los dos lados por igual. Con el modo estricto, un texto más largo da error (1406), nunca se recorta.

| Tabla.columna | Máximo de la app (origen) | Tipo MySQL |
|---------------|---------------------------|------------|
| `user.username` | 60 (`USERNAME_MAX_LENGTH`) | `VARCHAR(60)` |
| `user.username_key` | 60 más la expansión de `toLowerCase()` (U+0130 «İ» pasa a 2 puntos de código, máximo 120) | `VARCHAR(128)` (índice único) |
| `user.display_name` | 60 (`DISPLAY_NAME_MAX_LENGTH`) | `VARCHAR(60)` |
| `user.password_hash` | `scrypt$N$r$p$salt$hash`. Con N ≤ 2^20, r ≤ 32, p ≤ 16 y hash ≤ 64 bytes, el tamaño depende de la sal, que **hoy no tiene máximo** en `parsePasswordHash` (pregunta P-3) | `VARCHAR(255)`, con sal ≤ 64 bytes (máximo de unos 200 caracteres) |
| `user.role`, `user_business.business`, `product.business/category/details_type`, `product_change.business`, `product_import.business` | Enums | `ENUM(...)` (Prisma) |
| `user_audit.action` | `AUDIT_ACTIONS` (la más larga: `console_recovery`, 16) | `VARCHAR(32)` |
| `user_audit.actor_kind` | `user`, `console` o `system` | `VARCHAR(16)` |
| `user_audit.changes` | JSON de cambios (usuario y nombre de 60, rol y negocios; por debajo de 1 kB) | `MEDIUMTEXT` (margen; JSON completo) |
| `product.slug` | Base ≤ 54 + `-N`; `KEY_PATTERN` ≤ 60 en las fuentes importadas | `VARCHAR(64)` |
| `product.name` | 80 | `VARCHAR(80)` |
| `product.description` | 400 | `VARCHAR(400)` |
| `product.label` | 40 (badge o tag) | `VARCHAR(40)` |
| `product.price_unit` | 40 | `VARCHAR(40)` |
| `product.image_src` | `IMAGE_SRC_PATTERN` (ASCII) **sin máximo** (pregunta P-3) | `VARCHAR(255)`, con máximo de 255 en la validación |
| `product.image_alt` | 150 | `VARCHAR(150)` |
| `product.tone` | Enum de texto (`MOLOTES_TONES`/`DRINK_TONES`, máximo 9) | `VARCHAR(20)` |
| `product.icon` | `ICON_PATTERN` ≤ 40 | `VARCHAR(40)` |
| `product.details_label`, `portion`, `portion_extra` | 40 | `VARCHAR(40)` |
| `product_variant.label` | 40 | `VARCHAR(40)` |
| `product_variant.description` | 400 | `VARCHAR(400)` |
| `product_chip.text` | 40 | `VARCHAR(40)` |
| `product_change.slug` | Como `product.slug` | `VARCHAR(64)` |
| `product_change.action` | `PRODUCT_ACTIONS` (la más larga: `overwrite_after_conflict`, 24) | `VARCHAR(32)` |
| `product_change.actor_name` | Nombre visible (60) o `sistema` | `VARCHAR(60)` |
| `product_change.changes` | JSON de la edición más grande: en torno a 3600 caracteres por lado, hasta 6 bytes por carácter en el peor caso (un control escapado como `\u0001`; las descripciones de producto admiten caracteres de control), así que unos 45 kB, peligrosamente cerca de los 65 535 de `TEXT` | **`MEDIUMTEXT`** (16 MB) |
| `product_import.source` | `current`, `previous` o `seed` | `VARCHAR(16)` |
| Fechas (`created_at`, `updated_at`, `at`, `deleted_at`, `last_login_at`, `imported_at`) | — | `DATETIME(3)` (UTC, milisegundos; RF-12) |

Fuera del alcance de la base: la contraseña en claro (máximo 256) nunca se guarda.

Observación sin cambio: un texto con un sustituto UTF-16 suelto (que no es Unicode válido) se convierte en U+FFFD al codificarlo a UTF-8, igual que hoy con SQLite. RN-3 habla de texto válido. Rechazarlo con `isWellFormed()` sería una validación nueva, así que queda fuera de este ticket.

### V-5. Diseño propuesto (se convertirá en el Technical Action Plan tras las respuestas)

**Configuración (`src/config/env.ts`, RF-5 y CA-8).**

- `DATABASE_URL` es obligatoria en todos los entornos. Se valida con `new URL`:
  - esquema `mysql:`;
  - usuario y host no vacíos;
  - puerto 1–65535 (3306 por defecto);
  - un solo segmento de base (`^[A-Za-z0-9_]{1,64}$`);
  - sin parámetros de consulta: las opciones las fija el código;
  - contraseña decodificada con `decodeURIComponent`: un `%` mal formado la hace inválida.
- Produce `config.database` (`{ host, port, user, password, database }`), que nunca se registra.
- Mensajes: "DATABASE_URL es obligatoria" o "DATABASE_URL no es válida (…motivo genérico…)", sin el valor.
- `loadDatabaseConfig(env)` para `admin:recover`, que no exige el resto de la configuración.
- Se documenta la codificación de `@ : / % # ?` en la contraseña.
- `MIGRATION_DATABASE_URL` (y `SHADOW_DATABASE_URL`, solo para `migrate dev` y el CI) solo la lee `prisma.config.ts`, nunca la app.

**Cliente (`src/db/client.ts`).**

- `new PrismaClient({ adapter: new PrismaMariaDb({ host, port, user, password, database, connectionLimit: 5, connectTimeout: 3000, acquireTimeout: 5000, allowPublicKeyRetrieval: true, collation: 'UTF8MB4_ES_0900_AS_CS', sessionVariables: { time_zone: '+00:00', innodb_lock_wait_timeout: 5 } }, { database }), errorFormat: 'minimal' })`.
- Se eliminan `src/db/paths.ts` y `src/db/migrate.ts`.

**Verificación al arrancar (`src/db/verify.ts`, RF-6 y CA-7).** Sustituye a `prepareDatabase`. Solo hace `SELECT` (`$queryRaw` con plantilla, sin interpolar entradas). Los pasos, en orden:

1. **Conexión** con `SELECT 1`. Errores definitivos, que fallan al momento:
   - `1045` o `45044` dan `DATABASE_AUTH_FAILED`;
   - `1044` o `1049` dan `DATABASE_ACCESS_DENIED`.

   Cualquier otro (conexión rechazada, tiempo agotado, `1040`, `1053`, 450xx) se reintenta con espera exponencial de 0,5 s, 1 s, 2 s y 4 s, después cada 5 s, hasta un plazo total de **60 s** desde el primer intento, incluido el `connectTimeout`. Si se agota, `DATABASE_UNREACHABLE`. Cada espera registra `database_waiting` con el número de intento (sin detalles). El plazo y el reloj se inyectan en las pruebas.
2. **Modo estricto:** `@@SESSION.sql_mode` contiene `STRICT_TRANS_TABLES` o `STRICT_ALL_TABLES`. Si no, `DATABASE_NOT_STRICT`. No se fuerza en la sesión: así el fallo se detecta.
3. **Base:** `information_schema.SCHEMATA` de `DATABASE()` debe ser utf8mb4 con `utf8mb4_es_0900_as_cs`. Si no, `DATABASE_CHARSET_INVALID` (con `object: '<base>'`).
4. **Migraciones**, comparadas con `prisma/migrations` (SHA-256 del `migration.sql`, el mismo checksum que Prisma; la imagen `production` ya copia las migraciones):
   - sin `_prisma_migrations` (error 1146) o con una migración local no aplicada: `MIGRATIONS_PENDING` (nuevo);
   - aplicada sin terminar o fallida (`finished_at` NULL y `rolled_back_at` NULL): `MIGRATION_INCOMPLETE`;
   - aplicada que no existe en el código: `DATABASE_NEWER_THAN_CODE`;
   - checksum distinto: `MIGRATION_MODIFIED`;
   - carpeta ilegible: `MIGRATIONS_UNREADABLE`.
5. **Tablas y columnas:** `information_schema.TABLES` y `COLUMNS` (con `CHARACTER_SET_NAME` no nulo) de `DATABASE()`. Cualquiera fuera de utf8mb4 + `utf8mb4_es_0900_as_cs` da `DATABASE_CHARSET_INVALID`, con `object: 'tabla.columna'` (son nombres, no secretos). Excepción según P-1.

Cualquier otro error da `DATABASE_ERROR`. Se conservan `DatabaseInitError`, el log `database_init_failed` (`code`, `migration`, `object`) y la salida con código 1. El mensaje de stderr es genérico: revisa `DATABASE_URL`, que MySQL esté en marcha y las migraciones (`npm run db:migrate`). Desaparecen `DATA_DIR_MISSING` (para la base), `DATABASE_CORRUPT`, `MIGRATION_FAILED`, `FOREIGN_KEY_CHECK` y `SQLITE_*`. `server.ts` deja de registrar `database_migrated`.

**Último administrador (RF-7, CA-5).**

- Todas las escrituras del repositorio de usuarios (`create`, `update`, `setActive`, `setPassword`, `bootstrap` y `recover`) usan `prisma.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 })`.
- En InnoDB, SERIALIZABLE convierte las lecturas de la transacción (`load` y el `count` de `assertActiveAdmin`) en lecturas con bloqueo compartido. Dos desactivaciones de administradores distintos se bloquean en el `count` y InnoDB detecta el interbloqueo al instante (1213/P2034). Una transacción se revierte entera.
- **Reintento acotado** en `run()`: hasta 3 intentos en total ante P2034 (o `originalCode` 1213), con una espera aleatoria de 20 a 80 ms. Al reintentar, la perdedora ve un solo administrador y lanza `LastAdminError`: 409 con el aviso de siempre. Si se agotan los intentos, o si se agota la espera de bloqueo (1205, `innodb_lock_wait_timeout` = 5 s), o el tiempo de la transacción (P2028), `DatabaseUnavailableError` (503) sin cambios, porque la transacción se revirtió.
- **Por qué no `SELECT … FOR UPDATE`:** necesita SQL crudo en el repositorio y bloquea toda la tabla `user` (no hay índice por rol). SERIALIZABLE se queda en la API de Prisma y el volumen es mínimo.
- Las lecturas (`list`, `findCredentials`…) siguen en REPEATABLE READ sin bloqueo.
- Productos: sin cambios (mutex en proceso más `updateMany where version`, que en InnoDB es una lectura actual con bloqueo, así que se cumple RF-8).

**Soporte de pruebas (RF-13, CA-12).**

- **Dos URL de prueba:**
  - `TEST_DATABASE_URL`: usuario `restaurante_test_app`, solo `SELECT, INSERT, UPDATE, DELETE` sobre `restaurante\_test\_%`.*. Es el que usa la app en toda la suite, con lo que se cumple CA-6.
  - `TEST_ADMIN_DATABASE_URL`: usuario `restaurante_test_admin`, `ALL` sobre `restaurante\_test\_%`.*. Solo lo usa el soporte para crear, migrar, vaciar y borrar bases.

  Si no están definidas, `vitest.config.ts` usa las del MySQL local de `compose.yaml` (credenciales fijas de desarrollo, solo en `127.0.0.1`).
- **Salvaguarda** (`tests/setup/database-guard.ts`, en `globalSetup` y en `setupFiles`, antes de cualquier conexión): las dos URL deben apuntar a `127.0.0.1`, `localhost`, `::1` o `mysql-dev` (el servicio local; distinto del `mysql` de producción) y a una base con prefijo `restaurante_test`. Si no, la suite se niega a correr con un mensaje sin la URL. Los procesos hijos (`runNode`) solo reciben las URL derivadas por el soporte.
- **`globalSetup`:**
  1. genera un id de ejecución (`run`, 6 hex), para que dos suites en paralelo no se pisen;
  2. espera a MySQL hasta 10 s. Si no responde, falla con: "No hay MySQL de pruebas en 127.0.0.1:3307. Levántalo con `npm run db:up` (Docker) o define TEST_DATABASE_URL y TEST_ADMIN_DATABASE_URL". Nunca se salta.
  3. al terminar, borra las bases `restaurante_test_<run>_%`.
- **Base por trabajador:** `restaurante_test_<run>_<VITEST_POOL_ID>`, que se crea en el primer uso (`CREATE DATABASE … utf8mb4_es_0900_as_cs`) y se migra con el CLI real (`prisma migrate deploy` con el usuario admin, una vez por trabajador).
  - `makeDatabase()` y `setupAdmin()` la vacían con `TRUNCATE` (con `FOREIGN_KEY_CHECKS=0`, a través de la conexión admin). Así se reinician también los autoincrementos.
  - Si una misma prueba pide una segunda base, recibe otra del trabajador (`…_<pool>_2`).
  - `makeScratchDatabase({ migrated })` crea bases desechables para los casos de arranque, `admin:recover` y la verificación (vacía, sin migrar, migración alterada, colación cambiada con `ALTER`) y las borra al terminar.
- **Corte real de la base (CA-10):** `tests/support/tcp-proxy.ts` (con `node:net`, sin dependencias) se interpone entre la app y MySQL. La prueba cierra el proxy (503 en `/admin` y en la API, 200 en las landings) y lo vuelve a abrir (200 sin reiniciar la app).
- **Tiempo de la suite:** creación y migración por trabajador (unos 2 s en paralelo) y `TRUNCATE` por prueba (unos 50 a 80 ms en las 88 llamadas, repartidas entre los trabajadores), más CA-5 (50 repeticiones). Estimación: entre **+30 y +90 s**; se medirá en la fase 3 y se reportará.

**Correspondencia de las pruebas de SQLite (CA-12, lista que se entregará completa):**

| Prueba actual | Sustituta |
|---------------|-----------|
| `tests/unit/db-migrate.test.ts` (aplicador propio, atomicidad, FK, redefinición de tablas S-2/S-7, `.db` dañado, solo lectura, carpeta inexistente) | Se elimina. La app ya no migra, y esos casos son propios de SQLite. Sustitutas: `tests/integration/db-verify.test.ts` (MySQL real: al día, pendiente, más nueva, modificada, incompleta, colación incorrecta en base, tabla y columna, usuario sin DDL) y `tests/unit/db-verify.test.ts` (reintentos ≤ 60 s con reloj falso, credenciales al momento, modo estricto ausente, clasificación de errores) |
| `tests/integration/db-prisma-compat.test.ts` | `tests/integration/db-migrations.test.ts`: `prisma migrate deploy` real con el usuario admin sobre una base vacía (código 0), `migrate status` al día y `verifyDatabase` correcta. Además, el paso de divergencia del CI y `tests/unit/migrations-collation.test.ts` |
| `server-startup.test.ts`: `.db` dañado, solo lectura | Credenciales inválidas, que dan código 1 con `DATABASE_AUTH_FAILED` |
| `server-startup.test.ts`: migración que falla, migración de productos que falla (CA-6 de REQ-F-008) | Base sin migrar (`MIGRATIONS_PENDING`) y migración incompleta (`MIGRATION_INCOMPLETE`), las dos con código 1 |
| `server-startup.test.ts`: base más nueva, D-15 productos ilegibles, `DATA_DIR` sin permisos (JSON), primer arranque | Se conservan sobre MySQL. El primer arranque cumple CA-9: base vacía y migrada, `products_imported` 10 y 6, `admin_bootstrap_created` y snapshots |
| `admin-recover.test.ts`: "sin `.db` lo crea y migra", "`DATA_DIR` inexistente" | Base sin migrar, inalcanzable, o `DATABASE_URL` ausente o inválida: código 1 con un mensaje controlado (CA-11) |
| `admin-db-security.test.ts`: dobles con `originalCode: 'SQLITE_NOTADB'` | Mismos dobles con códigos de MySQL (`1205` y `45028`), más la prueba de corte real con el proxy (CA-10) |
| `admin-products-atomicity.test.ts` "con SQLite real" | Las mismas pruebas, "con MySQL real" |
| `user-repository.test.ts`: concurrencia D-7 (una vez) | 50 repeticiones con dos clientes de Prisma (dos pools, como dos procesos), más `recover` en paralelo, más 503 tras agotar los reintentos (doble que lanza P2034) |
| (nuevas) | `db-text-roundtrip.test.ts` (CA-1 en hexadecimal, CA-3 con longitudes máximas en emojis y en acentos, y la edición más grande, CA-4), pruebas de `DATABASE_URL` en `env.test.ts` (CA-8), barrido de secretos ampliado a la URL y la contraseña de la base (CA-8), concurrencia HTTP ×50 (CA-5) y `admin:recover` real en paralelo con una desactivación por HTTP (5 repeticiones, por el coste de arrancar un proceso) |

**MySQL local (`compose.yaml`, RF-14 y CA-14).**

- Servicio **`mysql-dev`**: `mysql:8.4` fijado por digest, `ports: ["127.0.0.1:3307:3306"]`, volumen con nombre `mysql-dev-data` y healthcheck con `mysqladmin ping`.
- `command`: `--character-set-server=utf8mb4 --collation-server=utf8mb4_es_0900_as_cs --default-time-zone=+00:00 --skip-log-bin --mysqlx=OFF --innodb-flush-log-at-trx-commit=2` (este último solo para la velocidad en local).
- Un script de inicio `docker/mysql/initdb/01-usuarios.sh` crea:
  - la base `restaurante` (desarrollo);
  - `restaurante_app` (DML sobre `restaurante.*`);
  - `restaurante_migrator` (DDL sobre `restaurante.*` y `restaurante_shadow.*`, para `migrate dev`);
  - los dos usuarios de prueba.

  Las contraseñas salen de variables con valores por defecto de desarrollo, documentados como no secretos y que solo escuchan en `127.0.0.1`.
- El servicio `test` deja `network_mode: none` y pasa a una red `db-test` con `internal: true` (sin salida a internet), compartida con `mysql-dev`. Arranca con `depends_on: service_healthy` y las URL de prueba hacia `mysql-dev:3306`.
- Scripts nuevos:
  - `npm run db:up` (`docker compose up -d --wait mysql-dev`);
  - `npm run db:down`;
  - `npm run db:migrate` (`prisma migrate deploy` con `MIGRATION_DATABASE_URL` del `.env`).

**Dockerfile (RF-15 y CA-13).**

- Etapa nueva **`migrate`** (`FROM base`):
  - `npm ci --omit=dev --strict-allow-scripts`. Sin `--omit=optional`, npm instala el CLI de Prisma como par opcional de `@prisma/client`, sin vitest, eslint ni tailwind.
  - Copia `prisma/schema.prisma`, `prisma/migrations` y `prisma.config.ts` (sin el import de `src/db/paths.ts`).
  - `USER node`, `NODE_ENV=production`, `CHECKPOINT_DISABLE=1`.
  - `ENTRYPOINT ["node_modules/.bin/prisma", "migrate", "deploy"]`. Lee `MIGRATION_DATABASE_URL`.
- `production` no cambia de fondo: `npm ci --omit=dev --omit=optional`, que ya excluye el CLI. Ahora incluye el adaptador y `mariadb`, no `better-sqlite3`, y sigue copiando `prisma/migrations` porque la verificación las lee.
- Se retiran los comentarios de SQLite y el bloque `*.db` de `.dockerignore`.

**CI (`.github/workflows/ci.yml`).**

- `calidad`:
  - `docker compose up -d --wait mysql-dev`: es el mismo servicio y el mismo script de inicio que en local. Un `services:` de GitHub no permite pasar `--collation-server`.
  - paso de divergencia: `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` con la base sombra de prueba (CA-12);
  - `npm test`;
  - `timeout-minutes` sube de 15 a 20.
- `docker`:
  - construye `production` y `migrate` (con `load`);
  - levanta `mysql-dev` y ejecuta la imagen `migrate` sobre una base de prueba vacía en la red del compose, que debe terminar con 0;
  - comprueba que `production` no contiene `node_modules/prisma` ni `better-sqlite3` y que `migrate` no contiene `better-sqlite3` (CA-13).

**Documentación (CA-15).** README, `docs/desarrollo.md` (levantar MySQL, migrar, arrancar, probar), `docs/despliegue.md` (se retiran las instrucciones de `restaurante.db`, el respaldo con `sqlite3` y el aplicador al arrancar, y se remite a REQ-F-016, 019 y 021) y `.env.example` (`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `SHADOW_DATABASE_URL` y la codificación de la contraseña; `DATA_DIR` queda solo para los JSON).

**Cambios exactos propuestos (D-10):**

- `.claude/agents/senior-fullstack.md`:
  - Línea "Base de datos:" (stack), sustituida por: «Base de datos: MySQL 8.4 LTS con Prisma 7 (`@prisma/client` + `@prisma/adapter-mariadb` + `mariadb`, versiones exactas; REQ-F-007 y REQ-F-014), en utf8mb4 con la colación `utf8mb4_es_0900_as_cs` en la base, las tablas y las columnas. Esquema en `prisma/schema.prisma`, con cada texto en `@db.VarChar(n)` o `@db.MediumText` explícito. Migraciones en `prisma/migrations/`: cada `CREATE TABLE` generado se revisa a mano para fijar `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs`, porque Prisma escribe `utf8mb4_unicode_ci` (`tests/unit/migrations-collation.test.ts` lo impide). El cliente se genera en `src/generated/prisma` con `npm run db:generate` (no se versiona; ESLint lo ignora). La app nunca modifica el esquema. Las migraciones las aplica el proceso aparte `migrate` (`prisma migrate deploy` con `MIGRATION_DATABASE_URL` y un usuario con DDL; imagen `migrate` del Dockerfile, o `npm run db:migrate` en local). La app, con `DATABASE_URL` y un usuario solo DML, solo verifica al arrancar (`src/db/verify.ts`: conexión con reintentos hasta 60 s, credenciales, utf8mb4 y colación, modo estricto y estado de `_prisma_migrations`). Si algo falla, termina con código 1 y `database_init_failed`. El CLI de Prisma solo existe en desarrollo, en el CI y en las etapas `build`, `test` y `migrate` de Docker.»
  - Tabla de comandos:
    - filas nuevas `npm run db:up` («Levanta el MySQL local de `compose.yaml`, solo en `127.0.0.1:3307`; lo necesitan `dev` y `test`»), `npm run db:down` y `npm run db:migrate` («Aplica las migraciones al MySQL local con `MIGRATION_DATABASE_URL`»);
    - la fila `db:migrate:dev` pasa a decir: «(solo desarrollo, contra el MySQL local con `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL`, nunca contra producción). Revisa a mano la colación de cada `CREATE TABLE`. Nunca edites una migración ya aplicada.»;
    - en la fila `npm test` se añade: «Requiere el MySQL local (`npm run db:up`)».
  - Persistencia:
    - «se guardan en SQLite» pasa a «se guardan en MySQL».
    - «La base de datos SQLite `DATA_DIR/restaurante.db` (Prisma; REQ-F-007)» pasa a «La base de datos MySQL (Prisma; REQ-F-007 y REQ-F-014)».
    - «(siempre un administrador activo, …)» pasa a «(siempre un administrador activo, con transacciones `Serializable` y reintento acotado ante interbloqueo, …)».
    - «Al arrancar: comprobación de escritura e integridad y migraciones (fallo rápido con código 1).» pasa a «Al arrancar: verificación de la base sin migrar nada (fallo rápido con código 1).»
  - Estructura: `db/` pasa a «client.ts (Prisma + adaptador MariaDB/MySQL), verify.ts (verificación al arrancar), errors.ts», y `prisma/` pasa a «schema.prisma y migrations/ (SQL de MySQL versionado)».
  - Testing: se añade «Las pruebas con base de datos corren contra MySQL 8.4 real (`npm run db:up`), con una base `restaurante_test_*` por trabajador; regla en `.claude/rules/testing.md`».
- `.claude/rules/testing.md`: sección nueva **"Base de datos de pruebas"**:
  - «Las pruebas que usan la base de datos corren contra MySQL 8.4 real (REQ-F-014), nunca contra una base de desarrollo o de producción. Usa `makeDatabase()`, `setupAdmin()` o `makeScratchDatabase()` de `tests/support/`; nunca abras conexiones por tu cuenta ni leas `DATABASE_URL` en una prueba.»
  - «`TEST_DATABASE_URL` (usuario solo DML, el de la app) y `TEST_ADMIN_DATABASE_URL` (DDL, solo el soporte de pruebas) apuntan únicamente a `127.0.0.1`, `localhost`, `::1` o `mysql-dev` y a bases con prefijo `restaurante_test`. La salvaguarda de `tests/setup/` rechaza cualquier otra antes de conectar. No la relajes.»
  - «Sin MySQL, la suite falla con el mensaje de cómo levantarlo (`npm run db:up`). Ninguna prueba se salta por falta de base.»
  - «El store de productos en memoria sigue siendo el doble de las pruebas unitarias.»

**Plan por fases** (un solo PR: si se fusionara a medias, `main` quedaría sin base de pruebas):

1. Dependencias, esquema con longitudes, migración inicial revisada a mano, prueba de colación de migraciones, `compose.yaml` con `mysql-dev` y su script de inicio, `prisma.config.ts`. Comprobar V-2.4 (divergencia).
2. `env.ts`, `client.ts`, `verify.ts`, `server.ts` y `admin-recover.ts`.
3. Soporte de pruebas (`globalSetup`, salvaguarda, base por trabajador, proxy) y adaptación de la suite. Medir el tiempo.
4. RF-7 (Serializable y reintentos) y pruebas de concurrencia.
5. Pruebas nuevas: CA-1, CA-3, CA-4, CA-7, CA-8 y CA-10.
6. Etapa `migrate` del Dockerfile y CI.
7. Documentación, agente y regla de pruebas.

### Preguntas para el usuario

**P-1. Colación de `_prisma_migrations` (CA-2).** Prisma crea siempre su tabla interna de control con `utf8mb4_unicode_ci` y no permite cambiarlo. La tabla solo guarda nombres de migración, checksums y logs, nunca textos del negocio.

- **(a) Recomendada.** Se acepta como única excepción documentada. La verificación comprueba que esa tabla sea utf8mb4 (sin `utf8mb3`), pero no exige su colación. CA-2 quedaría: «… en todas las tablas y columnas de la aplicación; `_prisma_migrations`, interna de Prisma, solo debe ser utf8mb4».
- (b) Antes de `migrate deploy`, la imagen `migrate` crea la tabla `_prisma_migrations` con nuestra colación, copiando el DDL interno de Prisma. Es frágil: depende de detalles internos que pueden cambiar en cualquier actualización de Prisma, y añade código propio al proceso de migración.

**P-2. CA-5, segundo punto (`admin:recover` en paralelo).** `admin:recover` solo **añade** o reactiva administradores, nunca los quita, así que no puede llevar a cero. Además, el resultado "exactamente uno" no siempre es posible. Un ejemplo: la desactivación del único administrador por HTTP coincide con `admin:recover` sobre un editor. Si va primero la recuperación, queda 1. Si va primero la desactivación, recibe el 409 y después quedan 2.

- **(a) Recomendada.** Redactarlo así: «Con la desactivación por HTTP en paralelo con `admin:recover`, en todas las repeticiones queda al menos un administrador activo, el resultado coincide con alguna ejecución en serie y la auditoría registra exactamente las operaciones aplicadas».
- (b) Mantener "exactamente uno" y limitar la prueba a escenarios donde siempre lo sea. Sería menos útil.

**P-3. Dos límites de validación que hoy no existen (RF-4: "o lo rechaza la validación o la base devuelve un error").** `ADMIN_PASSWORD_HASH` acepta una sal de cualquier longitud y la ruta de imagen no tiene máximo.

- **(a) Recomendada.** Añadir dos límites:
  - sal ≤ 64 bytes en `parsePasswordHash`: un hash fuera del límite da el error de configuración de siempre ("ADMIN_PASSWORD_HASH no es válido"). Los hashes de `npm run admin:hash-password` usan 16;
  - ruta de imagen ≤ 255 caracteres, con un 422 "La ruta es demasiado larga".

  Así `password_hash` y `image_src` caben en `VARCHAR(255)` y el error es claro. Son casos que hoy no se dan.
- (b) No tocar la validación. Esos valores absurdos fallarían en la base: `admin_bootstrap_failed` al arrancar o 503 al guardar, con un mensaje menos claro.

Con las respuestas, el diseño de V-5 se convertirá en el Technical Action Plan y se pedirá su aprobación.

### Respuestas del usuario (2026-10-09)

Cita textual: "todas las recomendadas". Queda así:

- **P-1 (a).** `_prisma_migrations` es la única excepción documentada a la colación: solo se le exige `utf8mb4`. CA-2 se ajustó.
- **P-2 (a).** El segundo punto de CA-5 se redacta como "al menos un administrador activo, un resultado equivalente a alguna ejecución en serie y una auditoría que registra exactamente lo aplicado". CA-5 se ajustó.
- **P-3 (a).** Sal de `ADMIN_PASSWORD_HASH` de 64 bytes como máximo (si la supera, el error de configuración de siempre). Ruta de imagen de 255 caracteres como máximo (si la supera, 422). Se añadió a CA-3.

## Technical Action Plan

El detalle de cada decisión está en "Revisión técnica" (V-1 a V-5). Este plan es la referencia de implementación.

### Objetivo técnico

Sustituir SQLite por MySQL 8.4 mediante `@prisma/adapter-mariadb`:

- utf8mb4 con `utf8mb4_es_0900_as_cs` en la base, las tablas de la app y las columnas;
- longitudes explícitas para cada texto;
- un proceso `migrate` aparte, con un usuario DDL;
- una app con un usuario solo DML que solo verifica la base al arrancar;
- RN-1 correcta con concurrencia real;
- la suite contra MySQL real, en local y en el CI, sin rastro de SQLite.

### Archivos o componentes afectados

- **Dependencias y Prisma:** `package.json` y `package-lock.json`, `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/` (se retiran las 2 de SQLite y `migration_lock.toml` pasa a `mysql`; se añade la nueva `<ts>_inicial_mysql`).
- **Base de datos:** `src/db/client.ts`. Nuevo `src/db/verify.ts`. Se eliminan `src/db/migrate.ts` y `src/db/paths.ts`.
- **App:** `src/db/errors.ts` (códigos de MySQL y P2034), `src/config/env.ts`, `src/server.ts`, `src/repositories/user-repository.ts`.
- **Validación (P-3):** `src/services/admin-auth.ts` (sal ≤ 64) y `src/services/menu-schema.ts` (ruta ≤ 255).
- **Consola:** `scripts/admin-recover.ts`.
- **Pruebas:**
  - `vitest.config.ts`;
  - nuevos `tests/setup/database-global.ts`, `tests/setup/database-guard.ts` y `tests/support/tcp-proxy.ts`;
  - `tests/support/database.ts`, `admin.ts` y `process.ts`, `tests/helpers.ts` (`VALID_ENV` con `DATABASE_URL`);
  - las pruebas listadas en V-5 (se eliminan `tests/unit/db-migrate.test.ts` y `tests/integration/db-prisma-compat.test.ts`);
  - nuevas: `tests/unit/db-verify.test.ts`, `tests/unit/migrations-collation.test.ts`, `tests/integration/db-verify.test.ts`, `tests/integration/db-migrations.test.ts` y `tests/integration/db-text-roundtrip.test.ts`.
- **Docker y CI:** `compose.yaml` y el nuevo `docker/mysql/initdb/01-usuarios.sh`, `Dockerfile`, `.dockerignore`, `.github/workflows/ci.yml`.
- **Documentación:** `README.md`, `docs/desarrollo.md`, `docs/despliegue.md`, `.env.example`.
- **Instrucciones del proyecto (D-10):** `.claude/agents/senior-fullstack.md` y `.claude/rules/testing.md`.

### Cambios requeridos

**Esquema.**

- `provider = "mysql"`.
- Cada texto con `@db.VarChar(n)` según la tabla de V-4. `user_audit.changes` y `product_change.changes` en `@db.MediumText`.
- Las fechas quedan como `DATETIME(3)`, el valor por defecto de Prisma.

**Migración inicial.**

- Se genera con `prisma migrate dev --create-only` contra `mysql-dev`.
- Se edita el sufijo de cada `CREATE TABLE` a `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs`, y se revisan a mano las longitudes, los índices y las FK.

**Cliente.** `PrismaMariaDb` con:

- la configuración validada;
- `connectionLimit: 5`, `connectTimeout: 3000`, `acquireTimeout: 5000`;
- `allowPublicKeyRetrieval: true`;
- `collation: 'UTF8MB4_ES_0900_AS_CS'`;
- `sessionVariables: { time_zone: '+00:00', innodb_lock_wait_timeout: 5 }`;
- `errorFormat: 'minimal'`.

**`verifyDatabase`.** Los pasos y códigos de V-5:

- conexión con reintentos hasta 60 s;
- autenticación y acceso fallan al momento;
- modo estricto;
- colación de la base;
- migraciones;
- colación de tablas y columnas. En `_prisma_migrations` solo se exige el juego de caracteres utf8mb4 (P-1).

**`server.ts`.** Llama a `createPrismaClient` y después a `verifyDatabase`. Si falla, registra `database_init_failed` (`code`, `migration`, `object`), escribe un mensaje genérico en stderr y termina con código 1. El resto del arranque no cambia (bootstrap e importación).

**`user-repository.ts`.**

- Las escrituras se hacen en transacción `Serializable` (`maxWait: 5000`, `timeout: 10000`).
- `run()` reintenta ante P2034 o 1213: 3 intentos en total, con 20 a 80 ms de espera aleatoria.
- Si se agotan los intentos, o hay espera de bloqueo (1205) o se agota el tiempo de la transacción (P2028), `DatabaseUnavailableError`.
- Se actualiza el comentario de D-7.

**`admin-recover.ts`.** Usa `loadDatabaseConfig()`, el cliente y `verifyDatabase` con un plazo de 10 s. No migra. Ante una base sin migrar, inalcanzable, o una URL ausente o inválida, termina con código 1 y un mensaje controlado.

**Retirar SQLite.** Se retiran sus dependencias, `allowScripts`, comentarios, documentación y el bloque `*.db` de `.dockerignore`.

### Backend

- **`env.ts`:**
  - `DATABASE_URL` obligatoria en todos los entornos;
  - esquema `mysql:`, usuario y host no vacíos, puerto 1–65535, base `^[A-Za-z0-9_]{1,64}$`, sin parámetros de consulta, contraseña decodificada con `decodeURIComponent`;
  - produce `config.database`, que nunca se registra;
  - exporta `loadDatabaseConfig(env)`;
  - los errores no incluyen el valor.
- **`prisma.config.ts`:**
  - `datasource.url` = `MIGRATION_DATABASE_URL` y `shadowDatabaseUrl` = `SHADOW_DATABASE_URL`;
  - `npm run db:generate` debe seguir funcionando sin URL; se comprueba en la fase 1;
  - sin el import de `src/db/paths.ts`.
- **Scripts:** `db:up` (`docker compose up -d --wait mysql-dev`), `db:down` (`docker compose stop mysql-dev`) y `db:migrate` (`prisma migrate deploy`).

### Contenido / configuración

- **Variables nuevas:**
  - `DATABASE_URL` (app y `admin:recover`);
  - `MIGRATION_DATABASE_URL` (solo `migrate` y el CLI);
  - `SHADOW_DATABASE_URL` (solo desarrollo y CI);
  - `TEST_DATABASE_URL` y `TEST_ADMIN_DATABASE_URL` (solo pruebas; si faltan, se usan los valores del MySQL local).
- `DATA_DIR` queda solo para los JSON y `changes.jsonl`.
- `.env.example` documenta las variables nuevas y cómo codificar `@ : / % # ?` en la contraseña.
- **`mysql-dev`:**
  - `mysql:8.4` por digest, `127.0.0.1:3307:3306` y volumen `mysql-dev-data`;
  - flags: utf8mb4, `utf8mb4_es_0900_as_cs`, `+00:00`, `skip-log-bin`, `mysqlx=OFF`, `innodb-flush-log-at-trx-commit=2`;
  - healthcheck;
  - script de inicio con las bases y los usuarios `restaurante_app` (DML), `restaurante_migrator` (DDL más la base sombra), `restaurante_test_app` (DML en `restaurante\_test\_%`) y `restaurante_test_admin` (ALL en `restaurante\_test\_%`). Las contraseñas tienen valores por defecto de desarrollo, no secretos.
- **Servicio `test`:** red `db-test` con `internal: true`, compartida con `mysql-dev`, y `depends_on: service_healthy`.

### Validaciones

- `DATABASE_URL` según RF-5 y CA-8.
- P-3:
  - `parsePasswordHash` rechaza una sal de más de 64 bytes, lo que da el error de configuración de siempre;
  - `imageSrcError` rechaza una ruta de más de 255 caracteres con 422 "La ruta es demasiado larga" (el mensaje exacto se ajusta al estilo de los existentes).
- Las longitudes de las columnas son iguales o mayores que los máximos de la app, medidos en puntos de código (V-4).

### Manejo de errores

- Las mismas superficies de hoy:
  - `DatabaseUnavailableError`, con 503 HTML en `/admin` y 503 JSON `DATABASE_UNAVAILABLE` en la API;
  - landings en 200 desde la caché;
  - `database_unavailable` solo con `name`, `code` y `originalCode`.
- Nunca se registran el mensaje de Prisma, el SQL, la URL ni las credenciales.
- `isUniqueViolation` (P2002) no cambia.
- Se añade la detección de P2034/1213 para el reintento.

### Testing

**Soporte** (V-5):

- salvaguarda (host `127.0.0.1`, `localhost`, `::1` o `mysql-dev`; prefijo `restaurante_test`);
- `globalSetup` con id de ejecución, espera de 10 s y fallo explícito con el mensaje de `npm run db:up`, y borrado de sus bases al terminar;
- base por trabajador, migrada con el CLI real y vaciada con `TRUNCATE`;
- `makeScratchDatabase` y el proxy TCP;
- la app usa en toda la suite el usuario DML (CA-6).

**Correspondencia con CA-12.** Se aplica la tabla de V-5 y se entrega la lista definitiva en "Implementation Result".

**Pruebas por criterio:**

- **CA-1:** `/admin` y la API, con la cadena del ticket en el nombre (incluido 🌮) y `€` en la descripción, más el nombre visible de un usuario. Se comprueban la API, el formulario, la landing, `HEX()` (🌮 = `F09F8CAE`) y el registro de cambios.
- **CA-2:** base, tabla y columna con otra colación, que dan `DATABASE_CHARSET_INVALID`; `_prisma_migrations` con `unicode_ci` se acepta.
- **CA-3:** cada columna con su máximo en emojis y en acentos, la edición más grande (6 variantes con 400 caracteres) y los límites de P-3.
- **CA-4:** `jose`/`josé`, las variantes de mayúsculas y NFD con 422, y el orden `ana`, `ñandu`, `oscar`, `zoe`.
- **CA-5:**
  - repositorio con dos clientes Prisma, ×50;
  - HTTP ×50;
  - `recover` en paralelo con una desactivación, ×50 en el repositorio y ×5 con el proceso real `admin:recover`, con el criterio de P-2;
  - 503 tras agotar los reintentos.
- **CA-6:** la suite pasa con el usuario DML, y una prueba confirma que ese usuario no puede ejecutar `CREATE TABLE`.
- **CA-7:** sobre MySQL real y con el proceso real cuando es viable (credenciales, pendiente, más nueva, modificada, incompleta, colación). El modo estricto ausente y la espera de 60 s se prueban en unidad, con un doble de consultas y un reloj falso.
- **CA-8:** `env.test.ts` y el barrido de secretos de la suite ampliado a la URL y la contraseña de la base.
- **CA-9:** primer arranque real con los snapshots.
- **CA-10:** proxy cerrado y reabierto.
- **CA-11:** `admin:recover` sobre una base migrada y sobre una sin migrar.
- **`migrations-collation.test.ts`:** comprobación estática de las migraciones.

**Comandos:** `npm run db:generate`, `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (con `npm run db:up`), más `docker compose run --rm test` y `docker build --target migrate` y `--target production`. Se medirá el tiempo de la suite antes y después.

### Seguridad

- Menor privilegio: la app y las pruebas usan un usuario DML, y solo el proceso de migración tiene DDL.
- La URL y la contraseña nunca aparecen en logs, errores ni `ConfigError`.
- La salvaguarda impide tocar bases que no son de prueba.
- `mysql-dev` solo escucha en `127.0.0.1`, y el contenedor de pruebas no tiene salida a internet.
- `allowPublicKeyRetrieval` solo dentro de la red interna; TLS si MySQL es remoto (REQ-F-016).
- Sin SQL crudo con entradas: la verificación solo usa `$queryRaw` con plantillas sin datos externos.
- La imagen `production` no lleva el CLI de Prisma.
- `npm ci --strict-allow-scripts` en todas partes.

### Performance

- Pool de 5 conexiones.
- Las landings siguen leyendo la caché en memoria.
- `Serializable` solo en las escrituras de usuarios, que son poco frecuentes.
- La suite tardará más (estimación: +30 a +90 s), y se informará de la medida.
- `timeout-minutes` del job `calidad` sube de 15 a 20.

### Riesgos técnicos

- **R-T1.** Que `migrate diff` marque como divergencia la colación editada a mano (fase 1). Si pasa, se detiene el trabajo y se informa.
- **R-T2.** Que `prisma.config.ts` sin URL rompa `db:generate` en la etapa `build`. Mitigación: URL condicional.
- **R-T3.** Pruebas de concurrencia intermitentes. Mitigación: reintentos acotados y 50 repeticiones en el CI.
- **R-T4.** La duración de la suite.
- **R-T5.** Errores del driver con códigos no previstos al arrancar. Mitigación: los códigos desconocidos se tratan como transitorios hasta los 60 s y después dan `DATABASE_UNREACHABLE`; los definitivos están en una lista explícita.
- **R-T6.** DDL no transaccional. La detección es `MIGRATION_INCOMPLETE`; el runbook va en REQ-F-019.

### Orden de implementación

Todo en un solo PR:

1. Dependencias, esquema, migración inicial revisada, `migrations-collation.test.ts`, `mysql-dev` con su script de inicio y `prisma.config.ts`. Comprobar R-T1 y R-T2.
2. `env.ts`, `client.ts`, `verify.ts`, `server.ts`, `admin-recover.ts` y P-3.
3. Soporte de pruebas y adaptación de la suite. Medir el tiempo.
4. RF-7 y las pruebas de concurrencia.
5. Pruebas nuevas: CA-1, CA-3, CA-4, CA-7, CA-8 y CA-10.
6. Etapa `migrate` del Dockerfile, `compose.yaml` (`test`) y CI.
7. Documentación, `.claude/agents/senior-fullstack.md` y `.claude/rules/testing.md`, con el texto exacto de V-5 (D-10).

### Criterios de finalización

- CA-1 a CA-15 cumplidos con su prueba o su comprobación indicada.
- `npm run typecheck` y `npm run lint` con 0, y `npm test` en verde contra MySQL 8.4 local.
- `docker compose run --rm test` en verde, y las imágenes `production` y `migrate` construidas.
- Ningún rastro de SQLite: `grep -ri "sqlite\|better-sqlite3\|restaurante.db"` vacío fuera del historial de git y de los tickets.
- Lista de las pruebas sustituidas y medida del tiempo de la suite en "Implementation Result".
- Cambios de D-10 aplicados con el texto exacto de V-5.

## Implementation Result

### Rama

`feature/REQ-F-014-migracion-mysql`, creada desde `main` al día (0784d8f). El ticket se movió de `backlog/` a `in-progress/` con `mv`: como no tenía seguimiento en git, `git mv` no era posible. Sin commits (fase T2).

### Cambios realizados

1. **Dependencias:**
   - se añaden `@prisma/adapter-mariadb@7.10.0` y `mariadb@3.4.5` (exactas);
   - se retiran `@prisma/adapter-better-sqlite3`, `better-sqlite3`, `@types/better-sqlite3` y su `allowScripts`;
   - scripts nuevos: `db:up`, `db:down` y `db:migrate`.
2. **Esquema y migración:**
   - `provider = "mysql"` y longitud explícita para cada texto (tabla V-4);
   - una sola migración inicial, `20261009223102_inicial_mysql`, generada con `migrate dev --create-only` y revisada a mano: las 8 tablas en `utf8mb4_es_0900_as_cs`;
   - se retiran las migraciones de SQLite;
   - `prisma.config.ts` usa `MIGRATION_DATABASE_URL` y `SHADOW_DATABASE_URL`, las dos opcionales.
3. **Riesgos de la fase 1, comprobados:**
   - **R-T1:** `prisma migrate diff --from-migrations … --to-schema … --exit-code` da 0 con la colación editada a mano y da 2 si el esquema cambia (comprobado).
   - **R-T2:** `prisma generate` funciona sin URL.
4. **Configuración:**
   - `DATABASE_URL` es obligatoria y se valida en `env.ts` (`parseDatabaseUrl` y `loadDatabaseConfig`). Los mensajes nunca incluyen el valor.
   - Se elimina `loadDataDir`.
5. **Cliente y verificación:**
   - `src/db/client.ts` usa `PrismaMariaDb`.
   - `src/db/verify.ts` sustituye a `src/db/migrate.ts` y `src/db/paths.ts`, que se eliminan:
     - conexión con una sonda directa del driver, porque el pool de Prisma solo informa de un tiempo agotado (45028);
     - reintentos con espera de 0,5, 1, 2 y 4 s y después cada 5 s, dentro de un máximo de 60 s;
     - credenciales y acceso fallan al momento;
     - después, el modo estricto, la base, las migraciones y las tablas y columnas, con `_prisma_migrations` solo en utf8mb4 (P-1).
   - `server.ts` ya no migra.
6. **Último administrador:**
   - las escrituras del repositorio de usuarios son `Serializable` (`maxWait` 5 s, `timeout` 10 s);
   - se reintentan ante P2034/1213 hasta `MAX_ATTEMPTS` = 3, con 20 a 80 ms de espera aleatoria;
   - si no se resuelve, 503.
7. **`admin:recover`:** usa `DATABASE_URL`, verifica la base con un plazo de 10 s y no migra.
8. **P-3:**
   - la sal de un hash scrypt puede tener 64 bytes como máximo (`parsePasswordHash`);
   - la ruta de imagen, 255 caracteres como máximo (`imageSrcError`, con el mensaje "La ruta es demasiado larga (máximo 255 caracteres).").
9. **Soporte de pruebas:**
   - archivos nuevos o reescritos:
     - `tests/support/test-database-config.ts` (URL de prueba y salvaguarda);
     - `database-admin.ts` (operaciones con DDL y huella del esquema);
     - `database.ts` (bases por trabajador y bases desechables);
     - `tcp-proxy.ts`;
     - `migrations.ts`;
     - `tests/setup/database-global.ts` (salvaguarda, espera de 10 s, id de ejecución, base de referencia y limpieza);
     - `tests/setup/database-guard.ts`;
   - `startServer` toma una base de prueba si no recibe `DATABASE_URL`;
   - `setupAdmin` libera su base después de cada prueba;
   - una base que una prueba alteró (DROP, ALTER, triggers) se vuelve a crear: su huella se compara con la base de referencia.
10. **Docker, compose y CI:**
    - nuevo servicio `mysql-dev` (MySQL 8.4 fijado por digest, solo en `127.0.0.1:3307`) y `docker/mysql/initdb/01-usuarios.sh`;
    - el servicio `test` pasa a la red interna `db-test`;
    - nueva etapa `migrate` en el Dockerfile;
    - el CI levanta `mysql-dev`, comprueba la divergencia, construye `production` y `migrate`, comprueba su contenido y aplica `migrate` sobre una base vacía;
    - el tiempo máximo de cada comprobación pasa a 20 minutos.
11. **Documentación:**
    - README, `docs/desarrollo.md`, `docs/despliegue.md` (instrucciones de SQLite retiradas y remisión a REQ-F-016, 019 y 021) y `.env.example`;
    - `.claude/agents/senior-fullstack.md` y `.claude/rules/testing.md` con el texto aprobado (D-10).
    - En `.gitignore` y `restaurante/.gitignore` solo cambian los comentarios (se conserva la regla `*.db` para restos locales).

**Desviación del plan (requiere el visto bueno del usuario).** La ejecución de la suite en Docker detectó un defecto del driver `mariadb@3.4.5`: si la red falla mientras una conexión nueva ejecuta sus consultas de inicio (`sessionVariables` o un `SET NAMES`), deja una promesa rechazada sin manejar (`ER_SETTING_SESSION_ERROR`, en `authSucceedHandler`). Con MySQL caído, eso tiraría el proceso, lo que incumple RF-9. Está corregido en `mariadb` 3.5.x, pero el adaptador exige 3.4.5. Solución aplicada, sin cambiar dependencias:

- el cliente ya no usa `sessionVariables` (`time_zone` e `innodb_lock_wait_timeout`);
- la colación de la conexión pasa a ser la utf8mb4 por defecto (`UTF8MB4_0900_AI_CI`, índice 255, que no exige `SET NAMES`). La conexión sigue en utf8mb4 (D-4); las comparaciones y el orden usan la colación de cada columna (`utf8mb4_es_0900_as_cs`);
- RF-12 queda garantizado por la app: `user_audit.at` lo pone el repositorio en UTC, y las demás fechas ya las ponía la app. Lo cubre una prueba nueva que lee la base con `DATE_FORMAT`;
- una espera de bloqueo larga no la corta el `timeout` de la transacción de Prisma: la corta `innodb_lock_wait_timeout` del servidor (50 s por defecto en MySQL 8.4) y la respuesta es 503 sin cambios. Bajar ese valor en el servidor: REQ-F-016. *(Corregido según DEF-001.)*

La prueba de corte real (`db-outage`) pasa 6 de 6 veces seguidas y la suite en Docker termina con 0. La alternativa sería forzar `mariadb@3.5.4` con `overrides`, sin garantía de compatibilidad con el adaptador, en REQ-F-020 o en un ticket aparte.

### Criterios de aceptación

| CA | Estado | Evidencia |
|----|--------|-----------|
| CA-1 | Cumple | `db-text-roundtrip.test.ts`: formulario, API, landing, HEX (🌮 = `F09F8CAE`), `product_change` y nombre visible de un usuario |
| CA-2 | Cumple (con P-1) | `db-verify.test.ts` (catálogo de la base, las tablas y las columnas; otra colación en la base, una tabla, una columna, y `_prisma_migrations` en utf8mb3) y `server-startup.test.ts` (código 1) |
| CA-3 | Cumple | `db-text-roundtrip.test.ts`: máximos en emojis y en acentos para cada texto de producto, usuario y nombre visible de 60, y la edición más grande (6 variantes con 400 caracteres); límites de P-3 en `admin-auth.test.ts`, `menu-schema.test.ts` y `config.test.ts` |
| CA-4 | Cumple | `db-text-roundtrip.test.ts`: jose y josé, Jose, JOSE y José en NFD (repositorio y 422 por formulario), orden ana, ñandu, oscar, zoe |
| CA-5 | Cumple (con P-2) | `last-admin-concurrency.test.ts`: 50 repeticiones en el repositorio con dos pools, 50 por HTTP, 50 de recover en paralelo y 5 con el proceso real `admin:recover`, más 503 tras agotar los reintentos. Con `RepeatableRead` la prueba falla (comprobado), así que detecta el write skew |
| CA-6 | Cumple | La suite usa el usuario `restaurante_test_app` (solo DML); `db-verify.test.ts` comprueba que no puede ejecutar CREATE ni DROP; `db-migrations.test.ts` y la imagen `migrate` crean el esquema con código 0 |
| CA-7 | Cumple | Proceso real: credenciales, pendiente, más nueva, modificada, incompleta y colación (`server-startup.test.ts`). En unidad: modo estricto ausente y 60 s con reloj falso (`db-verify.test.ts`, unit). Con MySQL detenido se probó manualmente: `DATABASE_UNREACHABLE` |
| CA-8 | Cumple | `config.test.ts` (ausente, otro esquema, sin host, sin base, parámetros, valor oculto) y `admin-recover.test.ts`. Barridos de logs y respuestas ampliados a la contraseña, el usuario y `mysql://` en `admin-db-security.test.ts` y `admin-products-logs.test.ts` |
| CA-9 | Cumple | `server-startup.test.ts`: base vacía y migrada, `products_imported` 10 y 6 y `admin_bootstrap_created`; los snapshots byte a byte sobre MySQL, en `landing-products.test.ts` |
| CA-10 | Cumple | `db-outage.test.ts` (corte real con el proxy TCP: 503 HTML y JSON, landings en 200, recuperación sin reiniciar) |
| CA-11 | Cumple | `admin-recover.test.ts`: con el servidor en marcha, base migrada vacía, base sin migrar (código 1, `MIGRATIONS_PENDING`, sin tablas creadas), inalcanzable y URL ausente o inválida |
| CA-12 | Cumple | typecheck, lint y test en verde contra MySQL 8.4 (local y en Docker); sin MySQL, código 1 con el mensaje de `npm run db:up`; salvaguarda en `test-database-guard.test.ts` y comprobada a mano; divergencia en el CI; lista de sustituciones abajo |
| CA-13 | Cumple (comprobado en local; el CI lo comprobará en el PR) | `package.json` y el lockfile no instalan `better-sqlite3`. El lockfile solo lo menciona como dependencia par opcional del CLI `prisma`, que no se instala. `production` no tiene `node_modules/prisma` ni `better-sqlite3`; `migrate` aplica el esquema sobre una base vacía con código 0 |
| CA-14 | Cumple | `npm run db:up`, `npm run db:migrate` y `npm run dev` documentados en `docs/desarrollo.md` (`mysql-dev` solo en 127.0.0.1) |
| CA-15 | Cumple | README, `desarrollo.md`, `despliegue.md`, `.env.example`, el agente y la regla de pruebas actualizados; SQLite solo aparece como histórico o en negaciones |

### Pruebas de SQLite sustituidas

| Prueba eliminada o cambiada | Sustituta |
|-----------------------------|-----------|
| `tests/unit/db-migrate.test.ts` (eliminada) | `tests/unit/db-verify.test.ts` y `tests/integration/db-verify.test.ts`. Los casos propios de SQLite (atomicidad del aplicador, FK, redefinición de tablas, `.db` dañado o de solo lectura) desaparecen con el aplicador |
| `tests/integration/db-prisma-compat.test.ts` (eliminada) | `tests/integration/db-migrations.test.ts`, el paso de divergencia del CI y `tests/unit/migrations-collation.test.ts` |
| `server-startup.test.ts`: `.db` dañado, migración fallida, migración de productos fallida, `.db` de solo lectura | Credenciales inválidas, base sin migrar, migración pendiente, modificada, incompleta y columna con otra colación |
| `server-startup.test.ts`: primer arranque, base más nueva, D-15, `DATA_DIR` sin permisos | Se conservan sobre MySQL (D-15 se provoca borrando una tabla) |
| `admin-recover.test.ts`: "sin `.db` lo crea y migra", "`DATA_DIR` inexistente" | Base migrada vacía, base sin migrar, MySQL inalcanzable, `DATABASE_URL` ausente o inválida |
| `admin-db-security.test.ts`, `admin-products-logs.test.ts`, `admin-products-atomicity.test.ts`, `user-repository.test.ts` (DDL y triggers de SQLite) | Los mismos casos con DDL y triggers de MySQL, aplicados con el usuario admin de pruebas |
| `admin-products-api.test.ts`, `admin-products.test.ts`, `landing-products.test.ts` (códigos `SQLITE_IOERR`) | Códigos de MySQL (`1205`) |
| Nuevas | `last-admin-concurrency.test.ts`, `db-text-roundtrip.test.ts`, `db-outage.test.ts`, `test-database-guard.test.ts`, la prueba de fechas RF-12 y las pruebas de `DATABASE_URL` y P-3 |

### Validaciones ejecutadas

Desde `restaurante/`, con `mysql-dev` en marcha:

| Comando | Resultado |
|---------|-----------|
| `npm run build:css` | OK |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, sin avisos |
| `npm test` (antes, SQLite, en `main`) | 68 archivos, 1383 pasan y 1 fallo esperado; 15,65 s |
| `npm test` (después, MySQL 8.4) | 74 archivos, 1447 pasan y 1 fallo esperado; 54,15 s (+38,5 s) |
| `docker compose run --rm test` | Código 0: 1446 pasan, 1 fallo esperado y 1 saltado (prueba que se salta cuando corre como root); 54,8 s |
| `docker build --target production` y `--target migrate` | OK (production unos 250 MB, migrate unos 530 MB) |
| Imagen `migrate` sobre una base vacía | Código 0 ("All migrations have been successfully applied.") y 0 al repetirla |
| Contenido de las imágenes | production sin `prisma` ni `better-sqlite3` y con el adaptador; migrate con `prisma` y sin `better-sqlite3` |
| `production` sobre la base migrada (usuario DML) | `products_imported` 10 y 6, y `server_started` |
| `prisma migrate diff --from-migrations … --exit-code` | 0 (y 2 con un cambio de esquema provocado) |
| `npm test` sin MySQL | Código 1, "No hay MySQL de pruebas disponible (ECONNREFUSED). Levanta el MySQL de pruebas con `npm run db:up`…" |
| `npm test` con una URL hacia otro host | Se niega: "apunta a un host que no es de pruebas" |

### Archivos afectados

- **Proyecto:**
  - `.github/workflows/ci.yml`, `.gitignore`;
  - `.claude/agents/senior-fullstack.md`, `.claude/rules/testing.md`;
  - este ticket.
- **`restaurante/`, configuración y documentación:**
  - `package.json`, `package-lock.json`, `compose.yaml`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example`;
  - `README.md`, `docs/desarrollo.md`, `docs/despliegue.md`;
  - `vitest.config.ts`, `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/` (sustituida);
  - `docker/mysql/initdb/01-usuarios.sh` (nuevo).
- **`restaurante/src`:**
  - `config/env.ts`;
  - `db/client.ts`, `db/errors.ts`, `db/verify.ts` (nuevo); se eliminan `db/migrate.ts` y `db/paths.ts`;
  - `server.ts`;
  - `repositories/user-repository.ts`, `repositories/prisma-product-store.ts` y `repositories/product-repository.ts` (comentarios);
  - `services/admin-auth.ts`, `services/menu-schema.ts`.
- **`restaurante/scripts`:** `admin-recover.ts`, `bot-chat.ts` (DATABASE_URL de relleno: el simulador no conecta).
- **`restaurante/tests`:**
  - soporte: `helpers.ts`, `setup/database-global.ts`, `setup/database-guard.ts`, `support/{admin,database,database-admin,migrations,process,tcp-proxy,test-database-config}.ts`;
  - pruebas: las de las tablas anteriores.

### Riesgos o pendientes

- **Desviación del cliente** (descrita arriba): requiere el visto bueno del usuario.
- **Tu `.env` local no tiene `DATABASE_URL`** (no lo toqué). Para `npm run dev` hay que copiar del `.env.example` las tres URL de la base y ejecutar `npm run db:up` y `npm run db:migrate`.
- **`innodb_lock_wait_timeout`:** ya no se fija en la sesión. Hoy acota las esperas de bloqueo con su valor por defecto (50 s; respuesta 503 sin cambios). Conviene bajarlo en la configuración del MySQL de producción (REQ-F-016). *(Corregido según DEF-001.)*
- **La suite tarda unos 39 s más.** Es la estimación del plan.
- **Un intento de conexión puede tardar más de lo previsto.** El plazo de 60 s asume que un intento dura como máximo 5 s; el `connectTimeout` es de 3 s.
- **El CI con MySQL todavía no se ha ejecutado en GitHub** (se hará en el PR, en T4). Usa `docker compose` del runner y la red `restaurante_db-test`.
- **`mysql-dev`** quedó detenido al terminar (`npm run db:down`); sus datos están en el volumen `mysql-dev-data`.

### Aprobación de la implementación

2026-10-09. El usuario aprobó la implementación y la desviación del cliente (cita textual): "Apruebo con la desviación".

## QA Action Plan

2026-10-09, senior-qa (fase Q1). No se ejecutó nada: solo se leyeron el ticket, `CLAUDE.md`, `.claude/rules/` (incluida la sección nueva "Base de datos de pruebas" de `testing.md`), el diff de la rama (46 archivos modificados o eliminados y 19 nuevos, sin contar `.claude/docs/reports/`), `src/db/{client,verify}.ts`, `src/repositories/user-repository.ts`, `compose.yaml`, `docker/mysql/initdb/01-usuarios.sh`, el `Dockerfile`, `ci.yml`, la migración inicial y `tests/support/test-database-config.ts`.

### Objetivo

Comprobar con evidencia que la app funciona sobre MySQL 8.4 (utf8mb4, `utf8mb4_es_0900_as_cs`) sin regresiones, con menor privilegio, verificación al arrancar, RN-1 correcta con concurrencia y sin rastro de SQLite. También hay que valorar los riesgos que deja la desviación aprobada: sin `sessionVariables`, con la colación de conexión por defecto, las fechas puestas por la app y las esperas de bloqueo acotadas por el `timeout` de la transacción.

### Requisito bajo prueba

RF-1 a RF-16, RN-1 a RN-4 y CA-1 a CA-15, con los ajustes P-1, P-2 y P-3 y la desviación aprobada. No se añaden criterios. Lo que el ticket no define se reporta como `REQUIREMENT_AMBIGUITY`, nunca como defecto.

### Criterios de aceptación → pruebas

| CA | Pruebas |
|----|---------|
| CA-1 | F-1, F-2, F-3, B-2 |
| CA-2 | F-4, N-6 |
| CA-3 | F-5, N-1, N-2 |
| CA-4 | F-6, F-7 |
| CA-5 | F-8, N-7 |
| CA-6 | F-9, S-1 |
| CA-7 | N-3, N-4, N-5, L-1 |
| CA-8 | N-8, S-2, S-3 |
| CA-9 | F-10, R-1 |
| CA-10 | L-2, L-3, L-4 |
| CA-11 | F-11, N-9 |
| CA-12 | A-1 a A-5, G-1 |
| CA-13 | I-1 a I-5 |
| CA-14 | D-1 |
| CA-15 | D-2, D-3 |

### Riesgos identificados

1. **Desviación (sin `time_zone` en la sesión).** La migración mantiene `DEFAULT CURRENT_TIMESTAMP(3)` en `user.created_at`, `user_audit.at` y `product.created_at`. Si alguna escritura no fija la fecha y el MySQL del VPS no está en UTC (en `mysql-dev` sí lo está, con `--default-time-zone=+00:00`), la fecha quedaría en hora local y se incumpliría RF-12. Ninguna prueba actual lo detectaría, porque todas corren con el servidor en UTC.
2. **Desviación (sin `innodb_lock_wait_timeout`).** El valor por defecto de MySQL es 50 s. `recordLogin` (`prisma.user.update` de `lastLoginAt`) se ejecuta **fuera** de una transacción, así que el `timeout` de 10 s no la acota. Con la fila bloqueada, el acceso podría quedarse esperando hasta 50 s. Falta comprobar también la escritura de productos y si el pool de 5 conexiones se agota durante la espera.
3. **Desviación (colación de la conexión `utf8mb4_0900_ai_ci`).** Los literales y parámetros tienen menor prioridad que la colación de la columna, así que las comparaciones `columna = ?` y los `ORDER BY columna` deberían usar `es_0900_as_cs`. Una expresión sin columna (por ejemplo, `ORDER BY` sobre un literal o una función) usaría `ai_ci`. Se comprueba con el comportamiento observable (CA-4) y con una revisión de las consultas crudas.
4. **Defecto del driver `mariadb@3.4.5`.** La desviación evita las consultas de inicio de sesión, pero podría quedar otra promesa sin manejar en el handshake (autenticación, `caching_sha2_password` en el camino completo tras reiniciar MySQL). `db-outage` corta la red con el proxy cerrado, no a mitad del handshake.
5. **Plazo de 60 s.** Un intento puede durar más de lo previsto (lo reconoce el propio Implementation Result): con un host que acepta TCP y no responde, o con uno que descarta paquetes, el total podría pasar de 60 s.
6. **Write skew (RN-1)** y pruebas de concurrencia intermitentes.
7. **Salvaguarda de pruebas.** Solo valida el host y el prefijo. Además, los procesos hijos podrían heredar un `DATABASE_URL` del entorno o del `.env` local.
8. **Secretos.** El CLI de Prisma (`migrate`) y el driver pueden escribir el host, el usuario o la URL en sus errores, lo que afecta a la imagen `migrate` y a `admin:recover`.
9. **CI.** No se ha ejecutado en GitHub. Depende de `docker compose` en el runner y del nombre de red `restaurante_db-test`.
10. **Estado del índice de git.** Hay eliminaciones ya añadidas al índice (`D ` en `git status`) y archivos nuevos sin seguimiento. Solo se reporta y no se toca; el commit es de T4.

### Pruebas funcionales

- **F-1 (CA-1, API y formulario).** Ronda manual en el navegador y con Supertest, además de `db-text-roundtrip.test.ts`. Se guarda `Ñandú ¿Qué? ¡Sí! «Pingüino» 🌮` con una descripción que lleva `€` por `/admin` y por la API, y se comprueba que la API, el formulario de edición y la landing devuelven los mismos code points.
- **F-2 (CA-1, hexadecimal).** `SELECT HEX(name), HEX(description) FROM product` con el cliente `mysql` del contenedor. Debe coincidir con el UTF-8 calculado en Node (`Buffer.from(s).toString('hex')`), con 🌮 = `F09F8CAE`. Lo mismo para `product_change.changes` y `user.display_name`.
- **F-3 (CA-1, auditoría y bot).** El nombre visible con la cadena aparece igual en `user_audit.changes`. El bot (`bot:chat` o la prueba del webhook) muestra el nombre del producto intacto.
- **F-4 (CA-2, catálogo).** Consultas a `information_schema.SCHEMATA`, `TABLES` y `COLUMNS` sobre una base migrada: la base, las 8 tablas y cada columna con `CHARACTER_SET_NAME` no nulo deben ser `utf8mb4` + `utf8mb4_es_0900_as_cs`. `_prisma_migrations` debe ser `utf8mb4` (se acepta `utf8mb4_unicode_ci`). Además, `grep` de `utf8mb3|utf8[^m]` en la migración y en el script de inicio.
- **F-5 (CA-3).** Ejecución de `db-text-roundtrip.test.ts` y revisión de que cubre cada columna de la tabla V-4. Los emojis compuestos (familia con ZWJ, bandera, tono de piel) en `name` y `description` deben volver idénticos (si no está cubierto, ver las pruebas nuevas).
- **F-6 (CA-4, unicidad).** Crear `jose` y después `josé` → los dos existen. `Jose`, `  JOSE  ` y `José` en NFD → 422 de CA-9 (REQ-F-007), sin filas nuevas ni auditoría. Se prueba por formulario y por el repositorio.
- **F-7 (CA-4, orden).** El listado de `/admin/usuarios` con `ana`, `zoe`, `ñandu` y `oscar` queda `ana`, `ñandu`, `oscar`, `zoe`. Contraste: se comprueba que con `utf8mb4_0900_ai_ci` la ñ también va después de la n, pero `jose` y `josé` chocarían. Así se demuestra que manda la colación de la columna y no la de la conexión (riesgo 3).
- **F-8 (CA-5).** `last-admin-concurrency.test.ts` completo (50 repeticiones en el repositorio, 50 por HTTP, 50 de recover y 5 con el proceso real), ejecutado **3 veces seguidas** para detectar intermitencias. Al terminar cada caso: número de administradores activos y número de filas de `user_audit` igual a las operaciones aplicadas.
- **F-9 (CA-6).** `SHOW GRANTS` de `restaurante_app` y `restaurante_test_app` (solo `SELECT, INSERT, UPDATE, DELETE`). Con el usuario DML, `CREATE TABLE`, `ALTER` y `DROP` dan 1142. La imagen `migrate` con el usuario de esquema sobre una base vacía → código 0.
- **F-10 (CA-9, primer arranque).** `npm start` con una base vacía migrada (por variables de entorno, sin tocar `.env`): logs `products_imported` (10 y 6) y `admin_bootstrap_created`. `/molotes` y `/birria` coinciden byte a byte con los snapshots (`landing-products.test.ts`).
- **F-11 (CA-11).** `admin:recover` sobre una base migrada con el servidor en marcha restablece el acceso (inicio de sesión real después) y deja la auditoría de CA-15 de REQ-F-007.

### Pruebas negativas y casos límite

- **N-1 (CA-3).** Un texto por encima del máximo de la app se rechaza con 422 por formulario y por API, y un insert directo (con el usuario DML) más largo que la columna da el error 1406, nunca un recorte.
- **N-2 (CA-3, P-3).** Una sal de 65 bytes da "ADMIN_PASSWORD_HASH no es válido" y una de 64 se acepta. Una ruta de imagen de 256 caracteres da 422 "La ruta es demasiado larga (máximo 255 caracteres)" y una de 255 se guarda.
- **N-3 (CA-7, proceso real).** `node src/server.ts` contra bases desechables (una por caso): credenciales inválidas (`DATABASE_AUTH_FAILED`), base inexistente o sin permiso (`DATABASE_ACCESS_DENIED`), sin migrar (`MIGRATIONS_PENDING`), migración aplicada que no existe en el código (`DATABASE_NEWER_THAN_CODE`), checksum alterado (`MIGRATION_MODIFIED`), `finished_at` NULL (`MIGRATION_INCOMPLETE`), colación distinta en la base, en una tabla o en una columna (`DATABASE_CHARSET_INVALID` con `object`), `_prisma_migrations` en `utf8mb3` (inválida) y carpeta de migraciones ilegible (`MIGRATIONS_UNREADABLE`). En cada caso: código 1, una línea `database_init_failed` con el código y stdout/stderr sin URL, contraseña, usuario de la base, SQL ni stack.
- **N-4 (CA-7, modo estricto).** Prueba unitaria existente y, además, una comprobación real: un servidor MySQL desechable con `--sql-mode=""` (contenedor temporal en `127.0.0.1:3308`, ver la pregunta 2) → `DATABASE_NOT_STRICT`.
- **N-5 (CA-7, inalcanzable).** Medición de tiempo real con `time`, en tres variantes:
  - (a) puerto cerrado (ECONNREFUSED);
  - (b) un listener TCP local que acepta y nunca responde;
  - (c) MySQL detenido que arranca a los 20 s (la app debe esperar y arrancar bien).

  En (a) y (b): `DATABASE_UNREACHABLE`, código 1, logs `database_waiting` sin detalles y una duración total ≤ 60 s (ver la pregunta 1).
- **N-6 (CA-2).** `ALTER TABLE … COLLATE utf8mb4_unicode_ci` sobre una tabla y una columna → la app no arranca.
- **N-7 (CA-5).** 503 sin cambios tras agotar los reintentos (prueba existente) y con un bloqueo real (L-4).
- **N-8 (CA-8).** `DATABASE_URL` ausente, con `postgres://`, sin host, sin base, con parámetros de consulta o con `%` mal formado → error de configuración sin el valor. Una contraseña con `@ : / % # ?` codificada según `.env.example` → la app arranca y conecta (usuario temporal creado con root en `mysql-dev` y borrado al terminar).
- **N-9 (CA-11).** `admin:recover` contra una base sin migrar (código 1, mensaje controlado y sin tablas creadas), contra MySQL inalcanzable (código 1 en ≤ 10 s más un intento) y con `DATABASE_URL` ausente o inválida.
- **N-10.** Un borde documentado en V-3: un usuario con guion suave (`jo­se`) cuando existe `jose`. Se espera el 422 (nunca dos cuentas que se confundan). Solo se registra el resultado.
- **N-11.** Huecos en los ids: borrar un producto y crear otro → nada depende de ids consecutivos (la landing y el admin funcionan).

### Pruebas de resiliencia y riesgos de la desviación

- **L-1 (CA-7, MySQL arrancando).** Variante N-5 (c).
- **L-2 (CA-10).** `db-outage.test.ts` ejecutado **10 veces seguidas**, sin fallos ni `unhandledRejection`.
- **L-3 (CA-10, corte real del contenedor).** Servidor real (`npm start`, puerto 3100) sobre `mysql-dev`. Con `docker compose stop mysql-dev`: landings en 200, `/admin` en 503 HTML, API en 503 JSON `DATABASE_UNAVAILABLE` y log `database_unavailable` solo con códigos. **El proceso sigue vivo** (lo confirma `ps`). Con `docker compose start mysql-dev` (camino completo de `caching_sha2_password` tras reiniciar): `/admin` y la API en 200 sin reiniciar la app. Se repite 3 veces, una de ellas cortando a mitad de una ráfaga de peticiones al admin (riesgo 4).
- **L-4 (riesgo 2, esperas de bloqueo).** Con una conexión admin de prueba que mantiene `SELECT … FOR UPDATE` sobre las filas de `user`, se mide:
  - (a) una desactivación por HTTP: 503 en ≤ ~12 s, sin cambios, y la app responde normalmente al liberar el bloqueo;
  - (b) un inicio de sesión cuyo `recordLogin` queda bloqueado: cuánto tarda en responder, qué código devuelve y si el resto del admin sigue respondiendo (pool de 5);
  - (c) una edición de producto con la fila de `product` bloqueada.

  El ticket solo fija "503 sin cambios a medias" (casos límite). Si (b) o (c) esperan hasta 50 s y después responden 503 sin cambios, se reporta como observación de rendimiento, o como `REQUIREMENT_AMBIGUITY` si el usuario quiere un límite. Solo será defecto si se cuelga, si deja cambios a medias o si tumba el proceso.
- **L-5 (riesgo 1, fechas).** En un MySQL desechable con `--default-time-zone=-06:00` (ver la pregunta 2): primer arranque, acceso, alta de usuario, cambio de contraseña y edición de producto. Después, `SELECT DATE_FORMAT(…)` de todas las columnas `DATETIME(3)` frente a la hora UTC del reloj de la prueba (diferencia < 5 s y milisegundos presentes). La auditoría se ordena y se muestra igual.

### Pruebas responsive

Sin cambios de UI. Solo una regresión breve de `/molotes`, `/birria` y `/admin/productos` a 375×812, 768×1024 y 1440×900, con un producto con la cadena de CA-1: sin overflow horizontal ni cortes y con los glifos (emoji y «») bien mostrados.

### Pruebas de accesibilidad

Sin cambios de marcado. Solo se comprueba que la página 503 de `/admin` con la base caída conserva su estructura (título, `h1` y `lang="es"`) y que los mensajes 422 nuevos (ruta demasiado larga) usan el mismo mecanismo accesible que los existentes.

### Pruebas UX/UI (vs. _stich_source_/)

No aplica: no hay cambios visuales (Action Plan, UX/UI). La única diferencia aceptada es el orden en español (F-7).

### Pruebas de integración (WhatsApp)

- **W-1.** Las pruebas existentes del webhook y del bot pasan, y el bot lee el menú desde MySQL (precio, nombre con acentos y emoji). Recorrido de pedido con `npm run bot:chat`.
- **W-2.** El `href` del CTA de WhatsApp en `/molotes` y `/birria` no cambia (snapshots).

### Pruebas de performance

- **P-1.** Duración de `npm test` (referencia del Implementation Result: 54 s) y de `docker compose run --rm test`.
- **P-2.** Tiempos de respuesta de las landings con la base caída frente a la base en marcha (desde la caché, sin espera de 3 a 5 s).
- **P-3.** Tamaño de las imágenes `production` y `migrate`.
- **P-4.** L-4 (esperas de bloqueo).

### Pruebas SEO

Sin cambios: los snapshots byte a byte de las landings (F-10) cubren `title`, la meta description, Open Graph y los encabezados.

### Pruebas de seguridad

- **S-1 (menor privilegio).** F-9, más la comprobación de que la app nunca ejecuta DDL: `grep` de `CREATE|ALTER|DROP|TRUNCATE` en `src/`, y el log general de MySQL (`general_log` activado temporalmente en `mysql-dev`) durante un arranque y un recorrido, filtrado por el usuario `restaurante_app`.
- **S-2 (secretos en los logs, CA-8).** Recorrido completo con `npm start`: acceso, edición de producto, alta de usuario, cambio de contraseña y pedido del bot. Después, `grep` en stdout/stderr de la contraseña de la base, el usuario de la base, `mysql://`, el hash scrypt, la contraseña del admin, la cookie de sesión y el token CSRF. Lo mismo con la salida de la imagen `migrate` y de `admin:recover` ante credenciales inválidas y host inalcanzable.
- **S-3 (salvaguarda, RF-13).** `npm test` con:
  - (a) `TEST_DATABASE_URL` hacia `10.0.0.5`;
  - (b) `TEST_ADMIN_DATABASE_URL` hacia la base `restaurante`;
  - (c) la base `restaurante_testing` (sin el `_` del prefijo);
  - (d) un `DATABASE_URL` real en el entorno del proceso de Vitest.

  En (a), (b) y (c), la suite debe negarse antes de conectar, con un mensaje sin la URL (se comprueba con `general_log` que no hubo conexión). En (d), ninguna prueba ni proceso hijo debe usarlo. Además, se revisa que `runNode` no herede `DATABASE_URL` ni lea el `.env` del usuario.
- **S-4.** `mysql-dev` solo escucha en `127.0.0.1:3307` (`docker port` y `lsof -iTCP:3307`) y el servicio `test` no sale a internet (red `internal: true`).

### Pruebas de imágenes Docker

- **I-1.** `docker build --target production` y `--target migrate`.
- **I-2 (contenido).**
  - `production`: sin `node_modules/prisma`, `@prisma/engines` (CLI), `better-sqlite3`, `@prisma/adapter-better-sqlite3`, `tests/`, `.env` ni `data/*.db`, y con `@prisma/adapter-mariadb`, `mariadb` y `prisma/migrations`.
  - `migrate`: solo `package*.json`, `node_modules`, `prisma/` y `prisma.config.ts`; sin `src/`, `tests/`, `.env` ni `better-sqlite3`.
  - En ambas, `docker history` y `docker inspect` (`Env`) sin secretos.
- **I-3 (usuario no root).** `docker run --rm --entrypoint id` en las dos imágenes debe dar `uid=1000(node)`. `Config.User` = `node`.
- **I-4 (migrate).** Sobre una base vacía → 0. Repetida → 0, sin cambios, comparando la huella de `information_schema`. Con credenciales inválidas o sin `MIGRATION_DATABASE_URL` → distinto de 0 y sin la contraseña en la salida. Con un usuario solo DML → falla sin dejar la base a medias (se registra el estado).
- **I-5 (production).** Sobre la base migrada con el usuario DML → `products_imported` y `server_started`, y `/molotes` en 200 desde el host.

### Divergencia de migraciones

- **G-1.** `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` → 0. En una copia temporal del esquema (en el scratchpad, sin tocar el árbol), un cambio (campo nuevo, longitud distinta) → 2. `tests/unit/migrations-collation.test.ts` falla con una migración temporal con `utf8mb4_unicode_ci` (en un directorio temporal, si la prueba admite la ruta; si no, se revisa su lógica y se registra).

### Pruebas de regresión

- **R-1.** `npm test` completo (todas las suites de landings, admin, API, bot, contenido, seguridad y logs), con `npm run build:css`, `npm run typecheck` y `npm run lint` en 0.
- **R-2.** `docker compose run --rm test` → 0.
- **R-3.** Regresión manual con el servidor real (puerto 3100): `GET /` según el día, `/molotes`, `/birria`, acceso y cierre de sesión en `/admin`, CRUD de productos (incluido el 409 de versión), usuarios (crear, editar, desactivar, el 409 del último administrador), API de productos con CSRF y permisos por negocio.
- **R-4.** Revisión de la lista de pruebas de SQLite sustituidas: cada caso eliminado tiene una sustituta que corre (nombre de la prueba y resultado), y no se debilitó ninguna aserción existente (diff de `tests/`, buscando `skip`, `todo`, aserciones retiradas o márgenes más amplios).

### Documentación e instrucciones (CA-14, CA-15, D-10)

- **D-1 (CA-14).** Seguir `docs/desarrollo.md` al pie de la letra, sin conocimiento previo, con un clon limpio en el scratchpad (`git worktree` no, para no tocar el repositorio; copia con `rsync` excluyendo `node_modules`) o con el árbol actual y variables de entorno: `npm run db:up`, `npm run db:migrate` y `npm run dev` → la app arranca. Se registra cualquier paso que falte, incluido que el `.env` existente no tenga `DATABASE_URL`.
- **D-2 (CA-15).** `grep -rni "sqlite\|better-sqlite3\|restaurante\.db"` en el repositorio (sin `node_modules`, `.git` ni los tickets): solo menciones históricas o negaciones. README, `desarrollo.md`, `despliegue.md` y `.env.example` documentan `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `SHADOW_DATABASE_URL`, utf8mb4 con `utf8mb4_es_0900_as_cs`, el proceso `migrate` y la codificación de la contraseña.
- **D-3 (D-10).** El diff de `.claude/agents/senior-fullstack.md` y `.claude/rules/testing.md` se compara con el texto exacto aprobado en V-5. `CLAUDE.md` no cambia.

### Pruebas automatizadas (existentes y nuevas)

Existentes, que se ejecutan: toda la suite (74 archivos). Las relevantes son `db-text-roundtrip`, `db-verify` (unit e integración), `db-migrations`, `db-outage`, `last-admin-concurrency`, `server-startup`, `admin-recover`, `admin-db-security`, `admin-products-*`, `landing-products`, `user-repository`, `config`, `admin-auth`, `menu-schema`, `migrations-collation` y `test-database-guard`.

**Nuevas** (solo en `restaurante/tests/`, si se aprueban; usan el soporte de `tests/support/` según la regla "Base de datos de pruebas"):

1. `tests/integration/db-lock-wait.test.ts` (L-4): bloqueo real con la conexión admin de prueba. Comprueba que la desactivación responde 503 sin cambios dentro del `timeout` y que la app se recupera al liberar el bloqueo. Registra el comportamiento de `recordLogin` y de la edición de producto con una aserción solo sobre "no deja cambios a medias y el proceso sigue vivo". El tiempo no se afirma mientras no exista un requisito.
2. `tests/integration/db-outage-handshake.test.ts` (riesgo 4): una variante del proxy TCP que corta la conexión a mitad del handshake (después del saludo del servidor y después de la autenticación) mientras llegan peticiones al admin. Con un `process.on('unhandledRejection')` en un proceso hijo real (`startServer`), comprueba que el servidor sigue vivo y se recupera.
3. Casos añadidos a `db-text-roundtrip.test.ts`, si faltan: emojis compuestos (familia con ZWJ, bandera, tono de piel), NFD en textos que no son el usuario (debe volver en NFD, sin normalizar) y el borde del guion suave en el usuario (N-10).

Fuera de `tests/` y ad hoc (scripts en el scratchpad, no versionados): L-5 (MySQL desechable con otra zona horaria), N-4 (sin modo estricto), N-5 (tiempos), N-8 (contraseña con caracteres especiales), S-1 (`general_log`) y S-3 (salvaguarda).

### Pruebas en navegador

Con Claude in Chrome en una pestaña nueva, con el servidor en el puerto 3100 sobre una base de prueba:

- F-1 en el formulario y la landing;
- F-7 en el listado de usuarios;
- el 503 de `/admin` con MySQL detenido (L-3);
- la regresión breve responsive.

No se sigue el enlace de WhatsApp. Si la extensión no responde, se marca como pendiente de revisión manual: ningún CA depende solo del navegador, porque CA-1 tiene evidencia HTTP y en hexadecimal.

### CI

Solo se puede validar en GitHub en T4. En Q2 se hacen una revisión estática de `ci.yml` (orden de pasos, `working-directory`, la red `restaurante_db-test`, URL por defecto y SHA fijados) y una reproducción local de sus pasos: `npm run db:up`, el paso de divergencia con `SHADOW_DATABASE_URL`, `npm test`, el build de las dos imágenes, las comprobaciones de contenido y `migrate` sobre `restaurante_test_ci`. Queda como **pendiente**: confirmar el CI verde en el PR antes del merge (lo comprueba la sesión principal o senior-fullstack en T4).

### Evidencia requerida

Salidas de comandos (resumen con el código de salida y las líneas relevantes), consultas a `information_schema` y `HEX()`, logs filtrados (sin secretos), tiempos medidos, capturas del navegador o texto de la página, y la salida de `docker run … id` y de las comprobaciones de contenido de las imágenes.

### Entorno y limpieza

- `npm run db:up` al empezar y `npm run db:down` al terminar.
- Las bases desechables (`restaurante_test_qa_*`) y el usuario temporal de N-8 se borran.
- Los contenedores temporales de N-4 y L-5 (en `127.0.0.1:3308`, con `--rm`) se eliminan.
- `general_log` se desactiva al terminar.
- El servidor del puerto 3100 se detiene.
- No se modifica `.env`: todo con variables en la línea de comandos.
- `.claude/docs/reports/` no se toca.

### Criterios de aprobación

- CA-1 a CA-15 en PASS con evidencia. El único pendiente aceptable es el CI de CA-12 y CA-13 en GitHub, reproducido en local.
- `npm run typecheck`, `npm run lint` y `npm test` en 0, y `docker compose run --rm test` en 0.
- `last-admin-concurrency` (3 ejecuciones) y `db-outage` (10 ejecuciones) sin fallos.
- El proceso nunca cae con MySQL caído ni con un corte a mitad del handshake.
- Sin secretos en ninguna salida.
- Sin defectos `BLOCKER` ni `CRITICAL`. Los `MAJOR` se resuelven con una decisión del usuario.

### Aprobación del QA Action Plan

2026-10-09. El usuario aprobó el plan (cita textual): "apruebo el plan de QA, todas las recomendadas". Sus respuestas a las preguntas de Q1:

1. Se acepta un margen de un intento de conexión sobre los 60 s (máximo de unos 65 s). Pasarse de ese margen es un defecto.
2. Se autorizan los contenedores MySQL desechables en `127.0.0.1:3308`.
3. Se autorizan el usuario temporal con la contraseña `@:/%#?` y `general_log`, deshaciéndolos al terminar.
4. Un inicio de sesión de hasta unos 50 s con la fila bloqueada que termina en 503 sin cambios es una observación para REQ-F-016. Es defecto si el proceso cae o si queda un cambio a medias.
5. Se autorizan las 3 pruebas nuevas.

Además, si una fecha queda mal guardada con un MySQL fuera de UTC, es un defecto de RF-12.

## QA Report

### Ronda

1 (2026-10-09, senior-qa, fase Q2). Rama `feature/REQ-F-014-migracion-mysql`, cambios sin commit. Comandos desde `restaurante/`, con `npm run db:up` al empezar y `npm run db:down` al terminar. No se modificaron `.env` ni `.claude/docs/reports/`.

### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
|--------|------------------|-----------|
| Preparación | `npm run build:css`, `npm run typecheck`, `npm run lint` | OK, 0 y 0 (sin avisos) |
| R-1 suite (antes de las pruebas nuevas) | `npm test` | 74 archivos, 1447 pasan y 1 fallo esperado; 56,6 s; código 0 |
| R-1 suite (final, con las pruebas nuevas) | `npm test` | **76 archivos, 1456 pasan y 1 fallo esperado; 58,3 s; código 0** |
| R-2 suite en Docker | `docker compose run --rm test` | Código 0: 1455 pasan, 1 fallo esperado y 1 saltada (solo como root); 94,7 s |
| F-8 concurrencia | `last-admin-concurrency.test.ts` ×3 seguidas | 5/5 cada vez (unos 23 s), sin intermitencias |
| L-2 corte | `db-outage.test.ts` ×10 seguidas | 10/10 |
| L-5 fechas fuera de UTC | MySQL desechable con `--default-time-zone=-06:00`: migrate, primer arranque, acceso, alta de usuario, cambio de contraseña, edición de producto por la API y `admin:recover`. Después, `DATE_FORMAT` de todas las columnas `DATETIME(3)` | **Todas las fechas en UTC** (por ejemplo, `created_at` 02:28:37.919 con UTC 02:28 y hora del servidor 20:28) y con milisegundos: `user` (created, updated, last_login), `user_audit.at` (bootstrap, create, password_change, console_recovery), `product`, `product_change` y `product_import`. El riesgo 1 queda descartado |
| N-4 sin modo estricto | MySQL desechable con `--sql-mode=""` | Código 1, `DATABASE_NOT_STRICT` |
| N-5a puerto cerrado | `DATABASE_URL` hacia `127.0.0.1:3399` | `DATABASE_UNREACHABLE`, código 1, **52,8 s**, 13 líneas `database_waiting` (con el código del driver, sin detalles) |
| N-5b TCP que no responde | listener local que acepta y no responde | `DATABASE_UNREACHABLE`, código 1, **54,9 s** |
| N-5c / L-1 MySQL que arranca tarde | app arrancada con `mysql-dev` detenido y `mysql-dev` iniciado a los 20 s | `server_started` a los 23 s; primer arranque completo |
| N-3 verificación (proceso real) | 16 casos sobre bases desechables | Ver CA-7 y CA-2 |
| F-4 catálogo | `information_schema` | Base `utf8mb4`/`utf8mb4_es_0900_as_cs`; las 8 tablas en `es_0900_as_cs`; 34 columnas de texto en `utf8mb4_es_0900_as_cs`; `_prisma_migrations` en `utf8mb4_unicode_ci` (4 columnas utf8mb4). Servidor: `utf8mb4`, `es_0900_as_cs` y `STRICT_TRANS_TABLES` |
| F-9 / S-1 menor privilegio | `SHOW GRANTS`; DDL con el usuario DML; `general_log` durante un arranque y un recorrido | `restaurante_app` y `restaurante_test_app`: solo `SELECT, INSERT, UPDATE, DELETE`. `CREATE`, `ALTER`, `DROP` y `TRUNCATE` → 1142. **742 sentencias del usuario de la app sin ningún DDL**: el único `SET` es `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`, sin `SET NAMES` ni variables de sesión |
| F-1 a F-3 recorrido real | script con `fetch` contra `node src/server.ts` (puerto 3100): acceso, alta de usuario con nombre visible CA-1, cambio de contraseña, edición de producto por la API con la cadena CA-1 y `€` | 303/303/303/200. API, formulario y landing con la cadena exacta. `HEX(name)` y `HEX(display_name)` = UTF-8 calculado en Node (termina en `F09F8CAE`) |
| N-8 configuración | proceso real con `DATABASE_URL` ausente, `postgres://`, sin host, sin base, con `?ssl=true`, con `%ZZ` y con el puerto 99999 | Código 1 y "DATABASE_URL es obligatoria / no es válida", sin el valor (búsqueda de la contraseña y del host: 0) |
| N-8 contraseña especial | usuario temporal con la contraseña `@:/%#?`, codificada como indica `.env.example` (`%40%3A%2F%25%23%3F`) | `server_started`; la contraseña no aparece en la salida |
| N-9 / F-11 `admin:recover` | sin migrar, inalcanzable, ausente, inválida, credenciales malas y base migrada con el servidor en marcha | Código 1 con un mensaje controlado (`MIGRATIONS_PENDING` sin crear tablas, `DATABASE_UNREACHABLE`, `DATABASE_AUTH_FAILED`, configuración) y sin secretos. En la base migrada: código 0, el acceso funciona (303) y auditoría `console_recovery` / `console` |
| L-3 corte real del contenedor | servidor real; `docker compose stop/start` ×2 y `docker kill -s KILL` a mitad de una ráfaga de 8×40 peticiones | Landings en 200 (3-8 ms); `/admin` en 503 HTML y la API en 503 JSON `DATABASE_UNAVAILABLE` (unos 5 s, `acquireTimeout`); **el proceso sigue vivo**; al volver, 200 sin reiniciar. 296 líneas `database_unavailable`, solo con `name`, `code` y `originalCode` |
| L-4 esperas de bloqueo | `db-lock-wait.test.ts` (nueva). Primero con el bloqueo hasta 50 s y después con la versión final (liberado a los 12 s) | Con el bloqueo mantenido: desactivación **503 en 50,2 s**, edición de producto **503 en 50,2 s**, acceso **503 en 50,2 s**, y las otras peticiones atendidas en 36 ms. Liberado a los 15 s (después del `timeout` de 10 s): 503 a los 15 s, **sin cambios ni auditoría**. Versión final: 3/3 |
| Riesgo 4 handshake | `db-outage-handshake.test.ts` (nueva): cortes tras 4 a 4000 bytes en los dos sentidos | 503 en todos los casos, **0 `unhandledRejection`**, recuperación con 200. Sensibilidad comprobada aparte: con `sessionVariables` (la configuración anterior) el mismo corte entre 200 y 400 bytes produce `unhandledRejection` `ER_SOCKET_UNEXPECTED_CLOSE`; con la configuración actual, 0 |
| F-5 a F-7 y N-10 textos | `db-text-roundtrip.test.ts` (16 casos, 5 nuevos) | 16/16 |
| S-2 secretos | búsqueda en los logs de dos servidores reales y del recorrido completo: contraseña y usuario de la base, `mysql://`, contraseñas del admin y del usuario, sal del hash, `scrypt$`, `admin_sid` y csrf | 0 coincidencias en todos los casos |
| S-3 salvaguarda | `vitest run` con una URL hacia `10.0.0.5`, la base `restaurante` y `restaurante_testing`; además, `DATABASE_URL` y `MIGRATION_DATABASE_URL` reales en el entorno | Las tres URL se rechazan antes de conectar, con un mensaje sin la URL (`general_log`: ninguna conexión de los usuarios de prueba). Con las URL reales en el entorno: `server-startup` y `admin-recover` 20/20 y **0 conexiones de `restaurante_app` o `restaurante_migrator`** |
| S-4 red | `docker port`, `lsof` y `docker network inspect` | `127.0.0.1:3307` únicamente; `restaurante_db-test` `internal=true` |
| I-1 a I-3 imágenes | `docker build --target production/migrate`; `id`, contenido e `inspect` | production 252 MB y migrate 527 MB; las dos con `uid=1000(node)` y `Config.User=node`. production: sin `prisma`, `@prisma/engines`, `better-sqlite3`, su adaptador, `tests/`, `.env` ni `data/`, y con el adaptador, `mariadb` y `prisma/migrations`. migrate: solo `package*.json`, `node_modules`, `prisma/` y `prisma.config.ts`, sin `better-sqlite3`. `Env` e historial sin secretos |
| I-4 migrate | base vacía, repetida, credenciales malas, sin URL y usuario DML | 0; 0 ("No pending migrations") con la misma huella del esquema; 1 (P1000); 1; 1 (CREATE denegado, sin crear tablas). La contraseña nunca aparece en la salida |
| G-1 divergencia | `prisma migrate diff --from-migrations … --exit-code` con la base sombra | 0 con el esquema actual; 2 con `name` en `VarChar(81)`; 2 con un campo nuevo (copias en el scratchpad) |
| D-1 desarrollo | pasos de `docs/desarrollo.md` con los valores de `.env.example` (sin tocar `.env`): `db:up`, `db:migrate` y arranque | Arranca y `/molotes` responde 200 |
| D-2 / D-3 documentación | `grep -rni sqlite…`; diff del agente y de la regla | SQLite solo como histórico o en negaciones; el agente y `testing.md` coinciden con el texto de V-5; `CLAUDE.md` sin cambios |
| R-4 pruebas sustituidas | diff de `tests/` frente a `main` | Sin `skip`, `only` ni `todo` nuevos. Las aserciones adaptadas son equivalentes o más estrictas (los barridos de secretos añaden la contraseña y el usuario de la base y `mysql://`) |
| Navegador | Claude in Chrome con el servidor real | Ver UX/UI y Accesibilidad |

### Criterios de aceptación

| CA | Resultado | Evidencia |
|----|-----------|-----------|
| CA-1 | PASS | Recorrido real y `db-text-roundtrip`: API, formulario, landing (verificada en el navegador), `HEX()` = UTF-8 exacto con 🌮 `F09F8CAE`, `product_change` y el nombre visible del usuario (también en `/admin/usuarios`, en el navegador) |
| CA-2 | PASS | Catálogo de F-4. La app no arranca (código 1, `DATABASE_CHARSET_INVALID` con `object`) con otra colación en la base, en `product` o en `product.name`, con `user_audit.changes` en utf8mb3 o con `_prisma_migrations` en utf8mb3. Con `_prisma_migrations` en `unicode_ci`, arranca (P-1) |
| CA-3 | PASS | `db-text-roundtrip` (máximos en emojis y en acentos, edición más grande); límites de P-3 en `admin-auth`, `menu-schema` y `config` (suite verde) |
| CA-4 | PASS | `jose` y `josé` coexisten y cada uno inicia sesión solo con su contraseña. `Jose` y `  JOSE  ` sin recortar, y `José` en NFD, por formulario → 422 sin guardar. El listado del repositorio y el de `/admin/usuarios` (HTML) quedan `ana`, `ñandu`, `oscar`, `zoe` |
| CA-5 | PASS | `last-admin-concurrency` ×3 (50 repeticiones en el repositorio, 50 por HTTP, 50 de recover y 5 con el proceso real `admin:recover`), siempre en verde |
| CA-6 | PASS | La suite y el servidor real corren con el usuario DML; 1142 ante DDL; `general_log` sin DDL; `migrate` con el usuario de esquema → 0 |
| CA-7 | PASS | Proceso real: `DATABASE_AUTH_FAILED`, `DATABASE_ACCESS_DENIED` (base inexistente o sin permiso), `MIGRATIONS_PENDING`, `DATABASE_NEWER_THAN_CODE`, `MIGRATION_MODIFIED`, `MIGRATION_INCOMPLETE` (dos variantes), `DATABASE_CHARSET_INVALID`, `DATABASE_NOT_STRICT` y `MIGRATIONS_UNREADABLE`. Todos con código 1 y sin secretos, SQL ni stack. Inalcanzable: 52,8 s y 54,9 s (dentro de 60 s, sin usar el margen aprobado) |
| CA-8 | PASS | N-8 y S-2: errores de configuración sin el valor y 0 secretos en los logs del recorrido (acceso, edición, alta, cambio de contraseña). El pedido del bot queda cubierto por los barridos de la suite (`whatsapp-webhook` CA-21); ver "Pendientes" |
| CA-9 | PASS | Primer arranque real (dos veces): `admin_bootstrap_created` y `products_imported` 10 (Molotes) y 6 (Birria) desde `seed`. Snapshots byte a byte en `landing-products` (suite verde) |
| CA-10 | PASS | L-2 (10/10), L-3 (stop, start y kill -9 con el servidor real, que sigue vivo y se recupera sin reiniciar) y el nuevo `db-outage-handshake` |
| CA-11 | PASS | N-9 / F-11 (base migrada con auditoría `console_recovery`; base sin migrar → código 1 sin crear tablas) |
| CA-12 | PASS (CI pendiente en GitHub) | typecheck, lint y test en verde en local y en Docker contra MySQL 8.4; sin MySQL, código 1 con el mensaje de `npm run db:up` (comprobado en `test-database-guard` y en el Implementation Result); salvaguarda S-3; divergencia G-1; lista de sustituciones revisada (R-4). El CI se verá en el PR (T4) |
| CA-13 | PASS (CI pendiente en GitHub) | `package.json` sin `better-sqlite3`; el lockfile solo lo declara como par opcional de `prisma`, que no se instala (`node_modules/better-sqlite3` no existe); contenido de las imágenes en I-2; `migrate` → 0 sobre una base vacía. Los pasos del CI se reprodujeron en local |
| CA-14 | PASS | D-1 |
| CA-15 | PASS | D-2 y D-3 |

### Defectos encontrados

### DEF-001
- Severidad: MINOR
- Criterio de aceptación afectado: ninguno. Afecta a la exactitud de la desviación aprobada y de la documentación técnica (comentario de `src/db/client.ts` e "Implementation Result").
- Descripción: la desviación dice que "una espera de bloqueo larga la corta el `timeout` de la transacción de Prisma (10 s, con respuesta 503)". En la práctica, el `timeout` de Prisma no interrumpe una consulta que espera un bloqueo: la espera dura hasta `innodb_lock_wait_timeout` (50 s por defecto en MySQL 8.4), tanto en las escrituras de usuarios (Serializable, `timeout` 10 s) como en la edición de productos y en `recordLogin`. El resultado sigue siendo 503 sin cambios.
- Pasos para reproducir: `db-lock-wait.test.ts` con el bloqueo mantenido más de 50 s (otra conexión con `SELECT … FOR UPDATE` sobre la fila de `user` o `product`) y una desactivación, una edición o un inicio de sesión.
- Resultado esperado (según la desviación): 503 en unos 10 s.
- Resultado actual: 503 a los 50,2 s en los tres casos, sin cambios ni auditoría y con el resto de la app atendiendo (36 ms). Si el bloqueo se libera a los 15 s, la respuesta es 503 en ese momento y no queda nada a medias.
- Evidencia: salida de `db-lock-wait` (versión de 50 s) y de su caso de liberación a los 15 s, en este informe.
- Impacto: solo en la latencia, ante un bloqueo largo, que es raro con una sola instancia. No hay pérdida ni corrupción de datos ni caída del proceso. Según la decisión 4 del usuario, una espera de unos 50 s que termina en 503 sin cambios es una observación para REQ-F-016.
- Recomendación: corregir el comentario de `src/db/client.ts` y el texto de la desviación ("la acota `innodb_lock_wait_timeout` del servidor, 50 s por defecto; se bajará en REQ-F-016"), y llevar a REQ-F-016 el ajuste de `innodb_lock_wait_timeout` en la configuración de MySQL de producción.

No hay defectos BLOCKER, CRITICAL ni MAJOR.

### Regresión

- Suite completa en verde en local (76 archivos) y en Docker.
- Landings: snapshots byte a byte; `/molotes` y `/birria` en 200 con la base caída; CTA de WhatsApp con su `href` (`wa.me/<número>?text=…` según `WHATSAPP_*`) en las dos.
- Admin: acceso, usuarios (alta, desactivación, 409 del último administrador), cuenta, productos (API y HTML, CSRF y permisos por negocio).
- `admin:recover`.
- Bot: el código del bot no cambia en este ticket. Lee la misma caché de productos que las landings, verificada sobre MySQL.

### Responsive

Sin cambios de UI en este ticket. `resize_window` no redujo el viewport del navegador (siguió en 1275 px), así que la comprobación a 375×812 y 768×1024 queda **pendiente de revisión manual**. Ningún CA depende de ella. A 1275 px: sin overflow horizontal en `/molotes` ni en `/birria`, y la tarjeta con «», ¿¡, ü y 🌮 se ve bien.

### Accesibilidad

La página 503 de `/admin` con MySQL detenido conserva `lang="es-MX"`, un solo `h1` ("Administración no disponible"), `main`, el enlace "Saltar al contenido" y un mensaje que no depende solo del color. `/birria` tiene un solo `h1`. El 422 nuevo de la ruta de imagen usa el mecanismo de errores existente (`menu-schema`, suite verde).

### UX/UI

Sin cambios visuales. En el navegador, la tarjeta de bebida de `/molotes` muestra `Ñandú ¿Qué? ¡Sí! «Pingüino» 🌮` y "Precio en € — ñ", y `/admin/usuarios` muestra el nombre visible con emoji. "Último acceso" se muestra en hora de México (21:01 local = 03:01 UTC guardado; RF-12).

### Performance

- Suite: 58,3 s en local (antes del QA, 56,6 s; con SQLite, 15,65 s) y 94,7 s en Docker.
- `/admin` y la API con la base caída responden 503 en unos 5 s (`acquireTimeout`), y las landings en 3-8 ms.
- Imágenes: production 252 MB y migrate 527 MB.
- Esperas de bloqueo: ver DEF-001.

### SEO

Sin cambios: los snapshots byte a byte de las landings pasan. El `title` de cada landing corresponde a su negocio.

### Pendientes de revisión manual

1. **CI en GitHub (T4):** confirmar `calidad` y `docker` en verde en el PR (divergencia, `npm test` contra `mysql-dev`, build de las dos imágenes, contenido y `migrate` sobre `restaurante_test_ci`). Se revisó `ci.yml` de forma estática y sus pasos se reprodujeron en local.
2. **Responsive a 375×812 y 768×1024:** la herramienta no pudo cambiar el tamaño del viewport. No hay cambios de UI.
3. **Pedido del bot contra el servidor real con MySQL:** no se ejecutó porque la URL de la Graph API está fija y enviaría peticiones reales a Meta. Lo cubren la suite (flujo completo con un doble, sin secretos en el log) y el hecho de que el bot use la misma caché de productos que la landing, ya verificada.

### Observaciones (sin defecto)

- `database_waiting` registra el código del driver (`-61`, `45012`), sin URL ni host.
- La salida del CLI de Prisma en la imagen `migrate` muestra el usuario, el host y la base ante un error (nunca la contraseña). Conviene tenerlo en cuenta en los logs del VPS (REQ-F-016/021).
- La espera al arrancar termina antes de los 60 s cuando el siguiente intento ya no cabe (52,8 s y 54,9 s), y `admin:recover` termina en unos 3 s con el puerto cerrado. Las dos están dentro de su plazo.
- `npm run db:migrate` y el arranque de D-1 importaron la semilla en la base de desarrollo `restaurante` de `mysql-dev`, que estaba vacía. Es lo mismo que hará el primer `npm run dev`.
- El índice de git tiene eliminaciones añadidas (`D `) y archivos nuevos sin seguimiento. Queda para el commit de T4.

### Pruebas nuevas o modificadas por QA (solo en `restaurante/tests/`)

- `tests/integration/db-lock-wait.test.ts` (nueva, 3 casos, unos 42 s): bloqueo real de fila liberado a los 12 s. Comprueba que la desactivación, la edición de producto y el acceso no dejan nada a medias, que el resto de la app atiende y que se recupera.
- `tests/integration/db-outage-handshake.test.ts` (nueva, 1 caso, unos 55 s): cortes a mitad del handshake en los dos sentidos. Comprueba que no hay `unhandledRejection`, que responde 503 y que se recupera.
- `tests/integration/db-text-roundtrip.test.ts` (5 casos añadidos): `Jose` y `  JOSE  ` sin recortar por formulario, inicio de sesión de `jose` frente a `josé`, NFD conservado en los textos de producto, orden en el HTML de `/admin/usuarios` y guion suave (resultado: "repetido").

`npm run lint` y `npm run typecheck` terminan en 0 con estas pruebas.

### Entorno al terminar

- `mysql-dev` detenido (`npm run db:down`).
- Contenedores desechables (`qa-mysql-tz`, `qa-mysql-ns`) eliminados.
- Bases `restaurante_test_qa_*` borradas (solo quedan `restaurante` y `restaurante_shadow`).
- Usuario `qa_especial` borrado.
- `general_log` en OFF con `log_output=FILE`, y la tabla vaciada.
- Imágenes `restaurante:qa-*` borradas.
- Ningún servidor en marcha y la pestaña del navegador cerrada.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

2026-10-09. Borrador inicial a partir del análisis de despliegue (`VPS-DOCKER-MYSQL-2026-10-09-analisis.md`) y de la auditoría OWASP. Decisiones del usuario sobre el análisis (cita textual): "todas las recomendadas, la colación de la BD debe soportar idioma español con todos sus simbolos". Quedaron pendientes los datos existentes, la colación, el dominio, el orden, las instrucciones del proyecto y el entorno de desarrollo.

### Versión 2

2026-10-09. Respuesta del usuario al borrador v1 (cita textual): "todas las recomendadas, español moderno, mi dominio es birriaelmuneco.com".

- Confirmadas D-2, D-5 (`utf8mb4_es_0900_as_cs`, español moderno) y D-6.
- Añadidas D-9 (Docker o MySQL 8.4 local) y D-10 (agente `senior-fullstack` y regla de pruebas).
- El orden en español de CA-4 pasa a ser obligatorio.
- Plazo máximo de 60 s de reintentos al arrancar (RF-6 y CA-7).
- Nuevo RF-16.
- Decisiones de los tickets siguientes registradas en el anexo.

Aprobada por el usuario el 2026-10-09 (cita textual): "apruebo REQ-F-014 v2".

### Revisión técnica (T1)

2026-10-09. senior-fullstack hizo la revisión técnica: verificó el adaptador (`@prisma/adapter-mariadb@7.10.0` + `mariadb@3.4.5`, sin scripts de instalación y compatible con `caching_sha2_password`) y la colación que escribe Prisma (`utf8mb4_unicode_ci`, también en `_prisma_migrations`). También verificó D-7 con `utf8mb4_es_0900_as_cs` e hizo el inventario de longitudes, y propuso el diseño completo. Estado: `NEEDS_TECHNICAL_CLARIFICATION`, con tres preguntas (P-1 colación de `_prisma_migrations`, P-2 redacción de CA-5 con `admin:recover`, P-3 límites de la sal y de la ruta de imagen).

### Respuestas a la revisión técnica y Technical Action Plan (T1)

2026-10-09. Respuesta del usuario a P-1, P-2 y P-3 (cita textual): "todas las recomendadas". Con esta respuesta, el usuario **aprueba los ajustes de CA-2** (`_prisma_migrations` como única excepción de colación, que solo debe ser utf8mb4) **y de CA-5** (segundo punto: al menos un administrador activo, un resultado equivalente a una ejecución en serie y una auditoría exacta). También aprueba los límites de P-3 añadidos a CA-3. senior-fullstack añadió el Technical Action Plan. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (T2)

2026-10-09. El usuario aprobó el Technical Action Plan (cita textual): "apruebo el plan técnico". senior-fullstack creó la rama `feature/REQ-F-014-migracion-mysql`, movió el ticket a `in-progress/` e implementó las 7 fases. Hay una desviación del cliente de MySQL, por un defecto de `mariadb@3.4.5` que dejaba una promesa rechazada sin manejar al caer la base: ya no usa `sessionVariables` y la colación de la conexión es la utf8mb4 por defecto. Ver "Implementation Result". Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA Action Plan (Q1)

2026-10-09. El usuario aprobó la implementación con la desviación del cliente (cita textual): "Apruebo con la desviación". senior-qa añadió el QA Action Plan, sin ejecutar pruebas. Riesgos principales: fechas con `DEFAULT CURRENT_TIMESTAMP(3)` sin `time_zone` en la sesión, `recordLogin` fuera de una transacción con `innodb_lock_wait_timeout` por defecto (50 s), cortes a mitad del handshake y plazo real de 60 s. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2), ronda 1

2026-10-09. El usuario aprobó el QA Action Plan (cita textual): "apruebo el plan de QA, todas las recomendadas". senior-qa ejecutó el plan:

- CA-1 a CA-15 en PASS; el CI en GitHub queda pendiente para T4.
- Un defecto MINOR (DEF-001: el `timeout` de 10 s de Prisma no acota las esperas de bloqueo; las acota `innodb_lock_wait_timeout`, 50 s, siempre con 503 sin cambios).
- Se añadieron `db-lock-wait.test.ts`, `db-outage-handshake.test.ts` y 5 casos en `db-text-roundtrip.test.ts`.

Estado: `QA_APPROVED`.

### Commit y Pull Request (T4)

2026-10-09. Se corrigió DEF-001 (MINOR, solo documentación), sin cambios de comportamiento: el comentario de `src/db/client.ts`, la desviación y los pendientes del "Implementation Result" dicen ahora que las esperas de bloqueo las corta `innodb_lock_wait_timeout` del servidor (50 s por defecto), con 503 sin cambios, y que ese valor se bajará en REQ-F-016. Se volvieron a ejecutar typecheck, lint y `npm test` contra MySQL: todo en verde (76 archivos, 1456 pruebas pasan y 1 fallo esperado; 58,9 s).
