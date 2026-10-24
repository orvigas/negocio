# Auditoría de seguridad OWASP: restaurante/ (frontend y backend)

Fecha: 2026-10-09. Rama analizada: `main` (eeeba13), árbol limpio. Fase de solo lectura: no se modificó código, configuración ni tickets.

## 1. Resumen ejecutivo

La base de la aplicación es sólida. El escapado de plantillas es estricto. La autorización por rol y por negocio se cumple en HTML y en la API (sin IDOR). Hay CSRF con token sincronizador, comprobación de origen y `SameSite=Strict`. Las contraseñas usan scrypt con comparación en tiempo constante. La firma del webhook (HMAC) se verifica en tiempo constante. Las salidas van a bases fijas (sin SSRF), los errores no revelan detalles y los logs están depurados. No encontré ninguna vulnerabilidad de inyección, XSS ni control de acceso explotable en el código.

Los riesgos reales están en la **configuración por defecto, el despliegue y los límites de abuso**:

1. **(Alta, condicionada)** El proceso escucha en todas las interfaces. Con `TRUST_PROXY=true`, si el puerto 3000 queda accesible, cualquiera falsifica `X-Forwarded-Proto` y `X-Forwarded-For`. Así se salta la exigencia de HTTPS de `/admin` y el límite de intentos de acceso. Lo verifiqué con curl.
2. **(Media)** El límite de intentos de acceso es solo por IP: no hay límite por cuenta, y una tabla de 1000 entradas descarta bloqueos. Un ataque distribuido o con IPv6 puede probar contraseñas sin límite práctico.
3. **(Media)** El webhook público almacena hasta 3 MB por petición **antes** de comprobar la firma, sin límite de concurrencia. Con 80 peticiones simultáneas sin firma, la memoria del proceso subió de 150 MB a 339 MB.
4. **(Media)** No hay topes diarios de coste en el bot. Desde el 2026-10-01 Meta cobra los mensajes de servicio, y un solo número puede provocar unas 28 800 respuestas al día (unos 245 USD al día), además de pedidos falsos al personal.
5. **(Media)** `NODE_ENV` vale `development` por defecto: si el `.env` de producción lo omite, la app arranca sin cookie `Secure`, sin HTTPS obligatorio y con stack traces en las respuestas 5xx.
6. **(Media, infraestructura)** nginx, TLS, el firewall y el gestor del proceso siguen "a definir". El ejemplo de nginx del README no limpia `X-Forwarded-Host` ni define límites de cuerpo, de peticiones ni timeouts.

El resto son hallazgos de severidad Baja o Informativa: parámetros de scrypt bajo el mínimo de OWASP, permisos 0644 de la base SQLite, CSP mejorable y falta de `Permissions-Policy`, dependencia de Google Fonts, avisos de `npm audit` solo en herramientas de build, sesión sin caducidad absoluta ni MFA, y ruido en los logs.

El plan propone **7 tickets de código (REQ-F-014 a REQ-F-020)** y **9 tareas de infraestructura** para el usuario. Las de mayor prioridad son el firewall, nginx y systemd, junto con REQ-F-014, REQ-F-015 y REQ-F-016.

## 2. Metodología y alcance

- **Marcos:** OWASP Top 10 (2021) A01 a A10 y OWASP API Security Top 10 (2023) API1 a API10, aplicados a `/admin`, `/admin/api` y `/webhooks/whatsapp`.
- **Revisión estática:** `CLAUDE.md`, `.claude/rules/`, `README.md`, `docs/despliegue.md`, `Dockerfile`, `compose.yaml`, `.dockerignore`, `.gitignore`, `.github/workflows/ci.yml`, `package.json`, y el código de `src/` relevante:
  - `app.ts`, `server.ts`, `config/env.ts`;
  - middleware y controladores de admin, API y webhook;
  - servicios de autenticación, sesión, límite de intentos y autorización;
  - repositorios, `db/`;
  - bot: orquestador, store, proveedores e intérprete;
  - `views/render.ts` y plantillas;
  - `public/js`.
- **Dinámica:** el servidor corrió en `127.0.0.1:3999` (escuchando en `*:3999`) con `NODE_ENV=production`, `TRUST_PROXY=true`, bot Meta con credenciales ficticias y un `DATA_DIR` temporal fuera del repositorio. Se probó con curl:
  - cabeceras y CSP;
  - puerta HTTPS y límite de intentos con `X-Forwarded-For` falsificado;
  - cookies;
  - CSRF en la API;
  - IDOR entre negocios con un editor;
  - asignación masiva;
  - XSS almacenado;
  - traversal en estáticos;
  - verificación y firma del webhook;
  - inundación de memoria del webhook.

  Ninguna petición fue a Meta ni a Twilio: solo envié firmas inválidas. Detuve solo el PID que lancé (81744).
- **Rendimiento del intérprete:** benchmark con entradas adversarias de 1000 caracteres (el máximo admitido) para descartar ReDoS.
- **Dependencias:** `npm audit` (completo y `--omit=dev`), `npm ls`, búsqueda de secretos en el historial de git.
- **Línea base:** `npm run typecheck`, `npm run lint` y `npm test` terminan en verde: 67 archivos, 1367 pruebas que pasan y 1 fallo esperado.
- **Fuera de alcance:** la VM real (no existe en el repositorio), las pruebas contra Meta o Twilio, y el pentest de red o del sistema operativo.

## 3. Hallazgos (por severidad)

| ID | Severidad | OWASP | Título |
|----|-----------|-------|--------|
| F-01 | Alta (condicionada) | A05, A07, API8 | Escucha en todas las interfaces más `TRUST_PROXY`: cabeceras de proxy falsificables |
| F-02 | Media | A07, API2 | Límite de intentos solo por IP, sin límite por cuenta y con descarte de bloqueos |
| F-03 | Media | A04, API4 | El webhook almacena 3 MB sin autenticar y sin límite de concurrencia (DoS de memoria) |
| F-04 | Media | A04, API6, API4 | Bot sin topes diarios de coste ni de pedidos por número |
| F-05 | Media | A05 | `NODE_ENV` por defecto `development` (falla en abierto) |
| F-06 | Media | A05, A02 | Proxy, TLS, firewall y gestor de proceso sin definir; el ejemplo de nginx está incompleto |
| F-07 | Baja | A02, A07 | Parámetros de scrypt bajo el mínimo recomendado por OWASP |
| F-08 | Baja | A05, A02 | La base SQLite (con hashes) se crea con permisos 0644 |
| F-09 | Baja | A05 | Falta `Permissions-Policy`; CSP con `style-src` y `font-src` `https:` amplios |
| F-10 | Baja | A08, privacidad | Google Fonts de terceros (sin SRI posible, IP del visitante a Google) |
| F-11 | Baja | A06, A08 | `npm audit`: 8 avisos altos en herramientas de build; dependencias de desarrollo instaladas en la VM; sin Dependabot ni auditoría en CI |
| F-12 | Baja | A07 | Sesión sin caducidad absoluta, sin MFA, y "Mi cuenta" sin límite de intentos |
| F-13 | Baja | A09 | Peticiones abortadas registradas como error 500 con stack; sin alertas |
| F-14 | Informativa | A08 | Imagen base de Docker sin fijar por digest; protección de rama no forzada |
| F-15 | Informativa | API8 | La protección contra repetición del webhook depende de memoria (se pierde al reiniciar) |

### F-01 (Alta, condicionada): cabeceras de proxy falsificables si el puerto 3000 es accesible

- **Evidencia:**
  - `src/server.ts:85`: `app.listen(config.port, ...)` sin host, así que escucha en todas las interfaces. `lsof` mostró `TCP *:3999 (LISTEN)`, y `docs/despliegue.md:16` confirma "en todas las interfaces".
  - `src/app.ts:78`: `app.proxy = config.trustProxy`. En producción la guía exige `TRUST_PROXY=true`.
  - `src/middleware/admin-guard.ts:78`: la puerta HTTPS usa `ctx.secure`, que depende de `X-Forwarded-Proto`.
  - `src/controllers/admin.ts:132`: el límite de intentos usa `ctx.ip`, que depende de `X-Forwarded-For`.
- **Prueba:**
  - Por HTTP plano, `GET /admin/login` devuelve 503. Con `-H 'X-Forwarded-Proto: https'` sobre HTTP plano devuelve **200**: la puerta HTTPS se salta.
  - Cinco fallos con `X-Forwarded-For: 10.0.0.1` dejan esa IP bloqueada (429). El siguiente intento con `X-Forwarded-For: 10.0.0.2` vuelve a responder **401**, o sea, se aceptan más intentos.
- **Impacto:** fuerza bruta ilimitada contra las cuentas de `/admin`. Con ellas se pueden alterar menús y precios o crear usuarios administradores. También permite servir `/admin` sin TLS.
- **Probabilidad:** Media. Depende de que el firewall de la VM (aún "a definir") deje abierto el 3000. Hoy la app no se protege por sí misma.

### F-02 (Media): límite de intentos solo por IP

- **Evidencia:**
  - `src/services/login-throttle.ts`: la clave es solo la IP, con `MAX_TRACKED = 1000` (línea 8).
  - Línea 55: al llenarse la tabla se borra la entrada más antigua aunque esté bloqueada.
  - No hay contador por usuario ni retardo progresivo.
- **Impacto:** con muchas IP (botnet o un rango IPv6 /64, que da millones de direcciones), cada IP tiene 5 intentos cada 15 minutos sin tope global. Llenar la tabla con 1000 IP desbloquea las anteriores.
- **Mitigación existente:** scrypt (unos 50 a 100 ms por intento), contraseña de al menos 12 caracteres y respuesta idéntica para cuenta inexistente o desactivada.
- **Probabilidad:** Media-baja, pero `/admin` es la superficie más valiosa.

### F-03 (Media): DoS de memoria en el webhook público

- **Evidencia:**
  - `src/controllers/whatsapp-webhook.ts:62-63`: `readRawBody` (hasta `MAX_WEBHOOK_BYTES = 3 MB`, `providers/meta/webhook.ts:18`) se ejecuta **antes** de `handleDelivery`, que es donde se mira la firma.
  - Tampoco se comprueba antes si la cabecera `X-Hub-Signature-256` existe.
  - No hay límite de peticiones concurrentes ni de velocidad.
- **Prueba:** 80 POST concurrentes de 3 MB sin firma, con envío lento. La memoria (RSS) pasó de **150 MB a 339 MB** y no se liberó al terminar. El crecimiento es lineal: unas 500 conexiones superarían 1.5 GB. El timeout de cuerpo por defecto de Node es de 300 s.
- **Impacto:** caída del proceso. Se cortan las landings, `/admin` y las conversaciones en curso, porque el estado vive en memoria.
- **Probabilidad:** Media: el endpoint es público y documentado.
- **Nota:** el `client_max_body_size` por defecto de nginx (1 MB) mitigaría parcialmente, pero no está configurado ni documentado.

### F-04 (Media): abuso de coste y de pedidos en el bot

- **Evidencia:**
  - `src/services/whatsapp-bot/store.ts:15`: el único límite es de 20 mensajes por minuto por número.
  - No hay tope diario por número, ni de pedidos confirmados, ni global de salientes.
  - `README.md:447-451`: desde el 2026-10-01 Meta cobra 0.0085 USD por mensaje de servicio (1000 gratis al mes) y la plantilla al personal también se cobra.
- **Impacto:**
  - Un solo número automatizado: 20 × 60 × 24 = 28 800 respuestas al día, unos 245 USD al día. Con varios números el coste se multiplica.
  - Además, pedidos falsos confirmados inundan el WhatsApp del personal. Cada uno es una plantilla cobrada y trabajo perdido.
- **Probabilidad:** Media-baja: requiere cuentas de WhatsApp, pero es barato de automatizar.

### F-05 (Media): `NODE_ENV` por defecto `development`

- **Evidencia:**
  - `src/config/env.ts:106` (`DEFAULTS.NODE_ENV = 'development'`) y la lectura en `:443`.
  - `package.json:12`: `npm start` no fija `NODE_ENV`, y en la VM se usa `npm start`.
  - Consecuencias:
    - `src/app.ts:120`: `exposeStack` en desarrollo;
    - `admin-guard.ts:109`: la cookie no lleva `Secure`;
    - `admin-guard.ts:78`: no exige HTTPS;
    - `DATA_DIR` vuelve a `restaurante/data`;
    - se permitiría Twilio.
- **Impacto:** un `.env` incompleto pone en producción un modo inseguro sin ningún aviso. Además, un túnel de desarrollo (Twilio) expone `/admin` por HTTP con stack traces.
- **Probabilidad:** Baja: la guía lo incluye. Pero el fallo es silencioso.

### F-06 (Media, infraestructura): proxy, TLS y firewall sin definir

- **Evidencia:** `docs/despliegue.md`, "Pendientes a definir", puntos 2 a 4, 7 a 9. Ejemplo de nginx en `README.md:821-827`.
- **Lo que falta en el ejemplo de nginx:**
  - **`X-Forwarded-Host`:** Koa, con `proxy=true`, lo usa para `ctx.host`, y nginx lo reenvía tal como lo manda el cliente. Hoy solo afecta a la comparación de origen anti-CSRF, que además exige token, así que no es explotable, pero conviene fijarlo.
  - **`client_max_body_size` por ruta.**
  - **Limitación de peticiones:** `limit_req` en `/admin/login` y en el webhook.
  - **Timeouts:** `client_body_timeout`.
  - **TLS:** redirección 80 → 443, versiones y cifrados.
  - **`server_tokens off`.**
- **Bien:** `X-Forwarded-For $remote_addr` sobrescribe la cabecera y, con `maxIpsCount=1`, Koa toma la IP real.
- **Otras decisiones:** helmet envía HSTS con `includeSubDomains` (afecta a todos los subdominios del dominio elegido). Si se pone una CDN delante, `ctx.ip` sería la de la CDN y el bloqueo afectaría a todos los usuarios.

### F-07 (Baja): parámetros de scrypt

- **Evidencia:** `src/services/admin-auth.ts:31`: `N=2^15, r=8, p=1`. La guía de OWASP (Password Storage) recomienda como mínimo `N=2^17, r=8, p=1`.
- **Nota:** los parámetros se guardan en cada hash, así que se pueden subir con un re-hash transparente al iniciar sesión. Hay que medirlo contra F-03 y F-02: con 128 MiB por intento, los intentos concurrentes suben la memoria.

### F-08 (Baja): permisos de la base de datos

- **Evidencia:** con umask 022, la app creó `restaurante.db`, `-wal` y `-shm` como `-rw-r--r--`, mientras que los JSON se crean como `-rw-------`. Mismo resultado en `restaurante/data/restaurante.db` local.
- **Impacto:** la carpeta `DATA_DIR` es 700 y lo mitiga. Si el operador la crea con 755, otro usuario de la VM puede leer los hashes, la auditoría y los productos. Los respaldos `.backup` heredan el mismo umask.

### F-09 (Baja): cabeceras y CSP

- **Evidencia (curl `/`):** CSP `style-src 'self' https: 'unsafe-inline'`, `font-src 'self' https: data:` y `frame-ancestors 'self'`. No hay `Permissions-Policy`.
- **Impacto:** hoy no hay ninguna vía de inyección (ver falsos positivos). Es defensa en profundidad: limitar a `fonts.googleapis.com` y `fonts.gstatic.com`, usar `frame-ancestors 'none'` y desactivar cámara, micrófono, geolocalización y otras APIs.
- `'unsafe-inline'` en estilos se necesita por los atributos `style=` de las plantillas (`pages/*.html`, fondos).

### F-10 (Baja): Google Fonts

- **Evidencia:** las tres landings cargan `https://fonts.googleapis.com/css2?...`. No se puede aplicar SRI: Google sirve un CSS distinto según el navegador.
- **Impacto:**
  - un tercero controla CSS y fuentes de la página;
  - Google recibe la IP de cada visitante (aviso de privacidad, LFPDPPP);
  - la página depende de la disponibilidad de Google.
- La alternativa es alojar las fuentes en el propio servidor. Antes hay que revisar `_stich_source_/`, porque el diseño fuente usa Google Fonts.

### F-11 (Baja): dependencias y cadena de suministro

- **Evidencia de `npm audit`:** 8 avisos altos:
  - `prisma` (CLI) → `@prisma/config` → `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) y `mysql2` (GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3);
  - `@tailwindcss/cli` → `@parcel/watcher` → `micromatch` → `braces` (GHSA-vfj7-8cjw-p6xm).
- **Alcance real:** ninguno se ejecuta en tiempo de ejecución. La app usa SQLite con el adaptador `better-sqlite3`, no `mysql2`, y Tailwind solo compila el CSS. El "arreglo" de `npm audit fix --force` es un downgrade que rompe (prisma 6.19.3).
- **Agravantes:**
  - la VM instala todas las dependencias, incluidas las de desarrollo (`docs/despliegue.md:131`), y las deja en producción;
  - el CI usa `--no-audit`;
  - no hay Dependabot;
  - `koa-static@5.0.0` lleva tiempo sin mantenerse (sin CVE conocidos).
- **Bien:** `allowScripts` con `--strict-allow-scripts`, versiones exactas de Prisma y de `better-sqlite3`, y acciones de GitHub fijadas por SHA.

### F-12 (Baja): sesión y autenticación

- **Sesión:** `src/services/session-store.ts` solo caduca por inactividad (2 h, renovable sin fin). No hay duración máxima.
- **MFA:** no existe, ni siquiera para administradores.
- **"Mi cuenta":** `src/controllers/admin-account.ts:46` verifica la contraseña actual sin límite de intentos. Quien robe una sesión podría adivinar la contraseña (para reutilizarla en otros servicios).
- **Contraseñas filtradas:** no se comprueban contra listas conocidas.

### F-13 (Baja): logs

- **Ruido:** `src/middleware/error-handler.ts:57`. Una petición que el cliente corta a medias se registra como `level:error`, estado 500, con stack (`"message":"aborted"`). En la prueba de F-03 salieron 94 líneas `request_error`. Cualquiera puede llenar los logs y tapar alertas reales.
- **Alertas:** no hay. La retención y las alertas están "a definir": `admin_login_locked`, `bot_webhook_signature_invalid`, `bot_rate_limited` y `database_unavailable` existen, pero nadie las vigila.

### F-14 (Informativa)

- `Dockerfile`: `FROM node:24-alpine` sin digest. Producción no usa Docker, así que el impacto es bajo.
- El merge no está protegido por GitHub (plan Free; documentado en el proceso).

### F-15 (Informativa)

- La firma de Meta no lleva marca de tiempo. Contra la repetición hay dos controles:
  - la deduplicación por id durante 3 h, en memoria y con un máximo de 10 000 ids;
  - el descarte de los mensajes con más de 2 h de antigüedad.
- Tras un reinicio, un payload firmado de menos de 2 h podría reprocesarse. Para eso el atacante necesita haber interceptado tráfico TLS entre Meta y nginx: el riesgo es teórico.

## 4. Controles correctos (cobertura)

- **A01 / API1 / API5:**
  - el editor recibe 403 en `/admin/api/birria/*`, `/admin/birria`, `/admin/usuarios` y al restablecer la contraseña de otro usuario;
  - un producto de Birria pedido por la ruta de Molotes responde 404 (`listBusiness` limita al negocio);
  - `next` del acceso con lista cerrada (sin redirección abierta).
- **A03 / XSS:**
  - el renderizador escapa `& < > " ' \``;
  - `{{{ }}}` solo acepta `SafeHtml`;
  - un payload `"><script>` e `{{ c.title }}` en el nombre de un producto se mostró escapado y sin reinterpretar;
  - no hay `innerHTML` ni `eval`: `public/js` solo usa `textContent`.
- **A03 / SQL:** todo pasa por Prisma. El único SQL crudo ejecuta los archivos de migración versionados (`src/db/migrate.ts`).
- **API3 (asignación masiva):** la API rechaza con 422 `business`, `slug`, `deleted`, `id` y cualquier campo desconocido. Los formularios aceptan solo listas cerradas de campos (400 si llega `role` en "Mi cuenta").
- **CSRF:**
  - sin token, 403 `CSRF_INVALID`; con `Origin` ajeno y token válido, también 403;
  - `text/plain` se rechaza con 415;
  - cookie `admin_sid; path=/admin; samesite=strict; secure; httponly`;
  - logout por POST con token.
- **A07:**
  - scrypt con sal y hash ficticio para usuarios inexistentes (sin enumeración);
  - id de sesión de 256 bits, nuevo en cada acceso (sin fijación);
  - `sessionVersion` invalida las sesiones al desactivar al usuario o cambiar su contraseña o su rol;
  - recuperación de acceso solo por consola.
- **Webhook:**
  - HMAC-SHA256 y HMAC-SHA1 comparados con `timingSafeEqual`, y el token de verificación con `safeEqualStrings`;
  - 401 sin firma, 403 con firma inválida, 413 por encima del límite;
  - `challenge` con patrón cerrado;
  - se ignoran los mensajes de otro número;
  - deduplicación, descarte por antigüedad y límite por número (guardado como HMAC, sin el número en claro).
- **Intérprete:** benchmark con 1000 caracteres adversarios (espacios, separadores, "y" repetidas, multiplicadores, emojis): como máximo 1.2 ms por mensaje. El texto se recorta a 1000 caracteres antes de interpretarlo.
- **A10 / SSRF:** `fetch` solo a `https://graph.facebook.com` y `https://api.twilio.com`, con identificadores validados por patrón y timeout de 10 s.
- **Errores y logs:**
  - formato JSON común, mensaje genérico en 5xx;
  - los errores de Prisma se convierten en `DatabaseUnavailableError` (solo códigos);
  - la ruta se registra sin query;
  - número del cliente enmascarado, sin textos ni tokens.
- **Configuración:**
  - validación estricta de `.env` sin mostrar valores;
  - Twilio prohibido en producción;
  - `DATA_DIR` absoluta y fuera de `src/` y `public/`.
- **Cabeceras:** HSTS, `nosniff`, `X-Frame-Options SAMEORIGIN` con `frame-ancestors`, `Referrer-Policy no-referrer` (`same-origin` en `/admin`), COOP y CORP, `script-src 'self'` y `script-src-attr 'none'`, `object-src 'none'`, `/admin` con `no-store` y `noindex`. No se envía ninguna cabecera CORS.
- **Enlaces:** todos los `target="_blank"` llevan `rel="noopener noreferrer"`.
- **Estáticos:** `/../.env` y `/%2e%2e/package.json` responden 403; los archivos ocultos, 404; las rutas de imagen se validan con patrón y comprobador dentro de `public/img`.
- **Secretos:** ninguno en el repositorio ni en el historial (solo valores ficticios de pruebas). `.env` está en `.gitignore` y `.dockerignore`.
- **CI y contenedor:**
  - `permissions: contents: read`, `persist-credentials: false`;
  - acciones fijadas por SHA;
  - imagen con usuario `node` (no root) y `DATA_DIR` 700;
  - sin secretos en CI.

## 5. Falsos positivos descartados

| Sospecha | Qué revisé | Por qué no aplica |
|----------|------------|-------------------|
| XSS almacenado desde la administración | PUT con `<script>`, `onerror` y `{{ }}`; HTML de la landing y de `/admin/molotes` | Todo sale escapado; el render es de una sola pasada |
| XSS en atributos `style="url('{{ }}')"` | Origen de `img.fondo.src` | Viene del contenido estático (`src/content/*`), no de la administración |
| Inyección SQL | `grep queryRaw/executeRaw/exec` | Solo en migraciones con archivos versionados |
| Path traversal | koa-send, `imageSrcError`, `createImageChecker` | 403 y 404, patrón más comprobación de que la ruta queda dentro de `public/img` |
| IDOR y BOLA | Producto 11 por la ruta de Molotes; editor contra Birria | 404 y 403 |
| Asignación masiva y prototype pollution | PUT con campos extra y `__proto__x`; `readFormBody` sobre `Map` | 422 y 400; no se construyen objetos a partir de nombres recibidos |
| CSRF en el acceso (login CSRF) | `assertSameOrigin` | Los navegadores modernos mandan `Origin` en POST; uno ajeno se rechaza |
| ReDoS en el intérprete (`TRIM`, `split`) | Benchmark | Lineal o casi lineal con entrada acotada (≤ 1.2 ms) |
| SSRF por la versión de la Graph API o el ID de cuenta | Patrones en `env.ts` | Solo dígitos y `vN.N`; base fija |
| Ataque de tiempo en firmas y tokens | `timingSafeEqual` y comparación por SHA-256 | Tiempo constante |
| Host header injection | `grep ctx.host/href` | Los enlaces usan `SITE_URL` de la configuración; `ctx.host` solo se usa en la comparación de origen (ver F-06) |
| Fuga de errores de Prisma | `db/errors.ts`, repositorios | Solo nombre y códigos |
| `npm audit` "high" en tiempo de ejecución | Árbol de dependencias | `mysql2`, `deepmerge-ts` y `braces` solo existen en el CLI de Prisma y en Tailwind (ver F-11) |
| Clickjacking | Cabeceras | XFO y `frame-ancestors` |
| Enumeración de usuarios | `createUserAuthenticator` | Hash ficticio y misma respuesta |
| Robo del token CSRF por `GET /admin/api/sesion` | Cabeceras | Sin CORS y cookie `SameSite=Strict` |
| Fuerza bruta del token de verificación del webhook | `env.ts` | Al menos 16 caracteres aleatorios; solo devuelve el reto |

## 6. Plan de acción

### 6.1 Infraestructura y configuración (las hace el usuario en la VM o las cuentas)

Prioridad 1, antes de exponer la VM:

- **I-1 Firewall:** solo 80 y 443 públicos; SSH solo con clave y, si se puede, desde IP restringidas. El 3000 nunca público. Cierra F-01 mientras REQ-F-014 no exista.
- **I-2 nginx con TLS:**
  - Let's Encrypt con renovación automática, TLS 1.2 o superior, redirección 80 → 443, `server_tokens off`;
  - `proxy_set_header Host $host; X-Forwarded-Proto $scheme; X-Forwarded-For $remote_addr; X-Forwarded-Host $host;`;
  - `client_max_body_size` de 3m solo en `location = /webhooks/whatsapp`, 256k en `/admin` y 64k en el resto;
  - `client_body_timeout 10s`;
  - `limit_req` en `/admin/login` (unos 10 por minuto por IP, con ráfaga 5) y en `/webhooks/whatsapp` (unos 30 por segundo);
  - `limit_conn` por IP;
  - opcional: limitar `/admin` por IP, VPN o autenticación básica adicional.

  Cubre F-01, F-02, F-03 y F-06.
- **I-3 systemd:**
  - usuario dedicado sin shell;
  - `Environment=NODE_ENV=production`;
  - `UMask=0077`;
  - `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `ReadWritePaths=<DATA_DIR>`, `PrivateTmp=yes`;
  - `Restart=on-failure`.

  Cubre F-05, F-08 y el gestor de proceso pendiente.
- **I-4 Secretos:**
  - `.env` con permisos 600;
  - copia cifrada fuera de la VM;
  - vaciar `ADMIN_PASSWORD_HASH` tras el primer arranque;
  - token de usuario del sistema de Meta con el permiso mínimo (`whatsapp_business_messaging`);
  - 2FA en Meta Business y en GitHub.

Prioridad 2:

- **I-5 Meta:** límite de gasto y alertas de facturación en Meta Business. Cubre F-04 mientras REQ-F-017 no exista.
- **I-6 Logs:**
  - retención en journald;
  - alertas, como mínimo por correo o con un script, sobre `admin_login_locked`, `bot_webhook_signature_invalid`, `bot_rate_limited`, `bot_staff_delivery_failed` y `database_unavailable`;
  - rotación de `changes.jsonl`.

  Cubre F-13.
- **I-7 Respaldos:** cifrados, fuera de la VM, con permisos 600 y una prueba de restauración periódica.
- **I-8 Sistema operativo:** actualizaciones de seguridad automáticas, fail2ban sobre SSH y Node LTS al día.
- **I-9 Despliegue:** tras `db:generate` y `build:css`, ejecutar `npm prune --omit=dev`, o compilar en CI y copiar el resultado. Clave de despliegue de solo lectura. Cubre F-11.

### 6.2 Tickets de código propuestos

Todos pasan por el ciclo BA → senior-fullstack → QA. Orden recomendado: 014 → 016 → 015 → 017 → 019 → 018 → 020.

**REQ-F-014: configuración segura por defecto (red y entorno)**

- **Objetivo:** que la app no falle en abierto.
- **Cubre:** F-01, F-05, parte de F-06.
- **Cambios:**
  - nueva variable `HOST`: por defecto `127.0.0.1` en producción (o siempre que `TRUST_PROXY=true`), `0.0.0.0` solo si se pide de forma explícita;
  - `NODE_ENV` obligatorio en el arranque del servidor (`npm run dev` y las pruebas lo fijan a `development` y `test`), o como mínimo un aviso `config_insecure_default` y la negativa a arrancar sin `NODE_ENV` cuando `DATA_DIR` es absoluta (pendiente de decisión);
  - documentar `X-Forwarded-Host` y el ejemplo completo de nginx en `docs/despliegue.md`.
- **Esfuerzo:** S.
- **Riesgo de regresión:** medio (arranque, Docker con `HOST=0.0.0.0`, healthcheck, `docs`).
- **Pruebas:**
  - unitarias de `loadConfig` (`HOST` por defecto y no válido; `NODE_ENV` ausente);
  - integración: el servidor escucha solo en loopback;
  - prueba de Docker: el healthcheck sigue en verde.

**REQ-F-015: límite de intentos robusto y endurecimiento de la sesión**

- **Objetivo:** frenar la fuerza bruta distribuida.
- **Cubre:** F-02, F-12, parte de F-01.
- **Cambios:**
  - límite doble, por IP (agrupando IPv6 por /64) y por cuenta (clave normalizada; por ejemplo 10 fallos por hora con retardo progresivo, sin revelar si la cuenta existe);
  - no descartar entradas bloqueadas al llenarse la tabla (descartar primero las no bloqueadas);
  - límite de intentos sobre la contraseña actual en "Mi cuenta";
  - caducidad absoluta de la sesión (por ejemplo 12 h);
  - evento de log `admin_account_throttled`.
- **Esfuerzo:** M.
- **Riesgo de regresión:** medio (bloqueo de usuarios legítimos; necesita una decisión del BA sobre los umbrales).
- **Pruebas:**
  - unitarias del limitador: IPv6 /64, por cuenta, tope sin borrar bloqueos;
  - integración: rotar `X-Forwarded-For` no permite más de N intentos contra una misma cuenta;
  - la sesión caduca a las 12 h aun con actividad.

**REQ-F-016: webhook resistente a DoS y logs sin ruido**

- **Objetivo:** no reservar memoria para peticiones sin firma.
- **Cubre:** F-03, F-13.
- **Cambios:**
  - comprobar que la cabecera de firma existe y tiene el formato correcto **antes** de leer el cuerpo (401 inmediato);
  - un semáforo con un máximo de cuerpos de webhook en lectura simultánea (por ejemplo 8), con 503 y `Retry-After` por encima;
  - timeout de lectura del cuerpo;
  - `server.requestTimeout` y `headersTimeout` explícitos;
  - registrar las peticiones abortadas por el cliente como `warn` con estado 400 o 499, sin stack.

  Se mantienen la respuesta 200 inmediata, la deduplicación y el procesamiento en segundo plano.
- **Esfuerzo:** S-M.
- **Riesgo de regresión:** bajo-medio (contrato del webhook; la prueba de contrato con los dos proveedores lo cubre).
- **Pruebas:**
  - integración: un POST sin firma no lee el cuerpo y responde 401;
  - con N+1 peticiones concurrentes, la última recibe 503;
  - un aborto no genera `level:error`;
  - `chat-bot-contract.test.ts` en verde con Meta y Twilio.

**REQ-F-017: topes de coste y abuso del bot**

- **Objetivo:** acotar el gasto de Meta y los pedidos falsos.
- **Cubre:** F-04.
- **Necesita al BA:** cambia el comportamiento.
- **Cambios:**
  - tope diario de mensajes atendidos por número (por ejemplo 150);
  - tope de pedidos confirmados por número y día (por ejemplo 3, con un aviso de contacto directo);
  - tope global diario de mensajes salientes que actúa como cortacircuitos: al alcanzarlo, solo responde un mensaje fijo o calla, y registra `bot_daily_cap_reached`;
  - dejar de responder tras K mensajes seguidos no reconocidos.

  Todo en memoria y seudonimizado, como el limitador actual.
- **Esfuerzo:** M.
- **Riesgo de regresión:** medio (clientes reales que hacen muchos pedidos).
- **Pruebas:** unitarias de los topes con `vi.setSystemTime` y la frontera de día en `BUSINESS_TIMEZONE`; integración con el doble de la Cloud API para comprobar que no se envía nada por encima del tope; logs sin datos personales.

**REQ-F-018: cabeceras de seguridad y recursos de terceros**

- **Objetivo:** defensa en profundidad en el navegador.
- **Cubre:** F-09, F-10.
- **Cambios:**
  - helmet configurado: `frame-ancestors 'none'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `font-src 'self' https://fonts.gstatic.com`;
  - `Permissions-Policy` (camera, microphone, geolocation, payment e interest-cohort deshabilitados);
  - opcional, en una fase 2: alojar las fuentes en el propio servidor (revisando `_stich_source_/`) y retirar los dominios de Google de la CSP.
- **Esfuerzo:** S (cabeceras); M (fuentes propias).
- **Riesgo de regresión:** bajo-medio (fuentes o estilos bloqueados).
- **Pruebas:** integración de cabeceras en `/`, `/admin/login` y la API; comprobación visual de las dos landings; snapshot del `<head>`.

**REQ-F-019: almacenamiento de credenciales y archivos de datos**

- **Cubre:** F-07, F-08.
- **Cambios:**
  - subir `SCRYPT_DEFAULTS` a `N=2^17` (midiendo latencia y memoria en la VM) con re-hash transparente al iniciar sesión cuando el hash tiene parámetros antiguos;
  - al arrancar, `chmod 600` de `restaurante.db`, `-wal` y `-shm` (o `process.umask(0o077)`), y aviso si `DATA_DIR` permite acceso a grupo u otros.
- **Esfuerzo:** S-M.
- **Riesgo de regresión:** bajo (la carga de las pruebas se controla con `hashParams`).
- **Pruebas:** unitarias del re-hash; integración: el acceso con un hash antiguo lo actualiza; los permisos de los archivos quedan en 600.

**REQ-F-020: cadena de suministro en CI y despliegue**

- **Cubre:** F-11, F-14.
- **Cambios:**
  - paso `npm audit --omit=dev --audit-level=high` en el CI, con una lista documentada de excepciones para los avisos que solo afectan a herramientas (CLI de Prisma y Tailwind);
  - `.github/dependabot.yml` para npm y github-actions;
  - imagen base fijada por digest;
  - en `docs/despliegue.md`, `npm prune --omit=dev` tras el build;
  - seguimiento de la versión de Prisma que corrija `deepmerge-ts` y `mysql2`.
- **Esfuerzo:** S.
- **Riesgo de regresión:** bajo.
- **Pruebas:** el CI en verde; un PR de Dependabot de prueba; la app arranca tras `npm prune --omit=dev`, porque el cliente de Prisma generado vive en `src/generated`.

### 6.3 Resumen de prioridades

| Prioridad | Infraestructura (usuario) | Código |
|-----------|---------------------------|--------|
| 1 (antes de exponer la VM) | I-1, I-2, I-3, I-4 | REQ-F-014, REQ-F-016 |
| 2 (antes de abrir el bot al público) | I-5, I-6 | REQ-F-015, REQ-F-017 |
| 3 | I-7, I-8, I-9 | REQ-F-019, REQ-F-018, REQ-F-020 |

## 7. Preguntas para el usuario

1. ¿La VM ya está en producción? ¿El puerto 3000 es accesible desde internet? Si lo es, aplica el firewall (I-1) de inmediato.
2. Si falta `NODE_ENV`, ¿prefieres que la app **se niegue a arrancar** (obliga a ajustar `npm run dev` y los scripts) o que solo avise?
3. Bot: ¿qué topes aceptas? Pedidos confirmados por número y día, mensajes por número y día, y gasto o mensajes salientes al día antes de cortar.
4. ¿Se puede alojar las fuentes en el propio servidor en lugar de Google Fonts, aunque el diseño fuente use Google Fonts?
5. ¿Quieres planear MFA (TOTP) para los administradores, o aceptas el riesgo con límites de intentos más fuertes y restricción por IP en nginx?
6. ¿Habrá una CDN o Cloudflare delante de nginx? Cambia cómo se obtiene la IP real (F-06).
7. ¿Quieres restringir `/admin` por IP o VPN desde nginx?
