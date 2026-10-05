# REQ-F-007 — Control de usuarios: autenticación y roles

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Citas textuales:

- "apruebo 007 y 008";
- confirmación de que la versión aprobada es la que presentó el Business Analyst (P-1 a P-8 y CA-1 a CA-20): "a".

Respuestas a las preguntas de clarificación (cita textual: "apruebo todo"): 7.1 A, 7.2 A, 7.3 A, 7.4 A y 7.5 A. Las propuestas P-1 a P-8 forman parte de la versión aprobada.

Origen: trabajo aparte listado en REQ-F-004 ("Control de usuarios: autenticación y roles").

## Objetivo

Sustituir la cuenta común de la administración (`ADMIN_USER`/`ADMIN_PASSWORD_HASH`, REQ-F-001 C-7) por cuentas personales con roles, guardadas en SQLite con Prisma dentro de `DATA_DIR`. Así cada cambio queda atribuido a una persona verificada y cada editor solo toca los negocios que tiene asignados.

Este ticket también crea la base técnica de Prisma y SQLite que reutiliza REQ-F-008.

## Decisiones confirmadas por el usuario

- **D-1 (7.1 A).** Solo hay usuarios del personal que administra `/admin`. No hay cuentas de clientes.
- **D-2 (7.2 A).** Hay dos roles:
  - **administrador:** gestiona usuarios y edita los dos negocios;
  - **editor:** edita contenido y productos solo de sus negocios asignados.
- **D-3 (7.3 A).** Los usuarios se guardan en SQLite con Prisma, dentro de `DATA_DIR`. La base técnica de Prisma llega con este ticket: el archivo `.db`, las migraciones al arrancar y los ajustes de Docker para Alpine.
- **D-4 (7.4 A).** En el primer arranque sin usuarios, el primer administrador se crea a partir de `ADMIN_USER` y `ADMIN_PASSWORD_HASH`. Después esas variables se ignoran y los usuarios se gestionan desde `/admin`. Si se pierde el acceso, se recupera con un comando de consola.
- **D-5 (7.5 A).** No hay recuperación por correo ni autoservicio. Un administrador restablece la contraseña de otro usuario. El último administrador recupera su acceso por consola.
- **D-6 (P-1).** Los usuarios **no se eliminan, se desactivan**, para conservar su nombre en el registro de cambios. Se pueden reactivar.
- **D-7 (P-2).** Siempre debe haber al menos un administrador activo. Se rechaza desactivar al último administrador activo o cambiarle el rol a editor, también si lo intenta él mismo.
- **D-8 (P-3).** Al desactivar a un usuario, cambiarle el rol o los negocios, o restablecerle la contraseña, se cierran sus sesiones abiertas.
- **D-9 (P-4).** Cada usuario puede cambiar su propia contraseña escribiendo la actual.
- **D-10 (P-5).** Datos de un usuario:
  - usuario de acceso: único, de 1 a 60 caracteres, sin distinguir mayúsculas de minúsculas;
  - nombre visible: de 1 a 60 caracteres; es el que aparece como autor;
  - rol;
  - negocios asignados: al menos uno si es editor; el administrador tiene los dos de forma implícita;
  - activo o no;
  - hash de la contraseña;
  - fechas de creación, actualización y último acceso.

  La contraseña debe tener al menos 12 caracteres.
- **D-11 (P-6).** En el registro de cambios de hero y promociones (REQ-F-001), el autor pasa a ser el nombre visible del usuario autenticado. El campo "Nombre de quien hace el cambio" desaparece. Las entradas antiguas no se modifican.
- **D-12 (P-7).** Se registran las operaciones de gestión de usuarios:
  - crear, editar, desactivar y reactivar;
  - restablecer la contraseña y cambiar la propia;
  - crear el primer administrador;
  - recuperar el acceso por consola.

  Cada registro guarda la fecha, quién lo hizo, a quién afecta y la acción. Nunca guarda contraseñas ni hashes.
- **D-13 (P-8).** Si ya hay usuarios y además están definidas `ADMIN_USER`/`ADMIN_PASSWORD_HASH`, esas variables se ignoran y al arrancar se escribe un aviso informativo en el log, sin mostrar sus valores.

## Alcance

- **Base de Prisma y SQLite en `DATA_DIR`:**
  - el archivo `.db`;
  - migraciones automáticas al arrancar;
  - fallo rápido si la base de datos no está disponible;
  - ajustes del Dockerfile y de `compose.yaml` (REQ-F-003).
- Modelo de usuario y su registro de cambios.
- Primer administrador (D-4) y comando de recuperación por consola (D-5).
- Acceso por usuario, conservando lo de REQ-F-001:
  - sesión que caduca tras 2 h de inactividad;
  - bloqueo de 15 min tras 5 intentos fallidos;
  - CSRF y HTTPS en producción;
  - `noindex` y `no-store`.
- Autorización por rol y por negocio en todas las rutas existentes de `/admin`.
- Página de gestión de usuarios (solo administradores) y página "Mi cuenta" para cambiar la propia contraseña.
- Autor verificado en el registro de hero y promociones (D-11).
- Actualización de `README.md`, `.env.example`, las pruebas y la sección "Persistencia y API" de `.claude/agents/senior-fullstack.md`.

## Fuera de alcance

- Cuentas de clientes y registro público.
- Recuperación de contraseña por correo.
- Segundo factor (2FA) y SSO.
- Credenciales del bot (REQ-F-009).
- Productos en la base de datos (REQ-F-008).
- Sesiones persistentes: siguen en memoria porque hay una sola instancia, y un reinicio cierra todas.
- Varias instancias del servidor.
- Respaldos automáticos del `.db`, que son responsabilidad de quien opera la VM.

## Requisitos

- **R-1. Persistencia.**
  - El `.db` vive en `DATA_DIR`. No se incluye en el repositorio ni en las imágenes.
  - Las migraciones pendientes se aplican al arrancar.
  - Las escrituras son atómicas.
  - Los datos sobreviven a reinicios, despliegues y a la reconstrucción del contenedor si se conserva el volumen.
- **R-2. Base de datos no disponible al arrancar** (archivo dañado, sin permisos de escritura o migración fallida). El servidor no arranca: termina con código 1 y deja en el log un error controlado, sin rutas ni SQL.
- **R-3. Fallo de la base de datos con el servidor en marcha.** El acceso y la administración responden 503 con un aviso accesible. Las landings no se ven afectadas.
- **R-4. Primer administrador (D-4).**
  - Sin usuarios y con las dos variables definidas, se crea un administrador activo con ese usuario y ese hash. Su nombre visible es igual al usuario y se puede editar después.
  - Sin usuarios ni variables, la administración queda deshabilitada (503), igual que en REQ-F-001 DT-7.
  - Si solo está definida una de las dos variables, o el hash no es válido, sigue siendo un error de configuración.
  - Si ya hay usuarios, se aplica D-13.
- **R-5. Recuperación por consola (D-5).** Un comando npm crea un administrador, o reactiva uno y le restablece la contraseña, directamente sobre el `.db` de `DATA_DIR`.
  - Pide la contraseña sin mostrarla.
  - Cierra las sesiones del usuario afectado si el servidor está en marcha.
  - Queda en el registro (D-12).
  - El nombre del comando lo decide `senior-fullstack`.
- **R-6. Acceso.**
  - Se entra con usuario y contraseña.
  - Un usuario desactivado no puede entrar. El mensaje de error es el mismo para credenciales incorrectas y para cuentas desactivadas.
  - Se conservan la caducidad, el límite de intentos, el CSRF, HTTPS y el cierre de sesión de REQ-F-001.
- **R-7. Autorización.**
  - El administrador puede hacer todo.
  - El editor solo ve y edita sus negocios asignados: hero, promociones, menú, restaurar la versión anterior o la semilla, y los conflictos.
  - En un negocio no asignado recibe 403 con un aviso y no se escribe nada.
  - La página de inicio de `/admin` solo muestra los negocios permitidos.
  - La gestión de usuarios es solo para administradores; un editor recibe 403.
- **R-8. Gestión de usuarios.** Formularios HTML nativos, sin JavaScript, con POST-redirect-GET y CSRF:
  - lista con usuario, nombre, rol, negocios, activo y último acceso;
  - crear y editar (D-10);
  - desactivar y reactivar (D-6), respetando D-7 y D-8;
  - restablecer la contraseña de otro usuario: el administrador escribe la nueva y no se envía por ningún canal;
  - los errores aparecen junto a cada campo, se conserva lo escrito y se anuncian de forma accesible.
- **R-9. Mi cuenta (D-9).** Para cambiar la contraseña se escribe la actual y dos veces la nueva. Al cambiarla se cierran las demás sesiones de ese usuario.
- **R-10. Autor verificado (D-11).** Cada escritura de hero y promociones registra el nombre visible y el identificador del usuario autenticado.
- **R-11. Seguridad.**
  - Las contraseñas se guardan como hash scrypt.
  - Ni las contraseñas, ni los hashes, ni los tokens aparecen en logs, respuestas o páginas.
  - Ningún formulario muestra el hash.
- **R-12. Documentación.**
  - `README.md` y `.env.example` explican:
    - la ubicación del `.db`;
    - las migraciones automáticas;
    - que `ADMIN_USER`/`ADMIN_PASSWORD_HASH` solo se usan en el primer arranque;
    - el comando de recuperación;
    - los roles;
    - la recomendación de respaldar el `.db`.
  - `senior-fullstack.md` describe la nueva persistencia y la nueva autenticación.

## Historias de usuario

- **HU-1.** **Como** dueño **quiero** que cada persona tenga su propia cuenta **para** saber de verdad quién cambió qué.
- **HU-2.** **Como** dueño **quiero** limitar a un editor a un solo negocio **para** que no toque el otro.
- **HU-3.** **Como** administrador **quiero** dar de alta, desactivar y restablecer contraseñas sin tocar el servidor.
- **HU-4.** **Como** dueño **quiero** recuperar el acceso si se pierde la contraseña del último administrador.
- **HU-5.** **Como** dueño **quiero** que la migración no me deje fuera **para** seguir entrando con mi cuenta actual, que pasa a ser la del primer administrador.

## Reglas de negocio

- **RN-1.** Siempre hay al menos un administrador activo (D-7).
- **RN-2.** Un editor nunca escribe en un negocio que no tiene asignado.
- **RN-3.** Toda escritura tiene como autor a un usuario autenticado y queda registrada.
- **RN-4.** Los usuarios no se eliminan (D-6).
- **RN-5.** Se conservan RN-1 y RN-2 de REQ-F-003: no se hornean secretos ni datos en las imágenes, y la configuración se valida al arrancar.

## Criterios de aceptación

- **CA-1.** Given un `DATA_DIR` sin `.db` y con `ADMIN_USER`/`ADMIN_PASSWORD_HASH` válidas, When arranca el servidor, Then:
  - se crea el `.db` y se aplican las migraciones;
  - se crea un administrador con esas credenciales;
  - se puede entrar con la contraseña de siempre;
  - el registro anota la creación inicial.
- **CA-2.** Given usuarios existentes, When se reinicia con otras `ADMIN_USER`/`ADMIN_PASSWORD_HASH`, Then:
  - no se crea ni se modifica ningún usuario;
  - las credenciales del entorno no permiten entrar;
  - el log muestra el aviso de D-13 sin los valores.
- **CA-3.** Given que no hay usuarios ni variables, When se abre `/admin`, Then responde 503 y las landings responden 200.
- **CA-4.** Given un `.db` dañado, una migración que falla o un `DATA_DIR` sin permisos de escritura, When arranca el servidor, Then termina con código 1 y un mensaje controlado, sin stack trace ni SQL.
- **CA-5.** Given que la base de datos falla con el servidor en marcha:
  - When se intenta entrar o usar `/admin`, Then responde 503.
  - When se carga una landing, Then responde 200.
- **CA-6.** Given un editor asignado solo a Molotes:
  - When abre o envía un formulario de `/admin/birria` (guardar, restaurar o conflicto), Then recibe 403 y el JSON de Birria no cambia.
  - When abre `/admin`, Then solo ve Molotes.
- **CA-7.** Given un editor, When abre la gestión de usuarios o envía uno de sus formularios, Then recibe 403 y nada cambia.
- **CA-8.** Given un administrador, When crea un editor con usuario, nombre, contraseña de al menos 12 caracteres y al menos un negocio, Then el editor puede entrar y solo ve sus negocios.
- **CA-9.** Given cualquiera de estos datos al crear un usuario, When se envía el formulario, Then se muestra el error junto al campo y no se guarda nada:
  - un usuario que ya existe, aunque cambien mayúsculas y minúsculas;
  - una contraseña de menos de 12 caracteres;
  - un editor sin negocios.
- **CA-10.** Given un único administrador activo, When intenta desactivarse o cambiarse el rol a editor, Then se rechaza con un mensaje claro (D-7).
- **CA-11.** Given un usuario con la sesión abierta, When un administrador lo desactiva, le cambia el rol o los negocios, o le restablece la contraseña, Then:
  - su siguiente petición pide acceso de nuevo (D-8);
  - si fue desactivado, no puede volver a entrar.
- **CA-12.** Given un usuario desactivado, When intenta entrar, Then ve el mismo mensaje que con credenciales incorrectas. When se reactiva, Then puede entrar.
- **CA-13.** Given un usuario, When cambia su contraseña con la actual correcta, Then puede entrar con la nueva y ya no con la anterior. Con la actual incorrecta, nada cambia.
- **CA-14.** Given que un usuario con nombre visible "Ana" guarda el hero de Molotes, When se consulta el registro, Then el autor es "Ana", con su identificador. El formulario ya no tiene el campo de autor.
- **CA-15.** Given que se perdió la contraseña del último administrador, When se ejecuta el comando de R-5, Then se puede entrar con la contraseña nueva y queda en el registro.
- **CA-16.** Se mantiene lo de REQ-F-001:
  - caducidad de la sesión a las 2 h;
  - bloqueo de 15 min tras 5 fallos (429);
  - CSRF (403);
  - HTTPS en producción;
  - cierre de sesión;
  - `noindex` y `no-store`.
- **CA-17.** Ninguna línea de log, respuesta ni página contiene contraseñas, hashes, el id de sesión ni el token CSRF. Se verifica en las pruebas con el logger capturado.
- **CA-18.** Todo funciona sin JavaScript. Recargar después de un POST no repite la operación.
- **CA-19.** La imagen `production`:
  - aplica las migraciones y funciona en Alpine, en amd64 y en arm64;
  - se ejecuta sin root;
  - no contiene `.env`, `data/` ni `.db`;
  - con un volumen conservado, los usuarios persisten después de reconstruirla.

  Además, `docker compose run --rm test` y el CI (REQ-F-006) pasan.
- **CA-20.** `typecheck`, `lint` y `npm test` pasan, sin cambios en los snapshots de las landings. `README.md`, `.env.example` y `senior-fullstack.md` cumplen R-12.

## Casos límite

- Primer arranque con el `.db` vacío, con y sin variables (CA-1 a CA-3).
- Actualizar desde la versión anterior con una sesión abierta: después del reinicio hay que volver a entrar.
- Usuario de acceso con mayúsculas o con espacios alrededor.
- Un administrador que se desactiva a sí mismo sin ser el último: se permite y su sesión se cierra.
- Dos administradores que editan al mismo usuario a la vez. Lo decide la revisión técnica; la propuesta es que gane la última escritura y se registren las dos.
- Un editor que pierde un negocio mientras lo está editando (CA-11).
- El comando de consola con el servidor parado o en marcha.
- La sesión caduca a mitad de un formulario de usuarios.
- Botón atrás después de cerrar sesión: no se muestran datos guardados en caché.

## Dependencias

- REQ-F-004 (TypeScript). El cliente de Prisma debe funcionar con el type stripping de Node 24.
- REQ-F-001: sesión, CSRF, límite de intentos, registro de cambios y formato de errores.
- REQ-F-003: Dockerfile y compose.
- REQ-F-005 y REQ-F-006: el lint y el CI deben pasar si ya existen.
- Dependencias nuevas de Prisma (CLI, cliente y adaptador de SQLite) con versiones exactas, porque el dist-tag `latest` apuntaba a una RC en la revisión anterior. Se justifican porque el usuario pidió Prisma explícitamente.

## Riesgos

- Binarios nativos de Prisma en Alpine (musl), en las dos arquitecturas, más OpenSSL.
- Las migraciones automáticas pueden fallar en producción. Se mitiga con el fallo rápido (R-2) y con los respaldos del `.db`.
- Si se pierde el `.db` sin respaldo, se pierden los usuarios. El acceso se recupera por consola, pero el registro de cambios de usuarios se pierde.
- La imagen de producción puede crecer unos 300 MB, según cómo se resuelva Q-2.

## Pendiente para la revisión técnica (senior-fullstack)

- **Q-2** (de la revisión técnica del análisis de producto descartado): cómo se aplican las migraciones en producción, con el CLI oficial de Prisma dentro de la imagen o con un aplicador propio. Afecta al tamaño de la imagen y a los binarios nativos.
- **Q-1** de esa revisión ya no aplica, porque el backend es TypeScript.
- **Q-3** se resuelve en REQ-F-008.

## Action Plan

### Objetivo

Que cada persona entre con su propia cuenta, solo toque lo que le corresponde y cada cambio tenga un autor verificado, sobre una base de Prisma y SQLite reutilizable.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Base de Prisma y SQLite: dependencias, esquema, migraciones al arrancar, comprobación de escritura, fallo rápido y Docker (R-1, R-2).
2. Modelo de usuario y registro de cambios de usuarios (D-10, D-12).
3. Primer administrador y D-13 (R-4).
4. Acceso por usuario sobre la sesión existente (R-6).
5. Autorización por rol y por negocio en `/admin` (R-7).
6. Gestión de usuarios y Mi cuenta (R-8, R-9).
7. Autor verificado en hero y promociones (R-10).
8. Comando de recuperación (R-5).
9. Pruebas unitarias, de integración y de arranque para CA-1 a CA-20.
10. Documentación (R-12).

### Reglas de negocio

RN-1 a RN-5.

### UX/UI

Administración sencilla y sin diseño en `_stich_source_/`, igual que REQ-F-001 C-8. Formularios accesibles, sin JavaScript y con acciones nombradas con texto.

### Integraciones

Ninguna externa.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-20.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

Seguir el orden de "Cambios requeridos", con la suite en verde tras cada paso.

### Resultado esperado

Cada persona entra con su cuenta, solo toca lo que le corresponde y cada cambio tiene un autor verificado. La base de Prisma queda lista para REQ-F-008.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Base de Prisma persistente | R-1 a R-3, D-3 | HU-5 | CA-1, CA-4, CA-5, CA-19 |
| Migración sin perder el acceso | R-4, R-5, D-4, D-5, D-13 | HU-4, HU-5 | CA-1 a CA-3, CA-15 |
| Cuentas y roles | R-6 a R-9, D-1, D-2, D-6 a D-10 | HU-1 a HU-3 | CA-6 a CA-13, CA-16, CA-18 |
| Autor verificado | R-10, D-11, D-12 | HU-1 | CA-14 |
| Seguridad y documentación | R-11, R-12 | — | CA-17, CA-20 |

No hay diseño asociado en `_stich_source_/`: la administración no tiene diseño fuente.

## Technical Action Plan

Revisión técnica de `senior-fullstack` (2026-10-05) sobre `main` en `56a7b75`. Incluye un spike en el scratchpad, sin tocar el repositorio: instalación, generación del cliente, migraciones, `tsc` y ESLint con la configuración del proyecto, y builds de Docker en Alpine amd64 y arm64.

### Objetivo técnico

- Crear la base de Prisma 7 y SQLite en `DATA_DIR/restaurante.db`, reutilizable por REQ-F-008.
- Sustituir la credencial común por cuentas en base de datos, autorizadas por rol y por negocio en todo `/admin`.
- Conservar la sesión en memoria, el CSRF, el límite de intentos, HTTPS y `noindex`/`no-store` de REQ-F-001.
- No cambiar las landings.

### Hallazgos del spike (2026-10-05)

| # | Hallazgo | Consecuencia en el plan |
| --- | --- | --- |
| S-1 | En npm, `prisma@latest` es `8.0.0-rc.20`. La versión estable es **7.10.0** para `prisma`, `@prisma/client` y `@prisma/adapter-better-sqlite3`. El adaptador exige `better-sqlite3@^12.6.0`: la 13.0.3 no es compatible y se usa la **12.11.1**. | Se fijan versiones exactas, sin `^` (DT-2). |
| S-2 | El generador `prisma-client` (`moduleFormat = "esm"`, `importFileExtension = "ts"`) genera unos 284 KB en `src/generated/prisma`, y siempre los mismos. Node 24 lo ejecuta con type stripping. `tsc` lo acepta con el `tsconfig.json` actual (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) y el lint del proyecto pasa sin avisos sobre el código que lo usa. Detalle: el cliente generado asigna `globalThis.__dirname`. | No se versiona y se genera con `npm run db:generate` (DT-4). |
| S-3 | **`@prisma/client` declara `prisma` y `typescript` como `peerDependencies`.** Con `npm ci --omit=dev`, npm instala igualmente el CLI, TypeScript, `@prisma/dev`, pglite, effect y otros paquetes: `node_modules` ocupa 361 MB y la imagen, 535 MB. Con `npm ci --omit=dev --omit=optional` (en el lockfile figuran como `devOptional`) quedan 43 paquetes y 85 MB. El lockfile actual no tiene dependencias opcionales de producción, así que la opción no quita nada necesario. | `production` instala con `--omit=dev --omit=optional` (DT-6). |
| S-4 | npm 11.19 (el de `node:24-alpine` y el local) avisa de los scripts de instalación no aprobados (`better-sqlite3`, `prisma`, `@prisma/engines`), pero los ejecuta (`strict-allow-scripts=false`). Su documentación ya los describe como "bloqueados por defecto". Con `allowScripts` fijado por versión en `package.json` y `npm ci --strict-allow-scripts`, la instalación funciona. Un script nuevo sin aprobar hace fallar la instalación en lugar de omitirse en silencio. | Se agregan `allowScripts` y `--strict-allow-scripts` (DT-2). |
| S-5 | `better-sqlite3` 12.11.1 tiene binarios precompilados `linuxmusl-x64` y `linuxmusl-arm64` para Node 24 (ABI 137), que se descargan de GitHub durante `npm ci`. No hace falta compilar (ni python ni g++) y el tiempo de ejecución no necesita OpenSSL. | No hay paquetes `apk` nuevos. |
| S-6 | Opción B de Q-2 (aplicador propio): genera en `_prisma_migrations` filas idénticas a las de Prisma (id UUID, `checksum` = SHA-256 hex del `migration.sql`, fechas en ms, `applied_steps_count`). Sobre una base aplicada por él, `prisma migrate status` responde "up to date", `migrate deploy` responde "No pending migrations" y `migrate dev` no detecta deriva. `prisma migrate diff --from-config-datasource --to-schema --exit-code` devuelve 0 sin cambios y lista los cambios cuando los hay. | Una prueba automática verifica la compatibilidad en cada ejecución (DT-3). |
| S-7 | **Las migraciones de Prisma que redefinen tablas en SQLite** (`PRAGMA foreign_keys=OFF` + `DROP TABLE` + `RENAME`) dentro de una transacción no desactivan las FK, porque ese PRAGMA no tiene efecto dentro de una transacción. **Un `ON DELETE CASCADE` borra las filas hijas sin avisar.** Se reprodujo: 1 fila hija pasa a 0. Con `foreign_keys=OFF` antes de `BEGIN` se conserva. | El aplicador sigue el procedimiento oficial de SQLite: FK desactivadas fuera de la transacción, `BEGIN IMMEDIATE`, script, `foreign_key_check` y `COMMIT` (DT-3). Es crítico para las variantes y chips de REQ-F-008. |
| S-8 | Detección al arrancar con `better-sqlite3`: `.db` de solo lectura → `SQLITE_READONLY`; carpeta sin escritura → `SQLITE_READONLY_DIRECTORY`; archivo dañado → `SQLITE_NOTADB`. Las tres se detectan con una escritura de prueba (`BEGIN IMMEDIATE` + DDL temporal + `COMMIT`) y `PRAGMA quick_check`, aunque no haya migraciones pendientes. | R-2 y CA-4 se cumplen sin depender del CLI. |
| S-9 | Un fallo de SQLite en tiempo de ejecución llega como `PrismaClientKnownRequestError` (p. ej. `P2039`), con el código original en `meta.driverAdapterError.cause.originalCode` (`SQLITE_NOTADB`...). El `message` incluye la invocación y rutas de archivo. Un usuario repetido llega como `P2002`. | Solo se registran `name`, `code` y `originalCode`, nunca el `message` (DT-9). |
| S-10 | Una transacción interactiva (`$transaction(async tx => …)`) que escribe y después comprueba revierte correctamente si la comprobación lanza un error. SQLite tiene un único escritor, así que la comprobación posterior a la escritura es segura también frente a otro proceso (el comando de consola). | Así se impone D-7 (DT-8). |
| S-11 | Docker: con la **opción B**, la imagen funciona en `linux/arm64` y `linux/amd64` como usuario `node`, migra en el primer arranque, no hace nada en el segundo y pesa **258 MB (arm64) / 262 MB (amd64)**, frente a los 172/176 MB actuales. Con la **opción A**, `prisma migrate deploy` funciona en arm64 (`node:24-alpine` ya trae `libssl3`) y la imagen pesa **535 MB**. | Ver Q-2. |

### Q-2: cómo se aplican las migraciones en producción

| | A) `prisma migrate deploy` oficial | B) Aplicador propio (recomendada) |
| --- | --- | --- |
| Imagen `production` | Unos 545 MB (+370 MB): CLI, `@prisma/dev`, pglite, effect, TypeScript, mysql2, postgres y el `schema-engine` nativo. | Unos 262 MB (+86 MB, casi todo de `@prisma/client`). |
| Binarios nativos en producción | `better-sqlite3` y `schema-engine-linux-musl-*-openssl-3.0.x` (depende de `libssl3`, que hoy viene en la imagen base). | Solo `better-sqlite3`. |
| Arranque | `CMD` con dos procesos (`prisma migrate deploy && node src/server.ts`) o un `spawn` desde la app. Unos 1-2 s más. | Dentro de `src/server.ts`, en milisegundos y con un único proceso (PID 1 conserva `SIGTERM`). |
| Si falla una migración | Queda marcada como fallida en `_prisma_migrations` y hay que resolverla a mano con `prisma migrate resolve`. | Se revierte entera (transacción), nada queda a medias y el servidor sale con 1. |
| Comprobación de escritura (R-2) | `migrate deploy` sale con 0 sobre un `.db` de solo lectura: la app tiene que comprobarlo igualmente. | Se hace en el mismo paso. |
| Mantenimiento | Ninguno propio. | Unas 120 líneas propias. Si una versión futura de Prisma cambiara el formato de `_prisma_migrations` (estable desde Prisma 2), lo detecta la prueba de compatibilidad con el CLI real (S-6) antes de llegar a producción. |
| Desarrollo | Igual: `prisma migrate dev` crea las migraciones en los dos casos. | Igual. |

**Recomendación: B.** La imagen pesa la mitad, no hay segundo binario nativo ni dependencia de OpenSSL, la migración es atómica y se ejecuta en un solo proceso. Además R-2 obliga a la app a comprobar la escritura con cualquiera de las dos opciones. El riesgo de B (desviarse del formato de Prisma) queda cubierto por una prueba contra el CLI oficial que corre en `npm test`, en el CI y en `docker compose run --rm test`.

### Decisiones técnicas

| ID | Decisión | Motivo |
| --- | --- | --- |
| DT-1 | El `.db` es `DATA_DIR/restaurante.db`, en modo WAL (`restaurante.db-wal` y `-shm` en la misma carpeta), con `busy_timeout` de 5 s y FK activas. | WAL permite que el comando de consola escriba con el servidor en marcha. Con el volumen de Docker (modo 700) los archivos quedan protegidos. |
| DT-2 | Dependencias con versión exacta. `dependencies`: `@prisma/client@7.10.0`, `@prisma/adapter-better-sqlite3@7.10.0` y `better-sqlite3@12.11.1` (la importa el aplicador). `devDependencies`: `prisma@7.10.0` y `@types/better-sqlite3@9.6.0` (verificado con `tsc`). `allowScripts` fijado a `better-sqlite3@12.11.1`, `prisma@7.10.0` y `@prisma/engines@7.10.0`. `npm ci --strict-allow-scripts` en Docker y en el CI. | `dependencias.md`: lo pidió el usuario (D-3). Fijar versiones evita la RC de `latest` (S-1) y la aprobación explícita evita sorpresas con npm (S-4). |
| DT-3 | Q-2 = B. `src/db/migrate.ts` hace lo siguiente: (1) abre con `better-sqlite3` y comprueba escritura e integridad (S-8); (2) crea `_prisma_migrations` con el DDL de Prisma; (3) falla si una migración aplicada ya no existe en el código (base más nueva que el código), si su checksum cambió o si hay una migración sin terminar; (4) aplica las pendientes en orden: `foreign_keys=OFF` → `BEGIN IMMEDIATE` → script → `foreign_key_check` → registro → `COMMIT` → `foreign_keys=ON` (S-7). | Ver Q-2. |
| DT-4 | El cliente se genera en `src/generated/prisma` (ya ignorado por ESLint) y se agrega a `.gitignore` y `.dockerignore`. Nuevos scripts: `db:generate` (`prisma generate`) y `db:migrate:dev` (`prisma migrate dev`, solo para crear migraciones nuevas). Se agrega un paso explícito `npm run db:generate` en el CI (antes de typecheck) y en la etapa `build` de Docker. No se usa `postinstall`: en `production` (sin CLI) fallaría. | Un cliente versionado se desincroniza del esquema. El paso explícito es visible y barato (unos 1-2 s). |
| DT-5 | `prisma.config.ts` en la raíz de `restaurante/`. Carga `.env` si existe (`process.loadEnvFile`) y apunta a `DATA_DIR` o, en su defecto, a `data/`, con el mismo nombre de archivo que la app. Se agrega a `include` de `tsconfig.json` (lint con tipos). No entra en la imagen de producción. | Prisma 7 ya no lee `.env` ni la URL del esquema. |
| DT-6 | `production`: `npm ci --omit=dev --omit=optional --strict-allow-scripts`. Copia `src/` (con el cliente generado en `build`), `public/`, `prisma/migrations/` y `scripts/*.ts`. No requiere paquetes `apk` nuevos. | S-3 y S-5. Sin `scripts/` no existiría el comando de recuperación en el contenedor. |
| DT-7 | La sesión guarda `userId` y `sessionVersion`. En cada petición de `/admin`, el guard carga el usuario por id y rechaza la sesión si no existe, está inactivo o su `session_version` cambió. Desactivar, cambiar el rol o los negocios, o restablecer la contraseña incrementa `session_version` (D-8). El comando de consola hace lo mismo desde otro proceso, así que cierra las sesiones con el servidor en marcha (R-5) sin necesidad de comunicación entre procesos. Al cambiar la propia contraseña (R-9) se incrementa la versión y se emite una sesión nueva para la petición actual: las demás sesiones quedan cerradas. | Una consulta por clave primaria por petición. Además, la autorización siempre usa el rol y los negocios vigentes. |
| DT-8 | D-7 se impone en una transacción: primero se escribe y después se cuenta `role=admin AND active` dentro de la misma transacción; si queda 0, se revierte. Ante ediciones simultáneas gana la última escritura y cada una queda registrada (propuesta del ticket). | S-10: es correcto frente a dos peticiones y frente al comando de consola. |
| DT-9 | Errores de base de datos: todo error de Prisma o SQLite que no sea esperado (`P2002` usuario repetido, `P2025` no encontrado) se convierte en `DatabaseUnavailableError`. En `/admin` responde **503** con una página HTML y un aviso `role="alert"`. El log solo registra `name`, `code` y `originalCode`, nunca `message`, SQL ni rutas. El cliente usa `errorFormat: 'minimal'`. Las landings no consultan la base de datos en este ticket. | R-3, CA-5 y CA-17. |
| DT-10 | Autenticación: búsqueda por `username_key` (recortado, NFC y en minúsculas). Si el usuario no existe o está inactivo, se ejecuta scrypt contra un hash ficticio calculado al arrancar y se muestra el mismo mensaje y el mismo código (401). Si el acceso es correcto, se actualiza `last_login_at`. Los usuarios nuevos usan `SCRYPT_DEFAULTS`; en las pruebas el costo se inyecta como `N=2^14`, igual que hoy. | R-6 y CA-12, sin revelar si la cuenta existe. |
| DT-11 | La configuración `config.admin` pasa a `config.adminBootstrap`, con la misma validación de DT-7 de REQ-F-001 (las dos variables o ninguna, hash válido, hasta 60 caracteres). Al arrancar: sin usuarios y con variables → se crea el administrador y se registra en la auditoría (`bootstrap`); con usuarios y variables → aviso `admin_bootstrap_ignored` sin valores (D-13); sin usuarios ni variables → `/admin` responde 503 `ADMIN_UNAVAILABLE` (se conserva la respuesta JSON actual). El gate vuelve a comprobar si hay usuarios mientras no los haya: si el comando de consola crea el primero con el servidor en marcha, `/admin` se habilita sin reiniciar. | R-4 y CA-1 a CA-3. |
| DT-12 | Autorización. Orden en un POST: mismo origen → sesión (303 a acceso) → **permiso (403)** → body y CSRF (403) → validación (422) → escritura → 303. El 403 por permiso es una página HTML con aviso y navegación; los 403 por CSRF y origen conservan el JSON actual. Como el permiso se comprueba antes de leer el body, un editor no llega a escribir nada (CA-6 y CA-7). | R-7. |
| DT-13 | Registro de hero y promociones (R-10): el autor sale de la sesión. `save`, `restorePrevious` y `restoreSeed` reciben `author: { id, name }`. El documento conserva `updatedBy` (nombre visible) y cada línea de `changes.jsonl` agrega `authorId`. Las entradas antiguas no se tocan. El campo "Nombre de quien hace el cambio" desaparece de los cuatro formularios (guardar, conflicto, restaurar y semilla). | D-11 y CA-14, sin cambiar el esquema del JSON de menús (REQ-F-008 lo sustituye para productos). |
| DT-14 | Comando de recuperación: `npm run admin:recover -- --usuario <nombre>`, que equivale a `node --env-file-if-exists=.env scripts/admin-recover.ts`. En Docker: `docker exec -it <contenedor> node scripts/admin-recover.ts --usuario <nombre>`. Pide la contraseña dos veces sin mostrarla (sin TTY lee la primera línea de stdin; así se prueba) y exige al menos 12 caracteres. Aplica las migraciones pendientes. Si el usuario no existe, crea un administrador. Si existe, lo deja activo y con rol administrador (si era editor, lo promueve), cambia el hash e incrementa `session_version`. Registra `console_recovery` en la auditoría. La lectura oculta se mueve a `scripts/support/read-hidden.ts`, compartida con `admin:hash-password`. | R-5 y CA-15. El objetivo del comando es recuperar acceso de administrador. |
| DT-15 | Datos de usuario. Usuario: recortado, de 1 a 60 caracteres, sin caracteres de control, único por `username_key` y editable. Nombre visible: recortado, de 1 a 60 caracteres. Contraseña: de 12 a 256 caracteres (el máximo es defensivo, porque scrypt procesa todo el texto). Editor: al menos un negocio. Administrador: no guarda negocios, los tiene todos de forma implícita. | D-10 y CA-9. |
| DT-16 | Auditoría de usuarios en la tabla `user_audit`. Guarda la fecha, la acción (`bootstrap`, `create`, `update`, `deactivate`, `reactivate`, `password_reset`, `password_change`, `console_recovery`), el actor (`actor_id` o `actor_kind` = `console`), el usuario afectado y los cambios en JSON: campo, antes y después, solo para usuario, nombre, rol, negocios y activo. Nunca guarda contraseñas ni hashes. No tiene pantalla en este ticket (no se pidió). | D-12. |

### Esquema Prisma (`prisma/schema.prisma`)

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "ts"
  runtime             = "nodejs"
}

datasource db {
  provider = "sqlite"
}

enum Role {
  admin
  editor
}

enum Business {
  molotes
  birria
}

model User {
  id             Int            @id @default(autoincrement())
  username       String                                   // tal como se escribió
  usernameKey    String         @unique @map("username_key") // NFC + minúsculas
  displayName    String         @map("display_name")
  role           Role
  active         Boolean        @default(true)
  passwordHash   String         @map("password_hash")
  sessionVersion Int            @default(0) @map("session_version")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")
  lastLoginAt    DateTime?      @map("last_login_at")
  businesses     UserBusiness[]
  auditActions   UserAudit[]    @relation("actor")
  auditEvents    UserAudit[]    @relation("target")

  @@map("user")
}

model UserBusiness {
  userId   Int      @map("user_id")
  business Business
  user     User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@id([userId, business])
  @@map("user_business")
}

model UserAudit {
  id        Int      @id @default(autoincrement())
  at        DateTime @default(now())
  action    String
  actorId   Int?     @map("actor_id")
  actorKind String   @map("actor_kind") // user | console | system
  targetId  Int      @map("target_id")
  changes   String?  // JSON sin contraseñas ni hashes
  actor     User?    @relation("actor", fields: [actorId], references: [id], onDelete: Restrict)
  target    User     @relation("target", fields: [targetId], references: [id], onDelete: Restrict)

  @@index([targetId])
  @@map("user_audit")
}
```

- Primera migración: `prisma/migrations/<fecha>_usuarios/` (crea 3 tablas y 2 índices, verificado en el spike) y `migration_lock.toml`.
- En SQLite los enums de Prisma se guardan como `TEXT`. La app valida los valores igualmente.
- `Business` reutiliza los ids de `src/config/businesses.ts`; una prueba comprueba que coinciden.
- REQ-F-008 añadirá sus modelos y migraciones sobre este esquema.

### Archivos o componentes afectados

**Nuevos**

- `prisma/schema.prisma`, `prisma/migrations/**` y `prisma.config.ts`.
- `src/db/`:
  - `client.ts`: crea el `PrismaClient` con el adaptador, WAL y `errorFormat: 'minimal'`;
  - `migrate.ts`: el aplicador (DT-3);
  - `errors.ts`: `DatabaseUnavailableError` y la clasificación de errores (DT-9);
  - `paths.ts`: el nombre y la ruta del `.db`, compartidos con `prisma.config.ts`.
- `src/repositories/user-repository.ts`: contrato y versión Prisma para buscar, listar, crear, actualizar, activar, cambiar la contraseña, registrar el acceso, comprobar si hay usuarios y escribir la auditoría.
- `src/services/`:
  - `user-schema.ts`: validación y normalización (DT-15);
  - `users.ts`: reglas D-6 a D-9 y DT-7, DT-8 y DT-16;
  - `admin-bootstrap.ts`: DT-11;
  - `authorization.ts`: rol y negocios permitidos.
- `src/controllers/`:
  - `admin-users.ts`: gestión de usuarios;
  - `admin-account.ts`: Mi cuenta.
- `src/views/admin/`:
  - `users.ts`;
  - plantillas `home.html`, `users-list.html`, `user-form.html`, `user-password.html`, `account.html`, `forbidden.html` y `unavailable.html`, y los parciales que hagan falta.
- `scripts/admin-recover.ts` y `scripts/support/read-hidden.ts`.
- Pruebas: ver "Testing".

**Modificados**

- `package.json` y `package-lock.json`: dependencias, `allowScripts` y scripts `db:generate`, `db:migrate:dev` y `admin:recover`.
- `tsconfig.json`: incluye `prisma.config.ts`.
- `.gitignore`: `src/generated/` y `*.db`, `*.db-wal`, `*.db-shm`, `*.db-journal`.
- `.dockerignore`: `src/generated` y los mismos patrones de `.db`.
- `Dockerfile` y `.github/workflows/ci.yml`.
- `.env.example`, `README.md` y `.claude/agents/senior-fullstack.md` ("Persistencia y API" y "Stack").
- `src/config/env.ts` (DT-11), `src/server.ts` (arranque de la base de datos y `$disconnect` al apagar) y `src/app.ts`.
- `src/routes/index.ts` y `src/routes/admin.ts`.
- `src/middleware/admin-guard.ts`: sesión con usuario, gate con base de datos y 403/503 en HTML.
- `src/services/session-store.ts` (DT-7) y `src/services/admin-auth.ts`: se conservan `hashPassword`, `parsePasswordHash` y `safeEqualStrings`, y el autenticador pasa a verificar contra el repositorio.
- `src/controllers/admin.ts`: sin campo de autor, con autorización por negocio y página de inicio.
- `src/views/admin/index.ts` y sus plantillas: navegación por rol, usuario conectado, sin el parcial `author.html`.
- `src/repositories/menu-repository.ts` y `memory-menu-repository.ts`: autor `{ id, name }` y `authorId` en el registro.
- `scripts/hash-password.ts`: usa `read-hidden.ts`.
- Pruebas existentes de administración (`tests/support/admin.ts`, `tests/integration/admin*.test.ts` y `tests/unit/*repository*`).

### Rutas de `/admin`

| Método y ruta | Quién | Qué hace |
| --- | --- | --- |
| `GET /admin` | Sesión | Inicio: enlaces a los negocios permitidos, a Usuarios (solo administrador) y a Mi cuenta. Reemplaza la redirección a `/admin/molotes`. |
| `GET/POST /admin/login`, `POST /admin/logout` | — | Sin cambios visibles. Después de entrar se vuelve a `next` (lista cerrada de rutas propias) o a `/admin`. |
| `GET/POST /admin/:negocio` y `…/restaurar-anterior`, `…/restaurar-semilla` | Administrador o editor asignado | Igual que hoy, sin campo de autor. Un negocio no asignado responde 403. |
| `GET /admin/usuarios` | Administrador | Lista con usuario, nombre, rol, negocios, activo y último acceso. |
| `GET /admin/usuarios/nuevo`, `POST /admin/usuarios` | Administrador | Crear. |
| `GET/POST /admin/usuarios/:id` | Administrador | Editar usuario, nombre, rol y negocios. |
| `POST /admin/usuarios/:id/desactivar`, `POST …/reactivar` | Administrador | D-6, D-7 y D-8. |
| `GET/POST /admin/usuarios/:id/contrasena` | Administrador | Restablecer la contraseña (la nueva dos veces). |
| `GET/POST /admin/cuenta` | Sesión | Mi cuenta: contraseña actual y la nueva dos veces (R-9). |

Las rutas fijas (`usuarios` y `cuenta`) se registran antes de `/:business`, que solo acepta los ids de `BUSINESS_IDS` y responde 404 al resto. `:id` se valida como entero positivo (404 si no lo es).

### Frontend

- La administración no tiene diseño fuente (C-8 de REQ-F-001). Se reutilizan las clases, los parciales y los patrones de `src/views/admin/`:
  - notice con `role="alert"` y foco al cargar;
  - `field-*` con `aria-invalid` y `aria-describedby`;
  - resumen de errores.
- Formularios HTML nativos sin JavaScript, POST-redirect-GET y `?ok=<acción>` para el aviso de éxito.
- Las contraseñas usan `type="password"`, `autocomplete="new-password"` o `current-password` y `minlength`. Nunca se vuelven a pintar después de un error.
- Negocios del editor: casillas en un `fieldset` con `legend`. Rol: `select`.
- La cabecera muestra "Sesión: <nombre visible>", enlaces solo a lo permitido y "Cerrar sesión".
- Se ejecuta `npm run build:css` porque cambian las clases de las plantillas de administración. Las landings no se tocan: los snapshots no cambian.

### Backend: arranque (`src/server.ts`)

1. `loadConfig()`. Si es inválida, sale con 1, igual que hoy.
2. Repositorio de menús: `init()` como hoy.
3. `openDatabase({ dataDir })`: comprobación de escritura e integridad, migraciones (DT-3) y cliente. Si falla, registra `database_init_failed` con `{ code, name }`, escribe por stderr "No se pudo preparar la base de datos en DATA_DIR: revisa permisos, espacio y que el archivo no esté dañado." y sale con 1, sin stack, SQL ni rutas (CA-4).
4. `bootstrapAdmin` (DT-11).
5. `createApp({ config, repository, users, … })`. Al recibir `SIGTERM`, se cierra el servidor y después `prisma.$disconnect()`.

### Validaciones

- Formularios de usuario: DT-15, con el error junto a cada campo y el resumen accesible. Se conserva lo escrito, salvo las contraseñas.
- Body con el límite actual (4 KB en acceso y cuenta). Campos desconocidos o repetidos → 400 (`readFormBody`).
- `:id` y `:business` se validan antes de cualquier consulta.

### Manejo de errores

| Situación | Respuesta |
| --- | --- |
| Sin permiso | 403 HTML: "No tienes permiso para…". No se escribe nada. |
| Base de datos no disponible | 503 HTML (DT-9). Las landings siguen respondiendo 200. |
| D-7 | 409 con el aviso "Debe quedar al menos un administrador activo." Nada cambia. |
| Usuario repetido (`P2002`, incluida una carrera) | 422 con el error en el campo. |
| Usuario inexistente | 404. |
| Contraseña actual incorrecta en Mi cuenta | 422 en el campo. No cuenta para el límite de intentos de acceso. |

### Testing

Base de datos real en un directorio temporal por archivo de pruebas (migrar cuesta unos milisegundos), creada con `tests/support/database.ts`. Hay un doble que falla a voluntad para R-3.

| Prueba | Cubre |
| --- | --- |
| `unit/db-migrate.test.ts` | Base nueva y repetición idempotente; checksum modificado, migración desconocida o sin terminar → error; migración que falla → revierte todo; **redefinición con `ON DELETE CASCADE` conserva las hijas** (S-7); solo lectura, carpeta sin escritura y archivo dañado → error con código (CA-4). |
| `integration/db-prisma-compat.test.ts` | Aplica con el aplicador propio y después ejecuta el CLI real: `prisma migrate status` al día y `prisma migrate diff --exit-code` = 0 (S-6). Corre con `CHECKPOINT_DISABLE=1`, también sin red. |
| `unit/user-schema.test.ts` | DT-15: límites 1/60, mayúsculas y espacios en el usuario, contraseña 11/12/256/257, editor sin negocios (CA-9). |
| `unit/users.test.ts` | D-7 desactivándose a sí mismo y cambiando de rol al último administrador (CA-10); un administrador que no es el último se desactiva (caso límite); D-8 incrementa `session_version` (CA-11); auditoría sin hashes (D-12). |
| `unit/admin-bootstrap.test.ts` | CA-1, CA-2 (aviso sin valores en el logger capturado) y CA-3. |
| `unit/session-store.test.ts` (ampliado) | `userId` y `sessionVersion`; caducidad de 2 h (CA-16). |
| `integration/admin-auth.test.ts` | Acceso por usuario; inactivo = credenciales incorrectas (CA-12); 5 fallos → 429 (CA-16); acceso con las credenciales de entorno ignoradas (CA-2); `last_login_at`. |
| `integration/admin-authorization.test.ts` | Editor de Molotes contra GET/POST de Birria (guardar, conflicto, restaurar, semilla) → 403 y JSON de Birria sin cambios (CA-6); inicio con solo Molotes; editor contra `/admin/usuarios*` → 403 sin cambios (CA-7). |
| `integration/admin-users.test.ts` | Crear un editor que entra y solo ve sus negocios (CA-8); errores de CA-9; CA-10; desactivar, cambiar rol o negocios, o restablecer → la sesión abierta pide acceso (CA-11); reactivar (CA-12); recargar después de un POST no repite (CA-18). |
| `integration/admin-account.test.ts` | CA-13: contraseña actual correcta e incorrecta; las demás sesiones se cierran y la actual sigue. |
| `integration/admin.test.ts` (adaptado) | CA-14: autor "Ana" con su id en `changes.jsonl` y sin campo de autor; restauraciones; CSRF 403, HTTPS en producción, `noindex`, `no-store` y cierre de sesión (CA-16). |
| `integration/admin-db-unavailable.test.ts` | Doble que falla: acceso y `/admin` → 503 HTML con `role="alert"`; `/`, `/molotes` y `/birria` → 200 (CA-5). |
| `integration/admin-recover.test.ts` | Ejecuta `node scripts/admin-recover.ts` con la contraseña por stdin: crea o reactiva y promueve; con una app abierta sobre el mismo `.db`, la sesión del usuario pide acceso; registro `console_recovery` (CA-15). |
| `integration/server-startup.test.ts` | `node src/server.ts` con `DATA_DIR` sin escritura, `.db` dañado y migración rota (en una carpeta de migraciones temporal) → código 1 y stderr/log sin stack, SQL ni rutas (CA-4). Primer arranque con variables → crea el `.db` (CA-1). |
| Barrido de secretos (CA-17) | En las pruebas de integración: ninguna línea del logger capturado ni ninguna respuesta contiene la contraseña, el hash, el id de sesión ni el token CSRF. |
| Snapshots de las landings | No cambian (CA-20). |

Docker (CA-19, verificación manual de QA como en REQ-F-003):

- `docker buildx build --platform linux/amd64` y `linux/arm64 --target production`.
- Arranque con volumen y variables → migra y crea el administrador.
- Reconstruir la imagen y arrancar con el mismo volumen → el usuario persiste y no se vuelve a migrar.
- `id -u` = 1000.
- La imagen no contiene `.env`, `data/` ni `*.db`.
- `docker compose run --rm test` en verde.

### CI (`.github/workflows/ci.yml`)

- Job `calidad`:
  - `env: CHECKPOINT_DISABLE: 1` (sin telemetría del CLI);
  - `install` pasa a `npm ci --strict-allow-scripts --no-audit --no-fund`;
  - nuevo paso `db:generate` entre `install` y `typecheck`.
  - Coste estimado: 10-20 s más, sobre todo por las descargas del motor de Prisma y del binario de `better-sqlite3`.
- Job `docker`: sin cambios en el workflow. El Dockerfile hace el resto.
- No se agrega arm64 al CI: con QEMU sería lento. arm64 se verifica en local, como en REQ-F-003. Si el usuario lo prefiere, se puede añadir `platforms: linux/amd64,linux/arm64`.

### Docker (`Dockerfile`)

- `ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1` en `base`.
- `deps`: `npm ci --strict-allow-scripts …`.
- `build`: `COPY . .` → `npm run db:generate` → `typecheck` → `build:css`.
- `test`: sin cambios (`network_mode: none` sigue valiendo, porque los motores se descargan al construir).
- `production`:
  - `npm ci --omit=dev --omit=optional --strict-allow-scripts … && npm cache clean --force`;
  - copia `src`, `public`, `prisma/migrations` y `scripts/*.ts`;
  - mismo usuario, `HEALTHCHECK` y `CMD` (`node src/server.ts` migra al arrancar).
- `compose.yaml`: sin cambios.
- Tamaño estimado de `production`: unos 262 MB.

### Seguridad

- Contraseñas en scrypt (DT-10). El acceso no revela si la cuenta existe ni si está activa.
- Sesiones invalidadas por versión (DT-7). Cada acceso emite un id de sesión nuevo (se conserva la protección contra la fijación de sesión).
- Autorización antes de leer el body (DT-12). `next` sigue siendo una lista cerrada.
- Nada de contraseñas, hashes, ids de sesión ni tokens en logs, respuestas, auditoría ni formularios (CA-17). Los errores de Prisma se registran sin `message` (S-9).
- CSP y `koa-helmet` sin cambios. La base de datos nunca se sirve: `DATA_DIR` no puede estar dentro de `src/` ni de `public/`.
- `allowScripts` fijado por versión (S-4). Sin secretos ni `.db` en las imágenes (RN-5).

### Performance

- Una consulta por clave primaria por petición autenticada de `/admin`. Las landings no tocan la base de datos.
- scrypt solo al entrar o al cambiar contraseñas.
- La imagen crece unos 86 MB (frente a unos 370 MB con la opción A).

### Riesgos técnicos

| ID | Riesgo | Mitigación |
| --- | --- | --- |
| RT-1 | El formato de `_prisma_migrations` cambia en una versión futura de Prisma. | Prueba de compatibilidad con el CLI real (S-6) en cada ejecución de la suite. Versiones exactas: actualizar Prisma es un cambio explícito. |
| RT-2 | Durante `npm ci` se descarga desde GitHub (`better-sqlite3`) y desde `binaries.prisma.sh` (motores del CLI, solo en desarrollo, CI y las etapas `deps`/`build`/`test`). | Si fallan, el CI y el build fallan de forma visible. En producción, solo GitHub. |
| RT-3 | Prisma 8 (hoy en RC) cambiará las APIs. | Versiones fijadas. La actualización queda para otro ticket. |
| RT-4 | Un respaldo hecho copiando el `.db` con el servidor en marcha y en modo WAL puede quedar incompleto. | El README explica cómo respaldar: copiar `restaurante.db*` con el servidor parado o usar `sqlite3 .backup`. Los respaldos automáticos están fuera de alcance. |
| RT-5 | Tamaño del cambio: unos 30 archivos nuevos y unos 25 modificados. | Implementación por etapas con la suite en verde (ver abajo). |
| RT-6 | Volver a una versión anterior del código con una base ya migrada. | El aplicador lo detecta ("la base de datos es más nueva que el código") y no arranca, en lugar de corromper datos. |
| RT-7 | Al actualizar, las sesiones abiertas se pierden. | Esperado: sesiones en memoria (caso límite del ticket). |

### Orden de implementación (un solo PR, en etapas)

Propuesta: **un solo PR y una sola rama**, porque el ticket se aprobó como una unidad y las etapas no se pueden desplegar por separado: sin la etapa 3 se perdería el autor. Cada etapa termina con `typecheck`, `lint` y `test` en verde:

1. **Base de datos:** dependencias, esquema, migración, `prisma.config.ts`, `src/db/*`, arranque, `.gitignore`/`.dockerignore`, Dockerfile y CI. Pruebas de S-6, S-7 y S-8.
2. **Usuarios y acceso:** repositorio, servicios, bootstrap, sesión con versión, autenticador por usuario y guard. Las pruebas existentes de administración siguen pasando con el administrador inicial.
3. **Autorización y autor verificado:** 403 por negocio, página de inicio, navegación y eliminación del campo de autor.
4. **Gestión de usuarios y Mi cuenta:** controladores, vistas y pruebas.
5. **Consola y documentación:** `admin:recover`, README, `.env.example` y `senior-fullstack.md`. Verificación de Docker en amd64 y arm64.

Alternativa, no recomendada: dividirlo en dos PR (etapas 1 y 2 / etapas 3 a 5). Exigiría que el BA partiera el ticket, y el primer PR dejaría `/admin` sin autorización por negocio, aunque con un único administrador inicial sería equivalente a hoy.

### Criterios de finalización

- CA-1 a CA-20 verificados con las pruebas indicadas y la verificación de Docker de CA-19.
- `npm run db:generate`, `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` en verde. `docker compose run --rm test` en verde. CI (`calidad` y `docker`) en verde en el PR.
- Snapshots de las landings sin cambios.
- `README.md`, `.env.example` y `senior-fullstack.md` cumplen R-12.

### Decisiones que se aprueban con este plan

1. **Q-2 = B** (aplicador propio, DT-3), frente a A.
2. Un solo PR por etapas.
3. DT-11: `/admin` se habilita sin reiniciar cuando el comando de consola crea el primer usuario.
4. DT-14: el comando de consola promueve a administrador si el usuario existe como editor.
5. DT-15: el usuario de acceso es editable y la contraseña tiene un máximo defensivo de 256 caracteres.
6. DT-12: el 403 por permiso y el 503 por base de datos son páginas HTML. El 503 de "administración deshabilitada" y los 403 de CSRF conservan el JSON actual.
7. arm64 se verifica en local y no se agrega al CI.

## Implementation Result

### Rama

`feature/REQ-F-007-control-usuarios-roles`, creada desde `main` (`56a7b75`). No hay commits: se hacen en T4.

### Cambios realizados

Implementación en las 5 etapas del plan. `typecheck`, `lint` y `npm test` quedaron en verde al cerrar cada etapa:

| Etapa | Contenido | Suite al cerrar |
| --- | --- | --- |
| Línea base | `main` sin cambios | 26 archivos, 502 pruebas |
| 1. Base de datos | Dependencias exactas y `allowScripts`. Esquema, migración `20261005163925_usuarios` y `prisma.config.ts`. `src/db/` (aplicador, cliente, errores y rutas). Arranque con fallo rápido. Dockerfile, `.dockerignore`, `.gitignore` y CI | 28 / 517 |
| 2. Usuarios y acceso | `user-schema`, `user-repository` (D-7, D-8 y auditoría en transacciones), `admin-bootstrap`, sesión ligada a `userId` y `sessionVersion`, autenticador por usuario con hash ficticio, gate y guard con base de datos y página 503 HTML. `config.admin` pasa a `config.adminBootstrap` | 32 / 568 |
| 3. Autorización y autor | `authorization.ts` y `admin-access.ts` (sesión → permiso → body → CSRF). 403 HTML por negocio. Página de inicio y navegación según el rol. Se elimina el campo de autor: el autor sale de la sesión y `changes.jsonl` agrega `authorId` | 33 / 575 |
| 4. Gestión y Mi cuenta | `admin-users.ts`, `admin-account.ts`, vistas `users.ts` y sus plantillas. El gate consulta la base de datos en cada petición (CA-5) | 36 / 597 |
| 5. Consola y documentación | `admin:recover`, `read-hidden.ts` compartido, `loadDataDir`, pruebas de arranque y del comando. README, `.env.example` y `senior-fullstack.md`. Docker verificado en amd64 y arm64 | 38 / 610 |

**Ajustes respecto al Technical Action Plan** (técnicos, sin cambio de alcance funcional):

1. **Sin `src/services/users.ts`.** Las reglas D-6 a D-8 y la auditoría están en `src/repositories/user-repository.ts`, porque deben ejecutarse dentro de la transacción. Es el mismo patrón que `menu-repository.ts`, que también concentra sus reglas. La validación está en `services/user-schema.ts`, el acceso en `services/admin-auth.ts` y los permisos en `services/authorization.ts`.
2. **Nuevo `src/controllers/admin-access.ts`.** Comparte la secuencia de DT-12 entre los controladores de menús, usuarios y cuenta, para no triplicarla.
3. **DT-11, ampliado.** El gate comprueba si hay usuarios en cada petición a `/admin` (un `COUNT`), no solo mientras no los haya. Sin este cambio, la página de acceso (GET) respondía 200 con la base caída, y CA-5 exige 503 al intentar entrar.
4. **`allowScripts`.** Además de aprobar `better-sqlite3`, `prisma` y `@prisma/engines`, se deniegan explícitamente dos dependencias previas de desarrollo con scripts que no hacen falta. Sin esa denegación, `npm ci --strict-allow-scripts` fallaba:
   - `@parcel/watcher`: su script solo compila si `npm_config_build_from_source=true`;
   - `fsevents`: trae su binario.
5. **`loadDataDir(env)` en `env.ts`.** El comando de recuperación resuelve `DATA_DIR` con las mismas reglas que la app, sin exigir el resto de la configuración (WhatsApp, etc.).
6. **Formularios con un campo `author` enviado a mano.** Se rechazan con 400 `STRUCTURE_MODIFIED` porque `author` dejó de ser un campo de control. No se puede suplantar al autor.
7. **CA-17, interpretación del token CSRF.** El token tiene que estar en los formularios para que funcionen. La prueba verifica que no aparece en ningún log y que, en las páginas, solo aparece dentro de `name="_csrf"`. Contraseñas, hashes e ids de sesión no aparecen en ningún log ni en ningún cuerpo de respuesta.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `server-startup.test.ts` arranca `node src/server.ts` real: crea el `.db`, migra, registra `admin_bootstrap_created`, el acceso responde 303 y `user_audit` tiene `bootstrap`. También `admin-bootstrap.test.ts`, `admin-auth.test.ts` y Docker (amd64 y arm64). |
| CA-2 | Cumple | `admin-auth.test.ts` y `admin-bootstrap.test.ts`: no se crea ni cambia ningún usuario, las credenciales del entorno responden 401 y el aviso no lleva valores. Docker: tras reconstruir con otras credenciales, `intruso` responde 401 y aparece `admin_bootstrap_ignored`. |
| CA-3 | Cumple | `admin-auth.test.ts`: `/admin`, `/admin/login` y `/admin/molotes` responden 503 `ADMIN_UNAVAILABLE`; `/`, `/molotes` y `/birria` responden 200. |
| CA-4 | Cumple | `server-startup.test.ts` termina con código 1, un mensaje controlado y sin stack, SQL ni rutas en estos casos: `.db` dañado (`SQLITE_NOTADB`), migración que falla (`MIGRATION_FAILED`, sin cambios a medias), base más nueva que el código, `.db` de solo lectura y `DATA_DIR` sin permisos de escritura. `db-migrate.test.ts` cubre los mismos casos y la carpeta inexistente. |
| CA-5 | Cumple | `admin-db-security.test.ts`, con un fallo real de SQLite (tablas borradas): acceso, inicio y negocio responden 503 en HTML con `role="alert"` y sin detalles técnicos; las landings responden 200; el log `database_unavailable` solo lleva códigos. |
| CA-6 | Cumple | `admin-authorization.test.ts`: GET, guardar, sobrescribir tras conflicto, restaurar y restaurar la semilla en Birria responden 403 y los datos de Birria no cambian (`current`, `previous` y registro). El permiso se comprueba antes de leer el body. El inicio solo muestra Molotes. |
| CA-7 | Cumple | `admin-users.test.ts`: 4 páginas y 5 formularios de usuarios responden 403 a un editor; usuarios, negocios y auditoría no cambian. |
| CA-8 | Cumple | `admin-users.test.ts`: el administrador crea un editor, que entra, abre Molotes (200) y recibe 403 en Birria. |
| CA-9 | Cumple | `admin-users.test.ts`, `user-schema.test.ts` y `user-repository.test.ts`: usuario repetido con otras mayúsculas, contraseña de 11 caracteres y editor sin negocios dan 422 con el error junto al campo y en el resumen; no se guarda nada y las contraseñas no se vuelven a pintar. |
| CA-10 | Cumple | `admin-users.test.ts` y `user-repository.test.ts`: el último administrador no puede desactivarse ni pasar a editor (409). Dos desactivaciones simultáneas: solo se aplica una. |
| CA-11 | Cumple | `admin-users.test.ts` (desactivar, rol, negocios y contraseña), `admin-authorization.test.ts` (perder el negocio mientras edita) y `admin-auth.test.ts`: la siguiente petición pide acceso; desactivado, no vuelve a entrar. |
| CA-12 | Cumple | `admin-auth.test.ts`: la página de una cuenta desactivada es idéntica, byte a byte, a la de credenciales incorrectas y a la de un usuario inexistente. `admin-users.test.ts`: tras reactivar, entra. |
| CA-13 | Cumple | `admin-account.test.ts`: entra con la nueva y no con la anterior; su sesión sigue y las demás se cierran. Con la actual incorrecta (6 intentos) no cambia nada ni se bloquea el acceso. |
| CA-14 | Cumple | `admin.test.ts`: "Ana" guarda el hero de Molotes y el registro tiene `author: 'Ana'` y su `authorId`; el formulario no tiene campo de autor. `admin-file-repository.test.ts` lo verifica en `changes.jsonl` real. |
| CA-15 | Cumple | `admin-recover.test.ts`, con el proceso real `node scripts/admin-recover.ts` y la contraseña por stdin, contra una app en marcha sobre el mismo `.db`: la sesión abierta pide acceso, la contraseña anterior responde 401 y la nueva 303, y queda `console_recovery`. También con el servidor parado y sin `.db`, reactivando y promoviendo a un editor, y con errores (código 1). Docker: `docker exec … admin-recover.ts` funciona en amd64 y arm64. |
| CA-16 | Cumple | Las pruebas de REQ-F-001 en `admin.test.ts` siguen pasando: caducidad de 2 h, 5 fallos → 429 durante 15 min, CSRF 403, HTTPS en producción, cierre de sesión, `noindex` y `no-store`. También `session-store.test.ts`. |
| CA-17 | Cumple (ajuste 7) | `admin-db-security.test.ts` hace un recorrido completo con el logger capturado: acceso fallido y correcto, crear usuario, error de validación, restablecer, Mi cuenta, guardar menú y acceso de otro usuario. Ningún log ni página contiene contraseñas, hashes (`scrypt$`) ni ids de sesión; el token CSRF no aparece en los logs y en las páginas solo dentro de su campo oculto. |
| CA-18 | Cumple | Ninguna página nueva tiene `<script>` (pruebas de usuarios y cuenta). Todas las acciones usan POST-redirect-GET; recargar el destino no repite la creación. |
| CA-19 | Cumple | Docker local, ver "Validaciones ejecutadas". |
| CA-20 | Cumple | `typecheck` 0, `lint` 0, `npm test` 610/610. `tests/snapshots/` sin cambios. README, `.env.example` y `senior-fullstack.md` cumplen R-12. |

### Validaciones ejecutadas

Desde `restaurante/`:

- `npm run build:css`: Done, 3 hojas.
- `npm run typecheck`: código 0.
- `npm run lint`: código 0, sin errores ni avisos.
- `npm test`: **38 archivos, 610 pruebas en verde** (línea base: 26 archivos y 502 pruebas). Hay 12 archivos de pruebas nuevos.
- **Mutación del aplicador:** se quitó `foreign_keys = OFF` y la prueba de redefinición con `ON DELETE CASCADE` falló ("expected +0 to be 2"). Se restauró el original y vuelve a pasar.
- `docker compose run --rm test`: **605 en verde y 5 omitidas.** Las omitidas son las de permisos de archivo, que no aplican al correr como root dentro de la imagen; sí corren en local y en el CI. La prueba de compatibilidad con el CLI de Prisma pasa sin red (`network_mode: none`).
- `docker buildx build --target production` en `linux/arm64` y `linux/amd64`: correcto. Tamaño: **262 MB (arm64) y 266 MB (amd64)**, frente a los 172/176 MB previos. Sin el CLI de Prisma ni TypeScript en la imagen.
- **Verificación funcional de CA-19 en las dos arquitecturas** (contenedor con volumen, `NODE_ENV=production` y `TRUST_PROXY=true`):
  - `/` responde 200 y el acceso del primer administrador 303;
  - logs `database_migrated`, `admin_bootstrap_created` y `server_started`;
  - `id -u` = 1000;
  - `restaurante.db` (con `-wal` y `-shm`) del usuario `node` en el volumen (carpeta 700);
  - `docker exec -i … node scripts/admin-recover.ts --usuario dueno` → código 0: la contraseña nueva da 303 y la anterior 401;
  - `HEALTHCHECK` en `healthy`;
  - la imagen no contiene `.env`, `data/` ni `*.db`.
- **Reconstrucción** (arm64, `--no-cache`) con el mismo volumen y otras credenciales de entorno:
  - el usuario existente entra con su contraseña (303) y las credenciales del entorno no (401);
  - no se vuelve a migrar;
  - aparece `admin_bootstrap_ignored` y ningún valor del entorno en el log.
- Se borraron las imágenes, los volúmenes y los contenedores de QA. El `data/` real del proyecto no se usó: todas las pruebas usan carpetas temporales.

### Archivos afectados

- **Nuevos:**
  - `restaurante/prisma/schema.prisma`, `prisma/migrations/20261005163925_usuarios/migration.sql`, `prisma/migrations/migration_lock.toml` y `restaurante/prisma.config.ts`;
  - `src/db/` (`client.ts`, `migrate.ts`, `errors.ts`, `paths.ts`);
  - `src/repositories/user-repository.ts`;
  - `src/services/user-schema.ts`, `authorization.ts` y `admin-bootstrap.ts`;
  - `src/controllers/admin-access.ts`, `admin-users.ts` y `admin-account.ts`;
  - `src/views/admin/users.ts`, `home.html`, `forbidden.html`, `unavailable.html`, `users-list.html`, `user-form.html` y `password-form.html`;
  - parciales `field-text`, `option-labeled`, `businesses-fieldset`, `user-row`, `home-item` y `cancel-link`;
  - `scripts/admin-recover.ts` y `scripts/support/read-hidden.ts`;
  - pruebas: `tests/support/database.ts` y `process.ts`; `tests/unit/` `db-migrate`, `user-schema` y `admin-bootstrap`; `tests/integration/` `db-prisma-compat`, `user-repository`, `admin-auth`, `admin-authorization`, `admin-users`, `admin-account`, `admin-db-security`, `admin-recover` y `server-startup`.
- **Modificados:**
  - `package.json` y `package-lock.json`, `tsconfig.json`, `.gitignore`, `.dockerignore`, `Dockerfile` y `.github/workflows/ci.yml`;
  - `.env.example`, `README.md` y `.claude/agents/senior-fullstack.md`;
  - `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/routes/admin.ts`, `src/middleware/admin-guard.ts` y `src/controllers/admin.ts`;
  - `src/services/admin-auth.ts`, `session-store.ts` y `admin-form.ts`;
  - `src/repositories/menu-repository.ts`;
  - `src/views/admin/index.ts`, `confirm-restore.html` y los parciales `header`, `submit`, `conflict` y `restore-form`;
  - `src/styles/admin/main.css` (solo el comentario) y `scripts/hash-password.ts`;
  - pruebas existentes adaptadas al autor verificado y a la base de datos.
- **Eliminado:** `src/views/admin/partials/author.html`.

### Riesgos o pendientes

- **Revisión visual de las páginas nuevas.** Usuarios, Mi cuenta, inicio, 403 y 503 no tienen diseño fuente (C-8). Se reutilizaron las clases y los patrones existentes (contraste AA de la paleta), pero no se revisaron en un navegador. Conviene que QA revise contraste, foco y vista móvil.
- **CI sin ejecutar en GitHub.** Los cambios del workflow (`--strict-allow-scripts` y `db:generate`) se reprodujeron en local, pero el CI real se verá en el PR (T4). Si el npm del runner fuera anterior a la opción `--strict-allow-scripts`, la trataría como una configuración desconocida (aviso) y la instalación seguiría.
- **RT-1 a RT-7 del plan siguen vigentes:** formato de Prisma, descargas durante `npm ci`, Prisma 8 en RC, respaldos en WAL, tamaño del cambio, base más nueva que el código y sesiones perdidas al actualizar.
- **Una consulta de más por petición.** Cada petición a `/admin` hace dos consultas por clave o `COUNT` (gate y guard). Es despreciable con SQLite local.
- **Contraseñas con caracteres no ASCII.** El límite de 12 caracteres se cuenta en puntos de código. `admin:hash-password` sigue usando la longitud de JavaScript, como antes.

### Correcciones de la ronda 1 de QA

Decisión del usuario (cita textual): "Corrige DEF-001 a DEF-004 en esta rama y abre ticket para OBS-1". OBS-1 no forma parte de esta corrección: va a un ticket aparte (en `backlog/` hay un `REQ-F-011`, que no se tocó).

| Defecto | Corrección | Prueba y evidencia |
| --- | --- | --- |
| DEF-001 (MINOR) | `users-list.html`: el contenedor `.admin-users` lleva `relative`, así los `.sr-only` absolutos de la columna de acciones se colocan dentro del contenedor con scroll y no respecto al documento. | **Chrome sin interfaz (CDP)** sobre la app real con 6 usuarios, uno de 60 caracteres sin espacios: `scrollWidth`/`innerWidth` = 375/375, 768/768 y 1440/1440. La tabla se desplaza dentro de su contenedor y las acciones conservan su nombre ("Editar a ana", "Restablecer contraseña de ana"). Sin la clase en el CSS: 1524, 1532 y 1804, con la ventana de 375 ampliada a 1500. Prueba estructural en `admin-qa-round1.test.ts`: contenedor `relative overflow-x-auto`, todos los `.sr-only` de la tabla dentro de él y nombres accesibles con el usuario de 60 caracteres. |
| DEF-002 (TRIVIAL) | `createUserAuthenticator` calcula el hash ficticio al crearse, es decir, al arrancar la app (DT-10), y lo reutiliza. El generador se puede inyectar para probarlo. | `admin-auth.test.ts`: el generador se llama una vez al crear el autenticador, antes de cualquier acceso, con el costo configurado, y no vuelve a llamarse en dos accesos fallidos. CA-12 sigue pasando. |
| DEF-003 (TRIVIAL) | La página 403 no marca ninguna sección como actual (`current: undefined`). `adminPage` acepta una sección indefinida. | `admin-qa-round1.test.ts`: el 403 de `/admin/birria` y de `/admin/usuarios` (editor) no tiene ningún enlace con `aria-current`. Inicio, Molotes, Birria, Usuarios (también "nuevo") y Mi cuenta conservan su `aria-current` correcto. |
| DEF-004 (TRIVIAL) | `admin-access.post` acepta una lista cerrada de campos (`allowedFields`, además de `_csrf`): cualquier otro responde 400 `INVALID_FORM` con el formato común. Se comprueba después del permiso (403) y del CSRF, así que se mantiene el orden de DT-12. Listas: crear (usuario, nombre, rol, `business-*`, contraseñas), editar (sin contraseñas), desactivar/reactivar (ninguno), restablecer (contraseñas) y Mi cuenta (actual y nueva). Las casillas `business-*` siguen siendo opcionales. | `admin-qa-round1.test.ts`: los 6 POST con un campo desconocido (`foo`, o `business-birria` en Mi cuenta) dan 400 `{ error: { code: 'INVALID_FORM', … } }` y no cambian usuarios, negocios ni auditoría; los formularios reales (editor con una casilla, administrador sin casillas, desactivar) dan 303; un editor con campos desconocidos sigue recibiendo 403. **AUTO-6** (`admin-authorization-matrix.test.ts`) se ajustó para exigir 400 y que la contraseña no cambie. Antes aceptaba 303 o 400; la aserción es ahora más estricta. |

**Comprobación de que las pruebas detectan los defectos.** Se revirtió cada corrección por separado sobre una copia de seguridad:

- `relative`;
- `current: 'home'`;
- `allowedFields` desactivado;
- hash ficticio perezoso.

En los 4 casos falla exactamente 1 prueba (21/22). Con el código restaurado (comprobado con `cmp`), las 22 pasan.

**Validación tras la ronda 1** (desde `restaurante/`):

- `npm run build:css`: correcto.
- `npm run typecheck`: código 0.
- `npm run lint`: código 0.
- `npm test`: **40 archivos, 626 pruebas en verde.** Antes había 39 archivos y 619 pruebas (las de QA incluidas); se añadió un archivo nuevo y una prueba más en `admin-auth.test.ts`.

Archivos de la ronda:

- **Código:** `src/views/admin/users-list.html`, `src/services/admin-auth.ts`, `src/views/admin/index.ts`, `src/controllers/admin-access.ts`, `src/controllers/admin-users.ts` y `src/controllers/admin-account.ts`.
- **Pruebas:** `tests/unit/admin-auth.test.ts`, `tests/integration/admin-authorization-matrix.test.ts` (AUTO-6) y el nuevo `tests/integration/admin-qa-round1.test.ts`.

## QA Action Plan

Fase Q1 de `senior-qa` (2026-10-05). Análisis sin ejecutar la batería definitiva. Se revisaron:

- el ticket completo: CA-1 a CA-20, D-1 a D-13, DT-1 a DT-16, las 7 decisiones aprobadas y el Implementation Result con sus 7 ajustes;
- `git status` y el diff contra `main`: 39 archivos modificados (+3485/−558), unos 40 nuevos y 1 eliminado, sin commits;
- `routes/admin.ts`, `controllers/admin-access.ts`, `admin-users.ts`, `admin-account.ts` y `admin.ts`, `middleware/admin-guard.ts`, `services/authorization.ts`, `user-schema.ts` y `admin-auth.ts`, `utils/form-body.ts`, las plantillas nuevas y los tests nuevos y adaptados;
- el blast radius con CodeGraph: `createAdminGate` → `app.ts` y 13 archivos de pruebas; `createSessionGuard` → `admin-access.ts`, sin pruebas unitarias directas.

### Objetivo

Comprobar con evidencia lo siguiente:

- las cuentas personales con roles cumplen CA-1 a CA-20;
- la autorización por rol y por negocio no se puede saltar (URL directa, campos ocultos o formularios manipulados);
- la persistencia en SQLite y el aplicador de migraciones son seguros;
- el cambio no altera las landings ni el flujo de menús de REQ-F-001;
- las páginas nuevas de `/admin` son accesibles y usables en móvil y en escritorio, sin JavaScript.

### Requisito bajo prueba

- R-1 a R-12 y RN-1 a RN-5, con las decisiones D-1 a D-13.
- El Technical Action Plan aprobado (Q-2 = B y las decisiones 1 a 7).
- La administración no tiene diseño en `_stich_source_/` (C-8 de REQ-F-001). La referencia visual son los patrones existentes de `src/views/admin/`. No se evalúa contra Stitch.

### Criterios de aceptación

| CA | Pruebas que lo cubren (ver los identificadores abajo) |
| --- | --- |
| CA-1 | F-1, ARR-1, DOC-1 |
| CA-2 | F-2, ARR-2, DOC-2 |
| CA-3 | F-3, ARR-3 |
| CA-4 | ARR-4 a ARR-7, MIG-6 |
| CA-5 | NEG-10, BR-6 |
| CA-6 | AUT-1 a AUT-4, AUT-7 |
| CA-7 | AUT-5, AUT-6 |
| CA-8 | F-4, BR-2 |
| CA-9 | NEG-1 a NEG-4, BR-3 |
| CA-10 | NEG-5, CON-1, CON-2 |
| CA-11 | SES-1 a SES-4 |
| CA-12 | ENU-1, ENU-2, F-5 |
| CA-13 | F-6, NEG-6 |
| CA-14 | F-7, REG-4 |
| CA-15 | CLI-1 a CLI-5, DOC-3 |
| CA-16 | SEC-1 a SEC-6, SES-5 |
| CA-17 | SEC-7 a SEC-9 |
| CA-18 | BR-5, F-8 |
| CA-19 | DOC-1 a DOC-6 |
| CA-20 | AUTO-1 a AUTO-4, REG-1 a REG-3, DOCU-1 |

### Riesgos identificados

| ID | Riesgo | Pruebas |
| --- | --- | --- |
| R-QA-1 | Escalada de privilegios. Un editor intenta hacerse administrador, asignarse negocios o cambiar los datos de otro usuario. Puede hacerlo por `/admin/usuarios/:id`, por su propio id o añadiendo `role`/`business-*` a `/admin/cuenta`. | AUT-5, AUT-6, ESC-1 a ESC-4 |
| R-QA-2 | Un editor descubre ids de usuarios. Con `GET /admin/usuarios/9999` podría distinguir 403 de 404. El permiso debe comprobarse antes del id. | ESC-5 |
| R-QA-3 | D-7 con concurrencia por HTTP. Dos administradores se desactivan o se degradan entre sí a la vez. El repositorio lo prueba en una transacción, pero no a través de HTTP ni con el comando de consola en paralelo. | CON-1 a CON-3 |
| R-QA-4 | Sesión no invalidada. Por ejemplo: el administrador restablece su propia contraseña desde `/admin/usuarios/:suId/contrasena`, cambia el rol o los negocios en otro navegador, o se cierra sesión y se vuelve atrás. | SES-1 a SES-6 |
| R-QA-5 | Enumeración de usuarios. Podría delatar la cuenta el texto, el código, las cabeceras o el tiempo de respuesta. El hash ficticio se calcula de forma perezosa en el primer acceso fallido, no al arrancar como dice DT-10, así que el primer intento con un usuario inexistente puede tardar más. | ENU-1 a ENU-4 |
| R-QA-6 | Mi cuenta no tiene límite de intentos para la contraseña actual (decisión del plan: "no cuenta para el límite de acceso"). Con una sesión robada se podría adivinar la contraseña sin límite. | NEG-6 (se documenta; no es defecto salvo contradicción con el requisito) |
| R-QA-7 | Campos desconocidos en los formularios nuevos. El plan dice "Campos desconocidos o repetidos → 400 (`readFormBody`)", pero `readFormBody` solo rechaza los repetidos; los desconocidos se ignoran en usuarios y cuenta. | NEG-7 |
| R-QA-8 | Secretos en logs o respuestas: contraseñas, hashes `scrypt$`, `admin_sid`, el token CSRF fuera de `_csrf`, mensajes de Prisma con rutas o SQL, y valores de `ADMIN_*`. | SEC-7 a SEC-9, ARR-2, ARR-4 a ARR-7 |
| R-QA-9 | El aplicador de migraciones. Riesgos: cascada S-7, atomicidad, checksum, base más nueva que el código y compatibilidad con el CLI de Prisma 7.10.0. | MIG-1 a MIG-7 |
| R-QA-10 | Arranque. Riesgos: `DATA_DIR` sin permisos, `.db` dañado o de solo lectura, migración rota, variables incompletas o hash inválido. Debe terminar con código 1, sin stack, SQL ni rutas. | ARR-1 a ARR-8 |
| R-QA-11 | Regresión de las landings, que no deben tocar la base de datos ni cambiar el HTML, y del flujo de menús de REQ-F-001 (conflicto, restaurar, semilla, autor). | REG-1 a REG-6 |
| R-QA-12 | Docker: imagen `production` sin el CLI, binarios musl en amd64 y arm64, `--omit=optional`, `allowScripts`, usuario no root y persistencia del volumen. | DOC-1 a DOC-6 |
| R-QA-13 | Las páginas nuevas no se han visto en un navegador. Hay que revisar el foco, las etiquetas, los errores accesibles, el contraste, el modo móvil y que funcionen sin JavaScript. | BR-1 a BR-8 |
| R-QA-14 | Recursos de QA mal limpiados. No se debe tocar `restaurante/data/` real ni dejar servidores, contenedores, volúmenes o worktrees. | Preparación y cierre |

### Entorno de QA (aislado)

- Todo servidor de QA usa un `DATA_DIR` temporal en el scratchpad, nunca `restaurante/data/`.
- Las credenciales de QA (`ADMIN_USER=qa-dueno` y un hash generado con `npm run admin:hash-password` desde stdin) se pasan por variables de entorno en la línea de comandos. No se edita `.env`.
- Antes de empezar se toma una huella (`find restaurante/data -newer <marca>` y `shasum`) de `restaurante/data/`. Al terminar se comprueba que no cambió.
- Servidores en `PORT=3100` (rama) y `3101` (`main`, en un worktree temporal con `node_modules` enlazado). Se detienen al terminar y el worktree se elimina.

### Pruebas funcionales

- **F-1 (CA-1).** Servidor real con un `DATA_DIR` vacío y las variables de QA.
  - Se crea `restaurante.db` y el log muestra `database_migrated` y `admin_bootstrap_created`.
  - El acceso con la contraseña da 303.
  - `user_audit` tiene `bootstrap` con `actor_kind` `system`.
  - Se consulta con `sqlite3` o con un script de `better-sqlite3` de solo lectura en el scratchpad.
- **F-2 (CA-2).** Se reinicia con otras `ADMIN_USER`/`ADMIN_PASSWORD_HASH`:
  - el número de usuarios y su `updated_at` no cambian;
  - las credenciales del entorno dan 401;
  - el log muestra `admin_bootstrap_ignored` sin el usuario ni el hash (búsqueda literal en el log).
- **F-3 (CA-3).** Servidor sin usuarios ni variables:
  - `/admin`, `/admin/login`, `/admin/molotes` y `/admin/usuarios` → 503 `ADMIN_UNAVAILABLE`;
  - `/`, `/molotes` y `/birria` → 200.
  - Después se ejecuta `admin:recover` con el servidor en marcha: `/admin/login` pasa a 200 sin reiniciar (decisión 3).
- **F-4 (CA-8).** El administrador crea tres editores: Molotes, Birria y los dos. Cada uno entra y su inicio solo lista sus negocios.
- **F-5 (CA-12).** Se desactiva a un editor y su acceso da la misma página que unas credenciales incorrectas. Se reactiva y entra.
- **F-6 (CA-13).** Mi cuenta con la contraseña actual correcta:
  - la nueva da 303 y la anterior 401;
  - la sesión actual sigue y una segunda sesión del mismo usuario pide acceso.
- **F-7 (CA-14).** Un usuario con nombre visible "Ana" guarda el hero de Molotes:
  - en `changes.jsonl` (del `DATA_DIR` temporal), `author` es "Ana" y `authorId` su id;
  - los formularios de guardar, conflicto, restaurar y semilla no tienen el campo de autor.
- **F-8 (CA-18).** Cada POST (crear, editar, desactivar, reactivar, restablecer, Mi cuenta, guardar menú) responde 303. Al repetir el GET del destino, ni la base de datos ni la auditoría cambian.

### Autorización (matriz)

Actores: anónimo, editor Molotes (EM), editor Birria (EB), editor de los dos (E2), administrador (A), administrador desactivado y sesión con `sessionVersion` antigua.

Rutas:

- `GET /admin`;
- `GET/POST /admin/cuenta`;
- `GET /admin/usuarios`, `GET /admin/usuarios/nuevo` y `POST /admin/usuarios`;
- `GET/POST /admin/usuarios/:id`, `POST …/desactivar`, `POST …/reactivar` y `GET/POST …/contrasena`;
- `GET/POST /admin/:negocio`, `GET/POST …/restaurar-anterior` y `POST …/restaurar-semilla`, para Molotes y Birria;
- `POST /admin/logout`.

Resultado esperado:

| Actor | Negocio propio | Negocio ajeno | Rutas de usuarios | Cuenta |
| --- | --- | --- | --- | --- |
| Anónimo | 303 al acceso (`?expirada=1` en POST) | igual | igual | igual |
| EM, EB, E2 | 200/303 | 403 HTML | 403 HTML | 200/303 |
| A | 200/303 | — | 200/303/404/409/422 según el caso | 200/303 |

Otros casos:

- `/admin/otro` → 404.
- La sesión inválida se trata como anónima.

Pruebas:

- **AUT-1.** La matriz completa por HTTP. Por cada 403 se comprueba:
  - el `shasum` de `DATA_DIR/<negocio>/*.json` y `changes.jsonl`, y el contenido de las tablas `user`, `user_business` y `user_audit`, antes y después;
  - que el cuerpo del 403 no contiene datos del negocio ajeno (nombre de productos ni hero).
- **AUT-2.** El 403 se produce antes de leer el body. Un POST del editor a Birria con un body inválido, de más de 128 KB o sin CSRF debe dar 403 y no 400, 413 ni 415.
- **AUT-3.** Desde el formulario de su propio negocio, el editor de Molotes cambia la URL de `action` a `/admin/birria` (con su CSRF válido) → 403, sin cambios.
- **AUT-4 (inicio y navegación).**
  - EM solo ve Molotes; EB solo Birria; E2 los dos.
  - Ningún editor ve el enlace a Usuarios.
  - A ve todo.
- **AUT-5 (CA-7).** Cualquier editor contra las 9 rutas de usuarios (GET y POST) → 403, con las tablas sin cambios.
- **AUT-6.** El editor contra su propio id (`/admin/usuarios/<suId>`, `…/contrasena`, `…/desactivar`) → 403.
- **AUT-7.** `next` del acceso:
  - con valores fuera de la lista (`//evil.example`, `https://evil.example`, `/admin/../x` y `/admin/birria` para EM) acaba en `/admin` o en el 403, nunca en otro origen;
  - con `next=/admin/usuarios` para un editor: tras entrar recibe 403.

### Escalada de privilegios

- **ESC-1.** El editor envía `POST /admin/cuenta` con su CSRF, la contraseña actual correcta y además `role=admin` y `business-birria=on`.
  - No debe cambiar ni el rol ni los negocios.
  - Respuesta esperada: 303 ignorando los campos, o 400 (ver NEG-7).
- **ESC-2.** El editor reutiliza su token CSRF contra `POST /admin/usuarios/<suId>` con `role=admin` → 403.
- **ESC-3.** El administrador edita a un editor con campos `business-*` desconocidos (`business-otro=on`) o con `role=superadmin` → 422 en el campo, sin cambios.
- **ESC-4.** El editor reutiliza la cookie `admin_sid` de un administrador cuya sesión ya se cerró (logout y después la cookie antigua) → 303 al acceso.
- **ESC-5.** El editor pide `GET` y `POST` de `/admin/usuarios/9999`, `/admin/usuarios/abc` y `/admin/usuarios/1`. Debe recibir siempre 403: el código no debe permitir distinguir los ids que existen.

### Pruebas negativas y casos límite

- **NEG-1 (CA-9).** Usuario repetido:
  - con otras mayúsculas (`QA-Dueno`);
  - con espacios alrededor;
  - en NFD frente a NFC (`José` compuesto y descompuesto).
  - Resultado: 422 junto al campo, sin escritura.
- **NEG-2.** Contraseña de 11, 12, 256 y 257 caracteres, incluidos emojis y acentos (se cuentan puntos de código). Confirmación distinta. En los 422, la contraseña no vuelve a pintarse.
- **NEG-3.** Editor sin negocios → 422. Un administrador con negocios marcados → se guarda sin negocios.
- **NEG-4.** Usuario y nombre visible:
  - vacíos, de 60 y de 61 caracteres, con caracteres de control (`%00`, `%1F`, `%7F`);
  - con HTML (`<script>`, `"><img>`): debe escaparse en la lista, el formulario, la cabecera "Sesión:", el inicio y el 403 (XSS almacenado).
- **NEG-5 (CA-10).** El único administrador intenta:
  - desactivarse;
  - pasar a editor desde su propia ficha;
  - pasar a editor desde la ficha de otro administrador desactivado.
  - Resultado: 409 con el aviso, sin cambios en la base de datos ni en la auditoría.
- **NEG-6 (CA-13).** Mi cuenta:
  - con la contraseña actual incorrecta: 422, nada cambia;
  - el acceso no queda bloqueado (comportamiento aprobado);
  - se anota R-QA-6 como observación.
- **NEG-7.** Campos desconocidos (`foo=1`) y repetidos en `/admin/usuarios`, `/admin/usuarios/:id`, `…/contrasena` y `/admin/cuenta`:
  - repetidos → 400;
  - desconocidos: se registra el comportamiento real. Ignorarlos no es un defecto de seguridad si no cambian nada (ESC-1). Si contradice la línea de "Validaciones" del plan aprobado, se clasifica según su impacto.
- **NEG-8.** Ids:
  - `:id` = `0`, `01`, `-1`, `1.5`, `99999999999` y `%31` → 404 sin consulta (el log no muestra un error de base de datos);
  - `:negocio` desconocido → 404.
- **NEG-9.** Límites de body: 16 KB en usuarios y cuenta, y 4 KB en desactivar, reactivar y acceso. Por encima → 413, con la sesión válida.
- **NEG-10 (CA-5).** Base de datos caída con el servidor en marcha:
  - se cambian los permisos del `.db` temporal o se reemplaza por basura;
  - `/admin/login`, `/admin`, `/admin/molotes` y `/admin/usuarios` → 503 HTML con `role="alert"`, sin texto técnico;
  - `/`, `/molotes` y `/birria` → 200;
  - el log `database_unavailable` solo lleva códigos.
- **NEG-11.** La sesión caduca a mitad de un formulario de usuarios (reloj simulado en Vitest o una sesión destruida): el POST da 303 a `/admin/login?next=…&expirada=1` y no escribe.
- **NEG-12.** Botón atrás tras cerrar sesión: `Cache-Control: no-store` en todas las páginas nuevas, y el navegador vuelve a pedir la página en lugar de mostrar la caché (BR-7).

### Concurrencia

- **CON-1.** Hay dos administradores, A1 y A2. Se envían en paralelo (`Promise.all` con dos agentes) "A1 desactiva a A2" y "A2 desactiva a A1".
  - Resultado: exactamente una da 303 y la otra 409 (o 303 al acceso si su sesión ya se cerró).
  - Queda al menos un administrador activo.
  - Se repite 20 veces.
- **CON-2.** Lo mismo con "degradar a editor" cruzado y con una mezcla de desactivar y degradar.
- **CON-3.** Mientras el servidor procesa una desactivación por HTTP del penúltimo administrador, `admin:recover` se ejecuta en paralelo sobre el otro.
  - No hay `SQLITE_BUSY` sin controlar.
  - Al final hay al menos un administrador activo.
- **CON-4.** Dos administradores editan al mismo usuario a la vez: gana la última escritura y `user_audit` tiene las dos entradas (decisión del plan).

### Sesiones

- **SES-1 (CA-11).** El usuario tiene la sesión abierta en dos agentes. El administrador lo desactiva, le cambia el rol, le cambia los negocios o le restablece la contraseña. En cada caso, la siguiente petición (GET y POST) de los dos agentes da 303 al acceso. Si fue desactivado, no vuelve a entrar.
- **SES-2.** Cambiar solo el nombre visible o el usuario de acceso no cierra la sesión (D-8 no lo pide), y la cabecera muestra el nombre nuevo.
- **SES-3.** El administrador se restablece su propia contraseña desde `/admin/usuarios/<suId>/contrasena`. Se registra el resultado (cierra su sesión, coherente con D-8) y se comprueba que puede volver a entrar con la nueva contraseña.
- **SES-4.** Un administrador que no es el último se desactiva a sí mismo: su sesión se cierra y no puede volver a entrar.
- **SES-5 (CA-16).** El acceso emite un `admin_sid` nuevo (sin fijación de sesión). El logout invalida la cookie en el servidor: reutilizarla da 303.
- **SES-6.** Tras un reinicio del servidor, las sesiones anteriores piden acceso (RT-7).

### Enumeración

- **ENU-1 (CA-12).** El cuerpo, el estado y las cabeceras (salvo la fecha) de las respuestas al acceso son idénticos byte a byte en cuatro casos:
  - usuario inexistente;
  - contraseña incorrecta de un usuario existente;
  - cuenta desactivada con la contraseña correcta;
  - cuenta desactivada con una contraseña incorrecta.
  - Se normaliza el token CSRF, si lo hay.
- **ENU-2.** El límite de intentos (5 fallos → 429 durante 15 min) se comporta igual en los cuatro casos. Se comprueba la clave del límite (origen) y que un usuario inexistente consume intentos igual que uno real.
- **ENU-3.** Tiempo: 20 intentos de cada caso de ENU-1 contra el servidor real, con el costo de producción. Se comparan las medianas. Se informa por separado del primer intento con un usuario inexistente tras el arranque, por el hash ficticio perezoso de R-QA-5.
  - Con una diferencia sistemática de más del 20 % entre medianas, se propone un MINOR.
  - Con una diferencia solo en la primera petición, se propone un TRIVIAL, o una observación si el usuario lo acepta. Antes se justifica.
- **ENU-4.** Las páginas de usuarios (solo las ve el administrador) no se consideran enumeración. Se comprueba que el 403 del editor no muestra datos de ningún usuario.

### Seguridad: CSRF, HTTPS, cabeceras y secretos

- **SEC-1.** En los 8 POST nuevos:
  - sin `_csrf`, con un `_csrf` de otra sesión o con un `_csrf` alterado → 403 JSON `CSRF_INVALID`, sin cambios;
  - con `Origin: https://evil.example` o `Sec-Fetch-Site: cross-site` → 403.
- **SEC-2.** Un editor con el token CSRF válido de su sesión contra rutas de administrador → 403 por permiso. El token no da permisos.
- **SEC-3 (CA-16).** `NODE_ENV=production` sin HTTPS → 503 en `/admin/*`. Con `TRUST_PROXY=true` y `X-Forwarded-Proto: https` → funciona, y la cookie lleva `Secure`, `HttpOnly`, `SameSite=Strict` y `Path=/admin`.
- **SEC-4.** `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: same-origin` en todas las páginas y estados nuevos (200, 303, 403, 404, 409, 422 y 503). La CSP de Helmet no cambia respecto a `main`.
- **SEC-5.** 5 fallos de acceso → 429, que dura 15 min (reloj simulado en Vitest; se comprueba la prueba existente). Un acceso correcto reinicia el contador.
- **SEC-6.** Logout por POST con CSRF. Un GET a `/admin/logout` no cierra la sesión.
- **SEC-7 (CA-17).** Barrido del log del servidor real (stdout y stderr capturados) después de todo el recorrido de Q2. Se buscan literalmente:
  - las contraseñas de QA;
  - `scrypt$` y los hashes generados;
  - cada `admin_sid` emitido;
  - cada token CSRF;
  - el valor de `ADMIN_PASSWORD_HASH`.
- **SEC-8.** Barrido de todas las respuestas HTML guardadas durante Q2:
  - ninguna contiene contraseñas, hashes ni `admin_sid`;
  - el token CSRF solo aparece en `name="_csrf"`;
  - ningún `value=` de un campo de contraseña tiene contenido.
- **SEC-9.** La auditoría (`user_audit.changes`) y `changes.jsonl` no contienen contraseñas ni hashes. Las respuestas 500, 503 y 4xx no tienen stack, SQL, rutas absolutas ni mensajes de Prisma.

### Aplicador de migraciones (Q-2 = B)

- **MIG-1.** Se revisan las pruebas existentes de `db-migrate.test.ts` y `db-prisma-compat.test.ts` y se ejecutan en `npm test`. Se confirma que la prueba de compatibilidad usa el CLI real 7.10.0, sin red (`CHECKPOINT_DISABLE=1`).
- **MIG-2 (cascada S-7).** Mutación temporal en una copia del aplicador en el scratchpad (nunca en `src/`): sin `foreign_keys=OFF`, la prueba de cascada debe fallar. Si no se puede aislar en el scratchpad, se usa la evidencia de la mutación de la implementación y se repite solo la prueba de cascada.
- **MIG-3 (atomicidad).** Una carpeta de migraciones temporal con una segunda migración que falla a mitad (`CREATE TABLE` y después un SQL inválido). No queda ni la tabla ni la fila en `_prisma_migrations`, y el servidor sale con 1.
- **MIG-4.** Idempotencia: el segundo arranque no aplica nada (sin `database_migrated`). El checksum alterado, una migración desconocida en la base de datos y una fila sin `finished_at` dan un error controlado y código 1.
- **MIG-5 (compatibilidad con el CLI).** Sobre el `.db` creado por la app real en F-1, ejecutar `npx prisma migrate status` y `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (`DATA_DIR` apuntando a la copia temporal). Resultado esperado: "up to date" y código 0.
- **MIG-6.** Una base más nueva que el código (fila extra en `_prisma_migrations`) → código 1 con el mensaje "más nueva que el código" (RT-6).
- **MIG-7.** WAL y `busy_timeout`: `PRAGMA journal_mode` = `wal` y `foreign_keys` = 1 en la conexión de la app (por inspección del log o con un script de solo lectura). Los archivos `-wal` y `-shm` quedan en `DATA_DIR`.

### Arranque

`node src/server.ts` con un `DATA_DIR` temporal y stdout y stderr capturados. En cada caso se verifica el código de salida y que la salida no tiene stack, SQL, rutas absolutas ni valores de variables.

- **ARR-1 (CA-1).** `DATA_DIR` vacío con las variables → arranca.
- **ARR-2 (CA-2).** Con usuarios y con otras variables → aviso sin valores.
- **ARR-3 (CA-3).** Sin usuarios ni variables → arranca y `/admin` da 503.
- **ARR-4.** `.db` dañado (bytes aleatorios) → 1.
- **ARR-5.** `.db` de solo lectura (`chmod 444`) → 1.
- **ARR-6.** `DATA_DIR` sin escritura (`chmod 555`) → 1.
- **ARR-7.** Migración rota (MIG-3) → 1.
- **ARR-8.** Solo `ADMIN_USER`, solo `ADMIN_PASSWORD_HASH` o un hash inválido → 1, sin el valor del hash en la salida. El `DATA_DIR` dentro de `src/` o de `public/` se rechaza (Seguridad del plan).
- **ARR-9.** `SIGTERM` → sale con 0 y libera el `.db`: se puede abrir en exclusiva justo después.

### Comando de consola (`admin:recover`)

- **CLI-1 (CA-15).** Con el servidor parado y sin `.db`: `npm run admin:recover -- --usuario qa-nuevo`, con la contraseña por stdin (dos líneas o la primera, según DT-14).
  - Crea el administrador y migra.
  - Queda `console_recovery` con `actor_kind` `console`.
  - Código 0.
- **CLI-2.** Con el servidor en marcha y una sesión abierta del usuario:
  - la sesión pide acceso;
  - la contraseña anterior da 401 y la nueva 303.
- **CLI-3.** Usuario existente desactivado y editor → queda activo, administrador y con la contraseña nueva (decisión 4).
- **CLI-4.** Errores, todos con código 1, sin cambios y sin mostrar la contraseña:
  - contraseña de menos de 12 caracteres;
  - confirmación distinta;
  - sin `--usuario`;
  - usuario vacío o de más de 60 caracteres;
  - `DATA_DIR` sin escritura.
- **CLI-5.** La contraseña no aparece en stdout ni en stderr (con TTY: revisión de `read-hidden.ts` y ejecución con `script` para simular un TTY, si es viable; sin TTY: lectura de stdin). `npm run admin:hash-password` sigue funcionando (regresión del parcial compartido).

### Pruebas responsive

Páginas: acceso, inicio (A y EM), lista de usuarios, crear (vacío y con errores), editar, restablecer contraseña, Mi cuenta (vacía, con errores y con éxito), 403, 503 y `/admin/molotes` (sin el campo de autor).

Viewports: 375×812, 768×1024 y 1440×900. En cada página se comprueba:

- sin overflow horizontal (`scrollWidth <= innerWidth`);
- la tabla o lista de usuarios es legible o tiene un desplazamiento controlado en 375;
- botones y enlaces con un área táctil de al menos 24×24 px (WCAG 2.2 AA), preferible 44;
- textos sin cortes y avisos visibles.

### Pruebas de accesibilidad

- **A11Y-1.** Un `h1` por página y jerarquía correcta. Landmarks: `header`, `nav` (con nombre si hay más de uno) y `main`.
- **A11Y-2.** Todos los campos tienen una `label` asociada. Los negocios van en un `fieldset` con `legend` y el rol en un `select` con etiqueta. Las contraseñas usan `type="password"` y el `autocomplete` correcto (`current-password` y `new-password`). El acceso usa `username` y `current-password`.
- **A11Y-3.** Errores:
  - resumen con `role="alert"` y enlaces a los campos;
  - cada campo con `aria-invalid="true"` y `aria-describedby` que apunta a su error;
  - el foco va al aviso al cargar (patrón existente; si depende de JavaScript, se verifica que sin JavaScript el aviso es lo primero tras el `h1`);
  - el estado no depende solo del color.
- **A11Y-4.** Foco visible al tabular en todos los enlaces, botones, casillas y `select`. Orden de tabulación lógico. Sin trampas de foco.
- **A11Y-5.** Contraste AA, calculado con `getComputedStyle` en los textos, avisos (éxito, error y 409), botones (primario, peligro y secundario), estados inactivos de la lista y bordes de los campos (3:1).
- **A11Y-6.** Las acciones destructivas (desactivar) y las de cada fila tienen un nombre accesible que identifica al usuario (por ejemplo "Desactivar a Ana"), no un "Desactivar" repetido sin contexto.
- **A11Y-7.** La página 403 y la 503 tienen un `h1`, un aviso con `role="alert"` y un enlace para salir.
- **A11Y-8.** Atributo `lang="es"` y `title` específico por página.

### Pruebas UX/UI

- No hay diseño en `_stich_source_/`. Se compara con los patrones de `/admin/molotes` en `main`: misma cabecera, mismos botones, notice y `field-*`.
- Se comprueba lo siguiente:
  - la cabecera muestra "Sesión: <nombre visible>", los enlaces permitidos y "Cerrar sesión";
  - avisos de éxito tras cada `?ok=`;
  - el texto de D-7 es claro;
  - el texto de las acciones es significativo;
  - la lista muestra usuario, nombre, rol, negocios, activo y último acceso, con la fecha en `BUSINESS_TIMEZONE`.
- Los avisos de `?ok=` con valores no previstos (`?ok=<script>`, `?ok=__proto__`) no se muestran ni se reflejan.

### Pruebas en navegador

- **BR-1.** Herramienta principal: la extensión Claude in Chrome (pestaña nueva, cerrada al terminar).
  - Si no responde tras 2 o 3 intentos, se usa Chrome sin interfaz con un perfil temporal por CDP, como en REQ-F-010, sin dependencias nuevas: el binario de Chrome instalado y un script de Node con `WebSocket` nativo en el scratchpad.
  - No se pulsan acciones que abran diálogos del navegador.
- **BR-2 (CA-8).** Flujo completo con el ratón y el teclado:
  1. Acceso del administrador.
  2. Inicio.
  3. Usuarios.
  4. Crear un editor.
  5. Aviso de éxito.
  6. Cierre de sesión.
  7. Acceso del editor.
  8. Inicio con solo su negocio.
  9. URL directa de Birria → 403.
- **BR-3 (CA-9).** Errores en el formulario de creación: anuncio, foco, conservación de lo escrito y contraseñas vacías.
- **BR-4.** Mi cuenta: error y éxito. Restablecer la contraseña. Desactivar y reactivar desde la lista.
- **BR-5 (CA-18).** Todas las páginas nuevas con JavaScript desactivado (`Emulation.setScriptExecutionDisabled` por CDP, o se comprueba que no hay ningún `<script>` y que los formularios son nativos): crear, editar, desactivar y Mi cuenta funcionan. Recargar tras un POST no lo repite.
- **BR-6 (CA-5).** Página 503 con la base de datos caída: la apariencia y el aviso se pueden leer.
- **BR-7.** Cerrar sesión y volver atrás: el navegador no muestra la página anterior desde la caché (`no-store`).
- **BR-8.** Consola del navegador sin errores (CSP incluida) y peticiones de red sin 4xx/5xx inesperados en las páginas nuevas.

### Pruebas de performance

- **PERF-1.** Las landings no consultan la base de datos. Se comprueba con la base caída en NEG-10 y revisando las importaciones (`routes/index.ts`, `controllers/landing`). Los tiempos de `/molotes` deben ser del mismo orden que en `main` (50 peticiones; solo se informa, no se usa como criterio).
- **PERF-2.** `/admin` hace dos consultas baratas por petición (lo indica el Implementation Result). Se acepta como dato; no es un defecto.
- **PERF-3.** El CSS de administración se regenera con `build:css`. Peso de `public/css/admin/main.css` frente a `main`. Las páginas nuevas no tienen JavaScript.
- **PERF-4.** Tamaño de la imagen `production` (DOC-4).

### Pruebas SEO

- **SEO-1.** Las landings conservan `title`, description, canonical y OG idénticos a `main` (REG-1).
- **SEO-2.** Todo `/admin/*` (incluidos 403, 404 y 503) devuelve `X-Robots-Tag: noindex, nofollow`. `robots.txt` y el sitemap, si existen, no cambian.

### Pruebas de regresión

- **REG-1 (landings byte a byte).** Worktree temporal de `main` en el scratchpad, con `node_modules` enlazado y su propio `build:css`. Las dos versiones se arrancan a la vez con la misma configuración (WhatsApp, zona horaria) y se compara el cuerpo y las cabeceras relevantes (`Content-Type`, CSP y `Cache-Control`) de `/`, `/molotes`, `/birria`, `/robots.txt` (si existe), los favicons y los manifiestos.
  - Se usa `cmp` para el cuerpo y `diff` para las cabeceras.
  - El estado de "abierto ahora" depende del reloj: las peticiones se hacen en el mismo minuto y se repiten si cambia el minuto.
- **REG-2.** `public/css/molotes/main.css` y `public/css/birria/main.css` generados en la rama y en `main` son idénticos (`cmp`). Los snapshots `tests/snapshots/landing-*.html` no cambian (`git diff --exit-code main -- tests/snapshots`).
- **REG-3.** Selección de landing por día (prueba rápida): `/` en un viernes a las 23:59 y un sábado a las 00:00 en `BUSINESS_TIMEZONE`. Lo cubre la suite existente (`landing.test.ts` y `business-schedule.test.ts`); se confirma que pasa.
- **REG-4 (flujo de menús de REQ-F-001).** Con el administrador y con el editor:
  - guardar el hero y una promoción;
  - conflicto (dos pestañas: la segunda recibe el aviso y sobrescribe);
  - restaurar la versión anterior;
  - restaurar la semilla con datos dañados (JSON alterado en el `DATA_DIR` temporal);
  - imagen inexistente → error en el campo.
  - El autor de cada operación es el nombre visible y el `authorId` correcto.
  - Un formulario con `author` enviado a mano → 400 `STRUCTURE_MODIFIED` (ajuste 6).
- **REG-5.** Las entradas antiguas de `changes.jsonl` (sin `authorId`) se conservan y se leen sin error. Se copia un `changes.jsonl` de `main` al `DATA_DIR` temporal y se guarda una vez.
- **REG-6.** Las pruebas existentes de REQ-F-001 a REQ-F-010 pasan en la suite completa.

### Docker (CA-19)

- **DOC-1.** `docker buildx build --platform linux/amd64 --target production` y lo mismo para `linux/arm64`:
  - arranque con un volumen y las variables;
  - logs `database_migrated` y `admin_bootstrap_created`;
  - acceso con 303;
  - `HEALTHCHECK` en `healthy`.
- **DOC-2.** Se reconstruye con `--no-cache` y se arranca con el mismo volumen y otras variables:
  - el usuario existente entra;
  - el usuario del entorno da 401;
  - aparece `admin_bootstrap_ignored` sin valores;
  - no se vuelve a migrar.
- **DOC-3.** `docker exec -i <c> node scripts/admin-recover.ts --usuario qa` con la contraseña por stdin → código 0 y la nueva contraseña da 303.
- **DOC-4.** Comprobaciones de la imagen:
  - `id -u` = 1000;
  - la imagen no contiene `.env`, `data/`, `*.db`, `prisma.config.ts`, `node_modules/prisma` ni `node_modules/typescript` (`docker run --rm --entrypoint sh … -c 'find / -name …'`);
  - tamaño aproximado de 262/266 MB.
- **DOC-5.** `docker compose run --rm test` en verde. Las 5 pruebas omitidas por ejecutarse como root se justifican.
- **DOC-6.** `npm ci --strict-allow-scripts` en limpio (en un directorio temporal copiado o en la etapa `deps` de Docker) termina sin error. El workflow `ci.yml` tiene `CHECKPOINT_DISABLE`, `db:generate` antes de typecheck y `--strict-allow-scripts`. El CI real se verá en el PR y queda como pendiente.
- Al terminar se borran las imágenes, contenedores y volúmenes de QA.

### Pruebas automatizadas

Existentes (se ejecutan todas):

- **AUTO-1.** `npm run build:css`, `npm run db:generate`, `npm run typecheck`, `npm run lint` (0 errores y 0 avisos; no se usa `lint:fix`) y `npm test` (610 o más en verde).
- **AUTO-2.** `git diff --exit-code main -- restaurante/tests/snapshots`.
- **AUTO-3.** Revisión de cobertura: cada CA tiene al menos una prueba que falla si se rompe. Se comprueba por inspección y con mutaciones puntuales en copias, no en `src/`.
- **AUTO-4.** `npm test` dos veces seguidas, para detectar inestabilidad por los procesos hijo y las carpetas temporales.

Nuevas (requieren la aprobación de este plan; solo en `restaurante/tests/`):

- **AUTO-5.** `tests/integration/admin-authorization-matrix.test.ts`. Matriz permanente de AUT-1, AUT-5, AUT-6 y ESC-5:
  - 5 actores (anónimo, EM, EB, E2 y A) × todas las rutas GET y POST de `/admin`;
  - el estado esperado de cada combinación;
  - las tablas y los JSON de menús sin cambios en cada 403.
  - Cubre combinaciones que hoy no se prueban: EB, E2, anónimo en las rutas nuevas e id inexistente para un editor.
- **AUTO-6.** En el mismo archivo o en `admin-users.test.ts` (con otro bloque `describe`):
  - ESC-1 (campos extra en Mi cuenta no cambian el rol ni los negocios);
  - CON-1 por HTTP (desactivación cruzada de dos administradores, repetida);
  - NEG-4 (escape de HTML en el nombre visible en lista, cabecera e inicio).
- Las pruebas nuevas usan `tests/support/admin.ts` y `database.ts`, no reproducen la implementación y no modifican producción. Si alguna falla por un defecto real, se queda en la rama, documentada en el QA Report, para que `senior-fullstack` corrija el código.

Sondas temporales (scripts de HTTP, CDP y SQLite de solo lectura) en el scratchpad. No se incorporan al repositorio.

### Evidencia requerida

- La salida de los comandos de AUTO-1, AUTO-2 y AUTO-4 (resúmenes con conteos).
- La tabla de la matriz de autorización con el estado obtenido por actor y ruta, y los `shasum` antes y después en los 403.
- Los extractos del log real (sin secretos) de F-1, F-2, ARR-* y NEG-10, y el resultado del barrido de secretos (0 coincidencias por patrón).
- Los códigos de salida y stderr de ARR-* y CLI-*.
- La salida de `prisma migrate status` y `migrate diff` (MIG-5).
- `cmp` y `diff` de REG-1 y REG-2.
- Capturas o mediciones del navegador por página y viewport: overflow, foco, contraste, `h1` y landmarks. También la consola sin errores.
- Los tiempos de ENU-3 (medianas y primera petición).
- Docker: `docker images`, `id -u`, `find` dentro de la imagen, los logs y el `HEALTHCHECK`.
- El estado final: servidores, Chrome, contenedores y worktree detenidos o eliminados; `restaurante/data/` sin cambios; `git status` solo con el ticket y los tests aprobados.

### Criterios de aprobación

- CA-1 a CA-20 en PASS con evidencia. CA-19 incluye arm64 en local. El CI de GitHub queda como pendiente para el PR, según la decisión 7 y el ajuste del Implementation Result.
- Ningún defecto BLOCKER ni CRITICAL. Se considera CRITICAL, como mínimo:
  - cualquier escalada de privilegios o acceso de un editor a un negocio o a una ruta no permitida;
  - cualquier secreto en logs o respuestas;
  - un caso que deje cero administradores activos;
  - una sesión no invalidada tras D-8;
  - una migración no atómica o una pérdida de filas por cascada.
- Los MAJOR quedan resueltos o aceptados explícitamente por el usuario.
- `npm test`, `typecheck` y `lint` en verde, incluidas las pruebas nuevas AUTO-5 y AUTO-6.
- Landings idénticas a `main` (REG-1 y REG-2) y flujo de menús sin regresión (REG-4 y REG-5).
- Páginas nuevas sin defectos de accesibilidad que impidan su uso con teclado o lector de pantalla, sin overflow en 375 px y funcionales sin JavaScript.

## QA Report

### Ronda

1 (2026-10-05). El QA Action Plan fue aprobado por el usuario (cita textual: "Apruebo el plan, las dos pruebas permanentes y el uso de Docker").

**Ampliación aprobada por el usuario.** Se agrega una prueba permanente nueva:

- `restaurante/tests/integration/admin-authorization-matrix.test.ts`, con 9 pruebas;
- cubre AUTO-5 (matriz de autorización) y AUTO-6 (escalada por "Mi cuenta", desactivación y degradación cruzadas de dos administradores por HTTP, y escape de HTML del nombre visible y del usuario).

No se modificó ningún archivo de producción ni ninguna aserción existente.

### Pruebas ejecutadas

**Entorno**

- Servidores reales de la rama en `DATA_DIR` temporales del scratchpad (puertos 3100 a 3116).
- `main` en un worktree temporal (3101).
- Credenciales de QA por variables de entorno. `.env` no se editó.
- Sondas HTTP, CDP y SQLite (de solo lectura) en el scratchpad.
- Huella inicial y final de `restaurante/data/`: idéntica, con 0 archivos modificados.

**Calidad y suite**

| Comando o acción | Resultado |
| --- | --- |
| `npm run build:css`, `db:generate`, `typecheck` y `lint` | Correctos. `typecheck` y `lint` terminan con 0 (sin errores ni avisos), también con la prueba nueva. |
| `npm test`, 3 ejecuciones finales | 39 archivos y **619/619** en verde cada vez: 610 existentes más 9 nuevas. |
| `npm test` con `--maxWorkers=1`, 6 ejecuciones | 614/614 cada vez (ejecución anterior a las últimas pruebas de AUTO-6). |
| `npm test` en paralelo, 25 ejecuciones durante Q2 | 4 fallos intermitentes. Son del entorno de pruebas en macOS, no del producto: ver OBS-1. También ocurren en `main` sin cambios (2 de 12 ejecuciones de `main` fallaron en `admin.test.ts`). |
| `docker compose run --rm test` (`network_mode: none`) | Código 0: 614 en verde y 5 omitidas (permisos de archivo como root), 619 en total. Incluye la compatibilidad con el CLI de Prisma sin red. |
| `git diff --exit-code main -- restaurante/tests/snapshots` | Sin cambios. |

**Ejecuciones manuales**

- **Matriz de autorización (AUT-1 a AUT-7) contra el servidor real:**
  - 5 actores × 13 GET;
  - 4 actores × 11 a 15 POST con token CSRF válido;
  - body inválido, de 200 KB, no UTF-8 y JSON;
  - `action` manipulado;
  - `next` con 6 valores maliciosos.
- **Escalada (ESC-1 a ESC-5), negativos (NEG-1 a NEG-12) y sesiones (SES-1 a SES-6).**
- **Concurrencia:**
  - CON-1 y CON-2: 3 modos × 20 rondas por HTTP;
  - CON-3: 5 rondas de HTTP y consola en paralelo;
  - CON-4.
- **Enumeración:**
  - ENU-1: cuerpos y cabeceras byte a byte;
  - ENU-2;
  - ENU-3: 25 × 4 casos con el costo de producción y direcciones IP distintas mediante `TRUST_PROXY`.
- **Seguridad:** SEC-1 (8 POST × 6 variantes de CSRF y origen), SEC-3, SEC-4 (1.206 respuestas de `/admin`), SEC-5, SEC-6 y SEC-7 a SEC-9 (barridos).
- **Migraciones:**
  - MIG-2: mutación en una copia del proyecto en el scratchpad;
  - MIG-3, MIG-4 y MIG-6: copia con una migración rota y bases alteradas;
  - MIG-5: CLI real;
  - MIG-7.
- **Arranque:** ARR-1 a ARR-9 con `node src/server.ts` real y su salida capturada.
- **Consola:** CLI-1 a CLI-5, incluido un TTY simulado con `script`.
- **Regresión:**
  - REG-1: `main` frente a la rama, con 12 rutas y 31 recursos locales;
  - REG-2;
  - REG-4: guardar, autor manual, conflicto, sobrescribir, restaurar la anterior, semilla con datos dañados e imagen inexistente;
  - REG-5.
- **Navegador:**
  - extensión Claude in Chrome, en una pestaña nueva y cerrada al terminar;
  - iframes del mismo origen de 375, 768 y 1440 px de ancho para medir;
  - teclado real para el foco.
- **Docker:** builds `production` de arm64 y amd64, contenedores con volumen, reconstrucción de arm64 con `--no-cache` y otras credenciales, y `docker exec` del comando de recuperación y de `hash-password`.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | `DATA_DIR` vacío: se crea `restaurante.db` y los logs muestran `database_migrated ["20261005163925_usuarios"]`, `admin_bootstrap_created` y `server_started adminStatus=created`. El acceso da 303. `user_audit` tiene `bootstrap` con `actor_kind=system`. El usuario no distingue mayúsculas ni espacios (`"  QA-DUENO  "` → 303). |
| CA-2 | PASS | Reinicio con `ADMIN_USER=intruso`: el usuario tiene el mismo `created_at`/`updated_at`, hay `admin_bootstrap_ignored reason=users_exist` y no se vuelve a migrar. Hay 0 apariciones del usuario o del hash del entorno en la salida. En Docker, tras la reconstrucción, el usuario existente da 303 y el intruso 401. |
| CA-3 | PASS | Sin usuarios ni variables: `/admin`, `/admin/login`, `/admin/molotes`, `/admin/usuarios` y `/admin/cuenta` → 503 `ADMIN_UNAVAILABLE`; `/`, `/molotes` y `/birria` → 200. Tras `admin:recover` con el servidor en marcha, `/admin/login` → 200 y el acceso → 303 sin reiniciar. |
| CA-4 | PASS | Todos los casos terminan con código 1 y un mensaje controlado, sin stack, SQL ni rutas: `.db` dañado (`SQLITE_NOTADB`), `.db` de solo lectura (`SQLITE_READONLY`), `DATA_DIR` sin escritura y sin `.db` (`SQLITE_CANTOPEN`), migración rota (`MIGRATION_FAILED`, sin la tabla ni la fila), checksum alterado (`MIGRATION_MODIFIED`), migración sin terminar (`MIGRATION_INCOMPLETE`) y base más nueva (`DATABASE_NEWER_THAN_CODE`). Ver también OBS-3. |
| CA-5 | PASS | Tablas borradas desde otro proceso con el servidor en marcha: acceso (GET y POST), `/admin`, negocio, usuarios y cuenta → 503 HTML con `role="alert"`, `no-store` y `noindex`, sin texto técnico. Las landings → 200. El log `database_unavailable` solo lleva `name`, `code` (`P2021`) y `originalCode`. |
| CA-6 | PASS | El editor de Molotes recibe 403 en GET de `/admin/birria` y de su confirmación, y en POST de guardar, sobrescribir, restaurar y semilla (también con el formulario y el token de Molotes). Lo mismo el editor de Birria contra Molotes. Los `shasum` de los JSON y de `changes.jsonl` y el estado de la base de datos no cambian. El 403 no muestra datos de Birria. El inicio solo enlaza los negocios permitidos (EM, EB y E2). |
| CA-7 | PASS | Los 3 editores contra las 6 rutas GET y las 7 POST de usuarios (también su propio id y un id inexistente) → 403. Las tablas no cambian. |
| CA-8 | PASS | El administrador crea 4 editores y 1 administrador por la UI (303 `?ok=created`). Cada uno entra y ve solo lo suyo (AUT-4). |
| CA-9 | PASS | Dan 422 con `aria-invalid` en el campo y un resumen `role="alert"`, sin escritura: usuario repetido (`EM`, `"  em  "`, `Em`, y `José` en NFD frente a NFC), contraseña de 11 caracteres (también 11 emojis), de 257 caracteres, confirmación distinta y editor sin negocios. Las contraseñas no se vuelven a pintar. 12 y 256 caracteres → 303. |
| CA-10 | PASS | El único administrador activo intenta desactivarse o pasar a editor → 409 "Debe quedar al menos un administrador activo: no se guardó nada." y se conserva lo escrito. Concurrencia por HTTP: 60 rondas (desactivar, degradar y mixto) con exactamente un administrador activo al final y una sola entrada de auditoría por ronda. La prueba permanente lo repite en cada `npm test`. |
| CA-11 | PASS | Desactivar, cambiar el rol, cambiar los negocios y restablecer la contraseña: el GET y el POST siguientes de las dos sesiones dan 303 al acceso (`expirada=1` en el POST). El desactivado da 401. Cambiar solo el nombre o el usuario no cierra la sesión, y la cabecera muestra el nombre nuevo. |
| CA-12 | PASS | El cuerpo, el estado y las cabeceras son idénticos byte a byte (3145 bytes, 401) en cuatro casos: usuario inexistente, contraseña incorrecta, cuenta desactivada con la contraseña correcta y desactivada con una incorrecta. Tras reactivar → 303. |
| CA-13 | PASS | Con la contraseña actual incorrecta → 422 en su campo, sin cambios. Con la correcta → 303: la sesión actual sigue (200) y la otra sesión → 303 al acceso. La nueva da 303 y la anterior 401. |
| CA-14 | PASS | "Ana" guarda el hero de Molotes: `changes.jsonl` tiene `"author":"Ana","authorId":20` y la página muestra "Último cambio: … por Ana". No hay campo de autor en guardar, conflicto ni restaurar. Un `author` enviado a mano → 400 `STRUCTURE_MODIFIED`. |
| CA-15 | PASS | Servidor parado y sin `.db` → crea el administrador (código 0) y `console_recovery` con `actor_kind=console`. Con el servidor en marcha → la sesión abierta pide acceso, la nueva da 303 y la anterior 401. Un editor desactivado pasa a administrador activo con `session_version` incrementada. En Docker (arm64 y amd64) → código 0, la nueva da 303 y la anterior 401. |
| CA-16 | PASS | 5 fallos → 429, también desde la IP con la contraseña correcta, y la misma lógica para un usuario inexistente. CSRF → 403 `CSRF_INVALID` en los 8 POST con 6 variantes. En producción sin HTTPS → 503; `X-Forwarded-Proto` sin `TRUST_PROXY` → 503; con TLS de proxy, la cookie lleva `Secure`, `HttpOnly`, `SameSite=Strict` y `Path=/admin`. El logout invalida en el servidor (reutilizar la cookie da 303) y el GET de logout da 404. Las 1.206 respuestas de `/admin` (de 200 a 503) llevan `no-store`, `noindex, nofollow`, `same-origin` y CSP. La caducidad de 2 h la cubre la suite. |
| CA-17 | PASS | Barrido de 2.549 líneas de log de todos los servidores, del comando de consola y del TTY contra 476 secretos (contraseñas, hashes, `scrypt$`, `admin_sid` y tokens): 0 coincidencias, y 0 stacks, SQL o rutas. Barrido de las páginas guardadas: 0 contraseñas o hashes; 4.878 apariciones de tokens, todas dentro de `name="_csrf"`; 0 campos de contraseña con valor. En la auditoría no hay hashes (las acciones de contraseña tienen `changes=null`). En producción, los 400 no llevan `stack`. |
| CA-18 | PASS | Ninguna página nueva tiene `<script>` (0 en todas). Formularios nativos enviados sin JavaScript de la app. Las 8 acciones usan POST-redirect-GET; recargar el destino no cambia la base de datos. El aviso de error tiene `autofocus` y `tabindex="-1"`: el foco va al aviso sin JavaScript. |
| CA-19 | PASS | Build `production` en arm64 (262 MB) y amd64 (266 MB) con `npm ci --strict-allow-scripts`, `db:generate` y `typecheck`. En los dos contenedores: `healthy`, migración y creación del administrador, acceso con 303, `id -u` = 1000 (`node`), volumen 700 de `node`, sin `.env`, `*.db`, `/app/data`, `prisma.config.ts`, CLI de Prisma ni TypeScript. Tras reconstruir arm64 con `--no-cache` y el mismo volumen, el usuario persiste y no se vuelve a migrar. `docker compose run --rm test` en verde. El CI real de GitHub queda pendiente para el PR (decisión 7). |
| CA-20 | PASS | `typecheck` y `lint` terminan con 0 y `npm test` da 619/619. Los snapshots no cambian. README, `.env.example` y `senior-fullstack.md` se revisaron en Q1 (R-12). |

### Defectos encontrados

#### DEF-001

- **Severidad:** MINOR.
- **Criterio afectado:** criterio de aprobación del QA Action Plan ("sin overflow en 375 px"); responsive en `diseno-responsivo.md`. No afecta a ningún CA funcional.
- **Descripción:** la página `/admin/usuarios` se desplaza en horizontal a nivel de documento en móvil.
  - La tabla está dentro de un contenedor `overflow-x-auto` (`div.admin-users`).
  - Los `<span class="sr-only">` de la columna de acciones ("Editar a …", "Restablecer contraseña de …", "Desactivar a …") son `position: absolute`.
  - Como el contenedor no está posicionado, se colocan respecto al documento y lo ensanchan.
- **Pasos para reproducir:**
  1. Abrir `/admin/usuarios` como administrador con un ancho de 375 px.
  2. Medir `document.documentElement.scrollWidth`.
- **Resultado esperado:** el documento no se desplaza en horizontal; solo la tabla, dentro de su contenedor.
- **Resultado actual:**
  - con 6 usuarios normales: `scrollWidth` es 647 frente a 375 (en 768, 1024 y 1440 no hay desbordamiento);
  - con los datos de QA (un usuario de 60 caracteres sin espacios): 1211 en 375 y 1491 en 1440;
  - `scrollTo(2000, 0)` llega a `scrollX` = 836: la página se mueve hacia una zona en blanco;
  - con `.admin-users { position: relative }` aplicado en la sonda, `scrollWidth` pasa a 375 (confirma la causa).
- **Evidencia:** medición CDP en un iframe de 375 px. 61 `.sr-only` con `right` máximo de 1210 px.
- **Impacto:** en móvil, la página de usuarios se puede arrastrar hacia los lados y la cabecera y el título se salen de la vista. El contenido y las acciones siguen siendo accesibles y funcionales. Solo afecta a administradores en móvil.
- **Recomendación:** contener los elementos absolutos dentro del contenedor con scroll, para que el desbordamiento quede solo en la tabla.

#### DEF-002

- **Severidad:** TRIVIAL.
- **Criterio afectado:** CA-12 y DT-10 ("hash ficticio calculado al arrancar"). CA-12 pasa.
- **Descripción:** el hash ficticio se calcula en el primer acceso fallido con un usuario inexistente, no al arrancar.
- **Pasos para reproducir:**
  1. Arrancar el servidor.
  2. Hacer un acceso con un usuario inexistente.
  3. Hacer un acceso con un usuario existente y una contraseña incorrecta.
- **Resultado esperado:** los dos tardan lo mismo.
- **Resultado actual:** 124 ms frente a 61 ms en la primera petición. Después, las medianas son iguales en los 4 casos (59,9 a 60,0 ms, 25 muestras cada uno).
- **Impacto:** una sola petición por arranque del proceso tarda el doble y en teoría delata que ese usuario no existe. En la práctica no es explotable de forma fiable.
- **Recomendación:** calcular el hash ficticio al arrancar, como indica DT-10.

#### DEF-003

- **Severidad:** TRIVIAL.
- **Criterio afectado:** accesibilidad (A11Y-1).
- **Descripción:** la página 403 de un negocio (p. ej. `/admin/birria` para un editor de Molotes) marca "Inicio" con `aria-current="page"`, aunque la página actual no es el inicio.
- **Resultado esperado:** ningún enlace con `aria-current` (o el que corresponda a la página).
- **Impacto:** un lector de pantalla anuncia "página actual" en un enlace incorrecto.
- **Recomendación:** no marcar como actual un enlace que no corresponde a la URL.

#### DEF-004

- **Severidad:** TRIVIAL.
- **Criterio afectado:** la línea "Validaciones" del Technical Action Plan ("Campos desconocidos o repetidos → 400").
- **Descripción:** en los formularios de usuarios y de Mi cuenta, los campos repetidos dan 400 `INVALID_FORM`, pero los desconocidos (`foo=1`, `role`, `business-*` en Mi cuenta) se ignoran con 303.
- **Impacto:** ninguno en seguridad. ESC-1 confirma que en Mi cuenta no cambian ni el rol ni los negocios, y la prueba permanente lo comprueba.
- **Recomendación:** alinear el plan o el código. Basta con documentar que se ignoran.

### Regresión

- **Landings frente a `main` (REG-1):** cuerpos y cabeceras (sin la fecha) idénticos en `/`, `/molotes`, `/birria`, el favicon, los CSS, los 404 y 31 recursos locales referenciados. La CSP de `/admin` es igual.
- **CSS (REG-2):** `public/css/molotes` y `public/css/birria` son idénticos a `main`. El CSS de administración crece de 20.363 a 21.079 bytes.
- **Snapshots:** sin cambios.
- **Flujo de menús de REQ-F-001 (REG-4):** funciona con el autor verificado: guardar, conflicto 409 → sobrescribir, restaurar la anterior, restaurar la semilla con datos dañados e imagen inexistente → 422 en el campo.
- **Registro antiguo (REG-5):** una línea antigua sin `authorId` se conserva intacta tras guardar.
- **Landings sin base de datos:** no importan la base de datos y responden 200 con la base caída (NEG-10).
- **Selección por día (REG-3):** la cubre la suite en verde.
- **Apagado (ARR-9):** `SIGTERM` con conexiones keep-alive abiertas → código 0 en 11 ms (en `main`, 4 ms).

### Responsive

Páginas: inicio, lista de usuarios, crear, editar, restablecer, Mi cuenta, Molotes, 403 y 503, en 375, 768 y 1440 px.

- Sin desbordamiento horizontal, salvo `/admin/usuarios` (DEF-001).
- Áreas táctiles: los enlaces de texto en línea miden de 17 a 21 px de alto (OBS-6). Los botones y campos miden al menos 24 px. Las casillas son de 20×20 px con una etiqueta que se puede pulsar.

### Accesibilidad

- **Estructura:** un `h1` por página, `lang="es-MX"`, `title` específico y landmarks `header`, `nav` ("Administración") y `main`. Enlace "Saltar al contenido". La tabla tiene `caption` y `th scope`.
- **Campos:** todos tienen etiqueta. Los negocios van en un `fieldset` con `legend` y una pista en `aria-describedby`. El `autocomplete` es correcto (`username`, `current-password` y `new-password`), con `minlength=12`.
- **Errores:**
  - resumen `role="alert"` con `autofocus` y enlaces a los campos (sin enlaces rotos);
  - `aria-invalid` en el campo y `aria-describedby` hacia "Error: …", así que no depende solo del color;
  - borde rojo de 1 px.
- **Foco:** foco visible al tabular con contorno de 2 o 3 px en todos los elementos de inicio, crear usuario, acceso y cabecera. El orden de tabulación es lógico.
- **Contraste:** sin textos por debajo de AA ni bordes de campo por debajo de 3:1, calculado con colores reales convertidos desde oklch.
- **Acciones de fila:** tienen nombre accesible con el usuario, por ejemplo "Editar a ana" (`sr-only`).
- **Páginas 403 y 503:** tienen `h1`, `role="alert"` y un enlace de salida.
- **Defecto:** DEF-003.

### UX/UI

- Coherente con los patrones de `/admin/molotes`: cabecera "Sesión: <nombre> (<rol>)", botones y avisos.
- Mensajes claros: D-7, éxito tras cada `?ok=` y errores por campo.
- Los valores de `?ok=` no previstos (`<script>`, `__proto__`, `constructor` y `toString`) ni se muestran ni se reflejan.
- El HTML del nombre visible y del usuario se escapa en todas las páginas (prueba permanente).
- No hay diseño en `_stich_source_/` (C-8).

### Performance

- `/molotes`: 1,2 ms de media en la rama y 1,1 ms en `main` (50 peticiones). Las landings no consultan la base de datos.
- Imagen: 262 MB (arm64) y 266 MB (amd64), frente a unos 172/176 MB antes, como prevé el plan. `node_modules` tiene 77 paquetes y 88,5 MB.
- Las páginas nuevas no tienen JavaScript y no hay errores en la consola del navegador (acceso, inicio, Molotes, cuenta, 403 y 503).

### SEO

- Las landings son idénticas a `main`: mismo `title`, description, canonical y OG.
- Todo `/admin/*` (200, 303, 4xx y 503) lleva `X-Robots-Tag: noindex, nofollow`. `robots.txt` responde 404, igual que en `main`.

### Observaciones (no son defectos de este ticket)

- **OBS-1. Pruebas intermitentes en macOS, también en `main`.**
  - Causa: supertest escucha en `::` (puerto efímero) y conecta a `127.0.0.1`. En macOS, otro proceso local con un socket IPv4 en el mismo puerto recibe la petición. Se capturó la respuesta "Client sent an HTTP request to an HTTPS server" de un servicio ajeno.
  - No ocurre con `--maxWorkers=1` (6/6 en verde) ni en Docker. En el CI de Linux no debería ocurrir.
  - La prueba nueva hace muchas peticiones, así que se expone más: 2 o 3 fallos en 25 ejecuciones aisladas.
  - Se recomienda otro ticket para que las pruebas escuchen en `127.0.0.1`.
- **OBS-2.** Mi cuenta no limita los intentos con la contraseña actual (decisión del plan). Se comprobaron 7 fallos seguidos sin bloqueo del acceso.
- **OBS-3.** Si `DATA_DIR` no tiene permiso de escritura pero ya existen `restaurante.db`, `-wal` y `-shm` con escritura, el servidor arranca, porque la base de datos sí se puede escribir. Sin esos archivos termina con código 1. Es coherente con R-2, que trata la base de datos no disponible.
- **OBS-4.** Con una base más nueva que el código, stderr muestra el mensaje genérico y el motivo (`DATABASE_NEWER_THAN_CODE`) solo aparece en el log.
- **OBS-5.** El error de usuario repetido aparece cuando no quedan otros errores de validación (la unicidad se comprueba al guardar).
- **OBS-6.** Los enlaces de texto de la lista y del inicio miden de 17 a 21 px de alto. Cumplen WCAG 2.5.8 por la excepción de espaciado y de enlace en línea.
- **OBS-7.** CON-3 no consiguió simultaneidad real entre HTTP y consola: SQLite serializó las escrituras, sin `SQLITE_BUSY` ni estados inválidos. La simultaneidad real está cubierta en `user-repository.test.ts` y en la prueba permanente por HTTP.

### Pendientes de revisión manual

- El CI de GitHub (`calidad` y `docker`) se verá en el PR.
- La ventana de Chrome no se pudo redimensionar a 375 px. La vista móvil se midió con iframes de 375, 768 y 1440 px del mismo origen. Si el usuario quiere, puede mirar `/admin/usuarios` en su móvil para ver DEF-001.

### Limpieza

- Servidores de QA, worktree de `main` y pestañas de Chrome cerrados.
- Contenedores, volúmenes e imágenes `qa-req007:*` eliminados.
- `restaurante/data/` sin cambios.
- Ningún archivo de producción cambió (`shasum` de `src/`, `scripts/`, `prisma/`, `public/`, `Dockerfile` y `package*.json` idénticos al inicio).
- `git status` solo difiere del inicio por la prueba nueva y este ticket.
- **Efectos en Docker fuera de lo planificado, para que el usuario los revise:**
  - Se ejecutó `docker image prune -f --filter dangling=true`, que borra las imágenes sin etiqueta de todo Docker local, no solo las de QA.
  - Un `docker run alpine:3` sin necesidad pudo haber descargado `alpine:3`. Se conservó, porque no se sabe si ya existía.
  - `docker compose run --rm test` volvió a etiquetar `restaurante:test` con el código de la rama, como en la verificación de la implementación.

### Resultado final

NEEDS_USER_DECISION

Todos los CA (CA-1 a CA-20) pasan y no hay defectos BLOCKER, CRITICAL ni MAJOR. Solo DEF-001 (MINOR) incumple un criterio de aprobación del QA Action Plan ("sin overflow en 375 px"), así que se pide decidir:

1. ¿Se corrige DEF-001 (desplazamiento horizontal de `/admin/usuarios` en móvil) antes de aprobar? En ese caso, QA devuelve `QA_REJECTED` para que `senior-fullstack` lo corrija y QA revalida. ¿O se acepta como defecto conocido y QA devuelve `QA_APPROVED`?
2. ¿Los TRIVIAL DEF-002, DEF-003 y DEF-004 se corrigen en esta rama (si se corrige DEF-001) o quedan registrados para otro ticket?
3. ¿Se abre un ticket aparte para OBS-1 (pruebas intermitentes en macOS, también en `main`)?

### Decisión del usuario (ronda 1)

Cita textual: "Corrige DEF-001 a DEF-004 en esta rama y abre ticket para OBS-1".

1. DEF-001 se corrige antes de aprobar.
2. DEF-002, DEF-003 y DEF-004 también se corrigen en esta rama. En DEF-004, los campos desconocidos de los formularios de usuarios y de Mi cuenta deben responder 400, como indica el Technical Action Plan.
3. OBS-1 va a un ticket aparte, que gestiona la sesión principal con el business-analyst. No es parte de este ticket.

### Resultado final de la ronda 1 (tras la decisión)

QA_REJECTED

#### Correcciones para `senior-fullstack`

**DEF-001 (MINOR): desplazamiento horizontal de `/admin/usuarios` en móvil**

- **Causa:** los `<span class="sr-only">` de la columna de acciones (`partials/user-row.html`) son `position: absolute`. Su contenedor con scroll, `div.admin-users overflow-x-auto` (`users-list.html`), no está posicionado. Por eso esos spans se colocan respecto al documento y lo ensanchan.
- **Comprobación de la causa:** con `position: relative` en `.admin-users`, el `scrollWidth` vuelve a 375.
- **Criterio de verificación:** con 375, 768 y 1440 px de ancho, en `/admin/usuarios`:
  - `document.documentElement.scrollWidth <= innerWidth`;
  - también con un usuario de 60 caracteres sin espacios;
  - la tabla solo se desplaza dentro de su contenedor;
  - las acciones conservan su nombre accesible, por ejemplo "Editar a …".

**DEF-002 (TRIVIAL): hash ficticio perezoso**

- **Causa:** `createUserAuthenticator` (`src/services/admin-auth.ts`) calcula el hash ficticio con `dummy()` en el primer acceso fallido con un usuario inexistente. DT-10 pide calcularlo al arrancar.
- **Criterio de verificación:** tras arrancar, el primer acceso con un usuario inexistente tarda lo mismo que el primero con un usuario existente y una contraseña incorrecta. La diferencia entre ambos debe ser de menos del 20 % con el costo de producción. CA-12 sigue pasando.

**DEF-003 (TRIVIAL): `aria-current` incorrecto en la página 403**

- **Causa:** la página 403 de un negocio (p. ej. `/admin/birria` para un editor de Molotes) marca "Inicio" con `aria-current="page"`.
- **Criterio de verificación:** en la página 403, ningún enlace de la navegación tiene `aria-current="page"` salvo el que corresponda a la URL actual. El resto de páginas conservan su `aria-current` correcto (inicio, negocio, usuarios y cuenta).

**DEF-004 (TRIVIAL): campos desconocidos aceptados**

- **Causa:** `readFormBody` solo rechaza los campos repetidos. Los controladores de usuarios (`admin-users.ts`) y de Mi cuenta (`admin-account.ts`) ignoran los desconocidos.
- **Criterio de verificación:** en `POST /admin/usuarios`, `/admin/usuarios/:id`, `…/desactivar`, `…/reactivar`, `…/contrasena` y `/admin/cuenta`:
  - un campo desconocido (`foo=1`, o `role` o `business-*` en Mi cuenta) da 400 con el formato de error común y no escribe nada;
  - los formularios reales, tal como los envía el navegador, siguen funcionando;
  - las casillas `business-*` sin marcar no se envían, así que deben seguir siendo opcionales;
  - el orden de DT-12 se mantiene: un editor sin permiso sigue recibiendo 403 antes de que se lea el body.
- **Prueba existente afectada:** la prueba permanente AUTO-6 de "Mi cuenta" acepta hoy 303 o 400. Con la corrección debe dar 400. No hace falta cambiarla, pero se puede ajustar a 400 si se desea.

#### Ronda 2 (qué volverá a comprobar QA)

1. DEF-001 a DEF-004, con los criterios anteriores. DEF-001 se revisará en el navegador (`/admin/usuarios` con 375, 768 y 1440 px de ancho). DEF-004 se revisará por HTTP contra el servidor real.
2. Regresión mínima:
   - `npm run typecheck`, `npm run lint` y `npm test`;
   - la matriz de autorización (`admin-authorization-matrix.test.ts`, y una pasada por HTTP de AUT-1 sobre el servidor real);
   - la página `/admin/usuarios` a 375 px en el navegador;
   - las pruebas de accesibilidad de los formularios afectados por DEF-004 (crear, editar, restablecer y Mi cuenta: siguen dando 303 o 422 con datos reales).

### Ronda 2 (revalidación, 2026-10-05)

**Qué cambió.** `senior-fullstack` corrigió DEF-001 a DEF-004 (ver "Correcciones de la ronda 1 de QA"). El usuario aprobó la implementación de las correcciones (cita textual: "Apruebo la implementación").

- Archivos de producción tocados: `users-list.html`, `admin-auth.ts`, `views/admin/index.ts`, `admin-access.ts`, `admin-users.ts` y `admin-account.ts`.
- Pruebas: `tests/integration/admin-qa-round1.test.ts` (nueva), `tests/unit/admin-auth.test.ts` y AUTO-6.

Se volvieron a probar los cuatro defectos y la regresión mínima definida al cerrar la ronda 1. No hizo falta un plan nuevo.

**Entorno.**

- `DATA_DIR` temporales en el scratchpad y credenciales de QA por variables de entorno.
- `.env` y `restaurante/data/` sin tocar.
- La extensión Claude in Chrome se usó en una pestaña nueva, cerrada al terminar.
- No se usó Docker en esta ronda.
- El archivo `.claude/docs/backlog/REQ-F-011-…` sin versionar no se tocó.

#### Pruebas ejecutadas

| Comando o acción | Resultado |
| --- | --- |
| `npm run build:css`, `db:generate`, `typecheck` y `lint` | Correctos. `typecheck` y `lint` terminan con 0. |
| `npm test` en paralelo, 11 ejecuciones | 9 en verde (40 archivos, **626/626**) y 2 con fallos ajenos a este ticket (OBS-1, ver abajo). |
| `npm test --maxWorkers=1`, 3 ejecuciones | 626/626 en las tres. |
| AUT-1 a AUT-7 y ESC-1 a ESC-3 por HTTP contra el servidor real | Matriz idéntica a la de la ronda 1. |
| DEF-004 por HTTP contra el servidor real | Ver la tabla de defectos. |
| DEF-002: 14 arranques reales en producción y medición del primer acceso | Ver la tabla de defectos. |
| DEF-003 por HTTP | Ver la tabla de defectos. |
| DEF-001 en el navegador, iframes de 375, 768 y 1440 px y ventana real de 500 px | Ver la tabla de defectos. |

Los 2 fallos en paralelo fueron en `admin.test.ts` CA-36 y `app.test.ts` en la primera ejecución, y en `icons.test.ts` (HEAD del icono, que recibió `text/html` de otro proceso) en la segunda. Son el patrón de OBS-1 y afectan a pruebas de otros tickets.

#### Defectos de la ronda 1

| Defecto | Resultado | Evidencia |
| --- | --- | --- |
| DEF-001 | **Corregido** | Ver el detalle debajo de la tabla. |
| DEF-002 | **Corregido** | Ver el detalle debajo de la tabla. |
| DEF-003 | **Corregido** | En el 403 del editor de Molotes en `/admin/birria`, `/admin/usuarios` y `/admin/usuarios/nuevo` no hay ningún enlace con `aria-current`. Las demás páginas del administrador conservan el suyo: inicio "Inicio", Molotes "Moloteando", Birria "Birriería El Muñeco", y lista, nuevo y edición "Usuarios", Mi cuenta "Mi cuenta". |
| DEF-004 | **Corregido** | Ver el detalle debajo de la tabla. |

**DEF-001.** `/admin/usuarios` tenía 10 usuarios, uno de ellos de 60 caracteres sin espacios.

- Ancho del documento igual al de la ventana, sin desplazamiento horizontal (`scrollTo(3000,0)` deja `scrollX` en 0): 375/375, 768/768 y 1440/1440 px, y 500/500 en la ventana real.
- La tabla se desplaza solo dentro de su contenedor (`position: relative`): ancho 1159 frente a 341, 718 y 846, con `scrollLeft` de 818, 441 y 313.
- Hay 0 `.sr-only` fuera del contenedor.
- Las acciones conservan su nombre accesible: "Editar a u×60", "Restablecer contraseña de u×60" y "Desactivar a u×60".
- El CSS generado contiene `.relative{position:relative}`.

**DEF-002.** El hash ficticio se crea al construir el autenticador (`admin-auth.ts`, línea 123).

- **Antes:** el primer acceso con un usuario inexistente tardaba 124 ms y el de un usuario existente 61 ms.
- **Ahora:** la primera petición de acceso tras arrancar es igual de lenta, sea cual sea el usuario.
  - Inexistente como primera petición: 94,7 a 98,5 ms (4 arranques).
  - Existente con contraseña incorrecta como primera petición: 86,1 a 97,3 ms (4 arranques).
  - Diferencia entre los dos "primeros": menos del 20 %.
  - La segunda petición tarda unos 60 ms en los dos casos.
- Es el calentamiento del proceso y no depende de que la cuenta exista. CA-12 sigue pasando.

**DEF-004.** Un campo desconocido da 400 `{"error":{"code":"INVALID_FORM","message":"El formulario tiene campos desconocidos."}}` en estos 8 casos, sin cambios en usuarios, negocios ni auditoría, y con la sesión intacta:

- `foo` en crear, editar y desactivar;
- `password` en editar;
- `role` en reactivar y en restablecer;
- `business-birria` y `active` en Mi cuenta.

Además:

- En producción el 400 no lleva `stack`.
- Se mantiene el orden de DT-12:
  - token CSRF inválido y campo desconocido → 403 `CSRF_INVALID`;
  - editor y campo desconocido en usuarios o en el otro negocio → 403 por permiso.
- Los campos repetidos siguen dando 400.
- Los formularios reales siguen funcionando, también tal como los arma el navegador a partir del HTML:
  - crear un editor con una casilla y un administrador sin casillas → 303;
  - editar → 303;
  - desactivar, reactivar y restablecer → 303;
  - Mi cuenta → 303;
  - guardar el menú → 303;
  - los errores de validación siguen dando 422.

#### Revisión del ajuste de AUTO-6

El ajuste no debilita la prueba, la refuerza.

- **Antes:** aceptaba 303 o 400 y comprobaba que el rol y los negocios no cambiaban.
- **Ahora exige:**
  - 400 y el cuerpo exacto `INVALID_FORM`;
  - que la contraseña **no** cambió (`verifyPassword` de la nueva da `false`);
  - que el rol sigue siendo editor y los negocios `['molotes']`;
  - que el editor recibe 403 en `/admin/birria` y en `/admin/usuarios`.
- El resto de `admin-authorization-matrix.test.ts` no perdió aserciones: sigue habiendo 6 bloques `it` y 42 `expect`, y la única aserción permisiva es la original, `[200, 303, 404]`, en la confirmación de restaurar de un negocio permitido.

#### Regresión mínima

- **Matriz de autorización:** la prueba permanente pasa. La pasada por HTTP contra el servidor real es idéntica a la de la ronda 1: 5 actores × 13 GET y 4 actores × 11 a 15 POST, sin escrituras. También se repitieron `action` manipulado, body inválido, enorme, no UTF-8 y JSON, el editor contra su propio id y `next` malicioso.
- **ESC-3:** `business-otro` ahora da 400 (antes 422). Es coherente con DEF-004 y sin escritura.
- **Secretos:** 0 coincidencias de contraseñas, hashes, `admin_sid` o tokens en 395 líneas de log de esta ronda.
- **Producción y datos:** ningún archivo de producción cambió durante la ronda (`shasum` igual). `restaurante/data/` sin cambios.

#### Defectos abiertos

Ninguno.

#### Observaciones

- **OBS-1** sigue igual: pruebas intermitentes en macOS por colisión de puertos de supertest, también en `main`. La sesión principal lo gestiona en un ticket aparte, ya creado en `backlog/` como REQ-F-011. No bloquea, porque con `--maxWorkers=1` y en Docker la suite pasa entera.
- **OBS-2 a OBS-7** sin cambios.

#### Pendientes de revisión manual

- El CI de GitHub (`calidad` y `docker`) se verá en el PR.

#### Limpieza

- Servidores de QA detenidos y pestaña de Chrome cerrada. No hay worktrees adicionales.
- Ningún archivo de producción cambió durante la ronda.
- `restaurante/data/` sin cambios.
- `git status` es idéntico al del inicio de la ronda 2, salvo este ticket.

#### Resultado final (ronda 2)

QA_APPROVED

- CA-1 a CA-20 en PASS (ronda 1).
- DEF-001 a DEF-004 corregidos y verificados.
- Sin defectos abiertos y `npm test` 626/626.
- Sin regresión en la autorización ni en los formularios.

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Incorpora las respuestas 7.1 A a 7.5 A ("apruebo todo") y las propuestas P-1 a P-8 como D-6 a D-13. Aprobada por el usuario ("apruebo 007 y 008"; confirmación de versión: "a").

### Revisión técnica (T1)

Revisión técnica de `senior-fullstack` (2026-10-05), sin cambios de código, con un spike en el scratchpad (Prisma 7.10.0 y Docker en Alpine amd64 y arm64). Se agrega el Technical Action Plan: hallazgos S-1 a S-11, Q-2 resuelta con la recomendación B (aplicador propio), DT-1 a DT-16, el esquema Prisma, rutas, Docker, CI, pruebas para CA-1 a CA-20 y riesgos RT-1 a RT-7. El estado pasa a `NEEDS_TECHNICAL_PLAN_APPROVAL` y el ticket permanece en `backlog/`.

### Inicio de implementación (T2)

El usuario aprobó el Technical Action Plan (cita textual: "Apruebo el plan con las decisiones 1 a 7"). Se crea la rama `feature/REQ-F-007-control-usuarios-roles` desde `main` (`56a7b75`) y el ticket pasa a `in-progress/` con estado `IN_PROGRESS`.

### Implementación (T2)

Implementación completa en 5 etapas, con la suite en verde tras cada una: de 502 a 610 pruebas. Docker se verificó en amd64 y arm64. Se agrega `## Implementation Result` con siete ajustes técnicos respecto al plan, sin cambio de alcance funcional. El estado pasa a `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commits.

### QA (Q1)

El usuario aprobó la implementación (cita textual: "Apruebo la implementación"). `senior-qa` analiza el requisito, el Implementation Result y el diff contra `main`, sin ejecutar la batería definitiva. Agrega `## QA Action Plan` con:

- 14 riesgos (R-QA-1 a R-QA-14);
- la matriz de autorización, escalada, concurrencia, sesiones, enumeración, CSRF, secretos, aplicador de migraciones, arranque, consola, regresión byte a byte con `main`, Docker, navegador y accesibilidad;
- 2 archivos de pruebas nuevas propuestos (AUTO-5 y AUTO-6).

El estado pasa a `NEEDS_QA_PLAN_APPROVAL`.

### QA (Q2, ronda 1)

El usuario aprobó el QA Action Plan, las dos pruebas permanentes y el uso de Docker (cita textual: "Apruebo el plan, las dos pruebas permanentes y el uso de Docker"). Se ejecuta el plan completo y se agrega `restaurante/tests/integration/admin-authorization-matrix.test.ts` con 9 pruebas (AUTO-5 y AUTO-6). La suite queda en 619/619.

Resultado:

- CA-1 a CA-20 en PASS;
- DEF-001 MINOR (desplazamiento horizontal de `/admin/usuarios` en móvil);
- DEF-002 a DEF-004 TRIVIAL;
- OBS-1 a OBS-7.

El estado pasa a `NEEDS_USER_DECISION` por DEF-001 frente al criterio de aprobación "sin overflow en 375 px". Sin commits.

### QA (Q2, ronda 1, decisión)

El usuario decidió (cita textual): "Corrige DEF-001 a DEF-004 en esta rama y abre ticket para OBS-1". El estado pasa a `QA_REJECTED`, con las correcciones para `senior-fullstack` y lo que QA revisará en la ronda 2. OBS-1 queda para un ticket aparte, que gestiona la sesión principal.

### Correcciones de QA, ronda 1 (T3)

DEF-001 a DEF-004 corregidos según la decisión del usuario ("Corrige DEF-001 a DEF-004 en esta rama y abre ticket para OBS-1"), con una prueba para cada uno y una comprobación de que la prueba falla al revertir la corrección. DEF-001 se verificó también en Chrome a 375, 768 y 1440 px. La suite queda en 626/626. El estado pasa a `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commits.

### QA (Q2, ronda 2)

Revalidación tras las correcciones de `senior-fullstack` (aprobadas por el usuario: "Apruebo la implementación").

- DEF-001 a DEF-004 corregidos y verificados (navegador, HTTP contra el servidor real y arranques reales).
- El ajuste de AUTO-6 refuerza la prueba.
- Regresión mínima en verde: `typecheck` y `lint` terminan con 0 y `npm test` da 626/626, con la matriz de autorización idéntica.
- OBS-1 queda en REQ-F-011.

El estado pasa a `QA_APPROVED`. Sin commits.
