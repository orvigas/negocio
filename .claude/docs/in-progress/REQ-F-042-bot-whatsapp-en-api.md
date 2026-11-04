# REQ-F-042 — Mover el bot de WhatsApp de `landing-pages` a `api`

## Estado

QA_APPROVED (PR 2 de 3, QA ronda 2, condicionado al CI verde en el PR). PR 1 mergeado en `epic/arquitectura` (#121). PR 2 en `feature/REQ-F-042-bot-whatsapp-en-api-2-bot`, sin commit. Falta el PR 3.

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
