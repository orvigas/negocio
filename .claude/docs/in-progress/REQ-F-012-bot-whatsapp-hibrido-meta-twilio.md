# REQ-F-012 — Bot de WhatsApp híbrido: Meta (producción) y Twilio (desarrollo), detrás de una interfaz ChatBot

## Estado

QA_APPROVED

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-10-08). Citas textuales:

- solicitud original: "Quiero hacer el bot the whatsapp hibrido, que pueda trabajar con meta y con twilio, meta para producción, twilio para desarrollo, actualiza el .env.example y el .env para que desde una variable de entorno se elija el proveedor y que ambos porveedores usen las mismas variables de entorno para los datos de la cuenta si es posible";
- respuesta a las preguntas del borrador v1: "Apruebo tus sugerencias y tambien quiero que se cree una interfaz ChatBot y de ahi deriven WhatsAppBot y TwilioBot que permitan intercambiar implementaciones";
- aprobación del borrador v2: "apruebo REQ-F-012 v2".

"Apruebo tus sugerencias" aprueba la opción recomendada de cada pregunta del v1 (1 A, 2 A, 3 A, 4 A/A, 5 C, 6 A, 7 A, 8 según la recomendación, 9 A, 10 A, 11: P-1 a P-5). PR-1 se aprobó tal como la propone el v2, porque el usuario no la modificó.

Origen: amplía REQ-F-009 (`done/`), que conectaba el bot solo con la WhatsApp Cloud API de Meta.

## Objetivo

El bot de REQ-F-009 podrá trabajar con uno de dos proveedores, elegido con `WHATSAPP_BOT_PROVIDER`:

- **Meta (WhatsApp Cloud API)** en producción;
- **Twilio (API de mensajes de WhatsApp, incluido el sandbox)** en desarrollo.

Cada proveedor se implementa detrás de una interfaz común, **`ChatBot`**, con dos implementaciones intercambiables: **`WhatsAppBot`** (Meta) y **`TwilioBot`** (Twilio). La conversación, las reglas de negocio y las landings no cambian, y la conversación no se duplica.

## Decisiones confirmadas por el usuario

- **D-1 (pregunta 1, opción A).** `WHATSAPP_BOT_PHONE_NUMBER_ID` pasa a llamarse `WHATSAPP_BOT_ACCOUNT_ID`, sin compatibilidad hacia atrás. Hasta donde se sabe, el bot no está desplegado: CA-26 de REQ-F-009 sigue pendiente.
- **D-2 (pregunta 2, opción A).** `WHATSAPP_BOT_PROVIDER` **no habilita** el bot. El bot se habilita solo si hay al menos una variable de datos de cuenta del bot.
- **D-3 (pregunta 3, opción A).** Se comparten unas variables y otras son específicas de cada proveedor, según la tabla de RF-2.
- **D-4 (pregunta 4, opción A).** Con el bot habilitado, `WHATSAPP_BOT_PROVIDER` es **obligatoria**. No hay valor por defecto.
- **D-5 (pregunta 4, opción A, y PR-1).** Con `NODE_ENV=production` y `WHATSAPP_BOT_PROVIDER=twilio`, la app **no arranca, esté o no habilitado el bot**.
- **D-6 (pregunta 5, opción C).** Aviso al personal con Twilio:
  - si `WHATSAPP_BOT_STAFF_TEMPLATE` está definida, se envía como Content Template (`ContentSid` `HX…`);
  - si no, como texto libre.
  - Con Meta, la variable sigue siendo obligatoria y el aviso va siempre con plantilla (DT-6 de REQ-F-009).
- **D-7 (pregunta 6, opción A).** `WHATSAPP_BOT_WEBHOOK_URL` es la URL pública completa del webhook, tal como está configurada en Twilio. Es obligatoria con Twilio y no se usa con Meta.
- **D-8 (pregunta 7, opción A).** El número emisor con Twilio es `WHATSAPP_MOLOTES`, que con el bot ya debe ser el número del bot (D-6 de REQ-F-009, igual a `WHATSAPP_BIRRIA`).
- **D-9 (pregunta 8).**
  - El `.env` local lleva el bloque de Twilio con `WHATSAPP_BOT_PROVIDER=twilio` y las credenciales vacías. Con D-2, el bot sigue deshabilitado y `npm run dev` sigue arrancando.
  - `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` se cambiarán al número del sandbox cuando el usuario active el bot, no en este ticket. El `.env` lo indica en un comentario.
  - La cuenta de Twilio es un prerrequisito del usuario que **solo bloquea CA-16**.
- **D-10 (pregunta 9, opción A).** Los dos proveedores usan la misma ruta, `/webhooks/whatsapp`.
- **D-11 (pregunta 10, opción A).** Con Twilio, cada envío lleva un `StatusCallback` hacia la URL del webhook. Un `failed` o `undelivered` de un aviso al personal se registra como `bot_staff_delivery_failed`, como en PT-3 de REQ-F-009 con Meta.
- **D-12 (P-1).** El valor de `WHATSAPP_BOT_PROVIDER` no distingue mayúsculas: `meta` o `twilio`.
- **D-13 (P-2).** Al arrancar con el bot habilitado se registra `bot_provider_selected { provider }`, sin ningún otro valor.
- **D-14 (P-3).** Con Twilio, la antigüedad de un mensaje (más de 2 h, PT-4 de REQ-F-009) y su orden se calculan con la hora de recepción, porque Twilio no envía `timestamp`.
- **D-15 (P-4).** Las variables que solo usa el otro proveedor se ignoran sin error.
- **D-16 (P-5).** `npm run bot:chat` admite `--proveedor twilio`. Por defecto sigue simulando Meta. Nunca sale a internet.
- **D-17 (requisito del usuario).** Existe una interfaz **`ChatBot`** con dos implementaciones, **`WhatsAppBot`** (Meta Cloud API) y **`TwilioBot`** (Twilio). Se intercambian solo con `WHATSAPP_BOT_PROVIDER`.

## Para la revisión técnica: conflicto de nombres

Hoy, `WhatsAppBot` (`restaurante/src/services/whatsapp-bot/bot.ts`) es la interfaz del **orquestador de la conversación**. Incluye `receive`, `drain`, la deduplicación, las colas por cliente, el límite por número y el aviso al personal, y no depende del proveedor. El cliente de Meta es `CloudApiClient`, en `cloud-api.ts`.

El usuario pide que `WhatsAppBot` sea la implementación de **Meta** de `ChatBot`. Por eso, el orquestador actual tendrá que cambiar de nombre o de papel.

**Este requisito fija solo esto:**

- los nombres `ChatBot`, `WhatsAppBot` (Meta) y `TwilioBot` (Twilio);
- que la conversación quede **compartida y en un solo lugar**.

**Lo decide `senior-fullstack` en la revisión técnica:**

- el reparto exacto de responsabilidades de `ChatBot`: recepción, firma, interpretación de la entrega, envío de texto y plantilla, partición por longitud, `StatusCallback` y la respuesta del webhook (TwiML vacío en Twilio, reto `GET` en Meta);
- qué pasa con el orquestador actual y con `CloudApiClient`;
- el nombre nuevo del orquestador.

## Alcance

- Interfaz `ChatBot`, `WhatsAppBot` (Meta) y `TwilioBot`, con un único punto de selección.
- Configuración (RF-2).
- Webhook (RF-3) y envío (RF-4) de Twilio.
- Reglas que dependen del proveedor.
- `StatusCallback`.
- `.env.example`, `.env` local y README.
- Doble de Twilio, batería de contrato y `bot:chat --proveedor twilio`.

## Fuera de alcance

- Otros proveedores (360dialog, Vonage…).
- Dos proveedores activos a la vez.
- Mensajes interactivos.
- Cambios en la conversación o en las landings.
- Compatibilidad con `WHATSAPP_BOT_PHONE_NUMBER_ID`.
- Messaging Services de Twilio.
- Cambiar ahora `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` en `.env`.
- CA-26 de REQ-F-009 (punta a punta con Meta).

## Diferencias entre proveedores (referencia)

Se tomaron de la documentación pública de Twilio y de REQ-F-009. `senior-fullstack` debe confirmarlas con la documentación vigente en la revisión técnica.

| Tema | Meta (Cloud API) | Twilio |
| --- | --- | --- |
| Verificación del webhook | `GET` con `hub.verify_token` y `hub.challenge` | No existe. Basta con configurar la URL en la consola o en el sandbox |
| Firma | `X-Hub-Signature-256`: HMAC-SHA256 del cuerpo crudo con el App Secret | `X-Twilio-Signature`: HMAC-SHA1 en Base64, calculado con el Auth Token sobre la URL pública exacta más los parámetros del formulario ordenados |
| Formato de entrada | JSON con `entry[].changes[].value.messages[]` y `statuses[]` | Formulario `x-www-form-urlencoded`, un mensaje por petición: `MessageSid`, `From=whatsapp:+…`, `WaId`, `Body`, `NumMedia`… |
| Marca de tiempo del mensaje | `timestamp` | No viene en la entrada (D-14) |
| Envío | `POST graph.facebook.com/<ver>/<ID del número>/messages`, Bearer token, JSON | `POST api.twilio.com/2010-04-01/Accounts/<AccountSid>/Messages.json`, Basic Auth, formulario, `From` y `To` con el prefijo `whatsapp:+` |
| Longitud del texto | 4096 | 1600 |
| Aviso al personal | Plantilla con nombre, idioma y parámetros con nombre | `ContentSid` más `ContentVariables`, o texto libre (D-6). El sandbox no admite plantillas propias, y el texto libre exige la ventana de 24 h |
| Estados | `statuses[]` en el mismo webhook | `StatusCallback` por envío (D-11) |
| Respuesta del webhook | 200 | 200 con TwiML vacío |

## Requisitos

### RF-1 Interfaz ChatBot e intercambiabilidad (D-17)

1. **`ChatBot`** define lo que la app y el webhook necesitan de un proveedor. La lista exacta de operaciones la fija la revisión técnica.
2. **`WhatsAppBot`** implementa `ChatBot` con la Cloud API de Meta. **`TwilioBot`** implementa `ChatBot` con Twilio.
3. La implementación se elige en **un solo punto**, según `WHATSAPP_BOT_PROVIDER`.
4. La app (`app.ts`), el router y el controlador del webhook dependen solo de `ChatBot`, nunca de una implementación concreta.
5. **La conversación no se duplica.** Hay una sola implementación compartida, independiente del proveedor, de:
   - la máquina de estados;
   - el catálogo;
   - el horario y D-16 de REQ-F-009;
   - el carrito;
   - los mensajes;
   - la deduplicación;
   - las colas;
   - el límite por número;
   - las reglas de privacidad y de logs.

   Ninguna parte de la conversación importa código de un proveedor concreto.
6. Cambiar de proveedor solo requiere cambiar variables de entorno y reiniciar la app.

### RF-2 Selección y configuración (D-1 a D-5, D-7, D-8, D-12, D-15)

| Variable | Meta (`WhatsAppBot`) | Twilio (`TwilioBot`) |
| --- | --- | --- |
| `WHATSAPP_BOT_PROVIDER` | `meta` | `twilio`. Obligatoria si el bot está habilitado; no lo habilita por sí sola |
| `WHATSAPP_BOT_ACCOUNT_ID` *(antes `_PHONE_NUMBER_ID`)* | ID del número en la Cloud API (dígitos) | Account SID (`AC` más 32 hex) |
| `WHATSAPP_BOT_ACCESS_TOKEN` | Token permanente (secreto) | Auth Token: autentica los envíos y firma el webhook (secreto) |
| `WHATSAPP_BOT_STAFF_MOLOTES` / `_BIRRIA` | Dígitos, formato internacional | Igual; se envían como `whatsapp:+<dígitos>` |
| `WHATSAPP_BOT_STAFF_TEMPLATE` | Obligatoria: nombre de la plantilla | Opcional: `ContentSid` `HX…`. Sin ella, el aviso va como texto libre |
| `WHATSAPP_BOT_APP_SECRET` | Obligatoria (firma) | No aplica |
| `WHATSAPP_BOT_VERIFY_TOKEN` | Obligatoria | No aplica |
| `WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE`, `WHATSAPP_GRAPH_API_VERSION` | Opcionales | No aplican |
| `WHATSAPP_BOT_WEBHOOK_URL` | No aplica | Obligatoria: URL https completa del webhook |
| `WHATSAPP_MOLOTES` | Número del bot (D-6 de REQ-F-009) | Igual, y además es el número emisor (`From`) |

Reglas de validación:

1. Con el bot habilitado, `WHATSAPP_BOT_PROVIDER` es obligatoria y solo admite `meta` o `twilio`, sin distinguir mayúsculas.
2. Cada variable compartida se valida con el formato de su proveedor. Si los datos son de otro proveedor, el arranque falla.
3. Si falta una obligatoria del proveedor activo, el arranque falla. Las del otro proveedor se ignoran.
4. Con `NODE_ENV=production` y `twilio`, el arranque falla, esté o no habilitado el bot (D-5).
5. Los mensajes de error nunca muestran valores, como en REQ-F-001 DT-7.

### RF-3 Webhook (D-10, D-11)

1. **Meta:** comportamiento idéntico a REQ-F-009 RF-1. No hay regresiones.
2. **Twilio:**
   - acepta `POST` en formulario;
   - valida `X-Twilio-Signature` con el Auth Token y `WHATSAPP_BOT_WEBHOOK_URL`; responde 401 si falta la firma y 403 si no coincide; en los dos casos no procesa y registra `bot_webhook_signature_invalid`;
   - responde 200 enseguida y procesa en segundo plano;
   - deduplica por `MessageSid`;
   - ignora las entregas de otra cuenta o de otro número;
   - trata como "no es texto" (D-15 de REQ-F-009) un mensaje con adjuntos o sin `Body`;
   - recibe en la misma ruta los `StatusCallback`: un `failed` o `undelivered` de un aviso al personal se registra como `bot_staff_delivery_failed`, con el negocio y el código de error, sin teléfonos.
3. Con Twilio, el `GET` de verificación de Meta no aplica. Responde 404 o 405, según decida `senior-fullstack`.
4. Con el bot deshabilitado, el webhook responde 503 con cualquier proveedor.

### RF-4 Envío

1. Se mantienen las reglas de REQ-F-009:
   - un solo reintento, solo cuando es seguro que el mensaje no se aceptó;
   - nunca un aviso duplicado al personal;
   - un timeout por petición;
   - las credenciales nunca van en una URL ni en los logs;
   - los errores se registran solo con el estado HTTP y el código numérico.
2. Los textos largos se parten según el límite del proveedor: 4096 caracteres en Meta y 1600 en Twilio. Nunca se corta un producto.
3. El aviso al personal se envía según D-6. El texto libre tiene el mismo contenido que exige REQ-F-009 CA-14.

### RF-5 Reglas que dependen del proveedor

- D-14: con Twilio, la antigüedad y el orden de los mensajes se calculan con la hora de recepción.
- D-11: `StatusCallback`.

### RF-6 Sin cambios funcionales

Siguen igual:

- la conversación, el horario, D-16 de REQ-F-009 y la privacidad;
- los eventos de log, sin datos personales;
- las landings y sus snapshots.

### RF-7 Configuración y documentación (D-9)

- **`.env.example`:**
  - sección del bot reescrita con `WHATSAPP_BOT_PROVIDER`;
  - qué variable usa cada proveedor y cuáles son secretas;
  - Meta para producción y Twilio para desarrollo;
  - la equivalencia `WHATSAPP_BOT_PHONE_NUMBER_ID` → `WHATSAPP_BOT_ACCOUNT_ID`.
- **`.env` local:** bloque de Twilio con `WHATSAPP_BOT_PROVIDER=twilio`, credenciales vacías y una nota sobre cambiar `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` al número del sandbox al activarlo. Sin secretos. `npm run dev` sigue arrancando.
- **README:**
  - la interfaz `ChatBot` y sus dos implementaciones;
  - cómo elegir el proveedor y las variables de cada uno;
  - los prerrequisitos de Twilio: cuenta, Account SID y Auth Token, sandbox, "join <palabra>" desde el teléfono de prueba y desde los del personal, y la caducidad de esa unión;
  - el túnel HTTPS y las URL "When a message comes in" y del status callback;
  - las limitaciones del sandbox (texto libre con la ventana de 24 h, sin plantillas propias);
  - la guía de Meta actual con los nombres nuevos;
  - `bot:chat --proveedor twilio`.

### RF-8 Pruebas

1. Ninguna prueba llama a Meta ni a Twilio.
2. Se crea un doble de la API de Twilio, con fixtures de entregas reales en formulario y vectores de firma de la documentación de Twilio.
3. Hay una **batería de contrato de `ChatBot`** que se ejecuta contra las dos implementaciones.
4. Las pruebas actuales de REQ-F-009 siguen pasando con Meta.
5. Las pruebas de configuración cubren todo RF-2.

## Prerrequisitos para la QA de punta a punta (los provee el usuario)

Solo bloquean CA-16:

1. Cuenta de Twilio con el sandbox de WhatsApp activado.
2. Account SID y Auth Token.
3. Teléfonos de prueba y del personal unidos al sandbox.
4. Un túnel HTTPS hacia la app local, configurado en Twilio y en `WHATSAPP_BOT_WEBHOOK_URL`.

## Historias de usuario

- **HU-1.** **Como** desarrollador **quiero** probar el bot de punta a punta con el sandbox de Twilio **para** no depender de la cuenta de Meta.
- **HU-2.** **Como** dueño **quiero** que producción use Meta cambiando solo la configuración.
- **HU-3.** **Como** responsable del despliegue **quiero** que los datos de cuenta tengan los mismos nombres en los dos proveedores.
- **HU-4.** **Como** desarrollador **quiero** que los proveedores sean implementaciones intercambiables de una misma interfaz `ChatBot` **para** cambiar o añadir un proveedor sin tocar la conversación ni la app.

## Reglas de negocio

- **RN-1 a RN-6** de REQ-F-009, sin cambios.
- **RN-7.** Hay un solo proveedor activo por arranque.
- **RN-8.** Producción nunca arranca con Twilio.
- **RN-9.** La conversación es la misma con cualquier proveedor.

## Criterios de aceptación

### Proveedores y webhook

- **CA-1.** Given `WHATSAPP_BOT_PROVIDER=meta` y la configuración de Meta con los nombres nuevos, When se ejecutan las pruebas de REQ-F-009, Then todas pasan sin cambios de comportamiento.
- **CA-2.** Given `twilio` y la configuración completa, When llega un texto con una firma válida, Then el webhook responde 200 y el doble de Twilio registra la respuesta a `whatsapp:+<cliente>`, enviada desde `whatsapp:+<WHATSAPP_MOLOTES>`.
- **CA-3.** Given `twilio`, When llega una entrega sin `X-Twilio-Signature`, Then responde 401. Si la firma no coincide, por ejemplo porque se calculó con otra URL, Then responde 403. En los dos casos no se responde al cliente y queda `bot_webhook_signature_invalid` en el log.
- **CA-4.** Given `twilio`, When llega dos veces el mismo `MessageSid`, Then el cliente recibe una sola respuesta.
- **CA-5.** Given `twilio` y un pedido confirmado:
  - con `WHATSAPP_BOT_STAFF_TEMPLATE` definida, el doble registra **exactamente un** envío con ese `ContentSid` y las variables del pedido;
  - sin ella, registra exactamente un texto libre con el contenido de REQ-F-009 CA-14.
- **CA-6.** Given `twilio` y un menú de más de 1600 caracteres, When se muestra, Then llega en varios mensajes de 1600 caracteres o menos, sin cortar un producto.
- **CA-7.** Given `twilio` y un mensaje con adjunto o sin `Body`, When se procesa, Then el bot responde como en D-15 de REQ-F-009.
- **CA-7b.** Given `twilio` y un `StatusCallback` `failed` o `undelivered` de un aviso al personal, When llega, Then se registra `bot_staff_delivery_failed` con el negocio y el código, sin teléfonos.

### Configuración

- **CA-8.** Given el bot habilitado y `WHATSAPP_BOT_PROVIDER` ausente o con un valor no admitido (p. ej. `whatsapp`), When arranca la app, Then termina con código 1 y lista el problema sin valores. `META` y `Twilio` sí se aceptan.
- **CA-9.** Given `twilio` y un `WHATSAPP_BOT_ACCOUNT_ID` de solo dígitos (o `meta` y un `AC…`), When arranca la app, Then falla sin mostrar valores.
- **CA-10.** Given `twilio` sin `WHATSAPP_BOT_WEBHOOK_URL`, When arranca la app, Then falla y nombra la variable. Given `twilio` sin `APP_SECRET`, `VERIFY_TOKEN` ni `STAFF_TEMPLATE`, Then arranca. Given `meta` sin `STAFF_TEMPLATE`, Then falla.
- **CA-11.** Given `NODE_ENV=production` y `WHATSAPP_BOT_PROVIDER=twilio`, con el bot habilitado o no, When arranca la app, Then termina con código 1.
- **CA-12.** Given `WHATSAPP_BOT_PROVIDER=twilio` sin datos de cuenta, fuera de producción, When arranca la app, Then arranca, el webhook responde 503 y las landings responden 200.
- **CA-12b.** Given `WHATSAPP_BOT_PHONE_NUMBER_ID` definida (el nombre anterior) y el resto de Meta, When arranca la app, Then falla e indica que falta `WHATSAPP_BOT_ACCOUNT_ID`.
- **CA-13.** Given cualquier flujo con Twilio, When se revisa el log, Then no contiene el Auth Token, el Account SID completo, textos, nombres, direcciones ni números completos. Al arrancar aparece `bot_provider_selected` con solo el proveedor.

### Intercambiabilidad (ChatBot)

- **CA-17.** `app.ts`, el router y el controlador del webhook no importan `WhatsAppBot` ni `TwilioBot`: solo usan el tipo `ChatBot`. Las implementaciones se importan en **un único** módulo de selección. Se verifica revisando los imports o con una prueba automática.
- **CA-18.** `WhatsAppBot` y `TwilioBot` implementan `ChatBot`, y `npm run typecheck` lo comprueba.
- **CA-19.** La misma batería de contrato, que recorre un pedido completo, la cancelación, "persona", un mensaje que no es texto y una entrega duplicada, pasa con las dos implementaciones. Solo cambian el doble del proveedor y las variables de entorno.
- **CA-20.** Con el mismo código, cambiar `WHATSAPP_BOT_PROVIDER` de `meta` a `twilio`, con sus variables, y reiniciar la app cambia el proveedor usado. Ningún archivo del código cambia.
- **CA-21.** Ningún módulo de la conversación compartida importa código de Meta ni de Twilio, y la lógica de la conversación existe una sola vez.

### Calidad, documentación y punta a punta

- **CA-14.** `.env.example` y el README cumplen RF-7. Con el `.env` local actualizado, `npm run dev` arranca con el bot deshabilitado.
- **CA-15.** `typecheck`, `lint`, `npm test`, `docker compose run --rm test` y el CI pasan sin llamadas reales a Meta ni a Twilio.
- **CA-15b.** `npm run bot:chat -- --proveedor twilio` completa un pedido contra el doble de Twilio. Sin la opción, sigue simulando Meta.
- **CA-16 (punta a punta; depende de los prerrequisitos de Twilio).** Con el sandbox y un túnel, un pedido completo de cada negocio llega al teléfono del personal unido al sandbox.

## Casos límite

- Cambiar de proveedor sin cambiar los datos de cuenta (CA-9).
- La URL del túnel distinta de `WHATSAPP_BOT_WEBHOOK_URL`: responde 403 (CA-3).
- Detrás de nginx o de un túnel, la firma usa la URL configurada, no la que reconstruye la petición.
- El personal sin unirse al sandbox, o con la unión caducada: el envío falla, el cliente recibe D-18 de REQ-F-009 y el log registra el error.
- Texto libre al personal con su ventana de 24 h vencida: fallo tardío por `StatusCallback`.
- Mensajes de Twilio muy seguidos o recibidos con retraso.
- Números mexicanos `521…` frente a `52…`: el bot responde al mismo identificador que recibió.
- Emojis y acentos en el formulario de Twilio.
- Proveedor definido con el bot deshabilitado (CA-12).
- Producción con `twilio` (CA-11).

## Dependencias

- REQ-F-009 (`done/`). Este ticket amplía su D-2 y adapta, solo para Twilio, DT-6 (aviso al personal), PT-4 (antigüedad) y el límite de longitud. REQ-F-009 no se modifica.
- REQ-F-004, REQ-F-005, REQ-F-006 y REQ-F-011: TypeScript, lint, CI y `listenLocal` en las pruebas HTTP.
- Los prerrequisitos de Twilio, que provee el usuario. Solo bloquean CA-16.

## Riesgos

- Dos integraciones duplican la superficie de pruebas. Lo mitiga la batería de contrato (CA-19).
- El sandbox no reproduce las plantillas ni la facturación de Meta. Twilio no sustituye a CA-26 de REQ-F-009.
- Renombrar el orquestador actual toca muchos archivos y pruebas, con riesgo de regresión. Lo mitigan CA-1 y los snapshots.
- La firma de Twilio depende de la URL exacta: si está mal configurada, el bot no responde (403).
- Las uniones al sandbox caducan.
- Las credenciales de Twilio viven solo en el `.env` local, nunca en tickets ni en el chat.

## Action Plan

### Objetivo

El mismo bot funciona con Meta o con Twilio, como implementaciones intercambiables de `ChatBot`, elegidas por configuración y sin duplicar la conversación.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Revisión técnica: el contrato de `ChatBot`, el reparto entre `ChatBot` y la conversación compartida, y el renombrado del orquestador actual y de `CloudApiClient`.
2. Refactorizar Meta detrás de `ChatBot` como `WhatsAppBot`, sin cambiar su comportamiento (CA-1, CA-17, CA-18, CA-21).
3. Configuración por proveedor y regla de producción (CA-8 a CA-12b).
4. `TwilioBot`: firma, formulario, deduplicación, envío, partición, aviso al personal según D-6 y `StatusCallback` (CA-2 a CA-7b).
5. Antigüedad y orden por hora de recepción con Twilio (D-14).
6. Doble de Twilio, fixtures, batería de contrato (CA-19) y `bot:chat --proveedor` (CA-15b).
7. `.env.example`, `.env` y README (CA-14).
8. CA-16, cuando el usuario tenga la cuenta.

### Reglas de negocio

RN-1 a RN-9.

### UX/UI

Sin cambios. La conversación es idéntica con los dos proveedores, salvo la partición de mensajes largos. No aplica `_stich_source_/`.

### Integraciones

WhatsApp Cloud API de Meta (existente) y API de mensajes de WhatsApp de Twilio (nueva).

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-21, más CA-7b, CA-12b y CA-15b.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. Revisión técnica del contrato de `ChatBot`.
2. Refactorizar Meta como `WhatsAppBot`, con REQ-F-009 en verde.
3. Configuración.
4. `TwilioBot`.
5. Reglas dependientes del proveedor y `StatusCallback`.
6. Batería de contrato y `bot:chat`.
7. Documentación y `.env`.
8. Punta a punta con el sandbox.

### Resultado esperado

En desarrollo se prueba el bot real con el sandbox de Twilio. En producción funciona con Meta. Cambiar de proveedor es cuestión de configuración y no toca la conversación.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Proveedores intercambiables | RF-1, D-17, RN-9 | HU-4 | CA-17 a CA-21 |
| Selección por configuración | RF-2, D-1 a D-5, D-12, D-15 | HU-2, HU-3 | CA-8 a CA-12b |
| Twilio en desarrollo | RF-3, RF-4, RF-5, D-6 a D-11, D-14 | HU-1 | CA-2 a CA-7b, CA-15b, CA-16 |
| Meta sin regresiones y producción solo con Meta | RF-3.1, RF-6, RN-8 | HU-2 | CA-1, CA-11 |
| Seguridad y privacidad | RF-3, RF-4.1 | — | CA-3, CA-13 |
| Documentación y calidad | RF-7, RF-8 | HU-3 | CA-14, CA-15 |

No hay diseño en `_stich_source_/` para el bot, que es solo conversacional.

## Revisión técnica

Revisión de `senior-fullstack` (2026-10-08). No hay bloqueos que exijan una decisión del usuario: el ticket es coherente con la arquitectura y las reglas. Las decisiones que el ticket delega quedan resueltas en el Technical Action Plan (DT-1 a DT-12). Observaciones:

- **Sin acceso a internet en esta revisión.** Los detalles de Twilio se confirmaron con lo que se sabe de su documentación pública, y el vector de firma de la documentación ("Webhook security": URL `https://mycompany.com/myapp.php?foo=1&bar=2`, Auth Token `12345`, parámetros `CallSid`, `Caller`, `Digits`, `From`, `To`, firma `0/KCTR6DLpKmkAf8muzZqo1nDgQ=`) se recalculó con `node:crypto` y coincide. Lo que no se pudo recalcular (la numeración de las variables de Content Templates) se resuelve de forma segura en DT-8.
- **Límite de 1600 frente a CA-5 ("exactamente un texto libre").** Con 15 líneas (D-12 de REQ-F-009) y nombres de hasta 80 caracteres, el aviso en texto libre puede superar 1600 caracteres. DT-9 lo resuelve: un pedido normal genera exactamente un mensaje (CA-5); solo si el texto supera el límite se envía en partes, sin perder datos. No cambia nada con Meta.
- **Partición.** Hoy solo se parte el menú (`menuMessages`, 4096). Con 1600, el carrito o el resumen de un pedido grande también pueden superar el límite: la partición pasa al envío (DT-7), con el límite de cada proveedor.
- **Documentación del agente.** `.claude/agents/senior-fullstack.md` describe el bot solo con Meta (`cloud-api-double.ts`, `no-meta.ts`). Actualizar ese párrafo es configuración del proyecto: se propone en el plan y solo se hará si el usuario lo aprueba explícitamente.

## Technical Action Plan

### Objetivo técnico

Separar el bot en dos capas: (1) la **conversación compartida**, un orquestador independiente del proveedor, y (2) el **transporte**, la interfaz `ChatBot` con dos implementaciones, `WhatsAppBot` (Meta) y `TwilioBot` (Twilio). Las implementaciones se eligen en un único módulo según `WHATSAPP_BOT_PROVIDER`. Meta no cambia de comportamiento (CA-1). Sin dependencias nuevas.

### Decisiones técnicas

- **DT-1. `ChatBot` es el adaptador del proveedor (transporte).** Cubre:
  - la verificación `GET`;
  - la firma, el formato y la normalización de la entrega;
  - la respuesta del webhook;
  - el envío de texto y del aviso al personal;
  - el límite de longitud.

  No contiene conversación, deduplicación, colas ni límites.

  ```ts
  export type BotProvider = 'meta' | 'twilio';
  export interface ChatBot {
    readonly provider: BotProvider;
    readonly maxTextLength: number;      // 4096 Meta, 1600 Twilio
    readonly maxWebhookBytes: number;    // 3 MB Meta, 64 KiB Twilio
    /** GET del webhook: Meta -> reto o rechazo; Twilio -> 'unsupported' (405). */
    verifySubscription(query: WebhookQuery): VerifyOutcome;
    /** POST: firma -> formato -> entrega normalizada y cuerpo de la respuesta (OK / TwiML vacío). */
    handleDelivery(rawBody: Buffer, header: (name: string) => string | undefined): DeliveryOutcome;
    sendText(to: string, body: string): Promise<SendResult>;
    sendStaffNotice(to: string, notice: StaffNotice): Promise<SendResult>;
  }
  ```

  Tipos compartidos, en `chat-bot.ts`:
  - `InboundDelivery { messages, statuses, ignored }`.
  - `InboundMessage { id, from, timestamp?, text? }`, con `timestamp` ausente en Twilio (D-14).
  - `InboundStatus { id, failed: boolean, errorCode? }`.
  - `DeliveryOutcome`: `accepted` (con la entrega y la respuesta), `signature_invalid` (con el motivo `missing`, `malformed` o `mismatch`) o `bad_request`.
  - `SendResult`: devuelve `messageIds: string[]` en lugar de `messageId`.
  - `StaffNotice { params, text }`: parámetros con nombre y texto libre, generados por la conversación.

  El controlador traduce estos resultados a HTTP: 401, 403, 400, 405 o 200.
- **DT-2. Orquestador.** `WhatsAppBot` (`bot.ts`) pasa a ser `BotOrchestrator` (`orchestrator.ts`, con `git mv`; `createBotOrchestrator`).
  - Conserva `receive`, `drain`, la deduplicación, las colas, el límite por número, el aviso al personal único, D-18, `bot_staff_delivery_failed` y los logs.
  - Recibe un `ChatBot` y `staff`. Ya no recibe la plantilla de Meta ni un `CloudApiClient`.
  - Expone `readonly chatBot: ChatBot` para el controlador.
  - Ni él ni ningún módulo de la conversación (`conversation.ts`, `messages.ts`, `catalog.ts`, `schedule.ts`, `store.ts`, `text.ts`, `phone.ts`) importa nada de `providers/` (CA-21).
- **DT-3. `CloudApiClient` y el parser de Meta.** Pasan a ser detalles internos de `WhatsAppBot`:
  - `cloud-api.ts` se mueve a `providers/meta/cloud-api.ts`;
  - `webhook.ts` se mueve a `providers/meta/webhook.ts`.

  Su lógica no cambia, salvo que `phoneNumberId` pasa a `accountId`. El timeout, la clasificación de errores de red y el reintento único se extraen a `providers/http-send.ts`, compartido por las dos implementaciones.
- **DT-4. Estructura.** Todo dentro de `src/services/whatsapp-bot/`:

  ```text
  chat-bot.ts              interfaz ChatBot y tipos de entrega/envío
  orchestrator.ts          BotOrchestrator (antes bot.ts)
  conversation.ts, messages.ts, catalog.ts, schedule.ts, store.ts, text.ts, phone.ts   (sin cambios de lógica)
  providers/select.ts      createChatBot(config, { fetch, logger }): ÚNICO módulo que importa las dos clases; registra bot_provider_selected { provider }
  providers/http-send.ts   envío con timeout, clasificación de errores y un reintento
  providers/meta/whatsapp-bot.ts     class WhatsAppBot implements ChatBot
  providers/meta/cloud-api.ts, providers/meta/webhook.ts
  providers/twilio/twilio-bot.ts     class TwilioBot implements ChatBot
  providers/twilio/twilio-api.ts     cliente REST (fetch nativo)
  providers/twilio/webhook.ts        firma X-Twilio-Signature y parser del formulario
  ```

  Las dos implementaciones son clases con `implements ChatBot`, para que `tsc` lo compruebe (CA-18). Respetan `erasableSyntaxOnly`: sin parameter properties.
- **DT-5. GET con Twilio: 405** con `Allow: POST` y el error JSON `METHOD_NOT_ALLOWED`. El recurso existe, pero el proveedor activo no admite ese método. Con el bot deshabilitado sigue respondiendo 503 con cualquier proveedor.
- **DT-6. Webhook de Twilio.** Orden en el `POST`:
  1. Bot deshabilitado: 503.
  2. Cuerpo crudo de más de 64 KiB: 413.
  3. Sin `X-Twilio-Signature`: 401. Con un formato que no es Base64 de 20 bytes: 401.
  4. Cuerpo que no es UTF-8 válido: 400 (`INVALID_FORM`).
  5. Firma distinta: 403. En los casos 3 y 5 se registra `bot_webhook_signature_invalid { reason }`.
  6. Si todo es correcto: 200 con `<?xml version="1.0" encoding="UTF-8"?><Response></Response>` (`text/xml`) y procesamiento en segundo plano.

  Firma:
  - se parte de `WHATSAPP_BOT_WEBHOOK_URL`, nunca de la URL reconstruida de la petición;
  - se le concatenan los parámetros del formulario (`URLSearchParams`, ya decodificados), ordenados por nombre, como `nombre+valor` sin separadores; si un nombre se repite, sus valores van ordenados;
  - se calcula HMAC-SHA1 con el Auth Token, en Base64;
  - se compara en tiempo constante con `timingSafeEqual`.

  Formulario:
  - Un `StatusCallback` es una petición con `MessageStatus`. Solo `failed` y `undelivered` cuentan como fallo, con el `ErrorCode` numérico.
  - Cualquier otra petición es un mensaje:
    - el id es `MessageSid` (`^(SM|MM)[0-9a-f]{32}$`, sin distinguir mayúsculas);
    - el cliente son los dígitos de `From` sin `whatsapp:+`, y se le responde a ese mismo identificador (caso `521`/`52`);
    - si `NumMedia > 0`, o `Body` falta o está vacío, el mensaje es "no es texto" (D-15);
    - el texto se recorta a 1000 caracteres, como con Meta.
  - Se ignora sin error, y cuenta en `bot_webhook_ignored`, toda entrega con:
    - otro `AccountSid`;
    - un mensaje cuyo `To` no es `whatsapp:+<WHATSAPP_MOLOTES>`;
    - campos mal formados.
- **DT-7. Partición por proveedor.**
  - `BotOrchestrator.reply` parte cada texto con `chunkText(texto, chatBot.maxTextLength)`. La partición es por líneas, y cada producto es una línea, así que nunca corta un producto (CA-6).
  - `menuMessages` sigue partiendo a 4096, y con Meta no cambia nada.
  - Se envía en orden y se detiene en el primer fallo, como hoy.
- **DT-8. Aviso al personal.**
  - La conversación genera los nueve parámetros con nombre de siempre (`staffTemplateParams`) y un texto libre nuevo (`staffNoticeText`) con el mismo contenido (CA-14 de REQ-F-009). El texto sale de una plantilla nueva, `botText.staffNotice`, en `src/content/common/bot.ts`.
  - `WhatsAppBot` envía la plantilla de Meta como hoy.
  - `TwilioBot` lo envía según D-6:
    - con `WHATSAPP_BOT_STAFF_TEMPLATE` (`HX…`), usa `ContentSid` y `ContentVariables` con claves **numéricas** del `"1"` al `"9"`, en este orden fijo: código, negocio, horario, cliente, WhatsApp, entrega, líneas, total y notas. Es el formato que admiten con seguridad los Content Templates de Twilio, y el README documenta el orden;
    - sin `WHATSAPP_BOT_STAFF_TEMPLATE`, usa `Body` con el texto libre.
- **DT-9. Texto libre que supera 1600 caracteres (solo Twilio).**
  - Se envía en partes ordenadas, partidas por líneas, sin reintentos de una parte ya aceptada. Así se mantiene "nunca un aviso duplicado".
  - El aviso cuenta como enviado solo si se aceptan todas las partes. Si alguna falla, el cliente recibe D-18.
  - El id de cada parte se registra para el `StatusCallback`.
  - Un pedido normal sigue generando exactamente un mensaje (CA-5).
- **DT-10. Envío con Twilio.**
  - Petición: `POST https://api.twilio.com/2010-04-01/Accounts/<AccountSid>/Messages.json`.
    - La base es fija.
    - `Authorization: Basic base64(AccountSid:AuthToken)`; el token nunca va en la URL ni en un log.
    - El cuerpo es `application/x-www-form-urlencoded` con `From=whatsapp:+<WHATSAPP_MOLOTES>`, `To=whatsapp:+<dígitos>`, `Body` o `ContentSid` con `ContentVariables`, y `StatusCallback=<WHATSAPP_BOT_WEBHOOK_URL>`.
  - Respuesta 2xx con `sid`: se acepta.
  - Un solo reintento, solo si es seguro que el mensaje no se aceptó: HTTP 429 o 503, o un error de conexión antes de enviar. Cualquier otro 5xx, un timeout o una conexión cortada a media respuesta son ambiguos: no se reintenta. Timeout de 10 s.
  - `bot_api_error` registra solo el estado HTTP, el `code` numérico de Twilio, el tipo de fallo y si hubo reintento.
- **DT-11. Hora de los mensajes (D-14).** Si `InboundMessage.timestamp` falta, el orquestador usa la hora de recepción, en segundos, para la antigüedad y el orden. Con Meta no cambia nada.
- **DT-12. Sin dependencias nuevas.** No se usa el SDK `twilio`: la firma se hace con `node:crypto` (`createHmac('sha1')` y `timingSafeEqual`), el envío con `fetch` nativo y el formulario con `URLSearchParams`.

### Archivos o componentes afectados

- **Backend:**
  - `src/services/whatsapp-bot/`: nuevos `chat-bot.ts`, `orchestrator.ts` (por `git mv` de `bot.ts`) y `providers/**`; se mueven `cloud-api.ts` y `webhook.ts`; cambian `messages.ts` (`staffNoticeText`) y `text.ts` (sin cambio de lógica).
  - `src/controllers/whatsapp-webhook.ts`: depende solo de `ChatBot` y del receptor, sin `botConfig`.
  - `src/routes/index.ts`.
  - `src/app.ts`: las opciones `whatsappBot` y `cloudApiFetch` pasan a `bot` y `providerFetch`.
  - `src/config/env.ts`.
  - `src/server.ts`: se mantiene `whatsappBot: enabled|disabled`.
  - `src/content/common/bot.ts`: texto `staffNotice`.
- **Pruebas:**
  - `tests/helpers.ts`: `BOT_ENV` con `WHATSAPP_BOT_ACCOUNT_ID` y `WHATSAPP_BOT_PROVIDER=meta`; nuevo `TWILIO_BOT_ENV`.
  - `tests/support/whatsapp.ts`: harness con proveedor.
  - Nuevos `tests/support/twilio-api-double.ts`, `tests/support/chat-bot-drivers.ts` y `tests/fixtures/twilio/*.json`.
  - `tests/setup/no-meta.ts`: también bloquea `twilio.com`.
  - Pruebas existentes del bot y de la configuración.
  - Nuevas: `tests/unit/whatsapp-bot-twilio.test.ts`, `tests/integration/chat-bot-contract.test.ts` y `tests/unit/chat-bot-boundaries.test.ts`.
- **Scripts:** `scripts/bot-chat.ts`.
- **Documentación y configuración:**
  - `restaurante/.env.example`, `restaurante/.env` (local, sin secretos) y `restaurante/README.md`;
  - `.claude/agents/senior-fullstack.md`, solo con la aprobación del usuario.

### Backend

1. **Refactorización de Meta, sin cambio de comportamiento:**
   - `chat-bot.ts`, `providers/http-send.ts`, `WhatsAppBot` (envuelve `cloud-api` y `webhook`), `BotOrchestrator` y `providers/select.ts`;
   - el controlador usa `chatBot.verifySubscription` y `chatBot.handleDelivery`;
   - se conservan los mismos códigos HTTP, los cuerpos, los eventos de log y el orden.
2. **`TwilioBot`** según DT-6, DT-8, DT-9 y DT-10.
3. **Orquestador:**
   - partición por `maxTextLength` (DT-7);
   - `timestamp` opcional (DT-11);
   - `InboundStatus.failed`;
   - registro de todos los `messageIds` del aviso.
4. **`app.ts`:**
   - `bot ?? (config.whatsappBot ? createBotOrchestrator({ chatBot: createChatBot(config.whatsappBot, { fetch: providerFetch, logger }), ... }) : undefined)`;
   - `app.ts`, el router y el controlador nunca importan `WhatsAppBot` ni `TwilioBot` (CA-17).

### Contenido / configuración

`src/config/env.ts`:

- **Tipo de la configuración.** `WhatsAppBotConfig` pasa a ser `ChatBotConfig = MetaBotConfig | TwilioBotConfig | null`, discriminada por `provider`.
  - Campos comunes: `accountId`, `accessToken` y `staff`.
  - Meta: `appSecret`, `verifyToken`, `staffTemplate { name, language }` y `graphApiVersion`.
  - Twilio: `webhookUrl`, `staffContentSid?` y `sender` (los dígitos de `WHATSAPP_MOLOTES`).
- **Bot habilitado (D-2).** El bot se habilita si hay al menos una de estas variables: `WHATSAPP_BOT_ACCOUNT_ID`, `_ACCESS_TOKEN`, `_APP_SECRET`, `_VERIFY_TOKEN`, `_STAFF_MOLOTES`, `_STAFF_BIRRIA`, `_STAFF_TEMPLATE`, `_STAFF_TEMPLATE_LANGUAGE`, `_WEBHOOK_URL` o `WHATSAPP_GRAPH_API_VERSION`. `WHATSAPP_BOT_PROVIDER` no cuenta. Un valor vacío cuenta como no definido (`readVar`), así que el `.env` local con las credenciales vacías deja el bot deshabilitado (CA-12, CA-14).
- **`WHATSAPP_BOT_PROVIDER`:**
  - se pasa a minúsculas (D-12);
  - si está definida, se valida siempre: solo `meta` o `twilio`;
  - con el bot habilitado, es obligatoria (CA-8);
  - con `NODE_ENV=production` y `twilio`, el arranque falla, esté o no habilitado el bot (CA-11).
- **Formatos por proveedor (CA-9, CA-10).** Las variables del otro proveedor se ignoran (D-15).

  | Variable | Meta | Twilio |
  | --- | --- | --- |
  | `ACCOUNT_ID` | `^\d{5,20}$` | `^AC[0-9a-fA-F]{32}$` |
  | `ACCESS_TOKEN` | `^\S{1,4096}$` | `^[0-9a-fA-F]{32}$` |
  | `STAFF_TEMPLATE` | Obligatoria, `^[a-z0-9_]{1,512}$` | Opcional, `^HX[0-9a-fA-F]{32}$` |
  | `APP_SECRET`, `VERIFY_TOKEN` | Obligatorias | Ignoradas |
  | `WEBHOOK_URL` | Ignorada | Obligatoria: https, sin credenciales, sin query ni fragmento, con la ruta exacta `/webhooks/whatsapp` (detecta pronto una URL mal escrita, que daría 403) |
  | `WHATSAPP_MOLOTES` | Sin cambios | Obligatoria como número: es el emisor (D-8) |

  La regla de REQ-F-009 D-6 (`WHATSAPP_MOLOTES` igual a `WHATSAPP_BIRRIA`) se mantiene con los dos proveedores.
- **`WHATSAPP_BOT_PHONE_NUMBER_ID` definida** (el nombre anterior). El arranque falla siempre, con el mensaje "ya no se usa: renómbrala a `WHATSAPP_BOT_ACCOUNT_ID`". Con el resto de Meta, también se informa que falta `ACCOUNT_ID` (CA-12b). No hay compatibilidad: solo un fallo rápido y claro.
- **Mensajes de error.** Ninguno muestra valores (RF-2.5).

### Validaciones

Todo lo que llega al webhook entra como `unknown` o como texto, y se valida campo por campo:

- **Twilio:** los SID, `From`, `To`, `NumMedia` (entero de 0 a 10), `ErrorCode` (entero) y `MessageStatus` (máximo 40 caracteres).
- **Meta:** la validación actual, sin cambios.

### Manejo de errores

- **Errores HTTP del webhook:** los mismos de hoy (401, 403, 400, 413 y 503), más 405 para un `GET` con Twilio. Todos responden con el formato JSON centralizado; el 200 de Twilio responde con TwiML.
- **Fallos de envío:** nunca lanzan excepciones; devuelven `SendResult`.
- **Fallos del bot o del proveedor:** nunca cambian la respuesta del webhook.

### Testing

- **CA-1. Pruebas de REQ-F-009 con Meta.**
  - Las de `whatsapp-bot-conversation`, `-infra`, `-orchestrator`, `whatsapp-webhook` y `config` solo cambian los nombres (`ACCOUNT_ID`, `createBotOrchestrator`, las opciones de `createApp`). Ninguna aserción de comportamiento cambia.
  - Los snapshots de las landings no cambian.
- **Unitarias de Twilio** (`whatsapp-bot-twilio.test.ts`):
  - firma con el vector de la documentación de Twilio y casos de 401, 403 y URL distinta;
  - parser del formulario con fixtures de la forma documentada (texto, imagen, ubicación sin `Body`, emojis y acentos, otra cuenta u otro `To`, `StatusCallback` `delivered`, `failed` y `undelivered`);
  - envío: Basic Auth, formulario, `StatusCallback`, `ContentSid` y `ContentVariables`, reintento solo con 429, 503 o un error previo al envío, y sin reintento con timeout o 500;
  - partición a 1600 (CA-6) y DT-9;
  - D-14: un mensaje sin `timestamp` no se descarta como antiguo.
- **Integración con Twilio por HTTP** (`listenLocal`): CA-2 a CA-5, CA-7, CA-7b, el `GET` con 405 y CA-13 (el log no contiene el Auth Token, el Account SID completo, textos ni números completos, y `bot_provider_selected` lleva solo `{ provider }`).
- **Batería de contrato (CA-19):** `chat-bot-contract.test.ts`, con `describe.each([meta, twilio])` y un "driver" por proveedor, en el que solo cambian el doble, las variables y la forma firmada de la entrega. Recorre:
  - un pedido completo con aviso al personal;
  - la cancelación;
  - "persona";
  - un mensaje que no es texto;
  - una entrega duplicada.
- **Fronteras (CA-17, CA-21):** `chat-bot-boundaries.test.ts` lee los imports de `src/`:
  - solo `providers/select.ts` importa `whatsapp-bot.ts` y `twilio-bot.ts`;
  - `app.ts`, `routes/` y `controllers/` no importan nada de `providers/meta` ni de `providers/twilio`;
  - ningún archivo de la conversación importa de `providers/`.
- **CA-18:** `npm run typecheck`.
- **Configuración** (`config.test.ts`): CA-8 a CA-12b, con `META`, `Twilio`, el proveedor ausente o inválido, los datos del otro proveedor, la URL sin la ruta exacta, la producción con `twilio` con y sin bot, y el nombre anterior. CA-20 se cubre con la misma app y dos entornos en la batería de contrato.
- **Sin llamadas reales:** `tests/setup/no-meta.ts` también rechaza `*.twilio.com`.
- **CA-15b:** prueba de humo del script `bot:chat --proveedor twilio` con la entrada redirigida, si se puede ejecutar en la suite en menos de unos segundos; si no, verificación manual documentada en el Implementation Result.

### Seguridad

- **Twilio:**
  - la firma se verifica antes de procesar nada, con la URL configurada y en tiempo constante;
  - el Auth Token solo va en la cabecera `Authorization`;
  - la base de la API es fija, así que el token no puede enviarse a otro host;
  - el log nunca registra el `message` de Twilio ni la URL de la petición, que lleva el Account SID.
- **CSP y helmet:** sin cambios. El TwiML es una respuesta a Twilio, no se sirve HTML.
- **Producción:** nunca arranca con Twilio (RN-8).

### Performance

Sin impacto: una HMAC y un parseo de formulario por entrega, sin nuevas lecturas de disco ni de la base de datos.

### Riesgos técnicos

- **Refactorización amplia del orquestador.** La mitigan CA-1, la batería de contrato y el orden de implementación (Meta en verde antes de Twilio).
- **La firma de Twilio depende de la URL exacta.** La mitigan la validación estricta de `WEBHOOK_URL` y el README.
- **La numeración de `ContentVariables`** depende de cómo el usuario cree su Content Template. El README lo documenta, y el sandbox no admite plantillas propias: es para cuando haya un número de Twilio propio.
- **DT-9 (aviso en partes)** solo se activa con pedidos muy grandes y solo con Twilio.
- **CA-16** queda pendiente hasta que el usuario tenga la cuenta y el túnel.

### Orden de implementación

1. **Meta detrás de `ChatBot`:**
   - `chat-bot.ts`, `http-send.ts`, mover `cloud-api.ts` y `webhook.ts`, `WhatsAppBot`, `select.ts`, el renombrado a `BotOrchestrator`, el controlador, el router y `app.ts`;
   - la configuración, solo el renombrado a `ACCOUNT_ID` y `PROVIDER=meta`;
   - todas las pruebas actuales en verde (CA-1).
2. Configuración completa por proveedor (CA-8 a CA-12b).
3. `TwilioBot`: firma, parser, envío, `StatusCallback`, partición, D-14 y DT-9.
4. Doble de Twilio, fixtures, harness con proveedor, batería de contrato y fronteras.
5. `bot:chat --proveedor twilio`.
6. `.env.example`, `.env` local, README y, si el usuario lo aprueba, el párrafo del agente.
7. `typecheck`, `lint`, `npm test` y `docker compose run --rm test`.

### Criterios de finalización

- CA-1 a CA-15b, CA-17 a CA-21, CA-7b y CA-12b cumplidos y verificados con las pruebas indicadas.
- CA-16 queda pendiente: depende de la cuenta de Twilio del usuario.
- `npm run typecheck`, `npm run lint` y `npm test` terminan con 0.
- `docker compose run --rm test` pasa.
- Sin dependencias nuevas.
- El `git diff` solo contiene cambios del ticket.
- `npm run dev` arranca con el `.env` local actualizado y el bot deshabilitado.

## Implementation Result

### Rama

`feature/REQ-F-012-bot-whatsapp-hibrido-meta-twilio`, creada desde `main` (`89c7508`). Sin commits: el commit queda para T4.

### Cambios realizados

- **Contrato `ChatBot`** (`src/services/whatsapp-bot/chat-bot.ts`), según DT-1:
  - verificación por `GET`;
  - `handleDelivery`: firma, formato y respuesta del webhook;
  - envío de texto y del aviso al personal;
  - `maxTextLength` y `maxWebhookBytes`;
  - tipos compartidos de entrega y de envío.
- **Orquestador** (DT-2):
  - `bot.ts` pasa a ser `orchestrator.ts`, con `git mv`;
  - `WhatsAppBot` pasa a llamarse `BotOrchestrator` y `createWhatsAppBot`, `createBotOrchestrator`;
  - recibe `chatBot` y `staff`, y expone `chatBot`;
  - parte los textos según el límite del proveedor (DT-7);
  - usa la hora de recepción cuando el proveedor no envía la hora del mensaje (D-14);
  - registra como fallo los estados `failed` y `undelivered`;
  - guarda los ids de todas las partes de un aviso.
- **Meta** (DT-3), sin cambio de comportamiento:
  - `cloud-api.ts` y `webhook.ts` se movieron a `providers/meta/`;
  - el timeout y el reintento único se extrajeron a `providers/http-send.ts`, compartido;
  - nueva clase `WhatsAppBot implements ChatBot` (`providers/meta/whatsapp-bot.ts`).
- **Twilio:**
  - `providers/twilio/webhook.ts`:
    - firma HMAC-SHA1 con la URL configurada, comparada en tiempo constante;
    - lectura del formulario: `MessageSid`, `From` y `To`, `NumMedia` y `Body`, y los `StatusCallback`;
  - `providers/twilio/twilio-api.ts`:
    - envío por `fetch` con Basic Auth, formulario, `whatsapp:+` y `StatusCallback`;
    - reintento solo con 429, 503 o un error previo al envío;
  - `providers/twilio/twilio-bot.ts`: clase `TwilioBot implements ChatBot`, que responde con TwiML vacío, devuelve 405 en el `GET` y envía el aviso según D-6, DT-8 y DT-9.
- **Selección:** `providers/select.ts` (`createChatBot`) es el único módulo que importa las dos clases. `app.ts` registra `bot_provider_selected { provider }`.
- **App, rutas y controlador:**
  - `app.ts`: las opciones pasan a `bot` y `providerFetch`;
  - `routes/index.ts`;
  - `controllers/whatsapp-webhook.ts`: depende solo de `ChatBot` y del receptor; responde 405 con `Allow: POST` cuando el proveedor no admite el `GET`.
- **Configuración** (`src/config/env.ts`):
  - `ChatBotConfig` = `MetaBotConfig | TwilioBotConfig | null`;
  - `WHATSAPP_BOT_PROVIDER` (obligatoria con el bot, sin distinguir mayúsculas, validada siempre);
  - `WHATSAPP_BOT_ACCOUNT_ID`, que reemplaza a `WHATSAPP_BOT_PHONE_NUMBER_ID`; si sigue definida la anterior, el arranque falla y pide renombrarla;
  - formatos por proveedor;
  - `WHATSAPP_BOT_WEBHOOK_URL` validada: https, ruta exacta, sin query;
  - con Twilio, `WHATSAPP_MOLOTES` es obligatoria como número (es el emisor);
  - producción con Twilio no arranca;
  - se ignoran las variables del otro proveedor.
- **Contenido del aviso en texto libre:**
  - `botText.staffNotice` en `src/content/common/bot.ts`;
  - `staffNoticeText` en `messages.ts`, que comparte el formato de línea con `staffTemplateParams`.
- **`scripts/bot-chat.ts`:**
  - `--proveedor meta|twilio`, con Meta por defecto;
  - con Twilio, firma con la URL configurada simulada y muestra el aviso en texto libre o como Content Template.
- **Pruebas:**
  - **Nuevas:**
    - `tests/unit/whatsapp-bot-twilio.test.ts`;
    - `tests/unit/chat-bot-boundaries.test.ts`;
    - `tests/integration/whatsapp-webhook-twilio.test.ts`;
    - `tests/integration/chat-bot-contract.test.ts`;
    - `tests/integration/bot-chat.test.ts`;
    - el doble `tests/support/twilio-api-double.ts`;
    - `tests/support/twilio.ts`, con la firma de referencia, las entregas y el harness de Twilio;
    - `tests/support/chat-bot-drivers.ts`;
    - las fixtures de `tests/fixtures/twilio/`.
  - **Existentes:**
    - en las de REQ-F-009 solo cambiaron rutas de import y nombres (`ACCOUNT_ID`, `createBotOrchestrator`, `bot:` en `createApp`, `accountId` en el cliente de la Cloud API), sin tocar ninguna aserción de comportamiento;
    - la prueba de arranque con la configuración incompleta añade `WHATSAPP_BOT_PROVIDER: 'meta'`, ahora obligatoria;
    - el bloque del bot de `config.test.ts` se reescribió con el contrato nuevo y se añadieron los casos de RF-2;
    - `tests/setup/no-meta.ts` también bloquea `*.twilio.com`.
- **Documentación y configuración:**
  - `.env.example`: sección del bot reescrita;
  - `.env` local, que git ignora: bloque de Twilio con `WHATSAPP_BOT_PROVIDER=twilio`, las credenciales vacías y la nota para cambiar `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` al número del sandbox;
  - `README.md`:
    - proveedores e interfaz `ChatBot`;
    - tabla de variables por proveedor;
    - sección "Twilio (desarrollo)", con los prerrequisitos, `join`, la caducidad, el túnel, la URL "When a message comes in", el `StatusCallback`, las limitaciones del sandbox y el orden de las variables del Content Template;
    - la guía de Meta con los nombres nuevos;
    - `bot:chat --proveedor twilio`;
    - el árbol de estructura.

### Criterios de aceptación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | Las pruebas de REQ-F-009 (conversación, infraestructura, orquestador, webhook de Meta) pasan solo con cambios de nombres y rutas. |
| CA-2 | Cumple | `whatsapp-webhook-twilio` "CA-2": 200 con TwiML; respuesta a `whatsapp:+<cliente>` desde `whatsapp:+<WHATSAPP_MOLOTES>`. |
| CA-3 | Cumple | "CA-3": 401 sin firma o con firma mal formada; 403 con otra URL u otro token; sin procesar; `bot_webhook_signature_invalid`. |
| CA-4 | Cumple | El mismo `MessageSid` dos veces produce una respuesta. |
| CA-5 | Cumple | Con `ContentSid`: un envío con las variables 1 a 9. Sin él: un texto libre con el contenido completo. |
| CA-6 | Cumple | Unitaria: menú de más de 1600 caracteres en varias partes de 1600 o menos, con cada producto en una sola parte. |
| CA-7 | Cumple | Imagen y ubicación sin `Body` reciben el aviso de D-15. |
| CA-7b | Cumple | Unitaria e integración: `failed` y `undelivered` registran `bot_staff_delivery_failed` con el negocio y el código, sin teléfonos. |
| CA-8 | Cumple | `config.test`: proveedor ausente o `whatsapp` falla sin valores; se aceptan `META`, `Twilio`, `meta` y `TWILIO`. |
| CA-9 | Cumple | `twilio` con un ID de solo dígitos, o `meta` con `AC…`, falla sin mostrar valores. |
| CA-10 | Cumple | Twilio sin `WEBHOOK_URL` falla y la nombra; sin `APP_SECRET`, `VERIFY_TOKEN` ni `STAFF_TEMPLATE` arranca; Meta sin `STAFF_TEMPLATE` falla. |
| CA-11 | Cumple | Producción con `twilio` falla, con el bot habilitado o sin él. Con `meta`, arranca. |
| CA-12 | Cumple | `config.test` (null) e integración: webhook 503 (POST y GET), landings 200. |
| CA-12b | Cumple | El nombre anterior impide arrancar, pide renombrarla e indica que falta `WHATSAPP_BOT_ACCOUNT_ID`. |
| CA-13 | Cumple | El log de un flujo con Twilio no tiene el Auth Token, el Account SID, textos, nombres, direcciones ni números. `bot_provider_selected` lleva solo `{ provider }`. |
| CA-14 | Cumple | `.env.example` y README según RF-7. Con el `.env` local actualizado, `node --env-file-if-exists=.env src/server.ts` arrancó: landing 200, webhook 503, `"whatsappBot":"disabled"`. |
| CA-15 | Parcial | `typecheck`, `lint` y `npm test` pasan. `docker compose run --rm test` no se pudo ejecutar porque el daemon de Docker no estaba en marcha. El CI se comprobará en T4. |
| CA-15b | Cumple | `tests/integration/bot-chat.test.ts`: pedido completo con `--proveedor twilio` y con Meta por defecto; un proveedor desconocido termina con código 1. |
| CA-16 | Pendiente | Depende de la cuenta de Twilio, el sandbox y el túnel del usuario. |
| CA-17 | Cumple | `chat-bot-boundaries.test.ts`: solo `providers/select.ts` importa las clases; `app.ts`, rutas y controladores no importan de `providers/meta` ni de `providers/twilio`. |
| CA-18 | Cumple | `class WhatsAppBot implements ChatBot` y `class TwilioBot implements ChatBot`; `npm run typecheck` termina con 0. |
| CA-19 | Cumple | `chat-bot-contract.test.ts` (`describe.each` sobre Meta y Twilio): pedido completo, cancelación, "persona", mensaje que no es texto y entrega duplicada. |
| CA-20 | Cumple | Misma batería: `createApp` sin bot inyectado crea el del proveedor configurado y responde por él. |
| CA-21 | Cumple | `chat-bot-boundaries.test.ts`: ningún módulo de la conversación importa de `providers/`. |

### Validaciones ejecutadas

| Comando (desde `restaurante/`) | Resultado |
| --- | --- |
| `npm run typecheck` | Termina con 0. |
| `npm run lint` | Termina con 0, sin errores ni avisos. |
| `npm test` | 60 archivos, 1058 pruebas pasan. Hay 1 `expected fail`, ya existente (`local-server.test.ts`, `it.fails`). |
| `npm run bot:chat -- --proveedor twilio --ahora 2026-10-06T10:00` (entrada redirigida) | Pedido completo, con el aviso al personal en texto libre. |
| `npm run bot:chat -- --ahora 2026-10-06T10:00` (entrada redirigida) | Pedido completo con Meta, con el aviso por plantilla. |
| Arranque con el `.env` local (`PORT=3999`) | `/` responde 200; `POST /webhooks/whatsapp` responde 503; el bot queda deshabilitado. |
| `docker compose run --rm test` | No ejecutado: "Cannot connect to the Docker daemon" (Docker no estaba en marcha). |
| `npm run build:css` | No aplica: no se tocaron estilos ni plantillas. |

### Archivos afectados

- **Código nuevo:**
  - `src/services/whatsapp-bot/chat-bot.ts`;
  - en `providers/`: `select.ts`, `http-send.ts`, `meta/whatsapp-bot.ts`, `twilio/{twilio-bot,twilio-api,webhook}.ts`.
- **Código movido** (`git mv`): `bot.ts` → `orchestrator.ts`; `cloud-api.ts` → `providers/meta/cloud-api.ts`; `webhook.ts` → `providers/meta/webhook.ts`.
- **Código modificado:** `src/app.ts`, `src/config/env.ts`, `src/routes/index.ts`, `src/controllers/whatsapp-webhook.ts`, `src/services/whatsapp-bot/messages.ts`, `src/content/common/bot.ts` y `scripts/bot-chat.ts`.
- **Pruebas:**
  - nuevas: las cinco de pruebas, tres de apoyo y las fixtures de Twilio;
  - modificadas: `tests/helpers.ts`, `tests/setup/no-meta.ts`, `tests/support/{whatsapp,cloud-api-double}.ts`, `tests/unit/{config,whatsapp-bot-infra,whatsapp-bot-orchestrator}.test.ts` y `tests/integration/whatsapp-webhook.test.ts`.
- **Documentación y configuración:** `restaurante/.env.example`, `restaurante/README.md` y `restaurante/.env` (local, no versionado).

### Riesgos o pendientes

- **CA-16 (punta a punta con el sandbox):** pendiente de la cuenta de Twilio, la unión de los teléfonos al sandbox y el túnel del usuario.
- **`docker compose run --rm test`:** no se ejecutó porque Docker no estaba en marcha. El CI (`calidad` y `docker`) lo comprobará en el Pull Request.
- **`.claude/agents/senior-fullstack.md`:** no se modificó. El usuario lo autorizó por medio de la sesión principal, pero cambiar la definición de un agente es configuración y este subagente no la cambia con una autorización transmitida por otro agente. La sesión principal tiene en su informe el texto propuesto para aplicarlo.
- **Numeración de `ContentVariables`:** el orden del 1 al 9 está documentado en el README y debe coincidir con el Content Template que se cree. El sandbox no admite plantillas propias.
- **Detalles de Twilio no confirmados por internet:** salvo el vector de firma, que se recalculó y coincide, los detalles salen de lo que se conoce de la documentación pública: campos del formulario, `MessageStatus` en los `StatusCallback` y códigos de error. La prueba de punta a punta (CA-16) los confirmará.

## QA Action Plan

### Objetivo

Validar con evidencia que el bot funciona con Meta y con Twilio como implementaciones intercambiables de `ChatBot`, elegidas solo por configuración. También que la conversación existe una sola vez y que no hay regresiones en Meta (REQ-F-009) ni en las landings. Además, que la firma, la configuración y los logs cumplen RF-2 a RF-4, y que `.env.example` y el README cumplen RF-7.

### Requisito bajo prueba

REQ-F-012 v2 (RF-1 a RF-8, D-1 a D-17, RN-7 a RN-9), con el Technical Action Plan aprobado (DT-1 a DT-12). Implementación sin commit en `feature/REQ-F-012-bot-whatsapp-hibrido-meta-twilio`, aprobada por el usuario: "apruebo la implementación y aplica el texto del agente".

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Pruebas |
| --- | --- |
| CA-1 | F-1 (suite completa), R-1 (diff de las pruebas de REQ-F-009: solo nombres o rutas, ninguna aserción de comportamiento cambiada), R-2 (snapshots de las landings sin cambios) |
| CA-2 | F-2 (prueba existente "CA-2"), F-3 (prueba QA nueva por HTTP real con el doble: `From`/`To` con `whatsapp:+`, `Content-Type` `text/xml`, TwiML exacto) |
| CA-3 | S-1 a S-6 (firma: sin cabecera 401, mal formada 401, otra URL 403, otro token 403, parámetro alterado 403, URL reconstruida por `Host`/`X-Forwarded-*` ignorada), con comprobación de que no hay envío y de `bot_webhook_signature_invalid { reason }` sin valores |
| CA-4 | F-4 (el mismo `MessageSid` dos veces, y también en paralelo: una sola respuesta) |
| CA-5 | F-5 (con `ContentSid`: exactamente un envío, `ContentVariables` "1" a "9" en el orden de DT-8), F-6 (sin plantilla: exactamente un `Body` con todos los campos de REQ-F-009 CA-14), L-6 (DT-9: aviso de más de 1600 caracteres en partes, sin duplicados) |
| CA-6 | F-7 (menú de más de 1600: cada parte de 1600 o menos y ningún producto partido; con Meta el menú sigue a 4096) |
| CA-7 | F-8 (imagen con pie de foto, ubicación sin `Body`, `Body` vacío: el mensaje de D-15) |
| CA-7b | F-9 (`failed` y `undelivered` del aviso: `bot_staff_delivery_failed` con el negocio y el código, sin teléfonos), N-5 (`delivered`, `sent` o `read` no registran fallo; un `failed` de una respuesta al cliente, que no es aviso, no registra `bot_staff_delivery_failed`) |
| CA-8 | C-1 (unitaria existente) y C-P (proceso real: `node src/server.ts` con el proveedor ausente o `whatsapp` termina con código 1 y sin valores; `META` y `Twilio` arrancan) |
| CA-9 | C-2 y C-P (Twilio con un ID de solo dígitos; Meta con `AC…`) |
| CA-10 | C-3 y C-P (Twilio sin `WEBHOOK_URL` nombra la variable; Twilio sin `APP_SECRET`/`VERIFY_TOKEN`/`STAFF_TEMPLATE` arranca; Meta sin `STAFF_TEMPLATE` falla) |
| CA-11 | C-4 y C-P (`NODE_ENV=production` + `twilio`, con el bot y sin él: código 1; `production` + `meta` no falla por esta regla) |
| CA-12 | C-5 y C-P (`twilio` sin datos de cuenta: arranca, `POST` y `GET /webhooks/whatsapp` → 503, `/`, `/molotes` y `/birria` → 200) |
| CA-12b | C-6 y C-P (`WHATSAPP_BOT_PHONE_NUMBER_ID` con el resto de Meta: falla, pide el renombrado y nombra `WHATSAPP_BOT_ACCOUNT_ID`) |
| CA-13 | P-1 a P-4 (privacidad de los logs) |
| CA-14 | D-1 a D-4 (documentación) y C-P7 (`npm run dev`/`start` con el `.env` local: bot deshabilitado) |
| CA-15 | F-1, A-1 (`typecheck`), A-2 (`lint`), A-3 (sin llamadas reales), Docker según "Tratamiento de Docker y CA-16" |
| CA-15b | F-10 (prueba existente `bot-chat.test.ts`) y F-11 (ejecución manual de `npm run bot:chat -- --proveedor twilio` y sin la opción, con la entrada redirigida) |
| CA-16 | Ver "Tratamiento de Docker y CA-16": BLOCKED por prerrequisitos del usuario |
| CA-17 | I-1 (prueba existente de fronteras), I-2 (verificación independiente con `grep` de los imports de `app.ts`, `routes/`, `controllers/` y de quién importa `whatsapp-bot.ts` y `twilio-bot.ts`) |
| CA-18 | A-1 (`typecheck` con 0) e I-3 (`implements ChatBot` en las dos clases) |
| CA-19 | I-4 (`chat-bot-contract.test.ts` con los dos proveedores: pedido completo, cancelación, "persona", no texto, duplicado). Se revisa que solo cambian el driver, el doble y las variables, y que las aserciones son las mismas |
| CA-20 | I-5 (misma app y mismo código: `createApp` sin bot inyectado, primero con el entorno de Meta y luego con el de Twilio, usa el proveedor configurado) y C-P (proceso real: con el mismo árbol, cambiar solo las variables cambia `bot_provider_selected`) |
| CA-21 | I-1 e I-2 (ningún módulo de la conversación importa de `providers/`), I-6 (búsqueda de lógica duplicada: la máquina de estados, el catálogo, el carrito y los mensajes no existen dentro de `providers/`) |

### Riesgos identificados

- **Refactorización amplia** (renombrado del orquestador, movimiento de `cloud-api.ts` y `webhook.ts`, `http-send.ts` compartido): riesgo de cambiar el comportamiento de Meta de forma silenciosa. Se mitiga con R-1, que revisa que las pruebas de REQ-F-009 no hayan cambiado aserciones.
- **Firma de Twilio:** la URL exacta, el orden de los parámetros, las claves repetidas, los caracteres codificados (`+`, `%20`, emojis y acentos) y la comparación en tiempo constante. Un error deja el bot sin responder (403) o, peor, acepta entregas falsas.
- **`StatusCallback`:** comparte la ruta y la firma; debe distinguir el aviso al personal de las respuestas al cliente.
- **Configuración:** muchas combinaciones de proveedor, entorno y variables. Los errores no deben mostrar valores y producción nunca debe arrancar con Twilio.
- **Privacidad:** el Account SID y el Auth Token son nuevos secretos que podrían aparecer en los logs (URL de la API, errores de `fetch`, mensajes de configuración).
- **Duplicidad de la conversación:** que una implementación reproduzca parte de la lógica compartida.
- **Documentación:** que el README y `.env.example` digan algo distinto de lo que valida `env.ts`.
- **Sin acceso a la documentación vigente de Twilio:** los campos del formulario y de los `StatusCallback` no se confirmaron en línea, y solo CA-16 los confirma.

### Pruebas funcionales

- **F-1.** `npm test` completo (se espera lo mismo que reportó la implementación: 1058 pruebas y 1 `it.fails` ya existente).
- **F-2 a F-10.** Las pruebas existentes de `tests/integration/whatsapp-webhook-twilio.test.ts`, `tests/unit/whatsapp-bot-twilio.test.ts`, `tests/integration/chat-bot-contract.test.ts` y `tests/integration/bot-chat.test.ts`. Se revisa que cada una aserte el comportamiento del CA, no la implementación interna.
- **F-3, F-4 (paralelo), F-5 a F-9:** se completan con pruebas QA nuevas donde la cobertura existente no sea suficiente (ver "Pruebas automatizadas").
- **F-11.** `npm run bot:chat -- --proveedor twilio --ahora 2026-10-06T10:00` y sin `--proveedor`, con la entrada redirigida desde un archivo del scratchpad: pedido completo, aviso al personal (texto libre o plantilla) y sin salida a internet.

### Pruebas negativas y casos límite

- **N-1.** `POST` de Twilio con un JSON o un `Content-Type` distinto, o con campos mal formados (`MessageSid` inválido, `From` sin `whatsapp:+`, `NumMedia` 11 o no numérico): 200 o 400 según DT-6, sin procesar, y `bot_webhook_ignored`.
- **N-2.** Otro `AccountSid` u otro `To`: 200, sin respuesta al cliente.
- **N-3.** Cuerpo de más de 64 KiB → 413; cuerpo no UTF-8 → 400; `GET` con Twilio → 405 con `Allow: POST` y el JSON `METHOD_NOT_ALLOWED`.
- **N-4.** Bot deshabilitado con `twilio` y con `meta`: `GET` y `POST` → 503.
- **N-5.** Estados que no son fallo; un fallo de una respuesta al cliente (no del aviso); un `StatusCallback` de un id desconocido.
- **L-1.** Emojis, acentos y `+` en `Body`: la firma calculada como Twilio (sobre los valores decodificados) es válida y el texto llega íntegro.
- **L-2.** Parámetros repetidos en el formulario: la firma no se rompe y el campo repetido se trata como mal formado.
- **L-3.** `Host` o `X-Forwarded-Proto/Host` distintos de `WHATSAPP_BOT_WEBHOOK_URL`: la firma se valida contra la URL configurada.
- **L-4.** `From` `whatsapp:+521…`: la respuesta va al mismo identificador recibido.
- **L-5.** D-14: un mensaje de Twilio (sin `timestamp`) no se descarta como antiguo, y los mensajes muy seguidos se procesan en orden.
- **L-6.** DT-9: aviso en texto libre de más de 1600 caracteres. Se envía en partes ordenadas, sin reintentar una parte aceptada. Si falla una parte, el cliente recibe D-18 y el personal no recibe un aviso duplicado.
- **L-7.** Reintento de Twilio solo con 429, 503 o un error previo al envío; sin reintento con 500 o timeout (pruebas existentes, revisadas).
- **L-8.** `WHATSAPP_BOT_WEBHOOK_URL` con `http`, con query, con credenciales o con otra ruta: el arranque falla sin mostrar el valor.

### Pruebas de configuración (CA-8 a CA-12b, CA-20)

- **C-1 a C-6.** Las pruebas existentes de `tests/unit/config.test.ts`, revisadas contra la tabla de RF-2 y las reglas 1 a 5.
- **C-P (proceso real, evidencia nueva).** Se arranca `node src/server.ts` (sin `.env`, con las variables mínimas no secretas del proyecto y un `DATA_DIR` temporal en el scratchpad, en un puerto libre) con cada combinación de CA-8, CA-9, CA-10, CA-11, CA-12 y CA-12b. En cada caso se registran el código de salida y el mensaje de error, y se comprueba que no aparece ningún valor de las variables. Los valores son ficticios y del formato de cada proveedor, nunca credenciales reales. Hoy no hay una prueba automática del código de salida con el proveedor (`server-startup.test.ts` no lo cubre). Por eso se añade como prueba QA nueva, si el plan se aprueba, y si no, queda como evidencia manual.
- **C-P7.** Con el `.env` local actual (sin imprimir su contenido): la app arranca, el log muestra `whatsappBot: disabled`, el webhook responde 503 y las landings responden 200. También se revisa que el `.env` tenga el bloque de Twilio con `WHATSAPP_BOT_PROVIDER=twilio`, las credenciales vacías y la nota sobre el sandbox, sin secretos. Solo se revisa si cada variable está vacía o no, sin mostrar valores.

### Seguridad de la firma

- **S-1 a S-6.** Ver CA-3 y L-1 a L-3.
- **S-7.** Vector oficial de la documentación de Twilio (URL `https://mycompany.com/myapp.php?foo=1&bar=2`, Auth Token `12345` y firma `0/KCTR6DLpKmkAf8muzZqo1nDgQ=`), recalculado de forma independiente con `node:crypto` en el scratchpad y contra `twilioSignature`.
- **S-8.** Revisión del código: la firma se comprueba antes de leer el formulario como datos del bot y antes de `receive`; usa `timingSafeEqual` y compara la longitud antes.
- **S-9.** Envío: el Auth Token solo va en `Authorization: Basic`, la base `https://api.twilio.com` es fija y no se puede configurar, y la URL lleva el Account SID pero nunca se registra (se verifica con el doble y con los logs).
- **S-10.** Meta sin regresión: las pruebas de firma `X-Hub-Signature-256` y de verificación por `GET` de REQ-F-009 siguen pasando sin cambios.

### Privacidad de los logs (CA-13)

- **P-1.** Prueba existente "CA-13", revisada: qué recorre y qué busca.
- **P-2.** Prueba QA nueva con un logger que captura todo: un flujo completo con Twilio que incluye un pedido, un aviso, un `StatusCallback` `failed`, una firma inválida, un error 4xx/5xx de la API y un timeout. En la salida serializada se buscan el Auth Token, el Account SID completo, `whatsapp:+<número>`, los números completos del cliente y del personal, el nombre, la dirección, las notas y los textos del cliente. No debe aparecer ninguno.
- **P-3.** `bot_provider_selected` lleva solo `{ provider }`, con Meta y con Twilio.
- **P-4.** Errores de configuración (C-P): ningún valor en `stderr` ni en los logs.

### Intercambiabilidad (CA-17 a CA-21)

- **I-1.** `tests/unit/chat-bot-boundaries.test.ts`, revisada para comprobar que no es trivial: por ejemplo, que fallaría si `app.ts` importara `twilio-bot.ts`.
- **I-2.** `grep` independiente de los imports en `src/` y `scripts/`.
- **I-3.** `implements ChatBot` en `WhatsAppBot` y `TwilioBot`, y `typecheck`.
- **I-4.** Batería de contrato con los dos proveedores, con la salida de Vitest de los dos bloques.
- **I-5.** CA-20, con la misma app y dos entornos.
- **I-6.** Revisión de que `providers/` no contiene lógica de la conversación (estados, catálogo, carrito, textos de `botText`, salvo los que recibe hechos).

### Documentación (CA-14, RF-7)

- **D-1.** `.env.example`:
  - la sección del bot con `WHATSAPP_BOT_PROVIDER`;
  - qué variable usa cada proveedor y cuáles son secretas;
  - Meta para producción y Twilio para desarrollo;
  - la equivalencia `PHONE_NUMBER_ID` → `ACCOUNT_ID`;
  - sin valores reales.
- **D-2.** README: cada punto de RF-7, que son la interfaz `ChatBot` y sus implementaciones, la elección del proveedor y la tabla de variables, los prerrequisitos de Twilio, `join` y la caducidad, el túnel y las dos URL, las limitaciones del sandbox, la guía de Meta con los nombres nuevos, `bot:chat --proveedor twilio` y el orden de `ContentVariables`.
- **D-3.** Coherencia entre la documentación y el código. Las variables, los formatos, la obligatoriedad, la regla de producción y la ruta exacta de `WEBHOOK_URL` del README y de `.env.example` se contrastan con `src/config/env.ts`. No debe quedar ninguna mención a `WHATSAPP_BOT_PHONE_NUMBER_ID` salvo como nombre anterior, ni a `createWhatsAppBot` o `bot.ts` como orquestador.
- **D-4.** `.claude/agents/senior-fullstack.md` (cambio de la sesión principal autorizado por el usuario): se revisa que describa lo que hace el código. Es solo una revisión de coherencia y no forma parte de ningún CA.

### Pruebas de regresión

- **R-1.** `git diff HEAD` de las pruebas de REQ-F-009 (`whatsapp-bot-conversation`, `-infra`, `-orchestrator`, `whatsapp-webhook`, `config`): solo cambian los imports, los nombres y la variable obligatoria nueva. Ningún `expect` de comportamiento se elimina ni se relaja. `whatsapp-bot-conversation.test.ts` no debería tener cambios.
- **R-2.** Snapshots de las landings (`landing-snapshot.test.ts`) sin cambios ni archivos `.snap` modificados.
- **R-3.** Landings por HTTP real (servidor en un puerto libre con el `.env` local): `/`, `/molotes` y `/birria` responden 200; los CTA de WhatsApp conservan su `href`, `target` y `rel`. Se comparan con `main` por texto de la página, porque este ticket no toca las vistas.
- **R-4.** Panel `/admin` y API de productos: cubiertos por la suite, sin cambios en esos archivos (`git diff --stat`).
- **R-5.** `package.json` y `package-lock.json` sin cambios: sin dependencias nuevas (DT-12).
- **R-6.** `git diff` limitado al ticket: no hay archivos ajenos al alcance.

### Pruebas responsive, de accesibilidad y UX/UI

No aplican al bot, que es solo conversacional y no tiene diseño en `_stich_source_/`. Las landings no cambian (RF-6). Su regresión visual se cubre con R-2 y R-3. Además, en el navegador (Claude in Chrome) se hace una comprobación rápida de `/molotes` y `/birria` a 375×812 y 1440×900: carga sin errores de consola y el CTA de WhatsApp es visible. Si la extensión no responde, queda como revisión manual, sin bloquear ningún CA.

### Pruebas de integración (WhatsApp)

- **CTA de las landings:** R-3.
- **API de Twilio:** se prueba solo contra el doble (`twilio-api-double.ts`), y se revisa que el doble valide lo que Twilio exige: Basic Auth, formulario, `From`/`To` con `whatsapp:+`, `StatusCallback` y la respuesta `sid`.
- **Twilio real:** CA-16.

### Pruebas de performance

Sin impacto esperado. Solo se comprueba que la respuesta del webhook de Twilio sea inmediata, es decir, que no espere a los envíos. Lo cubren las pruebas del doble con respuesta lenta, si existen, o una prueba QA nueva con un doble que tarda.

### Pruebas SEO

No aplican: las vistas no cambian. Lo cubren R-2 y R-3.

### Pruebas automatizadas (existentes y nuevas a crear o modificar)

- **Existentes:** toda la suite, con atención a `whatsapp-bot-twilio`, `whatsapp-webhook-twilio`, `chat-bot-contract`, `chat-bot-boundaries`, `bot-chat`, `config`, `whatsapp-webhook` y `landing-snapshot`.
- **Nuevas (solo en `restaurante/tests/`, con la aprobación de este plan)**, en un único archivo `tests/integration/whatsapp-twilio-qa-round1.test.ts` que usa `listenLocal` y los dobles existentes:
  - firma: vector oficial, URL reconstruida por cabeceras ignorada, parámetro alterado, emojis, acentos y `+`, y claves repetidas (S-1 a S-7, L-1 a L-3);
  - duplicado en paralelo (F-4), `521…` (L-4) y D-14 (L-5);
  - `StatusCallback` que no son fallo, el fallo de una respuesta al cliente y un id desconocido (N-5);
  - DT-9 con un aviso de más de 1600 caracteres, incluido el fallo de una parte (L-6);
  - privacidad ampliada del log (P-2), incluidos los errores de la API y el timeout;
  - respuesta inmediata del webhook con un doble lento.
- Si el código de salida del arranque no puede automatizarse de forma estable en la suite, C-P queda como evidencia manual con los comandos y su salida en el QA Report. Si se automatiza, va a `tests/integration/server-startup-provider-qa.test.ts` y lanza `node src/server.ts` como proceso hijo.
- Las pruebas nuevas no modifican código de producción ni reproducen la implementación interna: asertan respuestas HTTP, el tráfico registrado por el doble y los eventos de log.

### Pruebas en navegador

Solo la comprobación de regresión de las landings descrita arriba. No se sigue ningún enlace de WhatsApp.

### Tratamiento de Docker y CA-16

- **Docker (parte de CA-15).**
  - En Q2 se intenta `docker compose run --rm test` desde `restaurante/`, primero comprobando el daemon con `docker info`.
  - Si Docker no está en marcha, no se arranca Docker Desktop sin permiso. Se registra como **bloqueo de entorno**, no como defecto.
  - En ese caso CA-15 queda **PASS parcial**: `typecheck`, `lint` y `npm test` en verde. La parte de Docker y el CI queda pendiente del job `docker` del CI en el Pull Request (T4), que ya ejecuta la misma imagen.
  - Como la implementación no cambia el `Dockerfile`, `compose.yaml` ni las dependencias (se comprueba con R-5 y `git diff`), el riesgo es bajo. Por eso esta parte bloqueada **no impide `QA_APPROVED`**, pero queda como condición para el merge: el CI debe pasar.
  - Si el usuario prefiere que Docker bloquee la aprobación, puede decirlo al aprobar este plan.
- **CA-16 (punta a punta con el sandbox).**
  - Queda **BLOCKED por prerrequisitos del usuario**: la cuenta de Twilio, el sandbox, las uniones y el túnel. Lo prevén el ticket (D-9, "Prerrequisitos", "Solo bloquean CA-16") y los criterios de finalización del plan técnico, por lo que no es un defecto.
  - No se ejecuta ni se simula, y QA no usa ni solicita credenciales.
  - El QA Report lo deja en "Pendientes de revisión manual", con los pasos para que el usuario lo verifique: pedido completo de Molotes y de Birria, aviso en el teléfono del personal y comprobación de los `StatusCallback`.
  - `QA_APPROVED` se puede emitir con CA-16 pendiente, porque el requisito aprobado lo condiciona expresamente a esos prerrequisitos. Si el usuario quiere que CA-16 bloquee el cierre del ticket, puede indicarlo al aprobar este plan.

### Evidencia requerida

- La salida de `npm run typecheck`, `npm run lint`, `npm test` (resumen y conteo) y de las pruebas QA nuevas.
- Los comandos C-P con el código de salida y los mensajes, sin valores.
- La salida de `bot:chat` con los dos proveedores, resumida.
- El `grep` de los imports (CA-17 y CA-21).
- El `git diff` de las pruebas de REQ-F-009 (R-1), de los snapshots (R-2) y de `package*.json` (R-5).
- El resultado de `docker info` y `docker compose run --rm test`, o el bloqueo.
- Las respuestas HTTP de las landings y del webhook en el servidor real, y las capturas o el texto de la página si el navegador está disponible.
- La lista de verificación de RF-7 contra el README y `.env.example`, con las líneas.

### Criterios de aprobación

- **`QA_APPROVED`** si se cumple todo esto:
  - todos los CA pasan con evidencia, excepto CA-16 (BLOCKED por prerrequisitos) y, si Docker no está disponible, la parte de Docker de CA-15;
  - `npm test`, `typecheck` y `lint` terminan con 0;
  - no hay defectos BLOCKER, CRITICAL ni MAJOR sin una decisión del usuario;
  - no hay regresión en Meta ni en las landings.
- **`QA_REJECTED`** si falla algún CA, aparece un defecto BLOCKER o CRITICAL, o hay una regresión en Meta, en las landings, en la seguridad de la firma o en la privacidad de los logs.
- **`NEEDS_USER_DECISION`** si hay defectos MAJOR o una ambigüedad del requisito, como un detalle de Twilio no confirmable sin documentación en línea que cambie el resultado de un CA.

## QA Report

### Ronda

1 (2026-10-08). El usuario aprobó el QA Action Plan: "apruebo el plan de QA, sí a las 4". Sus respuestas:

- se aprueba el plan;
- Docker queda pendiente del CI y no bloquea la aprobación;
- CA-16 queda pendiente y no bloquea la aprobación;
- se autorizan las pruebas QA nuevas.

### Pruebas ejecutadas

Todos los comandos se ejecutaron desde `restaurante/`, en la rama `feature/REQ-F-012-bot-whatsapp-hibrido-meta-twilio`.

| Comando o acción | Resultado real |
| --- | --- |
| `npm run build:css` | Código 0. |
| `npm run typecheck` | Código 0, antes y después de añadir las pruebas QA. |
| `npm run lint` | Código 0, sin errores ni avisos, ya con las pruebas QA. La primera versión de `server-startup-provider-qa.test.ts` tuvo 4 errores `no-unused-vars` en el código de prueba de QA. Se corrigieron y no es un defecto de la implementación. |
| `npm test` (antes de las pruebas QA) | 60 archivos; 1058 pasan y 1 `expected fail` ya existente. |
| `npm test` (con las pruebas QA) | **62 archivos; 1085 pasan y 1 `expected fail` ya existente.** |
| `tests/integration/server-startup-provider-qa.test.ts` (nueva, 9 pruebas) | 9/9. Arranca `node src/server.ts` en procesos reales con cada combinación de CA-8 a CA-12b, CA-20 y L-8. |
| `tests/integration/whatsapp-twilio-qa-round1.test.ts` (nueva, 18 pruebas) | 18/18. Cubre la firma con un firmador propio de QA, las entregas, los `StatusCallback`, DT-9, la privacidad, la respuesta inmediata y CA-20. |
| Contrato, fronteras y Twilio unitarias (`--reporter=verbose`) | 50/50, con los dos bloques del contrato (`meta` y `twilio`) en verde. |
| `npm run bot:chat -- --proveedor twilio --ahora 2026-10-06T10:00` (entrada redirigida) | Código 0. Pedido `M-…` completo, `[aviso al personal +52…, texto libre]` y ninguna línea de más de 1600 caracteres. |
| `npm run bot:chat -- --ahora 2026-10-06T10:00` | Código 0. "Simulador del bot con meta", `[aviso al personal …, plantilla nuevo_pedido]` y pedido confirmado. |
| `npm run bot:chat -- --proveedor otro` | Código 1, con el mensaje de uso. |
| `PORT=3117 npm start` con el `.env` local | Muestra `server_started` y `"whatsappBot":"disabled"`. `/`, `/molotes` y `/birria` responden 200. `POST` y `GET /webhooks/whatsapp` responden 503 `BOT_DISABLED`. Servidor detenido al terminar. |
| `grep` de imports en `src/` y `scripts/` | Solo `providers/select.ts` importa `meta/whatsapp-bot.ts` y `twilio/twilio-bot.ts`. `app.ts` y `scripts/bot-chat.ts` importan solo `providers/select.ts` (`createChatBot`). Ningún módulo de `src/services/whatsapp-bot/*.ts` fuera de `providers/` importa de `providers/`. |
| `git diff HEAD` de las pruebas de REQ-F-009 | `whatsapp-bot-conversation.test.ts` no cambia. En `-infra`, `-orchestrator` y `whatsapp-webhook` se eliminan 0 líneas con `expect`: solo cambian imports, nombres (`accountId`, `bot:`) y `WHATSAPP_BOT_PROVIDER: 'meta'`. En `config.test.ts`, los casos reescritos tienen equivalentes con el contrato nuevo (líneas 143 a 300). |
| `git diff HEAD --stat` de `tests/unit/__snapshots__`, `src/views`, `public`, `src/styles`, `package*.json`, `Dockerfile`, `compose.yaml` y `.github` | Sin cambios. |
| `docker info` | Código 1: el daemon no está en marcha. No se arrancó Docker, como indicó el usuario. |
| Navegador (Claude in Chrome) en `/molotes` y `/birria` | Un `h1`, sin overflow horizontal, CTA visible arriba con `href` `wa.me/<número>?text=…`, `target="_blank"` y `rel="noopener noreferrer"`. Sin errores de consola. La ventana no se pudo reducir a 375×812, porque `innerWidth` siguió en 2560. |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | La suite completa pasa. Las pruebas de REQ-F-009 no pierden ninguna aserción. `whatsapp-bot-conversation.test.ts` y los snapshots no cambian. El reto `GET` de Meta responde 200 con el `challenge` en un proceso real (CA-20 de la QA). |
| CA-2 | PASS | `whatsapp-webhook-twilio` "CA-2": 200 con `text/xml` y TwiML vacío; la respuesta va a `whatsapp:+<cliente>`, desde `whatsapp:+<WHATSAPP_MOLOTES>` y con `StatusCallback`. La QA lo repite con un firmador propio. |
| CA-3 | PASS | Sin firma, vacía, con espacios o con Base64 de otra longitud: 401. Con otra URL, otro token, un parámetro alterado, un parámetro añadido o la URL reconstruida desde `Host`/`X-Forwarded-*`: 403. No hay ningún envío. `bot_webhook_signature_invalid` lleva solo `{ level, msg, reason }`. |
| CA-4 | PASS | El mismo `MessageSid` dos veces seguidas, y tres veces en paralelo (`Promise.all`), produce una sola respuesta. |
| CA-5 | PASS | Con `ContentSid`, exactamente un envío con las variables "1" a "9" en el orden de DT-8. Sin plantilla, exactamente un texto libre con los campos de REQ-F-009 CA-14. DT-9 (QA): el aviso de más de 1600 caracteres va en partes de 1600 o menos, que unidas reproducen el texto. Si falla una parte, el aviso falla y la primera parte no se reenvía. Con un 503 se reintenta solo la parte afectada, sin duplicados. |
| CA-6 | PASS | Unitaria "CA-6": el menú de más de 1600 caracteres llega en partes de 1600 o menos, sin cortar productos. `bot:chat` con Twilio no muestra ninguna línea de más de 1600 caracteres. |
| CA-7 | PASS | Imagen y ubicación sin `Body` reciben D-15. Un `Body` repetido también se trata como "no es texto" (QA, L-2). |
| CA-7b | PASS | `failed` y `undelivered` de un aviso al personal registran `bot_staff_delivery_failed { business, errorCode }`. `sent`, `delivered` y `read`, un `failed` de una respuesta al cliente o de un id desconocido no registran nada. No hay números en el log. |
| CA-8 | PASS | En procesos reales, sin proveedor o con `whatsapp`, la app termina con código 1, nombra `WHATSAPP_BOT_PROVIDER` y no muestra valores. `META` y `Twilio` arrancan. |
| CA-9 | PASS | En procesos reales, Twilio con un ID de dígitos y Meta con `AC…` terminan con código 1, sin valores. |
| CA-10 | PASS | En procesos reales, Twilio sin `WEBHOOK_URL` termina con código 1 y la nombra. Twilio sin `APP_SECRET`, `VERIFY_TOKEN` ni `STAFF_TEMPLATE` arranca. Meta sin `STAFF_TEMPLATE` termina con código 1. L-8: una URL con `http`, query, credenciales u otra ruta termina con código 1 sin mostrar el valor. |
| CA-11 | PASS | En procesos reales, `NODE_ENV=production` con `twilio` termina con código 1 y muestra "WHATSAPP_BOT_PROVIDER=twilio no se permite con NODE_ENV=production", con el bot habilitado y sin él. |
| CA-12 | PASS | En un proceso real, `twilio` sin datos de cuenta arranca con `whatsappBot: disabled`; el webhook (`GET` y `POST`) responde 503 y las tres landings 200. Lo mismo ocurre con el `.env` local. |
| CA-12b | PASS | En un proceso real, `WHATSAPP_BOT_PHONE_NUMBER_ID` con el resto de Meta termina con código 1; el mensaje nombra la variable anterior y `WHATSAPP_BOT_ACCOUNT_ID`, sin valores. |
| CA-13 | PASS | Prueba existente, más la de QA con errores 500, 429 y 401, timeout, `ECONNRESET`, `StatusCallback` `failed` y una firma inválida. El log no contiene el Auth Token, el Account SID (ni sin `AC`), `whatsapp:+`, `api.twilio.com`, el `message` de Twilio, `Basic `, la URL del webhook, números completos, el nombre, la dirección ni las notas. `bot_provider_selected` lleva solo `provider`, también en un proceso real. |
| CA-14 | PASS | `.env.example` y el README cumplen cada punto de RF-7 (ver "Documentación" más abajo). El `.env` local, ignorado por git, tiene `WHATSAPP_BOT_PROVIDER=twilio`, las credenciales vacías y la nota sobre el sandbox, sin secretos. `npm start` arranca con el bot deshabilitado. |
| CA-15 | PASS parcial (aceptado) | `typecheck`, `lint` y `npm test` terminan con 0. `tests/setup/no-meta.ts` rechaza `api.twilio.com` (prueba en `whatsapp-bot-infra`). Docker queda BLOCKED por el entorno y pendiente del CI, según la decisión del usuario. |
| CA-15b | PASS | `bot-chat.test.ts` y la ejecución manual con los dos proveedores. Un proveedor desconocido termina con código 1. |
| CA-16 | BLOCKED (aceptado) | Depende de la cuenta de Twilio, el sandbox y el túnel del usuario. No se ejecutó ni se simuló. |
| CA-17 | PASS | `chat-bot-boundaries.test.ts` analiza los imports reales y comprueba que encuentra los archivos, más el `grep` independiente. `app.ts`, `routes/` y `controllers/` no importan nada de `providers/meta` ni de `providers/twilio`. El controlador depende solo del tipo `ChatBot`. |
| CA-18 | PASS | `class WhatsAppBot implements ChatBot` y `class TwilioBot implements ChatBot`; `typecheck` termina con 0. |
| CA-19 | PASS | `chat-bot-contract.test.ts` pasa los mismos 5 casos con `meta` y con `twilio` (salida verbose). |
| CA-20 | PASS | Contrato "selección por configuración", más la QA: con `createApp` sin bot inyectado, cada entorno envía solo a `graph.facebook.com` o solo a `api.twilio.com`. En procesos reales, el mismo árbol registra `meta` o `twilio` según las variables; Meta responde al reto `GET` y Twilio responde 405 al `GET` y 401 al `POST` sin firma. |
| CA-21 | PASS | Prueba de fronteras y `grep`: ningún módulo de la conversación importa de `providers/`, y `providers/` no contiene lógica de la conversación (catálogo, carrito, estados ni `botText`). |

### Defectos encontrados

Ninguno.

Una observación sin defecto: un formulario con `Body` repetido, que Twilio no envía, no se ignora. Se trata como "no es texto" (D-15) y no usa ninguno de los dos valores. DT-6 no define este caso, el comportamiento es seguro y no contradice ningún CA.

### Regresión

- Meta: la suite de REQ-F-009 pasa sin aserciones eliminadas; la firma `X-Hub-Signature-256` y el reto `GET` funcionan en un proceso real.
- Landings: los snapshots no cambian; `/`, `/molotes` y `/birria` responden 200 y los CTA de WhatsApp tienen el `href`, `target` y `rel` correctos.
- Panel y API de productos: sin cambios en sus archivos, y la suite pasa.
- Dependencias y CI: `package*.json`, `Dockerfile`, `compose.yaml` y `.github` no cambian.

### Responsive

No aplica: las vistas no cambian. En el navegador no hay overflow horizontal en `/molotes` ni en `/birria` y el CTA aparece arriba. La ventana no se pudo reducir a 375 px, porque la extensión no aplicó el tamaño. La regresión visual está cubierta por los snapshots sin cambios.

### Accesibilidad

No aplica al bot. Las landings no cambian: un solo `h1` en cada una y CTA con texto, `target` y `rel`.

### UX/UI

No aplica: no hay diseño en `_stich_source_/` para el bot. La conversación es la misma con los dos proveedores, como demuestra la batería de contrato.

### Performance

El webhook de Twilio responde 200 sin esperar al envío: con un proveedor bloqueado, la respuesta llega antes del envío y el envío ocurre al liberarlo. La firma es una HMAC por entrega. Sin errores de consola en las landings.

### SEO

No aplica: las vistas no cambian. Los títulos de las landings siguen correspondiendo a cada negocio.

### Documentación

- **`.env.example`:**
  - la sección del bot con `WHATSAPP_BOT_PROVIDER`;
  - Meta para producción y Twilio para desarrollo;
  - la regla de producción;
  - el uso de cada variable por proveedor, y cuáles son secretas;
  - la equivalencia `PHONE_NUMBER_ID` → `ACCOUNT_ID`;
  - los formatos, coherentes con `env.ts`;
  - `WEBHOOK_URL` con https, la ruta exacta y sin query.
- **README:**
  - la interfaz `ChatBot` y sus dos implementaciones;
  - la tabla de variables por proveedor;
  - los prerrequisitos de Twilio, `join <palabra>` y la caducidad de la unión;
  - el túnel, "When a message comes in" y el `StatusCallback`;
  - las limitaciones del sandbox: la ventana de 24 h y que no admite plantillas propias;
  - el orden `{{1}}` a `{{9}}`;
  - la guía de Meta con los nombres nuevos;
  - `bot:chat --proveedor twilio`;
  - el árbol actualizado.
- **Referencias obsoletas:** no hay ninguna a `createWhatsAppBot`, `whatsapp-bot/bot.ts` ni `cloudApiFetch`. `WHATSAPP_BOT_PHONE_NUMBER_ID` solo aparece como el nombre anterior.
- **`.claude/agents/senior-fullstack.md`:** describe lo que hace el código.

### Pendientes de revisión manual

1. **CA-16:** el usuario verifica el pedido de punta a punta con el sandbox de Twilio:
   1. Une al sandbox (`join <palabra>`) el teléfono de prueba y los del personal.
   2. Crea un túnel HTTPS y pon su URL en `WHATSAPP_BOT_WEBHOOK_URL` y en "When a message comes in".
   3. Rellena en `.env` el Account SID, el Auth Token y los números del personal, y cambia `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` al número del sandbox.
   4. Con `npm run dev`, haz un pedido completo de Molotes (de lunes a viernes) y uno de Birria (sábado o domingo, o con la hora cambiada).
   5. Comprueba que el aviso llega al teléfono del personal y que el log no tiene `bot_staff_delivery_failed`.

   Con esta prueba también se confirman los campos reales del formulario y de los `StatusCallback`.
2. **Docker:** el job `docker` del CI debe pasar en el Pull Request (`docker compose run --rm test` no se pudo ejecutar porque el daemon no estaba en marcha).
3. **Responsive en el navegador a 375×812 y 768×1024:** no se pudo, porque la extensión no redujo la ventana. No bloquea: este ticket no toca las vistas y los snapshots no cambian.

### Archivos de prueba añadidos por QA

- `restaurante/tests/integration/server-startup-provider-qa.test.ts`
- `restaurante/tests/integration/whatsapp-twilio-qa-round1.test.ts`

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1 (borrador, 2026-10-08)

Análisis inicial con las preguntas 1 a 11 y las propuestas P-1 a P-5.

### Versión 2 (aprobada, 2026-10-08)

- Integra las respuestas del usuario: "Apruebo tus sugerencias", es decir, las opciones recomendadas de las preguntas 1 a 11, con P-1 a P-5.
- Añade el requisito de la interfaz `ChatBot`, con `WhatsAppBot` y `TwilioBot` intercambiables (RF-1, HU-4, CA-17 a CA-21).
- Añade la precisión PR-1, que queda en D-5 y CA-11: producción con `twilio` no arranca aunque el bot esté deshabilitado.
- Aprobada por el usuario: "apruebo REQ-F-012 v2".

### Revisión técnica (2026-10-08)

- `senior-fullstack` añade la revisión técnica y el Technical Action Plan (DT-1 a DT-12): `ChatBot` como adaptador del proveedor, el orquestador renombrado a `BotOrchestrator`, `CloudApiClient` como detalle interno de `WhatsAppBot`, 405 para un `GET` con Twilio y sin dependencias nuevas. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (2026-10-08)

- Aprobación del plan técnico por el usuario: "apruebo el plan técnico y autorizo actualizar el agente".
- `senior-fullstack` implementa el plan en la rama `feature/REQ-F-012-bot-whatsapp-hibrido-meta-twilio`, con el ticket en `in-progress/`. `typecheck`, `lint` y `npm test` en verde; Docker no disponible; CA-16 pendiente.
- El agente no se actualizó: el texto queda propuesto en el informe.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, plan (2026-10-08)

- Aprobación de la implementación por el usuario: "apruebo la implementación y aplica el texto del agente".
- `senior-qa` añade el QA Action Plan: trazabilidad de CA-1 a CA-21, CA-7b, CA-12b y CA-15b; regresión de Meta y de las landings; configuración con arranque real; seguridad de la firma; privacidad de los logs; intercambiabilidad y documentación. CA-16 queda BLOCKED por prerrequisitos del usuario. Si Docker no está disponible, se registra como bloqueo de entorno y queda pendiente del CI. Estado: `NEEDS_QA_PLAN_APPROVAL`.

### QA, ronda 1 (2026-10-08)

- Aprobación del QA Action Plan por el usuario: "apruebo el plan de QA, sí a las 4". Docker queda pendiente del CI, CA-16 queda pendiente y se autorizan las pruebas QA nuevas.
- `senior-qa` ejecuta el plan:
  - añade 27 pruebas QA en 2 archivos;
  - `typecheck`, `lint` y `npm test` pasan (1085 pruebas y 1 `expected fail` ya existente);
  - no encuentra defectos.
- CA-16 y Docker quedan pendientes, aceptados por el usuario. Estado: `QA_APPROVED`.
