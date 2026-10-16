# REQ-F-035 — Forma de pago en el bot de WhatsApp

## Estado

DONE

Pull Request: https://github.com/orvigas/negocio/pull/71

## Aprobación

Aprobado por el usuario (versión 2 de la propuesta, con la opción (a) para el comprobante; fecha 2026-10-16). Respuesta textual: "Te doy permiso de que tu cambies el número y apruebo". "Apruebo" se refiere a esta propuesta. "Cambies el número" se refiere a la configuración del número del personal en el VPS, que lleva la sesión principal y está fuera del alcance de este ticket.

## Objetivo

Que el cliente elija cómo va a pagar antes de confirmar su pedido en el bot. Si elige transferencia, recibe:

- los datos de la cuenta;
- la indicación de usar su código de pedido como concepto;
- la indicación de enviar el comprobante, o la referencia bancaria, al personal para validar el pago.

El personal ve en el aviso del pedido cómo le pagarán.

## Alcance

- Flujo del bot de WhatsApp de Molotes y de Birria El Muñeco.
- Resumen del pedido y mensaje final de confirmación.
- Aviso al personal (plantilla de Meta, Content Template de Twilio y texto libre), sin cambiar el cuerpo de las plantillas.
- Datos bancarios configurables en un único lugar.
- Textos del bot, README y pruebas.

## Fuera de alcance

- Cobro en línea y validación automática de pagos.
- Recepción por el bot de comprobantes o referencias, y su reenvío al personal.
- Plantillas nuevas de Meta o Twilio.
- Cambiar la forma de pago desde el resumen.
- Cambios en las landing pages.
- Configurar en el VPS el número del personal (527351599988), que lo hace la sesión principal.

## Decisiones del usuario

1. El banco es "Mercado Pago W".
2. A domicilio, "pagar al recibir" es genérico: no se pregunta si es en efectivo o con tarjeta.
3. Aplica a Molotes y a Birria, con la misma cuenta.
4. En una transferencia a domicilio, el cliente espera a que el personal le confirme el total con envío antes de transferir.
5. "Visible todo el tiempo" significa que el código y los datos bancarios aparecen en el resumen y se repiten en el mensaje final de confirmación. No hace falta que el cliente pueda volver a pedírselos al bot.
6. El comprobante se envía al WhatsApp del personal del negocio, tomado de la configuración existente.
7. Aviso al personal, opción B: el pago va dentro del campo de entrega existente. No se crea una plantilla nueva.
8. Se acepta el pago escrito junto con los datos (p. ej. "Ana, recoger, efectivo").
9. En una transferencia fuera de horario se muestran los datos y se avisa al cliente que espere la confirmación del personal.
10. Opción (a) del comprobante: el bot solo da la instrucción. El cliente envía al personal la captura del comprobante de su banca móvil o, si no puede enviar la imagen, la referencia o clave de rastreo de su banco junto con su código.

## Requisitos

### RF-1 Pregunta de forma de pago

- **RF-1.1** El bot pregunta la forma de pago después de tener el nombre, la entrega y, si es a domicilio, una dirección válida, y antes del resumen.
- **RF-1.2** Las opciones van en una lista numerada con el formato de REQ-F-029 (`*1.*`):
  - Recoger en sucursal: *1.* Efectivo, *2.* Tarjeta, *3.* Transferencia.
  - A domicilio: *1.* Pagar al recibir, *2.* Transferencia.
- **RF-1.3** Además del número, se aceptan las palabras "efectivo", "tarjeta", "transferencia" y "al recibir", siempre que sean válidas para la entrega elegida.
- **RF-1.4** Ante una respuesta no válida, o un método incompatible con la entrega, el bot avisa y repite la pregunta sin avanzar.
- **RF-1.5** Las palabras clave globales (menú, carrito, cancelar, persona, ayuda) siguen funcionando en este paso.

### RF-2 Pago escrito junto con los datos

- **RF-2.1** Si el mensaje con los datos de entrega trae también una forma de pago válida para esa entrega, el bot la toma y no hace la pregunta.
- **RF-2.2** Si el método no es válido para la entrega, el bot no lo toma y hace la pregunta de RF-1.
- **RF-2.3** El texto que pide los datos menciona la forma de pago e incluye un ejemplo con ella.

### RF-3 Coherencia entre entrega y pago

Si la entrega cambia antes del resumen y el método elegido ya no es válido, se descarta y el bot vuelve a preguntar.

### RF-4 Resumen

- **RF-4.1** El bloque de datos del resumen incluye el renglón "Pago: <método>".
- **RF-4.2** Con transferencia, el resumen incluye un bloque con:
  1. Beneficiario (Orlando Villegas Galan), Banco (Mercado Pago W), CLABE (722969010833880068) y "Concepto: <código del pedido>". El código es el mismo que el del título del resumen.
  2. La indicación de usar el código como concepto.
  3. La indicación de validar el pago: enviar al WhatsApp del personal del negocio (enlace configurado) la captura del comprobante que genera la banca móvil o, si no se puede enviar la imagen, escribirle la referencia o clave de rastreo que da el banco, junto con el código del pedido.
  4. A domicilio o fuera de horario: esperar a que el personal confirme el total (con envío, si aplica) antes de transferir.
- **RF-4.3** Sin transferencia no aparecen los datos bancarios ni la indicación del comprobante.

### RF-5 Confirmación

Con transferencia, el mensaje final de confirmación ("¡Listo! Tu pedido *{codigo}* fue enviado…") repite el bloque completo de RF-4.2, incluida la indicación del comprobante o la referencia con el enlace del personal. Con los demás métodos, el mensaje no cambia.

### RF-6 Aviso al personal

- **RF-6.1** El campo de entrega del aviso lleva el método de pago:
  - "Recoger en sucursal · Pago: <efectivo | tarjeta | transferencia>"
  - "A domicilio: <dirección> · Pago: <pagar al recibir | transferencia>"
- **RF-6.2** Aplica a la plantilla de Meta, al Content Template de Twilio y al aviso en texto libre. El cuerpo de las plantillas (`nuevo_pedido`) no cambia.
- **RF-6.3** Si el aviso supera los 1024 caracteres y hay que recortar el campo de entrega, se recorta la dirección y nunca la parte "Pago: …".

### RF-7 Configuración y contenido

- **RF-7.1** Los datos bancarios (beneficiario, banco y CLABE) se editan en un único lugar, común a ambos negocios, sin tocar el flujo ni los textos.
- **RF-7.2** Los textos nuevos viven junto con el resto de los textos del bot.
- **RF-7.3** El destino del comprobante es el contacto del personal ya configurado por negocio (`WHATSAPP_BOT_STAFF_MOLOTES` / `WHATSAPP_BOT_STAFF_BIRRIA`). Ningún número se escribe en un texto.

### RF-8 Sin cobro ni validación automática

El bot no cobra, no valida pagos y no recibe comprobantes ni referencias. Una imagen enviada al bot sigue recibiendo la respuesta actual de "solo texto". El personal valida el pago con lo que el cliente le envía directamente.

## Historias de usuario

- **HU-1.** Como cliente que recoge, quiero elegir pagar en efectivo, con tarjeta o por transferencia, para preparar mi pago.
- **HU-2.** Como cliente a domicilio, quiero indicar si pago al recibir o por transferencia, para que el repartidor sepa qué esperar.
- **HU-3.** Como cliente que transfiere, quiero ver la CLABE y mi código como concepto en el resumen y en la confirmación, para transferir sin errores.
- **HU-4.** Como personal, quiero ver la forma de pago en el aviso del pedido, para saber si espero una transferencia o cobro al entregar.
- **HU-5.** Como personal, quiero que el cliente que transfiere me mande el comprobante o la referencia bancaria con su código, para validar el pago y relacionarlo con su pedido.

## Reglas de negocio

- **RN-1.** Métodos válidos según la entrega: recoger, {efectivo, tarjeta, transferencia}; a domicilio, {pagar al recibir, transferencia}.
- **RN-2.** No se llega al resumen sin una forma de pago.
- **RN-3.** El concepto de la transferencia es siempre el código del pedido, el mismo en el resumen, la confirmación y el aviso al personal.
- **RN-4.** A domicilio o fuera de horario, se transfiere solo después de la confirmación del personal. Al recoger dentro del horario, se puede transferir el total mostrado.
- **RN-5.** Una sola cuenta para ambos negocios.
- **RN-6.** La prueba de pago de una transferencia se entrega al personal por su WhatsApp, no al bot. La captura del comprobante es preferente; la alternativa es la referencia o clave de rastreo del banco junto con el código.

## Criterios de aceptación

1. **CA-1.** Given un carrito y la entrega "recoger", When el cliente da su nombre, Then el bot pregunta el pago con exactamente 3 opciones: Efectivo, Tarjeta y Transferencia.
2. **CA-2.** Given la entrega "a domicilio" con una dirección válida, Then el bot pregunta el pago con exactamente 2 opciones: Pagar al recibir y Transferencia.
3. **CA-3.** Given la pregunta de pago, When el cliente responde "5", "hola" o "tarjeta" (estando a domicilio), Then el bot avisa y repite la pregunta, y no pasa al resumen.
4. **CA-4.** Given la pregunta de pago, When el cliente escribe "efectivo" (recoger) o "2" (domicilio), Then el resumen muestra "Pago: Efectivo" o "Pago: Transferencia", respectivamente.
5. **CA-5.** Given el carrito tras el aviso de privacidad, When el cliente escribe "Ana, recoger, efectivo", Then el bot muestra el resumen sin preguntar el pago, con Ana, recoger y Efectivo.
6. **CA-6.** Given "Ana, domicilio, Calle 5 #10, Centro, tarjeta", Then el bot no toma "tarjeta" y pregunta el pago con las opciones de domicilio.
7. **CA-7.** Given el pago "tarjeta" con recoger, When la entrega cambia a domicilio antes del resumen, Then el bot vuelve a preguntar el pago con las opciones de domicilio.
8. **CA-8.** Given transferencia con recoger y dentro del horario, Then el resumen contiene:
   - Beneficiario Orlando Villegas Galan, Banco Mercado Pago W y CLABE 722969010833880068;
   - "Concepto: <código>", igual al código del título;
   - la indicación de enviar al enlace del personal del negocio la captura del comprobante de la banca móvil o, si no se puede enviar la imagen, la referencia o clave de rastreo del banco junto con el código.
9. **CA-9.** Given una transferencia a domicilio, Then el resumen incluye lo de CA-8 y la indicación de esperar a que el personal confirme el total con envío antes de transferir.
10. **CA-10.** Given una transferencia fuera de horario, Then el resumen incluye los datos bancarios, la indicación del comprobante o la referencia, y la de esperar la confirmación del personal.
11. **CA-11.** Given un pedido confirmado con transferencia, Then el mensaje de confirmación contiene el código, los datos bancarios, el concepto, la indicación del comprobante o la referencia con el enlace del personal, y las indicaciones de CA-9 y CA-10 que correspondan.
12. **CA-12.** Given efectivo, tarjeta o pagar al recibir, Then ni el resumen ni la confirmación contienen la CLABE ni la indicación del comprobante.
13. **CA-13.** Given un pedido confirmado, Then el campo de entrega del aviso al personal (Meta, Twilio y texto libre) termina en "· Pago: <método>". El cuerpo de la plantilla `nuevo_pedido` no cambia, y la prueba que la compara con el README sigue pasando.
14. **CA-14.** Given una dirección de 200 caracteres, el nombre y las notas al máximo y un pedido largo, Then el aviso al personal mide como máximo 1024 caracteres y conserva "Pago: <método>" completo.
15. **CA-15.** Given que se cambian los datos bancarios en su único lugar de configuración o contenido, Then el resumen y la confirmación muestran los nuevos sin otros cambios.
16. **CA-16.** Given que cambian `WHATSAPP_BOT_STAFF_MOLOTES` o `WHATSAPP_BOT_STAFF_BIRRIA`, Then el enlace de la indicación del comprobante cambia. Ningún texto contiene un número fijo.
17. **CA-17.** Los CA-1 a CA-14 se cumplen para Molotes y para Birria.
18. **CA-18.** Todos los mensajes nuevos respetan el formato de REQ-F-029 (ancho de renglón y listas `*1.*`) y el límite de mensaje de cada proveedor.
19. **CA-19.** Given un pedido confirmado con transferencia, When el cliente envía una imagen o un texto al bot, Then el bot se comporta como hoy: imagen → "solo texto"; texto → nueva conversación. El bot no registra la referencia ni la reenvía al personal.

## Casos límite

- Palabras clave globales durante la pregunta de pago.
- Cambio de precios entre el resumen y el "sí" (D-13): el resumen actualizado repite el bloque de transferencia con el total nuevo.
- El código lleva guion (`B-XXXX` / `M-XXXX`) y se usa como concepto. Con 4 caracteres aleatorios puede repetirse entre días.
- Si el cliente envía la captura o la referencia al bot en vez de al personal, el bot no la procesa. Las indicaciones de RF-4.2 y RF-5 lo dirigen al personal con un enlace directo.
- Un cliente sin posibilidad de hacer la captura usa la referencia escrita.
- Un mensaje con productos, datos y pago a la vez sigue la regla actual de "dataOrProducts".
- En el resumen, un texto como "efectivo" se toma como nota, igual que hoy con la entrega.

## Dependencias

- Contacto del personal configurado en producción (`WHATSAPP_BOT_STAFF_*`). El cambio al número 527351599988 lo hace la sesión principal en el VPS.
- Formato de textos de REQ-F-029 y presupuesto del aviso al personal de REQ-F-013 (DT-1).
- Sin conflicto con REQ-F-033 ni con REQ-F-034.

## Riesgos

- El cliente no usa el código como concepto o no envía la prueba de pago. Mitigación: indicaciones explícitas en el resumen y la confirmación, con enlace directo al personal.
- El cliente envía la prueba al bot por costumbre. Mitigación: el enlace al personal en el último mensaje.
- El bloque de transferencia alarga los mensajes. Debe cumplir CA-18.
- Coincidencia de códigos entre pedidos de días distintos.
- El personal lee el pago dentro de "Forma de entrega" (opción B aceptada).
- Un turno más en el flujo. Lo mitiga RF-2.

## Action Plan

### Objetivo

Pregunta de pago en el bot; datos de transferencia con el código como concepto e indicación de enviar el comprobante o la referencia al personal; método de pago en el aviso al personal.

### Alcance

Ver "Alcance".

### Fuera de alcance

Ver "Fuera de alcance".

### Cambios requeridos

1. Un único lugar común para los datos bancarios.
2. Textos:
   - pregunta y opciones por entrega;
   - error;
   - renglón "Pago:";
   - bloque de transferencia: datos, concepto, indicación del comprobante o la referencia al enlace del personal, y espera de confirmación a domicilio o fuera de horario;
   - texto que pide los datos, con un ejemplo que incluya el pago.
3. Paso de pago tras la entrega o la dirección y antes del resumen.
4. Pago reconocido en el mensaje de datos, y descarte del pago incompatible al cambiar la entrega.
5. Renglón de pago y bloque de transferencia en el resumen.
6. Bloque de transferencia completo en la confirmación.
7. "· Pago: …" en el campo de entrega del aviso al personal, sin perderlo en los recortes.
8. README: flujo del bot, campo de entrega e indicación del comprobante.

### Reglas de negocio

RN-1 a RN-6.

### UX/UI

Formato de REQ-F-029. Cada dato bancario en su renglón, con la CLABE sola para poder copiarla. La indicación del comprobante va en pocas líneas, con el enlace del personal en su propio renglón.

### Integraciones

Ninguna nueva. Las plantillas de Meta y Twilio no cambian.

### Casos límite

Ver "Casos límite".

### Criterios de aceptación

CA-1 a CA-19.

### Dependencias

Configuración del personal en el VPS.

### Riesgos

Ver "Riesgos".

### Orden recomendado

1. Datos bancarios y textos.
2. Paso de pago y validación según la entrega.
3. Pago junto con los datos y coherencia con la entrega.
4. Resumen y confirmación.
5. Aviso al personal y presupuesto de 1024 caracteres.
6. Pruebas de ambos negocios.
7. README.

### Resultado esperado

Todo pedido confirmado tiene una forma de pago válida para su entrega. Con transferencia, el cliente tiene en el chat:

- la CLABE, el beneficiario y el banco;
- su código como concepto;
- cuándo transferir;
- la instrucción de mandar al personal la captura del comprobante o, si no puede, la referencia bancaria con su código.

El personal ve el método en el aviso y valida el pago con lo que recibe en su WhatsApp.

## Trazabilidad

| Objetivo                  | Requisitos       | Historias  | Criterios                          |
| ------------------------- | ---------------- | ---------- | ---------------------------------- |
| Pago según la entrega     | RF-1, RF-2, RF-3 | HU-1, HU-2 | CA-1 a CA-7                        |
| Datos de transferencia    | RF-4, RF-5, RF-7 | HU-3, HU-5 | CA-8 a CA-12, CA-15, CA-16, CA-19  |
| Aviso al personal         | RF-6             | HU-4       | CA-13, CA-14                       |
| Ambos negocios            | Alcance          | —          | CA-17                              |
| Formato                   | REQ-F-029        | —          | CA-18                              |

`_stich_source_/` no aplica, porque el bot no tiene diseño en Stitch.

## Technical Action Plan

Revisión técnica hecha contra `main` (los archivos del bot no cambian en la rama de REQ-F-033). Sin bloqueos: todos los criterios son implementables sin persistencia nueva, sin dependencias y sin tocar las plantillas `nuevo_pedido` de Meta y Twilio.

### Objetivo técnico

Agregar el paso `payment` a la conversación del bot (`src/services/whatsapp-bot/`), con la forma de pago validada contra la entrega (RN-1), reconocerla dentro del mensaje de datos, mostrarla en el resumen y la confirmación (con el bloque de transferencia y el enlace del personal) y añadirla al parámetro `entrega` del aviso al personal sin perderla en los recortes de 1024 caracteres.

### Archivos o componentes afectados

- `src/content/common/payment.ts` (nuevo): datos bancarios comunes (`beneficiary`, `bank`, `clabe`), único lugar de edición (RF-7.1, RN-5).
- `src/content/common/bot.ts`: textos nuevos en `botText` (pregunta, opciones, avisos de método no válido, renglón `Pago:`, bloque de transferencia, espera de confirmación, `staffPayment`), `askData` con el pago y su ejemplo (RF-2.3), y `botVocabulary.payment` (palabras por método).
- `src/content/bot.ts`: reexporta los datos bancarios.
- `src/services/whatsapp-bot/payment.ts` (nuevo, pequeño): tipo `PaymentMethod` (`'cash' | 'card' | 'transfer' | 'onDelivery'`), `PAYMENT_OPTIONS` por entrega (`pickup: cash, card, transfer`; `delivery: onDelivery, transfer`) e `isPaymentValid(method, delivery)`. Regla de negocio en código, no en contenido.
- `src/services/whatsapp-bot/interpreter/types.ts` y `interpreter/customer-data.ts`: `CustomerDataInterpretation.payment?` (el método reconocido; la validez la decide la conversación).
- `src/services/whatsapp-bot/conversation.ts`: `Step` + `'payment'`, `Customer.payment?`, `prompt()`, `askNext()`, `applyData()`, `handlePayment()`, guarda en `handleConfirm()`, `buildOrder()` y `showSummary()` (pasa el contacto del personal).
- `src/services/whatsapp-bot/messages.ts`: `OrderDetails.payment`, `paymentPrompt(delivery)`, `transferBlock(order, contact, account = bankAccount)`, `summary(order, contact)`, `confirmedMessage(order, contact)`, `buildStaffTemplate` (parámetro `entrega` y recorte solo de la dirección).
- `src/services/whatsapp-bot/orchestrator.ts`: `confirmedMessage(order, staffContact(order.business))`.
- `README.md` de `restaurante/`: flujo del bot, paso de pago, ejemplo del parámetro `entrega`, orden de recorte (la dirección, nunca "Pago: …") y dónde se editan los datos bancarios.
- Pruebas (ver "Testing") y fixtures dorados `tests/fixtures/bot-golden/{flow,template}.json`.

### Cambios requeridos

**Contenido / configuración**

1. `payment.ts`: `export const bankAccount = Object.freeze({ beneficiary: 'Orlando Villegas Galan', bank: 'Mercado Pago W', clabe: '722969010833880068' })`. Decisión técnica: contenido versionado (como `hours.ts`), no variable de entorno: no es secreto (se muestra a cualquier cliente), el repositorio es privado y CLAUDE.md §7 pide separar el contenido común. Una prueba valida la CLABE (18 dígitos y dígito verificador; el valor actual es válido).
2. Textos (REQ-F-029: renglones estructurados ≤ 28, listas `*1.*`, emojis permitidos como mucho dos por renglón, contacto solo en su renglón). Borrador, sujeto a ajuste fino de redacción en T2:
   - `askPayment`: `💳 ¿Cómo vas a pagar?` + opciones generadas desde `PAYMENT_OPTIONS` con `listItem` (Efectivo, Tarjeta, Transferencia / Pagar al recibir, Transferencia).
   - `paymentNotFor`: por entrega ("A domicilio puedes pagar al recibir o por transferencia." / "Al recoger puedes pagar en efectivo, con tarjeta o por transferencia."), seguido de la pregunta.
   - `paymentLabels` (cliente, con mayúscula) y `staffPaymentLabels` (personal, en minúscula: efectivo, tarjeta, transferencia, pagar al recibir), sin emojis en los del personal.
   - `summaryFields.payment: 'Pago:'` con ícono 💳.
   - Bloque de transferencia (cada dato en su renglón y la CLABE sola para copiarla): `🏦 *Datos para transferir*`, `Beneficiario:` / nombre, `Banco: …`, `CLABE:` / número, `Concepto: *{codigo}*`; párrafo "Usa tu código como concepto"; párrafo del comprobante (captura de la banca móvil o, si no puedes enviar la imagen, la referencia o clave de rastreo, con tu código) con `{contacto}` solo en su renglón; y, a domicilio o fuera de horario, `transferWait` ("Espera a que el personal te confirme el total (con envío) antes de transferir."); al recoger en horario, "Puedes transferir el total de tu pedido." (RN-4).
   - `staffPayment: '{entrega} · Pago: {pago}'`.
   - `askData`: renglón `- 💳 forma de pago` y ejemplos `*Ana, recoger, efectivo*` y `*Ana, domicilio, Calle 5 #10, Centro, transferencia*`.
   - `botVocabulary.payment` normalizado: `cash: ['efectivo', 'en efectivo']`, `card: ['tarjeta', 'con tarjeta']`, `transfer: ['transferencia', 'por transferencia']`, `onDelivery: ['al recibir', 'pagar al recibir', 'pago al recibir']`.
   - Emojis nuevos 💳 y 🏦: se agregan a la lista permitida de `whatsapp-bot-format.test.ts`.

### Backend

**Paso de pago (RF-1, RN-2)**

- `askNext()`: tras nombre, entrega y dirección, si `customer.payment` falta o no es válido para la entrega, `step = 'payment'` y se envía la pregunta con las opciones de esa entrega. Si no, resumen.
- `handlePayment()`: número dentro del rango de `PAYMENT_OPTIONS[delivery]` → método; si no, el mensaje completo normalizado (también sin cortesía, con `withoutCourtesy`) contra `botVocabulary.payment`. Método reconocido pero incompatible → `paymentNotFor` + pregunta (CA-3 "tarjeta" a domicilio). Nada reconocido ("5", "hola") → `invalidNumber` + pregunta. Si el mensaje trae una palabra de entrega (`customerData` con `delivery`), se aplica con `applyData` (el cliente corrige la entrega en este paso; habilita CA-7). Las palabras clave globales se atienden antes en `handleText` (RF-1.5, sin cambios).
- `prompt()` devuelve la pregunta del paso `payment` (ayuda y entradas no válidas).

**Pago dentro de los datos (RF-2) y coherencia (RF-3)**

- `interpretCustomerData`: antes de buscar la palabra de entrega se quitan los segmentos (separados por `,`, `;` o `.`) cuyo texto normalizado, sin cortesía, es exactamente una frase de `botVocabulary.payment`, y se devuelve `payment`. Coincidencia exacta del segmento entero para no confundir direcciones ("Av. Transferencia 10" no cuenta). Solo se devuelve `payment` si hay palabra de entrega (como hoy, sin ella el resultado es `{}`). Así "Ana, recoger, efectivo" da nombre, recoger y efectivo sin nota (CA-5), y "Ana, domicilio, Calle 5 #10, Centro, tarjeta" da la dirección sin "tarjeta" y `payment: 'card'` (CA-6).
- `applyData`: al cambiar la entrega, si el pago guardado ya no es válido se borra (RF-3, CA-7). Un `payment` recibido se guarda solo si es válido para la entrega resultante; si no, se descarta y `askNext` antepone `paymentNotFor` a la pregunta (RF-2.2, CA-6).
- `handleDataOrProducts` (opción 2) y `handleName` usan `applyData`, así que heredan el comportamiento.
- `handleConfirm`: antes de pasar a `sending`, si falta un pago válido se vuelve a `askNext()` (mismo patrón que la dirección de CA-13; defensa de RN-2). En el resumen, "efectivo" sigue siendo una nota (caso límite del ticket).

**Resumen y confirmación (RF-4, RF-5)**

- `OrderDetails.payment: PaymentMethod` (obligatorio); `buildOrder()` lo toma de `customer.payment` (la guarda de `handleConfirm` y `askNext` garantizan que existe; el tipo se estrecha con una comprobación explícita, sin `!`).
- `summary(order, contact)`: renglón `💳 *Pago:* <método>` en el bloque de datos; con transferencia, el bloque de transferencia después del total/datos y del aviso de fuera de horario, antes de `confirmPrompt`. `showSummary` pasa `ctx.staffContact(business)`. El código del concepto es `order.code`, el mismo del título (RN-3); con D-13 el resumen actualizado vuelve a incluir el bloque.
- `confirmedMessage(order, contact)`: con transferencia agrega el mismo `transferBlock` (una sola función para resumen y confirmación, DRY); con los demás métodos el texto no cambia (CA-12). `staffFailedMessage` y `orderCapContactMessage` no cambian (el pedido no se envió; fuera del alcance de RF-5).

**Aviso al personal (RF-6)**

- `buildStaffTemplate`: `entrega = fill(botText.staffPayment, { entrega: deliveryText(order), pago: staffPaymentLabels[order.payment] })`. Mismo valor en Meta (parámetros con nombre), Twilio (Content Template, variable `{{6}}`) y texto libre (`staffNoticeText` reutiliza los parámetros). `STAFF_TEMPLATE_BODY` no cambia.
- Recorte (RF-6.3): en el último recurso de `FREE_TEXT_PARAMS`, el turno de `entrega` recorta solo la dirección con `clip` y reconstruye el valor, de modo que " · Pago: …" queda completo. Con "recoger" no hay nada que recortar en `entrega` y se pasa al nombre. El presupuesto de `lineas` ya descuenta el largo real de `entrega` (≈ 25 caracteres más), así que DT-1 sigue funcionando sin cambios.

### Validaciones

- Número de opción solo dentro del rango de la entrega; palabras como mensaje completo; validez siempre contra `PAYMENT_OPTIONS` (fail fast con aviso y repetición de la pregunta).
- Ningún número de teléfono en textos: el enlace sale de `staffContact` (`WHATSAPP_BOT_STAFF_*` validados en `env.ts`) (RF-7.3, CA-16).

### Manejo de errores

Sin errores nuevos: las entradas no válidas son turnos de conversación. Los textos y la CLABE nunca van al log; los logs existentes no cambian (solo contadores).

### Testing

Unitarias (Vitest, sin red; dobles de Meta y Twilio existentes):

- `whatsapp-bot-interpreter.test.ts`: `customerData` con pago en cualquier segmento, segmento exacto (dirección con la palabra dentro no cuenta), sin palabra de entrega → `{}`, cortesía.
- `whatsapp-bot-conversation.test.ts` / `whatsapp-bot-free-text.test.ts` (o un archivo nuevo `whatsapp-bot-payment.test.ts`, para ambos negocios con `it.each(BUSINESS_IDS)`, CA-17): CA-1, CA-2 (número exacto de opciones), CA-3 ("5", "hola", "tarjeta" a domicilio), CA-4, CA-5, CA-6, CA-7 (cambio de entrega desde el paso de pago y desde el paso de nombre), palabras clave en el paso de pago, guarda de `handleConfirm`, D-13 con transferencia.
- `whatsapp-bot-format.test.ts`: CA-8 a CA-12 sobre `summary` y `confirmedMessage` (datos bancarios, `Concepto:` igual al código del título, enlace del personal en su renglón, espera a domicilio y fuera de horario, ausencia con efectivo/tarjeta/al recibir); CA-15 con una cuenta alternativa inyectada en `transferBlock`; CA-16 con dos contactos distintos y sin dígitos de teléfono en `botText`; CA-18: ancho ≤ 28 de los renglones estructurados nuevos, emojis permitidos, partición con `TWILIO_MAX_TEXT_CHARS` de un resumen de 15 líneas con transferencia sin cortar el bloque; confirmación ajustada a la nueva firma.
- Aviso al personal: CA-13 (`entrega` termina en "· Pago: <método>" en parámetros de Meta, en Twilio y en `staffNoticeText`; la prueba README ↔ `STAFF_TEMPLATE_BODY` sigue igual) y CA-14 (dirección de 200, nombre 60, notas 200 y 15 líneas largas, incluidos emojis → ≤ 1024 y "Pago: <método>" completo).
- Contenido: CLABE válida (18 dígitos y dígito verificador); `botVocabulary.payment` normalizado (la prueba de vocabulario existente).
- CA-19: tras un pedido confirmado con transferencia, imagen → "solo texto" y texto → conversación nueva (orquestador con el doble).

Integración: `chat-bot-contract.test.ts` (Meta y Twilio) recorre un pedido con transferencia; se actualizan `chat-bot-message-count.test.ts`, `whatsapp-bot-qa-req-f-013`, `bot-protection-qa-req-f-025`, `whatsapp-webhook`, `whatsapp-twilio-qa-round1` y `bot-chat` donde un flujo llega al resumen (agregar el pago al mensaje de datos, p. ej. "Ana, recoger, efectivo", salvo en las pruebas cuyo objetivo es el paso nuevo).

Fixtures dorados (REQ-F-029): `flow.json` y `template.json` cambian a propósito (parámetro `entrega` con el pago, paso `payment`, `customer.payment`). Se regeneran una sola vez con el código nuevo y se revisa el diff para comprobar que **solo** cambian esos campos; el comentario de `tests/support/bot-golden.ts` registra REQ-F-035 como cambio intencional del flujo y de la plantilla.

Comandos: `npm run typecheck`, `npm run lint`, `npm test` (con `npm run db:up`). No hay cambios de estilos ni plantillas HTML (`build:css` no aplica).

### Seguridad

- Sin entradas nuevas fuera del texto del cliente, ya normalizado; sin cambios en el webhook, la firma ni la deduplicación.
- La CLABE y el beneficiario son contenido público para el cliente; nunca se registran. El repositorio es privado.
- El bot no recibe ni reenvía comprobantes (RF-8): sin cambios en el manejo de mensajes no soportados.

### Performance

Un turno más en el flujo (mitigado por RF-2). Mensajes algo más largos: el resumen con transferencia sigue muy por debajo de 4096 (Meta) y, en Twilio, `splitMessage` lo parte sin cortar bloques si pasa de 1600.

### Riesgos técnicos

- **Fixtures dorados:** su regla es "no se regeneran"; aquí se actualizan de forma intencional y revisada (ver Testing). Si el diff muestra algo más que el pago, es una regresión.
- **Muchas pruebas de flujo** llegan hoy al resumen con "Ana, recoger": hay que agregar el pago o el turno de pago. Cambio mecánico pero amplio.
- **Reconocimiento del pago en los datos:** limitado a segmentos exactos para no alterar nombres ni direcciones; "Ana recoger efectivo" sin comas deja "efectivo" como nota (como hoy) y el bot pregunta el pago. Aceptable y cubierto por pruebas.
- **"efectivo" a domicilio** se trata como no válido (RN-1, igual que "tarjeta" en CA-3): el bot explica que a domicilio se paga al recibir o por transferencia.
- **Personal:** lee el pago dentro de "Forma de entrega" (opción B aceptada); la plantilla aprobada por Meta no se toca.

### Orden de implementación

1. `payment.ts` (contenido y servicio), textos y vocabulario.
2. Intérprete: `payment` en `CustomerDataInterpretation` y extracción de segmentos.
3. Conversación: paso `payment`, `askNext`, `applyData`, `handlePayment`, guarda de `handleConfirm`, `buildOrder`.
4. `summary`, `transferBlock`, `confirmedMessage` y orquestador.
5. `buildStaffTemplate` (parámetro `entrega` y recorte de la dirección).
6. Pruebas nuevas y ajuste de las existentes; regeneración revisada de los fixtures dorados.
7. README.
8. `typecheck`, `lint`, `test` y revisión de `git diff`.

### Criterios de finalización

- CA-1 a CA-19 cubiertos por pruebas automáticas, para Molotes y Birria.
- `npm run typecheck`, `npm run lint` y `npm test` terminan en 0.
- `STAFF_TEMPLATE_BODY` y el README de la plantilla sin cambios en el cuerpo; diff de los fixtures dorados limitado al pago.
- README actualizado; sin cambios ajenos al ticket.

## Aprobación del Technical Action Plan

Aprobado por el usuario el 2026-10-16: "Apruebo el plan pero a futuro los datos deben guardarse en la base de datos, merge hcho". Se aplican las dos recomendaciones del plan: datos bancarios en contenido versionado (`src/content/common/payment.ts`) y regeneración única y revisada de los fixtures dorados de REQ-F-029.

### Decisión del usuario: trabajo futuro (fuera de este ticket)

Los datos bancarios deben guardarse en el futuro en la base de datos (editables, p. ej. desde la administración). No se implementa en REQ-F-035. Para facilitarlo, el flujo y los textos leen la cuenta solo mediante `getBankAccount()` (`src/content/common/payment.ts`, reexportado por `src/content/bot.ts`); `transferBlock` la recibe como parámetro con ese valor por defecto. La migración futura cambia solo ese punto de acceso (y requerirá su propio ticket: tabla, migración de Prisma, administración y caché).

## Implementation Result

### Rama

`feature/REQ-F-035-forma-de-pago-bot` (desde `main` 2bccedb). Sin commit (fase T2).

### Cambios realizados

- **Datos bancarios** (`src/content/common/payment.ts`, nuevo): `BankAccount` y `getBankAccount()`, único punto de acceso (RF-7.1, RN-5). Reexportado en `src/content/bot.ts`.
- **Regla de negocio** (`src/services/whatsapp-bot/payment.ts`, nuevo): `PaymentMethod`, `PAYMENT_OPTIONS` por entrega (RN-1), `isPaymentValid` y `paymentOf` (frase completa contra `botVocabulary.payment`).
- **Textos y vocabulario** (`src/content/common/bot.ts`): `askPayment`, `paymentLabels`, `paymentNotFor` (por entrega), `transferData`, `transferConcept`, `transferNow`, `transferWaitDelivery`, `transferWaitOffHours`, `transferProof`, `summaryFields.payment`, `summaryIcons.payment` (💳), `staffPayment`, `staffPaymentLabels`; `askData` con "- 💳 cómo vas a pagar" y los ejemplos `*Ana, recoger, efectivo*` y `*Ana, domicilio, Calle 5 #10, Centro, transferencia*` (RF-2.3); `botVocabulary.payment` por método.
- **Intérprete** (`interpreter/types.ts`, `interpreter/customer-data.ts`): `CustomerDataInterpretation.payment`; `takePayment` quita un segmento entero entre `,`, `;` o `.` que sea una frase de pago, solo si además hay palabra de entrega (RF-2.1).
- **Conversación** (`conversation.ts`): paso `payment`; `askNext` lo pide tras nombre, entrega y dirección (RF-1.1), con el aviso `paymentNotFor` si el método escrito no valía (RF-2.2); `applyData` descarta el pago que deja de valer al cambiar la entrega (RF-3) y toma el escrito con los datos si vale; `handlePayment` (número de la entrega, palabra completa o con cortesía, cambio de entrega; RF-1.3, RF-1.4); `validPayment()`; guardas de RN-2 en `showSummary` y `handleConfirm`; `buildOrder(payment)`.
- **Mensajes** (`messages.ts`): `OrderDetails.payment`; `paymentPrompt(delivery)`; `transferBlock(order, contact, account = getBankAccount())`; `summary(order, contact)` con el renglón "💳 *Pago:*" y el bloque de transferencia antes de la indicación de confirmar; `confirmedMessage(order, contact)` repite el bloque (RF-5); `buildStaffTemplate`: `entrega` = "<entrega> · Pago: <método>" y, en el recorte de último recurso, se recorta solo la dirección (RF-6.3). `STAFF_TEMPLATE_BODY` sin cambios.
- **Orquestador**: `confirmedMessage(order, staffContact(order.business))`.
- **README** (`restaurante/README.md`): flujo con el pago, sección "Forma de pago (REQ-F-035)" (opciones, palabras, bloque de transferencia, enlace del personal, dónde se editan los datos), vocabulario `payment`, parámetro `entrega` con el pago, orden de recorte y ejemplo para la revisión de Meta.
- **Pruebas**: nuevo `tests/unit/whatsapp-bot-payment.test.ts` (56 casos, Molotes y Birria); caso de transferencia en `tests/integration/chat-bot-contract.test.ts` (Meta y Twilio); pruebas de flujo existentes ajustadas para incluir el pago en el mensaje de datos o el turno de pago; `whatsapp-bot-format.test.ts` (💳 y 🏦 permitidos, `askData`, renglón "Pago:", corpus con transferencia y preguntas de pago, ancho de los renglones nuevos).
- **Fixtures dorados** regenerados una vez y revisados (`tests/fixtures/bot-golden/{flow,template}.json`; nota en `tests/support/bot-golden.ts`). Diff revisado: `template.json` solo cambia `entrega` (" · Pago: …") en los 5 pedidos, su reflejo en `body` y `text`, y en el pedido compactado `lineas` abreviadas 2 caracteres más por línea (el presupuesto de DT-1 descuenta el `entrega` más largo; mismo nivel 3, mismas 15 líneas, total igual). `flow.json`: pasos `payment`, `customer.payment`, `order.payment`, los turnos de pago agregados (molotes-numeros "1", birria-aclaracion "transferencia", birria-quitar-y-datos-por-pasos "1") y el pago escrito con los datos en 2 recorridos; carrito, totales, códigos y número de respuestas por turno sin otros cambios.

### Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | Cumple | `whatsapp-bot-payment.test.ts` "CA-1" (3 opciones exactas, ambos negocios) |
| CA-2 | Cumple | "CA-2" y `whatsapp-bot-conversation.test.ts` CA-13 |
| CA-3 | Cumple | "CA-3" ("5", "hola", "tarjeta" y "efectivo" a domicilio; "al recibir" y "4" al recoger) |
| CA-4 | Cumple | "CA-4" |
| CA-5 | Cumple | "CA-5" (sin pregunta y sin nota) |
| CA-6 | Cumple | "CA-6" (aviso + opciones de domicilio; dirección sin "tarjeta") |
| CA-7 | Cumple | "CA-7" (desde el paso de nombre y desde el paso de pago) |
| CA-8 | Cumple | "CA-8" (datos, `Concepto` = código del título, enlace del personal, comprobante o referencia) |
| CA-9 | Cumple | "CA-9 y CA-11" |
| CA-10 | Cumple | "CA-10 y CA-11" (Molotes lunes 10:00, Birria sábado 07:00) |
| CA-11 | Cumple | "CA-9 y CA-11", "CA-10 y CA-11"; enlace del personal en el último renglón |
| CA-12 | Cumple | "CA-12 y CA-13" (efectivo, tarjeta, pagar al recibir) |
| CA-13 | Cumple | Meta: "CA-12 y CA-13", "CA-13 con transferencia", `whatsapp-webhook.test.ts`; Twilio: `whatsapp-webhook-twilio.test.ts` (texto libre y `{{6}}`), `staffNoticeText`; prueba README ↔ `STAFF_TEMPLATE_BODY` sin cambios y en verde |
| CA-14 | Cumple | "CA-14" (dirección 200, nombre 60, notas 200, 15 líneas; con "x" y con emojis; recoger) |
| CA-15 | Cumple | "CA-15" (cuenta alternativa en `transferBlock`) |
| CA-16 | Cumple | "CA-16" (dos contactos; sin números fijos en `botText`) |
| CA-17 | Cumple | `describe.each(BUSINESS_IDS)` en el archivo nuevo |
| CA-18 | Cumple | "CA-18" (renglones ≤ 28, partición Twilio 1600 y Meta 4096 sin cortar el bloque) y corpus de `whatsapp-bot-format.test.ts` |
| CA-19 | Cumple | "CA-19" (imagen → solo texto; texto → saludo nuevo; sin reenvío ni registro) |

### Validaciones ejecutadas

- `npm run typecheck` → código 0.
- `npm run lint` → código 0 (sin errores ni avisos).
- `npm test` (MySQL local levantado) → 92 archivos, 1887 pruebas superadas y 1 fallo esperado (`it.fails` previo), 0 fallos.
- `npm run bot:chat -- --ahora 2026-10-20T12:00`: recorrido a domicilio con "tarjeta" rechazada, "2" (transferencia), resumen con el bloque, aviso al personal con `entrega` "A domicilio: Calle 5 #10, Centro · Pago: transferencia" y confirmación con el bloque.
- `npm run build:css`: no aplica (sin cambios de estilos ni plantillas HTML).

### Archivos afectados

Nuevos: `src/content/common/payment.ts`, `src/services/whatsapp-bot/payment.ts`, `tests/unit/whatsapp-bot-payment.test.ts`.
Modificados: `README.md`, `src/content/bot.ts`, `src/content/common/bot.ts`, `src/services/whatsapp-bot/{conversation,messages,orchestrator}.ts`, `src/services/whatsapp-bot/interpreter/{customer-data,types}.ts`, `tests/fixtures/bot-golden/{flow,template}.json`, `tests/support/bot-golden.ts`, `tests/unit/whatsapp-bot-{conversation,emojis,format,free-text,infra,orchestrator,protection,qa-req-f-013,twilio}.test.ts`, `tests/integration/{bot-chat,bot-protection-qa-req-f-025,chat-bot-contract,chat-bot-message-count,whatsapp-bot-qa-req-f-013,whatsapp-twilio-qa-round1,whatsapp-webhook-twilio,whatsapp-webhook}.test.ts`.

### Riesgos o pendientes

- Desviaciones menores del plan: (1) el ícono del pago va en `botText.summaryIcons.payment` (un objeto, como `deliveryIcons`) y no como texto suelto; (2) en el intérprete la coincidencia del segmento de pago es exacta, sin quitar cortesía (en el paso de pago sí se acepta "tarjeta por favor"); (3) la espera tiene dos textos (`transferWaitDelivery`, `transferWaitOffHours`) en vez de uno con "(con envío)", y al recoger en horario se muestra "Una vez confirmado tu pedido, transfiere el total: *$…*." (RN-4); (4) la guarda RN-2 está en `showSummary` y en `handleConfirm` (sin `!` ni excepciones); (5) "Ana, efectivo" en el paso de nombre se toma como nombre (sin palabra de entrega no se interpreta el pago), igual que el comportamiento actual con textos sin entrega.
- En el aviso compactado, las líneas abreviadas pierden 2 caracteres por línea porque `entrega` es más largo (efecto esperado de DT-1).
- Pendiente fuera del ticket: número del personal en el VPS (sesión principal) y la persistencia futura de los datos bancarios en la base de datos (decisión del usuario).

## Aprobación de la implementación

Aprobada por el usuario el 2026-10-16: "apruebo la implementacion y dejar la alerta como tolerable" (la alerta es de Dependabot, la atendió la sesión principal y no forma parte de este ticket).

## QA Action Plan

### Objetivo

Validar con evidencia que el paso de forma de pago del bot de WhatsApp (Molotes y Birria, Meta y Twilio) cumple CA-1 a CA-19, que el aviso al personal conserva "Pago: …" dentro de 1024 caracteres y que no hay regresiones en el resto del flujo del bot, en los fixtures dorados de REQ-F-029 ni en la plantilla `nuevo_pedido`.

### Requisito bajo prueba

REQ-F-035, RF-1 a RF-8 y RN-1 a RN-6. No hay UI web: `_stich_source_/`, responsive, Chrome y SEO no aplican. La "UX" que se valida es la del texto del chat: formato de REQ-F-029 y límites de cada proveedor.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Pruebas |
| --- | --- |
| CA-1, CA-2 | Suite: `whatsapp-bot-payment.test.ts` "CA-1"/"CA-2". Manual: P-1, P-2 (`bot:chat`). |
| CA-3 | Suite "CA-3". QA-N1 a QA-N4. Manual: P-2 ("5", "hola", "tarjeta" a domicilio). |
| CA-4 | Suite "CA-4". Manual: P-1 ("efectivo"), P-2 ("2"). |
| CA-5 | Suite "CA-5". Manual: P-3. |
| CA-6 | Suite "CA-6". Manual: P-4 (comprobar que la dirección no contiene "tarjeta"). |
| CA-7 | Suite "CA-7". Manual: P-5. |
| CA-8 | Suite "CA-8". Manual: P-1 con transferencia (comparar el concepto con el título del resumen). |
| CA-9, CA-11 | Suite "CA-9 y CA-11". Manual: P-2 (resumen y confirmación). |
| CA-10 | Suite "CA-10 y CA-11". Manual: P-6 fuera de horario (Molotes y Birria). |
| CA-12 | Suite "CA-12 y CA-13". Manual: P-1 y P-3 (sin CLABE ni comprobante). |
| CA-13 | Suite (Meta, Twilio `{{6}}`, texto libre y README ↔ `STAFF_TEMPLATE_BODY`). Manual: el aviso al personal de `bot:chat` con `--proveedor meta` y `--proveedor twilio`. `git diff main -- <README sección de la plantilla>`: el cuerpo no cambia. |
| CA-14 | Suite "CA-14". QA-L1 (dirección tan larga que el sobrante supera la dirección). |
| CA-15 | Suite "CA-15". |
| CA-16 | Suite "CA-16". QA-R4: ningún texto de `botText` ni README de flujo contiene un teléfono fijo. |
| CA-17 | `describe.each(BUSINESS_IDS)` del archivo nuevo. Manual: P-1 a P-6 repartidos entre Molotes (martes a viernes) y Birria (sábado y domingo). |
| CA-18 | Suite "CA-18" y corpus de `whatsapp-bot-format.test.ts`. QA-L2: confirmación con transferencia en Twilio (1600) sin cortar el bloque. |
| CA-19 | Suite "CA-19". Manual: P-7 (`/audio` y texto tras confirmar). |

### Riesgos identificados

1. **Intérprete de datos (`takePayment`).** Parte por `,`, `;` y `.`, así que puede afectar direcciones con puntos ("Av. Juárez 10. Centro") o nombres que coinciden con una palabra de pago. Riesgo de perder o alterar texto al reconstruir el mensaje.
2. **Recorte del aviso al personal.** Si el sobrante supera el largo de la dirección, se recorta a 1 carácter. Hay que comprobar que el aviso queda ≤ 1024 de todos modos y que "Pago: …" está completo.
3. **Fixtures dorados regenerados.** El diff debe limitarse a `payment`, `entrega`, su reflejo en `body`/`text`, las 2 letras menos por línea del pedido compactado y los turnos de pago agregados. Cualquier otro cambio sería una regresión oculta.
4. **Largo de los mensajes.** El resumen y la confirmación con transferencia en Twilio (1600 por mensaje, partición con `splitMessage`).
5. **Guardas de RN-2** (`showSummary`, `handleConfirm`) y D-13 (cambio de precio entre el resumen y el "sí").
6. **Regresión amplia.** Hubo cambios mecánicos en 17 archivos de prueba existentes. Hay que verificar que no se debilitó ninguna aserción, solo que se agregó el pago.
7. Blast radius (CodeGraph): `confirmedMessage` tiene 5 llamadas en `orchestrator.ts`; `askNext`/`applyData` tienen 4 y 6 llamadas internas en `conversation.ts` (nombre, datos o productos, dirección, pago y aclaración). `takePayment` llega a `whatsapp-bot-interpreter`, `whatsapp-bot-emojis` y otras 4 suites.

Sin riesgo de estado persistido: las conversaciones viven en memoria (`store.ts`), así que un despliegue no deja conversaciones previas sin pago.

### Pruebas funcionales (manuales con `npm run bot:chat`, dobles de Meta/Twilio, sin red)

Las entradas se envían por stdin y se guarda la salida como evidencia. Molotes: `--ahora 2026-10-20T12:00` (martes). Birria: `--ahora 2026-10-17T12:00` (sábado).

- **P-1** Molotes, recoger: pregunta con 3 opciones; "efectivo" lleva al resumen con "Pago: Efectivo" y sin CLABE. Se repite con "3" (transferencia): bloque de transferencia con "Una vez confirmado… transfiere el total".
- **P-2** Birria, domicilio: pregunta con 2 opciones; "5", "hola" y "tarjeta" repiten la pregunta; "2" lleva al resumen con el bloque y la espera de confirmación con envío. "sí" muestra la confirmación con el bloque y el enlace del personal en su renglón, y el aviso al personal con "A domicilio: … · Pago: transferencia".
- **P-3** "Ana, recoger, efectivo": resumen directo, sin nota.
- **P-4** "Ana, domicilio, Calle 5 #10, Centro, tarjeta": aviso de método no válido, opciones de domicilio y dirección sin "tarjeta".
- **P-5** Con el pago "tarjeta" y recoger, cambiar a domicilio antes del resumen: vuelve a preguntar con las opciones de domicilio.
- **P-6** Fuera de horario con transferencia (Molotes lunes 10:00; Birria sábado 07:00): datos, comprobante y espera de confirmación.
- **P-7** Tras confirmar con transferencia: `/audio` responde "solo texto"; un texto inicia una conversación nueva; el aviso al personal no se repite.
- **P-8** `--proveedor twilio`: P-2 completo; los mensajes no superan 1600 o se parten sin cortar el bloque de transferencia.

### Pruebas negativas y casos límite (nuevas, automatizadas)

- **QA-N1** Palabras clave globales en el paso de pago ("menú", "carrito", "cancelar", "persona", "ayuda"): se comportan como antes y "ayuda" repite la pregunta de pago.
- **QA-N2** Números fuera de rango ("0", "3" a domicilio, "4" al recoger) y mayúsculas o acentos ("TRANSFERENCIA", "Efectivo", "tarjeta por favor").
- **QA-N3** "efectivo" en el paso de resumen se toma como nota (caso límite del ticket).
- **QA-N4** Guarda de `handleConfirm`: un "sí" sin pago válido no envía el pedido.
- **QA-L1** CA-14 extremo: el sobrante supera la dirección. El aviso queda ≤ 1024 con "Pago: …" completo, en Meta y Twilio.
- **QA-L2** Confirmación con transferencia y pedido de 15 líneas en Twilio: cada parte ≤ 1600 y el bloque no se corta.
- **QA-L3** Intérprete: "Ana, domicilio, Av. Transferencia 10, Centro" (sin pago); "Ana, domicilio, Av. Juárez 10. Centro, transferencia" (la dirección conserva "Av. Juárez 10. Centro"); dos pagos en el mismo mensaje (se toma el último); "Ana recoger efectivo" sin comas (pregunta el pago).
- **QA-L4** D-13 con transferencia: el resumen actualizado repite el bloque con el total nuevo y el mismo código.

### Pruebas de accesibilidad

Lectura de los mensajes en `bot:chat`: opciones numeradas `*1.*`, ningún estado comunicado solo con un emoji, enlace del personal en su propio renglón y CLABE sola en su renglón (para copiarla).

### Pruebas de integración (WhatsApp)

- `chat-bot-contract.test.ts` (Meta y Twilio con transferencia), `whatsapp-webhook*.test.ts`.
- El enlace del comprobante sale de `WHATSAPP_BOT_STAFF_MOLOTES` y `WHATSAPP_BOT_STAFF_BIRRIA` (CA-16): en `bot:chat`, el enlace de Molotes y el de Birria corresponden a su variable.
- **Paso opcional para el usuario (no bloqueante):** un pedido con transferencia desde un teléfono real contra el bot de desarrollo (no el de producción). Sirve para ver cómo WhatsApp muestra el bloque y si el enlace del personal es pulsable. QA no lo ejecuta ni envía mensajes reales.

### Pruebas de performance

Sin cambios de assets. Solo se comprueba el largo de los mensajes (CA-18, QA-L2) y que el flujo tiene un solo turno extra (lo evita RF-2).

### Pruebas de regresión

- `npm run typecheck`, `npm run lint` y `npm test` completos (MySQL con `npm run db:up`).
- Revisión de `git diff main -- tests/fixtures/bot-golden/` campo por campo, según el riesgo 3.
- Revisión del diff de las 17 pruebas existentes modificadas: no debe haber aserciones eliminadas ni debilitadas.
- `STAFF_TEMPLATE_BODY` y el cuerpo de la plantilla en el README sin cambios (`git diff main`).
- Que `staffFailedMessage` y `orderCapContactMessage` no cambien.
- Landings: sin cambios en `src/views`, `public/` ni `src/content/{molotes,birria}` (`git diff --stat`).

### Pruebas automatizadas

- **Existentes:** toda la suite, en especial `whatsapp-bot-payment.test.ts` (56 casos) y las suites del bot.
- **Nueva (requiere aprobación):** `restaurante/tests/unit/whatsapp-bot-payment-qa-req-f-035.test.ts`, con QA-N1 a QA-N4 y QA-L1 a QA-L4 para ambos negocios. Se usan los dobles y el soporte existentes, sin dependencias nuevas ni cambios de producción.

### Evidencia requerida

Salida de typecheck, lint y test (conteos); transcripciones de `bot:chat` de P-1 a P-8, guardadas en el scratchpad y citadas en el QA Report; extracto del diff de los fixtures dorados y de la plantilla.

### Criterios de aprobación

CA-1 a CA-19 en PASS con evidencia; typecheck, lint y `npm test` en 0; diff de los fixtures limitado a lo descrito; sin defectos BLOCKER ni CRITICAL, y los MAJOR decididos por el usuario.

## Aprobación del QA Action Plan

Aprobado por el usuario el 2026-10-16: "si a todo". Autoriza el plan, el archivo de pruebas `tests/unit/whatsapp-bot-payment-qa-req-f-035.test.ts` y la prueba opcional con teléfono real, que hará el usuario y que no bloquea. Acepta también que "Ana, efectivo" sin entrega se tome como nombre y que después se pregunte el pago.

## QA Report

### Ronda

1

### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| `git branch --show-current` | `feature/REQ-F-035-forma-de-pago-bot` |
| `npm run db:up`, `npm run typecheck` | 0 y 0 |
| `npm run lint` | 0, sin errores ni avisos (también con el archivo de QA) |
| `npm test` antes del archivo de QA | 92 archivos; 1887 superadas y 1 fallo esperado (`it.fails` previo) |
| `npm test` final | 93 archivos; 1928 superadas y 1 fallo esperado; 0 fallos |
| Nuevo `tests/unit/whatsapp-bot-payment-qa-req-f-035.test.ts` | 41 de 41 superadas (QA-N2, QA-N4, QA-L1, QA-L2, QA-L3; Molotes y Birria) |
| `bot:chat` P-1 a P-8 y palabras clave (Meta y Twilio, dobles, sin red) | Todas conformes (ver criterios) |
| Mismo recorrido posterior a la confirmación sobre `main` (worktree temporal, ya eliminado) | Mismo comportamiento que la rama (CA-19) |
| Diff de los fixtures dorados frente a `main` (comparación programática sin " · Pago: …" ni `payment`) | Solo cambia lo previsto (ver Regresión) |

Nota del entorno: con la entrada redirigida, el simulador `bot:chat` aplica el límite de ráfaga por defecto (5 mensajes cada 10 s, REQ-F-025) y deja de responder. Es el comportamiento esperado de la protección y no es un defecto. Los recorridos se ejecutaron enviando un mensaje cada 2,2 s.

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | P-1 (Molotes, martes): "Ana, recoger" → `*1.* Efectivo / *2.* Tarjeta / *3.* Transferencia`. Suite "CA-1". |
| CA-2 | PASS | P-2 (Birria, sábado): domicilio → `*1.* Pagar al recibir / *2.* Transferencia`. Suite "CA-2". |
| CA-3 | PASS | P-2: "5" y "hola" → "Escribe solo el número…" + la pregunta; "tarjeta" → "A domicilio puedes pagar al recibir o por transferencia." + la pregunta, sin resumen. QA-N2: "0", "3", "-1" y "2.5". |
| CA-4 | PASS | P-1: "efectivo" → "💳 *Pago:* Efectivo". P-2: "2" → "💳 *Pago:* Transferencia". |
| CA-5 | PASS | P-3: "Ana, recoger, efectivo" → resumen directo, "Notas: Sin notas". |
| CA-6 | PASS | P-4: "Ana, domicilio, Calle 5 #10, Centro, tarjeta" → aviso + opciones de domicilio. Suite y QA-L3: la dirección queda sin "tarjeta". |
| CA-7 | PASS | P-5a (desde el paso de pago) y P-5b (desde el paso de nombre con "recoger, tarjeta"): se vuelve a preguntar con las opciones de domicilio. |
| CA-8 | PASS | P-1 con "3": beneficiario, banco, CLABE 722969010833880068 y "Concepto: *M-ZTG9*", igual que el título; comprobante o referencia con `https://wa.me/5215511110001`; "Una vez confirmado tu pedido, transfiere el total: *$90*." |
| CA-9 | PASS | P-2: "Espera a que el personal te confirme el total con envío antes de transferir." |
| CA-10 | PASS | P-6 Molotes lunes 10:00 y Birria sábado 07:00: datos, comprobante y "Espera a que el personal confirme tu pedido y el total antes de transferir." |
| CA-11 | PASS | P-1, P-2, P-6 y P-8: "¡Listo!…" repite el bloque completo; el enlace del personal va en el último renglón. |
| CA-12 | PASS | P-1 y P-3 (efectivo) y QA-N2 ("Al Recibir"): ni CLABE ni comprobante en el resumen ni en la confirmación. Suite "CA-12". |
| CA-13 | PASS | Meta (`bot:chat`): `"entrega": "Recoger en sucursal · Pago: efectivo"` y `"A domicilio: Calle 5 #10, Centro · Pago: transferencia"`. Twilio en texto libre (P-8): `Entrega: A domicilio: Av. Juárez 10. Centro · Pago: transferencia`. `STAFF_TEMPLATE_BODY` sin cambios en el diff; la prueba README ↔ plantilla, en verde. |
| CA-14 | PASS | Suite "CA-14". QA-L1: 15 casos ("x", "🌮", "ñ" × todos los métodos válidos para cada entrega) con la plantilla ≤ 1024 y " · Pago: <método>" completo. |
| CA-15 | PASS | Suite "CA-15" (cuenta alternativa en el único punto de acceso, `getBankAccount()`). |
| CA-16 | PASS | `bot:chat`: Molotes enlaza a `wa.me/5215511110001` y Birria a `wa.me/5215522220002` (sus `WHATSAPP_BOT_STAFF_*`). Suite: dos contactos distintos y ningún número de 8 o más dígitos en `botText`. |
| CA-17 | PASS | Recorridos en ambos negocios; `describe.each(BUSINESS_IDS)` en la suite y en el archivo de QA. |
| CA-18 | PASS | Suite "CA-18" y corpus de formato. QA-L2: confirmación de 15 líneas en Twilio, cada parte ≤ 1600, el bloque entero y el enlace al final. |
| CA-19 | PASS | P-7: tras confirmar con transferencia, `/audio` → "Por ahora solo entiendo mensajes de texto." (con el saludo de la conversación nueva); un texto → saludo nuevo (P-1a); no se reenvía nada al personal. Idéntico a `main`. |

### Defectos encontrados

Ninguno.

### Regresión

- **Fixtures dorados.** En `template.json`, sin contar el pago, solo cambian `lineas` y `body` del pedido compactado `molotes-grande-compactado`, con 2 caracteres menos por línea. Es el efecto documentado del presupuesto DT-1. En `flow.json`, los pedidos finales de los 8 recorridos son idénticos sin `payment` (métodos: cash, transfer, card, transfer, onDelivery). Los únicos cambios son los turnos de pago agregados (más 1 respuesta en `molotes-numeros`, `birria-aclaracion` y `birria-quitar-y-datos-por-pasos`) y el pago en 2 entradas de datos.
- **Pruebas existentes modificadas.** Se quitaron 18 aserciones y se agregaron 32. Cada aserción quitada se reemplaza por una equivalente con el pago o con el turno de pago (revisión por pares de líneas). Ninguna se debilitó; por ejemplo, el recorte de la plantilla ahora exige `… · Pago: pagar al recibir`.
- `staffFailedMessage`, `orderCapContactMessage` y `STAFF_TEMPLATE_BODY`: sin cambios.
- Landings (`src/views`, `public/`, `src/content/{molotes,birria}`): sin cambios.
- Blast radius (CodeGraph): `confirmedMessage` (5 llamadas en el orquestador), `askNext`, `applyData` y `takePayment`, todas cubiertas por la suite completa en verde.

### Responsive

No aplica (sin UI web).

### Accesibilidad

En los textos del chat, las opciones van numeradas con `*1.*`, la CLABE va sola en su renglón y el enlace del personal en el suyo. Ningún estado depende solo de un emoji.

### UX/UI

No aplica `_stich_source_/`. El formato de REQ-F-029 se verificó con la suite y los recorridos.

### Performance

Un turno más solo cuando el pago no viene con los datos. Los mensajes están dentro de los límites de Meta (4096) y Twilio (1600, con partición).

### SEO

No aplica.

### Observaciones (no son defectos)

- El aviso en texto libre al personal (Twilio sin plantilla, `staffNoticeText`) no tiene presupuesto de 1024: con entradas extremas mide más (QA-L1). Es así desde antes de este ticket. Ese canal es un mensaje de sesión que se parte según el límite del proveedor, y el límite de 1024 corresponde a la plantilla. El pago siempre aparece completo.
- Tras la palabra clave "carrito" en el paso de pago, el bot pasa al menú del carrito, y "tarjeta por favor" ya no se interpreta como pago. Así funcionan hoy todas las palabras clave. "tarjeta por favor" sí se acepta en el paso de pago (suite).

### Pendientes de revisión manual

- Prueba opcional del usuario, que no bloquea: un pedido con transferencia desde un teléfono real contra el bot de **desarrollo**, para ver cómo WhatsApp muestra el bloque y comprobar que el enlace del personal se puede pulsar. QA no envió mensajes reales.

### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Persistencia inicial de la propuesta aprobada. Incluye su evolución durante el análisis:

- **Propuesta v1:** pregunta de pago según la entrega, datos de transferencia con el código como concepto en el resumen y la confirmación, el pago dentro del campo de entrega del aviso al personal (opción B) y el comprobante dirigido al WhatsApp del personal configurado. Se basa en las respuestas del usuario a 9 preguntas ("Aprueba con todas las sugerencias").
- **Propuesta v2:** a petición del usuario ("Quiero que agregues la instruccion de que si elije transferencia, envie el comprobante de la misma generado por su banca movil para validar su pago o por lo menos que escriba la referencia del pago que le da el banco si no se pueden recibir imagenes"), se añade la indicación de enviar al personal la captura del comprobante de la banca móvil o, si no se puede, la referencia o clave de rastreo del banco con el código (opción (a): solo instrucción, sin cambios en el bot). Cambian RF-4.2, RF-5 y RF-8; se añaden RN-6, HU-5 y CA-19; se ajustan CA-8, CA-9 y CA-11.
- **Aprobación:** el usuario aprobó la propuesta v2 con la opción (a) el 2026-10-16: "Te doy permiso de que tu cambies el número y apruebo".

### Versión 2

Revisión técnica de `senior-fullstack` (2026-10-16): sin bloqueos. Se agrega el Technical Action Plan y el estado pasa a `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Versión 3

T2 de `senior-fullstack` (2026-10-16): el usuario aprueba el Technical Action Plan ("Apruebo el plan pero a futuro los datos deben guardarse en la base de datos, merge hcho"); se registra la persistencia futura en BD como trabajo fuera del ticket. Rama `feature/REQ-F-035-forma-de-pago-bot`, ticket movido a `in-progress/`, implementación y pruebas (typecheck 0, lint 0, 1887 pruebas en verde). Estado `NEEDS_IMPLEMENTATION_APPROVAL`.

### Versión 4

Q1 de `senior-qa` (2026-10-16): el usuario aprueba la implementación ("apruebo la implementacion y dejar la alerta como tolerable"). Se agrega el QA Action Plan y el estado pasa a `NEEDS_QA_PLAN_APPROVAL`.

### Versión 5

Q2 de `senior-qa` (2026-10-16): el usuario aprueba el QA Action Plan ("si a todo"). Ronda 1: CA-1 a CA-19 en PASS; typecheck y lint en 0; 1928 pruebas superadas (incluidas 41 nuevas de QA); fixtures dorados conformes; sin defectos. Estado `QA_APPROVED`.

### Versión 6

T4 de `senior-fullstack` (2026-10-16): commit `d0ce7dd` (`feat: el bot de WhatsApp pregunta la forma de pago y guía la transferencia con el código del pedido`) en `feature/REQ-F-035-forma-de-pago-bot`. PR #71 contra `main`: https://github.com/orvigas/negocio/pull/71. CI del PR (run 38945291517) en verde: `calidad`, `docker`, `despliegue` y `auditoria` pass (`publish`, `deploy`, `validado` y `vigente` omitidos, como corresponde a un PR). Estado `READY_FOR_MERGE`.

### Versión 7

T5 de `senior-fullstack` (2026-10-16): el usuario mergeó el PR #71 (https://github.com/orvigas/negocio/pull/71; merge `a38a15c`, 2026-10-16T18:28:02Z) ("Fusionado"). Pipeline de `main` (run 38947561354, https://github.com/orvigas/negocio/actions/runs/38947561354) en verde: `cambios`, `validado`, `publish`, `vigente` y `deploy` success (el despliegue a producción terminó bien). Ticket movido a `done/`; ramas `feature/REQ-F-035-forma-de-pago-bot` local y remota borradas. Estado `DONE`.
