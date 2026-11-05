# REQ-F-042 — Mover el bot de WhatsApp de `landing-pages` a `api`

## Estado

Los tres PR están mergeados en `epic/arquitectura`: #121, #124 y #126 (merge `16acc18`). El ticket sigue en `in-progress/` hasta las comprobaciones de producción (CA-1 a CA-3, CA-9, memoria en el VPS y certificado real), que dependen del despliegue de la épica. No está en `DONE`.

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-10-30). Cita textual: "si".

Paso 4, ticket 3 del plan de migración (`restaurante/docs/arquitectura.md` §8, "Plan del paso 4 (REQ-F-039)"). Los PR de este ticket van a `epic/arquitectura` (`.claude/rules/git.md`).

## Decisiones del usuario

- **D-1 — URL del webhook:** "Conservar la actual (Recomendado)". Se conserva `https://birriaelmuneco.com/webhooks/whatsapp`; un router de Traefik acotado a esa ruta la envía a `api`. Sin acción en Meta.
- **D-2 — Página "Bot" de `/admin` hasta el ticket 4:** "Casi todo, sin la lista de topes (Recomendado)". Se conservan la pausa, los bloqueos y el uso y gasto (leídos de la base). La lista "Números que alcanzaron un tope hoy" y su botón se sustituyen por un aviso hasta el ticket 4.
- **D-3 — Bot en producción:** "Activo, cualquier momento". El bot está activo en producción; el despliegue no requiere una ventana especial.
- **D-4 — Configuración en la transición:** "Sí, del mismo .env (Recomendado)". `landing-pages` recibe también, del mismo `.env`, la clave de la lista negra, los números del personal y los topes.

## Objetivo

Sacar el bot de WhatsApp de `landing-pages` y llevarlo a `api` como un cliente más de `core`, sin cambiar lo que vive el cliente por WhatsApp ni el personal. Al terminar, `landing-pages` conserva las landings, los CTA (`WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA`) y el `/admin` en transición, y la regla de lint impide que el bot vuelva a `landing-pages`.

## Alcance

RF-1 a RF-14.

## Fuera de alcance

- Control del bot en el admin nuevo (ticket 4), incluida la lista "Números que alcanzaron un tope hoy".
- Retirada del `/admin` actual (ticket 6).
- Guardar los pedidos como ventas (paso 5).
- Cambios de conversación o de textos del bot.
- Cambiar la URL del webhook en Meta.
- Corregir el texto "L-V Moloteando, S-D Birria" de `restaurante/README.md` (desfasado respecto a `.claude/CLAUDE.md`; este ticket no cambia cómo el bot elige el negocio).

## Requisitos

- **RF-1 Ubicación.** El bot (orquestador, proveedores Meta y Twilio, protección, uso, mantenimiento, contenido propio del bot y simulador de conversación) se ejecuta en `api`. `landing-pages` deja de contener código del bot y de atender el webhook.
- **RF-2 Comportamiento sin cambios.** Conversación, textos, horario, carrito, forma de pago, avisos al personal, plantilla `nuevo_pedido`, deduplicación, firma, topes, lista negra y pausa se comportan igual que hoy. Las pruebas actuales del bot siguen pasando, trasladadas a `api`.
- **RF-3 Entrada pública mínima.** Desde Internet, de `api` solo es alcanzable la ruta del webhook (`GET` de verificación y `POST` de entregas). `/api/v1/public` y `/api/v1/admin` siguen inalcanzables desde fuera. La IP del visitante se toma del último valor de `X-Forwarded-For` (el que añade Traefik).
- **RF-4 URL del webhook (D-1).** Se conserva `https://birriaelmuneco.com/webhooks/whatsapp`, con el mismo App Secret y verify token. El router del dominio raíz deja de enviar esa ruta a `landing-pages`; el resto de rutas del dominio no cambia.
- **RF-5 Sin bot configurado.** `api` arranca igual y el webhook responde 503 `BOT_DISABLED`, como hoy.
- **RF-6 Configuración (D-4).**
  - `api` recibe `WHATSAPP_BOT_*`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_BOT_BLOCKLIST_KEY(_PREVIOUS)`, `BOT_LIMIT_*`, `BOT_*` y lo que el bot necesite de `WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA`, con las mismas validaciones de arranque que hoy (Twilio prohibido en producción, clave obligatoria con el bot, D-6).
  - Durante la transición, `landing-pages` recibe también, del mismo `.env`, la clave de la lista negra (actual y anterior), los números del personal, los topes y lo necesario para mostrar si el bot está habilitado y con qué proveedor.
  - Un solo `.env` en el VPS; el usuario no duplica valores a mano.
- **RF-7 Contenido compartido.** Los horarios que muestran las landings y los que usa el bot tienen una sola fuente; editarla cambia ambos. Textos, vocabulario y cuenta bancaria del bot viajan con el bot. La ubicación exacta la decide `senior-fullstack`.
- **RF-8 Página "Bot" del `/admin` actual hasta el ticket 4 (D-2).**
  - Se conservan la pausa y reanudación con motivo, el alta y baja manual de bloqueos y la lista de bloqueados.
  - El uso y el gasto del día y del mes se leen de la base al cargar la página, de modo que reflejan lo registrado por `api`.
  - El estado "Habilitado (Meta)/Desactivado" sigue siendo correcto.
  - La lista "Números que alcanzaron un tope hoy" y su botón "bloquear" se sustituyen por un aviso de que vuelven con el control del bot en el admin nuevo. La ruta de ese botón (`/admin/bot/topes/<token>/bloquear`) deja de bloquear números.
- **RF-9 Propagación del control.** Una pausa, reanudación, alta o baja hecha en `/admin` se aplica en el bot de `api` como mucho `BOT_CONTROL_REFRESH_SECONDS` después (10 s por defecto), sin reiniciar nada.
- **RF-10 Catálogo fresco.** Tras una escritura confirmada de productos en el admin nuevo, el siguiente mensaje al bot usa el catálogo nuevo, sin esperar la recarga de 60 s. El aviso "La landing y el bot ya muestran el cambio" sigue siendo verdad.
- **RF-11 Mantenimiento único.** Las caducidades y la retención del control del bot corren en un solo proceso, sin auditorías duplicadas.
- **RF-12 Regla de dependencias.** Se elimina la "REGLA DE TRANSICIÓN — TEMPORAL" de `restaurante/eslint.config.ts` para el bot: `npm run lint` impide que el código del bot vuelva a `landing-pages`. La excepción de `/admin` sigue hasta el ticket 6.
- **RF-13 Despliegue y vuelta atrás.** El corte puede desplegarse en cualquier momento (D-3). No pierde entregas de Meta (Meta reintenta las que no reciben 200) y no procesa dos veces un mensaje ya respondido. La vuelta atrás a la versión anterior devuelve también el enrutamiento del webhook a `landing-pages`; nunca queda el webhook apuntando a un proceso sin bot.
- **RF-14 Documentación.** Se actualizan:
  - `restaurante/docs/arquitectura.md`: §1, §4, §6, §8 ticket 3 (con REQ-F-042 y la URL conservada), §9 D-3 y §10 (memoria de `api` y nuevo estado en memoria: conversaciones del bot).
  - `restaurante/docs/despliegue.md`: webhook sin cambio en Meta, variables, comprobaciones, frescura de la CA-9, problemas frecuentes y vuelta atrás.
  - `restaurante/README.md`: "Bot de WhatsApp", desarrollo con túnel y Twilio apuntando a `api`, y el simulador.
  - Los `.env.example` de `api` y `landing-pages` y `deploy/env.production.example`.

## Historias de usuario

- **HU-1.** Como cliente, quiero seguir pidiendo por WhatsApp igual que antes, para no notar el cambio.
- **HU-2.** Como administrador, quiero pausar el bot y bloquear o desbloquear números desde `/admin` mientras llega el admin nuevo, para no perder el control ante abusos.
- **HU-3.** Como dueño, quiero ver en `/admin` el uso y el gasto reales del bot, para no pasarme del presupuesto.
- **HU-4.** Como responsable técnico, quiero que desde Internet solo se alcance el webhook de `api`, para no exponer la administración.

## Reglas de negocio

- **RN-1.** Un solo bot para los dos negocios; el negocio lo decide el servidor con `BUSINESS_TIMEZONE`, sin cambios.
- **RN-2.** D-6: con el bot, los CTA de las dos landings usan el número del bot.
- **RN-3.** Twilio prohibido en producción; la clave de la lista negra es obligatoria con el bot.
- **RN-4.** Los números del personal no se pueden bloquear.
- **RN-5.** Clave, personal y topes son idénticos en `api` y `landing-pages` porque salen del mismo `.env`.

## Criterios de aceptación

- **CA-1.** Dado el bot configurado en `api`, cuando Meta verifica la suscripción en `https://birriaelmuneco.com/webhooks/whatsapp` con el token correcto, entonces responde el challenge; con un token incorrecto, la misma respuesta de error que hoy.
- **CA-2.** Dado un `POST` firmado a esa URL, entonces lo atiende `api` (`bot_provider_selected` en el log de `api`, no en el de `app`) y el cliente recibe la misma respuesta que hoy. Sin firma válida, el mismo error que hoy y `bot_webhook_signature_invalid`.
- **CA-3.** `https://birriaelmuneco.com/api/v1/admin/...`, `/api/v1/public/...` y cualquier ruta que no sea el webhook no llegan a `api` (comprobado en los logs de `api`). `/`, `/molotes`, `/birria` y `/admin` responden como antes.
- **CA-4.** Dado el bot sin configurar en `api`, el webhook responde 503 `BOT_DISABLED` y las landings y los dos admin funcionan.
- **CA-5.** Dada una pausa en `/admin`, cuando llega un mensaje más de 10 s después (valor por defecto), `api` lo descarta. Lo mismo con un número bloqueado; con uno desbloqueado, se atiende.
- **CA-6.** Dado un envío del bot desde `api`, cuando el administrador recarga "Bot" en `/admin`, los contadores del día y del mes lo incluyen.
- **CA-7.** La página "Bot" de `/admin` muestra pausa, bloqueos y uso y gasto. No muestra la lista "Números que alcanzaron un tope hoy" ni su botón, sino el aviso de que vuelven en el admin nuevo. Un `POST` a la ruta de ese botón no bloquea ningún número.
- **CA-8.** El alta manual de un número válido en `/admin` funciona y el bot de `api` lo bloquea (CA-5). Intentar bloquear un número del personal da el mismo error que hoy.
- **CA-9.** Un producto marcado como no disponible en el admin nuevo deja de ofrecerse en el siguiente mensaje al bot.
- **CA-10.** Si se agrega a `landing-pages` código del bot o un import suyo, `npm run lint` falla. La regla de transición ya no menciona el bot.
- **CA-11.** El simulador de conversación corre desde `api` con Meta y con Twilio, con su comando documentado.
- **CA-12.** Con una variable del bot obligatoria ausente o inválida (clave, D-6, Twilio en producción), `api` no arranca y da el mismo mensaje que hoy daba `landing-pages`. `landing-pages` ya no exige las variables del bot que no usa.
- **CA-13.** Las caducidades vencidas se auditan una sola vez.
- **CA-14.** Tras una vuelta atrás con `deploy.sh` a la versión anterior, el webhook responde desde `landing-pages` (verificación `GET` correcta).
- **CA-15.** `npm run typecheck`, `npm run lint` y `npm test` en verde, sin archivos de prueba de más de 20 s en el CI. CI completo (`calidad`, `docker`, `auditoria`) en verde en el PR hacia `epic/arquitectura`.
- **CA-16.** La documentación de RF-14 está actualizada y no describe el bot dentro de `landing-pages`.

## Casos límite

- Mensajes durante el corte: Meta reintenta lo que no recibió 200. Las conversaciones a medias se pierden, como en cualquier despliegue (aceptado, D-3).
- MySQL caído: el bot de `api` sigue con la última copia del control; `/admin` muestra el aviso de base no disponible.
- Cambio de día o de mes en los contadores según `BUSINESS_TIMEZONE`, igual en ambos procesos.
- Rotación de la clave de la lista negra: `KEY` y `KEY_PREVIOUS` llegan iguales a los dos procesos (RN-5).
- Un reinicio de `api` corta a la vez las sesiones del admin nuevo, el límite de intentos y las conversaciones del bot.
- Desarrollo local: el túnel y `WHATSAPP_BOT_WEBHOOK_URL` (Twilio) apuntan a `api`; la ruta `/webhooks/whatsapp` no cambia.

## Dependencias

- PR #120 (`main` → `epic/arquitectura`) mergeado antes de empezar.
- Reinstalar `deploy/` en el VPS si cambia (el job `deploy` falla con el código 4): acción del usuario.
- Ninguna acción en Meta.

## Riesgos

- Vuelta atrás incompleta (imágenes revertidas, router no): webhook apuntando a un `api` sin bot (RF-13, CA-14).
- Regla de Traefik demasiado amplia que exponga `/api/v1/admin` (CA-3).
- Pérdida temporal de la lista de topes de hoy en `/admin` hasta el ticket 4 (aceptada, D-2).
- Más memoria en `api` por el bot (medición actual 31,5 %): conviene medir tras el despliegue.

## Action Plan

### Objetivo

Bot en `api`, webhook público con la misma URL y acotado a esa ruta, `landing-pages` sin bot y regla de lint activa, sin cambios de comportamiento.

### Alcance

RF-1 a RF-14.

### Fuera de alcance

El indicado en "Fuera de alcance".

### Cambios requeridos

1. Llevar a `api` el bot: protección, uso, mantenimiento, contenido propio, configuración validada, simulador y pruebas.
2. Fuente única de horarios para las landings y el bot.
3. Router de Traefik en el dominio raíz acotado a `/webhooks/whatsapp` hacia `api`, y `api` conectado a la red de Traefik.
4. Página "Bot" de `/admin` según RF-8 (uso leído de la base y aviso en lugar de la lista de topes).
5. Variables en `deploy/` según RF-6, del mismo `.env`.
6. Quitar de `landing-pages` el webhook, la recarga del catálogo del bot y las variables que ya no use.
7. Mantenimiento del control en un solo proceso.
8. Eliminar la regla de transición para el bot y añadir la restricción.
9. Vuelta atrás que incluya el enrutamiento.
10. Documentación de RF-14.

### Reglas de negocio

RN-1 a RN-5.

### UX/UI

Sin cambios para el cliente. En `/admin` → "Bot": aviso en lugar de la lista de topes de hoy; uso y gasto actualizados.

### Integraciones

Meta Cloud API con la misma URL, App Secret y verify token.

### Casos límite

Los de la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-16.

### Dependencias

Las de la sección "Dependencias".

### Riesgos

Los de la sección "Riesgos".

### Orden recomendado

1. Contenido y horarios compartidos.
2. Bot en `api`, con pruebas y configuración.
3. `/admin` en la transición.
4. Retirada del bot de `landing-pages` y lint.
5. `deploy/` (router, red, variables) y vuelta atrás.
6. Documentación.
7. CI del PR hacia `epic/arquitectura`.
8. Despliegue con la épica y comprobaciones.

### Resultado esperado

Los clientes piden igual; el webhook, con la misma URL, lo atiende `api`; `/admin` sigue controlando el bot y viendo su uso real; la regla de dependencias impide la regresión.

## Revisión técnica

Revisión de `senior-fullstack` (2026-10-30) con CodeGraph sobre `landing-pages/src`, `api/src`, `packages/core` y las pruebas, y lecturas dirigidas de `deploy/`, `eslint.config.ts` y `docs/arquitectura.md`. NotebookLM no estaba disponible en la sesión del agente (sin herramientas MCP `notebooklm`): no se consultó.

Hallazgos (todos se resuelven en el plan; ninguno cambia el alcance funcional):

- **H-1. La API no tiene salida a internet.** `api` solo está en las redes `db` y `admin`, las dos `internal: true`. El bot necesita llegar a `graph.facebook.com`, así que `api` tiene que entrar en `traefik-public` (que además es por donde le llega Traefik). Consecuencia: los demás contenedores de esa red (los otros sitios del VPS) podrían llegar a `api:3001`, como hoy llegan a `app:3000` (`/admin`). `/api/v1/admin` exige sesión y `/api/v1/public` es de solo lectura. Ver P-1.
- **H-2. El refresco del control es perezoso.** `createBotControl` solo refresca la copia (pausa y bloqueos) cuando llega un mensaje y la evalúa con la copia anterior (`maybeRefresh` no espera). Hoy no importa porque el panel y el bot comparten proceso; con `/admin` en `landing-pages` y el bot en `api`, el primer mensaje tras una pausa se atendería aunque hayan pasado más de 10 s (CA-5 fallaría). El plan añade en `api` un refresco periódico cada `BOT_CONTROL_REFRESH_SECONDS`.
- **H-3. El uso del panel es el contador en memoria.** La página "Bot" muestra `usage.snapshot()` del proceso, que ya no enviará nada. El plan la hace leer `readUsage` de la base en cada carga (CA-6), sin tocar el contador del bot en `api`, que conserva sus deltas pendientes.
- **H-4. El control del bot lo usan los dos procesos.** `services/bot-control.ts`, `bot-usage.ts`, `whatsapp-bot/phone.ts` y `protection/limits.ts` los usa también `/admin` (alta manual con HMAC, personal, duraciones, topes). Para no duplicarlos van a `packages/core/bot-control`, que ya usan los dos (la regla de transición de `/admin` lo permite) y que necesitará el ticket 4.
- **H-5. Contenido compartido.** El bot lee de `landing-pages` el horario (`content/hours.ts`), los nombres de los negocios (`molotesContent.name`), el enlace de Google Maps (`commonContent.location.mapsUrl`) y `buildWhatsAppLink`/`PHONE_PATTERN` (`services/whatsapp.ts`). `api` no puede importar `landing-pages`. Van a `core` (ver "Contenido / configuración").
- **H-6. La vuelta atrás automática de `deploy.sh` usa el compose instalado.** Si falla la salud de la app nueva, `deploy.sh` arranca las imágenes anteriores con el **mismo** `compose.prod.yaml`. Un router fijo hacia `api` dejaría el webhook en una `api` sin bot (RF-13). Además, la app anterior arranca con las variables que le pase el compose nuevo: si este le quita el token o el App Secret, la app anterior no arranca (`parseChatBot` exige el conjunto completo). Ver P-2 y "Backend → Despliegue".
- **H-7. Catálogo del bot.** En `api`, el bot usa la misma instancia de `ProductRepository` que `/api/v1/admin`, y `write()` recarga su caché antes de responder: la frescura de RF-10 queda garantizada en proceso, sin aviso interno para el bot.
- **H-8. Pruebas con base de datos.** `api/tests` no tiene hoy soporte de MySQL. Las pruebas del bot usan el store en memoria y se mueven a `api`; las que necesitan MySQL (`admin-bot`, `bot-control-store`) son de `/admin` o de `packages/db` y se quedan en `landing-pages`.

### Decisiones técnicas para el usuario

- **P-1. `api` en `traefik-public` (H-1).**
  - **A (Recomendada):** `api` entra en `traefik-public` y el webhook se sirve en un **puerto propio** (3004, una app Koa que solo tiene `/webhooks/whatsapp`). El servicio de Traefik apunta a ese puerto, así que ni una regla demasiado amplia puede exponer `/api/v1/admin` desde internet (CA-3). Riesgo residual documentado: un contenedor vecino de `traefik-public` alcanza `api:3001`, como hoy alcanza `app:3000`.
  - B: un contenedor aparte para el bot con la imagen de `api`. Aísla más, pero suma un contenedor Node, separa el bot del repositorio de productos (vuelve a hacer falta el aviso de frescura) y contradice "el bot vive en `api`" (§6).
- **P-2. Variables del bot en `app` durante la transición (H-6).**
  - **A (Recomendada):** el compose sigue pasando a `app` **todas** las variables del bot que recibe hoy. La app nueva solo valida y usa las de D-4 (clave, personal, topes y proveedor) e ignora el resto (token, App Secret, verify token). Así la vuelta atrás automática puede arrancar la app anterior con su bot. Se retiran del compose en el ticket 6 (o en el siguiente cambio de `deploy/` posterior a la épica en producción).
  - B: quitar ya a `app` los secretos que no usa (mínimo privilegio). La vuelta atrás automática de la app dejaría de funcionar, porque la app anterior no arranca sin ellos. Incumple RF-13.
- **P-3. Número de PR.**
  - **A (Recomendada):** tres PR hacia `epic/arquitectura`, como REQ-F-039: (1) piezas compartidas a `core`, sin cambio de comportamiento; (2) el bot pasa a `api` (con `git mv`), `landing-pages` lo pierde, `/admin` en transición y regla de lint; (3) despliegue y documentación.
  - B: un solo PR. Más difícil de revisar: más de 6500 líneas movidas, además del despliegue.

### Decisiones técnicas tomadas (2026-10-30)

- **P-1:** "Puerto propio en api (Recomendado)".
- **P-2:** "Conservarlas hasta el ticket 6 (Recomendado)".
- **P-3:** "3 PR, apruebo (Recomendado)". El usuario aprueba el Technical Action Plan.

## Technical Action Plan

Supone las opciones recomendadas P-1 A, P-2 A y P-3 A. Si el usuario elige otra, se revisa el plan antes de implementar.

### Objetivo técnico

El bot (orquestador, proveedores, intérprete, protección, contenido propio, simulador y pruebas) vive en `api/src/bot/` y su webhook se sirve en un puerto propio de `api`, publicado por Traefik solo en `https://<dominio>/webhooks/whatsapp`. El control compartido (lista negra, pausa, uso y topes) vive en `packages/core/bot-control`, y el contenido compartido con las landings, en `core`. `landing-pages` conserva las landings, los CTA y la página "Bot" de `/admin` (D-2), y el lint impide que el bot vuelva.

### Archivos o componentes afectados

- **`packages/core`:**
  - `schedule/` gana `business-hours.ts` (`BUSINESS_HOURS`, `getBusinessHours`, `defineHours`, `BusinessHours`, `ClockTime`; los datos de `molotes/hours.ts` y `birria/hours.ts`).
  - `shared/` gana `whatsapp-link.ts` (`buildWhatsAppLink`, `PHONE_PATTERN`, `isHttpsUrl`, `MAX_MESSAGE_LENGTH`) y en `businesses.ts` los nombres visibles (`BUSINESS_NAMES`). También `branch.ts` con el enlace de Google Maps de la sucursal (`BRANCH_LOCATION.mapsUrl`).
  - `bot-control/` gana `bot-control.ts`, `bot-usage.ts`, `phone.ts`, `limits.ts` y `bot-config.ts` (lectura y validación de `WHATSAPP_BOT_BLOCKLIST_KEY(_PREVIOUS)`, `WHATSAPP_BOT_STAFF_*`, `WHATSAPP_BOT_PROVIDER` y `BOT_*`, con los mismos mensajes que hoy).
  - Todo se exporta por los `index.ts`.
- **`api`:**
  - `src/bot/` (lo que hoy es `landing-pages/src/services/whatsapp-bot/`, más `controllers/whatsapp-webhook.ts`, `services/catalog-reload.ts` y `content/{common,molotes,birria}/bot.ts` y `common/payment.ts`);
  - `src/bot/webhook-app.ts` (app Koa del puerto del webhook), `src/bot/config.ts` (la parte del bot de `loadConfig`), y cambios en `src/config.ts` y `src/server.ts`;
  - `scripts/bot-chat.ts` y `package.json` (`bot:chat`), `vitest.config.ts`, `tests/` (pruebas, fixtures `bot-golden/`, `whatsapp/` y `twilio/`, dobles y `setup/no-meta.ts`), `.env.example` y `scripts/dev-server.ts`.
- **`landing-pages`:**
  - se van `services/whatsapp-bot/`, `controllers/whatsapp-webhook.ts`, `services/catalog-reload.ts`, `services/bot-control.ts`, `services/bot-usage.ts`, `content/bot.ts`, `content/hours.ts`, `content/*/hours.ts`, `content/*/bot.ts`, `content/common/payment.ts` y `scripts/bot-chat.ts`;
  - cambian `config/env.ts`, `app.ts`, `server.ts`, `routes/index.ts`, `internal-app.ts`, `services/whatsapp.ts` (reexporta de `core/shared` o desaparece), `content/{common,molotes,birria}/index.ts`, `controllers/admin-bot.ts`, `views/admin/bot.ts` (+ su plantilla), `package.json` (sin `bot:chat`), `.env.example` y las pruebas.
- **Raíz:**
  - `eslint.config.ts`, `package.json` (el script `bot:chat` delega en `api`);
  - `deploy/compose.prod.yaml`, `deploy/deploy.sh`, `deploy/env.production.example`, `deploy/ci/smoke.sh`;
  - `landing-pages/Dockerfile` (etapa `api`: etiqueta OCI);
  - `docs/arquitectura.md`, `docs/despliegue.md`, `README.md`.

### Cambios requeridos

1. **PR 1, piezas compartidas a `core` (sin cambio de comportamiento):**
   - mover el horario, los nombres, el enlace de Maps, el constructor de enlaces de WhatsApp y el control del bot (H-4, H-5) a `core`;
   - `landing-pages` (landings, bot todavía, `/admin`) importa desde ahí;
   - las pruebas existentes pasan sin cambiar sus casos.
2. **PR 2, el bot a `api`:**
   - `git mv` del bot, su contenido, el simulador, las pruebas y los fixtures a `api`;
   - webhook en su propio puerto;
   - configuración del bot en `api`;
   - control con refresco periódico, mantenimiento y vaciado de contadores al apagar;
   - `landing-pages` sin bot, con la página "Bot" en transición;
   - regla de lint y pruebas nuevas.
3. **PR 3, despliegue y documentación:**
   - router, red y etiqueta de imagen;
   - `deploy.sh` y el smoke;
   - `.env` de ejemplo y documentos;
   - CI completo.

### Backend

- **Webhook en `api` (RF-1, RF-3, RF-5):**
  - `createBotWebhookApp({ bot, logger })`: Koa con el mismo manejador de hoy (orden firma → 200 inmediato → segundo plano, deduplicación y 503 `BOT_DISABLED` sin bot) y las cabeceras `no-store`/`nosniff` de la `api`; 404 para cualquier otra ruta.
  - `proxy = true` y `maxIpsCount = 1` (último valor de `X-Forwarded-For`).
  - Escucha en `WEBHOOK_PORT` (por defecto 3004) en la misma `HOST`. La app principal (3001) no monta el webhook.
  - El log de peticiones registra solo `ctx.path` (el `hub.verify_token` de la query nunca va al log).
- **Configuración (RF-6, CA-12):**
  - `loadApiConfig` incorpora la parte del bot de `landing-pages/src/config/env.ts` (proveedor, Meta/Twilio, `WHATSAPP_GRAPH_API_VERSION`, Twilio prohibido en producción, `WHATSAPP_MOLOTES`/`WHATSAPP_BIRRIA` para D-6 y el remitente de Twilio) y `core/bot-control/bot-config.ts` (clave obligatoria con el bot, personal y topes).
  - Mismos textos de error que hoy, cubiertos por las pruebas de configuración trasladadas.
- **Arranque de `api` (`server.ts`):**
  - `createBotControl` siempre (como hoy en `landing-pages`), con `init()` (si falla, `api` no arranca);
  - mantenimiento al arrancar y cada hora (RF-11: solo aquí);
  - **refresco periódico cada `refreshMs`** (H-2; temporizador `unref`);
  - orquestador sobre el `products` existente (H-7);
  - recarga del catálogo cada 60 s como red de seguridad (por si falla la recarga en `write()`);
  - `bot_provider_selected` en el log;
  - en el apagado, `botControl.flush()` antes de `prisma.$disconnect()`.
- **`landing-pages` sin bot:**
  - Sin ruta del webhook (404), sin orquestador ni `startCatalogReload`.
  - `loadConfig` deja de leer y exigir las variables que no usa. Valida y usa solo la clave (actual y anterior), el personal, los topes y `WHATSAPP_BOT_PROVIDER`, con las funciones de `core/bot-control`.
  - D-6 se sigue comprobando en `landing-pages` cuando hay proveedor, porque es la regla de sus CTA (RN-2), con el mismo mensaje.
  - `createBotControl` en "modo panel": sin mantenimiento ni temporizadores; `snapshot()` lee el uso del día y del mes con `store.readUsage` (H-3).
- **Página "Bot" de `/admin` (RF-8, CA-7, CA-8):**
  - Se conservan la pausa, los bloqueos y el uso.
  - La sección "Números que alcanzaron un tope hoy" se sustituye por un aviso (`renderAdminNotice`, con el estilo actual del admin): "Esta lista vuelve con el control del bot en el admin nuevo".
  - `POST /admin/bot/topes/<token>/bloquear` responde 410 con ese aviso, después de pasar por `admin-access` (sesión → permiso → CSRF), y no escribe nada.
  - "Habilitado (Meta)/Desactivado" sale de `WHATSAPP_BOT_PROVIDER`.
- **Aviso interno de productos:**
  - `landing-pages/src/internal-app.ts` deja de recargar "el catálogo del bot" y responde `{ landing }`.
  - El `notifier` de `api` confirma con `landing === true`, porque la frescura del bot es en proceso.
  - Durante el despliegue, combinado con una versión anterior, como mucho la API dice "no confirmado" un momento.
- **Despliegue (RF-4, RF-13):**
  - La etapa `api` del Dockerfile lleva `LABEL org.restaurante.webhook="whatsapp"`.
  - En `deploy.sh`, `compose()` calcula `RESTAURANTE_API_WEBHOOK=true|false` con `docker image inspect` de la imagen de `api` con la que arranca cada servicio. En `compose.prod.yaml`, las etiquetas de `api` usan `traefik.enable=${RESTAURANTE_API_WEBHOOK:-false}`.
  - Con la `api` anterior (sin etiqueta), el router del webhook se apaga y el router raíz vuelve a enviar la ruta a la app anterior, que tiene el bot y sus variables (P-2). Así ninguna vuelta atrás deja el webhook en un proceso sin bot.
  - Una vuelta atrás manual a un commit anterior exige reinstalar su `deploy/` (código 4), que tampoco tiene el router.
- **Router de Traefik:**
  - `restaurante-webhook` con `Host(<dominio>) && Path(`/webhooks/whatsapp`)` (ruta exacta), `priority=200` (por encima del raíz y de `restaurante-admin`, 100), HTTPS con el mismo certresolver y servicio `restaurante-webhook` en el puerto 3004;
  - `traefik.docker.network=traefik-public`;
  - sin límite de peticiones en Traefik (como hoy; la protección es la del bot);
  - `api` pasa a las redes `db`, `admin` y `traefik`;
  - la `api` recibe las variables del bot del mismo `.env` (RF-6, sin duplicar valores);
  - cambia la suma de `deploy/`: el usuario reinstala `deploy/` en el VPS.

### Frontend

Solo la página "Bot" de `/admin`: el aviso sustituye a la lista de topes, con las clases y el componente de aviso que ya usa el admin. No toca las landings ni `_stich_source_/`. `npm run build:css` tras cambiar la plantilla.

### Contenido / configuración

- **Fuente única de horarios (RF-7):**
  - `core/schedule/business-hours.ts`. La usan el bot (`api/src/bot/schedule.ts`) y la prueba de coherencia de las landings (`landing-pages/tests/unit/business-hours.test.ts`, que compara los textos de horario de `content/*/index.ts` con esa fuente, como hoy).
  - Si se cambia un horario sin actualizar el texto de la landing, la prueba falla.
- **Datos compartidos en `core`:**
  - Nombres de los negocios y enlace de Maps: `content/*/index.ts` y `common/index.ts` los toman de `core/shared`, igual que el bot.
  - Textos, vocabulario, códigos y cuenta bancaria del bot viajan con el bot a `api/src/bot/content/`.
- **Variables:**
  - `api/.env.example` gana el bloque del bot y `WEBHOOK_PORT`.
  - `landing-pages/.env.example` se queda con el proveedor, la clave, el personal y los topes, y lo explica (D-4).
  - `deploy/env.production.example` no cambia de nombres: un solo `.env` (RN-5).
- **Desarrollo:** `npm run bot:chat` (raíz) delega en `api`. El túnel y `WHATSAPP_BOT_WEBHOOK_URL` (Twilio) apuntan al `WEBHOOK_PORT` de `api`.
- **Simulador:** usa un fixture de productos de `api/tests/fixtures/` (copia de las listas congeladas de las semillas), porque `api` no puede leer `landing-pages`.

### Validaciones

- Firma, verificación de suscripción, tamaño del cuerpo y formato: sin cambios.
- Configuración de `api`: fallo rápido con los mensajes de hoy (CA-12).
- `WEBHOOK_PORT`: entero de 1 a 65535 y distinto de `PORT`.
- `/admin`: mismas validaciones del alta manual (número, personal, motivo, duración).

### Manejo de errores

- Webhook: los mismos códigos (`BOT_DISABLED` 503, 401/403 de firma, 413, 400), con el formato `{ error: { code, message } }`.
- Base caída en `api`: el bot sigue con la última copia del control (`bot_control_store_failed`, una vez por caída).
- Base caída en `/admin`: aviso de base no disponible, sin cambios.
- Ruta de bloquear desde topes: 410 con aviso y sin escritura.

### Testing

- **Se mueven a `api/tests`** (con `git mv`; mismos casos):
  - las pruebas unitarias `whatsapp-bot-*`, `bot-protection-config` (la parte del bot), `bot-control` y `business-hours` (la parte de `core`);
  - las de integración `chat-bot-contract`, `chat-bot-message-count`, `whatsapp-bot-qa-req-f-013`, `whatsapp-twilio-qa-round1`, `whatsapp-webhook-twilio` y los casos del webhook de `app.test.ts`;
  - los dobles `cloud-api-double`, `twilio-api-double`, `chat-bot-drivers`, `bot-golden` y `whatsapp`, y `setup/no-meta.ts` (en `setupFiles` de `api/vitest.config.ts`).
- **Pruebas que se quedan en `landing-pages`** (MySQL):
  - `admin-bot` (CA-7, CA-8 y la nueva lectura de uso de la base, CA-6: otra instancia de `createBotControl` escribe uso en la base y `GET /admin/bot` lo muestra);
  - `bot-control-store` (contrato del store Prisma);
  - `bot-protection-qa-req-f-025`, partida: la parte de `/admin` aquí y la del bot a `api`, con el store en memoria.
- **Pruebas nuevas:**
  - **CA-5 / RF-9 (`api`):** dos instancias de `createBotControl` sobre el mismo store en memoria (panel y bot), con fake timers. Una pausa, un alta o una baja en el panel se aplican en el bot pasados `refreshMs` sin que llegue ningún mensaje, y el primer mensaje posterior se descarta (o se atiende tras la baja).
  - **RF-11 / CA-13:** el "modo panel" no audita caducidades y `api` audita cada una una sola vez.
  - **CA-9 / RF-10 (`api`):** con el repositorio en memoria, un `PATCH` de `/api/v1/admin` que marca un producto como no disponible y, después, el siguiente mensaje al bot ya no lo ofrece.
  - **App del webhook:** 404 en cualquier otra ruta, como `/api/v1/admin/sesion` (CA-3, defensa en profundidad); `X-Forwarded-For` (último valor).
  - **Configuración de `api`:** variables ausentes o inválidas, Twilio en producción, D-6 y `WEBHOOK_PORT`. En `landing-pages`: sin exigir el token y el App Secret, y con la clave, el personal y los topes validados.
  - **CA-10:** casos en `tests/unit/dependency-rule*.test.ts`. Falla un archivo en `landing-pages/src/services/whatsapp-bot/`, `**/whatsapp-webhook*.ts`, `src/content/**/bot.ts` o `scripts/bot-chat*.ts`, y también un import de `api/src` desde `landing-pages`. La regla de transición ya no menciona el bot.
  - `landing-pages`: `GET`/`POST /webhooks/whatsapp` responden 404.
- **Duración (CA-15):**
  - Tras mover, se mide la duración de cada archivo de `api` y de `landing-pages` (`vitest --reporter=verbose`, y el log del CI). Un archivo de más de 20 s se parte por sus `describe` con la preparación en `tests/support/`, sin cambiar casos, timeouts ni reintentos.
  - Las pruebas de `api` siguen sin MySQL salvo que se diga lo contrario.
- **Smoke (`deploy/ci/smoke.sh`, PR 3):**
  - `api` en `db`, `admin` y `traefik`;
  - los routers de Traefik son los de `app`, `inventory-manager` y `restaurante-webhook`;
  - `https://<dominio>/webhooks/whatsapp` lo responde `api` (503 `BOT_DISABLED`, sin bot en el smoke);
  - `https://<dominio>/api/v1/admin/sesion` y `/api/v1/public/birria/productos` no llegan a `api` (404 de la app);
  - `/`, `/molotes`, `/birria` y `/admin` como antes;
  - `deploy.sh` con una imagen de `api` sin la etiqueta deja `traefik.enable=false` en `api`.
- **Comandos:** `npm run typecheck`, `npm run lint`, `npm test` (con `npm run db:up`) y `npm run build:css`. Para el PR 3, el job `docker` del CI (smoke).

### Seguridad

- Desde internet, solo `/webhooks/whatsapp` llega a `api`, y por un puerto que no tiene otra ruta (P-1 A).
- La firma se comprueba antes de procesar nada; respuesta 200 inmediata; deduplicación: sin cambios.
- Los logs siguen enmascarando el número y nunca llevan textos, datos del cliente, tokens ni el Account SID.
- `api` recibe los secretos del bot. `landing-pages` sigue recibiéndolos, sin usarlos, hasta el ticket 6 (P-2 A, riesgo documentado).
- Riesgo residual de `traefik-public` documentado (H-1).
- Las pruebas nunca llaman a Meta ni a Twilio (`no-meta.ts` en `api`).

### Performance

- No hay contenedores nuevos. El bot sale de `app` y entra en `api`: el balance de memoria es casi neutro.
- El refresco periódico del control suma tres consultas ligeras cada 10 s (unas 26 000 al día, despreciables para MySQL).
- Memoria (§10): medida local de la imagen `api` con el bot (`docker stats`) en el PR 3. Tras el despliegue de la épica, medida en el VPS con `free -m` y `docker stats --no-stream` (solo lectura, con autorización del usuario para el SSH), que se compara con el 31,5 % y el umbral del 80 %.

### Riesgos técnicos

- **Vuelta atrás incompleta:** mitigada con la etiqueta de imagen (H-6) y P-2 A. Se prueba en el smoke y se comprueba tras el despliegue (CA-14).
- **Dos bots activos** solo si `inventory-manager` falla en el despliegue (código 16: `api` nueva y app anterior). El webhook va a `api`, pero el mantenimiento puede correr también en la app anterior hasta el siguiente despliegue. Puede duplicar alguna auditoría de caducidad en ese caso excepcional. Se documenta en "Problemas frecuentes".
- **Tamaño del PR 2** (sobre todo movimientos): `git mv` para conservar el historial y la revisión por archivos movidos.
- **Duración de las pruebas** en `api`: se mide y se parte si hace falta.
- **Conversaciones a medias** se pierden en el corte (aceptado, D-3); Meta reintenta las entregas sin 200.

### Orden de implementación

1. PR 1: `core` (horario, nombres, Maps, enlace de WhatsApp, control del bot y lectura de su configuración), `landing-pages` importando de `core` y las pruebas en verde. CI hacia `epic/arquitectura`.
2. PR 2: el bot a `api` (webhook en su puerto, configuración, arranque, refresco, mantenimiento y simulador), pruebas movidas y nuevas, `landing-pages` sin bot, página "Bot" en transición, aviso interno y lint (CA-10). Medición de duraciones. CI.
3. PR 3: Dockerfile (etiqueta), `compose.prod.yaml`, `deploy.sh`, `env.production.example`, smoke y documentación de RF-14 (incluido §8 ticket 3 con REQ-F-042, la URL conservada y §9 D-3). CI completo.
4. Tras el merge de la épica a `main` (acción del usuario): reinstalar `deploy/` y comprobar CA-1 a CA-4, CA-9 y CA-14 en producción. Medir la memoria (§10).

### Criterios de finalización

- CA-1 a CA-16 comprobados: los de producción (CA-1 a CA-3, CA-14), con el despliegue de la épica; el resto, con las pruebas y el smoke.
- `typecheck`, `lint` (0) y `npm test` en verde, sin archivos de más de 20 s en el CI.
- CI `calidad`, `docker` y `auditoria` en verde en cada PR hacia `epic/arquitectura`.
- Ningún archivo ni import del bot en `landing-pages`; la regla de transición solo menciona `/admin`.
- Documentación de RF-14 actualizada.

## Implementation Result

### PR 1 de 3: piezas compartidas a `core` (sin cambio de comportamiento)

#### Rama

`feature/REQ-F-042-bot-whatsapp-en-api-1-core`, desde `epic/arquitectura` (`42d3c3b`, con el #120). Sin commit todavía.

#### Cambios realizados

- **Horario (RF-7, H-5):** `packages/core/schedule/business-hours.ts` (`BUSINESS_HOURS`, `getBusinessHours`, `defineHours`, `BusinessHours`, `ClockTime`, con los datos de los dos negocios). Sustituye a `landing-pages/src/content/hours.ts`, `content/molotes/hours.ts` y `content/birria/hours.ts`, que se eliminan. El bot (`schedule.ts`, `messages.ts`) y la prueba de coherencia de las landings la leen de `@restaurante/core/schedule`.
- **Datos compartidos (H-5):**
  - `core/shared/businesses.ts` gana `BUSINESS_NAMES`: los nombres "Moloteando" y "Birria El Muñeco", que usan el contenido de las landings y el del bot (que ya no importa el contenido de las landings);
  - `core/shared/branch.ts` (`BRANCH_LOCATION.mapsUrl`), que usan `content/common/index.ts` y los textos del bot;
  - `core/shared/whatsapp-link.ts` (`git mv` de `landing-pages/src/services/whatsapp.ts`: `buildWhatsAppLink`, `PHONE_PATTERN`, `isHttpsUrl`, `MAX_MESSAGE_LENGTH`), que usan `config/env.ts` y el orquestador.
- **Control del bot (H-4):** `git mv` a `packages/core/bot-control/` de `bot-control.ts`, `bot-usage.ts`, `phone.ts` y `limits.ts`. `bot-config.ts` nuevo, con `BotKeys`, `BOT_KEY_VARS`, `parseBotKeys` y `parseBotLimits` extraídos de `landing-pages/src/config/env.ts` con los mismos mensajes. El `index.ts` exporta todo.
  - Desviación menor del plan: la lectura del personal y del proveedor se queda por ahora en `env.ts`, porque forma parte de `parseChatBot`. Se separa en el PR 2, cuando cambia la configuración de las dos apps.
- **`landing-pages`:** los imports apuntan a `@restaurante/core/{schedule,shared,bot-control}`. No cambia código de comportamiento.
- **Documentación:** `restaurante/README.md` (pasajes del horario, que nombraban archivos eliminados). El resto de RF-14 va en el PR 3.

#### Criterios de aceptación

Este PR es preparatorio: no cierra ningún criterio por sí mismo.

- **RF-7:** la fuente única del horario ya está en `core`, compartida por las landings y el bot.
- **CA-15** (parcial, en local): `typecheck`, `lint` y `test` en verde, sin archivos de más de 20 s.
- Los demás criterios van en los PR 2 y 3.

#### Validaciones ejecutadas

- `npm run db:up`: MySQL local healthy.
- `npm run typecheck`: 0 errores en todos los workspaces.
- `npm run lint`: 0 errores y 0 avisos.
- `npm test`: código de salida 0.
  - Por workspace (Vitest con salida JSON): `landing-pages` 149 archivos y 2230 pruebas, todas en verde; `api` 7 y 144; `inventory-manager` 8 y 111.
  - Archivos más lentos en local: `product-repository-contract-prisma-crear` 17,1 s, `db-outage-handshake-saludo` 15,0 s, `db-outage-handshake-bajada` 14,7 s; ninguno pasa de 20 s. Este PR no cambia ninguno de esos archivos.
- `npm run build:css`: no aplica (no cambian estilos ni plantillas).

#### Archivos afectados

- **Nuevos en `packages/core`:** `bot-control/bot-config.ts`, `schedule/business-hours.ts`, `shared/branch.ts`.
- **Movidos a `packages/core`:**
  - a `bot-control/`: `bot-control.ts`, `bot-usage.ts`, `phone.ts`, `limits.ts`;
  - a `shared/`: `whatsapp-link.ts`.
- **Modificados en `packages/core`:** `bot-control/index.ts`, `schedule/index.ts`, `shared/index.ts`, `shared/businesses.ts`.
- **Eliminados en `landing-pages/src/content/`:** `hours.ts`, `molotes/hours.ts`, `birria/hours.ts`.
- **Modificados en `landing-pages`:**
  - `src/config/env.ts`, `src/app.ts`, `src/server.ts`;
  - `src/content/{common,molotes,birria}/index.ts`, `src/content/{molotes,birria}/bot.ts`;
  - `src/controllers/admin-bot.ts`, `src/controllers/admin.ts`, `src/views/admin/bot.ts`;
  - en `src/services/whatsapp-bot/`: `messages.ts`, `orchestrator.ts`, `schedule.ts`, `protection/{protection,number-guard}.ts` y `providers/meta/cloud-api.ts`;
  - `scripts/bot-chat.ts`;
  - 16 archivos de `tests/`, solo sus imports.
- **Otros modificados:** `restaurante/README.md`.

#### Riesgos o pendientes

- Sin cambio de comportamiento: las pruebas existentes pasan sin cambiar ningún caso.
- `.claude/agents/senior-fullstack.md` todavía nombra `src/content/hours.ts`. Es configuración del agente y no se toca aquí; conviene actualizarlo con la documentación del PR 3.
- Siguen PR 2 (el bot a `api`) y PR 3 (despliegue y documentación).

### PR 2 de 3: el bot pasa a `api`

#### Rama

`feature/REQ-F-042-bot-whatsapp-en-api-2-bot`, desde `epic/arquitectura` (con el #121). Sin commit todavía.

#### Cambios realizados

- **Bot en `api/src/bot/`** (con `git mv`): orquestador, conversación, proveedores, intérprete, protección, contenido propio, recarga del catálogo y webhook. Simulador en `api/scripts/bot-chat.ts`; `npm run bot:chat` delega en `api`.
- **Webhook en puerto propio (P-1):** `api/src/bot/webhook-app.ts` escucha en `WEBHOOK_PORT` (3004) y solo tiene `/webhooks/whatsapp`; cualquier otra ruta responde 404 y otro método, 405. `proxy = true` y `maxIpsCount = 1`. La app principal (3001) no monta el webhook.
- **Configuración:** `api/src/bot/config.ts` y `loadApiConfig` (bot y `WEBHOOK_PORT`). `core/bot-control/bot-config.ts` gana proveedor, personal y `parseBotPanel`, lo que cierra la desviación del PR 1.
- **Arranque de `api`:** control del bot siempre, mantenimiento al arrancar y cada hora, refresco cada `refreshMs` (`control-timers.ts`, H-2), recarga del catálogo cada 60 s y `flush()` antes de desconectar.
- **`landing-pages` sin bot:** sin webhook (404), orquestador ni recarga del catálogo. `loadConfig` solo valida proveedor, personal, clave y topes (D-4), y D-6. `createBotControl` en `mode: 'panel'`: lee el uso de la base en cada `snapshot()` y no ejecuta mantenimiento.
- **Página "Bot" (D-2):** aviso en lugar de la lista de topes; `POST /admin/bot/topes/<token>/bloquear` responde 410 tras sesión, permiso y CSRF, sin escribir. Se elimina el parcial `bot-reached-row.html`, sin uso.
- **Aviso interno:** `landing-pages` responde `{ landing }` y el `notifier` confirma con `landing === true`.
- **Lint (CA-10):** falla un archivo del bot en `landing-pages` y un import o `import()` de otra app. La regla de transición ya no menciona el bot.
- **Variables:** `api/.env.example` y `landing-pages/.env.example`.

#### Desviaciones del plan

- Las pruebas del bot en `api` no usan supertest, por la regla de `api`: `tests/support/webhook.ts` da un cliente con la misma forma encadenada sobre `fetch` y `listenLocal`, para no reescribir los casos.
- `createBotFromConfig` vive en `webhook-app.ts`, función que el plan no nombraba.
- `landing-pages/tests/unit/business-hours.test.ts` se queda donde está, porque compara los textos de las landings.
- La regla de lint cubre además `catalog-reload*.ts`.
- `.github/workflows/ci.yml`: solo un comentario con la ruta nueva de una prueba.

#### Criterios de aceptación

- **Con pruebas en este PR:** CA-4, CA-5, CA-6, CA-7, CA-8, CA-9, CA-10, CA-11, CA-12 y CA-13.
- **Parciales:** CA-1, CA-2 y CA-3, comprobados contra el puerto del webhook; falta el router de Traefik (PR 3) y su comprobación en producción. CA-15, en local; falta el CI.
- **Pendientes del PR 3:** CA-14 y CA-16.

#### Validaciones ejecutadas

- `npm run build:css`: código 0.
- `npm run typecheck`: código 0, en todos los workspaces.
- `npm run lint`: código 0, sin avisos.
- `npm test`, por workspace y con MySQL local: `api` 36 archivos y 980 pruebas; `landing-pages` 125 archivos y 1435 pruebas (1434 y 1 `it.fails` intencionado, anterior a este trabajo); `inventory-manager` 8 archivos y 111 pruebas. Sin fallos.
- Una ejecución anterior dio 189 fallos en `landing-pages`: Docker Desktop se actualizó y reinició su VM a mitad de la ejecución (`ECONNREFUSED`, registros de Docker). Se relanzó sin cambiar nada relacionado con esos fallos.
- Duración por archivo: el mayor de `api`, 4,7 s. El mayor de `landing-pages`, `product-repository-contract-prisma-actualizar.test.ts`, 21,6 s en paralelo y 6,7 s aislado; este PR no lo modifica. El límite de 20 s se aplica al CI, que no se ha ejecutado.
- `npm run bot:chat` con `--proveedor meta` y `--proveedor twilio`: código 0, conversación con respuesta del bot.
- No ejecutado: CI ni construcción de imágenes Docker.

#### Riesgos o pendientes

- **Orden de merge:** hasta el PR 3, Traefik no enruta el webhook a `api` y `landing-pages` responde 404. La épica no debe llegar a `main` sin el PR 3.
- **Desarrollo local:** las variables del bot pasan a `api/.env`.
- `Dockerfile` (comentario del simulador), `README.md` y `docs/` aún describen el bot en `landing-pages`: PR 3.

#### Correcciones de QA, ronda 1

Decisiones del usuario: A-1, "Registrarla (Recomendado)"; A-2, "Ampliar a src/bot/** (Recomendado)"; DEF-001, "Corregir en este PR (Recomendado)". DEF-002 no se toca.

- **DEF-001 (RF-10):** confirmado de punta a punta antes de corregir: con el notifier real, una landing que confirma y la recarga de la caché fallida, `PUT` respondía 200 con `freshness: confirmed` y el bot seguía ofreciendo el producto. Ahora `ProductRepository` expone `isCacheFresh(business)` (sin E/S) y `freshness` en `product-routes.ts` solo confirma si la landing confirma y la caché está al día. La escritura sigue respondiendo bien y el aviso sale siempre. La recuperación sigue siendo la recarga de 60 s o la siguiente escritura.
- **A-1 (RF-3):** el log de peticiones del webhook lleva `ip` y `protocol`, como en `landing-pages`. `createRequestLogger` es el mismo middleware en los dos puertos, pero gana un parámetro opcional que solo pasa `webhook-app.ts`: el log del puerto principal no cambia.
- **A-2 (CA-10):** la regla de lint cubre `landing-pages/src/bot/**/*.ts`. Se restaura el caso que QA retiró y se añade uno anidado.

Pruebas añadidas: `bot-catalog-freshness.test.ts` (2 casos, y `startAdmin` acepta `realNotifier`), `bot-webhook-app.test.ts` (2 casos) y `dependency-rule-bot-qa-req-f-042.test.ts` (2 casos).

Validaciones:

- `npm run typecheck`: código 0.
- `npm run lint`: código 0, sin avisos.
- Pruebas, por workspace y con MySQL local: `api` 36 archivos y 984 pruebas; `landing-pages` 127 archivos y 1455 pruebas (1454 y 1 `it.fails` previa); `inventory-manager` 8 archivos y 111 pruebas. Sin fallos.
- `api` se volvió a ejecutar tras el último cambio, de una sola línea en una prueba suya; las otras dos suites corrieron antes de ese cambio.
- Duración: el mayor de `landing-pages`, 15,6 s; el de `api`, 4,7 s.
- No ejecutado: CI ni construcción de imágenes Docker.

### PR 3 de 3: despliegue y documentación

#### Rama

`feature/REQ-F-042-bot-whatsapp-en-api-3-deploy`, desde `epic/arquitectura` (`5c6c8bd`). Sin commit todavía.

#### Cambios realizados

- **Imagen `api`:** `LABEL org.restaurante.webhook="whatsapp"` y `EXPOSE 3001 3004`. Comentario del simulador actualizado.
- **`compose.prod.yaml`:**
  - router `restaurante-webhook`: `Host(<dominio>) && Path(`/webhooks/whatsapp`)`, prioridad 200, certresolver y HTTPS como los demás, servicio en el 3004 y `traefik.enable=${RESTAURANTE_API_WEBHOOK:-false}`;
  - `api` entra en `traefik-public` y recibe `WEBHOOK_PORT=3004`;
  - las variables del bot salen de un solo bloque (`x-bot-env`) que comparten `app` y `api` (RN-5). `app` las conserva todas (P-2).
- **`deploy.sh`:**
  - `compose()` calcula `RESTAURANTE_API_WEBHOOK` con la etiqueta de la imagen de `api` de cada llamada;
  - `probe_webhook`: con una `api` con etiqueta, comprueba por Traefik que el webhook le llega antes de cambiar la app; si no, vuelve a la `api` anterior y termina con 15;
  - en la vuelta atrás automática, la `api` vuelve la última;
  - `release.env` registra `RESTAURANTE_API_WEBHOOK`, y el paso 1 descarga también la `api` anterior.
- **`smoke.sh`:** comprobaciones estáticas del router y de las variables, webhook en la `api`, rutas que no llegan a ella, y cuatro escenarios de RF-13 (api sin etiqueta, vuelta atrás automática, webhook que no responde y vuelta a una api con webhook).
- **`env.production.example`:** comentarios; sin nombres nuevos.
- **Documentación de RF-14:** `README.md`, `docs/arquitectura.md` (§1, §4, §6, §8 ticket 3 con la URL conservada, §9 D-3 y §10), `docs/despliegue.md` y `docs/desarrollo.md`.

#### Qué pasa con los mensajes durante el despliegue (D-3, RF-13)

- **Corte:** mientras la `api` nueva arranca, Traefik no publica su router (filtra los contenedores que no están `healthy`) y `/webhooks/whatsapp` sigue en la app anterior, que tiene el bot. Al quedar `healthy`, el router de prioridad 200 toma la ruta. La app, la única que dejaría la ruta sin bot, cambia después de que `probe_webhook` lo haya comprobado.
- **Lo que garantiza que el webhook no dé 404 de forma permanente:** la app no se cambia sin esa comprobación, y el router sigue a la imagen: con una `api` sin etiqueta no existe, y la ruta vuelve a la app anterior.
- **Ventanas medidas en local** (imágenes reales de `main` y de esta rama, bot configurado, una petición cada 0,3 s):
  - corte hacia la versión nueva: 74 peticiones, 0 fallos;
  - vuelta atrás automática (código 21): 1 respuesta 502, en 73 peticiones;
  - reinicio de la `api` ya con la app nueva: 11 respuestas 404 en unos 4 s;
  - volver a la versión anterior desplegándola con `deploy.sh`: 22 respuestas 404 o 502 en unos 8 s, porque la `api` cambia antes que la app.
- **No es cierto que el webhook nunca responda 404:** en las dos últimas ventanas lo hace durante unos segundos. Meta reintenta lo que no recibe 200, así que no se pierden entregas (RF-13). Los tiempos del VPS pueden ser mayores.
- Las conversaciones a medias se pierden en cada corte (aceptado, D-3). Una entrega ya respondida con 200 no se reintenta.

#### Desviaciones del plan

- **`probe_webhook` y su salida con el código 15:** el plan no los incluía. Sin ellos, una `api` `healthy` que Traefik no enrutara dejaría el webhook en una app sin bot.
- **La `api` vuelve la última en la vuelta atrás automática.** El plan conservaba el orden. Con la `api` primero, el sondeo dio 14 fallos en esa vuelta atrás; con este orden, 1.
- **`RESTAURANTE_API_WEBHOOK` en `release.env`:** para que `$C up -d --no-deps api` a mano conserve el router. `ops/backup/restore.sh` reescribe ese archivo sin esa línea: documentado en `despliegue.md`.
- **El paso 1 descarga la `api` anterior:** si no estuviera en el host, su etiqueta se leería como ausente.
- **Bloque `x-bot-env`:** el plan solo pedía que `api` recibiera las variables.
- **`docs/desarrollo.md`:** no está en RF-14, pero el túnel y el `.env` del bot apuntaban a `landing-pages`, y CA-16 lo exige.
- **El sondeo de `probe_webhook` usa `OPTIONS`:** no llega al bot y no deja `bot_webhook_verify_failed`. Distingue quién responde por la cabecera CSP, que solo pone la app.

#### Sin cambios, pendiente de autorización del usuario

`.claude/CLAUDE.md` §8 y `.claude/agents/senior-fullstack.md` siguen desfasados: dicen que el bot está en `landing-pages` y citan `src/content/hours.ts`, ya borrado. Son configuración del proyecto y necesitan autorización del usuario. Una edición de `.claude/CLAUDE.md` se llegó a hacer en esta fase y se revirtió con `git checkout`. No forman parte de RF-14, así que no afectan a CA-16.

#### Criterios de aceptación

- **Pendientes de producción (no cumplidos todavía):** CA-1, CA-2 y CA-3. En local, por Traefik y con el bot configurado: verificación con token correcto 200 y reto, token incorrecto 403, `POST` firmado 200, sin firma 401, `bot_provider_selected` solo en `api`, y `/api/v1/admin/sesion`, `/api/v1/public/birria/productos` y las rutas vecinas del webhook no llegan a `api`. Faltan el dominio, el certificado y Meta real. Comprobación: `docs/despliegue.md`, "Comprobaciones del webhook (REQ-F-042)".
- **CA-4:** en local, sin bot, `api` responde 503 `BOT_DISABLED`; las landings, el `/admin` y el admin nuevo responden (smoke).
- **CA-14:** cumplido en local con las imágenes reales de `main`: tras la vuelta atrás con `deploy.sh`, y también tras la automática, `GET` de verificación da 200 con el reto y lo responde `app`, y `RESTAURANTE_API_WEBHOOK=false`. Se repite en producción solo si llega a haber una vuelta atrás. En el CI, el smoke solo cubre la imagen sin etiqueta, porque no tiene las imágenes anteriores.
- **CA-15:** en local, verde. **Pendiente:** el CI del PR.
- **CA-16:** cumplido para los documentos de RF-14.
- **Memoria:** medida local hecha (`api` 100,0 MiB). **Pendiente:** medición en el VPS.

#### Validaciones ejecutadas

- `npm run typecheck`: código 0. `npm run lint`: código 0. `npm run build:css`: código 0.
- Pruebas por workspace, con MySQL local (`npx vitest run`, código 0 en los tres):
  - `api`: 36 archivos y 984 pruebas;
  - `landing-pages`: 129 archivos y 1455 pruebas;
  - `inventory-manager`: 8 archivos y 111 pruebas;
  - ningún fallo. Se ejecutaron por workspace, no con `npm test`.
- Duración máxima por archivo en local: `landing-pages` 16,4 s (`db-outage-handshake-autenticacion.test.ts`); `api` 4,8 s. Este PR no cambia pruebas; el límite de 20 s se comprueba en el CI, que no se ha ejecutado.
- `shellcheck` (imagen `koalaman/shellcheck-alpine:stable`) sobre `deploy.sh`, `01-usuarios.sh`, `smoke.sh`, `resumen.sh` y `resumen-test.sh`: código 0. La última pasada, solo sobre `deploy.sh`, tras su último cambio.
- `deploy/ci/smoke.sh` en local, con las cuatro imágenes construidas de esta rama: 158 comprobaciones, 0 fallos. Una copia en la carpeta temporal usó el puerto 5050 para el registro, porque AirPlay ocupa el 5000 en macOS.
  - La primera ejecución dio 3 fallos: las comprobaciones del webhook corrían justo después de reiniciar la `api`, antes de que Traefik volviera a publicar el router. Se movieron antes de esa parada.
- Comprobación puntual con imágenes de `origin/main` (`352014e`), fuera del repositorio: los resultados de arriba.
- No ejecutado: CI, despliegue real, Meta real, medición en el VPS.

#### Archivos afectados

- `restaurante/deploy/{compose.prod.yaml,deploy.sh,env.production.example,ci/smoke.sh}`
- `restaurante/landing-pages/Dockerfile`
- `restaurante/README.md`, `restaurante/docs/{arquitectura,despliegue,desarrollo}.md`
- Este ticket

#### Riesgos o pendientes

- **Tras el merge de la épica a `main` (acción del usuario):** reinstalar `deploy/` cuando el job `deploy` falle con el código 4 y comprobar CA-1 a CA-3 y CA-9 en producción; medir la memoria con autorización para el SSH.
- **Sin mitigar:** los 404 de unos segundos en cada reinicio o despliegue de la `api`, mientras haya una sola réplica.
- **`curl` de `probe_webhook` contra Traefik real:** se probó con el Traefik v3.7.14 del smoke, no con el del VPS.
- **Vuelta atrás manual:** exige `RESTAURANTE_API_WEBHOOK=false` y volver primero la app; está documentado, pero depende de quien la ejecute.
- **`api` en `traefik-public`:** un contenedor vecino alcanza `api:3001` (H-1, aceptado).

#### Correcciones de QA, ronda 1

Decisiones del usuario, cita textual: "1. Si / 2. Corrigelo / 3. si te autorizo / 4. si es". Es decir: corregir también DEF-003, DEF-005 y DEF-006; corregir DEF-004 sin importar lo que haya hoy en el VPS; la consulta de solo lectura del VPS la hizo la sesión principal; y la URL de Meta está confirmada.

- **R-1 sin efecto:** el usuario confirmó en la consola de Meta que la URL es exactamente `https://birriaelmuneco.com/webhooks/whatsapp`.
- **Consulta del VPS (sesión principal, sin SSH de este agente):** `traefik-public` solo tiene `restaurante-app-1` y `restaurante-inventory-manager-1`. Traefik es `traefik:latest`, versión 3.7.14, en `network_mode: host`, igual que la del smoke. `docker network inspect` no muestra alias, así que no prueba que no exista un alias `app` o `mysql` de otro proyecto.
- **DEF-001 (`docs/despliegue.md` §11.7, paso 5):** remite a una sección nueva, "Arrancar la `api` a mano", que calcula `RESTAURANTE_API_WEBHOOK` con la etiqueta de la imagen. §5, §6, §9 y §11.7 usan ese único procedimiento.
- **DEF-002:**
  - §9: con otra `api`, ese mismo procedimiento; ya no hereda `true` de `release.env`.
  - "Problemas frecuentes": entradas del 502, del `AVISO` de `restore.sh` y del código 22 con la app restaurada.
  - `restore.sh`: **documentación y aviso en el script.** Solo documentación no basta: en plena recuperación, el 0 del script se lee como "todo bien". Al terminar comprueba si la `api` tiene el router y, si no, si la app responde 404 en el webhook; en ese caso la última línea es `AVISO: el bot queda SIN SERVICIO`.
  - Sigue terminando con 0: los datos sí están restaurados y un código de error invitaría a repetir una operación destructiva que no arreglaría nada. La comprobación corre después de restaurar y no puede estropear la restauración. No arregla la `api` por su cuenta, porque el respaldo no dice qué imagen usar.
  - Coste: el usuario debe actualizar `restore.sh` en el VPS (paso 11.5). Sin eso todo funciona igual, pero sin aviso.
- **DEF-003:** en el código 21 se comprueba la `api` anterior (`healthy` y webhook). Si no queda bien, termina con **22** y `health_failed_api_not_restored`, con un mensaje propio que dice que no hace falta restaurar la base. El resumen del CI ya trata el 22 como "producción pudo quedar sin servicio".
- **DEF-004:** `api` usa `restaurante-mysql-1` y `restaurante-app-1`, con `${COMPOSE_PROJECT_NAME:-restaurante}` para el smoke.
  - **Por qué nombres de contenedor y no alias propios:** un alias nuevo obligaría a recrear MySQL y la app en el despliegue, con el bot activo; el nombre de contenedor ya existe, es único en el host y sirve desde el primer momento.
  - **No toca `.env`:** el compose compone las dos URL. Tampoco cambia P-2.
  - **Vuelta atrás:** son solo cadenas de configuración que cualquier imagen acepta; comprobado con imágenes reales de `main`.
  - **Dependencia:** el sufijo `-1` es la convención de Compose para una sola réplica, ya documentada en los comandos de `despliegue.md`. El smoke fallaría si cambiara.
- **DEF-005:** sin `api` anterior, una `api` nueva que falla se detiene, y el webhook vuelve a la app.
- **DEF-006:** el aviso dice ahora que "seguiría la api nueva". Si la imagen anterior no se puede arrancar, la vuelta atrás lo registra y termina con 21, con la `api` nueva atendiendo.

Hallazgo adicional, corregido en el mismo procedimiento: con `C="sudo docker compose ..."`, un `VAR=valor $C ...` no llega a compose, porque `sudo` borra el entorno (comprobado con `sudo` en un contenedor Alpine; Ubuntu lo hace igual por defecto, no comprobado en el VPS). Los comandos de §5, §6, §9 y §11.7 que pasaban imágenes habrían usado en silencio `release.env`. Ahora usan `sudo env`.

Cambios ya aplicados por la sesión principal, autorizados por el usuario: `.claude/CLAUDE.md` §8 y `.claude/agents/senior-fullstack.md` (líneas 82, 114, 118, 127 y 164). La línea 118 no estaba en la propuesta original y solo se le quitaron las entradas del bot. Sustituye a "Sin cambios, pendiente de autorización del usuario".

Smoke:

- `deploy/ci/smoke.sh`: vecino con alias `app` y `mysql`; sin `api` anterior con webhook mudo (15); `api` anterior que no vuelve (22); el procedimiento manual en los dos sentidos; y una comprobación de que ningún comando de `despliegue.md` recrea la `api` sin `RESTAURANTE_API_WEBHOOK`. Ese archivo ahora se lee de `docs/`: el comando local del `README.md` lo monta.
- `ops/backup/ci/smoke.sh`: `restore.sh` avisa sin router y no avisa con router.

Validaciones:

- `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`: código 0.
- `npm test`: `api` 36 archivos y 984 pruebas; `landing-pages` 129 archivos y 1455 pruebas (1454 y 1 `expected fail` previo); `inventory-manager` 8 archivos y 111 pruebas.
- `shellcheck` de los dos pasos del CI: código 0.
- `deploy/ci/smoke.sh`, imágenes reconstruidas, `REGISTRY_PORT=5050`: 184 comprobaciones, 0 fallos.
- `ops/backup/ci/smoke.sh`: 58 comprobaciones, 0 fallos, tras dos ejecuciones fallidas: una por un error de esta corrección en el smoke (variable sin definir; un contenedor con etiquetas que `compose ps` no lista) y otra por mi forma de montarlo (`--drill` necesita una ruta visible para el daemon).
- Comprobación puntual con imágenes de `352014e` y el `deploy/` final, bot sintético:
  - verificación correcta en A, B, C, D y E, con `app` o `api` según corresponda;
  - corte: 72 peticiones, 0 fallos;
  - vuelta atrás automática: 4 respuestas 502, en 85 peticiones (1 en la medición anterior);
  - reinicio de `api`: 11 respuestas 404;
  - volver a la versión anterior con `deploy.sh`: 14 respuestas 404 o 502.
- Memoria en esa ejecución: `api` 103,1 MiB. `arquitectura.md` conserva la medida de 100,0 MiB; las diferencias de esta magnitud no cambian la conclusión.
- No ejecutado: CI, despliegue real, Meta real, `restore.sh` en el VPS, SSH.

Riesgos de esta ronda:

- `app` a MySQL y `app` e `inventory-manager` a `api` siguen usando nombres de servicio. Ya estaban en `traefik-public` antes de este ticket y quedan fuera de la decisión del usuario, que se refiere a `api`.
- Con DEF-003, el código 22 significa ahora dos cosas; el mensaje las distingue.

## QA Action Plan

### PR 1 de 3: piezas compartidas a `core` (regresión)

#### Objetivo

Comprobar que mover el horario, `BUSINESS_NAMES`, `branch`, el enlace de WhatsApp y el control del bot (`bot-control`, `bot-usage`, `phone`, `limits`, `bot-config`) a `packages/core` no cambia el comportamiento de las landings, del bot, del simulador ni de `/admin` → Bot, y que `core` respeta la regla de dependencias.

#### Requisito bajo prueba

RF-2 (sin cambios de comportamiento) y RF-7 (fuente única del horario) en su parte preparatoria. Implementación aprobada por el usuario ("Si la apruebo").

#### Criterios de aceptación

- **CA-1 a CA-14:** no aplican a este PR (bot en `api`, despliegue y vuelta atrás): se validan en los PR 2 y 3. No se exigen aquí.
- **CA-15 (parcial, local):** `typecheck`, `lint` y `npm test` en verde; ningún archivo de más de 20 s. CI, en el PR.
- **CA-16:** fuera de este PR, salvo que el README modificado no nombre archivos eliminados.
- **RF-7 (parcial):** el horario mostrado por `/molotes` y `/birria` coincide con `core/schedule/business-hours.ts` (prueba `business-hours.test.ts` y comprobación en navegador).
- **RF-2:** las pruebas existentes pasan sin cambiar ningún caso (solo imports).

#### Riesgos identificados

- R-1: un test cambió algo más que imports y oculta un cambio de comportamiento.
- R-2: un mensaje de validación de `parseBotKeys`/`parseBotLimits` o de `buildWhatsAppLink` cambió al extraerlo (los mensajes de arranque deben ser idénticos).
- R-3: `core` importa E/S o algo de una app, o un módulo nuevo no se exporta por `index.ts` (consumidores importando rutas internas).
- R-4: `BUSINESS_NAMES` de `core` ("Moloteando") cambia algún nombre visible de las landings o de los textos del bot respecto a `epic/arquitectura`.
- R-5: referencias a archivos borrados (`content/**/hours.ts`, `services/whatsapp.ts`, `services/bot-control.ts`…) en código, scripts o README.
- R-6: `src/views/admin/bot.ts` (diff de 4 líneas) altera el HTML de la página "Bot".

#### Pruebas funcionales y de regresión (blast radius de CodeGraph)

1. Diff de pruebas: `git diff epic/arquitectura -- restaurante/landing-pages/tests` solo cambia líneas `import` (R-1).
2. Diff de los archivos movidos (`git diff -M epic/arquitectura` sobre `bot-control`, `bot-usage`, `limits`, `phone`, `whatsapp-link`) y de `bot-config.ts` frente a las funciones extraídas de `env.ts`: mismos cuerpos y mismos textos de error (R-2).
3. Diff de `src/` de `landing-pages` sin cambios fuera de imports y del contenido derivado de `BUSINESS_NAMES`/`BRANCH_LOCATION` (R-4, R-6).
4. Búsqueda de referencias a los archivos eliminados en `restaurante/` (excepto `.claude/agents/senior-fullstack.md`, ya anotado como pendiente) (R-5).
5. Regla de dependencias (R-3): imports de `packages/core` limitados a `core` y `node:crypto` (sin E/S de red, disco ni base); `index.ts` de `schedule`, `shared` y `bot-control` exportan los módulos nuevos; `dependency-rule*.test.ts` en verde.
6. Pruebas del blast radius (dentro de `npm test`): `business-hours`, `content`, `whatsapp`, `config`, `bot-protection-config`, `bot-control`, `whatsapp-bot-*`, `admin-bot`, `bot-control-store`, `bot-protection-qa-req-f-025`, `app`, `dependency-rule*` y las de `inventory-manager` (consumidor de `BUSINESS_NAMES` propio, sin tocar).
7. Simulador: `scripts/bot-chat.ts` arranca y responde a un mensaje con el proveedor de pruebas, sin llamar a Meta ni a Twilio (si requiere credenciales, se cubre con `chat-bot-contract` y se anota).

#### Pruebas negativas y casos límite

- Mensajes de arranque con clave ausente/inválida/igual a la anterior y topes inválidos: cubiertos por `bot-protection-config.test.ts` y `config.test.ts`; se comprueba que los textos esperados no cambiaron en el diff.
- `defineHours` con datos incoherentes y `getBusinessHours` con negocio inexistente: cubiertos por `business-hours.test.ts`.

#### Pruebas en navegador (comprobación breve)

Servidor en `PORT=3100` con el `.env` existente y CSS compilado. En 375×812 y 1440×900:

- `/molotes` y `/birria`: textos de horario (hero y sección de horario) coinciden con `business-hours.ts`; nombre del negocio; `href` del CTA de WhatsApp (dominio, número, `text`), `target` y `rel` iguales a `epic/arquitectura` (comparado con el HTML servido por `curl`).
- `/`: Birria con el aviso del día actual (viernes 30-10-2026 en `America/Mexico_City`: aviso "Molotes").
- `/admin` → Bot: solo si hay sesión disponible en local; si no, cubierto por `admin-bot.test.ts`.
- Sin errores en consola.

No aplica revisión contra `_stich_source_/`: no cambian plantillas, estilos ni contenido visible.

#### Pruebas de accesibilidad, SEO y performance

Sin cambios de HTML esperados: se cubren comparando el HTML servido (`curl`) de `/`, `/molotes` y `/birria` en esta rama frente a `epic/arquitectura` (mismo `title`, meta, encabezados y enlaces). Una diferencia es defecto de regresión.

#### Pruebas automatizadas

Existentes: `npm run typecheck`, `npm run lint`, `npm test` (con `npm run db:up`) y `npm run build:css`. No se crean pruebas nuevas en este PR.

#### Evidencia requerida

Salida de los comandos, resumen de diffs, comparación del HTML servido, y texto de la página o captura de los horarios en `/molotes` y `/birria`.

#### Criterios de aprobación

`QA_APPROVED` si typecheck, lint y `npm test` pasan, ningún archivo pasa de 20 s, las pruebas solo cambian imports, los mensajes de validación son idénticos, `core` cumple la regla de dependencias, el HTML servido es idéntico al de `epic/arquitectura` y los horarios coinciden. Cualquier diferencia de comportamiento observable es `DEFECT`.

#### Aprobación del QA Action Plan

Aprobado por el usuario (2026-10-30). Cita textual: "Si lo apruebo".

### PR 2 de 3: el bot pasa a `api`

Diseño del plan: `git status`/`git diff` del working tree y CodeGraph (blast radius de `createBotControl`, `parseChatBot`, `WebhookBot`, `createAdminRoutes`). NotebookLM no está disponible en la sesión del agente (sin herramientas MCP `notebooklm`): no se consultó.

#### Objetivo

Comprobar con evidencia propia, no con el informe de implementación, que el bot funciona en `api` sin cambiar lo que vive el cliente ni el personal, que `landing-pages` queda sin bot ni webhook y que `/admin` sigue controlando el bot desde otro proceso.

#### Requisito bajo prueba

RF-1, RF-2, RF-3 (parte de aplicación), RF-5, RF-6, RF-7, RF-8, RF-9, RF-10, RF-11 y RF-12, con las decisiones D-2 y D-4 y P-1 y P-2. Implementación aprobada por el usuario ("si"). Rama `feature/REQ-F-042-bot-whatsapp-en-api-2-bot`, sin commit; la base es `epic/arquitectura` (`3993937`).

#### Criterios de aceptación

| Criterio | Alcance en este PR | Pruebas |
| --- | --- | --- |
| CA-1 | Parcial: contra `WEBHOOK_PORT` | T-01 |
| CA-2 | Parcial: contra `WEBHOOK_PORT` | T-02, T-03 |
| CA-3 | Parcial: el puerto del webhook y la app principal; `/`, `/molotes`, `/birria` y `/admin` completos | T-04, T-05, T-20 |
| CA-4 | Completo, en local | T-06, T-07 |
| CA-5 | Completo | T-08, T-09 |
| CA-6 | Completo | T-10 |
| CA-7 | Completo | T-11, T-12, N-05 |
| CA-8 | Completo | T-09, T-13 |
| CA-9 | Completo | T-14 |
| CA-10 | Completo | T-15 |
| CA-11 | Completo | T-16 |
| CA-12 | Completo | T-17, T-18 |
| CA-13 | Completo | T-19 |
| CA-15 | Parcial: local con condiciones del CI; el CI real corre al abrir el PR | T-21, T-22 |
| CA-14, CA-16 | Fuera de este PR (PR 3) | Ninguna; no bloquean este PR |

`BLOCKED` no se usa para lo que corresponde al PR 3: esos alcances se informan como `PARCIAL` o `FUERA DE ESTE PR`.

#### Riesgos identificados

- **R-1. Casos perdidos en el traslado (RF-2).** Se pasa de 2374 pruebas en `landing-pages` y `api` (PR 1) a 2415 informadas, con 70 archivos de prueba tocados. Un aumento neto puede esconder un caso retirado o debilitado.
- **R-2. Cambio de comportamiento en el traslado.** Los archivos movidos con `M` tienen que cambiar solo imports y comentarios. `tests/support/webhook.ts` sustituye a supertest con un cliente propio, que podría suavizar comprobaciones (cabeceras, cuerpo crudo de la firma).
- **R-3. Firma sobre cuerpo crudo.** El webhook cambia de app: un parser antes del manejador, o una diferencia del cliente de prueba, puede ocultar un fallo de firma real de Meta o Twilio (`WHATSAPP_BOT_WEBHOOK_URL` en Twilio).
- **R-4. Hilo entre procesos sin prueba de punta a punta.** `bot-control-timers.test.ts` usa dos instancias sobre el store en memoria y `admin-bot.test.ts` ejecuta `bot.refresh()` a mano. Ninguna prueba informada usa los procesos reales, con el temporizador real y un mensaje real por el webhook.
- **R-5. Coherencia del panel con la `api`.** El panel obtiene el estado de `WHATSAPP_BOT_PROVIDER` y la `api`, de `isBotConfigured`. Con el proveedor solo (D-2 de REQ-F-012), `/admin` podría decir "Habilitado" con la `api` en 503.
- **R-6. Exposición por la app principal.** La app principal (3001) no debe montar el webhook, y el puerto 3004 no debe servir `/api/v1/*`, `/salud` ni nada más.
- **R-7. IP del visitante sin consumidor.** La `api` calcula `ctx.ip` con `maxIpsCount = 1`, pero `createRequestLogger` de la `api` no registra la IP y antes el log de `landing-pages` sí lo hacía. Hay que decidir si RF-3 se cumple con el valor correcto o exige verlo en el log.
- **R-8. Apagado.** `shutdown` hace `webhookServer.close()` sin esperarlo. Un `flush()` puede adelantarse a un envío en segundo plano y perder contadores.
- **R-9. Regla de lint incompleta (CA-10).** Los patrones cubren rutas conocidas. Queda por comprobar un archivo del bot en otra carpeta (`src/bot/`) y un import por el nombre del paquete (`api/...`).
- **R-10. `landing-pages` sin red de seguridad.** Se retira `no-meta.ts` de sus `setupFiles`: hay que confirmar que ninguna prueba ni código de `landing-pages` llega a Meta o Twilio.
- **R-11. Caché `products` de `landing-pages` sin recarga.** Desaparecen la recarga de 60 s y la del aviso interno. Lectura inicial: `getPublished` no se usa ya en `src/` de esa caché y `/admin` lee con `list`. Se confirma por comportamiento.
- **R-12. Versiones mezcladas del aviso interno.** El notifier exige `landing === true`; con una `landing-pages` anterior (`{ landing, bot }`) también confirma, y sin `landing`, queda pendiente. El aviso "La landing y el bot ya muestran el cambio" no debe mentir si falla la recarga de la `api`, porque `write()` no propaga ese fallo (`refresh` devuelve false).
- **R-13. Permisos de MySQL.** La `api` pasa a escribir `bot_*` con su usuario. Si ese usuario no tiene esos permisos, no arranca en producción. Se comprueba con el usuario de aplicación de las pruebas y por lectura de `deploy/`.
- **R-14. Duración por archivo.** `product-repository-contract-prisma-actualizar.test.ts` dio 21,6 s en paralelo local (6,7 s aislado), por encima de los 20 s de CA-15.
- **R-15. Entorno.** Docker Desktop se reinició durante la implementación: un `ECONNREFUSED` masivo se investiga como entorno antes de clasificarlo.

#### Pruebas funcionales

Salvo indicación, corren contra **procesos reales** (`node ../api/src/server.ts` y `landing-pages`), con MySQL de pruebas, configuración sintética y el doble de salida descrito en "Pruebas automatizadas".

- **T-01 (CA-1).** `GET /webhooks/whatsapp` en `WEBHOOK_PORT` con token correcto: 200 y el challenge. Con token incorrecto, comparar estado y cuerpo con la base `epic/arquitectura`.
- **T-02 (CA-2).** `POST` firmado con HMAC del App Secret sintético: 200 inmediato, `bot_provider_selected` en el log de `api`, respuesta enviada al doble y misma forma de petición que con la base (simulador).
- **T-03 (CA-2).** Sin firma, malformada y con firma incorrecta en Meta; y `X-Twilio-Signature` incorrecta en Twilio: el mismo estado, cuerpo y `bot_webhook_signature_invalid` que en la base. Ningún procesamiento ni envío.
- **T-04 (CA-3, P-1).** Por `WEBHOOK_PORT`: `/api/v1/admin/sesion`, `/api/v1/public/birria/productos`, `/salud`, `/`, `/webhooks/whatsapp/` con barra final, `/webhooks/whatsapp/x` y variantes de mayúsculas y codificación (`/webhooks%2Fwhatsapp`, `//api/v1/admin/sesion`) dan 404 sin datos. Otro método en el webhook: 405 con `Allow`. Sin `x-powered-by` ni detalles internos.
- **T-05 (R-6).** Por `PORT` (3001): `/webhooks/whatsapp` da 404, y `/api/v1/*` sigue igual.
- **T-06 (CA-4, RF-5).** `api` sin bot: arranca, `whatsappBot: 'disabled'`, webhook `GET` y `POST` con 503 `BOT_DISABLED`, sin `bot_provider_selected`.
- **T-07 (CA-4).** En ese mismo estado, `/`, `/molotes`, `/birria`, `/admin` y `inventory-manager` responden.
- **T-08 (CA-5, RF-9).** Punta a punta: pausa en `/admin` con un `BOT_CONTROL_REFRESH_SECONDS` bajo y permitido, esperar a `refreshMs`, `POST` firmado: descartado y sin envío, **siendo ese el primer mensaje posterior**. Reanudar: atendido.
- **T-09 (CA-5, CA-8).** Igual con alta manual (descartado) y baja (atendido).
- **T-10 (CA-6).** Tras un envío real de `api`, `GET /admin/bot` incluye el día y el mes, sin reiniciar nada.
- **T-11 (CA-7).** La página muestra pausa, bloqueos, uso y gasto y el aviso. No muestra la lista "Números que alcanzaron un tope hoy" ni su botón.
- **T-12 (CA-7).** `POST /admin/bot/topes/<token>/bloquear` con sesión, permiso y CSRF: 410, con el aviso y sin filas nuevas en `bot_block` ni en la auditoría.
- **T-13 (CA-8).** Alta de un número válido correcta; el número del personal da el mismo error que la base, sin devolver el número.
- **T-14 (CA-9, RF-10).** `PATCH` real a `/api/v1/admin` que marca un producto como no disponible y, sin esperar 60 s, el siguiente mensaje ya no lo ofrece. Comprobar además `freshness` en la respuesta (R-12).
- **T-15 (CA-10, RF-12).** `npm run lint` en verde y, mediante `lintText` (sin crear archivos en `src/`): cada patrón de `BOT_FILES_IN_LANDING`, imports estáticos e `import()` de `api`. Casos adicionales de R-9. La regla de transición no menciona el bot.
- **T-16 (CA-11).** `npm run bot:chat -- --proveedor meta|twilio`, desde la raíz y con la entrada del PR 1 (`--ahora 2026-10-30T10:00`, saludo, menú, `/hora`, `/audio`): código 0 y salida igual a la de la base con `git archive`. Cualquier diferencia se explica o es defecto. Sin red.
- **T-17 (CA-12).** Proceso `api` real con cada caso: sin clave con el bot, clave inválida, D-6 incumplida, Twilio con `NODE_ENV=production`, proveedor inválido, `WEBHOOK_PORT` inválido e igual a `PORT`. Código de salida distinto de 0 y texto igual al de `landing-pages` en la base, comparado literalmente con `git show`.
- **T-18 (CA-12, D-4).** `landing-pages` arranca sin `WHATSAPP_BOT_ACCESS_TOKEN`, `APP_SECRET` ni `VERIFY_TOKEN`, y sigue rechazando clave, personal, topes y D-6 inválidos con el mismo mensaje. También arranca con esas variables presentes (P-2).
- **T-19 (CA-13, RF-11).** Bloqueo caducado en la base, `api` y `landing-pages` arrancadas y reiniciadas: una sola fila `block_expired`, y `landing-pages` no audita ni purga.
- **T-20 (RF-1).** Inventario: sin `whatsapp-bot`, `whatsapp-webhook`, `catalog-reload` ni `content/**/bot.ts` en `landing-pages`, y `POST /webhooks/whatsapp` da 404.

#### Pruebas negativas y casos límite

- **N-01 (RF-3, R-7).** `X-Forwarded-For` con varios valores, falsificado por el cliente, vacío y mal formado: `ctx.ip` es el último valor y nunca el primero. Sin consumidor en el log, se registra como `REQUIREMENT_AMBIGUITY` y no como defecto.
- **N-02.** Cuerpo mayor del límite (413), JSON inválido firmado (400), entrega duplicada (procesada una vez) y `POST` sin `Content-Type`. Mismos códigos y formato `{ error: { code, message } }` que en la base.
- **N-03 (secretos).** En los logs de `api` y `landing-pages` de toda la ronda no aparecen el token, el App Secret, `hub.verify_token`, números completos ni textos.
- **N-04 (MySQL caído).** Con un proxy TCP entre `api` y MySQL: el bot sigue con la última copia, `bot_control_store_failed` una sola vez y `bot_control_store_recovered` al volver; `/admin` muestra el aviso de base no disponible.
- **N-05 (permisos en la ruta 410).** Sin sesión, con editor y sin CSRF: el mismo resultado que el resto de `/admin` (redirección o 403), nunca 410, y sin token válido también 410 tras autorizar. Ninguna escritura.
- **N-06 (R-5).** Solo `WHATSAPP_BOT_PROVIDER=meta` y ninguna variable de datos: `api` en 503 y `/admin` debe decir "Desactivado". Sin bot, `/admin` no permite altas sin clave.
- **N-07 (R-8).** `SIGTERM` a `api` justo tras una entrega: salida 0 y contadores guardados (`bot_usage`), sin procesos ni puertos abiertos.
- **N-08 (puerto ocupado).** `WEBHOOK_PORT` en uso: mensaje claro, salida distinta de 0 y sin dejar el puerto 3001 tomado.
- **N-09 (cambio de día y de mes).** Contadores con fecha simulada cerca de la medianoche de `BUSINESS_TIMEZONE`, con el reloj del proceso en otra zona (`TZ=UTC`).
- **N-10 (rotación de clave).** `KEY` y `KEY_PREVIOUS`: un bloqueo creado en `/admin` con la clave anterior lo aplica el bot y se re-clava (RN-5).
- **N-11 (R-12).** Aviso interno sin token, con token inválido y con negocio inválido, igual que hoy; `{ landing: false }` da `pending`.

#### Pruebas de integración (WhatsApp)

- CTA de `/molotes` y `/birria`: `href` (dominio, número y `text` codificado), `target` y `rel` idénticos a la base (D-6, RN-2).
- Plantilla `nuevo_pedido`, aviso al personal, forma de pago y deduplicación: por las pruebas trasladadas (RF-2) y T-02. **No se envía nada a Meta ni a Twilio.**

#### Pruebas UX/UI

No aplica `_stich_source_/`: el cambio es de `/admin` y usa su sistema visual. Se comprueba que el aviso sale con `renderAdminNotice`, sin huecos ni encabezados vacíos en la sección sustituida, y con el texto aprobado.

#### Pruebas responsive

`/admin/bot` a 375×812, 768×1024 y 1440×900: sin overflow horizontal, con el aviso legible y los formularios de pausa y bloqueo alcanzables. Las landings, a 375×812 y 1440×900 (CTA visible sin scroll en móvil), como comprobación de regresión.

#### Pruebas de accesibilidad

`/admin/bot`: un solo `h1`, jerarquía sin saltos tras retirar la sección, foco visible en el orden de tabulación y aviso con el rol que ya usa el admin. El mensaje del 410 también debe ser perceptible y no depender del color.

#### Pruebas de performance

- `api` con el bot: sin errores en el log tras varios ciclos de refresco; los temporizadores no se solapan ni retienen el proceso (N-07).
- Memoria: se mide en el PR 3 (`docker stats`), según el plan técnico. Aquí no se evalúa.

#### Pruebas SEO

HTML servido de `/`, `/molotes` y `/birria`, comparado con la base: idéntico byte a byte salvo valores por petición. Cubre `title`, meta, canonical, Open Graph y encabezados. No se esperan cambios.

#### Pruebas de regresión

Blast radius de CodeGraph: `createBotControl` (21 llamadas en `api`, `landing-pages` y pruebas), `parseChatBot`, `WebhookBot` y `createAdminRoutes`.

- **G-01 (R-1).** Inventario de nombres de casos (`it`/`describe`) de la base frente a esta rama, por `git show` y JSON de Vitest. Cada caso retirado debe tener sustituto o justificación. Una pérdida sin justificar es defecto.
- **G-02 (R-2).** `git diff -M` de los archivos con `RM`: solo imports, rutas y comentarios en `src/`; en pruebas, además, adaptación al cliente de `tests/support/webhook.ts`. Revisión específica de ese cliente: que envíe el cuerpo crudo exacto y exponga estado, cabeceras y cuerpo reales (R-3).
- **G-03.** Diff de `core/bot-control` (`bot-config.ts`, `bot-control.ts`): el modo `bot` no cambia; textos de validación intactos (`bot-control-store`, `bot-protection-config`).
- **G-04 (RF-7).** `business-hours.test.ts` en verde: los horarios siguen teniendo una sola fuente.
- **G-05.** `admin-e2e`, `admin-bot`, `app`, `api-process`, `internal-app`, `internal-notify-process`, `notifier`, `server-startup-provider-qa*`, `config`, `bot-protection-qa-req-f-025` (las dos partes) y `dependency-rule*`.
- **G-06.** `inventory-manager` completo, y flujo de edición de producto contra una `api` real.
- **G-07 (R-10).** Sin referencias a `graph.facebook.com` ni `twilio.com` en `landing-pages/src` y en `landing-pages/tests`.
- **G-08 (R-11).** Con `ADMIN_NEW_URL` definido, cambio de producto en la `api` y `/admin` muestra el dato actual sin esperar.
- **G-09 (R-13).** El usuario solo DML de pruebas puede leer y escribir `bot_*` desde `api` (T-08); lectura de la `DATABASE_URL` de `api` en `deploy/compose.prod.yaml`, sin acceder al VPS.
- **G-10.** Referencias a archivos eliminados en `restaurante/` y en el `Dockerfile`, y `.env.example` coherentes con `loadApiConfig`. Lo que sea del PR 3 se lista como pendiente, no como defecto.

#### Pruebas automatizadas

**Verificación independiente** de lo informado por implementación (no se dan por buenos sus números):

- **T-21.** Desde `restaurante/`: `npm run db:up`, `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`, cada uno con su código de salida y sus totales por workspace, contrastados con lo informado (`api` 36/980; `landing-pages` 125/1435 con el `it.fails` previo; `inventory-manager` 8/111). No se ejecuta `lint:fix`.
- **T-22 (duración, CA-15).** Dos mediciones con `--reporter=json`:
  - condiciones del CI, `npm test -- --maxWorkers=4 --shard=1/2` y `--shard=2/2`;
  - el archivo de R-14, aislado.

  Se contrasta además con la duración de ese archivo en el log del último CI de `epic/arquitectura` (`gh run`, solo lectura). Un archivo de más de 20 s en condiciones del CI se informa con su historial; no se cambian timeouts ni se parte ningún archivo durante QA.

**Pruebas nuevas** (solo en `restaurante/landing-pages/tests/`, que es donde QA puede escribir; `landing-pages` ya arranca el proceso real de la `api` en `api-process.test.ts`):

- `tests/integration/bot-procesos-qa-req-f-042.test.ts`: T-01 a T-03, T-06, T-08 a T-10, T-14, T-19, N-06 y N-07, sobre los dos procesos reales y `makeScratchDatabase()`. Si pasa de 20 s, se parte por sus `describe`.
- `tests/support/salida-bot-doble.ts`: precarga de `node --import` para el proceso `api`, que sustituye el `fetch` global, registra las salidas a Meta y a Twilio y rechaza cualquier otro host externo. Ninguna petición sale de la máquina.
- `tests/unit/dependency-rule-bot-qa-req-f-042.test.ts`: casos adicionales de CA-10 (R-9).

Lo que dependa de una prueba que falle se informa como defecto: esa prueba no queda en rojo en la rama ni se marca `it.fails` sin decisión del usuario.

Los casos N-02, N-03, N-04, N-08 y N-10 se ejecutan en esas pruebas o en un script del scratchpad. T-04, T-05, T-17 y T-18, por `curl` y procesos, y se conserva la salida como evidencia.

**Base de comparación:** copia de `epic/arquitectura` con `git archive` en el scratchpad, como en el PR 1, para T-01, T-03, T-16, T-17, N-02 y HTML servido. No usa `git worktree` ni toca el working tree.

#### Pruebas en navegador

Claude in Chrome, pestaña nueva, con `landing-pages` en `PORT=3100` sobre una base `restaurante_test_*` y un administrador sintético creado para QA, y CSS compilado:

- `/admin/bot` en los tres viewports: página completa, aviso, pausa y reanudación, alta y baja (T-11, responsive y accesibilidad).
- `/`, `/molotes` y `/birria`: aviso del día actual en `America/Mexico_City`, CTA y consola sin errores.
- No se sigue el enlace de WhatsApp. Servidores y pestaña se cierran al terminar.

Si la extensión no responde, se marca como pendiente de revisión manual: ningún criterio depende solo del navegador, salvo la apariencia del aviso.

#### Evidencia requerida

Comandos con código de salida y totales; JSON de duraciones; inventario de casos; diffs resumidos; extractos de log de `api` y `app` con los eventos citados, sin secretos; registro del doble de salida (vacío donde se espera descarte); filas de `bot_audit` y `bot_usage`; comparación con la base; y texto de la página o capturas de `/admin/bot`.

#### Criterios de aprobación

`QA_APPROVED` del PR 2 si:

- CA-4 a CA-13 pasan con evidencia, y CA-1, CA-2 y CA-3 pasan en su alcance de este PR;
- `typecheck`, `lint` (0) y `npm test` pasan, verificados por QA;
- ningún caso se perdió sin justificación y los `RM` no cambian comportamiento;
- ningún secreto en los logs y ninguna ruta salvo el webhook por `WEBHOOK_PORT`;
- no hay defectos `BLOCKER` ni `CRITICAL`, y cada `MAJOR` tiene decisión del usuario.

CA-15 queda en local y condicionado al CI verde en el PR, como en el PR 1. CA-14 y CA-16 y el router de Traefik, en el PR 3. Un archivo de más de 20 s en condiciones del CI, o una `REQUIREMENT_AMBIGUITY` (N-01), da `NEEDS_USER_DECISION`.

#### Aprobación del QA Action Plan

Aprobado por el usuario, con las cinco acciones solicitadas. Cita textual: "si".

### PR 3 de 3: despliegue y documentación

Diseño del plan: `git diff` del working tree de `feature/REQ-F-042-bot-whatsapp-en-api-3-deploy` (base `epic/arquitectura`, `5c6c8bd`), CodeGraph (`createBotWebhookApp`, `createWhatsAppWebhook`, `loadApiConfig`, `parseChatBot`) y lectura dirigida de `compose.prod.yaml`, `deploy.sh`, `smoke.sh`, `restore.sh` y `docs/despliegue.md`. NotebookLM: sin herramientas MCP en esta sesión del agente, no se consultó. No se ejecutó ninguna prueba: las hipótesis de abajo son lecturas del código, no resultados.

#### Objetivo

Comprobar con evidencia propia que el corte del webhook a `api` no expone nada más que esa ruta, que no deja el webhook en un proceso sin bot en ningún camino de `deploy.sh` y que la documentación describe lo que hace el sistema.

#### Requisito bajo prueba

RF-3, RF-4, RF-5, RF-6, RF-13 y RF-14, con D-1, D-3, D-4, P-1 y P-2. Implementación aprobada por el usuario. Citas textuales: "1. si" (a "¿Apruebas la implementación para que pase a senior-qa?") y "2. si" (a "¿Autorizas actualizar .claude/CLAUDE.md §8 y .claude/agents/senior-fullstack.md?").

La autorización del punto 2 deja sin efecto la sección "Sin cambios, pendiente de autorización" del Implementation Result: la sesión principal ya aplicó esos cambios.

#### Criterios de aceptación

| Criterio | Alcance en este PR | Pruebas |
| --- | --- | --- |
| CA-1 | Local por Traefik, con dominio de prueba. Producción: pendiente | W-01 |
| CA-2 | Local por Traefik, con entrega firmada sin mensajes. Producción: pendiente | W-02, W-03 |
| CA-3 | Local por Traefik. Producción: pendiente | W-04 a W-09, W-12 |
| CA-4 | Completo, en local | W-10 |
| CA-14 | Completo, en local, con imágenes de `main` (`352014e`) | V-01 a V-05 |
| CA-15 | Local con condiciones del CI; el CI real corre con el PR listo | G-01 a G-04 |
| CA-16 | Completo | K-01 a K-05 |
| CA-5 a CA-13 | Cerrados en el PR 2. Solo regresión | G-02 |

Pendiente de producción significa que no se cumple todavía y no es `BLOCKED`.

#### Riesgos identificados

- **R-1. Regla exacta frente al router de Koa.** La nota de T-04 del PR 2 registra que Koa trata `/webhooks/whatsapp/` y `/WEBHOOKS/WHATSAPP` como el webhook. `Path` de Traefik es exacto y distingue mayúsculas: tras el corte esas variantes dejan de llegar a un bot. No afecta si la URL en Meta es exactamente la de D-1, pero eso solo se puede confirmar en la consola de Meta.
- **R-2. Normalización de la ruta en Traefik.** `..`, barras dobles y `%2F` pueden hacer que una ruta distinta de la solicitada llegue al router. El 3004 es la segunda defensa (P-1).
- **R-3. `probe_webhook`.** Depende de que `OPTIONS` responda 2xx en la `api`, con y sin bot, y de que la app anterior devuelva CSP en `OPTIONS`. Si la app anterior no la devolviera, el sondeo pasaría sin que la `api` tuviera la ruta.
- **R-4. Vuelta atrás con la `api` al final.** Ese paso es `up -d ... || true`, sin `wait_healthy` ni `probe_webhook`, y después se registra el código 21. Con una `api` anterior con etiqueta y una app anterior sin bot, un fallo ahí dejaría el webhook en un proceso sin bot y el despliegue informaría que se restauró.
- **R-5. Código 22.** Con la `api` al final, un fallo de la app anterior deja la `api` nueva en marcha con `release.env` anterior.
- **R-6. `restore.sh`.** Lectura: no recrea la `api`, así que no apaga el router por sí solo. Pero elimina de `release.env` la imagen y `RESTAURANTE_API_WEBHOOK`. Hipótesis a comprobar: el comando literal de la recuperación en un VPS nuevo (`despliegue.md` §11.7, paso 5: `RESTAURANTE_API_IMAGE=<imagen> $C up -d --no-deps api`) no pasa `RESTAURANTE_API_WEBHOOK=true`, y dejaría el router apagado con una app sin bot, de forma permanente.
- **R-7. Restauración con el bot escribiendo.** `restore.sh` y `despliegue.md` §9 paran `app` antes del `DROP DATABASE`, pero ahora el bot vive en `api`, que sigue en marcha y escribe `bot_*`.
- **R-8. §9 de `despliegue.md`.** Ahí no se reescribe `release.env`. Hipótesis: arrancar una `api` anterior con `RESTAURANTE_API_IMAGE` hereda `RESTAURANTE_API_WEBHOOK=true` y deja el router apuntando a un 3004 que no existe, porque el aviso solo está en el §6.
- **R-9. Nombres en `traefik-public`.** `api` entra por primera vez en una red compartida. Otro stack del VPS con un servicio llamado `api`, `app` o `mysql` podría resolverse desde `api`, `app` o `inventory-manager`. El smoke no tiene vecinos, así que no lo detecta.
- **R-10. Salida a internet.** El bot necesita salir por `traefik-public` (H-1). Hay que confirmar la ruta por defecto y el DNS con tres redes, dos de ellas internas.
- **R-11. Healthcheck sin el 3004 (decisión).** Un webhook que falla después del despliegue no vuelve la `api` `unhealthy`. El sondeo solo cubre el momento del despliegue.
- **R-12. `x-bot-env`.** El merge YAML puede quitar o cambiar una variable de `app`, o dejar fuera de `api` una que su configuración lee (`loadApiConfig`, `parseChatBot`, `parseBotLimits`).
- **R-13. Cifras del informe.** Una sola muestra, con el reloj de un Mac. El CI no tiene imágenes de `main`, así que CA-14 solo se verifica aquí.
- **R-14. Entorno.** Docker Desktop puede reiniciarse y apagar MySQL. AirPlay ocupa el 5000. Son fallos de entorno, y se repite la ejecución antes de clasificar.

#### Preparación y entorno

Todo es local y usa solo valores sintéticos: sin SSH al VPS, sin Meta, sin despliegue y sin leer `.env` reales.

1. **Imágenes propias.** Se reconstruyen los cuatro objetivos desde el working tree, y `production`, `migrate`, `api` e `inventory-manager` desde `git archive 352014e` en el scratchpad. No se reutilizan `restaurante-old:*` ni las etiquetas del implementador. Se comprueba la etiqueta de cada `api`: `whatsapp` en la rama y vacía en `main`.
2. **Ejecutor Linux.** `smoke.sh` y `deploy.sh` necesitan `flock`, GNU `stat` y llegar a la IP de Traefik, y nada de eso existe en el Mac. Se usan desde un contenedor `docker:cli` con bash, curl, jq, util-linux, coreutils, findutils y age, conectado al socket de Docker y a `traefik-public`, con `SMOKE_WORKDIR` en una ruta que el daemon ve igual.
3. **Copia del smoke en el scratchpad.** Solo cambia `REGISTRY_PORT=5050`, y se conserva ese diff como evidencia. Los casos propios van en un guion aparte, también en el scratchpad, sobre el mismo montaje.
4. **Bot sintético.** Formato válido de Meta, sin credenciales reales. Las entregas firmadas no llevan mensajes: `200` sin ninguna salida a Meta.

No se escribe en `restaurante/landing-pages/tests/` ni en `deploy/`. Si un caso merece quedar en `smoke.sh`, se recomienda en el informe.

#### Pruebas funcionales: enrutado por Traefik

Cada caso se identifica por tres señales: estado, cabecera CSP (solo la app) y línea `request` en el log de `api` o de `app`.

- **W-01 (CA-1).** `GET /webhooks/whatsapp` con `hub.*`: token correcto da 200 y el reto, token incorrecto da 403, sin CSP, con `bot_webhook_verify_failed` en `api`. Comparado con la misma petición a la app de `main`.
- **W-02 (CA-2).** `POST` firmado, sin mensajes y con un cuerpo con bytes no ASCII, en HTTP/1.1 y HTTP/2: 200 `OK`, en el log de `api` y no en el de `app`. Traefik no altera el cuerpo ni la cabecera de la firma.
- **W-03 (CA-2).** Sin firma 401, firma incorrecta 403, JSON inválido firmado 400 y cuerpo mayor del límite 413. Mismo estado y cuerpo que `main`, con `bot_webhook_signature_invalid`.
- **W-04 (CA-3).** Rutas que no deben llegar a `api`: 404 de la app, con CSP y sin línea en el log de `api`. `/api/v1/admin/sesion`, `/api/v1/admin/sonda-qa`, `/api/v1/public/birria/productos`, `/webhooks`, `/webhooks/`, `/webhooks/whatsapp/`, `/webhooks/whatsapp/x`, `/webhooks/whatsappx`, `/WEBHOOKS/WHATSAPP`, `/Webhooks/whatsapp`, `/api/webhooks/whatsapp`, `/x/webhooks/whatsapp`, `//webhooks/whatsapp` y `/webhooks//whatsapp`.
- **W-05 (CA-3, R-2).** Con `curl --path-as-is`, sin normalizar: `/webhooks/whatsapp/../../api/v1/public/birria/productos`, `/webhooks/../api/v1/admin/sesion`, `/webhooks/whatsapp/..%2f..%2fapi%2fv1%2fadmin%2fsesion`, `/%2e%2e/api/v1/admin/sesion`, `/webhooks%2Fwhatsapp`, `/webhooks/whatsapp%2F`, `/%77ebhooks/whatsapp`, `/webhooks/whatsapp;x=1`, `/webhooks/whatsapp%20` y `/webhooks/whatsapp%00`. Se acepta cualquier respuesta que no sea un dato de `api`: 400 de Traefik, 404, o el webhook si la ruta normalizada es exactamente la suya. Un dato de `/api/v1` es defecto `BLOCKER`.
- **W-06 (CA-3).** Por el 3004, desde un contenedor de `traefik-public`: `/api/v1/*`, `/salud` y `/` dan 404 sin datos.
- **W-07 (RF-3).** Inventario real de Traefik por `/api/http/routers` y `/api/http/services`, activando su API en la copia del smoke: el único router hacia `api` es `restaurante-webhook`, su servidor está en la IP de `traefik-public` y en el 3004, y ningún servicio apunta al 3001. `docker port` vacío en `api`.
- **W-08 (RF-4).** Otras máquinas y puertos: `https://www.<dominio>/webhooks/whatsapp` da 301 a la raíz, `http://<dominio>/webhooks/whatsapp` da 301 a https como en `main`, y `admin.<dominio>/webhooks/whatsapp` no llega a `api`. También `Host` en mayúsculas y con `:443`, y un `Host` desconocido.
- **W-09 (CA-3).** `/`, `/molotes`, `/birria`, `/admin` y `admin.<dominio>/salud` responden como con `main`. El límite de `/admin` sigue en su router y `/webhooks/whatsapp` no tiene límite, como en `main`: 50 peticiones seguidas sin 429.
- **W-10 (CA-4, RF-5).** `api` sin bot: 503 `BOT_DISABLED`, `OPTIONS` sigue pasando el sondeo, y las landings y los dos admin funcionan.
- **W-11 (RF-3).** `X-Forwarded-For` falsificado por el cliente: el log de `api` lleva la IP que añade Traefik, nunca la falsificada.
- **W-12.** Métodos por Traefik: `PUT` y `DELETE` dan 405 con `Allow`, `HEAD` no procesa nada y `OPTIONS` no deja rastro de error en el log.

#### Pruebas funcionales: `deploy.sh`

Con las imágenes del smoke (`api-sin-webhook`, `api-webhook-mudo`, `app-bad`) y las reales de `main` donde se indica. Cada caso comprueba código de salida, `traefik.enable`, quién atiende la ruta, `release.env` y `releases.log`.

- **D-01 (corte).** `main` a la rama: código 0, `RESTAURANTE_API_WEBHOOK=true`, y la app cambia después de que `probe_webhook` termina (orden en el log).
- **D-02 (sondeo, R-3).** `OPTIONS` por Traefik contra los cuatro destinos: `api` con bot, `api` sin bot, app de `main` y app de la rama. Las dos `api` pasan y las dos apps no.
- **D-03 (código 15).** `api` healthy con el 3004 mudo: código 15, app intacta, `api` anterior, router apagado, y con migraciones nuevas, `protect_running_app` recrea la app.
- **D-04 (código 15 sin `api` anterior).** Sin versión anterior a la que volver: qué queda y qué informa.
- **D-05 (código 16).** `inventory-manager` roto en el corte: el webhook sigue en `api`, con el router encendido, y `release.env` no cambia. Se revisa el siguiente despliegue desde ese estado.
- **D-06 (código 21 hacia `api` sin etiqueta).** La `api` vuelve después de la app, router apagado y webhook en la app anterior.
- **D-07 (código 21 hacia `api` con etiqueta, R-4).** Ambas versiones posteriores al corte: la ruta acaba en la `api` anterior. Además, una `api` anterior que no arranca: se documenta qué queda y si el código 21 lo oculta.
- **D-08 (código 22, R-5).** App anterior también rota: estado de la `api`, del router y de `release.env`, y si `despliegue.md` lo explica.
- **D-09 (compatibilidad).** `release.env` sin `RESTAURANTE_API_WEBHOOK` ni `RESTAURANTE_API_IMAGE`, como tras una restauración: toma la `api` del contenedor en marcha, calcula bien el valor y deja el archivo completo.
- **D-10 (imagen ausente).** Falla el `docker pull` de la `api` anterior: aviso en el log, el despliegue sigue y la vuelta atrás informa lo que ocurre.
- **D-11 (idempotencia).** Redesplegar los mismos digests no recrea la `api` ni causa fallos en el webhook. Una variable `RESTAURANTE_API_WEBHOOK` exportada o en `.env` no altera lo que calcula `deploy.sh`.
- **D-12 (`$C`).** `$C restart api` y `$C up -d --no-deps api` tras un despliegue normal conservan el router y la imagen.

#### Pruebas funcionales: vuelta atrás con imágenes de `main` (CA-14)

- **V-01 (CA-14).** Despliegue de la rama y vuelta a `main` con `deploy.sh`: `GET` con token correcto da 200 y el reto, con CSP y en el log de `app`; `RESTAURANTE_API_WEBHOOK=false`; token incorrecto 403.
- **V-02 (CA-14, RF-13).** Vuelta atrás automática (código 21) con app rota sobre `main`: las mismas comprobaciones.
- **V-03 (cifras).** Muestreo independiente de la ruta cada 0,3 s durante las cuatro operaciones de la tabla de `despliegue.md`, **tres veces cada una**, registrando estado y quién responde. `GET` de verificación y `POST` sin firma: no generan salidas a Meta.

  | Operación | Informado | Se contrasta con |
  | --- | --- | --- |
  | Corte hacia la versión nueva | 74 peticiones, 0 fallos | Mínimo, mediana y máximo |
  | Vuelta atrás automática (21) | 1 respuesta 502 en 73 | Ídem |
  | Reinicio de la `api` con la app nueva | 11 respuestas 404, unos 4 s | Ídem |
  | Volver a `main` con `deploy.sh` | 22 respuestas 404 o 502, unos 8 s | Ídem |

  Las cifras no tienen que ser iguales, pero la tabla debe ser verdadera en orden de magnitud y en su afirmación principal: ningún fallo en el corte, un fallo aislado en la 21. Una diferencia mayor se informa como corrección de CA-16. Un estado final sin bot detrás de la ruta es defecto, sea cual sea la cifra.
- **V-04 (RF-13).** Ninguna ventana termina en un estado permanente sin bot: 60 s después de cada operación, la verificación responde.
- **V-05 (CA-13 en el corte).** Con un bloqueo caducado y la app y la `api` en marcha a la vez durante el corte y la vuelta atrás: `block_expired` una sola vez.

#### Pruebas funcionales: `restore.sh` (R-6, R-7 y R-8)

Con `ops/backup/restore.sh` real, en una copia del smoke de respaldos sobre el compose del PR, con `api` con etiqueta y Traefik. No se simula reescribiendo `release.env`.

- **B-01.** Tras `restore.sh`, con la `api` en marcha: `traefik.enable` sigue en `true`, la ruta sigue en `api` y la verificación responde. Es la respuesta directa a la pregunta de si deja el router apagado.
- **B-02.** Después, cada comando documentado, en sus palabras exactas: `$C restart api`, `$C up -d --no-deps api`, y `RESTAURANTE_API_IMAGE=<imagen> $C up -d --no-deps api` de §11.7. Se anota el estado final del router y de la ruta.
- **B-03.** VPS nuevo: `restore.sh` sin `api` en marcha y luego el paso 5 tal como está escrito.
- **B-04.** Respaldo de una app sin bot sobre una `api` anterior sin etiqueta: la ruta queda sin bot, aunque ningún paso haya fallado. Se comprueba si la documentación lo cubre.
- **B-05 (R-7).** Peticiones al webhook durante el `DROP DATABASE` y la carga, con la `api` en marcha: qué responde, qué registra y si tras la restauración el control del bot y el catálogo de `api` vuelven a coincidir con la base, sin reiniciar. Lo mismo con el §9.
- **B-06 (R-8).** Procedimiento del §9 con una `api` anterior a REQ-F-042 y `release.env` en `true`.
- **B-07.** El siguiente `deploy.sh` tras una restauración deja `release.env` completo (D-09) y `backup.sh` lee un `release.env` con la línea nueva.

#### Pruebas de configuración y red

- **E-01 (P-2, RN-5).** `compose config` con el bot vacío, con todas sus variables y sin `.env` opcionales: válido en los tres casos. Con `RESTAURANTE_API_WEBHOOK` sin definir, `false` y `true`.
- **E-02 (R-12).** Las claves y valores de `app` coinciden exactamente con los de `epic/arquitectura`. Las de `api` son las de la base más el bot y `WEBHOOK_PORT`. Con valores distintos por variable, `api` y `app` reciben los mismos.
- **E-03 (R-12).** Lista de variables que leen `loadApiConfig`, `parseChatBot` y `parseBotLimits` frente al compose. La ausencia de `WHATSAPP_BOT_WEBHOOK_URL` es correcta solo porque Twilio está prohibido en producción: se confirma que `api` arranca sin ella con Meta.
- **E-04 (CA-12).** `api` con `NODE_ENV=production` en el contenedor real: arranca con el bot completo, y con clave ausente, D-6 incumplida o Twilio termina con el mensaje esperado, sin mostrar valores. El contenedor no queda `healthy` y `deploy.sh` da el código 15.
- **E-05 (R-10).** Dentro de `api`: ruta por defecto por `traefik-public`, resolución DNS de `graph.facebook.com` y salida HTTPS a un destino que no es Meta. No se conecta a Meta.
- **E-06 (R-9).** Un contenedor vecino en `traefik-public` con los alias `api`, `app` y `mysql`: qué resuelven `app`, `api` e `inventory-manager`, y si las landings, el aviso interno y la base siguen hablando con el servicio correcto. El resultado local dice si hay riesgo. Si lo hay, la existencia real de esos nombres en el VPS es una pregunta para el usuario.
- **E-07 (R-11).** Con el 3004 detenido dentro de la `api` ya en marcha: estado `healthy` y 502 en la ruta. Confirma el comportamiento decidido y que `despliegue.md` da la pista para diagnosticarlo.
- **E-08.** Sin secretos en la salida de `deploy.sh`, en los logs de `api` y `app` de toda la ronda, ni en `docker inspect` de las etiquetas de Traefik.
- **E-09.** `env.production.example`: sin variables nuevas y coherente con el compose.

#### Pruebas de documentación (CA-16)

- **K-01.** Búsqueda en `README.md`, `docs/{arquitectura,despliegue,desarrollo}.md`, `.env.example` y `deploy/env.production.example`: ninguna descripción del bot dentro de `landing-pages`, salvo el historial marcado como tal.
- **K-02.** Cada punto de RF-14 tiene su contenido: `arquitectura.md` §1, §4, §6, §8 ticket 3, §9 D-3 y §10; `despliegue.md` webhook sin cambio en Meta, variables, comprobaciones, frescura de CA-9, problemas frecuentes y vuelta atrás; `README.md` con bot, túnel, Twilio y simulador.
- **K-03 (D-1).** La URL conservada es la que aparece en todos los documentos. Prevalece sobre cualquier texto anterior de `arquitectura.md` y sobre NotebookLM.
- **K-04.** Comandos y cifras de `despliegue.md`: la tabla de comprobaciones del webhook se ejecuta tal cual en local (con el dominio del smoke), y los comandos de §6, §9 y §11.7 se validan en B-02, B-03 y B-06.
- **K-05.** `.claude/CLAUDE.md` §8 y `.claude/agents/senior-fullstack.md`: las rutas citadas existen. Comprobadas en este análisis las de `api/src/bot/`, `providers/select.ts`, `core/shared/whatsapp-link.ts`, `core/schedule/business-hours.ts`, `api/src/bot/content/`, los dobles, `no-meta.ts` y `chat-bot-contract.test.ts`: todas existen.

#### Pruebas de performance

Memoria local de `api` con `docker stats`, en reposo y con muestreo, comparada con los 100,0 MiB informados. No se juzga el umbral del 80 %, que es del VPS. Duración de `deploy.sh`: lo que añaden `probe_webhook` y la descarga de la `api` anterior.

#### Pruebas de regresión

Blast radius de CodeGraph: `createBotWebhookApp`, `createWhatsAppWebhook` y `parseChatBot`. Este PR no cambia `src/` ni pruebas, lo que se confirma con `git diff --stat`.

- **G-01 (CA-15).** Desde `restaurante/`, `npm run db:up`, `npm run build:css`, `npm run typecheck`, `npm run lint` y `npm test`, este último tal cual, con los tres workspaces, código de salida y totales contrastados con los informados (`api` 36/984, `landing-pages` 129/1455 e `inventory-manager` 8/111). Sin `lint:fix`.
- **G-02 (CA-5 a CA-13).** Son las suites de `npm test`: `bot-procesos-qa-req-f-042*`, `api-process`, `dependency-rule*`.
- **G-03 (duración).** Condiciones del CI con `npm test -- --maxWorkers=4 --shard=1/2` y `--shard=2/2` y `--reporter=json`. Las duraciones locales no predicen las del CI: un archivo por encima de 20 s se contrasta con el log del último CI, sin cambiar timeouts.
- **G-04.** `shellcheck` (imagen `koalaman/shellcheck-alpine:stable`) sobre los archivos de los dos pasos del CI: los de `deploy/` y los de `ops/backup/`. `resumen-test.sh`. `smoke.sh` y `ops/backup/ci/smoke.sh` completos en la copia, con las imágenes reconstruidas, y validación del job `contenido de las imágenes` para `api`.
- **G-05.** Sin cambios ajenos: los archivos del diff son los del informe y `Calculadora.xlsx` no entra en el trabajo.

No aplican responsive, accesibilidad, Stitch ni navegador: no cambia HTML, CSS ni JavaScript del frontend, y W-09 cubre las respuestas de las rutas. Tampoco SEO por la misma razón.

#### Evidencia requerida

Comandos con su código de salida, diff de la copia del smoke, tabla de W-04 y W-05 (ruta, estado, CSP y log), inventario de Traefik, extractos de `deploy-<n>.log`, `release.env` y `releases.log` por escenario, muestras de V-03 por operación y repetición, y salida de los comandos de restauración. Sin valores reales ni secretos. Los archivos quedan en el scratchpad y el informe lleva el resumen.

#### Fuera de alcance

- SSH al VPS, Meta, despliegues, `.env` reales y producción. Por tanto, quedan **pendientes de producción**: CA-1 a CA-3, CA-9, memoria en el VPS, certificado real y comportamiento con la versión de Traefik del VPS (el smoke usa la v3.7.14).
- Pendientes de confirmar por el usuario, solo con su consulta: la URL exacta de Meta (R-1) y, si E-06 lo pide, los nombres de los servicios en `traefik-public` (R-9).
- CI real: corre con el PR listo.
- Corrección de defectos y cambios en `deploy/` o en la documentación: los hace `senior-fullstack`.

#### Criterios de aprobación

`QA_APPROVED` del PR 3 si:

- CA-4, CA-14 y CA-16 pasan con evidencia; CA-1, CA-2 y CA-3 pasan en local y quedan pendientes de producción; CA-15, en local y condicionado al CI;
- ninguna ruta de `/api/v1`, ni el 3001, se alcanza por Traefik;
- ningún camino de `deploy.sh` documentado como correcto deja la ruta sin bot de forma permanente;
- `typecheck`, `lint`, `npm test`, `shellcheck` y los dos smoke pasan, verificados por QA;
- no hay `BLOCKER` ni `CRITICAL`, y cada `MAJOR` tiene decisión del usuario.

Un archivo de más de 20 s en condiciones del CI, una ambigüedad del requisito o un `MAJOR` dan `NEEDS_USER_DECISION`. Lo que falle por el entorno se repite y, si persiste, se informa como bloqueo de entorno, no como defecto.

#### Aprobación del QA Action Plan

Aprobado por el usuario. Cita textual: "Si lo apruebo".

## QA Report

### PR 1 de 3: piezas compartidas a `core`

#### Ronda

1

#### Pruebas ejecutadas

- `npm run db:up` (0) y `npm run build:css` (0).
- `npm run typecheck`: 0. `npm run lint` (`eslint . --max-warnings 0`): 0, sin errores ni avisos.
- `npm test`: 0. `landing-pages` 149 archivos y 2230 pruebas (2229 pasan y 1 `it.fails` previa e intencionada de `local-server.test.ts`, que no está en el diff); `api` 7 y 144; `inventory-manager` 8 y 111.
- Duración por archivo (`vitest --reporter=json` en `landing-pages`): el máximo es 15,9 s (`db-outage-handshake-saludo`), seguido de 15,5 s (`admin-users`). Ninguno pasa de 20 s.
- Diff de `landing-pages/tests` contra `epic/arquitectura` (14 archivos): solo cambian imports y un comentario de `business-hours.test.ts` con la ruta nueva del horario (R-1).
- Archivos movidos frente a su original (`git show epic/arquitectura:…` y `diff`):
  - `bot-control.ts`, `bot-usage.ts`, `limits.ts` y `whatsapp-link.ts`: solo cambian imports y comentarios;
  - `phone.ts`: idéntico.
- `bot-config.ts` frente a lo eliminado de `env.ts`: todas las líneas eliminadas están en `bot-config.ts`, salvo los imports y las dos firmas, que ahora llevan `export` y `BotEnv` en lugar de `Env`. Los mensajes de validación son idénticos (R-2).
- Datos de `business-hours.ts` idénticos a los `hours.ts` eliminados:
  - Molotes: martes a viernes, de 08:30 a 15:00;
  - Birria: sábado y domingo, de 08:00 a 15:00.
- `BUSINESS_NAMES` ("Moloteando", "Birria El Muñeco") y `BRANCH_LOCATION.mapsUrl`: los mismos valores que los literales sustituidos (R-4). `views/admin/bot.ts`, `app.ts` y `server.ts`: solo imports (R-6).
- Referencias a archivos eliminados en `restaurante/` y `.claude/` (excluidos `done/` y este ticket): ninguna. Solo quedan las de `.claude/agents/senior-fullstack.md` (líneas 82 y 164), ya anotadas como pendientes del PR 3 (R-5).
- Regla de dependencias (R-3):
  - los imports de `packages/core` son relativos dentro del módulo, `../shared/index.ts` y `node:crypto` (permitido por `eslint.config.ts`; no es E/S);
  - `index.ts` de `bot-control`, `shared` y `schedule` exporta `bot-config`, `branch`, `whatsapp-link` y `business-hours`;
  - `dependency-rule*.test.ts` en verde.
- Simulador (`node scripts/bot-chat.ts --ahora 2026-10-30T10:00`, con Meta y con Twilio y la misma entrada: saludo, menú, `/hora` al sábado, saludo, menú y `/audio`), en esta rama y en una copia de `epic/arquitectura` (`git archive`): las dos salidas (128 líneas cada una) son **idénticas** con ambos proveedores. Muestran el menú y los nombres de Moloteando el viernes y de Birria El Muñeco el sábado.
- HTML servido: esta rama en el puerto 3100 y la base `epic/arquitectura` en el 3101, con el mismo `.env`, el mismo `DATA_DIR` y `API_INTERNAL_URL` de respaldo. `/`, `/molotes`, `/birria` y `/admin/login` dan 200 y son **byte a byte idénticos**. La única diferencia del 404 es la ruta absoluta del stack de desarrollo.
- Navegador (Claude in Chrome):
  - `/molotes`: horarios "Mar - Vie 08:30 a 15:00", "Martes a Viernes de 8:30 AM a 3:00 PM" y "08:30 - 15:00"; CTA visible sin scroll; sin overflow horizontal; sin errores de consola;
  - `/birria`: "8:00 a 15:00", "08:00 AM – 03:00 PM" y "08:00 - 15:00"; CTA visible; sin aviso; sin errores;
  - `/` (viernes en `America/Mexico_City`): se abre el aviso "La birria es de fin de semana", con enlace a `/molotes`.
- Servidores detenidos (sin escucha en 3100 ni 3101) y pestaña cerrada.

#### Criterios de aceptación

- CA-1 a CA-14: no aplican al PR 1 (PR 2 y 3).
- CA-15 (parcial, local): **PASS** (typecheck, lint y test en 0; máximo 15,9 s por archivo). El CI se verá en el PR.
- CA-16: no aplica al PR 1. El README ya no nombra archivos eliminados.
- RF-7 (parcial): **PASS**. Horario único en `core`; landings y bot coherentes (`business-hours.test.ts` y navegador).
- RF-2: **PASS**. Las pruebas solo cambian imports; el HTML servido y la salida del simulador son idénticos a los de `epic/arquitectura`.

#### Defectos encontrados

Ninguno.

Observación (anterior a este PR, fuera de alcance, no es defecto): el comentario de `landing-pages/src/content/molotes/index.ts` dice "landing de lunes a viernes", pero Molotes abre de martes a viernes. Ya estaba así en `epic/arquitectura`.

#### Regresión

Sin regresión:
- suite completa en verde;
- HTML de las landings y de `/admin/login` idéntico;
- simulador idéntico con Meta y con Twilio;
- `/admin` → Bot queda cubierto por `admin-bot.test.ts` y `bot-control-store.test.ts` (en verde) y su vista solo cambia imports.

#### Responsive

No cambian plantillas ni CSS, y el HTML es idéntico, así que el responsive no cambia. La ventana de Chrome no bajó de 1063 px de ancho al pedir 375×812: a ese ancho, sin overflow y con el CTA visible.

#### Accesibilidad

Sin cambios: HTML idéntico (un `h1` por página, el mismo aviso `dialog`, CTA con texto accesible "(se abre en una pestaña nueva)").

#### UX/UI

Sin cambios visuales; no aplica la revisión contra `_stich_source_/`.

#### Performance

Sin cambios de assets ni de JS de cliente. Sin errores de consola.

#### SEO

`title`, meta y encabezados idénticos a los de `epic/arquitectura` (HTML byte a byte).

#### Pendientes de revisión manual

Ninguno imprescindible. Opcional: ver el móvil real a 375 px (la ventana no se pudo reducir). No cambia nada que dependa del ancho.

#### Resultado final

QA_APPROVED

### Pull Request del PR 1

- **PR:** https://github.com/orvigas/negocio/pull/121 (`feature/REQ-F-042-bot-whatsapp-en-api-1-core` → `epic/arquitectura`).
- **Commit:** `40bfabd` refactor: comparte en core el horario, los datos de la sucursal y el control del bot (REQ-F-042, PR 1 de 3).
- **CI** (ejecución 41081241771): en verde.
  - `calidad`, `docker` (6 min 58 s) y `auditoria`: pass.
  - `verificacion` y `pruebas` (1/2 y 2/2): pass.
  - `publish`, `deploy`, `vigente` y `validado`: omitidos, como corresponde a un PR.

### Pull Request del PR 2

- **PR:** https://github.com/orvigas/negocio/pull/124 (`feature/REQ-F-042-bot-whatsapp-en-api-2-bot` → `epic/arquitectura`).
- **Commits:**
  - `0db70c5` refactor: mueve el bot de WhatsApp de landing-pages a api (REQ-F-042, PR 2 de 3).
  - `4c03d85` test: parte la prueba de procesos del bot por duración (REQ-F-042, PR 2 de 3).
- **CI** (ejecución 41883988101, sobre `4c03d85`): en verde.
  - `calidad` y `auditoria`: pass. `docker` (7 min 9 s): pass.
  - `cambios`, `verificacion` y `pruebas` (1/2 y 2/2): pass.
  - `publish`, `deploy`, `vigente` y `validado`: omitidos, como corresponde a un PR.
- **Duración máxima por archivo en el CI:** 14,5 s (`inventory-manager-qa-req-f-039-csrf.test.ts`), de los 173 archivos del log. Ninguno pasa de 20 s.
- **Pruebas en el CI:** `landing-pages` 129 archivos y 1455 pruebas (1454 y 1 `it.fails` previa). Total de los tres workspaces: 2550.

**Corrección de la duración.** El QA Report dice que ningún archivo pasaba de 20 s; esa medición era local, en condiciones del CI. El CI real sobre `0db70c5` (ejecución 41878055457) estaba en verde, pero `bot-procesos-qa-req-f-042.test.ts` tardó 21,9 s en `pruebas (2/2)`, por encima del límite de CA-15. Se partió por sus `describe`, con la preparación en `tests/support/bot-procesos-qa-req-f-042.ts`, y conserva los 12 casos, sus títulos y lo que comprueban, sin tocar esperas, reintentos ni timeouts:

| Archivo | Casos | Duración en el CI |
| --- | --- | --- |
| `bot-procesos-qa-req-f-042.test.ts` | 10 | 12,5 s |
| `bot-procesos-qa-req-f-042-mantenimiento.test.ts` | 1 | 3,8 s |
| `bot-procesos-qa-req-f-042-desactivado.test.ts` | 1 | 2,4 s |

El primer archivo no se dividió más: queda lejos de 20 s, y T-10 y N-03 dependen de lo que los casos anteriores dejan en los mismos procesos.

**CA-15:** cumplido para este PR, con `typecheck`, `lint` y `npm test` en verde, ningún archivo de más de 20 s en el CI y `calidad`, `docker` y `auditoria` en verde. Queda por repetir en el PR 3.

**Revisión manual:** los pendientes que QA dejó para revisión manual (responsive de `/admin/bot` y de las landings, y editar un producto desde `inventory-manager`) los revisó el usuario, que lo comunicó así: "ya hice las validaciones continua donde nos quedamos". No dio resultados por ancho ni por pantalla y no reportó defectos.

### PR 2 de 3: el bot pasa a `api`

#### Ronda

1

#### Pruebas ejecutadas

**Batería base (`restaurante/`), rama `feature/REQ-F-042-bot-whatsapp-en-api-2-bot`, sin commit:**

- `npm run db:up`: 0. `npm run build:css`: 0.
- Antes de crear las pruebas de QA: `typecheck` 0; `lint` 0, sin avisos; `npm test` 0, con `api` 36 archivos y 980 pruebas, `landing-pages` 125 y 1435 (1434 y 1 `it.fails` previa), `inventory-manager` 8 y 111. Coincide con lo informado por implementación.
- Con las pruebas de QA: `typecheck` 0; `lint` 0; `npm test` 0, con `api` 36 y 980, `landing-pages` 127 y 1453 (1452 y 1 `it.fails` previa), `inventory-manager` 8 y 111.
- Condiciones del CI (`--maxWorkers=4 --shard=1/2` y `2/2`, por workspace): 6 ejecuciones con código 0, 171 archivos, 2544 pruebas y 0 fallos. Archivo más lento: 14,5 s (`db-outage-handshake-saludo`). Ningún archivo pasa de 20 s. El de QA, 11,9 s.
- Duración de `product-repository-contract-prisma-actualizar.test.ts` en el CI del #121 (`gh run`, solo lectura): 10,5 s. En las condiciones del CI de esta ronda quedó por debajo de 11,5 s. Los 21,6 s informados fueron de una ejecución local en paralelo.

No hubo fallos de Docker y ninguna ejecución se repitió por el entorno. El único `ECONNREFUSED` (T-14, primera versión) fue del arnés de QA, que usaba un puerto equivocado. Lo comprobé antes de corregirlo; no era MySQL.

**Pruebas nuevas:** `bot-procesos-qa-req-f-042.test.ts` (12 casos sobre los procesos reales de `api` y `landing-pages`, con MySQL y sin salida a internet) y `dependency-rule-bot-qa-req-f-042.test.ts` (6 casos). Las dos en verde.

**Comparación con la base:** copia de `epic/arquitectura` con `git archive`, arrancada en paralelo con la misma configuración sintética y el doble de salida. Tres bases `restaurante_test_qa042*`, ya borradas. Procesos detenidos: 0 procesos Node escuchando al terminar.

| Caso | Resultado | Evidencia |
| --- | --- | --- |
| T-01 | PASS | Token correcto: 200 y el challenge. Incorrecto: 403 `FORBIDDEN`. Mismo estado y cuerpo que la base |
| T-02 | PASS | 200, respuesta en el doble, `bot_provider_selected` en el log de `api` y no en el de `landing-pages` |
| T-03 | PASS | Meta: sin firma y malformada 401, incorrecta 403, sin salidas y con `bot_webhook_signature_invalid`. Twilio: sin firma y mala 401, buena 200 y 1 salida. Igual que la base |
| T-04 | PASS | 404 sin datos en `/api/v1/admin/sesion`, `/api/v1/public/...`, `/salud`, `/`, `/webhooks/whatsapp/x`, `/webhooks%2Fwhatsapp`, `//api/...` y variantes con `..`. Otro método: 405 con `Allow`. Ver nota |
| T-05 | PASS | Por 3101: webhook 404, público 200, sesión 401 |
| T-06 | PASS | `GET` y `POST` 503 `BOT_DISABLED`, sin `bot_provider_selected` |
| T-07 | PASS | Sin bot, procesos reales: `/`, `/molotes`, `/birria` y `/admin/login` 200; `inventory-manager` arranca y `/acceso` 200; `/api/v1/admin` sesión 201 y productos 200 |
| T-08 | PASS | Procesos reales, temporizador real, `refreshMs` de 1 s: el primer mensaje tras la pausa no produce salidas; tras reanudar, se responde |
| T-09 | PASS | Alta: `bot_blocked_message` y 0 salidas. Baja: respuesta |
| T-10 | PASS | `bot_usage` de día y mes con los envíos de `api`, y el valor aparece en `/admin/bot` |
| T-11 | PASS | Texto de la página: pausa, bloqueos, uso, gasto y aviso. Sin la lista ni su botón. También en navegador a 1281 px |
| T-12 | PASS | 410 con el aviso, sin filas nuevas en `bot_block` ni `bot_audit` |
| T-13 | PASS | Número del personal: 422 sin devolver el número |
| T-14 | PASS | `PUT` real a `/api/v1/admin`: 200 y `freshness: confirmed`. El siguiente mensaje no ofrece el producto |
| T-15 | PASS con hallazgo | Patrones del plan e imports estáticos, por paquete e `import()`: fallan el lint. Ver A-2 |
| T-16 | PASS | `npm run bot:chat` con Meta y Twilio: código 0 y salida de 128 líneas **idéntica** (`cmp`) a la de la base |
| T-17 | PASS | 12 casos más Twilio en producción: `api` y base con el mismo código y las mismas líneas de error. Solo cambia el encabezado ("Configuración de la API inválida" frente a "Configuración inválida"). `WEBHOOK_PORT` `abc`, `0`, `70000` e igual a `PORT`: código 1 con mensaje claro |
| T-18 | PASS | `landing-pages` arranca sin token, App Secret ni verify token, y con ellos (P-2). Rechaza clave, personal, topes, D-6 y Twilio en producción con los textos de la base |
| T-19 | PASS | Procesos reales: 0 `block_expired` con solo `landing-pages`, 1 con `api` y sigue en 1 tras reiniciar las dos |
| T-20 | PASS | Sin `services/whatsapp-bot`, `whatsapp-webhook`, `catalog-reload` ni `content/**/bot.ts`. `GET` y `POST` del webhook en `landing-pages`: 404 |
| T-21 | PASS | Números de arriba |
| T-22 | PASS | Números de arriba |
| N-01 | PASS con hallazgo | `ctx.ip` es el último valor, nunca el primero. Vacío o sin cabecera: la dirección del socket. Ver A-1 |
| N-02 | PASS | JSON inválido 400, cuerpo grande 413 y sin `Content-Type` 200 igual que la base. Duplicado: 1 salida y 0 en la repetición |
| N-03 | PASS | Ningún secreto, número completo ni texto de cliente en los logs de los dos procesos |
| N-04 | PASS | Proxy TCP cortado: `POST` 200 y 1 salida con la copia del control, `bot_control_store_failed` 1 vez, `/admin/login` 503, `bot_control_store_recovered` 1 vez al volver |
| N-05 | PASS | Sin sesión 303 al acceso, sin CSRF 403, editor 403 (`admin-bot.test.ts`), con todo 410. Token no hexadecimal, también 410 |
| N-06 | PASS | Solo `WHATSAPP_BOT_PROVIDER=meta`: `api` en 503 y `/admin` dice "Desactivado" |
| N-07 | PASS | `SIGTERM` tras una entrega: salida 0 y contadores guardados |
| N-08 | PASS | `WEBHOOK_PORT` ocupado: mensaje claro, código 1 y 3401 libre |
| N-09 | PASS | `periodsOf` con `TZ=UTC` y `TZ=Asia/Tokyo`: cambian de día y de mes a las 00:00 de `America/Mexico_City` en el mismo instante |
| N-10 | PASS | Tras rotar `KEY`, el bloqueo creado con la clave anterior se aplica (0 salidas) y se re-clava (`key_id` cambia) |
| N-11 | PASS | Solo por pruebas existentes (`internal-app.test.ts`, `notifier.test.ts`) |
| G-01 | PASS | Inventario de títulos: 17 retirados y 40 agregados. Cada retirado tiene sustituto o lo retira una decisión (D-2, aviso `{ landing }`). "Sobrevive a un reinicio" no tenía sustituto: comprobado a mano, tras reiniciar `api` sigue la pausa y hay 0 salidas |
| G-02 | PASS | Archivos movidos de `src/`: solo imports y comentarios, salvo `chat-bot.ts` (reexporta de `core`) y `scripts/bot-chat.ts` (configuración de `api`). `tests/support/webhook.ts` envía el cuerpo crudo y expone estado, cabeceras y cuerpo reales |
| G-03 | PASS | `bot-control.ts`: el modo `bot` no cambia; el diff solo añade ramas `panel`. Textos de validación iguales (T-17) |
| G-04 | PASS | `business-hours.test.ts` en verde |
| G-05 | PASS | Dentro de `npm test` |
| G-06 | PARCIAL | Suite de `inventory-manager` en verde y T-07. No se editó un producto desde su interfaz: T-14 llama a la API directamente |
| G-07 | PASS | Sin referencias a Meta ni Twilio en `src`, `tests` ni `scripts` de `landing-pages` (fuera del doble de QA) |
| G-08 | PASS | Con `ADMIN_NEW_URL`, un cambio en `api` aparece en `/admin/molotes` al momento. `freshness: pending` porque esa prueba corrió sin aviso interno |
| G-09 | PASS | `api` escribe `bot_*` con el usuario solo DML de pruebas. En `compose.prod.yaml`, `api` y `app` usan `restaurante_app` |
| G-10 | PASS | `README.md` y `docs/arquitectura.md` aún citan rutas antiguas: pendiente previsto del PR 3 |

**Nota sobre T-04:** el plan esperaba 404 en `/webhooks/whatsapp/` y `/WEBHOOKS/WHATSAPP`. Responden 403 porque el router las trata como el propio webhook. La base hace lo mismo y no exponen otra ruta. Corrijo la expectativa del plan, no es defecto. El router exacto de Traefik se comprueba en el PR 3.

#### Criterios de aceptación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS en este alcance; producción en el PR 3 | T-01 |
| CA-2 | PASS en este alcance; producción en el PR 3 | T-02, T-03 |
| CA-3 | PASS en este alcance; Traefik y producción en el PR 3 | T-04, T-05, T-20, HTML idéntico |
| CA-4 | PASS | T-06, T-07 |
| CA-5 | PASS | T-08, T-09. Con `refreshMs` de 1 s en proceso real; los 10 s por defecto, por `bot-control-timers.test.ts` |
| CA-6 | PASS | T-10 |
| CA-7 | PASS | T-11, T-12, N-05 |
| CA-8 | PASS | T-09, T-13 |
| CA-9 | PASS | T-14 |
| CA-10 | Depende de la decisión A-2 | T-15 |
| CA-11 | PASS | T-16 |
| CA-12 | PASS | T-17, T-18 |
| CA-13 | PASS | T-19 |
| CA-15 | PASS en local; **falta el CI**, que no puede correr sin commit | T-21, T-22 |
| CA-14, CA-16 | Fuera de este PR (PR 3) | No evaluados |

#### Defectos encontrados

##### DEF-001

- Severidad: `MINOR`.
- Criterio de aceptación afectado: RF-10 ("El aviso ... sigue siendo verdad"). CA-9 pasa en el flujo normal.
- Descripción: si falla la recarga de la caché de `api` justo después de confirmar la escritura, la escritura responde bien y el bot sigue ofreciendo el producto hasta la recarga de 60 s. Antes, un fallo de esa recarga daba 503 en el aviso interno y la frescura quedaba `pending`. Ahora el notifier solo mira `landing`.
- Pasos para reproducir: repositorio de `core` con un store cuyo `listBusiness` falla una vez tras la transacción; `update` con `available: false`; leer `getPublished`.
- Resultado esperado: si el bot no tiene el cambio, la frescura no se confirma.
- Resultado actual: `update` termina sin error, `available` sigue en `true`, y pasa a `false` tras `reload`. Reproducido a nivel de repositorio. La ruta completa hasta mostrar `confirmed` se deduce del código (`write` traga el fallo y `freshness` solo llama al notifier); no la observé de punta a punta, porque exige que la landing sí recargue en ese mismo instante.
- Evidencia: script de reproducción en el scratchpad; `product-repository.ts`, `write` y `refresh`; `api/src/notifier.ts`.
- Impacto: reducido. Exige un fallo breve de MySQL en ese momento y se corrige solo en 60 s como mucho.
- Recomendación: que la frescura de `api` tenga en cuenta si su propia caché quedó al día.

##### DEF-002

- Severidad: `TRIVIAL`.
- Criterio de aceptación afectado: ninguno.
- Descripción: con Meta, un método no permitido en el webhook responde "Método no permitido." en lugar de "Method Not Allowed". El código `METHOD_NOT_ALLOWED` y el 405 no cambian.
- Pasos para reproducir: `PUT /webhooks/whatsapp` en esta rama y en la base.
- Resultado esperado: sin cambios, según RF-2.
- Resultado actual: cambia el texto.
- Evidencia: comparación `CMP put`.
- Impacto: ninguno observable; Meta no usa ese método.
- Recomendación: aceptarlo.

#### Requirement ambiguity

- **A-1 (RF-3 y R-7).** `ctx.ip` es correcto, pero nada lo consume: el log de peticiones del webhook en `api` ya no lleva `ip` ni `protocol`, y el de `landing-pages` sí los llevaba. RF-3 no dice si la IP debe verse en el log, y RF-2 no enumera los logs. Es la única comprobación visible con la que se podría verificar RF-3 en producción.
- **A-2 (CA-10 y R-9).** Un archivo nuevo en `landing-pages/src/bot/orchestrator.ts` **no** falla el lint. Todas las rutas que enumera el plan técnico sí fallan, y también cualquier import de `api`. CA-10 dice "código del bot" sin acotar la ruta. Retiré ese caso de la prueba nueva para no dejarla en rojo.

#### Clasificación de los riesgos del plan

| Riesgo | Clasificación | Evidencia |
| --- | --- | --- |
| Procesos reales sin prueba (R-4) | No defecto | T-08, T-09, T-10 y T-19 con procesos reales |
| X-Forwarded-For (R-7) | `REQUIREMENT_AMBIGUITY` | A-1 |
| Estado del panel (R-5) | No defecto | N-06 |
| Apagado (R-8) | No defecto | N-07, y 6 entregas con `SIGTERM` inmediato: 6 salidas y 6 guardadas, salida 0, igual que la base |
| Lint CA-10 (R-9) | `REQUIREMENT_AMBIGUITY` | A-2 |
| Aviso de frescura (R-12) | Defecto `MINOR` | DEF-001 |
| Casos perdidos (R-1) | No defecto | G-01 |

El resto de riesgos (R-2, R-3, R-6, R-10, R-11, R-13, R-14 y R-15) quedan descartados por G-02, T-03, T-05, G-07, G-08, G-09, T-22 y por no haber fallos de Docker.

#### Regresión

Sin regresión: `npm test` completo; HTML de `/`, `/molotes`, `/birria` y `/admin/login` **idéntico byte a byte** a la base; simulador idéntico. Diferencias con la base en el webhook: `Cache-Control: no-store` (previsto en el plan técnico), DEF-002 y A-1.

#### Responsive

**No verificado.** `resize_window` no cambió el viewport (`innerWidth` siguió en 1281) y el intento con iframes de 375, 768 y 1440 px dejó la pestaña sin responder. Sin overflow a 1281 px. Landings: HTML idéntico a la base, lo que cubre su marcado; el CSS no se comparó. Queda para revisión manual.

#### Accesibilidad

`/admin/bot`: un `h1`, `h2` sin saltos, `main` presente y aviso con `role="status"` y texto. El foco por teclado llega con `:focus-visible`, pero el estilo leído fue transparente, posiblemente durante la transición: **no concluyente**. El aviso no añade elementos enfocables.

#### UX/UI

El aviso sale con el componente del admin, sin huecos, con el texto aprobado y bajo el encabezado "Alcanzaron un tope hoy". `/` muestra el aviso del miércoles y `/molotes`, ninguno; CTA `https://wa.me/5210000000009?text=Hola`, `_blank`, `noopener noreferrer`. Sin errores en consola.

#### Performance

Sin errores en los logs durante la ronda. Memoria: PR 3.

#### SEO

HTML idéntico a la base: sin cambios en `title`, meta, canonical, Open Graph ni encabezados.

#### Pendientes de revisión manual

- `/admin/bot` a 375×812, 768×1024 y 1440×900, y las landings en móvil.
- Foco visible al tabular en `/admin/bot`.
- Editar un producto desde la interfaz de `inventory-manager` con el bot activo (G-06).

Ningún criterio de aceptación depende solo de estas comprobaciones.

#### Pendientes de otros PR

CI real (`calidad`, `docker`, `auditoria`), router de Traefik, CA-1 a CA-3 en producción, CA-14, CA-16 y memoria.

#### Resultado final

`NEEDS_USER_DECISION`

#### Ronda 2

Revalidación de "Correcciones de QA, ronda 1": DEF-001, A-1 y A-2. Código de producción sin cambios por QA. Las medidas se repitieron; no reutilizan las de la ronda 1.

**Decisiones del usuario:** A-1, "Registrarla (Recomendado)". A-2, "Ampliar a src/bot/** (Recomendado)". DEF-001, "Corregir en este PR (Recomendado)". Correcciones aprobadas para esta ronda: "Si", aceptando la limitación de reintentos (tras un fallo de recarga, `pending` hasta la recarga de 60 s o la siguiente escritura). DEF-002: aceptado, sin objeción del usuario.

##### Pruebas ejecutadas

- Desde `restaurante/`: `npm run typecheck` 0; `npm run lint` 0, sin avisos; `npm test` 0, con `api` 36 archivos y 984 pruebas, `landing-pages` 127 y 1455 (1454 y 1 `it.fails` previa), `inventory-manager` 8 y 111.
- Condiciones del CI (`--maxWorkers=4 --shard=1/2` y `2/2`, por workspace): 6 ejecuciones con código 0, 171 archivos, 2550 pruebas y 0 fallos. Archivo más lento: 13,2 s (`db-outage-handshake-saludo`). `bot-procesos-qa-req-f-042`: 11,7 s. `product-repository-contract-prisma-actualizar`: 6,5 s. Ninguno pasa de 20 s.
- Docker no falló y ninguna ejecución se repitió.

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| DEF-001, caso normal | PASS | Procesos reales, MySQL y aviso interno real: `PUT` 200, `freshness: confirmed`; el siguiente mensaje no ofrece el producto |
| DEF-001, fallo de recarga | PASS | Un proxy TCP cortó, una sola vez, la lectura de productos tras el `COMMIT`: `PUT` 200, `freshness: pending`, `products_cache_refresh_failed` 1 vez, `available = 0` en MySQL y el bot aún ofrece el producto, como acepta la limitación |
| DEF-001, recuperación por escritura | PASS | Siguiente `PUT` sin fallo: `confirmed`, y el bot ya no ofrece ninguno de los dos productos |
| DEF-001, recuperación por recarga | PASS | Nuevo fallo: `pending` y el bot desactualizado. Tras 63 s, sin escrituras, el bot refleja el cambio. El siguiente `PUT`: `confirmed` |
| A-1, puerto del webhook | PASS | Con `X-Forwarded-For: 203.0.113.9, 198.51.100.7` y `X-Forwarded-Proto: https`: `ip` 198.51.100.7 y `protocol` https, también en el 404 de ese puerto. Sin token ni challenge en el log |
| A-1, puerto principal | PASS | `GET /api/v1/public/birria/productos`: claves `method`, `path`, `status` y `durationMs`, sin `ip` ni `protocol` |
| A-2 / CA-10 | PASS | Archivos reales en una copia aislada: `src/bot/orchestrator.ts`, `src/bot/a/b/c.ts` y `src/services/whatsapp-bot/x.ts` dan `no-restricted-syntax` con código 1; `content/birria/index.ts` sigue en 0. Regla en `npm run lint` 0 sobre el repositorio, que no tiene `src/bot/` |
| `isCacheFresh` en `core` | PASS | 9 líneas añadidas, sin imports nuevos ni E/S. Solo lo consume `api/src/admin/product-routes.ts`. Sin cambios ni consumidores en `landing-pages`, cuya suite pasa |

Nota sobre A-2: `lintText` con una ruta inexistente da error de análisis, no el de la regla, porque el archivo no está en el proyecto de TypeScript. Por eso la evidencia usa archivos reales fuera del repositorio.

##### Criterios de aceptación

CA-10: PASS. RF-3 y RF-10: PASS en este alcance. CA-4 a CA-9 y CA-11 a CA-13: PASS; las correcciones no los tocan salvo CA-9, repetido arriba, y la regresión automática los cubre. CA-1 a CA-3: PASS en este alcance, con producción en el PR 3. CA-15: PASS en local, falta el CI. CA-14 y CA-16: fuera de este PR.

##### Defectos

- DEF-001: **corregido y verificado**.
- DEF-002 (`TRIVIAL`): **aceptado** sin cambios.
- A-1 y A-2: **resueltos** según la decisión del usuario.
- Sin defectos nuevos.

##### Regresión

Sin regresión en la suite completa ni en los shards.

##### Responsive

**Sigue sin verificar.** En el reintento, `resize_window` cambió el alto pero no el ancho (`innerWidth` 1440). No insistí. Queda para revisión manual, sin aprobar.

##### Accesibilidad

**Foco visible verificado** en `/admin/bot`: con Tab, el campo "Motivo" tiene `:focus-visible` y un anillo azul de 2 px, visible en la captura. Cierra el pendiente de la ronda 1.

##### Pendientes de revisión manual

- `/admin/bot` a 375×812, 768×1024 y 1440×900, y las landings en móvil.
- Editar un producto desde la interfaz de `inventory-manager` con el bot activo (G-06).

Ningún criterio de aceptación depende solo de estas comprobaciones.

##### Pendientes de otros PR

CI real (`calidad`, `docker`, `auditoria`), router de Traefik, CA-1 a CA-3 en producción, CA-14, CA-16 y memoria.

##### Resultado final

`QA_APPROVED` (PR 2 de 3, condicionado al CI verde en el PR, como en el PR 1).

### PR 3 de 3: despliegue y documentación

#### Ronda

1 (2026-11-04). Rama `feature/REQ-F-042-bot-whatsapp-en-api-3-deploy`, sin commit, sobre `5c6c8bd`. Ejecutada en local, con valores sintéticos, tras la aprobación del plan ("Si lo apruebo"). Evidencia completa en el scratchpad de la sesión (carpeta `ev/`).

#### Resultado final

**`QA_REJECTED`.** CA-16 falla: dos procedimientos de `docs/despliegue.md`, ejecutados tal como están escritos, dejan el webhook sin bot de forma permanente (DEF-001 y DEF-002). `deploy.sh`, el router, el compose y la imagen no tienen ningún defecto `BLOCKER` ni `CRITICAL`, y no se expone ninguna ruta de `api` salvo el webhook.

#### Pruebas ejecutadas

| Prueba | Resultado real |
| --- | --- |
| `npm run db:up`, `build:css`, `typecheck`, `lint` | Código 0 en los cuatro |
| `npm test` (tres workspaces, tal cual) | Código 0. `api` 36 archivos y 984 pruebas; `landing-pages` 129 y 1455 (1454 pasan y 1 `expected fail` previo); `inventory-manager` 8 y 111. Coincide con lo informado |
| Shards con `--maxWorkers=4`, `--shard=1/2` y `2/2` | Código 0. Máximo por archivo: 13,3 s (`db-outage-handshake-subida-saludo.test.ts`). Duración local, no predice la del CI |
| `shellcheck` de los dos pasos del CI | Código 0 en los dos |
| `resumen-test.sh` | Código 0 |
| `deploy/ci/smoke.sh`, imágenes propias de la rama | 158 comprobaciones, 0 fallos. Copia con solo `REGISTRY_PORT=5050` |
| `ops/backup/ci/smoke.sh` | 55 comprobaciones, 0 fallos |
| Imágenes propias | Ocho, reconstruidas: cuatro de la rama y cuatro de `git archive 352014e`. Etiqueta `whatsapp` en la `api` de la rama y vacía en la de `main` |
| Montaje propio | Traefik v3.7.14 con su API activa, registro local, bot Meta sintético. Estado inicial instalado con el `deploy/` de `main` y corte con el de la rama |
| Contenido de imágenes | `api` con el bot y sin el CLI de Prisma ni el simulador; `production` sin simulador |

Docker Desktop y MySQL no se cayeron durante la ronda: ningún fallo fue de entorno.

#### Criterios de aceptación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS en local; pendiente de producción | W-01: token correcto 200 y reto, incorrecto 403, sin CSP, con `bot_webhook_verify_failed` en `api` |
| CA-2 | PASS en local; pendiente de producción | W-02: `POST` firmado con bytes no ASCII, HTTP/1.1 y HTTP/2, 200 `OK`. Un mensaje real por Traefik con un doble de salida en `api`: 200 y una salida, sin contacto con Meta. Sin firma 401, firma mala 403, JSON inválido 400. Mismo estado y cuerpo que `main` |
| CA-3 | PASS en local; pendiente de producción | W-04 a W-09: ver "Hipótesis" y el apartado de enrutado |
| CA-4 | PASS | W-10: `GET` y `POST` 503 `BOT_DISABLED`, landings y admin nuevo responden, `/admin` igual que sin bot |
| CA-14 | PASS | V-01 y V-02: tras volver a `main`, con `deploy.sh` y con el código 21, 200 y reto, con CSP, y `RESTAURANTE_API_WEBHOOK=false`, en las tres repeticiones |
| CA-15 | PASS en local; pendiente del CI | Tabla anterior. Ningún archivo pasa de 20 s en local |
| CA-16 | **FAIL** | K-01, K-02, K-03 y K-05 pasan. K-04 falla: DEF-001 y DEF-002 |
| CA-5 a CA-13 | PASS (regresión) | Suites de `npm test`. CA-12 y CA-13, además, en contenedor real (E-04 y V-05) |

**Pendientes de producción, no cumplidos todavía:** CA-1 a CA-3, CA-9, memoria en el VPS, certificado real y versión de Traefik del VPS.

#### Hipótesis del plan

| Hipótesis | Resultado | Evidencia |
| --- | --- | --- |
| `restore.sh` deja el router apagado | **Descartada** | B-01: `traefik.enable=true`, la ruta sigue en `api` y la verificación responde. `release.env` queda sin las líneas de `api` |
| R-1 Variantes de la URL | **Confirmada como cambio de comportamiento** | `/webhooks/whatsapp/`, `/WEBHOOKS/WHATSAPP` y `/Webhooks/whatsapp` pasan de 403 con el bot a 404 sin bot. No es defecto: D-1 fija la URL exacta. Falta confirmar la URL en la consola de Meta |
| R-3 `probe_webhook` | **Descartada** | D-02: `OPTIONS` da 200 sin CSP en `api` con y sin bot, 200 con CSP en la app de `main` y 404 en la de la rama: pasan solo las `api` |
| R-4 `api` al final sin comprobación | **Confirmada** | D-07b: DEF-003 |
| R-5 Código 22 | **Descartada como defecto** | D-08: la `api` nueva sigue atendiendo el webhook con el router encendido, la app caída y `release.env` sin cambios. El aviso de `despliegue.md` para ese código es suficiente |
| R-6 Comando del §11.7 | **Confirmada** | B-02.3 y B-03: DEF-001 |
| R-7 Restauración con el bot escribiendo | **Descartada como defecto** | B-05 y B-05b: 11 `POST` firmados con pausa y 2623 sin pausa durante `restore.sh`, todos con 200, `api` healthy, sin reinicios y sin errores en el log. La pausa creada después del respaldo desaparece de `api` sin reiniciar. Límites de la prueba: la base es diminuta (unos 3 s de restauración) y la ráfaga activó el enfriamiento del bot, así que casi ninguna entrega llegó a escribir |
| R-8 §9 con `release.env` en `true` | **Confirmada** | B-06: DEF-002 |
| R-9 Nombres en `traefik-public` | **Confirmada en local** | E-06: DEF-004 |
| R-10 Salida a internet | **Descartada** | E-05: ruta por defecto por `traefik-public`, DNS de `graph.facebook.com` correcto y HTTPS a `1.1.1.1` con 200, sin contactar con Meta |
| R-11 Healthcheck sin el 3004 | **Confirmada como decisión** | E-07: `healthy` con 502. `despliegue.md` no tiene entrada para un 502 (ver DEF-002) |
| R-12 `x-bot-env` | **Descartada** | E-01: válido con y sin bot. E-02: entorno y etiquetas de `app` idénticos a la base; `mysql`, `migrate` e `inventory-manager` también; `api` solo suma el bot y `WEBHOOK_PORT`, con los mismos valores que `app` |
| R-13 Cifras del informe | **Confirmadas en orden de magnitud** | V-03 |

#### V-03: fallos de `/webhooks/whatsapp` (una petición cada 0,3 s, tres repeticiones)

| Operación | Informado | Medido por QA |
| --- | --- | --- |
| Corte hacia la versión nueva | 0 fallos | 0, 0 y 0 |
| Vuelta atrás automática (21) | 1 respuesta 502 | 1, 1 y 1 (502) |
| Reinicio de la `api` con la app nueva | 11 respuestas 404, unos 4 s | 9, 9 y 9 (404), en 2,6 s |
| Volver a `main` con `deploy.sh` | 22 respuestas, unos 8 s | 22, 23 y 33 (404 y 502), entre 7,6 y 10,2 s |

La tabla de `despliegue.md` es verdadera en su afirmación principal. V-04: tras cada operación, la verificación responde; la primera repetición esperó 60 s.

#### Defectos encontrados

##### DEF-001

- **Severidad:** `MAJOR`. Es el procedimiento de recuperación ante desastre, el bot queda fuera sin ningún error y existe alternativa (volver a desplegar).
- **Criterio afectado:** CA-16, RF-13.
- **Descripción:** `docs/despliegue.md` §11.7, paso 5, indica `RESTAURANTE_API_IMAGE=<imagen> $C up -d --no-deps api` tras `restore.sh`. Como `release.env` ya no tiene `RESTAURANTE_API_WEBHOOK`, la `api` queda con el router apagado.
- **Pasos:** desplegar la rama, ejecutar `restore.sh` y ese comando (B-02.3). Lo mismo sin `api` previa (B-03).
- **Resultado esperado:** el webhook llega a la `api`.
- **Resultado actual:** `enable=false` y 404 con CSP tras 30 y 60 s, en una app sin bot, de forma permanente.
- **Evidencia:** `ev/s4.txt`. Con `RESTAURANTE_API_WEBHOOK=true` añadido, 200 y reto (B-02.4).
- **Impacto:** tras la recuperación, las landings funcionan y el bot no atiende a nadie.
- **Recomendación:** el comando documentado debe dejar el router coherente con la imagen. El §5 ("Recrear la `api`") remite al §6, que solo menciona `false`.

##### DEF-002

- **Severidad:** `MAJOR`. Los dos casos dejan la ruta sin bot de forma permanente, y existe alternativa (desplegar).
- **Criterio afectado:** CA-16, RF-13.
- **Descripción:** las restauraciones con una `api` de otra versión no están cubiertas.
  - §9 ("arráncalos igual con `RESTAURANTE_API_IMAGE`"): con una `api` anterior a REQ-F-042, hereda `true` de `release.env`. El aviso solo está en el §6.
  - `restore.sh` de un respaldo con app sin bot sobre una `api` sin etiqueta: el script termina con 0.
- **Pasos:** B-06 y B-04.
- **Resultado esperado:** RF-13, nunca un webhook apuntando a un proceso sin bot, o un aviso en el procedimiento.
- **Resultado actual:** B-06 da `enable=true` y 502 en `GET` y `POST`, y B-04 da 404 con CSP tras 20 s.
- **Evidencia:** `ev/s4.txt`.
- **Impacto:** quien sigue el §9 deja el bot fuera. "Problemas frecuentes" no tiene una entrada para el 502.
- **Recomendación:** avisar en esos dos procedimientos y documentar el síntoma 502.

##### DEF-003

- **Severidad:** `MINOR`. Exige un doble fallo: app nueva rota y `api` anterior que no arranca.
- **Criterio afectado:** RF-13.
- **Descripción:** en el código 21 con `api` anterior con etiqueta, ese último paso no se comprueba.
- **Pasos:** D-07b, `api` anterior que sale al arrancar.
- **Resultado esperado:** que el resultado refleje que el webhook no quedó atendido.
- **Resultado actual:** código 21, "versión anterior restaurada", `api` en `restarting` con 8 reinicios y 404 de la app sin bot.
- **Evidencia:** `ev/s3.txt`.
- **Impacto:** el operador ve un despliegue fallido, pero el mensaje dice que todo se restauró. Solo afecta a versiones posteriores a REQ-F-042.
- **Recomendación:** comprobar ese paso, o decirlo en el mensaje.

##### DEF-004

- **Severidad:** `MAJOR`, condicionada a que exista ese nombre en el VPS. El impacto observado es la entrega de una credencial a otro contenedor.
- **Criterio afectado:** ninguno directo. RF-3 y riesgo H-1, que solo aceptó que un vecino alcance `api:3001`.
- **Descripción:** al entrar en `traefik-public`, `api` resuelve también por esa red los nombres `app` y `mysql`.
- **Pasos:** contenedor en `traefik-public` con alias `app`, y después `mysql` (E-06).
- **Resultado esperado:** `api` habla con sus servicios.
- **Resultado actual:**
  - alias `app`: 4 de 5 peticiones a `http://app:3002` llegan al vecino, con la cabecera `Authorization`;
  - alias `mysql`: el DNS solo devuelve al vecino y la `api` no arranca, que `deploy.sh` convertiría en código 15;
  - alias `api`: no afecta a la `api`. La `app` y `inventory-manager` ya estaban expuestas antes de este PR, igual que `app` a `mysql`.
- **Evidencia:** `ev/s3.txt` y `ev/s5.txt`.
- **Impacto:** si otro stack del VPS tiene un servicio `app`, el aviso interno falla y el token llega a ese contenedor.
- **Recomendación:** confirmar los nombres en el VPS. Si hay colisión, el nombre usado por `api` no debe depender de esa red.

##### DEF-005

- **Severidad:** `MINOR`. Solo es alcanzable sin ninguna `api` anterior, cosa que no pasa en el VPS actual.
- **Criterio afectado:** RF-13.
- **Descripción:** código 15 sin `api` anterior, con 3004 mudo (D-04): la `api` rota sigue en marcha con el router encendido.
- **Resultado actual:** 502, con la app anterior con bot en marcha, aunque el log diga "la app no se tocó".
- **Recomendación:** tratarlo en la misma corrección que DEF-003.

##### DEF-006

- **Severidad:** `TRIVIAL`.
- **Criterio afectado:** ninguno.
- **Descripción:** con la `api` anterior imposible de descargar (D-10), el aviso dice que una vuelta atrás "dejaría el webhook en la app". En realidad falla el `up`, la `api` nueva sigue y el webhook responde.
- **Recomendación:** ajustar el mensaje.

#### Regresión

Sin regresión. `deploy.sh` y el router:

- **Códigos:** 0, 15, 16, 21 y 22 se comportan como se documenta (D-01 a D-12), salvo DEF-003 y DEF-005.
- **Idempotencia:** los mismos digests no recrean la `api` y dan 0 fallos en 34 peticiones. `RESTAURANTE_API_WEBHOOK` exportada o en `.env` no altera el valor calculado.
- **`$C`:** `restart api` y `up -d --no-deps api` conservan router e imagen tras un despliegue normal.
- **`release.env`:** sin las líneas de `api`, el siguiente despliegue lo deja completo (B-07, D-04). `backup.sh` funciona con la línea nueva.
- **CA-13:** una sola `block_expired` en el corte, en la vuelta atrás y al volver a `main`.
- **Secretos (E-08):** seis valores buscados en logs de despliegue y restauración, logs de `api` y `app` y etiquetas: 0 coincidencias.

**Enrutado (W-04 a W-12):** inventario de Traefik con un solo router hacia `api`, `restaurante-webhook`, en el 3004 y en su IP de `traefik-public`. Ningún servicio apunta al 3001 y `docker port` está vacío. Tras la matriz completa, el log de `api` solo tiene `/webhooks/whatsapp`. Ningún dato de `/api/v1` en los 15 casos de `--path-as-is`.

**Corrección de la expectativa del plan:** `//webhooks/whatsapp`, `/webhooks//whatsapp`, `/x/../webhooks/whatsapp` y `/%77ebhooks/whatsapp` no dan 404: Traefik las normaliza y llegan al webhook, como en `main`. No exponen otra ruta. No es defecto.

El `/admin` responde 503 `ADMIN_UNAVAILABLE` en el montaje, igual con `main` y con la rama, porque no hay usuarios. Su funcionamiento lo cubre `npm test`.

#### Responsive, accesibilidad, UX/UI y SEO

No aplican: no cambia HTML, CSS ni JavaScript del frontend. Tamaño de `/`, `/molotes` y `/birria` idéntico con `main` y con la rama.

#### Performance

`api` entre 97,2 y 99,0 MiB, frente a los 100,0 MiB informados. Un despliegue completo tarda entre 15 y 22 s en local: el sondeo no lo alarga de forma apreciable.

#### Pendientes de revisión manual

- **Meta:** confirmar, solo consultando, que la URL de la consola es exactamente `https://birriaelmuneco.com/webhooks/whatsapp` (R-1).
- **VPS:** nombres de los servicios en `traefik-public` (DEF-004).

#### No ejecutado

- CI real, despliegue, Meta, SSH al VPS.
- Twilio por Traefik: prohibido en producción. Su rechazo en contenedor real sí se comprobó.
- Corte con la versión de Traefik del VPS.
- Restauración con una base de tamaño real.
- `/admin` con usuarios por Traefik.
- `protect_running_app` con webhook mudo: lo cubre el smoke con la `api` rota.

#### Ronda 2 (2026-11-05)

Revalidación de "Correcciones de QA, ronda 1". Rama sin commit, con las decisiones del usuario: corregir DEF-001 a DEF-006; R-1 queda sin efecto porque la URL de Meta se confirmó exacta. Sin SSH, Meta, despliegues ni `.env` reales. Evidencia en `ev2/` del scratchpad.

##### Resultado final de la ronda 2

**`QA_APPROVED` (PR 3), condicionado al CI verde en el PR y a las comprobaciones de producción.** DEF-001 a DEF-006 quedan corregidos, CA-16 pasa y no hay defectos abiertos.

##### Montaje

- **Fidelidad:** proyecto `restaurante`, sin `COMPOSE_PROJECT_NAME` en `.env`, como el `env.production.example`. Contenedores reales: `restaurante-mysql-1`, `restaurante-app-1`, `restaurante-api-1` y `restaurante-inventory-manager-1`. Estado inicial instalado con el `deploy/` de `main`.
- **Imágenes:** ocho reconstruidas por QA, de la rama y de `352014e`.
- **`sudo` real:** usuario `deploy` con `NOPASSWD`, `sudo` de Alpine con `env_reset`. El bloque de "Arrancar la `api` a mano" se extrae de `despliegue.md` y solo se sustituyen `cd /opt/restaurante` por la ruta del montaje y el digest.
- **Sin Ubuntu:** el `sudo` del VPS no se probó. Los demás comandos del §6 y §9 se copiaron con la misma sustitución.

##### Pruebas ejecutadas

| Prueba | Resultado real |
| --- | --- |
| `build:css`, `typecheck`, `lint` | Código 0 |
| `npm test` | Código 0: `api` 36 y 984; `landing-pages` 129 y 1455 (1454 más el `expected fail` previo); `inventory-manager` 8 y 111 |
| Shards `--maxWorkers=4` | Código 0. Máximo 13,0 s. Medición local |
| `shellcheck` de los dos pasos y `resumen-test.sh` | Código 0 |
| `deploy/ci/smoke.sh` | **184 comprobaciones, 0 fallos** |
| `ops/backup/ci/smoke.sh` | **58 comprobaciones, 0 fallos** |
| Secretos | Seis valores, en logs de despliegue, restauración, `api` y `app`: 0 coincidencias |
| `compose config` | Válido con y sin bot y con el router sin definir, `false` y `true`. `app`, `mysql`, `migrate` e `inventory-manager` idénticos a la base. Router sin cambios |

##### Defectos de la ronda 1

| Defecto | Escenario repetido | Antes | Ahora | Resultado |
| --- | --- | --- | --- | --- |
| DEF-001 | Procedimiento tras `restore.sh`, con y sin `api` en marcha | `enable=false` y 404 permanente | `enable=true`, 200 y reto a los 10 y 60 s; `POST` sin firma 401 en `api` | Corregido |
| DEF-002 | §9 con `api` de `main` y `release.env` en `true` | 502 permanente | `enable=false`, 200 con la app de `main` | Corregido |
| DEF-002 | `restore.sh`, app sin bot y `api` sin etiqueta | Código 0 sin ningún aviso | Código 0 y `AVISO` en la última línea; arreglado con el procedimiento | Corregido |
| DEF-002 | Fila del 502 | Sin entrada | 502, el comando da etiqueta vacía, y el procedimiento quita el 502 | Corregido |
| DEF-003 | Código 21 con `api` anterior que no arranca | 21 y "restaurada" | **22**, `health_failed_api_not_restored`, y mensaje propio | Corregido |
| DEF-004 | Vecino con alias `app` y `mysql` | 4 de 5 avisos al vecino; `api` sin arrancar | 10 de 10 avisos a la app, 0 peticiones al vecino, `api` healthy sin reinicios | Corregido |
| DEF-005 | Código 15 sin `api` anterior y 3004 mudo | 502 con la `api` rota | `api` detenida, 200 de la app con bot | Corregido |
| DEF-006 | `api` anterior no descargable | Aviso incorrecto | "seguiría la api nueva", y el webhook sigue atendido | Corregido |

##### DEF-004 en detalle

- **Nombres usados:** en `docker inspect` de `api`, `DATABASE_URL` apunta a `restaurante-mysql-1` y `LANDING_INTERNAL_URL` a `http://restaurante-app-1:3002`, sin `COMPOSE_PROJECT_NAME` y sin tocar `.env`. Coincide con `despliegue.md` y con los nombres vistos en el VPS.
- **Vecino:** `app` y `mysql` siguen resolviendo al vecino desde la `api`, y los nombres de contenedor no. Por eso el cambio funciona.
- **Vuelta atrás:** con `api` y app de `main`, los mismos nombres funcionan: productos desde la base, aviso interno y `healthy` con el vecino.
- **Arranque antes que el contenedor:**
  - Sin `restaurante-app-1`: la `api` queda healthy; el aviso falla con `bad address` y funciona al volver la app.
  - Sin `restaurante-mysql-1`: la `api` espera con `database_waiting`, sin reinicios, y queda healthy al volver MySQL.
  - Primer despliegue desde cero, con la `api` antes que la app: código 0, 200 y aviso correcto.

##### `restore.sh` y su `AVISO`

| Caso | Código | `AVISO` | Correcto |
| --- | --- | --- | --- |
| `api` con router | 0 | No | Sí |
| App con bot y `api` sin router | 0 | No | Sí |
| App sin bot y `api` sin etiqueta | 0 | Sí | Sí |
| Sin `api` | 0 | Sí | Sí |
| `api` en bucle de reinicios con router | 0 | No | Ver OBS-1 |

`backup.sh` funciona con `release.env` completo y un despliegue posterior a la restauración lo deja completo.

##### Documentación y `sudo env` (CA-16)

- **Hallazgo de `sudo`, confirmado:** con `RESTAURANTE_API_IMAGE=x sudo docker compose ...` la variable no llega (0 coincidencias en `config --images`), y con `sudo env` sí (1).
- **§6, los dos sentidos:** app y después `api` a `main`, sin router y con 200 de la app. Después `api` con webhook sobre esa app, con router y 200 de la `api`. Vuelta de la app. El siguiente despliegue termina con 0.
- **§9:** `stop`, `DROP`, carga del volcado, app, `inventory-manager` y `api`, con el procedimiento: 200 con router coherente. Con app sin bot y `api` anterior da 404, y la nota "Alguien tiene que atender el webhook" lo advierte.
- **Búsqueda:** una sola línea de `despliegue.md` recrea la `api`, y lleva `RESTAURANTE_API_WEBHOOK`. Ninguna descripción del bot en `landing-pages`, salvo la tabla histórica de `arquitectura.md`.

##### V-03, tres repeticiones

| Operación | Ronda 1 | Informe de la corrección | Ronda 2 |
| --- | --- | --- | --- |
| Corte | 0, 0, 0 | 0 | **0, 0, 0** |
| Vuelta atrás automática (21) | 1, 1, 1 | 4 | **1, 1, 1** (502) |
| Reinicio de la `api` | 9, 9, 9 | 11 | **9, 9, 10** (404), hasta 2,8 s |
| Volver a `main` con `deploy.sh` | 22, 23, 33 | 14 | **28, 30, 30**, entre 9,6 y 10,6 s |

Los 4 fallos de la vuelta atrás no se reproducen, y `despliegue.md` da un rango correcto ("entre 1 y 4"). Los 14 tampoco. Las ventanas son de segundos en todos los casos y V-04 pasa: nunca queda un estado permanente sin bot.

##### Las pruebas nuevas del smoke detectan el defecto

Se reintrodujeron los defectos en una copia, sin tocar el repositorio:

| Mutación | Comprobaciones que fallan |
| --- | --- |
| `mysql` y `app` en el compose (DEF-004) | `la api avisa a la app por su nombre de contenedor`, `la api llega a MySQL por su nombre de contenedor`, `la api arranca con el vecino en la red` |
| Sin detener la `api` (DEF-005) | `la api rota queda detenida`, `la ruta del webhook vuelve a la app` |
| Sin comprobar la `api` anterior (DEF-003) | `con app rota y la api anterior sin arrancar -> 22, no 21`, `releases.log lo registra` |
| Comando sin la variable en `despliegue.md` (DEF-001) | `todo comando documentado que recrea la api pasa RESTAURANTE_API_WEBHOOK` |
| `restore.sh` nunca avisa | `restore.sh avisa de que nadie atiende el webhook` |
| `restore.sh` siempre avisa | `y sin aviso` |

Total de la copia mutada del despliegue: 176 pasan y 8 fallan, las esperadas.

##### Criterios de aceptación, ronda 2

| Criterio | Resultado |
| --- | --- |
| CA-1, CA-2, CA-3 | PASS en local (router sin cambios); pendientes de producción |
| CA-4 | PASS, por el smoke |
| CA-14 | PASS: 6 de 6 operaciones con 200, reto, CSP y `enable=false`; token incorrecto 403; línea en el log de `app` |
| CA-15 | PASS en local; pendiente del CI |
| CA-16 | **PASS** |
| CA-5 a CA-13 | PASS (regresión) |

##### Observaciones, no defectos

- **OBS-1:** el `AVISO` mira la etiqueta del router, no si la `api` responde. Con una `api` que ya estaba en bucle de reinicios y router encendido, no avisa y la ruta da 404. La `api` estaba rota antes de restaurar y el texto del aviso describe otro caso.
- **OBS-2:** tras un código 15 sin `api` anterior, la `api` detenida cuenta como "anterior". Si el siguiente despliegue falla, termina con 22 y un mensaje correcto, pero queda esa `api` rota con 502. Exige tres fallos seguidos y un VPS sin `api` previa.
- **OBS-3:** `despliegue.md` dice "unos 8 s" al volver a la versión anterior; en esta ronda fueron entre 9,6 y 10,6 s. Es el mismo orden de magnitud y el texto avisa de que varía.
- **OBS-4:** la comprobación del smoke `y el aviso interno sigue llegando a la app` usa el nombre de contenedor directo y no detecta por sí sola la mutación del compose. La comprobación estática sí la detecta.
- **OBS-5:** el sufijo `-1` depende de la convención de Compose para una sola réplica. Un cambio lo detectaría el smoke.
- **Riesgo previo al ticket, solo anotado:** `app` usa `mysql` y `api`, e `inventory-manager` usa `api`, por nombre de servicio. Siguen expuestos a un alias de `traefik-public`.

##### Pendientes de producción

CA-1 a CA-3, CA-9, memoria en el VPS y certificado real. Hay que reinstalar `deploy/` cuando el job falle con el código 4 y `restore.sh` en el paso 11.5, para tener el `AVISO`.

##### No ejecutado

- CI real, despliegue, Meta y SSH al VPS.
- `sudo` de Ubuntu: se probó el de Alpine.
- Los comandos en `/opt/restaurante`: se ejecutaron en la ruta del montaje.
- `sudo -u deploy -H docker pull` contra GHCR: se usó el registro local.
- Restauración con una base de tamaño real.
- Pruebas W completas por `curl`: el router no cambió y el smoke cubre sus rutas.
- Memoria de `api`: no se volvió a medir con la imagen de la rama, que no cambió de digest respecto a la ronda 1.

### Pull Request del PR 3

- **PR:** https://github.com/orvigas/negocio/pull/126 (`feature/REQ-F-042-bot-whatsapp-en-api-3-deploy` → `epic/arquitectura`). Mergeado por el usuario el 2026-11-05 UTC: merge `16acc18`, head `f0682cf`.
- **Commits:**
  - `a2f1b93` feat: enruta el webhook de WhatsApp a api con la misma URL y vuelta atrás segura (REQ-F-042, PR 3 de 3).
  - `f0682cf` docs: documenta el bot en api, su despliegue y su recuperación (REQ-F-042, PR 3 de 3).
- **CI** (ejecución 41943418030, sobre `f0682cf`): en verde.
  - `calidad`: pass. `auditoria`: pass (40 s). `docker`: pass (13 min 25 s).
  - `cambios`, `verificacion`, `pruebas (1/2)` y `pruebas (2/2)`: pass.
  - `publish`, `deploy`, `vigente` y `validado`: omitidos, como corresponde a un PR.
  - Prueba de humo del despliegue y de los respaldos dentro de `docker`: 184 y 58 comprobaciones, 0 fallos.
- **Duración máxima por archivo en el CI** (límite 20 s), de los 173 archivos del log; ninguno pasa de 20 s:
  - `landing-pages`: 17,6 s (`server-startup-provider-qa.test.ts`), de 129 archivos;
  - `api`: 8,4 s (`admin-users-api.test.ts`), de 36 archivos;
  - `inventory-manager`: 1,3 s (`products.test.ts`), de 8 archivos.
- **Pruebas en el CI:** `api` 984, `landing-pages` 1455 (1454 y 1 `expected fail` previo) e `inventory-manager` 111. Total: 2550.
- **Reglas de agentes:** este PR incluyó en `.claude/agents/senior-fullstack.md` y `.claude/agents/senior-qa.md` las dos reglas pedidas por el usuario ("si, déjalo como regla"): la revisión previa a QA y la regresión selectiva.

**CA-15:** cumplido: `typecheck`, `lint` y `npm test` en verde, ningún archivo de más de 20 s en el CI y `calidad`, `docker` y `auditoria` en verde.

**Pendientes de producción, a cargo del despliegue de la épica:** CA-1, CA-2, CA-3, CA-9, memoria en el VPS y certificado real. Acciones manuales: reinstalar `deploy/` cuando el job `deploy` falle con el código 4 (paso 1.3), actualizar `restore.sh` en el VPS (paso 11.5) y hacer "Comprobaciones del webhook (REQ-F-042)" de `docs/despliegue.md`.

## Trazabilidad

| Objetivo / historia | Requisitos | Criterios |
| --- | --- | --- |
| Objetivo (bot en `api`) | RF-1, RF-12 | CA-10 |
| HU-1 | RF-2, RF-4, RF-5, RF-7, RF-10, RF-13 | CA-1, CA-2, CA-4, CA-9, CA-11, CA-14 |
| HU-2 | RF-6, RF-8, RF-9 | CA-5, CA-7, CA-8 |
| HU-3 | RF-8 | CA-6 |
| HU-4 | RF-3 | CA-3 |
| Configuración | RF-6 | CA-12 |
| Mantenimiento | RF-11 | CA-13 |
| Documentación | RF-14 | CA-16 |
| Calidad | — | CA-15 |

Diseño: no implica `_stich_source_/`; solo cambia un bloque de la página "Bot" de `/admin`, con el sistema visual actual del admin.

## Historial de cambios

### Versión 1

Análisis inicial con cuatro preguntas: URL del webhook, página "Bot" de `/admin` en la transición, estado del bot en producción y configuración en la transición.

### Versión 2

Incorpora las decisiones D-1 a D-4. Resuelve C-1 (se conserva la URL; sin acción en Meta, a diferencia del texto del plan §8) y C-2 (el bot está activo en producción). Se elimina como requisito la ventana de despliegue en lunes. Precisa RF-4, RF-6, RF-8 y RF-13 y los criterios CA-1 a CA-3, CA-7 y CA-8.

### Versión 3

Revisión técnica de `senior-fullstack` (2026-10-30): hallazgos H-1 a H-8, decisiones técnicas P-1 a P-3 (con opción recomendada) y Technical Action Plan en tres PR hacia `epic/arquitectura`. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Versión 4

Technical Action Plan aprobado con P-1 A, P-2 A y P-3 A (citas en "Decisiones técnicas tomadas"). Ticket a `in-progress/`, estado `IN_PROGRESS`; empieza el PR 1 en `feature/REQ-F-042-bot-whatsapp-en-api-1-core`, desde `epic/arquitectura` (con el #120 ya mergeado).

### Versión 5

Implementación del PR 1 (piezas compartidas a `core`): typecheck, lint y pruebas en verde. Estado: `NEEDS_IMPLEMENTATION_APPROVAL` del PR 1.

### Versión 6

Implementación del PR 1 aprobada por el usuario ("Si la apruebo"). `senior-qa` agrega el QA Action Plan del PR 1 (regresión; CA-1 a CA-14 quedan para los PR 2 y 3). Estado: `NEEDS_QA_PLAN_APPROVAL`.

### Versión 7

QA Action Plan del PR 1 aprobado por el usuario ("Si lo apruebo"). QA ronda 1 del PR 1 ejecutada: sin defectos y sin regresión (HTML servido y simulador idénticos a `epic/arquitectura`). Estado: `QA_APPROVED` (PR 1).

### Versión 6

PR 1 (`QA_APPROVED`, ronda 1) commiteado y abierto: #121 hacia `epic/arquitectura`, con el CI en verde. El ticket sigue en `in-progress/` hasta los PR 2 y 3.

### Versión 8

PR 1 mergeado (#121). PR 2 implementado y validado en local, sin commit (retomado tras la interrupción del 2026-10-30). Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Versión 9

Implementación del PR 2 aprobada por el usuario ("si"). `senior-qa` agrega el QA Action Plan del PR 2 (CA-4 a CA-13 completos; CA-1 a CA-3 y CA-15 parciales; CA-14 y CA-16 para el PR 3). Estado: `NEEDS_QA_PLAN_APPROVAL`.

### Versión 10

QA Action Plan del PR 2 aprobado por el usuario ("si"). QA ronda 1 ejecutada: sin defectos `BLOCKER`, `CRITICAL` ni `MAJOR`; DEF-001 `MINOR`, DEF-002 `TRIVIAL` y dos `REQUIREMENT_AMBIGUITY` (A-1 y A-2). Responsive sin verificar por el entorno. Estado: `NEEDS_USER_DECISION`.

### Versión 11

Correcciones de QA ronda 1 del PR 2: DEF-001, A-1 y A-2, según las decisiones del usuario. DEF-002 se acepta sin cambios. Sin commit. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### Versión 12

QA ronda 2 del PR 2: DEF-001, A-1 y A-2 verificados, DEF-002 aceptado y foco visible comprobado. Responsive sigue sin verificar, para revisión manual. Estado: `QA_APPROVED` (PR 2), condicionado al CI.

### Versión 13

CI del PR 2 en #124: la primera ejecución dio 21,9 s en `bot-procesos-qa-req-f-042.test.ts`, que se parte por sus `describe` (`4c03d85`) sin cambiar casos. CI en verde con un máximo de 14,5 s por archivo: CA-15 cumplido para este PR. Revisión manual hecha por el usuario, sin defectos reportados. Estado: `READY_FOR_MERGE` (PR 2 de 3).

### Versión 14

PR 3: implementación de despliegue y documentación en `feature/REQ-F-042-bot-whatsapp-en-api-3-deploy`. Estado: `NEEDS_IMPLEMENTATION_APPROVAL` (PR 3). CA-1 a CA-3 quedan pendientes de producción.

### Versión 15

Implementación del PR 3 aprobada por el usuario ("1. si"), y autorizada la actualización de `.claude/CLAUDE.md` §8 y `.claude/agents/senior-fullstack.md` ("2. si"), que la sesión principal ya aplicó. QA Action Plan del PR 3 escrito, sin ejecutar pruebas. Estado: `NEEDS_QA_PLAN_APPROVAL` (PR 3).

### Versión 16

QA Action Plan del PR 3 aprobado por el usuario ("Si lo apruebo") y ejecutado, ronda 1: 158 y 55 comprobaciones de los dos smoke sin fallos, CA-14 verificado con imágenes de `main`, y seis defectos (tres `MAJOR`, dos `MINOR` y un `TRIVIAL`). Estado: `QA_REJECTED` (PR 3).

### Versión 15

PR 3: QA ronda 1 `QA_REJECTED`. Correcciones de DEF-001 a DEF-006 según las decisiones del usuario ("1. Si / 2. Corrigelo / 3. si te autorizo / 4. si es"). R-1 sin efecto. Estado: `NEEDS_IMPLEMENTATION_APPROVAL` (PR 3).

### Versión 17

QA ronda 2 del PR 3 (decisión del usuario: "si"): DEF-001 a DEF-006 corregidos, CA-16 pasa, 184 y 58 comprobaciones de los dos smoke sin fallos, y los defectos reintroducidos en una copia hacen fallar las pruebas nuevas. Estado: `QA_APPROVED` (PR 3), condicionado al CI.

### Versión 18

`.claude/agents/senior-fullstack.md` y `.claude/agents/senior-qa.md` incluyen dos reglas nuevas pedidas por el usuario ("si, déjalo como regla"): la revisión previa a QA y la regresión selectiva. Van en el commit de documentación del PR 3.

### Versión 19

PR 3 mergeado por el usuario en `epic/arquitectura` (#126, merge `16acc18`, head `f0682cf`), con el CI en verde y CA-15 cumplido. El ticket sigue en `in-progress/` hasta las comprobaciones de producción.
