# REQ-F-039 — Admin nuevo (`inventory-manager`) en `admin.birriaelmuneco.com` y gestión de productos por `/api/v1/admin`

## Estado

QA_APPROVED (PR 2 de 3, `inventory-manager`: QA ronda 2 aprobada el 2026-10-28; DEF-004 a DEF-008 corregidos; siguiente paso: commit y PR hacia `epic/arquitectura`)

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
- Merge del PR 1 (#94), confirmado por el usuario el 2026-10-28: "Fusionado".
- QA del PR 2, ronda 1 (2026-10-28): DEF-005: "Ahora, en el PR 2 (Recomendado)"; DEF-008 y DEF-004: "DEF-008 ahora (Recomendado), DEF-004 ahora (Recomendado)"; DEF-007: "Aclarar el borde (Recomendado)". DEF-006 (BLOCKER) se corrige obligatoriamente.
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

#### Pull Request del PR 1

- **PR:** #94, https://github.com/orvigas/negocio/pull/94 (base `epic/arquitectura`).
- **Commit:** `75c4b4d`.
- **CI** (ejecución 40664267304): `calidad`, `docker`, `despliegue`, `auditoria` y `cambios` en verde. `publish`, `deploy`, `vigente`, `validado` y GitGuardian aparecen omitidos, como corresponde a un PR.
- **Pendiente para el PR 2 o el PR 3** (observación de QA, sin severidad): `loop(business)` del notificador se lanza con `void`. Si `response.body?.cancel()` o el logger lanzaran, sería un rechazo sin manejar. Hay que capturarlo con `.catch` y registrarlo.

#### Desviaciones y pendientes

1. **Variables del aviso interno opcionales también en producción en el PR 1.** El plan las hacía obligatorias (fallo rápido), pero eso exigiría tocar `compose.prod.yaml`, `deploy.sh` y los smoke, que son del PR 3. Sin ellas no se avisa y queda la red de seguridad de 60 s. El PR 3 las hace obligatorias junto con `compose.prod.yaml`.
2. **`api` siempre confía en `X-Forwarded-For`** (`app.proxy = true`), sin una variable `TRUST_PROXY` nueva. Es seguro porque solo es alcanzable desde la red interna. En el ticket 3, el router de Traefik de `api` debe limitarse al webhook (ya está en los riesgos).
3. **Cliente HTTP del admin y correspondencia formulario ↔ entrada** (`contracts/admin-client.ts` y `contracts/product-form.ts`): pasan al PR 2, donde está su único consumidor y se prueban con él. El PR 1 deja los esquemas del contrato.
4. **Sobrescritura tras un 409:** se pide con `?sobrescribir=1` en el `PUT`, porque `validateProductInput` rechaza campos desconocidos como `action`.
5. **`api/tests` usa un doble del repositorio de usuarios**, en proceso, como el store en memoria. Las reglas de usuarios con MySQL ya las cubre `landing-pages`, y el PR 3 añade la prueba de extremo a extremo con MySQL.
6. **Prueba estática de `api-process.test.ts`:** ahora solo comprueba que la API no importa semillas, porque desde REQ-F-039 escribe productos.
7. **Etiqueta del ticket:** el archivo sigue sin versionar (se creó con estado `APPROVED` sin commit) y se movió a `in-progress/` con `mv`, no con `git mv`.

### PR 2 de 3: `inventory-manager` (2026-10-28)

#### Rama

`feature/REQ-F-039-admin-nuevo-productos-2-inventory`, creada desde `epic/arquitectura` (`fd8bf4b`, con el PR 1 mergeado). No hay commit ni PR.

#### Cambios realizados

**1. `packages/contracts` (desviación 3 del PR 1: el cliente y el formulario llegan ahora, con su consumidor).**
- `admin-client.ts` (`createAdminApiClient`):
  - nunca lanza: devuelve los datos validados con el contrato, el error de la API (`code`, `message`, `fields`, `current`) o el fallo de transporte (`timeout`, `network`, `invalid_response`);
  - la sesión viaja como `Authorization: Bearer`; `X-CSRF-Token` solo en escrituras; `X-Forwarded-For` en el login; `Idempotency-Key` en el alta;
  - sin redirecciones y con un cuerpo de 1 MiB como máximo.
- `product-form.ts`: `parseProductForm`, `formErrors`, `productFormValues` y `emptyProductFormValues`, guiados por el descriptor de la API. Misma forma que el `/admin` actual: filas fijas con «Posición» y «Quitar».
- `http.ts`: las utilidades HTTP de `public-client.ts`, extraídas sin cambios para compartirlas.

**2. Workspace `inventory-manager` (Koa con SSR).**
- **Configuración** (`src/config.ts`): `NODE_ENV`, `HOST`, `PORT` (3003), `API_INTERNAL_URL` (obligatoria) y `TRUST_PROXY`. No tiene credenciales de la base ni la del aviso interno.
- **Sesión** (`src/session.ts`):
  - cookie `__Host-admin_sid` en producción (`admin_sid` fuera de ella), `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, sin `Domain` ni `Max-Age`; se reenvía como Bearer;
  - `sanitizeNext`: solo las pantallas GET del admin; cualquier otro destino vuelve a `/`.
- **Pantallas** (`src/controllers/admin.ts` y `src/routes.ts`):
  - acceso y salir;
  - selector de negocio (o directo al único permitido);
  - lista por categoría y en orden;
  - alta: primero la categoría y, en Birria, el tipo de detalle;
  - edición, con 422 por campo y resumen enlazado, y 409 que conserva lo escrito, dice quién y cuándo, y ofrece «Cargar la versión vigente» o «Guardar mis cambios sobre la versión vigente»;
  - eliminar con confirmación, eliminados con «Recuperar», y subir y bajar.
  - Todo con POST/redirect/GET.
  - El mensaje de éxito dice si la landing y el bot ya muestran el cambio (`meta.freshness`).
- **API no disponible** (RF-10 y CA-8): página 503 con un aviso claro. En alta y edición se vuelve a pintar lo escrito; para eso los descriptores ya recibidos se guardan por combinación, de modo que también funciona si la API cae antes de comprobar la sesión.
- **Seguridad:**
  - mismo origen (`assertSameOrigin` de `web`) en todos los POST; el `_csrf` del formulario va a la API como `X-CSRF-Token`;
  - `X-Forwarded-For` con `ctx.ip` (con `TRUST_PROXY`, el último valor);
  - `no-store`, `X-Robots-Tag: noindex, nofollow`, `<meta name="robots">`, `Referrer-Policy: same-origin`;
  - CSP estricta (`script-src 'self'`; estilos y fuentes propios y de Google Fonts; `form-action 'self'`; `frame-ancestors 'none'`);
  - en producción, solo por HTTPS (503 sin TLS);
  - `robots.txt` con `Disallow: /`;
  - `GET /salud` responde sin llamar a la API.
- **Clave de idempotencia por formulario:** el alta lleva `requestId` (24 caracteres base64url), que se conserva al volver a pintar el formulario tras un 422 o un 503.
- **Vistas** (`src/views/`): plantillas con el renderizador de `packages/web`.
  - BEM: `admin-shell`, `admin-header`, `login-card`, `business-picker`, `product-list`, `product-row`, `product-form`, `field`, `notice`, `confirm-panel`, `kind-choice` y `button--primary|secondary|ghost|danger`.
  - Un solo `h1`, salto al contenido, `aria-current` en la navegación.
  - Errores con `aria-invalid`, `aria-describedby`, icono y texto «Error:» (no solo color). Un aviso de error recibe el foco.
- **Tailwind** (`src/styles/main.css`): tokens de P-4 y acento por negocio con `--accent`. Contraste comprobado: crema sobre el rojo de Birria 5,96; sobre el azul de Molotes 5,79; masa sobre superficie 9,91; error sobre superficie 9,95.
- **JS de mejora** (`public/js`, módulos ES con `data-*`):
  - `submit-guard.js`: evita el doble envío; pone `aria-busy` y «Guardando…»;
  - `reorder.js`: sube y baja con `fetch` y `X-Fragment: product-list`; reemplaza la lista con el fragmento del servidor, conserva el foco y lo anuncia en `aria-live`; si falla, envía el formulario normal.

**3. Monorepo.**
- Workspace en el `package.json` raíz, con los scripts `dev:inventory`, `start:inventory`, `build:css` y `watch:css` de los dos workspaces. `package-lock.json` actualizado sin dependencias nuevas.
- `eslint.config.ts`: bloque de `inventory-manager` (solo `contracts` y `web`; nunca `core`, `db`, Prisma ni otra app), reglas de servidores de prueba, `public/js` y CSS generado.
- `dependency-rule.test.ts`: 13 casos de `inventory-manager` (CA-17).
- `landing-pages/Dockerfile`: las etapas que hacen `npm ci` copian `inventory-manager/package.json`, y la etapa `build` copia el workspace para el typecheck y las pruebas. La imagen propia llega en el PR 3.
- `.dockerignore` ignora el CSS generado.

**4. Observación de QA del PR 1.** En `api/src/notifier.ts`, el bucle de avisos ya no se lanza con `void`: un fallo inesperado se captura y se registra como `products_notify_loop_failed`. Tiene una prueba.

#### Criterios de aceptación

| CA | Estado en el PR 2 |
| --- | --- |
| CA-1 | Cumplido: cookie `__Host-admin_sid` con `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` y sin `Domain`; credenciales inválidas dan un mensaje genérico y ninguna cookie |
| CA-2 | Completo: la IP reenviada es la del proxy (último valor), no la falseada por el navegador. La parte de la API ya estaba en el PR 1 |
| CA-3 | Completo en la interfaz: sin sesión o con una sesión que la API ya no acepta, al acceso con `next` y vuelta; destinos externos ignorados; POST caducado con aviso |
| CA-4 | Completo: 403 «sin permiso» sin datos ni llamadas a la API del otro negocio; 404 en un negocio inexistente; la navegación solo ofrece los negocios permitidos |
| CA-5 | Completo: `Origin` ajeno y `Sec-Fetch-Site: cross-site` dan 403 sin llamar a la API; sin token o con el de otra sesión, 403 de la API y nada cambia |
| CA-6 | Completo sin JS (alta, edición, eliminar, recuperar, mover y doble envío) y con JS (fragmento de reordenar y pruebas jsdom) |
| CA-7 | Completo: 409 con lo escrito, quién y cuándo, sin botón de guardado normal; sobrescribir solo a petición |
| CA-8 | Completo: 503 con lo escrito intacto y sin trazas |
| CA-14 | Pruebas de estructura (etiqueta en cada control, un solo `h1`, salto al contenido, `lang`, foco en el resumen, botones con nombre). La revisión manual con teclado, a 375 px y en escritorio queda para QA |
| CA-16 | Completo en `inventory-manager`: `no-store`, `noindex` y ningún secreto en el log |
| CA-17 | Completo (lint y `dependency-rule.test.ts`) |
| CA-19 | Locales en 0. El CI del PR se ejecuta en T4 |
| CA-9, CA-15, CA-18 y CA-20 | PR 3 |

#### Validaciones ejecutadas

Desde `restaurante/`, con el MySQL local:

- `npm run typecheck`: 0.
- `npm run lint`: 0.
- `npm run build:css`: 0.
- `npm test`:
  - antes: `api` 89 y `landing-pages` 2160 + 1 *expected fail* (2250 en total);
  - después: `api` 90, `landing-pages` 2173 + 1 *expected fail* e `inventory-manager` 67 (6 archivos), 2331 en total. Todo verde.
- `docker build` de las etapas `api` y `migrate` en local: correcto.
- No queda ningún proceso abierto.

#### Pantallas (descripción)

Fondo brasa `#1c1412`, tarjetas `#261a17` con borde `#432c27`, texto crema, títulos en Epilogue mayúscula y etiquetas en Space Grotesk.

- **Acceso:** tarjeta centrada con «Administración / Molotes y Birria El Muñeco», usuario, contraseña y el botón «Entrar» a todo el ancho.
- **Selector:** dos tarjetas con borde superior del acento de cada negocio (azul en Molotes, rojo en Birria).
- **Cabecera:** marca, chips de los negocios permitidos (el activo, relleno con el acento y `aria-current`), nombre del usuario y «Salir».
- **Lista:** título con el nombre del negocio en el color secundario del acento; acciones «Agregar platillo», «Agregar bebida» y «Ver eliminados»; tarjetas por producto con número, nombre, precio, estado en texto y los botones «Subir», «Bajar», «Editar» y «Eliminar».
  - En móvil todo va en una columna; desde `md`, la información a la izquierda y las acciones a la derecha.
- **Formulario:** grupos «Datos del producto», «Imagen» y «Variantes» (o «Chips»), con filas numeradas, en dos columnas desde `md`, y la ayuda de cada campo.
- **Confirmación de eliminar:** panel con el botón rojo de contorno y «Cancelar».

#### Correcciones de QA del PR 2, ronda 1 (2026-10-28)

Decisiones del usuario: DEF-005: "Ahora, en el PR 2 (Recomendado)"; DEF-008 y DEF-004: "DEF-008 ahora (Recomendado), DEF-004 ahora (Recomendado)"; DEF-007: "Aclarar el borde (Recomendado)". DEF-006 era BLOCKER y su corrección, obligatoria.

- **DEF-006** (BLOCKER, `public/js/modules/submit-guard.js`).
  - `submit-guard` ya no copia el name/value del botón a un campo oculto. El navegador ya lo incluye al construir los datos del envío, y el botón se deshabilita después, con `setTimeout`.
  - Prueba nueva `inventory-manager/tests/integration/js-server.test.ts`, en jsdom:
    - pinta la página real del servidor y activa `submit-guard`;
    - toma los datos del envío como los construye el navegador (`new FormData(form, submitter)`) y los manda al servidor;
    - cubre crear, editar y sobrescribir tras un 409: en los tres hay un solo `action` y responden 303.
  - Comprobé que estas 3 pruebas fallan con el código anterior.
  - La prueba jsdom de `submit-guard` exige ahora que no haya un campo oculto repetido.
- **DEF-005** (`src/middleware/security.ts`): en producción, `/salud` responde 200 también sin TLS (`HEALTH_PATH`); el resto del admin sigue solo por HTTPS.
  - `access.test.ts`: `/acceso` da 503 y `/salud` da 200, con `no-store`.
  - El `it.fails` de DEF-005 en `landing-pages/tests/integration/inventory-manager-qa-req-f-039.test.ts` pasa a `it` y queda en verde.
- **DEF-008** (`src/views/index.ts` y `src/controllers/admin.ts`): el aviso de conflicto del 409 es ahora una alerta urgente (`urgent: true`), con `role="alert"`, `tabindex="-1"` y `autofocus`, igual que los avisos de error del 422 y el 503. Sigue con el tono de advertencia (borde adobo) y su texto dice «no se guardó nada». `products.test.ts` comprueba el rol y el foco.
- **DEF-004** (`eslint.config.ts`): `api` e `inventory-manager` (código y pruebas) revisan también los `import()` dinámicos con `no-restricted-syntax`.
  - `inventory-manager`: rechaza `@restaurante/*` salvo `contracts` y `web`, Prisma y mariadb, `api/src`, `landing-pages` y las rutas relativas a `packages/`.
  - `api`: rechaza `landing-pages`, `inventory-manager`, archivos internos de `core` y rutas relativas a `packages/`.
  - 11 casos nuevos en `dependency-rule.test.ts`.
- **DEF-007** (solo en el admin; las landings no cambian):
  - el borde de los campos en reposo pasa a **`#ab8985`**, el color `outline` de `_stich_source_/birrier_a_el_mu_eco/DESIGN.md`, como token `--color-outline`;
  - contraste medido: **5,35:1** sobre la tarjeta `#261a17` y **5,74:1** sobre el fondo `#1c1412` de las filas (antes, 1,31:1);
  - lo usan los campos de texto, selector y área de texto, y la pantalla de acceso;
  - las casillas mantienen el borde adobo `#c2410c`: 3,26:1 sobre `#261a17` y 3,50:1 sobre `#1c1412`.
- **Validaciones:**
  - `npm run typecheck`: 0.
  - `npm run lint`: 0.
  - `npm run build:css`: 0.
  - `npm test`: `api` 90; `landing-pages` 2193 + 1 *expected fail* (105 archivos, con el archivo de QA); `inventory-manager` 70 (7 archivos).
  - No queda ningún proceso abierto.

#### Desviaciones y pendientes

1. **El PR 2 toca `landing-pages/Dockerfile` y `.dockerignore`.** Sin eso, `npm ci` falla en Docker por el workspace nuevo. Solo copia el `package.json` y el código para el typecheck; la etapa y la imagen `inventory-manager` siguen siendo del PR 3.
2. **Los descriptores de formulario se guardan en memoria** para conservar lo escrito con la API caída. Salen del código de core, así que solo cambian cuando se despliega la API.
3. **Sin favicon propio** (`<link rel="icon" href="data:,">`) para no duplicar binarios entre imágenes. Se puede revisar en el PR 3.
4. **Las pruebas de `inventory-manager` usan un doble de la API** que cumple el contrato. La prueba con los procesos reales y MySQL es la de extremo a extremo del PR 3.
5. **La documentación** (README del workspace, `desarrollo.md`, `despliegue.md` y `arquitectura.md`) queda para el PR 3, como dice el plan. `inventory-manager/.env.example` documenta las variables.

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

### PR 2 de 3: `inventory-manager` (2026-10-28, fase Q1)

**Aprobación:** aprobado por el usuario el 2026-10-28. Respuesta textual: "Si lo apruebo". Incluye el archivo `inventory-manager-qa-req-f-039.test.ts`, la base temporal `restaurante_test_qa039pr2` y los procesos locales. DEF-003 del PR 1 ya se corrigió antes del merge (#94); si vuelve a fallar, es un hallazgo nuevo.

#### Objetivo

Validar con evidencia que el PR 2 (`feature/REQ-F-039-admin-nuevo-productos-2-inventory`, sin commit, base `epic/arquitectura` = `fd8bf4b`) cumple los CA que le asigna el plan técnico (CA-1, CA-3, CA-4 a CA-8 en la interfaz, CA-14, CA-16 y CA-17, y CA-2 completo), con CA-19 en local y sin regresiones en `api`, `landing-pages`, `contracts` ni en las imágenes Docker.

#### Requisito bajo prueba

- **Workspace `inventory-manager`:** Koa con SSR, Tailwind (tokens de P-4 y acento por negocio) y Vanilla JS de mejora (`submit-guard.js` y `reorder.js`).
  - Sesión con cookie `__Host-admin_sid` (`admin_sid` fuera de producción) reenviada como Bearer, y `next` con lista cerrada.
  - CSRF en dos capas: `assertSameOrigin` y `_csrf` → `X-CSRF-Token`.
  - CSP estricta, `no-store`, `noindex`, `Referrer-Policy: same-origin` y solo HTTPS en producción.
  - Una `requestId` por formulario de alta como `Idempotency-Key`.
  - Páginas 403, 404 y 503; esta última conserva lo escrito.
- **`contracts`:** `admin-client.ts`, `product-form.ts` y `http.ts`. Este último se extrajo de `public-client.ts` y debe seguir igual.
- **Regla de dependencias:** `inventory-manager` solo importa `contracts` y `web`. La imponen el lint y los 13 casos de `dependency-rule.test.ts`.
- **Cambios fuera del workspace:** `landing-pages/Dockerfile` y `.dockerignore` (desviación 1), y `api/src/notifier.ts` (`products_notify_loop_failed`, observación del QA del PR 1).
- **Desviaciones 2 a 5 aceptadas por el usuario:** descriptores en memoria, sin favicon, doble de la API en las pruebas y documentación en el PR 3.

#### Criterios de aceptación (PR 2 → pruebas)

| CA | Pruebas que lo cubren |
| --- | --- |
| CA-1 | S-01, S-02, F-01, F-02 |
| CA-2 (completo) | S-08 |
| CA-3 | F-03, S-05, S-06, N-01 |
| CA-4 | F-04, N-02 |
| CA-5 | S-03, S-04 |
| CA-6 | F-05 a F-10 (sin JS), J-01 a J-04 (con JS) |
| CA-7 | F-11, B-07 |
| CA-8 | F-12, B-08 |
| CA-14 | B-01 a B-10 (revisión manual), A-03 |
| CA-16 | S-07, S-09 |
| CA-17 | D-01 a D-03 |
| CA-19 (local) | R-01 a R-05 |

Fuera de este QA, por ser del PR 3: CA-9, CA-15, CA-18 y CA-20.

#### Riesgos identificados

1. **R-NEXT.** Redirección abierta o destino no válido en `next` (`//evil`, `/\evil`, esquemas, codificaciones `%2F%2F`, mayúsculas, rutas con barra final o con query).
2. **R-COOKIE.** Atributos de la cookie en producción detrás de TLS terminado en el proxy (`TRUST_PROXY`). Fijación: la cookie debe renovarse al entrar y borrarse al salir o cuando la API rechace la sesión.
3. **R-CSRF.** POST con `Origin` ajeno, `Origin: null`, `Sec-Fetch-Site: cross-site` o `same-site`; `_csrf` ausente, de otra sesión o reutilizado tras salir.
4. **R-CSP.** Recursos bloqueados (estilos o fuentes de Google, JS de módulos) o CSP permisiva (`unsafe-inline` o `unsafe-eval`, comodines).
5. **R-IDEM.** `requestId` perdida o regenerada al volver a pintar el formulario tras un 422 o un 503; o compartida entre formularios o pestañas.
6. **R-503.** Lo escrito no se conserva si la API cae antes o después de comprobar la sesión; trazas o detalles internos en la respuesta.
7. **R-409.** Que se guarde sin querer sobre la versión de otro; que se pierda lo escrito; que falten quién y cuándo.
8. **R-A11Y.** Foco perdido tras reordenar, anuncio ausente en `aria-live`, contraste insuficiente en estados (deshabilitado, foco, error o éxito), desplazamiento horizontal a 375 px.
9. **R-JS.** Doble envío con conexiones lentas; `reorder.js` sin respaldo si `fetch` falla; errores en consola o violaciones de CSP.
10. **R-DEP.** Que `inventory-manager` importe `core`, `db`, Prisma u otra app, también en sus pruebas o scripts.
11. **R-REG.** Regresión en las landings por la extracción de `http.ts` de `public-client.ts`; en `api` por el cambio del notificador; en Docker por el workspace nuevo.
12. **R-ENV.** Repetir el incidente del PR 1: `npm run db:migrate` lee `packages/db/.env` y apunta a la base de desarrollo si no se fija `MIGRATION_DATABASE_URL`.

#### Pruebas funcionales (procesos reales, base de pruebas)

Con `api`, `landing-pages` (solo para crear la base, importar la semilla y crear el primer administrador) e `inventory-manager` arrancados como se describe en "Entorno local".

- **F-01.** Entrar con credenciales válidas.
  - Administrador: llega al selector de negocio.
  - Editor de Molotes: va directo a `/molotes/productos`.
  - La cookie `admin_sid` es `HttpOnly`, `SameSite=Strict`, `Path=/` y sin `Domain` ni `Max-Age`.
- **F-02.** Credenciales inválidas: mensaje genérico y ningún `Set-Cookie` de sesión.
- **F-03.** Sin sesión, cualquier pantalla lleva a `/acceso?next=<ruta>` y, tras entrar, vuelve a la ruta pedida. Una sesión cerrada en la API (salir desde otra pestaña, o desactivar la cuenta desde el `/admin` actual) lleva al acceso en la siguiente petición. Un POST caducado muestra el aviso de sesión caducada.
- **F-04.** Editor de Molotes en `/birria/productos` (lista, alta, edición o eliminados): 403 "sin permiso" sin datos de Birria. `/tacos/productos`: 404. La cabecera solo ofrece los negocios permitidos.
- **F-05.** Alta sin JS: categoría y, en Birria, tipo de detalle; formulario; 303 a la lista con el mensaje de éxito y la frescura. El producto queda no disponible y al final.
- **F-06.** Edición con 303 y el mensaje según `meta.freshness` ("ya se ve" o "pendiente").
- **F-07.** Eliminar con la pantalla de confirmación; "Cancelar" vuelve sin cambios.
- **F-08.** "Recuperar" desde eliminados.
- **F-09.** Subir y bajar sin JS (formularios POST con 303).
- **F-10.** Doble envío del alta (el mismo formulario enviado dos veces con la misma `requestId`): un solo producto.
- **F-11.** 409: dos sesiones con el mismo producto abierto; la segunda guarda.
  - Conserva lo escrito y muestra quién y cuándo, sin el botón de guardado normal.
  - "Cargar la versión vigente" carga los datos de la otra sesión.
  - "Guardar mis cambios sobre la versión vigente" guarda solo a petición, con el historial de sobrescritura.
- **F-12.** API caída (proceso de `api` detenido) al guardar un alta y una edición: 503 con el aviso, lo escrito intacto y sin trazas. Se repite con la API caída antes de comprobar la sesión (descriptores en memoria, desviación 2).
- **F-13.** Salir: 303 al acceso, cookie borrada y la sesión ya no vale en la API. Volver atrás no muestra datos (`no-store`).
- **F-14.** El mensaje de éxito solo dice que la landing y el bot ya muestran el cambio cuando la API respondió `confirmed`. Se comprueba con y sin `landing-pages` escuchando el aviso.

#### Pruebas de seguridad

- **S-01.** Producción detrás de proxy (`NODE_ENV=production`, `TRUST_PROXY=true`, con `X-Forwarded-Proto: https` por `curl`): la cookie se llama `__Host-admin_sid` y lleva `Secure`, `HttpOnly`, `SameSite=Strict` y `Path=/`, sin `Domain`. Sin TLS (sin la cabecera) → 503 "solo por HTTPS".
- **S-02.** Fijación: al entrar se sustituye cualquier cookie previa por un id nuevo; una cookie inventada no da acceso y se borra.
- **S-03.** Primera capa de CSRF: POST con `Origin` ajeno, `Origin: null` sin `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Site: cross-site` o `same-site` → 403 sin llamar a la API (se comprueba en el log de `api`, que no recibe la petición) y sin cambios.
- **S-04.** Segunda capa: `_csrf` ausente, de otra sesión o de una sesión cerrada → 403 de la API y sin cambios en la lista.
- **S-05.** `next` (R-NEXT), con valores codificados y sin codificar: `//evil.example`, `/\evil`, `https://evil.example`, `javascript:…`, `/%2F%2Fevil`, `/MOLOTES/productos`, `/molotes/productos/`, `/molotes/productos?x=1`, `/molotes/productos/0/editar`, `/salir` y `/acceso` → siempre `/`. Los destinos válidos se respetan.
- **S-06.** `Location` de todas las redirecciones: siempre una ruta relativa interna.
- **S-07.** Cabeceras en todas las respuestas (HTML, 403, 404, 503, `robots.txt`, `/salud` y estáticos):
  - `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: same-origin`;
  - `<meta name="robots">` en el HTML;
  - `robots.txt` con `Disallow: /`;
  - CSP sin `unsafe-inline` ni `unsafe-eval` en `script-src`, con `form-action 'self'`, `frame-ancestors 'none'` y `object-src 'none'`.
- **S-08.** IP reenviada (CA-2):
  - con `TRUST_PROXY=true` y `X-Forwarded-For: 1.1.1.1, 203.0.113.9`, la API cuenta la IP `203.0.113.9`;
  - sin `TRUST_PROXY`, cuenta la del socket, aunque el navegador mande la cabecera;
  - el límite de 5 fallos bloquea el acceso con un mensaje claro.
- **S-09.** Logs de `inventory-manager` y de `api` durante toda la ronda: sin contraseñas, ids de sesión (valores de cookie), `_csrf` ni la credencial del aviso.
- **S-10.** `requestId` (R-IDEM): 24 caracteres base64url, distinta en cada formulario pintado y en cada pestaña; se conserva tras un 422 y un 503; una `requestId` manipulada (formato inválido) no se acepta.
- **S-11.** `inventory-manager` no recibe credenciales de la base ni el token del aviso. Se comprueba en `config.ts` y en `.env.example`, por nombre de variable, sin leer ningún `.env`.

#### Pruebas negativas y casos límite

- **N-01.** Sesión caducada a mitad de una edición (la API la invalida): al enviar, acceso con aviso y `next` a la pantalla. Se anota si lo escrito se conserva; sin JS no es obligatorio.
- **N-02.** URL directa a un producto inexistente → 404; a uno del otro negocio → 403 o 404, sin datos.
- **N-03.** Campos manipulados (desconocidos, categoría o tipo inválidos, `version` no numérica, `?ok=` fuera de la lista cerrada) → 400, 404 o un mensaje controlado, sin trazas.
- **N-04.** Cuerpos de formulario por encima del límite → 413 controlado.
- **N-05.** Métodos no permitidos y rutas desconocidas → 404 o 405 con la página del admin, sin trazas.

#### Pruebas con JavaScript

- **J-01.** `submit-guard.js`: al enviar, el botón pasa a `aria-busy` y "Guardando…" y un segundo clic no envía otra vez (red lenta simulada con la API retrasada). Si la página vuelve atrás (`pageshow`), el botón se restablece.
- **J-02.** `reorder.js`: "Subir" y "Bajar" piden por `fetch` con `X-Fragment: product-list` y reemplazan la lista. El foco queda en el botón equivalente del producto movido y `aria-live` anuncia la nueva posición. En los extremos, el botón que no aplica no rompe el foco.
- **J-03.** Respaldo de `reorder.js`: con la API devolviendo error o un 409, se envía el formulario normal y el resultado es el mismo que sin JS.
- **J-04.** Consola sin errores ni violaciones de CSP en todas las pantallas.
- **J-05.** Pruebas jsdom existentes (`enhancements.test.ts`).

#### Pruebas de accesibilidad y responsive (CA-14, revisión manual en el navegador)

- **B-01. Teclado.** Recorrido completo con Tab y Shift+Tab: salto al contenido (visible al recibir el foco), cabecera, chips de negocio, acciones, filas, formulario y botones. Sin trampas de foco. Todo se puede activar con Enter o Espacio.
- **B-02. Foco visible.** Contorno de 2 px `#eab308` (o el definido) en enlaces, botones, campos y casillas, sobre las superficies oscuras y sobre el acento.
- **B-03. Contraste AA.** Medido con un script que calcula el contraste de cada texto visible y de los bordes de los controles a partir de los estilos computados. Cubre texto normal, etiquetas, ayudas, mensajes de error y éxito, botones primario, secundario, *ghost* y peligro, chips activos e inactivos y estados deshabilitados, en los dos acentos. Se contrastan las cifras con las declaradas: 5,96, 5,79, 9,91 y 9,95.
- **B-04. 375 px.** Sin desplazamiento horizontal (`scrollWidth <= innerWidth`) en acceso, selector, lista, alta, edición con errores, 409, confirmación de eliminar, eliminados, 403, 404 y 503. Las filas se apilan, los botones tienen un área táctil adecuada y no hay textos cortados.
- **B-05. Escritorio** (1440×900, y 768×1024 como tablet): diseño en dos columnas desde `md` y la misma lista de pantallas.
- **B-06. Formulario.** Cada control tiene etiqueta. Errores 422: resumen enlazado que recibe el foco; cada campo con `aria-invalid` y `aria-describedby` hacia su error; icono y texto "Error:", no solo color.
- **B-07. 409** en el navegador: aviso con quién y cuándo, lo escrito conservado, foco en el aviso y las dos acciones claras.
- **B-08. 503** en el navegador: aviso claro y formulario intacto.
- **B-09. Estructura.** Un solo `h1`, encabezados jerarquizados, `lang="es"`, `aria-current` en la navegación y estado "Disponible" o "No disponible" con texto.
- **B-10. Sin JS.** Los formularios son `<form method="post">` con `action` propia y botones `type="submit"`, y el flujo completo funciona sin JS (cubierto por F-05 a F-11 con `curl`, que no ejecuta JS). En el navegador se comprueba que la interfaz no depende de JS para mostrar ni para enviar.

**Cómo se hará en el navegador.** En el PR 1, la ventana de Chrome no se pudo redimensionar (2560 px) y la CSP `frame-ancestors 'none'` impide los iframes. Para 375, 768 y 1440 px se abrirá desde la pestaña de trabajo una ventana emergente del mismo origen con `window.open(url, 'qa', 'width=…,height=…')`, y se medirán diseño, foco y contraste desde la pestaña que la abrió (mismo origen). Si tampoco es posible, B-04 y B-05 quedarán pendientes de revisión manual del usuario y CA-14 volverá como `NEEDS_USER_DECISION`, porque depende de esa revisión.

#### Pruebas de la regla de dependencias (CA-17)

- **D-01.** `dependency-rule.test.ts`: los 13 casos de `inventory-manager` en verde. Se revisa que cubran `core`, `db`, Prisma, las otras apps (`landing-pages` y `api`), imports relativos fuera del workspace, el código de pruebas y que se acepten `contracts`, `web` y las dependencias externas propias.
- **D-02.** Sondas sin escribir archivos (`npx eslint --stdin --stdin-filename` sobre archivos existentes del workspace: `src/app.ts`, `tests/unit/product-form.test.ts` y `scripts/dev-server.ts`):
  - importar `@restaurante/core/shared`, `@restaurante/db/client`, `@prisma/client`, `../../landing-pages/src/app.ts` y `../../api/src/app.ts` → error;
  - importar `@restaurante/contracts`, `@restaurante/web` y `koa` → sin error;
  - `public/js` con globales del navegador → sin error.
- **D-03.** `package.json` de `inventory-manager` sin `@restaurante/core` ni `@restaurante/db`, y búsqueda de imports en `src/`, `tests/` y `scripts/`.

#### Pruebas de regresión

- **R-01.** `npm run typecheck` desde la raíz (todos los workspaces y la configuración).
- **R-02.** `npm run lint`, sin avisos.
- **R-03.** `npm run build:css` (los dos workspaces).
- **R-04.** `npm test` de todos los workspaces. Esperado: `api` 90, `landing-pages` 2173 + 1 *expected fail* e `inventory-manager` 67; 2331 en total. Si falla "arranque sin API" de `landing-products-api.test.ts`, se atribuye a DEF-003 (inestabilidad conocida, MINOR, heredada) solo si el diff de orden coincide con `birria` antes que `molotes`, y se vuelve a ejecutar.
- **R-05.** `docker build` de las etapas `deps`, `build`, `production`, `migrate` y `api` tras el cambio del `Dockerfile` y de `.dockerignore`. Las 6 comprobaciones del job `docker` del CI en local. El contexto no incluye `node_modules`, `.env` ni el CSS generado de `inventory-manager`, y la etapa `build` compila y comprueba los tipos de `inventory-manager`. Las imágenes se borran al terminar.
- **R-06.** `contracts/public-client.ts` frente a `fd8bf4b`: la extracción de `http.ts` no cambia el comportamiento. El diff solo mueve código, y las pruebas del cliente público y las de las landings pasan.
- **R-07.** HTML de las landings: las referencias de REQ-F-038 (`tests/snapshots/`) no cambian y `landing-html-reference.test.ts` pasa.
- **R-08.** `api/src/notifier.ts`: la prueba nueva de `products_notify_loop_failed` y las pruebas N-09 y N-09b del PR 1 en verde.
- **R-09.** El `/admin` actual (con y sin `ADMIN_NEW_URL`), por la suite (`admin-*.test.ts` y `admin-products-moved.test.ts`).

#### Entorno local para el navegador (sin tocar desarrollo ni producción)

1. **Base:** una base desechable `restaurante_test_qa039pr2` en el MySQL de pruebas (127.0.0.1:3307, usuario DDL de pruebas, el que define el soporte de `tests/`), creada con `docker exec … mysql -e "CREATE DATABASE …"`. Nunca la base `restaurante` ni la de producción.
2. **Migraciones:** `MIGRATION_DATABASE_URL=<base de pruebas> npm run db:migrate`. Antes de seguir se comprueba que la salida dice `Datasource "db": MySQL database "restaurante_test_qa039pr2"`. Si dice otra base, se detiene y se informa. No se lee ni se muestra ningún `.env`.
3. **Procesos:** con `env -i` (sin `--env-file`, sin heredar el `.env` de nadie) y solo variables explícitas:
   - `api` en el 3101 (`DATABASE_URL` del usuario DML de pruebas sobre esa base);
   - `landing-pages` en el 3100 (misma base, un `DATA_DIR` temporal, el aviso interno en el 3102 con un token generado en la sesión, y `ADMIN_USER` y `ADMIN_PASSWORD_HASH` generados en la sesión) para importar la semilla y crear el primer administrador;
   - un editor de Molotes creado desde el `/admin` actual;
   - `inventory-manager` en el 3103 con `API_INTERNAL_URL=http://127.0.0.1:3101`, en `development` para el navegador y en `production` con `TRUST_PROXY=true` para las comprobaciones de S-01 con `curl`.
4. **Identificación de procesos:** por puerto (`lsof -tiTCP:<puerto> -sTCP:LISTEN`), nunca con `pgrep -f`. Las esperas sondean el puerto o la URL con `curl`.
5. **Credenciales:** las de prueba se generan en la sesión y no se muestran en el informe.
6. **Limpieza al terminar:** detener los procesos, borrar la base, el `DATA_DIR` temporal, los logs y los scripts de `/tmp`, y las imágenes Docker de prueba, y cerrar las pestañas del navegador.

#### Pruebas automatizadas

- **Existentes:** todas (R-04), con atención a `inventory-manager/tests/**`, `dependency-rule.test.ts`, `notifier.test.ts`, `admin-client.test.ts`, `product-form.test.ts` y `enhancements.test.ts`.
- **Nuevas (solo si se aprueba):** en `restaurante/landing-pages/tests/integration/inventory-manager-qa-req-f-039.test.ts`, con procesos reales de `api` e `inventory-manager` sobre MySQL (`startServer` y `makeDatabase`, sin importar código de `inventory-manager`), para lo que la suite del PR 2 no cubre al usar el doble de la API:
  - S-01 (atributos de la cookie en producción detrás de proxy);
  - S-05 y S-06 (la lista completa de `next` y `Location`);
  - S-03 (CSRF de la primera capa sin llegar a la API);
  - S-08 (IP reenviada con y sin `TRUST_PROXY`);
  - F-10 y S-10 (`requestId` y doble envío reales);
  - F-12 (API caída de verdad);
  - S-09 (logs de los dos procesos sin secretos).

  No se tocan las pruebas de `inventory-manager/` ni el código de producción. Un defecto encontrado se documenta con `it.fails` y la referencia DEF-NNN, como en el PR 1.

#### Evidencia requerida

- Salidas de R-01 a R-05, con totales por workspace.
- Cabeceras y cuerpos de `curl` de F y S.
- Salidas de las sondas de lint.
- Medidas del navegador: `scrollWidth`, contraste por elemento, foco (elemento activo y estilo del contorno), texto de `aria-live`, consola sin errores. Capturas de acceso, lista, formulario con errores, 409, 503 y la vista a 375 px.
- Extractos de log de S-09.

#### Criterios de aprobación

- CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-8, CA-14, CA-16 y CA-17 pasan con evidencia, y CA-19 local en 0.
- Sin `BLOCKER` ni `CRITICAL`. Cualquier `MAJOR` vuelve al usuario como `NEEDS_USER_DECISION`.
- La revisión manual de CA-14 hecha en el navegador; si no se puede, `NEEDS_USER_DECISION`.
- Sin regresiones en `api`, `landing-pages`, `contracts` ni Docker.
- Entorno limpio al terminar.

#### Lo que queda fuera de este QA

- **CI del PR hacia `epic/arquitectura`:** `calidad`, `docker`, `despliegue` y `auditoria` en verde (CA-19 completo).
- **PR 3:**
  - la etapa e imagen Docker de `inventory-manager`;
  - `compose.prod.yaml` con la red `admin` y Traefik;
  - `deploy.sh` con 4 imágenes y el código 16;
  - el smoke del subdominio, el límite de 60 por minuto y que Traefik no enrute `api` ni el puerto 3002;
  - CA-9 (extremo a extremo con MySQL);
  - CA-15 (subdominio, certificado y redirección a HTTPS);
  - CA-18 (despliegue);
  - CA-20 (documentación);
  - las variables del aviso obligatorias en producción;
  - el favicon propio, si se decide (desviación 3);
  - la memoria.
- **DEF-003** (prueba inestable heredada): pendiente de la decisión del usuario.

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

### PR 2 de 3: `inventory-manager` — Ronda 1 (2026-10-28, fase Q2)

#### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| `npm run typecheck` / `npm run lint` / `npm run build:css` | 0 / 0 / 0 |
| `npm test` (inicial) | `api` 90; `landing-pages` 2173 + 1 *expected fail*; `inventory-manager` 67 (6 archivos). 2331 + 1, todo en verde |
| `npm test` (final, con el archivo de QA) | `api` 90; `landing-pages` 2181 + 2 *expected fail* (105 archivos); `inventory-manager` 67. Todo en verde. "Arranque sin API" no falló |
| Archivo nuevo `landing-pages/tests/integration/inventory-manager-qa-req-f-039.test.ts` | 9 casos con procesos reales (`api`, `landing-pages` e `inventory-manager` sobre MySQL): 8 pasan; 1 `it.fails` documenta DEF-005. Pasa `typecheck` y `lint` |
| `docker build` de `deps`, `build`, `production`, `migrate` y `api` | Correcto. Las 6 comprobaciones del job `docker` del CI en local: todas en 0. La etapa `build` comprueba los tipos de `inventory-manager` y no lleva `.env`. Imágenes `qa2:*` borradas al terminar |
| Revisión de `contracts/public-client.ts` | Solo se movieron `isTimeout`, `isJson` y `readLimited` a `http.ts` (añadiendo `export`); sin cambios de comportamiento. Las referencias de REQ-F-038 (`tests/snapshots/`) no cambian |
| Regla de dependencias | Los 13 casos de `dependency-rule.test.ts` cubren `core`, `core/catalog`, `db`, Prisma, `mariadb`, `api` y `landing-pages` por ruta relativa, rutas relativas a `packages/` y las pruebas, y permiten `contracts`, `web`, `koa` y archivos propios. Sondas `eslint --stdin` adicionales: `scripts/` rechaza `core` y `db`; `src/` rechaza `@restaurante/core`; `tests/` rechaza `../../../landing-pages`; `koa-static` y `public/js` pasan. **Un `import()` dinámico de `@restaurante/core/shared` pasa el lint** (DEF-004). Ningún import prohibido en `src/`, `tests/`, `scripts/` ni `package.json` |
| Entorno local | Base `restaurante_test_qa039pr2`. Antes de migrar, `prisma migrate status` con `MIGRATION_DATABASE_URL` explícita confirmó `Datasource "db": MySQL database "restaurante_test_qa039pr2"`. Procesos con `env -i`: `api` 3101, `landing-pages` 3100 (aviso interno 3102) e `inventory-manager` 3103 (desarrollo) y 3104 (producción con `TRUST_PROXY`). Editor de Molotes creado con el repositorio de usuarios sobre la base temporal (comprobando el nombre de la base antes de conectar) |
| `curl` contra `inventory-manager` | Ver los criterios de aceptación y la seguridad |
| Navegador (Claude in Chrome) | Pestaña de trabajo a 2560 px y ventana emergente del mismo origen redimensionada a 375×755, 768 y 1440. Teclado, foco, contraste, `reorder.js`, `submit-guard.js`, 422, 409 y 503 |

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Desarrollo: `admin_sid; path=/; samesite=strict; httponly`. Producción detrás del proxy: `__Host-admin_sid; path=/; samesite=strict; secure; httponly`, sin `Domain` ni `Max-Age` (S-01, `curl` y prueba). Credenciales inválidas: 401 "Usuario o contraseña incorrectos." y ningún `Set-Cookie` |
| CA-2 | PASS | Con `TRUST_PROXY=true` y `X-Forwarded-For: 10.0.0.N, 203.0.113.50`, la API registra `ip: 203.0.113.50`; 5 fallos → 429 "bloqueado temporalmente"; otra IP → 303. Sin `TRUST_PROXY`, la cabecera falseada se ignora (`ip: 127.0.0.1`) |
| CA-3 | PASS | Sin sesión → `303 /acceso?next=%2Fmolotes%2Fproductos%2F5%2Feditar` y, tras entrar, vuelve a esa pantalla (también en el navegador, con el teclado). 16 destinos maliciosos de `next` (`//evil`, `/\evil`, `https:`, `javascript:`, `%2F%2F`, mayúsculas, barra final, query, id 0, `/salir`, `/acceso`, espacio inicial, CRLF) → `/`. Una cookie inventada → 303 al acceso y la cookie se borra. Tras salir, la cookie anterior ya no vale |
| CA-4 | PASS | Editor de Molotes en 5 pantallas de Birria → 403 "Sin permiso", sin datos de Birria y **0 llamadas a la API de Birria**; `/tacos/productos` → 404; la cabecera solo ofrece Molotes |
| CA-5 | PASS | `Origin` ajeno, `Origin: null`, `Sec-Fetch-Site: cross-site` y `same-site` → 403 en `inventory-manager` (`admin_csrf_rejected` con `origin`, `origin_null` y `fetch_site`), **sin ninguna petición a la API**. `_csrf` vacío, de otra sesión o inventado → 403 de la API (`admin_csrf_rejected`, `reason: token`), sin cambios en el orden |
| CA-6 | **FAIL** | **Sin JS:** pasa. Alta con doble envío (un solo producto), eliminar, recuperar, subir y bajar, y frescura en el mensaje ("La landing y el bot ya muestran el cambio"). **Con JS:** el alta y la edición fallan siempre con 400 "El formulario tiene campos repetidos." (DEF-006, BLOCKER). Eliminar y recuperar con JS funcionan. `reorder.js` funciona (ver J-02) |
| CA-7 | PASS en el servidor (con la observación de DEF-008 y bloqueado con JS por DEF-006) | 409 real entre dos sesiones: conserva lo escrito, "Última modificación: qa, el 28/10/2026 08:54", sin el botón de guardado normal, "Cargar la versión vigente" y "Guardar mis cambios sobre la versión vigente"; sobrescribe solo a petición (prueba F-11 y navegador) |
| CA-8 | PASS | API detenida: el alta y la edición → 503 con `role="alert"` "Servicio no disponible…", lo escrito intacto (nombre, precio e imagen), la misma `requestId` y sin trazas (navegador y prueba F-12) |
| CA-14 | **FAIL** | Ver "Accesibilidad y responsive". Teclado, foco visible, contraste del texto, 375 px y escritorio pasan, pero el formulario de producto no se puede usar con JS (DEF-006). Además, DEF-007 y DEF-008 (MINOR) |
| CA-16 | PASS | `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: same-origin` y CSP en 12 tipos de respuesta (HTML, 303, 403, 404, 400, `robots.txt`, `/salud`, CSS y JS). `<meta name="robots">` y `robots.txt` `Disallow: /`. Logs de los 4 procesos sin las 2 contraseñas, el token interno, el token CSRF ni 4 ids de sesión (0 coincidencias) |
| CA-17 | PASS (con DEF-004, MINOR) | Lint y `dependency-rule.test.ts`. El hueco del `import()` dinámico es DEF-004 |
| CA-19 (local) | PASS | `typecheck`, `lint` y `test` en 0 |

#### Seguridad

- **S-01 (TLS):** en producción sin TLS → 503 "Administración disponible solo por HTTPS."
- **S-07 (CSP):** `default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests`. Sin `unsafe-inline` ni `unsafe-eval`. Sin errores ni violaciones de CSP en la consola.
- **S-10 (`requestId`):** 24 caracteres base64url; distinta en cada formulario; se conserva tras un 422 y un 503; una `requestId` con formato inválido se sustituye por una nueva en el servidor (el alta se hace una vez y nunca llega `INVALID_IDEMPOTENCY_KEY` a la API).
- **S-11:** `inventory-manager` solo tiene las variables `NODE_ENV`, `HOST`, `PORT`, `API_INTERNAL_URL` y `TRUST_PROXY` (sin base de datos ni token del aviso).

#### Accesibilidad y responsive (CA-14)

- **Teclado (B-01, B-02):**
  - el primer Tab va a "Saltar al contenido", visible al recibir el foco;
  - los 30 siguientes recorren la cabecera, los chips, "Salir", las acciones y las filas, todos con `:focus-visible` y un contorno sólido de 2 px `rgb(234,179,8)`;
  - sin trampas de foco;
  - el acceso se hace entero con teclado y vuelve a `next`.
- **Áreas táctiles:** 44 px de alto en botones y enlaces de acción. Son más pequeños el enlace "Administración" de la marca (28 px) y los enlaces "Volver a productos" (17 px de alto, enlaces de texto).
- **Contraste del texto (B-03):** script sobre los estilos computados. Lista de Molotes: 89 textos, mínimo 5,79. Formulario con errores: 58 textos, mínimo 5,79. Lista de Birria: 57 textos, mínimo 5,96. Ningún texto por debajo de AA. Bordes de los botones de contorno: mínimo 3,26.
- **Contraste de los campos (WCAG 1.4.11):** el borde de los campos en reposo `#432c27` sobre la tarjeta `#261a17` da 1,31:1, y el fondo del campo frente a la tarjeta, 1,07:1 (DEF-007).
- **375 px (B-04):** sin desplazamiento horizontal (`scrollWidth = 375`) en selector, listas de Molotes y Birria, elección de tipo, alta, edición, confirmación de eliminar, eliminados, 404 y 409. Las filas se apilan (acciones debajo del nombre).
- **768 y 1440 px (B-05):** sin desplazamiento horizontal; desde `md`, la información a la izquierda y las acciones a la derecha en la misma línea.
- **422 (B-06):** resumen con `role` de alerta que recibe el foco (`:focus-visible`), con 8 enlaces `#f-…` a sus campos. Cada campo con error tiene `aria-invalid="true"` y `aria-describedby` hacia la ayuda y "⚠Error: …". Lo escrito y la `requestId` se conservan. Los 11 controles tienen etiqueta. Un solo `h1`, `lang="es"`.
- **409 (B-07):** aviso completo y lo escrito conservado, pero el foco queda en `body`: el aviso es `role="status"` sin foco (DEF-008).
- **503 (B-08):** el aviso `role="alert"` recibe el foco y el formulario queda intacto.
- **JS (J-01 a J-04):**
  - `reorder.js`: con "Bajar" y "Subir" por teclado, la lista se reemplaza sin recargar, el foco sigue en el botón del producto movido (o en "Bajar" cuando llega a la primera posición) y `aria-live` anuncia "Molotes de Tinga de Pollo: posición 3 de 8". Con una versión desfasada, aviso "La lista cambió mientras tanto: no se movió nada."
  - `submit-guard.js`: rompe el alta y la edición (DEF-006).
  - Consola sin errores.
- **Sin JS (B-10):** los formularios son `<form method="post">` con `action` propia, y el flujo completo funciona por `curl` y en el navegador sin `submit-guard`.

#### Defectos encontrados

### DEF-006
- **Severidad:** BLOCKER
- **Criterio de aceptación afectado:** CA-6 (con JavaScript), CA-7 y CA-14; RF-8.
- **Descripción:** con JavaScript activo (lo normal en el navegador), crear, editar o sobrescribir un producto falla siempre con 400 "El formulario tiene campos repetidos." Los botones de envío del formulario de producto tienen `name="action"` (`create`, `update` y `overwrite`). `submit-guard.js` copia el valor del botón a un campo oculto con el mismo nombre durante el evento `submit` y deshabilita el botón después (`setTimeout`). Como el botón sigue habilitado al construir los datos del envío, el navegador envía `action` dos veces, y `readFormBody` de `packages/web` rechaza los campos repetidos.
- **Pasos para reproducir:**
  1. Entrar en `inventory-manager` en un navegador con JS.
  2. Abrir "Editar" de cualquier producto.
  3. Pulsar "Guardar cambios", con el ratón o con Enter, sin cambiar nada.
  4. Lo mismo con "Crear producto" en un alta.
- **Resultado esperado:** 303 a la lista con el mensaje de éxito (o 422 si hay errores).
- **Resultado actual:** página "No se pudo procesar" con "El formulario tiene campos repetidos." y 400 `request_error` en el log de `inventory-manager`. Nada se guarda.
- **Evidencia:** navegador (alta con Enter y edición con clic de ratón en "Guardar cambios"); el botón de alta tiene `name: "action", value: "create"`; con `data-submit-guard` quitado, el mismo envío funciona (422 o 503 según el caso). Eliminar y recuperar (botones sin `name`) funcionan con JS.
- **Impacto:** el admin nuevo no permite crear ni editar productos en un navegador normal. Es el flujo principal del ticket. Las pruebas de `submit-guard` con jsdom y las del servidor no lo detectan porque nunca se combinan.
- **Recomendación:** que el envío con `submit-guard` no duplique el valor del botón, y añadir una prueba que combine el JS con el servidor (o que compruebe en jsdom los datos del envío).

### DEF-004
- **Severidad:** MINOR
- **Criterio de aceptación afectado:** CA-17 ("El lint lo rechaza").
- **Descripción:** el bloque de `inventory-manager` de `eslint.config.ts` solo aplica `no-restricted-imports`, que no revisa `import()`. Un `export const x = await import('@restaurante/core/shared');` en `inventory-manager/src/app.ts` pasa el lint (sonda por stdin, código 0). Los paquetes usan `PACKAGE_DYNAMIC_IMPORT` para eso.
- **Impacto:** la regla se puede saltar con un import dinámico. Hoy no hay ninguno en el código (búsqueda en `src/`, `tests/` y `scripts/`). `api` tiene el mismo hueco desde REQ-F-038.
- **Recomendación:** aplicar a `inventory-manager` una restricción equivalente para `import()` y añadir su caso a `dependency-rule.test.ts`.

### DEF-005
- **Severidad:** MINOR (el impacto llega con el PR 3)
- **Criterio de aceptación afectado:** RF-19 y CA-18 (el `HEALTHCHECK` contra `/salud`, del PR 3).
- **Descripción:** en producción, el middleware de "solo HTTPS" responde 503 antes de las rutas, también a `GET /salud`. Un `HEALTHCHECK` del contenedor, que habla por HTTP con `127.0.0.1` sin `X-Forwarded-Proto`, verá siempre 503.
- **Evidencia:** log de `inventory-manager` en producción: `admin_requires_https` con `path: "/salud"` y estado 503. Prueba `it.fails` DEF-005.
- **Impacto:** sin corregirlo, el contenedor nunca quedaría sano y el despliegue del PR 3 terminaría con el código 16.
- **Recomendación:** que `/salud` responda sin exigir TLS, o que el `HEALTHCHECK` del PR 3 lo tenga en cuenta.

### DEF-007
- **Severidad:** MINOR
- **Criterio de aceptación afectado:** CA-14 (contraste; `accesibilidad.md`).
- **Descripción:** el borde de los campos en reposo (`#432c27`) sobre la tarjeta (`#261a17`) tiene un contraste de 1,31:1, y el fondo del campo (`#1c1412`) frente a la tarjeta, 1,07:1. WCAG 1.4.11 pide 3:1 para el límite visual de un control. Los textos sí cumplen AA.
- **Evidencia:** script de contraste sobre el formulario de alta (campos `name`, `tone` e `image.src` en reposo).
- **Impacto:** con baja visión cuesta ver dónde están los campos; la etiqueta encima de cada uno lo compensa en parte. El color sale del `DESIGN.md` validado en P-4.
- **Recomendación:** revisarlo con el usuario, por ejemplo con un borde más claro en reposo.

### DEF-008
- **Severidad:** MINOR
- **Criterio de aceptación afectado:** CA-14 y CA-7 (errores accesibles).
- **Descripción:** tras un 409, el aviso de conflicto es `role="status"` y no recibe el foco; queda en `body`. El 422 y el 503 sí llevan el foco a su aviso.
- **Evidencia:** navegador, edición con una versión desfasada: `activeElement = BODY`.
- **Impacto:** un usuario de lector de pantalla o de teclado puede no enterarse de que no se guardó hasta recorrer la página. El aviso está justo debajo del título.
- **Recomendación:** tratar el aviso de conflicto como los otros avisos de error (foco o `role="alert"`).

#### Regresión

- Sin regresiones en `api`, `landing-pages` ni `contracts`.
- El `/admin` actual y la API pública pasan la suite.
- Referencias HTML de las landings sin cambios.
- La prueba nueva del notificador (`products_notify_loop_failed`) pasa.
- Docker correcto.
- "Arranque sin API" no falló en esta ronda.

#### Pendientes de revisión manual

Ninguno: la revisión de CA-14 se hizo en el navegador con la ventana emergente.

#### Limpieza

- Borrados: los procesos (puertos 3100–3104 libres, detenidos por puerto con `lsof`), la base `restaurante_test_qa039pr2`, las imágenes `qa2:*`, la pestaña y la ventana emergente, y los archivos temporales de `/tmp/qa2`.
- Sin cambios en git ni en el código de producción.
- Solo escribí el ticket y el archivo de pruebas nuevo.

#### Lo que queda fuera de este QA

- **CI del PR.**
- **PR 3:** CA-9, CA-15, CA-18 y CA-20; DEF-005 se materializa con el `HEALTHCHECK`.

#### Resultado final

QA_REJECTED

### PR 2 de 3: `inventory-manager` — Ronda 2 (2026-10-28, revalidación)

#### Qué cambió

El usuario aprobó las correcciones de la ronda 1 ("Si apruebo"):
- **DEF-006:** `submit-guard.js` ya no copia el botón a un campo oculto.
- **DEF-005:** en producción, `/salud` responde sin TLS.
- **DEF-008:** el aviso del 409 es `role="alert"`, con `tabindex="-1"` y `autofocus`.
- **DEF-004:** `no-restricted-syntax` para `import()` en `api` e `inventory-manager`.
- **DEF-007:** el borde de los campos pasa a `#ab8985`.

#### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| `npm run typecheck` / `lint` / `build:css` | 0 / 0 / 0 |
| `npm test` | `api` 90; `landing-pages` 2193 + 1 *expected fail* (105 archivos, con el archivo de QA); `inventory-manager` 70 (7 archivos). Todo en verde |
| `inventory-manager-qa-req-f-039.test.ts` | 9/9; DEF-005 ya es un `it` normal y la aserción es la misma (`/salud` → 200 en producción sin TLS) |
| Entorno | Base `restaurante_test_qa039pr2r2`; `Datasource` comprobado antes de migrar. Procesos en 3100–3104 con `env -i`. Ya está todo borrado |
| Navegador | Chrome con JS activo: alta, edición, 409 y sobrescritura, triple clic, 422 y 503 |

#### Defectos de la ronda 1

| Defecto | Resultado | Evidencia |
| --- | --- | --- |
| DEF-006 (BLOCKER) | **Corregido** | Con JS (`data-submit-guard` presente): **alta** con clic real en "Crear producto" → 303 `?ok=created` y la fila "Molote JS Ronda2"; **edición** con "Guardar cambios" → 303 `?ok=saved` y "Edit JS R2"; **409** (otra sesión guardó la versión 2 con `curl`) → 409 y no 400; **sobrescribir** → 303 `?ok=saved` y "Mio JS R2". En el log de `inventory-manager`, ningún POST con 400 (POST `/molotes/productos/17`: 3×303 y 1×409). Como el servidor exige `action` (`update` u `overwrite`) y rechaza los repetidos, los 303 confirman que `action` llegó una sola vez. **Triple clic** en "Crear producto": el botón queda con `aria-busy="true"` y "Guardando…", y se crea un solo producto (un único POST) |
| DEF-005 | **Corregido** | En producción: `/salud` sin TLS → 200 con `no-store`; `/acceso` → 503; `/salud/` y `/SALUD` → 503 (solo se exime la ruta exacta) |
| DEF-004 | **Corregido** | Sondas `eslint --stdin`: `import()` de `@restaurante/core/shared`, `@restaurante/db/client`, `@prisma/client` y `../../landing-pages/...` → error en `src/`, `tests/` y `scripts/`; `@restaurante/contracts`, `@restaurante/web`, `node:crypto` y `./config.ts` → sin error. En `api`, `import()` de `landing-pages` → error y de `@restaurante/core/catalog` → sin error. Un `import()` con una variable no lo detecta la regla (solo `no-unsafe-assignment`); como cualquier regla sobre literales, es una limitación aceptable |
| DEF-007 | **Corregido** | En la edición de Birria (35 controles): texto, selector y área de texto `#ab8985` → **5,35:1** sobre `#261a17` y **5,74:1** sobre `#1c1412`; casillas `#c2410c` → 3,26:1 y 3,50:1. Ningún control por debajo de 3:1. Texto de la página: mínimo 5,96, sin fallos AA |
| DEF-008 | **Corregido** | Tras el 409 con JS: `document.activeElement` es el aviso `role="alert"` (`tabindex="-1"`), con `:focus-visible` y un contorno sólido de 2 px `rgb(234,179,8)`. Lo escrito se conserva, el botón de guardado normal desaparece y queda "Guardar mis cambios sobre la versión vigente" |

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-6 | **PASS** | Con JS: alta, edición, triple clic sin duplicar y `reorder.js` (ronda 1). Sin JS: ronda 1, `curl` y la prueba F-10 (en verde) |
| CA-7 | **PASS** | En el cliente con JS: 409 con lo escrito, quién y cuándo ("qa, el 28/10/2026 13:46"), sin guardado normal y sobrescritura solo a petición. Servidor: prueba F-11 en verde |
| CA-14 | **PASS** | La revisión de la ronda 1 (teclado, foco, 375/768/1440 px, contraste del texto, `reorder.js` y 503) se mantiene. Ahora, además: 422 con JS (el foco va a la alerta y `price` tiene `aria-invalid` y `aria-describedby="f-price-help f-price-error"`), 409 con el foco en la alerta, 503 con JS (alerta con foco y lo escrito intacto) y bordes de los campos ≥ 3:1. Consola sin errores |
| CA-1 a CA-5, CA-8, CA-16, CA-17 y CA-19 | PASS | Sin cambios respecto a la ronda 1. CA-17, ahora también con `import()` (DEF-004). Suite completa en verde |

#### Defectos abiertos

Ninguno.

#### Observaciones

La sesión del navegador caducó durante la pausa por el límite de uso (más de 2 h sin actividad) y el acceso volvió a la pantalla pedida: es el comportamiento esperado (RF-3).

#### Limpieza

- Borrados: los procesos (puertos 3100–3104 libres, detenidos por puerto con `lsof`), la base `restaurante_test_qa039pr2r2`, la pestaña y los archivos de `/tmp/qa3`.
- Logs sin la contraseña de prueba, el token interno ni el id de sesión (0 coincidencias).
- Sin cambios en git ni en el código de producción.

#### Lo que queda fuera de este QA

- **CI del PR.**
- **PR 3:** CA-9, CA-15, CA-18 y CA-20.

#### Resultado final

QA_APPROVED

## Historial de cambios

### QA del PR 2, ronda 2 (2026-10-28)

senior-qa, revalidación. DEF-004 a DEF-008 corregidos y verificados (DEF-006 con JS en Chrome: alta, edición, 409 y sobrescritura con 303). CA-6, CA-7 y CA-14 en PASS. `typecheck`, `lint`, `build:css` y `test` en 0. Estado `QA_APPROVED`.

### Correcciones de QA del PR 2, ronda 1 (2026-10-28)

DEF-006 (BLOCKER), DEF-005, DEF-008, DEF-004 y DEF-007 corregidos según las decisiones del usuario. `typecheck`, `lint`, `build:css` y `test` en 0. Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA del PR 2, ronda 1 (2026-10-28)

senior-qa, fase Q2. `typecheck`, `lint`, `build:css` y `test` en 0; Docker correcto. Revisión de CA-14 en el navegador. DEF-006 (BLOCKER): con JS, crear y editar productos falla con 400 por un campo `action` duplicado por `submit-guard.js`. Además, DEF-004, DEF-005, DEF-007 y DEF-008 (MINOR). Estado `QA_REJECTED`.

### QA Action Plan del PR 2 (2026-10-28)

senior-qa, fase Q1. El usuario aprobó la implementación del PR 2 ("Si lo apruebo"). Se redacta el QA Action Plan del PR 2: CA-14 manual en el navegador, seguridad, regla de dependencias, regresión con Docker y entorno local solo con bases `restaurante_test*`. Estado `NEEDS_QA_PLAN_APPROVAL`.

### Implementación del PR 2 (2026-10-28)

`inventory-manager` implementado en `feature/REQ-F-039-admin-nuevo-productos-2-inventory`, sin commit. `typecheck`, `lint`, `build:css` y `test` en 0 (2331 pruebas). Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Merge del PR 1 e inicio del PR 2 (2026-10-28)

PR #94 mergeado en `epic/arquitectura` el 2026-10-28T10:53:26Z (confirmado por el usuario: "Fusionado"). Rama del PR 2: `feature/REQ-F-039-admin-nuevo-productos-2-inventory`, desde `fd8bf4b`.

### Pull Request del PR 1 (2026-10-28)

DEF-003 corregido en la prueba (50 ejecuciones en verde). Commit `75c4b4d`, PR #94 hacia `epic/arquitectura`, CI en verde. El PR 1 está listo para merge; el ticket sigue `IN_PROGRESS` hasta el PR 3.

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
