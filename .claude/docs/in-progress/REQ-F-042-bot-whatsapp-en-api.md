# REQ-F-042 — Mover el bot de WhatsApp de `landing-pages` a `api`

## Estado

IN_PROGRESS. PR 1 de 3 abierto hacia `epic/arquitectura` (#121, CI en verde; pendiente de merge por el usuario). Faltan los PR 2 y 3.

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
