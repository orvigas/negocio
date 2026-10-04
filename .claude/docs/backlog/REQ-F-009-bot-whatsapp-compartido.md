# REQ-F-009 — Bot de WhatsApp compartido para Molotes y Birria El Muñeco

## Estado

APPROVED

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
