# REQ-F-039 — Admin nuevo (`inventory-manager`) en `admin.birriaelmuneco.com` y gestión de productos por `/api/v1/admin`

## Estado

QA_APPROVED (PR 1 de 3: QA ronda 2 aprobada el 2026-10-27; DEF-001 y DEF-002 corregidos; DEF-003 corregido en la prueba; siguiente paso: commit y PR hacia `epic/arquitectura`)

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-26). Respuesta textual: "Sí, apruebo la versión 1".

Decisiones del usuario incorporadas (2026-10-26, citas textuales):

- Decisión B (tecnología): "Quiero que la api use koa.js y todo lo que usan las landing Pagés para que podamos unificar todo en una sola API" y "Va acusar koa.js y vainilla js". Tras pedirle que lo aclarara: "inventory-manager como las landings". Es una app Koa propia con SSR, plantillas, Tailwind y Vanilla JS, en su propio contenedor. Una sola API (`api`) sirve `/api/v1/public` y `/api/v1/admin`, y se mantiene la decisión A. Interfaz: "SSR + Vanilla JS que mejora (Recomendado)": formularios que funcionan sin JS, y el JS solo mejora la experiencia. Se registra en §9 de `restaurante/docs/arquitectura.md` como "Vanilla JS + SSR con Koa (como las landings)", **sin cambiar `.claude/CLAUDE.md` §2**.
- Diseño: "Sistema visual de las landings" (los `DESIGN.md` de `_stich_source_/`; no hay diseño específico del admin).
- División del paso 4: "Sí, 6 tickets en ese orden". El bot se mueve en el ticket 3.
- Frescura: "Aviso interno al instante (Recomendado)".
- Convivencia: "Solo lectura en el actual (Recomendado)".
- Imágenes: "Copiarlas en la imagen de api (Recomendado)".
- Subdominio: "Sí, admin.birriaelmuneco.com". El usuario crea el DNS antes de desplegar la épica a `main`.
- Acceso: "Sesión aparte en cada admin" (2 h de inactividad), "Ajustar el límite de Traefik" y "Credenciales fuera de landing-pages" (en el ticket 6, tras mover la importación de semillas y el menú).
- Dispositivos: "Ambos" (responsive).
- Menú (hero, destacado y promociones; archivos o MySQL): pendiente para el ticket 5.

Propuestas del análisis confirmadas por el usuario (2026-10-26, citas textuales):

- D-1 y D-2: "D-1/D-2: sesión y CSRF en api".
- D-3: "D-3: api sin publicar hasta el ticket 3".
- RF-13: "Recarga del bot cada 60 s".
- RF-18: "Límite Traefik 60/min, ráfaga 60".

Decisiones técnicas del usuario sobre la revisión técnica (2026-10-26, citas textuales):

- P-1: "Paquete packages/web (Recomendado)". RF-17 y CA-17 pasan a "solo `contracts` y `web`".
- P-2: "Tres PR (Recomendado)".
- P-3: "Aceptarlo así (Recomendado)".
- P-4: "Sí, lo valido" (base del `DESIGN.md` de Birria El Muñeco y acento por negocio).
- DEF-001 y DEF-002 de la QA del PR 1 (2026-10-27): "Ahora, en el PR 1 (Recomendado)".
- DEF-003 de la QA del PR 1, ronda 2 (2026-10-27): "Ahora, en el PR 1 (Recomendado)".
- Technical Action Plan: "Sí, aprobar e implementar PR 1" (aprobado completo con estas respuestas, 2026-10-26).

## Objetivo

Paso 4, ticket 1 de 6, del plan de migración (`restaurante/docs/arquitectura.md` §8). Que un usuario con permiso sobre un negocio gestione sus productos desde `https://admin.birriaelmuneco.com`, con las mismas reglas que hoy.

- El admin nuevo es la app `inventory-manager` (Koa con SSR, Tailwind y Vanilla JS, como las landings) y consume la API única `api` (`/api/v1/admin`) por la red interna.
- Las landings y el bot reflejan cada cambio al instante.
- La edición de productos del `/admin` actual queda en solo lectura.

El PR va a `epic/arquitectura` (`.claude/rules/git.md`).

## Decisiones de arquitectura

Con SSR, el navegador solo habla con `inventory-manager`. La cookie de §9 sigue en el mismo origen (`admin.birriaelmuneco.com`), y el CSRF se comprueba en el borde con el navegador y vuelve a validarse en la API.

- **D-1. La sesión pertenece a `api`; `inventory-manager` solo la transporta.**
  - El login lo resuelve `api`: comprueba la contraseña y el límite de intentos, y crea una sesión con su token CSRF.
  - `inventory-manager` guarda el id opaco en su cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, solo de su host y sin `Domain`) y lo reenvía a `api` en cada llamada interna.
  - Permisos, `sessionVersion`, caducidad y CSRF se deciden en un solo sitio: `api`.
  - Queda descartado que `inventory-manager` tenga las sesiones y llame a `api` con una credencial de servicio afirmando quién es el usuario (riesgo de *confused deputy*).
- **D-2. CSRF en dos capas.**
  - `inventory-manager` comprueba el mismo origen (`Origin` y `Sec-Fetch-Site`) en cada POST.
  - Inserta en cada formulario el token CSRF de la sesión, obtenido de `api`, y lo reenvía a `api` como `X-CSRF-Token`.
  - `api` lo valida contra la sesión, como hoy `/admin/api`.
- **D-3. En este ticket `api` no se publica en internet.**
  - El navegador no la necesita, porque lo que haga el JS de mejora va contra `inventory-manager`.
  - Es una desviación del texto de la decisión A ("la API en `admin.<dominio>/api`") y se registra en §9.
  - La publicación de una entrada de `api` llega en el ticket 3 (webhook del bot), que decidirá su host y su ruta.

## Alcance

1. **`api`** (Koa, la misma app de `/api/v1/public`):
   - acceso: entrar, salir y consultar la sesión vigente (usuario, permisos por negocio y token CSRF);
   - productos por negocio: listar (incluyendo eliminados si se pide y filtrando por categoría), ver, crear, actualizar con `version`, eliminar (borrado lógico), recuperar y reordenar una categoría;
   - contratos de esos endpoints en `packages/contracts` (Zod, decisión C).
2. **`inventory-manager`** (workspace nuevo, Koa con SSR):
   - pantallas de acceso, selector de negocio, productos (lista, alta, edición, eliminados, eliminar, recuperar y reordenar) y cierre de sesión;
   - funciona sin JavaScript; el JS solo mejora la experiencia.
3. **Frescura.** Tras cada escritura confirmada, `api` avisa a `landing-pages` por la red interna. `landing-pages` invalida la caché de la landing de ese negocio y la del catálogo del bot.
4. **`/admin` actual.** Con el admin nuevo activo, la edición de productos (páginas HTML y escrituras de `/admin/api`) queda en solo lectura, con un enlace al admin nuevo. Usuarios, cuenta, bot y menú no cambian.
5. **Imágenes.** La imagen de `api` lleva una copia de las imágenes de producto para validar `image.src`.
6. **Despliegue:**
   - imagen y servicio `inventory-manager`;
   - router de Traefik para `admin.birriaelmuneco.com` con HTTPS, redirección desde HTTP y límite de peticiones propio;
   - `deploy.sh` con el digest nuevo;
   - CI (calidad, docker, despliegue y smoke) y Dependabot.
7. **Documentación:**
   - `arquitectura.md`: §4, §6, §8 (plan de 6 tickets), §9 (decisión B y desviación D-3) y §10;
   - `docs/despliegue.md`, `docs/desarrollo.md` y los README.

## Fuera de alcance

- Usuarios y cuenta propia (ticket 2).
- Mover el bot a `api` (ticket 3).
- Control del bot (ticket 4).
- Menú y página (ticket 5).
- Retirar el `/admin` actual, quitar las credenciales de la base de `landing-pages`, mover la importación de semillas y activar la regla de lint para `/admin` (ticket 6).
- Crear el registro DNS: lo hace el usuario.
- Cambiar las reglas de negocio de los productos.
- Cambiar el HTML de las landings.

## Requisitos

### Acceso y sesión

- **RF-1. Entrar.**
  - Con usuario y contraseña válidos de una cuenta activa, se crea una sesión y se llega al selector de negocio, o directamente al único negocio permitido.
  - Si las credenciales no valen, el mensaje es genérico, no revela qué campo falló y no se crea sesión.
  - Las cuentas son las mismas del `/admin` actual (misma base). La sesión es independiente: entrar en uno no abre sesión en el otro.
- **RF-2. Límite de intentos.**
  - Se mantiene el límite de intentos de acceso actual, contado por la IP real del visitante.
  - `inventory-manager` reenvía esa IP y `api` solo la acepta de la red interna.
  - Al superarlo, se rechaza con un mensaje claro y sin comprobar la contraseña.
- **RF-3. Vigencia.**
  - La sesión caduca tras 2 h de inactividad y deja de valer si la cuenta se desactiva o cambia su `sessionVersion`.
  - Sin sesión válida, cualquier pantalla lleva al acceso y, tras entrar, vuelve a la pantalla pedida.
  - Solo se aceptan como destino rutas internas del admin (sin redirecciones abiertas).
- **RF-4. Salir.** Cerrar sesión la invalida en `api` y borra la cookie. Volver atrás no muestra datos nuevos sin entrar de nuevo.
- **RF-5. Cookie y CSRF.** Según D-1 y D-2. Las respuestas del admin no se guardan en caché (`no-store`) y llevan `noindex`.

### Permisos

- **RF-6.** Un usuario solo ve y edita los negocios en los que tiene permiso, con el modelo actual (`canEditBusiness`).
  - **API:** 401 sin sesión, 403 en un negocio no permitido y 404 en un negocio inexistente.
  - **Interfaz:** solo ofrece los negocios permitidos. Una URL directa a uno ajeno muestra "sin permiso", sin datos.

### Productos

- **RF-7. Reglas idénticas a las actuales:**
  - validación por campo (422 con `fields`);
  - máximo de productos activos;
  - slug único generado;
  - un producto nuevo se crea no disponible y al final de su categoría;
  - concurrencia optimista con `version` (409 con `current`);
  - historial con autor y fecha;
  - formato de error `{ error: { code, message } }`.
- **RF-8. Operaciones.** Listar los activos por categoría y en su orden, ver los eliminados, crear, editar, eliminar (con confirmación), recuperar y reordenar. Sin JS, reordenar es subir y bajar. Con JS se puede mejorar, con la misma regla.
- **RF-9. Conflicto (409).**
  - La pantalla conserva lo que escribió el usuario y muestra la versión vigente, con quién la cambió y cuándo.
  - El usuario puede recargar la versión vigente o volver a aplicar sus cambios sobre ella.
  - Nunca se guarda en silencio sobre la versión de otro.
- **RF-10. API no disponible.** Si `api` no responde o responde 503, el admin muestra un aviso claro y no pierde lo escrito en el formulario. Nunca muestra trazas ni detalles internos.
- **RF-11. Imagen.** Si la `image.src` no existe en las imágenes publicadas de la landing (la copia en la imagen de `api`), se rechaza con un error en ese campo.

### Frescura

- **RF-12. Efecto de cada escritura confirmada de productos en `api`:**
  - la siguiente visita a la landing de ese negocio muestra el cambio, igual que hoy (esperando como mucho el límite de 1,5 s del cliente de la API);
  - el bot ofrece el catálogo nuevo en su siguiente mensaje.
- **RF-13. Aviso interno.**
  - Solo es accesible desde la red interna (Traefik no lo enruta) y exige una credencial compartida configurable.
  - Si falla, la escritura no se deshace ni da error al usuario: el fallo se registra en el log y se reintenta de forma acotada.
  - Red de seguridad para cuando el aviso se pierde del todo:
    - las landings vuelven a la caducidad de 60 s;
    - el catálogo del bot se recarga como mucho cada 60 s (confirmado: "Recarga del bot cada 60 s").
- **RF-14.** Un aviso sin credencial o con una credencial incorrecta se rechaza y no invalida nada.

### Convivencia

- **RF-15.** Cuando la URL del admin nuevo está configurada en `landing-pages` (eso lo marca como activo):
  - las páginas de productos del `/admin` actual muestran los productos sin controles de edición, con un aviso y un enlace al admin nuevo;
  - cualquier POST de productos (HTML) o escritura de `/admin/api` no cambia nada. El HTML muestra el mismo aviso; la API responde con el formato de error estándar y el código `PRODUCTS_MOVED` (el código HTTP lo fija el plan técnico);
  - sin la URL configurada, el `/admin` actual se comporta exactamente como hoy.

### Interfaz

- **RF-16.**
  - Sigue el sistema visual de los `DESIGN.md` de las landings: colores, tipografías y componentes equivalentes. Lo que no exista en el diseño se propone en el plan técnico y se valida allí.
  - Es responsive para móvil y escritorio, y está en español.
  - Cumple `.claude/rules/accesibilidad.md` y `formularios.md`:
    - etiquetas en todos los campos;
    - errores accesibles, asociados a su campo y que no dependen solo del color;
    - foco visible y uso completo con teclado;
    - encabezados jerarquizados.
- **RF-17.** El código de `inventory-manager` solo importa `contracts` y `web` (P-1). Lo impone el lint, con su caso en `dependency-rule.test.ts`.

### Despliegue

- **RF-18. Subdominio y límite.**
  - `admin.birriaelmuneco.com` sirve `inventory-manager` con un certificado válido del resolver de Traefik, y HTTP redirige a HTTPS.
  - El subdominio tiene un límite de peticiones propio: 60 por minuto de media y ráfaga de 60 por IP (confirmado: "Límite Traefik 60/min, ráfaga 60").
  - `api` y el aviso interno no son accesibles desde internet.
  - El dominio y las rutas de las landings (incluido `/admin`) no cambian.
- **RF-19. Despliegue y CI.**
  - `deploy.sh` recibe y verifica la imagen nueva y levanta `inventory-manager` con su `HEALTHCHECK`. Si no queda sano, el despliegue falla con un código documentado y no deja sin servicio las landings ni la `api`.
  - El smoke del CI cubre el subdominio.
  - Se revisa la estimación de memoria con el contenedor nuevo frente al umbral del 80 % de §10. Si se supera, se vuelve al usuario antes de continuar.

## Historias de usuario

- **HU-1.** Como editor de un negocio, quiero entrar al admin nuevo desde el móvil o el escritorio y gestionar sus productos, para mantener el menú al día.
- **HU-2.** Como administrador, quiero que un editor solo vea su negocio, para evitar cambios ajenos.
- **HU-3.** Como cliente, quiero que la landing y el bot reflejen al momento que un producto ya no está disponible, para no pedir algo que no hay.
- **HU-4.** Como equipo, quiero que solo una administración escriba los productos, para evitar conflictos entre las dos.

## Criterios de aceptación

| CA | Given / When / Then |
| --- | --- |
| CA-1 | **Given** una cuenta activa, **When** entra con credenciales válidas en `admin.birriaelmuneco.com`, **Then** se crea la sesión y la cookie es `HttpOnly`, `Secure` y `SameSite=Strict`, sin `Domain`. Con credenciales inválidas: mensaje genérico y ninguna cookie de sesión |
| CA-2 | **Given** el límite de intentos superado para una IP, **When** intenta entrar otra vez, **Then** se rechaza sin comprobar la contraseña. Otra IP no queda afectada. La IP es la del visitante, no la de `inventory-manager` |
| CA-3 | **Given** una sesión con 2 h sin actividad, o de una cuenta desactivada desde el `/admin` actual, **When** pide cualquier pantalla, **Then** va al acceso y, tras entrar, vuelve a la pantalla pedida. Un destino externo en el parámetro de retorno se ignora |
| CA-4 | **Given** un editor de Molotes, **When** pide los productos de Birria (interfaz o API), **Then** recibe 403 y ningún dato de Birria. Un negocio inexistente da 404 y, sin sesión, la API da 401 |
| CA-5 | **Given** un POST del admin sin token CSRF, con el token de otra sesión o con un `Origin` ajeno, **Then** responde 403 y nada cambia en la base |
| CA-6 | Crear, editar, eliminar, recuperar y reordenar funcionan **con y sin JavaScript** y cumplen RF-7: el producto nuevo queda no disponible y al final, se respeta el máximo de activos, el slug es único y el historial registra el autor |
| CA-7 | **Given** dos sesiones con el mismo producto abierto, **When** la segunda guarda, **Then** recibe 409: su formulario conserva lo escrito y muestra quién cambió el producto y cuándo. Nada se sobrescribe |
| CA-8 | **Given** `api` caída, **When** el usuario guarda, **Then** ve el aviso de servicio no disponible, el formulario queda intacto y la respuesta no contiene trazas ni datos internos |
| CA-9 | **Given** un producto marcado como no disponible en el admin nuevo, **When** se visita justo después la landing de ese negocio, **Then** ya no aparece, y el siguiente mensaje al bot ya no lo ofrece. Todo sin reiniciar nada |
| CA-10 | **Given** un aviso interno con una credencial incorrecta, **Then** se rechaza y la caché no se invalida. El aviso no responde desde fuera de la red interna ni a través de Traefik |
| CA-11 | **Given** el aviso interno caído, **When** se guarda un producto, **Then** la escritura se confirma al usuario, el fallo queda en el log, y la landing y el bot muestran el cambio como mucho cuando vence su recarga de 60 s (P-3: en la landing, vencidos los 60 s, la siguiente visita lanza la recarga y la posterior muestra el cambio, *stale-while-revalidate* de §6) |
| CA-12 | **Given** una `image.src` que no existe en las imágenes de la landing, **Then** responde 422 con el error en `image.src`. Una imagen existente se acepta |
| CA-13 | **Given** la URL del admin nuevo configurada, **When** se usa la edición de productos del `/admin` actual, **Then** no hay controles de edición, se ve el enlace al nuevo, un POST no cambia nada y `/admin/api` responde `PRODUCTS_MOVED`. Usuarios, cuenta, bot y menú del `/admin` actual funcionan igual. Sin la URL configurada, todo funciona como hoy |
| CA-14 | Las pantallas del admin pasan la revisión de accesibilidad (teclado, foco visible, etiquetas y errores asociados a su campo) y se usan sin desplazamiento horizontal a 375 px y en escritorio |
| CA-15 | `https://admin.birriaelmuneco.com` responde con certificado válido y HTTP redirige a HTTPS. `api` y el aviso interno no son accesibles desde internet. `https://birriaelmuneco.com`, `/molotes`, `/birria` y `/admin` responden como antes, y las referencias HTML de las landings de REQ-F-038 no cambian. El subdominio aplica el límite de 60 por minuto con ráfaga de 60 por IP |
| CA-16 | Las respuestas del admin llevan `no-store` y `noindex`. Ningún log contiene contraseñas, tokens de sesión ni tokens CSRF |
| CA-17 | `inventory-manager` solo importa `contracts` y `web` (P-1): no puede importar `core`, `db` ni Prisma. El lint lo rechaza y `dependency-rule.test.ts` lo comprueba |
| CA-18 | `deploy.sh` despliega las cuatro imágenes. Si `inventory-manager` no queda sano, termina con su código documentado y las landings y la `api` siguen sirviendo. El smoke del CI cubre el subdominio |
| CA-19 | `typecheck`, `lint` y `test` terminan con 0 en la raíz, y el CI (`calidad`, `docker`, `despliegue` y `auditoria`) pasa en verde en el PR hacia `epic/arquitectura` |
| CA-20 | La documentación (`arquitectura.md` §4, §6, §8, §9 y §10, `despliegue.md`, `desarrollo.md` y los README) refleja la decisión B, la desviación D-3, el plan de 6 tickets, las variables nuevas y el paso del DNS a cargo del usuario |

## Casos límite

- **Sesión caducada a mitad de una edición.** Al enviar se va al acceso. Conservar lo escrito tras volver a entrar es deseable, pero no obligatorio sin JS; el plan técnico indica si es viable.
- **Doble envío del mismo formulario.** La segunda escritura recibe 409 por `version` o no duplica la creación (el mecanismo lo define el plan técnico).
- **Botón atrás tras salir o tras guardar.** No se reenvía el formulario (POST/redirect/GET) y no se muestran datos guardados en caché.
- **URL directa a un producto inexistente o de otro negocio.** 404 o 403, sin datos.
- **JavaScript deshabilitado.** Todas las operaciones de CA-6 funcionan.
- **Conexión lenta.** No hay doble envío y se indica que el envío está en curso.
- **`landing-pages` caída cuando `api` avisa.** Aplica CA-11.
- **Reinicio de `api`.** Se pierden las sesiones del admin nuevo (en memoria) y hay que volver a entrar. Es aceptado: hoy pasa igual con `/admin`.
- **DNS sin crear o sin propagar al desplegar.** El subdominio no responde y las landings siguen sin cambios.
- **Cuenta desactivada desde el `/admin` actual con una sesión abierta en el nuevo.** La sesión deja de valer en la siguiente petición (`sessionVersion`).

## Dependencias

- **DNS:** registro A de `admin.birriaelmuneco.com` hacia el VPS, a cargo del usuario, antes de desplegar la épica a `main`.
- **VPS:** reinstalar `deploy/` y dar al token de GHCR acceso de lectura a la imagen nueva de `inventory-manager` (pendiente heredado de REQ-F-038).
- **Diseño:** los `DESIGN.md` de `_stich_source_/`.
- **Contratos:** `packages/contracts` con Zod (decisión C).
- **Tickets anteriores:** REQ-F-036, REQ-F-037 y REQ-F-038, cerrados.

## Riesgos

- **R-1. Memoria del VPS** con un cuarto contenedor Node. Mitigación: revisar el umbral del 80 % (RF-19).
- **R-2. Aviso interno perdido** que deja datos viejos. Mitigación: reintentos acotados y recarga de 60 s en las landings y en el bot.
- **R-3. Superficie del reenvío de sesión** (D-1 y D-2): `inventory-manager` maneja el id de sesión. Mitigación: cookie solo del host, `no-store`, nada en los logs, y validación de sesión y CSRF en `api`.
- **R-4. Tamaño del ticket**, el mayor de la épica. Mitigación: el plan técnico puede proponer varios PR dentro del mismo ticket.
- **R-5. Imágenes duplicadas** en dos imágenes de contenedor. Ambas salen del mismo commit, pero una imagen nueva tiene que llegar a las dos. Se documenta.
- **R-6. Cambio de hábito del personal:** la edición de productos cambia de URL. Mitigación: aviso y enlace en el `/admin` actual.
- **R-7. Despliegue único de la épica:** todo llega a producción a la vez con el PR de `epic/arquitectura` a `main`, incluido el modo de solo lectura.

## Action Plan

### Objetivo

Admin nuevo operativo para productos en `admin.birriaelmuneco.com`, con la frescura "al instante" intacta y el `/admin` actual en solo lectura para productos.

### Cambios requeridos

1. Registrar en `arquitectura.md` la decisión B, la desviación D-3 y el plan de 6 tickets.
2. Contratos del admin en `packages/contracts`: sesión, productos y errores.
3. En `api`: acceso, sesión, límite de intentos (con la IP real reenviada), CSRF y permisos.
4. En `api`: endpoints de productos con las reglas de RF-7 y validación de imágenes contra la copia.
5. Aviso interno de `api` a `landing-pages` con credencial compartida. En `landing-pages`: invalidación de la caché de las landings y del bot, y recarga del bot cada 60 s como mucho.
6. Workspace `inventory-manager`: SSR, reenvío de sesión, pantallas, Vanilla JS de mejora y Tailwind con el sistema visual de las landings.
7. Modo de solo lectura de los productos en el `/admin` actual.
8. Imagen, servicio y router de Traefik con su límite; `deploy.sh`, CI, smoke y Dependabot.
9. Documentación.

### Reglas de negocio

RF-6 y RF-7, sin cambios respecto de hoy.

### UX/UI

RF-16: todo funciona sin JS y los errores se muestran por campo.

### Integraciones

- `api` ↔ `inventory-manager`: sesión reenviada.
- `api` → `landing-pages`: aviso interno.

### Orden recomendado

2 → 3 → 4 → 5 → 7 → 6 → 8 → 1 y 9.

### Resultado esperado

Los productos se gestionan solo desde el admin nuevo, y las landings y el bot están siempre al día.

## Plan del paso 4 (a registrar en §8 de `arquitectura.md`)

| # | Ticket | Notas |
| --- | --- | --- |
| 1 | **REQ-F-039**: base del admin nuevo y productos | Este ticket |
| 2 | Usuarios y cuenta propia | En `api` y en `inventory-manager` |
| 3 | Mover el bot a `api` | Publica una entrada de `api` para el webhook y cambia la URL en Meta (acción del usuario). Activa la regla de lint para el bot |
| 4 | Control del bot en el admin nuevo | Pausa, bloqueos y topes |
| 5 | Menú y página | Antes se decide si el menú queda en archivos o pasa a MySQL |
| 6 | Retirada del `/admin` actual | Mover la importación de semillas y el menú, quitar las credenciales de la base de `landing-pages`, quitar el router `restaurante-admin` y activar la regla de lint para `/admin` |

Los IDs de los tickets 2 a 6 se asignan al crearlos.

## Trazabilidad

| Objetivo | Requisitos | Historia | Criterios | Action Plan |
| --- | --- | --- | --- | --- |
| Acceso seguro | RF-1 a RF-5 | HU-1 | CA-1 a CA-3, CA-5 y CA-16 | 3 y 6 |
| Permisos | RF-6 | HU-2 | CA-4 | 3 y 4 |
| Productos | RF-7 a RF-11 | HU-1 | CA-6 a CA-8 y CA-12 | 4 y 6 |
| Frescura | RF-12 a RF-14 | HU-3 | CA-9 a CA-11 | 5 |
| Convivencia | RF-15 | HU-4 | CA-13 | 7 |
| Interfaz | RF-16 y RF-17 | HU-1 | CA-14 y CA-17 | 6 |
| Despliegue | RF-18 y RF-19 | Todas | CA-15 y CA-18 a CA-20 | 8 y 9 |

## Revisión técnica

Revisión del 2026-10-26 (senior-fullstack, fase T1). Se exploró con CodeGraph `/admin` y `/admin/api` (`admin-access`, `admin-api-access`, `admin-guard`, `session-store`, `login-throttle`, `admin-products`, `admin-products-api`, `product-form`), `product-repository` (mutex `exclusive`, `onChange`, `imageExists`, caché `getPublished`), `landing-products`, el orquestador del bot (`ctx.catalog` lee `products.getPublished`), `api/src`, `packages/contracts`, y se leyeron `deploy/compose.prod.yaml`, `deploy/deploy.sh`, `deploy/ci/smoke.sh`, `landing-pages/Dockerfile`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `arquitectura.md` §4 a §10 y los `DESIGN.md` de `_stich_source_/`.

El requisito es viable con la arquitectura actual. Hay cuatro puntos que necesitan una decisión del usuario antes de implementar (P-1 a P-4). El resto de los puntos delicados quedan resueltos en el Technical Action Plan.

### P-1. Código compartido entre las apps SSR (afecta a RF-17 y CA-17)

- **Problema.** `inventory-manager` necesita lo mismo que ya tiene `landing-pages` para servir HTML: el renderizador de plantillas (`src/views/render.ts`, 122 líneas), la lectura de formularios (`utils/form-body.ts`, 54), la comprobación de mismo origen (`assertSameOrigin`, 20) y el logger JSON (`createLogger`, en `core/shared`). RF-17 y CA-17 dicen que `inventory-manager` **solo** importa `contracts`, y una app no puede importar otra. Con la regla literal, todo eso se tiene que copiar (unas 250 líneas), contra `.claude/rules/componentizacion.md` y DRY.
- **Requisito afectado:** RF-17 y CA-17, y la tabla de dependencias de `arquitectura.md` §4.
- **Opción A (recomendada).** Un paquete nuevo, `packages/web` (`@restaurante/web`), con las utilidades HTTP/SSR sin dominio: `render.ts`, `form-body.ts`, `json-body.ts`, `same-origin.ts` y `logger.ts` (`createLogger` y `serializeError`).
  - `core/shared` conserva la interfaz `Logger`, `silentLogger` (sin E/S) y `errorProp`.
  - `web` no importa nada del proyecto (como `contracts`). Lo pueden importar `landing-pages`, `inventory-manager` y `api`; nunca `core`, `db` ni `contracts`.
  - RF-17 y CA-17 quedan como "`inventory-manager` solo importa `contracts` y `web`; nunca `core`, `db` ni Prisma". El lint y `dependency-rule.test.ts` lo imponen igual.
  - Sin dependencias nuevas: `koa` ya está en el lockfile.
- **Opción B.** Mantener la regla literal y copiar esas utilidades en `inventory-manager`, con una prueba que compare la salida del renderizador de las dos apps. Menos cambios en otros paquetes, pero queda código duplicado hasta que se retire el `/admin` actual (ticket 6), y el renderizador para siempre.
- **Decisión requerida:** A o B.

### P-2. División en PR (R-4)

- **Problema.** Es el ticket más grande de la épica. La estimación es de unos 60 a 80 archivos y entre 4500 y 6000 líneas con las pruebas. Un solo PR es difícil de revisar y de probar en QA.
- **Opción recomendada:** tres PR hacia `epic/arquitectura` dentro del mismo ticket. Cada uno pasa por su aprobación de implementación, su QA (sobre los CA de esa parte) y su CI en verde antes de empezar el siguiente. El ticket sigue en `in-progress/` hasta que se mergee el tercero.
  1. **Parte 1, `feature/REQ-F-039-admin-nuevo-productos-1-api`:**
     - `web`, si se elige P-1 A;
     - los movimientos a `core`;
     - contratos del admin;
     - `/api/v1/admin` en `api`, con el aviso interno;
     - en `landing-pages`, el receptor del aviso, la recarga del bot y el modo de solo lectura. Este modo queda **inactivo** sin `ADMIN_NEW_URL`, así que el comportamiento actual no cambia.
  2. **Parte 2, `feature/REQ-F-039-admin-nuevo-productos-2-inventory`:** workspace `inventory-manager` (pantallas, JS de mejora, Tailwind, pruebas y regla de lint).
  3. **Parte 3, `feature/REQ-F-039-admin-nuevo-productos-3-despliegue`:**
     - etapa Docker, `compose.prod.yaml` (servicio, red `admin` y Traefik), `deploy.sh` con cuatro imágenes;
     - `smoke.sh`, CI y Dependabot;
     - la prueba de extremo a extremo de CA-9, la documentación y la revisión de memoria.
- **Alternativa:** un solo PR.
- **Decisión requerida:** tres PR (y que la QA sea por parte) o uno.

### P-3. Interpretación de CA-11 en las landings (caché *stale-while-revalidate*)

- **Problema.** La caché de las landings (§6, REQ-F-038) es *stale-while-revalidate*: cuando vencen los 60 s, la **primera** visita recibe todavía la copia anterior y lanza la recarga en segundo plano; las siguientes ya ven el cambio. Así que, si el aviso interno se pierde, el cambio aparece "en la primera visita después de vencer + 1", no exactamente a los 60 s. El bot no tiene ese efecto, porque su recarga es un temporizador fijo de 60 s.
- **Requisito afectado:** CA-11 y RF-13 ("las landings vuelven a la caducidad de 60 s").
- **Opción A (recomendada):** aceptar el comportamiento actual de §6, que es la red de seguridad para un fallo poco frecuente. CA-11 se comprueba como "vencidos 60 s, la siguiente visita lanza la recarga y la posterior muestra el cambio".
- **Opción B:** que una entrada vencida haga esperar a la visita (como mucho 1,5 s, el límite del cliente). Cambia la latencia de las landings en cada vencimiento, no solo cuando falla el aviso.
- **Decisión requerida:** A o B.

### P-4. Sistema visual del admin (RF-16: "lo que no exista en el diseño se propone en el plan técnico y se valida allí")

- **Problema.** `_stich_source_/` tiene un sistema por landing, con paletas distintas: Molotes azul y ámbar; Birria rojo chile y dorado. No hay diseño del admin. Hoy el `/admin` usa la paleta de Tailwind y la fuente del sistema (comentario C-8 en `src/styles/admin/main.css`).
- **Propuesta (recomendada).**
  - **Base:** el sistema de `birrier_a_el_mu_eco/DESIGN.md`, la marca de la página de inicio:
    - fondo `#1c1412` y superficies `#261a17` / `#33221e` con borde `#432c27`;
    - texto `#fbf5ea` / `#d6c3b3`; primario `#b91c1c`, secundario `#c2410c`, terciario `#eab308`;
    - Epilogue para títulos y texto, Space Grotesk para etiquetas, desde Google Fonts como las landings;
    - radios de 8 px en tarjetas y campos y de 16 px en paneles;
    - componentes de ese `DESIGN.md`: botón primario, secundario y *ghost*, campos con foco `#c2410c` de 1,5 px, chips, tarjetas y casillas.
  - **Acento por negocio:** dentro de un negocio, la cabecera y el chip activo usan el primario de su `DESIGN.md`. Molotes usa `#1b5eb8` con ámbar `#f3a300` (`moloteando_tradicional`); Birria usa `#b91c1c` con dorado `#eab308`. Así se ve siempre en qué negocio se está editando.
  - **Errores y estados:**
    - error `#ffb4ab` sobre la superficie oscura, con icono y texto, nunca solo color;
    - éxito con el terciario (`#eab308`) y su texto;
    - contraste AA comprobado.
  - Lo que no existe en el diseño (tabla o lista de productos, filas con subir y bajar, avisos y la pantalla de confirmación) se construye con esos mismos tokens y componentes (tarjetas de Layer 1, botones *ghost* para subir y bajar, y un aviso tipo tarjeta con borde del color del estado).
- **Alternativa:** un admin neutro (paleta de Tailwind y fuente del sistema, como el `/admin` actual), que no sigue la decisión "Sistema visual de las landings".
- **Decisión requerida:** validar la propuesta o indicar cambios.

### Puntos delicados resueltos (sin decisión pendiente)

Quedan detallados en el Technical Action Plan:

- **Mecánica del reenvío de sesión, el CSRF y la IP real.**
- **Qué pasa a `core` y qué se queda en `landing-pages`.**
- **Un solo escritor:** con `ADMIN_NEW_URL`, el `/admin` actual no escribe productos y `api` (una réplica) serializa con su mutex. Entre procesos siguen valiendo la versión optimista (`replace` con `expectedVersion`) y el slug único (`SlugTakenError`).
- **El aviso interno:** puerto interno aparte en `landing-pages` que Traefik no enruta, credencial compartida, reintentos acotados y confirmación honesta de frescura.
- **La copia de imágenes:** misma ruta relativa en la imagen de `api` y del mismo commit.
- **La estructura de `inventory-manager`.**
- **Docker, Traefik, `deploy.sh` (orden y código 16), el smoke del subdominio, la memoria y Dependabot.**

**Revisión de memoria (RF-19):** con la medición del paso 1 (pico de 1142 MiB en el host y 84,1 MiB del contenedor Node), la estimación con tres contenedores Node es 1142 + 3 × 84,1 = **1394,3 MiB, el 35,6 %** de 3915 MiB. Queda muy por debajo del umbral del 80 % (3132 MiB): no hace falta volver al usuario. La parte 3 lo registra en §10.

## Technical Action Plan

Aprobado por el usuario el 2026-10-26 con P-1 A, P-2 (tres PR), P-3 A y P-4 validada.

**División en tres PR (P-2).** Cada PR tiene su propia aprobación de implementación (`NEEDS_IMPLEMENTATION_APPROVAL`), su QA sobre los CA de su parte y su CI en verde hacia `epic/arquitectura`, y solo entonces empieza el siguiente. El ticket sigue en `in-progress/` hasta que se mergee el tercero.

| PR | Rama | Alcance | CA principales |
| --- | --- | --- | --- |
| 1 | `feature/REQ-F-039-admin-nuevo-productos-1-api` | `packages/web`, movimientos a `core`, contratos del admin, `/api/v1/admin`, aviso interno, recarga del bot y modo de solo lectura (apagado sin `ADMIN_NEW_URL`) | CA-2, CA-4, CA-5, CA-6, CA-7 y CA-16 en la parte de la API, CA-10, CA-11, CA-12, CA-13 y CA-19 |
| 2 | `feature/REQ-F-039-admin-nuevo-productos-2-inventory` | Workspace `inventory-manager` y regla de lint | CA-1, CA-3, CA-4 a CA-8 en la interfaz, CA-14, CA-16, CA-17 y CA-19 |
| 3 | `feature/REQ-F-039-admin-nuevo-productos-3-despliegue` | Docker, compose, `deploy.sh`, smoke, CI, Dependabot, prueba de extremo a extremo y documentación | CA-9, CA-15, CA-18, CA-19 y CA-20 |

### Objetivo técnico

`api` pasa a ser la única que escribe los productos (`/api/v1/admin`), con la sesión y el CSRF en `api` (D-1 y D-2). `inventory-manager` es una app Koa SSR en `admin.birriaelmuneco.com` que solo transporta la sesión y habla con `api` por una red interna. Cada escritura confirmada avisa a `landing-pages` por un puerto interno (landing y bot al instante), con red de seguridad de 60 s. El `/admin` actual queda en solo lectura para productos cuando `ADMIN_NEW_URL` está configurada.

### Archivos o componentes afectados

**`packages/web` (nuevo, P-1 A).**
- `render.ts`, `form-body.ts` y `json-body.ts`, movidos desde `landing-pages`.
- `same-origin.ts` (`assertSameOrigin`, extraído de `admin-guard.ts`).
- `logger.ts` (`createLogger` y `serializeError`, desde `core/shared`).
- `index.ts` y `package.json` con `exports`.

**`packages/core`** (se mueve sin reescribir la lógica, como en el paso 2):
- `identity/session-store.ts` y `identity/login-throttle.ts`, desde `landing-pages/src/services`;
- `identity/session.ts` (nuevo, pequeño): `resolveSession({ sessions, users }, id)` con la regla actual (sesión vigente, usuario activo y `sessionVersion` igual). Lo extrae de `admin-guard.ts`;
- `catalog/product-repository.ts`, desde `landing-pages/src/repositories`. Son las reglas sobre el store: el caso de uso que comparten `api` y `landing-pages`. Se añaden:
  - `reload(business): Promise<boolean>` (recarga la caché y dice si pudo);
  - `init()` sin fuentes: solo carga la caché, sin importar semillas (lo usa `api`; la importación sigue solo en `landing-pages`, O-1);
- `catalog/product-form-fields.ts`: las hojas del formulario (`productFormLeaves`, `IMAGE_LEAVES`, `ROW_LEAVES`, `ROW_SLOTS`), desde `landing-pages/src/services/product-form.ts`, que se queda con el análisis del formulario HTML hasta el ticket 6;
- `catalog/product-dto.ts`: `toProductDto` (el `serialize` actual de `admin-products-api.ts`);
- `catalog/image-checker.ts`: `createImageChecker`, desde `services/admin-form.ts`;
- `shared/datetime.ts`: `toZonedIsoString`;
- se quitan `createLogger` y `serializeError` de `shared/logger.ts`, que pasan a `web`.

**`packages/contracts`:**
- `admin.ts`: esquemas Zod de:
  - sesión: entrada, respuesta de login, sesión vigente;
  - producto de administración (DTO), lista, descriptor del formulario (`productFormFieldSchema`);
  - errores 422 (`fields`), 409 (`current`), `meta.freshness`;
  - rutas (`adminPaths`) y cabeceras (`X-CSRF-Token`, `Idempotency-Key`).
- `admin-client.ts`: `createAdminApiClient`.
  - No lanza: devuelve `{ ok, status, data }` o un fallo tipado (`unavailable`, `timeout`, `invalid_response`).
  - Límite de 5 s, sin redirecciones, cuerpo de 1 MiB como máximo y validación con el contrato.
  - Cabeceras: `Authorization: Bearer <sid>`, `X-CSRF-Token`, `X-Forwarded-For` e `Idempotency-Key`.
- `product-form.ts`: correspondencia entre el formulario HTML plano y la entrada de la API, guiada por el descriptor (`parseProductForm`, `productFormValues`, `formErrors`), con la misma forma que hoy (seis filas fijas de variantes y chips con posición y "Quitar"). Es la versión de `inventory-manager`. La de `landing-pages` se retira en el ticket 6.

**`api`:**
- `src/app.ts`: pasa a `@koa/router` (ya está en el lockfile) y monta lo público sin cambios y `/api/v1/admin`.
- `src/admin/` (nuevo):
  - `access.ts`: Bearer → sesión (401) → negocio (404) → permiso (403) → en escrituras, `X-CSRF-Token` (403);
  - `session-routes.ts`;
  - `product-routes.ts` (basado en `admin-products-api.ts`);
  - `idempotency.ts`;
  - `notifier.ts` (aviso a `landing-pages`).
- `src/config.ts`: `TRUST_PROXY`, `BUSINESS_TIMEZONE`, `PRODUCT_IMAGES_DIR`, `LANDING_INTERNAL_URL` e `INTERNAL_NOTIFY_TOKEN`.
- `src/server.ts`: repositorio de usuarios Prisma, autenticador, sesiones, límite de intentos, repositorio de productos con `init()` y notificador.

**`landing-pages`:**
- `src/internal-app.ts` (nuevo): app Koa mínima del puerto interno, con `POST /internal/v1/productos-cambiados`.
- `src/server.ts`: segundo `listen` en `INTERNAL_PORT`, si hay token, y temporizador de recarga del catálogo del bot cada 60 s (`unref`).
- `src/config/env.ts`: `ADMIN_NEW_URL`, `INTERNAL_PORT` e `INTERNAL_NOTIFY_TOKEN`.
- Modo de solo lectura en `controllers/admin-products.ts`, `admin-products-api.ts` y `admin-business-view.ts`, y en `views/admin/products.ts` y sus plantillas.
- Imports actualizados en `app.ts`, `admin-guard.ts`, `admin*.ts`, `scripts/` y `tests/`.

**`inventory-manager` (workspace nuevo).**

**Raíz y despliegue:**
- `package.json`: workspace y scripts `dev:inventory`, `start:inventory` y `build:css` de los dos;
- `eslint.config.ts` (bloques de `inventory-manager` y `web`);
- `landing-pages/tests/unit/dependency-rule.test.ts`;
- `landing-pages/Dockerfile`: etapa `inventory-manager`, con `inventory-manager/package.json` en las etapas que hacen `npm ci`;
- `deploy/compose.prod.yaml`, `deploy/deploy.sh`, `deploy/env.production.example`, `deploy/ci/smoke.sh` y `deploy/ci/resumen.sh`;
- `.github/workflows/ci.yml` (`cambios`, `docker`, `despliegue`, `publish` y `deploy`) y `.github/dependabot.yml` (comentario);
- `ops/backup/` solo si su smoke interpola variables nuevas (se usan valores por defecto para no romperlo).

**Documentación:** `docs/arquitectura.md` (§4, §6, §8, §9 y §10), `docs/despliegue.md`, `docs/desarrollo.md` y los README (raíz, `api`, `inventory-manager` y `landing-pages`).

### Cambios requeridos

#### 1. Sesión reenviada (D-1) e IP real (RF-2)

**Login:**
- `inventory-manager` recibe `POST /acceso` (mismo origen) y llama a `POST /api/v1/admin/sesion` con `{ username, password }` y `X-Forwarded-For: <ctx.ip>`. Esa cabecera la escribe `inventory-manager` (reemplaza cualquier valor recibido) y su `ctx.ip` viene de Traefik (`app.proxy = true`, `maxIpsCount = 1`, como el `/admin` actual).
- `api` usa el límite de intentos actual (5 fallos → 15 min por IP), ahora en `core/identity`, y el autenticador actual (mensaje genérico).
- Respuestas: 201 `{ session: { id, csrfToken }, user }`; 401 `INVALID_CREDENTIALS`; 429 `LOGIN_LOCKED` con `Retry-After`, sin comprobar la contraseña.

**IP real en `api`:**
- `api` usa `app.proxy = true` con `maxIpsCount = 1`: `ctx.ip` es el último valor de `X-Forwarded-For`, el que pone `inventory-manager`.
- `api` solo es alcanzable desde las redes internas `db` y `admin`, sin puertos ni router de Traefik: nadie de internet puede fijar esa cabecera.
- El login sin una IP válida en la cabecera responde 400 `CLIENT_IP_REQUIRED`, para que no se cuenten todos los intentos como uno.
- Para el ticket 3 (cuando se publique el webhook de `api`) queda documentado:
  - su router de Traefik debe limitarse a la ruta del webhook;
  - aun así, Traefik añade la IP real como último valor, así que el límite sigue sin poder falsearse.

**Cookie de `inventory-manager`:**
- Nombre: `__Host-admin_sid` en producción. El prefijo hace que el navegador exija `Secure`, `Path=/` y que no haya `Domain`. En desarrollo, por HTTP, se llama `admin_sid`.
- Atributos: `HttpOnly`, `SameSite=Strict` y sin `Max-Age` (la caducidad de 2 h la decide `api`).
- Solo contiene el id opaco de 256 bits. Al entrar se borra la cookie anterior: el id siempre es nuevo.

**Cada petición:**
- `inventory-manager` reenvía el id como `Authorization: Bearer <id>`.
- `api` aplica la regla actual: renueva la actividad, lee el usuario de la base (rol y negocios vigentes) y comprueba que está activo y que su `sessionVersion` no cambió.
- Si la sesión no vale, 401 → `inventory-manager` borra la cookie y redirige con 303 a `/acceso?next=<ruta>` (CA-3).
- La desactivación desde el `/admin` actual sube `sessionVersion` (ya ocurre en `setActive`), así que la sesión del admin nuevo cae en la siguiente petición.

**Retorno tras entrar (`next`):**
- Solo rutas internas: empieza por `/`, no por `//` ni `/\`, no tiene esquema y coincide con un patrón de las rutas de `inventory-manager`.
- Si no, `/` (CA-3: sin redirecciones abiertas).

**Salir:**
- `POST /salir` (mismo origen y `_csrf`) llama a `DELETE /api/v1/admin/sesion` con Bearer y CSRF.
- Borra la cookie y redirige con 303 a `/acceso`.
- `no-store` evita que el botón atrás muestre datos.

#### 2. CSRF en dos capas (D-2)

- **Primera capa, `inventory-manager`:** `assertSameOrigin` (de `web`) en todo POST: `Sec-Fetch-Site` debe ser `same-origin` y `Origin` el propio. `Referrer-Policy: same-origin` para que el navegador envíe el `Origin` real.
- **Segunda capa, `api`:** cada página pide `GET /api/v1/admin/sesion` (usuario, negocios y `csrfToken`) e inserta el token en `_csrf`. En el POST, `inventory-manager` reenvía `_csrf` como `X-CSRF-Token` y `api` lo compara en tiempo constante con el de la sesión (`safeEqualStrings`).
- Si falla cualquiera de las dos, 403 y nada cambia (CA-5). El token de otra sesión no coincide con el de la sesión del Bearer.

#### 3. Qué pasa a `core` y qué se queda en `landing-pages`

- **A `core`:** lo que usan las dos apps y no depende de Koa ni de Prisma: las sesiones, el límite de intentos, `resolveSession`, el repositorio de productos, las hojas del formulario, el DTO, el comprobador de imágenes y `toZonedIsoString`. `api` lo compone en `server.ts`. Las sesiones de las dos apps son almacenes distintos: "Sesión aparte en cada admin".
- **Se queda en `landing-pages` hasta el ticket 6:**
  - `admin-guard.ts` (envoltorio de cookies y 303 sobre `resolveSession`);
  - `admin-access.ts`, `admin-api-access.ts` y los controladores y vistas de `/admin`;
  - el análisis del formulario HTML de productos (`parseProductForm` actual);
  - la importación de semillas;
  - el menú.
- La regla de lint del código de las landings (P-1 de REQ-F-038) se actualiza para seguir prohibiendo el repositorio de productos, ahora desde `@restaurante/core/catalog` (`createProductRepository`, `ProductRepository`).

#### 4. Un solo escritor

- Con `ADMIN_NEW_URL` configurada (siempre en producción: la pone `compose.prod.yaml`), ninguna ruta de `landing-pages` escribe productos. Escriben solo `api`, con una réplica y el mutex `exclusive` del repositorio, y la importación única al arrancar `landing-pages`, que es idempotente por `product_import` y no escribe si ya hay productos.
- Entre procesos siguen valiendo:
  - `replace` con versión: 409 si otro cambió;
  - el slug único: un reintento ante `SlugTakenError`.
- La comprobación del máximo de activos y el cálculo de la posición solo serían vulnerables con dos escritores a la vez, y eso ya no ocurre.
- **Doble envío de un alta** (caso límite):
  - el formulario lleva un `requestId` aleatorio que se genera al pintarlo, y `inventory-manager` lo reenvía como `Idempotency-Key`;
  - `api` recuerda en memoria la clave, por usuario, durante 10 min (máximo 500) y, si se repite, devuelve el mismo producto sin crear otro;
  - editar, eliminar, recuperar y mover usan `version`: el segundo envío recibe 409.

#### 5. Aviso interno (RF-13 y RF-14)

**Receptor, en `landing-pages`:**
- Segundo servidor Koa en `INTERNAL_PORT` (3002), solo con `POST /internal/v1/productos-cambiados`, cuerpo `{ "business": "molotes" | "birria" }` (como mucho 1 KiB, JSON).
- No existe en el puerto 3000, el que enruta Traefik, que responde 404. Traefik no lo enruta: su `loadbalancer.server.port` es 3000 y no hay ningún router hacia 3002.
- **Credencial:**
  - `Authorization: Bearer <INTERNAL_NOTIFY_TOKEN>`, comparada en tiempo constante;
  - sin ella o incorrecta: 401 `INVALID_CREDENTIALS` y no se invalida nada (CA-10 y RF-14);
  - el token tiene 32 caracteres como mínimo, es obligatorio en producción en las dos apps (fallo rápido) y nunca aparece en los logs.
- **Al recibir un aviso válido:**
  - `landingProducts.invalidate(business)`, como hoy hace `onChange`;
  - `await products.reload(business)`: el bot usa el catálogo nuevo en su siguiente mensaje;
  - `await landingProducts.confirmFresh(business)`, como mucho 1,5 s;
  - responde 200 `{ landing: boolean, bot: boolean }`, o 503 si la recarga del bot falló.
- **Defensa añadida:** si la petición trae `X-Forwarded-For` (señal de que pasó por un proxy), 404.
- **Riesgo residual documentado:** otros contenedores de la red `traefik-public` del VPS podrían llegar al puerto 3002. Los frena la credencial, y la única acción posible (invalidar una caché) es inocua y está acotada por el vuelo único.

**Emisor, en `api` (`notifier.ts`):**
- Se suscribe a `onChange` del repositorio, que solo se emite tras el commit.
- El primer intento se espera **como mucho 2 s** antes de responder la escritura, y la respuesta lleva `meta.freshness: "confirmed" | "pending"`. Así `inventory-manager` no afirma que la landing ya lo muestra si no es cierto (paridad con DEF-003 de REQ-F-038).
- **Si falla** (red, 5xx o tiempo):
  - la escritura igual responde éxito;
  - se reintenta en segundo plano a 1 s, 5 s y 30 s (cuatro intentos en total);
  - los avisos pendientes del mismo negocio se agrupan en uno;
  - se registra `products_notify_failed` (negocio, intento, motivo y estado HTTP; nunca el token) y, al agotar los intentos, `products_notify_gave_up` (CA-11).
- **Red de seguridad** (RF-13):
  - landings: la caducidad de 60 s actual (P-3);
  - bot: el temporizador de 60 s de `landing-pages` llama a `products.reload` de los dos negocios y registra `products_cache_refresh_failed` si falla.

#### 6. Imágenes (RF-11)

- `api` comprueba `image.src` con `createImageChecker(PRODUCT_IMAGES_DIR)`, que por defecto es `<api>/../landing-pages/public`. En desarrollo apunta directamente a la carpeta de las landings.
- En la imagen Docker, la etapa `api` copia `landing-pages/public/img` en `/app/landing-pages/public/img` desde la etapa `build`, la misma de la imagen `production`. Las dos salen del mismo commit y del mismo job, y `deploy.sh` las despliega juntas.
- Una imagen nueva exige un despliegue normal (R-5, documentado en `despliegue.md`).
- El mensaje de error sigue siendo el actual ("La imagen no existe en public/img/.").
- Una prueba de `api` comprueba que la carpeta por defecto existe y contiene imágenes, y el job `docker` del CI comprueba que la imagen `api` las incluye.

#### 7. Endpoints de `/api/v1/admin`

| Método y ruta | Uso | Respuestas |
| --- | --- | --- |
| `POST /sesion` | Entrar | 201, 400, 401, 429 |
| `GET /sesion` | Usuario, negocios permitidos y `csrfToken` | 200, 401 |
| `DELETE /sesion` | Salir (CSRF) | 204, 401, 403 |
| `GET /:negocio/productos?eliminados=1&categoria=` | Listar | 200, 401, 403, 404 |
| `GET /:negocio/productos/campos?categoria=&tipo=` | Descriptor del formulario de una combinación (sale de `core`) | 200, 400, 401, 403, 404 |
| `POST /:negocio/productos` | Crear (CSRF, `Idempotency-Key`) | 201, 422, 403 |
| `PUT /:negocio/productos/orden` | Reordenar una categoría completa | 200, 409, 422 |
| `GET /:negocio/productos/:id` | Ver | 200, 404 |
| `PUT /:negocio/productos/:id` | Actualizar con `version` (y `action: overwrite_after_conflict` tras un 409) | 200, 409, 422 |
| `DELETE /:negocio/productos/:id?version=N` | Eliminar (borrado lógico) | 200, 409 |
| `POST /:negocio/productos/:id/recuperar` | Recuperar `{ version }` | 200, 409, 422 |
| `POST /:negocio/productos/:id/mover` | Subir o bajar `{ direction, version }` | 200, 409 |

- **Orden de las comprobaciones** (el de D-19 actual): sesión (401) → negocio (404) → permiso (403) → CSRF en escrituras (403) → existencia (404) → cuerpo (413/415/400) → validación (422) → versión (409).
- **Errores:** `{ error: { code, message } }`, con `fields` en el 422 y `current: { id, version, updatedAt, updatedBy }` en el 409.
- **Base de datos:** si falla, 503 `DATABASE_UNAVAILABLE`.
- **Respuestas:** se validan con `contracts`. Todas llevan `no-store`.

#### 8. Modo de solo lectura del `/admin` actual (RF-15)

**Con `ADMIN_NEW_URL`:**
- Las páginas de productos (lista dentro de la página del negocio y eliminados) pintan los productos **sin** "Nuevo", "Editar", "Eliminar", "Subir/Bajar" ni "Recuperar".
- Muestran un aviso con el enlace al admin nuevo.
- Las páginas de alta, edición y eliminación responden 410 con el mismo aviso.
- Cualquier POST HTML de productos: sesión → permiso → 410 con el aviso, sin leer el formulario ni escribir.
- Las escrituras de `/admin/api` responden: sesión (401) → permiso (403) → **410** `PRODUCTS_MOVED` (formato estándar, con el enlace en `message`), sin leer el cuerpo.
  - Se elige **410 Gone** porque el cambio es permanente, no depende de la autorización y el cliente no debe reintentar.
  - Las lecturas de `/admin/api` siguen funcionando.
- Usuarios, cuenta, bot y menú no cambian.

**Sin la variable:** exactamente como hoy (las pruebas actuales lo cubren sin cambios).

#### 9. `inventory-manager`

**Estructura** (como las landings):

```text
inventory-manager/
├── package.json        # koa, @koa/router, koa-static, koa-helmet, helmet, @restaurante/contracts, @restaurante/web;
│                       # dev: @tailwindcss/cli, tailwindcss, @tailwindcss/forms, vitest, supertest, jsdom (todas ya en el lockfile)
├── .env.example  tsconfig.json  vitest.config.ts  .gitignore (public/css/*)
├── scripts/dev-server.ts
├── src/
│   ├── app.ts / server.ts / config.ts      # NODE_ENV, HOST, PORT (3003), TRUST_PROXY, API_INTERNAL_URL
│   ├── session.ts                          # cookie, Bearer y retorno (`next`)
│   ├── middleware/{security.ts, error-handler.ts, request-logger.ts}
│   ├── controllers/{access.ts, businesses.ts, products.ts, health.ts}
│   ├── views/{layouts,pages,partials}/*.html + views/*.ts (modelos de vista)
│   └── styles/main.css                     # Tailwind v4 + @tailwindcss/forms + tokens de P-4
├── public/
│   ├── css/main.css                        # generado (no versionado)
│   ├── js/main.js, js/modules/{submit-guard.js, reorder.js}
│   └── robots.txt                          # Disallow: /
└── tests/{unit,integration,support}
```

**Rutas:**
- `GET|POST /acceso`, `POST /salir`, `GET /salud` (200, sin llamar a `api`).
- `GET /`: selector de negocio, o redirección si solo hay uno permitido.
- `GET /:negocio/productos`.
- `GET /:negocio/productos/nuevo` (primero se elige la categoría y, en Birria, el tipo de detalle) y `POST /:negocio/productos`.
- `GET /:negocio/productos/eliminados`.
- `GET /:negocio/productos/:id/editar` y `POST /:negocio/productos/:id`.
- `GET|POST /:negocio/productos/:id/eliminar` (página de confirmación).
- `POST /:negocio/productos/:id/recuperar` y `POST /:negocio/productos/:id/{subir|bajar}`.
- Siempre POST/redirect/GET con 303 y mensajes por `?ok=<clave>` cerrada.

**Formularios:**
- Se pintan desde el descriptor (`/productos/campos`) con `contracts/product-form.ts`: `label` en cada campo, `aria-describedby` hacia la ayuda y el error, `aria-invalid`, y un resumen de errores al principio con enlaces a cada campo y el foco puesto en él.
- **422:** se vuelve a pintar con lo escrito y el error junto a su campo y su fila.
- **409** (RF-9 y CA-7): se conserva lo escrito y un aviso muestra quién y cuándo cambió la versión vigente, con dos acciones:
  - "Cargar la versión vigente": enlace GET a la edición;
  - "Guardar mis cambios sobre la versión vigente": envía con `version = current.version` y `action = overwrite_after_conflict`.
  Nunca se guarda en silencio.
- **`api` caída o 503** (RF-10 y CA-8): 503 con aviso "Servicio no disponible", el formulario intacto y sin detalles internos.
- **Éxito:** el mensaje depende de `meta.freshness`. Con "confirmed", "ya se ve en la landing y en el bot". Con "pending", "se verá en cuanto se actualicen, como mucho en un minuto".

**JS de mejora** (módulos ES, `data-*`; sin JS todo funciona):
- `submit-guard.js`: desactiva el botón al enviar, pone `aria-busy` y el texto "Guardando…" (doble envío y conexión lenta).
- `reorder.js`: las formas de subir y bajar se envían con `fetch` a la misma ruta, con `Accept: text/html` y una cabecera `X-Fragment: product-list`. El servidor responde el fragmento de la lista. El JS lo sustituye, conserva el foco en el botón del producto movido y lo anuncia en una región `aria-live` ("Birria de res: posición 3 de 7"). Es la misma regla de `move`.

**Seguridad:**
- `koa-helmet`:
  - CSP: `default-src 'self'`; `script-src 'self'`; `style-src 'self' https://fonts.googleapis.com`; `font-src https://fonts.gstatic.com`; `img-src 'self' data:`; `form-action 'self'`; `frame-ancestors 'none'`;
  - HSTS;
  - `Referrer-Policy: same-origin`.
- `X-Robots-Tag: noindex, nofollow` en todas las respuestas y `Cache-Control: no-store` en todo HTML y JSON (CA-16). Los CSS y JS estáticos, sin datos, llevan `max-age=3600`, para no gastar el límite de 60 peticiones por minuto.
- En producción, sin HTTPS: 503 (como `/admin`).
- El log de peticiones registra método, ruta, estado y duración. Nunca cookies, cabeceras de autorización, cuerpos ni tokens.

**BEM** (bloques):
- estructura: `admin-shell`, `admin-header`, `login-card`, `business-picker`;
- productos: `product-list`, `product-row`, `product-form`, `confirm-panel`;
- piezas comunes: `field` (`__label`, `__help`, `__error`), `notice` (`--error`, `--success`, `--warning`, `--info`) y `button` (`--primary`, `--secondary`, `--ghost`, `--danger`).
- Utilidades de Tailwind para el estilo y CSS propio mínimo (tokens de `@theme`).

### Frontend

- Mobile-first: una columna en móvil (las filas de producto se apilan con nombre, estado y acciones) y una lista en dos columnas a partir de `md`. Sin desplazamiento horizontal a 375 px (CA-14).
- Encabezados jerarquizados: un `h1` por página, `h2` por categoría.
- Enlace para saltar al contenido, foco visible (`:focus-visible` con contorno de 2 px de `#eab308`) y todo usable con teclado.
- Estado "No disponible" o "Disponible" con texto y no solo color.
- `npm run build:css` genera también `inventory-manager/public/css/main.css`.

### Backend

- **`api`:** composición en `server.ts` con:
  - `createUserRepository` (Prisma);
  - `createUserAuthenticator`;
  - `createSessionStore` y `createLoginThrottle` (de `core`);
  - `createProductRepository({ store: createPrismaProductStore, imageExists })` con `init()`;
  - el notificador.
  La API pública no cambia (mismo contrato y mismas pruebas).
- **`landing-pages`:** imports desde `core` y `web`, el receptor interno, el temporizador del bot y el modo de solo lectura.
- **Sin persistencia nueva:** ni tablas ni migraciones. Sesiones e idempotencia en memoria (una réplica, igual que hoy).

### Contenido / configuración

| Variable | App | Regla |
| --- | --- | --- |
| `ADMIN_NEW_URL` | landing-pages | Opcional. URL absoluta, `https` en producción. Activa el modo de solo lectura |
| `INTERNAL_PORT` | landing-pages | Por defecto 3002 |
| `INTERNAL_NOTIFY_TOKEN` | landing-pages y api | 32 caracteres como mínimo. Obligatoria en producción |
| `LANDING_INTERNAL_URL` | api | `http(s)` absoluta. Obligatoria en producción (`http://app:3002`) |
| `TRUST_PROXY` | api, inventory-manager | `true` en producción |
| `BUSINESS_TIMEZONE` | api | Para las fechas del DTO |
| `PRODUCT_IMAGES_DIR` | api | Opcional, por defecto `../landing-pages/public` |
| `API_INTERNAL_URL` | inventory-manager | Obligatoria (`http://api:3001`) |
| `RESTAURANTE_ADMIN_DOMAIN`, `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` | `.env` del VPS | Las valida `deploy.sh` (código 3 si faltan o son inválidas) |

### Validaciones

- Toda entrada llega como `unknown`:
  - `:negocio` con `isBusinessId`;
  - `:id` y `version` con los patrones actuales;
  - los cuerpos JSON con un límite de 64 KiB (`json-body`) y los formularios con los límites actuales;
  - las reglas de producto, solo en `core` (`validateProductInput`): `contracts` no duplica reglas, solo describe la forma.
- `inventory-manager` valida con `contracts` toda respuesta de `api` y trata una respuesta inválida como "no disponible".
- `next`, `?ok`, `categoria` y `tipo` son listas cerradas.

### Manejo de errores

- **`api`:** un manejador central (el actual) con `ApiHttpError`, `DatabaseUnavailableError` → 503 y el resto → 500 sin mensaje. El log lleva nombre y código, nunca el mensaje de Prisma.
- **`inventory-manager`:** páginas 403 ("sin permiso", sin datos), 404, 503 ("servicio no disponible", conservando el formulario cuando hay uno) y 500, sin trazas.
- **Notificador:** nunca propaga errores a la escritura.

### Testing

**`core`:**
- se mueven las pruebas de `session-store`, `login-throttle` y el contrato del repositorio (memoria y Prisma, con MySQL real), y se añaden casos de `reload`, `init()` sin fuentes y `resolveSession`;
- descriptor y DTO.

**`contracts`:** `admin-client` (nunca lanza, tiempo, tamaño, contrato) y `product-form` (filas, posiciones, "Quitar" y errores a su fila).

**`api`** (en proceso, store de productos en memoria y usuarios con un doble de `UserRepository`):
- login: 201, 401 genérico, 429 sin comprobar la contraseña, IP de `X-Forwarded-For` (otra IP no afectada) y 400 sin IP;
- sesión: 2 h con reloj inyectado, `sessionVersion` y usuario desactivado;
- permisos: 401, 403 y 404;
- CSRF: falta, de otra sesión y correcto;
- productos: 201 no disponible y al final, máximo de activos, slug único, historial con autor, 422 con `fields`, `image.src` inexistente y existente, 409 con `current` y `overwrite_after_conflict`, mover y reordenar;
- idempotencia del alta;
- `freshness` confirmada y pendiente, y reintentos y agrupación del notificador (con `fetch` simulado y temporizadores falsos);
- logs sin contraseñas ni tokens.

**`landing-pages`:**
- receptor interno: token correcto, ausente e incorrecto (no invalida), `X-Forwarded-For` → 404, puerto 3000 → 404;
- recarga del bot cada 60 s (temporizadores falsos) y en el aviso;
- modo de solo lectura: HTML sin controles, POST 410 sin cambios en la base, `/admin/api` 410 `PRODUCTS_MOVED`, lecturas, usuarios, cuenta, bot y menú iguales;
- sin `ADMIN_NEW_URL`, la suite actual sin cambios;
- `dependency-rule.test.ts` con los casos de `inventory-manager` y `web` (CA-17).

**`inventory-manager`** (en proceso contra un doble de `api` que cumple el contrato, levantado con `listenLocal`):
- cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, sin `Domain`) y ninguna cookie si las credenciales fallan;
- reenvío de la IP;
- `next` (rutas internas y externas ignoradas);
- 401 → acceso y vuelta a la pantalla pedida;
- mismo origen y `_csrf` → `X-CSRF-Token`;
- 403 sin datos;
- 409 conserva lo escrito y muestra quién y cuándo;
- `api` caída → 503 con el formulario intacto y sin trazas;
- `no-store` y `noindex`;
- etiquetas y `aria-describedby`;
- logs sin tokens.
- Con jsdom: `submit-guard` y `reorder` (foco y `aria-live`).

**Extremo a extremo** (`landing-pages/tests/integration`, MySQL real; precedente de `api-process.test.ts`):
- arranca los procesos `api` e `inventory-manager`;
- entra, marca un producto como no disponible, y la landing y el catálogo del bot dejan de ofrecerlo sin reiniciar (CA-9);
- un aviso con credencial incorrecta no invalida (CA-10).

**Revisión manual de QA:** CA-14, con teclado, foco, 375 px y escritorio. Las pruebas cubren la estructura.

**Smoke de despliegue:** ver "Riesgos técnicos y despliegue".

### Seguridad

- Mínimo privilegio en las redes:
  - `inventory-manager` solo en `traefik` y en una red interna nueva `admin` (con `api`): no llega a MySQL ni a `landing-pages`;
  - `api` en `db` y `admin`;
  - `landing-pages`, sin cambios.
- `inventory-manager` no recibe credenciales de la base ni el token del aviso.
- Los logs nunca registran contraseñas, ids de sesión, tokens CSRF ni el token del aviso (CA-16, con prueba).
- `koa-helmet` en `inventory-manager`, con la CSP estricta descrita.
- `api` sin publicar (D-3).

### Performance

- Cada página de `inventory-manager` hace dos llamadas internas: sesión y datos.
- La escritura espera como mucho 2 s por el aviso.
- `api` sigue leyendo la base en cada petición, sin caché.
- La recarga del bot es una consulta por negocio cada 60 s.
- Sin dependencias nuevas.

### Riesgos técnicos y despliegue

**`compose.prod.yaml`:**
- **Servicio `inventory-manager`:**
  - imagen `${RESTAURANTE_INVENTORY_IMAGE:-ghcr.io/orvigas/restaurante-inventory-manager:sin-desplegar}`, el mismo patrón que la `api` para no romper `ops/backup`;
  - `read_only`, `tmpfs`, `cap_drop` y `no-new-privileges`;
  - redes `traefik` y `admin`; *healthcheck* contra `/salud`.
- **Routers de Traefik:**
  - `restaurante-inventory`: `Host(admin)`, HTTPS con el *certresolver* y el *middleware* `restaurante-inventory-ratelimit` (`average=60`, `period=1m`, `burst=60`);
  - `restaurante-inventory-http`: `Host(admin)` en `web`, con `redirectscheme` a HTTPS permanente.
- **`app`:** `ADMIN_NEW_URL=https://${RESTAURANTE_ADMIN_DOMAIN}`, `INTERNAL_PORT` y el token, sin labels nuevas.
- **`api`:** red `admin` y sus variables nuevas.
- **Red nueva:** `admin` (`internal: true`).

**`deploy.sh`:**
- Recibe siete argumentos: `deploy <sha> <app> <migrate> <api> <inventory> <suma>`, valida el digest nuevo y `RESTAURANTE_ADMIN_DOMAIN` y el token del `.env` (código 3).
- **Orden:** pull de las cuatro imágenes → MySQL → volcado → migración → **api** → **inventory-manager** → **app** → registro.
- `inventory-manager` va **antes** de la app: la app nueva activa el modo de solo lectura, y no debe hacerlo si el admin nuevo no queda sano.
- **Si `inventory-manager` no queda *healthy*** (o Traefik no lo enruta, comprobado con `--resolve` sin depender del DNS):
  - vuelve a su imagen anterior o, en el primer despliegue, lo detiene;
  - la app y la api siguen como estaban: la app con su versión anterior, que todavía edita productos;
  - termina con el **código 16**, documentado.
- **Si después falla la app:** la vuelta atrás actual (app y api anteriores), y además `inventory-manager` vuelve al anterior o se detiene, para no dejar dos escritores.
- `release.env` registra `RESTAURANTE_INVENTORY_IMAGE`.

**Smoke y CI:**
- **`smoke.sh` comprueba:**
  - el compose estático: redes de `inventory-manager` y de `api`, sin labels en `api` ni hacia el 3002, sin puertos;
  - en el subdominio: 200 en `/acceso`, HTTP → 301 a HTTPS, cabeceras `no-store` y `noindex`, y 429 al superar la ráfaga de 60;
  - que el subdominio no enruta a la api (`/api/v1/...` → 404 de `inventory-manager`) y que el dominio no expone el aviso;
  - que las landings y `/admin` responden igual;
  - el despliegue con `inventory-manager` roto: código 16, con la app y la api sirviendo.
- **CI:**
  - `docker` construye y verifica la imagen `inventory-manager`, y que la imagen `api` contiene `public/img`;
  - `despliegue` pasa la cuarta imagen al smoke;
  - `publish` publica `restaurante-inventory-manager`;
  - `deploy` pasa cuatro digests;
  - `resumen.sh` muestra la cuarta imagen y el código 16;
  - `cambios` clasifica `inventory-manager/` y `packages/web/` como código.
- **Dependabot:** el ecosistema npm de `/restaurante` ya cubre el workspace nuevo y la imagen base sigue en el mismo `Dockerfile`. Solo se actualiza el comentario.

**Riesgos:**
- **R-4:** tamaño del ticket → tres PR (P-2).
- **R-5:** imágenes en dos contenedores; se documenta.
- **R-7:** todo llega a la vez al mergear la épica. El usuario debe:
  - crear el DNS;
  - añadir `RESTAURANTE_ADMIN_DOMAIN` y `RESTAURANTE_INTERNAL_NOTIFY_TOKEN` al `.env`;
  - reinstalar `deploy/`;
  - dar al token de GHCR acceso a la imagen nueva.
- **Puerto 3002** alcanzable desde la red `traefik-public` del VPS: lo frena la credencial y la acción es inocua.
- **Ticket 3:** su router de Traefik debe limitarse al webhook para no exponer `/api/v1/admin`.

### Orden de implementación

1. **Parte 1:**
   - `web` y los movimientos a `core`, con los imports actualizados y la suite actual en verde (sin cambios de comportamiento);
   - contratos del admin;
   - `/api/v1/admin` (sesión y productos);
   - notificador, receptor interno y recarga del bot;
   - modo de solo lectura;
   - pruebas.
2. **Parte 2:** `inventory-manager` (estructura, acceso, productos, JS, Tailwind y accesibilidad) y regla de lint con su prueba.
3. **Parte 3:**
   - Docker, compose, `deploy.sh`, smoke, CI y Dependabot;
   - prueba de extremo a extremo;
   - documentación (§4, §6, §8 con el plan de 6 tickets, §9 con la decisión B, la desviación D-3 y `web` si se elige P-1 A, y §10 con la memoria);
   - `despliegue.md` (variables, código 16, DNS a cargo del usuario y reinstalación de `deploy/`), `desarrollo.md` y los README.

### Criterios de finalización

| CA | Cómo se comprueba |
| --- | --- |
| CA-1 | Prueba de `inventory-manager`: `Set-Cookie` con `HttpOnly`, `Secure`, `SameSite=Strict`, sin `Domain` (`__Host-` en producción). Credenciales inválidas: mensaje genérico y sin `Set-Cookie` de sesión |
| CA-2 | Prueba de `api`: 429 sin llamar al autenticador, otra IP no afectada, IP tomada de `X-Forwarded-For`. Prueba de `inventory-manager`: reenvía `ctx.ip` y no la de su socket |
| CA-3 | Pruebas con reloj inyectado (2 h) y `sessionVersion` (desactivación), redirección al acceso con `next` y vuelta, `next` externo ignorado |
| CA-4 | Pruebas de API (401, 403 sin datos, 404) y de interfaz (403 "sin permiso" sin datos) |
| CA-5 | Pruebas sin token, con el de otra sesión y con `Origin` ajeno: 403, y el store sin cambios |
| CA-6 | Pruebas de `api` (reglas) y de `inventory-manager` sin JS (formularios y 303) y con JS (jsdom). Prueba de extremo a extremo |
| CA-7 | Prueba de 409: formulario conservado, quién y cuándo, sin sobrescribir |
| CA-8 | Prueba con `api` caída o 503: aviso, formulario intacto y cuerpo sin trazas |
| CA-9 | Prueba de extremo a extremo con MySQL real (landing y catálogo del bot) |
| CA-10 | Pruebas del receptor (credencial incorrecta → 401, sin invalidar; puerto 3000 → 404). Smoke: no accesible por Traefik |
| CA-11 | Prueba del notificador caído: escritura confirmada, `products_notify_failed` en el log. Temporizador del bot a 60 s. Caducidad de 60 s de las landings según P-3 |
| CA-12 | Pruebas de `api`: 422 en `image.src` si la imagen no existe; 201 si existe |
| CA-13 | Pruebas del modo de solo lectura, con y sin `ADMIN_NEW_URL` |
| CA-14 | Pruebas de estructura (etiquetas, `aria-describedby`, encabezados) y revisión manual de QA a 375 px y en escritorio |
| CA-15 | Smoke (subdominio, redirección, límite, `api` no enrutada, landings y `/admin` iguales) y comprobación del certificado real tras el DNS, a cargo del usuario y documentada |
| CA-16 | Pruebas de cabeceras y de logs sin secretos |
| CA-17 | `npm run lint` y `dependency-rule.test.ts` |
| CA-18 | Smoke: cuatro imágenes y código 16 con las landings y la api sirviendo |
| CA-19 | `typecheck`, `lint` y `test` con 0, y CI en verde en cada PR hacia `epic/arquitectura` |
| CA-20 | Revisión del diff de la documentación |

## Implementation Result

### PR 1 de 3 (2026-10-27)

#### Rama

`feature/REQ-F-039-admin-nuevo-productos-1-api`, creada desde `epic/arquitectura` (`c53aca4`). No hay commit ni PR.

#### Cambios realizados

**1. `packages/web` (nuevo, decisión P-1).** No importa nada del proyecto; sí Koa.
- Movidos con `git mv` desde `landing-pages`: `render.ts`, `form-body.ts` y `json-body.ts`.
- `same-origin.ts`: `assertSameOrigin` y `rejectCsrf`, extraídos de `admin-guard.ts`, que los reexporta.
- `logger.ts`: `createLogger` y `serializeError`, desde `core/shared`. `core/shared/logger.ts` conserva la interfaz `Logger` y un `silentLogger` sin E/S.
- Nuevo bloque de lint para el paquete y casos en `dependency-rule.test.ts`.
- En el Dockerfile, las etapas `production` y `api` copian `packages/web`.

**2. Movimientos a `core`, sin reescribir la lógica.**
- `catalog/product-repository.ts`, con dos añadidos:
  - `reload(business)`, que devuelve si pudo recargar;
  - `init()` sin fuentes, que solo carga la caché y no importa.
- `catalog/product-form-fields.ts`: las hojas del formulario.
- `catalog/product-dto.ts`: `toProductDto`, que comparten `/admin/api` y `/api/v1/admin`.
- `catalog/image-checker.ts`.
- `identity/session-store.ts` e `identity/login-throttle.ts`.
- `identity/session.ts`: `resolveSession`, la regla de sesión que comparten `/admin` y la API.
- `shared/datetime.ts`.
- La regla de lint del código de las landings prohíbe ahora el repositorio desde `@restaurante/core/catalog`.

**3. `packages/contracts/admin.ts`.** Esquemas Zod de:
- sesión, producto de administración, listas, descriptor del formulario y `meta.freshness`;
- errores 422 y 409;
- rutas (`adminPaths`) y cabeceras (`X-CSRF-Token`, `Idempotency-Key`).

**4. `api`: `/api/v1/admin` con `@koa/router`** (ya estaba en el lockfile).
- **Composición:** `src/admin/` (`access`, `session-routes`, `product-routes`, `idempotency`, `router` e `index`), `src/errors.ts` y `src/notifier.ts`.
- **IP del visitante:** `app.proxy = true` y `maxIpsCount = 1`, así que es el último valor de `X-Forwarded-For`. Sin una IP válida, el login responde 400.
- **Arranque:** repositorio de usuarios Prisma, repositorio de productos con `init()` sin importar y notificador.
- **Respuestas:** se validan con el contrato.
- **Configuración nueva:** `BUSINESS_TIMEZONE`, `PRODUCT_IMAGES_DIR` (por defecto `../landing-pages/public`), y `LANDING_INTERNAL_URL` con `INTERNAL_NOTIFY_TOKEN` (las dos o ninguna).
- **Imagen Docker:** la etapa `api` copia `landing-pages/public/img` en la misma ruta relativa. El job `docker` del CI lo comprueba.

**5. `landing-pages`.**
- `src/internal-app.ts`: puerto interno `INTERNAL_PORT`, 3002 por defecto, con `POST /internal/v1/productos-cambiados`.
  - Exige la credencial en `Authorization: Bearer`.
  - Con `X-Forwarded-For`, 404.
  - Invalida la caché de la landing, recarga el catálogo del bot y responde `{ landing, bot }`, o 503 si la recarga falla.
- `services/catalog-reload.ts`: recarga del bot cada 60 s, con un temporizador que no retiene el proceso.
- `server.ts`: abre el puerto interno solo si hay token.
- **Modo de solo lectura**, con `ADMIN_NEW_URL` (`https` en producción):
  - las páginas muestran los productos sin controles de edición, con un aviso y el enlace al admin nuevo;
  - alta, edición y eliminación, y todos sus POST: sesión, después permiso, después 410 con el aviso, sin leer el formulario;
  - escrituras de `/admin/api`: sesión (401), después permiso (403), después 410 `PRODUCTS_MOVED`;
  - sin la variable, todo funciona como hoy.
- `.env.example` de `api` y de `landing-pages` actualizados.

**6. Documentación mínima del PR 1.** `arquitectura.md` §4 (árbol, tabla de dependencias y `packages/web`) y la descripción del `package.json` raíz. El resto de la documentación es del PR 3.

#### Criterios de aceptación

| CA | Estado en el PR 1 |
| --- | --- |
| CA-2 | Cumplido en la API: 429 sin comprobar la contraseña, otra IP no afectada, IP del último valor de `X-Forwarded-For`. La parte de la interfaz es del PR 2 |
| CA-3 | Cumplido en la API: 2 h, `sessionVersion` y cuenta desactivada. La redirección y la vuelta a la pantalla pedida son del PR 2 |
| CA-4 | Cumplido en la API: 401, 403 sin datos y 404. La interfaz es del PR 2 |
| CA-5 | Cumplido en la API: sin token, con el de otra sesión o inventado, 403 y nada cambia. El origen ajeno se comprueba en `inventory-manager` (PR 2) |
| CA-6 | Cumplido en la API: alta no disponible y al final, máximo de activos, slug único, autor, editar, eliminar, recuperar, mover y reordenar. La interfaz con y sin JS es del PR 2 |
| CA-7 | Cumplido en la API: 409 con `current` (versión, quién y cuándo) y `?sobrescribir=1`. La interfaz es del PR 2 |
| CA-8 | Pendiente del PR 2 (aviso en la interfaz). La API ya responde 503 `DATABASE_UNAVAILABLE` sin detalles |
| CA-9 | Pendiente del PR 3 (prueba de extremo a extremo). Los mecanismos ya están: aviso, invalidación y `reload` |
| CA-10 | Cumplido: credencial incorrecta o ausente, 401 sin invalidar; el puerto de la app y `X-Forwarded-For` dan 404. Con Traefik se verifica en el smoke del PR 3 |
| CA-11 | Cumplido en el código y las pruebas: la escritura se confirma con `pending`; `products_notify_failed`, reintentos a 1, 5 y 30 s y `products_notify_gave_up`; bot cada 60 s; landings con la caducidad de 60 s de §6 (P-3) |
| CA-12 | Cumplido: 422 en `image.src` si la imagen no existe; 201 si existe |
| CA-13 | Cumplido: modo de solo lectura en HTML y `/admin/api`, y el resto de `/admin` igual. Sin la URL, la suite actual pasa sin cambios |
| CA-16 | Cumplido en la API y en el puerto interno: el log no lleva contraseñas, ids de sesión, tokens CSRF ni la credencial. `no-store` y `noindex` del admin nuevo son del PR 2 |
| CA-17 | Parcial: regla y pruebas de `web`. El bloque de `inventory-manager` es del PR 2 |
| CA-19 | Locales en 0. El CI del PR se ejecuta en T4 |
| CA-1, CA-14 | PR 2 |
| CA-15, CA-18, CA-20 | PR 3 |

#### Validaciones ejecutadas

Desde `restaurante/`, con el MySQL local:

- `npm run typecheck`: 0.
- `npm run lint`: 0, sin avisos.
- `npm test`:
  - antes: `api` 33 y `landing-pages` 2098 + 1 *expected fail* (2131 en total);
  - después: `api` 83 (6 archivos) y `landing-pages` 2150 + 1 *expected fail* (103 archivos), 2233 en total. Todo verde.
- `npm run build:css`: 0.
- `docker build --target api` y `--target production` en local: correctos.
  - Las dos imágenes resuelven `@restaurante/web`.
  - La imagen `api` contiene `landing-pages/public/img`.
  - Las imágenes de prueba se borraron.
- No queda ningún proceso abierto.

#### Archivos afectados

- **Nuevos:**
  - `packages/web/*`;
  - en `core`: `catalog/{image-checker,product-dto,product-form-fields}.ts` e `identity/session.ts`;
  - `contracts/admin.ts`;
  - en `api`: `src/{errors,notifier}.ts`, `src/admin/*`, y las pruebas `tests/integration/admin-api.test.ts`, `tests/unit/{notifier,idempotency}.test.ts` y `tests/support/admin.ts`;
  - en `landing-pages`: `src/internal-app.ts`, `src/services/catalog-reload.ts`, 7 plantillas de solo lectura en `src/views/admin/`, y las pruebas `tests/integration/{admin-products-moved,internal-notify-process}.test.ts` y `tests/unit/{internal-app,product-repository-reload}.test.ts`.
- **Movidos (`git mv`):** `render.ts`, `form-body.ts`, `json-body.ts`, `datetime.ts`, `product-repository.ts`, `session-store.ts` y `login-throttle.ts`.
- **Modificados:**
  - configuración y raíz: `eslint.config.ts`, `package.json` y `package-lock.json` (workspace `web`), `api/package.json` y `landing-pages/package.json`;
  - `landing-pages/Dockerfile` y `.github/workflows/ci.yml` (comprobación del contenido de las imágenes);
  - `docs/arquitectura.md` §4 y los `.env.example`;
  - en `landing-pages`: imports actualizados (unos 60 archivos de `src/`, `tests/` y `scripts/`), `config/env.ts`, `server.ts`, `admin-guard.ts`, los controladores y vistas de productos de `/admin`, y `tests/{helpers,support/process}.ts`.

Diff: 123 archivos, +3349 / −473.

#### Correcciones de QA del PR 1 (2026-10-27)

Decisión del usuario: "Ahora, en el PR 1 (Recomendado)".

- **DEF-001** (aviso perdido con un intento en vuelo). Archivo: `api/src/notifier.ts`.
  - Cada escritura espera el resultado del **primer intento que empieza después de ella**. Por negocio, el notificador guarda una cola de escrituras en espera y un único bucle de intentos.
  - Si la escritura llega con un intento en vuelo, lo cubre el siguiente intento:
    - si el intento en vuelo falla, el reintento;
    - si termina bien o se rechaza, un aviso nuevo con su propia cuenta de reintentos.
  - Nunca hay dos avisos en paralelo del mismo negocio.
  - `freshness` sigue siendo veraz: `confirmed` solo si el aviso que empezó después de esa escritura confirmó la landing y el bot dentro de los 2 s. Si no, `pending`, y el aviso se envía igual.
  - Al agotar los reintentos, las escrituras en espera quedan en `pending` (red de seguridad de 60 s).
- **DEF-002** (`Idempotency-Key` sin el negocio). Archivos: `api/src/admin/idempotency.ts` y `product-routes.ts`.
  - La clave se recuerda por **usuario, negocio y clave**, junto con una **huella SHA-256 del cuerpo**.
  - La misma clave en otro negocio es otra alta.
  - La misma clave con otro cuerpo responde **422 `IDEMPOTENCY_KEY_REUSED`**, sin ejecutar nada. Elegí 422 porque es lo que indica el borrador IETF "The Idempotency-Key HTTP Header Field" para una clave reutilizada con otra carga. Además, nunca se devuelve un producto que no corresponde a lo enviado.
  - El 409 queda para el conflicto de versión, como hasta ahora.
- **Pruebas:**
  - `notifier.test.ts`: 3 casos nuevos y 2 adaptados (en vuelo, aviso posterior con su frescura, espera mayor que 2 s, reintentos).
  - `idempotency.test.ts`: 2 casos nuevos (otro negocio, otro cuerpo), con la firma nueva.
  - `admin-api.test.ts`: 1 caso nuevo (otro negocio y 422).
  - En `landing-pages/tests/integration/admin-api-qa-req-f-039.test.ts`, N-09 y N-12 pasan de `it.fails` a `it` y quedan en verde.
  - En N-09, la frescura de la segunda escritura se acepta como `confirmed` o `pending`: depende de cuánto retenga el proxy frente a los 2 s, y las dos respuestas son veraces. Lo que la prueba exige es que la landing muestre el cambio antes de los 60 s.
- **Validaciones:**
  - `npm run typecheck`: 0.
  - `npm run lint`: 0.
  - `npm test`: `api` 89/89 y `landing-pages` 2158 + 1 *expected fail* (104 archivos).
  - En una ejecución intermedia falló una vez `landing-products-api.test.ts` ("arranque sin API", 16 ms). Es un archivo que este cambio no toca. Volvió a pasar en 3 ejecuciones aisladas y en la suite completa siguiente.
  - No queda ningún proceso abierto.

- **DEF-003** (QA ronda 2; decisión del usuario del 2026-10-27: "Ahora, en el PR 1 (Recomendado)"). La prueba "arranque sin API" de `landing-pages/tests/integration/landing-products-api.test.ts` exigía que los avisos `landing_products_fallback` llegaran en el orden molotes y luego birria, pero `warmUp` carga los dos negocios en paralelo (fallaba un 0,75 % de las veces).
  - **Cambio, solo en la prueba:** ahora exige exactamente dos avisos, uno de cada negocio con `source: seed`, sin depender del orden. El código de producción no cambia.
  - **Verificación:** 50 ejecuciones seguidas de la prueba, todas en verde.

#### Desviaciones y pendientes

1. **Variables del aviso interno opcionales también en producción en el PR 1.** El plan las hacía obligatorias (fallo rápido), pero eso exigiría tocar `compose.prod.yaml`, `deploy.sh` y los smoke, que son del PR 3. Sin ellas no se avisa y queda la red de seguridad de 60 s. El PR 3 las hace obligatorias junto con `compose.prod.yaml`.
2. **`api` siempre confía en `X-Forwarded-For`** (`app.proxy = true`), sin una variable `TRUST_PROXY` nueva. Es seguro porque solo es alcanzable desde la red interna. En el ticket 3, el router de Traefik de `api` debe limitarse al webhook (ya está en los riesgos).
3. **Cliente HTTP del admin y correspondencia formulario ↔ entrada** (`contracts/admin-client.ts` y `contracts/product-form.ts`): pasan al PR 2, donde está su único consumidor y se prueban con él. El PR 1 deja los esquemas del contrato.
4. **Sobrescritura tras un 409:** se pide con `?sobrescribir=1` en el `PUT`, porque `validateProductInput` rechaza campos desconocidos como `action`.
5. **`api/tests` usa un doble del repositorio de usuarios**, en proceso, como el store en memoria. Las reglas de usuarios con MySQL ya las cubre `landing-pages`, y el PR 3 añade la prueba de extremo a extremo con MySQL.
6. **Prueba estática de `api-process.test.ts`:** ahora solo comprueba que la API no importa semillas, porque desde REQ-F-039 escribe productos.
7. **Etiqueta del ticket:** el archivo sigue sin versionar (se creó con estado `APPROVED` sin commit) y se movió a `in-progress/` con `mv`, no con `git mv`.

## QA Action Plan

### PR 1 de 3 (2026-10-27, fase Q1)

**Aprobación:** aprobado por el usuario el 2026-10-27. Respuesta textual: "Si". Incluye el archivo de pruebas nuevo `admin-api-qa-req-f-039.test.ts`, la base temporal y el worktree temporal de `c53aca4`.

#### Objetivo

Validar con evidencia que el PR 1 (`feature/REQ-F-039-admin-nuevo-productos-1-api`, sin commit, base `epic/arquitectura` = `c53aca4`) cumple los CA que le asigna el Technical Action Plan (CA-2, CA-4, CA-5, CA-6, CA-7 y CA-16 en la parte de la API, CA-10, CA-11, CA-12, CA-13, CA-17 en la parte de `web` y CA-19 local), con las 6 desviaciones aprobadas por el usuario ("Si lo apruebo"), sin regresiones en `/admin`, el bot y las landings, y sin daños en los 24 archivos cuyas cabeceras se reconstruyeron durante la implementación.

#### Requisito bajo prueba

- `api` con `/api/v1/admin`: acceso con Bearer, CSRF en `X-CSRF-Token`, límite de intentos por el último valor de `X-Forwarded-For` (400 `CLIENT_IP_REQUIRED` sin IP); productos con `version`, 409 con `current` y `?sobrescribir=1` (desviación 4); `Idempotency-Key`; `meta.freshness`; aviso a `landing-pages` con reintentos a 1, 5 y 30 s; `image.src` contra la copia de `public/img`.
- `packages/web` nuevo (archivos movidos) y su regla de dependencias.
- `core` recibe el repositorio de productos, las sesiones, el límite de intentos, `resolveSession` y las fechas.
- `landing-pages`: puerto interno (3002) con `INTERNAL_NOTIFY_TOKEN` (401 sin credencial o con una incorrecta; 404 con `X-Forwarded-For` y en el puerto 3000); recarga del bot cada 60 s; modo de solo lectura con `ADMIN_NEW_URL` (410 y `PRODUCTS_MOVED`); sin la variable, todo como hoy.
- Desviaciones aprobadas que se validan como comportamiento esperado: (1) variables del aviso opcionales en producción en el PR 1; (2) `api` siempre confía en `X-Forwarded-For`; (3) cliente HTTP y `product-form` de `contracts` pasan al PR 2; (4) `?sobrescribir=1`; (5) doble del repositorio de usuarios en `api/tests`; (6) prueba estática de `api-process.test.ts` reducida.

#### Criterios de aceptación (alcance del PR 1 → pruebas)

| CA | Parte del PR 1 | Pruebas que lo cubren |
| --- | --- | --- |
| CA-2 | API | F-03, F-04, N-01, N-02, N-03, AUT-01 |
| CA-4 | API | F-06, N-04 |
| CA-5 | API (token; el `Origin` es del PR 2) | F-07, N-05 |
| CA-6 | API (reglas; interfaz con y sin JS es del PR 2) | F-08, F-09, F-10 |
| CA-7 | API (409 con `current` y sobrescritura) | F-11, N-06 |
| CA-10 | Receptor interno (Traefik es del PR 3) | F-13, N-07, N-08 |
| CA-11 | Notificador y red de seguridad de 60 s (P-3) | F-14, F-15, N-09, L-03 |
| CA-12 | API | F-12 |
| CA-13 | `/admin` actual con y sin `ADMIN_NEW_URL` | F-16, F-17, B-01 a B-04 |
| CA-16 | Logs de la API y del puerto interno (`no-store`/`noindex` del admin nuevo son del PR 2) | S-01, S-02 |
| CA-17 | Regla de `web` (bloque de `inventory-manager` es del PR 2) | D-01, D-02 |
| CA-19 | `typecheck`, `lint` y `test` locales en 0 | A-01 a A-04 |
| CA-8 (parcial) | 503 `DATABASE_UNAVAILABLE` sin detalles en la API | N-10 |

Fuera del PR 1 (no se evalúan ahora): CA-1, CA-3 (redirección y vuelta), CA-14 → PR 2; CA-9, CA-15, CA-18, CA-20 → PR 3.

#### Riesgos identificados

1. **R-HDR. Cabeceras reconstruidas en 24 archivos.** Pérdida o cambio de comentarios de cabecera, licencias, directivas (`// eslint-disable…`, `// @ts-expect-error`, `/* @vitest-environment */`, `#!`), orden de imports con efectos secundarios o modo de archivo. El análisis previo (`git diff -U0`, filtrando líneas de import) muestra 49 archivos modificados cuyo único cambio son imports: es el universo candidato.
2. **R-MOV. Archivos movidos con cambios.** `product-repository.ts`, `session-store.ts`, `login-throttle.ts`, `datetime.ts`, `render.ts`, `form-body.ts` y `json-body.ts` deben ser iguales al original salvo imports, los añadidos del plan (`reload`, `init()` sin fuentes) y comentarios de procedencia.
3. **R-NOT. Agrupación del notificador.** Mientras hay una cadena en curso para un negocio, una segunda escritura no lanza aviso (`chains.has` → `pending`). Si el primer intento ya está en vuelo y `landing-pages` recarga antes del commit de la segunda escritura, la segunda puede quedar sin reflejarse hasta la red de seguridad de 60 s aunque el aviso "se confirme". Hay que medir si ocurre.
4. **R-IDEM. Idempotencia por (usuario, clave).** La clave no está ligada al negocio ni al cuerpo: la misma clave en otro negocio podría devolver el producto del primero (y un `Location` de otro negocio).
5. **R-OVR. Sobrescritura tras 409.** `?sobrescribir=1` con una `version` desfasada no debe guardar en silencio sobre la versión de otro (RF-9).
6. **R-IP. IP del visitante.** Valores múltiples en `X-Forwarded-For`, IPv6, espacios, valores no IP.
7. **R-FIX. Fijación de sesión.** El login debe generar siempre un id nuevo y no adoptar un Bearer recibido; ids opacos de 256 bits.
8. **R-RO. Solo lectura.** POST HTML sin sesión, sin permiso, con y sin CSRF; plantillas nuevas (7) sin controles; 410 en páginas de alta/edición/eliminación; lecturas de `/admin/api`; el resto de `/admin` intacto.
9. **R-REG. Regresión por movimientos de imports** en `/admin`, bot, landings, webhook y scripts, y en el HTML de las landings (referencias de REQ-F-038).
10. **R-DOCK. Imágenes Docker.** `production`, `api` y `migrate` con `packages/web` en `npm ci` (`packages/*/package.json`), `api` con `public/img` en la ruta por defecto de `PRODUCT_IMAGES_DIR`.
11. **R-INT. Puerto interno.** Solo se abre con token; token mínimo de 32 caracteres; no se registra; con `X-Forwarded-For` → 404.

#### Pruebas funcionales

Se ejecutan con dos procesos reales (`api` en un puerto libre y `landing-pages` con su puerto interno) contra una base de pruebas `restaurante_test_*` migrada y efímera (soporte `makeScratchDatabase` o una base creada con `TEST_ADMIN_DATABASE_URL` y borrada al terminar), nunca contra la base de desarrollo. Peticiones con `curl`/`fetch`.

- **F-01.** `POST /api/v1/admin/sesion` válido → 201 `{ session: { id, csrfToken }, user }` con los negocios permitidos.
- **F-02.** `GET /sesion` → 200 con `csrfToken`; `DELETE /sesion` con CSRF → 204 y después 401.
- **F-03.** Cinco fallos desde una IP → 429 `LOGIN_LOCKED` con `Retry-After`; un sexto intento con la contraseña correcta sigue en 429 (no se comprueba la contraseña).
- **F-04.** Otra IP no queda afectada (201).
- **F-05.** 2 h de inactividad y `sessionVersion`/desactivación → 401 (prueba existente con reloj inyectado; se revisa).
- **F-06.** Editor de Molotes sobre Birria → 403 sin datos de Birria; `/tacos/` → 404; sin Bearer → 401. Orden: 401 → 404 → 403 → CSRF.
- **F-07.** Escrituras sin `X-CSRF-Token`, con el de otra sesión o inventado → 403 y la base sin cambios (lista antes/después).
- **F-08.** Alta → 201, `available: false`, al final de su categoría, slug único (dos altas con el mismo nombre), historial con autor (`product_change`).
- **F-09.** Máximo de activos → 422 con el mensaje del límite.
- **F-10.** Editar, eliminar (borrado lógico), recuperar (vuelve al final y no disponible), mover arriba/abajo y reordenar la categoría.
- **F-11.** Dos sesiones sobre el mismo producto: la segunda → 409 `VERSION_CONFLICT` con `current: { id, version, updatedAt, updatedBy }`; `?sobrescribir=1` con la versión vigente guarda y el historial registra `overwrite_after_conflict`.
- **F-12.** `image.src` inexistente → 422 en `image.src` ("La imagen no existe en public/img/."); existente → 201.
- **F-13.** Aviso con credencial correcta → 200 `{ landing, bot }`, `products_change_notified`; la siguiente visita a la landing muestra el cambio sin reiniciar (comprobación de proceso; la prueba de extremo a extremo con `inventory-manager` es del PR 3).
- **F-14.** Escritura con el aviso caído (landing-pages parada o puerto erróneo) → la escritura responde éxito con `meta.freshness: "pending"`; `products_notify_failed` en el log de `api` (sin token) y reintentos a 1, 5 y 30 s hasta `products_notify_gave_up`.
- **F-15.** Recarga del bot cada 60 s: prueba existente con temporizadores falsos y, en proceso, un cambio hecho directamente en la base aparece en el catálogo del bot tras el tick (observado por log o por el simulador `bot:chat` si es viable sin efectos laterales).
- **F-16.** Con `ADMIN_NEW_URL`: páginas de productos sin "Nuevo", "Editar", "Eliminar", "Subir/Bajar" ni "Recuperar", con aviso y enlace; alta/edición/eliminación → 410 con el aviso; todo POST de productos → 410 sin leer el formulario y sin cambios en la base; `/admin/api` escrituras → 410 `PRODUCTS_MOVED` (formato estándar, enlace en `message`), lecturas → 200.
- **F-17.** Sin `ADMIN_NEW_URL`: `/admin` igual que en `c53aca4` (alta, edición, eliminación, recuperación y movimientos por HTML y por `/admin/api`).
- **F-18.** `meta.freshness: "confirmed"` solo cuando landing-pages responde `landing: true` y `bot: true`.

#### Pruebas negativas y casos límite

- **N-01.** Login sin `X-Forwarded-For`, con `no-es-ip`, vacío o `unknown` → 400 `CLIENT_IP_REQUIRED`, sin contar el intento.
- **N-02.** `X-Forwarded-For: 203.0.113.9, 198.51.100.7`: el límite se cuenta por el último valor; cambiar solo el primer valor no evita el bloqueo.
- **N-03.** IPv6 y espacios alrededor de la IP: se aceptan y se cuentan por separado.
- **N-04.** `:id` inválido o de otro negocio → 404 sin datos.
- **N-05.** CSRF en `DELETE /sesion` y en cada escritura (`POST`, `PUT`, `DELETE`, `recuperar`, `mover`, `orden`).
- **N-06.** `?sobrescribir=1` con una `version` desfasada (R-OVR) → 409, nada se guarda.
- **N-07.** Receptor interno sin `Authorization`, con otro esquema (`Basic`), token incorrecto de la misma longitud → 401 y sin invalidar (la landing sigue sirviendo la copia anterior).
- **N-08.** Receptor con `X-Forwarded-For`, otra ruta, otro método, y la ruta en el puerto 3000 → 404; negocio desconocido → 400; no JSON → 415; cuerpo > 1 KiB → 413.
- **N-09.** Agrupación del notificador (R-NOT): dos escrituras del mismo negocio muy seguidas con una landing-pages lenta (servidor doble en la prueba que retrasa la respuesta del aviso). Se comprueba si la segunda escritura queda visible en la landing antes de los 60 s. Si no, se registra con la severidad que justifique el impacto observable.
- **N-10.** Base caída → 503 `DATABASE_UNAVAILABLE` sin trazas, SQL ni credenciales.
- **N-11.** `Idempotency-Key` repetida con el mismo cuerpo → un solo producto y `product_create_replayed`; clave con formato inválido (< 16 o > 64, caracteres no base64url) → 400 `INVALID_IDEMPOTENCY_KEY`; un primer envío fallido (422) libera la clave.
- **N-12.** Misma `Idempotency-Key` del mismo usuario en otro negocio o con otro cuerpo (R-IDEM): se documenta el resultado (producto devuelto y `Location`).
- **N-13.** Fijación (R-FIX): el login ignora un `Authorization: Bearer` recibido; dos logins dan ids distintos de 43 caracteres base64url; un id inventado → 401.
- **N-14.** Cuerpos: login > 4 KiB → 413; producto > 64 KiB → 413; JSON inválido → 400; tipo erróneo → 415; campo desconocido → 422.
- **N-15.** Configuración: `INTERNAL_NOTIFY_TOKEN` < 32 caracteres → error de configuración sin repetir el valor; `LANDING_INTERNAL_URL` sin token (o al revés) en `api` → error; `ADMIN_NEW_URL` con credenciales, query, fragmento o `http` en producción → error sin repetir el valor; sin token, el puerto interno no se abre.
- **N-16.** `GET /productos/campos` con combinación inválida → 400 `INVALID_KIND`.

#### Pruebas responsive

Solo aplica al `/admin` actual en modo de solo lectura (la interfaz nueva es del PR 2). En el navegador, a 375×812, 768×1024 y 1440×900: página del negocio y de eliminados con el aviso y el enlace, página 410; sin desplazamiento horizontal (`document.documentElement.scrollWidth <= innerWidth`), aviso legible y enlace alcanzable.

#### Pruebas de accesibilidad

Sobre las plantillas nuevas de solo lectura (`products-moved.html`, `products-moved-link.html`, `products-intro.html` y las filas/tablas `*-readonly.html`):

- un solo `h1` y jerarquía correcta; el aviso es texto, no solo color;
- el enlace al admin nuevo es un `<a>` con texto significativo, accesible con teclado y con foco visible;
- sin botones ni formularios residuales de edición;
- tablas con encabezados (`th`) como las originales;
- contraste del aviso con la paleta del `/admin` actual.

#### Pruebas UX/UI (vs. _stich_source_/)

El `/admin` actual no tiene diseño en `_stich_source_/` (usa la paleta de Tailwind, comentario C-8). Se valida coherencia con los componentes existentes de `/admin` (aviso, tabla y enlaces), no con Stitch. Las landings se validan por igualdad de HTML con las referencias de REQ-F-038 (R-1).

#### Pruebas de integración (WhatsApp)

Sin cambios funcionales esperados. Regresión: el bot usa el catálogo recargado (F-13, F-15); las pruebas del webhook y del orquestador (`whatsapp-*.test.ts`, `chat-bot-*.test.ts`) pasan; los `href` de WhatsApp de las landings quedan cubiertos por la igualdad de HTML (R-1).

#### Pruebas de performance

- La escritura no espera más de 2 s por el aviso (prueba existente "respuesta lenta" y medición en proceso con landing-pages lenta).
- El temporizador de 60 s no retiene el proceso (`unref`; prueba de arranque y parada).
- Peso de imagen Docker: diferencia de tamaño de `api` antes/después por la copia de `public/img` (solo informativo).

#### Pruebas SEO

Sin cambios esperados en las landings: la igualdad del HTML (R-1) cubre `title`, description, canonical, Open Graph y encabezados. `/admin` mantiene `noindex` y `no-store` en las páginas nuevas de solo lectura y en el 410.

#### Pruebas de regresión

- **R-1. HTML de las landings.** `landing-html-reference.test.ts` y `landing-snapshot.test.ts` en verde, y `git status`/`git diff c53aca4 -- landing-pages/tests/snapshots/` vacío (hoy ya lo está). Además, con el servidor arrancado, `GET /`, `/molotes` y `/birria` comparados con la salida de `c53aca4` en un `git worktree` temporal (mismos datos y fecha simulada), para descartar diferencias fuera de los casos de las referencias.
- **R-2. `/admin` completo sin `ADMIN_NEW_URL`**: toda la suite de `admin-*.test.ts` sin cambios de aserciones respecto a `c53aca4` (`git diff c53aca4 -- landing-pages/tests/integration/admin*.test.ts` solo con imports).
- **R-3. Bot y webhook**: suites `whatsapp-*` y `chat-bot-*` en verde.
- **R-4. API pública** `/api/v1/public`: `products-endpoint.test.ts` y `contract-types.test.ts` sin cambios de aserciones.
- **R-5. Scripts**: `admin:hash-password`, `admin:recover` y `bot:chat` arrancan (pruebas existentes `admin-recover.test.ts`, `bot-chat.test.ts`).
- **R-HDR. Revisión dirigida de los archivos con cabeceras reconstruidas** contra `epic/arquitectura` (`c53aca4`):
  1. Para cada archivo modificado o renombrado (`git diff --name-status -M c53aca4`), comparar con su versión en `c53aca4` (para los renombrados, `git show c53aca4:<ruta antigua>`).
  2. Script de comparación (en `/tmp`, sin tocar el repositorio) que, para cada par, extrae y compara: comentarios de bloque y de línea, directivas (`eslint-disable`, `@ts-expect-error`, `@ts-ignore`, `@vitest-environment`, `#!`, `'use strict'`, `/// <reference`), imports con efectos secundarios (`import '…'`), orden relativo de los no-import, final de línea, BOM y salto final. Cualquier diferencia fuera de imports se revisa a mano y debe estar justificada por el plan.
  3. `git diff --summary c53aca4` sin cambios de modo (bits de ejecución).
  4. Lista de los 49 archivos con cambios solo de imports como universo principal; revisión manual del cuerpo del diff de los 7 movidos y de los que tienen cambios no-import (`admin-guard.ts`, `admin-products*.ts`, `admin-business-view.ts`, `views/admin/products.ts`, `product-form.ts`, `admin-form.ts`, `server.ts`, `env.ts`, `config.test.ts`, `dependency-rule.test.ts`, `tests/helpers.ts`, `tests/support/process.ts`, `api-process.test.ts`, `core/shared/logger.ts`, `eslint.config.ts`, `Dockerfile`, `ci.yml`, `.env.example`, `arquitectura.md`).
  5. Que ninguna prueba haya perdido casos: número de `it(`/`test(` por archivo igual o mayor que en `c53aca4` (salvo la desviación 6, aprobada).

#### Pruebas automatizadas

**Existentes (se ejecutan todas):** `npm run typecheck`, `npm run lint` y `npm test` desde `restaurante/` (esperado: 2233 pruebas, `api` 83 y `landing-pages` 2150 + 1 *expected fail*), con atención a `admin-api.test.ts`, `notifier.test.ts`, `idempotency.test.ts`, `internal-app.test.ts`, `internal-notify-process.test.ts`, `product-repository-reload.test.ts`, `admin-products-moved.test.ts`, `dependency-rule.test.ts`, `landing-html-reference.test.ts` y `api-process.test.ts`.

- **A-01** typecheck, **A-02** lint, **A-03** test completo, **A-04** `npm run build:css`.
- **D-01.** Regla de `web`: `dependency-rule.test.ts` y sondas sin escribir archivos con `npx eslint --stdin --stdin-filename packages/web/sonda.ts` importando `@restaurante/core/shared`, `@restaurante/contracts`, `@prisma/client` y `../core/x.ts` → error; `koa` → sin error.
- **D-02.** Regla de las landings sobre el repositorio: `--stdin-filename landing-pages/src/controllers/landing.ts` importando `createProductRepository` de `@restaurante/core/catalog` → error. Y `core`/`contracts` no importan `web` (sonda equivalente).

**Nueva (solo en `restaurante/landing-pages/tests/`, si se aprueba):** `tests/integration/admin-api-qa-req-f-039.test.ts`, con procesos reales de `api` y `landing-pages` (precedente `api-process.test.ts`, `startServer` y `makeScratchDatabase`), para los huecos que la suite no cubre:

- N-02 y N-03 (último valor de `X-Forwarded-For`, IPv6);
- N-06 (`?sobrescribir=1` con versión desfasada → 409);
- N-12 (misma clave de idempotencia en otro negocio);
- N-13 (fijación: Bearer ignorado en el login, ids distintos);
- F-13/F-14 de proceso (aviso real: la landing muestra el cambio sin reiniciar; con el aviso caído, `pending` y `products_notify_failed`);
- N-09 (agrupación del notificador con un receptor lento);
- S-01 (logs de los dos procesos sin contraseña, id de sesión, token CSRF ni `INTERNAL_NOTIFY_TOKEN`).

Los casos que resulten defectos se dejan como pruebas que documentan el comportamiento esperado solo si el plan lo permite; si no, se describen en el QA Report sin marcar la suite en rojo. No se tocan `api/tests/` ni código de producción.

#### Pruebas en navegador

Con `landing-pages` en un puerto libre (`PORT=3100`) y el `.env` existente (más un `DATA_DIR` y base de pruebas si hace falta para no tocar datos de desarrollo):

- **B-01.** Sin `ADMIN_NEW_URL`: `/admin` → entrar → negocio → productos con "Nuevo", "Editar", "Eliminar", "Subir/Bajar"; eliminados con "Recuperar"; menú, usuarios, cuenta y bot accesibles. Consola sin errores.
- **B-02.** Con `ADMIN_NEW_URL=http://127.0.0.1:3103` (reinicio del servidor): productos sin controles, aviso y enlace correcto (`href`), eliminados sin "Recuperar", URL directa de alta/edición/eliminación → página 410 con el aviso; menú, usuarios, cuenta y bot iguales. No se sigue el enlace al admin nuevo.
- **B-03.** Teclado: tabulación hasta el enlace del aviso con foco visible.
- **B-04.** Responsive a 375×812, 768×1024 y 1440×900 de B-02.
- **B-05.** `/`, `/molotes` y `/birria` cargan sin errores de consola (complemento de R-1).

Si la extensión no responde tras 2–3 intentos, B-01 a B-05 quedan pendientes de revisión manual; CA-13 tiene cobertura automatizada (`admin-products-moved.test.ts` y F-16/F-17), así que no depende solo del navegador.

#### Pruebas de seguridad y logs

- **S-01.** Logs de `api` y `landing-pages` durante F-01 a F-18: `grep` de la contraseña usada, los ids de sesión, los `csrfToken` y el `INTERNAL_NOTIFY_TOKEN` → sin coincidencias.
- **S-02.** Respuestas de error de `api` y del puerto interno sin trazas, SQL ni rutas internas; `Cache-Control: no-store` en `/api/v1/admin` y en el receptor.
- **S-03.** Comparación del CSRF y del token interno en tiempo constante (`safeEqualStrings`), revisión de código como apoyo, no como evidencia única.

#### Pruebas de imágenes Docker

- **K-01.** `docker build` de los targets `production`, `api`, `migrate` y `test` desde `restaurante/`.
- **K-02.** Las comprobaciones del job `docker` del CI ejecutadas en local, incluidas las nuevas: `@restaurante/web` resoluble en `production` y `api`; `/app/landing-pages/public/img/molotes/*.jpg` en `api`.
- **K-03.** En la imagen `api`, `PRODUCT_IMAGES_DIR` por defecto resuelve a `/app/landing-pages/public` y el comprobador acepta una imagen real y rechaza una inexistente (`node -e` dentro del contenedor, sin base).
- **K-04.** El contenido de `public/img` de `api` coincide con el de `production` (lista y sumas).
- **K-05.** Las imágenes de prueba se borran al terminar.

#### Evidencia requerida

Salidas de `typecheck`, `lint`, `test` (totales por workspace) y `build:css`; salida del script de revisión de cabeceras y lista de diferencias justificadas; respuestas HTTP (estado, cabeceras y cuerpo) de F/N; extractos de log de S-01; capturas o texto de página de B-01 a B-05; salida de `docker build` y de las comprobaciones K; `diff` del HTML de las landings frente a `c53aca4`.

#### Criterios de aprobación

- CA-2, CA-4, CA-5, CA-6, CA-7, CA-10, CA-11, CA-12, CA-13, CA-16 y CA-17 en su parte del PR 1 pasan con evidencia, y CA-19 local en 0.
- R-HDR sin pérdidas ni cambios no justificados por el plan.
- HTML de las landings idéntico a las referencias de REQ-F-038.
- Sin `BLOCKER` ni `CRITICAL`; cualquier `MAJOR` (p. ej. de R-NOT, R-IDEM o R-OVR) vuelve al usuario como `NEEDS_USER_DECISION`.
- Imágenes Docker correctas (K-01 a K-04).

#### Lo que queda fuera de este QA

- **CI del PR hacia `epic/arquitectura`:** jobs `calidad`, `docker`, `despliegue` y `auditoria` en verde (CA-19 completo). Se verifica en T4 al abrir el PR; QA lo deja como condición.
- **PR 2:** `inventory-manager` (CA-1, CA-3 con redirección y `next`, CA-4 a CA-8 en la interfaz, CA-14, CA-16 `no-store`/`noindex`, CA-17 bloque de `inventory-manager`), `contracts/admin-client.ts` y `contracts/product-form.ts` (desviación 3), y el `Origin` ajeno de CA-5.
- **PR 3:** Docker de `inventory-manager`, `compose.prod.yaml`, `deploy.sh` (código 16), smoke del subdominio y de que Traefik no enruta `api` ni el 3002 (CA-10 y CA-15), variables del aviso obligatorias en producción (desviación 1), prueba de extremo a extremo de CA-9 con MySQL, documentación (CA-20) y memoria.

## QA Report

### PR 1 de 3 — Ronda 1 (2026-10-27, fase Q2)

#### Pruebas ejecutadas

Rama `feature/REQ-F-039-admin-nuevo-productos-1-api` (HEAD `c53aca4`, sin commit). Todo desde `restaurante/`.

| Prueba | Resultado |
| --- | --- |
| `npm run typecheck` | 0 (antes y después del archivo de QA) |
| `npm run lint` | 0, sin avisos (antes y después del archivo de QA) |
| `npm run build:css` | 0 |
| `npm test` (inicial) | `api` 83/83 (6 archivos); `landing-pages` 2150 + 1 *expected fail* (103 archivos). En total 2233 + 1 |
| `npm test` (final, con el archivo de QA) | `api` 83/83; `landing-pages` 2156 + 3 *expected fail* (104 archivos). Los 2 *expected fail* nuevos documentan DEF-001 y DEF-002 |
| Archivo nuevo `landing-pages/tests/integration/admin-api-qa-req-f-039.test.ts` | 8 casos con procesos reales de `api` y `landing-pages` sobre MySQL: 6 pasan; 2 son `it.fails` (DEF-001 y DEF-002) |
| Sondas de lint con `eslint --stdin` (sin escribir archivos) | `web` rechaza `@restaurante/core/shared`, `@restaurante/contracts`, `@prisma/client` y `../core/…`, y acepta `koa`. `core` y `contracts` rechazan `@restaurante/web`. Las landings rechazan `createProductRepository` de `@restaurante/core/catalog` |
| Revisión de cabeceras contra `c53aca4` (script en `/tmp`) | 90 archivos modificados o movidos comparados; ver "Revisión de los archivos con cabeceras reconstruidas" |
| Procesos reales (base temporal `restaurante_test_qa039`, borrada al terminar) | `api` y `landing-pages` nuevos (3101 y 3100, puerto interno 3102) junto a `api` y `landing-pages` de `c53aca4` (3201 y 3200, worktree temporal, borrado al terminar) |
| HTML frente a `c53aca4` | `/`, `/molotes`, `/birria` y `/admin/login`: cuerpo idéntico byte a byte y cabeceras iguales (sin contar fecha ni longitud). Los 404 solo difieren en la ruta de la traza de desarrollo (`NODE_ENV=development`, comportamiento previo) |
| `curl` contra `/api/v1/admin` y el puerto interno | Ver los criterios de aceptación |
| Navegador (Claude in Chrome) | `/admin` sin `ADMIN_NEW_URL` y con `ADMIN_NEW_URL=http://127.0.0.1:3103`: B-01, B-02, B-03 y B-05. Sin errores de consola |
| Docker | `docker build` de `production`, `migrate` y `api`: correcto. Las 6 comprobaciones del job `docker` del CI, en local: todas en 0. Imágenes borradas al terminar |

#### Criterios de aceptación

| CA (parte del PR 1) | Resultado | Evidencia |
| --- | --- | --- |
| CA-2 (API) | PASS | `admin-api.test.ts` (429 sin comprobar la contraseña; otra IP no afectada). QA N-02: cinco fallos con `X-Forwarded-For: 10.0.0.N, 203.0.113.77` → 401×4 y 429; cambiar el primer valor con la contraseña correcta sigue en 429 con `Retry-After`; otro último valor → 201. N-03: IPv6 (`2001:db8::1`) y la IP con espacios → 201; sin cabecera, vacía, `unknown` o con un último valor no IP → 400 `CLIENT_IP_REQUIRED`. En vivo: sin `X-Forwarded-For` → 400 `CLIENT_IP_REQUIRED` |
| CA-4 (API) | PASS | `admin-api.test.ts` (401, 403 sin datos y 404). En vivo: `GET /sesion` sin Bearer → 401; `/tacos/productos` → 404 `BUSINESS_NOT_FOUND` |
| CA-5 (API, token) | PASS | `admin-api.test.ts` (sin token, de otra sesión o inventado: 403 y el store sin cambios). En vivo: `POST` sin `X-CSRF-Token` → 403 `CSRF_INVALID`. El `Origin` ajeno es del PR 2 |
| CA-6 (API, reglas) | PASS | `admin-api.test.ts`. En vivo: el alta respondió `available: false`, posición 9 (la última), slug `molote-vivo-qa` y `freshness: confirmed` |
| CA-7 (API) | PASS | `admin-api.test.ts` (409 con `current`, quién y cuándo, y sobrescritura con la versión vigente). QA N-06: `?sobrescribir=1` con una versión desfasada → 409 y el producto conserva la versión 3 de otro usuario |
| CA-8 (parcial: 503 de la API) | PASS | QA N-10: con la base cortada (proxy TCP), `GET /api/v1/admin/molotes/productos` → 503 `DATABASE_UNAVAILABLE`, sin trazas, SQL ni credenciales en la respuesta ni en los logs |
| CA-10 (receptor interno) | PASS | `internal-app.test.ts` e `internal-notify-process.test.ts`. En vivo en el 3102: token correcto → 200 `{"landing":true,"bot":true}`; token incorrecto de la misma longitud → 401 `INVALID_CREDENTIALS`; `Basic` → 401; con `X-Forwarded-For` → 404; la misma ruta en el 3100 → 404; cuerpo de más de 1 KiB → 413; `Cache-Control: no-store`. La parte de Traefik es del PR 3 |
| CA-11 | PASS (con DEF-001, MINOR) | `notifier.test.ts` (reintentos 1/5/30 s, `gave_up`, agrupación y token fuera del log). QA F-14: con el aviso caído, el alta → 201 con `freshness: pending` y `products_notify_failed` en los intentos 1 y 2 (`reason: network`), sin el token. Red de seguridad del bot cada 60 s: `internal-app.test.ts`. Ver DEF-001 para las escrituras concurrentes |
| CA-12 | PASS | `admin-api.test.ts`. En vivo: `image.src` inexistente → 422 con `fields: { "image.src": "La imagen no existe en public/img/." }`; la existente → 201. En la imagen `api`, `PRODUCT_IMAGES_DIR` por defecto es `/app/landing-pages/public`: acepta una imagen real, rechaza una inexistente y rechaza `../../api/src/server.ts` |
| CA-13 | PASS | `admin-products-moved.test.ts` y el navegador con `ADMIN_NEW_URL`: lista y eliminados sin "Agregar", "Editar", "Eliminar", "Subir/Bajar" ni "Recuperar"; aviso con texto ("Los productos ahora se editan en el admin nuevo…") y enlace "Ir al admin nuevo" a la URL configurada. Las páginas de alta, edición y eliminación (molotes y birria) → 410 con el aviso. Los POST de crear, editar, eliminar, subir, bajar y recuperar (incluido uno sin CSRF) → 410, y el producto quedó en la versión 2 sin cambios. `DELETE /admin/api/...` → 410 `PRODUCTS_MOVED` con el enlace en `message`; `GET /admin/api/...` → 200. Usuarios, cuenta, bot y menú → 200, con sus controles. Sin `ADMIN_NEW_URL`, el navegador muestra todos los controles y la suite anterior pasa sin cambios en sus aserciones |
| CA-16 (logs de la API y del puerto interno) | PASS | `admin-api.test.ts` e `internal-app.test.ts`. QA S-01: los logs de los dos procesos en los 8 casos nuevos no contienen contraseñas, ids de sesión, tokens CSRF ni `INTERNAL_NOTIFY_TOKEN`. En vivo: 0 coincidencias de la contraseña, del id de sesión, del token CSRF y del token interno en los logs de los cuatro procesos |
| CA-17 (regla de `web`) | PASS | `dependency-rule.test.ts` y las sondas de lint |
| CA-19 (local) | PASS | `typecheck`, `lint` y `test` en 0. Falta el CI del PR |

#### Revisión de los archivos con cabeceras reconstruidas

Comparé los 90 archivos modificados o movidos de `restaurante/` y `.github/` con su versión en `c53aca4` (los movidos, contra su ruta antigua). Comprobé comentarios de bloque y de línea, directivas (`eslint-disable`, `@ts-expect-error`, `@ts-ignore`, `@vitest-environment`, `#!`, `use strict`, licencias), imports con efectos secundarios, BOM, CRLF, salto final y número de casos de prueba.

- **Sin pérdidas.** Ninguna directiva perdida ni cambiada, ningún import con efectos secundarios alterado, sin cambios de BOM, CRLF, salto final ni permisos (`git diff --summary` sin cambios de modo), y ningún archivo de pruebas con menos casos que antes.
- **24 archivos con diferencias en los comentarios, todas justificadas por el plan:**
  - los comentarios se actualizaron con la referencia a REQ-F-039 o al alcance nuevo;
  - los comentarios que desaparecieron de un archivo están en su destino. El bloque de mismo origen de `admin-guard.ts` está en `packages/web/same-origin.ts`; el de `createImageChecker`, en `core/catalog/image-checker.ts`; los de las hojas del formulario de `product-form.ts`, en `core/catalog/product-form-fields.ts`; el de `serializeError`, en `packages/web/logger.ts`;
  - `product-repository.ts` dejó de reexportar `toPublished` (y su comentario), y `typecheck` y `lint` pasan.
- **Los 7 movidos, línea a línea:**
  - `login-throttle.ts` y `render.ts`: idénticos;
  - `session-store.ts`, `datetime.ts`, `form-body.ts` y `json-body.ts`: solo cambian comentarios de procedencia;
  - `product-repository.ts`: solo cambian los imports, `init(sources?)`, `refresh` → `boolean` y `reload`, como pide el plan.
- **49 archivos solo cambian imports.**

#### Riesgos del plan

| Riesgo | Resultado |
| --- | --- |
| N-02 (último valor de `X-Forwarded-For`) | PASS |
| N-03 (IPv6, espacios y valores no IP) | PASS |
| N-06 (sobrescribir con una versión desfasada) | PASS: 409 y nada se guarda |
| N-09 (agrupación del notificador) | DEF-001 (MINOR). Con reintentos pendientes, la agrupación funciona: dos escrituras durante la espera de 5 s llegaron a la landing con el tercer intento, unos 4 s después. Falla solo si el primer intento está en vuelo y termina bien |
| N-12 (`Idempotency-Key` en otro negocio) | DEF-002 (MINOR) |
| N-13 (fijación de sesión) | PASS: el login ignora un `Bearer` recibido; cada login da un id y un token CSRF nuevos (43 caracteres base64url, 256 bits); un id inventado → 401 |

#### Defectos encontrados

### DEF-001
- **Severidad:** MINOR
- **Criterio de aceptación afectado:** RF-12 y CA-11 (frescura de cada escritura confirmada).
- **Descripción:** si una escritura de un negocio llega mientras el primer aviso de una escritura anterior del mismo negocio está en vuelo, el notificador no manda otro aviso (`chains.has(business)` → `pending`). Si `landing-pages` ya recargó antes de que la segunda escritura se guardara y ese intento termina bien, la cadena se cierra sin cubrir la segunda escritura. La landing y el bot no la muestran hasta la red de seguridad de 60 s.
- **Pasos para reproducir:** caso N-09 de `admin-api-qa-req-f-039.test.ts`. Un proxy delante del puerto interno reenvía el aviso al momento y retiene la respuesta 1,2 s (por debajo del límite de 1,5 s). Eli crea un producto de Molotes; 400 ms después, Ana publica otro.
- **Resultado esperado:** la segunda escritura llega a la landing en la siguiente visita, o queda un aviso pendiente que la cubra en segundos.
- **Resultado actual:** la segunda escritura responde 200 con `meta.freshness: "pending"` y no aparece en `/molotes` durante 8 s de sondeo. En el log de `landing-pages` solo hay un `products_change_notified` del primer aviso, anterior a la segunda escritura.
- **Evidencia:** la prueba `it.fails` N-09 y los logs de los procesos de la ronda.
- **Impacto:** reducido.
  - Exige dos escrituras concurrentes en el mismo negocio dentro del intento en vuelo. En condiciones normales dura unas decenas de milisegundos (la escritura en vivo con aviso confirmado tardó 144 ms), o más si `landing-pages` va lenta.
  - La respuesta es honesta (`pending`), así que el admin nuevo no afirmará que ya se ve.
  - El retraso queda acotado por la red de seguridad de 60 s (P-3).
- **Recomendación:** que una escritura que llega con un intento en vuelo deje pendiente otro aviso al terminar ese intento, en lugar de darse por cubierta.

### DEF-002
- **Severidad:** MINOR
- **Criterio de aceptación afectado:** caso límite "doble envío" (mecanismo `Idempotency-Key` del plan técnico).
- **Descripción:** la clave se recuerda por (usuario, clave), sin el negocio. La misma clave del mismo usuario en otro negocio devuelve el producto del primero.
- **Pasos para reproducir:** caso N-12. Ana crea en Molotes con `Idempotency-Key: clave-qa-req-f-039-0001` y, con la misma clave, crea en Birria.
- **Resultado esperado:** el alta de Birria crea su propio producto, o se rechaza la reutilización de la clave.
- **Resultado actual:** 201 con el producto de Molotes ("Molote Idempotente") y un `Location` de Birria con el id de ese producto de Molotes (`adminPaths.product(auth.businessId, value.product.id)`). No se crea nada en Birria.
- **Evidencia:** la prueba `it.fails` N-12.
- **Impacto:** reducido. El admin nuevo (PR 2) generará una clave aleatoria cada vez que pinte el formulario, así que solo ocurre si un cliente reutiliza la clave entre negocios. No expone datos de un negocio sin permiso, porque el permiso se comprueba antes.
- **Recomendación:** incluir el negocio en la clave recordada, y quizá una huella del cuerpo.

#### Regresión

- **Suite completa en verde:** `/admin`, bot, webhook, API pública, scripts y arranque.
- **Pruebas existentes de `/admin`:** `admin*.test.ts` solo cambian imports frente a `c53aca4`.
- **HTML de las landings:** las referencias de REQ-F-038 (`tests/snapshots/`) no cambian y `landing-html-reference.test.ts` y `landing-snapshot.test.ts` pasan. La salida en vivo de `/`, `/molotes` y `/birria` es idéntica a la de `c53aca4`.
- **Base de desarrollo:** al preparar la base temporal, un primer `npm run db:migrate` leyó `MIGRATION_DATABASE_URL` del `.env` de `packages/db` y apuntó a la base de desarrollo `restaurante`. Respondió "No pending migrations to apply" y no cambió nada. El segundo, con la variable explícita, migró la base temporal.

#### Responsive

**Pendiente de revisión manual.** La ventana de Chrome no se pudo redimensionar (sigue en 2560 px) y el `/admin` prohíbe los iframes (`frame-ancestors`). En escritorio, el aviso y el enlace se ven bien y no hay desplazamiento horizontal. Ningún CA del PR 1 depende de esto; CA-14 es del PR 2.

#### Accesibilidad

En las páginas de solo lectura y en el 410:
- un solo `h1` y `h2` por sección;
- tablas con `th`;
- aviso con texto, no solo color;
- el enlace "Ir al admin nuevo" es un `<a>` con nombre, accesible con teclado y con foco visible (contorno sólido de 3 px);
- sin botones ni formularios residuales de edición (el formulario del menú sigue, como debe);
- `meta robots` `noindex, nofollow`.

#### UX/UI

El aviso usa el estilo de avisos del `/admin` actual (tarjeta ámbar con borde a la izquierda). El `/admin` no tiene diseño en `_stich_source_/`.

#### Performance

Una escritura con aviso confirmado tardó 144 ms en vivo. Con el aviso lento, la escritura no espera más de unos 1,5 a 2 s (1283 ms con el proxy). La imagen `api` pesa 262 MB, con `public/img` (32 archivos, iguales que en `production`).

#### SEO

Sin cambios: el HTML de las landings es idéntico al de `c53aca4`.

#### Pendientes de revisión manual

- Responsive del `/admin` en solo lectura a 375, 768 y 1440 px (B-04).

#### Pendiente para el CI y para los PR 2 y 3

- **CI del PR hacia `epic/arquitectura`:** `calidad`, `docker`, `despliegue` y `auditoria` en verde (CA-19 completo).
- **PR 2:**
  - `inventory-manager`: CA-1, CA-3 (redirección y `next`), CA-4 a CA-8 en la interfaz, CA-14, `no-store`/`noindex` de CA-16 y el bloque de CA-17;
  - el `Origin` ajeno de CA-5;
  - `contracts/admin-client.ts` y `contracts/product-form.ts` (desviación 3);
  - generar una `Idempotency-Key` por formulario (contexto de DEF-002).
- **PR 3:**
  - Docker de `inventory-manager`, `compose.prod.yaml` y `deploy.sh` con el código 16;
  - smoke de que Traefik no enruta `api` ni el puerto 3002 (CA-10 y CA-15);
  - las variables del aviso obligatorias en producción (desviación 1);
  - la prueba de extremo a extremo de CA-9;
  - CA-18, CA-20 y la memoria.
- **DEF-001 y DEF-002:** a decidir si se corrigen en este ticket o en otro. Sus pruebas `it.fails` fallarán cuando se corrijan y entonces habrá que pasarlas a `it`.

#### Resultado final

QA_APPROVED

### PR 1 de 3 — Ronda 2 (2026-10-27, fase Q2, revalidación)

#### Qué cambió

El usuario decidió corregir DEF-001 y DEF-002 en el PR 1 ("Ahora, en el PR 1 (Recomendado)") y aprobó las correcciones ("Si las apruebo").
- **DEF-001:** cola de avisos por negocio en `api/src/notifier.ts`.
- **DEF-002:** la clave se recuerda por (usuario, negocio, clave) con una huella SHA-256 del cuerpo, y una reutilización con otro cuerpo responde 422 `IDEMPOTENCY_KEY_REUSED`. Archivos: `api/src/admin/idempotency.ts` y `product-routes.ts`.
- **Mis pruebas:** N-09 y N-12 pasan de `it.fails` a `it`. En N-09 se acepta `confirmed` o `pending` en la frescura de la segunda escritura.

#### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| Revisión del código corregido (CodeGraph) | `loop` por negocio: nunca dos intentos en paralelo. Las escrituras llegadas durante un intento las cubre el siguiente (un reintento o un aviso nuevo con su propia cuenta). `freshness` sale del primer intento que empieza después de la escritura. Al agotar los reintentos, las escrituras en espera quedan en `pending`. La idempotencia compara la huella antes de reutilizar |
| Ajuste de N-09 | Justificado y no debilita la prueba. La aserción que importa (la segunda escritura aparece en la landing antes de los 60 s, con 8 s de sondeo) se mantiene. Con la retención de 1,2 s, el intento que cubre la segunda escritura termina cerca del límite de 2 s, así que las dos frescuras son veraces según el reparto de tiempos. Para no dejar la frescura sin comprobar, añadí N-09b con un resultado determinista |
| Casos nuevos en `admin-api-qa-req-f-039.test.ts` | **N-09b:** con el aviso en vuelo retenido 300 ms, la segunda escritura responde `confirmed` y la landing ya la muestra al responder, sin esperar. **N-12b:** la misma clave con otro cuerpo en el mismo negocio → 422 `IDEMPOTENCY_KEY_REUSED` sin crear nada; con el mismo cuerpo → el mismo producto (uno solo); otro usuario con la misma clave → alta propia |
| `admin-api-qa-req-f-039.test.ts`, 3 ejecuciones | 10/10 en las tres |
| `npm run typecheck` / `npm run lint` | 0 / 0 |
| `npm test` (primera ejecución) | `api` 89/89. `landing-pages`: 1 fallo en `landing-products-api.test.ts` ("arranque sin API", 28 ms), con los avisos en orden `birria`, `molotes` (ver DEF-003); el resto, en verde |
| `npm test` (segunda ejecución) | `api` 89/89; `landing-pages` 2160 + 1 *expected fail* (104 archivos). Todo en verde |
| "Arranque sin API", aislada | 0 fallos en 25 ejecuciones, y 0 en 32 ejecuciones a 4 en paralelo |
| Sonda temporal de orden (archivo de prueba creado en `tests/` y borrado al terminar) | 400 `warmUp` con la API doble caída: `molotes,birria` 397 veces y `birria,molotes` 3 veces (0,75 %) |

#### Criterios de aceptación afectados

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-6 | PASS | `admin-api.test.ts` (alta, máximo de activos, slug, historial y la idempotencia nueva). N-12, N-12b |
| CA-11 | PASS | `notifier.test.ts` (3 casos nuevos y 2 adaptados). F-14 (aviso caído: `pending` y `products_notify_failed`). N-09 (segunda escritura visible antes de 60 s). N-09b (`confirmed` veraz) |
| CA-12 | PASS | `admin-api.test.ts` (422 en `image.src` si la imagen no existe; 201 si existe) |
| Resto de CA del PR 1 | Sin cambios | No tocados por las correcciones; la suite completa pasa |

#### Defectos

| Defecto | Estado |
| --- | --- |
| DEF-001 | **Corregido.** N-09 y N-09b en verde |
| DEF-002 | **Corregido.** N-12 y N-12b en verde |
| DEF-003 | **Nuevo, MINOR.** Prueba inestable heredada de REQ-F-038; no es del PR 1 |

### DEF-003
- **Severidad:** MINOR (solo de la prueba; el código de producción se comporta bien).
- **Criterio de aceptación afectado:** ninguno del PR 1. Afecta a CA-19 (CI en verde) por fallos espurios.
- **Descripción:** "CA-6 y CA-7: arranque sin API" de `landing-pages/tests/integration/landing-products-api.test.ts` exige que los dos avisos `landing_products_fallback` del arranque salgan en el orden `molotes`, `birria`. `warmUp` carga los dos negocios en paralelo (`Promise.all`) y la API doble caída cierra cada conexión, así que el orden de los avisos no está garantizado.
- **Pasos para reproducir:** ejecutar la suite o la sonda de orden varias veces.
- **Resultado esperado:** la prueba no depende del orden entre negocios.
- **Resultado actual:** falla aproximadamente 1 de cada 130 ejecuciones (3 de 400 en la sonda) con `expected [['birria','seed'], …] to deeply equal [['molotes','seed'], …]`. Pasó una vez durante el desarrollo y otra en esta ronda.
- **Evidencia:** fallo en la primera ejecución de `npm test` de esta ronda (28 ms, diff de orden), la sonda (397/3) y la lectura de `warmUp`.
- **Origen:** heredado. El archivo de prueba, `landing-products.ts` y el doble de la API no cambian frente a `c53aca4`. No es una regresión del PR 1.
- **Impacto:** un job de CI puede fallar sin motivo real y obligar a relanzarlo.
- **Recomendación:** comparar los avisos sin depender del orden (por ejemplo, ordenarlos o usar `arrayContaining` con la longitud). Es un cambio solo en la prueba; no lo apliqué porque el plan aprobado no lo contempla.

#### Observaciones (sin severidad)

- `loop(business)` se lanza con `void`. Si `response.body?.cancel()` o el logger lanzaran, sería un rechazo sin manejar. El código anterior tenía el mismo patrón y no hay evidencia de que ocurra. Se anota para el PR 2 o el PR 3.

#### Regresión

`typecheck`, `lint` y la suite completa (en la segunda ejecución) en verde. Las correcciones solo tocan `api/src/notifier.ts`, `api/src/admin/idempotency.ts`, `product-routes.ts` y sus pruebas. No afectan a `/admin`, al bot ni a las landings.

#### Limpieza

- Borrados el archivo de sonda y los logs temporales.
- No hay bases `restaurante_test_qa*` ni procesos de `node` o de Vitest abiertos.
- Sin cambios en el código de producción ni commit.
- Solo escribí el ticket y `admin-api-qa-req-f-039.test.ts` (2 casos nuevos).

#### Pendiente para el CI y para los PR 2 y 3

- Igual que en la ronda 1.
- Además, el usuario decide cuándo corregir DEF-003. Mientras siga, el CI del PR puede fallar de vez en cuando en esa prueba; basta con relanzarlo.

#### Resultado final

QA_APPROVED

## Historial de cambios

### QA del PR 1, ronda 2 (2026-10-27)

senior-qa, revalidación. DEF-001 y DEF-002 corregidos (N-09, N-09b, N-12 y N-12b en verde). `typecheck` y `lint` en 0. `npm test` en verde en la segunda ejecución; la primera falló en la prueba inestable heredada "arranque sin API" (DEF-003, MINOR, solo de la prueba). Estado `QA_APPROVED`.

### Correcciones de QA del PR 1 (2026-10-27)

El usuario decidió corregir DEF-001 y DEF-002 en el PR 1 ("Ahora, en el PR 1 (Recomendado)"). Hechas, con pruebas; `typecheck`, `lint` y `test` en 0. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA del PR 1, ronda 1 (2026-10-27)

senior-qa, fase Q2. El usuario aprobó el QA Action Plan ("Si"). `typecheck`, `lint` y `test` en 0. Se añadió `landing-pages/tests/integration/admin-api-qa-req-f-039.test.ts` (8 casos, 2 `it.fails`). La revisión de las cabeceras contra `c53aca4` no encontró pérdidas. El HTML de las landings es idéntico. Las imágenes Docker son correctas. Defectos: DEF-001 y DEF-002, los dos MINOR. Estado `QA_APPROVED`.

### QA Action Plan del PR 1 (2026-10-27)

senior-qa, fase Q1: el usuario aprobó la implementación del PR 1 y sus 6 desviaciones ("Si lo apruebo"). Se redacta el QA Action Plan del PR 1 (incluye la revisión dirigida de los 24 archivos con cabeceras reconstruidas contra `c53aca4`). Estado `NEEDS_QA_PLAN_APPROVAL`.

### Implementación del PR 1 (2026-10-27)

PR 1 implementado en `feature/REQ-F-039-admin-nuevo-productos-1-api`, sin commit. `typecheck`, `lint` y `test` en 0 (2233 pruebas). Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Aprobación del plan e inicio del PR 1 (2026-10-26)

El usuario respondió P-1 a P-4 con las opciones recomendadas y aprobó el Technical Action Plan ("Sí, aprobar e implementar PR 1"). RF-17, CA-17 y CA-11 se ajustan. Rama `feature/REQ-F-039-admin-nuevo-productos-1-api` desde `epic/arquitectura` (`c53aca4`). El ticket pasa a `in-progress/` con el estado `IN_PROGRESS`.

### Revisión técnica (2026-10-26)

senior-fullstack, fase T1: revisión técnica y Technical Action Plan redactado con las opciones recomendadas. Estado `NEEDS_TECHNICAL_CLARIFICATION` por cuatro decisiones: P-1 (paquete `web` frente a copiar código, afecta a RF-17 y CA-17), P-2 (tres PR), P-3 (interpretación de CA-11 con *stale-while-revalidate*) y P-4 (validación del sistema visual). Memoria estimada: 35,6 %, por debajo del umbral del 80 %.

### Versión 1

Descripción inicial (2026-10-26). Aprobada por el usuario con las decisiones B (SSR con Koa como las landings), de diseño, división, frescura, convivencia, imágenes, subdominio, acceso y dispositivos, y con D-1, D-2, D-3, la recarga del bot cada 60 s y el límite de Traefik de 60 por minuto con ráfaga de 60.
