# REQ-F-002 — Favicons e iconos de pantalla de inicio por landing

## Estado

READY_FOR_MERGE (antes del merge, el usuario debe completar las verificaciones manuales de CA-5, CA-6 y CA-10)

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-02). Cita textual: "Aprobar".

La aprobación incluye estos ajustes, que el usuario respondió al validar:

- El nombre largo de Birria en el manifest es "Birria El Muñeco".
- `/apple-touch-icon-precomposed.png` se comporta igual que `/apple-touch-icon.png`. Respuesta: "Sí (Recomendado)". Es un requisito firme.

## Objetivo

Que cada landing se identifique con la marca de su negocio en la pestaña del navegador, en favoritos, en el historial y en la pantalla de inicio de iOS y Android. Los iconos se generan a partir del logo de cada negocio.

## Decisiones confirmadas por el usuario

| #   | Decisión |
| --- | -------- |
| D-1 | **Tamaños pequeños (16, 32 y 48 px):** se usa un recorte de la mascota. En Molotes es el molote con pañoleta y en Birria la cabeza del toro. **Desde 180 px** se usa el logo completo. |
| D-2 | `/favicon.ico` en la raíz y las páginas `/admin` usan el icono del **negocio activo del día**: Molotes de lunes a viernes y Birria el fin de semana, igual que la landing de `/`. |
| D-3 | **Colores** de fondo de los iconos opacos y de theme-color: Molotes `#03132b` y Birria `#290808`. Son los fondos de cada landing. |
| D-4 | El acceso directo instalado abre siempre la **URL fija** del negocio de su icono: `/molotes` o `/birria`. |
| D-5 | El acceso se abre **en el navegador normal**, con su barra visible. No hay modo app independiente (standalone). |
| D-6 | Nombres cortos: **"Moloteando"** y **"El Muñeco"**. Nombre largo de Birria: **"Birria El Muñeco"**. |
| D-7 | `/apple-touch-icon-precomposed.png` se comporta igual que `/apple-touch-icon.png`. |

## Contexto (hechos del proyecto)

- Hoy no hay favicon, apple-touch-icon, manifest ni theme-color en `restaurante/src/views/layouts/base.html` ni en `restaurante/src/views/admin/layout.html`. Por eso `/favicon.ico` devuelve 404.
- `/` elige el negocio según el día y responde con `Cache-Control: no-cache`. Los estáticos de `public/` tienen una caché de 1 h en producción.
- Las fuentes de alta resolución son `_stich_source_/logo_molotes.png/screen.png` (unos 1200×1320) y `_stich_source_/logo_birria.png/screen.png` (unos 1200×1470). Son PNG con esquinas transparentes, no cuadrados y sin versión SVG.
- Los webp de `public/img` (461×512 y 418×512) no alcanzan para los iconos de 512 px.
- `_stich_source_/` no define favicons ni manifest, así que no hay conflicto con el diseño.
- Los colores salen de `moloteando_tradicional/DESIGN.md` y `birria_tradicional_jalisciense/DESIGN.md`.

## Alcance

- Por cada negocio:
  - favicon .ico con 16, 32 y 48 px;
  - PNG de 16 y 32 px;
  - apple-touch-icon de 180 px;
  - PNG de 192 y 512 px;
  - icono maskable de 512 px.
- Un manifest por negocio, con `display` "browser".
- theme-color de cada landing.
- `/favicon.ico`, `/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png` en la raíz, según el día y con la caché adecuada.
- Favicon en las páginas de admin, según el día.

## Fuera de alcance

- Service worker, modo offline, aviso de instalación, modo standalone y notificaciones.
- Pantallas de arranque (splash screens) de iOS.
- Favicon SVG.
- Cambiar `og:image`.
- Rediseñar los logos.

## Requisitos

- **RF-1. Juego de iconos por negocio.** Cada negocio tiene estos iconos, generados desde su PNG de alta resolución:
  - **Tamaños pequeños.** El arte es el recorte de la mascota.
    - favicon `.ico` con 16, 32 y 48 px;
    - PNG de 16×16;
    - PNG de 32×32.
  - **Tamaños grandes.** El arte es el logo completo, centrado y sin deformar.
    - apple-touch-icon de 180×180, opaco, sobre el color de fondo del negocio;
    - PNG de 192×192;
    - PNG de 512×512;
    - icono maskable de 512×512, opaco, sobre el color de fondo. El logo cabe dentro de la zona segura (el círculo central del 80 %).
  - No se incluye un favicon SVG.
- **RF-2. Referencias en cada landing.** El `<head>` de `/molotes`, de `/birria` y de `/` (según el negocio que muestra) declara los recursos del negocio mostrado:
  - favicon .ico;
  - PNG de 16 y 32;
  - apple-touch-icon de 180;
  - manifest;
  - theme-color.

  Nunca referencia recursos del otro negocio.
- **RF-3. Manifest por negocio.**
  - Molotes: `name` "Moloteando", `short_name` "Moloteando", `start_url` `/molotes`.
  - Birria: `name` "Birria El Muñeco", `short_name` "El Muñeco", `start_url` `/birria`.
  - Valores comunes a ambos:
    - `display` "browser";
    - `lang` "es-MX";
    - `theme_color` y `background_color` iguales al color del negocio (D-3);
    - `icons` con 192, 512 y maskable 512.
- **RF-4. theme-color.** Molotes declara `#03132b` y Birria `#290808`.
- **RF-5. Iconos de la raíz según el día.** Estas rutas responden 200 con el icono del negocio activo en la zona horaria configurada:
  - `GET /favicon.ico` devuelve el .ico con la mascota recortada.
  - `GET /apple-touch-icon.png` y `GET /apple-touch-icon-precomposed.png` devuelven el apple-touch de 180 px con el logo completo.
- **RF-6. Caché.**
  - Las rutas de la raíz que cambian según el día no pueden tener caché HTTP de larga duración. Deben pedir revalidación en cada uso (el mismo criterio que `/`, que ya usa `no-cache`) o tener una caché que nunca dure más allá del cambio de día. La forma concreta la decide senior-fullstack.
  - Los iconos con URL propia de cada negocio son estables y pueden usar la caché normal de estáticos. Deben poder versionarse si cambia un logo.
  - Limitación aceptada: los navegadores, sobre todo Safari e iOS, guardan su propia caché de favicons, que el servidor no controla.
- **RF-7. Admin.** Todas las páginas de `/admin`, incluido el login, muestran el favicon del negocio activo del día, con la misma regla que RF-5. No añaden manifest ni theme-color.
- **RF-8. Fuente única.** Las rutas de iconos y manifest, los colores y los nombres de cada negocio se definen una sola vez, junto al contenido o la configuración de ese negocio. No se repiten en plantillas ni en controladores.
- **RF-9. Sin regresiones.** No cambian el resto del `<head>` (SEO, OG, CSS y JS), el diseño visible ni el comportamiento de las landings y de admin.

## Historias de usuario

- **HU-1.** Como cliente con varias pestañas abiertas, quiero reconocer la del negocio por su mascota, para volver a pedir rápido.
- **HU-2.** Como cliente frecuente en el móvil, quiero añadir el negocio a mi pantalla de inicio con su logo y su nombre, para abrir directamente su landing.
- **HU-3.** Como dueño, quiero que cada marca tenga su propia identidad en el navegador y en el móvil.

## Reglas de negocio

- **RN-1.** Los iconos de una landing siempre son los de su negocio.
- **RN-2.** `/`, `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png` y `/admin` siguen la regla del día: lunes a viernes Molotes, sábado y domingo Birria. Se usa la zona horaria configurada (CLAUDE.md §11).
- **RN-3.** El acceso directo instalado abre la URL fija del negocio de su icono, sin importar el día.

## Criterios de aceptación

- **CA-1.** Given `GET /molotes`, When se inspecciona el `<head>`, Then contiene:
  - `rel="icon"` que apunta al .ico;
  - `rel="icon"` PNG con `sizes="16x16"` y otro con `sizes="32x32"`;
  - `rel="apple-touch-icon"` con `sizes="180x180"`;
  - `rel="manifest"`;
  - `<meta name="theme-color" content="#03132b">`.

  Todas esas URLs son de Molotes y ninguna referencia recursos de Birria.
- **CA-2.** Lo mismo que CA-1 para `/birria`, con recursos de Birria y `#290808`.
- **CA-3.** Given `now` de lunes a viernes en la zona horaria configurada, When `GET /`, Then los links de iconos, el manifest y el theme-color son idénticos a los de `/molotes`. Given sábado o domingo, Then son idénticos a los de `/birria`.
  - Incluye las fronteras viernes 23:59:59 → sábado 00:00:00 y domingo 23:59:59 → lunes 00:00:00.
  - Incluye un caso en el que la hora UTC cae en un día distinto al de la zona del negocio.
- **CA-4.** Cada URL referenciada responde 200 con el tipo correcto:
  - .ico: `image/x-icon` o `image/vnd.microsoft.icon`;
  - PNG: `image/png`;
  - manifest: `application/manifest+json`.

  Las dimensiones reales de cada PNG coinciden con las declaradas, y el .ico contiene 16, 32 y 48 px.
- **CA-5.** Inspección visual:
  - en 16, 32 y 48 px se ve solo la mascota recortada;
  - en 180, 192 y 512 px se ve el logo completo sin deformar;
  - el apple-touch-icon y el maskable no tienen píxeles transparentes y su fondo es el color del negocio;
  - en el maskable, el logo cabe en el círculo central del 80 %. Se comprueba con maskable.app o una herramienta equivalente.
- **CA-6.** Cada manifest es JSON válido y contiene exactamente los valores de RF-3. El de Birria tiene `name` "Birria El Muñeco" y `short_name` "El Muñeco". El de Molotes tiene `name` y `short_name` "Moloteando". Chrome DevTools > Application > Manifest no muestra errores en los iconos.
- **CA-7.** Given `now` de lunes a viernes:
  - When `GET /favicon.ico`, Then 200 con el .ico de Molotes.
  - When `GET /apple-touch-icon.png` y `GET /apple-touch-icon-precomposed.png`, Then 200 con el apple-touch de Molotes.

  Given sábado o domingo, Then las tres rutas devuelven los de Birria.
- **CA-8.** Las respuestas de CA-7 incluyen cabeceras de caché que obligan a revalidar, o cuya validez no pasa del cambio de día (RF-6). Nunca llevan un `max-age` que permita servir el icono del día anterior desde la caché HTTP.
- **CA-9.** Given `now` de lunes a viernes, When se carga una página de `/admin`, incluido el login, Then su `<head>` referencia el favicon de Molotes. Given sábado o domingo, Then referencia el de Birria. En ningún caso incluye manifest ni theme-color.
- **CA-10.** Verificación manual en dispositivos:
  - En Chrome y Safari de escritorio, la pestaña de cada landing muestra su mascota.
  - En iOS Safari, "Añadir a pantalla de inicio" desde `/molotes` muestra el logo de Moloteando sobre `#03132b`.
  - En Android Chrome, desde `/molotes` se ve el logo con el nombre "Moloteando".
  - Al tocar el acceso se abre `/molotes` dentro del navegador, con la barra visible.
  - Lo mismo con Birria: nombre "El Muñeco", fondo `#290808` y apertura de `/birria`.
  - Si se instala desde `/` un sábado, se crea un acceso de Birria que abre `/birria` también entre semana.
- **CA-11.** Los tests existentes de landings y de admin siguen pasando, y el resto del `<head>` no cambia.

## Casos límite

- Al recargar `/` justo después de medianoche se ven los iconos del nuevo negocio.
- Una pestaña abierta durante el cambio de día conserva el icono anterior hasta que se recarga. Es la limitación aceptada de RF-6.
- Al entrar directamente a `/molotes` o `/birria`, cualquier día, se ven siempre sus propios iconos.
- Las peticiones a los iconos de la raíz nunca devuelven 404.
- Si cambia un logo, versionar las URLs evita servir los iconos viejos desde la caché HTTP. Las cachés propias del navegador o de iOS pueden tardar en actualizarse.
- Con JavaScript desactivado no cambia nada, porque los iconos no dependen de JS.
- Con admin desactivado (sin credenciales) no hay páginas de admin, pero `/favicon.ico` sigue funcionando.
- Al compartir enlaces se sigue usando `og:image`, que no cambia.

## Dependencias

- PNG de alta resolución de ambos logos en `_stich_source_` (ya existen).
- El servicio que selecciona el negocio según el día y la zona horaria (ya existe, `restaurante/src/services/business-schedule.js`).
- Para generar los iconos puede hacer falta una herramienta. senior-fullstack decide si se generan una sola vez y se versionan o si se añade una dependencia, siguiendo `.claude/rules/dependencias.md`.

## Riesgos

- Que el recorte no se lea bien a 16 px. Se mitiga con una revisión visual antes de cerrar.
- Las cachés propias de favicons de los navegadores y de iOS.
- Una posible dependencia nueva para generar los iconos.

## Action Plan

### Objetivo

Dar a cada landing iconos propios para el navegador y la pantalla de inicio. La raíz y admin siguen al negocio activo del día.

### Cambios requeridos

1. Hacer los recortes de la mascota (molote y cabeza del toro) a partir de los PNG de alta resolución, y comprobar que se reconocen a 16, 32 y 48 px.
2. Generar el juego completo de iconos de cada negocio con el arte y los fondos de RF-1.
3. Crear los manifests de cada negocio con los valores de RF-3.
4. Declarar una sola vez las rutas, los colores y los nombres de cada negocio (RF-8).
5. Hacer que el layout de las landings emita los links y el theme-color del negocio que muestra.
6. Servir `/favicon.ico`, `/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png` según el negocio activo, con la caché de RF-6.
7. Hacer que el layout de admin referencie el favicon del negocio activo.
8. Escribir los tests de CA-1 a CA-9, con las fronteras de día y zona horaria.
9. Documentar en el README cómo regenerar y versionar los iconos.

### UX/UI

- Mascota reconocible en los tamaños pequeños.
- Logo completo sobre fondo sólido del color de la landing en los tamaños grandes.
- Ningún cambio visible dentro de las páginas.

### Integraciones

Ninguna externa.

### Orden recomendado

1. Recortes y revisión visual.
2. Assets y manifests.
3. Fuente única de configuración.
4. `<head>` de las landings.
5. Rutas de la raíz y caché.
6. Admin.
7. Tests y verificación manual en dispositivos.
8. Documentación.

### Resultado esperado

Pestañas, favoritos y accesos en la pantalla de inicio muestran la identidad correcta de cada negocio. La raíz y admin siguen al negocio del día. No hay 404 de iconos ni se sirven iconos del día anterior desde la caché HTTP.

## Trazabilidad

| Elemento | Requisitos | Criterios de aceptación |
| -------- | ---------- | ----------------------- |
| HU-1     | RF-1, RF-2, RF-5, RF-7 | CA-1, CA-2, CA-3, CA-5, CA-7, CA-9, CA-10 |
| HU-2     | RF-1, RF-3, RF-4 | CA-4, CA-5, CA-6, CA-10 |
| HU-3     | RF-1, RF-4 | CA-5 |
| Caché    | RF-6 | CA-8 |
| Fuente única | RF-8 | Paso 4 del Action Plan; se verifica en la revisión técnica |
| Sin regresiones | RF-9 | CA-11 |

`_stich_source_` no define iconos, así que no hay trazabilidad con el diseño. Los colores salen de los DESIGN.md de cada negocio.

## Technical Action Plan

### Objetivo técnico

Generar una sola vez el juego de iconos de cada negocio a partir de los PNG de `_stich_source_`, versionar los binarios en `public/img/<negocio>/icons/`, declarar sus metadatos (versión, color, nombres del manifest) una sola vez en el contenido de cada negocio y emitirlos en el `<head>` de las landings y de admin. Servir `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png` y los manifests desde rutas Koa que siguen la regla del día y piden revalidación.

### Decisiones técnicas

| #    | Decisión | Motivo |
| ---- | -------- | ------ |
| DT-1 | **Generación única con un script Python + Pillow** (`restaurante/scripts/generate-icons.py`), ejecutado a mano por quien desarrolla. Los PNG/ICO resultantes se versionan en el repo. No se añade ninguna dependencia npm ni de ejecución. | `sips` (macOS) puede recortar y escalar, pero no aplana la transparencia sobre un color ni escribe un .ico con varios tamaños. Node no decodifica imágenes sin una librería nativa (p. ej. `sharp`, binario pesado) y no está justificado para una tarea puntual (`.claude/rules/dependencias.md`). Python 3 y Pillow 12.2 ya están en la máquina de desarrollo. El script queda versionado porque contiene las coordenadas del recorte y hace reproducible la regeneración; el servidor nunca lo ejecuta. |
| DT-2 | **Recorte de la mascota (16/32/48 px)**: círculo sobre el color del negocio (decisión del usuario, 2026-10-02: "Circular sobre color"). Lienzo cuadrado opaco con el color de fondo (`#03132b` Molotes, `#290808` Birria) y, encima, el recorte de la mascota enmascarado en un círculo que ocupa todo el lienzo. Coordenadas del recorte en píxeles de la fuente: Molotes `(x 480, y 300) → (900, 720)`, 420×420 (cabeza con pañoleta y cara); Birria `(x 390, y 340) → (820, 770)`, 430×430 (cabeza del toro con cuernos). El círculo se dibuja a 4× y se reduce con Lanczos (bordes suavizados). Las coordenadas viven solo en el script. | Ver la revisión visual abajo. |
| DT-3 | **Iconos grandes**: el logo se recorta a su contorno no transparente y se centra sin deformar. apple-touch 180: opaco (RGB, sin canal alfa), fondo del negocio, logo a 162 px de alto (margen del 5 % para el redondeo de iOS). 192 y 512 (`purpose` "any"): fondo transparente, logo ajustado al lienzo. Maskable 512: opaco, fondo del negocio; el script busca la escala máxima tal que **todo píxel con alfa > 0 queda dentro del círculo central del 80 %** (radio 204,8 px) y falla si no se cumple. Los PNG grandes (180, 192, 512 y maskable) se guardan con paleta de 256 colores y difuminado: pesan unas 4 veces menos (p. ej. 512: de ~450 KB a ~90 KB) sin pérdida visible; los opacos no llevan transparencia en la paleta. | Cumple RF-1 y CA-5 con una comprobación automática, no a ojo. |
| DT-4 | **URLs propias de cada negocio**: archivos estáticos en `public/img/<negocio>/icons/` servidos por `koa-static` con la caché normal (1 h en producción). Se versionan con `?v=<icons.version>` (entero en el contenido del negocio); al regenerar un logo se incrementa ese número. | RF-6: estables, cacheables y versionables sin renombrar archivos. |
| DT-5 | **Rutas de la raíz** (`/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`): los archivos .ico y apple-touch de ambos negocios se leen a memoria al crear la app (fallo rápido si faltan). Cada respuesta lleva `Cache-Control: no-cache` y un `ETag` fuerte calculado del contenido (SHA-256); si `If-None-Match` coincide se responde 304 (`ctx.fresh` nativo de Koa). Tipos: `image/x-icon` e `image/png`. | Mismo criterio que `/` (revalidar siempre). El ETag distinto por negocio hace que, tras el cambio de día, la revalidación devuelva el icono nuevo (200), y evita retransmitir bytes el resto del tiempo. Se descarta un `max-age` hasta medianoche: más lógica de fechas y riesgo en las fronteras sin beneficio real para archivos de pocos KB. |
| DT-6 | **Manifests dinámicos** en `/molotes.webmanifest` y `/birria.webmanifest`, construidos una vez al arrancar a partir del contenido y de `BUSINESS_PATHS` (RF-8), con `application/manifest+json`, `no-cache` y ETag (misma utilidad que DT-5). Claves: `name`, `short_name`, `start_url`, `display`, `lang`, `theme_color`, `background_color`, `icons` (192, 512 y 512 con `purpose: "maskable"`), sin claves adicionales. | Un archivo estático repetiría nombres y colores. Se publican en la raíz (no en `/molotes/manifest...`) porque el `scope` por defecto es el directorio del manifest: en `/molotes/` el `start_url` `/molotes` quedaría fuera del scope y Chrome lo marcaría como error (CA-6). |
| DT-7 | **Admin**: el controlador de admin calcula el negocio activo con `getActiveBusinessId({ now: now(), timeZone })` por petición y lo pasa a las tres funciones de vista (`renderAdminLogin`, `renderAdminBusiness`, `renderAdminConfirmRestore`), que lo entregan al `layout`. El `<head>` de admin enlaza el .ico y los PNG 16/32 **del negocio activo por su URL propia** (no `/favicon.ico`), sin apple-touch, manifest ni theme-color. | Con la URL propia el navegador cambia de icono al cambiar de día aunque tenga `/favicon.ico` en su caché de favicons, y CA-9 se verifica comparando URLs. |
| DT-8 | **Un partial compartido** `partials/favicon-links.html` (ico + PNG 16 + PNG 32) lo usan ambos layouts; el layout de landings añade apple-touch, manifest y theme-color. | Evita duplicar marcado entre landings y admin. |

### Revisión visual del recorte

- Ya hay vistas previas generadas con las coordenadas de DT-2 (fuera del repo, en el scratchpad de la sesión):
  - `molotes-preview.png` y `birria-preview.png`: 16/32/48, apple-touch 180, maskable 512 con el círculo del 80 % dibujado en verde (solo en la vista previa) y 512 "any".
  - `molotes-sheet2.png` y `birria-sheet2.png`: comparación entre recorte cuadrado y recorte circular.
- Antes de cerrar: en T2 el script genera además una hoja de contacto `icons-preview.png` por negocio (no versionada) con todos los tamaños a 1× y ampliados 4× sin suavizado, y su ruta se reporta en el Implementation Result. El usuario la aprueba junto con la implementación; si quiere otro encuadre, en T3 solo cambian las coordenadas del script y se regeneran los binarios.

### Archivos o componentes afectados

- Nuevos:
  - `restaurante/scripts/generate-icons.py`.
  - `restaurante/public/img/{molotes,birria}/icons/`: `favicon.ico` (16/32/48), `icon-16.png`, `icon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
  - `restaurante/src/content/icons.js`: `iconSet(businessId, version)` (patrón único de rutas con `?v=`) y `buildManifest(businessId)`.
  - `restaurante/src/routes/icons.js` (o controlador equivalente en `src/controllers/icons.js`): rutas de la raíz y manifests, con la utilidad de respuesta con ETag.
  - `restaurante/src/views/partials/favicon-links.html`.
  - Tests: `tests/unit/icons.test.js`, `tests/integration/icons.test.js`.
- Modificados:
  - `src/content/molotes/index.js` y `src/content/birria/index.js`: bloque `icons` con `version`, `themeColor` y `manifest: { name, shortName }`.
  - `src/views/layouts/base.html`, `src/views/landings/index.js`.
  - `src/views/admin/layout.html`, `src/views/admin/index.js`, `src/controllers/admin.js`.
  - `src/routes/index.js` y `src/app.js` (carga de los buffers con `publicDir`).
  - `tests/snapshots/landing-{molotes,birria}.html` (solo se añaden las líneas de iconos en el `<head>`).
  - `restaurante/README.md`: sección "Iconos".

### Contenido / configuración

- Molotes: `icons: { version: 1, themeColor: '#03132b', manifest: { name: 'Moloteando', shortName: 'Moloteando' } }`.
- Birria: `icons: { version: 1, themeColor: '#290808', manifest: { name: 'Birria El Muñeco', shortName: 'El Muñeco' } }`.
- `background_color` = `themeColor` (D-3). `lang` sale de `commonContent.lang`; `start_url` de `BUSINESS_PATHS`.
- Sin variables de entorno nuevas.

### Validaciones y manejo de errores

- Al crear la app se leen los .ico y apple-touch de ambos negocios; si falta alguno, `createApp` lanza un error claro (fallo rápido), igual que otros recursos obligatorios.
- Las rutas de la raíz siempre resuelven un negocio (no hay 404). `HEAD` funciona por `@koa/router`.
- Debe seguir sin existir `public/favicon.ico` ni `public/apple-touch-icon*.png`: `koa-static` va antes del router y los serviría con caché larga. Un test lo comprueba.

### Testing

- Unit (`tests/unit/icons.test.js`): `iconSet` y `buildManifest` por negocio (valores exactos de RF-3, sin claves extra, URLs del propio negocio con `?v=`).
- Integración (`tests/integration/icons.test.js`, `now` inyectado en `createApp`):
  - CA-1/CA-2: links, `sizes`, manifest y theme-color de `/molotes` y `/birria`; ninguna URL del otro negocio.
  - CA-3: `/` igual a `/molotes` o `/birria` con fronteras viernes 23:59:59 → sábado 00:00:00 y domingo 23:59:59 → lunes 00:00:00 en `America/Mexico_City`, y un caso con día UTC distinto al local.
  - CA-4: cada URL referenciada responde 200 con su tipo; dimensiones leídas del IHDR de cada PNG; directorio del .ico con 16, 32 y 48; apple-touch y maskable con tipo de color PNG RGB (sin alfa) y sin chunk `tRNS` (prueba de opacidad sin dependencias).
  - CA-6: manifest JSON válido con los valores exactos.
  - CA-7/CA-8: las tres rutas de la raíz por día; `Cache-Control: no-cache`, sin `max-age`; ETag distinto entre negocios; 304 con `If-None-Match` igual; 200 con el icono nuevo tras el cambio de día.
  - CA-9: login y páginas de admin (con `tests/support/admin.js`) enlazan el favicon del negocio del día; sin manifest ni theme-color.
  - Con admin deshabilitado, `/favicon.ico` sigue respondiendo 200.
- CA-11: suite completa; las instantáneas de landing se actualizan y se revisa que el diff sea solo de líneas añadidas en el `<head>`.
- CA-5 y CA-10 son manuales (hoja de contacto, maskable.app, DevTools > Application > Manifest, iOS Safari y Android Chrome). Quedan como pendientes de verificación del usuario en el Implementation Result.

### Seguridad

- Sin cambios de CSP ni de cabeceras de `koa-helmet`: `img-src 'self'` y `default-src 'self'` (que cubre `manifest-src`) ya permiten los recursos.
- Las rutas nuevas no leen entrada del cliente salvo `If-None-Match`, que Koa compara sin interpretarlo.
- Los valores del `<head>` se escapan con `{{ }}`.

### Performance

- Los buffers de la raíz y los manifests se preparan una vez al arrancar: sin E/S por petición.
- PNG optimizados (`optimize=True`); el .ico pesa unos pocos KB.
- Seis `<link>` más en el `<head>` de las landings; no bloquean el render.

### Riesgos técnicos

- Regenerar los iconos requiere Python 3 + Pillow (se documenta en el README; no afecta a la ejecución ni al despliegue).
- A 16 px el detalle es limitado; mitigado con el recorte ajustado y la revisión visual.
- Cachés propias de favicons de Safari/iOS (limitación aceptada en RF-6).
- El logo maskable queda pequeño (cabe completo en el círculo del 80 %, por exigencia de CA-5).

### Orden de implementación

1. Script de generación, iconos versionados y hoja de contacto.
2. Bloque `icons` en el contenido, `src/content/icons.js` y sus tests unitarios.
3. Partial y `<head>` de las landings; actualización de instantáneas.
4. Rutas de la raíz y manifests con ETag y `no-cache`.
5. Favicon en admin.
6. Tests de integración, `npm run build:css`, `npm test`.
7. README.

### Criterios de finalización

- CA-1 a CA-4 y CA-6 a CA-9, CA-11 cubiertos por tests en verde.
- CA-5 con la hoja de contacto y la comprobación automática del script; CA-10 pendiente de verificación manual del usuario.
- `git diff` sin cambios ajenos al ticket.

## Implementation Result

### Rama

`feature/REQ-F-002-favicons-por-landing` (desde `main` actualizado). Sin commit.

### Cambios realizados

- **Generación de iconos (DT-1 a DT-3):** `restaurante/scripts/generate-icons.py` (Python 3 + Pillow, solo desarrollo). Genera en `public/img/<negocio>/icons/`:
  - `favicon.ico` (16/32/48), `icon-16.png` e `icon-32.png`: la mascota recortada en círculo sobre `#03132b` / `#290808` (decisión del usuario "Circular sobre color").
  - `apple-touch-icon.png` (180, opaco): el logo completo.
  - `icon-192.png` e `icon-512.png`: fondo transparente.
  - `icon-maskable-512.png`: opaco. El script busca la escala máxima en la que todo píxel con alfa > 0 cabe en el círculo del 80 % y falla si no se cumple.
  - Los PNG grandes llevan paleta de 256 colores. Peso total: ~200 KB por negocio.
- **Fuente única (RF-8):** bloque `icons` (`version`, `themeColor`, `manifest.name`, `manifest.shortName`) en `src/content/{molotes,birria}/index.js`. `src/content/icons.js` define una sola vez:
  - los archivos;
  - las URLs versionadas con `?v=`;
  - `buildManifest` (claves exactas de RF-3).

  También valida el contenido al cargarse (fallo rápido).
- **`<head>` de las landings (RF-2, RF-4):**
  - el partial `partials/favicon-links.html` (.ico + PNG 16/32);
  - en `layouts/base.html`, el apple-touch, el manifest y el theme-color;
  - `renderLandingPage` pasa los enlaces del negocio mostrado.
- **Rutas de la raíz y manifests (RF-5, RF-6, DT-5, DT-6):** `src/controllers/icons.js`.
  - Carga a memoria el .ico y el apple-touch de cada negocio al crear la app; si falta alguno, la app no arranca.
  - Responde con `Cache-Control: no-cache`, ETag SHA-256 y 304 vía `ctx.fresh`.
  - Rutas: `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`, `/molotes.webmanifest` y `/birria.webmanifest`. Están registradas en `src/routes/index.js`, y `app.js` pasa `publicDir`.
- **Admin (RF-7, DT-7):** `createAdminController` calcula el negocio activo con `now` y la zona horaria, y lo pasa como `faviconBusinessId` a `renderAdminLogin`, `renderAdminBusiness` y `renderAdminConfirmRestore`. El `admin/layout.html` incluye el mismo partial, sin manifest ni theme-color.
- **Tests:**
  - nuevos: `tests/unit/icons.test.js`, `tests/integration/icons.test.js` y `tests/support/png.js` (lector mínimo de PNG/ICO sin dependencias);
  - actualizados: `tests/unit/admin-form.test.js` (nuevo parámetro) y las instantáneas `tests/snapshots/landing-{molotes,birria}.html`.
- **README:** rutas HTTP, estructura y la sección "Iconos (favicons y pantalla de inicio)", con cómo regenerar y versionar los iconos.

### Criterios de aceptación

| CA | Estado | Evidencia |
| -- | ------ | --------- |
| CA-1 | Cumple | `icons.test.js` (integración): `<head>` de `/molotes` exacto, sin URLs de Birria, incluso en sábado. |
| CA-2 | Cumple | Lo mismo para `/birria`, en viernes. |
| CA-3 | Cumple | `/` igual a la ruta fija en: viernes 12:00; viernes 20:00 CDMX (sábado en UTC); viernes 23:59:59; sábado 00:00:00; domingo 23:59:59; lunes 00:00:00. |
| CA-4 | Cumple | Cada URL del `<head>` y del manifest responde 200: .ico `image/x-icon` / `image/vnd.microsoft.icon`, PNG `image/png`, manifest `application/manifest+json`. Las dimensiones del IHDR coinciden y el .ico trae 16/32/48. |
| CA-5 | Parcial (automático) / pendiente de revisión visual | Test: apple-touch, maskable y 16/32 sin transparencia, con la esquina del color del negocio. El script comprueba la zona segura del maskable. Falta la revisión del usuario con la hoja de contacto y maskable.app. |
| CA-6 | Cumple (automático) / DevTools pendiente | `toStrictEqual` con los valores de RF-3. Falta revisar a mano Chrome DevTools > Application > Manifest. |
| CA-7 | Cumple | Las tres rutas de la raíz devuelven los bytes del negocio del día en las fronteras. |
| CA-8 | Cumple | `Cache-Control: no-cache`, sin `max-age`, ETag distinto por negocio, 304 con el mismo ETag y 200 con el icono nuevo tras medianoche. |
| CA-9 | Cumple | El login (en las 4 fronteras) y las páginas `/admin/<negocio>` y `/restaurar-anterior` muestran el favicon del día, no el del negocio editado. Sin manifest, apple-touch ni theme-color. |
| CA-10 | Pendiente | Verificación manual en dispositivos (Chrome/Safari de escritorio, iOS, Android). |
| CA-11 | Cumple | Suite completa en verde. El diff de las instantáneas son solo 6 líneas añadidas por landing, en el `<head>`; no se modificó ni eliminó ninguna línea. |

### Validaciones ejecutadas

- `python3 scripts/generate-icons.py --preview-dir <scratchpad>`: generó los 14 archivos y las hojas de contacto.
- `npm run build:css`: OK.
- `npm test`: 25 archivos, **462 tests pasados**, 0 fallidos.
- `npm run lint`: **lint no configurado** (placeholder).
- `git diff tests/snapshots`: solo se añaden las líneas de iconos (6 por landing).

### Archivos afectados

- Nuevos:
  - `restaurante/scripts/generate-icons.py`;
  - `restaurante/public/img/{molotes,birria}/icons/` (7 archivos cada uno);
  - `restaurante/src/content/icons.js`;
  - `restaurante/src/controllers/icons.js`;
  - `restaurante/src/views/partials/favicon-links.html`;
  - `restaurante/tests/unit/icons.test.js`, `restaurante/tests/integration/icons.test.js`, `restaurante/tests/support/png.js`.
- Modificados:
  - `restaurante/README.md`;
  - `restaurante/src/app.js`;
  - `restaurante/src/content/{molotes,birria}/index.js`;
  - `restaurante/src/controllers/admin.js`;
  - `restaurante/src/routes/index.js`;
  - `restaurante/src/views/admin/{index.js,layout.html}`;
  - `restaurante/src/views/landings/index.js`;
  - `restaurante/src/views/layouts/base.html`;
  - `restaurante/tests/snapshots/landing-{molotes,birria}.html`;
  - `restaurante/tests/unit/admin-form.test.js`.

### Riesgos o pendientes

- **Revisión visual (CA-5):** hojas de contacto `icons-preview-molotes.png` e `icons-preview-birria.png`, en el scratchpad de la sesión (fuera del repo). Tienen 16/32/48 a 1× y ampliados 4×, el 180, el 192, el 512 y el maskable.
- CA-6 (DevTools) y CA-10 (dispositivos) se verifican a mano.
- Los colores de fondo están en el script y en el contenido. El test de la esquina de cada icono detecta si se desalinean al regenerar.
- No hay commits. El ticket no está versionado todavía (se creó sin seguimiento en `backlog/`), así que se movió con `mv`.
- Caché propia de favicons de Safari e iOS (limitación aceptada).

## QA Action Plan

### Objetivo

Validar con evidencia independiente (no solo con los tests del desarrollador) que cada landing, la raíz y admin exponen los iconos, el manifest y el theme-color correctos según RF-1 a RF-9, sin regresiones en el `<head>`, el diseño ni el comportamiento.

### Requisito bajo prueba

REQ-F-002 (versión 1, aprobada) con D-1 a D-7 y el Technical Action Plan aprobado (DT-1 a DT-8, recorte "Circular sobre color"). Implementación aprobada por el usuario: "Aprobar y pasar a QA".

### Criterios de aceptación (cada uno -> pruebas que lo cubren)

| CA | Pruebas |
| -- | ------- |
| CA-1 | F-1, F-3, B-1 |
| CA-2 | F-2, F-3, B-1 |
| CA-3 | F-4, L-1, L-2, A-1 |
| CA-4 | F-5, F-6, P-1 |
| CA-5 | V-1, V-2, V-3, V-4 (automático, independiente) + revisión visual del usuario (hojas de contacto y maskable.app) |
| CA-6 | F-7, B-2 + revisión manual del usuario en DevTools > Application > Manifest |
| CA-7 | F-8, L-1, A-1 |
| CA-8 | F-9, L-3 |
| CA-9 | F-10, A-1 |
| CA-10 | Solo verificación manual del usuario en dispositivos (ver "Pendientes de revisión manual") |
| CA-11 | R-1 a R-5 |

### Riesgos identificados

- R-a. Un PNG "opaco" con paleta podría conservar transparencia (`tRNS`) o un borde que no sea del color del negocio; el test actual solo comprueba la esquina superior izquierda.
- R-b. El maskable podría salirse del círculo del 80 %: hoy lo garantiza el script de generación, no un test sobre el binario versionado.
- R-c. Rutas de la raíz servidas desde una caché larga si alguien añade `public/favicon.ico` (koa-static va antes del router), o un `max-age` heredado de middleware (helmet, static).
- R-d. Selección por día con una zona horaria configurada distinta de la del servidor (`BUSINESS_TIMEZONE` distinto de `America/Mexico_City`, o `TZ` del proceso distinto).
- R-e. CSP (`koa-helmet`) bloqueando el manifest o los iconos en el navegador real (los tests HTTP no lo detectan).
- R-f. Ambos manifests en la raíz comparten `scope` "/" e identidad derivada de `start_url`: Chrome podría advertir algo en DevTools; solo se puede confirmar a mano.
- R-g. Admin: las tres vistas reciben un nuevo parámetro; una vista no cubierta (p. ej. una página de error de admin) podría renderizar sin favicon o romperse.
- R-h. Regresión del `<head>` de landings y admin (orden o contenido de SEO/OG/CSS/JS).

### Pruebas funcionales (caja negra contra el servidor real, `curl`/script en el scratchpad)

- F-1. `GET /molotes`: el `<head>` contiene el .ico, PNG 16 y 32 (con `sizes`), apple-touch 180, manifest `/molotes.webmanifest` y `theme-color` `#03132b`; todas las URLs son de `/img/molotes/icons/` con `?v=1`.
- F-2. Igual para `/birria` con `#290808`.
- F-3. Ninguna URL de iconos de `/molotes` contiene `birria` y viceversa.
- F-4. `GET /` en el día real del servidor: links de iconos idénticos a los de la ruta fija del negocio del día.
- F-5. Cada URL referenciada (incluidas las de `icons` del manifest) responde 200 con `Content-Type` correcto (`image/x-icon`/`image/vnd.microsoft.icon`, `image/png`, `application/manifest+json`).
- F-6. Dimensiones reales leídas con Pillow (herramienta del entorno de desarrollo, sin añadir dependencias al proyecto): PNG 16, 32, 180, 192, 512, maskable 512; el .ico con 16, 32 y 48.
- F-7. Cada manifest: JSON válido; exactamente las claves y valores de RF-3 (`name`, `short_name`, `start_url`, `display` "browser", `lang` "es-MX", `theme_color`, `background_color`, `icons` 192/512/maskable 512 con `purpose`).
- F-8. `/favicon.ico`, `/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png`: 200, bytes idénticos (hash) a los archivos del negocio del día.
- F-9. Cabeceras de esas tres rutas y de los manifests: `Cache-Control: no-cache`, sin `max-age`/`immutable`, `ETag` presente; `If-None-Match` con el ETag devuelve 304.
- F-10. `/admin/login` (y, con sesión de test, las páginas de admin): favicon del negocio del día por su URL propia; sin manifest, apple-touch ni theme-color.

### Pruebas negativas y casos límite

- N-1. `HEAD` en las tres rutas de la raíz: 200 sin cuerpo y mismo `Content-Type`.
- N-2. `If-None-Match` con un ETag ajeno o del otro negocio: 200 con el cuerpo completo.
- N-3. Rutas inexistentes cercanas (`/favicon.png`, `/otro.webmanifest`, `/molotes/manifest.webmanifest`): 404 controlado, sin stack trace.
- N-4. `/favicon.ico?x=1` responde igual que `/favicon.ico`.
- N-5. Comprobar que no existen `public/favicon.ico` ni `public/apple-touch-icon*.png`.
- N-6. Con admin deshabilitado (sin credenciales), `/favicon.ico` responde 200 (cubierto por la suite; se confirma en la salida).
- N-7. Arranque sin un icono obligatorio: se verifica en un directorio `publicDir` temporal en el scratchpad (sin tocar `public/`) que `createApp` falla con un mensaje claro.

### Casos límite de fecha y zona horaria

- L-1. Fronteras viernes 23:59:59 -> sábado 00:00:00 y domingo 23:59:59 -> lunes 00:00:00 en `America/Mexico_City` para `/`, las tres rutas de la raíz y `/admin/login` (suite existente, confirmada en la salida).
- L-2. Zona configurable: con `BUSINESS_TIMEZONE` distinto (p. ej. `Asia/Tokyo`) y el proceso en otra zona (`TZ=UTC`), un instante que es viernes en CDMX y sábado en Tokio selecciona Birria en `/`, `/favicon.ico` y `/admin/login`.
- L-3. Tras el cambio de día, revalidar con el ETag del día anterior devuelve 200 con el icono nuevo (suite existente).

### Pruebas responsive (375x812, 768x1024, 1440x900)

- RS-1. Los cambios no son visibles en la página: se confirma en `/molotes` y `/birria` en los tres viewports que no hay overflow horizontal ni cambios de layout respecto a lo esperado (comparación visual rápida con capturas; el CSS no cambió).

### Pruebas de accesibilidad

- AC-1. Sin cambios en el `<body>`: se confirma que el diff no toca el cuerpo y que se mantiene un solo `h1` en ambas landings. Los iconos no requieren texto alternativo (metadatos del `<head>`).

### Pruebas UX/UI (vs. `_stich_source_/`)

- `_stich_source_/` no define iconos. Se verifica que el arte proviene de `_stich_source_/logo_*.png/screen.png` (script) y que los colores coinciden con los DESIGN.md (`#03132b`, `#290808`).
- V-1. Hojas de contacto `icons-preview-{molotes,birria}.png`: inspección por QA de que 16/32/48 muestran solo la mascota en círculo y 180/192/512 el logo completo sin deformar (proporción del contorno del logo comparada con la fuente).
- V-2. Apple-touch y maskable: sin canal alfa ni `tRNS`, y las cuatro esquinas y el borde completo del color del negocio (Pillow, tolerancia de paleta <= 3).
- V-3. Maskable: todo píxel que no es fondo queda dentro del círculo central de radio 204,8 px (Pillow, verificación independiente del script).
- V-4. 192 y 512 "any": transparentes fuera del logo y logo sin deformar (relación de aspecto del contorno dentro de +-2 % de la fuente).

### Pruebas de integración

- No hay integraciones externas nuevas. WhatsApp: se confirma por regresión (R-3) que el CTA y su `href` no cambian en ambas landings.

### Pruebas de performance

- P-1. Peso de cada icono (presupuesto informativo: favicon y PNG pequeños < 15 KB; grandes < 100 KB; total por negocio ~200 KB) y que los iconos grandes no se cargan en la página (solo el navegador los pide al instalar).
- P-2. En navegador: lista de peticiones de `/molotes` y `/birria`; sin 404 de iconos ni del manifest; sin errores de consola (incluidos CSP).

### Pruebas SEO

- S-1. El resto del `<head>` (title, description, canonical, OG, viewport) no cambia: diff de las instantáneas limitado a 6 líneas añadidas por landing.

### Pruebas de regresión

- R-1. `npm run build:css` y `npm test` completos en verde.
- R-2. `git diff main...` + cambios sin commit: no hay cambios ajenos al ticket; el diff de `tests/snapshots/` es solo de líneas añadidas.
- R-3. `/molotes`, `/birria` y `/` responden 200 con el mismo contenido visible y el CTA de WhatsApp intacto.
- R-4. Admin: login y edición funcionan (suite `admin.test.js` y `admin-form.test.js`); `<head>` de admin con solo una línea añadida (el partial).
- R-5. Cabeceras de seguridad (`koa-helmet`) presentes también en las rutas nuevas.

### Pruebas automatizadas

- Existentes a ejecutar: toda la suite (`tests/unit/icons.test.js`, `tests/integration/icons.test.js`, landings, snapshots, admin).
- Nuevas propuestas en `restaurante/tests/integration/icons.test.js` (solo si se aprueba este plan):
  - A-1. Zona horaria configurable (L-2): `BUSINESS_TIMEZONE` distinto de CDMX para `/`, `/favicon.ico`, `/apple-touch-icon-precomposed.png` y `/admin/login`.
  - A-2. `HEAD /apple-touch-icon-precomposed.png` y `If-None-Match` con el ETag del otro negocio -> 200.
- Las comprobaciones de píxeles (V-2 a V-4) y del arranque sin iconos (N-7) se ejecutan como scripts temporales en el scratchpad (Pillow / Node), sin añadir dependencias ni archivos al repo.

### Pruebas en navegador (Claude in Chrome, servidor en `PORT=3100`)

- B-1. `/molotes` y `/birria`: leer con JS los `link[rel~=icon]`, `apple-touch-icon`, `manifest` y `theme-color`; capturas a 375x812, 768x1024 y 1440x900.
- B-2. `fetch` del manifest desde la página: 200, JSON válido, sin error de CSP; la consola sin errores.
- B-3. Peticiones de red: los favicons y el manifest se cargan sin 404.
- La pestaña del navegador (icono real en la barra) y DevTools > Application > Manifest no son accesibles para la extensión: quedan como revisión manual del usuario.

### Evidencia requerida

- Salidas de `npm run build:css` y `npm test` (número de archivos y tests).
- Salidas de `curl -sI`/`curl -s` con estado, `Content-Type`, `Cache-Control`, `ETag` y hashes.
- Salida de los scripts de Pillow (dimensiones, alfa, bordes, zona segura).
- Texto/JS leído en el navegador, capturas por viewport y log de consola/red.

### Pendientes de revisión manual del usuario

- CA-5: revisión visual de las hojas de contacto y del maskable en maskable.app.
- CA-6: Chrome DevTools > Application > Manifest sin errores ni advertencias de iconos, en `/molotes` y `/birria`.
- CA-10: Chrome y Safari de escritorio (pestaña), iOS Safari y Android Chrome ("Añadir a pantalla de inicio": icono, nombre, fondo y apertura de `/molotes` o `/birria` en el navegador). QA no tiene acceso a dispositivos.

### Criterios de aprobación

- CA-1 a CA-4, CA-7 a CA-9 y CA-11 en PASS con evidencia.
- CA-5 en PASS en su parte automatizable (V-1 a V-4); CA-5 visual, CA-6 (DevTools) y CA-10 se reportan como pendientes de revisión manual del usuario. Como ningún otro criterio depende solo de ellos, QA puede emitir `QA_APPROVED` condicionado a esa revisión; si el usuario prefiere que esas verificaciones bloqueen la aprobación, el resultado será `NEEDS_USER_DECISION` hasta que las confirme.
- `npm test` en verde, sin defectos BLOCKER/CRITICAL y sin MAJOR sin decisión del usuario.

## QA Report

### Ronda

1 (2026-10-02). QA Action Plan aprobado por el usuario: "Aprobar". Tests A-1/A-2: "Sí (Recomendado)". Verificaciones manuales: "QA aprueba con condición".

### Pruebas ejecutadas

- Rama `feature/REQ-F-002-favicons-por-landing`, cambios sin commit (solo archivos del ticket).
- `npm run build:css`: OK (tailwindcss v4.3.3).
- `npm test` antes de añadir tests: 25 archivos, 462 tests pasados.
- Tests añadidos por QA en `restaurante/tests/integration/icons.test.js`:
  - A-1 (2 casos): instante viernes 10:00 CDMX = sábado 01:00 Tokio. Con `BUSINESS_TIMEZONE=America/Mexico_City`, `/`, `/favicon.ico`, `/apple-touch-icon-precomposed.png` y `/admin/login` dan Molotes; con `Asia/Tokyo`, Birria.
  - A-2 (4 casos): `HEAD /apple-touch-icon-precomposed.png` (200, `image/png`, `no-cache`, sin cuerpo); las tres rutas de la raíz con el ETag del otro negocio responden 200 con el icono del día.
- `npm test` final: 25 archivos, **468 tests pasados**, 0 fallidos.
- Servidor real `PORT=3100 TZ=UTC npm start` (`.env` existente, `BUSINESS_TIMEZONE=America/Mexico_City`). Fue a las 20:11 del viernes en CDMX, que ya era sábado 02:11 en UTC: caso real de servidor en otra zona.
  - `<head>` de `/molotes`, `/birria`, `/` y `/admin/login` con `curl`.
  - Cabeceras y SHA-256 de las rutas de la raíz y los manifests.
  - Todas las URLs referenciadas (`<head>` y `icons` del manifest), con formato y dimensiones leídos con Pillow.
- Comprobaciones en proceso (script temporal, ya borrado) con `NODE_ENV=production`: caché y respuesta de error.
- Arranque con un icono faltante (copia temporal de `public/`, ya borrada).
- Pillow (scratchpad, sin dependencias nuevas):
  - opacidad, `tRNS` y borde completo del color del negocio;
  - zona segura del maskable;
  - relación de aspecto del logo frente a la fuente de `_stich_source_`.
- Revisión de las hojas de contacto `icons-preview-{molotes,birria}.png`.
- Navegador (Claude in Chrome): **la extensión no está conectada** (3 intentos con el mismo error). B-1 a B-3 y RS-1 quedan pendientes de revisión manual.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| -- | --------- | --------- |
| CA-1 | PASS | En `curl /molotes` están el .ico (`sizes="16x16 32x32 48x48"`), los PNG 16x16 y 32x32, el apple-touch 180x180, `/molotes.webmanifest` y `theme-color #03132b`. Todas las URLs son `/img/molotes/icons/...?v=1` y ninguna contiene `birria`. Test de integración CA-1 en verde. |
| CA-2 | PASS | Lo mismo en `/birria`, con `/img/birria/icons/...`, `/birria.webmanifest` y `#290808`. |
| CA-3 | PASS | En el servidor real (viernes CDMX, sábado UTC), `/` emite exactamente los enlaces de Molotes. La suite cubre las fronteras viernes 23:59:59 / sábado 00:00:00 / domingo 23:59:59 / lunes 00:00:00 y el día UTC distinto. A-1 confirma que la zona es configurable. |
| CA-4 | PASS | Las 14 URLs referenciadas responden 200. El .ico es `image/vnd.microsoft.icon` (estático) o `image/x-icon` (raíz) y contiene 16/32/48. Los PNG son `image/png` y miden lo declarado: 16, 32, 180, 192, 512 y 512. Los manifests se sirven como `application/manifest+json; charset=utf-8`. |
| CA-5 | PASS (automático) / revisión visual pendiente del usuario | **Opacos:** apple-touch y maskable sin alfa ni `tRNS`, con el borde completo del color del negocio (0/720 y 0/2048 píxeles distintos). 16 y 32 son RGB sin alfa, con esquinas del color; el círculo de la mascota llega al borde, como define DT-2. **Maskable:** el contenido llega a un radio de 203,2 px en Molotes y 203,3 px en Birria, dentro del límite de 204,8. **Sin deformar:** el aspecto del logo difiere de la fuente un 0,3 % como máximo. En las hojas de contacto, los tamaños pequeños muestran solo la mascota y los grandes el logo completo. |
| CA-6 | PASS (JSON) / DevTools pendiente del usuario | Ambos manifests son JSON válido con exactamente `name`, `short_name`, `start_url`, `display` "browser", `lang` "es-MX", `theme_color`, `background_color` e `icons`. Valores: Molotes "Moloteando"/"Moloteando" `/molotes`; Birria "Birria El Muñeco"/"El Muñeco" `/birria`. Los iconos son 192, 512 y maskable 512 (`purpose: "maskable"`). |
| CA-7 | PASS | En el servidor real, el SHA-256 de `/favicon.ico` y el de `/apple-touch-icon(-precomposed).png` coinciden con `molotes/favicon.ico` (cc05ae29…) y `molotes/apple-touch-icon.png` (1ebddc0c…). La suite y A-1 cubren Birria en fin de semana. |
| CA-8 | PASS | Las tres rutas de la raíz y los manifests llevan `Cache-Control: no-cache`, sin `max-age`, con ETag. `If-None-Match` con el mismo ETag devuelve 304; con otro ETag, 200. En la suite, después de medianoche se sirve el icono nuevo con 200. En producción, los iconos con URL propia usan `max-age=3600` y `?v=` (RF-6). |
| CA-9 | PASS | `/admin/login` en el servidor real enlaza solo el .ico y los PNG 16/32 de Molotes (viernes CDMX), sin manifest, apple-touch ni theme-color. La suite cubre las fronteras, `/admin/<negocio>` y `restaurar-anterior`. A-1 cubre la zona configurable. |
| CA-10 | PENDIENTE (verificación manual del usuario) | QA no tiene acceso a dispositivos iOS/Android y la extensión del navegador no está disponible. |
| CA-11 | PASS | 468/468 tests. El diff de las instantáneas es +6/-0 por landing, solo en el `<head>`. El `<head>` de admin solo añade el partial. |

### Defectos encontrados

Ninguno.

Observaciones (no son defectos):
- **OBS-1. Error 404 en desarrollo.** Con `NODE_ENV=development`, un 404 (p. ej. `/favicon.png`) devuelve `stack` en el JSON. Es el comportamiento previo del manejador de errores (`exposeStack` solo en development). En producción la respuesta es `{"error":{"code":"NOT_FOUND","message":"Not Found"}}`, sin stack. No lo introduce este ticket.
- **OBS-2. Cuernos del toro a 16-48 px.** En el recorte de Birria, los cuernos aparecen solo en parte en el borde superior del círculo. Lo valida el usuario en la revisión visual de CA-5. Si quiere otro encuadre, solo cambian las coordenadas de DT-2.

### Regresión

- La suite completa está en verde.
- Los CTA de WhatsApp no cambian: `wa.me/5210000000001?text=…molotes` y `wa.me/5210000000002?text=…birria`.
- Hay un solo `h1` en cada landing.
- Las cabeceras de `koa-helmet` (CSP y `nosniff`) también están en las rutas nuevas.
- Arranque sin un icono obligatorio: falla rápido con "Falta el icono /img/birria/icons/apple-touch-icon.png (genéralo con scripts/generate-icons.py)".
- `public/` no contiene `favicon.ico` ni `apple-touch-icon*.png`.
- Rutas inexistentes cercanas (`/favicon.png`, `/otro.webmanifest`, `/molotes/manifest.webmanifest`) responden 404 controlado. `/favicon.ico?x=1` responde 200.

### Responsive

Sin cambios en el `<body>` ni en el CSS: el diff de las instantáneas solo afecta al `<head>`. La revisión visual a 375x812, 768x1024 y 1440x900 queda pendiente porque la extensión del navegador no estaba disponible.

### Accesibilidad

Sin cambios en el `<body>`. Los iconos son metadatos del `<head>` y no requieren texto alternativo. Se mantiene un solo `h1`.

### UX/UI

`_stich_source_/` no define iconos. El arte sale de los PNG de `_stich_source_` y los colores (`#03132b`, `#290808`) son los de los DESIGN.md. La revisión de las hojas de contacto es coherente con D-1 y DT-2/DT-3.

### Performance

- Pesos por negocio: favicon.ico ~9,5 KB, PNG 16 ~0,9 KB, PNG 32 ~2,8 KB, apple-touch ~16-17 KB, 192 ~20-22 KB, 512 ~87-89 KB, maskable ~64-70 KB.
- La página solo declara el .ico, los PNG 16/32 y el apple-touch. Los iconos grandes solo se piden al instalar.
- Las rutas de la raíz responden desde memoria, con 304 cuando se revalida.

### SEO

`title`, description, canonical, OG y viewport no cambian (instantáneas +6/-0). Cada landing declara el `theme-color` y el manifest de su negocio.

### Pendientes de revisión manual

1. **CA-5 visual:** revisar las hojas de contacto (`/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/e31ec681-7a26-46af-904b-ccbd2fec1cb3/scratchpad/icons-preview-{molotes,birria}.png`) y el maskable en maskable.app. Ver OBS-2.
2. **CA-6:** Chrome DevTools > Application > Manifest en `/molotes` y `/birria`, sin errores ni advertencias de iconos.
3. **CA-10:** pestaña en Chrome y Safari de escritorio; "Añadir a pantalla de inicio" en iOS Safari y Android Chrome (icono, nombre, fondo y apertura de `/molotes` o `/birria` en el navegador); instalación desde `/` en fin de semana.
4. **B-1 a B-3 y RS-1:** consola sin errores de CSP, red sin 404 de iconos y capturas en los 3 viewports. No se pudieron ejecutar porque la extensión no estaba conectada.

### Resultado final

QA_APPROVED, condicionado a que el usuario complete los pendientes de revisión manual antes del merge (decisión del usuario: "QA aprueba con condición").

## Historial de cambios

### Commit y Pull Request — 2026-10-02

senior-fullstack: el usuario eligió "Commit y Pull Request". `npm test`: 468 tests en verde. Commit en `feature/REQ-F-002-favicons-por-landing` y Pull Request hacia `main`. Estado: `READY_FOR_MERGE`. El merge queda sujeto a las verificaciones manuales pendientes (CA-5 con OBS-2, CA-6 y CA-10).

### QA Ronda 1 — 2026-10-02

senior-qa: plan aprobado ("Aprobar"). Se ejecutó la batería y se añadieron los tests A-1 y A-2 (468 tests en verde). Sin defectos. La extensión del navegador no estaba disponible. Estado: `QA_APPROVED` condicionado a las verificaciones manuales de CA-5, CA-6 y CA-10.

### QA Action Plan — 2026-10-02

senior-qa: análisis del requisito y de los cambios; se añade el QA Action Plan (sin ejecutar la batería definitiva). Estado: `NEEDS_QA_PLAN_APPROVAL`.

### Implementación — 2026-10-02

senior-fullstack: implementación completa según el Technical Action Plan (recorte circular sobre color). `npm test`: 462 tests en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Inicio de implementación — 2026-10-02

senior-fullstack: el usuario aprobó el Technical Action Plan ("Aprobar"), eligió el recorte "Circular sobre color" (DT-2 actualizado) y confirmó la herramienta ("Sí, Python + Pillow"). Rama `feature/REQ-F-002-favicons-por-landing`; ticket movido a `in-progress/`. Estado: `IN_PROGRESS`.

### Technical Action Plan — 2026-10-02

senior-fullstack: revisión técnica sin bloqueos; se añade el Technical Action Plan (DT-1 a DT-8). Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Versión 1

Descripción inicial, aprobada junto con dos ajustes:

- el nombre del manifest de Birria es "Birria El Muñeco";
- `/apple-touch-icon-precomposed.png` es un requisito firme.
