# REQ-F-040 — Usuarios y cuenta propia en `/api/v1/admin` y en el admin nuevo (`inventory-manager`)

## Estado

DONE (2026-10-30). Los dos PR están mergeados en `epic/arquitectura`: #110 (PR 1, merge `0bfa50a`) y #111 (PR 2, merge `d5f5393`, 2026-10-30T01:21:04Z). Llegará a producción con el siguiente merge de la épica a `main`.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-29). Respuesta textual: "Si" a "¿Apruebas la versión 1 de REQ-F-040?".

Decisiones del usuario incorporadas (2026-10-29, citas textuales):

- Convivencia con el `/admin` actual: "Solo lectura (Recomendado)". Con `ADMIN_NEW_URL`, usuarios y "Mi cuenta" del `/admin` actual quedan en solo lectura, con un enlace al admin nuevo, como con productos (RF-19).
- Pantalla de auditoría: "Dejarla fuera (Recomendado)".
- Intentos de la contraseña actual en "Mi cuenta": "Paridad, sin límite (Recomendado)" (RF-10).

## Objetivo

Paso 4, ticket 2 de 6, del plan de migración (`restaurante/docs/arquitectura.md` §8).

- Que un **administrador** gestione los usuarios desde `https://admin.birriaelmuneco.com`: listar, crear, editar, desactivar, reactivar y restablecer contraseñas.
- Que **cualquier usuario** cambie su propia contraseña en "Mi cuenta".
- Todo con las mismas reglas que hoy aplica el `/admin` actual (REQ-F-007), a través de `api` (`/api/v1/admin`).
- Es un paso hacia la retirada del `/admin` actual (ticket 6).

Los PR van a `epic/arquitectura` (`.claude/rules/git.md`).

## Punto de partida (hechos del repositorio, 2026-10-29)

**Rutas del `/admin` actual (`landing-pages/src/routes/admin.ts`)**

- `GET|POST /admin/usuarios`, `GET /admin/usuarios/nuevo` y `GET|POST /admin/usuarios/:id`.
- `POST /admin/usuarios/:id/desactivar` y `…/reactivar`.
- `GET|POST /admin/usuarios/:id/contrasena`.
- `GET|POST /admin/cuenta`.

**Roles y permisos**

- Hay dos roles: `admin` ("Administrador") y `editor` ("Editor").
- Las pantallas de usuarios son solo para administradores: un editor recibe 403, también contra su propio id.
- "Mi cuenta" la puede usar cualquier usuario con sesión.

**Validación (`packages/core/identity/user-schema.ts`)**

- Usuario de acceso: 1-60 caracteres, sin caracteres de control. Se guarda recortado y en NFC, y es único sin distinguir mayúsculas.
- Nombre visible: 1-60 caracteres, sin caracteres de control.
- Negocios: se asignan solo al editor; el administrador tiene todos.
- Contraseña nueva: 12-256 caracteres (contados como caracteres, no bytes), escrita dos veces y con hash scrypt.
- Las contraseñas nunca se vuelven a pintar.
- Los formularios tienen una lista cerrada de campos: un campo desconocido responde 400.

**Reglas del repositorio (`packages/db/src/user-repository.ts`)**

- Las escrituras son transacciones serializables con reintento ante interbloqueo. Un error inesperado de la base da 503.
- **D-7:** si tras la escritura no queda ningún administrador activo, se revierte la transacción.
- Un usuario de acceso repetido es un error del campo.
- **D-8:** cambiar el rol o los negocios, desactivar o reactivar, y restablecer o cambiar la contraseña incrementan `sessionVersion`. Editar solo el usuario de acceso o el nombre visible no lo incrementa.
- **Auditoría en `user_audit`:** acciones `create`, `update`, `deactivate`, `reactivate`, `password_reset` y `password_change`, con el actor y los cambios, sin hashes ni contraseñas.
- No se eliminan usuarios.
- **Edición simultánea:** gana la última escritura.

**Sesiones entre los dos admins**

- `resolveSession` (`core/identity/session.ts`) compara en cada petición el `sessionVersion` de la base.
- Cada admin tiene su propio almacén de sesiones en memoria, pero un cambio hecho en uno invalida las sesiones del otro en su siguiente petición.
- La invalidación mutua ya existe; este ticket la mantiene y la prueba.

**Estado actual de `api` e `inventory-manager`**

- `api/src/admin` solo tiene sesión y productos.
- El contrato `AdminUser` no incluye el usuario de acceso, el estado ni el último acceso.
- `inventory-manager` no tiene pantallas de usuarios ni de cuenta.

**Modo de solo lectura de REQ-F-039**

- Se activa con `ADMIN_NEW_URL` en `landing-pages`, ya activa en producción.
- Hoy solo afecta a productos.

## Alcance

1. **`api`, con contratos en `packages/contracts` (Zod):**
   - usuarios (solo administradores): listar, ver uno, crear (con contraseña), editar (usuario de acceso, nombre visible, rol y negocios), desactivar, reactivar y restablecer la contraseña;
   - cuenta propia (cualquier usuario con sesión): cambiar la contraseña con la actual y recibir una sesión nueva para el navegador actual.
2. **`inventory-manager`:**
   - pantallas de lista, alta, edición, restablecer contraseña y "Mi cuenta";
   - navegación a "Usuarios" (solo administradores) y a "Mi cuenta" (todos);
   - todo sin JavaScript, con el JS solo como mejora.
3. **Convivencia:** usuarios y "Mi cuenta" del `/admin` actual en solo lectura con `ADMIN_NEW_URL` (RF-19).
4. **Documentación:**
   - `restaurante/docs/arquitectura.md` §8 ("Paso 4, ticket 2 aplicado");
   - la descripción de `inventory-manager` en `.claude/CLAUDE.md` §8, que hoy dice "el admin nuevo de productos";
   - los README de `api` e `inventory-manager` y `docs/desarrollo.md`, si cambian las rutas o la configuración.

## Fuera de alcance

- Una pantalla o un endpoint de consulta de la auditoría (decisión: "Dejarla fuera (Recomendado)"). La auditoría se sigue escribiendo igual que hoy.
- Eliminar usuarios.
- Cambiar las reglas de REQ-F-007: longitudes, roles, D-7, D-8 y la regla de "gana la última escritura".
- Un límite de intentos para la contraseña actual en "Mi cuenta" (decisión: "Paridad, sin límite (Recomendado)").
- El primer administrador (`ADMIN_USER`/`ADMIN_PASSWORD_HASH`) y la recuperación por consola (`scripts/admin-recover.ts`). Siguen en `landing-pages`; su traslado se decide en el ticket 6.
- Bot (tickets 3 y 4), menú (ticket 5) y retirada del `/admin` actual (ticket 6).
- Cambios de despliegue: no hay contenedores ni subdominios nuevos.
- Sesiones persistentes: siguen en memoria (REQ-F-039).

## Requisitos

### Permisos

- **RF-1. Solo administradores en usuarios.**
  - **API:** 401 sin sesión y 403 para un editor, sin datos y sin cambios. Vale también contra su propio id.
  - **Interfaz:** un editor no ve la entrada "Usuarios". Una URL directa muestra "sin permiso", sin datos.
- **RF-2. "Mi cuenta"** está disponible para cualquier usuario con sesión válida. Solo actúa sobre el usuario de la sesión: no acepta un id ni campos ajenos, como el rol o los negocios.

### Usuarios

- **RF-3. Lista.**
  - Muestra: usuario de acceso, nombre visible, rol, negocios ("Todos" para el administrador), estado (Activo o Desactivado) y último acceso en la zona horaria del negocio o "Nunca".
  - Orden: activos primero y después por usuario de acceso.
- **RF-4. Crear.**
  - Pide usuario de acceso, nombre visible, rol, negocios (solo editor) y la contraseña dos veces.
  - Aplica la validación de `user-schema`. Errores por campo: 422 con `fields`.
  - Un usuario de acceso repetido, sin distinguir mayúsculas, da error en ese campo.
  - Auditoría `create`, con el actor.
- **RF-5. Editar.**
  - Usuario de acceso, nombre visible, rol y negocios, con la misma validación.
  - Si cambian el rol o los negocios, se cierran las sesiones del usuario editado en los dos admins (D-8).
  - Auditoría `update` con los cambios. Si no cambia nada, no se audita.
- **RF-6. Desactivar y reactivar.**
  - Desactivar cierra sus sesiones en los dos admins, y el usuario no puede entrar en ninguno.
  - Reactivar le permite volver a entrar.
  - Repetir la acción sobre un usuario que ya está en ese estado no cambia nada.
  - Auditoría `deactivate` o `reactivate`.
- **RF-7. Restablecer la contraseña de un usuario** (incluido uno mismo).
  - La nueva se escribe dos veces y nunca se muestra ni se envía.
  - Cierra todas las sesiones de ese usuario.
  - Auditoría `password_reset`.
- **RF-8. Último administrador (D-7).**
  - Se rechaza, con un 409 y el mensaje actual, cualquier operación que deje sin administradores activos: desactivar al último o pasarlo a editor, también si lo intenta él mismo. No cambia nada.
  - Un administrador que no es el último sí puede desactivarse o degradarse a sí mismo, y su sesión se cierra (paridad con REQ-F-007).
  - Se respeta también con peticiones simultáneas, aunque vengan de los dos admins.
- **RF-9. Edición simultánea y errores.**
  - Gana la última escritura y cada una queda auditada.
  - Pedir un id inexistente o mal formado da 404.

### Cuenta propia

- **RF-10. Cambiar la propia contraseña.**
  - Pide la actual y dos veces la nueva.
  - Si la actual es incorrecta: error en ese campo y ningún cambio. Ese fallo no cuenta para el límite de intentos de acceso, y no se añade ningún límite propio ("Paridad, sin límite (Recomendado)").
  - Al confirmarse:
    - se cierran las demás sesiones del usuario, también las del otro admin;
    - el navegador actual sigue con una sesión nueva, y la cookie de `inventory-manager` se actualiza;
    - auditoría `password_change`.

### Sesión y seguridad (heredado de REQ-F-039)

- **RF-11.** Se aplican D-1 y D-2 de REQ-F-039: la sesión es de `api`, se comprueba el mismo origen y cada escritura lleva `X-CSRF-Token`, validado por `api`.
- **RF-12.** Las respuestas llevan `no-store` y `noindex`.
- **RF-13.** Ningún log, ninguna respuesta y ninguna entrada de auditoría contienen contraseñas, hashes, ids de sesión ni tokens CSRF.
- **RF-14.** El parámetro de retorno tras entrar acepta también las pantallas nuevas (GET), sin redirecciones abiertas.
- **RF-15. Errores en el admin.**
  - **422:** por campo, conservando lo escrito, salvo las contraseñas.
  - **409 del último administrador:** aviso claro y ningún cambio.
  - **503 o `api` caída:** aviso de servicio no disponible, que conserva lo escrito salvo las contraseñas. Sin trazas.
- **RF-16. Formato de error:** `{ error: { code, message } }`, como en REQ-F-039. Los códigos concretos los fija el plan técnico.

### Interfaz

- **RF-17.**
  - Sigue el sistema visual de P-4 de REQ-F-039.
  - Es responsive (375 px y escritorio) y está en español.
  - Cumple `.claude/rules/accesibilidad.md` y `formularios.md`: etiquetas, errores asociados a su campo y no solo por color, foco visible, uso completo con teclado, encabezados jerarquizados y `autocomplete` adecuado en las contraseñas.
  - Desactivar y reactivar son botones de formulario (POST), nunca enlaces.
- **RF-18.** `inventory-manager` sigue importando solo `contracts` y `web` (CA-17 de REQ-F-039).

### Convivencia

- **RF-19.** Con `ADMIN_NEW_URL` configurada en `landing-pages`:
  - las pantallas de usuarios (`/admin/usuarios`, `/nuevo`, `/:id` y `/:id/contrasena`) y "Mi cuenta" (`/admin/cuenta`) del `/admin` actual se muestran sin controles de escritura, con un aviso y un enlace a la pantalla equivalente del admin nuevo;
  - cualquier POST a esas rutas (crear, editar, desactivar, reactivar, restablecer y cambiar la propia contraseña) no cambia nada y muestra el mismo aviso. El código HTTP lo fija el plan técnico;
  - sin la variable, el `/admin` actual se comporta exactamente como hoy;
  - el bot y el menú del `/admin` actual no cambian, y la recuperación por consola y el primer administrador siguen funcionando.

## Historias de usuario

- **HU-1.** Como administrador, quiero dar de alta, editar, desactivar y reactivar cuentas y restablecer contraseñas desde el admin nuevo, para gestionar al personal sin el `/admin` anterior.
- **HU-2.** Como editor o administrador, quiero cambiar mi contraseña en "Mi cuenta", para mantener mi acceso seguro.
- **HU-3.** Como dueño, quiero que siempre quede al menos un administrador activo y que cada cambio quede auditado, para no perder el control ni la trazabilidad.
- **HU-4.** Como equipo, quiero que solo el admin nuevo escriba los usuarios, para evitar dos caminos para lo mismo.

## Criterios de aceptación

| CA | Given / When / Then |
| --- | --- |
| CA-1 | **Given** un editor con sesión, **When** pide cualquier ruta de usuarios en la interfaz o en la API (también con su propio id), **Then** recibe 403 sin datos y nada cambia en la base. Sin sesión, la API da 401 y la interfaz lleva al acceso. La entrada "Usuarios" no se muestra a un editor |
| CA-2 | **Given** un administrador, **When** abre "Usuarios", **Then** ve los campos y el orden de RF-3, y el último acceso se muestra en la zona horaria del negocio |
| CA-3 | **Given** datos válidos, **When** un administrador crea un usuario, con y sin JavaScript, **Then** el usuario puede entrar en los dos admins con esa contraseña y hay una entrada `create` con el actor y sin hash. Con datos inválidos: 422 por campo, lo escrito se conserva (sin las contraseñas) y no se crea nada. Un usuario de acceso repetido con otras mayúsculas da error en ese campo |
| CA-4 | **Given** un editor con sesiones abiertas en los dos admins, **When** un administrador le cambia los negocios o el rol en el admin nuevo, **Then** las dos sesiones dejan de valer en su siguiente petición. Cambiar solo el nombre visible no las cierra. Hay una entrada `update` con los cambios |
| CA-5 | **Given** un usuario con sesiones en los dos admins, **When** se le desactiva, **Then** las dos sesiones dejan de valer y no puede entrar en ninguno. Tras reactivarlo, puede entrar. Hay entradas `deactivate` y `reactivate` |
| CA-6 | **Given** un único administrador activo, **When** intenta desactivarse o pasarse a editor, **Then** recibe 409 con el aviso de D-7 y nada cambia. Con dos administradores, uno puede desactivarse a sí mismo y su sesión se cierra. Si dos administradores se desactivan entre sí a la vez (uno en cada admin, o dos peticiones a la API), queda al menos uno activo |
| CA-7 | **Given** un usuario con sesiones abiertas, **When** un administrador le restablece la contraseña, **Then** sus sesiones se cierran en los dos admins, la contraseña anterior deja de valer, la nueva funciona y hay una entrada `password_reset` |
| CA-8 | **Given** un usuario con sesiones en los dos admins, **When** cambia su contraseña en "Mi cuenta" del admin nuevo con la actual correcta, **Then** sigue con sesión en ese navegador (cookie nueva), las demás sesiones dejan de valer y hay una entrada `password_change`. Con la actual incorrecta: error en ese campo, nada cambia y el límite de intentos de acceso no se ve afectado. Añadir `role`, `businesses` o un id al formulario no cambia nada (400 o rechazo) |
| CA-9 | **Given** un POST de usuarios o de cuenta sin token CSRF, con el token de otra sesión o con un `Origin` ajeno, **Then** responde 403 y nada cambia |
| CA-10 | **Given** `api` caída o en 503, **When** se guarda un formulario de usuarios o de cuenta, **Then** se ve el aviso de servicio no disponible, el formulario conserva lo escrito salvo las contraseñas y la respuesta no tiene trazas |
| CA-11 | **Given** un id inexistente o mal formado, **Then** 404 sin datos. Tras guardar, el botón atrás no reenvía el formulario (POST/redirect/GET) |
| CA-12 | Ningún log, respuesta o entrada de auditoría contiene contraseñas, hashes, ids de sesión ni tokens CSRF. Las respuestas llevan `no-store` y `noindex` |
| CA-13 | Las pantallas nuevas pasan la revisión de accesibilidad (teclado, foco visible, etiquetas, errores asociados y no solo por color) y se usan sin desplazamiento horizontal a 375 px y en escritorio |
| CA-14 | **Given** `ADMIN_NEW_URL` configurada, **When** se usan usuarios o "Mi cuenta" del `/admin` actual, **Then** no hay controles de escritura y se ve el enlace a la pantalla equivalente del admin nuevo. Un POST a cualquiera de esas rutas, aunque tenga sesión y CSRF válidos, deja sin cambios la tabla de usuarios y `user_audit`. Bot y menú funcionan igual. Sin la variable, todo funciona como hoy |
| CA-15 | Tras entrar con `?next=` apuntando a una pantalla nueva válida, se vuelve a ella. Un destino externo se ignora |
| CA-16 | `inventory-manager` sigue importando solo `contracts` y `web` (lint y `dependency-rule.test.ts`) |
| CA-17 | `typecheck`, `lint` y `test` terminan con 0 en la raíz, y el CI (`calidad`, `docker` y `auditoria`) pasa en verde en el PR hacia `epic/arquitectura` |
| CA-18 | La documentación (`arquitectura.md` §8, `.claude/CLAUDE.md` §8 y los README afectados) refleja el ticket |

## Casos límite

- **Un administrador se degrada a sí mismo, sin ser el último.** Se guarda, su sesión se cierra y vuelve al acceso. Ya no ve "Usuarios".
- **Un administrador se restablece su propia contraseña desde "Usuarios"** en lugar de "Mi cuenta". Se cierran todas sus sesiones, también la actual (paridad).
- **Doble envío de "Crear usuario".** El segundo envío da error de usuario repetido: no se duplica.
- **Sesión caducada a mitad de un formulario.** Lleva al acceso. Las contraseñas escritas no se conservan.
- **Usuario desactivado desde un admin con sesión abierta en el otro.** Su sesión deja de valer en la siguiente petición.
- **Reinicio de `api`.** Se pierden las sesiones del admin nuevo (aceptado en REQ-F-039).
- **JavaScript deshabilitado y conexión lenta.** Todo funciona sin JS, sin doble envío y con indicación de envío en curso.
- **Contraseña con caracteres multibyte.** La longitud se cuenta en caracteres, no en bytes.

## Dependencias

- REQ-F-039 cerrado: sesión, CSRF, cliente del admin, sistema visual y `ADMIN_NEW_URL`.
- `core/identity` y `db/user-repository`: se reutilizan sin cambiar sus reglas.
- `packages/contracts`: contratos nuevos de usuarios y cuenta.

## Riesgos

- **R-1. Bloqueo accidental de administradores.** Mitigación: D-7 en transacción serializable y CA-6 con concurrencia entre los dos admins.
- **R-2. Escalada de privilegios por la API nueva:** un editor que intenta tocarse el rol o "Mi cuenta" con campos extra. Mitigación: listas cerradas de campos y CA-1 y CA-8.
- **R-3. Cambio de hábito del personal.** Quien entra al `/admin` actual por el bot o el menú tiene que cambiar su contraseña en el admin nuevo. Mitigación: el aviso y el enlace de RF-19.
- **R-4. Intentos repetidos de la contraseña actual en "Mi cuenta"** con una sesión robada. No se limitan: riesgo aceptado por el usuario ("Paridad, sin límite (Recomendado)").
- **R-5. Orden de llegada a producción.**
  - Situación: la épica está en producción desde el 2026-10-29 (PR #105) y `ADMIN_NEW_URL` ya está activa. Los PR de este ticket van a `epic/arquitectura`, y la solo lectura de usuarios y "Mi cuenta" llegará a producción junto con las pantallas nuevas en el siguiente merge de la épica a `main`.
  - Riesgo: si la solo lectura llegara a `main` sin las pantallas nuevas, nadie podría gestionar usuarios ni cambiar su contraseña por la web.
  - Mitigación: la solo lectura solo se mergea en `epic/arquitectura` junto con las pantallas del admin nuevo o después de ellas. Antes del merge a `main` se comprueba que ambas partes están presentes.

## Action Plan

### Objetivo

Usuarios y "Mi cuenta" operativos en el admin nuevo, con paridad total con REQ-F-007, y el `/admin` actual en solo lectura para estas funciones.

### Cambios requeridos

1. Contratos de usuarios y cuenta en `packages/contracts`: DTO de usuario, peticiones, respuestas y errores.
2. En `api`: endpoints de usuarios (solo administradores) y de cuenta propia.
   - Reutilizan `UserRepository`, la validación de `user-schema` y el hash de contraseñas.
   - Llevan sesión, CSRF y listas cerradas de campos.
   - Al cambiar la propia contraseña, responden con una sesión nueva.
3. En `inventory-manager`:
   - pantallas y navegación según el rol;
   - reescritura de la cookie tras el cambio de la propia contraseña;
   - retorno tras entrar a las pantallas nuevas;
   - manejo de 422, 409 y 503;
   - JS de mejora.
4. En `landing-pages`: solo lectura de usuarios y "Mi cuenta" con `ADMIN_NEW_URL` (RF-19), con aviso y enlace a la pantalla equivalente del admin nuevo.
5. Pruebas: matriz de autorización, D-7 con concurrencia entre los dos admins, invalidación mutua de sesiones, auditoría, CSRF, funcionamiento sin JS, accesibilidad y regresión del `/admin` actual.
6. Documentación.

### Reglas de negocio

Las de REQ-F-007, sin cambios: RF-1 a RF-10.

### UX/UI

- Sistema visual P-4 de REQ-F-039.
- Sin JS primero.
- Errores por campo.
- Las contraseñas nunca se vuelven a pintar.

### Integraciones

- `inventory-manager` ↔ `api`: sesión reenviada (D-1 y D-2).
- No hay aviso interno a las landings: los usuarios no afectan a su caché.

### Orden recomendado

1 → 2 → 3 → 4 → 5 → 6.

- El cambio 4 nunca se mergea antes que el 3 (R-5).
- El plan técnico decide si el ticket se divide en varios PR.

### Resultado esperado

El personal gestiona los usuarios y su contraseña desde `admin.birriaelmuneco.com`, con las mismas garantías que hoy, y el `/admin` actual deja de escribir usuarios y cuentas.

## Trazabilidad

| Objetivo | Requisitos | Historia | Criterios | Action Plan |
| --- | --- | --- | --- | --- |
| Permisos | RF-1, RF-2 | HU-1, HU-2 | CA-1, CA-8 | 2, 3 |
| Gestión de usuarios | RF-3 a RF-9 | HU-1, HU-3 | CA-2 a CA-7, CA-11 | 1, 2, 3 |
| Cuenta propia | RF-10 | HU-2 | CA-8 | 2, 3 |
| Seguridad y sesión | RF-11 a RF-16 | Todas | CA-9, CA-10, CA-12, CA-15 | 2, 3 |
| Interfaz | RF-17, RF-18 | HU-1, HU-2 | CA-13, CA-16 | 3 |
| Convivencia | RF-19 | HU-4 | CA-14 | 4 |
| Calidad y documentación | — | — | CA-17, CA-18 | 5, 6 |

## Revisión técnica

Fase T1, 2026-10-29. Revisé el ticket, `CLAUDE.md`, las reglas de `.claude/rules/`, `restaurante/docs/arquitectura.md` (§4 y §8) y el Technical Action Plan de REQ-F-039. Exploré el código con CodeGraph (`api/src/admin`, `packages/contracts`, `core/identity`, `db/user-repository`, `inventory-manager`, y los controladores y vistas de usuarios y cuenta de `landing-pages`). NotebookLM no estaba disponible como herramienta MCP en esta sesión: no lo consulté.

### Hallazgos sin decisión pendiente

- **Las reglas ya están donde hace falta.**
  - `UserRepository` (`core`) y su implementación Prisma (`db`) imponen D-7, D-8, la auditoría, `Serializable` con reintento y el 503. `validateUserData`, `validatePasswordPair`, `hashPassword` y `verifyPassword` están en `core/identity`.
  - `api` ya los importa (`session-routes.ts` y `access.ts`). No hace falta cambiar ninguna regla.
  - Solo se mueven a `core/identity/user-schema.ts` tres mensajes que hoy están en los controladores de `landing-pages`: el del último administrador, el del usuario repetido y el de la contraseña actual incorrecta. Así los dos admins dicen lo mismo sin duplicarlos.
- **La invalidación mutua ya funciona.** `resolveSession` compara `sessionVersion` en cada petición, en los dos admins. La API además libera de su almacén las sesiones del usuario afectado (`destroyUser`), igual que `closeSessions` en `landing-pages`.
- **Repetir desactivar o reactivar ya no cambia nada.** `setActive` devuelve el usuario sin escribir ni auditar si ya está en ese estado (RF-6).
- **`AdminUser` (sesión) no cambia.** La gestión usa un DTO nuevo, `ManagedUser`. Así no se toca el contrato de la sesión del que ya dependen productos y el doble de pruebas.
- **Límites en la interfaz.** `inventory-manager` no puede importar `core` (CA-16). `contracts` publica `USER_LIMITS` (60, 60, 12 y 256) solo para los textos de ayuda. La regla sigue solo en `core` (el 422 de la API manda). Una prueba de `api` comprueba que `USER_LIMITS` y los roles del contrato coinciden con los de `core`.
  - Los campos de contraseña no llevan `minlength` ni `maxlength`: el navegador cuenta unidades UTF-16, no caracteres (caso límite multibyte).
- **D-7 "uno en cada admin" (CA-6).** Con `ADMIN_NEW_URL`, el `/admin` actual no escribe usuarios: en producción solo escriben `api` y la recuperación por consola. La prueba "uno en cada admin" arranca `landing-pages` sin la variable, como en desarrollo. La prueba de dos peticiones a la API corre con la variable.
- **README.** `api/` e `inventory-manager/` no tienen README propio. La documentación de las apps está en `restaurante/README.md` (secciones "Admin nuevo" y la tabla de rutas de `/admin`). Se actualiza ese archivo.
- **`deploy/compose.prod.yaml`.** Su comentario de `ADMIN_NEW_URL` dice "edición de productos". No se toca: es parte de la suma de `deploy/`, que debe coincidir con la del VPS. El alcance real queda en `.env.example`, en `README.md` y en `docs/despliegue.md`.
- **Memoria.** No hay contenedores nuevos. El hash scrypt de la API (N = 2^15, unos 32 MiB por cálculo) ya existe en el login. La estimación de REQ-F-039 no cambia: 1394,3 MiB, el 35,6 % de 3915 MiB. La medición real de producción del 2026-10-29 (`docs/arquitectura.md` §10) es de 1232 de 3915 MiB usados en el host (31,5 %); este ticket no la cambia.

### P-1. División en PR (R-5)

- **A (recomendada): dos PR hacia `epic/arquitectura`.**
  - PR 1: `api` y `contracts`. En producción no cambia nada: la API es interna y nadie la llama para usuarios.
  - PR 2: pantallas de `inventory-manager`, solo lectura de `landing-pages`, prueba de extremo a extremo y documentación.
  - R-5 se cumple por construcción: la solo lectura llega en el mismo PR que las pantallas.
- **B: tres PR.** Igual que A, pero la solo lectura y la documentación van en un PR 3, que se mergea después del PR 2. Los PR quedan más pequeños, a cambio de un ciclo más de QA y CI.
- **Decisión requerida:** A o B.

### P-2. Pantallas de formulario del `/admin` actual en solo lectura (RF-19)

- **A (recomendada): paridad con productos.**
  - `/admin/usuarios` sigue en 200 con los datos y sin controles de escritura: sin "Nuevo usuario", "Editar", "Contraseña", "Desactivar" ni "Reactivar".
  - `/admin/usuarios/nuevo`, `/admin/usuarios/:id`, `/admin/usuarios/:id/contrasena` y `/admin/cuenta` responden 410 con el aviso y el enlace a la pantalla equivalente del admin nuevo. No muestran el formulario.
  - Cualquier POST a esas rutas sigue este orden: sesión → permiso → 410 con el mismo aviso. No lee el cuerpo ni escribe nada.
- **B: detalle de solo lectura.** `/admin/usuarios/:id` muestra los datos del usuario como texto. Es más código para una pantalla que la lista ya cubre.
- **Decisión requerida:** A o B.

El Technical Action Plan de abajo supone **P-1 A** y **P-2 A**. Si eliges otra opción, lo ajusto antes de implementar.

## Technical Action Plan

Aprobado por el usuario el 2026-10-29. Respuestas textuales: "Sí, apruebo el plan"; P-1: "Dos PR (Recomendado)"; P-2: "Como productos (Recomendado)".

### Objetivo técnico

- `api` expone la gestión de usuarios (solo administradores) y el cambio de la propia contraseña en `/api/v1/admin`.
  - Usa las reglas actuales de `core/identity` y `db/user-repository`, con la sesión y el CSRF de D-1 y D-2.
  - Al cambiar la propia contraseña, devuelve una sesión nueva.
- `inventory-manager` añade las pantallas de usuarios y "Mi cuenta":
  - sin JavaScript y con POST/redirect/GET;
  - reescribe su cookie con esa sesión nueva.
- Con `ADMIN_NEW_URL`, el `/admin` actual deja de escribir usuarios y cuentas.

### División en PR (P-1 A)

| PR | Rama | Alcance | CA principales |
| --- | --- | --- | --- |
| 1 | `feature/REQ-F-040-admin-usuarios-1-api` | Contratos, endpoints de `api`, mensajes compartidos en `core` y pruebas de la API (en proceso y con MySQL real por proceso) | CA-1, CA-3 a CA-9, CA-11 y CA-12 en la API, CA-17 |
| 2 | `feature/REQ-F-040-admin-usuarios-2-inventory` | Pantallas y navegación de `inventory-manager`, solo lectura en `landing-pages`, prueba de extremo a extremo de los tres procesos y documentación | CA-1 a CA-18 en la interfaz, CA-14, CA-15, CA-16 y CA-18 |

Cada PR tiene su propia aprobación de implementación, su QA y su CI en verde, y se abre en borrador (`.claude/rules/git.md`). El ticket sigue en `in-progress/` hasta que se mergee el PR 2.

### Archivos o componentes afectados

**`packages/contracts`**
- `admin.ts`:
  - `managedUserSchema`;
  - las respuestas `userResponseSchema`, `userListResponseSchema`, `userWriteResponseSchema` y `passwordChangeResponseSchema` (igual que `loginResponseSchema`);
  - los tipos de las peticiones;
  - `USER_LIMITS`, `adminPaths.users`, `.user(id)`, `.userStatus(id, accion)`, `.userPassword(id)` y `.accountPassword`;
  - el error `lastAdminErrorSchema` (`LAST_ADMIN`).
- `admin-client.ts`: `listUsers`, `getUser`, `createUser`, `updateUser`, `setUserActive`, `resetUserPassword` y `changeOwnPassword`.

**`packages/core/identity`**
- `user-schema.ts` recibe tres constantes de mensajes: `LAST_ADMIN_MESSAGE`, `USERNAME_TAKEN_MESSAGE` y `WRONG_CURRENT_PASSWORD_MESSAGE`.
- `index.ts` las exporta.
- No cambia ninguna regla.

**`api/src/admin`**
- `user-routes.ts` (nuevo): usuarios.
- `account-routes.ts` (nuevo): cuenta propia.
- `access.ts`: `adminOnly(ctx, { write })`, que comprueba sesión (401), rol (403) y, en escrituras, CSRF (403).
- `router.ts` e `index.ts`: composición. `createAdminRoutes` pasa `hashParams` también a las rutas nuevas.

**`landing-pages`**
- `controllers/admin-users.ts` y `admin-account.ts`:
  - usan los mensajes de `core`;
  - con `config.adminNewUrl`, se sustituyen las acciones de escritura (P-2 A), con el mismo patrón que `admin-products.ts`.
- `views/admin/users.ts` y sus `.html`:
  - lista sin controles con `movedTo`;
  - `renderUsersMoved` (410) y su parcial de aviso con enlace.
- `.env.example`: comentario de `ADMIN_NEW_URL`.

**`inventory-manager`**
- `controllers/common.ts` (nuevo):
  - se extraen sin cambios de comportamiento `send`, `seeOther`, `toLogin`, `session`, `unavailable`, `failureReason`, `isUnavailable`, `notFound` y `idOf`, que hoy están en `controllers/admin.ts`;
  - las pruebas actuales de productos cubren la extracción.
- `controllers/users.ts` y `controllers/account.ts` (nuevos).
- `routes.ts`.
- `session.ts`: patrones de `next`.
- `views/index.ts`: navegación y vistas nuevas.
- Plantillas nuevas: `pages/users.html`, `user-form.html`, `user-password.html` y `account.html`, y parciales `user-row.html` y `status-form.html`.
- `partials/header.html`: navegación "Usuarios" (solo administradores) y "Mi cuenta".

**Pruebas y documentación:** ver las secciones correspondientes.

### Cambios requeridos

#### 1. Endpoints de `/api/v1/admin`

| Método y ruta | Uso | Respuestas |
| --- | --- | --- |
| `GET /usuarios` | Listar (activos primero y después por usuario de acceso; orden del repositorio) | 200 `{ users }`, 401, 403 |
| `POST /usuarios` | Crear `{ username, displayName, role, businesses, password, passwordConfirmation }` | 201 `{ user }`, 401, 403, 413/415/400, 422 |
| `GET /usuarios/:id` | Ver | 200 `{ user }`, 401, 403, 404 |
| `PUT /usuarios/:id` | Editar `{ username, displayName, role, businesses }` | 200 `{ user, meta }`, 401, 403, 404, 422, 409 |
| `POST /usuarios/:id/desactivar` | Desactivar (cuerpo `{}`) | 200 `{ user, meta }`, 401, 403, 404, 409 |
| `POST /usuarios/:id/reactivar` | Reactivar (cuerpo `{}`) | 200 `{ user, meta }`, 401, 403, 404 |
| `PUT /usuarios/:id/contrasena` | Restablecer `{ password, passwordConfirmation }` | 200 `{ user, meta }`, 401, 403, 404, 422 |
| `POST /cuenta/contrasena` | Cambiar la propia `{ currentPassword, password, passwordConfirmation }` | 200 `{ session: { id, csrfToken }, user }`, 401, 403, 422 |

**Orden de las comprobaciones (el de D-19):**
- Usuarios: sesión (401 `UNAUTHENTICATED`) → rol administrador (403 `FORBIDDEN_ROLE`, "No tienes permiso para gestionar usuarios.") → en escrituras, CSRF (403 `CSRF_INVALID`) → id con `^[1-9]\d{0,9}$` y existente (404 `USER_NOT_FOUND`) → cuerpo (413/415/400) → validación (422) → dominio (409).
  - Un editor recibe 403 antes de mirar el id: también con su propio id o con uno mal formado (CA-1).
- Cuenta: sesión (401) → CSRF (403) → cuerpo → validación (422).
  - No acepta id: el usuario es siempre el de la sesión (RF-2).

**Cuerpo:**
- JSON con `readJsonBody`: 16 KiB para los formularios y 4 KiB para desactivar y reactivar.
- Es una lista cerrada, como `closedBody` de productos: un campo desconocido (`role` o `id` en la cuenta, por ejemplo) responde 422 `VALIDATION_FAILED` con `fields[campo] = "Campo desconocido."` y no cambia nada (CA-8 y R-2).
- Un valor que no es texto cuenta como vacío y da el error de `core`.
- `businesses` debe ser un array de negocios conocidos. Un negocio desconocido da 422 en `businesses`.

**Validación y escritura:**
- La hacen `validateUserData` y `validatePasswordPair` de `core`, `hashPassword` con `hashParams`, y el repositorio.
- `UsernameTakenError` → 422 en `username`.
- `LastAdminError` → 409 `LAST_ADMIN`, con el mensaje actual ("Debe quedar al menos un administrador activo: no se guardó nada. Crea o reactiva otro administrador antes.").
- `UserNotFoundError` → 404.
- `DatabaseUnavailableError` → 503 (manejador central).

**Efecto en las sesiones (D-8):**
- Si `after.sessionVersion !== before.sessionVersion`, `sessions.destroyUser(id)`.
- `meta.ownSessionClosed` es `true` si el usuario afectado es el de la sesión y su versión cambió: degradarse, desactivarse o restablecerse la propia contraseña desde "Usuarios".

**Cuenta propia (RF-10):**
- `findPasswordHash` y `verifyPassword`. Si falla, 422 en `currentPassword` y se registra `admin_password_change_rejected`, sin tocar el límite de intentos.
- Si no, `setPassword(..., 'password_change')`, `sessions.destroyUser(user.id)` (todas, incluida la actual) y `sessions.create(...)` con la versión nueva.
- La respuesta lleva el id y el token CSRF nuevos. El Bearer anterior deja de valer al instante.

**`ManagedUser`:**
- Campos: `{ id, username, displayName, role, businesses, active, lastLoginAt, createdAt, updatedAt }`.
  - `businesses` son los negocios asignados: `[]` para el administrador, que la interfaz muestra como "Todos".
  - Las fechas van en ISO con la zona del negocio (`toZonedIsoString`, como en productos), y `lastLoginAt` es `null` si nunca entró.
- Nunca incluye `sessionVersion`, hashes ni contraseñas.
- Toda respuesta se valida con el contrato antes de enviarse, como `send` en productos.

**Logs:** `admin_user_created`, `admin_user_updated`, `admin_user_deactivated`, `admin_user_reactivated`, `admin_user_password_reset` y `admin_password_changed`, con `userId` y `by`. Nunca cuerpos, contraseñas, hashes, ids de sesión ni tokens (RF-13).

#### 2. Sesión nueva tras cambiar la propia contraseña (`inventory-manager`)

- `POST /cuenta` sigue este orden: mismo origen (403) → lista cerrada del formulario (`_csrf`, `currentPassword`, `password`, `passwordConfirmation`; otro campo da 400, como DEF-004) → sesión → `api.changeOwnPassword`.
- Con 200:
  - `writeSessionId(ctx, isProduction, data.session.id)` reemplaza la cookie (`overwrite: true`, mismos atributos, mismo nombre `__Host-admin_sid`);
  - responde 303 a `/cuenta?ok=password_change`;
  - el GET siguiente pide `GET /sesion` con el id nuevo y obtiene su token CSRF.
- Con 422: se vuelve a pintar con los errores y sin las contraseñas.
- Con 401: se borra la cookie y se va al acceso con `expirada=1`.
- Con 503 o `api` caída: aviso de servicio no disponible.
  - Si `api` llegó a confirmar el cambio pero la respuesta se perdió, el id anterior ya no vale: la siguiente petición lleva al acceso. Es un riesgo aceptable y queda documentado.

#### 3. Cierre de sesiones entre los dos admins

- No hay mecanismo nuevo. Cada escritura que sube `sessionVersion` en la base invalida las sesiones de los dos admins en su siguiente petición: `resolveSession` en `api` y el guard en `landing-pages`.
- `api` libera además las de su almacén.
- **Tras `meta.ownSessionClosed`**, `inventory-manager`:
  - borra su cookie;
  - responde 303 a `/acceso?ok=sesion_cerrada`, con el aviso "Tu sesión se cerró porque cambiaste tu propio rol, estado o contraseña. Entra de nuevo.";
  - así un administrador que se degrada no termina en un 403 de "Usuarios" (caso límite).

#### 4. Pantallas de `inventory-manager`

**Rutas:**

| Ruta | Pantalla |
| --- | --- |
| `GET /usuarios` | Lista. En móvil se apila en tarjetas y desde `md` es una tabla. Columnas: usuario, nombre, rol, negocios ("Todos"), estado (texto "Activo" o "Desactivado") y último acceso (`displayDate` o "Nunca"). Cada fila tiene "Editar", "Contraseña" y un botón POST "Desactivar" o "Reactivar" |
| `GET /usuarios/nuevo`, `POST /usuarios` | Alta |
| `GET /usuarios/:id/editar`, `POST /usuarios/:id` | Edición. Muestra el estado y el botón de desactivar o reactivar |
| `POST /usuarios/:id/desactivar`, `POST /usuarios/:id/reactivar` | Cambio de estado |
| `GET /usuarios/:id/contrasena`, `POST` (misma ruta) | Restablecer la contraseña |
| `GET /cuenta`, `POST /cuenta` | "Mi cuenta": nombre y rol de la sesión, y el formulario de cambio |

**Permisos y errores:**
- Un editor en `/usuarios*` recibe 403 "Sin permiso", sin datos y sin llamar a los endpoints de usuarios. La navegación solo muestra "Usuarios" si `user.role === 'admin'` (RF-1).
- **PRG:** 303 a `/usuarios?ok=<created|updated|deactivated|reactivated|password_reset>` o a `/cuenta?ok=password_change`, con lista cerrada de claves (CA-11).
- **422:** se vuelve a pintar con lo escrito, salvo las contraseñas. Cada error va junto a su campo y en el resumen con enlaces (`aria-describedby` y `aria-invalid`).
- **409 `LAST_ADMIN`:** aviso urgente (`role="alert"`, con el foco) con el texto de la API. Lo escrito se conserva y no cambia nada.
- **503 o `api` caída:** 503 con "Servicio no disponible", conservando lo escrito salvo las contraseñas. Usa el mismo mecanismo `preserve` de productos, también cuando falla la comprobación de la sesión (CA-10).
- **401:** al acceso con `next` (GET) o `expirada=1` (POST).
- **403 CSRF:** "Petición no válida". **404:** "No encontrado".

**Formularios y JS:**
- Lista cerrada de campos (400 si sobra uno), como el `/admin` actual (DEF-004). Los negocios son casillas `business-molotes` y `business-birria`, y solo se envían al editor; con rol administrador se ignoran (validación de `core`).
- `autocomplete`: `username` en el usuario de acceso, `new-password` en la contraseña nueva y su confirmación, y `current-password` en la actual. Los campos de contraseña nunca llevan `value`.
- El texto de ayuda sale de `USER_LIMITS` ("Al menos 12 caracteres").
- El JS de mejora reutiliza `submit-guard.js` (doble envío y "Guardando…"). No hace falta JS nuevo.

**Retorno tras entrar (RF-14):** se añaden a `RETURN_PATTERNS` `/usuarios`, `/usuarios/nuevo`, `/usuarios/[1-9]\d{0,9}/(editar|contrasena)` y `/cuenta`. Cualquier otro destino vuelve a `/`.

**BEM:** bloques `user-list`, `user-row` y `account-panel`. Reutiliza `field`, `notice`, `button` y `admin-header` y los tokens de P-4 de REQ-F-039.

#### 5. Solo lectura en el `/admin` actual (RF-19, P-2 A)

- Con `config.adminNewUrl`:
  - **`GET /admin/usuarios`** (solo administradores; el editor sigue con 403): la lista con los mismos datos y sin controles de escritura, con el aviso "Los usuarios y "Mi cuenta" ahora se gestionan en el admin nuevo." y un enlace a `${ADMIN_NEW_URL}/usuarios`.
  - **Pantallas de formulario:** `GET /admin/usuarios/nuevo`, `GET /admin/usuarios/:id` y `GET /admin/usuarios/:id/contrasena` comprueban sesión (303 al acceso) → permiso de administrador (403) → id con el patrón (404) → 410 con el aviso y el enlace a la pantalla equivalente: `/usuarios/nuevo`, `/usuarios/:id/editar` o `/usuarios/:id/contrasena`. No leen la base.
  - **"Mi cuenta":** `GET /admin/cuenta` comprueba sesión → 410 con el aviso y el enlace a `${ADMIN_NEW_URL}/cuenta`.
  - **POST:** cualquier POST a `/admin/usuarios`, `/admin/usuarios/:id`, `…/desactivar`, `…/reactivar`, `…/contrasena` o `/admin/cuenta` comprueba sesión → permiso → 410 con el mismo aviso. No lee el cuerpo ni escribe, y registra `admin_users_moved` (ruta, método y `userId`).
  - Se elige 410, igual que en productos: el cambio es permanente y no depende de la autorización.
- Sin la variable, el `/admin` actual funciona como hoy: lo cubren sus pruebas actuales, sin cambios.
- El bot, el menú, los productos (ya en solo lectura), `npm run admin:recover` y el primer administrador no cambian.

### Frontend

- Mobile-first: a 375 px, las filas de usuario se apilan con los datos y las acciones en columna. No hay desplazamiento horizontal (CA-13).
- Un `h1` por página y `h2` por bloque. Hay enlace para saltar al contenido, foco visible (contorno `#eab308` de 2 px) y todo se usa con teclado.
- El estado y el rol se muestran con texto, nunca solo con color. "Desactivar" es un `<button>` dentro de un `<form method="post">`.
- `_stich_source_/` no tiene diseño del admin: se aplica el sistema P-4 ya validado en REQ-F-039.

### Backend

- `api` añade unos 8 manejadores con la misma estructura que `product-routes.ts`: funciones de propiedad, `ApiHttpError` y respuestas validadas.
- No hay dependencias nuevas.
- `landing-pages` solo cambia el modo de solo lectura y la procedencia de tres mensajes.

### Contenido / configuración

- No hay variables nuevas. `ADMIN_NEW_URL` amplía su efecto a usuarios y "Mi cuenta".
- Se documenta en `landing-pages/.env.example`, `README.md` y `docs/despliegue.md`.
- `deploy/compose.prod.yaml` no se toca (suma de `deploy/`).

### Validaciones

- En la API:
  - listas cerradas de campos;
  - tipos;
  - `validateUserData` y `validatePasswordPair` de `core`: longitudes en caracteres, NFC, sin caracteres de control, negocios solo para el editor y confirmación;
  - id con patrón.
- En `inventory-manager`: mismo origen, lista cerrada del formulario y `_csrf` reenviado como `X-CSRF-Token`.
- No hay validación paralela de reglas: el 422 de la API es la fuente de verdad.

### Manejo de errores

- El formato es `{ error: { code, message } }`, con `fields` en el 422.
- Códigos nuevos: `FORBIDDEN_ROLE` (403), `USER_NOT_FOUND` (404) y `LAST_ADMIN` (409).
- Códigos que ya existen: `UNAUTHENTICATED`, `CSRF_INVALID`, `VALIDATION_FAILED` y `DATABASE_UNAVAILABLE`.
- Sin trazas: el manejador central de `api` y el de `inventory-manager` no cambian.

### Testing

Todas las pruebas con procesos usan `freePorts(n)` para reservar a la vez los puertos y esperan las líneas de log con `expect.poll` (#109). Las de base de datos usan `makeDatabase()` o `setupAdmin()`.

**PR 1, `api` en proceso (`api/tests/integration/admin-users-api.test.ts`)**
- **Base:** doble de `UserRepository` ampliado en `api/tests/support/admin.ts`, con `create`, `update`, `setActive` y `setPassword` mínimos. Las reglas reales se prueban con MySQL (abajo).
- **Matriz de autorización** de las 8 rutas:
  - sin sesión: 401;
  - editor: 403, con su propio id y con un id mal formado;
  - administrador sin CSRF, con el token de otra sesión o con uno mal formado: 403;
  - el doble no registra ninguna escritura.
- **Cuerpo:**
  - campo desconocido: 422 con "Campo desconocido.";
  - `role`, `businesses` o `id` en `/cuenta/contrasena`: 422 y nada cambia;
  - JSON inválido: 400;
  - sin `application/json`: 415;
  - más de 16 KiB: 413.
- **Ids:** id inexistente o mal formado (`0`, `abc`, `1e3`, 11 dígitos): 404.
- **Respuestas:**
  - cumplen el contrato y no contienen `sessionVersion`, `passwordHash` ni la contraseña enviada;
  - llevan `no-store`;
  - los logs capturados no contienen contraseñas, hashes, ids de sesión ni tokens (CA-12).
- **Cuenta:**
  - con la actual incorrecta: 422 en `currentPassword`;
  - 6 intentos fallidos seguidos no bloquean el login (el límite está intacto);
  - con la correcta: 200 con un id y un token nuevos, el Bearer anterior da 401 y el nuevo da 200.
- **`meta.ownSessionClosed`:** `true` al degradarse o restablecerse la propia contraseña; `false` al editar a otro.
- **Unidad (`contract-types.test.ts`):** `USER_LIMITS` y los roles del contrato coinciden con los de `core`.

**PR 1, MySQL real con el proceso de `api` (`landing-pages/tests/integration/users-api-process.test.ts`)**
- **Reglas reales:**
  - CRUD completo con las entradas de `user_audit` (`create`, `update` con los cambios, sin entrada si no cambia nada, `deactivate`, `reactivate`, `password_reset` y `password_change`), con el actor y sin hashes ni contraseñas en `changes`;
  - usuario repetido con otras mayúsculas: 422 en `username`;
  - doble envío del alta: el segundo da 422 y queda una sola fila;
  - contraseña multibyte de 12 caracteres y más de 12 bytes: se acepta. Con 11 caracteres, 422.
- **D-8 entre los dos admins** (`landing-pages` en proceso con `setupAdmin()` sin `ADMIN_NEW_URL`, y `api` como proceso, sobre la misma base):
  - un editor tiene sesión en los dos;
  - cambiarle los negocios desde la API invalida las dos sesiones (303 en `/admin` y 401 en la API);
  - cambiarle solo el nombre visible no invalida ninguna;
  - lo mismo al desactivarlo y al restablecerle la contraseña;
  - al reactivarlo puede entrar en los dos (CA-4, CA-5 y CA-7);
  - en sentido inverso: un cambio hecho desde el `/admin` actual (sin la variable) invalida la sesión de la API.
- **D-7 con concurrencia (CA-6):**
  - **dos peticiones a la API:** dos administradores, A y B, se desactivan entre sí a la vez (`Promise.all`), 10 repeticiones. Siempre queda exactamente un administrador activo y la otra petición recibe 409 `LAST_ADMIN`, o 200 si fue la primera;
  - **uno en cada admin:** A desactiva a B desde la API mientras B desactiva a A desde el `/admin` actual sin `ADMIN_NEW_URL`, 10 repeticiones. Siempre queda al menos uno activo.
  - El repositorio ya tiene 50 repeticiones por caso en `last-admin-concurrency.test.ts`. Aquí se prueba el camino HTTP.
- **Último administrador:** con uno solo, desactivarse o pasarse a editor da 409 y no cambia la base ni `user_audit`. Con dos, uno se desactiva a sí mismo: 200 con `ownSessionClosed` y su Bearer da 401.
- **Base caída** (proxy TCP cortado, como en `api-process.test.ts`): 503 `DATABASE_UNAVAILABLE` sin trazas.
- **Último acceso:** tras entrar, `lastLoginAt` lleva la zona del negocio.

**PR 2, `inventory-manager` en proceso (`inventory-manager/tests/integration/users.test.ts` y `account.test.ts`)**
- **Base:** doble de la API (`tests/support/api-double.ts`) ampliado con usuarios y cuenta: sesión, CSRF, rol, 422, 409 `LAST_ADMIN`, `ownSessionClosed`, sesión nueva y modo `down`.
- **Permisos:** un editor no ve "Usuarios" y recibe 403 sin datos en cada `/usuarios*`, sin llamar al doble. Sin sesión, al acceso.
- **Lista (CA-2):** campos, "Todos", "Nunca", fecha en la zona del negocio y orden recibido.
- **Alta y edición (CA-3):** sin JS, con PRG (303) y el aviso `?ok`. Con 422, lo escrito se conserva sin contraseñas y los errores van asociados a su campo. Con 409, aviso urgente. Campo desconocido: 400.
- **Mi cuenta (CA-8):** con 200 cambia el `Set-Cookie` (mismo nombre y atributos, valor nuevo) y la página siguiente usa la sesión nueva. Con la actual incorrecta, error en el campo.
- **`ownSessionClosed`:** cookie borrada y 303 a `/acceso?ok=sesion_cerrada`.
- **Seguridad (CA-9):** `Origin` ajeno o `Sec-Fetch-Site` distinto: 403 sin llamar al doble. Sin `_csrf`: 403 de la API, mostrado como "Petición no válida".
- **API caída (CA-10):** 503 con lo escrito conservado, sin contraseñas y sin trazas, también si la caída ocurre al comprobar la sesión.
- **Retorno (CA-15):** `next` vale para cada patrón nuevo. `//evil`, `https://…` y `/usuarios/abc/editar` vuelven a `/`.
- **Cabeceras (CA-12):** `no-store` y `noindex` en todas las pantallas nuevas.
- **Accesibilidad (CA-13), con jsdom:** un `h1`, etiquetas con su `for`, `autocomplete`, sin `value` en las contraseñas, `aria-describedby` y `aria-invalid` en los errores, y desactivar como `<button>` dentro de un `<form method="post">`.

**PR 2, solo lectura en `landing-pages` (`landing-pages/tests/integration/admin-users-moved.test.ts`)**
- Con `ADMIN_NEW_URL`:
  - la lista no tiene controles de escritura y sí el enlace;
  - las 4 pantallas de formulario dan 410 con el enlace equivalente;
  - los 7 POST, con sesión y CSRF válidos, dan 410 y dejan sin cambios la tabla `user` y `user_audit` (recuento y contenido antes y después);
  - un editor sigue con 403 en usuarios;
  - el bot, el menú y `npm run admin:recover` funcionan (CA-14).
- Sin la variable, las pruebas actuales (`admin-users.test.ts`, `admin-account.test.ts` y la matriz de autorización) pasan sin cambios.

**PR 2, de extremo a extremo (`landing-pages/tests/integration/admin-users-e2e.test.ts`)**
- **Montaje:** los tres procesos y MySQL, con `freePorts(2)` como en `admin-e2e.test.ts`, y `landing-pages` con `ADMIN_NEW_URL`.
- **Recorrido:** un administrador crea en `inventory-manager` (formularios reales, sin JS) a un editor, que entra en los dos admins. Después:
  - le cambia los negocios y las dos sesiones caen;
  - lo desactiva y no puede entrar en ninguno;
  - lo reactiva y vuelve a entrar;
  - le restablece la contraseña y la anterior deja de valer;
  - el editor cambia su contraseña en "Mi cuenta" del admin nuevo y sigue con sesión, mientras su sesión del `/admin` actual cae.
- **Comprobaciones:**
  - `user_audit` tiene la secuencia esperada;
  - con `expect.poll` sobre los logs de los tres procesos: ninguno contiene las contraseñas usadas, hashes `scrypt$`, ids de sesión ni tokens CSRF (CA-12).
- Es un único escenario por archivo para limitar el tiempo en CI (`--maxWorkers=4`).

**Regresión y lint:** `dependency-rule.test.ts` y el lint siguen pasando (CA-16). `typecheck`, `lint` y `test` desde la raíz (CA-17).

### Seguridad

- **Sesión y CSRF:** se mantienen D-1 y D-2. El mismo origen se comprueba en `inventory-manager` y el CSRF en `api`. Los tokens se comparan en tiempo constante.
- **Escalada de privilegios:** el rol se comprueba en la API en cada petición con el usuario leído de la base. "Mi cuenta" no admite id ni campos ajenos (R-2).
- **Contraseñas:** nunca se registran, se devuelven, se repintan ni se auditan. Los hashes nunca salen del repositorio salvo `findPasswordHash` para verificar.
- **Sesión nueva tras el cambio de contraseña:** el id nuevo viaja de `api` a `inventory-manager` por la red interna, igual que en el login, y solo llega al navegador en una cookie `HttpOnly`, `SameSite=Strict` y `__Host-`.
- **Retorno tras entrar:** `next` es una lista de patrones, sin redirecciones abiertas.
- **R-4 (aceptado):** el cambio de la propia contraseña no tiene límite de intentos.

### Performance

- Cada pantalla hace una llamada a `GET /sesion` y otra a usuarios. La lista es pequeña (decenas): no hace falta paginación ni caché.
- scrypt solo en altas, restablecimientos y cambios: entre 50 y 100 ms cada uno y unos 32 MiB, igual que el login actual.
- No hay JS nuevo.

### Riesgos técnicos

- **R-5:** con P-1 A, la solo lectura y las pantallas van en el mismo PR. Antes del merge de la épica a `main` se comprueba que el PR 2 está mergeado en `epic/arquitectura`.
- **Respuesta perdida tras cambiar la contraseña:** el usuario vuelve al acceso con la contraseña nueva ya válida (documentado).
- **Duración de las pruebas con procesos en el CI:** un escenario por archivo, 10 repeticiones en la concurrencia HTTP y puertos con `freePorts`.
- **Extracción de `controllers/common.ts`:** es un refactor sin cambio de comportamiento. Lo cubren las pruebas de productos de `inventory-manager`, que no cambian.

### Documentación

- **`restaurante/docs/arquitectura.md` §8:**
  - "Paso 4, ticket 2 aplicado (REQ-F-040)", con los endpoints, la sesión nueva tras cambiar la contraseña y la solo lectura ampliada;
  - marcar el ticket 2 en la tabla del plan del paso 4.
- **`.claude/CLAUDE.md` §8:** `inventory-manager` pasa a ser "el admin nuevo (productos, usuarios y cuenta propia)", y `api`, "productos públicos y la administración de productos y usuarios".
- **`restaurante/README.md`:** la sección "Admin nuevo" (rutas nuevas y convivencia) y la tabla de rutas de `/admin` (usuarios y cuenta en solo lectura con `ADMIN_NEW_URL`).
- **`docs/despliegue.md`:** el efecto ampliado de `ADMIN_NEW_URL` y el aviso al personal (R-3).
- **`landing-pages/.env.example`:** el comentario de `ADMIN_NEW_URL`.
- `docs/desarrollo.md` solo cambia si cambian los pasos de desarrollo: no se prevé.

### Orden de implementación

1. **PR 1:**
   1. Mensajes en `core`.
   2. Contratos y cliente.
   3. `access.adminOnly`.
   4. `user-routes.ts` y `account-routes.ts`, con su router.
   5. Pruebas en proceso.
   6. Pruebas con MySQL por proceso (D-7 y D-8).
   7. Validación.
2. **PR 2:**
   1. `controllers/common.ts` (extracción).
   2. Patrones de `next` y navegación.
   3. Pantallas de usuarios.
   4. "Mi cuenta" y cookie.
   5. Doble de la API y pruebas.
   6. Solo lectura en `landing-pages` y sus pruebas.
   7. Prueba de extremo a extremo.
   8. `npm run build:css`.
   9. Documentación.
   10. Validación.

### Criterios de finalización

- CA-1 a CA-18 comprobados con las pruebas de la matriz anterior.
- `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` terminan con 0 desde `restaurante/`.
- El CI (`calidad`, `docker` y `auditoria`) queda en verde en cada PR hacia `epic/arquitectura`.
- `git diff` sin cambios ajenos.
- Ninguna regla de REQ-F-007 cambió: las pruebas del repositorio (`user-repository.test.ts` y `last-admin-concurrency.test.ts`) no se modifican.
- `deploy/` no cambia.

## Implementation Result

### PR 1 de 2: `api` y contratos (2026-10-29)

#### Rama

`feature/REQ-F-040-admin-usuarios-1-api`, creada desde `origin/epic/arquitectura` (`9354724`), sin upstream. No hay commit ni PR todavía.

#### Cambios realizados

- **`packages/core/identity/user-schema.ts`:** tres mensajes compartidos, `LAST_ADMIN_MESSAGE`, `USERNAME_TAKEN_MESSAGE` y `WRONG_CURRENT_PASSWORD_MESSAGE`, con el mismo texto de antes. Los usan `landing-pages/src/controllers/admin-users.ts` y `admin-account.ts`. Ninguna regla cambió.
- **`packages/contracts/admin.ts`:**
  - `adminPaths.users`, `.user(id)`, `.userStatus(id, accion)`, `.userPassword(id)` y `.accountPassword`;
  - `USER_ROLES` y `USER_LIMITS` (solo para los textos de ayuda);
  - `managedUserSchema` (sin `sessionVersion` ni hashes);
  - las respuestas `userListResponseSchema`, `userResponseSchema`, `userWriteResponseSchema` (con `meta.ownSessionClosed`) y `passwordChangeResponseSchema` (igual que la del login);
  - los tipos de las peticiones;
  - `lastAdminErrorSchema` (`LAST_ADMIN`).
- **`packages/contracts/admin-client.ts`:** `listUsers`, `getUser`, `createUser`, `updateUser`, `setUserActive`, `resetUserPassword` y `changeOwnPassword`.
- **`api/src/admin/access.ts`:** `adminOnly`, que comprueba sesión (401), rol administrador (403 `FORBIDDEN_ROLE`, antes de mirar el id) y, en escrituras, CSRF (403).
- **`api/src/admin/user-routes.ts` (nuevo):** las 7 rutas de usuarios.
  - Orden: sesión → rol → CSRF → id (404 `USER_NOT_FOUND`) → cuerpo cerrado → validación de `core` (422) → dominio (409 `LAST_ADMIN`; usuario repetido, 422 en `username`).
  - D-8: si cambia `sessionVersion`, `destroyUser` en el almacén de la API.
  - `meta.ownSessionClosed` indica si se cerraron las sesiones del propio usuario.
  - Las fechas van en la zona del negocio.
- **`api/src/admin/account-routes.ts` (nuevo):** `POST /cuenta/contrasena`.
  - Orden: sesión → CSRF → cuerpo cerrado → contraseña actual (422 sin tocar el límite de intentos) → `setPassword`.
  - Cierra todas las sesiones del usuario en la API y devuelve `{ session, user }` con la sesión nueva.
- **`api/src/admin/router.ts`, `index.ts` y `app.ts`:** composición.
  - Las rutas de usuarios van antes que las de productos: `/usuarios/productos` es un id mal formado (403 para un editor y 404 para un administrador).
  - `hashParams` llega también a las rutas nuevas.
- **`api/src/admin/responses.ts` (nuevo):** `send` (validado con el contrato), `validationFailed` y `closedBody`, extraídos de `product-routes.ts` para reutilizarlos. Productos no cambia de comportamiento: sus 144 pruebas de la API pasan igual.
- **Pruebas:** ver "Validaciones ejecutadas".

#### Desviaciones del plan

- **Nombre de la rama:** `feature/REQ-F-040-admin-usuarios-1-api`, el indicado al aprobar el plan. La tabla de la división se actualizó. El PR 2 será `feature/REQ-F-040-admin-usuarios-2-inventory`.
- **`api/src/admin/responses.ts`:** módulo nuevo, no previsto en la lista de archivos. Evita duplicar en usuarios y cuenta la respuesta validada y el cuerpo cerrado de productos.
- **Base caída (503):** se prueba en proceso, con el doble que lanza `DatabaseUnavailableError`, en lugar de con el proxy TCP del proceso. La traducción de la base caída a 503 sobre Prisma ya la cubre `api-process.test.ts`.
- **Concurrencia por la API:** la petición que pierde puede recibir 401, además de 409 o 503, si la otra desactivó primero a su propio autor. Lo que se exige es lo de D-7: como mucho un 200 y siempre exactamente un administrador activo.
- **Detalles añadidos:**
  - un negocio desconocido en `businesses` da 422 con "Elige negocios conocidos.";
  - la API registra `admin_last_admin_rejected` (ruta y método) cuando D-7 rechaza una operación.

#### Criterios de aceptación (parte de la API)

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumplido en la API | 401 sin sesión en las 8 rutas. 403 `FORBIDDEN_ROLE` a un editor en las 7 de usuarios, con su id, con un id mal formado y con `/usuarios/productos`, sin escrituras ni auditoría |
| CA-2 | Cumplido en la API | Lista con usuario, nombre, rol, negocios, estado y último acceso, activos primero; `lastLoginAt` en la zona del negocio (`-06:00`) |
| CA-3 | Cumplido en la API | 201 y auditoría `create` con el actor y sin hash; 12 casos de 422 por campo; repetido con otras mayúsculas y doble envío simultáneo con MySQL, una sola cuenta; el usuario entra en los dos admins |
| CA-4 | Cumplido | Cambiar los negocios desde la API cierra las sesiones de los dos admins; cambiar solo el nombre no; `update` con los cambios; sin cambios no se audita |
| CA-5 | Cumplido | Desactivar cierra las dos sesiones y no puede entrar en ninguno; reactivar le deja entrar; `deactivate` y `reactivate`; repetir no cambia nada |
| CA-6 | Cumplido en la API | Con un solo administrador, 409 `LAST_ADMIN` sin cambios en la tabla ni en la auditoría. Con dos, autodesactivación y autodegradación con `ownSessionClosed`. Concurrencia, 10 repeticiones, con dos peticiones a la API y con una en cada admin |
| CA-7 | Cumplido | Restablecer cierra las sesiones de los dos admins: la contraseña anterior falla y la nueva sirve; `password_reset` |
| CA-8 | Cumplido en la API | Sesión nueva, y las anteriores (también la del `/admin` actual) caen; `password_change`. Con la actual incorrecta, 422 en el campo; 6 intentos no bloquean el login. `role`, `businesses`, `id` y `userId` dan 422 sin cambios |
| CA-9 | Cumplido en la API | Sin token CSRF, con el de otra sesión o con uno falso: 403 en las 7 escrituras, sin cambios. El `Origin` lo comprueba `inventory-manager` (PR 2) |
| CA-10 | PR 2 | La interfaz con la API caída. La API responde 503 `DATABASE_UNAVAILABLE` sin trazas |
| CA-11 | Cumplido en la API | 404 `USER_NOT_FOUND` con 6 ids inexistentes o mal formados. Las redirecciones tras guardar son del PR 2 |
| CA-12 | Cumplido en la API | Respuestas con `no-store` y sin contraseñas, hashes ni `sessionVersion`; los logs en proceso y los del proceso real no tienen contraseñas, hashes, ids de sesión ni tokens CSRF; la auditoría no tiene hashes |
| CA-13 a CA-16 y CA-18 | PR 2 | Interfaz, solo lectura, retorno, regla de `inventory-manager` y documentación |
| CA-17 | Cumplido en local | `typecheck`, `lint` y `test` terminan con 0. El CI se comprobará en T4 |

#### Validaciones ejecutadas (desde `restaurante/`)

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin errores ni avisos.
- `npm run build:css`: 0. No se tocaron estilos; se ejecutó como se pidió.
- `npm test -- --maxWorkers=4`: 0.
  - `api`: 7 archivos y 144 pruebas.
  - `landing-pages`: 108 archivos y 2207 pruebas: 2206 pasan y 1 es un fallo esperado que ya existía.
  - `inventory-manager`: 7 archivos y 71 pruebas.
- Concurrencia aislada, 5 ejecuciones seguidas de `npx vitest run tests/integration/users-api-process.test.ts -t "simultáneas"` en `landing-pages`: 2 de 2 pasan en las 5.
- Sin procesos en segundo plano al terminar.

#### Archivos afectados

- `restaurante/packages/core/identity/user-schema.ts`
- `restaurante/packages/contracts/admin.ts`
- `restaurante/packages/contracts/admin-client.ts`
- `restaurante/api/src/admin/access.ts`
- `restaurante/api/src/admin/index.ts`
- `restaurante/api/src/admin/router.ts`
- `restaurante/api/src/admin/product-routes.ts`
- `restaurante/api/src/admin/responses.ts` (nuevo)
- `restaurante/api/src/admin/user-routes.ts` (nuevo)
- `restaurante/api/src/admin/account-routes.ts` (nuevo)
- `restaurante/api/src/app.ts`
- `restaurante/landing-pages/src/controllers/admin-users.ts`
- `restaurante/landing-pages/src/controllers/admin-account.ts`
- `restaurante/api/tests/support/admin.ts`: el doble de usuarios con D-7, D-8, auditoría y usuario único
- `restaurante/api/tests/unit/contract-types.test.ts`
- `restaurante/api/tests/integration/admin-users-api.test.ts` (nuevo)
- `restaurante/landing-pages/tests/integration/users-api-process.test.ts` (nuevo)
- `.claude/docs/in-progress/REQ-F-040-admin-nuevo-usuarios-cuenta.md`

#### Riesgos o pendientes

- **Producción:** no cambia nada hasta el PR 2. La API es interna y nadie llama a los endpoints nuevos.
- **Duración:** `users-api-process.test.ts` arranca un proceso de la API por prueba (7) y tarda unos 13 s en local.
- **PR 2 pendiente:** pantallas de `inventory-manager`, solo lectura con `ADMIN_NEW_URL`, prueba de extremo a extremo y documentación.

## QA Action Plan

### PR 1 de 2: `api` y contratos (Q1, 2026-10-29)

#### Objetivo

Comprobar con evidencia que el PR 1 (endpoints de usuarios y cuenta propia en `/api/v1/admin`, contratos, `adminOnly`, `responses.ts` y los mensajes movidos a `core`):

- cumple su parte de los CA (los de la API);
- es seguro: permisos, CSRF, listas cerradas de campos, sin escalada de privilegios y sin secretos;
- respeta D-7 y D-8 contra MySQL real, también con concurrencia;
- no rompe el `/admin` actual (usuarios, cuenta, productos, bot y menú), los productos de la API ni la regla de dependencias.

Este PR no cambia nada visible: no hay pruebas de navegador, responsive, accesibilidad, UX/UI frente a Stitch ni SEO (son del PR 2).

#### Requisito bajo prueba

RF-1, RF-2, RF-3 a RF-11, RF-13 y RF-16 en la API, y RF-12 en su parte de la API (`no-store`). Las cuatro desviaciones del Implementation Result están aprobadas por el usuario ("Si") y se validan como parte del alcance:

1. nombre de la rama;
2. `api/src/admin/responses.ts`;
3. 503 probado en proceso con el doble;
4. la petición que pierde en la concurrencia puede recibir 401.

#### Criterios de aceptación (parte de la API) y pruebas que los cubren

| CA | Qué se valida en el PR 1 | Pruebas |
| --- | --- | --- |
| CA-1 | 401 sin sesión en las 8 rutas; 403 `FORBIDDEN_ROLE` al editor en las 7 de usuarios (su id, id mal formado, `/usuarios/productos`) antes de mirar el id; sin escrituras ni auditoría | A-1, A-2, S-1, S-2 |
| CA-2 | Lista: campos de RF-3, orden (activos primero y por usuario), "Todos" = `businesses: []` para el admin, `lastLoginAt` con la zona del negocio o `null` | F-1, R-MySQL |
| CA-3 | 201 + `create` con actor y sin hash; 422 por campo; repetido con otras mayúsculas; doble envío; el usuario entra en los dos admins | F-2, N-1 a N-6, R-MySQL |
| CA-4 | D-8: rol o negocios cierran las sesiones de los dos admins; solo el nombre no; `update` con cambios; sin cambios no audita | R-MySQL, F-3 |
| CA-5 | Desactivar cierra las dos sesiones y bloquea la entrada; reactivar la permite; repetir no cambia nada; `deactivate`/`reactivate` | R-MySQL, F-4 |
| CA-6 | D-7: 409 `LAST_ADMIN` con un solo admin (desactivar y degradar), sin cambios; autodegradación y autodesactivación con dos; concurrencia | R-MySQL, C-1 a C-4 |
| CA-7 | Restablecer: sesiones cerradas en los dos admins, la anterior falla, la nueva sirve; `password_reset` | R-MySQL, F-5 |
| CA-8 | Cuenta: sesión nueva, las demás caen (también `/admin`); `password_change`; actual incorrecta → 422 sin tocar el límite de login; `role`, `businesses`, `id` → 422 sin cambios | R-MySQL, F-6, S-3 |
| CA-9 | Sin CSRF, con el de otra sesión o falso: 403 en las 8 escrituras (7 + cuenta), sin cambios. El `Origin` es del PR 2 | A-3 |
| CA-10 | Solo la API: 503 `DATABASE_UNAVAILABLE` sin trazas (la interfaz es del PR 2) | E-1 |
| CA-11 | 404 `USER_NOT_FOUND` sin datos con ids inexistentes o mal formados (el PRG es del PR 2) | N-7 |
| CA-12 | Respuestas sin contraseñas, hashes, `sessionVersion`, ids de sesión ni tokens (salvo la sesión nueva de la cuenta, que es el objetivo); `no-store`; logs y `user_audit` sin secretos | S-4 a S-6 |
| CA-16 | Regla de dependencias intacta (lint y `dependency-rule.test.ts`) | G-3 |
| CA-17 | `typecheck`, `lint` y `test` en 0 en local. El CI real queda para T4 | G-1, G-2 |

CA-13, CA-14, CA-15 y CA-18 no aplican al PR 1.

#### Riesgos identificados

- **Escalada de privilegios:** un editor que se cambia el rol por `PUT /usuarios/:id`, o que mete `role`/`businesses`/`id` en `/cuenta/contrasena`; claves especiales en el JSON (`__proto__`, `constructor`).
- **Una sesión que pierde privilegios a mitad:** un admin degradado o desactivado que reutiliza su Bearer.
- **D-7 por caminos no cubiertos:** la concurrencia existente cubre desactivar contra desactivar. No cubre la degradación (`PUT` con `role: editor`) simultánea ni la mezcla degradar más desactivar.
- **Orden de comprobaciones:** un 404, 415 o 422 que filtre la existencia de un id a un editor.
- **Secretos:** el logger de peticiones, `admin_forbidden`, `admin_last_admin_rejected` o un 500 por un fallo del contrato (`admin_response_invalid`).
- **Regresión por la extracción de `responses.ts`:** cambios en el 422, la lista cerrada o los límites de los productos.
- **Regresión del `/admin` actual:** los mensajes movidos a `core` deben ser idénticos.
- **Métodos no previstos:** `DELETE /usuarios/:id` o `PATCH` no deben borrar ni cambiar nada (no se eliminan usuarios).
- **Entorno:** `mysql-dev` compartido (500 conexiones; un 1040 es de entorno) y pruebas con procesos, sensibles a puertos y tiempos.

#### Pruebas funcionales

- **F-1. Lista:** contrato, orden, `businesses: []` para el admin, `lastLoginAt` `null` y con la zona del negocio (`-06:00`) tras entrar. Pruebas existentes en proceso y con MySQL.
- **F-2. Crear:** 201, contrato, `create` con actor y sin hash, entrada en los dos admins.
- **F-3. Editar:** usuario de acceso, nombre, rol y negocios. D-8 solo con rol o negocios. `update` con los cambios; sin cambios, sin auditoría.
- **F-4. Desactivar y reactivar,** incluida la repetición idempotente.
- **F-5. Restablecer** la contraseña, también la propia (`ownSessionClosed: true`).
- **F-6. Cuenta propia:** sesión nueva (id y token distintos), el Bearer anterior da 401 y el nuevo 200.
- **F-7. Edición simultánea (RF-9):** dos `PUT` a la vez sobre el mismo usuario. Gana la última, ninguna da error y las dos quedan en `user_audit`. Sonda QA.

#### Pruebas negativas y casos límite

- **N-1.** Campo desconocido → 422 "Campo desconocido.", también con `__proto__` y `constructor` como claves (sonda QA).
- **N-2.** Tipos inválidos: `username` numérico o `null`, `role` desconocido (`superadmin`), `businesses` como texto, con un negocio desconocido o con duplicados (sonda QA para los que no tienen prueba).
- **N-3.** Un admin creado o editado con `businesses` queda con `[]` (prueba existente).
- **N-4.** Contraseñas: 11 caracteres → 422; 12 caracteres multibyte → 201; 256 → aceptada y 257 → 422 (sonda QA para 256/257); confirmación distinta → 422.
- **N-5.** JSON inválido → 400; sin `application/json` → 415; más de 16 KiB → 413; desactivar con más de 4 KiB → 413 (sonda QA).
- **N-6.** Usuario repetido con otras mayúsculas y doble envío simultáneo: 422 en `username` y una sola fila.
- **N-7.** Ids `999`, `0`, `abc`, `1e3`, `12345678901` y `-1` → 404 en ver y en las escrituras.
- **N-8.** `DELETE` y `PATCH` sobre `/usuarios/:id` → 405 con `Allow`, sin borrar ni cambiar nada; `HEAD /usuarios` sin datos para un editor (sonda QA).

#### Pruebas de seguridad

- **A-1.** Sin sesión, con un Bearer mal formado o desconocido: 401 en las 8 rutas, sin escrituras.
- **A-2.** Editor: 403 en las 7 rutas de usuarios (su id, id mal formado e inexistente, `/usuarios/productos`), con el mismo cuerpo de error en todos los casos (no filtra si el id existe).
- **A-3.** CSRF: falta, de otra sesión, falso o vacío → 403 `CSRF_INVALID` en las 7 escrituras de usuarios y en la cuenta; la base y `user_audit` no cambian.
- **S-1. Escalada de un editor** (sonda QA, MySQL): `PUT /usuarios/<su id>` con `role: admin` → 403, y su fila no cambia. `POST /cuenta/contrasena` con `role`, `businesses`, `id` o `userId` → 422 y nada cambia.
- **S-2. Privilegios perdidos a mitad** (sonda QA): un admin degradado o desactivado por otro admin reutiliza su Bearer en `/usuarios` y en `/cuenta/contrasena` → 401. Un usuario desactivado no cambia su contraseña.
- **S-3. Cuenta:** 6 intentos con la actual incorrecta no bloquean el login; se registra `admin_password_change_rejected` sin la contraseña.
- **S-4. Respuestas:** las de las 8 rutas, incluidas las de error, llevan `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`, y no contienen `sessionVersion`, `passwordHash`, `scrypt$` ni la contraseña enviada. Los errores siguen `{ error: { code, message } }` (con `fields` en el 422) y nunca llevan trazas.
- **S-5. Logs** (en proceso y del proceso real): ninguna contraseña usada, ningún `scrypt$`, id de sesión ni token CSRF. Los eventos `admin_user_*`, `admin_password_changed`, `admin_forbidden` y `admin_last_admin_rejected` llevan solo ids, ruta y método.
- **S-6. Auditoría:** `changes` de cada acción sin hashes ni contraseñas (consulta directa a `user_audit` en la sonda).
- **`noindex`:** la API (interna, sin router en Traefik) solo envía `no-store`. Igual que en REQ-F-039, el `noindex` lo pone `inventory-manager`: se verifica en el PR 2 y no se trata como defecto del PR 1.

#### Pruebas de concurrencia (D-7 y D-8, MySQL real)

- **C-1.** Las 2 pruebas de concurrencia existentes (dos peticiones a la API; una en cada admin), 10 repeticiones cada una, ejecutadas aisladas 5 veces seguidas.
- **C-2.** Sonda QA: A y B se degradan mutuamente a la vez con `PUT … role: editor`, 10 repeticiones. Siempre queda exactamente un administrador activo, como mucho un 200, y la otra recibe 409 o 401.
- **C-3.** Sonda QA: A se degrada a sí mismo mientras B desactiva a A, 10 repeticiones. Queda al menos un administrador activo.
- **C-4.** `user-repository.test.ts` y `last-admin-concurrency.test.ts` no cambian (`git diff`) y pasan.

Un 1040 (`Too many connections`) o un fallo de arranque por puertos se registra como bloqueo de entorno y se repite una vez, sin convertirlo en defecto.

#### Pruebas de errores e integración

- **E-1.** 503 `DATABASE_UNAVAILABLE` sin trazas con el doble (desviación 3 aprobada) y la traducción real de Prisma ya cubierta por `api-process.test.ts`.
- **E-2.** `contracts/admin-client.ts`: los 7 métodos nuevos usan las rutas de `adminPaths` y los tipos de las respuestas (typecheck, y `contract-types.test.ts`: `USER_LIMITS` y roles iguales a los de `core`).

#### Pruebas de regresión

- **R-1. `/admin` actual sin `ADMIN_NEW_URL`:** `admin-users.test.ts`, `admin-account.test.ts`, la matriz de autorización y las pruebas del bot y del menú pasan sin cambios. `git diff` confirma que los tres mensajes de `core` son idénticos a los textos anteriores.
- **R-2. `/admin` actual con `ADMIN_NEW_URL`:** `admin-products-moved.test.ts` pasa. Usuarios y cuenta siguen escribiendo (la solo lectura es del PR 2).
- **R-3. Productos de la API tras `responses.ts`:** `admin-api.test.ts` y `products-endpoint.test.ts` pasan sin cambios en sus aserciones (422, campos desconocidos, 413, 409 de versión y contrato).
- **R-4. `inventory-manager`:** su suite pasa sin cambios (el cliente amplió `admin-client.ts`).
- **R-5. Alcance del diff:** solo los archivos listados en el Implementation Result; `deploy/`, los tests del repositorio de usuarios y `inventory-manager/src` sin cambios.
- **R-6. Landings:** la suite de `landing-pages` (HTML de las landings) pasa; no hay cambios de CSS ni de vistas.

#### Pruebas automatizadas

- **Existentes, sin modificar:** `api/tests/integration/admin-users-api.test.ts` (28 pruebas), `api/tests/unit/contract-types.test.ts` y `landing-pages/tests/integration/users-api-process.test.ts` (7 pruebas con el proceso de la API y MySQL), más toda la suite.
- **Nueva, de QA:** `restaurante/landing-pages/tests/integration/users-api-qa-req-f-040.test.ts` (nombre final; ver "Aprobación del QA Action Plan"), con las sondas F-7, N-1, N-2, N-4 (256/257), N-5 (4 KiB), N-8, S-1, S-2, S-6, C-2 y C-3.
  - Sigue el patrón de `users-api-process.test.ts`: `setupAdmin()`, la API como proceso hijo, `freePorts` y `expect.poll` para los logs. Solo bases `restaurante_test*`.
  - Queda como prueba permanente del PR (decisión del usuario: "Conservarlas en el PR"). No toca código de producción.
  - Se escribe en `landing-pages/tests/` porque es la única carpeta de pruebas en la que puede escribir QA. Arranca la API como proceso, sin importar `api/`, igual que la prueba existente.
- **Sin dependencias nuevas.**

#### Pruebas en navegador

No aplican: el PR 1 no cambia pantallas, HTML ni CSS. Las del PR 2 tendrán su propio QA.

#### Pruebas de performance

- Duración de `users-api-process.test.ts` (unos 13 s en local) y de la suite completa con `--maxWorkers=4`, para anticipar el tiempo del CI.
- Ningún proceso ni contenedor queda en segundo plano al terminar. No se construyen imágenes Docker en el QA del PR 1: el job `docker` se comprueba en T4.

#### Comandos generales (desde `restaurante/`)

- **G-1.** `npm run typecheck` y `npm run lint` (0, sin avisos). No se ejecuta `lint:fix`.
- **G-2.** `npm test -- --maxWorkers=4` completo: `api`, `landing-pages`, `inventory-manager` y paquetes. El fallo esperado que ya existía se identifica por su nombre.
- **G-3.** `dependency-rule.test.ts` y la regla del lint: `api` importa solo los paquetes permitidos y `landing-pages` no importa `api`.
- `npm run build:css` (requisito del flujo; no hay cambios de estilos).

#### Evidencia requerida

- Salida resumida (archivos, pruebas y código de salida) de G-1, G-2 y C-1.
- Resultado de cada sonda QA con su aserción principal (códigos HTTP, recuento de administradores activos por repetición y filas de `user_audit`).
- `git status` y `git diff --stat` con la lista de archivos frente a `9354724`.
- Búsqueda de secretos en los logs capturados (contraseñas usadas, `scrypt$`, ids de sesión y tokens).

#### Criterios de aprobación

- Los CA de la tabla pasan con evidencia.
- No hay defectos `BLOCKER` ni `CRITICAL`; cualquier `MAJOR` se lleva al usuario.
- Las sondas de seguridad (S-1, S-2) y de concurrencia (C-2, C-3) se cumplen en todas las repeticiones.
- `typecheck`, `lint` y `npm test` terminan con 0, y la regresión R-1 a R-6 no presenta fallos.

#### Aprobación del QA Action Plan (2026-10-29)

Respuestas textuales del usuario:

1. Plan: "Sí, apruebo el plan".
2. Archivo de sondas: "Conservarlas en el PR". Queda como prueba permanente, estable y sin `it.fails`. Se llama `users-api-qa-req-f-040.test.ts` en lugar de `qa-req-f-040-api-probes.test.ts`: sigue la convención de las pruebas de QA del repositorio (`admin-api-qa-req-f-039.test.ts` e `inventory-manager-qa-req-f-039.test.ts`).
3. `noindex`: "Sí, en el PR 2 (Recomendado)".

#### Pull Request del PR 1

- **PR:** https://github.com/orvigas/negocio/pull/110, de `feature/REQ-F-040-admin-usuarios-1-api` hacia `epic/arquitectura`.
- **Commits:**
  - `29dad31`: `feat: gestiona los usuarios y la cuenta propia desde la API de administración (REQ-F-040, PR 1 de 2)`;
  - y este commit, `docs: registra el Pull Request del PR 1 de REQ-F-040`.
- **Base:** `origin/epic/arquitectura` seguía en `9354724` al hacer el commit, así que no hizo falta integrar nada.
- **Prueba de QA:** se incluye `landing-pages/tests/integration/users-api-qa-req-f-040.test.ts`, que el usuario decidió conservar ("Conservarlas en el PR").
- **Estado:** `READY_FOR_MERGE` se registra en este commit para que entre en el merge, como se pidió tras lo ocurrido en el #99. El PR se marca como listo después de subirlo, y el resultado del CI (`calidad`, `docker` y `auditoria`) se informa al usuario. Si el CI fallara, el estado volvería a corregirse antes del merge.

### PR 2 de 2: `inventory-manager`, solo lectura y documentación (2026-10-29)

#### Rama

`feature/REQ-F-040-admin-usuarios-2-inventory`, creada desde `origin/epic/arquitectura` (`0bfa50a`, con el PR 1 mergeado), sin upstream. No hay commit ni PR todavía.

#### Cambios realizados

- **`inventory-manager/src/controllers/common.ts` (nuevo):**
  - reúne lo común de los controladores, extraído sin cambios de `controllers/admin.ts`: `send`, `seeOther`, `toLogin`, `unavailable`, `failureReason`, `isUnavailable`, `session`, `notFound`, `idOf` y `credentials`;
  - añade `toLoginClosed`, que borra la cookie y lleva a `/acceso?ok=sesion_cerrada`.
  - `controllers/admin.ts` (productos) usa ahora estas funciones. Las 71 pruebas anteriores de `inventory-manager` pasan sin cambios.
- **`inventory-manager/src/controllers/users.ts` (nuevo):** lista, alta, edición, desactivar y reactivar, y restablecer la contraseña.
  - GET: sesión → rol administrador (403 "Sin permiso" sin pedir usuarios a la API) → datos.
  - POST: mismo origen → lista cerrada de campos (400) → sesión → rol → la API.
  - Errores:
    - 422 por campo, conservando lo escrito salvo las contraseñas;
    - 409 `LAST_ADMIN` con aviso urgente;
    - 503 conservando lo escrito, también si la API cae al comprobar la sesión;
    - 401 al acceso;
    - 403 "Petición no válida";
    - 404.
  - Tras guardar, PRG con `?ok=` de lista cerrada.
  - Con `meta.ownSessionClosed`, al acceso con el aviso "Tu sesión se cerró".
- **`inventory-manager/src/controllers/account.ts` (nuevo):** "Mi cuenta".
  - Lista cerrada de campos: `role`, `businesses`, `id` o `business-birria` dan 400 sin llamar a la API.
  - Con 200, `writeSessionId` reescribe la cookie con la sesión nueva (mismo nombre y atributos) y redirige a `/cuenta?ok=password_change`.
  - Con 422, error en el campo, sin contraseñas. Con 401, al acceso con `expirada=1`. Con 503, el aviso.
- **`inventory-manager/src/views/users.ts` (nuevo) y plantillas nuevas:**
  - páginas `pages/users.html`, `user-form.html`, `user-password.html` y `account.html`;
  - parciales `user-row`, `status-form`, `user-status-panel`, `user-fieldset`, `field-password` y `form-submit`.
  - Bloques BEM `user-list`, `user-row`, `user-form`, `user-status` y `account-panel`. Reutilizan `field`, `notice`, `button` y los tokens de P-4; no hay CSS nuevo.
  - Las contraseñas no llevan `value`, `minlength` ni `maxlength`. El texto de ayuda sale de `USER_LIMITS`.
  - `autocomplete`: `new-password` en la contraseña nueva, `current-password` en la actual y `off` en el usuario de acceso.
  - Desactivar y reactivar son botones dentro de un formulario POST.
- **Cabecera (`views/index.ts` y `partials/header.html`):**
  - "Usuarios" en la navegación, solo para administradores;
  - "Mi cuenta" junto al nombre, con `aria-current` en la sección activa;
  - la navegación pasa de `aria-label="Negocios"` a `aria-label="Secciones"`.
- **Acceso:** la pantalla muestra el aviso "Tu sesión se cerró" con `?ok=sesion_cerrada`.
- **`inventory-manager/src/session.ts`:** el retorno tras entrar acepta `/usuarios`, `/usuarios/nuevo`, `/usuarios/<id>/editar`, `/usuarios/<id>/contrasena` y `/cuenta` (RF-14).
- **`routes.ts` y `app.ts`:** rutas nuevas, registradas antes de las de productos.
- **`noindex`:** lo pone ya en todas las respuestas el middleware de seguridad (`X-Robots-Tag: noindex, nofollow`), y el layout lleva `<meta name="robots">`. Las pruebas lo comprueban en las pantallas nuevas.
- **JavaScript:** no hay JS nuevo. Los formularios llevan `data-submit-guard`: el `submit-guard.js` actual evita el doble envío y muestra "Guardando…".
- **`landing-pages`, solo lectura con `ADMIN_NEW_URL` (P-2 A):**
  - `controllers/admin-users.ts`: la lista, en consulta y sin controles, con el aviso y el enlace a `${ADMIN_NEW_URL}/usuarios`.
  - Nuevo, editar, contraseña, desactivar, reactivar y sus POST siguen el orden sesión → permiso de administrador → id (404) → 410, con el enlace a la pantalla equivalente. No leen el formulario ni escriben.
  - `controllers/admin-account.ts`: GET y POST de `/admin/cuenta` siguen el orden sesión → 410, con el enlace a `${ADMIN_NEW_URL}/cuenta`.
  - Se registra `admin_users_moved`.
  - Vistas nuevas: `users-list-readonly.html`, `users-moved.html`, `partials/user-row-readonly.html` y `partials/users-moved-link.html`.
- **Documentación:**
  - `restaurante/docs/arquitectura.md` §8: tabla del plan y "Paso 4, ticket 2 aplicado (REQ-F-040)";
  - `.claude/CLAUDE.md` §8: descripción de `api` e `inventory-manager`;
  - `restaurante/README.md`: tabla de apps, API, admin nuevo, convivencia y nota en las rutas de `/admin`;
  - `docs/despliegue.md`: efecto ampliado de `ADMIN_NEW_URL` y aviso al personal (R-3);
  - `docs/desarrollo.md`: cómo probar la solo lectura;
  - `landing-pages/.env.example`.
- **Pruebas:** ver "Validaciones ejecutadas".

#### Desviaciones del plan

- **Lista de usuarios:** en `inventory-manager` es una lista de tarjetas (`<ul>` con un `<dl>` por usuario), como las filas de productos, en lugar de una tabla desde `md`. Así no hay desplazamiento horizontal a 375 px y se reutiliza el patrón ya validado de P-4.
- **`autocomplete` del usuario de acceso:** es `off` en el alta y la edición, no `username`. En esos formularios, `username` haría que el navegador rellenara el usuario del administrador que está creando la cuenta. Es lo mismo que hace el `/admin` actual.
- **Estado al volver a pintar la edición:** tras un 422, un 409 o un 503, el formulario no vuelve a mostrar el panel "Estado y contraseña" (necesitaría otra llamada a la API). Sí lo muestra al abrir la edición.
- **Regresión intencionada en `landing-pages/tests/integration/admin-products-moved.test.ts`:** su prueba "el resto del /admin funciona igual" esperaba `/admin/cuenta` en 200 con `ADMIN_NEW_URL`. Ahora espera 410, como pide RF-19. `/admin/usuarios` sigue en 200, en consulta.
- **Cabecera:** la navegación del admin nuevo se llama "Secciones" en vez de "Negocios", porque ahora incluye "Usuarios".
- **Número de POST de la solo lectura:** la prueba recorre los 6 POST de usuarios y cuenta más un POST sin token CSRF, 7 en total.

#### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumplido | Un editor no ve "Usuarios" y recibe 403 en 5 GET y 5 POST sin llamar a los endpoints de usuarios (`inventory-manager/tests/integration/users.test.ts`). La API ya daba 401 y 403 (PR 1). Sin sesión, al acceso |
| CA-2 | Cumplido | Lista con usuario, nombre, rol, "Todos", estado en texto y último acceso (`28/10/2026 13:45`, la hora del negocio de la API) o "Nunca" |
| CA-3 | Cumplido | Alta sin JS con PRG; en el e2e, el usuario nuevo entra en los dos admins; 422 que conserva lo escrito sin contraseñas, con error asociado y resumen enlazado; repetido con otras mayúsculas (doble y e2e); `create` en la auditoría |
| CA-4 | Cumplido | e2e: cambiar los negocios en el admin nuevo cierra las dos sesiones. PR 1: solo el nombre no las cierra |
| CA-5 | Cumplido | e2e: desactivar cierra las dos sesiones y no puede entrar en ninguno (401 y 401); reactivar le deja entrar. `deactivate` y `reactivate` en la auditoría |
| CA-6 | Cumplido | 409 con aviso urgente en edición y en desactivar, sin cambios. Al degradarse a sí mismo, al acceso con el aviso y sin "Usuarios". Concurrencia entre los dos admins en `users-api-process.test.ts` (PR 1) |
| CA-7 | Cumplido | e2e: restablecer cierra las dos sesiones, la contraseña anterior falla (401 y 401) y la nueva sirve. `password_reset`. Restablecerse la propia desde "Usuarios" también cierra la sesión actual |
| CA-8 | Cumplido | "Mi cuenta": cookie nueva (`HttpOnly` y `SameSite=Strict`), la sesión anterior y la del otro navegador caen, la del `/admin` actual también (e2e). Con la actual incorrecta, 422 en ese campo; los campos ajenos dan 400 |
| CA-9 | Cumplido | `Origin` ajeno o `Sec-Fetch-Site` distinto: 403 sin llamar a la API. Sin token o con el de otra sesión: 403 "Petición no válida", sin cambios |
| CA-10 | Cumplido | Con la API en `writes-down` y en `down`: 503 "Servicio no disponible", lo escrito conservado sin contraseñas y sin trazas, en el alta y en "Mi cuenta" |
| CA-11 | Cumplido | 404 en ids inexistentes o mal formados; PRG con 303 tras cada escritura |
| CA-12 | Cumplido | `no-store`, `X-Robots-Tag: noindex, nofollow` y `<meta name="robots">` en las pantallas nuevas. Los logs de `inventory-manager` (en proceso) y de los tres procesos (e2e) no tienen contraseñas, hashes, ids de sesión, cookies ni tokens CSRF |
| CA-13 | Cumplido en pruebas automáticas | En las 5 pantallas: un `h1`, cada campo con su `label`, salto al contenido, contraseñas sin `value`, errores con `aria-describedby` y `aria-invalid` y texto "Error:", y sin anchos fijos. Falta la revisión visual a 375 px en navegador (QA) |
| CA-14 | Cumplido | `admin-users-moved.test.ts`: lista sin controles con el enlace; 4 GET con 410 y el enlace equivalente; 7 POST con 410 y la tabla de usuarios y `user_audit` idénticas; un editor sigue con 403; menú, bot y `admin:recover` con `ADMIN_NEW_URL`. Sin la variable, `admin-users.test.ts` y `admin-account.test.ts` pasan sin cambios |
| CA-15 | Cumplido | `next` vale para las 5 pantallas nuevas y se vuelve a ellas tras entrar; `//evil…`, ids mal formados y acciones POST vuelven a `/` |
| CA-16 | Cumplido | `npm run lint` (regla de `inventory-manager`) en 0: solo importa `contracts` y `web` |
| CA-17 | Cumplido en local | `typecheck`, `lint` y `test` en 0. El CI se comprobará en T4 |
| CA-18 | Cumplido | Documentación actualizada (ver "Cambios realizados") |

#### Validaciones ejecutadas (desde `restaurante/`)

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin errores ni avisos.
- `npm run build:css`: 0.
- `npm test -- --maxWorkers=4`: 0.
  - `api`: 7 archivos y 144 pruebas, todas pasan.
  - `landing-pages`: 111 archivos y 2225 pruebas: 2224 pasan y 1 es un fallo esperado que ya existía.
  - `inventory-manager`: 8 archivos y 111 pruebas, todas pasan.
- 5 ejecuciones aisladas seguidas de `admin-users-e2e.test.ts`, `users-api-process.test.ts` y `admin-users-moved.test.ts`: 18 de 18 en las 5.
- Sin procesos en segundo plano al terminar.

#### Archivos afectados

Nuevos:
- `inventory-manager/src/controllers/{common,users,account}.ts`
- `inventory-manager/src/views/users.ts`
- `inventory-manager/src/views/pages/{users,user-form,user-password,account}.html`
- `inventory-manager/src/views/partials/{user-row,status-form,user-status-panel,user-fieldset,field-password,form-submit}.html`
- `inventory-manager/tests/integration/users.test.ts`
- `landing-pages/src/views/admin/{users-list-readonly,users-moved}.html`
- `landing-pages/src/views/admin/partials/{user-row-readonly,users-moved-link}.html`
- `landing-pages/tests/integration/{admin-users-moved,admin-users-e2e}.test.ts`

Modificados:
- `inventory-manager/src/{app,routes,session}.ts`
- `inventory-manager/src/controllers/admin.ts`
- `inventory-manager/src/views/index.ts`
- `inventory-manager/src/views/partials/header.html`
- `inventory-manager/tests/support/api-double.ts`
- `inventory-manager/tests/unit/config-session.test.ts`
- `landing-pages/src/controllers/{admin-users,admin-account}.ts`
- `landing-pages/src/views/admin/users.ts`
- `landing-pages/tests/integration/admin-products-moved.test.ts`
- `landing-pages/.env.example`
- `README.md`
- `docs/{arquitectura,despliegue,desarrollo}.md`
- `.claude/CLAUDE.md`
- este ticket

#### Cómo probarlo en local

1. `npm run db:up` y `npm run db:generate` si hace falta.
2. En `landing-pages/.env`, `ADMIN_NEW_URL=http://127.0.0.1:3003`.
3. `npm run dev`: API en 3001, landings en 3000 y admin nuevo en 3003.
4. En `http://127.0.0.1:3003/acceso`, entra con el primer administrador (`ADMIN_USER`). "Usuarios" aparece en la cabecera; "Mi cuenta", junto a tu nombre.
5. Crea un editor y entra con él en una ventana privada, en el admin nuevo y en `http://127.0.0.1:3000/admin/login`. Desde el administrador, cámbiale los negocios, desactívalo, reactívalo o restablécele la contraseña, y comprueba que sus dos sesiones caen.
6. Con el editor, cambia la contraseña en "Mi cuenta": sigue con sesión en el admin nuevo y su sesión del `/admin` actual cae.
7. En `http://127.0.0.1:3000/admin/usuarios`, la lista sale sin controles y con el enlace; `/admin/cuenta` responde 410 con el enlace.
8. Sin `ADMIN_NEW_URL`, el `/admin` actual funciona como antes.

#### Riesgos o pendientes

- **R-5:** la solo lectura y las pantallas nuevas van en este mismo PR. Al mergear la épica a `main`, el personal cambia de hábito (R-3, documentado en `docs/despliegue.md`).
- **Duración:** el e2e con tres procesos tarda unos 10 s en local, y `admin-users-moved.test.ts` unos 7 s.
- **Revisión visual en navegador** (375 px y escritorio, teclado): pendiente de QA.

### QA Action Plan del PR 2 de 2: `inventory-manager`, solo lectura y documentación (Q1, 2026-10-29)

El usuario aprobó la implementación del PR 2 ("Si lo apruebo"), con sus seis desviaciones. Este plan las valida como parte del alcance. Nota de estructura: el Implementation Result del PR 2 quedó bajo `## QA Action Plan` (desde "PR 2 de 2: `inventory-manager`, solo lectura y documentación"); QA no lo mueve.

NotebookLM: el servidor MCP `notebooklm` no está disponible en esta sesión de QA, así que no se consultó. Las fuentes son el ticket, el código (CodeGraph), `CLAUDE.md` y `.claude/rules/`.

#### Objetivo

Comprobar con evidencia que el PR 2:

- cumple CA-1 a CA-18 en su parte de la interfaz, y sobre todo CA-13 (accesibilidad y responsive en navegador), CA-14 (solo lectura) y CA-15 (retorno tras entrar);
- es seguro: mismo origen, CSRF, sesión, cookie reescrita, sin secretos en los logs y con `noindex`;
- no rompe los productos (REQ-F-039) en ninguno de los dos admins, ni el bot, el menú o la recuperación por consola del `/admin` actual.

#### Requisito bajo prueba

- RF-1, RF-2, RF-3 a RF-10 y RF-14 a RF-17 en `inventory-manager`; RF-11 a RF-13 en su parte de la interfaz; RF-18; RF-19 en `landing-pages`.
- Las desviaciones aprobadas, que se verifican así:

| Desviación | Cómo se verifica |
| --- | --- |
| D-1. Tarjetas (`<ul>` con un `<dl>` por usuario) en lugar de tabla | En navegador, a 375, 768 y 1440 px: se leen los 6 datos de RF-3 por usuario, con su término (`dt`), sin desplazamiento horizontal |
| D-2. `autocomplete="off"` en el usuario de acceso del alta y la edición | DOM; en Chrome con credenciales guardadas, el campo no se rellena con el usuario del administrador. "Mi cuenta" y las contraseñas mantienen `current-password` y `new-password` |
| D-3. El panel "Estado y contraseña" solo en la carga inicial | Tras un 422, un 409 y un 503 en la edición: el formulario sigue siendo usable, sin enlaces rotos, y la ausencia del panel no confunde (hay "Volver a usuarios") |
| D-4. Navegación "Secciones" | `aria-label="Secciones"` en el `nav`, con un solo `nav` con ese nombre y `aria-current="page"` en la sección activa |
| D-5. `admin-products-moved.test.ts`: `/admin/cuenta` pasa a 410 | Revisión del diff: solo cambia esa expectativa; el resto de la prueba sigue igual y pasa |
| D-6. `.claude/CLAUDE.md` §8 | Diff: solo cambian las descripciones de `api` e `inventory-manager`, coherentes con CA-18 |

#### Criterios de aceptación y pruebas que los cubren

| CA | Qué se valida en el PR 2 | Pruebas |
| --- | --- | --- |
| CA-1 | Un editor no ve "Usuarios"; 403 "Sin permiso" sin datos en cada `/usuarios*` (GET y POST, también con su id); sin sesión, al acceso | `users.test.ts`, B-6, Q-3 |
| CA-2 | Lista con los campos de RF-3, "Todos", "Nunca", fecha en la zona del negocio y orden de la API | `users.test.ts`, B-2 |
| CA-3 | Alta sin JS y con JS (PRG y aviso); 422 por campo conservando lo escrito sin contraseñas; repetido con otras mayúsculas; el usuario entra en los dos admins | `users.test.ts`, `admin-users-e2e.test.ts`, B-3 |
| CA-4, CA-5, CA-7 | Cambiar negocios, desactivar, reactivar y restablecer desde el admin nuevo cierran las sesiones de los dos admins | `admin-users-e2e.test.ts`, B-7 |
| CA-6 | 409 del último administrador con aviso urgente que recibe el foco y no cambia nada; autodegradación al acceso con el aviso "Tu sesión se cerró" | `users.test.ts`, B-5 |
| CA-8 | "Mi cuenta": cookie reescrita, la sesión sigue en este navegador y cae en el otro admin; actual incorrecta en su campo; campos ajenos con 400 | `users.test.ts`, `admin-users-e2e.test.ts`, B-7 |
| CA-9 | `Origin` ajeno o `Sec-Fetch-Site` distinto: 403 sin llamar a la API; sin token o con el de otra sesión: "Petición no válida" | `users.test.ts`, Q-2 |
| CA-10 | API caída (`down` y `writes-down`): 503 "Servicio no disponible", lo escrito conservado sin contraseñas, sin trazas | `users.test.ts`, B-4 |
| CA-11 | 404 en ids inexistentes o mal formados; PRG: el botón atrás no reenvía | `users.test.ts`, B-3 |
| CA-12 | `no-store`, `X-Robots-Tag: noindex, nofollow` y `<meta name="robots">`; logs de los tres procesos sin secretos | `users.test.ts`, `admin-users-e2e.test.ts`, B-8 |
| CA-13 | Teclado, foco visible, etiquetas, errores asociados y no solo por color; sin desplazamiento horizontal a 375 px y en escritorio | `users.test.ts` (jsdom), B-1 a B-6 |
| CA-14 | `/admin` actual con `ADMIN_NEW_URL`: lista sin controles con aviso y enlace; 410 en 4 GET y 7 POST sin escribir en `user` ni en `user_audit`; editor con 403; bot, menú y `admin:recover` intactos; sin la variable, como hoy | `admin-users-moved.test.ts`, `admin-users.test.ts`, `admin-account.test.ts`, B-9, Q-1 |
| CA-15 | `next` hacia las 5 pantallas nuevas; destinos externos o mal formados vuelven a `/` | `users.test.ts`, `config-session.test.ts`, Q-4 |
| CA-16 | `inventory-manager` solo importa `contracts` y `web` | G-1 (lint), `dependency-rule.test.ts` |
| CA-17 | `typecheck`, `lint` y `test` en 0 en local. El CI real queda para T4 | G-1, G-2 |
| CA-18 | `arquitectura.md` §8, `.claude/CLAUDE.md` §8, `README.md`, `docs/despliegue.md`, `docs/desarrollo.md` y `.env.example` describen lo implementado, sin funcionalidades inexistentes | Revisión del diff (DOC-1) |

#### Riesgos identificados

- **Cabecera a 375 px:** con "Usuarios", "Mi cuenta" y "Salir" puede desbordar o dejar áreas táctiles por debajo de 44 px.
- **Foco y avisos:** el aviso del 409 debe recibir el foco y anunciarse; el resumen de errores debe enlazar a cada campo.
- **Autorrelleno del navegador:** con `autocomplete="off"` Chrome puede seguir rellenando el usuario o la contraseña del administrador en el alta.
- **Cookie reescrita:** si la cookie nueva no sustituye a la anterior (nombre, ruta o atributos distintos), el usuario quedaría fuera tras cambiar su contraseña.
- **Solo lectura incompleta:** una ruta POST o GET de usuarios o cuenta del `/admin` actual que siga escribiendo, o que lea el cuerpo antes del 410; el orden sesión → permiso → id → 410.
- **XSS:** el nombre visible y el usuario de acceso se pintan en la lista, la edición, la cabecera y la lista de solo lectura.
- **Regresión de productos** por la extracción de `controllers/common.ts` y por la cabecera nueva.
- **Datos de la revisión en navegador:** la pila de `npm run dev` usa la base local de desarrollo (`restaurante` en `127.0.0.1:3307`, contenedor `mysql-dev`), no una `restaurante_test*`. Ver la pregunta 2 de "Decisiones para el usuario".
- **Entorno:** pruebas con tres procesos, sensibles a puertos y tiempos; `mysql-dev` compartido (un 1040 es de entorno).

#### Pruebas en navegador (Claude in Chrome)

**Preparación (P-0):**

1. Desde `restaurante/`: `npm run db:up` y `npm run build:css`.
2. Una cuenta de QA: `npm run admin:recover -- --usuario qa040-admin`, con la contraseña por la entrada estándar. Así no hace falta la contraseña del administrador real. Si la decisión 2 es B, se hace sobre la base de QA.
3. `ADMIN_NEW_URL=http://127.0.0.1:3003` solo en el entorno del proceso (`ADMIN_NEW_URL=… npm run dev`), sin editar `landing-pages/.env`. Si `npm run dev` no la toma del entorno, se añade al `.env` y se retira al terminar, dejando `git status` igual.
4. Servicios: API en 3001, landings en 3000 y admin nuevo en 3003. Si alguno no arranca por configuración, se registra como bloqueo de entorno.
5. Una pestaña nueva tras `tabs_context_mcp`; se cierra al terminar. Los servidores se detienen al final y se comprueba con `ps` que no queda ninguno.

**Recorridos (viewports 375×812, 768×1024 y 1440×900, salvo que se diga otra cosa):**

- **B-1. Responsive (CA-13):** en `/usuarios`, `/usuarios/nuevo`, `/usuarios/:id/editar`, `/usuarios/:id/contrasena`, `/cuenta` y `/acceso?ok=sesion_cerrada`:
  - `document.documentElement.scrollWidth <= innerWidth` en los tres tamaños;
  - la cabecera hace salto de línea sin cortar textos;
  - las áreas táctiles de enlaces y botones miden al menos 44 px de alto (`getBoundingClientRect`);
  - con un nombre visible y un usuario de 60 caracteres sin espacios, la tarjeta no desborda.
  - Capturas a 375 y 1440 px de cada pantalla.
- **B-2. Lista (CA-2, D-1):** con al menos un administrador, un editor de un negocio y un desactivado: los 6 datos de RF-3 por tarjeta, "Todos", "Nunca", fecha con la hora del negocio, activos primero, y el estado en texto, no solo en color.
- **B-3. Alta y edición (CA-3, CA-11):**
  - alta válida → aviso de éxito en la lista; el botón atrás no reenvía el formulario;
  - alta con errores (nombre vacío, contraseña corta, confirmación distinta): cada error junto a su campo con el texto "Error:", `aria-invalid` y `aria-describedby`, resumen con enlaces que llevan el foco al campo; usuario y nombre conservados, contraseñas vacías;
  - usuario repetido con otras mayúsculas: error en ese campo;
  - con JS: "Guardando…" y sin doble envío (doble clic rápido). Sin JS (JavaScript desactivado en la pestaña, o con `submit-guard` ausente si la extensión no lo permite): el alta funciona igual;
  - edición: cambiar el rol a administrador oculta o ignora los negocios, sin perder lo escrito;
  - D-3: provocar un 422 en la edición y comprobar que el formulario sigue usable.
- **B-4. Servicio no disponible (CA-10):** con el admin nuevo arrancado y la API detenida, enviar el alta y "Mi cuenta": aviso "Servicio no disponible", lo escrito conservado sin contraseñas y sin trazas en la página. Después se vuelve a arrancar la API.
- **B-5. Último administrador (CA-6):** con `qa040-admin` como único administrador activo de la base de la revisión (o la decisión 2), intentar desactivarse y pasarse a editor: aviso con `role="alert"` y el foco en él (`document.activeElement`), lo escrito conservado y nada cambia. Si hay otros administradores activos en la base local, este caso solo se cubre por pruebas automáticas y se indica.
- **B-6. Editor (CA-1):** entrar como el editor creado: la cabecera no muestra "Usuarios"; `/usuarios` y `/usuarios/<id>/editar` por URL directa muestran "Sin permiso" sin datos; "Mi cuenta" sí.
- **B-7. Sesiones entre los dos admins (CA-4, CA-5, CA-7, CA-8):** el editor con sesión en `127.0.0.1:3003` y en `127.0.0.1:3000/admin/login`; el administrador le cambia los negocios → las dos sesiones caen en su siguiente petición. Después el editor cambia su contraseña en "Mi cuenta": sigue con sesión en el admin nuevo (navega a otra pantalla), su sesión del `/admin` actual cae. Con un administrador que no es el último, degradarse a sí mismo lleva a `/acceso?ok=sesion_cerrada` con el aviso.
- **B-8. Teclado y foco (CA-13):** recorrido completo solo con el teclado en las 5 pantallas: el salto al contenido es el primer tabulado y lleva a `main`; el orden sigue la lectura; el foco es visible (contorno `#eab308` de 2 px, comprobado con `getComputedStyle` en enlaces, botones, campos y casillas); "Desactivar" y "Reactivar" son `<button>` dentro de un `<form method="post">` y se activan con Intro y Espacio; ninguna trampa de foco. Además: un solo `h1` y `h2` por bloque, `lang="es"`, `meta robots` `noindex`, y sin errores en la consola.
- **B-9. Solo lectura del `/admin` actual (CA-14):** en `127.0.0.1:3000/admin/usuarios` como administrador: la lista con los datos, sin botones ni enlaces de crear, editar, contraseña, desactivar o reactivar, con el aviso y el enlace a `http://127.0.0.1:3003/usuarios`; `/admin/usuarios/nuevo`, `/admin/usuarios/<id>`, `/admin/usuarios/<id>/contrasena` y `/admin/cuenta` muestran el aviso y el enlace equivalente (410 comprobado con `read_network_requests` o `fetch`). La navegación del `/admin` actual sigue llevando a "Usuarios" y "Mi cuenta", y el bot y el menú abren. Responsive a 375 px de la lista de solo lectura y del aviso.
- **B-10. Productos (REQ-F-039) en el admin nuevo:** la lista, el alta y la edición de un producto de Molotes y de Birria con la cabecera nueva, a 375 px y en escritorio, y "Usuarios" sin `aria-current` en esas pantallas.

`_stich_source_/` no tiene diseño del admin (Technical Action Plan, "Frontend"): la referencia visual es el sistema P-4 de REQ-F-039 (tokens, `field`, `notice`, `button`, `admin-header`). Se comprueba que las pantallas nuevas usan esos mismos componentes y tokens, sin colores, tipografías ni espaciados nuevos.

Si la extensión no responde tras 2 o 3 intentos, B-1 a B-10 quedan pendientes de revisión manual del usuario. Como CA-13 depende de la revisión en navegador, en ese caso el resultado sería `NEEDS_USER_DECISION`.

No se pulsa nada que abra diálogos del navegador.

#### Pruebas de seguridad

- **S-1. CSRF y mismo origen (CA-9):** las pruebas existentes de `users.test.ts` y, en la sonda Q-2, un POST a `/usuarios`, `/usuarios/:id/desactivar` y `/cuenta` con `Origin` ajeno, sin `Origin` con `Sec-Fetch-Site: cross-site` y sin `_csrf`: 403 y nada cambia en MySQL (sonda contra la API real, ver Q-2).
- **S-2. Sesión:** cookie `__Host-admin_sid` (en modo producción, en `config-session.test.ts`), `HttpOnly` y `SameSite=Strict`, con el mismo nombre y atributos tras reescribirse; la anterior deja de valer (e2e).
- **S-3. Secretos (CA-12):** búsqueda en los logs capturados de los tres procesos (e2e, Q-1 y Q-2) de las contraseñas usadas, `scrypt$`, ids de sesión, cookies y tokens CSRF. En la revisión en navegador, la consola de los tres procesos de `npm run dev` se revisa igual.
- **S-4. `noindex` y `no-store`:** en todas las respuestas nuevas, también en los 403, 404, 410 y 503.
- **S-5. XSS:** un nombre visible `<img src=x onerror=alert(1)>` y un usuario con `"` y `<`: se pintan escapados en la lista y la edición del admin nuevo, la cabecera y la lista de solo lectura del `/admin` actual (Q-1 y B-2, sin ejecutar el script).

#### Pruebas negativas y casos límite

- Un administrador se restablece su propia contraseña desde "Usuarios": cierra también la sesión actual (`users.test.ts`).
- Sesión caducada a mitad de un formulario: al acceso con `expirada=1` y sin contraseñas conservadas (`users.test.ts`).
- Doble envío del alta: un único usuario (e2e y B-3).
- Contraseña multibyte de 12 caracteres: se acepta por la interfaz (B-3).
- `?ok=` con una clave fuera de la lista: no se muestra ningún aviso (Q-3).
- POST de solo lectura sin sesión: 303 al acceso; de un editor a usuarios: 403; en ambos casos sin cambios en `user` ni `user_audit` (Q-1).

#### Pruebas de regresión

- **R-1. Productos en el admin nuevo:** `inventory-manager/tests/integration/products.test.ts`, `access.test.ts` y `js-server.test.ts`, sin cambios en las pruebas (la extracción de `common.ts` no debe cambiar comportamiento), más B-10.
- **R-2. Productos en el `/admin` actual:** `admin-products-moved.test.ts` (solo cambia la expectativa de D-5) y las pruebas de productos de `landing-pages` sin la variable.
- **R-3. `/admin` actual sin `ADMIN_NEW_URL`:** `admin-users.test.ts`, `admin-account.test.ts` y `admin-authorization-matrix.test.ts`, que no deben haber cambiado (`git diff`).
- **R-4. Bot, menú y recuperación por consola:** `admin-users-moved.test.ts` ("el resto del /admin funciona igual") y sus pruebas propias en la suite.
- **R-5. API:** las 144 pruebas de `api` y `users-api-process.test.ts` y `users-api-qa-req-f-040.test.ts` (PR 1).
- **R-6. Landings públicas:** la suite de `landing-pages` (HTML, SEO y avisos), sin cambios en ellas.
- **R-7. Repositorio de usuarios:** `user-repository.test.ts` y `last-admin-concurrency.test.ts` sin cambios (`git diff`), y pasan.
- **R-8. Alcance del diff:** ningún cambio en `deploy/`, `packages/core`, `packages/db` ni en las pruebas anteriores salvo D-5 y `config-session.test.ts`.

#### Pruebas automatizadas

**Comandos generales (desde `restaurante/`):**

- **G-1.** `npm run typecheck` y `npm run lint` (0, sin avisos). No se ejecuta `lint:fix`.
- **G-2.** `npm run build:css` y `npm test -- --maxWorkers=4` completo (`api`, `landing-pages`, `inventory-manager` y paquetes). El fallo esperado que ya existía (`local-server.test.ts`, `it.fails`) se identifica por su nombre.
- **G-3. Estabilidad:** 5 ejecuciones aisladas seguidas de las pruebas con procesos: `admin-users-e2e.test.ts`, `admin-users-moved.test.ts`, `users-api-process.test.ts`, `users-api-qa-req-f-040.test.ts`, `admin-e2e.test.ts` e `inventory-manager-qa-req-f-039.test.ts`, más `inventory-manager/tests/integration/users.test.ts`. Además, 2 ejecuciones completas de la suite con `--maxWorkers=4`.
- **G-4.** `git status` y `git diff --stat` antes y después: QA solo añade la sonda (si se aprueba) y edita este ticket. `build:css` genera archivos ignorados por git.

**Sonda nueva propuesta (sujeta a la decisión 1):** `landing-pages/tests/integration/inventory-manager-qa-req-f-040.test.ts`, con la convención de `inventory-manager-qa-req-f-039.test.ts`: MySQL real (`setupAdmin()`/`makeDatabase()`, solo `restaurante_test*`), la API e `inventory-manager` como procesos con `freePorts`, y `expect.poll` sobre los logs.

- **Q-1. Solo lectura completa:** con `ADMIN_NEW_URL`, recuento y contenido de `user` y `user_audit` antes y después de: los 7 POST sin sesión (303), de un editor (403) y de un administrador con cuerpo malicioso (`role=admin`, 20 KiB); la lista de solo lectura escapa un nombre con HTML (S-5).
- **Q-2. Mismo origen y CSRF contra la API real:** los POST de S-1 en el admin nuevo dejan `user` y `user_audit` sin cambios.
- **Q-3. Avisos y permisos:** `?ok=` desconocido no pinta nada; un editor con un formulario POST forjado a `/usuarios/<su id>` con `role=admin` recibe 403 y sigue siendo editor en la base.
- **Q-4. Retorno (CA-15):** tras entrar con `next=/cuenta` y `next=/usuarios/<id>/contrasena` se vuelve a ellas; con `next=/usuarios/0/editar`, `next=/%2F%2Fevil.example` y `next=https://evil.example`, a `/`.

#### Pruebas de performance

- Duración de `admin-users-e2e.test.ts`, `admin-users-moved.test.ts`, `users.test.ts` y de la suite completa con `--maxWorkers=4`.
- En navegador (B-8): número de peticiones por pantalla nueva, sin JS nuevo (solo `submit-guard.js` y los módulos que ya había) y sin errores en la consola. Ningún proceso queda en segundo plano al terminar.

#### Pruebas SEO

Solo aplica `noindex`: el admin no se indexa (S-4 y B-8). Las landings públicas no cambian (R-6).

#### Evidencia requerida

- Salida resumida (archivos, pruebas y código de salida) de G-1 a G-3.
- Capturas a 375 y 1440 px de las pantallas de B-1 y de la lista de solo lectura (B-9), y los valores medidos de `scrollWidth`, alturas de áreas táctiles, foco (`outline`) y `document.activeElement` en el 409.
- Peticiones de red con los códigos 303, 403, 410 y 503 de los recorridos.
- Resultado de cada sonda Q con su aserción principal (recuentos de `user` y `user_audit`).
- `git status` y `git diff --stat` frente a `0bfa50a`.

#### Criterios de aprobación

- Los CA de la tabla pasan con evidencia, y CA-13 con la revisión en navegador.
- Las seis desviaciones se comprueban como se describe.
- No hay defectos `BLOCKER` ni `CRITICAL`; cualquier `MAJOR` se lleva al usuario.
- `typecheck`, `lint` y `npm test` terminan con 0, G-3 pasa en todas las repeticiones y la regresión R-1 a R-8 no presenta fallos.

#### Decisiones para el usuario

1. **Sonda Q-1 a Q-4:** ¿se crea `landing-pages/tests/integration/inventory-manager-qa-req-f-040.test.ts` y se conserva en el PR, como en el PR 1 (recomendado), se crea solo durante el QA y se borra al terminar, o no se crea (Q-1 a Q-4 se cubren solo en navegador y con `curl`)?
2. **Base de la revisión en navegador:** (A, recomendado) la base local de desarrollo de `npm run dev` (`restaurante` en `mysql-dev`, no producción), donde quedarán `qa040-admin` y los usuarios de QA con el prefijo `qa040-`, desactivados al terminar (no se pueden eliminar), más sus entradas de `user_audit`; o (B) una base aparte `restaurante_test_qa040`, migrada para la revisión y borrada al final, con `DATABASE_URL` sustituida solo en el entorno de los procesos.
3. **`ADMIN_NEW_URL` local:** ¿se permite, si `npm run dev` no la toma del entorno, añadirla temporalmente a `landing-pages/.env` y retirarla al terminar?

#### Aprobación del QA Action Plan del PR 2 (2026-10-29)

Respuestas textuales del usuario:

1. Plan: "Sí, apruebo el plan".
2. Sonda Q-1 a Q-4: "Conservarla en el PR (Recomendado)".
3. Base de la revisión en navegador: "Base aparte temporal" (opción B, `restaurante_test_qa040`, borrada al terminar; la base local de desarrollo no se toca; intentar B-5 en el navegador).
4. `ADMIN_NEW_URL`: "Sí, temporalmente" (no hizo falta: `npm run dev` la tomó del entorno).

#### Pull Request del PR 2

- **PR:** https://github.com/orvigas/negocio/pull/111, de `feature/REQ-F-040-admin-usuarios-2-inventory` hacia `epic/arquitectura`.
- **Commits:**
  - `ec19892`: `feat: gestiona los usuarios y la cuenta propia en el admin nuevo y deja el /admin actual en solo lectura (REQ-F-040, PR 2 de 2)`;
  - y este commit, `docs: registra el Pull Request del PR 2 de REQ-F-040`.
- **Base:** `origin/epic/arquitectura` seguía en `0bfa50a`, así que no hizo falta integrar nada.
- **Sonda de QA:** se incluye `landing-pages/tests/integration/inventory-manager-qa-req-f-040.test.ts`, que el usuario decidió conservar ("Conservarla en el PR (Recomendado)").
- **Estado:** `READY_FOR_MERGE` se registra en este commit para que entre en el merge, antes de marcar el PR como listo. El resultado del CI (`calidad`, `docker` y `auditoria`) se informa al usuario. Si el CI fallara, el estado se corregiría antes del merge.
- **Antes de llevar la épica a `main`:** avisar al personal de que "Mi cuenta" y los usuarios del `/admin` actual dejarán de funcionar (R-3; `docs/despliegue.md`). Queda pendiente la comprobación manual del autorrelleno de contraseñas en el navegador (D-2 del QA).

## QA Report

### PR 1 de 2: `api` y contratos

#### Ronda

1 (2026-10-29), en `feature/REQ-F-040-admin-usuarios-1-api`, sin commit, frente a `9354724`.

#### Pruebas ejecutadas (desde `restaurante/`)

| Prueba | Resultado |
| --- | --- |
| `npm run build:css` | 0 |
| `npm run typecheck` | 0 (antes y después de añadir la prueba de QA) |
| `npm run lint` | 0, sin avisos (antes y después de añadir la prueba de QA). No se ejecutó `lint:fix` |
| `npm test -- --maxWorkers=4` | 0. `api`: 7 archivos, 144 pruebas. `landing-pages`: 108 archivos, 2206 pasan y 1 fallo esperado (`local-server.test.ts`, "una prueba que falla a mitad (debe fallar)", `it.fails` que ya existía). `inventory-manager`: 7 archivos, 71 pruebas |
| `landing-pages/tests/integration/users-api-qa-req-f-040.test.ts` (nueva, 7 pruebas, MySQL real y la API como proceso) | 7 de 7 en 6 ejecuciones seguidas (unos 11 s cada una) |
| C-1: `users-api-process.test.ts -t "simultáneas"` (2 pruebas, 10 repeticiones cada una) | 2 de 2 en 5 ejecuciones seguidas |
| Regresión dirigida: `dependency-rule.test.ts`, `admin-users.test.ts`, `admin-account.test.ts`, `admin-authorization-matrix.test.ts`, `admin-products-moved.test.ts` | 5 archivos, 138 pruebas, todas pasan |
| `git diff 9354724 --stat` | 12 archivos modificados, más los 5 nuevos del Implementation Result y la prueba de QA. Ningún cambio en `deploy/`, `inventory-manager/`, `packages/db` ni en las pruebas del repositorio de usuarios |
| Procesos al terminar | 0 procesos de la API (`ps`). No se construyeron imágenes Docker |

Contenido de la prueba de QA:

- **Escalada (S-1):** un editor que se pone el rol `admin` por `PUT /usuarios/<su id>` recibe 403 `FORBIDDEN_ROLE`. En "Mi cuenta", `role`, `businesses`, `id`, `userId`, `__proto__` y `constructor` (enviados como JSON en crudo) dan 422 "Campo desconocido.". La tabla `user` y `user_audit` quedan idénticas y el usuario sigue siendo editor.
- **Privilegios perdidos (S-2):**
  - un admin degradado por otro recibe 401 con su Bearer en `GET /usuarios` y en `POST …/desactivar`;
  - un usuario desactivado recibe 401 en `/cuenta/contrasena`: su hash no cambia y no hay `password_change`.
- **Métodos y cabeceras (N-8, S-4):**
  - `DELETE` y `PATCH /usuarios/:id` dan 405 con `Allow`, sin cambios;
  - `HEAD /usuarios` de un editor da 403 sin cuerpo;
  - los 401, 403, 404, 422 y 405 llevan `no-store` y `nosniff`, con `{ error: { code } }` y sin trazas.
- **Validación (N-2, N-4, N-5, S-6):**
  - dan 422 en su campo, sin cambios: `username` numérico o `null`, `displayName` como array, `role: superadmin`, `businesses` como texto, desconocido o vacío para un editor, una contraseña de 257 caracteres y una numérica;
  - se acepta una contraseña de 256 caracteres multibyte, que sirve para entrar, y los negocios repetidos se guardan una sola vez;
  - desactivar con un cuerpo de más de 4 KiB da 413 y no cambia nada;
  - ninguna entrada de `user_audit` contiene hashes ni contraseñas.
- **Edición simultánea (F-7, RF-9):** dos `PUT` simultáneos, 10 veces. Los dos dan 200, queda guardado uno de los dos valores y cada uno deja su entrada `update`.
- **D-7, degradación mutua (C-2):** A y B se degradan entre sí a la vez, 10 veces.
- **D-7, operaciones sobre uno mismo (C-3):** uno se degrada a sí mismo mientras el otro se desactiva a sí mismo, 10 veces. Es una variante más exigente que la del plan ("B desactiva a A", que nunca podría dejar sin administradores): cada operación sola es válida, pero las dos juntas dejarían cero.
- **Resultado de C-2 y C-3:** en todas las repeticiones gana como mucho una petición, las demás reciben 409, 401 o 503, y siempre queda al menos un administrador activo (exactamente `2 - ganadoras`).

#### Criterios de aceptación (parte de la API)

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | `admin-users-api.test.ts` (401 en las 8 rutas; 403 al editor con su id, mal formado y `/usuarios/productos`; sin escrituras); S-1 y S-2 con MySQL |
| CA-2 | PASS | Lista con contrato, orden y `businesses: []` (`admin-users-api.test.ts`); `lastLoginAt` con `-06:00`/`-05:00` (`users-api-process.test.ts`) |
| CA-3 | PASS | 201, `create` con actor y sin hash, repetido con otras mayúsculas y doble envío con una sola fila, y entrada en los dos admins (`users-api-process.test.ts`); validación ampliada (QA) |
| CA-4 | PASS | D-8 en los dos sentidos entre los dos admins; el nombre no cierra; secuencia de `update` (`users-api-process.test.ts`) |
| CA-5 | PASS | Desactivar cierra las dos sesiones y bloquea la entrada; reactivar la permite; repetir no cambia nada |
| CA-6 | PASS | 409 `LAST_ADMIN` sin cambios con un solo admin; autodegradación y autodesactivación; concurrencia C-1 (5 ejecuciones), C-2 y C-3 (6 ejecuciones de 10 repeticiones) |
| CA-7 | PASS | Restablecer: sesiones cerradas en los dos admins, la anterior falla, la nueva sirve; `password_reset` |
| CA-8 | PASS | Sesión nueva y caída de las demás (también `/admin`); `password_change`; la actual incorrecta da 422 y no bloquea el login con 6 intentos; campos ajenos y claves especiales dan 422 sin cambios (QA) |
| CA-9 | PASS (API) | 403 `CSRF_INVALID` sin token, con el de otra sesión o falso, sin cambios. `Origin`: PR 2 |
| CA-10 | PASS (API) | 503 `DATABASE_UNAVAILABLE` sin trazas (doble; desviación 3 aprobada). Interfaz: PR 2 |
| CA-11 | PASS (API) | 404 `USER_NOT_FOUND` con 6 ids. PRG: PR 2 |
| CA-12 | PASS (API) | Respuestas sin `sessionVersion`, hashes ni contraseñas, con `no-store`; logs en proceso y del proceso real sin secretos; auditoría sin hashes (QA). `noindex`: PR 2 (decisión del usuario) |
| CA-16 | PASS | `dependency-rule.test.ts` y `npm run lint` en 0 |
| CA-17 | PASS en local | `typecheck`, `lint` y `test` en 0. CI real: T4 |
| CA-13, CA-14, CA-15 y CA-18 | No aplican | PR 2 |

#### Defectos encontrados

Ninguno.

#### Regresión

- **`/admin` actual sin `ADMIN_NEW_URL`:** usuarios, cuenta, la matriz de autorización, el bot y el menú pasan sin cambios en sus pruebas. Los tres mensajes de `core` tienen el mismo texto que antes (diff de `admin-users.ts`, `admin-account.ts` y `user-schema.ts`).
- **Con `ADMIN_NEW_URL`:** `admin-products-moved.test.ts` pasa.
- **Productos de la API:** la extracción a `responses.ts` es literal (mismo `send`, 422, mensaje y lista cerrada; el límite sigue en 64 KiB). Las 144 pruebas de `api` pasan, y `admin-api.test.ts` y `products-endpoint.test.ts` no cambiaron.
- **`inventory-manager`:** 71 de 71, sin cambios en su código.
- **Repositorio de usuarios:** `user-repository.test.ts` y `last-admin-concurrency.test.ts` no cambiaron y pasan.

#### Responsive, accesibilidad, UX/UI y SEO

No aplican al PR 1: no cambia HTML, CSS ni vistas. Las landings pasan sus pruebas de HTML (suite de `landing-pages`).

#### Performance

- `users-api-qa-req-f-040.test.ts` tarda unos 11 s y `users-api-process.test.ts` unos 13 s, con 7 procesos de la API cada uno.
- La suite completa con `--maxWorkers=4` terminó sin errores de conexión (1040) ni de puertos.

#### Pendientes de revisión manual

- Ninguno en el PR 1.
- El CI real (`calidad`, `docker` y `auditoria`) se comprueba en T4.
- La prueba nueva `users-api-qa-req-f-040.test.ts` debe entrar en el commit del PR 1.

#### Resultado final

QA_APPROVED

### PR 2 de 2: `inventory-manager`, solo lectura y documentación

#### Ronda

1 (2026-10-29), en `feature/REQ-F-040-admin-usuarios-2-inventory`, sin commit, frente a `0bfa50a`.

#### Pruebas ejecutadas (desde `restaurante/`)

| Prueba | Resultado |
| --- | --- |
| G-1. `npm run typecheck` | 0 (antes y después de añadir la sonda) |
| G-1. `npm run lint` | 0, sin avisos (antes y después de añadir la sonda). No se ejecutó `lint:fix` |
| G-2. `npm run build:css` | 0 (los CSS generados están ignorados por git) |
| G-2. `npm test -- --maxWorkers=4`, ejecución 1 (sin la sonda) | 0. `api`: 7 archivos, 144 pruebas. `landing-pages`: 111 archivos, 2224 pasan y 1 fallo esperado (`local-server.test.ts`, `it.fails` que ya existía). `inventory-manager`: 8 archivos, 111 pruebas |
| G-2. `npm test -- --maxWorkers=4`, ejecución 2 (con la sonda) | 0. `api`: 7 archivos, 144 pruebas. `landing-pages`: 112 archivos, 2225 pasan y 1 fallo esperado (el mismo). `inventory-manager`: 8 archivos, 111 pruebas |
| G-3. 5 ejecuciones aisladas seguidas de `admin-users-e2e`, `admin-users-moved`, `users-api-process`, `users-api-qa-req-f-040`, `admin-e2e`, `inventory-manager-qa-req-f-039` e `inventory-manager-qa-req-f-040`, más `inventory-manager/tests/integration/users.test.ts` | 37 de 37 y 30 de 30 en las 5 (unos 24 s por ronda) |
| Sonda nueva `landing-pages/tests/integration/inventory-manager-qa-req-f-040.test.ts` (Q-1 a Q-4, MySQL real y los tres procesos) | Pasa en 7 ejecuciones (1 aislada y 5 en G-3, además de la ejecución 2 de la suite) |
| G-4. `git status` | Solo se añadió la sonda y se editó este ticket. `landing-pages/.env` sin cambios (`shasum` `aebc195c…` antes y después). La base `restaurante_test_qa040` se creó, se migró y se borró al final |
| Navegador | Ver "Revisión en navegador" |

**Primera versión de la sonda:** falló por un error de la propia prueba, no del producto. La instantánea de `user` incluía `lastLoginAt` y `updatedAt`, que cambian cuando la sonda inicia sesión con el editor. Se excluyeron esos dos campos. Las escrituras reales (rol, estado, `sessionVersion`, hash y negocios) y `user_audit` siguen comparándose completas.

**Contenido de la sonda (Q-1 a Q-4):**

- **Q-1, solo lectura:** los 6 POST de usuarios y de "Mi cuenta" del `/admin` actual con `ADMIN_NEW_URL`:
  - sin sesión: 303 a `/admin/login`;
  - como administrador, con `role=admin` y un cuerpo de 20 KiB: 410 con `no-store`;
  - como editor: 403 en los de usuarios y 410 en `/admin/cuenta`;
  - `user` y `user_audit` quedan idénticas.
- **S-5, XSS:** un nombre visible `<img src=x onerror=alert(1)>` y un usuario `qa"<editor` se pintan escapados en la lista y la edición del admin nuevo y en la lista de solo lectura, sin ningún `img` en `main`.
- **Q-2, mismo origen y CSRF:** `POST /usuarios`, `/usuarios/:id/desactivar` y `/cuenta` con `Origin` ajeno, con `Sec-Fetch-Site: cross-site` sin `Origin` y sin `_csrf` dan 403 ("Petición no válida" sin token). La base no cambia.
- **Q-3, avisos y escalada:**
  - `?ok=desconocido`, `?ok=__proto__` y `/cuenta?ok=created` no pintan ningún aviso; `?ok=created` sí;
  - un editor que envía `role=admin` a `/usuarios/<su id>` recibe 403, sigue siendo editor y nada cambia.
- **Q-4, retorno tras entrar:**
  - se vuelve a `/cuenta`, `/usuarios`, `/usuarios/nuevo`, `/usuarios/<id>/editar` y `/usuarios/<id>/contrasena`;
  - vuelven a `/`: `/usuarios/0/editar`, `/usuarios/<id>/desactivar`, `//evil.example`, `/%2F%2Fevil.example`, `https://evil.example/usuarios` y `/usuarios?x=1`;
  - lo mismo ocurre en el campo oculto `next` del formulario.
- **CA-12:** los logs de los tres procesos no contienen las contraseñas usadas, `scrypt$`, los tokens CSRF ni los ids de sesión.

#### Revisión en navegador

**Entorno:**

- `npm run dev` con `DATABASE_URL` hacia `restaurante_test_qa040` y `ADMIN_NEW_URL=http://127.0.0.1:3003`, ambas solo en el entorno de los procesos. También `API_INTERNAL_URL`, `DATA_DIR` temporal y `ADMIN_USER=qa040-admin` con un hash generado.
- Así `qa040-admin` fue el único administrador (`adminStatus: created`).
- No hizo falta tocar `landing-pages/.env`.

**Claude in Chrome:**

- Se usó para entrar, ver la lista, desactivar a un usuario y comprobar la cabecera.
- `resize_window` no cambió el tamaño de la ventana (`innerWidth` siguió en 1064 tras dos intentos), y los marcos y las ventanas emergentes están bloqueados.
- Por eso las medidas por viewport se hicieron con Chrome real en modo headless, controlado por DevTools Protocol (`Emulation.setDeviceMetricsOverride` a 375×812, 768×1024 y 1440×900, y teclado con `Input.dispatchKeyEvent`), con un perfil temporal.
- Las capturas están en `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/295b6757-f3b3-4ee4-bf01-daa30ac9bc18/scratchpad/qa/shots/`.

| Recorrido | Resultado |
| --- | --- |
| B-1. Responsive | `scrollWidth` igual a `innerWidth` (375, 768 y 1440) en `/usuarios`, `/usuarios/nuevo`, `/usuarios/3/editar`, `/usuarios/3/contrasena`, `/cuenta`, `/acceso?ok=sesion_cerrada`, `/molotes/productos` y `/birria/productos`, y en `/admin/usuarios`, `/admin/cuenta` y `/admin/usuarios/nuevo` del `/admin` actual. Ningún elemento del admin nuevo sobresale. Un nombre visible de 60 caracteres y un usuario de 52, ambos sin espacios, se parten dentro de la tarjeta. Botones y enlaces de las pantallas nuevas de al menos 44 px, salvo el enlace de marca "Administración" (28 px, de REQ-F-039); los campos miden 42 px, igual que en productos |
| B-2. Lista (CA-2, D-1) | Tarjetas con usuario, nombre, rol, negocios ("Todos" para el administrador), estado en texto ("Activo" o "Desactivado", además del color) y último acceso (`29/10/2026 19:04`, la hora de Ciudad de México para 01:04 UTC) o "Nunca". Los activos van primero |
| B-3. Alta y edición (CA-3, CA-11) | Repetido con otras mayúsculas (`QA040-EDITOR`): error junto al campo con "Error:", lo escrito se conserva y las contraseñas quedan vacías. Varios errores: resumen `role="alert"` con enlaces a `#f-displayName` y `#f-password`; el enlace lleva el foco al campo, que tiene `aria-invalid` y `aria-describedby` hacia su ayuda y su error. `submit-guard`: "Guardando…" y, con dos `requestSubmit` y un clic seguidos, un solo usuario (`qa040-guard`). PRG: atrás vuelve al GET `/usuarios/nuevo` sin reenviar. La contraseña multibyte (`ñandú-12345á`) se aceptó como válida (el único error fue el usuario repetido). D-3: tras un 422 o un 409 en la edición no aparece el panel "Estado y contraseña", pero quedan "Volver a usuarios" y "Cancelar" y el formulario sigue usable |
| B-4. API detenida (CA-10) | Alta: 503 "Servicio no disponible", con usuario, nombre y negocio conservados, contraseñas vacías, sin trazas y sin la contraseña en el HTML. "Mi cuenta" (con la página ya abierta): aviso "no se cambió la contraseña", contraseñas vacías y sin trazas. `GET /cuenta` con la API caída: página "Servicio no disponible" |
| B-5. Último administrador (CA-6) | Con `qa040-admin` como único administrador. Pasarse a editor: 409, aviso `role="alert"` con el foco, nombre, rol y negocio conservados, y sigue siendo administrador. Desactivarse desde la lista: 409 con el aviso y el foco en él |
| B-6. Editor (CA-1) | La cabecera muestra Molotes, "Mi cuenta" y "Salir", sin "Usuarios". `/usuarios`, `/usuarios/3/editar`, `/usuarios/nuevo` y `/usuarios/2/contrasena` muestran "Sin permiso" sin filas ni datos |
| B-7. Sesiones (CA-4, CA-5, CA-7, CA-8) | Con la contraseña actual incorrecta: error en `currentPassword` y nada se repinta. Con la correcta: `/cuenta?ok=password_change` y la cookie `admin_sid` cambia de valor (`HttpOnly`, `SameSite=Strict`, `Path=/`). El editor sigue con sesión en el admin nuevo (`/molotes/productos`) y su sesión del `/admin` actual cae (`/admin` lleva a `/admin/login`). Un segundo administrador que se degrada a sí mismo termina en `/acceso?ok=sesion_cerrada` con el aviso "Tu sesión se cerró…", y al volver a entrar ya no ve "Usuarios" |
| B-8. Teclado y foco (CA-13) | En las 5 pantallas, el primer tabulado es "Saltar al contenido" y con Intro el foco va a `main#contenido`. El orden sigue la lectura y no hay trampas. Enlaces y botones: contorno sólido de 2 px `rgb(234, 179, 8)` (`#eab308`). Campos: el foco cambia el borde a `rgb(194, 65, 12)`, igual que en el formulario de productos de REQ-F-039. Espacio sobre "Desactivar" da `?ok=deactivated` e Intro sobre "Reactivar" da `?ok=reactivated`; los dos son `<button>` dentro de un `<form method="post">` con nombre accesible ("Desactivar a …"). Un `h1` por página, `lang="es"`, `meta robots` `noindex, nofollow`, todas las entradas con su `label` y `autocomplete` `off`, `new-password` y `current-password`. Ninguna contraseña lleva `value`. Solo se carga `/js/main.js`. 0 errores de JS en la consola (solo los avisos de red de los 4xx esperados) |
| B-9. Solo lectura del `/admin` actual (CA-14) | Como administrador: `/admin/usuarios` responde 200 con 6 filas, sin formularios, con el aviso y un solo enlace a `http://127.0.0.1:3003/usuarios`. Responden 410: `/admin/usuarios/nuevo`, `/admin/usuarios/2` (enlace a `/usuarios/2/editar`), `/admin/usuarios/2/contrasena` y `/admin/cuenta`. Responden 200: `/admin`, `/admin/molotes`, `/admin/birria` y `/admin/bot`. Todas con `no-store` y `X-Robots-Tag: noindex, nofollow`. Como editor, `/admin/usuarios` da 403 y `/admin/cuenta` da 410, con el enlace a "Mi cuenta" del admin nuevo |
| B-10. Productos en el admin nuevo | Listas de Molotes y Birria sin desplazamiento horizontal a 375, 768 y 1440 px; "Usuarios" sin `aria-current` en esas pantallas |

Logs de `npm run dev` y de la API reiniciada (989 líneas): 0 apariciones de las contraseñas usadas, `scrypt$`, `admin_sid` o `csrf`.

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | `users.test.ts`, B-6 y Q-3 (escalada forzada: 403 y sigue siendo editor) |
| CA-2 | PASS | `users.test.ts` y B-2 (campos, "Todos", "Nunca", hora del negocio y orden) |
| CA-3 | PASS | `users.test.ts`, `admin-users-e2e.test.ts` y B-3 (PRG, 422 conservando lo escrito sin contraseñas, repetido con otras mayúsculas, doble envío con un solo usuario) |
| CA-4 | PASS | `admin-users-e2e.test.ts` (cambio de negocios: caen las dos sesiones); PR 1 (solo el nombre no las cierra) |
| CA-5 | PASS | `admin-users-e2e.test.ts`; B-3 y B-8 (desactivar y reactivar con PRG y teclado) |
| CA-6 | PASS | B-5 en navegador con un único administrador (degradarse y desactivarse: 409 con el foco en el aviso y sin cambios); autodegradación con dos (B-7); concurrencia en G-3 (`users-api-process`, `users-api-qa-req-f-040`) |
| CA-7 | PASS | `admin-users-e2e.test.ts` y `users.test.ts` (también restablecerse la propia contraseña) |
| CA-8 | PASS | B-7 (cookie nueva, sigue la sesión aquí y cae en el `/admin` actual; actual incorrecta en su campo); `users.test.ts` (campos ajenos: 400) |
| CA-9 | PASS | `users.test.ts` y Q-2 contra la API real, sin cambios en la base |
| CA-10 | PASS | B-4 en navegador y `users.test.ts` (`down` y `writes-down`) |
| CA-11 | PASS | `users.test.ts` (404); B-3 (atrás no reenvía) |
| CA-12 | PASS | `no-store` y `noindex` (B-8, B-9 y Q-1); logs sin secretos en `admin-users-e2e`, la sonda y `npm run dev` |
| CA-13 | PASS | B-1 y B-8 en Chrome real a 375, 768 y 1440 px, más jsdom en `users.test.ts` |
| CA-14 | PASS | `admin-users-moved.test.ts`, Q-1 (sin sesión, editor y cuerpo malicioso) y B-9; sin la variable, `admin-users.test.ts`, `admin-account.test.ts` y la matriz de autorización no cambiaron (`git diff 0bfa50a`) y pasan |
| CA-15 | PASS | `users.test.ts`, `config-session.test.ts` y Q-4 |
| CA-16 | PASS | `npm run lint` en 0 (regla de dependencias de `inventory-manager`) |
| CA-17 | PASS en local | `typecheck`, `lint` y `test` en 0. El CI real queda para T4 |
| CA-18 | PASS | Diff de `arquitectura.md` §8 (tabla y "Paso 4, ticket 2 aplicado"), `.claude/CLAUDE.md` §8 (solo las dos descripciones), `README.md`, `docs/despliegue.md` (efecto de `ADMIN_NEW_URL` y aviso al personal), `docs/desarrollo.md` y `.env.example`, coherentes con lo implementado |

**Desviaciones:**

| Desviación | Resultado |
| --- | --- |
| D-1. Tarjetas | Correcta (B-1 y B-2) |
| D-2. `autocomplete="off"` | Correcto en el DOM (B-8). El autorrelleno real con credenciales guardadas no se pudo probar: el perfil headless no tiene contraseñas guardadas (ver pendientes) |
| D-3. Panel solo en la carga inicial | Correcta (B-3 y B-5): el formulario sigue usable |
| D-4. "Secciones" | Correcta: `aria-label="Secciones"` y `aria-current="page"` en la sección activa |
| D-5. `admin-products-moved.test.ts` | Correcta: solo cambian el comentario, el título de la prueba y la expectativa de `/admin/cuenta` (410) |
| D-6. `.claude/CLAUDE.md` §8 | Correcta: solo cambian las descripciones de `api` e `inventory-manager` |

#### Defectos encontrados

Ninguno.

**Observaciones sin defecto** (comportamientos que ya existían o que siguen el patrón aprobado):

- **OBS-1. Foco de los campos:** el anillo es un cambio de color del borde (`#ab8985` a `#c2410c`) con el contorno transparente. Es el componente `field` de P-4, igual que en productos (REQ-F-039). En enlaces y botones el contorno es el de `#eab308`.
- **OBS-2. Lista de solo lectura del `/admin` actual a 375 px:** la tabla se desplaza dentro de su contenedor (`overflow-x-auto`), como la lista de usuarios que ya existía. La página no se desplaza en horizontal.
- **OBS-3. Áreas táctiles heredadas:** el enlace de marca "Administración" del admin nuevo mide 28 px y los enlaces de la cabecera del `/admin` actual, 36 px. No son de este PR.

#### Regresión

- **R-1. Productos del admin nuevo:** `products.test.ts`, `access.test.ts` y `js-server.test.ts` sin cambios y en verde; B-10.
- **R-2. Productos del `/admin` actual:** `admin-products-moved.test.ts` (solo D-5) y las pruebas de productos en verde.
- **R-3:** `admin-users.test.ts`, `admin-account.test.ts` y `admin-authorization-matrix.test.ts` sin cambios (`git diff 0bfa50a`) y en verde.
- **R-4:** bot, menú y `admin:recover` con `ADMIN_NEW_URL` (`admin-users-moved.test.ts`); `/admin/bot`, `/admin/molotes` y `/admin/birria` con 200 en B-9.
- **R-5:** API con 144 de 144; `users-api-process` y `users-api-qa-req-f-040` estables en G-3.
- **R-6:** landings en verde en la suite.
- **R-7:** `user-repository.test.ts` y `last-admin-concurrency.test.ts` sin cambios y en verde.
- **R-8:** ningún cambio en `deploy/` ni en `packages/`.

#### Responsive

Sin desplazamiento horizontal a 375, 768 y 1440 px en todas las pantallas nuevas y en las de productos (B-1). Las capturas a 375 y 1440 px están en la carpeta indicada.

#### Accesibilidad

B-8 y B-3: teclado completo, salto al contenido, foco visible, etiquetas, errores asociados con "Error:" y no solo con color, resumen con enlaces, aviso urgente con el foco, botones POST y un `h1` por página. Ver OBS-1.

#### UX/UI

`_stich_source_/` no tiene diseño del admin. Las pantallas usan el sistema P-4 de REQ-F-039 (tokens, `field`, `notice`, `button` y `admin-header`), sin colores ni tipografías nuevos (capturas). El `/admin` actual conserva su estilo.

#### Performance

- Las pantallas nuevas solo cargan `/js/main.js` (no hay JS nuevo) y no tienen errores de JS.
- G-3 tarda unos 24 s por ronda con 7 archivos de procesos; la sonda nueva, unos 4 s.
- No quedó ningún proceso de `npm run dev`, de Chrome headless ni de pruebas al terminar.

#### SEO

`noindex, nofollow` en `X-Robots-Tag` y en `<meta name="robots">` en todas las pantallas revisadas. Las landings públicas no cambian.

#### Pendientes de revisión manual

- **D-2:** con contraseñas guardadas en el Chrome del usuario, comprobar que el alta y la edición no rellenan el usuario del administrador. No es un CA: la desviación ya está aprobada y el atributo es correcto.
- El CI real (`calidad`, `docker` y `auditoria`) se comprueba en T4.
- La sonda `landing-pages/tests/integration/inventory-manager-qa-req-f-040.test.ts` debe entrar en el commit del PR 2 ("Conservarla en el PR (Recomendado)").

#### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1 (2026-10-29)

Descripción inicial. Incluye:

- las decisiones del usuario: solo lectura en el `/admin` actual, auditoría fuera de alcance y paridad sin límite en "Mi cuenta";
- la paridad con REQ-F-007 para la autodesactivación de un administrador que no es el último;
- el CI sin el job `despliegue`;
- R-5 redactado con la épica ya en producción.

### Revisión técnica (2026-10-29)

Fase T1 (senior-fullstack): revisión técnica y Technical Action Plan en dos PR, con las decisiones P-1 (división en PR) y P-2 (pantallas de formulario del `/admin` actual en solo lectura) pendientes del usuario. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Aprobación del plan e inicio del PR 1 (2026-10-29)

El usuario aprobó el Technical Action Plan ("Sí, apruebo el plan") con P-1 "Dos PR (Recomendado)" y P-2 "Como productos (Recomendado)". Se añade la medición real de memoria de producción. Ticket movido a `in-progress/`, estado `IN_PROGRESS`, rama `feature/REQ-F-040-admin-usuarios-1-api`.

### Implementación del PR 1 (2026-10-29)

PR 1 de 2 (`api` y contratos) implementado en `feature/REQ-F-040-admin-usuarios-1-api`, con `typecheck`, `lint`, `build:css` y `test` en 0, y la concurrencia estable en 5 ejecuciones. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commit.

### QA Action Plan del PR 1 (2026-10-29)

El usuario aprobó la implementación del PR 1 ("Si"), con las cuatro desviaciones. Fase Q1 (senior-qa): QA Action Plan del PR 1 centrado en seguridad, D-7 y D-8 con MySQL real y regresión. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 1 (2026-10-29)

El usuario aprobó el QA Action Plan ("Sí, apruebo el plan"), decidió conservar las sondas en el PR ("Conservarlas en el PR") y dejó el `noindex` para el PR 2 ("Sí, en el PR 2 (Recomendado)"). Fase Q2 (senior-qa), ronda 1: prueba nueva `landing-pages/tests/integration/users-api-qa-req-f-040.test.ts` (7 pruebas, estable en 6 ejecuciones) y la suite completa en 0, sin defectos. Estado: `QA_APPROVED`.

### Pull Request del PR 1 (2026-10-29)

Commit `29dad31` y PR #110 (https://github.com/orvigas/negocio/pull/110) hacia `epic/arquitectura`, con la prueba de QA incluida. Estado: `READY_FOR_MERGE` (PR 1 de 2), sujeto a que el CI termine en verde.

### Merge del PR 1 e inicio del PR 2 (2026-10-29)

El usuario mergeó el PR #110 ("pr 110 mergeado"; merge `0bfa50a` en `epic/arquitectura`, con el CI en verde). Empieza el PR 2 en `feature/REQ-F-040-admin-usuarios-2-inventory`. Estado: `IN_PROGRESS`.

### Implementación del PR 2 (2026-10-29)

PR 2 de 2 (pantallas de `inventory-manager`, solo lectura del `/admin` actual con `ADMIN_NEW_URL`, e2e y documentación) implementado en `feature/REQ-F-040-admin-usuarios-2-inventory`, con `typecheck`, `lint`, `build:css` y `test` en 0, y las pruebas con procesos estables en 5 ejecuciones. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commit.

### QA Action Plan del PR 2 (2026-10-29)

El usuario aprobó la implementación del PR 2 ("Si lo apruebo"), con sus seis desviaciones. Fase Q1 (senior-qa): QA Action Plan del PR 2, con la revisión en navegador de CA-13 (375, 768 y 1440 px, teclado, foco, errores, último administrador y editor), la solo lectura del `/admin` actual, seguridad, regresión de productos en los dos admins, estabilidad de las pruebas con procesos y tres decisiones pendientes (sonda de QA, base de la revisión en navegador y `ADMIN_NEW_URL` local). Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA del PR 2 (2026-10-29)

El usuario aprobó el QA Action Plan del PR 2 ("Sí, apruebo el plan"), decidió conservar la sonda ("Conservarla en el PR (Recomendado)"), pidió una base aparte ("Base aparte temporal") y permitió `ADMIN_NEW_URL` temporal ("Sí, temporalmente"; no hizo falta). Fase Q2 (senior-qa), ronda 1:

- sonda nueva `landing-pages/tests/integration/inventory-manager-qa-req-f-040.test.ts`, estable en 7 ejecuciones;
- 2 ejecuciones completas de la suite en 0;
- las pruebas con procesos, estables en 5 rondas;
- revisión en Chrome real (headless por DevTools Protocol, porque `resize_window` no funcionó) a 375, 768 y 1440 px, con B-5 reproducido con un único administrador;
- base `restaurante_test_qa040` borrada y `landing-pages/.env` sin cambios.

Sin defectos. Estado: `QA_APPROVED`.

### Pull Request del PR 2 (2026-10-29)

Commit `ec19892` y PR #111 (https://github.com/orvigas/negocio/pull/111) hacia `epic/arquitectura`, con la sonda de QA incluida. Estado: `READY_FOR_MERGE` (PR 2 de 2), sujeto a que el CI termine en verde. El ticket pasa a `done/` en T5, tras el merge.

### Cierre (2026-10-30)

El usuario confirmó el merge del PR #111 ("Ya está mergeado"): merge `d5f5393` en `epic/arquitectura`, el 2026-10-30T01:21:04Z. El PR #110 se había mergeado antes (`0bfa50a`). Ticket movido a `done/`, estado `DONE`.

Pendientes antes de llevar la épica a `main`:

- **Avisar al personal (R-3):** tras el despliegue, "Mi cuenta" y la gestión de usuarios del `/admin` actual dejan de funcionar. Las contraseñas se cambian en "Mi cuenta" de `https://admin.birriaelmuneco.com` y las altas y cambios de usuarios, en "Usuarios" del admin nuevo (`docs/despliegue.md`).
- **Comprobación manual del autorrelleno (D-2 del QA):** comprobar en un navegador real que el gestor de contraseñas no rellena el usuario del administrador en el alta ni en la edición de usuarios, y que sí propone guardar la contraseña nueva en "Mi cuenta".
