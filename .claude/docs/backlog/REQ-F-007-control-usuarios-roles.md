# REQ-F-007 — Control de usuarios: autenticación y roles

## Estado

APPROVED

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

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Incorpora las respuestas 7.1 A a 7.5 A ("apruebo todo") y las propuestas P-1 a P-8 como D-6 a D-13. Aprobada por el usuario ("apruebo 007 y 008"; confirmación de versión: "a").
