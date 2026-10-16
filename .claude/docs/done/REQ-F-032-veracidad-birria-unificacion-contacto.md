# REQ-F-032 — Textos veraces de Birria y unificación de contacto, ubicación y bot

## Estado

DONE

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-15). Respuesta textual a "¿Apruebas los tres tickets con estos textos?": "si".

Serie de tickets y orden obligatorio: **REQ-F-032 → REQ-F-033 → REQ-F-034**. Este es el primero.

## Objetivo

Que `/birria` y `/` publiquen solo afirmaciones comerciales verdaderas con la voz editorial aprobada (mexicana, cercana, divertida y antojable), y que Birria, Molotes y el bot de WhatsApp publiquen los datos de la **única sucursal**: ubicación de Molotes (con mapa embebido), teléfono `+52 735 278 2306` y correo `ordenes@birriaelmuneco.mx`.

## Alcance

- Textos estáticos de Birria en `restaurante/src/content/birria/index.ts` (llegan con el despliegue).
- Datos de contacto y ubicación de ambas landings y del bot.
- Plataformas de pedido de ambas landings.
- Ajustes mínimos de las plantillas afectadas (sucursal única con mapa, plataformas, contacto del pie).
- Pruebas, snapshots y README.

## Fuera de alcance

- Productos de Birria (MySQL) y `seed.json`.
- Showcase del hero y promoción editables en /admin (`DATA_DIR/birria/current.json`). Ver "Decisión por defecto (V-3)".
- Precios.
- Aviso de la página de inicio (`homeNotices`) y su lógica.
- Botones de navegación cruzada del pie (REQ-F-033).
- Avisos en `/molotes` (REQ-F-034).
- Textos de proceso de Molotes: se conservan porque el usuario confirmó que son ciertos.
- Diseño fuera de las secciones afectadas, dependencias, infraestructura, despliegue y variables de entorno.

## Reglas de negocio

- **RN-1.** Birria es "birria de res estilo de Los Altos de Jalisco", preparada con "cocción lenta". No se mencionan otros métodos de cocción: horno, horno de pozo, olla sellada con masa, olla de presión ni tatemada.
- **RN-2.** No se publican tiempos de cocción, ingredientes, gramajes, certificaciones, años de tradición, número de sucursales, cifras de venta, reseñas, valoraciones, premios ni testimonios que no estén confirmados.
- **RN-3.** Hay una sola sucursal, con los mismos datos en ambas landings y en el bot.
- **RN-4.** Las entregas a domicilio se hacen por motomandados. Se puede recoger en la sucursal. No se mencionan Uber Eats, Rappi ni empaques térmicos.
- **RN-5.** Ningún botón contiene "2x1" ni "2×1". Si un botón activa una promoción, su texto es exactamente "Activar promoción".
- **RN-6.** El teléfono de llamadas y el WhatsApp del bot son datos distintos; la configuración de WhatsApp no cambia.

## Requisitos

- **R-1. Nombre comercial.** El nombre visible es "Birria El Muñeco" en textos, SEO, alt del logo y copyright. "Birriería" no aparece.
- **R-2. Textos de Birria.** Se usan los textos exactos de la tabla editorial aprobada (más abajo).
- **R-3. Ubicación única.**
  - `/`, `/birria`, `/molotes` y la respuesta "Horario y ubicación" del bot (ambos negocios) usan el enlace `https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853`.
  - El enlace corto `https://maps.app.goo.gl/sAFDEeLdKzs7GGPz9` deja de usarse en todas partes.
- **R-4. Mapa embebido en Birria.**
  - La tarjeta de sucursal de Birria muestra el mismo mapa embebido (Street View) que Molotes, con el mismo `src` oficial aprobado en REQ-F-031, el `title` "Ubicación de Birria El Muñeco en Google Maps" y `loading="lazy"`.
  - No se añaden orígenes a la CSP.
  - "Cómo llegar" enlaza a R-3, abre en otra pestaña con `rel="noopener noreferrer"` y lleva su texto de apoyo para lectores de pantalla.
- **R-5. Sucursal única.** La lista de 3 sucursales pasa a una sola entrada. No se publica dirección postal ni "Estacionamiento Disponible".
- **R-6. Contacto en los pies de ambas landings.**
  - Teléfono `+52 735 278 2306` (`tel:+527352782306`).
  - Correo `ordenes@birriaelmuneco.mx` (`mailto:ordenes@birriaelmuneco.mx`). En Molotes se restaura la línea de correo.
  - "Ver ubicación en Google Maps", enlazando a R-3.
- **R-7. Horario de Birria.** Sábado y domingo de 08:00 a 15:00; de lunes a viernes, cerrado. La sección de horarios y el pie coinciden con `restaurante/src/content/birria/hours.ts`.
- **R-8. Plataformas de pedido.**
  - Birria muestra exactamente tres: "WhatsApp / Sin comisiones" (enlace al bot), "Motomandados / Costo según distancia" (informativa) y "Recoger en sucursal / Pasa por tu pedido" (enlace a R-3).
  - Molotes añade "Recoger en sucursal / Pasa por tu pedido" (enlace a R-3) a sus dos plataformas actuales.
  - Ninguna cuadrícula queda con huecos a ningún ancho.
- **R-9. Botón del club de Birria.** Dice exactamente "Activar promoción".
- **R-10. Bot.**
  - La respuesta "Horario y ubicación" usa la ubicación de R-3 para ambos negocios.
  - La opción "Recoger en sucursal" del bot se mantiene.
- **R-11. Documentación.** El README refleja la ubicación única, el teléfono y el correo comunes y las plataformas.

## Texto editorial aprobado (Birria, `restaurante/src/content/birria/index.ts`)

| Campo | Texto |
|---|---|
| `name` | Birria El Muñeco |
| `seo.title` | Birria El Muñeco \| Birria de Res Estilo Los Altos de Jalisco |
| `seo.description` | Birria de res estilo de Los Altos de Jalisco, de cocción lenta y con consomé caldosito. Sábados y domingos de 8:00 a 15:00. Pide por WhatsApp y te la llevamos hasta tu puerta. |
| `images.logo.alt` | Birria El Muñeco |
| `images.ritual.alt` | Quesabirrias con su consomé |
| `brand.tagline` | Birria de Res Estilo Los Altos |
| `nav` (etiquetas, mismos destinos) | Inicio · Menú de Birria · Quesabirrias & Consomé · Nuestra Birria · Ubicación |
| `hero.eyebrow` | Estilo Los Altos de Jalisco |
| `hero.titleLead` / `hero.titleHighlight` | Birria de res bien perrona y / Quesabirrias de Rechupete |
| `hero.description` | ¡Raza, aquí el antojo se pone serio! Birria de res estilo de Los Altos de Jalisco, de cocción lenta, con carne suavecita y consomé caldosito para que no dejes ni una gota. |
| `hero.secondaryCta.label` | Conoce Nuestra Birria |
| `hero.badges` | ① «Cocción lenta» / «Con paciencia» (icono `local_fire_department`) ② «Consomé» / «Caldosito» (`soup_kitchen`) ③ «Sáb y Dom» / «8:00 a 15:00» (`calendar_month`) |
| `menu.eyebrow` / `menu.title` | Nuestro Menú / Menú de Birria El Muñeco |
| `menu.description` | Birria de res de cocción lenta con su consomé para chopear sin pena. Escoge tu antojo y pídelo con todo. |
| `menu.orderBanner.title` | Haz tu pedido por WhatsApp |
| `menu.orderBanner.description` | Escríbenos, arma tu pedido y te confirmamos el total. Sin comisiones. |
| `ritual.eyebrow` / `ritual.title` | Nuestra Birria / Lumbre bajita y paciencia de la buena |
| `ritual.intro` (before / strong / after) | «En » / «Birria El Muñeco» / « preparamos birria de res estilo de Los Altos de Jalisco con cocción lenta, sin prisas y con mucho cariño.» |
| `ritual.body` | El resultado: carne suavecita que se deshace sola y un consomé caldosito para chopear con todo. Nomás sábados y domingos, así que no te quedes con las ganas. |
| `ritual.method` (label / title) | Preparación / Cocción lenta |
| `ritual.steps` | ① «1. Sin prisas»: «Cocción lenta para que la carne quede suavecita.» (`schedule`) ② «2. A chopear»: «Consomé caldosito para que no dejes ni una gota.» (`soup_kitchen`) |
| `ritual.metrics` | ① «1» / «Sucursal» ② «Sáb y Dom» / «Días de birria» ③ «A domicilio» / «Por motomandados» |
| `ritual.quote` (text / author) | "Aquí la birria no se apura: lumbre bajita, paciencia y antojo del bueno." / — Birria El Muñeco |
| `locations.eyebrow` / `locations.title` | A domicilio o en la sucursal / Visítanos o pide por WhatsApp |
| `locations.description` | Sábados y domingos el consomé está listo desde las 8 de la mañana. Pide por WhatsApp o date una vuelta por la sucursal. |
| `locations.schedule.title` | Horario de servicio |
| `locations.schedule.slots[0]` | Sábado y Domingo / 08:00 AM – 03:00 PM / Birria, consomé y quesabirrias para el antojo del finde. |
| `locations.schedule.slots[1]` | Lunes a Viernes / Cerrado / De martes a viernes te esperan nuestros Molotes. |
| `locations.branches.title` / `badge` | Nuestra Sucursal / Pasa por tu pedido |
| `locations.branches.items` | Una sola entrada: «Birria El Muñeco» / «Consulta la ubicación en el mapa.» |
| `locations.branches.mapLabel` | Abrir en Google Maps |
| `locations.delivery.title` | Te la llevamos a tu puerta |
| `locations.delivery.description` | Pide por WhatsApp y te llevamos tu birria hasta la puerta con motomandados. El costo del envío depende de la distancia; te lo decimos al hacer tu pedido. |
| `locations.delivery.platforms` | WhatsApp / Sin comisiones · Motomandados / Costo según distancia · Recoger en sucursal / Pasa por tu pedido |
| `locations.club.submit` | Activar promoción |
| `locations.club.success` | ¡Listo! Pregunta por la promoción vigente al pedir por WhatsApp. |
| `locations.club.disclaimer` | Sin spam. Solo antojo y promociones reales. |
| `footer.about.text` | Birria de res estilo de Los Altos de Jalisco, de cocción lenta, con carne suavecita y consomé caldosito. ¡Para chuparse los dedos! |
| `footer.about.guarantee` | Hecha con paciencia |
| `footer.hours.title` | Horario |
| `footer.hours.rows` | ① Lunes: / Cerrado ② Sábados y Domingos: / 08:00 - 15:00 (la fila destacada) ③ Martes a Viernes: / Hay Molotes |
| `footer.contact.title` | Contacto y pedidos |
| `footer.contact` | +52 735 278 2306 (`tel:+527352782306`) · ordenes@birriaelmuneco.mx · Ver ubicación en Google Maps |
| `footer.secret` (title / text / badgeTitle / badgeText) | El Consomé / Caldosito, calientito y listo para chopear tus quesabirrias sin pena. / Consomé para chopear / Pídelo con tu orden por WhatsApp. |
| `footer.copyright` | © 2026 Birria El Muñeco. Todos los derechos reservados. |
| Sin cambios | `cta.label` («Ordenar ya!»), `homeNotices`, `club.inputLabel`, `club.placeholder`, `footer.legal`, `icons` |

## Historias de usuario

- **HU-1.** Como cliente, quiero información cierta y antojable sobre la birria, para pedir sin falsas expectativas.
- **HU-2.** Como cliente, quiero los mismos datos de contacto y ubicación en ambas páginas y en el bot, para llegar o llamar sin confusiones.

## Criterios de aceptación

- **CA-1.** El texto visible y los metadatos (title, description, Open Graph y alt) de `/` y `/birria` no contienen ninguno de estos términos: "tatemad", "horno", "olla", "pozo", "maguey", "barro", "brasa", "leña", "presión", "térmic", "Uber", "Rappi", "Sucursales", "Años de Tradición", "4.9", "Opiniones", "14 Horas", "24 horas", "1.8k", "Maestro", "2x1", "2×1", "Birriería", "Tapatía", "Ribera de San Cosme", "Narvarte", "Coyoacán", "4123-9080", "Estacionamiento", "2024". Excepción: el contenido editable de /admin y los productos de MySQL (fuera de alcance; ver pendientes) se excluyen de esta comprobación. La prueba se hace con contenido de prueba controlado o con la semilla neutralizada.
- **CA-2.** `/birria` contiene "Los Altos de Jalisco" y "cocción lenta", y cada campo de la tabla editorial muestra el texto aprobado.
- **CA-3.** `/`, `/birria` y `/molotes` contienen `tel:+527352782306` y `mailto:ordenes@birriaelmuneco.mx`, y no contienen ningún otro `tel:` ni `mailto:`.
- **CA-4.** Ninguna de las tres rutas contiene `maps.app.goo.gl`. La respuesta "Horario y ubicación" del bot, para ambos negocios, contiene el enlace de R-3.
- **CA-5.** `/` y `/birria` tienen exactamente un iframe con el `src` oficial, el `title` "Ubicación de Birria El Muñeco en Google Maps" y `loading="lazy"`. No hay errores de CSP y la política es idéntica a la actual.
- **CA-6.** Las plataformas cumplen R-8:
  - Birria tiene exactamente sus tres plataformas y Molotes tiene las suyas más "Recoger en sucursal".
  - Los enlaces externos abren en otra pestaña, con `rel="noopener noreferrer"` y su texto de apoyo.
  - A 320, 768 y 1280 px no hay huecos en la cuadrícula ni desbordamiento horizontal.
- **CA-7.** El horario de la sección y del pie de `/birria` coincide con R-7.
- **CA-8.** El botón del club de Birria dice exactamente "Activar promoción", y ningún botón de ambas landings contiene "2x1" ni "2×1".
- **CA-9.** No hay regresiones:
  - El aviso de `/`, el resto del contenido de Molotes, los productos y /admin no cambian.
  - Las pruebas de REQ-F-031 que fijaban decisiones revertidas (CA-4 "sin correo en Molotes" y CA-7 "enlace corto común") se actualizan a la regla nueva; no se eliminan.
  - `npm run typecheck`, `npm run lint` y `npm test` terminan en 0.
  - Los snapshots de ambas landings se regeneran y su diff se revisa.

## Casos límite

- El mapa embebido es pesado en móvil: se carga de forma diferida.
- Sin JavaScript, la página se ve igual (todo el contenido es estático).
- El bot está desactivado en producción: R-10 no tiene efecto visible hoy, pero se prueba.
- Se mantienen dos datos distintos: el WhatsApp del bot (configuración) y el teléfono de llamadas.

## Dependencias

- Ninguna previa. REQ-F-033 y REQ-F-034 van después.

## Riesgos

- Tono demasiado caricaturesco: se mitiga con el texto aprobado campo por campo.
- Producción seguirá mostrando la promoción y las descripciones de productos de /admin y MySQL hasta que se corrijan (ver pendientes).
- La correspondencia entre el dominio del sitio (`.com`) y el del correo (`.mx`) fue confirmada por el usuario (V-1).

## Decisión por defecto (V-3)

El usuario no eligió explícitamente cómo tratar la promoción editable de Birria. Por coherencia con su decisión de dejar fuera de alcance MySQL y /admin, la promoción de /admin (badge "Club El Muñeco", "Domingos de Birria Familiar", "2x1" y tortillas ilimitadas) queda **pendiente** en `.claude/docs/pendientes.md` y **no** es un paso manual de este ticket. Este ticket solo cambia el botón, el mensaje de éxito y el aviso legal del club, que viven en el código.

## Action Plan

### Objetivo
Birria veraz y con la voz de marca, con los mismos datos de sucursal que Molotes y el bot.

### Cambios requeridos
1. Unificar la fuente de la ubicación (enlace y mapa) para ambas landings y el bot, sin duplicarla.
2. Aplicar la tabla editorial.
3. Sustituir las tres sucursales por una sola con mapa embebido.
4. Contacto común (teléfono y correo) en ambos pies.
5. Plataformas de R-8 en ambas landings.
6. Actualizar las pruebas: las nuevas de CA-1 a CA-8 y las de REQ-F-031 afectadas. Regenerar snapshots.
7. Actualizar el README.

### Orden recomendado
Datos comunes → textos → plantillas → pruebas → documentación.

### Resultado esperado
`/`, `/birria`, `/molotes` y el bot coherentes y sin afirmaciones no confirmadas en el contenido del código.

## Trazabilidad

| Respuesta del usuario | Decisión | Requisitos | Criterios |
|---|---|---|---|
| Regla semanal "1 a" | Se mantiene CLAUDE.md (Birria sábado y domingo) | R-7 | CA-7 |
| Ubicación "6 a" | Misma sucursal, ubicación de Molotes con mapa | R-3, R-4, R-5 | CA-4, CA-5 |
| Bot "7 si" | El bot usa la ubicación única | R-10 | CA-4 |
| Teléfono "9 si" | +52 735 278 2306 en Birria | R-6 | CA-3 |
| Correo "8 usa ordenes@birriaelmuneco.mx para ambas paginas, no ocultes" + V-1 | Correo en ambos pies | R-6 | CA-3 |
| Recoger "10 si" + V-2 | Recoger en sucursal en ambas landings | R-8, R-10 | CA-6 |
| Horario "12" (sí) | Sábado y domingo 08:00–15:00 | R-7 | CA-7 |
| Promoción "11 a de momento y si cambia" | Botón "Activar promoción", texto genérico en el código | R-9 | CA-8 |
| MySQL y /admin "14" (fuera de alcance) + V-3 por defecto | Productos, showcase y promoción editables quedan pendientes | Fuera de alcance | — |
| Textos de proceso de Molotes "16 a" | Se conservan | Fuera de alcance | CA-9 |
| Nombre "17 a" | Birria El Muñeco | R-1 | CA-1, CA-2 |
| Tres tickets "19 b" | Serie 032 → 033 → 034 | — | — |
| V-4 | Se aceptan las reversiones de REQ-F-031 | R-3, R-6 | CA-9 |
| Aprobación "si" | Tabla editorial aprobada | R-2 | CA-2 |

Objetivo → R-1 a R-11 → HU-1, HU-2 → CA-1 a CA-9 → diseño (`_stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/`; el mapa embebido y la sucursal única son diferencias deliberadas) → Action Plan.

## Technical Action Plan

### Objetivo técnico

Aplicar la tabla editorial a `birriaContent`, dejar una sola fuente de ubicación (enlace y mapa embebido) y de contacto (teléfono y correo) en `commonContent`, que leen Birria, Molotes y el bot, y ajustar solo las plantillas de sucursal, plataformas y contacto del pie. Sin cambios en la CSP, dependencias, variables de entorno, MySQL ni /admin (funcionalmente).

### Hallazgos de la revisión técnica

- **H-1. La ubicación ya tiene fuente común.** `commonContent.location.mapsUrl` (enlace corto) la usan Birria (`location.mapsUrl`) y el bot (`hoursAndLocation` en `src/services/whatsapp-bot/messages.ts`). Molotes tiene una copia propia (`molotesContent.location`, REQ-F-031). Unificar = mover `mapsUrl` y `embedSrc` de Molotes a `commonContent.location` y borrar la copia. El bot queda cubierto sin tocar su código.
- **H-2. El nombre se propaga solo (decisión DT-1).** `birriaContent.name` alimenta también el bot (`birriaBot.name` → saludo, menú, "fue enviado a…", parámetro `negocio` de la plantilla del personal) y /admin (`businessName()` en `src/views/admin/index.ts`: títulos y avisos como "No tienes permiso para administrar …"). Cambiarlo a "Birria El Muñeco" cambia esos textos. Es coherente con R-1 y RN-3 (un solo nombre en todas partes) y con no duplicar datos; el comportamiento de /admin no cambia (CA-9). La plantilla aprobada de Meta recibe el nombre como parámetro libre: no requiere reaprobación.
- **H-3. CSP.** `frame-src https://www.google.com` ya es global (`src/app.ts`), así que el iframe de Birria no requiere ningún cambio en la política. Solo se actualiza el comentario.
- **H-4. Horarios.** `tests/unit/business-hours.test.ts` interpreta las filas de horario. Las filas nuevas ("Lunes:" / "Cerrado", "Sábados y Domingos:" / "08:00 - 15:00", "Martes a Viernes:" / "Hay Molotes") lo cumplen: una fila sin horas es una fila cerrada, y los días que cubren las tres filas no se repiten y suman la semana.
- **H-5. CA-1 y la semilla.** La semilla de Birria (`seed.json`: productos, showcase y promoción) contiene "tatemad", "olla" (en "cebolla"), "brasa" y "2x1". Están fuera de alcance, así que la prueba de CA-1 renderiza con el showcase y el club neutralizados y sin productos.

### Decisiones técnicas incluidas en este plan (aprobar el plan las aprueba)

- **DT-1.** El nombre "Birria El Muñeco" sale de `birriaContent.name` y se propaga al bot y a /admin (H-2). No se crea un segundo campo de nombre.
- **DT-2. Cuadrícula de plataformas sin huecos.** Se conservan las 2 columnas del diseño (`grid-cols-2`, ya probadas a 320 px) y la tercera casilla, "Recoger en sucursal", ocupa la fila completa (`col-span-2`), en Birria y en Molotes. Así no queda ningún hueco a ningún ancho y no se reduce el ancho de las casillas. La alternativa son 3 columnas desde `sm`, pero aprieta los textos en la columna `lg:col-span-5` de Birria.
- **DT-3. Mapa de Birria.** El enlace con la textura `fondo-birria.jpg` (`branches-card__map`) se sustituye por un iframe `aspect-video` con el mismo marco y la misma paleta de la tarjeta. Debajo va el enlace "Abrir en Google Maps" (`mapLabel`), con el patrón de Molotes (enlace fuera del iframe, nunca superpuesto). Es una diferencia deliberada con `_stich_source_/`, que ya prevé el ticket.
- **DT-4.** El enlace "Cómo llegar" de la sucursal usa la etiqueta común `common.location.label` ("Cómo llegar") y se elimina `branches.directionsLabel` ("Cómo Llegar"). En pantalla se ve igual, porque la etiqueta va en mayúsculas.
- **DT-5.** El texto de apoyo de los enlaces cuyo texto visible ya dice "Google Maps" es "(se abre en una pestaña nueva)", como el del pie de Molotes (REQ-F-031). Pasa a ser común.

### Archivos o componentes afectados

- `restaurante/src/content/common/index.ts`: ubicación y contacto comunes.
- `restaurante/src/content/birria/index.ts`: tabla editorial, sucursal única, plataformas, pie.
- `restaurante/src/content/molotes/index.ts`: se elimina `location` y el contacto propio; se añade la plataforma "Recoger en sucursal" y el `title` del mapa.
- `restaurante/src/views/pages/birria.html`: mapa embebido, plataformas, contacto del pie.
- `restaurante/src/views/pages/molotes.html`: referencias a la ubicación común, tercera plataforma, línea de correo.
- `restaurante/src/views/partials/birria/branch.html`: etiqueta común (DT-4).
- `restaurante/src/views/landings/birria.ts`: `renderBranches` (etiqueta común; comentario de la "matriz").
- `restaurante/src/app.ts`: solo el comentario de la CSP.
- Pruebas: `tests/integration/app.test.ts`, `tests/unit/content.test.ts`, `tests/unit/business-hours.test.ts` (si se añade la línea del badge), pruebas del bot y `tests/fixtures/bot-golden/template.json` (DT-1), `tests/integration/admin-authorization.test.ts` (DT-1), snapshots `tests/snapshots/landing-{birria,molotes}.html`.
- `restaurante/README.md`.

Sin cambios: `src/services/whatsapp-bot/*` (el bot ya lee la fuente común), `src/content/hours.ts`, `homeNotices`, `seed.json`, productos, `public/js`, `src/styles` (salvo regenerar el CSS por las clases nuevas), `.env.example`.

### Cambios requeridos

**Contenido / configuración**

1. `commonContent.location` queda así:
   - `mapsUrl`: `https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853`.
   - `embedSrc`: el `src` oficial de REQ-F-031, movido desde Molotes.
   - `label` ("Cómo llegar") y `assistiveText` se conservan.
   - Nuevo `newTabText`: "(se abre en una pestaña nueva)" (DT-5).
   - El comentario indica que es la única sucursal (RN-3) y que el origen del iframe es el único de `frame-src`.
2. Nuevo `commonContent.contact`:
   - `phone`: `{ label: '+52 735 278 2306', href: 'tel:+527352782306' }`.
   - `email`: `{ label: 'ordenes@birriaelmuneco.mx', href: 'mailto:ordenes@birriaelmuneco.mx' }`.
   - `mapLabel`: "Ver ubicación en Google Maps".
   - Un comentario aclara que el teléfono es el de llamadas y no el WhatsApp del bot (RN-6).
3. `molotesContent`:
   - Se elimina `location`.
   - `service.mapTitle`: "Ubicación de Moloteando en Google Maps" (el título de cada mapa es propio de cada negocio).
   - `service.platforms` añade `{ name: 'Recoger en sucursal', note: 'Pasa por tu pedido' }`.
   - `footer.contact` queda solo con `title` ("Contacto y ubicación"); salen `address`, `addressAssistiveText` y `phone`.
   - El resto del contenido de Molotes no cambia (CA-9).
4. `birriaContent`: cada campo de la tabla editorial, literal. Además:
   - `locations.branches.items` con una sola entrada `{ name: 'Birria El Muñeco', address: 'Consulta la ubicación en el mapa.' }`.
   - `branches.mapTitle`: "Ubicación de Birria El Muñeco en Google Maps".
   - Se elimina `directionsLabel` (DT-4).
   - `locations.delivery.platforms` con las 3 entradas.
   - `footer.contact` queda solo con `title` ("Contacto y pedidos").
   - Se actualizan los comentarios que dicen "Birriería".
   - Sin cambios: `cta`, `homeNotices`, `club.inputLabel`, `club.placeholder`, `footer.legal`, `icons`.

**Frontend (plantillas)**

5. `birria.html`, sucursal:
   - El `<a class="branches-card__map">` se sustituye por `div.branches-card__map`, que contiene:
     - el marco `branches-card__map-frame aspect-video overflow-hidden rounded-xl border border-[#9b1e1e]` con `<iframe src="{{ location.embedSrc }}" title="{{ c.locations.branches.mapTitle }}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>`, igual que Molotes;
     - el enlace `branches-card__map-link` (icono `pin_drop`, `mapLabel`, `sr-only` con `newTabText`, `target="_blank"`, `rel="noopener noreferrer"`, `data-action="open-map"`, foco visible).
   - El `<ol>` conserva un solo `<li>` (número 1 destacado) con "Cómo llegar".
6. `birria.html`, plataformas:
   - Casillas: WhatsApp (sin cambios), Motomandados (informativa, `<li>` sin enlace, icono `moped` como en Molotes) y Recoger en sucursal (`<a>` a `location.mapsUrl`, icono `shopping_bag`, con su texto de apoyo, en `col-span-2`).
   - Se eliminan las casillas `platforms.2` y `platforms.3` antiguas.
7. `birria.html`, pie:
   - El teléfono y el correo salen de `common.contact`.
   - La ubicación sale de `common.contact.mapLabel`, con `common.location.newTabText` como texto de apoyo.
8. `molotes.html`:
   - `c.location.*` pasa a `location.*`; el `title` del iframe sale de `c.service.mapTitle`.
   - Nueva tercera plataforma (`<a>` a `location.mapsUrl`, icono `storefront`, `col-span-2`, texto de apoyo).
   - Pie:
     - la ubicación usa `common.contact.mapLabel` y `newTabText`;
     - el teléfono sale de `common.contact.phone`;
     - se añade el `<li>` del correo (icono `mail`, mismo estilo que el teléfono).
9. `branch.html` y `renderBranches` usan `location.label` (DT-4).

**Backend**: ningún cambio de lógica. El bot obtiene R-3 por H-1. `app.ts` solo cambia el comentario.

### Validaciones

- Sin entradas nuevas: todo el contenido es estático y se escapa con `{{ }}`.
- `content.test.ts` comprueba que `mapsUrl` y `embedSrc` son https de `www.google.com` con las coordenadas oficiales y que `tel:`/`mailto:` coinciden con su etiqueta (los mismos dígitos y el mismo correo).

### Manejo de errores

Sin cambios. Si una plantilla referencia una clave eliminada, el renderizador falla rápido ("Falta el valor…"), y las pruebas de renderizado lo detectan.

### Testing

Nuevas pruebas, en un `describe('REQ-F-032 …')` de `tests/integration/app.test.ts`, salvo que se indique otro archivo:

- **CA-1.** Se renderiza `/` (con aviso de martes y de lunes) y `/birria` con `renderLandingPage`, con la semilla neutralizada: sin platillos, y con el showcase y el club con textos neutros (H-5). En el texto visible (sin `<svg>`) y en `<title>`, `meta[name=description]`, `og:*` y los `alt`, no debe aparecer ninguno de los 31 términos, sin distinguir mayúsculas.
- **CA-2.** `/birria` contiene "Los Altos de Jalisco" y "cocción lenta". Cada campo de la tabla se compara con el texto publicado en su elemento (seo, alt, nav, hero, badges, menú, ritual, métricas, cita, ubicaciones, horarios, sucursal, entrega, club y pie).
- **CA-3.** En `/`, `/birria` y `/molotes`, el conjunto de `href` que empiezan por `tel:` es exactamente `{tel:+527352782306}` y el de `mailto:` es `{mailto:ordenes@birriaelmuneco.mx}`.
- **CA-4.**
  - Ninguna de las tres rutas contiene `maps.app.goo.gl`.
  - `hoursAndLocation('molotes')` y `hoursAndLocation('birria')` contienen la URL de R-3.
  - Además, una conversación del bot ("3" en la raíz) contiene esa URL.
- **CA-5.**
  - `/` y `/birria` tienen exactamente un iframe, dentro de `#ubicaciones-pedidos`, con el `src` oficial, el `title` aprobado y `loading="lazy"`.
  - La prueba de CSP de REQ-F-031 (CA-11) amplía sus rutas a `/birria`, con la misma política esperada (CA-5: idéntica).
- **CA-6.**
  - Birria tiene 3 casillas en el orden y con los textos de R-8.
  - Molotes tiene 3 (las dos actuales más "Recoger en sucursal").
  - Los enlaces externos llevan `target="_blank"`, `rel="noopener noreferrer"` y `.sr-only`.
  - La última casilla tiene `col-span-2` y la lista `grid-cols-2`.
  - La parte visual (320, 768 y 1280 px sin huecos ni desbordamiento) se verifica en el navegador durante QA: jsdom no calcula el layout.
- **CA-7.** El horario de la sección y del pie coincide con R-7 (filas y notas exactas). La coherencia con `hours.ts` la cubre `business-hours.test.ts`, que sigue pasando sin cambios. Se añade a sus `lines` el badge "Sáb y Dom 8:00 a 15:00" si el intérprete reconoce "Sáb y Dom"; si no, se comprueba por texto exacto en `app.test.ts`.
- **CA-8.**
  - El botón del club dice exactamente "Activar promoción".
  - Ningún `<button>` ni `<a>` de `/`, `/birria` y `/molotes` contiene "2x1" ni "2×1". El botón y los enlaces vienen del código; la insignia y el título de la promoción salen de /admin y quedan fuera de esta comprobación (V-3).

Pruebas que se actualizan (no se borran):

- `app.test.ts`:
  - **REQ-F-031 CA-3 y CA-4** pasa a "el pie lleva el teléfono y el correo comunes".
  - **REQ-F-031 CA-5 y CA-6**: el `title` y los enlaces de Molotes ahora son tres, porque se suma "Recoger en sucursal"; la URL es la misma.
  - **REQ-F-031 CA-7** pasa a "/ y /birria usan la ubicación única con mapa; el bot envía R-3".
  - **REQ-F-031 CA-8**: 3 casillas.
  - **REQ-F-010 CA-2 (D-8)** y **CA-5 (sábado)**: textos nuevos de los horarios.
  - "GET /birria: contenido del diseño" (las "sucursales" pasan a ser una, con la nueva URL).
  - `PAGES.birria.title` cambia.
  - `PAGES.molotes.other` pasa de "Birriería" a un término exclusivo de Birria (p. ej. "Quesabirrias & Consomé"), porque Molotes ya nombra "Birria El Muñeco".
- `content.test.ts`: el host de la ubicación común y la prueba R-15 de Molotes pasan a `commonContent.location`.
- Bot (DT-1): las aserciones con "Birriería El Muñeco" en `whatsapp-bot-conversation`, `whatsapp-bot-free-text`, `chat-bot-message-count`, `whatsapp-bot-qa-req-f-013` y `fixtures/bot-golden/template.json` (6 apariciones) cambian a "Birria El Muñeco", y `maps.app.goo.gl` (línea 378) pasa a la URL de R-3. Las pruebas de `normalizeInput` y Twilio que usan "Birriería" como texto de entrada no cambian.
- `admin-authorization.test.ts` (DT-1): el texto del aviso.
- Snapshots: `npx vitest run -u tests/unit/landing-snapshot.test.ts tests/integration/landing-products.test.ts`. Se revisa el diff completo de `tests/snapshots/landing-{birria,molotes}.html`: solo deben cambiar los textos, la sucursal, el mapa, las plataformas y el contacto.

Comandos: `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (con `npm run db:up`).

### Seguridad

- No se añaden orígenes a la CSP. El iframe usa `referrerpolicy="strict-origin-when-cross-origin"`, como el de Molotes.
- Los enlaces externos llevan `rel="noopener noreferrer"`.
- Los enlaces de WhatsApp siguen saliendo solo de `src/services/whatsapp.ts`.
- Ningún dato nuevo va a los logs. El teléfono y el correo son públicos por decisión del usuario.

### Performance

- El iframe se carga con `loading="lazy"`, dentro de la sección de ubicaciones, por debajo del pliegue.
- Desaparece una petición de imagen (`fondo-birria.jpg` en la tarjeta, si no se usa en otro sitio de la página; en el diff del snapshot se verifica si sigue referenciada).
- Sin JavaScript nuevo.

### Riesgos técnicos

- **DT-1** cambia textos visibles del bot y de /admin. Hay que revisar las pruebas del bot en conjunto (golden incluido).
- El aviso de `/` (modal) y el iframe conviven sin problema: el `<dialog>` va en la capa superior.
- REQ-F-033 añadirá su enlace en la columna de marca del pie, no en la de contacto: no hay conflicto. REQ-F-034 toca `molotes.html` y el contenido de Molotes en otras zonas. Mover el contacto a `common` no les cierra el camino.
- Producción seguirá mostrando la promoción y los productos de /admin y MySQL con textos no veraces (pendientes ya registrados).
- Al final, `fondo-birria.jpg` podría quedar sin uso en la tarjeta. Solo se elimina el asset si ya no se referencia en ningún sitio (`.claude/rules/assets.md`); si no, se conserva.

### Orden de implementación

1. Contenido común (ubicación y contacto) y Molotes.
2. `molotes.html`.
3. Contenido de Birria (tabla editorial).
4. `birria.html`, `branch.html` y `birria.ts`.
5. Comentario de la CSP.
6. `build:css`.
7. Pruebas nuevas y actualizadas.
8. Snapshots y revisión de su diff.
9. README: ubicación única con mapa en ambas landings, contacto común, plataformas, nombre y la sección "Diferencias deliberadas con el diseño fuente" (el mapa de Birria deja de ser la textura; Molotes ya muestra correo).
10. Typecheck, lint y test.

### Criterios de finalización

- CA-1 a CA-9 cubiertos por pruebas automatizadas, salvo la parte visual de CA-6, que se verifica en el navegador en QA.
- `npm run typecheck`, `npm run lint` y `npm test` terminan en 0.
- Diff de los snapshots revisado, sin cambios ajenos.
- `git diff` limitado a los archivos listados.

## Implementation Result

### Rama

`feature/REQ-F-032-veracidad-birria-unificacion-contacto` (desde `main` actualizado; sin commits).

### Cambios realizados

- **Fuente única** en `src/content/common/index.ts`:
  - `location` contiene `mapsUrl` (R-3), `embedSrc` (movido desde Molotes), `label`, `assistiveText` y `newTabText`.
  - `contact` contiene el teléfono, el correo y `mapLabel`.
  - Se eliminaron `molotesContent.location` y el contacto propio de cada pie: `footer.contact` solo conserva su `title`.
  - El bot obtiene R-3 sin cambios de código (`hoursAndLocation`).
- **Birria** (`src/content/birria/index.ts`): tabla editorial completa. Además, una sola sucursal, `mapTitle`, tres plataformas y el pie nuevo. Se eliminó `directionsLabel` (DT-4).
- **Molotes** (`src/content/molotes/index.ts`): plataforma "Recoger en sucursal" y `service.mapTitle`. El resto de los textos no cambia.
- **Plantillas**:
  - `birria.html`:
    - mapa embebido `aspect-video` con el enlace "Abrir en Google Maps" debajo (DT-3);
    - plataformas WhatsApp, Motomandados y Recoger en sucursal (`col-span-2`, DT-2);
    - pie con `common.contact`.
  - `molotes.html`: ubicación común, tercera plataforma `col-span-2` y línea del correo en el pie.
  - `landings/birria.ts`: "Cómo llegar" con la etiqueta común.
- **Nombre "Birria El Muñeco"** (DT-1): se propaga al bot y a /admin desde `birriaContent.name`. También se actualizaron los comentarios que decían "Birriería" (`bot.ts`, `hours.ts`, `main.css`, `routes/index.ts`, `public/js/birria/main.js`) y el README.
- **CSP**: sin cambios; solo se actualizó el comentario en `src/app.ts`.
- **README**: ubicación y contacto únicos, plataformas, diferencias deliberadas con el diseño y nombre.

### Criterios de aceptación

| CA | Estado | Prueba |
|---|---|---|
| CA-1 | Cumple | `tests/unit/birria-veracity.test.ts` (/ lunes, / martes, /birria; texto visible, title, description, OG y alt; semilla neutralizada) |
| CA-2 | Cumple | `birria-veracity.test.ts` (cada texto de la tabla publicado; SEO, alt, nav, badges, pasos y métricas) |
| CA-3 | Cumple | `app.test.ts` › REQ-F-032 › CA-3 (/, /birria, /molotes) |
| CA-4 | Cumple | `app.test.ts` › REQ-F-032 › CA-4 (sin `maps.app.goo.gl`; el bot envía R-3 para ambos negocios) y `whatsapp-bot-conversation` (opción 3) |
| CA-5 | Cumple | `app.test.ts` › REQ-F-032 › CA-5 (/ lunes, martes y sábado; /birria) y la prueba de CSP de REQ-F-031 (CA-11) ampliada a /birria con la misma política |
| CA-6 | Cumple, salvo la parte visual | `app.test.ts` › CA-6 (Birria) y REQ-F-031 CA-8 (Molotes). La verificación visual a 320, 768 y 1280 px queda para QA en el navegador |
| CA-7 | Cumple | `app.test.ts` › CA-7, REQ-F-010 CA-2 actualizada y `business-hours.test.ts` (sin cambios, pasa) |
| CA-8 | Cumple | `birria-veracity.test.ts` (botón) y `app.test.ts` › CA-8 (ningún botón ni enlace con 2x1 en las 3 rutas) |
| CA-9 | Cumple | REQ-F-031 CA-3/4, CA-5/6, CA-7 y CA-8 actualizadas, no borradas; snapshots regenerados y revisados; typecheck, lint y test en 0 |

### Validaciones ejecutadas

- `npm run build:css`: OK.
- `npm run typecheck`: código 0.
- `npm run lint`: código 0 (0 errores, 0 avisos).
- `npm test`: 90 archivos, 1812 pruebas aprobadas y 1 fallo esperado (ya existente), código 0.
- Snapshots regenerados con `npx vitest run -u tests/unit/landing-snapshot.test.ts tests/integration/landing-products.test.ts`.
  - Molotes (+9 líneas): solo la casilla "Recoger en sucursal" y la línea del correo.
  - Birria (−119/+101): solo los textos de la tabla, la sucursal única, el mapa embebido, las plataformas, el contacto y el copyright.
  - Sin cambios ajenos.

### Archivos afectados

- `restaurante/src/content/common/index.ts`
- `restaurante/src/content/birria/index.ts`
- `restaurante/src/content/molotes/index.ts`
- `restaurante/src/views/pages/birria.html`
- `restaurante/src/views/pages/molotes.html`
- `restaurante/src/views/landings/birria.ts`
- `restaurante/src/app.ts` (comentario)
- Comentarios: `src/content/birria/bot.ts`, `src/content/birria/hours.ts`, `src/styles/birria/main.css`, `src/routes/index.ts`, `public/js/birria/main.js`
- `restaurante/README.md`
- Pruebas:
  - nueva: `tests/unit/birria-veracity.test.ts`;
  - actualizadas: `tests/integration/app.test.ts`, `tests/unit/content.test.ts`, `tests/unit/whatsapp-bot-conversation.test.ts`, `tests/unit/whatsapp-bot-free-text.test.ts`, `tests/integration/chat-bot-message-count.test.ts`, `tests/integration/whatsapp-bot-qa-req-f-013.test.ts`, `tests/integration/admin-authorization.test.ts`, `tests/fixtures/bot-golden/template.json`;
  - snapshots: `tests/snapshots/landing-{birria,molotes}.html`.

### Riesgos o pendientes

- **Desviaciones menores del plan:**
  - CA-1 y CA-2 viven en un archivo unitario nuevo (`birria-veracity.test.ts`, que renderiza con `renderLandingPage`) en lugar de `app.test.ts`.
  - Se actualizaron también los comentarios con "Birriería" de archivos que no se iban a tocar.
  - No se añadió el badge "Sáb y Dom" a `business-hours.test.ts`: lo cubre CA-2 por texto exacto.
- `fondo-birria.jpg` se conserva: se sigue usando como textura en otras secciones.
- La verificación visual de CA-6 (320, 768 y 1280 px, sin huecos ni desbordamiento) se hace en QA en el navegador.
- En producción, la insignia, el título y la descripción del club ("Club El Muñeco", "2x1") y los productos siguen saliendo de /admin y MySQL (pendientes registrados, V-3).

### Correcciones de la ronda 1 de QA (QA_REJECTED)

El usuario eligió corregir los cuatro defectos ("Los cuatro defectos"). Solo cambiaron utilidades de Tailwind en las plantillas; los textos aprobados no se tocaron.

- **DEF-001** (plataformas de Birria a 320 px). Por debajo de `sm`, cada casilla va en columna, con el icono arriba (`flex-col items-start gap-1.5`), como en Molotes. Desde `sm` vuelve a ir en fila (`sm:flex-row sm:items-center sm:gap-2.5`). La cuadrícula de 2 columnas y `col-span-2` no cambian.
- **DEF-002** (métricas del ritual).
  - Columnas: `grid-cols-1 sm:grid-cols-3`, como las métricas de Molotes.
  - Tamaño del valor: `text-3xl`, `sm:text-2xl`, `lg:text-xl` y `xl:text-2xl`.
  - La medición también detectó un desborde de "A domicilio" a 1024 px, que se corrigió con `lg:text-xl`.
- **DEF-003** (insignias del hero).
  - Sin cambios: siguen siendo 3 columnas.
  - Espaciado: `gap-2 sm:gap-3` y `p-2.5 sm:p-3.5`.
  - Tamaño del valor: `text-sm`, `min-[360px]:text-base` y `sm:text-xl`.
- **DEF-004** (icono de "Recoger en sucursal" en Molotes). El icono usa `text-primary` (`#acc7ff` sobre `#102038`), un token de la paleta de Molotes con contraste alto; antes era `text-[rgb(3,43,95)]`, con 1.18:1.

**Verificación en el navegador.** Se usó Chrome headless por CDP con el script `fix-measure.mjs` del scratchpad, a 320, 360, 375, 414, 640, 768, 1024, 1280 y 1440 px, en `/birria` y `/molotes`. Resultados:

- Ningún elemento de las insignias, las métricas ni las plataformas sale de su caja ni tiene contenido más ancho que ella.
- `scrollWidth` es igual a `clientWidth` en todos los anchos.
- Capturas en `scratchpad/fix/after/`: `badges-320.png`, `badges-375.png`, `metrics-320.png`, `metrics-375.png`, `plat-320.png`, `plat-375.png` y `molotes-plat-320.png`.

**Pruebas nuevas en `tests/integration/app.test.ts`.** Fijan las utilidades responsivas, porque jsdom no calcula el layout:

- "DEF-001 a DEF-003": plataformas, métricas e insignias de Birria.
- "DEF-004": el icono de Molotes.

**Validaciones de la ronda.**

- `npm run build:css`: OK.
- `npm run typecheck`: 0.
- `npm run lint`: 0.
- `npm test`: 90 archivos, 1814 pruebas aprobadas y 1 fallo esperado, código 0.
- Snapshots regenerados: entre rondas solo cambian clases, ningún texto.

## QA Action Plan

### Objetivo
Comprobar con evidencia que `/`, `/birria`, `/molotes` y el bot publican solo los textos aprobados y los datos de la única sucursal (ubicación R-3, mapa embebido, teléfono y correo), que las cuadrículas de plataformas no tienen huecos ni desbordamiento a ningún ancho y que no hay regresiones en el aviso de `/`, en Molotes, en el bot ni en /admin (DT-1).

### Requisito bajo prueba
R-1 a R-11, RN-1 a RN-6 y la tabla editorial aprobada de REQ-F-032 (versión 1), con las decisiones técnicas DT-1 a DT-5 aprobadas por el usuario.

### Criterios de aceptación (cada uno → pruebas que lo cubren)
| CA | Automatizada | Navegador / manual |
|---|---|---|
| CA-1 | `tests/unit/birria-veracity.test.ts` (/ lunes, / martes, /birria; semilla neutralizada). QA revisa que la lista de 31 términos de la prueba coincida literalmente con la del CA | F-3: `get_page_text` de `/birria` y `/` + metadatos; los términos que aparezcan solo en productos MySQL o en el club de /admin se anotan como observación (fuera de alcance, V-3) |
| CA-2 | `birria-veracity.test.ts` (cada campo de la tabla) | F-4: muestreo de textos visibles (hero, badges, ritual, métricas, horario, sucursal, entrega, club, pie) contra la tabla |
| CA-3 | `app.test.ts` › REQ-F-032 › CA-3 | F-5: listar `a[href^=tel:]` y `a[href^=mailto:]` en las 3 rutas con `javascript_tool` |
| CA-4 | `app.test.ts` › CA-4, `whatsapp-bot-conversation.test.ts` (opción 3) | F-6: `document.documentElement.outerHTML.includes('maps.app.goo.gl')` en las 3 rutas; `curl` de las 3 rutas con `grep -c maps.app.goo.gl` |
| CA-5 | `app.test.ts` › CA-5 y CSP de REQ-F-031 CA-11 ampliada | F-7: un iframe con `src`, `title` y `loading="lazy"`; el mapa carga; `read_console_messages` sin errores de CSP; comparación de la cabecera `Content-Security-Policy` de `/`, `/birria` y `/molotes` (con `curl -sI`) con el valor esperado de la prueba CA-11 de REQ-F-031 |
| CA-6 | `app.test.ts` › CA-6 y REQ-F-031 CA-8 | R-1 a R-3: cuadrícula de plataformas de ambas landings a 320, 768 y 1280 px (y 375×812, 768×1024, 1440×900), con capturas y medición de `scrollWidth` vs `clientWidth` y de las cajas de cada casilla |
| CA-7 | `app.test.ts` › CA-7, REQ-F-010 CA-2, `business-hours.test.ts` | F-8: texto de la sección de horarios y del pie de `/birria` |
| CA-8 | `birria-veracity.test.ts`, `app.test.ts` › CA-8 | F-9: texto del botón del club; búsqueda de "2x1"/"2×1" en `button` y `a` de las 3 rutas (la insignia y el título del club de /admin se excluyen, V-3) |
| CA-9 | Suite completa, snapshots, `home-notice.test.ts`, pruebas del bot y de /admin | G-1 a G-6 (regresión) |

### Riesgos identificados
- **Cuadrícula** (DT-2): la casilla `col-span-2` puede verse desproporcionada o con altura distinta a las demás; en Birria la columna `lg:col-span-5` es estrecha a 1280 px.
- **Textos nuevos más largos en cuadrículas fijas de 3 columnas** (`hero__badges grid-cols-3`, `ritual__metrics grid-cols-3`): "Cocción lenta / Con paciencia", "Sáb y Dom / 8:00 a 15:00" y "A domicilio / Por motomandados" pueden desbordar o cortarse a 320 px.
- **Correo largo** en los pies (`break-all`): puede partirse de forma poco legible en móvil.
- **Iframe** dentro de la tarjeta de sucursal: CSP, carga diferida real, que no quede por encima del aviso (`<dialog>`) de `/`, y que no robe el foco al tabular.
- **Foco visible**: los enlaces del pie de Birria y Molotes no declaran `focus-visible` propio; depende del contorno por defecto del navegador sobre fondo oscuro (Birria) o claro (Molotes).
- **DT-1**: el nombre cambia en el bot (saludo, menú, confirmaciones, parámetro de la plantilla del personal) y en /admin.
- **Bot**: `hoursAndLocation` lee la fuente común; cambio sin código propio, solo cubierto por pruebas.
- **Pruebas de REQ-F-031 actualizadas**: verificar que se modificaron y no se debilitaron ni borraron.
- **Snapshots regenerados**: un `-u` puede ocultar cambios ajenos; se revisa el diff.

### Pruebas funcionales
- F-1. `npm run build:css`, `npm run typecheck`, `npm run lint` (sin `lint:fix`) y `npm test` desde `restaurante/` (con `npm run db:up` si MySQL no está levantado). Se espera código 0; el único fallo admitido es el `it.fails` intencionado de `tests/integration/local-server.test.ts`.
- F-2. Servidor en `PORT=3100 npm start` con el `.env` existente (`NODE_ENV=development`, `?dia=` activo). `curl -sI` de `/`, `/birria`, `/molotes` → 200.
- F-3 a F-9: ver la tabla de criterios.
- F-10. Sucursal única de `/birria`: un solo `<li>` en la lista, nombre "Birria El Muñeco", "Consulta la ubicación en el mapa.", "Cómo llegar" con `href` R-3, `target="_blank"`, `rel="noopener noreferrer"` y `.sr-only`; sin dirección postal ni "Estacionamiento".
- F-11. Enlace "Abrir en Google Maps" bajo el mapa: `href` R-3, nueva pestaña, `rel`, texto de apoyo "(se abre en una pestaña nueva)"; no superpuesto al iframe.
- F-12. Plataformas: Birria = WhatsApp (enlace al bot, `href` según `WHATSAPP_BIRRIA*`), Motomandados (sin enlace), Recoger en sucursal (enlace R-3). Molotes = sus dos actuales + Recoger en sucursal (enlace R-3).
- F-13. Contacto de los pies de `/`, `/birria` y `/molotes`: teléfono, correo y "Ver ubicación en Google Maps" con sus `href`.
- F-14. Nombre comercial: `<title>`, `og:site_name`/`og:title`, `alt` del logo y copyright de `/birria` dicen "Birria El Muñeco"; "Birriería" no aparece en `/`, `/birria` ni `/molotes` (salvo, si apareciera, en contenido de /admin o MySQL, como observación).
- F-15. README: secciones de ubicación única, contacto común, plataformas y diferencias con el diseño reflejan lo implementado (lectura dirigida del diff).

### Pruebas negativas y casos límite
- N-1. Sin JavaScript (se usa el HTML servido por `curl`): el mapa, la sucursal, las plataformas y el contacto están en el HTML del servidor; el aviso de `/` no tapa contenido (comportamiento ya cubierto por `home-notice.test.ts`).
- N-2. `/birria` y `/molotes` con `?dia=lunes` y `?dia=martes`: nunca muestran el aviso.
- N-3. `?dia=valor-invalido` en `/`: se ignora y se usa el día real.
- N-4. Teléfono de llamadas y WhatsApp del bot distintos: el `tel:` no coincide con el número de `WHATSAPP_*` ni el `href` de WhatsApp cambió (RN-6).
- N-5. Ningún otro `tel:`/`mailto:` en las tres rutas (incluido el aviso de `/`).

### Pruebas responsive (viewports: 375×812, 768×1024, 1440×900)
- R-1. 320, 768 y 1280 px (CA-6) más 375×812, 768×1024 y 1440×900 en `/birria` y `/molotes`: sección de plataformas sin huecos (las 3 casillas ocupan la cuadrícula completa: 2 arriba, 1 a lo ancho), sin texto cortado.
- R-2. `document.documentElement.scrollWidth <= clientWidth` en cada ancho y en las 3 rutas.
- R-3. Capturas de la sección `#ubicaciones-pedidos` de Birria y de la sección de servicio de Molotes en cada ancho.
- R-4. Hero badges y métricas del ritual de Birria a 320 y 375 px: sin desbordamiento ni cortes con los textos nuevos.
- R-5. Mapa `aspect-video` sin deformar; correo del pie legible a 320 px.
- R-6. CTA "Ordenar ya!" visible sin scroll a 375×812 en `/birria` y `/` (regresión).

### Pruebas de accesibilidad
- A-1. Un solo `h1` y jerarquía de encabezados sin saltos en `/birria`, `/` y `/molotes` (script de `javascript_tool`).
- A-2. Teclado: tabular por "Cómo llegar", el iframe, "Abrir en Google Maps", "Recoger en sucursal" y los tres enlaces del pie en ambas landings; foco visible en cada uno (capturas).
- A-3. Nombre accesible de los enlaces externos incluye el texto de apoyo (`.sr-only`); iconos con `aria-hidden="true"`.
- A-4. Iframe con `title` significativo y propio de cada negocio.
- A-5. Contraste del texto nuevo de las casillas y del enlace bajo el mapa (blanco y `cream-muted` sobre `#590d0d`/`#4a0808`), medido con los colores calculados.
- A-6. `<address>` en los pies; enlaces (no botones) para navegar.

### Pruebas UX/UI (vs. _stich_source_/)
- U-1. Comparación de la sección de ubicaciones y del pie de Birria con `_stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/` y `birrier_a_el_mu_eco_m_vil_optimizado/`: tipografía, colores y espaciado conservados; el mapa embebido y la sucursal única son diferencias deliberadas (R-4, R-5, DT-3) y no se reportan.
- U-2. Molotes: la tercera casilla y la línea de correo usan el mismo estilo que sus vecinas, comparado con `_stich_source_/moloteando_*`.
- U-3. El resto de secciones de ambas landings no cambia visualmente (capturas a 1440 px y diff de snapshots).

### Pruebas de integración (WhatsApp)
- W-1. CTA de pedido y casilla WhatsApp de ambas landings: `href` (dominio, número, `text` codificado) igual al de `main` según `WHATSAPP_*`, `target` y `rel`. No se sigue el enlace.
- W-2. Bot: `hoursAndLocation('molotes'|'birria')` y la conversación (opción 3) contienen R-3 (pruebas automatizadas); el golden `tests/fixtures/bot-golden/template.json` solo cambia el nombre (diff revisado).

### Pruebas de performance
- P-1. `read_network_requests` en `/birria`: el iframe de Google no se pide antes de desplazarse a la sección (carga diferida); se pide al llegar.
- P-2. Sin JS nuevo; `fondo-birria.jpg` se sigue pidiendo una sola vez (se usa como textura).
- P-3. Consola sin errores en las 3 rutas.

### Pruebas SEO
- S-1. `/birria` y `/`: `title`, meta description y Open Graph iguales a la tabla editorial; canonical y viewport sin cambios.
- S-2. `/molotes`: SEO sin cambios respecto a `main` (diff de `src/content/molotes/index.ts`, sección `seo`).

### Pruebas de regresión
- G-1. Aviso de `/` con `?dia=lunes` ("Descanso" y enlace a `/molotes`), `?dia=martes` a `?dia=viernes` ("Molotes"), `?dia=sabado` y `?dia=domingo` (sin aviso), limpiando `sessionStorage` entre casos; cierre con teclado y foco devuelto; el iframe no se superpone al aviso.
- G-2. Molotes: textos de proceso, menú, horario y SEO sin cambios (diff de `src/content/molotes/index.ts` y del snapshot: solo la casilla nueva y el correo).
- G-3. Productos de Birria (MySQL) se siguen listando en `/birria` y `/` (snapshot de `landing-products.test.ts` y vista en el navegador).
- G-4. DT-1 bot: pruebas `whatsapp-bot-*` y `chat-bot-message-count` en verde; revisión de que solo cambia "Birriería" → "Birria El Muñeco" y la URL de ubicación; las pruebas de `normalizeInput` y Twilio con "Birriería" como entrada se conservan.
- G-5. DT-1 /admin: `admin-authorization.test.ts` en verde y `curl` de la pantalla de acceso de /admin (sin credenciales) para comprobar el nombre; el comportamiento de /admin no cambia.
- G-6. Pruebas de REQ-F-031 (CA-3/4, CA-5/6, CA-7, CA-8, CA-11) siguen presentes y actualizadas, no eliminadas ni debilitadas (diff de `app.test.ts`).
- G-7. Diff de snapshots revisado: solo textos de la tabla, sucursal, mapa, plataformas, contacto y copyright en Birria; casilla y correo en Molotes.
- G-8. `git diff --stat` limitado a los archivos declarados en "Implementation Result".

### Pruebas automatizadas (existentes y nuevas a crear o modificar)
- Existentes: toda la suite (`npm test`), en especial `tests/unit/birria-veracity.test.ts`, `tests/integration/app.test.ts`, `tests/unit/content.test.ts`, `tests/unit/business-hours.test.ts`, `tests/unit/home-notice.test.ts`, `tests/unit/landing-snapshot.test.ts`, pruebas del bot y `tests/integration/admin-authorization.test.ts`.
- Nuevas: ninguna prevista. Solo si QA detecta un hueco de cobertura en CA-1 a CA-8 (p. ej. la lista de términos de CA-1 incompleta) se añadiría una prueba en `restaurante/tests/` y se indicaría en el QA Report; no se modifican pruebas existentes.

### Pruebas en navegador
Claude in Chrome sobre `http://localhost:3100`, pestaña nueva, cerrada al final:
- `/birria`, `/`, `/molotes` en 320, 375×812, 768×1024, 1280, 1440×900 (R-1 a R-6).
- Mapa: carga, carga diferida y consola (CA-5, P-1, P-3).
- Teclado y foco (A-2).
- Aviso de `/` con `?dia=` (G-1).
- No se pulsa ningún enlace externo (Maps, WhatsApp, `tel:`, `mailto:`): se validan sus atributos.
Si la extensión no responde tras 2–3 intentos, la parte visual de CA-6 y la carga del mapa quedan como pendientes de revisión manual y el resultado será `NEEDS_USER_DECISION`, porque CA-6 (visual) depende del navegador.

### Evidencia requerida
- Salida de `build:css`, `typecheck`, `lint` y `npm test` (resumen con número de pruebas y fallos).
- Salidas de `curl` (códigos, cabecera CSP, recuentos de `maps.app.goo.gl`, `tel:` y `mailto:`).
- Resultados de `javascript_tool` (overflow, cajas de la cuadrícula, iframe, encabezados, enlaces).
- Capturas de plataformas a cada ancho, del mapa, del foco y del aviso.
- Mensajes de consola y peticiones de red del mapa.
- Fragmentos de diff revisados (snapshots, pruebas de REQ-F-031, golden del bot).

### Criterios de aprobación
- CA-1 a CA-9 en PASS con evidencia; CA-6 visual verificada en el navegador.
- `typecheck`, `lint` y `npm test` en 0 (solo el `it.fails` intencionado).
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR` solo con aceptación explícita del usuario.
- Sin regresiones en el aviso de `/`, Molotes, productos, bot ni /admin.
- Los textos no veraces que vengan de MySQL o del club de /admin se reportan como observación, nunca como defecto de este ticket.

## QA Report

### Ronda
1 (2026-10-15). QA Action Plan aprobado por el usuario ("Si").

### Pruebas ejecutadas
- `git branch --show-current`: `feature/REQ-F-032-veracidad-birria-unificacion-contacto`. `git status` igual antes y después de QA: QA no modificó ningún archivo, salvo este ticket.
- `npm run build:css`: OK. `npm run typecheck`: 0. `npm run lint`: 0 (0 errores, 0 avisos).
- `npm test`: 90 archivos; 1812 pruebas aprobadas y 1 fallo esperado (el `it.fails` intencionado de `tests/integration/local-server.test.ts`); código 0.
- La lista de términos prohibidos de `tests/unit/birria-veracity.test.ts` coincide literalmente con la de CA-1.
- Servidor: `PORT=3100 npm start` **no arranca** con el `.env` actual: falta `WHATSAPP_BOT_BLOCKLIST_KEY` (bloqueo de entorno, no es un defecto del ticket). Lo arranqué con una clave aleatoria de prueba definida solo en el entorno del proceso (`openssl rand -base64 32`), sin tocar `.env`. El servidor quedó detenido al terminar.
- `curl` de `/`, `/birria`, `/molotes`, `/?dia=lunes|martes|sabado|domingo|xyz`, `/birria?dia=lunes` y `/molotes?dia=martes`: todas responden 200.
- Navegador (Claude in Chrome, `localhost:3100`):
  - mapa, carga diferida y consola;
  - SEO y encabezados;
  - enlaces externos;
  - recorrido con Tab;
  - aviso de `/`;
  - textos de CA-1;
  - contraste.
- La extensión no pudo cambiar el ancho del viewport: la ventana no se redimensionaba y bloqueaba ventanas nuevas. Un iframe de prueba lo impide la propia CSP (`frame-src` solo permite www.google.com, como debe ser). Las medidas a 320, 375×812, 768×1024, 1280 y 1440×900 se tomaron con Chrome headless del sistema mediante el protocolo DevTools: un script en el scratchpad, sin dependencias nuevas, que mide el layout y guarda capturas.

### Criterios de aceptación
| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | Prueba automatizada en verde. En el navegador, el texto de `/birria`, `/` (lunes, martes y sábado), su title, description, OG y alt no contienen ningún término, **excluyendo** las tarjetas de producto (MySQL) y la tarjeta del club (/admin). Dentro de esas exclusiones aparecen "tatemada", "olla" (cebolla), "brasa" y "2x1": están fuera de alcance (observación O-1). |
| CA-2 | PASS (texto) / ver DEF-002 y DEF-003 (presentación) | `birria-veracity.test.ts` en verde. Title "Birria El Muñeco \| Birria de Res Estilo Los Altos de Jalisco", description, `og:site_name`/`og:title` y alt del logo "Birria El Muñeco" verificados en el navegador. A 320 y 375 px, algunos textos aprobados se ven cortados (DEF-002, DEF-003). |
| CA-3 | PASS | `curl`: en `/`, `/birria` y `/molotes`, los únicos `tel:` y `mailto:` son `tel:+527352782306` y `mailto:ordenes@birriaelmuneco.mx`. |
| CA-4 | PASS | `grep -c maps.app.goo.gl` = 0 en las 3 rutas. Pruebas del bot (`hoursAndLocation` y opción 3) en verde. |
| CA-5 | PASS | Un iframe en `/` y en `/birria`, dentro de `#ubicaciones-pedidos`, con `loading="lazy"` y el title "Ubicación de Birria El Muñeco en Google Maps". Peticiones del iframe: 0 al cargar, 1 al llegar a la sección (`/birria` y `/?dia=sabado`). El mapa (Street View) se ve. Consola sin errores. CSP idéntica en las 3 rutas (mismo md5), con `frame-src https://www.google.com` como único añadido. |
| CA-6 | **FAIL** | Sin huecos a ningún ancho: 2 columnas, y la tercera casilla ocupa el ancho completo en Birria y en Molotes. Sin desbordamiento de página (`scrollWidth = clientWidth` en los 5 anchos y las 3 rutas). Los enlaces externos tienen `target`, `rel` y `.sr-only`. **Pero a 320 px, el texto "Motomandados" sale de su casilla en `/birria` y en `/` (DEF-001).** |
| CA-7 | PASS | Prueba automatizada en verde. En pantalla: "Sábado y Domingo 08:00 AM – 03:00 PM", "Lunes a Viernes Cerrado"; pie: "Lunes: Cerrado", "Sábados y Domingos: 08:00 - 15:00", "Martes a Viernes: Hay Molotes". |
| CA-8 | PASS | El botón de envío del club dice "Activar promoción" en `/birria` y `/`. Ningún `button` ni `a` contiene "2x1"/"2×1" en las 3 rutas. |
| CA-9 | PASS | El aviso de `/` funciona bien (ver Regresión). Molotes solo añade la casilla y la línea de correo (diff del contenido y de su captura de referencia). Las pruebas de REQ-F-031 CA-3/4, 5/6, 7 y 8 se renombraron y actualizaron, no se borraron. typecheck, lint y test en 0. Golden del bot: solo cambia el nombre (comprobado sustituyendo el nombre antiguo en `main` y comparando: sin diferencias). |

### Defectos encontrados

### DEF-001
- Severidad: MINOR
- Criterio de aceptación afectado: CA-6 ("a 320 … px no hay … desbordamiento horizontal"), R-8
- Descripción: en la cuadrícula de plataformas de Birria, la palabra "Motomandados" no cabe en su casilla a 320 px y cruza el borde derecho de la tarjeta.
- Pasos para reproducir: abrir `/birria` (o `/`) con un viewport de 320 px y desplazarse hasta "Te la llevamos a tu puerta".
- Resultado esperado: el texto de cada casilla queda dentro de ella.
- Resultado actual: la casilla mide 113 px y su contenido es más ancho (`scrollWidth > clientWidth`); el texto sobresale del borde.
- Evidencia: `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/DEF-001-birria-320-plataformas.png`, `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/birria-320.png`, `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/layout.json`. A 375 px ya no desborda (141 px).
- Impacto: cosmético y legible, pero incumple literalmente CA-6 a 320 px. Es nuevo de este ticket ("Motomandados" no existía en Birria).
- Recomendación: que el nombre de la casilla quepa a 320 px (en Molotes, el mismo texto cabe porque su casilla es de columna).

### DEF-002
- Severidad: MAJOR
- Criterio de aceptación afectado: CA-2 (presentación del texto aprobado de `ritual.metrics`); checklist responsive "textos sin cortes".
- Descripción: en las métricas del ritual de Birria (cuadrícula fija de 3 columnas), "A domicilio" se corta y se ve "A domici…", y "Por motomandados" sobresale de la tarjeta. "Sáb y Dom" se parte en tres líneas.
- Pasos para reproducir: abrir `/birria` o `/` a 375×812 (y a 320) y desplazarse a "Nuestra Birria".
- Resultado esperado: los textos aprobados se leen completos dentro de su tarjeta.
- Resultado actual: a 375 y 320 px, la palabra "domicilio" queda cortada por el borde de la página y "MOTOMANDADOS" cruza el borde de la tarjeta. A 768 px o más, bien.
- Evidencia: `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/metrics-375.png`, `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/metrics-320.png`.
- Impacto: en el viewport móvil de referencia (375), en la página de inicio de todos los días, una de las tres métricas aprobadas no se puede leer completa. Hay alternativa: la información se repite en la sección de entrega.
- Recomendación: que las tres métricas quepan a 320 y 375 px sin cortar ni partir palabras.

### DEF-003
- Severidad: MINOR
- Criterio de aceptación afectado: CA-2 (presentación de `hero.badges`); checklist responsive.
- Descripción: en las insignias del hero de Birria (3 columnas fijas), "Consomé" sobresale de su tarjeta a 375 px y se ve cortado ("Consome…") a 320 px; "Cocción" toca el borde a 320 px.
- Pasos para reproducir: abrir `/birria` o `/` a 320 y a 375 px; ver el primer pliegue.
- Resultado esperado: los textos de las insignias quedan dentro de su tarjeta.
- Resultado actual: ver las capturas.
- Evidencia: `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/badges-320.png`, `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/badges-375.png`.
- Impacto: cosmético en el primer pliegue móvil; se entiende igual.
- Recomendación: que las insignias quepan a 320 px.

### DEF-004
- Severidad: MINOR
- Criterio de aceptación afectado: ninguno directo (calidad: contraste y consistencia, R-8 en Molotes).
- Descripción: el icono `storefront` de la nueva casilla "Recoger en sucursal" de Molotes es azul marino `rgb(3,43,95)` sobre la casilla `rgb(16,32,56)`: contraste 1.18:1, prácticamente invisible. Los iconos vecinos tienen 9.6:1 (WhatsApp) y 10.41:1 (Motomandados).
- Pasos para reproducir: abrir `/molotes` y ver la sección "Pídelos Calientes a Tu Puerta".
- Resultado esperado: el icono se ve, como los de las otras dos casillas.
- Resultado actual: el icono no se distingue.
- Evidencia: `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots/molotes-320.png`; medición en el navegador (color calculado contra el fondo de la casilla).
- Impacto: bajo (el icono es decorativo, `aria-hidden`, y el texto se lee), pero la casilla nueva se ve incompleta frente a las otras.
- Recomendación: un color de icono con contraste suficiente sobre la casilla, coherente con la paleta de Molotes.

### Regresión
- Aviso de `/`:
  - `?dia=lunes` muestra "¡Los lunes descansamos!" con el enlace a `/molotes`; es modal y el foco va al enlace.
  - `?dia=martes` y `?dia=viernes` muestran "¡Ay, compa! La birria es de fin de semana" con el enlace a `/molotes`.
  - `?dia=sabado` y `?dia=domingo` no muestran ningún aviso.
  - `?dia=xyz` se ignora y aplica el día real (jueves), así que hay aviso.
  - Escape lo cierra; al recargar en la misma sesión no reaparece.
  - `/birria?dia=lunes` y `/molotes?dia=martes` no tienen `<dialog>`.
- Molotes: en el diff, solo se suman la casilla y la línea del correo, y la ubicación pasa a la fuente común; el resto no cambia.
- Productos (MySQL) visibles en `/birria`.
- DT-1:
  - bot: pruebas en verde; el golden solo cambia el nombre;
  - /admin: `admin-authorization.test.ts` en verde; la pantalla de acceso (`/admin/login`) responde y no contiene "Birriería".
- WhatsApp: `href` `wa.me/<número>?text=…` codificado en ambas landings, con `rel="noopener noreferrer"`.
- Toda la suite en verde.

### Responsive
- 320, 375×812, 768×1024, 1280 y 1440×900 en `/birria`, `/molotes` y `/?dia=sabado`:
  - sin desbordamiento de página;
  - plataformas sin huecos;
  - mapa con proporción 16:9 (≈1.78) sin deformarse;
  - correo del pie legible a 320 px.
- Fallos: DEF-001 (320), DEF-002 (320/375) y DEF-003 (320/375).
- CTA "Ordenar ya!" visible sin desplazarse a 375×812 en `/birria`, `/` y `/molotes`.

### Accesibilidad
- `/birria`: un `h1`, sin saltos de encabezado; landmarks presentes; un `<address>` en el pie.
- Recorrido con Tab, en orden y con `:focus-visible` y contorno visible en cada paso:
  - "Cómo llegar" → iframe → "Abrir en Google Maps" → WhatsApp → "Recoger en sucursal" → club → teléfono → correo → "Ver ubicación en Google Maps".
- Captura del foco en el pie.
- Todos los enlaces externos nuevos llevan su texto de apoyo `.sr-only`; los iconos llevan `aria-hidden`.
- Contraste de los textos nuevos de Birria entre 11.8:1 y 16.3:1.
- DEF-004 (icono de Molotes, 1.18:1).

### UX/UI
- La sucursal única con mapa embebido y la casilla a lo ancho son diferencias deliberadas (R-4, R-5, DT-2, DT-3); conservan la paleta, las tipografías y los bordes de la tarjeta.
- El enlace "Abrir en Google Maps" queda debajo del mapa, sin superponerse.
- DEF-004 rompe la consistencia de iconos en Molotes.

### Performance
- El mapa se carga en diferido (0 peticiones antes de llegar a la sección; 1 al llegar).
- Sin JS nuevo.
- Consola sin errores en Chrome headless (todos los anchos) ni en Chrome (`/birria`, `/?dia=sabado`, `/?dia=viernes`).

### SEO
- `/birria`:
  - title, description, `og:site_name`, `og:title` y `og:description` según la tabla;
  - canonical `/birria`;
  - un `h1`.
- `/molotes`: sin cambios de SEO en el diff.

### Observaciones (no son defectos de este ticket)
- O-1. La descripción del club de Birria (desde /admin) dice "promociones de litros al 2x1" y "Domingos de Birria Familiar", y los productos (MySQL) contienen "tatemada" y "brasa". Están fuera de alcance (V-3, `.claude/docs/pendientes.md`).
- O-2. El `.env` local no tiene `WHATSAPP_BOT_BLOCKLIST_KEY`, por lo que `npm start` falla en local con la configuración actual (ajeno a este ticket).
- O-3. La extensión de Chrome no pudo redimensionar el viewport en este equipo; la parte responsive se validó con Chrome headless.

### Pendientes de revisión manual
Ninguno imprescindible. Opcional: revisar a ojo en un móvil real las capturas de DEF-002 y DEF-003.

### Resultado final
QA_REJECTED

Motivo: CA-6 falla a 320 px (DEF-001). Además hay un defecto MAJOR (DEF-002) y dos MINOR (DEF-003, DEF-004). Todos tienen que ver con la presentación a anchos móviles o con el contraste; la lógica, los textos, los enlaces, el mapa, la CSP, el bot y el aviso pasan.

### Ronda 2 (2026-10-15)
Revalidación de las correcciones de DEF-001 a DEF-004, aprobadas por el usuario ("si"), con el plan aprobado en la ronda 1.

#### Qué cambió
- Solo clases de Tailwind en `birria.html` (plataformas, métricas, insignias) y en `molotes.html` (icono `text-primary`), más 2 pruebas nuevas en `app.test.ts` (DEF-001 a DEF-003 y DEF-004).
- Comparado con `main` y quitando los atributos `class`:
  - el diff estructural de `birria.html` es el mismo que en la ronda 1 (mapa, plataformas, pie);
  - el de la captura de referencia de Molotes sigue en 9 líneas (casilla y correo).
- Los archivos de contenido (`birria/index.ts` 171, `molotes/index.ts` 27, `common/index.ts` 17 líneas de diff) no cambian respecto a la ronda 1.

#### Pruebas ejecutadas
- `npm run build:css`: OK. `npm run typecheck`: 0. `npm run lint`: 0.
- `npm test`: 90 archivos; 1814 aprobadas y 1 fallo esperado (`it.fails` de `local-server.test.ts`); código 0.
- Servidor `PORT=3100` con una `WHATSAPP_BOT_BLOCKLIST_KEY` aleatoria solo para el proceso (`.env` sin tocar); detenido al terminar.
- Chrome headless (CDP), anchos 320, 360, 375×812, 768×1024, 1024, 1280 y 1440×900, en `/birria`, `/?dia=sabado` y `/molotes`. Se midió:
  - desbordamiento de página;
  - texto fuera de su tarjeta (rectángulos del texto frente a la caja de cada insignia, métrica y casilla de plataforma);
  - palabras sueltas partidas en varias líneas;
  - cuadrícula de plataformas;
  - contraste de iconos (color normalizado con canvas);
  - errores de consola.
  Hay capturas en `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots2/`.
- `curl`:
  - `tel:`, `mailto:`, `maps.app.goo.gl`, iframe `lazy` y CSP (md5 idéntico en las 3 rutas);
  - `<dialog>` con `?dia=` de lunes a domingo y con un valor inválido.
- Claude in Chrome, `/?dia=martes`:
  - el aviso es modal, con el texto y el enlace correctos;
  - el iframe hace 0 peticiones antes de llegar a la sección y 1 al llegar;
  - consola sin errores.

#### Defectos de la ronda 1
| Defecto | Resultado | Evidencia |
|---|---|---|
| DEF-001 | Corregido | A 320, 360 y 375 px las casillas van en columna (icono arriba): 0 textos fuera de la casilla y 2 columnas sin huecos a todos los anchos. Captura `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots2/birria-ubicacionespedidosul-320.png` |
| DEF-002 | Corregido | Por debajo de `sm`, las métricas van en 1 columna y "A domicilio" y "Por motomandados" se leen completos. A 768, 1024 y 1280 px van en 3 columnas, sin texto fuera de la tarjeta ni palabras partidas (a 1024, "A domicilio" pasa a dos líneas, palabra por palabra). Capturas `birria-ritualmetrics-{320,375,768,1024}.png` |
| DEF-003 | Corregido | Insignias sin texto fuera de la tarjeta a 320, 360 y 375 px; "Consomé" completo. Capturas `birria-herobadges-{320,375}.png` |
| DEF-004 | Corregido | El icono `storefront` tiene contraste 9.62:1 sobre la casilla (antes 1.18:1); los vecinos, 9.6:1 y 10.41:1. Captura `/private/tmp/claude-501/-Users-orvigas-Desktop-Negocio/2cff8506-aad0-4b07-aeb9-699ff9708e48/scratchpad/shots2/DEF-004-molotes-320-plataformas.png` |

#### Criterios de aceptación (ronda 2)
| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | Prueba automatizada en verde; los textos no cambiaron en esta ronda (diff solo de clases) |
| CA-2 | PASS | Prueba en verde; los textos aprobados se ven completos en todos los anchos (DEF-002 y DEF-003 corregidos) |
| CA-3 | PASS | `curl`: un único `tel:+527352782306` y un único `mailto:ordenes@birriaelmuneco.mx` en `/`, `/birria` y `/molotes` |
| CA-4 | PASS | `maps.app.goo.gl` = 0 en las 3 rutas; pruebas del bot en verde |
| CA-5 | PASS | Un iframe `lazy` en `/` y `/birria`; carga diferida verificada; CSP idéntica; sin errores en consola |
| CA-6 | PASS | Sin huecos ni desbordamiento (de página ni dentro de las casillas) a 320, 360, 375, 768, 1024, 1280 y 1440 px, en Birria y en Molotes |
| CA-7 | PASS | Prueba en verde (sin cambios de contenido) |
| CA-8 | PASS | Prueba en verde (sin cambios de contenido) |
| CA-9 | PASS | Aviso de `/`: lunes, martes y viernes con aviso, sábado y domingo sin él, un valor inválido se ignora. Capturas de referencia con diff solo de clases en esta ronda. typecheck, lint y test en 0 |

#### Defectos encontrados
Ninguno nuevo.

#### Regresión, responsive, accesibilidad, performance y SEO
- Sin desbordamiento de página en ningún ancho ni ruta, y sin errores de consola.
- Iconos de las casillas de Birria con contraste entre 5.93:1 y 9.75:1.
- Contenido, enlaces, SEO y foco: sin cambios respecto a la ronda 1 (esta ronda solo cambia clases), por lo que siguen validados.

#### Observaciones
Siguen vigentes O-1 (club de /admin y productos de MySQL, fuera de alcance) y O-2 (falta `WHATSAPP_BOT_BLOCKLIST_KEY` en el `.env` local).

#### Pendientes de revisión manual
Ninguno.

#### Resultado final
QA_APPROVED

## Pull Request

- PR: #67, https://github.com/orvigas/negocio/pull/67 (base `main`, rama `feature/REQ-F-032-veracidad-birria-unificacion-contacto`).
- Commit: `58fc9d1` (`feat: publica textos veraces de Birria y unifica ubicación, contacto y mapa de la sucursal`).
- CI del PR (run 38827063233): `calidad`, `docker`, `despliegue` y `auditoria` en verde (además de `cambios` y GitGuardian). `publish`, `deploy`, `validado` y `vigente` aparecen omitidos (*skipped*), como corresponde a un PR.

## Historial de cambios

### Versión 1
Descripción inicial, aprobada por el usuario el 2026-10-15.

### Revisión técnica (senior-fullstack, 2026-10-15)
Technical Action Plan agregado, con los hallazgos H-1 a H-5 y las decisiones DT-1 a DT-5. Estado: NEEDS_TECHNICAL_PLAN_APPROVAL.

### Implementación (senior-fullstack, 2026-10-15)
Plan aprobado por el usuario ("Si", con DT-1 a DT-5). Rama creada, ticket movido a `in-progress/` e implementación validada (typecheck, lint y test en 0). Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### QA Action Plan (senior-qa, 2026-10-15)
Implementación aprobada por el usuario ("Apruebo"). QA Action Plan agregado. Estado: NEEDS_QA_PLAN_APPROVAL.

### QA ronda 1 (senior-qa, 2026-10-15)
Plan aprobado por el usuario ("Si"). Ejecución completa. CA-6 falla a 320 px (DEF-001); DEF-002 (MAJOR), DEF-003 y DEF-004 (MINOR). Estado: QA_REJECTED.

### Correcciones QA ronda 1 (senior-fullstack, 2026-10-15)
DEF-001 a DEF-004 corregidos con utilidades responsivas, sin cambiar textos. Verificación en Chrome headless de 320 a 1440 px. Typecheck, lint y test en 0. Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### QA ronda 2 (senior-qa, 2026-10-15)
Corrección aprobada por el usuario ("si"). DEF-001 a DEF-004 corregidos y verificados; CA-1 a CA-9 en PASS. Estado: QA_APPROVED.

### Pull Request (senior-fullstack, 2026-10-15)
Commit `58fc9d1` y PR #67 contra `main`, con el CI en verde. Estado: READY_FOR_MERGE.

### Cierre (senior-fullstack, 2026-10-16)
El usuario mergeó el PR #67 (https://github.com/orvigas/negocio/pull/67; merge `6ccfec0`) el 2026-10-16 ("Fusionado"). Ticket movido a `done/`. Estado: DONE.
