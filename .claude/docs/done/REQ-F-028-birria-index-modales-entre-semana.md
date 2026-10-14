# REQ-F-028 — Birria como índice permanente, con modal de Molotes de martes a viernes y modal de descanso los lunes

## Estado

DONE

Pull Request: https://github.com/orvigas/negocio/pull/45 (commit 59a3620). CI del PR en verde: `calidad`, `docker` y `despliegue` pasan (`publish` y `deploy` se omiten en un PR; ejecución https://github.com/orvigas/negocio/actions/runs/38567391499).

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-14). Cita textual: "Aprobar todo".

## Objetivo

Que la página de inicio (`/`) muestre siempre la landing de Birria El Muñeco. Según el día en la zona horaria del negocio, se abre además un aviso:

- **De martes a viernes:** explica que la birria es solo de fin de semana y lleva a los molotes.
- **Los lunes:** dice que ese día descansamos y lleva a los molotes del día siguiente.

## Alcance

- La regla de `/` cambia: Birria los 7 días.
- Se añaden dos modales informativos, solo en `/`, y sus textos se pueden editar en el contenido.
- El `<title>`, la meta description y las etiquetas Open Graph de `/` pasan a ser siempre los de Birria.
- Se reescriben las secciones §1, §5 y §11 de `CLAUDE.md` (autorizado por el usuario).
- Se deja constancia de que este ticket sustituye la decisión D-2 de REQ-F-010.
- Pruebas y documentación.

## Fuera de alcance

- Las páginas `/birria` y `/molotes` no cambian y no muestran ningún modal.
- El CTA de pedido de Birria se queda igual todos los días.
- No hay modal en la landing de Molotes.
- No cambian los horarios (REQ-F-010) ni el bot de WhatsApp.
- No se mide la conversión del modal.

## Requisitos

- **RF-1.** `/` muestra la landing de Birria todos los días.
- **RF-2.** El modal que se abre depende del día en la zona horaria del negocio (`America/Mexico_City`, configurable), nunca de la hora del servidor ni de la del dispositivo:
  - Lunes: modal "Descanso".
  - De martes a viernes: modal "Molotes".
  - Sábado y domingo: ningún modal.
- **RF-3.** El modal que toca se decide al cargar la página. Si el día cambia con la página abierta, no cambia.
- **RF-4.** Los modales solo aparecen en `/`. Nunca en `/birria` ni en `/molotes`.
- **RF-5.** El modal "Molotes" lleva el logo de Molotes y el texto "¡Ordenar ya!" dentro de un único enlace a `/molotes`. El texto es el mismo a cualquier hora.
- **RF-6.** El modal "Descanso" lleva el enlace "Mañana hay molotes" a `/molotes`, además del botón de cerrar.
- **RF-7.** Los dos modales se pueden cerrar con un botón visible "Cerrar" y con la tecla Escape.
- **RF-8.** Cada modal se muestra una sola vez por sesión del navegador. No vuelve a salir hasta que se cierra el navegador. Si el navegador no permite guardar esa marca, el modal se muestra igual y se puede cerrar.
- **RF-9.** Los textos de los dos modales (título, cuerpo, textos de los enlaces y del botón de cerrar) están en el contenido de Birria, que se puede editar. No están escritos a mano en el HTML ni en el JavaScript.
- **RF-10.** Todo el contenido de Birria llega ya generado desde el servidor. Sin JavaScript se ve completo y ningún modal lo tapa.
- **RF-11.** En desarrollo se puede forzar el día para comprobar los tres casos sin tocar código. Si ya existe un mecanismo para eso, se reutiliza; en producción no está disponible.

### Accesibilidad (obligatoria)

- Diálogo modal nativo con un título asociado.
- Al abrirse, el foco entra en el modal y no puede salir de él con Tab.
- Al cerrarse, el foco vuelve a la página.
- El enlace con el logo tiene un nombre accesible claro: la imagen lleva un texto alternativo que no repite "¡Ordenar ya!".
- El foco se ve en todo momento y el contraste cumple el nivel AA.
- Funciona con teclado en móvil y en escritorio.

### UX/UI

Es una excepción aprobada a la sección 3 de `CLAUDE.md`, porque `_stich_source_/` no tiene una pantalla de modal:

- Capa de modal de `_stich_source_/birrier_a_el_mu_eco/DESIGN.md:206`: fondo `#3d2621`, sombra `0 16px 40px -8px rgba(0,0,0,0.85)` y borde superior de `1.5px solid #c2410c`.
- Radio de 16px, según `_stich_source_/birria_tradicional_jalisciense/DESIGN.md:181`.
- Colores y tipografía de Birria.
- Se reutiliza el logo que ya existe en `restaurante/public/img/molotes/logo-molotes.webp`.
- Diseño mobile-first: el modal se ve entero en una pantalla de 320 px de ancho.

### Textos aprobados (editables en el contenido)

**Modal "Molotes" (de martes a viernes)**

- Título: "¡Ay, compa! La birria es de fin de semana"
- Cuerpo: "Nuestra birria sale calientita nomás sábados y domingos. Pero no te quedes con antojo: de martes a viernes tenemos ricos y deliciosos molotes recién hechecitos, doraditos y con su salsita de la casa."
- Enlace (logo de Molotes + texto): "¡Ordenar ya!" → `/molotes`. Texto alternativo del logo: "Molotes".
- Botón: "Cerrar"

**Modal "Descanso" (lunes)**

- Título: "¡Los lunes descansamos!"
- Cuerpo: "Hoy el comal y las cazuelas agarran fuerzas, y nosotros también. Mañana martes volvemos con molotes recién hechecitos, y el fin de semana, con la birria de siempre."
- Enlace: "Mañana hay molotes" → `/molotes`
- Botón: "Cerrar"

## Historias de usuario

- **HU-1.** Como cliente que entra de martes a viernes, quiero saber que la birria es solo de fin de semana y llegar rápido a los molotes, para no irme sin pedir.
- **HU-2.** Como cliente que entra un lunes, quiero saber que hoy no hay servicio y cuándo volver.
- **HU-3.** Como cliente con teclado o lector de pantalla, quiero poder usar y cerrar el modal sin quedarme atrapado.

## Reglas de negocio

- **RN-1.** Molotes abre de martes a viernes, de 08:30 a 15:00. Birria abre sábado y domingo, de 08:00 a 15:00. El lunes no abre ningún negocio (REQ-F-010).
- **RN-2.** El día se calcula en `America/Mexico_City`.
- **RN-3.** `/` es siempre Birria. `/molotes` y `/birria` son páginas propias y nunca muestran un modal.
- **RN-4.** Cada modal se muestra como máximo una vez por sesión del navegador.
- **RN-5.** La marca de "ya se vio" se guarda aparte para cada modal. Si alguien deja la pestaña abierta del lunes al martes y recarga, ve el modal del martes.
- **RN-6.** El modal cuenta como visto en cuanto se muestra, no solo cuando se cierra. Si alguien va a `/molotes` desde el modal y pulsa "atrás", no vuelve a salir.

## Criterios de aceptación

- **CA-1.** Dado que es sábado o domingo en CDMX, cuando abro `/`, entonces veo Birria y no se abre ningún modal.
- **CA-2.** Dado que es de martes a viernes, cuando abro `/` por primera vez en la sesión, entonces se abre el modal "Molotes" con los textos aprobados y un único enlace (logo + "¡Ordenar ya!") a `/molotes`.
- **CA-3.** Dado que es lunes, cuando abro `/` por primera vez en la sesión, entonces se abre el modal "Descanso" con el enlace "Mañana hay molotes" a `/molotes` y el botón "Cerrar".
- **CA-4.** Dado cualquier día, cuando abro `/birria` o `/molotes`, entonces no se abre ningún modal.
- **CA-5.** Dado un modal abierto, cuando pulso Escape o "Cerrar", entonces se cierra y el foco vuelve a la página.
- **CA-6.** Dado un modal abierto, cuando navego con Tab o Mayús+Tab, entonces el foco no sale del modal.
- **CA-7.** Dado que ya vi el modal en esta sesión, cuando recargo `/` o vuelvo con "atrás", entonces no se abre otra vez. Si abro el navegador de nuevo, sí se abre.
- **CA-8.** Dado que el navegador no permite guardar la marca de sesión, cuando abro `/`, entonces el modal se muestra y se puede cerrar sin errores.
- **CA-9.** Dado JavaScript deshabilitado, cuando abro `/`, entonces veo todo el contenido de Birria y nada lo tapa.
- **CA-10.** Dado cualquier día, cuando abro `/`, entonces el `<title>`, la meta description y las etiquetas `og:` son los de Birria, y el HTML del servidor incluye su contenido completo.
- **CA-11.** Dado el servidor en UTC y el lunes a las 23:30 en CDMX, cuando abro `/`, entonces se abre el modal "Descanso", no el del martes.
- **CA-12.** Dado que cambio un texto en el contenido de Birria, cuando recargo, entonces el modal muestra el texto nuevo sin cambios en HTML ni en JS.
- **CA-13.** Dado un día forzado en desarrollo, se cumplen CA-1 a CA-3. En producción, forzar el día no tiene efecto.
- **CA-14.** El modal cumple el contraste AA, el foco es visible y se ve entero a 320 px de ancho.

## Casos límite

- La medianoche en CDMX frente a UTC (CA-11).
- Un cambio de día con la página abierta (RF-3).
- Recargar, pulsar "atrás" o entrar por un enlace directo (CA-4, CA-7).
- Sin JavaScript (CA-9).
- No se puede guardar la marca de sesión (CA-8).
- Conexión lenta: el modal no se abre después de que la persona ya interactuó con la página. Sale al cargar o no sale.

## Dependencias

- REQ-F-010 (horarios).
- La selección por día y la zona horaria del negocio que ya existen.
- `restaurante/public/img/molotes/logo-molotes.webp`.
- Los DESIGN.md de Birria en `_stich_source_/`.

## Riesgos

- Un modal molesto puede bajar la conversión de Birria entre semana. Se mitiga mostrándolo una vez por sesión y cerrándolo fácil.
- Si `CLAUDE.md` no se actualiza, la documentación queda desalineada con el comportamiento.
- SEO: el riesgo es bajo si el contenido se genera en el servidor (CA-10).

## Action Plan

1. Cambiar la regla de `/` para que muestre siempre Birria, y quitar la selección por día de la landing en `/`.
2. Decidir qué modal toca según el día en la zona del negocio, solo en `/`.
3. Construir un único componente de modal accesible que sirva para las dos variantes.
4. Poner los textos y el logo de los modales en el contenido de Birria.
5. Mostrar el modal una vez por sesión y que la página funcione igual sin JavaScript.
6. Comprobar el `<title>`, la meta description y las etiquetas Open Graph de `/`.
7. Habilitar o reutilizar el forzado del día, solo en desarrollo.
8. Reescribir las secciones §1, §5 y §11 de `CLAUDE.md`, registrar que se sustituye REQ-F-010 D-2 y actualizar el README si cambia la configuración.
9. Pruebas de CA-1 a CA-14.

## Technical Action Plan

### Objetivo técnico

`/` renderiza siempre Birria. El servidor decide el aviso del día (lunes, martes a viernes o ninguno) con `getWeekday` en `BUSINESS_TIMEZONE` y lo inserta como un `<dialog>` cerrado en el HTML de `/`. Un módulo JS lo abre con `showModal()` una sola vez por sesión. Sin JS, el `<dialog>` cerrado no se ve ni tapa nada.

### Decisiones técnicas (se confirman al aprobar este plan)

- **D-T1. Iconos de `/favicon.ico` y `/apple-touch-icon*.png`.** Hoy siguen el negocio del día (`icons.ts` → `getActiveBusinessId`): un martes servirían el icono de Molotes, aunque `/` sea Birria. **Recomendado:** que siempre sirvan el de Birria, igual que `/`. La alternativa es dejarlos por día (fuera de alcance), con esa incoherencia. El favicon de `/admin`, el bot y `getActiveBusinessId` no cambian.
- **D-T2. Forzado del día (RF-11).** No existe ningún mecanismo en la web (solo `--ahora` en `bot:chat`). **Recomendado:** el parámetro `/?dia=lunes|martes|miercoles|jueves|viernes|sabado|domingo`, que solo se respeta con `NODE_ENV=development`. En `test` y `production`, o con un valor no válido, se ignora sin error. No necesita variables nuevas ni cambia `deploy/`. La alternativa es una variable de entorno validada en `env.ts` y prohibida en producción, pero obliga a reiniciar el servidor para cada caso.
- **D-T3. Foco dentro del modal (CA-6).** **Recomendado:** el comportamiento nativo de `showModal()`. El resto del documento queda inerte y Tab recorre solo los controles del diálogo. Algunos navegadores dejan pasar el foco a su propia barra (no a la página), como en cualquier diálogo nativo, y eso cumple WCAG. No se añade una trampa de foco propia en JS.
- **D-T4. Conexión lenta.** El módulo no abre el modal si, antes de ejecutarse, la persona ya desplazó la página (`scrollY > 0`) o movió el foco (`document.activeElement` distinto de `body`). En ese caso tampoco marca el modal como visto.

### Archivos o componentes afectados

- `restaurante/src/services/business-schedule.ts`: nueva `getHomeNotice({ now, timeZone, forcedDay? })` → `'molotes' | 'rest' | null`, que reutiliza `getWeekday`. `getActiveBusinessId` queda igual (la usan el bot, `/admin` y sus pruebas).
- `restaurante/src/controllers/landing.ts`: en `/` (sin `businessId` fijo) el negocio es siempre `birria` y calcula el aviso. Con `NODE_ENV=development` lee y valida `?dia`. `/birria` y `/molotes` nunca llevan aviso. `Cache-Control: no-cache` se mantiene.
- `restaurante/src/routes/index.ts`: actualiza el comentario de `GET /` y pasa `config.nodeEnv` al controlador.
- `restaurante/src/views/landings/index.ts` y `birria.ts`: `renderLandingPage` acepta `homeNotice?` (solo Birria). `buildBirriaBody` renderiza el parcial del aviso, o una cadena vacía si no hay.
- `restaurante/src/views/partials/birria/home-notice.html` (nuevo, un único componente) y `home-notice-molotes-link.html` y `home-notice-rest-link.html` (las acciones de cada variante).
- `restaurante/src/views/pages/birria.html`: `{{{ homeNotice }}}` después del `<footer>`.
- `restaurante/src/content/birria/index.ts`: nuevo bloque `homeNotices: { molotes: { title, body, linkLabel, logo, closeLabel }, rest: { title, body, linkLabel, closeLabel } }` con los textos aprobados. `logo = image('/img/molotes/logo-molotes.webp', 'Molotes', 461, 512)` reutiliza el asset existente.
- `restaurante/public/js/modules/home-notice.js` (nuevo) e `initHomeNotice()` en `restaurante/public/js/birria/main.js`.
- `restaurante/src/controllers/icons.ts`: solo si se aprueba D-T1.
- Documentación: `.claude/CLAUDE.md` §1, §5 y §11; `restaurante/README.md` (rutas: `GET /`, iconos, la nota de la canónica y el forzado `?dia` en desarrollo); el registro en REQ-F-010 de que D-2 queda sustituida.
- **No se toca `restaurante/deploy/`**, ni `.env.example`, ni el Dockerfile: no hay variables nuevas.

### Frontend

- Marcado: `<dialog class="home-notice" data-home-notice="molotes|rest" aria-labelledby="home-notice-title">`, sin el atributo `open`. Dentro van un `<h2 id="home-notice-title">`, el párrafo, la acción y `<button type="button" data-action="close-home-notice">Cerrar</button>` (en la variante "Molotes", un `<a href="/molotes">` con `<img alt="Molotes">` y el texto "¡Ordenar ya!"). Sin JS, un `<dialog>` cerrado no se muestra (`display: none` del navegador): CA-9 se cumple sin CSS extra.
- `home-notice.js`:
  - Busca `[data-home-notice]`. Si no existe (`/birria`, `/molotes`, fin de semana), no hace nada.
  - Clave `homeNotice:<variante>:seen` en `sessionStorage`, una por modal (RN-5). Lee y escribe dentro de `try/catch`: si falla, abre el modal igual (CA-8).
  - Aplica D-T4, llama a `showModal()` y guarda la marca nada más abrirlo (RN-6).
  - "Cerrar" llama a `dialog.close()`. Escape lo resuelve el navegador (evento `cancel`). Al cerrar, el foco vuelve al elemento que lo tenía antes (`body`, comportamiento nativo).
  - En `pagehide` cierra el diálogo, para que al volver con "atrás" desde la caché del navegador (bfcache) no aparezca abierto (CA-7, RN-6).
  - Si el navegador no tiene `HTMLDialogElement.prototype.showModal`, no hace nada (la página ya está completa).
- El día nunca se calcula en el cliente: el JS solo lee la variante que puso el servidor (RF-2, RF-3).

### Estilos

- Tailwind (con `partials/birria` ya en `@source`) y BEM (`home-notice`, `home-notice__title`, `__body`, `__action`, `__logo`, `__close`):
  - Capa: `bg-[#3d2621] rounded-2xl border-t-[1.5px] border-t-[#c2410c] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.85)]`.
  - `backdrop:bg-black/70`.
  - Texto `text-cream`, título `font-headline`, cuerpo `font-body`.
  - Ancho `w-[calc(100%-2rem)] max-w-md` y `max-h-[calc(100dvh-2rem)] overflow-y-auto`, para que se vea entero a 320 px (CA-14).
- El enlace "¡Ordenar ya!" reutiliza el estilo del CTA ámbar de Birria. "Cerrar" es un botón secundario con borde. Ambos con `focus-visible:outline` ámbar visible. Contraste AA: crema `#fff8f0` y ámbar sobre `#3d2621` superan 4.5:1 (se comprueba en las pruebas o al revisar el CSS).
- CSS propio mínimo en `src/styles/birria/main.css` solo si hace falta (por ejemplo, bloquear el desplazamiento con `html:has(dialog[open])`). `npm run build:css` regenera `public/css/birria/main.css`.

### Validaciones

- `?dia` solo se lee con `config.nodeEnv === 'development'`, contra una lista cerrada de 7 valores, y nunca se refleja en el HTML. Fuera de esa lista se ignora.

### Seguridad

- No hace falta cambiar la CSP: el JS es un módulo de `/js/birria/main.js` (`script-src 'self'`) y no hay scripts ni estilos en línea nuevos. La imagen sale de `'self'`. Los textos del contenido se escapan con `{{ }}`.

### Caché

- `/` ya responde `Cache-Control: no-cache` y la app no usa ETag ni respuestas condicionales (no hay `koa-conditional-get` ni `koa-etag`): cada carga vuelve a pedir el HTML y recibe el aviso del día. Una caché intermedia (Traefik no cachea) debería revalidar por `no-cache`. RF-3 se cumple porque el aviso queda fijo en el HTML ya cargado.

### Testing

- **Unitarias** (`business-schedule.test.ts`): `getHomeNotice` para los 7 días, el cambio de medianoche en CDMX frente a UTC (CA-11: lunes 23:30 CDMX = martes UTC → `rest`) y el día forzado.
- **Unitarias** (`landing.test.ts` y `landing-snapshot.test.ts`): Birria con cada variante y sin aviso. Se actualizan las snapshots de Birria (la de `/birria` no cambia de contenido). Además: un `<dialog>` sin `open`, un único `<a href="/molotes">` en la variante "Molotes" con el `alt` "Molotes", los textos que salen del contenido (CA-12, con un contenido modificado) y su escape.
- **Integración** (`tests/integration/app.test.ts`): se reescribe el bloque `GET /`:
  - Viernes y lunes devuelven `data-business="birria"`, el `<title>`, la descripción, `og:*` y la canónica de Birria (CA-10).
  - El aviso correcto según el día: lunes `rest`, martes a viernes `molotes`, sábado y domingo ninguno (CA-1 a CA-3).
  - CA-11 con `BUSINESS_TIMEZONE`.
  - `/birria` y `/molotes` sin `data-home-notice` en ningún día (CA-4).
  - `?dia=` funciona con `NODE_ENV=development` y se ignora con `production` y `test` (CA-13).
  - `Cache-Control: no-cache` y la CSP intactas.
  - Los casos de horario CA-5 de REQ-F-010 (lunes → Molotes) se reescriben: un lunes, `/` es Birria con el aviso de descanso, y la fila "Lunes: Cerrado por nixtamal" se comprueba en `/molotes`.
  - Si se aprueba D-T1, `favicon.ico` sirve Birria entre semana.
- **JS** (`landing-dom.test.ts` o un `home-notice.test.ts` nuevo con jsdom, que no implementa `showModal`, así que se simula `showModal` y `close` en el prototipo):
  - Abre una vez y marca la sesión. No abre si ya está marcado. Las claves son distintas por variante (RN-5).
  - Con `sessionStorage` que lanza error, abre igual sin error (CA-8).
  - "Cerrar" cierra. `pagehide` cierra. No abre si ya hubo desplazamiento o cambio de foco (D-T4). Sin `[data-home-notice]`, no hace nada.
- **Manual en navegador** (lo anota QA): Escape, Tab y Mayús+Tab dentro del modal, foco visible, 320 px, contraste y "atrás" desde `/molotes`.

### Riesgos técnicos

- jsdom no implementa `<dialog>`: el foco y el Escape reales solo se comprueban en el navegador (manual o QA).
- Las snapshots y las pruebas de REQ-F-010 que suponían "lunes → Molotes en `/`" cambian a propósito: queda documentado como sustitución de REQ-F-010 D-2.
- Si en el futuro se añade una caché HTTP compartida delante de `/`, debe respetar `no-cache`.

### Orden de implementación

1. `getHomeNotice` y sus pruebas unitarias.
2. El contenido `homeNotices` en Birria.
3. El parcial, `buildBirriaBody` y `renderLandingPage`, con sus snapshots.
4. El controlador y la ruta `/` (y `?dia` en desarrollo), con las pruebas de integración.
5. `home-notice.js` y sus pruebas con jsdom.
6. Estilos y `build:css`.
7. D-T1, si se aprueba.
8. `CLAUDE.md` §1, §5 y §11, el README y la nota en REQ-F-010.
9. `typecheck`, `lint`, `test` y la revisión del diff.

### Criterios de finalización

CA-1 a CA-13 cubiertos por pruebas automáticas. CA-5, CA-6 y CA-14 comprobados además en el navegador. `npm run build:css`, `typecheck`, `lint` y `test` en verde. Sin cambios en `deploy/`, la CSP ni las variables de entorno.

## Implementation Result

### Rama

`feature/REQ-F-028-birria-index-modales-entre-semana`, creada desde `main` en d2a7258. Sin commits.

### Cambios realizados

- **`/` siempre Birria:** `src/controllers/landing.ts` fija Birria en `/` y calcula el aviso con `getHomeNotice()`, una función nueva en `src/services/business-schedule.ts`: lunes `rest`, martes a viernes `molotes`, fin de semana `null`. Con `NODE_ENV=development` acepta `?dia=` (D-T2), validado por `parseForcedDay()` contra una lista cerrada. `getActiveBusinessId` no cambia (la siguen usando el bot y `/admin`).
- **Vista:**
  - `renderLandingPage` acepta `homeNotice`. `buildBirriaBody` pinta un `<dialog>` cerrado con `aria-labelledby`.
  - Parciales nuevos: `partials/birria/home-notice.html` y las dos acciones (`home-notice-molotes-action.html` y `home-notice-rest-action.html`).
  - El hueco `{{{ homeNotice }}}` va al final de `pages/birria.html`: sin aviso, el HTML de `/birria` queda idéntico al de las snapshots.
- **Contenido:** `homeNotices` en `src/content/birria/index.ts` lleva los textos aprobados y reutiliza el logo `/img/molotes/logo-molotes.webp` con el texto alternativo "Molotes".
- **JS:** `public/js/modules/home-notice.js`, cargado desde `public/js/birria/main.js`.
  - Usa `showModal()` y una marca en `sessionStorage` por aviso, guardada al abrirlo y protegida con `try/catch`.
  - "Cerrar" llama a `close()` y Escape lo resuelve el navegador.
  - Cierra el aviso en `pagehide`, para que "atrás" no lo devuelva abierto.
  - No lo abre si la persona ya desplazó la página o movió el foco (D-T4), ni si el navegador no implementa `showModal`.
- **Estilos** con los tokens de los DESIGN.md: `#3d2621`, borde superior de 1.5px `#c2410c`, la sombra de modal, `rounded-2xl` (16px), fondo de detrás `black/75`, ancho `calc(100%-2rem)` con `max-w-md`, alto máximo `100dvh-2rem` con desplazamiento y foco ámbar visible.
- **Iconos (D-T1):** `/favicon.ico` y `/apple-touch-icon*.png` sirven siempre los de Birria (`src/controllers/icons.ts`, que ya no depende del reloj; `src/routes/index.ts`).
- **Documentación:**
  - `.claude/CLAUDE.md` §1, §5 y §11 reescritas.
  - `restaurante/README.md`: estado, negocios, tabla HTTP, el aviso y `?dia`, y los iconos.
  - `restaurante/docs/desarrollo.md`: URL `?dia=`.
  - Nota en REQ-F-010 D-2: sustituida por REQ-F-028.
- **Sin cambios** en `restaurante/deploy/`, la CSP, `.env.example` ni el Dockerfile.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `app.test.ts` (sábado y domingo sin aviso) y `home-notice.test.ts` |
| CA-2 | Cumple | `app.test.ts` y `home-notice.test.ts` (textos, un único enlace a `/molotes`, `alt` "Molotes") |
| CA-3 | Cumple | `app.test.ts` y `home-notice.test.ts` |
| CA-4 | Cumple | `app.test.ts`: `/birria` y `/molotes` sin `<dialog>` ningún día, también con `?dia` |
| CA-5 | Cumple en automático (cierre con "Cerrar"); el foco y Escape reales quedan para el navegador | `home-notice.test.ts` |
| CA-6 | Pendiente de verificar en el navegador | Comportamiento nativo de `showModal()` (D-T3) |
| CA-7 | Cumple | Marca por sesión y `pagehide` (`home-notice.test.ts`) |
| CA-8 | Cumple | `sessionStorage` que lanza al leer, al escribir y al acceder |
| CA-9 | Cumple | `<dialog>` sin `open` (`app.test.ts`); sin JS el navegador no lo muestra |
| CA-10 | Cumple | `<title>`, `og:title`, canónica `/birria` y script de Birria los 5 días probados |
| CA-11 | Cumple | Lunes 23:30 CDMX = martes UTC (unitaria e integración) |
| CA-12 | Cumple | Los textos no aparecen en las plantillas ni en el JS; salen de `homeNotices` |
| CA-13 | Cumple | `?dia` con los 7 días en desarrollo; ignorado en `test` y `production`, con valores no válidos o repetidos |
| CA-14 | Pendiente de verificar en el navegador (320 px, contraste, foco) | Clases aplicadas y compiladas |

### Validaciones ejecutadas

- `npm run build:css`: correcto; las clases del modal están en `public/css/birria/main.css`.
- `npm run typecheck`: 0.
- `npm run lint`: 0, sin errores ni avisos.
- `npm test`: 79 archivos y 1579 pruebas en verde, 1 fallo esperado (el que ya existía).
- Servidor local de desarrollo (`scripts/dev-server.ts`, puerto 3123):
  - `/` (miércoles real) da Birria con el aviso `molotes`.
  - `?dia=lunes` da `rest`, `?dia=martes` da `molotes` y `?dia=sabado` no lleva aviso.
  - `/birria?dia=lunes` no lleva `<dialog>`.
  - Responde `Cache-Control: no-cache` y la CSP no cambió.

### Archivos afectados

- Código: `restaurante/src/services/business-schedule.ts`, `src/controllers/landing.ts`, `src/controllers/icons.ts`, `src/routes/index.ts`, `src/views/landings/index.ts`, `src/views/landings/birria.ts`, `src/views/pages/birria.html`, `src/views/partials/birria/home-notice*.html` (3 nuevos), `src/content/birria/index.ts`, `public/js/modules/home-notice.js` (nuevo) y `public/js/birria/main.js`.
- Pruebas: `restaurante/tests/unit/business-schedule.test.ts`, `tests/unit/home-notice.test.ts` (nuevo), `tests/integration/app.test.ts` y `tests/integration/icons.test.ts`.
- Documentación: `.claude/CLAUDE.md`, `restaurante/README.md`, `restaurante/docs/desarrollo.md` y `.claude/docs/done/REQ-F-010-horarios-reales-molotes-birria.md`.

### Riesgos o pendientes

- jsdom no implementa `<dialog>`: Escape, la trampa de foco nativa, la vuelta del foco, la vista a 320 px y el contraste quedan para revisarlos en un navegador real (QA).
- El ticket no estaba versionado en `backlog/` (era un archivo sin seguimiento), así que se movió con `mv`, no con `git mv`.

## QA Action Plan

### Objetivo
Validar con evidencia que `/` es siempre Birria, que el aviso correcto aparece una vez por sesión y es accesible, y que no hay regresiones en `/birria`, `/molotes`, iconos ni el CTA de WhatsApp.

### Requisito bajo prueba
REQ-F-028 (RN-1 a RN-6, CA-1 a CA-14) y las decisiones D-T1 a D-T4.

### Criterios de aceptación (→ pruebas)
| CA | Automática | Navegador |
| --- | --- | --- |
| CA-1 | `app.test.ts` sábado/domingo | N1 (`?dia=sabado`, `?dia=domingo`) |
| CA-2 | `app.test.ts`, `home-notice.test.ts` | N2 (textos, un único enlace a `/molotes`, `alt`) |
| CA-3 | `app.test.ts`, `home-notice.test.ts` | N3 |
| CA-4 | `app.test.ts` | N4 (`/birria?dia=lunes`, `/molotes?dia=martes`) |
| CA-5 | `home-notice.test.ts` (Cerrar) | N5 (Escape y "Cerrar"; `document.activeElement` tras cerrar) |
| CA-6 | — (jsdom no implementa `<dialog>`) | N6 (Tab y Mayús+Tab recorren solo el diálogo, D-T3) |
| CA-7 | `home-notice.test.ts` | N7 (recarga, "atrás" desde `/molotes`) |
| CA-8 | `home-notice.test.ts` (sessionStorage que lanza) | — |
| CA-9 | `app.test.ts` (`<dialog>` sin `open`) | N8 (HTML del servidor sin JS: `curl` + vista sin JS si la extensión lo permite) |
| CA-10 | `app.test.ts` | S1 (`curl`: `title`, description, `og:*`, canónica, un `h1`) |
| CA-11 | `business-schedule.test.ts`, `app.test.ts` | — |
| CA-12 | Revisión: textos solo en `src/content/birria/index.ts` (grep en plantillas y JS) | — |
| CA-13 | `app.test.ts` (development / test / production) | N1–N3 con `?dia=` en dev |
| CA-14 | — | N9 (320 px), N10 (contraste AA), N6 (foco visible) |

### Riesgos identificados
- jsdom no cubre `<dialog>`: CA-5 (Escape y foco de retorno), CA-6 y CA-14 dependen solo del navegador.
- El Implementation Result reporta "1 fallo esperado (el que ya existía)" en `npm test`. QA solo aprueba con la suite completa en verde: se identificará el fallo y se comprobará en `main` si es previo. Si lo es y es ajeno al ticket, se devolverá como decisión del usuario.
- D-T4: con la página cargada en local, el aviso podría no abrirse si el foco o el scroll cambian antes de que se ejecute el módulo (riesgo de falso negativo en las pruebas).
- "Atrás" con bfcache: el aviso podría reaparecer abierto (RN-6).
- D-T1: el favicon cambia a Birria entre semana; la regresión alcanza a `/admin`, que no debe cambiar.
- El plan técnico mencionaba casos en `landing.test.ts` y `landing-snapshot.test.ts` (CA-12 con contenido modificado, escape) que no aparecen en el diff: se verificará si existe la cobertura.

### Pruebas funcionales
F1. `curl` contra el servidor de desarrollo para los 7 valores de `?dia=` y sin `?dia=`: `data-business="birria"` y `data-home-notice` esperado (lunes `rest`, martes a viernes `molotes`, sábado y domingo ninguno).
F2. Variante "Molotes": un único `<a href="/molotes">` con `<img alt="Molotes">` y "¡Ordenar ya!". Variante "rest": enlace "Mañana hay molotes" y botón "Cerrar".

### Pruebas negativas y casos límite
- `?dia=` no válido, en mayúsculas o repetido: se ignora sin error (HTTP 200).
- `?dia=` con `NODE_ENV=production` (cubierto en `app.test.ts`; no se levanta producción).
- CA-8 y CA-11: solo automáticas.
- D-T4: desplazarse antes de que cargue el módulo no abre el aviso (automática en `home-notice.test.ts`).

### Pruebas responsive
375×812, 768×1024 y 1440×900, más 320 px de ancho (CA-14) con el aviso abierto: se ve entero, sin overflow horizontal, el botón y el enlace son alcanzables y hay desplazamiento interno si no cabe. Con el aviso cerrado, `/` sin overflow horizontal.

### Pruebas de accesibilidad
- N5: Escape y "Cerrar" cierran el aviso; el foco vuelve al documento (no queda en un elemento oculto).
- N6: Tab y Mayús+Tab ciclan solo entre el enlace y "Cerrar" (o el navegador); foco inicial dentro del diálogo; anillo de foco visible.
- `aria-labelledby` apunta al `h2` existente; un solo `h1` en la página; el `h2` del aviso no rompe la jerarquía.
- N10: contraste AA de título, párrafo, enlace y botón contra `#3d2621` (estilos computados y cálculo de ratio).

### Pruebas UX/UI (vs. _stich_source_/)
Tokens declarados (fondo `#3d2621`, borde superior `#c2410c`, `rounded-2xl`, fondo de detrás `black/75`) comparados con los DESIGN.md de Birria en `_stich_source_/`. Captura de cada variante en 375 y 1440.

### Pruebas de integración (WhatsApp)
En `/`, `/birria` y `/molotes`: el CTA es visible, el `href` usa `wa.me`/`WHATSAPP_*` con el número y `text` codificado, y tiene `target` y `rel` correctos. No se sigue el enlace.

### Pruebas de performance
- Consola sin errores en `/`, `/birria` y `/molotes`.
- Peticiones de red: el módulo `home-notice.js` es la única petición nueva y el logo de Molotes solo se pide si el aviso es "molotes".
- `/` sigue con `Cache-Control: no-cache`.

### Pruebas SEO
S1. `/` (lunes, martes, sábado): `title`, meta description, viewport, canónica y `og:*` de Birria; contenido completo de Birria en el HTML del servidor (CA-10).

### Pruebas de regresión
- `/birria` sin cambios (snapshots) y `/molotes` sin aviso, con horarios y CTA intactos (lunes "Cerrado por nixtamal" en `/molotes`).
- `/favicon.ico` y `/apple-touch-icon*.png` = Birria cualquier día; favicon de `/admin` sin cambios.
- Consumidores de los símbolos modificados (Grep, CodeGraph no devolvió resultados): `src/views/admin/index.ts`, `tests/unit/{landing,landing-snapshot,landing-dom,icons,business-hours,business-schedule,home-notice}.test.ts`, `tests/integration/{app,icons}.test.ts`.
- Bot y `getActiveBusinessId` sin cambios: la suite completa.

### Pruebas automatizadas
- `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test` (con `npm run db:up`).
- No se crean pruebas nuevas, salvo una prueba en `tests/unit/landing.test.ts` para CA-12 (contenido modificado → texto nuevo en el aviso, y escape HTML) si la revisión confirma que falta. Solo en `restaurante/tests/`.

### Pruebas en navegador (Claude in Chrome, `npm run dev`, puerto 3000)
N1–N4 según la tabla. N5–N6 con teclado real. N7: abrir `/?dia=martes`, recargar (no reaparece); ir a `/molotes` desde el aviso y pulsar "atrás" (no reaparece ni vuelve abierto); `/?dia=lunes` en la misma pestaña sí muestra "rest" (RN-5); borrar `sessionStorage` reproduce una sesión nueva. N8: sin JS. N9–N10 a 320 px y contraste. Pestaña nueva; se cierra al terminar y se detiene el servidor.

### Evidencia requerida
Salida de los cuatro comandos, respuestas `curl` (cabeceras y fragmentos), valores de `document.activeElement` y `sessionStorage`, estilos computados y ratios de contraste, capturas por variante y viewport, y la consola.

### Criterios de aprobación
CA-1 a CA-14 en PASS con evidencia; `npm test` completo en verde (o el fallo previo aceptado por el usuario); typecheck, lint y build:css a 0; sin defectos BLOCKER o CRITICAL ni MAJOR sin decisión; sin regresiones en `/birria`, `/molotes`, iconos, `/admin` ni WhatsApp.

## QA Report

### Ronda
1 (2026-10-14). QA Action Plan aprobado por el usuario ("Aprobar").

### Pruebas ejecutadas
- `npm run db:up`: 0. `npm run build:css`: correcto. `npm run typecheck`: 0. `npm run lint`: 0, sin errores ni avisos.
- `npm test`: 79 archivos; 1579 pasan y 1 "expected fail", el `it.fails` intencional de `tests/integration/local-server.test.ts:87`. Ningún fallo real.
- `npm run dev` (puerto 3000, `NODE_ENV=development`, `America/Mexico_City`; miércoles real): pruebas con `curl` y Chrome. El servidor se detuvo al terminar.
- No se crearon ni modificaron pruebas. CA-12 ya está cubierto en `tests/unit/home-notice.test.ts`: los textos no están en las plantillas ni en el JS, salen de `homeNotices` y se escapan.

### Criterios de aceptación
| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | `?dia=sabado` y `?dia=domingo`: `data-business="birria"`, sin `data-home-notice` (curl); 0 `<dialog>` en Chrome |
| CA-2 | PASS | `?dia=martes`: modal abierto (`:modal`), título correcto, un único enlace `/molotes` con "¡Ordenar ya!" e `img alt="Molotes"` |
| CA-3 | PASS | `?dia=lunes`: "¡Los lunes descansamos!", "Mañana hay molotes" a `/molotes` y "Cerrar" (captura) |
| CA-4 | PASS | `/birria` y `/molotes` con `?dia=lunes` y `?dia=martes`: 0 `<dialog>` (curl y Chrome) |
| CA-5 | PASS | Escape → `open=false`, foco en `BODY`; clic en "Cerrar" → `open=false`, foco fuera del diálogo |
| CA-6 | PASS | Tab: enlace → Cerrar → (barra del navegador, `activeElement=BODY`) → enlace. Mayús+Tab: navegador → Cerrar → enlace. Nunca llega a un control de la página (D-T3) |
| CA-7 | PASS | Al recargar `/?dia=martes` no se abre. Desde el modal → `/molotes` → "atrás": `open=false` y sin `:modal`. Sesión nueva (`sessionStorage` vacío) → se abre |
| CA-8 | PASS | `home-notice.test.ts` (sessionStorage que lanza al leer, al escribir y al acceder) |
| CA-9 | PASS | iframe con `sandbox` sin scripts: el `<dialog>` tiene `display:none`, el `h1` es el elemento visible en el centro y la captura muestra el hero completo |
| CA-10 | PASS | `/?dia=martes`: `title`, description, viewport, canónica `/birria` y `og:*` de Birria; un `h1`; HTML del servidor completo |
| CA-11 | PASS | `business-schedule.test.ts` y `app.test.ts` (lunes 23:30 CDMX → `rest`) |
| CA-12 | PASS | `home-notice.test.ts` (textos desde el contenido, ausentes de las plantillas y del JS, escape) |
| CA-13 | PASS | Los 7 días en dev dan el aviso esperado; `LUNES`, `xx` y `dia` repetido se ignoran (200, aviso del día real); `test` y `production` cubiertos en `app.test.ts` |
| CA-14 | PASS | 320×568: diálogo de 288×476 (martes) y 288×400 (lunes), entero y sin overflow; contraste y foco en las secciones de abajo |

### Defectos encontrados
Ninguno.

### Regresión
- Toda la suite de pruebas en verde (la de `/birria` incluida).
- `/favicon.ico` y `/apple-touch-icon.png` un miércoles = los de Birria (shasum igual a `img/birria/icons/*`). `/admin/login` sigue con el favicon de Molotes (`src/views/admin/index.ts` sin cambios).
- `/` responde con `Cache-Control: no-cache` y la CSP no cambia.
- WhatsApp: `/` y `/birria` tienen 5 CTA y `/molotes` 4, todos `https://wa.me/<número>?text=<codificado>` con `target="_blank"` y `rel="noopener noreferrer"`. El CTA se ve sin desplazarse a 375 px.

### Responsive
320×568, 375×812, 768×1024 y 1440×900 con las dos variantes: diálogo entero, sin desplazamiento interno ni overflow horizontal en el documento. Controles de 240 a 384 px de ancho y 40 a 60 px de alto.

### Accesibilidad
- `aria-labelledby` → `h2#home-notice-title`; un solo `h1`.
- Foco inicial en el enlace del diálogo.
- Foco visible con teclado: contorno ámbar `rgb(251,191,36)` sólido (`:focus-visible`), con un contraste de 8.4:1 contra el fondo.
- Contraste AA contra `#3d2621`: título 8.4:1 (30px), párrafo 11.75:1, "Cerrar" 13.31:1. Texto del botón ámbar (`#4a0808`) contra los extremos del degradado: 7.36:1 y 7.4:1.

### UX/UI
Los tokens coinciden con `_stich_source_/birrier_a_el_mu_eco/DESIGN.md`: borde de 1.5px `#c2410c`, fondo `#3d2621`, `rounded-2xl` y CTA ámbar. Capturas de las dos variantes en escritorio y a 320 px.

### Performance
- Consola sin errores ni avisos.
- Sale una sola petición nueva de JS (`/js/modules/home-notice.js`). El logo de Molotes solo se pide cuando el aviso es "molotes".
- Observación sin defecto: `logo-molotes.webp` pesa 86 KB (461×512) y se muestra a 40 px de alto. Es un asset existente, reutilizado según el plan aprobado.

### SEO
Ver CA-10. El `h2` del aviso va al final del documento y no rompe la jerarquía.

### Pendientes de revisión manual
Ninguno.

### Resultado final
QA_APPROVED

## Cierre

- **Merge:** PR #45 (https://github.com/orvigas/negocio/pull/45), mergeado a `main` por el usuario ("Merge hecho") con el commit d1d2286, el 2026-10-14.
- **Despliegue:** ejecución https://github.com/orvigas/negocio/actions/runs/38569723704, con todos los jobs en success. Desplegado el 2026-10-14T13:22:35Z; la app está healthy.
- **Verificación en producción** (hecha por la sesión principal):
  - `/` muestra Birria con `data-home-notice="molotes"` (miércoles).
  - `/birria` y `/molotes` no muestran el modal.
  - `?dia=lunes` se ignora en producción.
  - `/js/modules/home-notice.js` y `/favicon.ico` responden 200.

## Trazabilidad

| Objetivo | Requisitos | Historia | Criterios |
| --- | --- | --- | --- |
| Birria como índice | RF-1, RF-4 | — | CA-1, CA-4, CA-10 |
| Modal de martes a viernes | RF-2, RF-5 | HU-1 | CA-2 |
| Modal de lunes | RF-2, RF-6 | HU-2 | CA-3 |
| Accesibilidad | RF-7 | HU-3 | CA-5, CA-6, CA-14 |
| Una vez por sesión | RF-8, RN-5, RN-6 | — | CA-7, CA-8 |
| Zona horaria y forzado del día | RF-2, RF-3, RF-11 | — | CA-11, CA-13 |
| Textos editables | RF-9 | — | CA-12 |
| Sin JavaScript | RF-10 | — | CA-9 |

El diseño del modal sale de los tokens de los DESIGN.md (excepción aprobada a `CLAUDE.md` §3).

## Historial de cambios

### Versión 1

Descripción inicial. Sustituye REQ-F-010 D-2 ("el lunes se muestra Molotes") y autoriza reescribir las secciones §1, §5 y §11 de `CLAUDE.md`. RN-5 y RN-6 quedan confirmadas.

Aprobada por el usuario el 2026-10-14 con la respuesta textual: "Aprobar todo".

### Revisión técnica (senior-fullstack, 2026-10-14)

Se agrega el Technical Action Plan con las decisiones técnicas D-T1 a D-T4. Estado: NEEDS_TECHNICAL_PLAN_APPROVAL.

### Implementación (senior-fullstack, 2026-10-14)

Plan aprobado por el usuario ("Aprobar"; D-T1 "Siempre Birria", D-T2 "/?dia=lunes", D-T3 y D-T4 según la recomendación). Rama `feature/REQ-F-028-birria-index-modales-entre-semana`; el ticket pasa a `in-progress/`. Implementación terminada, sin commits. Estado: NEEDS_IMPLEMENTATION_APPROVAL.

### QA Action Plan (senior-qa, 2026-10-14)

Implementación aprobada por el usuario ("Aprobar"). Se agrega el QA Action Plan. Estado: NEEDS_QA_PLAN_APPROVAL.

### QA ronda 1 (senior-qa, 2026-10-14)

QA Action Plan aprobado por el usuario ("Aprobar"). Pruebas ejecutadas; CA-1 a CA-14 en PASS y sin defectos. Estado: QA_APPROVED.

### Pull Request (senior-fullstack, 2026-10-14)

Commit 59a3620 y PR #45 (https://github.com/orvigas/negocio/pull/45) contra `main`. CI en verde: `calidad`, `docker` y `despliegue`. Estado: READY_FOR_MERGE.

### Cierre (senior-fullstack, 2026-10-14)

PR #45 mergeado (d1d2286) y desplegado (ejecución 38569723704). Verificado en producción. El ticket pasa a `done/`. Estado: DONE.
