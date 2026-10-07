# REQ-F-009 — Bot de WhatsApp compartido para Molotes y Birria El Muñeco

## Estado

DONE (2026-10-07; PR #30 mergeado en `main`, commit de merge `1c5c43e`)

Pull Request: https://github.com/orvigas/negocio/pull/30 (CI del commit `ff91243`: `calidad` y `docker` en verde; CI del push a `main` de `1c5c43e`: `calidad` y `docker` en verde).

Seguimiento pendiente: CA-26 (prueba de punta a punta con Meta real, incluida la longitud que acepta la plantilla del aviso al personal) queda pendiente de los prerrequisitos de Meta que provee el usuario.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-03). Citas textuales:

- respuestas a las preguntas de clarificación: "recomendadas, aun no tengo el número del bot ni la cuenta de meta";
- aprobación del borrador: "apruebo 010 y 009 con P-11 A".

Otras respuestas del usuario que dan forma al ticket (citas textuales):

- sobre si existe el bot: "aún no existe el bot, será uno compartido y tendra el mismo comportamiento que las landing page dependiendo el día de la semana";
- sobre conversiones: "apruebo todo" (9.4 A).

Las propuestas P-1 a P-11 forman parte de la versión aprobada. P-11 se aprobó en su opción A.

Origen: trabajo aparte listado en REQ-F-004 ("Integración del bot de WhatsApp").

## Objetivo

Construir **un solo bot de WhatsApp** dentro de la app Koa, conectado a la WhatsApp Cloud API oficial de Meta. El bot:

- elige Molotes o Birria El Muñeco con la misma regla de día y zona horaria que las landings;
- muestra el menú del día a partir del catálogo de REQ-F-008;
- guía al cliente para armar su pedido;
- envía el resumen confirmado por WhatsApp al número del personal de ese negocio.

No hay pago, ni panel de pedidos, ni pedidos guardados.

## Decisiones confirmadas por el usuario

- **C-1.** El bot todavía no existe: hay que construirlo.
- **C-2.** Es un solo bot para ambos negocios.
- **C-3.** Se comporta como las landings según el día de la semana (CLAUDE.md §5 y §11).
- **D-1 (1A).** Vive dentro de la app Koa como webhook.
- **D-2 (2A).** Usa la WhatsApp Cloud API oficial de Meta. El usuario aún no tiene número ni cuenta (ver "Prerrequisitos").
- **D-3 (3A).** Hace un pedido guiado y envía el resumen al número del personal de cada negocio. En cualquier momento el cliente puede pedir hablar con una persona.
- **D-4 (4A).** El negocio se fija con el primer mensaje. Se mantiene hasta que el pedido se confirma o se cancela, o tras 2 h sin actividad.
- **D-5 (5A).** El bot responde a cualquier hora. Fuera de horario muestra el menú y avisa que el pedido se atenderá cuando abra el negocio, con la excepción de D-16 (P-11).
- **D-6 (choque 4).** Se mantienen `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA`. Las dos llevan el número del bot y conservan su propio mensaje inicial. El botón de las landings no cambia.
- **D-7 (9.3 reconsiderada).** No se guardan pedidos. No hay panel, ni estados, ni pago en línea.
- **D-8 (9.4 A).** No se miden conversiones.
- **D-9 (P-1).** Se interactúa con texto: números de opción o palabras clave. Las listas y botones interactivos de WhatsApp son una mejora opcional. Si se usan, la respuesta por texto debe seguir funcionando.
- **D-10 (P-2).** Las palabras clave "menú", "carrito", "cancelar", "persona" y "ayuda" funcionan en cualquier momento, sin distinguir mayúsculas ni acentos.
- **D-11 (P-3).** El estado de la conversación vive en memoria, porque hay una sola instancia, igual que las sesiones de `/admin`. Si la app se reinicia, la conversación en curso se pierde y el bot pide empezar de nuevo.
- **D-12 (P-4).** Límites del pedido:
  - de 1 a 20 unidades por línea;
  - hasta 15 líneas por pedido;
  - nombre de 1 a 60 caracteres;
  - dirección de 5 a 200 caracteres;
  - notas de hasta 200 caracteres.
- **D-13 (P-5).** Antes de pedir la confirmación, el bot vuelve a comprobar precios y disponibilidad. Si algo cambió, lo avisa y actualiza el resumen antes de confirmar.
- **D-14 (P-6).** El bot no calcula costos ni zonas de envío. Avisa que el personal confirmará el costo del envío.
- **D-15 (P-7).** A los mensajes que no son texto (audio, imagen, sticker, ubicación o contacto), el bot responde que solo entiende texto y repite las opciones del paso actual.
- **D-16 (P-11, opción A). Excepción a D-5.** Fuera de horario, el bot solo acepta el pedido si el negocio de la conversación abre ese mismo día o al día siguiente. Si no (Molotes el viernes después de las 15:00; Birria el domingo después de las 15:00), el bot:
  - muestra el menú;
  - informa cuándo abre su negocio y cuándo abre el otro;
  - ofrece "hablar con una persona";
  - **no toma el pedido**.
- **D-17 (P-8). Privacidad.** Antes de pedir el nombre y la dirección, el bot avisa que se usarán solo para preparar y entregar el pedido. Al cerrar la conversación no se conservan.
- **D-18 (P-9).** Si falla el envío al personal, el bot avisa al cliente y le da el contacto directo del personal de ese negocio. El fallo se registra en el log sin datos personales.
- **D-19 (P-10).** Cada resumen lleva un código corto de referencia (por ejemplo, `M-4F7K`). El código no se guarda.

## Alcance

- Webhook de Meta: verificación de la suscripción y recepción de mensajes.
- Envío de mensajes con la Cloud API.
- Conversación:
  - selección del negocio;
  - flujo de la conversación;
  - carrito;
  - datos del cliente;
  - resumen y confirmación;
  - envío al personal.
- Lectura del catálogo de REQ-F-008 y de la fuente de horarios de REQ-F-010.
- Configuración por variables de entorno, con validación al arrancar.
- Doble de la Cloud API para las pruebas.
- Documentación: README con la guía de configuración en Meta, `.env.example` y pruebas.

## Fuera de alcance

- Pago en línea.
- Guardar pedidos, panel de pedidos y estados de pedido.
- Medir conversiones.
- Costos y zonas de envío.
- Aplicar promociones o descuentos.
- Lenguaje natural libre o IA.
- Mensajes multimedia.
- Campañas o mensajes de marketing que envíe el negocio por su cuenta.
- Editar los textos del bot desde `/admin`.
- Varias instancias del servidor.
- Uber Eats y Rappi.
- Otros idiomas.

## Requisitos

### RF-1 Webhook

1. Responde a la verificación de suscripción de Meta solo si el token de verificación coincide. Si no coincide, responde 403.
2. Solo procesa mensajes con una firma válida, calculada con el secreto de la app. Si la firma falta o no es válida, responde 401 o 403, no procesa el mensaje y lo registra en el log.
3. Responde enseguida con 200 a las entregas válidas.
4. Una entrega repetida del mismo mensaje (un reintento de Meta) se procesa una sola vez.
5. Las notificaciones de estado (entregado, leído) se aceptan y se ignoran.

### RF-2 Configuración

1. Se configuran por variables de entorno:
   - las credenciales de la Cloud API;
   - el número del bot;
   - el secreto de la app;
   - el token de verificación;
   - el número del personal de cada negocio.

   Los nombres de las variables los decide `senior-fullstack`.
2. Si no se configura **ninguna**, el bot queda deshabilitado: el webhook responde 503 y las landings siguen funcionando.
3. Si la configuración está incompleta o no es válida, el arranque falla y muestra la lista de problemas sin mostrar valores, con el mismo criterio que REQ-F-001 DT-7.
4. Ningún secreto aparece en los logs ni en las respuestas.

### RF-3 Selección del negocio (C-3, D-4)

1. Usa la misma regla y el mismo servicio que las landings, con `BUSINESS_TIMEZONE`.
2. El negocio se fija con el primer mensaje de una conversación nueva y se mantiene según D-4.
3. El mensaje inicial que llega desde una landing no cambia el negocio.
4. Si el cliente pide el otro negocio, el bot le indica sus días de servicio y no toma ese pedido.

### RF-4 Flujo de conversación (D-3)

1. **Saludo.** El bot saluda con el nombre del negocio del día y ofrece estas opciones:
   - ver el menú;
   - hacer un pedido;
   - horario y ubicación (tomados del contenido del negocio);
   - hablar con una persona.
2. **Menú.** Muestra los productos activos y disponibles, por categoría y con su precio. Aplica las mismas reglas de visibilidad que la landing (REQ-F-008 RF-4):
   - solo las variantes disponibles;
   - se ocultan los productos sin variantes disponibles;
   - las bebidas de Molotes van en su propia sección.
3. **Agregar un producto.** El cliente elige el producto, luego la variante (Birria) o la presentación por pieza u orden (Molotes, si tiene precio por orden), y luego la cantidad. Puede ver el carrito, quitar productos y vaciarlo.
4. **Cierre del pedido.** El bot muestra el aviso de privacidad (D-17) y después pide:
   - el nombre;
   - si es para recoger o a domicilio;
   - la dirección, si es a domicilio;
   - notas opcionales.
5. **Resumen.** Incluye:
   - el código de referencia;
   - el negocio;
   - las líneas, cada una con cantidad, producto, variante o presentación, precio unitario y subtotal;
   - el total;
   - la forma de entrega;
   - los datos del cliente;
   - el aviso de fuera de horario, si aplica.

   El bot pide confirmar o cancelar.
6. **Confirmación.** Al confirmar, el resumen se envía al personal. El cliente recibe la confirmación con el código y la conversación se cierra.
7. **"Cancelar"** descarta el pedido y cierra la conversación.
8. **"Persona"** da el contacto del personal del negocio de la conversación.
9. **Texto no reconocido.** El bot responde con una ayuda breve y las opciones del paso actual.

### RF-5 Catálogo

1. El catálogo se lee del repositorio de REQ-F-008.
2. Si la base de datos no está disponible con la app en marcha, se usan los últimos productos válidos que hay en memoria (REQ-F-008 D-15).
3. Si no hay ningún producto disponible, el bot lo dice y ofrece hablar con una persona.

### RF-6 Horario (D-5, D-16)

1. El bot usa la fuente estructurada de horarios de REQ-F-010 y no define horarios propios:
   - Molotes: de martes a viernes, de 08:30 a 15:00;
   - Birria El Muñeco: sábado y domingo, de 08:00 a 15:00.
2. Fuera de horario, el bot avisa al saludar cuándo abre el negocio. El cliente puede ver el menú y hacer el pedido, salvo en lo indicado en D-16. El resumen para el cliente y para el personal lleva la marca "fuera de horario".
3. El lunes el bot atiende como Molotes, porque la regla de días no cambia (REQ-F-010 D-2). Todo el lunes cuenta como fuera de horario: el bot avisa que abre el martes a las 08:30 y aplica RF-6.2.
4. **D-16.** Si el negocio de la conversación no abre ni ese día ni el siguiente, el bot:
   - no toma el pedido;
   - informa cuándo abre su negocio y cuándo abre el otro;
   - ofrece hablar con una persona.

### RF-7 Envío al personal

1. El resumen se envía al número del personal del negocio de la conversación. Si la ventana de 24 h de WhatsApp lo exige, se envía con una plantilla aprobada.
2. Si el envío falla, se aplica D-18.
3. Se reintenta como máximo una vez y nunca se duplica el envío al personal.

### RF-8 Fallos de Meta

Si la Cloud API no responde o devuelve un error, el fallo se registra sin datos personales y la app sigue funcionando. Las landings no se ven afectadas.

### RF-9 Logs y privacidad

1. Se registran estos eventos:
   - conversación iniciada;
   - pedido confirmado;
   - pedido cancelado;
   - envío fallido al personal;
   - firma inválida;
   - error de la API.
2. El número del cliente se registra enmascarado. El nombre, la dirección y las notas nunca se registran.
3. Los datos de la conversación se borran de memoria al cerrarla o cuando caduca.

### RF-10 Landings

Las landings no cambian (D-6). Su botón abre el chat del número del bot con el mensaje inicial de cada negocio.

### RF-11 Pruebas

1. Ninguna prueba llama a Meta.
2. Se usa un doble de la Cloud API, con ejemplos de las entregas reales del webhook.
3. El reloj se controla en las pruebas para cubrir los días de la semana, la medianoche y los horarios.

### RF-12 Documentación

El README explica:

- los prerrequisitos;
- las variables de entorno;
- cómo registrar la URL del webhook y el token de verificación;
- la plantilla del aviso al personal;
- cómo probar el bot en local con el doble.

## Prerrequisitos para la QA de punta a punta (los provee el usuario)

No hacen falta para especificar ni para implementar, porque las pruebas usan el doble. **Sí bloquean la QA de punta a punta (CA-26) y la puesta en producción.**

1. Cuenta de Meta Business, verificada si Meta lo pide por volumen o por las plantillas.
2. App en Meta for Developers con el producto WhatsApp y una cuenta de WhatsApp Business (WABA).
3. Número dedicado al bot, registrado en la Cloud API y que no esté en uso en la app de WhatsApp.
4. Token de acceso permanente (de un usuario del sistema), el ID del número y el ID de la WABA.
5. El secreto de la app, para validar la firma.
6. URL pública con HTTPS para el webhook (el dominio de la VM con nginx), registrada en Meta con el token de verificación y suscrita al campo `messages`.
7. Plantilla aprobada para el aviso al personal.
8. Método de pago en Meta para las conversaciones que cobra.
9. Números de WhatsApp del personal de Molotes y de Birria.

## Historias de usuario

- **HU-1.** **Como** cliente **quiero** ver por WhatsApp el menú del negocio del día con sus precios **para** decidir qué pedir.
- **HU-2.** **Como** cliente **quiero** armar mi pedido en la conversación y confirmarlo **para** no tener que escribirlo a mano.
- **HU-3.** **Como** cliente **quiero** hablar con una persona cuando lo necesite.
- **HU-4.** **Como** personal **quiero** recibir cada pedido confirmado con un resumen claro **para** prepararlo.
- **HU-5.** **Como** dueño **quiero** que el bot nunca ofrezca productos ocultos o del otro negocio.

## Reglas de negocio

- **RN-1.** El negocio del bot es el del día en `BUSINESS_TIMEZONE`, igual que en las landings, y se mantiene durante la conversación (D-4).
- **RN-2.** Solo se ofrecen productos activos y disponibles del negocio de la conversación.
- **RN-3.** Ningún pedido llega al personal sin la confirmación explícita del cliente.
- **RN-4.** Un pedido confirmado se envía al personal una sola vez.
- **RN-5.** No se conservan datos personales después de cerrar la conversación.
- **RN-6.** Fuera de horario, el pedido se acepta con un aviso (D-5), salvo lo indicado en D-16 (P-11).

## Criterios de aceptación

### Webhook y configuración

- **CA-1.** Given el token de verificación correcto, When Meta verifica el webhook, Then la app devuelve el reto. Con un token incorrecto, responde 403.
- **CA-2.** Given una entrega sin firma o con una firma inválida, When llega, Then se rechaza, no se responde al cliente y queda en el log.
- **CA-3.** Given la misma entrega repetida dos veces, When llega, Then el cliente recibe una sola respuesta.
- **CA-4.** Given que no hay configuración del bot, When llega un mensaje al webhook, Then responde 503 y las landings responden 200. Given una configuración incompleta, When arranca la app, Then termina con código 1 y muestra la lista de problemas sin valores.

### Selección del negocio

- **CA-5.** Given un martes a las 10:00 en `BUSINESS_TIMEZONE`, When un cliente escribe, Then el bot saluda como Molotes. Given un sábado a las 10:00, Then saluda como Birria El Muñeco.
- **CA-6.** Given un pedido de Molotes iniciado el viernes a las 23:50, When se confirma el sábado a las 00:10, Then sigue siendo de Molotes y llega al personal de Molotes.
  - **Sustituido por CA-6a y CA-6b** (decisión del usuario PT-1 A, 2026-10-06; ver "Revisión técnica"). Con D-16, CA-6 tal como está escrito no puede cumplirse.
- **CA-7.** Given una conversación sin actividad durante 2 h, When el cliente vuelve a escribir, Then empieza una conversación nueva con el negocio de ese momento.
- **CA-8.** Given que el cliente llega un martes desde `/birria`, When escribe, Then el bot atiende como Molotes e indica los días de Birria.

### Menú y pedido

- **CA-9.** Given un producto no disponible o eliminado, When se muestra el menú, Then no aparece. Given un producto de Birria cuya primera variante no está disponible, Then solo se ofrecen las variantes disponibles.
- **CA-10.** Given un carrito con 2 órdenes de "Molotes de Queso Oaxaca" y 1 bebida, When se pide el resumen, Then las líneas, los subtotales y el total coinciden con el catálogo.
- **CA-11.** Given que cambia el precio de un producto que está en el carrito, When se pide confirmar, Then el bot avisa y muestra el resumen actualizado antes de confirmar (D-13).
- **CA-12.** Given una cantidad de 0, 21 o "abc", o un pedido de 16 líneas, When se envía, Then el bot lo rechaza con un mensaje claro y el carrito no cambia (D-12).
- **CA-13.** Given un pedido a domicilio sin dirección, When se intenta confirmar, Then el bot pide la dirección.

### Envío y opciones del cliente

- **CA-14.** Given un resumen confirmado, When se envía, Then:
  - el doble registra exactamente un mensaje al número del personal de ese negocio, con el código, las líneas, el total, la forma de entrega y los datos del cliente;
  - el cliente recibe la confirmación con el código.
- **CA-15.** Given que falla el envío al personal, When el cliente confirma, Then recibe el aviso de D-18 con el contacto directo, y el log registra el fallo sin datos personales.
- **CA-16.** Given "cancelar" en cualquier paso, When se procesa, Then no se envía nada al personal y la conversación se cierra.
- **CA-17.** Given "persona", When se procesa, Then el cliente recibe el contacto del personal del negocio de la conversación.
- **CA-18.** Given un audio o una imagen, When se procesa, Then el cliente recibe el mensaje de D-15 con las opciones del paso actual.

### Horario y fallos

- **CA-19.** Given una hora fuera de horario, por ejemplo:
  - un miércoles a las 16:00 o a las 07:00 (Molotes);
  - un sábado a las 16:00 (Birria);

  When el cliente escribe, Then el bot avisa cuándo abre el negocio, deja pedir y el resumen lleva la marca "fuera de horario".
- **CA-20.** Given que la base de datos no está disponible con la app en marcha, When se pide el menú, Then el bot muestra los últimos productos válidos. Given que no hay productos disponibles, Then el bot lo dice y ofrece hablar con una persona.

### Privacidad, calidad y documentación

- **CA-21.** Given cualquier flujo, When se revisa el log capturado, Then no contiene tokens, secretos, nombres, direcciones, notas ni números completos de clientes.
- **CA-22.** Given una conversación confirmada o cancelada, When se inspecciona el estado en memoria, Then sus datos ya no están.
- **CA-23.** Las landings y sus snapshots no cambian (RF-10).
- **CA-24.** `typecheck`, `lint`, `npm test`, `docker compose run --rm test` y el CI pasan sin ninguna llamada real a Meta.
- **CA-25.** El README y `.env.example` cumplen RF-12 y listan los prerrequisitos.
- **CA-26 (punta a punta; depende de los prerrequisitos).** Con el número real, un pedido completo de cada negocio llega al número del personal correspondiente.

### Lunes y excepción de D-16

- **CA-27.** Given un lunes a las 10:00 en `BUSINESS_TIMEZONE`, When un cliente escribe, Then el bot:
  - saluda como Molotes;
  - avisa que hoy está cerrado y que abre el martes a las 08:30;
  - deja ver el menú y hacer el pedido;
  - pone en el resumen la marca "fuera de horario".
- **CA-28.** Given un viernes a las 16:00, When un cliente intenta pedir, Then el bot:
  - no toma el pedido;
  - informa que Molotes abre el martes a las 08:30 y que Birria El Muñeco abre el sábado a las 08:00;
  - ofrece hablar con una persona.

  Lo mismo ocurre un domingo a las 16:00 con Birria El Muñeco.

## Casos límite

- La medianoche durante una conversación (CA-6).
- Los cambios de viernes a sábado y de domingo a lunes, y el lunes completo (CA-27).
- Viernes y domingo después de las 15:00 (D-16, CA-28).
- Reintentos de Meta y mensajes que llegan en desorden.
- Dos mensajes muy seguidos del mismo cliente.
- Un reinicio de la app en mitad de un pedido (D-11).
- Un producto que se elimina entre que se agrega al carrito y se confirma el pedido.
- La ventana de 24 h vencida con el número del personal.
- Clientes con números internacionales.
- Textos con emojis o acentos.

## Dependencias

- REQ-F-008: el catálogo.
- REQ-F-010: la fuente estructurada de horarios de los dos negocios y el comportamiento del lunes.
- REQ-F-004, REQ-F-005 y REQ-F-006.
- Los prerrequisitos de Meta, que provee el usuario. Bloquean solo CA-26 y la producción.
- No depende de REQ-F-007: el bot lee el catálogo dentro de la propia app, sin credencial. D-11′ de REQ-F-008 (la API no tiene lectura pública) se mantiene.

## Riesgos

- Costos y políticas de Meta: plantillas, verificación y límites de mensajes.
- Puede que el número no se pueda usar a la vez en la app de WhatsApp.
- Al recoger nombre y dirección se aplica la LFPDPPP. El footer menciona un "Aviso de Privacidad" que no tiene enlace. Se recomienda que el negocio lo publique.
- Con el estado en memoria, un reinicio pierde los pedidos en curso (D-11, aceptado).
- Si el personal no atiende su WhatsApp, el pedido se pierde, porque no se guarda (D-7).

## Action Plan

### Objetivo

Un cliente pide por WhatsApp al negocio del día y el personal recibe el pedido listo para prepararlo.

### Alcance

Ver la sección "Alcance".

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Configuración y validación (RF-2).
2. Webhook: verificación, firma, idempotencia y doble de la Cloud API (RF-1, RF-11).
3. Cliente de envío de la Cloud API (RF-7, RF-8).
4. Máquina de estados de la conversación, con la selección del negocio (RF-3, RF-4).
5. Lectura del catálogo y del horario, incluida la excepción D-16 (RF-5, RF-6).
6. Resumen y envío al personal (RF-7).
7. Logs y privacidad (RF-9).
8. Pruebas CA-1 a CA-25, CA-27 y CA-28.
9. Documentación (RF-12).
10. QA de punta a punta cuando estén los prerrequisitos (CA-26).

### Reglas de negocio

RN-1 a RN-6.

### UX/UI

Solo conversacional:

- mensajes breves;
- opciones numeradas;
- textos de cada negocio en su propio contenido (CLAUDE.md §7).

No hay cambios en las landings ni en `_stich_source_/`.

### Integraciones

WhatsApp Cloud API de Meta.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-28.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

Después de REQ-F-008 y de REQ-F-010.

### Resultado esperado

Un cliente pide por WhatsApp al negocio del día y el personal recibe el pedido listo para prepararlo, con horarios coherentes con la landing.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
| --- | --- | --- | --- |
| Bot seguro y configurable | RF-1, RF-2 | — | CA-1 a CA-4, CA-21 |
| Negocio del día | RF-3, RN-1 | HU-1 | CA-5 a CA-8 |
| Menú y pedido | RF-4, RF-5, D-12, D-13 | HU-1, HU-2, HU-5 | CA-9 a CA-13, CA-16 a CA-18, CA-20 |
| Envío al personal | RF-7, RN-3, RN-4 | HU-4 | CA-14, CA-15, CA-26 |
| Horario | RF-6, D-16, RN-6 | HU-1 | CA-19, CA-27, CA-28 |
| Privacidad y calidad | RF-9 a RF-12 | — | CA-21 a CA-25 |

No hay diseño en `_stich_source_/` para el bot, que es solo conversacional.

## Revisión técnica

Revisión T1 de `senior-fullstack` (2026-10-06) sobre `main` (8006984). Se revisaron CLAUDE.md, `.claude/rules/`, este ticket y el código afectado: `src/app.ts`, `src/server.ts`, `src/routes/index.ts`, `src/config/env.ts`, `src/services/{business-schedule,whatsapp,visible-menu,price,session-store,login-throttle,admin-auth}.ts`, `src/content/{hours,molotes/hours,birria/hours,molotes/index,common/index}.ts`, `src/repositories/product-repository.ts`, `src/utils/{form-body,json-body,logger,datetime}.ts`, `src/middleware/{request-logger,error-handler,admin-guard}.ts`, `tests/support/{http,products}.ts`, `.env.example` y el README. No hay impacto visual (no aplica `_stich_source_/`).

Conclusión: el ticket es implementable con el stack actual, **sin dependencias nuevas** ni persistencia nueva. Hay **una contradicción** entre criterios (PT-1) y tres decisiones de comportamiento que conviene que confirme el usuario (PT-2 a PT-4). El resto son decisiones técnicas que se proponen en el Technical Action Plan de abajo.

**Decisiones del usuario (2026-10-06).** Cita textual: "Recomendadas en PT-1 a PT-4 y autorizo actualizar senior-fullstack.md". Quedan PT-1 A, PT-2 A, PT-3 A y PT-4 A, y se autoriza actualizar la definición del agente (ver "Documentación del agente" en el Technical Action Plan).

### Verificación con la documentación oficial de Meta (consultada el 2026-10-06)

| Tema | Lo que dice Meta | Consecuencia en el diseño |
| --- | --- | --- |
| Versión de Graph API | v26.0 (29-07-2026) es la vigente; v25.0 hasta 07-2028. Los ejemplos de la Cloud API usan v26.0. | Versión por defecto `v26.0`, configurable. |
| Verificación del webhook | `GET` con `hub.mode=subscribe`, `hub.challenge` y `hub.verify_token`. Hay que comprobar el token y devolver `hub.challenge`. | `GET /webhooks/whatsapp`: compara en tiempo constante y responde el reto como `text/plain`. Si no coincide, 403. |
| Firma | `X-Hub-Signature-256: sha256=<hex>`: HMAC-SHA256 del cuerpo con el App Secret. | Hay que leer el **cuerpo crudo** antes de parsearlo. Ya existe `readRawBody` (`src/utils/form-body.ts`) y la app no tiene un parser de body global. |
| Tamaño y reintentos | Un webhook puede pesar hasta 3 MB. Cualquier respuesta distinta de 200 se reintenta durante un máximo de **7 días**, y Meta avisa de que puede haber duplicados. | Límite de lectura de 3 MiB. Hay que deduplicar por `id` de mensaje y responder 200 enseguida. Los mensajes viejos se tratan según PT-4. |
| Payload | `object: "whatsapp_business_account"` → `entry[].changes[]` con `field: "messages"`. `value.metadata.phone_number_id`, `value.messages[]` (`from`, `id` = `wamid…`, `timestamp` en segundos (string), `type`, `text.body`) y `value.statuses[]` (`id`, `status`, `recipient_id`, `errors`). | Validador propio y estricto (`unknown` → tipos). Se ignora cualquier entrega de otro `phone_number_id`. |
| Envío | `POST https://graph.facebook.com/<ver>/<PHONE_NUMBER_ID>/messages`, `Authorization: Bearer <token>`. Texto: `type: "text"`, `text.body` de hasta 4096 caracteres. Plantilla: `type: "template"`. | Cliente con `fetch` nativo y `AbortSignal.timeout`. Los mensajes largos se parten en trozos de hasta 4096 caracteres. |
| Ventana de 24 h | Los mensajes que no son de plantilla solo se pueden enviar con la ventana de servicio abierta, es decir, en las 24 h posteriores al último mensaje del usuario. Fuera de ella el error es 131047. Las plantillas **utility** enviadas con la ventana abierta son gratuitas desde el 01-07-2025. | Las respuestas al cliente van siempre dentro de su ventana, porque el cliente acaba de escribir. Al personal se le escribe **siempre con plantilla** (decisión DT-6). |
| Interactivos | Listas: un botón de hasta 20 caracteres, hasta 10 secciones y **10 filas en total**, títulos de fila de hasta 24 caracteres, descripciones de hasta 72 e id de hasta 200; cuerpo de hasta 4096 caracteres. Botones de respuesta: hasta 3, con etiqueta de hasta 20 caracteres y cuerpo de hasta 1024. | Un menú de hasta 50 productos activos (`MAX_ACTIVE_PRODUCTS`) no cabe en una lista: habría que paginar en bloques de 10. Ver DT-11. |
| Errores | Formato `{ error: { code, message, error_data.details, fbtrace_id } }`. Códigos relevantes: 130429 (límite de envío), 131056 (demasiados mensajes al mismo número), 131047 (ventana de 24 h), 132000/132001/132018 (plantilla). | Solo se registran `status` y `error.code` (números), nunca `message` ni `details`, porque pueden llevar datos. |

No se pudo comprobar en las páginas consultadas el límite de longitud de los **parámetros** de plantilla ni la regla de que un parámetro no puede contener saltos de línea, tabuladores ni más de 4 espacios seguidos (error 132018). Son comportamientos conocidos de la API, así que el diseño los respeta por precaución (DT-6). Se confirmarán en CA-26.

### PT-1 (bloqueante). CA-6 es imposible con D-16 / CA-28

- **Problema.** CA-6 pide un pedido de Molotes **iniciado el viernes a las 23:50** y confirmado el sábado a las 00:10. Con D-16, el viernes después de las 15:00 Molotes **no toma pedidos**, porque no abre ni ese día ni el siguiente (CA-28). El negocio solo cambia a medianoche del viernes al sábado y del domingo al lunes, y en las dos medianoches el negocio saliente ya cerró su último día de servicio. Por eso, con D-16 **nunca** puede confirmarse un pedido que cruce un cambio de negocio. Las conversaciones duran como máximo 2 h sin actividad (D-4).
- **Requisitos afectados.** CA-6 frente a D-16, RF-6.4 y CA-28.
- **Impacto.** No se puede escribir una prueba de CA-6 que pase sin incumplir CA-28. La intención de CA-6 (el negocio se fija con el primer mensaje y no cambia a medianoche, RF-3.2) sí se puede probar.
- **Alternativas.**
  - **A (recomendada). Reformular CA-6 en dos casos que conservan su intención:**
    - **CA-6a.** Given una conversación de Molotes iniciada el **lunes a las 23:50** (fuera de horario; D-16 deja pedir porque abre el martes), When se confirma el martes a las 00:10, Then es de Molotes, llega al personal de Molotes y lleva la marca "fuera de horario".
    - **CA-6b.** Given una conversación de Molotes iniciada el **viernes a las 23:50**, When el cliente escribe "menú" el sábado a las 00:10, Then el bot sigue mostrando el menú de **Molotes**, no el de Birria. Si intenta pedir, se aplica D-16. Lo mismo ocurre con Birria entre el domingo a las 23:50 y el lunes a las 00:10.
  - **B.** Eliminar CA-6 y dejar la regla de medianoche cubierta solo por RF-3.2.
- **Decisión del usuario (2026-10-06): opción A.** **CA-6 se sustituye por CA-6a y CA-6b**, con el texto de la opción A. Las pruebas y el QA verifican CA-6a y CA-6b en lugar de CA-6.

### PT-2. Cuándo se evalúa D-16 y la marca "fuera de horario"

- **Problema.** D-16 dice que el bot "no toma el pedido", pero no dice en qué momento se comprueba. Una conversación puede empezar a las 14:55 del viernes, cuando Molotes está abierto, y confirmarse a las 15:05.
- **Alternativas.**
  - **A (recomendada). Se comprueba al empezar el pedido**, es decir, al elegir "hacer un pedido" o al agregar el primer producto. Un pedido empezado mientras se podía pedir se acepta aunque se confirme después. La marca "fuera de horario" se calcula al mostrar el resumen y al confirmar. El personal recibe la marca y decide. Se frustra menos al cliente y D-16 sigue evitando pedidos para dentro de varios días.
  - **B. Se comprueba al empezar y otra vez al confirmar.** Si al confirmar ya no se cumple, el bot no toma el pedido (mensaje de D-16). Es más estricto, pero el cliente puede perder el carrito por unos minutos.
- Ver el menú está permitido siempre, en los dos casos.
- **Decisión del usuario (2026-10-06): opción A.** D-16 se comprueba **solo al empezar el pedido**. La marca "fuera de horario" se calcula al mostrar el resumen y al confirmar.

### PT-3. Fallo del aviso al personal que llega después, en un estado `failed`

- **Problema.** La Cloud API puede aceptar el envío (200 con un `wamid`) y avisar del fallo más tarde, en una notificación de estado `failed`. Pasa, por ejemplo, si la plantilla está pausada o el número del personal no está en WhatsApp. A esas alturas el cliente ya recibió "pedido confirmado" y la conversación se borró (RN-5). RF-1.5 pide ignorar los estados.
- **Alternativas.**
  - **A (recomendada).** Respetar RF-1.5 y RN-5. Para el flujo, el estado se ignora. Solo se registra `bot_staff_delivery_failed` con el negocio y el código de error, sin datos personales. Para relacionarlo, se guarda un mapa acotado `wamid → negocio` durante 24 h, sin teléfonos. El riesgo es que, en ese caso, el cliente no se entere. Se documenta en el README como algo que hay que vigilar en los logs.
  - **B.** Conservar el número del cliente y el código hasta 1 h después de cerrar, para avisarle con el mensaje de D-18 si llega el `failed`. Es más robusto, pero contradice RF-1.5 y RN-5 (datos personales tras el cierre).
- **Decisión del usuario (2026-10-06): opción A.** Solo se registra `bot_staff_delivery_failed`, sin teléfonos. Riesgo aceptado: en ese caso el pedido puede perderse sin que nadie avise, salvo que se revise el log.

### PT-4. Mensajes viejos que Meta reentrega tras una caída

- **Problema.** Meta reintenta durante 7 días. Si la app estuvo caída, al volver llegarían mensajes de hace horas o días, y los ids ya vistos se pierden con el reinicio (D-11).
- **Alternativas.**
  - **A (recomendada).** Ignorar sin responder los mensajes con un `timestamp` de hace **más de 2 h**, el mismo plazo de D-4, y registrarlos como `bot_message_stale`, sin el texto ni el número completo. Así se evita contestar "Hola, ¿qué deseas?" a un mensaje de ayer y se evitan los envíos fuera de la ventana de 24 h.
  - **B.** Responder siempre, sea cual sea su antigüedad.
- **Decisión del usuario (2026-10-06): opción A.** Los mensajes de más de 2 h se ignoran y se registran como `bot_message_stale`.

## Technical Action Plan

> Incorpora las decisiones del usuario del 2026-10-06: PT-1 A, PT-2 A, PT-3 A y PT-4 A.

### Objetivo técnico

Montar dentro de la app Koa un webhook de la WhatsApp Cloud API que:

- verifique la suscripción y la firma;
- deduplique y responda 200 enseguida;
- procese los mensajes en segundo plano, en orden y uno a la vez por cliente;
- lleve una conversación guiada en memoria sobre el catálogo en caché (REQ-F-008) y el horario estructurado (REQ-F-010);
- envíe una sola vez el resumen confirmado al personal del negocio fijado en la conversación.

Todo se prueba contra un doble de la Cloud API, sin dependencias nuevas.

### Decisiones técnicas

- **DT-1. Ruta y montaje.**
  - `GET` y `POST /webhooks/whatsapp`, en el router principal (`src/routes/index.ts`) y fuera de `/admin`: no pasan por `adminGate`, ni por la sesión, ni por CSRF. La autenticidad la da la firma.
  - `helmet` se mantiene, porque sus cabeceras no afectan a Meta. `koa-static` deja pasar la ruta porque no existe ese archivo.
  - `request-logger` ya registra solo `path`, sin la query, así que `hub.verify_token` nunca llega al log.
  - Otros métodos devuelven 405 (`allowedMethods`) con el formato centralizado.
- **DT-2. Verificación (RF-1.1, CA-1).**
  - Hace falta `hub.mode === 'subscribe'`, y `hub.verify_token` se compara con `safeEqualStrings` (ya existe en `admin-auth.ts`).
  - `hub.challenge` solo se devuelve si cumple `^[A-Za-z0-9_-]{1,128}$`, como `text/plain`. En cualquier otro caso, 403.
- **DT-3. Recepción (RF-1.2 a RF-1.5, CA-2, CA-3).** El orden es este:
  1. Bot deshabilitado → 503 `{ error: { code: 'BOT_DISABLED' } }`.
  2. Cuerpo crudo con `readRawBody` y un límite de 3 MiB (413 si se pasa).
  3. Sin cabecera, o con una cabecera que no sea `sha256=<64 hex>` → **401**. HMAC distinto (comparado con `timingSafeEqual`) → **403**. Las dos se registran como `bot_webhook_signature_invalid { reason }`, no se procesan y no se responde al cliente.
  4. JSON y UTF-8 inválidos con la firma válida → 400.
  5. Payload de otro `object`, `field` o `phone_number_id` → 200 sin procesar (`bot_webhook_ignored`).
  6. Los `statuses` se ignoran en el flujo (PT-3 A).
  7. Se responde **200 sin esperar** el procesamiento. Los mensajes se encolan en el bot, que atrapa sus propios errores.
- **DT-4. Idempotencia y orden.**
  - Conjunto acotado de `wamid` ya vistos, con una caducidad de 3 h (mayor que el corte de PT-4) y un tope de 10 000 entradas que descarta primero las más antiguas (el patrón de `session-store` y `login-throttle`). Un `wamid` repetido no se procesa (CA-3).
  - Cola por cliente: una cadena de promesas por `wa_id`, que se borra al vaciarse. Así, dos mensajes muy seguidos se procesan uno tras otro.
  - Dentro de una entrega, los mensajes se ordenan por `timestamp`. Un mensaje con un `timestamp` anterior al último procesado de esa conversación se descarta (`bot_message_out_of_order`). El cliente ya tiene el aviso del paso actual.
  - Mensajes con un `timestamp` de hace más de 2 h: se ignoran sin responder y se registran como `bot_message_stale` (PT-4 A).
- **DT-5. Estado de la conversación (D-4, D-11, RF-9.3, CA-7, CA-22).**
  - `Map<wa_id, Conversation>` en memoria, con caducidad por 2 h de inactividad y limpieza perezosa en cada acceso, igual que `session-store`.
  - Tope de 1000 conversaciones, que descarta la menos reciente y lo registra.
  - Al confirmar, al cancelar o al caducar, la entrada se **borra** (nombre, dirección, notas y carrito).
  - Cada conversación tiene un `conversationId` aleatorio (8 caracteres hexadecimales) para relacionar sus entradas del log.
  - Una conversación guarda el negocio, el paso, el carrito, los datos de entrega, la numeración del último menú mostrado, el último `timestamp` y `lastSeen`.
- **DT-6. Aviso al personal: siempre con plantilla (RF-7.1, RN-4).**
  - El número del personal casi nunca tiene la ventana de 24 h abierta con el bot, porque no le escribe. Además, un texto libre fuera de la ventana no falla de forma síncrona: el fallo llega después, en un estado.
  - Intentar primero con texto y después con plantilla podría **duplicar** el aviso. Por eso se usa **siempre** una plantilla utility. Es gratuita si la ventana está abierta y, si no, es la única opción válida.
  - La plantilla tiene **solo cuerpo**, con **parámetros con nombre**: `codigo`, `negocio`, `horario` ("En horario" o "FUERA DE HORARIO, abre <día> <hora>"), `cliente`, `whatsapp` (`+<wa_id>`, para que el personal pueda contactar al cliente), `entrega` ("Recoger en sucursal" o "A domicilio: <dirección>"), `lineas`, `total` y `notas` ("Sin notas" si no hay).
  - Los saltos de línea van en el texto fijo de la plantilla. Cada parámetro se sanea: sin `\r`, `\n` ni `\t`, sin espacios repetidos y nunca vacío.
  - Las líneas se unen con `; `, en el formato `2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260`.
  - El README trae el texto exacto de la plantilla, su categoría (Utility), el idioma `es_MX` y los ejemplos de cada parámetro.
- **DT-7. Cliente de la Cloud API (RF-7.3, RF-8).**
  - `fetch` inyectable (en las pruebas, el doble) con `AbortSignal.timeout(10 s)`.
  - **Un solo reintento**, tras 1 s (inyectable), y solo cuando hay **certeza** de que Meta no aceptó el mensaje:
    - respuesta HTTP 429 o 5xx;
    - error de conexión **antes** de enviar (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN` o `UND_ERR_CONNECT_TIMEOUT`).
  - **Nunca** se reintenta después de un timeout de respuesta ni de `ECONNRESET`, porque el mensaje pudo llegar. Eso daría un envío duplicado, y "nunca se duplica" (RF-7.3) prevalece sobre el reintento.
  - Además, la conversación pasa a `sending` antes de enviar, así que un segundo "confirmar" se ignora.
  - Los errores se registran solo con `status`, `error.code` y el tipo de fallo. El token va solo en la cabecera y nunca en una URL ni en un log.
- **DT-8. Selección de negocio y horario (RF-3, RF-6, D-16, CA-5, CA-8, CA-19, CA-27, CA-28).**
  - Negocio: `getActiveBusinessId({ now, timeZone: config.timezone })` con el primer mensaje.
  - Funciones nuevas puras en `src/services/whatsapp-bot/schedule.ts`, que se apoyan en `getBusinessHours` y en un helper nuevo, `getLocalTime(date, tz)`, en `src/utils/datetime.ts` (reutiliza `wallClock`):
    - `isOpen(business, now, tz)`, para la marca "fuera de horario" en el resumen y al confirmar;
    - `nextOpening(business, now, tz)`, que devuelve el día de la semana y la hora, por ejemplo "el martes a las 08:30" o "hoy a las 08:30";
    - `acceptsOrders(business, now, tz)`, que es `isOpen` **o** que el negocio abra hoy más tarde **o** que abra mañana.
  - **D-16 se comprueba solo al empezar el pedido** (PT-2 A): al elegir "hacer un pedido" o al agregar el primer producto. Si no se cumple, el bot no toma el pedido, informa cuándo abre su negocio y cuándo abre el otro, y ofrece hablar con una persona. Un pedido empezado a tiempo se acepta aunque se confirme después, con la marca si aplica. Ver el menú está permitido siempre.
  - Con eso: el lunes cuenta como fuera de horario y abre el martes (CA-27). El viernes a las 16:00 y el domingo a las 16:00 no se aceptan pedidos (CA-28). El sábado a las 16:00 sí, con la marca (CA-19).
  - Otro negocio (RF-3.4, CA-8): si el primer mensaje, o un texto no reconocido en el saludo o el menú, contiene una palabra clave del **otro** negocio (por ejemplo "birria", "muñeco" o "molote", definidas en su contenido), el bot saluda como el negocio del día y añade los días y el horario del otro, sacados de `BUSINESS_HOURS`.
- **DT-9. Catálogo (RF-5, HU-5, CA-9, CA-20).**
  - El bot lee `products.getPublished(business)`, la caché en memoria, que ya conserva la última versión válida si falla la base de datos (D-15). Nunca consulta la base.
  - Para no duplicar las reglas de visibilidad, `src/services/visible-menu.ts` exporta las funciones de nivel de lista (`visibleMolotesLists` y `visibleBirriaItems`) que ya usa `buildVisibleMenu`. Es una refactorización sin cambio de salida, y los snapshots de las landings lo garantizan (CA-23).
  - Presentaciones:
    - platillos de Molotes: "pieza" (`unitPriceCents`) u "orden de N" (`orderPriceCents`, si es mayor que 0);
    - bebidas de Molotes: precio único, en su propia sección;
    - Birria con variantes: solo las disponibles;
    - Birria con chips o porción: precio propio.
  - Una línea del carrito se identifica por `slug` (no editable ni reutilizable) más la presentación o la etiqueta de la variante.
- **DT-10. Revalidación (D-13, CA-11).** Al pedir el resumen y otra vez al confirmar, cada línea se recalcula contra el catálogo vigente. Las que ya no existen o no están disponibles se quitan, y las que cambiaron de precio se actualizan. Si hubo cambios, el bot los avisa, muestra el resumen actualizado y vuelve a pedir la confirmación. Si el carrito queda vacío, vuelve al menú.
- **DT-11. Interacción solo por texto (D-9).** En esta versión no hay listas ni botones interactivos. Con 50 productos harían falta varias páginas de 10 filas y una doble ruta de entrada, sin que el ticket lo exija. Se usan números de opción y palabras clave. Un menú de más de 4096 caracteres se parte por secciones en varios mensajes. Los productos se numeran de forma continua en todas las secciones, y la numeración se guarda en la conversación. Se puede añadir más adelante sin cambiar la máquina de estados.
- **DT-12. Palabras clave (D-10).**
  - "menú", "carrito", "cancelar", "persona" y "ayuda", más variantes como "menu" o "humano".
  - Solo cuentan si son **el mensaje completo**, normalizado: sin mayúsculas, sin acentos (NFD), sin signos y sin espacios en los extremos. Así no chocan con un nombre o una dirección que contengan esas palabras.
  - Funcionan en cualquier paso, salvo en `sending`.
- **DT-13. Validaciones del pedido (D-12, CA-12, CA-13).**
  - Cantidad: un entero de 1 a 20, solo dígitos.
  - Un producto con la misma presentación se **suma** a su línea, sin pasar de 20.
  - Hasta 15 líneas.
  - Nombre de 1 a 60 caracteres, dirección de 5 a 200 y notas de hasta 200. Se cuentan **puntos de código**, para que los emojis cuenten bien. Los caracteres de control se eliminan.
  - Las notas se omiten con "0" o "no".
  - Si la entrada no es válida, el bot da el motivo y repite el paso, y el carrito no cambia.
  - Antes de confirmar se comprueba que hay dirección si el pedido es a domicilio.
  - El texto entrante se recorta a 1000 caracteres antes de procesarlo.
- **DT-14. Código de referencia (D-19).** Prefijo `M-` o `B-` más 4 caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sin caracteres ambiguos), generados con `crypto.randomInt`. No se guarda.
- **DT-15. Límite por número (riesgo de abuso; recomendado).** Como máximo 20 mensajes por `wa_id` en 60 s. Los que pasen de ahí se ignoran sin respuesta, y se registra un aviso por ventana con el número enmascarado. Se siguen hasta 1000 números, como `login-throttle`. Protege el costo y el límite de envío (131056).
- **DT-16. Privacidad en los logs (RF-9, CA-21).**
  - `maskPhone` deja solo los 4 últimos dígitos (por ejemplo `*********5678`).
  - Eventos: `bot_conversation_started`, `bot_order_confirmed`, `bot_order_cancelled`, `bot_staff_send_failed`, `bot_staff_delivery_failed`, `bot_webhook_signature_invalid`, `bot_api_error`, `bot_message_stale`, `bot_message_out_of_order`, `bot_rate_limited`, `bot_webhook_ignored` y `bot_conversation_evicted`.
  - Campos permitidos: `conversationId`, `business`, el número enmascarado, el número de líneas, `totalCents`, `offHours`, `status` y `errorCode`.
  - Nunca se registran el texto de los mensajes, el nombre, la dirección, las notas, el código de referencia, los tokens ni el `message` o los `details` de Meta.
  - Los errores inesperados del bot se registran solo con `name`.
- **DT-16b. Estados de los mensajes enviados al personal (PT-3 A).** Los `statuses` no cambian el flujo (RF-1.5). Se guarda un mapa acotado `wamid → negocio` de los avisos al personal durante 24 h, sin teléfonos ni datos del pedido. Si llega un `failed` de uno de esos `wamid`, se registra `bot_staff_delivery_failed { business, errorCode }`.
- **DT-17. Contacto con una persona y fallo (RF-4.8, D-18, CA-15, CA-17).** El contacto es el enlace `https://wa.me/<número del personal>`, construido **solo** con `buildWhatsAppLink` de `src/services/whatsapp.ts` (regla del agente).
- **DT-18. Procesamiento asíncrono comprobable.** El bot expone `drain()`, una promesa que se cumple cuando todas las colas están vacías, y una vista de solo lectura del estado (`hasConversation`, `conversationCount`) para CA-22. Las pruebas usan `now` inyectado y `vi.setSystemTime` (RF-11.3).

### Archivos o componentes afectados

Nuevos:

- `src/services/whatsapp-bot/cloud-api.ts`: cliente de envío de texto y plantilla, con su clasificación de errores y el reintento de DT-7.
- `src/services/whatsapp-bot/webhook.ts`: `verifySignature` y `parseDelivery` (validación estricta de `unknown`).
- `src/services/whatsapp-bot/schedule.ts`: `isOpen`, `nextOpening` y `acceptsOrders`.
- `src/services/whatsapp-bot/catalog.ts`: menú del bot, presentaciones y revalidación (D-13).
- `src/services/whatsapp-bot/conversation.ts`: máquina de estados **pura**, `(conversación, entrada, contexto) → { conversación, respuestas, efecto }`. El efecto `notifyStaff` lo ejecuta el orquestador.
- `src/services/whatsapp-bot/messages.ts`: formateo de los textos (menú, carrito, resumen, partición en trozos de 4096).
- `src/services/whatsapp-bot/store.ts`: conversaciones, `wamid` vistos y límite por número.
- `src/services/whatsapp-bot/bot.ts`: orquestador (colas, deduplicación, filtros, envío, aviso al personal, logs y `drain`).
- `src/services/whatsapp-bot/phone.ts`: `maskPhone`.
- `src/controllers/whatsapp-webhook.ts`: `GET` (verificación) y `POST` (recepción).
- `src/content/common/bot.ts`: textos comunes del flujo (opciones, errores, privacidad de D-17, D-14, D-15).
- `src/content/molotes/bot.ts` y `src/content/birria/bot.ts`: saludo, palabras clave del negocio, nombres de sección y textos propios.
- `scripts/bot-chat.ts` (`npm run bot:chat`): conversación en la terminal contra el doble y con las semillas, para probar el bot en local (RF-12).
- Pruebas: `tests/support/cloud-api-double.ts`, `tests/fixtures/whatsapp/*.json`, `tests/unit/whatsapp-bot-*.test.ts` y `tests/integration/whatsapp-webhook.test.ts`.
  - Las fixtures son payloads con la forma de los ejemplos oficiales (texto, imagen, audio, sticker, ubicación, contactos y estados), con números ficticios.

Modificados:

- `src/config/env.ts`: `config.whatsappBot`.
- `src/app.ts`: creación del bot si hay configuración. Acepta `cloudApiFetch` y `bot` inyectables para las pruebas.
- `src/routes/index.ts`: monta la ruta.
- `src/server.ts`: registra `whatsappBot: enabled|disabled` en `server_started`.
- `src/services/visible-menu.ts`: exporta las funciones de lista, sin cambiar su salida.
- `src/utils/datetime.ts`: `getLocalTime`.
- `src/services/price.ts`: recibe `formatPesos`, que `src/views/landings/shared.ts` reexporta, para que el bot no dependa de las vistas.
- `package.json`: script `bot:chat`.
- `.env.example` y `README.md`.

### Contenido / configuración

Variables nuevas (RF-2). Funciona la regla de **todas o ninguna**:

- si no se define ninguna `WHATSAPP_BOT_*` ni `WHATSAPP_GRAPH_API_VERSION`, el bot queda deshabilitado (`config.whatsappBot = null`);
- si se define alguna, todas las obligatorias deben estar y ser válidas;
- si no, el arranque falla con la lista de problemas, sin valores (CA-4).

| Variable | Obligatoria | Validación |
| --- | --- | --- |
| `WHATSAPP_BOT_ACCESS_TOKEN` | sí | sin espacios, 1 a 4096 caracteres (secreto) |
| `WHATSAPP_BOT_PHONE_NUMBER_ID` | sí | solo dígitos, 5 a 20 |
| `WHATSAPP_BOT_APP_SECRET` | sí | alfanumérico, 16 a 128 (secreto) |
| `WHATSAPP_BOT_VERIFY_TOKEN` | sí | `[A-Za-z0-9._~-]`, 16 a 128 (secreto; README: `openssl rand -hex 32`) |
| `WHATSAPP_BOT_STAFF_MOLOTES` | sí | `PHONE_PATTERN` (como `WHATSAPP_MOLOTES`) |
| `WHATSAPP_BOT_STAFF_BIRRIA` | sí | `PHONE_PATTERN` |
| `WHATSAPP_BOT_STAFF_TEMPLATE` | sí | `^[a-z0-9_]{1,512}$` |
| `WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE` | no (por defecto `es_MX`) | `^[a-z]{2,3}(_[A-Z]{2})?$` |
| `WHATSAPP_GRAPH_API_VERSION` | no (por defecto `v26.0`) | `^v\d{1,3}\.\d$` |

- **Número del bot (RF-2.1, D-6).** Los números `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` son el número público del bot, y la API usa `WHATSAPP_BOT_PHONE_NUMBER_ID`. Con el bot habilitado, si los dos números están definidos y son distintos, la configuración es inválida, por coherencia con D-6. Las variables de las landings no cambian (RF-10).
- La base de la Graph API (`https://graph.facebook.com`) es una constante y **no** se configura. Así el token nunca puede enviarse a otro host.
- Los textos del bot viven en `src/content/<negocio>/bot.ts` y `src/content/common/bot.ts` (CLAUDE.md §7).
- El horario y su texto se derivan de `BUSINESS_HOURS`.
- La ubicación sale de `commonContent.location.mapsUrl`.
- Los nombres de los negocios salen de `molotesContent.name` y `birriaContent.name`.

### Validaciones

- Firma, token de verificación, `hub.challenge` y payload validados en el borde (DT-2 y DT-3).
- La entrada del cliente se valida en la máquina de estados (DT-13).
- Configuración validada en el arranque (RF-2.3).

### Manejo de errores

- El webhook usa el formato centralizado de errores (401, 403, 400, 413, 503).
- Un fallo de procesamiento o de la Cloud API **nunca** cambia el 200 ya enviado, nunca tumba la app y no afecta a las landings (RF-8).
- Si falla el aviso al personal, se aplica D-18: se avisa al cliente con el contacto directo, la conversación se cierra y se registra `bot_staff_send_failed`.
- Si falla una respuesta al cliente, se registra `bot_api_error` y el estado de la conversación se conserva.

### Testing

Sin llamadas a Meta (RF-11.1). El doble es un `fetch` falso que registra las peticiones (URL, cabeceras y JSON) y responde según un guion: éxito, 5xx, 429, error de conexión, timeout o errores de Graph. Las pruebas no usan `fetch` global.

- **Unitarias:**
  - `verifySignature` (válida, sin prefijo, hex corto, otra clave, cuerpo alterado);
  - `parseDelivery` con las fixtures;
  - `schedule` (los 7 días, antes y después de abrir y cerrar, medianoche, lunes, D-16);
  - catálogo y revalidación (CA-9, CA-10 = $260 + $35 = $295 con la semilla, CA-11, producto eliminado);
  - máquina de estados (CA-5, CA-6a y CA-6b, CA-7, CA-8, CA-12, CA-13, CA-16 a CA-19, CA-27, CA-28, palabras clave con acentos y mayúsculas, emojis);
  - store (caducidad, tope, borrado);
  - cliente (reintenta una vez con 5xx o 429 y error de conexión previo; no reintenta con timeout ni con 4xx);
  - `maskPhone`;
  - configuración (todas, ninguna, incompletas, sin valores en los mensajes).
- **Integración** (`listenLocal`, REQ-F-011):
  - CA-1 a CA-4;
  - CA-14: exactamente un envío al personal del negocio correcto, con todos los parámetros;
  - CA-15 y CA-20 (store de memoria que falla tras el arranque);
  - estado `failed` de un aviso al personal → `bot_staff_delivery_failed` sin teléfonos, y ningún mensaje al cliente (PT-3 A);
  - mensaje de hace más de 2 h → sin respuesta y `bot_message_stale` (PT-4 A);
  - CA-21: log capturado sin token, secreto, nombre, dirección, notas ni número completo;
  - CA-22;
  - las landings siguen respondiendo 200 con el bot deshabilitado y con fallos de la API.
- **Regresión:** los snapshots de las landings no cambian (CA-23).
- **CA-24:** `typecheck`, `lint`, `npm test`, `docker compose run --rm test` y el CI.
- **CA-26:** queda pendiente de los prerrequisitos de Meta.

### Seguridad

- HMAC con `timingSafeEqual` sobre el cuerpo crudo y comparación del token en tiempo constante.
- Límite de 3 MiB en el cuerpo, validación estricta del payload y respuesta del reto restringida.
- Secretos solo en variables de entorno, nunca en logs ni en respuestas. La base de la API es fija.
- Sin datos personales en los logs, y borrado al cerrar la conversación.
- Límite por número (DT-15) y topes de memoria (DT-4, DT-5).
- No se relaja CSP ni ninguna cabecera, y no cambia nada en `/admin`.

### Performance

- Respuesta inmediata al webhook, sin E/S de base de datos (el catálogo sale de la caché).
- Estructuras en memoria acotadas y limpieza perezosa (sin temporizadores que mantengan vivo el proceso).
- Un `fetch` por mensaje saliente.

### Riesgos técnicos

- Longitud y formato de los parámetros de la plantilla sin confirmar en la documentación consultada. Mitigación: plantilla de solo cuerpo, parámetros saneados y registro del código 132018 o 132000. Se confirma en CA-26.
- **Riesgo aceptado por el usuario (PT-3 A).** Si Meta acepta el aviso al personal y avisa del fallo después (estado `failed`), el cliente ya recibió la confirmación y la conversación se borró. **El pedido puede perderse sin que nadie avise, salvo que se revise el log** (`bot_staff_delivery_failed`). El README lo indica como algo que hay que vigilar.
- Tras una caída de más de 2 h, los mensajes que Meta reentrega no reciben respuesta (PT-4 A). El cliente tendrá que volver a escribir.
- Un timeout ambiguo al avisar al personal hace que el cliente reciba el mensaje de D-18 aunque el aviso quizá llegó. Se prefiere eso a un duplicado.
- Estado en memoria: un reinicio pierde las conversaciones (D-11, aceptado).
- Las etiquetas de variante no son únicas por esquema. Si se repiten, la revalidación toma la primera disponible.

### Orden de implementación (un solo PR, por etapas)

1. Configuración (`env.ts`), `.env.example` y las pruebas de configuración.
2. Webhook: verificación, firma, parser, fixtures, el controlador con 503 y las integraciones CA-1 a CA-4.
3. Cliente de la Cloud API, el doble y las pruebas de reintento.
4. Horario (`schedule.ts`, `getLocalTime`), catálogo (refactorización de `visible-menu` y `formatPesos`, con los snapshots intactos) y contenido del bot.
5. Máquina de estados, mensajes y sus pruebas unitarias.
6. Orquestador: colas, deduplicación, límites, aviso al personal, D-18, logs y las integraciones CA-14 a CA-22.
7. `scripts/bot-chat.ts`, README (prerrequisitos, variables, registro del webhook, plantilla, prueba local y la vigilancia de `bot_staff_delivery_failed`), el parche de la definición del agente y la validación completa.

### Documentación del agente

El usuario autorizó actualizar `.claude/agents/senior-fullstack.md`, porque el webhook es el primer endpoint público. `senior-fullstack` no modifica definiciones de agentes. Durante la implementación deja un parche (`senior-fullstack-md.patch`) en el scratchpad de la sesión, y la sesión principal lo revisa y lo aplica. El parche no forma parte del diff del ticket salvo que la sesión principal lo incluya.

Texto propuesto. Sustituye el párrafo "El proyecto **no tiene API pública**…" de la sección "Persistencia y API":

> El proyecto tiene dos superficies HTTP además de las landings:
>
> - **API JSON de productos** bajo `/admin/api` (REQ-F-008), con sesión.
> - **Webhook del bot de WhatsApp** en `/webhooks/whatsapp` (REQ-F-009). Es el único endpoint público sin sesión: la autenticidad la da la firma `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo con el App Secret) y la verificación con el token de suscripción. Todo cambio en esa ruta mantiene la verificación de la firma antes de procesar nada, la respuesta 200 inmediata y el procesamiento en segundo plano, y la deduplicación por id de mensaje.
>
> El bot vive en `src/services/whatsapp-bot/`. Guarda el estado de la conversación solo en memoria (una instancia; se borra al cerrar o tras 2 h) y lee el catálogo de la caché de productos y el horario de `src/content/hours.ts`. Envía mensajes con `fetch` nativo a la Cloud API de Meta, con una base fija (`https://graph.facebook.com`). Sus textos viven en `src/content/{common,molotes,birria}/bot.ts` y su configuración, en las variables `WHATSAPP_BOT_*` (todas o ninguna). En los logs, el número del cliente va enmascarado y nunca aparecen el texto de los mensajes ni los datos del cliente. Las pruebas nunca llaman a Meta: usan el doble de `tests/support/cloud-api-double.ts`.

Además, en "Estructura del proyecto" se añade `services/whatsapp-bot/` y `controllers/whatsapp-webhook.ts`, y en la tabla de comandos, `npm run bot:chat`.

### Criterios de finalización

- CA-1 a CA-5, CA-6a, CA-6b, CA-7 a CA-25, CA-27 y CA-28 cubiertos por pruebas automatizadas y en verde (CA-6 se sustituye por CA-6a y CA-6b, PT-1 A).
- `npm run typecheck` y `npm run lint` terminan con 0, `npm test` en verde y `docker compose run --rm test` en verde.
- Los snapshots de las landings no cambian.
- README y `.env.example` actualizados.
- Ninguna dependencia nueva.
- CA-26 documentado como pendiente de los prerrequisitos.
- El parche de `senior-fullstack.md` está en el scratchpad para la sesión principal.

## Implementation Result

### Rama

`feature/REQ-F-009-bot-whatsapp-compartido`, creada desde `main` (8006984). Sin commit (T2).

### Cambios realizados

Se siguieron las 7 etapas del plan. Al cerrar cada etapa pasaron `typecheck`, `lint` y `npm test`.

1. **Configuración** (`src/config/env.ts`): `config.whatsappBot` (`WhatsAppBotConfig | null`).
   - Funciona la regla de todas o ninguna, y cada problema se lista sin mostrar valores.
   - Con el bot habilitado, `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` deben ser el mismo número (D-6).
   - Valores por defecto: `es_MX` y `v26.0`.
   - `.env.example` documenta todas las variables.
2. **Webhook** (`src/services/whatsapp-bot/webhook.ts` y `src/controllers/whatsapp-webhook.ts`, montado en `src/routes/index.ts`).
   - `GET` (verificación): comparación del token en tiempo constante y reto restringido a `^[A-Za-z0-9_-]{1,128}$`.
   - `POST`: lee el cuerpo crudo con un límite de 3 MiB y comprueba la firma HMAC con `timingSafeEqual`. Sin firma o mal formada → 401; si no coincide → 403. JSON inválido → 400.
   - Un payload de otro número u objeto → 200 sin procesar. Las entregas válidas reciben 200 enseguida y se procesan en segundo plano. Con el bot deshabilitado → 503 `BOT_DISABLED`.
3. **Cliente de la Cloud API** (`cloud-api.ts`): `fetch` nativo con un timeout de 10 s y la base fija `https://graph.facebook.com`.
   - Texto y plantilla con parámetros con nombre.
   - Un solo reintento, solo con 429, 5xx, códigos de Graph 1, 2, 4 o 130429, o errores de conexión antes de enviar. Nunca tras un timeout ni tras `ECONNRESET`.
   - Nunca lanza. Registra `bot_api_error` solo con el estado, el código y el tipo de fallo.
   - Doble para las pruebas en `tests/support/cloud-api-double.ts`.
4. **Horario, catálogo y contenido**:
   - `schedule.ts` (`isOpen`, `nextOpening`, `acceptsOrders`, `describeOpening`, `describeHours`), apoyado en un helper nuevo, `getLocalMinutes`, en `src/utils/datetime.ts`.
   - `catalog.ts`. `visible-menu.ts` exporta `availableOnly` y `visibleBirriaItems`, sin cambiar su salida.
   - `formatPesos` pasa a `src/services/price.ts`; `views/landings/shared.ts` la reexporta.
   - Textos en `src/content/common/bot.ts`, `src/content/{molotes,birria}/bot.ts` y `src/content/bot.ts`.
5. **Máquina de estados** (`conversation.ts`, pura) y **mensajes** (`messages.ts`, `text.ts`):
   - flujo de RF-4, palabras clave de D-10 y límites de D-12;
   - revalidación de D-13 al pedir el resumen y al confirmar;
   - D-16 comprobado al empezar el pedido (PT-2 A), privacidad de D-17 y código `M-`/`B-` + 4 caracteres de D-19;
   - parámetros de plantilla saneados (DT-6) y menú partido en mensajes de hasta 4096 caracteres.
   - Ajuste durante la implementación: el saludo fuera de horario ya no dice "deja tu pedido" cuando D-16 no lo permite (texto `closedNoOrders`).
6. **Orquestador** (`bot.ts`, `store.ts`, `phone.ts`):
   - deduplicación por `wamid` (3 h, máximo 10 000) y cola por cliente;
   - descarte de los mensajes desordenados y de los de hace más de 2 h (PT-4 A, `bot_message_stale`);
   - límite de 20 mensajes por minuto por número y conversaciones en memoria (2 h, máximo 1000, limpieza perezosa);
   - aviso al personal único con la plantilla, D-18 si falla y `bot_staff_delivery_failed` ante un `failed` tardío (PT-3 A, mapa `wamid → negocio` de 24 h sin teléfonos);
   - `drain()`, `hasConversation()` y `conversationCount`, para las pruebas.
   - `createApp` acepta `whatsappBot` y `cloudApiFetch`. `server.ts` registra `whatsappBot: enabled|disabled` en `server_started`.
7. **Simulador y documentación**:
   - `scripts/bot-chat.ts` (`npm run bot:chat [-- --ahora …]`): arranca la app real en 127.0.0.1 con el doble y las semillas en memoria, y manda POST firmados al webhook.
   - El README tiene una sección nueva, "Bot de WhatsApp" (prerrequisitos, variables, registro del webhook, plantilla, logs y privacidad, prueba local), y actualiza Scripts, Configuración, HTTP y Estructura.
   - Dockerfile: la imagen de producción copia solo `admin-recover.ts` y `hash-password.ts`. `bot-chat.ts` es de desarrollo, porque importa el doble de `tests/`.
   - `vitest.config.ts`: `tests/setup/no-meta.ts` hace fallar cualquier `fetch` de una prueba a `*.facebook.com`.
   - Parche de la definición del agente: `senior-fullstack-md.patch` en el scratchpad de la sesión. Se verificó con `git apply --check`. `.claude/agents/` no se tocó.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `tests/integration/whatsapp-webhook.test.ts` "CA-1" (reto, 403 en 4 variantes, token fuera del log); arranque real con `?hub.challenge=42` |
| CA-2 | Cumple | integración "CA-2": 401 sin firma o mal formada y 403 si no coincide; sin envíos ni conversación; `bot_webhook_signature_invalid` en el log |
| CA-3 | Cumple | integración "CA-3" (dos POST iguales → una respuesta) y unitaria del orquestador |
| CA-4 | Cumple | integración: 503 sin configuración y landings en 200; arranque real con la configuración incompleta → código 1, lista de problemas y sin valores; `config.test.ts` |
| CA-5 | Cumple | `whatsapp-bot-conversation.test.ts` "CA-5" |
| CA-6a | Cumple | "CA-6a" (lunes 23:50 → martes 00:10, personal de Molotes, marca "fuera de horario") |
| CA-6b | Cumple | "CA-6b" para Molotes (viernes → sábado) y para Birria (domingo → lunes) |
| CA-7 | Cumple | "CA-7" (conversación nueva con Birria tras 2 h) |
| CA-8 | Cumple | "CA-8" y RF-3.4 en el menú |
| CA-9 | Cumple | "CA-9" (no disponible, eliminado y primera variante no disponible) |
| CA-10 | Cumple | "CA-10": $260 + $35 = $295 |
| CA-11 | Cumple | "CA-11" (aviso y resumen actualizado; el personal recibe $80) |
| CA-12 | Cumple | cantidades 0, 21, abc, -1 y 2.5; línea 16; más de 20 unidades en una línea; el carrito no cambia |
| CA-13 | Cumple | "CA-13" (pide y valida la dirección) |
| CA-14 | Cumple | integración "CA-14": exactamente un aviso al número de Molotes con los 9 parámetros |
| CA-15 | Cumple | orquestador (timeout, dos 5xx, plantilla inexistente, red caída) e integración: contacto directo y log sin datos personales |
| CA-16 | Cumple | "cancelar", "CANCELAR", "Cancelar!" y "2" en el resumen: no se avisa al personal y la conversación se cierra |
| CA-17 | Cumple | "persona", "Persona" y "HUMANO" → `https://wa.me/<personal de Birria>` |
| CA-18 | Cumple | imagen, audio, sticker, ubicación y contactos (fixtures) → aviso de solo texto y opciones del paso |
| CA-19 | Cumple | miércoles 16:00, miércoles 07:00 y sábado 16:00: aviso, pedido y marca en el resumen y en la plantilla |
| CA-20 | Cumple | caché con el store fallando y catálogo vacío → aviso con "persona" |
| CA-21 | Cumple | integración "CA-21": flujo completo, fallo y cancelación; el log no contiene tokens, secretos, nombre, dirección, notas, números completos ni códigos |
| CA-22 | Cumple | "CA-22" (confirmado y cancelado → `conversationCount` 0) y CA-14 |
| CA-23 | Cumple | `landing-snapshot.test.ts` en verde y `tests/snapshots/` sin cambios (`git status`) |
| CA-24 | Cumple en local | typecheck, lint, `npm test` y `docker compose run --rm test` en verde; `tests/setup/no-meta.ts` lo garantiza. El CI corre en T4 |
| CA-25 | Cumple | README ("Bot de WhatsApp") y `.env.example` |
| CA-26 | Pendiente | Depende de los prerrequisitos de Meta del usuario (número, cuenta, plantilla aprobada) |
| CA-27 | Cumple | "CA-27" (lunes 10:00) |
| CA-28 | Cumple | viernes 16:00 y domingo 16:00, con "2" y con un producto del menú: no toma el pedido, informa las dos aperturas y ofrece una persona; el saludo no promete el pedido |

### Validaciones ejecutadas

- `npm run typecheck` → código 0.
- `npm run lint` → código 0, sin errores ni avisos.
- `npm test` → 55 archivos; 965 pruebas pasan y 1 falla a propósito (la misma que había; antes eran 797). De ellas, 168 son nuevas: configuración, webhook, cliente, horario, texto, store, conversación, orquestador e integración HTTP.
- `docker compose run --rm --build test` → 960 pasan, 1 falla a propósito y 5 se omiten. Las 5 omitidas son las pruebas de permisos que no se ejecutan como root (`db-migrate` y `server-startup`), y ya se omitían antes.
- `docker build --target production` → correcto; `scripts/` contiene `admin-recover.ts`, `hash-password.ts` y `support/`.
- `npm run bot:chat -- --ahora 2026-10-06T10:00` con la entrada redirigida, de punta a punta contra el simulador:
  - pedido completo de Molotes a domicilio: resumen con $295 y aviso al personal con los 9 parámetros;
  - `/hora 2026-10-09T16:00` → saludo sin promesa de pedido y "2" → mensaje de D-16 con las dos aperturas;
  - `/audio` → solo texto; `persona` → contacto; `cancelar` → cierre.
  - Salida guardada en el scratchpad (`bot-chat-run.txt`).
- `git status`: solo cambian los archivos del ticket. No se tocaron `tests/snapshots/`, `data/`, `.env` ni `.claude/agents/`.

### Archivos afectados

- Nuevos:
  - `src/services/whatsapp-bot/{webhook,cloud-api,schedule,catalog,text,messages,conversation,store,phone,bot}.ts`
  - `src/controllers/whatsapp-webhook.ts`
  - `src/content/bot.ts`, `src/content/common/bot.ts`, `src/content/molotes/bot.ts`, `src/content/birria/bot.ts`
  - `scripts/bot-chat.ts`
  - `tests/support/{cloud-api-double,whatsapp}.ts`, `tests/setup/no-meta.ts`, `tests/fixtures/whatsapp/*.json` y su README
  - `tests/unit/whatsapp-bot-{conversation,infra,orchestrator}.test.ts`, `tests/integration/whatsapp-webhook.test.ts`
- Modificados:
  - `src/config/env.ts`, `src/app.ts`, `src/routes/index.ts`, `src/server.ts`
  - `src/services/visible-menu.ts`, `src/services/price.ts`, `src/views/landings/shared.ts`, `src/utils/datetime.ts`
  - `tests/helpers.ts` (`BOT_ENV`), `tests/unit/config.test.ts`
  - `vitest.config.ts`, `package.json` (`bot:chat`), `Dockerfile`, `.env.example`, `README.md`
- Ticket: movido a `in-progress/`.

### Correcciones de la ronda 1 de QA (2026-10-07)

Decisión del usuario (cita textual): "Corrige DEF-001 con la opción A y también DEF-002".

**DEF-001 (MAJOR, opción A): el número del cliente se quedaba en el limitador.**

- **`src/services/whatsapp-bot/store.ts`.** `createRateLimiter` recibe `keyOf` y guarda solo esa clave, nunca el número.
  - Las ventanas vencidas (`now - start >= windowMs`) se borran de forma perezosa en cada `hit` y en el nuevo `sweep(now)`, sin temporizadores y con el reloj inyectado.
  - Expone de solo lectura `has(id)` y `size`.
  - Se mantienen 20 mensajes por 60 s, un solo aviso por ventana y el tope de 1000.
- **`src/services/whatsapp-bot/bot.ts`.**
  - La clave es `HMAC-SHA256(wa_id)` con una clave `randomBytes(32)` creada al construir el bot, que nunca se registra ni se expone.
  - `receive` llama a `rateLimiter.sweep`, así que cualquier entrega limpia, también una que solo trae estados.
  - `bot_rate_limited` sigue enmascarando el `wa_id`.
  - Para las pruebas, `WhatsAppBot` expone de solo lectura `isRateTracked(waId)` y `rateTrackedCount`.
- **Pruebas nuevas**, con el reloj inyectado:
  - en `tests/unit/whatsapp-bot-orchestrator.test.ts`, el bloque "limitador por número sin datos personales":
    - criterio 1: tras un pedido confirmado y otro cancelado, pasados 60 s y con un mensaje de otro número, el primer cliente ya no está;
    - una entrega solo de estados también limpia;
    - criterio 3: el mensaje 21 se ignora con un solo `bot_rate_limited` enmascarado, y el número se atiende de nuevo tras 60 s;
    - criterio 4: con 1100 números distintos el limitador se queda en 1000;
    - ni la clave del limitador ni el número completo aparecen en los logs;
  - en `tests/unit/whatsapp-bot-infra.test.ts`: la clave pasa por `keyOf`, `sweep` olvida las ventanas vencidas (también en `hit` de otro número) y el tope sigue acotado.
  - Las pruebas anteriores del límite siguen en verde sin cambios en sus aserciones. La única adaptación es la firma de `createRateLimiter` en la prueba unitaria existente, que ahora recibe `keyOf`.
- **Criterio 2** (el *heap snapshot* no contiene números de conversaciones cerradas): el limitador ya no guarda números y la conversación se borra al cerrar. La comprobación con el *heap snapshot* la repite QA en la ronda 2.

**DEF-002 (TRIVIAL): fechas inválidas en `bot:chat`.**

- `scripts/bot-chat.ts`: `fromLocal` devuelve un mensaje en lugar de lanzar.
  - Antes de llamar a `toZonedIsoString`, comprueba el formato, que el instante sea válido y que la fecha exista tal cual: la fecha y hora locales deben coincidir, así que no se convierten en otro día.
  - `--ahora` inválido → `Fecha inválida: <valor>` y código 1, sin traza.
  - `/hora` inválido → el mismo mensaje y la sesión sigue abierta con el reloj anterior.
  - Los formatos válidos y los mensajes de uso no cambian.
- Evidencia (ejecución real):
  - `--ahora 2026-13-45T99:00`, `2026-02-30T10:00` y `2026-10-06T24:00` → `Fecha inválida: …` y `exit=1`; `--ahora 2026-10-06` → mensaje de formato y `exit=1`.
  - `/hora` con las tres fechas → `Fecha inválida: …` tres veces. Después, `/hora 2026-10-09T16:00` cambia el reloj y "Hola" responde con el saludo de Molotes, cerrado y sin pedidos.

**Validaciones de la ronda:**

- `npm run typecheck` → 0.
- `npm run lint` → 0.
- `npm test` → 55 archivos, 972 pruebas en verde y 1 que falla a propósito (son 7 pruebas más).
- Archivos tocados en esta ronda: `src/services/whatsapp-bot/store.ts`, `src/services/whatsapp-bot/bot.ts`, `scripts/bot-chat.ts`, `tests/unit/whatsapp-bot-infra.test.ts`, `tests/unit/whatsapp-bot-orchestrator.test.ts` y este ticket.
- `.claude/agents/senior-fullstack.md` aparece modificado en el árbol de trabajo. No lo cambió `senior-fullstack` en esta ronda: se entiende que la sesión principal aplicó el parche.

### Riesgos o pendientes

- **CA-26**, pendiente de los prerrequisitos de Meta. Además, ahí se confirmará la longitud y el formato de los parámetros de la plantilla (riesgo técnico del plan).
- **PT-3 A, riesgo aceptado:** un aviso al personal que Meta acepta y luego no entrega solo queda en el log (`bot_staff_delivery_failed`), y ese pedido puede perderse sin aviso. Está documentado en el README.
- **PT-4 A:** tras una caída de más de 2 h, los mensajes reentregados no reciben respuesta.
- Un reinicio pierde las conversaciones en curso (D-11).
- **Decisión menor, tomada dentro del alcance:** "2" en el resumen cancela, igual que la palabra "cancelar" (texto "Escribe 1 para confirmar o 2 para cancelar").
- ~~**Pendiente para la sesión principal:** revisar y aplicar `senior-fullstack-md.patch` desde el scratchpad.~~ **Aplicado** (2026-10-07): la sesión principal aplicó la actualización de `.claude/agents/senior-fullstack.md` con autorización directa del usuario. Incluye el webhook como único endpoint público sin sesión, la descripción del bot y `npm run bot:chat` en la tabla de comandos y en la estructura.

## QA Action Plan

Fase Q1 de `senior-qa` (2026-10-07). Revisé el ticket completo y el diff de la rama contra `main` (8006984). En el código revisé el controlador, `webhook.ts`, `bot.ts`, `store.ts`, `cloud-api.ts`, `conversation.ts`, `messages.ts`, `text.ts`, `schedule.ts`, `catalog.ts`, `env.ts`, `app.ts`, `routes/index.ts`, `request-logger`, `error-handler`, `admin-guard`, `bot-chat.ts`, el doble de la Cloud API, `tests/setup/no-meta.ts` y las pruebas nuevas. CodeGraph da este blast radius de lo compartido que se modificó:

- `formatPesos`: 17 llamadas, entre ellas las vistas de las landings y de `/admin`.
- `availableOnly` y `visibleBirriaItems`: landing y bot.
- `createRouter`: 17 archivos de pruebas.
- `getLocalMinutes`: solo el bot.

No hay impacto visual: no aplica `_stich_source_/` y no se usa el navegador, salvo para comparar las landings, que se hace byte a byte por HTTP.

### Objetivo

Comprobar con evidencia que el bot cumple CA-1 a CA-5, CA-6a, CA-6b, CA-7 a CA-25, CA-27 y CA-28, con D-1 a D-19 y PT-1 a PT-4 en su opción A. También hay que comprobar que el primer endpoint público sin sesión no abre una vía de abuso ni de fuga de datos personales, y que las landings, `/admin` y la suite no tienen regresiones. CA-26 queda **fuera de esta ronda** (no hay cuenta de Meta) y no bloquea.

### Requisito bajo prueba

RF-1 a RF-12, RN-1 a RN-6 y D-1 a D-19. CA-6 está sustituido por CA-6a y CA-6b (PT-1 A). D-16 se comprueba solo al empezar el pedido (PT-2 A). Un `failed` tardío solo se registra (PT-3 A). Los mensajes de más de 2 h se ignoran (PT-4 A).

### Criterios de aceptación → pruebas

| CA | Pruebas (ver las secciones de abajo) |
| --- | --- |
| CA-1 | S-1 a S-4 |
| CA-2 | S-5 a S-12 |
| CA-3 | I-1 a I-4 |
| CA-4 | C-1 a C-7 y S-13 |
| CA-5 | N-1 |
| CA-6a / CA-6b | N-2 y N-3 |
| CA-7 | N-4 |
| CA-8 | N-5 |
| CA-9 | M-1 y M-2 |
| CA-10 | M-3 |
| CA-11 | M-4 y M-5 |
| CA-12 | M-6 |
| CA-13 | M-7 |
| CA-14 | E-1 |
| CA-15 | E-2 y E-3 |
| CA-16 | E-4 |
| CA-17 | E-5 |
| CA-18 | E-6 |
| CA-19 | H-1 |
| CA-20 | M-8 |
| CA-21 | P-1 a P-3 |
| CA-22 | P-4 y P-5 |
| CA-23 | R-1 y R-2 |
| CA-24 | R-3 a R-6 y X-1 |
| CA-25 | D-1 |
| CA-26 | Fuera de esta ronda (pendiente de los prerrequisitos de Meta) |
| CA-27 | H-2 |
| CA-28 | H-3 |

### Riesgos identificados (a confirmar con pruebas, no son defectos todavía)

1. **Superficie pública:** el cuerpo se lee (hasta 3 MiB) antes de comprobar la firma. Cualquiera puede forzar esa lectura. Hay que medir el 413 por `Content-Length` y en modo *chunked*, y que nada se procese sin firma.
2. **Datos personales en memoria tras el cierre (RN-5, RF-9.3):** el limitador por número (`createRateLimiter`) guarda el `wa_id` completo como clave y no caduca de forma perezosa. Solo se reemplaza en el siguiente mensaje o al superar 1000 números. Hay que comprobar si el número del cliente sigue en memoria después de confirmar o cancelar, y si eso choca con RN-5 o es una `REQUIREMENT_AMBIGUITY` (el número es imprescindible para limitar). También se revisan la cola por cliente, `seen` y `staffMessages`.
3. **Orden y reloj:** un mensaje con `timestamp` en el futuro (desfase de reloj) fija `lastTimestamp` y podría hacer descartar como "desordenados" los mensajes siguientes. Un mensaje viejo de una conversación ya cerrada abre una nueva.
4. **D-6 con `WHATSAPP_*_URL`:** la regla "mismo número con el bot activo" solo compara `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA` cuando las dos están definidas. Hay que ver qué pasa si una landing usa `WHATSAPP_*_URL` con otro número.
5. **Límites de Meta:** el resumen para el cliente no se parte en trozos de 4096 (el menú sí). Hay que medir el peor caso: 15 líneas con nombres al máximo, dirección y notas de 200. Los parámetros de la plantilla sin límite confirmado quedan para CA-26.
6. **Red de seguridad "no-meta":** `tests/setup/no-meta.ts` solo cubre el `fetch` global del proceso de Vitest. Los procesos hijo (pruebas de arranque real) no la heredan.
7. **Regresión indirecta:** `formatPesos` se movió y `visible-menu` se refactorizó. Afectan a las dos landings y a `/admin`.
8. **Palabras clave en pasos de texto libre:** un nombre "Persona" o unas notas "pedido" se interpretan como palabra clave (DT-12 lo acepta). Solo se registra como observación de UX si se reproduce.

### Pruebas funcionales

Seguridad del webhook (S):

- **S-1.** GET con modo `subscribe`, token correcto y reto válido → 200 `text/plain` con el reto exacto.
- **S-2.** Token incorrecto, vacío, ausente, con otra longitud o con distinta capitalización → 403 con el formato centralizado.
- **S-3.** `hub.mode` distinto de `subscribe` o ausente → 403.
- **S-4.** Reto inválido → 403, sin eco del reto: vacío, de 129 caracteres, con `<script>`, con espacios, unicode o CRLF, o repetido (`hub.challenge=a&hub.challenge=b`). El log no contiene la query (`hub.verify_token`).
- **S-5.** POST sin `X-Hub-Signature-256` → 401.
- **S-6.** Cabecera mal formada → 401: sin `sha256=`, `sha1=`, hex de 63 o 65 caracteres, hex no válido o vacía.
- **S-7.** Firma de otro secreto → 403.
- **S-8.** Firma válida de un cuerpo y cuerpo alterado en un byte, con la misma longitud y con otra (espacio extra o reordenar claves JSON) → 403.
- **S-9.** Firma calculada sobre el JSON re-serializado y no sobre el cuerpo crudo → 403. Hex en mayúsculas y espacios alrededor → resultado coherente con la implementación (se documenta).
- **S-10.** En S-5 a S-9: el doble no registra ninguna petición, no se crea ninguna conversación (`conversationCount` 0) y el log tiene `bot_webhook_signature_invalid` con `reason`, sin la firma ni el cuerpo.
- **S-11.** Comparación en tiempo constante: revisión de código (uso de `timingSafeEqual` sobre buffers de igual longitud y `safeEqualStrings`) más una medición orientativa. Se miden miles de intentos con una firma que difiere en el primer byte y otra en el último; no se espera una diferencia significativa. La medición no se usa como criterio de rechazo por sí sola, porque es ruidosa.
- **S-12.** Firma válida y cuerpo no válido:
  - JSON roto, UTF-8 inválido o BOM → 400;
  - JSON válido pero no objeto (`[]`, `null`, `"x"`, `1`) → 200 sin procesar y `bot_webhook_ignored`;
  - otro `object`, `field` o `phone_number_id` → 200 sin procesar;
  - mensaje con campos de tipo incorrecto o `from` no numérico → descartado.
- **S-13.** Límite: más de 3 MiB declarado en `Content-Length` → 413 sin leer el cuerpo. Más de 3 MiB por *chunked*, sin `Content-Length` → 413. Exactamente 3 MiB firmado → aceptado.
- **S-14.** Otros métodos (PUT, DELETE, PATCH) → 405 con el formato centralizado. HEAD y OPTIONS se documentan.
- **S-15.** Aislamiento:
  - el webhook funciona con y sin `/admin` configurado;
  - no pasa por `adminGate`, sesión ni CSRF;
  - las cabeceras de `helmet` siguen presentes;
  - una cookie de sesión de `/admin` enviada al webhook no cambia nada;
  - `/admin/*` sigue exigiendo sesión.
- **S-16.** Ninguna respuesta del webhook (200, 4xx o 503) contiene el token de acceso, el App Secret, el token de verificación, los números del personal ni trazas.

Idempotencia, orden y cotas (I):

- **I-1.** La misma entrega dos veces → una sola respuesta al cliente, también en paralelo (dos POST simultáneos).
- **I-2.** Reentrega del mismo `wamid` en otra entrega con más mensajes → solo se procesan los nuevos.
- **I-3.** Reentrega de un "1" de confirmación → un solo aviso al personal (RN-4). Dos "1" distintos seguidos (ids distintos) → un solo aviso.
- **I-4.** Orden:
  - mensajes desordenados dentro de una entrega → se procesan por `timestamp`;
  - un mensaje con un `timestamp` anterior al último procesado, en otra entrega → descartado (`bot_message_out_of_order`);
  - mismo `timestamp` → se procesan los dos;
  - mensaje con `timestamp` en el futuro y efecto en los siguientes (riesgo 3).
- **I-5.** PT-4 A: el corte de 2 h por los dos lados (1 h 59 min responde; 2 h 1 min se ignora con `bot_message_stale` y sin respuesta). Mensajes de hace días.
- **I-6.** Límite por número:
  - 20 mensajes en 60 s se procesan; del 21 en adelante se ignoran, sin respuesta;
  - un solo `bot_rate_limited` por ventana, con el número enmascarado;
  - en la ventana siguiente se vuelve a atender;
  - un número limitado no afecta a otro.
- **I-7.** Cotas de memoria:
  - 1001 o más conversaciones simultáneas → como máximo 1000, con `bot_conversation_evicted` y sin datos;
  - más de 10 000 `wamid` → el conjunto no pasa de 10 000;
  - más de 1000 números en el limitador → no pasa de 1000;
  - el mapa de avisos al personal está acotado a 1000;
  - la cola por cliente se vacía al terminar.
- **I-8.** Un fallo de la Cloud API al responder al cliente no rompe la cola: el siguiente mensaje del mismo cliente se procesa.

Configuración (C):

- **C-1.** Ninguna variable `WHATSAPP_BOT_*` ni `WHATSAPP_GRAPH_API_VERSION` → bot deshabilitado, webhook en 503 (GET y POST) y landings en 200.
- **C-2.** Variables presentes pero vacías, como al copiar `.env.example` tal cual → se tratan como ausentes y la app arranca con el bot deshabilitado.
- **C-3.** Una sola variable (cualquiera de las 9, también una opcional como `WHATSAPP_GRAPH_API_VERSION`) → el arranque falla con código 1 y lista las obligatorias que faltan.
- **C-4.** Cada variable con un valor inválido (secreto corto, espacios, número con `+`, plantilla con mayúsculas, versión `26`, idioma `es-MX`) → falla y nombra la variable con su pista.
- **C-5.** En la salida de C-3 y C-4 no aparece **ningún** valor: se buscan los valores sembrados, marcados con cadenas reconocibles. El arranque se hace como proceso real (`node src/server.ts`), no solo con `loadConfig`.
- **C-6.** D-6: con el bot activo, `WHATSAPP_MOLOTES` ≠ `WHATSAPP_BIRRIA` → falla. Iguales → arranca. Se documenta lo que ocurre con `WHATSAPP_*_URL` (riesgo 4).
- **C-7.** `server_started` registra `whatsappBot: enabled|disabled` sin otros datos del bot. Los valores por defecto son `es_MX` y `v26.0`. La URL de envío es siempre `https://graph.facebook.com/<versión>/<phone_number_id>/messages`, con el token solo en `Authorization`.

Selección del negocio (N):

- **N-1.** CA-5: martes 10:00 → Molotes; sábado 10:00 → Birria. Más los 7 días a las 10:00 y la medianoche de viernes a sábado y de domingo a lunes, con el proceso en otra zona horaria (`TZ=Asia/Tokyo` y `TZ=UTC`) y `BUSINESS_TIMEZONE=America/Mexico_City`.
- **N-2.** CA-6a: conversación iniciada el lunes a las 23:50 y confirmada el martes a las 00:10 → Molotes, personal de Molotes y marca "fuera de horario".
- **N-3.** CA-6b:
  - Molotes iniciada el viernes a las 23:50 → "menú" el sábado a las 00:10 muestra Molotes, y pedir → mensaje de D-16;
  - Birria, del domingo a las 23:50 al lunes a las 00:10, igual.
- **N-4.** CA-7: 2 h sin actividad → conversación nueva con el negocio de ese momento, y los datos de la anterior ya no están. Límite exacto de 2 h, por los dos lados.
- **N-5.** CA-8 y RF-3.3: el martes, el mensaje inicial **exacto** de `WHATSAPP_BIRRIA_MESSAGE` → atiende como Molotes e indica los días de Birria. El de `WHATSAPP_MOLOTES_MESSAGE` en sábado → al revés. "birria" escrito a mitad del menú → nota del otro negocio, sin cambiar de negocio.

Menú y pedido (M):

- **M-1.** CA-9 y HU-5:
  - producto no disponible, eliminado, oculto y del otro negocio → no aparece;
  - la primera variante de Birria no disponible → solo las disponibles;
  - Birria sin variantes disponibles → oculto;
  - bebidas de Molotes en su propia sección;
  - Molotes con `orderPriceCents` 0 → solo la pieza.
- **M-2.** Fidelidad con la landing: con el mismo estado de la caché, el conjunto de productos, variantes y precios del menú del bot coincide con lo que muestra `/molotes` y `/birria`. Se comparan los nombres y precios extraídos del HTML con los del mensaje del menú.
- **M-3.** CA-10: 2 órdenes de "Molotes de Queso Oaxaca" + 1 bebida → $260 + $35 = $295 en el resumen, y los mismos importes en la plantilla.
- **M-4.** CA-11 y D-13: el precio cambia entre agregar y confirmar → aviso, resumen actualizado y nueva confirmación. El personal recibe el precio nuevo.
- **M-5.** D-13: entre agregar y confirmar, el producto se elimina, se marca no disponible o se le quita la variante → la línea se quita con aviso. Si el carrito queda vacío → vuelve al menú y no se envía nada al personal.
- **M-6.** CA-12 y D-12:
  - cantidades 0, 21, "abc", "-1", "2.5", "1e1", "２" (ancho completo), "" y "٣" (dígito árabe) → rechazo claro y carrito igual;
  - sumar a una línea sin pasar de 20;
  - línea 16 → rechazo;
  - nombre de 0, 1, 60 y 61 puntos de código (con emojis y acentos);
  - dirección de 4, 5, 200 y 201;
  - notas de 200 y 201;
  - caracteres de control eliminados;
  - texto de más de 1000 caracteres recortado.
- **M-7.** CA-13: a domicilio sin dirección → la pide. Cambiar de domicilio a recoger borra la dirección.
- **M-8.** CA-20: el store falla tras el arranque → menú con los últimos productos válidos. Catálogo vacío → aviso y la opción "persona".
- **M-9.** Carrito: ver, quitar (número válido e inválido), vaciar, "carrito" con el carrito vacío. "menú" a mitad del pedido conserva el carrito.

Envío y opciones (E):

- **E-1.** CA-14: exactamente **un** mensaje de plantilla al número del personal del negocio de la conversación (Molotes y Birria por separado). Debe tener:
  - los 9 parámetros, sin `\n`, `\t` ni dobles espacios, y ninguno vacío;
  - el código `M-`/`B-` + 4 caracteres del alfabeto;
  - las líneas, el total, la entrega y los datos.

  El cliente recibe la confirmación con el **mismo** código.
- **E-2.** CA-15 y D-18, con 5xx dos veces, 4xx de plantilla (132001), timeout, `ECONNRESET` y red caída → el cliente recibe el contacto directo (`https://wa.me/<personal>`) y **nunca** el texto de pedido confirmado. El log tiene `bot_staff_send_failed` sin datos personales.
- **E-3.** Reintento: 5xx o 429 una vez y luego éxito → dos peticiones y **un** aviso entregado. Timeout o `ECONNRESET` → **ningún** reintento (una sola petición). Un 4xx no reintentable → sin reintento.
- **E-4.** CA-16: "cancelar", "CANCELAR", "Cancelar!" y "cancelár" en cada paso (root, browse, option, quantity, cart, remove, name, delivery, address, notes, confirm) → nada al personal y la conversación cerrada.
- **E-5.** CA-17: "persona", "Persona", "HUMANO" y la opción 4 → contacto del personal del negocio **de la conversación**, también tras la medianoche (CA-6b).
- **E-6.** CA-18: imagen, audio, sticker, ubicación y contactos, en el primer mensaje y a mitad del flujo → aviso de "solo texto" y opciones del paso actual. El carrito no cambia.
- **E-7.** RF-4.9: un texto no reconocido en cada paso → ayuda breve con las opciones del paso.
- **E-8.** PT-3 A: estado `failed` del `wamid` del aviso → `bot_staff_delivery_failed { business, errorCode }`, sin teléfonos y sin mensajes al cliente. `failed` de un `wamid` desconocido → nada. `delivered` y `read` → nada.

Horario (H):

- **H-1.** CA-19: miércoles a las 16:00 y a las 07:00, y sábado a las 16:00 → aviso de apertura, pedido permitido y la marca en el resumen **y** en el parámetro `horario` de la plantilla.
- **H-2.** CA-27: lunes a las 10:00 → Molotes, "abre el martes a las 08:30", menú y pedido permitidos, con la marca.
- **H-3.** CA-28: viernes a las 16:00 y domingo a las 16:00, con la opción 2 y eligiendo un producto del menú:
  - no toma el pedido;
  - informa las dos aperturas (martes a las 08:30 y sábado a las 08:00);
  - ofrece "persona";
  - el saludo no promete el pedido.
- **H-4.** PT-2 A:
  - pedido empezado el viernes a las 14:55 y confirmado a las 15:05 → aceptado, con la marca;
  - conversación saludada a las 14:59 y primer producto a las 15:01 → no se toma;
  - lo mismo el domingo con Birria.
- **H-5.** Bordes exactos: 08:29, 08:30, 14:59 y 15:00 en un día de Molotes; 07:59 y 08:00 el sábado. Jueves a las 16:00 → acepta (abre el viernes). Domingo a las 07:00 → acepta.

### Pruebas negativas y casos límite

Ya están dentro de S-2 a S-14, I-4 a I-7, C-2 a C-6, M-5, M-6, E-2, E-3 y H-5. Además:

- números internacionales de 5 a 20 dígitos;
- emojis, acentos y RTL en nombre, dirección y notas;
- un reinicio de la app en mitad de un pedido (D-11): el siguiente mensaje empieza una conversación nueva.

### Pruebas de integración (WhatsApp)

- El CTA de las landings no cambia: el `href` con el número del bot y el mensaje inicial de cada negocio, con el bot activo (D-6, RF-10).
- `buildWhatsAppLink` es el único constructor de `wa.me` en el bot (DT-17).
- Doble de la Cloud API: forma del cuerpo de texto y de plantilla (`messaging_product`, `to`, `type`, `template.language.code` y `components[0].parameters[].parameter_name`) coherente con lo documentado en el ticket.

### Privacidad (P)

- **P-1.** CA-21, barrido de logs. Se captura **todo** el log (logger inyectado y stdout/stderr del proceso real) durante una batería con:
  - pedidos completos de los dos negocios;
  - D-18;
  - cancelación;
  - firma inválida;
  - errores de la API;
  - estados `failed`;
  - mensajes viejos, límite por número y desalojo.

  Luego se busca cada valor sembrado: el token, el App Secret, el token de verificación, los números completos de clientes y del personal, el nombre, la dirección, las notas, los textos de los mensajes, el código de referencia, los `message` y `details` de Meta del doble, `hub.verify_token` y `hub.challenge`. Se espera **cero** apariciones. El número del cliente solo aparece enmascarado (4 últimos dígitos).
- **P-2.** Errores inesperados del bot (excepción forzada en el catálogo) → `bot_processing_failed` solo con `name`.
- **P-3.** El `request` log del webhook solo tiene método, ruta, estado y duración.
- **P-4.** CA-22: tras confirmar, cancelar, D-18 y caducar → `hasConversation` es false y `conversationCount` es 0.
- **P-5.** RN-5 y RF-9.3 a nivel de proceso (riesgo 2). Se hace un *heap snapshot* tras `gc()`, después de confirmar y después de cancelar, en un script del scratchpad sobre la app real con el doble. En él se buscan el nombre, la dirección, las notas y el número completo del cliente. Si solo queda el número en el limitador, se evalúa como `REQUIREMENT_AMBIGUITY` o como defecto según el texto de RN-5.

### Pruebas de performance

- El 200 de una entrega válida llega antes de que termine el procesamiento: el doble se configura con un retraso de varios segundos y se mide.
- El 413 de un cuerpo grande declarado no lee el cuerpo.
- Una ráfaga de 200 entregas firmadas de 50 números → sin errores, memoria acotada (I-7) y landings respondiendo en paralelo.
- Ni el webhook ni el bot hacen E/S de base de datos: el catálogo sale de la caché, y se comprueba con el store espía de M-8.

### Pruebas de regresión

- **R-1.** CA-23: `tests/snapshots/` sin cambios (`git status` y `git diff main -- tests/snapshots`), y `landing-snapshot.test.ts` en verde.
- **R-2.** Landings **byte a byte frente a `main`**. Hay que arrancar `main` (un `git worktree` en el scratchpad) y la rama con la misma configuración y la misma fecha simulada, y comparar con `cmp`:
  - las respuestas de `/`, `/molotes` y `/birria` en martes, sábado y lunes;
  - los manifests;
  - un 404.

  Se hace con el bot deshabilitado y con el bot habilitado, en la configuración D-6 del mismo número.
- **R-3.** `npm run typecheck` y `npm run lint` terminan con 0 (CA-24).
- **R-4.** `npm test` completo terminado con 0. La prueba `it.fails` de `local-server.test.ts` ya existía y es una falla esperada.
- **R-5.** `docker compose run --rm --build test` en verde. `docker build --target production` correcto, y la imagen no contiene `scripts/bot-chat.ts` ni `tests/`. El contenedor de producción arranca con el bot deshabilitado y con el bot habilitado, y responde a `/molotes` y al GET de verificación.
- **R-6.** `/admin` sin cambios de comportamiento: las suites de admin en verde y una comprobación manual de que el login y `/admin/api` siguen exigiendo sesión. `price.test.ts` y `visible-menu.test.ts` en verde.
- **R-7.** Ningún archivo de `src/` importa de `tests/`, salvo `scripts/bot-chat.ts`, que es solo de desarrollo.

### Pruebas automatizadas y red de seguridad no-meta (X)

- **X-1.** Se ejecuta `npm test` con un *preload* del scratchpad cargado con `NODE_OPTIONS=--import …`, que también heredan los procesos hijo. El *preload* intercepta `fetch`, `http(s).request` y `dns.lookup` hacia `*.facebook.com` y `graph.facebook.com`, y anota cada intento en un archivo. Resultado esperado: el archivo vacío. Además:
  - se comprueba que `tests/setup/no-meta.ts` rechaza de verdad (una prueba temporal del scratchpad, que no queda en el repositorio);
  - en `src/` no hay más llamadas a `fetch` que la del cliente.
- Pruebas existentes que se ejecutan: toda la suite. Las de esta funcionalidad son `whatsapp-bot-{conversation,infra,orchestrator}.test.ts`, `whatsapp-webhook.test.ts`, `config.test.ts`, `whatsapp.test.ts`, `visible-menu.test.ts`, `price.test.ts` y `landing-snapshot.test.ts`.
- **Pruebas permanentes nuevas (requieren tu aprobación).** Propongo dejar en el repositorio `tests/integration/whatsapp-bot-qa.test.ts`, solo con los huecos que la suite actual no cubre y que no reproducen la implementación:
  - S-4 (reto peligroso o repetido);
  - S-8 y S-9 (cuerpo alterado con la misma longitud, firma sobre JSON re-serializado);
  - S-12 (JSON no objeto, UTF-8 inválido);
  - S-13 (*chunked* de más de 3 MiB);
  - S-15 (aislamiento de `/admin`);
  - I-1 en paralelo;
  - I-3 (doble confirmación);
  - I-5 (bordes de 2 h);
  - I-7 (cotas);
  - C-2 (variables vacías);
  - E-3 (sin reintento con `ECONNRESET`);
  - H-4 y H-5 (PT-2 A y bordes);
  - P-1 ampliado (barrido con todos los valores sembrados).

  Si no lo apruebas, esas pruebas se ejecutan igual, pero como scripts temporales en el scratchpad, con la salida como evidencia. Nada queda en el repositorio.
- Las demás comprobaciones son evidencia de una sola ejecución y viven en el scratchpad: *heap snapshot*, *preload* no-meta, comparación byte a byte, medición de tiempos y Docker.

### Prueba de punta a punta con `npm run bot:chat`

La hago yo, con la entrada redirigida y la salida guardada como evidencia:

1. Martes 10:00: pedido de Molotes a domicilio con 2 órdenes y una bebida → $295, la plantilla con los 9 parámetros y la confirmación con el mismo código.
2. Sábado 12:00: pedido de Birria con variante y para recoger.
3. Lunes 10:00: aviso del lunes, pedido con la marca.
4. Viernes 16:00 y domingo 16:00: D-16.
5. `/audio`, "persona", "cancelar", cantidades inválidas y "ayuda".
6. `/hora` cruzando la medianoche (CA-6b).

En todos los casos se comprueba además que:

- ninguna petición sale a internet: el *preload* de X-1 está activo;
- no se tocan `DATA_DIR` ni la base: la fecha de modificación y el hash de `data/` no cambian;
- el log del proceso cumple P-1;
- un `--ahora` inválido falla con un mensaje claro.

### Documentación

- **D-1.** CA-25 y RF-12. El README y `.env.example` tienen:
  - los prerrequisitos (los 9);
  - todas las variables, con su validación y sus valores por defecto;
  - el registro de la URL y del token de verificación;
  - el texto exacto de la plantilla (Utility, `es_MX`, los 9 parámetros con nombre que coinciden con `staffTemplateParams`);
  - la prueba local con `bot:chat`;
  - la vigilancia de `bot_staff_delivery_failed` (PT-3 A).

  Se comprueba también que los nombres de las variables del README coinciden con `env.ts`. La actualización de `.claude/agents/senior-fullstack.md` está aplicada y es coherente con la implementación.

### Pruebas en navegador

No se necesitan: el bot es solo conversacional y la regresión de las landings se valida byte a byte (R-2), que es más estricto que una revisión visual. Solo se usaría Claude in Chrome si R-2 mostrara alguna diferencia.

### Evidencia requerida

- Salida de cada comando: typecheck, lint, test, Docker y `bot:chat`.
- Salida de los scripts del scratchpad: barrido de logs, *heap snapshot*, *preload* no-meta, `cmp` de las landings y tiempos.
- Las peticiones que registra el doble en E-1 a E-3.
- `git status` y `git diff main --stat` antes y después del QA, para confirmar que solo cambian el ticket y, si se aprueba, `tests/integration/whatsapp-bot-qa.test.ts`.

### Criterios de aprobación

- Pasan con evidencia CA-1 a CA-5, CA-6a, CA-6b, CA-7 a CA-25, CA-27 y CA-28.
- No hay defectos `BLOCKER` ni `CRITICAL`, y cada `MAJOR` tiene una decisión explícita del usuario.
- Se cumplen todas estas condiciones:
  - no se procesa nada sin una firma válida;
  - no se duplican avisos al personal;
  - nunca se dice "pedido confirmado" si el aviso falló;
  - cero valores sensibles en los logs;
  - cero intentos de llamar a Meta;
  - las landings son idénticas byte a byte a `main`;
  - `npm test`, typecheck, lint y Docker terminan con 0.
- CA-26 queda como pendiente documentado y no bloquea.

## QA Report

### Ronda

1 (2026-10-07). QA Action Plan aprobado por el usuario (cita textual: "Apruebo el plan"). La prueba permanente `tests/integration/whatsapp-bot-qa.test.ts` **no** se aprobó, así que esas comprobaciones se ejecutaron como pruebas temporales en el scratchpad de la sesión (`qa/probe/*.qa.test.ts`, con Vitest y una configuración propia fuera del repositorio). No se añadió nada al repositorio.

### Pruebas ejecutadas

| Acción | Resultado |
| --- | --- |
| `git branch --show-current` | `feature/REQ-F-009-bot-whatsapp-compartido` |
| `npm run build:css`, `npm run typecheck`, `npm run lint` | Código 0 los tres; lint sin avisos |
| `npm test` | Código 0: 55 archivos, 965 pasan y 1 "expected fail" (el `it.fails` que ya existía en `local-server.test.ts`) |
| `npm test` con el *preload* deny-meta (X-1) | Código 0. El *preload* se cargó en 59 procesos (npm, Vitest, 55 workers y los procesos hijo de las pruebas de arranque); **0** intentos de contactar con `*.facebook.com`. Antes se comprobó que el *preload* intercepta (`fetch graph.facebook.com` → rechazado y registrado) |
| `tests/setup/no-meta.ts` (comprobación aislada) | Rechaza `fetch('https://graph.facebook.com/…')` con el mensaje esperado. En `src/` solo hay dos `fetch`: el valor por defecto de `cloudApiFetch` en `app.ts` y el cliente |
| Pruebas temporales (33 pruebas: webhook, configuración, bot y fidelidad con la landing) | 33/33 en verde con el TZ del sistema, `TZ=Asia/Tokyo`, `TZ=UTC` y `TZ=Pacific/Kiritimati`, todas con el *preload* deny-meta (0 intentos) |
| *Heap snapshot* tras `gc()`, con un pedido confirmado y otro cancelado (P-5) | Ver DEF-001 |
| Landings byte a byte frente a `main` (R-2) | Un `git worktree` de `main` (8006984) en el scratchpad. 8 rutas × 4 fechas = 64 respuestas (cuerpo y cabeceras sin `date`/`etag`). Rama con el bot apagado frente a main: **idénticas**. Rama con el bot encendido (D-6) frente a main: **idénticas**. El CSS compilado en las dos ramas también es idéntico |
| Servidor real (`node src/server.ts`, `NODE_ENV=production`, bot habilitado, `DATA_DIR` en el scratchpad, *preload* deny-meta) | `server_started` con `whatsappBot: "enabled"`. Verificación: 200 con el token y 403 sin él. Más de 3,5 MB en *chunked* y con `Content-Length` → 413. Un POST firmado → 200 en 24 ms; el intento de respuesta a Meta quedó bloqueado por el *preload*, `bot_api_error` sin datos y la app siguió en pie. `/molotes` 200 |
| Ráfaga contra el servidor real | 200 POST firmados de 50 números más 20 GET de `/birria` en paralelo: 200 × 200, p50 de 76 ms y p95 de 89 ms en el webhook, landings en 200 con p95 de 52 ms, sin 500. La memoria residente pasó de 204 MB a 220 MB |
| `npm run bot:chat` (7 escenarios con la entrada redirigida, *preload* activo) | Código 0 en todos; 0 intentos a Meta; `data/` sin cambios (hash idéntico antes y después) |
| `docker compose run --rm --build test` | Código 0: 960 pasan, 1 "expected fail" y 5 omitidas (las de permisos como root, que ya se omitían) |
| `docker build --target production` (etiqueta temporal `restaurante:qa-req009`, borrada al terminar) | Correcto. La imagen tiene `scripts/` = `admin-recover.ts`, `hash-password.ts` y `support/`, sin `bot-chat.ts` y sin `tests/`. Contenedor sin bot: `/molotes` 200 y el webhook en 503 `BOT_DISABLED`. Contenedor con bot: `/molotes` 200 y la verificación en 200 con el reto. Configuración incompleta: código 1, lista de problemas sin el valor sembrado (0 apariciones) |
| README y `.env.example` (D-1) | Las 9 variables están en los dos; los 9 parámetros `{{…}}` de la plantilla coinciden con `staffTemplateParams`. Tiene los prerrequisitos, Utility y `es_MX`, `openssl rand`, la suscripción a `messages`, la vigilancia de `bot_staff_delivery_failed` y `bot:chat` |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Reto devuelto como `text/plain`. 403 con token incorrecto, vacío, ausente, en mayúsculas o con un carácter extra, y con `hub.mode` incorrecto o ausente. Los retos vacíos, de 129 caracteres, `<script>`, con espacios, `ñ`, CRLF o repetidos dan 403 sin eco; 128 caracteres → 200. El log no tiene el token ni el reto. Igual en el servidor real y en Docker |
| CA-2 | PASS | 12 variantes (sin cabecera, sin prefijo, `sha1=`, hex de 63 o 65, no hex, otro secreto, cuerpo alterado con la misma longitud, espacio extra, firma sobre el JSON reserializado y al revés) → 401/403. En todas: 0 peticiones al doble, 0 conversaciones, `bot_webhook_signature_invalid` con `reason` ∈ {missing, malformed, mismatch} y sin la firma en el log. Tiempo de comparación sin diferencias entre el primer y el último byte (unos 3,0–3,2 µs por llamada en 5 rondas) |
| CA-3 | PASS | Tres POST idénticos en paralelo → 3 × 200 y 1 respuesta. Reentrega con un id viejo y uno nuevo → solo el nuevo. "1" de confirmación reentregado y dos "1" distintos seguidos → **1** aviso al personal |
| CA-4 | PASS | Sin configuración: GET y POST → 503 `BOT_DISABLED` y landings en 200 (app, servidor y Docker). Variables vacías, como al copiar `.env.example` → bot deshabilitado. Cualquier variable sola (las 9) → falla. Cada valor inválido → nombra la variable y no muestra el valor. Arranque real → código 1 y lista sin valores |
| CA-5 | PASS | Los 7 días a las 10:00 y las medianoches de viernes 23:59 a sábado 00:00 y de domingo 23:59 a lunes 00:00, con 4 zonas horarias del proceso |
| CA-6a | PASS | Prueba existente en verde; `bot:chat` (lunes → pedido con la marca) |
| CA-6b | PASS | E-5 (viernes 23:50 → sábado 00:10: "persona" y la opción 4 dan el contacto de Molotes). `bot:chat` 6 (menú de Molotes tras la medianoche, D-16 al pedir) |
| CA-7 | PASS | 2 h − 1 s: conversación vigente; 2 h exactas: caducada |
| CA-8 | PASS | Los mensajes iniciales **exactos** de las landings: el de Birria un martes → Molotes más los días de Birria; el de Molotes un sábado → Birria más los días de Molotes; el del propio negocio → sin nota |
| CA-9 | PASS | No disponible, eliminado y primera variante no disponible. M-2: el menú del bot y la landing coinciden en productos (8/8 y 6/6) y precios con el mismo estado de la caché |
| CA-10 | PASS | $260 + $35 = $295 en el resumen, en la plantilla y en `bot:chat` |
| CA-11 | PASS | Prueba existente. Además, un producto no disponible, eliminado o con la variante retirada al confirmar → aviso, resumen actualizado o carrito vacío, y 0 avisos al personal |
| CA-12 | PASS | 0, 21, abc, -1, 2.5, 1e1, `２`, `٣`, espacio y 00 → rechazo. Exactamente 15 líneas y la 16 se rechaza. Nombre de 60/61 puntos de código con emojis, dirección de 4/5/200/201, notas de 200/201, caracteres de control eliminados |
| CA-13 | PASS | Prueba existente en verde |
| CA-14 | PASS | Molotes y Birria: 1 plantilla al personal correcto, los 9 parámetros sin `\n`, `\t` ni dobles espacios, el mismo código en la confirmación, URL `https://graph.facebook.com/v26.0/<id>/messages`, token solo en `Authorization`, `es_MX`. Conversación borrada |
| CA-15 | PASS | Matriz de fallos: 5xx+5xx, 132001, timeout, ECONNRESET y ECONNREFUSED×2 → el cliente recibe el contacto directo y **nunca** "fue enviado", con `bot_staff_send_failed`. 429→ok, 5xx→ok y ENOTFOUND→ok → un solo aviso entregado. Timeout, ECONNRESET y 132001 → **1** intento, sin reintento |
| CA-16 | PASS | Cancelar en los 11 pasos con 5 variantes de escritura → "Pedido cancelado", 0 conversaciones y 0 avisos |
| CA-17 | PASS | "persona" y la opción 4, también tras la medianoche → personal del negocio de la conversación |
| CA-18 | PASS | Audio como primer mensaje, e imagen, sticker, ubicación y contactos a mitad del pedido → aviso de solo texto y opciones del paso; el carrito no cambia |
| CA-19 | PASS | Miércoles 16:00 y 07:00 y sábado 16:00 aceptan; la marca aparece en el resumen y en el parámetro `horario` |
| CA-20 | PASS | Pruebas existentes en verde (caché con el store fallando, catálogo vacío) |
| CA-21 | PASS | Barrido de 1133 líneas de log de las pruebas temporales con 39 valores sembrados: 0 apariciones. Los números enmascarados cumplen `^\*+\d{4}$`. Servidor real: 0 apariciones de 9 valores sensibles. Error inesperado → solo `name` |
| CA-22 | PASS | `hasConversation` y `conversationCount` en 0 tras confirmar, cancelar, D-18 y caducar. Ver DEF-001 sobre el número del cliente en el limitador |
| CA-23 | PASS | Byte a byte frente a main (64 respuestas, con el bot apagado y encendido); `tests/snapshots/` sin cambios |
| CA-24 | PASS (local) | typecheck, lint, `npm test` y Docker test en 0, con 0 llamadas a Meta. El CI corre con el PR |
| CA-25 | PASS | Ver D-1 |
| CA-26 | PENDIENTE | Sin cuenta de Meta; no bloquea |
| CA-27 | PASS | Lunes a las 10:00: "Abrimos mañana martes a las 08:30", pedido aceptado y la marca en el resumen y la plantilla (`bot:chat` 3) |
| CA-28 | PASS | Viernes 16:00 y 15:00 y domingo 16:00 y 15:00 → no toma el pedido, da las dos aperturas y ofrece "persona"; el saludo no promete el pedido. PT-2 A: un pedido empezado a las 14:55 se acepta a las 15:05 con la marca; un primer producto a las 15:01 se rechaza; igual con Birria el domingo |

### Defectos encontrados

#### DEF-001

- **Severidad:** MAJOR (necesita decisión del usuario).
- **Criterio afectado:** RN-5 ("No se conservan datos personales después de cerrar la conversación") y RF-9.3. Roza CA-22.
- **Descripción:** el limitador de 20 mensajes/min por número (`createRateLimiter` en `src/services/whatsapp-bot/store.ts`) usa el `wa_id` completo del cliente como clave y **no borra las ventanas vencidas**. La entrada solo se reemplaza cuando ese número vuelve a escribir, o se descarta cuando entran más de 1000 números distintos. El número completo del cliente se queda en memoria después de confirmar o cancelar, sin plazo, hasta un reinicio. La cola por cliente, `seen` y `staffMessages` sí están limpios. Nombre, dirección y notas no quedan retenidos.
- **Pasos para reproducir:** script del scratchpad `qa/heap/heap2.ts`, con `node --expose-gc`:
  1. un cliente confirma un pedido y otro cancela;
  2. se llama a `gc()`;
  3. se guarda `writeHeapSnapshot`;
  4. se buscan los retenedores con `qa/heap/retainers.py`.
- **Resultado esperado:** tras cerrar la conversación, ningún dato personal del cliente sigue en memoria. Como mucho, el número podría seguir el tiempo imprescindible para el límite: 60 s desde su último mensaje.
- **Resultado actual:** `conversationCount` 0 y `hasConversation` false para los dos, pero el *heap snapshot* contiene los dos números completos (`…29694` y `…22119`). La cadena de retención es `Map windows` → closure `hit` → `rateLimiter` → contexto de `createWhatsAppBot`. La dirección y las notas sembradas ya no están. El nombre solo lo retenía el propio script de prueba (closure `now`), no el bot.
- **Evidencia:** `qa/heap/after-close2.heapsnapshot` y la salida de `retainers.py` en el scratchpad. La comprobación funcional (I-7) confirma que el limitador solo suelta un número cuando entran 1000 números más.
- **Impacto:** el dato está solo en la memoria del proceso: no va al log, no se persiste y no se expone por HTTP. Pero contradice una regla de privacidad aprobada (LFPDPPP, D-17 dice que los datos "no se conservan"). En un negocio con pocos clientes al día, el número puede quedarse en memoria durante días o semanas.
- **Recomendación:** que el limitador olvide las ventanas vencidas, por ejemplo con una limpieza perezosa en cada `hit`, como `session-store` y `createExpiringMap`. Así el número no sobrevive más de unos 60 s a su último mensaje. Opcionalmente, usar como clave un HMAC del número con una clave aleatoria por proceso. Y una prueba que lo verifique.

#### DEF-002

- **Severidad:** TRIVIAL.
- **Criterio afectado:** ninguno directamente (RF-12, herramienta de desarrollo).
- **Descripción:** `npm run bot:chat -- --ahora 2026-13-45T99:00` (fecha con el formato correcto pero imposible) termina con código 1, pero muestra una traza de `TypeError: Fecha inválida` desde `toZonedIsoString`, en lugar del mensaje claro que usa el script para los demás errores. Un formato incorrecto (`--foo`) sí da el mensaje de uso.
- **Resultado esperado:** "Fecha inválida: …" sin traza.
- **Impacto:** solo en desarrollo.
- **Recomendación:** validar la fecha antes de calcular el desfase.

### Observaciones (no son defectos)

- **OBS-1 (D-6 con URL).** Con el bot activo, `WHATSAPP_BIRRIA_URL=https://wa.me/<otro número>` arranca sin error. La comprobación solo compara `WHATSAPP_MOLOTES` y `WHATSAPP_BIRRIA`, como fijó el Technical Action Plan ("si los dos números están definidos"). Es coherente con el plan aprobado; se anota como riesgo de configuración.
- **OBS-2 (límites de la plantilla).** En el peor caso (15 líneas con nombres de 80 caracteres, dirección y notas de 200), el resumen para el cliente mide 2510 caracteres (< 4096: correcto) y el parámetro `lineas` de la plantilla, 1805. Meta podría rechazar un cuerpo hidratado tan largo. Va a D-18 sin duplicar y queda para confirmar en CA-26, como ya preveía el riesgo técnico del plan.
- **OBS-3.** Un `timestamp` en el futuro respecto al reloj del servidor hace que el siguiente mensaje con un `timestamp` menor se descarte como desordenado. No es realista: todos los `timestamp` los pone Meta y son crecientes por cliente.
- **OBS-4.** Un segundo "1" (otro id) justo después de confirmar abre una conversación nueva y recibe el saludo. El personal recibe un solo aviso.
- **OBS-5.** Comportamientos documentados:
  - firma en hex con mayúsculas → aceptada;
  - JSON con BOM UTF-8 → 200;
  - HEAD → 403 (lo atiende la verificación GET);
  - OPTIONS → 200;
  - `#3` y `3.` cuentan como números (diseño de `parseNumber`).
- **OBS-6.** `docker compose run --build test` reconstruyó la etiqueta `restaurante:test` del propio proyecto (igual que en la implementación). No hice *prune* ni toqué otras imágenes.

### Regresión

Las landings son idénticas byte a byte a `main`. `/admin` responde igual con y sin el bot (503 sin usuarios). La suite completa y las de `price`, `visible-menu`, `landing-snapshot` y las de admin están en verde. Ningún archivo de `src/` importa de `tests/`.

### Responsive

No aplica: no hay cambios visuales, y la comparación byte a byte lo garantiza.

### Accesibilidad

No aplica, por el mismo motivo.

### UX/UI

Conversación revisada con `bot:chat`: mensajes breves y opciones numeradas, y los textos salen del contenido de cada negocio.

### Performance

El 200 llega en 24 ms con el procesamiento en segundo plano. El 413 por `Content-Length` sale en 1 ms sin leer el cuerpo. La ráfaga de 200 entregas no da errores y la memoria queda acotada: 1000 conversaciones, 10 000 ids y 1000 números, verificado.

### SEO

Sin cambios (byte a byte).

### Pendientes de revisión manual

CA-26 (punta a punta con Meta) y la longitud real admitida por la plantilla (OBS-2).

### Resultado final

NEEDS_USER_DECISION

Preguntas:

1. **DEF-001** (MAJOR): el número completo del cliente se queda en memoria en el limitador después de cerrar la conversación, en contra de RN-5. Opciones:
   - **A (recomendada):** corregirlo antes del merge. `senior-fullstack` haría que el limitador olvide las ventanas vencidas (y opcionalmente usaría un HMAC del número como clave), con una prueba; luego QA revalida.
   - **B:** aceptarlo como excepción documentada a RN-5. El número queda solo en memoria, sin logs ni persistencia, hasta un reinicio o hasta que entren 1000 números más.
2. **DEF-002** (TRIVIAL, `bot:chat`): ¿se corrige en la misma ronda que DEF-001 o se deja como está? No bloquea en ningún caso.

### Decisión del usuario y resultado de la ronda 1

Decisión del usuario (2026-10-07). Cita textual: "Corrige DEF-001 con la opción A y también DEF-002".

**Resultado de la ronda 1: QA_REJECTED.** El usuario decidió que DEF-001 (MAJOR) se corrige. DEF-002 se corrige en la misma ronda.

#### Correcciones que debe hacer senior-fullstack

**DEF-001 (opción A).** Archivo: `src/services/whatsapp-bot/store.ts` (`createRateLimiter`) y su uso en `bot.ts`.

1. **Olvidar las ventanas vencidas.** El limitador borra de forma perezosa las ventanas vencidas: las que tienen `now - start >= windowMs`. La limpieza se hace en cada `hit` y también en `receive`, igual que `createExpiringMap` y `session-store`, sin temporizadores. Así, el número de un cliente no permanece en memoria más de unos 60 s después de su último mensaje, aunque no escriba nadie más, siempre que llegue cualquier entrega al webhook.
   - Como la limpieza es perezosa, en un servidor totalmente inactivo la entrada vencida puede quedar hasta la siguiente entrega. Es aceptable, pero el plazo debe medirse con el reloj inyectado (`now`).
2. **Clave seudónima (recomendada, no complica).** El limitador no guarda el número en claro. Usa como clave un HMAC-SHA256 del `wa_id` con una clave aleatoria generada por proceso (`randomBytes(32)` al crear el bot), que no se registra ni se expone.
   - El limitador solo necesita igualdad de claves, así que el cambio es local. Además protege el dato si en el futuro se vuelca la memoria o se depura.
   - Se mantienen el comportamiento actual: 20 mensajes por 60 s, un aviso `bot_rate_limited` por ventana con el número enmascarado (el enmascarado sigue saliendo del `wa_id` en `bot.ts`, no de la clave) y el tope de 1000 entradas.
3. **Prueba que lo verifique** (unitaria o de integración, con el reloj inyectado). Las cuatro cosas que debe comprobar están en "Criterios de aceptación de la corrección" (puntos 1 a 4).
   - El limitador debe exponer algo que permita verificarlo sin reproducir la implementación, por ejemplo `size` o un `has(waId)` de solo lectura.
4. **Sin regresión:** las pruebas existentes de límite por número (orquestador e integración) siguen en verde.

**DEF-002.** Archivo: `scripts/bot-chat.ts` (`fromLocal`).

- `npm run bot:chat -- --ahora <fecha inválida>` muestra un mensaje claro y termina con código 1, **sin traza**. Fechas inválidas: `2026-13-45T99:00`, `2026-02-30T10:00` y `2026-10-06T24:00`.
  - Se recomienda validar el instante (`Number.isNaN`) y los rangos antes de llamar a `toZonedIsoString`, y usar `fail()`, por ejemplo con el texto `Fecha inválida: <valor>`.
- Igual con el comando interactivo `/hora <fecha inválida>`. Hoy pasa por la misma función: aunque sea durante la sesión, debe dar un mensaje claro sin traza. Lo mejor es que la sesión siga abierta; si se cierra, que sea con código 1 y sin traza.
- Los formatos válidos y los mensajes de uso actuales no cambian.

#### Criterios de aceptación de la corrección (los que fija QA)

- **DEF-001**, con el reloj inyectado:
  1. Tras un pedido confirmado y otro cancelado, después de más de 60 s y de una entrega cualquiera de **otro** número, el limitador ya no contiene la entrada del primer cliente.
  2. Si se adopta el HMAC, en el *heap snapshot* no aparece el número completo de ningún cliente cuya conversación esté cerrada, ni siquiera dentro de la ventana de 60 s.
  3. El mensaje 21 dentro de 60 s se sigue ignorando, con un solo `bot_rate_limited`, y el mismo número vuelve a ser atendido después de 60 s.
  4. Con más de 1000 números, el limitador sigue acotado.
- **DEF-002:** las tres fechas inválidas, por `--ahora` y por `/hora`, dan un mensaje claro sin `TypeError`, sin `at …` y sin rutas, y terminan con código 1 cuando es por `--ahora`.

#### Revalidación prevista (ronda 2)

1. Releer el diff de la corrección (`store.ts`, `bot.ts`, `scripts/bot-chat.ts` y las pruebas nuevas) y comprobar que no cambia nada fuera de esos puntos.
2. **DEF-001:**
   - repetir el *heap snapshot* (`qa/heap/heap2.ts` con `retainers.py`) en tres momentos: justo después de cerrar, dentro de los 60 s y pasados 60 s con una entrega de otro número;
   - repetir I-6 (límite y nueva ventana) e I-7 (tope de 1000);
   - comprobar que la clave HMAC no aparece en los logs.
3. **DEF-002:** `bot:chat` con las tres fechas inválidas por `--ahora` y por `/hora` (código de salida y salida sin traza).
4. **Regresión mínima:**
   - `npm run typecheck`, `npm run lint` y `npm test` (con el *preload* deny-meta: 0 intentos);
   - las pruebas temporales del scratchpad, sobre todo el barrido de logs CA-21 y las de idempotencia y límites;
   - `npm run bot:chat` con los escenarios de pedido de Molotes, Birria, lunes y viernes con D-16;
   - `git status`, para confirmar que solo cambian los archivos de la corrección y el ticket.
5. Si la corrección toca algo compartido con las landings, se repite la comparación byte a byte frente a `main`.

### Ronda 2 (revalidación, 2026-10-07)

Correcciones de `senior-fullstack` aprobadas por el usuario (cita textual: "Apruebo la implementación"). Se revalidó lo previsto al cerrar la ronda 1.

#### Qué cambió

Desde el cierre de la ronda 1 solo cambiaron estos archivos (comprobado por fecha de modificación):

- `src/services/whatsapp-bot/store.ts`
- `src/services/whatsapp-bot/bot.ts`
- `scripts/bot-chat.ts`
- `tests/unit/whatsapp-bot-infra.test.ts`
- `tests/unit/whatsapp-bot-orchestrator.test.ts`
- el ticket

`git status` tiene las mismas entradas que al empezar la ronda.

El limitador ahora:

- guarda solo `keyOf(id)`, que en el bot es un HMAC-SHA256 en base64url con una clave `randomBytes(32)` por proceso;
- borra las ventanas vencidas en cada `hit` y en `sweep`, y `receive` llama a `sweep`;
- expone `has` y `size` de solo lectura.

`fromLocal` de `bot-chat.ts` devuelve un mensaje en lugar de lanzar.

No cambió nada compartido con las landings, así que no hacía falta repetir la comparación byte a byte (sigue valiendo la de la ronda 1).

#### Pruebas ejecutadas

| Acción | Resultado |
| --- | --- |
| `npm run typecheck` y `npm run lint` | 0 y 0 |
| `npm test` con el *preload* deny-meta | Código 0: 55 archivos, 972 pasan y 1 "expected fail". *Preload* en 59 procesos, **0** intentos hacia Meta |
| Pruebas temporales del scratchpad (35, con 2 nuevas de DEF-001), con el TZ del sistema y `TZ=UTC`, ambas con deny-meta | 35/35 en las dos; 0 intentos hacia Meta |
| *Heap snapshot* tras `gc()` en tres momentos (`qa/heap/heap3.ts` y `retainers.py`) | Ver DEF-001 |
| `bot:chat` con fechas inválidas, por `--ahora` y por `/hora` | Ver DEF-002 |
| `bot:chat`, 4 escenarios (Molotes, Birria, lunes y viernes con D-16) con deny-meta | Código 0 en todos. Molotes $295, Birria $160, lunes con "FUERA DE HORARIO, abre mañana martes a las 08:30", viernes 16:00 sin pedido y con las dos aperturas. 0 intentos hacia Meta; `data/` sin cambios (mismo hash) |

#### DEF-001: PASS (corregido)

- **Criterio 1.** Pedido confirmado (cliente A) y cancelado (cliente B):
  - dentro de la ventana, `isRateTracked` es true para los dos y `rateTrackedCount` es 2;
  - pasados 61 s y con una entrega de un tercer número, A y B son false y `rateTrackedCount` es 1;
  - pasados otros 61 s, una entrega que **solo trae estados** deja `rateTrackedCount` en 0.
- **Criterio 2.** En el *heap snapshot* hay **0** apariciones de los números completos de A y B, de la dirección y de las notas en los tres momentos: justo tras cerrar, con ventanas vigentes; dentro de los 60 s con otra entrega; y pasados 61 s con otra entrega. En la ronda 1 el mismo script sí encontraba los dos números retenidos por el limitador, así que la búsqueda es sensible.
- **Criterio 3.** I-6 en verde: 20 respuestas en la ventana, 1 solo `bot_rate_limited` con el número enmascarado y vuelve a atender tras 61 s. Otro número no se ve afectado.
- **Criterio 4.** Con 1005 números, las conversaciones quedan acotadas en 1000. El limitador queda acotado en 1000: lo cubre la prueba nueva de `senior-fullstack` con 1100 números, en verde.
- **Clave HMAC fuera de los logs.** Ninguna cadena del tipo HMAC en base64url (43 caracteres) en los logs. El barrido de CA-21 da 1139 líneas, 41 valores sembrados y **0** apariciones; los números siguen enmascarados (`^\*+\d{4}$`).

#### DEF-002: PASS (corregido)

- `--ahora 2026-13-45T99:00`, `2026-02-30T10:00` y `2026-10-06T24:00` → `Fecha inválida: <valor>` y código 1, sin traza.
- `--ahora 2026-10-06` → mensaje de formato y código 1.
- Por `/hora`, las tres fechas → `Fecha inválida: …`, sin `TypeError` ni líneas `at` (0 apariciones). La sesión sigue abierta: `/hora 2026-10-09T16:00` cambia el reloj, "Hola" responde con el saludo de Molotes cerrado y el proceso termina con código 0.

#### Regresión

Suite completa, pruebas temporales (seguridad del webhook, duplicados, configuración, reglas de negocio, fallos de envío, horario y fidelidad con la landing) y `bot:chat` en verde. Los criterios CA-1 a CA-25, CA-27 y CA-28 (con CA-6a y CA-6b) siguen en PASS.

#### Defectos abiertos

Ninguno. Las observaciones OBS-1 a OBS-6 de la ronda 1 siguen anotadas. OBS-2 (longitud de la plantilla) queda para CA-26.

#### Pendientes de revisión manual

CA-26 (punta a punta con Meta, cuando estén los prerrequisitos) y la longitud admitida por la plantilla (OBS-2).

#### Limpieza

No se modificó código ni pruebas. Las pruebas y los scripts temporales viven solo en el scratchpad. No quedan servidores, contenedores ni worktrees. `data/` y `.env` no se tocaron.

#### Resultado final de la ronda 2

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-03). Incorpora:

- las respuestas 1A a 5A ("recomendadas, aun no tengo el número del bot ni la cuenta de meta");
- la propuesta del choque 4 (D-6);
- 9.4 A;
- la reconsideración de 9.3 (D-7);
- los ajustes por REQ-F-010: RF-6.1 y RF-6.3 reescritos, CA-27 y CA-19 concretado;
- P-11 opción A (D-16, RN-6 y CA-28).

Aprobada por el usuario ("apruebo 010 y 009 con P-11 A").

### Revisión técnica T1 (2026-10-06)

`senior-fullstack`: revisión técnica sobre `main` (8006984), con la documentación oficial de Meta consultada el 2026-10-06 (Graph API v26.0; webhooks, firma, payloads, envío, plantillas, ventana de 24 h y límites de interactivos). Technical Action Plan en borrador, que supone las opciones recomendadas. Estado `NEEDS_TECHNICAL_CLARIFICATION` por:

- PT-1, bloqueante: CA-6 es imposible con D-16 y CA-28;
- PT-2: cuándo se evalúa D-16;
- PT-3: fallo asíncrono del aviso al personal;
- PT-4: mensajes viejos reentregados por Meta.

Sin cambios de código.

### Decisiones técnicas del usuario y plan final T1 (2026-10-06)

El usuario responde a la revisión técnica (cita textual: "Recomendadas en PT-1 a PT-4 y autorizo actualizar senior-fullstack.md"):

- PT-1 A: CA-6 se sustituye por CA-6a y CA-6b;
- PT-2 A: D-16 se comprueba solo al empezar el pedido;
- PT-3 A: el fallo tardío del aviso al personal solo se registra; el riesgo de pérdida queda anotado;
- PT-4 A: los mensajes de más de 2 h se ignoran y se registran.

`senior-fullstack` ajusta el Technical Action Plan con estas decisiones y añade el texto propuesto para la definición del agente (parche en el scratchpad durante la implementación). Estado `NEEDS_TECHNICAL_PLAN_APPROVAL`. Sin cambios de código.

### Aprobación del Technical Action Plan e inicio (2026-10-07)

El usuario aprueba el plan (cita textual: "Apruebo el plan"). Rama `feature/REQ-F-009-bot-whatsapp-compartido`; ticket movido a `in-progress/` con estado `IN_PROGRESS`.

### Implementación T2 (2026-10-07)

`senior-fullstack`: implementación del Technical Action Plan en 7 etapas.

- Validación: typecheck y lint con código 0; `npm test` con 965 pruebas en verde y 1 que falla a propósito; `docker compose run --rm test` en verde; build de producción correcto.
- `npm run bot:chat` probado de punta a punta contra el simulador.
- CA-1 a CA-5, CA-6a, CA-6b, CA-7 a CA-25, CA-27 y CA-28 cubiertos. CA-26 sigue pendiente de los prerrequisitos de Meta.
- Parche de `senior-fullstack.md` en el scratchpad.

Estado `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commit.

### Aprobación de la implementación y QA Action Plan Q1 (2026-10-07)

El usuario aprueba la implementación (cita textual: "Apruebo la implementación"). La sesión principal ya aplicó la actualización de `.claude/agents/senior-fullstack.md`, con autorización directa del usuario. En "Implementation Result" queda marcada como aplicada.

`senior-qa` (Q1) analiza el requisito, el diff contra `main` y el blast radius de CodeGraph, y redacta el QA Action Plan. Tiene 8 riesgos a confirmar y pruebas S, I, C, N, M, E, H, P, R y X, más `bot:chat` de punta a punta. Propone, sujeto a aprobación, una prueba permanente nueva: `tests/integration/whatsapp-bot-qa.test.ts`. Sin cambios de código ni ejecución de la batería definitiva. Estado `NEEDS_QA_PLAN_APPROVAL`.

### Ejecución del QA Q2, ronda 1 (2026-10-07)

El usuario aprueba el QA Action Plan (cita textual: "Apruebo el plan"). La prueba permanente propuesta no se aprobó, así que se ejecutó como prueba temporal en el scratchpad.

`senior-qa` ejecuta la batería completa:

- typecheck, lint y `npm test` (más la red de seguridad deny-meta, incluidos los procesos hijo);
- 33 pruebas temporales con 4 zonas horarias del proceso;
- la comparación byte a byte de las landings frente a `main`;
- el servidor real y la ráfaga de carga;
- `bot:chat` (7 escenarios);
- Docker (pruebas e imagen de producción);
- el *heap snapshot*.

CA-1 a CA-25, CA-27 y CA-28 (con CA-6a y CA-6b) pasan con evidencia. CA-26 sigue pendiente.

Defectos: DEF-001 (MAJOR: el número completo del cliente queda en memoria en el limitador tras cerrar, en contra de RN-5) y DEF-002 (TRIVIAL: traza en `bot:chat` con una fecha imposible). Estado `NEEDS_USER_DECISION`.

No se modificó código ni pruebas. El worktree, los contenedores y la imagen temporal se eliminaron, y `git status` solo difiere del inicio por este ticket.

### Decisión sobre los defectos de la ronda 1 de QA (2026-10-07)

El usuario decide (cita textual): "Corrige DEF-001 con la opción A y también DEF-002".

`senior-qa` registra la decisión en el QA Report, las correcciones que debe hacer `senior-fullstack` y sus criterios de aceptación:

- DEF-001: el limitador olvida las ventanas vencidas (unos 60 s), usa como clave un HMAC con una clave aleatoria por proceso y lleva una prueba que lo verifique.
- DEF-002: una fecha inválida en `bot:chat` da un mensaje claro, código 1 y ninguna traza.

También registra la revalidación prevista para la ronda 2. Estado `QA_REJECTED`. Sin cambios de código.

### Correcciones T3, ronda 1 (2026-10-07)

`senior-fullstack`: corrige DEF-001 con la opción A y DEF-002 (cita del usuario: "Corrige DEF-001 con la opción A y también DEF-002").

- DEF-001: el limitador guarda un HMAC-SHA256 con una clave aleatoria por proceso, limpia de forma perezosa en `hit` y en cada entrega, y tiene pruebas con el reloj inyectado.
- DEF-002: `bot:chat` valida las fechas de `--ahora` y `/hora` sin trazas.
- typecheck y lint con código 0; `npm test` con 972 pruebas en verde y 1 que falla a propósito.

Estado `NEEDS_IMPLEMENTATION_APPROVAL`. Sin commit.

### QA Q2, ronda 2 (2026-10-07)

El usuario aprueba las correcciones de DEF-001 y DEF-002 (cita textual: "Apruebo la implementación"). `senior-qa` revalida:

- el diff, limitado a `store.ts`, `bot.ts`, `bot-chat.ts` y las pruebas;
- DEF-001, con *heap snapshot* en tres momentos, límite por número, tope y la clave HMAC fuera de los logs;
- DEF-002, por `--ahora` y por `/hora`;
- typecheck, lint y `npm test` (972, con deny-meta y 0 intentos hacia Meta), las pruebas temporales con el barrido de logs y `bot:chat` en 4 escenarios.

Los dos defectos quedan corregidos y no hay regresiones. CA-26 sigue pendiente de los prerrequisitos de Meta. Estado `QA_APPROVED`.

### Validación previa al commit T4 (2026-10-07)

`senior-fullstack`: antes del commit se repitieron `db:generate`, `build:css`, `typecheck`, `lint` y `npm test` sobre la rama, que parte de `origin/main` (8006984).

- Una ejecución de `npm test` falló de forma intermitente: `ECONNRESET` en la prueba del 413 del webhook (`tests/integration/whatsapp-webhook.test.ts`). Con supertest y un cuerpo real de más de 3 MiB, el servidor responde 413 y corta la conexión mientras el cliente aún escribe.
- Corrección, solo en la prueba (sin cambios en `src/`): la petición declara `Content-Length` mayor que el límite y envía solo el principio del cuerpo, así que la app responde 413 por la longitud declarada. La aserción no cambia (413).
- Resultado: la prueba pasa en 3 de 3 ejecuciones del archivo, y `npm test` pasa en 3 de 3 ejecuciones completas (972 pruebas en verde y 1 que falla a propósito). typecheck y lint con código 0.

### Commit y Pull Request T4 (2026-10-07)

`senior-fullstack`: la rama parte de `origin/main` (8006984).

- Validación: `db:generate`, `build:css`, typecheck y lint con código 0; `npm test` con 972 pruebas en verde y 1 que falla a propósito, en 3 de 3 ejecuciones.
- Commit `a529310`, con rutas explícitas: código, contenido, pruebas, fixtures, documentación, `.claude/agents/senior-fullstack.md` (autorizado por el usuario) y el ticket.
- PR #30 (https://github.com/orvigas/negocio/pull/30) contra `main`.
- CI del commit `a529310` en verde (run 37652819800): `calidad` y `docker`.

Estado `READY_FOR_MERGE`.

### Cierre T5

2026-10-07, `senior-fullstack`. El usuario confirma el merge del PR #30 (cita textual: "Merge hecho"). Mergeado el 2026-10-07T16:40:45Z (10:40 del 2026-10-07, hora de Ciudad de México); commit de merge `1c5c43e`. El push a `main` de `1c5c43e` pasó el CI con `calidad` y `docker` en verde: https://github.com/orvigas/negocio/actions/runs/37653936440. El ticket pasa de `in-progress/` a `done/`. Estado: `DONE`.

Queda como seguimiento CA-26: la prueba de punta a punta con Meta real, incluida la comprobación de la longitud que acepta la plantilla del aviso al personal. Depende de los prerrequisitos de Meta del usuario (ver "Prerrequisitos para la QA de punta a punta") y no bloquea el cierre.
