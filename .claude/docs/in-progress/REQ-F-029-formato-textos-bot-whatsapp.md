# REQ-F-029 — Formato legible de los textos del bot de WhatsApp

## Estado

READY_FOR_MERGE

Pull Request: https://github.com/orvigas/negocio/pull/60 (contra `main`). CI del PR en verde: `calidad`, `docker`, `despliegue` y `auditoria` pasan; `publish` y `deploy` se omiten en un PR.

## Aprobación

Aprobado por el usuario (versión 1, fecha 2026-10-15): "Aprobado".

Decisiones previas del usuario a las 6 preguntas del análisis: "Acepto las recomendaciones". Es decir:

1. Menú con la alternativa A: nombre en un renglón y precios en el siguiente.
2. N = 32 caracteres visibles por renglón estructurado.
3. Un renglón en blanco entre productos.
4. **No** se omite el prefijo "Molotes de".
5. El aviso al personal en texto libre (Twilio) queda fuera de alcance.
6. Se permiten pequeños cambios de redacción que conserven el significado y las palabras clave. Cada uno está listado en este ticket (W-1 a W-6).

Nota del análisis: en la sesión del Business Analyst no estaba disponible CodeGraph (ni la herramienta MCP ni el CLI) y no se ejecutó el simulador `bot:chat`. El análisis se hizo con lecturas dirigidas de `src/services/whatsapp-bot/messages.ts`, `conversation.ts`, `text.ts`, `src/content/common/bot.ts`, `src/content/{molotes,birria}/bot.ts` y `src/content/*/seed.json`. Los ejemplos son ilustrativos: los precios reales salen del catálogo en la base y el formato del código de pedido puede ser otro.

## Objetivo

Que todos los textos que el bot de WhatsApp envía al cliente se lean ordenados en un celular, donde una burbuja muestra unos 30 a 38 caracteres por renglón:

- ningún precio ni opción se parte a la mitad;
- cada bloque se ve separado;
- nada se ve amontonado.

No cambian el flujo, el intérprete, la numeración, el número de mensajes ni la plantilla `nuevo_pedido` de Meta.

Solicitud original del usuario (2026-10-15): "El formato del menú en el chat de whatsapp no me gusta se ve muy desordenado el largo de los renglones excede y rompe la línea. Quiero formatearlo que aproveche correctamente el espacio que no se vea amontonado lo mismo para todos los textos del bot".

## Alcance

Todos los textos del bot al cliente, en los dos negocios:

- saludo y estados del horario, opciones iniciales, invitación a pedir y palabras clave;
- menú y menú vacío;
- opciones y variantes, cantidad y aclaraciones;
- "Agregado", "No agregué", quitar y vaciar;
- carrito y petición de datos con privacidad;
- nombre, entrega y dirección;
- resumen, fuera de horario, confirmado y cancelado;
- horario y ubicación, otro negocio y pedidos cerrados;
- ayudas y errores;
- persona y contacto directo (`staffFailed` y los mensajes fijos de REQ-F-025).

## Fuera de alcance

- La plantilla `nuevo_pedido`: su cuerpo y los valores de sus parámetros.
- El aviso al personal en texto libre de Twilio (`staffNotice`).
- El intérprete, las palabras clave, el vocabulario, la numeración y los topes de REQ-F-025.
- Los nombres del catálogo: se conserva "Molotes de".
- Mensajes interactivos de Meta (listas o botones).
- Las landing pages.

## Requisitos

### Requisitos confirmados

- C-1. El menú se ve desordenado porque los renglones largos se parten a mitad del precio. Lo dijo el usuario.
- C-2. Aplica a todos los textos del bot al cliente.
- C-3. Emojis según REQ-F-013: acompañan a la palabra, como mucho dos por renglón. Este ticket no agrega emojis nuevos.
- C-4. Los textos siguen siendo editables en `src/content/common/bot.ts` y `src/content/<negocio>/bot.ts`.
- C-5. Partición según el proveedor (4096 en Meta y 1600 en Twilio), sin cortar un producto (REQ-F-012 CA-6). Este ticket lo reformula como "bloque" (RF-12).
- C-6. El cuerpo de la plantilla `nuevo_pedido` y los valores de sus parámetros no cambian.
- C-7. Las metas de número de mensajes de REQ-F-013 (CA-1 a CA-3, I-1) y el conteo de salientes de REQ-F-025 (D-T2) no empeoran.
- C-8. La numeración de productos y opciones no cambia, porque el intérprete la usa.

### Definiciones

- **Ancho visible.** Puntos de código del renglón:
  - no cuentan los marcadores de formato de WhatsApp (`*`, `_`, `~`);
  - no cuenta la sangría inicial, que mide 4 espacios como máximo;
  - cada emoji cuenta como 2.
- **Renglón estructurado.** Cualquiera de estos:
  - título de mensaje;
  - encabezado de sección;
  - renglón de precios u opciones;
  - renglón de cantidad y subtotal;
  - total;
  - elemento de una lista fija (opciones 1, 2, 3…);
  - etiqueta de campo ("Entrega:", "Nombre:", "Notas:");
  - renglón de palabras clave.
- **Dato variable.** Cualquiera de estos:
  - nombre de producto;
  - etiqueta de opción;
  - detalle;
  - nombre del cliente;
  - dirección;
  - notas;
  - URL;
  - contacto;
  - código de pedido;
  - nombre del negocio;
  - fragmento escrito por el cliente;
  - ejemplos de pedido (son contenido editable).
- **Prosa.** Cualquier otra frase u oración.
- **Bloque de producto.** El renglón del número y el nombre, más el detalle si lo hay, más sus renglones de precios o cantidad.

### Requisitos funcionales

- **RF-1. Ancho.** Todo renglón estructurado mide como máximo **28** de ancho visible (era 32; cambio por decisión del usuario, D-9), salvo que contenga un dato variable. Un dato variable va solo en su renglón, o al final del renglón de su etiqueta, sin otro dato ni precio detrás.
- **RF-2. Prosa.** La prosa puede partirse de forma natural:
  - cada párrafo trata una sola idea;
  - los párrafos se separan con un renglón en blanco;
  - las oraciones con instrucciones distintas van en renglones distintos.
- **RF-3. Menú (alternativa A).**
  - Título en negrita.
  - Encabezado de sección en negrita y mayúsculas. Es solo presentación: el contenido no cambia.
  - Un renglón en blanco antes y después del encabezado de sección.
  - Por producto:
    - renglón 1: `*N.* emoji *Nombre*`;
    - debajo, con sangría: los precios. Las opciones van unidas con " · " si caben en 32; si no, una por renglón con la misma sangría.
  - Un renglón en blanco entre productos.
  - Al final, la invitación con el ejemplo en su propio renglón, separada por un renglón en blanco.
  - Si WhatsApp no conserva la sangría en algún cliente, el precio va inmediatamente debajo, sin sangría.
- **RF-4. Líneas del pedido.**
  - En el carrito:
    - renglón `*N.* Nombre (opción)`;
    - si hay detalle, un renglón en _cursiva_;
    - con sangría, el renglón `2 × $130 c/u = $260`.
  - En el resumen, el mismo bloque con el marcador "- " en lugar del número (hoy no lleva número).
  - En "Agregado:", `- 2 × Nombre (opción)` y, si hay detalle, un renglón en _cursiva_.
  - El total va en negrita y separado con un renglón en blanco.
- **RF-5. Resumen.**
  - Título.
  - Código y negocio en el renglón siguiente.
  - Bloque de líneas.
  - Total.
  - Bloque de datos: Entrega, Nombre y Notas, un renglón cada uno con la etiqueta en negrita. La dirección va en el renglón siguiente a "A domicilio".
  - Aviso de costo de envío, si aplica.
  - Bloque de fuera de horario, si aplica.
  - Bloque de confirmación.
  - Los bloques se separan con un renglón en blanco.
- **RF-6. Contacto y enlaces.** El contacto directo y la URL del mapa van solos en su propio renglón, después de la frase que los presenta (terminada en ":").
- **RF-7. Separación.**
  - Nunca hay dos renglones en blanco seguidos.
  - No hay espacios al final del renglón.
  - No hay renglones en blanco al principio ni al final del mensaje.
  - Cuando un turno une varios textos, los separa un renglón en blanco (como hoy).
- **RF-8. Negritas.** Se usan solo en:
  - títulos y encabezados de sección;
  - número y nombre de producto en el menú;
  - número de línea del carrito;
  - totales;
  - etiquetas de campos;
  - código de pedido;
  - nombre del negocio;
  - palabras clave y ejemplos (ya van en negrita).

  Nunca en párrafos completos.
- **RF-9. Emojis.** Se mantiene C-3: no se agrega ningún emoji nuevo.
- **RF-10. Invariantes.** No cambian:
  - el intérprete, las palabras clave, el vocabulario y la numeración;
  - las transiciones del flujo;
  - el número de mensajes por turno en los escenarios de REQ-F-013 CA-1 a CA-3, con Meta y con Twilio;
  - el cuerpo de la plantilla `nuevo_pedido` ni los valores de sus parámetros, incluidos `pickup`, `delivery`, `staffHours`, `staffOffHours` y `noNotes`, que también usa el resumen;
  - la información de cada mensaje: ningún dato se quita ni se agrega, salvo las redacciones W-1 a W-6.
- **RF-11. Editabilidad.**
  - Los textos fijos siguen en los archivos de contenido.
  - El formato del menú, del carrito y del resumen es uno solo para los dos negocios.
  - Un cambio del catálogo en /admin no requiere tocar código para mantener el formato.
- **RF-12. Partición por bloques.** Al partir un mensaje a 1600 o 4096 caracteres, nunca se separa un bloque de producto ni una línea del pedido entre dos mensajes.

### Redacciones que cambian (decisión 6)

| ID | Texto (`botText`) | Hoy | Aprobado |
| --- | --- | --- | --- |
| W-1 | `keywordsHint` | `💬 En cualquier momento puedes escribir: *menú*, *carrito*, *cancelar*, *persona* o *ayuda*.` | `💬 En cualquier momento escribe:` / `*menú* · *carrito* · *cancelar*` / `*persona* · *ayuda*` |
| W-2 | `orderInvite`, `menuPrompt`, `help` | `…por ejemplo: *{ejemplo}*. …` | La frase termina en "por ejemplo:" y el ejemplo va en su propio renglón, sin el punto final. El resto de la oración va en un párrafo aparte. |
| W-3 | `askData` | `Si es todo, envíame tu nombre y si es para 🏪 *recoger* o 🛵 *a domicilio* (con tu dirección). Por ejemplo: *Ana, recoger* o *Ana, domicilio, Calle 5 #10, Centro*.` | `Si es todo, envíame:` / `- tu nombre` / `- 🏪 *recoger* o 🛵 *a domicilio*` / `  (con tu dirección)` / (en blanco) / `Por ejemplo:` / `*Ana, recoger*` / `*Ana, domicilio, Calle 5 #10, Centro*` |
| W-4 | `dataOrProducts` | `2. Son mis datos (nombre y entrega)` | `2. Son mis datos de entrega`. Es el mismo término que ya usa `dataLater`, y la opción se sigue eligiendo con "2". |
| W-5 | `offHours` | `🌙 FUERA DE HORARIO: tu pedido se atenderá cuando abramos, {apertura}.` | `🌙 *FUERA DE HORARIO*` / `Tu pedido se atenderá cuando abramos, {apertura}.` |
| W-1′ (D-9) | `keywordsHint` | W-1 aprobada | `💬 En cualquier momento,` / `escribe:` / `*menú* · *carrito* · *cancelar*` / `*persona* · *ayuda*`. El primer renglón de W-1 medía 32 y no cabe en 28. |
| W-3′ (D-9) | `askData` | W-3 aprobada | `Si es todo, envíame:` / `- tu nombre` / `- 🏪 *recoger* o` / `  🛵 *a domicilio*` / `  (con tu dirección)` / (en blanco) / `Por ejemplo:` / `*Ana, recoger*` / `*Ana, domicilio, Calle 5 #10, Centro*`. El renglón de las formas de entrega medía 29. |
| W-6 | `confirmPrompt` | `✅ Escribe *sí* para confirmar, o escribe una nota para agregarla. *cancelar* para cancelar.` | `✅ Escribe *sí* para confirmar.` / `O escribe una nota para agregarla.` / `Escribe *cancelar* para cancelar.` |

Ningún otro texto cambia de redacción: solo saltos de línea, renglones en blanco y negritas.

### Formato por texto (solo acomodo)

- **Saludo** (`greeting`, `openNow`, `closedNow`, `closedNoOrders`):
  - "¡Hola! 👋 Te atiende el asistente de *X*." como párrafo propio;
  - el lema en su propio párrafo;
  - el estado del horario en su propio párrafo;
  - después, las opciones (`rootOptions`, con "¿Qué deseas hacer?" en negrita), la invitación (W-2) y las palabras clave (W-1), cada uno separado por un renglón en blanco.
- **Horario y ubicación** (`hoursAndLocation`): `🕒 *X* atiende {horario}.` / (en blanco) / `📍 *Ubicación:*` / `{mapa}`.
- **Otro negocio y pedidos cerrados** (`otherBusiness`, `ordersClosed`): párrafos separados. La segunda oración de `ordersClosed` va en un párrafo aparte.
- **Opciones, aclaración, quitar y entrega** (`chooseOption`, `clarifyBlock`, `removePrompt`, `removeWhich`, `askDelivery`, `cartOptions`, `dataOrProducts`): la pregunta en su renglón y la lista debajo. Un renglón en blanco entre la pregunta y la lista solo si la lista es de productos.
- **Agregado y no agregado** (`added`, `notAdded`): formato de RF-4, con un renglón en blanco entre los dos bloques.
- **Carrito** (`cartView`): `🛒 *Tu pedido*` / (en blanco) / bloques de RF-4 / (en blanco) / `*Total: $X*` / (en blanco) / `cartOptions`.
- **Datos** (`askData` y `privacy`): W-3, y luego la privacidad en un párrafo aparte.
- **Resumen** (`summary`, `summaryTitle`): RF-5. `📝 *Resumen de tu pedido*` / `*{codigo}* · {negocio}`.
- **Confirmado** (`confirmed`): `¡Listo! 🙌` / `Tu pedido *{codigo}* fue enviado a {negocio}.` / (en blanco) / `El personal te escribirá para confirmarlo. 😋`.
- **Contacto directo** (`person`, `staffFailed`, `orderLimitReached`, `orderCapContact`, `dailyLimitReached`, `directContactMode`): RF-6. Ejemplo: `Por hoy ya recibimos el máximo de pedidos desde este número.` / (en blanco) / `Si quieres pedir algo más, escribe directamente al personal de *X*:` / `{contacto}`.
- **Errores y ayudas** (`notUnderstood`, `invalid*`, `lineTooLarge`, `tooManyLines`, `removeNotFound`, `catalogChanged`, `textOnly`, `menuEmpty`, `cancelled`, `emptied`, `removed`): el error es un párrafo y la nueva pregunta va en otro párrafo (como hoy, que ya los separa un renglón en blanco).

### Ejemplos de referencia (ilustrativos)

Menú de Molotes:

```
📋 *Menú de Moloteando*

*MOLOTES*

*1.* 🧀 *Molotes de Queso Oaxaca*
    pieza $45 · orden de 3 $130

*2.* 🍗 *Molotes de Tinga de Pollo*
    pieza $45 · orden de 3 $130

*6.* 🥕 *Molotes de Picadillo de Cerdo con Verduras*
    pieza $48 · orden de 3 $140

*BEBIDAS*

*9.* 🍹 *Aguas Frescas Naturales del Día*
    $35

Escríbeme tu pedido, por ejemplo:
*2 molotes de queso 🧀 y una coca 🥤*

También puedes escribir el número de un producto.
```

Fragmento del menú de Birria (opciones que no caben juntas en 32):

```
*3.* 🍲 *Tazón de Consomé Chico*
    Con Carne $80 · Sin Carne $45

*5.* 🥤 *Bebidas Frías del Comal*
    Aguas Frescas $35
    Coca-Cola Vidrio $35
```

Resumen a domicilio:

```
📝 *Resumen de tu pedido*
*M-1234* · Moloteando

- Molotes de Queso Oaxaca (orden de 3)
    2 × $130 c/u = $260
- Refrescos Familia Coca-Cola
    _Coca-Cola Sin Azúcar_
    1 × $35 c/u = $35

*Total: $295*

🛵 *Entrega:* A domicilio
Calle 5 #10, Centro
*Nombre:* Ana
*Notas:* Sin notas
El personal te confirmará el costo del envío.

✅ Escribe *sí* para confirmar.
O escribe una nota para agregarla.
Escribe *cancelar* para cancelar.
```

En la plantilla del personal, `entrega` sigue siendo "A domicilio: Calle 5 #10, Centro".

Estimación del análisis: el saludo con el menú de Molotes mide unos 1050 caracteres, por debajo de 1600.

## Historias de usuario

- **HU-1.** Como cliente en el celular, quiero ver cada producto con su precio sin renglones cortados, para elegir rápido.
- **HU-2.** Como cliente, quiero que el carrito y el resumen separen cada producto, el total y mis datos, para revisar antes de confirmar.
- **HU-3.** Como dueño, quiero que todos los mensajes del bot se vean ordenados, para dar una imagen profesional.

## Reglas de negocio

- RF-1 a RF-12.
- Se usa el mismo formato en los dos negocios.
- No se agregan emojis.
- La plantilla `nuevo_pedido` queda intacta (cuerpo y valores de los parámetros).
- Ningún turno de los escenarios de REQ-F-013 CA-1 a CA-3 gana mensajes.

## Criterios de aceptación

- **CA-1.** Given el catálogo actual de los dos negocios, When se muestra el menú, Then:
  - ningún renglón contiene a la vez el nombre de un producto y un precio;
  - cada renglón de precios mide 28 o menos de ancho visible, salvo una opción individual más larga que 28 (era 32; D-9);
  - hay exactamente un renglón en blanco entre productos.
- **CA-2.** Given un producto cuyas opciones unidas superan 28 (Bebidas y Consomé Chico de Birria; era 32, D-9), When se muestra, Then cada opción va en su propio renglón.
- **CA-3.** Given cualquier texto fijo del bot, When se genera, Then:
  - sus renglones estructurados sin datos variables miden 28 o menos (era 32; D-9);
  - no hay dos renglones en blanco seguidos, ni espacios al final, ni renglones en blanco al principio o al final;
  - ningún renglón tiene más de dos emojis;
  - no aparece ningún emoji que no exista hoy.
- **CA-4.** Given el carrito, el resumen y "Agregado:", When se muestran, Then cada línea sigue el bloque de RF-4 (detalle en cursiva en su propio renglón) y el total va en negrita, separado con un renglón en blanco.
- **CA-5.** Given cualquiera de los 6 mensajes de contacto directo o el de horario y ubicación, When se envía, Then el contacto o la URL va solo en su renglón.
- **CA-6.** Given Meta y Twilio y los escenarios de REQ-F-013 CA-1 a CA-3, When se recorren, Then el número de mensajes del bot es igual al de antes del cambio. Con Twilio, el saludo con el menú llega en 1 mensaje de 1600 caracteres o menos.
- **CA-7.** Given Twilio y un menú de 50 productos con nombres de 80 caracteres, o un carrito de 15 líneas con detalles de 60, When se parte, Then cada parte mide 1600 o menos y ningún bloque de producto ni línea del pedido queda repartido entre dos partes.
- **CA-8.** Given un pedido confirmado (recoger y domicilio, en horario y fuera de horario), When se avisa al personal por plantilla, Then el cuerpo y los valores de los parámetros son idénticos a los de antes del cambio.
- **CA-9.** Given las mismas entradas del cliente (por números y en texto libre), When se recorre el flujo, Then el carrito, el total, el código y las transiciones son idénticos a los de antes del cambio.
- **CA-10.** Given los textos W-1 a W-6, When se generan, Then coinciden con la redacción aprobada en este ticket. Ningún otro texto cambia de redacción (solo saltos de línea, renglones en blanco y negritas).
- **CA-11.** Given un Android y un iPhone con el tamaño de letra predeterminado, When se recorre el flujo completo en los dos negocios, Then:
  - ningún renglón de precios queda partido;
  - la sangría se ve o, si no se conserva, el precio queda inmediatamente debajo del nombre.

  Es una verificación manual y queda registrada en QA.

## Casos límite

- Nombre de producto de 80 caracteres: el nombre se parte solo y el renglón de precios queda intacto.
- Producto sin emoji.
- Producto con una sola opción sin etiqueta ("$35").
- Producto con 3 o más opciones.
- Etiqueta de opción más larga que 32.
- Menú vacío.
- Detalle de 60 caracteres.
- Dirección y notas de 200 caracteres.
- Carrito de 15 líneas.
- Fuera de horario.
- Catálogo modificado durante el pedido.
- Aclaración con varios bloques.
- WhatsApp Web o escritorio: no aparecen cortes forzados raros, porque solo se parte en puntos con sentido.
- Letra grande en el teléfono: puede partir de todos modos y no se controla.
- El cliente copia y envía un renglón del menú: se entiende igual (CA-9).
- WhatsApp no conserva los espacios iniciales: se aplica el respaldo de RF-3.

## Dependencias

- REQ-F-009 y REQ-F-012: CA-6 de REQ-F-012 pasa de "renglón" a "bloque" (RF-12).
- REQ-F-013: CA-1 a CA-3, I-1 y la regla de emojis.
- REQ-F-025: mensajes fijos y conteo de salientes (D-T2).
- Pruebas existentes que comparan textos exactos: al menos `whatsapp-bot-conversation`, `whatsapp-bot-qa-req-f-013`, `whatsapp-bot-emojis` y `whatsapp-bot-free-text`.
- Los ejemplos del bot en el README, si los hay.
- Un Android y un iPhone reales para CA-11.

## Riesgos

- No sabemos cómo tratan Android, iOS y Web la sangría y las listas "1. ". Mitigación: probarlo en un dispositivo antes de cerrar la implementación, con el respaldo de RF-3.
- Los mensajes son más largos. Mitigación: CA-6 y CA-7. En casos extremos con Twilio (carritos muy grandes), un turno puede partirse en más mensajes, sin cortar bloques.
- Si se modifica por error un texto compartido con la plantilla, cambia lo que recibe el personal. Mitigación: CA-8.
- Regresiones en las pruebas de texto exacto.

## Action Plan

### Objetivo

Reacomodar todos los textos del bot al cliente según RF-1 a RF-12, con el mismo contenido funcional.

### Alcance

El de la sección "Alcance".

### Fuera de alcance

El de la sección "Fuera de alcance".

### Cambios requeridos

1. Formato del menú (RF-3).
2. Bloque de línea de pedido en el carrito, el resumen y "Agregado" (RF-4 y RF-5), sin tocar los valores de los parámetros de la plantilla.
3. Acomodo de los textos fijos según "Formato por texto", y las redacciones W-1 a W-6, en `src/content/common/bot.ts`.
4. Partición por bloques (RF-12).
5. Pruebas nuevas:
   - ancho visible;
   - un renglón en blanco entre productos;
   - opciones partidas;
   - invariantes de plantilla, de flujo y de número de mensajes;
   - partición por bloques;
   - los textos W.
6. Actualizar las pruebas de texto existentes.
7. Actualizar los ejemplos de la documentación.

### Reglas de negocio

RF-1 a RF-12.

### UX/UI

- Mobile-first con N = 32.
- Jerarquía con negritas y renglones en blanco.
- Sangría en los precios, con respaldo si no se conserva.
- Sin emojis nuevos.

### Integraciones

- Límites de Meta (4096) y Twilio (1600).
- La plantilla `nuevo_pedido` no cambia.

### Casos límite

Los de la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-11.

### Dependencias

Las de la sección "Dependencias".

### Riesgos

Los de la sección "Riesgos".

### Orden recomendado

1. Prueba en un dispositivo real de la sangría y de los números en negrita.
2. Menú.
3. Líneas del pedido, carrito y resumen.
4. Textos fijos y W-1 a W-6.
5. Partición por bloques.
6. Pruebas.
7. Simulador `bot:chat` en 2026-10-15T13:00 (Molotes) y 2026-10-17T13:00 (Birria), con Meta y con Twilio.
8. Verificación manual en teléfonos (CA-11).

### Resultado esperado

Conversaciones ordenadas y legibles en el celular, con el mismo flujo, los mismos datos, el mismo número de mensajes y la misma plantilla.

## Trazabilidad

| Origen | Requisito | Criterio |
| --- | --- | --- |
| C-1 / HU-1 / decisiones 1 a 4 | RF-1, RF-3 | CA-1, CA-2, CA-11 |
| HU-2 | RF-4, RF-5 | CA-4 |
| C-2 / HU-3 | RF-2, RF-6 a RF-9 | CA-3, CA-5 |
| Decisión 6 | W-1 a W-6, RF-10 | CA-10 |
| C-5 / X-1 (bloque en vez de renglón) | RF-12 | CA-7 |
| C-7 / X-2 (longitud frente a número de mensajes) | RF-10 | CA-6 |
| C-6 / X-3 (textos compartidos con la plantilla) / decisión 5 | RF-10 | CA-8 |
| C-8 | RF-10 | CA-9 |

No hay diseño en `_stich_source_/` que aplique al chat. No queda ningún requisito sin trazabilidad.

## Technical Action Plan

Revisión técnica hecha el 2026-10-15 con CodeGraph (`messages.ts`, `text.ts`, `conversation.ts`, `orchestrator.ts`, `twilio-bot.ts` y sus pruebas), lecturas dirigidas de `src/content/{common,molotes,birria}/bot.ts` y el simulador `bot:chat` (Molotes 2026-10-15T13:00 con Meta; Birria 2026-10-17T13:00 con Twilio). No hay contradicciones que bloqueen: el plan fija las decisiones técnicas D-1 a D-7 con su opción recomendada. D-1 depende de una prueba en teléfonos reales que se hace **antes** de escribir código (paso 0 del orden de implementación).

### Objetivo técnico

Reacomodar el texto que generan `messages.ts` y los textos de `src/content/common/bot.ts` según RF-1 a RF-12, con una función de ancho visible verificable, una partición de mensajes por bloques y pruebas que fijen como invariantes la plantilla, el flujo y el número de mensajes.

### Hallazgos de la revisión

- **H-1. Textos compartidos con la plantilla (punto 3 del BA).** `deliveryText()` (`messages.ts:152`) produce a la vez la línea "Entrega" del resumen y el parámetro `entrega` de la plantilla (`buildStaffTemplate`, y `staffNoticeText` de Twilio). El resumen nuevo ("A domicilio" y la dirección en el renglón siguiente) no puede salir de `botText.delivery` (`'A domicilio: {direccion}'`) sin cambiar la plantilla. `pickup` y `noNotes` sí se pueden seguir compartiendo, porque su valor no cambia. `staffHours` y `staffOffHours` solo los usa la plantilla. Resolución en D-3.
- **H-2. `lineLabel()` alimenta la plantilla.** La usan `staffLine` y `compactLines` (parámetro `lineas`), además de `removePrompt`, `removed`, `lineRemoved`, `linePriceChanged` y `lineTooLarge`. No se modifica: el bloque nuevo de línea de pedido es una función aparte.
- **H-3. La partición actual (`chunkText`) es por renglones.** La usan `reply()` del orquestador (cada parte cuenta como saliente en REQ-F-025), `menuMessages()` y el aviso en texto libre de Twilio (`sendStaffNotice`, fuera de alcance). Con renglones agrupados en bloques, partir por renglón puede separar el nombre de su precio. Resolución en D-2.
- **H-4. Etiquetas fijas en el código.** "Entrega:", "Nombre:", "Notas:" y "Total:" están escritas en `messages.ts` (`summary`, `cartView`). Para cumplir RF-11 (textos fijos en contenido) pasan a `botText` sin cambiar su redacción.
- **H-5. Medición de CA-6 con el catálogo de las semillas** (prototipo del formato nuevo; longitud en unidades UTF-16, que es como cuenta `chunkText`, y la medida más conservadora para Twilio):

  | Mensaje | Abierto | Cerrado, acepta pedidos |
  | --- | --- | --- |
  | Saludo + menú de Molotes (10 productos) | 1044 | 1145 |
  | Saludo + menú de Birria (6 productos) | 703 | 804 |

  Hoy (formato actual, medido con el simulador) el saludo con el menú de Molotes mide 972. Con el aviso del otro negocio se suman unas 90. Queda un margen de unas 450 unidades bajo 1600, unos 4 productos más de Molotes (unas 90 por producto). El renglón de precios más ancho mide 27 (Molotes) y 29 (Birria). "Aguas Frescas $35 · Coca-Cola Vidrio $35" mide 40, así que va una opción por renglón (CA-2). El mensaje del carrito de CA-1 (agregado + carrito + opciones + datos + privacidad + invitación) se estima en unas 800 y el de CA-2 con saludo, en unas 1000. Ningún escenario de REQ-F-013 CA-1 a CA-3 se acerca a 1600 ni a 4096.
- **H-6. Formato automático de WhatsApp.** Las versiones actuales convierten en lista un renglón que empieza con "- ", "* " o "1. ". `*1.*` (número en negrita) no empieza con "* " y no se convierte. Los "- " del resumen, de "Agregado" y de W-3 sí pueden mostrarse como viñetas y alterar la sangría del renglón siguiente. Se comprueba en el paso 0.
- **H-7. Copiar y pegar (CA-9).** `normalizeInput` quita `*`, `_` y `~` y convierte en espacio cualquier separador Unicode (`\s` de JS incluye U+00A0, U+2007 y U+2003). Un renglón copiado del menú nuevo se interpreta igual que hoy. Se añade una prueba.

### Decisiones técnicas

**D-1. Sangría (RF-3; punto 1 del BA).** La sangría es una constante única `INDENT` en `src/services/whatsapp-bot/text.ts`. Se usa en el renglón de precios del menú, en el detalle y en el renglón de cantidad de las líneas del pedido. Su valor se elige con la prueba del paso 0, en este orden de preferencia:

1. 4 espacios normales: lo más simple, y se copia y pega sin sorpresas.
2. 4 × U+00A0 (espacio de no separación).
3. 4 × U+2007 (espacio de cifra).
4. Respaldo de RF-3, sin sangría: el precio va justo debajo del nombre. Como entonces la partición no puede reconocer la continuación del bloque por la sangría, las líneas del pedido (carrito, resumen y "Agregado") se separan entre sí con un renglón en blanco, igual que los productos del menú.

**Recomendada:** la primera variante que se vea bien en Android, iPhone y WhatsApp Web. "↳" queda descartado: es un símbolo nuevo que no está en el ticket.

**Prueba del paso 0 (la ejecuta la sesión principal con permiso del usuario; este agente no envía nada).**

- **Canal preferido:** la app de desarrollo de Meta (WABA de prueba) hacia un número de prueba verificado, o el sandbox de Twilio. Así no se toca producción.
- **Si hay que usar producción:** un mensaje de texto de la Cloud API desde el número del bot al número del personal 523330254871.
  - Requiere que ese número haya escrito al bot en las últimas 24 h; si no, Meta rechaza el texto libre con el error 131047.
  - Ese mensaje entrante abre una conversación con el bot (respuesta de saludo; cuenta para los topes de REQ-F-025, sin efecto práctico).
  - El token se toma del entorno sin imprimirlo y no se registra el cuerpo de la respuesta.
- **Cuerpo del mensaje.** Un único texto. Cada variante va precedida de una regla de 32 caracteres (`12345678901234567890123456789012`) para ver si 32 caben en un renglón:
  - A) 4 espacios, B) 4 × U+00A0, C) 4 × U+2007 y D) 2 × U+2003, cada una con `*1.* 🧀 *Molotes de Queso Oaxaca*` y debajo `<sangría>pieza $45 · orden de 3 $130`;
  - E) la misma pareja sin sangría;
  - F) una línea del pedido con detalle: `- Refrescos Familia Coca-Cola` / `<sangría>_Coca-Cola Sin Azúcar_` / `<sangría>1 × $35 c/u = $35`;
  - G) el bloque W-3 (`Si es todo, envíame:` / `- tu nombre` / `- 🏪 *recoger* o 🛵 *a domicilio*` / `  (con tu dirección)`);
  - H) `1. 📋 Ver el menú` frente a `*2.* 🍗 *Molotes de Tinga de Pollo*`.
- **Se registra en el ticket**, por variante y en Android, iPhone y WhatsApp Web:
  - si se ve la sangría;
  - si el número en negrita se ve en negrita;
  - si "- " se convierte en viñeta y cómo queda el renglón siguiente;
  - si la regla de 32 cabe en un renglón con la letra predeterminada.
- **Comprobación adicional:** copiar el renglón A, B o C y enviarlo al bot no debe cambiar la interpretación (H-7).

**Resultado de la prueba del paso 0 (2026-10-15).** Mensaje enviado por la sesión principal desde producción al 523330254871 a las 11:30 UTC (HTTP 200). Se revisó en **un solo teléfono** del usuario (sin Android/iPhone/Web por separado). Cita textual: "A si, B si, C si, D no, E no, F si, G si, H se ve raro no enendí".

- A, B y C (4 espacios, U+00A0, U+2007): la sangría se ve. D (U+2003) y E (sin sangría): no.
- F (línea de pedido con "- " y sangría) y G (bloque W-3): se ven bien.
- H (numeración "1. " frente a "*2.*"): se ve raro. Decisión pendiente del usuario; mientras tanto no se cambia la numeración más allá del plan.
- **D-1 fijada: opción 1, `INDENT` = 4 espacios normales.** CA-11 sigue pendiente de QA en Android e iPhone.

**D-2. Partición por bloques (RF-12; punto 2 del BA, frente a REQ-F-012 CA-6).** Nueva función pura `splitMessage(text, max)` en `text.ts`, usada por `reply()` del orquestador y por `menuMessages()`:

- **Unidad de partición: el bloque.** Un bloque es un renglón no vacío más los renglones que lo siguen y empiezan con sangría (espacio, U+00A0 o U+2007). Los bloques se separan por "\n" o por un renglón en blanco.
- **Encabezados.** Un bloque que es solo un encabezado en negrita (`*MOLOTES*`, `*1) …*` de la aclaración) se queda con el bloque siguiente, para que un encabezado nunca quede solo al final de una parte.
- **Empaque voraz.** Se agregan bloques mientras quepan en `max`. En el corte se descarta el separador, así que ninguna parte empieza ni termina con un renglón en blanco (RF-7).
- **Bloque más largo que `max`** (hoy imposible: nombre ≤ 80 y detalle ≤ 60): se parte por renglones con `chunkText`, que se mantiene tal cual.
- **Aviso en texto libre de Twilio (`sendStaffNotice`):** sigue con `chunkText`. Queda fuera de alcance y su comportamiento no cambia.
- **Equivalencia con hoy:** sin renglones en blanco ni sangrías, `splitMessage` da las mismas partes que `chunkText` (lo comprueba una prueba). Por eso el número de salientes de REQ-F-025 solo cambia cuando el texto realmente crece.

Recomendada esta opción. La alternativa, que los constructores devuelvan estructuras de bloques en lugar de texto, obliga a cambiar `Turn.say`, `mergeFrom` y decenas de pruebas, sin beneficio para dos landings.

El README pasa de "sin cortar nunca un producto del menú" a "sin separar nunca un producto del menú ni una línea del pedido (bloque)". REQ-F-012 CA-6 queda ampliado por RF-12; su ticket cerrado no se edita.

**D-3. Textos compartidos con la plantilla (punto 3 del BA; RF-10, CA-8).**

- `pickup`, `delivery`, `staffHours`, `staffOffHours`, `noNotes` y `staffNotice` no cambian ni de valor ni de uso en la plantilla.
- `deliveryText()` se queda solo para la plantilla y el texto libre de Twilio.
- El resumen usa:
  - una clave nueva `deliveryHome: 'A domicilio'` (solo para el cliente), con la dirección en el renglón siguiente;
  - `pickup` para recoger (mismo valor);
  - `noNotes` para las notas vacías (mismo valor).
- Las etiquetas pasan a `botText` con la misma redacción: `summaryFields: { delivery: 'Entrega:', name: 'Nombre:', notes: 'Notas:' }` y `total: 'Total: {total}'`. La negrita la pone el código.
- El comentario de cabecera de `common/bot.ts` amplía la lista de claves que nunca se reacomodan (las de la plantilla).
- **Protección:** una prueba dorada (golden) escrita y en verde **antes** de tocar el código. Fija los parámetros, el cuerpo hidratado de la plantilla y `staffNoticeText` para recoger y domicilio, en horario y fuera de horario, más un pedido grande que se compacta (nivel > 0).

**D-4. Ancho visible (RF-1; función testeable).** Se exportan desde `text.ts`:

- `MAX_LINE_WIDTH = 32`;
- `visibleWidth(line)`:
  1. quita hasta 4 caracteres iniciales de sangría (espacio, U+00A0, U+2007);
  2. quita los marcadores `*`, `_` y `~`;
  3. recorre los grafemas con `Intl.Segmenter` (nativo, sin dependencias): un grafema con `\p{Extended_Pictographic}` cuenta 2 y cualquier otro, 1. Así `🕒`, `✅` y un emoji con U+FE0F o ZWJ cuentan como uno solo, y "×", "·" y las letras acentuadas cuentan 1.

`visibleWidth` también es código de producción: `menuText` decide con ella si las opciones van unidas con " · " (ancho ≤ 32) o una por renglón. Para las pruebas se añade `emojiCount(line)`, con la misma segmentación.

**D-5. Dónde vive el formato (RF-11).**

- En `messages.ts`, funciones compartidas por los dos negocios:
  - `menuProductBlock(number, emoji, product)`;
  - `orderLineBlock(line, marker)`, donde el marcador es `*N.*` en el carrito y `-` en el resumen;
  - `addedLineBlock(line)`, para "Agregado": `- 2 × Nombre (opción)` y el detalle en cursiva en su renglón con sangría.
- `conversation.ts:446` deja de armar el renglón de "Agregado" y llama a `addedLineBlock`.
- El encabezado de sección en mayúsculas se calcula al mostrarlo (`toLocaleUpperCase('es-MX')`), sin cambiar `sections` en el contenido.
- Los textos fijos siguen en `src/content/common/bot.ts`. Un cambio del catálogo en /admin no toca código.

**D-6. Interpretación del "Formato por texto"** (recomendada; queda aprobada junto con el plan):

| Clave | Texto propuesto (`\n` = salto; `\n\n` = renglón en blanco) |
| --- | --- |
| `greeting` | `¡Hola! 👋 Te atiende el asistente de *{negocio}*.\n\n{lema}` (y `greetingHeader` une saludo y estado con `\n\n`) |
| `closedNow` | `🌙 En este momento estamos cerrados.\nAbrimos {apertura}.\n\nPuedes ver el menú y dejar tu pedido: lo atenderemos cuando abramos.` |
| `closedNoOrders` | `🌙 En este momento estamos cerrados.\nAbrimos {apertura}.\n\nPuedes ver el menú; los pedidos se reciben desde el día anterior a la apertura.` |
| `rootOptions` | `*¿Qué deseas hacer?*` y la lista sin cambios. `greeting()` separa opciones, invitación y palabras clave con `\n\n` |
| `keywordsHint` (W-1) | `💬 En cualquier momento escribe:\n*menú* · *carrito* · *cancelar*\n*persona* · *ayuda*` |
| `orderInvite` (W-2) | `O escríbeme tu pedido, por ejemplo:\n*{ejemplo}*` |
| `menuPrompt` (W-2) | `Escríbeme tu pedido, por ejemplo:\n*{ejemplo}*\n\nTambién puedes escribir el número de un producto.` |
| `help` (W-2) | `Puedes escribir tu pedido con tus palabras, por ejemplo:\n*{ejemplo}*\n\nTambién respondo a números de opción y a palabras clave.` |
| `hoursAndLocation` | `🕒 *{negocio}* atiende {horario}.\n\n📍 *Ubicación:*\n{mapa}` |
| `otherBusiness` | `*{otro}* atiende {horarioOtro}.\n\nHoy te atiende *{negocio}*.` |
| `ordersClosed` | Tres párrafos: `🌙 Por ahora *{negocio}* no está tomando pedidos: abre {apertura}.` / `*{otro}* abre {aperturaOtro}.` / `Puedes ver el menú (escribe *menú*) o hablar con una persona (escribe *persona*).` |
| `menuEmpty` | `Por ahora no tenemos productos disponibles.\n\nEscribe *persona* para hablar con alguien de {negocio}.` |
| `askQuantity` | `¿Cuántas de *{producto}*?\nEscribe un número del 1 al {max}.` |
| `askData` (W-3) | Exactamente como W-3; `dataRequest()` une `askData` y `privacy` con `\n\n` |
| `dataOrProducts` (W-4) | `Tu mensaje trae productos y datos de entrega.\n¿Qué hago?\n1. Agregar los productos\n2. Son mis datos de entrega` |
| `removePrompt` / `removeWhich` | `¿Qué producto quitas?\nEscribe su número.\n\n{lineas}` / `¿Cuál quitas?\nEscribe su número.\n\n{lineas}` (la lista es de productos: lleva un renglón en blanco) |
| `askAddress` | `¿Cuál es la dirección de entrega?\n(calle, número, colonia y referencias)` |
| `summaryTitle` | `📝 *Resumen de tu pedido*\n*{codigo}* · {negocio}` |
| `offHours` (W-5) | `🌙 *FUERA DE HORARIO*\nTu pedido se atenderá cuando abramos, {apertura}.` |
| `confirmPrompt` (W-6) | `✅ Escribe *sí* para confirmar.\nO escribe una nota para agregarla.\nEscribe *cancelar* para cancelar.` |
| `confirmed` | `¡Listo! 🙌\nTu pedido *{codigo}* fue enviado a {negocio}.\n\nEl personal te escribirá para confirmarlo. 😋` |
| `cancelled` | `Pedido cancelado.\n\nCuando quieras, escríbenos de nuevo. 👋` |
| `person` | `🙋 Para hablar con una persona de *{negocio}*, escribe a:\n{contacto}` |
| `staffFailed` | `No pude enviar tu pedido *{codigo}* al personal de {negocio}.\n\nPor favor escríbeles directamente:\n{contacto}` |
| `orderCapContact` | `Tu pedido *{codigo}* no se pudo enviar automáticamente al personal de {negocio}.\n\nPor favor escríbeles directamente con tu pedido:\n{contacto}` |
| `orderLimitReached` | `Por hoy ya recibimos el máximo de pedidos desde este número.\n\nSi quieres pedir algo más, escribe directamente al personal de *{negocio}*:\n{contacto}` |
| `dailyLimitReached` | `Llegaste al límite de mensajes de hoy con el asistente.\n\nPara continuar, escribe directamente al personal de *{negocio}*:\n{contacto}` |
| `directContactMode` | `Por ahora no puedo tomar pedidos por este medio.\n\nEscribe directamente al personal de *{negocio}*:\n{contacto}` |

Sin cambios:

- `openNow`, `notUnderstood`, `textOnly`, `chooseOption`, `invalid*`, `added`, `notAdded` y las líneas `- …` de sus listas, `dataLater`, `dataHint`, `clarify*`, `removeNotFound`, `cartTitle`, `cartEmpty`, `cartOptions`, `removed`, `emptied`, `privacy`, `askName`, `askDelivery`, `deliveryCost`, `catalogChanged`, `lineRemoved`, `linePriceChanged`, `cartNowEmpty` y `moreHint`.
- `lineTooLarge` y `tooManyLines` tampoco cambian: también van dentro de un elemento `- {motivo}` de "No agregué", y un salto los partiría.
- `clarifyBlock` mantiene el encabezado pegado a sus opciones: separarlos lo despegaría de su bloque.

**D-8. Números en negrita en todas las listas (decisión del usuario, 2026-10-15).** Tras la variante H de la prueba del paso 0, el usuario decidió: "1 si". Todas las listas numeradas del bot usan el número en negrita (`*1.*`, `*2.*`…): menú, `rootOptions`, `cartOptions`, `askDelivery`, `dataOrProducts`, opciones de un producto, aclaraciones y quitar. Así no se mezclan estilos ni se dispara la lista automática de WhatsApp. Lo que escribe el cliente no cambia ("1", "2"…). Un solo constructor, `listItem(n, texto)` en `messages.ts`. Los marcadores `*` no cuentan en el ancho visible.

**D-9. N = 28 (decisión del usuario, 2026-10-15).** En el teléfono del usuario la regla de 32 dígitos no cabía en un renglón ("2 se partia"). Midió que llegaba "hasta el 9" (29 dígitos en el primer renglón) y eligió N: "28". Cambia el requisito aprobado: RF-1, CA-1, CA-2 y CA-3 pasan de 32 a 28. `MAX_LINE_WIDTH = 28` en `text.ts`.

Efectos:

- W-1 y W-3 se reacomodan (W-1′ y W-3′ en la tabla de redacciones), conservando las palabras clave.
- "Con Carne $80 · Sin Carne $45" (29) pasa solo a una opción por renglón.
- Ningún otro texto fijo supera 28 (lo comprueba la prueba de CA-3).

**D-7. Sin normalizador global.** No se agrega una función que "limpie" el texto antes de enviarlo (colapsar renglones en blanco, quitar espacios finales): ocultaría errores de los constructores. RF-7 se garantiza con las pruebas de corpus (abajo). La alternativa, aplicar un `tidy()` en `reply()`, es más defensiva pero hace que las pruebas de `handleTurn` no vean lo que se envía.

### Archivos o componentes afectados

- `restaurante/src/services/whatsapp-bot/text.ts`: `INDENT`, `MAX_LINE_WIDTH`, `visibleWidth`, `emojiCount`, `splitMessage`. `chunkText` no cambia.
- `restaurante/src/services/whatsapp-bot/messages.ts`:
  - funciones que cambian: `greetingHeader`, `greeting`, `menuText`, `menuMessages`, `cartView`, `dataRequest`, `summary`;
  - funciones nuevas: `menuProductBlock`, `orderLineBlock`, `addedLineBlock`;
  - sin cambios: `deliveryText`, `lineLabel`, `staffLine`, `buildStaffTemplate`, `staffNoticeText` y `STAFF_TEMPLATE_BODY`.
- `restaurante/src/services/whatsapp-bot/conversation.ts`: solo la línea de "Agregado" (`:446`). Sin cambios de flujo.
- `restaurante/src/services/whatsapp-bot/orchestrator.ts`: `reply()` usa `splitMessage` en lugar de `chunkText`.
- `restaurante/src/content/common/bot.ts`: textos de D-6 y claves nuevas `deliveryHome`, `summaryFields` y `total`.
- `restaurante/README.md`: "Mensajes largos" (D-2) y los ejemplos de textos del bot, si los hay.
- Pruebas (ver Testing).

### Validaciones

- No hay entradas externas nuevas. Los datos del cliente siguen pasando por `cleanText` (sin saltos ni sangría inicial), así que un dato del cliente no puede imitar la continuación de un bloque en `splitMessage`.
- `visibleWidth` y `splitMessage` son funciones puras y totales: nunca lanzan, y una cadena vacía da 0 o `[]`.

### Manejo de errores

Sin cambios. `reply()` conserva el corte al primer envío fallido y la reserva y liquidación por parte de REQ-F-025.

### Testing

Orden: las pruebas doradas, primero y con el código actual; después, el cambio.

1. **Doradas antes de cambiar (CA-8, CA-9).**
   - `tests/unit/whatsapp-bot-template-golden.test.ts`: los parámetros exactos, el cuerpo hidratado (`hydrateStaffTemplate`) y `staffNoticeText` de 4 pedidos (recoger y domicilio, en horario y fuera de horario) y de un pedido compactado. Los literales se generan con el código actual.
   - `tests/unit/whatsapp-bot-flow-golden.test.ts`: recorridos por números y en texto libre, en los dos negocios. Registra por turno el paso, el carrito (slug, opción, cantidad, precio, detalle), el total, el código y el número de respuestas. No registra los textos.
   - Las dos pruebas tienen que seguir en verde, sin tocarlas, después del cambio.
2. **`text.ts` (unitarias, en `whatsapp-bot-infra.test.ts` o en un archivo nuevo `whatsapp-bot-format.test.ts`):**
   - `visibleWidth`: marcadores, sangría ≤ 4 de cada tipo, emoji = 2 (también con U+FE0F y ZWJ), acentos = 1, "×" y "·" = 1, la regla de 32.
   - `splitMessage`: corte en un renglón en blanco y entre renglones; un bloque con sangría nunca se separa; un encabezado se queda con su bloque; ninguna parte empieza ni termina con un renglón en blanco; cada parte ≤ `max`; bloque mayor que `max` partido por renglones; igual a `chunkText` en un texto sin renglones en blanco ni sangría.
3. **Formato (unitarias, `messages.ts`) con el catálogo de las semillas de los dos negocios:**
   - CA-1: ningún renglón con nombre y precio; renglones de precios ≤ 32; exactamente un renglón en blanco entre productos.
   - CA-2: las bebidas de Birria, una opción por renglón.
   - Casos límite: producto sin emoji, una opción sin etiqueta, 3 o más opciones, etiqueta de más de 32 sola en su renglón, nombre de 80 caracteres, menú vacío.
   - CA-4: carrito, resumen y "Agregado" con y sin detalle, detalle de 60 caracteres, dirección y notas de 200, recoger y domicilio, fuera de horario.
   - CA-5: los 6 mensajes de contacto y el de horario y ubicación, con el contacto o la URL como renglón completo.
   - CA-10: W-1 a W-6, textos exactos.
4. **Corpus (CA-3).**
   - El corpus reúne todas las claves de `botText` rellenadas con valores de ejemplo y todas las respuestas de los recorridos del punto 1.
   - Sobre todo el corpus se comprueba: RF-7 (sin dos renglones en blanco seguidos, sin espacios finales, sin renglones en blanco al principio ni al final), como mucho 2 emojis por renglón, y que todo emoji pertenezca a un conjunto fijo de los emojis de hoy (lista literal en la prueba).
   - Ancho ≤ 32 en los renglones estructurados: una lista explícita de claves y de renglones (títulos, listas fijas, palabras clave, etiquetas, totales, `offHours`, los renglones de precios y de cantidad), sin los datos variables.
   - Además, un renglón del menú copiado (con `*`, emoji y cada variante de sangría) se interpreta igual que el texto plano (H-7).
5. **Integración.**
   - `tests/integration/chat-bot-message-count.test.ts` (CA-6, Meta y Twilio): mismos conteos que hoy, y el saludo con el menú ≤ 1600 en un mensaje. Se actualizan las cadenas esperadas.
   - CA-7 (Twilio, en el orquestador con el doble): un menú de 50 productos con nombres de 80 caracteres y un carrito de 15 líneas con detalles de 60. Cada parte ≤ 1600, ningún bloque repartido (cada renglón de precio o cantidad está en la misma parte que su nombre) y las partes coinciden con los salientes contados por REQ-F-025.
6. **Actualización de las pruebas de texto exacto existentes.** Afectadas según el radio de impacto de CodeGraph: `whatsapp-bot-conversation`, `whatsapp-bot-free-text`, `whatsapp-bot-qa-req-f-013` (unitaria e integración), `whatsapp-bot-emojis`, `whatsapp-bot-orchestrator`, `whatsapp-twilio-qa-round1`, `chat-bot-contract`, `chat-bot-message-count`, `bot-protection-qa-req-f-025`, `bot-chat`. Solo cambian las cadenas esperadas, nunca los conteos ni los estados.
7. **Simulador.** `bot:chat` en 2026-10-15T13:00 (Molotes) y 2026-10-17T13:00 (Birria), con Meta y con Twilio: saludo, menú, pedido en texto libre, carrito, datos, resumen a domicilio, fuera de horario y confirmación. Se copia la salida en el Implementation Result.
8. **CA-11 (manual, QA):** Android y iPhone con la letra predeterminada, en los dos negocios.

Comandos: `npm run typecheck`, `npm run lint`, `npm test` (con `npm run db:up`). No hace falta `build:css`.

### Seguridad

- Sin rutas, dependencias ni cabeceras nuevas.
- Los logs no cambian: nunca registran textos.
- La prueba del paso 0 no deja el token en la terminal ni en el ticket.
- La plantilla queda protegida por la prueba dorada.

### Performance

- `Intl.Segmenter` se crea una sola vez por módulo.
- `splitMessage` es lineal en el tamaño del texto.
- Los mensajes crecen entre un 10 % y un 15 % (renglones en blanco y sangría), sin efecto en el número de mensajes de los escenarios medidos (H-5).

### Riesgos técnicos

- **R-1. Cómo se ve la sangría y "- " en cada cliente (H-6).** Mitigación: el paso 0 antes de programar, y el respaldo de D-1 ya definido.
- **R-2. Nombres con `*`, `_` o `~`** (los edita /admin) pueden romper la negrita del nombre en el menú. Hoy ningún nombre los usa. WhatsApp no permite escaparlos. Se documenta en el README y no se filtran (cambiaría el dato).
- **R-3. Catálogo de producción distinto de las semillas.** Con más de unos 14 productos en Molotes, el saludo con el menú pasaría de 1600 con Twilio (solo desarrollo) y llegaría en 2 mensajes, sin cortar bloques. Con Meta (producción), el límite de 4096 da margen para unos 40 productos.
- **R-4. Carritos grandes con Twilio** pueden partirse en más mensajes que hoy. Lo acepta el ticket (Riesgos) y lo cubre CA-7. En Meta no ocurre con los topes actuales.
- **R-5. Volumen de pruebas de texto a actualizar** (unas 10 suites). Mitigación: las doradas del punto 1 garantizan que solo cambió la presentación.
- **R-6. Copiar y pegar con U+00A0 o U+2007.** Cubierto por H-7 y su prueba.

### Orden de implementación

0. **Prueba en teléfonos (D-1).** La ejecuta la sesión principal con permiso del usuario. Se registra el resultado y se fija `INDENT`. Sin este resultado no se empieza el paso 3.
1. Rama, movimiento del ticket y pruebas doradas (Testing, punto 1) en verde con el código actual.
2. `text.ts`: `visibleWidth`, `emojiCount` y `splitMessage`, con sus pruebas. `reply()` y `menuMessages` pasan a `splitMessage`.
3. Menú (RF-3), bloques del pedido, carrito, "Agregado" y resumen (RF-4, RF-5; D-3, D-5).
4. Textos de `common/bot.ts` (D-6, W-1 a W-6).
5. Pruebas de formato, de corpus, de CA-6 y de CA-7, y actualización de las existentes.
6. README.
7. `typecheck`, `lint`, `test` y el simulador con los dos negocios y los dos proveedores.

### Criterios de finalización

- CA-1 a CA-10 cubiertos por pruebas automáticas en verde. CA-11 queda para la verificación manual de QA, con el resultado del paso 0 como referencia.
- Las pruebas doradas de la plantilla y del flujo, sin modificar y en verde.
- `npm run typecheck` y `npm run lint` terminan con 0. `npm test` pasa completo.
- `git diff` sin cambios ajenos. La plantilla (`STAFF_TEMPLATE_BODY`, `buildStaffTemplate`, `deliveryText`, `lineLabel`, `staffNoticeText`) sin cambios en el código.

## Implementation Result

### Correcciones de la ronda 1 de QA (T3, 2026-10-15)

- **DEF-001 (MAJOR).** Las opciones de la aclaración usan ahora el bloque del menú: `*N.* Nombre (opción)` y, debajo con `INDENT`, el precio (≤ 28).
  - Código: en `messages.ts`, `clarifyQuestion` recibe opciones `{ label, price }` (tipo `ClarifyOption`) y las arma con `clarifyOptionBlock`. En `conversation.ts`, `clarifyText` ya no escribe "— $X" en el renglón del nombre.
  - Una opción que no se encuentra en el catálogo muestra solo su `slug`, sin precio, igual que antes.
  - Las opciones de un mismo bloque van seguidas, sin renglón en blanco. El encabezado `*N) fragmento*` queda pegado a ellas.
  - No cambian la numeración, las respuestas ni el número de mensajes: las pruebas doradas siguen en verde sin tocarlas.
- **DEF-002 (TRIVIAL).** En `splitMessage`, un encabezado unido a su bloque guarda sus unidades originales (`members`). Si juntos superan `max`, se empacan por separado: el bloque nunca se reparte si cabe solo, y ninguna parte termina ni empieza con un salto. La equivalencia con `chunkText` en textos sin formato se mantiene.
- **Pruebas:**
  - Los `it.fails` "DEF-001" y "DEF-002" de `tests/unit/whatsapp-bot-qa-req-f-029.test.ts` pasaron a `it(...)`; también se actualizó su comentario de cabecera.
  - Prueba nueva de texto exacto de la aclaración en `whatsapp-bot-format.test.ts`.
  - Ninguna suite existente fijaba el formato anterior de la aclaración, así que no hubo cadenas que actualizar.
  - No se tocaron la plantilla, `staffNoticeText`, el intérprete ni las pruebas doradas.
- **Validaciones:**
  - `npm run typecheck`: 0.
  - `npm run lint`: 0.
  - `npm test`: 89 archivos y 1778 pruebas en verde (1 fallo esperado, ya existente).
  - Simulador Birria 2026-10-17T13:00 (`Hola` → `consomé, una bebida y 2 tacos` → `2, 1`): la misma salida con Meta y con Twilio, un mensaje por turno.

### Rama

`feature/REQ-F-029-formato-textos-bot-whatsapp`, creada desde `main` actualizado. Lleva el slug del archivo del ticket. Sin commit.

### Cambios realizados

- `src/services/whatsapp-bot/text.ts`:
  - `INDENT` (4 espacios, D-1) y `MAX_LINE_WIDTH = 28` (D-9);
  - `visibleWidth` y `emojiCount` (D-4);
  - `splitMessage`, la partición por bloques (D-2). `chunkText` no cambia.
- `src/services/whatsapp-bot/messages.ts`:
  - funciones nuevas: `listItem` (D-8), `menuProductBlock`, `orderLineBlock` y `addedLineBlock`;
  - cambian el menú, el carrito, el resumen, el saludo y `dataRequest`;
  - el resumen ya no usa `deliveryText`, que sigue siendo el parámetro `entrega` de la plantilla;
  - `lineLabel`, `buildStaffTemplate`, `staffNoticeText` y `STAFF_TEMPLATE_BODY` no cambian.
- `src/content/common/bot.ts`:
  - textos de D-6, W-1′, W-2, W-3′, W-4, W-5 y W-6;
  - números en negrita en las listas fijas (D-8);
  - claves nuevas `deliveryHome`, `summaryFields` y `total`;
  - las claves de la plantilla no cambian.
- `src/services/whatsapp-bot/conversation.ts`: la línea de "Agregado" usa `addedLineBlock` y la de quitar, `listItem`.
- `src/services/whatsapp-bot/orchestrator.ts`: `reply()` parte con `splitMessage`.
- `README.md`: "Mensajes largos" y una nota nueva, "Formato de los textos".
- Pruebas:
  - Doradas de CA-8 y CA-9: `tests/unit/whatsapp-bot-golden.test.ts`, `tests/support/bot-golden.ts` y `tests/fixtures/bot-golden/{template,flow}.json`. Se generaron con el código anterior y siguen en verde sin modificarlas.
  - `tests/unit/whatsapp-bot-format.test.ts`, con 49 casos.
  - 11 suites actualizadas: solo cambian las cadenas esperadas, nunca los conteos ni los estados.

### Criterios de aceptación

- CA-1: cumplido. Prueba de formato con las semillas de los dos negocios: precios ≤ 28 y un renglón en blanco entre productos.
- CA-2: cumplido. Las bebidas y el consomé chico de Birria van una opción por renglón.
- CA-3: cumplido. Prueba sobre todo lo que dice el bot: RF-7, como mucho 2 emojis por renglón, ningún emoji nuevo y renglones estructurados ≤ 28.
- CA-4: cumplido. Textos exactos del carrito, el resumen (recoger, domicilio y fuera de horario) y "Agregado".
- CA-5: cumplido. Los 6 mensajes de contacto, más horario y ubicación.
- CA-6: cumplido. `chat-bot-message-count` con Meta y con Twilio da los mismos conteos que antes, y el saludo con el menú es un solo mensaje ≤ 1600.
- CA-7: cumplido. 50 productos con nombres de 80 caracteres y un carrito de 15 líneas con detalles de 60, más el orquestador real con Twilio y 40 productos largos.
- CA-8: cumplido. La prueba dorada de la plantilla pasa sin cambios.
- CA-9: cumplido. La prueba dorada del flujo pasa sin cambios, y un renglón copiado del menú se interpreta igual.
- CA-10: cumplido. W-1′, W-2, W-3′ y W-4 a W-6 comprobados con su texto exacto.
- CA-11: pendiente. Verificación manual de QA en Android e iPhone; la prueba del paso 0 se hizo en un solo teléfono.

### Validaciones ejecutadas

- `npm run typecheck`: código de salida 0.
- `npm run lint`: código de salida 0.
- `npm test`: 88 archivos y 1757 pruebas en verde (1 fallo esperado, ya existente).
- Simulador `bot:chat`, saludo con el menú: un solo mensaje en todos los casos. No hubo que ejecutar `build:css`.

  | Negocio y hora | Meta | Twilio |
  | --- | --- | --- |
  | Molotes 2026-10-15T13:00 | 1044 | 1044 |
  | Molotes 2026-10-15T07:00 (cerrado) | – | 1139 |
  | Birria 2026-10-17T13:00 | 705 | 705 |

- Pedido completo a domicilio en Molotes con Meta: los parámetros de la plantilla son idénticos a los de antes, incluida `entrega` ("A domicilio: Calle 5 #10, Centro").

### Archivos afectados

- `restaurante/src/services/whatsapp-bot/{text,messages,conversation,orchestrator}.ts`
- `restaurante/src/content/common/bot.ts`
- `restaurante/README.md`
- Suites actualizadas:
  - `restaurante/tests/unit/whatsapp-bot-{conversation,free-text,qa-req-f-013,emojis,orchestrator}.test.ts`
  - `restaurante/tests/integration/{bot-chat,chat-bot-contract,chat-bot-message-count,whatsapp-bot-qa-req-f-013,whatsapp-webhook,whatsapp-webhook-twilio}.test.ts`
- Nuevos:
  - `restaurante/tests/support/bot-golden.ts`
  - `restaurante/tests/fixtures/bot-golden/`
  - `restaurante/tests/unit/whatsapp-bot-golden.test.ts`
  - `restaurante/tests/unit/whatsapp-bot-format.test.ts`

### Riesgos o pendientes

- CA-11: QA en Android e iPhone.
- R-2: un nombre de producto con `*`, `_` o `~` puede romper la negrita del menú. Queda documentado en el README.
- R-3: con Twilio (solo desarrollo), más de unos 14 productos en Molotes harían que el saludo con el menú llegue en 2 mensajes, sin cortar bloques.

## QA Action Plan

Preparado por senior-qa el 2026-10-15 (fase Q1), tras la aprobación de la implementación por el usuario ("Apruebo la implementación"). Revisión previa: el ticket completo, `git diff main` (17 archivos; 6 de producción), el blast radius de CodeGraph (CLI) para `splitMessage`, `visibleWidth`, `menuProductBlock`, `orderLineBlock`, `addedLineBlock`, `listItem`, `summary` y `cartView`, y lecturas dirigidas de las pruebas doradas y del contenido de Birria.

### Objetivo

Comprobar con evidencia que los textos del bot al cliente cumplen RF-1 a RF-12 y CA-1 a CA-11 con N = 28 (D-9), números en negrita (D-8) y sangría de 4 espacios (D-1), sin cambiar la plantilla `nuevo_pedido`, el aviso en texto libre de Twilio, el flujo ni el número de mensajes.

### Requisito bajo prueba

REQ-F-029 versión 1 con D-8 y D-9: RF-1 a RF-12, redacciones W-1′, W-2, W-3′, W-4, W-5 y W-6, y las interpretaciones de D-6 aprobadas con el Technical Action Plan.

### Criterios de aceptación (cada uno → pruebas que lo cubren)

| CA | Pruebas |
| --- | --- |
| CA-1 | F-2, F-3, A-1 (`whatsapp-bot-format`), S-1 a S-3 (simulador) |
| CA-2 | F-3 (Bebidas y Consomé Chico de Birria, una opción por renglón), S-2 |
| CA-3 | F-5 (corpus), N-6 (conjunto de emojis frente a `main`), S-1 a S-4 (revisión a ojo) |
| CA-4 | F-4, S-1, S-2 |
| CA-5 | F-6, S-5 |
| CA-6 | I-3, I-4 (conteo exacto `main` frente a rama, Meta y Twilio) |
| CA-7 | L-1 a L-3, I-5 |
| CA-8 | G-1 a G-4 |
| CA-9 | G-1, G-2, G-5, N-5 |
| CA-10 | F-7 (texto exacto) y F-8 (comparación normalizada de `botText` con `main`) |
| CA-11 | M-1 (manual del usuario en Android y iPhone) |

### Riesgos identificados

- **QR-1. Doradas no generadas con el código anterior.** `tests/support/bot-golden.ts` tiene fecha de modificación 05:44, posterior a los fixtures (05:32) y a los primeros cambios de `orchestrator.ts` (05:34) y `conversation.ts` (05:36). Hay que demostrar que fixtures y soporte producen lo mismo en `main` y que el soporte no oculta diferencias (p. ej., no registrar algo que sí cambió).
- **QR-2. Plantilla en revisión en Meta.** Cualquier byte distinto en los parámetros, en el cuerpo o en `staffNoticeText` es `BLOCKER`.
- **QR-3. `splitMessage`.** La regla de encabezado (`^\*[^*\n]+\*$`) también atrapa `*Total: $X*` y `*¿Qué deseas hacer?*`; encabezados encadenados; bloque mayor que `max`; separadores con renglones de solo espacios; en el resumen, "A domicilio" y la dirección no forman un bloque con sangría y podrían quedar en partes distintas.
- **QR-4. `visibleWidth`.** Emojis con U+FE0F, ZWJ y modificador de tono; símbolos que Unicode marca como pictográficos sin parecer emoji (©, ®, ™); banderas y keycaps (no pictográficos: cuentan 1); sangría de más de 4 o mixta.
- **QR-5. Conteo de salientes.** La prueba CA-1 de `chat-bot-message-count` usa `≤`, así que no demuestra "igual que antes": se mide el conteo exacto en `main` y en la rama.
- **QR-6. Pruebas de texto exacto reescritas.** Las 11 suites modificadas solo deben cambiar cadenas, nunca conteos, estados ni aserciones debilitadas.
- **QR-7. CA-11** depende de teléfonos reales: el paso 0 se hizo en un solo teléfono.

### Pruebas funcionales

- **F-1.** `git diff main` de producción: `STAFF_TEMPLATE_BODY`, `buildStaffTemplate`, `hydrateStaffTemplate`, `deliveryText`, `lineLabel`, `staffLine`, `compactLines`, `staffNoticeText`, el intérprete y las claves `pickup`, `delivery`, `staffHours`, `staffOffHours`, `noNotes` y `staffNotice` sin cambios (inspección como apoyo; la evidencia la dan G-1 a G-4).
- **F-2.** Menú de los dos negocios con el catálogo de las semillas: ningún renglón con nombre y precio; renglones de precios ≤ 28; exactamente un renglón en blanco entre productos; título y encabezados en negrita, encabezados en mayúsculas con un renglón en blanco antes y después; invitación con el ejemplo en su propio renglón (W-2).
- **F-3.** CA-2: "Con Carne $80 · Sin Carne $45" (29) y las bebidas de Birria van una opción por renglón, con la misma sangría.
- **F-4.** CA-4: carrito (`*N.*`), resumen (`- `) y "Agregado:" (`- 2 × …`), con y sin detalle en cursiva; total en negrita y separado; resumen de recoger, domicilio (dirección en el renglón siguiente) y fuera de horario (W-5), y bloque de datos con etiquetas en negrita.
- **F-5.** CA-3 sobre el corpus: RF-7, como mucho 2 emojis por renglón, ningún emoji nuevo y renglones estructurados ≤ 28.
- **F-6.** CA-5: los 6 mensajes de contacto y `hoursAndLocation`, con el contacto o la URL como renglón completo, después de una frase terminada en ":".
- **F-7.** CA-10: W-1′, W-2 (`orderInvite`, `menuPrompt`, `help`), W-3′, W-4, W-5 y W-6 con el texto exacto del ticket.
- **F-8.** CA-10, "ningún otro texto cambia de redacción": script temporal (en el scratchpad, fuera del repo) que importa `botText` de `main` (worktree) y de la rama, normaliza (quita `*`, `_`, `~`, une saltos y espacios) y compara clave por clave. Solo pueden diferir W-1′ a W-6, las claves nuevas `deliveryHome`, `summaryFields` y `total`, y los acomodos de D-6 y D-8; cualquier otra diferencia de palabras es defecto.
- **F-9.** D-8: todas las listas numeradas usan `*N.*` (menú, `rootOptions`, `cartOptions`, `askDelivery`, `dataOrProducts`, opciones, aclaraciones y quitar) y el cliente sigue eligiendo con "1", "2"…

### Pruebas negativas y casos límite

- **N-1.** Producto sin emoji; una opción sin etiqueta ("$35"); 3 o más opciones; etiqueta de opción de más de 28 sola en su renglón; nombre de 80 caracteres; menú vacío.
- **N-2.** Detalle de 60 caracteres; dirección y notas de 200; carrito de 15 líneas.
- **N-3.** Fuera de horario; catálogo modificado durante el pedido (`catalogChanged`, `lineRemoved`, `linePriceChanged`); aclaración con varios bloques.
- **N-4.** `visibleWidth`: cadena vacía (0); marcadores `*`, `_`, `~`; sangría de 1 a 4 espacios, U+00A0 y U+2007, mezcladas, y de 5 (el quinto cuenta); acentos (1); "×" y "·" (1); emoji simple, con U+FE0F (🕒, ✅, 🛵), con ZWJ y con tono de piel (2 por grafema); bandera y keycap (documentar el valor); ©/®/™ (documentar que cuentan 2 y comprobar que no aparecen en los textos). `emojiCount` con los mismos casos.
- **N-5.** H-7: un renglón del menú copiado (con `*`, emoji y cada variante de sangría) y un renglón del carrito se interpretan igual que el texto plano.
- **N-6.** El conjunto literal de emojis permitido en la prueba de corpus es igual (o un subconjunto) al de los emojis presentes en `main` (`src/content/**` y `messages.ts`), extraído por script en el worktree de `main`.
- **N-7.** `splitMessage`: texto vacío (`[]`); solo renglones en blanco; renglones en blanco al principio y al final; renglones de solo espacios; encabezado al final del texto; dos encabezados seguidos; `*Total: $X*` tratado como encabezado (aceptable si no rompe RF-7 ni RF-12); un bloque exactamente de `max` y de `max + 1` (cae a `chunkText`); ninguna parte vacía, empieza ni termina con renglón en blanco; equivalencia con `chunkText` en un texto sin renglones en blanco ni sangría; con Twilio, si el resumen se parte, documentar si "A domicilio" y la dirección quedan separadas (no es bloque de producto ni línea del pedido según RF-12; se registra como observación, no como defecto).

### Pruebas de integración (WhatsApp)

- **I-1.** `whatsapp-webhook` (Meta) y `whatsapp-webhook-twilio`: las respuestas llegan con el formato nuevo por los dos proveedores.
- **I-2.** `chat-bot-contract`, `bot-chat`, `whatsapp-twilio-qa-round1` y `bot-protection-qa-req-f-025` en verde.
- **I-3.** CA-6 exacto: script temporal en el scratchpad que recorre los escenarios de REQ-F-013 CA-1 a CA-3 con los drivers de Meta y Twilio de `tests/support/` e imprime por turno el número de mensajes del bot y del cliente. Se ejecuta en el worktree de `main` y en la rama, y la salida debe ser idéntica. Además, el saludo con el menú con Twilio: un mensaje de ≤ 1600 (abierto y cerrado, los dos negocios).
- **I-4.** REQ-F-025: los salientes contados por la protección (reserva y liquidación por parte) coinciden con las partes enviadas, en `main` y en la rama, con Meta y Twilio (mismo script, contando `protection` o el doble de envío).
- **I-5.** CA-7 con el orquestador real y Twilio (`maxTextLength` 1600): menú de 50 productos con nombres de 80 y carrito de 15 líneas con detalles de 60; cada parte ≤ 1600, ningún nombre separado de su precio o cantidad, y partes = salientes.

### Pruebas de performance

- **P-1.** `Intl.Segmenter` se crea una vez por módulo (inspección) y `splitMessage` sobre un texto de 50 productos tarda un tiempo despreciable (medido en L-1; solo se registra, no es criterio).
- **P-2.** Tamaño del saludo con el menú en `main` y en la rama (simulador), para confirmar H-5 (crecimiento esperado del 10 % al 15 %, y Molotes ≤ 1600).

### Pruebas de regresión

- **R-1.** `npm run typecheck`, `npm run lint` (sin `lint:fix`) y `npm test` completo con MySQL (`npm run db:up`). La única "falla" admitida es el `it.fails` intencional de `tests/integration/local-server.test.ts`, que Vitest cuenta como prueba superada; cualquier otra falla rechaza.
- **R-2.** Revisión del diff de las 11 suites modificadas: solo cambian cadenas esperadas; ningún conteo, estado, `toHaveLength` ni aserción se debilita o elimina.
- **R-3.** Blast radius de CodeGraph: consumidores de `listItem` (6), `cartView` (4), `addedLineBlock` (3) y del orquestador (`reply()`); el aviso en texto libre de Twilio (`sendStaffNotice`) sigue usando `chunkText`.
- **R-4.** README: la sección "Mensajes largos" y "Formato de los textos" describen lo implementado (bloque, N = 28, sangría, R-2 de nombres con `*`, `_`, `~`) sin funcionalidades inexistentes.
- **R-5.** `git status`: sin cambios fuera del alcance (los archivos sin seguimiento `.claude/docs/pendientes.md` y `.claude/docs/reports/` se registran como ajenos al ticket).

### Pruebas doradas (CA-8 y CA-9)

- **G-1. Generadas antes del cambio.** Worktree temporal de `main` en el scratchpad (con `node_modules` enlazado). Se copian ahí, sin modificarlos, `tests/unit/whatsapp-bot-golden.test.ts`, `tests/support/bot-golden.ts` y `tests/fixtures/bot-golden/`, y se ejecuta la prueba: debe pasar contra el código de `main`. Si el soporte no compila en `main` (usa algo nuevo), es evidencia de que se tocó después y se registra.
- **G-2. Sin tocar después.** Los fixtures y la prueba dorada en la rama son idénticos (sha256) a los copiados en G-1, y pasan en la rama. Se revisa el contenido de `bot-golden.ts` para confirmar que registra todo lo que exige CA-8 y CA-9 (parámetros, cuerpo hidratado, `staffNoticeText`, nivel de compactación; paso, carrito, total, código, datos y número de respuestas) y que no normaliza ni filtra valores.
- **G-3. Byte a byte con `main`.** Script temporal que, en los dos árboles, serializa `templateTraces()` y una batería propia de pedidos (recoger, domicilio, en horario, fuera de horario, notas vacías y de 200, detalle, pedido de 15 líneas compactado) con `buildStaffTemplate`, `hydrateStaffTemplate` y `staffNoticeText`; las dos salidas se comparan con `cmp` y sha256.
- **G-4.** Pedido completo a domicilio en el simulador con Meta: el parámetro `entrega` sigue siendo "A domicilio: Calle 5 #10, Centro".
- **G-5.** `flowTraces()` en los dos árboles con `cmp`.

### Recorrido del simulador (`npm run bot:chat`)

Con Meta y con Twilio (`--proveedor twilio`), en la rama y, para comparar, en el worktree de `main`:

- **S-1.** Molotes `--ahora 2026-10-15T13:00`: saludo, menú, pedido en texto libre, opción por número, carrito, quitar, datos (W-3′), resumen a domicilio, confirmación.
- **S-2.** Birria `--ahora 2026-10-17T13:00`: lo mismo, con Consomé Chico y una bebida con detalle.
- **S-3.** Fuera de horario: Molotes `2026-10-15T07:00` (acepta pedidos: resumen con W-5) y lunes `2026-10-19T13:00` (descanso: `closedNoOrders`/`ordersClosed` según el negocio).
- **S-4.** Ayuda, palabras clave, horario y ubicación, otro negocio, persona, mensaje no entendido y cancelar.
- **S-5.** Mensajes de contacto directo que el simulador pueda provocar; los demás se cubren con F-6.

Cada texto se revisa a ojo contra el criterio del ticket (renglones estructurados ≤ 28, prosa en párrafos, RF-7, RF-8, sin emojis nuevos) y se copia en el QA Report lo relevante.

**Observación de la sesión principal (`*MENÚ*` bajo `📋 *Menú de Birriería El Muñeco*`).** Clasificación preliminar: **no es defecto**. RF-3 exige el encabezado de sección en negrita y mayúsculas "solo como presentación, sin cambiar el contenido", y la sección del catálogo de Birria se llama "Menú" (`src/content/birria/bot.ts`, `sections.platillo`); en `main` ya se mostraba `*Menú*` en el mismo lugar. Cambiar el nombre de la sección o suprimir el encabezado sería un cambio de contenido fuera del alcance. En Q2 se confirma con la salida del simulador en `main` y, si persiste, se registra como observación de contenido para que el usuario decida (p. ej., renombrar la sección en un ticket aparte), no como defecto de este ticket.

### Pruebas automatizadas (existentes y nuevas)

- Existentes: toda la suite; en especial `whatsapp-bot-format` (49 casos), `whatsapp-bot-golden` y las 11 suites actualizadas.
- Nueva (si el plan se aprueba): `restaurante/tests/unit/whatsapp-bot-qa-req-f-029.test.ts`, con los casos de N-4 y N-7 que no estén ya cubiertos y L-1 a L-3:
  - **L-1.** Menú de 50 productos con nombres de 80 en `splitMessage(…, 1600)`: cada parte ≤ 1600 y cada renglón con sangría en la misma parte que su nombre.
  - **L-2.** Carrito y resumen de 15 líneas con detalles de 60 a 1600: ninguna línea del pedido repartida.
  - **L-3.** Encabezado de sección justo en el límite: nunca queda solo al final de una parte.
- Los scripts de comparación con `main` (F-8, N-6, I-3, I-4, G-3, G-5) viven en el scratchpad, no en el repo. El worktree temporal se elimina al terminar (`git worktree remove`).
- No se agregan dependencias.

### Pruebas en navegador

No aplican: el ticket no toca las landing pages, ni HTML, CSS o JS de `public/` (lo confirma `git diff main --stat`). No se levanta el servidor ni se usa Claude in Chrome.

### Verificación manual en teléfonos (CA-11)

QA no tiene acceso a teléfonos: la hace el usuario. Opción recomendada: **después del despliegue, con el bot de producción**, porque es el texto real que verá el cliente y no depende de la ventana de 24 h. Alternativa antes del merge: la sesión principal envía al 523330254871 (con la ventana de 24 h abierta, escribiendo antes "hola" al bot) un único texto con la salida del simulador de la rama: menú de Birria, menú de Molotes, carrito con detalle y resumen a domicilio.

En **un Android y un iPhone**, con el tamaño de letra predeterminado, y en los dos negocios (Molotes de martes a viernes; Birria en sábado o domingo; o los dos menús en el mensaje de prueba de la alternativa), el usuario comprueba y responde sí o no a cada punto:

1. Menú: ningún renglón de precios se parte (p. ej., "pieza $45 · orden de 3 $130" queda en un renglón).
2. Menú: los precios se ven con sangría debajo del nombre; si no, quedan justo debajo, sin renglón en blanco entre nombre y precio.
3. Los números `1.`, `2.`… se ven en negrita y no como lista automática (sin sangría rara).
4. Birria: "Con Carne $80" y "Sin Carne $45" y las bebidas, cada una en su renglón.
5. Carrito y resumen: el detalle se ve en cursiva y "2 × $130 c/u = $260" con sangría; los renglones "- " no se ven desordenados.
6. Palabras clave (`*menú* · *carrito* · *cancelar*`) y "Si es todo, envíame:" (W-3′) sin renglones partidos.
7. Respuesta "1" o "2" a una lista sigue funcionando.
8. Captura de pantalla del menú de cada negocio en cada teléfono (opcional, como evidencia).

Si 1, 2, 4 o 6 fallan en algún teléfono, es `DEFECT` (severidad según el alcance). Si el usuario no tiene los dos sistemas, se registra qué quedó sin verificar. **Propuesta:** CA-11 es el único criterio que depende exclusivamente de esta verificación; si el usuario elige hacerla tras el despliegue, QA devolverá en Q2 `NEEDS_USER_DECISION` con la pregunta de si acepta aprobar con CA-11 como verificación posterior al merge, o `QA_APPROVED` si esa aceptación ya viene en la aprobación de este plan. Justificación: el cambio es solo de presentación, el paso 0 ya validó en un teléfono la sangría (A), las viñetas (F, G) y N = 28 (D-9), y el respaldo de RF-3 está implementado (`INDENT = ''`).

### Evidencia requerida

- Salida (resumen y código de salida) de `typecheck`, `lint` y `npm test`.
- Salida de la prueba dorada en el worktree de `main` y sha256 de fixtures, prueba y soporte.
- `cmp`/sha256 de las salidas de G-3, G-5, F-8, I-3 e I-4 en `main` y en la rama.
- Fragmentos del simulador en los dos negocios y proveedores, con longitudes del saludo con el menú.
- Resultado de la nueva suite QA.
- Respuesta del usuario a M-1 (CA-11), o su decisión de dejarla para después del merge.

### Criterios de aprobación

- CA-1 a CA-10 en PASS con evidencia; CA-11 en PASS o diferido por decisión explícita del usuario.
- Plantilla, cuerpo hidratado y `staffNoticeText` idénticos byte a byte a `main`; las doradas demostradamente generadas con `main` y sin modificar.
- Conteo de mensajes por turno idéntico a `main` con Meta y Twilio en los escenarios de REQ-F-013 CA-1 a CA-3.
- Sin defectos `BLOCKER` ni `CRITICAL`; los `MAJOR`, solo con aceptación explícita del usuario.
- `typecheck` y `lint` en 0; `npm test` completo en verde.

### Decisiones que se piden al usuario con este plan

1. ¿Aprueba el QA Action Plan, incluida la nueva suite `tests/unit/whatsapp-bot-qa-req-f-029.test.ts` y los scripts temporales con un worktree de `main` en el scratchpad?
2. CA-11: ¿lo hará en Android e iPhone **antes del merge** (con el mensaje de prueba de la sesión principal) o **después del despliegue** con el bot de producción, aceptando que QA apruebe con CA-11 como verificación posterior al merge?
3. ¿Está de acuerdo en clasificar `*MENÚ*` bajo el título del menú de Birria como observación de contenido (no defecto de este ticket)?

Aprobación del plan (2026-10-15): "No tengo un Iphone ahora, apruebo el plan". Las preguntas 2 y 3 siguen abiertas.

## QA Report

### Ronda

1 (2026-10-15).

### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Preparación | `git branch --show-current`, `git status`, `npm run db:up` | Rama `feature/REQ-F-029-formato-textos-bot-whatsapp`; solo los cambios del ticket (más `.claude/docs/pendientes.md` y `.claude/docs/reports/`, ajenos al ticket); MySQL `Healthy` |
| R-1 | `npm run typecheck` / `npm run lint` | Código de salida 0 / 0 |
| R-1 | `npm test` antes de la suite QA | 88 archivos, 1757 pasan, 1 fallo esperado (`it.fails` intencional de `local-server.test.ts`) |
| R-1 | `npm test` con la suite QA | 89 archivos, 1775 pasan, 3 fallos esperados (el de `local-server` y los `it.fails` de DEF-001 y DEF-002) |
| G-1 | Worktree de `main` (1428106) con copias de `whatsapp-bot-golden.test.ts`, `bot-golden.ts` y `fixtures/bot-golden/` | La prueba dorada **pasa contra el código de `main`** (2/2) |
| G-1 (sensibilidad) | En el worktree de `main`, `pickup` con un punto final | CA-8 falla: la dorada detecta un cambio de un solo carácter |
| G-2 | sha256 de las copias en `main` y en la rama | Idénticos: `flow.json` 7a7e2069…, `template.json` 21edd31d…, `bot-golden.ts` 6adcaa52…, prueba f81a47ba…. El soporte (modificado a las 05:44) no registra textos, no normaliza valores y pasa sin cambios en `main`: el cambio posterior no alteró lo que fija |
| G-3, G-5, I-3 | Volcado temporal (borrado) en `main` y en la rama: `templateTraces()`, otros 5 pedidos (notas y dirección de 200, detalle de 60, 15 líneas, fuera de horario a domicilio), `flowTraces()` y mensajes por turno con Meta y Twilio en 15 escenarios (REQ-F-013 CA-1 a CA-4, cerrado y los 8 recorridos dorados) | `cmp` sin diferencias: `template` (0abd16de…), `flow` (26489a5b…), `counts` (ec7e1322…) |
| F-8 | `botText` de `main` frente a la rama, normalizado (sin `*`, `_`, `~` ni saltos) | Solo cambian palabras en `keywordsHint` (W-1′), `help`, `menuPrompt` y `orderInvite` (W-2), `askData` (W-3′), `dataOrProducts` (W-4), `offHours` (W-5), `confirmPrompt` (W-6) y `summaryTitle` (formato aprobado en RF-5 y D-6). Otras 23 claves cambian solo de formato. Claves nuevas: `deliveryHome`, `summaryFields` y `total` (D-3). Ninguna eliminada |
| N-6 | Emojis de `src/content` y `src/services/whatsapp-bot` en `main` y en la rama | 31 y 31; ninguno nuevo ni quitado. Los 30 permitidos por la prueba de corpus están en `main`; el que no está en la lista (©) no lo usa el bot |
| S-1 a S-5 | `bot:chat` en la rama: Molotes 2026-10-15T13:00, Birria 2026-10-17T13:00, Molotes 07:00 (cerrado, acepta pedidos), lunes 2026-10-19 y viernes 18:00 (sin pedidos), con Meta y Twilio. Comparación con `main` en Birria | Revisión a ojo abajo. Entre Meta y Twilio solo cambian el código de pedido y el aviso al personal (plantilla o texto libre) |
| G-4 | Simulador, pedido a domicilio con Meta | `"entrega": "A domicilio: Calle 5 #10, Centro"` y `"A domicilio: Av. Juárez 120, Col. Americana"`; texto libre de Twilio sin cambios |
| R-2 | Diff de las 11 suites modificadas | 94 `expect` quitados y 94 agregados, uno por uno; ninguna prueba eliminada. Solo cambian las cadenas esperadas, nunca los conteos ni los estados |
| N-4, N-7, L-1 a L-3 | Nueva suite `tests/unit/whatsapp-bot-qa-req-f-029.test.ts` | 18 pasan y 2 `it.fails` (DEF-001 y DEF-002); `eslint` y `tsc` en 0 |
| Limpieza | `git worktree remove` y borrado del volcado temporal | Sin worktrees ni archivos temporales en el repo |

### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Menús del simulador: ningún renglón con nombre y precio; el renglón de precios más ancho, "pieza $48 · orden de 3 $140" (27); exactamente un renglón en blanco entre productos. Además, `whatsapp-bot-format` en verde |
| CA-2 | PASS | Birria: "Con Carne $80" / "Sin Carne $45" y "Aguas Frescas $35" / "Coca-Cola Vidrio $35", uno por renglón con la misma sangría |
| CA-3 | PASS | Corpus de `whatsapp-bot-format`, N-6 y revisión a ojo: sin dos renglones en blanco seguidos ni bordes en blanco, como mucho 2 emojis por renglón, ningún emoji nuevo. Los renglones estructurados sin datos variables miden 28 o menos (W-1′ "💬 En cualquier momento," 24; W-3′ "- 🏪 recoger o" 14) |
| CA-4 | PASS | Simulador: "Agregado" con `- 2 × …` y el detalle `_Coca-Cola Sin Azúcar_` en su renglón; carrito `*1.*` con `2 × $130 c/u = $260` con sangría; resumen `- …` con total en negrita separado y bloque de datos con etiquetas en negrita |
| CA-5 | PASS | `person` y `hoursAndLocation` en el simulador (contacto y URL solos en su renglón tras ":"); los 6 mensajes de contacto, en `whatsapp-bot-format` |
| CA-6 | PASS | Conteo por turno idéntico al de `main` en 15 escenarios × 2 proveedores (`cmp`). El saludo con el menú más largo con Twilio mide 1044 (Molotes; `main` 972), en 1 mensaje |
| CA-7 | PASS | `whatsapp-bot-format` (50 productos con nombres de 80, carrito de 15 líneas con detalles de 60, orquestador real con Twilio) y la propiedad de la suite QA: 500 textos generados, partes ≤ `max`, sin renglones perdidos y ningún bloque que cabe repartido. DEF-002 es un caso inalcanzable con 1600 y 4096 |
| CA-8 | PASS | G-1 a G-4: plantilla, cuerpo hidratado y `staffNoticeText` idénticos byte a byte a `main`; dorada generada con `main` y sin modificar |
| CA-9 | PASS | G-5 y `flowTraces` idénticos a `main`; prueba de copiar y pegar de `whatsapp-bot-format` en verde |
| CA-10 | PASS | F-8 y textos exactos en `whatsapp-bot-format`. W-1′, W-3′, W-4, W-5 y W-6 coinciden con la tabla. W-2 quita el punto final y el párrafo, como dice la tabla |
| CA-11 | BLOCKED (pendiente) | Verificación manual. El usuario no tiene iPhone por ahora ("No tengo un Iphone ahora"). Falta decidir si la de Android se hace antes del merge o después del despliegue |

### Defectos encontrados

### DEF-001
- Severidad: MAJOR
- Criterio de aceptación afectado: ningún CA lo detecta: CA-1 mira solo el menú y CA-3 excluye los renglones con datos variables. Incumple **RF-1** ("Un dato variable va solo en su renglón… sin otro dato ni precio detrás") en un mensaje del alcance ("opciones y variantes, cantidad y aclaraciones").
- Descripción: en la aclaración, cada opción lleva el nombre del producto y el precio en el mismo renglón, como antes del cambio (`clarifyText`, `conversation.ts:509`, no se tocó): `*2.* Bebidas Frías del Comal (Coca-Cola Vidrio) — $35` (51 de ancho visible) y `*2.* Tazón de Consomé Chico (Con Carne) — $80` (43).
- Pasos para reproducir: `npm run bot:chat -- --ahora 2026-10-17T13:00` → `Hola` → `consomé, una bebida y 2 tacos`.
- Resultado esperado: nombre y precio en renglones distintos (como el menú), o renglones que no superen 28.
- Resultado actual: `*1.* Tazón de Consomé Grande — $140` / `*2.* Tazón de Consomé Chico (Con Carne) — $80` / … / `*2.* Bebidas Frías del Comal (Coca-Cola Vidrio) — $35`.
- Evidencia: salida del simulador (QA Report, S-2); prueba `it.fails` "DEF-001… RF-1" en `tests/unit/whatsapp-bot-qa-req-f-029.test.ts`; misma salida en `main`.
- Impacto: en el celular (unos 29 caracteres por renglón) cada opción ocupa 2 renglones y el precio puede quedar suelto al principio del siguiente. Es el mismo problema que motivó el ticket (C-1), pero en un mensaje que aparece en pedidos ambiguos frecuentes de Birria ("consomé", "una bebida"). El flujo funciona: el cliente puede responder igual.
- Recomendación: aplicar a las opciones de la aclaración el mismo criterio de RF-1 que al menú. Cuando se corrija, el `it.fails` de la suite QA fallará y debe pasar a prueba normal.

### DEF-002
- Severidad: TRIVIAL
- Criterio de aceptación afectado: CA-7 / RF-12 (caso límite, inalcanzable con los límites reales).
- Descripción: en `splitMessage`, si un encabezado unido a su bloque supera `max` pero el bloque solo no, la unidad se parte por renglones con `chunkText`. El producto queda separado de su precio, o una parte termina en un salto.
- Pasos para reproducir: `splitMessage('*BEBIDAS*\n\n*1.* Agua\n    $35', 21)` → `["*BEBIDAS*\n\n*1.* Agua", "    $35"]`; con `max` 18 → `["*BEBIDAS*\n", "*1.* Agua\n    $35"]`.
- Resultado esperado: el encabezado en una parte y el bloque entero en la siguiente, sin saltos en los bordes.
- Resultado actual: lo descrito arriba.
- Evidencia: `it.fails` "DEF-002" en la suite QA.
- Impacto: ninguno observable hoy. Haría falta un bloque de casi 1600 caracteres, y un producto mide unos 200 como máximo (nombre ≤ 80).
- Recomendación: registrar; se puede corregir con DEF-001 o dejar documentado.

### Observaciones (no son defectos)

- **OBS-1. `*MENÚ*` bajo `📋 *Menú de Birriería El Muñeco*`.** En `main` ya salía `*Menú*` en el mismo lugar (verificado con el simulador en el worktree). La sección del catálogo de Birria se llama "Menú" (`src/content/birria/bot.ts`, `sections.platillo`) y RF-3 exige mostrarla en mayúsculas sin cambiar el contenido. Cambiarlo es una decisión de contenido para otro ticket. Pendiente de que el usuario confirme la clasificación.
- **OBS-2.** "No entendí tu mensaje. 🤔 Puedes escribir tu pedido con tus palabras, por ejemplo:" une el error y la ayuda en un renglón de prosa (`conversation.ts:348` y `:815`, sin cambios). La nueva pregunta ("¿Qué deseas hacer?") sí va en otro párrafo, y D-6 dejó `notUnderstood` sin cambios; cumple la letra de "Errores y ayudas". Mejora opcional.
- **OBS-3.** En el resumen, "A domicilio" y la dirección no forman un bloque con sangría: en un resumen que superara 1600 con Twilio, podrían quedar en partes distintas. RF-12 no lo exige (no es un producto ni una línea del pedido). En los escenarios medidos el resumen siempre llega en 1 mensaje.

### Regresión

- Suite completa en verde (89 archivos). `bot-protection-qa-req-f-025` y `whatsapp-twilio-qa-round1` pasan sin modificaciones.
- Flujo, plantilla, texto libre de Twilio y conteo de mensajes idénticos a `main` (`cmp`).
- `sendStaffNotice` sigue con `chunkText`; `reply()` y `menuMessages` usan `splitMessage` (blast radius de CodeGraph: `listItem` 6 consumidores, `cartView` 4, `addedLineBlock` 3, todos cubiertos por la suite).
- README: "Mensajes largos" y "Formato de los textos" describen lo implementado (bloque, `MAX_LINE_WIDTH`, `INDENT` de 4 espacios, números en negrita y la advertencia de R-2).
- Landing pages: sin cambios en `public/` ni en las vistas.

### Responsive

No aplica a las landings (sin cambios). En el chat, el equivalente es CA-11 (pendiente).

### Accesibilidad

No aplica: no hay cambios de HTML. En el chat: no se agregan emojis, las listas siguen respondiéndose con números y el estado de "FUERA DE HORARIO" va en texto, no solo con el emoji.

### UX/UI

- Sin diseño en `_stich_source_/` para el chat. Revisión a ojo del simulador en los dos negocios con el criterio del ticket:
  - menú, carrito, resumen, saludo, horario y ubicación, persona, cerrado y sin pedidos, ordenados y en párrafos;
  - excepción: DEF-001 (aclaración).
- Longitud del saludo con el menú (`main` → rama): Molotes 972 → 1044; Birria 685 → 705; Molotes cerrado 810 → 880.

### Performance

`Intl.Segmenter` se crea una vez por módulo (`text.ts`). La propiedad de 500 textos y los casos de 50 productos corren en milisegundos dentro de la suite. Los mensajes crecen entre un 2 % y un 9 % en los escenarios medidos, sin mensajes adicionales.

### SEO

No aplica.

### Pendientes de revisión manual

- **CA-11.** Android e iPhone con la letra predeterminada. No hay iPhone disponible por ahora. Falta decidir si la verificación en Android se hace antes del merge (mensaje de prueba de la sesión principal) o después del despliegue con el bot de producción. Se usa la lista de 8 puntos del QA Action Plan.

### Resultado final

NEEDS_USER_DECISION (emitido al terminar la ejecución de la ronda 1; ver la decisión del usuario abajo).

### Decisión del usuario sobre la ronda 1 (2026-10-15)

Cita textual: "Acepto las recomendaciones". Es decir:

1. **DEF-001 (MAJOR): se corrige en este ticket.** Las opciones de la aclaración (`clarifyText`) usan el formato del menú: nombre en un renglón y precio con sangría debajo, ≤ 28.
2. **DEF-002 (TRIVIAL): se corrige junto con DEF-001.**
3. **CA-11:**
   - la verificación en Android se hace después del despliegue, con el bot de producción;
   - el usuario acepta aprobar con CA-11 como verificación posterior al merge;
   - la parte de iPhone queda pendiente hasta que tenga uno.
4. **`*MENÚ*` de Birria:** es una observación de contenido (OBS-1), no un defecto de este ticket. Se podrá cambiar después renombrando la sección.

### Resultado final de la ronda 1 (tras la decisión)

**QA_REJECTED**, por DEF-001 (MAJOR que el usuario decidió corregir) y DEF-002.

### Qué debe corregir senior-fullstack

- **DEF-001.** En la aclaración, cada opción sigue el bloque del menú (RF-1 y RF-3):
  - renglón `*N.* Nombre (opción)`, con el nombre que hoy se muestra antes de " — ";
  - debajo, con `INDENT`, el precio, de 28 o menos de ancho visible;
  - sin "— $X" en el renglón del nombre.

  Hay que conservar:
  - el encabezado `*N) fragmento*` pegado a sus opciones (D-6);
  - la numeración y las respuestas "2, 1" o por nombre (C-8): el flujo dorado (CA-9) debe seguir idéntico;
  - el número de mensajes por turno (CA-6).

  Puntos de decisión que se dejan al implementador, sin imponer solución:
  - si se separan las opciones de un bloque con un renglón en blanco, como en el menú;
  - cómo se ve una opción sin etiqueta ni precio encontrado (hoy, el `slug`).

  Al corregirlo, el `it.fails` "DEF-001" de `restaurante/tests/unit/whatsapp-bot-qa-req-f-029.test.ts` empieza a fallar: hay que convertirlo en `it(...)` (lo permite este QA, que es el autor de esa suite) y actualizar las cadenas exactas de las suites que muestran la aclaración.
- **DEF-002.** En `splitMessage`, un bloque que cabe solo en `max` nunca se reparte entre partes, aunque su encabezado no quepa con él. Ninguna parte termina ni empieza con un salto o un renglón en blanco. Al corregirlo, el `it.fails` "DEF-002" debe pasar a `it(...)`. La equivalencia con `chunkText` (texto sin renglones en blanco ni sangría) se mantiene.
- Sin cambios en la plantilla, `staffNoticeText`, el intérprete ni las doradas (`tests/fixtures/bot-golden/`, `tests/support/bot-golden.ts`, `whatsapp-bot-golden.test.ts`), que no se deben tocar.

### Plan de la ronda 2 de QA (sin cambio de alcance; el plan aprobado sigue vigente)

- Revisar el diff respecto de la ronda 1 (solo `clarifyText` o su constructor de mensajes, `splitMessage` y las pruebas afectadas).
- Repetir:
  - `typecheck`, `lint` y `npm test` completo;
  - la dorada contra `main` en un worktree, con los mismos sha256;
  - la comparación con `cmp` de la plantilla, el flujo y el conteo por turno con Meta y Twilio.
- Simulador Birria 2026-10-17T13:00 (`consomé, una bebida y 2 tacos`) y Molotes con una aclaración, con Meta y Twilio. Se revisa a ojo que ningún renglón de opción supere 28 sin dato variable y que el precio vaya debajo.
- Las pruebas DEF-001 y DEF-002 deben ser `it(...)` en verde.
- CA-11: se registra como verificación posterior al merge en Android, aceptada por el usuario, con iPhone pendiente. No bloquea `QA_APPROVED`.

### Ronda 2 (2026-10-15)

Las correcciones de DEF-001 y DEF-002 las aprobó el usuario: "Si".

#### Qué cambió desde la ronda 1

- **`messages.ts`:**
  - `clarifyQuestion` recibe opciones `{ label, price }` (`ClarifyOption`);
  - las arma con `clarifyOptionBlock`: `listItem` y debajo, con `INDENT`, el precio, o nada si `price` es `null`.
- **`conversation.ts`:** `clarifyText` ya no escribe "— $X" en el renglón del nombre; una opción que no está en el catálogo muestra su `slug`, sin precio.
- **`text.ts`:**
  - `unitsOf` guarda en `members` las unidades originales de un encabezado unido a su bloque;
  - si juntos superan `max`, `splitMessage` las empaca por separado antes de recurrir a `chunkText`.
- **`whatsapp-bot-format.test.ts`:** una prueba nueva de texto exacto de la aclaración.
- **`whatsapp-bot-qa-req-f-029.test.ts`:**
  - DEF-001 y DEF-002 pasaron de `it.fails` a `it`.
  - QA reforzó la prueba de DEF-001, que en su forma de `it` podía pasar en vacío. Ahora exige las 5 opciones de la aclaración de Birria: cada nombre sin `$` y el precio en el renglón siguiente con sangría, de 28 o menos.
  - Se actualizaron los comentarios.

#### Pruebas ejecutadas

| Prueba | Comando o acción | Resultado |
| --- | --- | --- |
| Preparación | `git branch --show-current`, `git status`, `npm run db:up` | Rama correcta; solo archivos del ticket (más `.claude/docs/pendientes.md` y `.claude/docs/reports/`, ajenos); MySQL `Healthy` |
| Regresión | `npm run typecheck` / `npm run lint` | 0 / 0 |
| Regresión | `npm test` | 89 archivos; 1778 pasan y 1 fallo esperado (el `it.fails` de `local-server`). Total: 1779 = 1778 de la ronda 1 + 1 prueba nueva de la aclaración |
| `whatsapp-bot-format.test.ts` (reparación del duplicado) | Lista de `describe` e `it`, nombres repetidos, renglones largos repetidos e identificadores repetidos; `vitest run` del archivo | 9 `describe` sin repetir (los 8 de la ronda 1 más "aclaración"); ningún nombre de prueba repetido; ningún renglón de más de 50 caracteres repetido salvo `expect(part.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS)`, que ya aparecía dos veces en la ronda 1 (CA-7 y orquestador); sin `import` ni constantes duplicados. **50 pruebas**: las 49 de la ronda 1, con los mismos nombres, más la nueva de la aclaración. No se perdió ninguna |
| Suite QA | `vitest run tests/unit/whatsapp-bot-qa-req-f-029.test.ts` y `eslint` | 20 de 20 en verde, sin `it.fails`; lint 0 |
| CA-8 y CA-9 (dorada) | Worktree de `main` (1428106) con copias de la dorada, el soporte y los fixtures | 2/2 en `main`; sha256 iguales a los de la ronda 1 (7a7e2069…, 21edd31d…, 6adcaa52…, f81a47ba…) |
| G-3, G-5, I-3 | Volcado temporal en `main` y en la rama: plantilla (dorada y 5 pedidos extra), flujo y mensajes por turno en 15 escenarios con Meta y con Twilio | `cmp` sin diferencias; sha256 iguales a los de la ronda 1: `template` 0abd16de…, `flow` 26489a5b…, `counts` ec7e1322… |
| Aclaración en Birria | `bot:chat` el 2026-10-17 a las 13:00: `Hola` → `consomé, una bebida y 2 tacos` → `2, 1`, con Meta y con Twilio | Salida idéntica en los dos proveedores (`cmp`). Cada opción: `*N.* Nombre (opción)` y debajo, con sangría, el precio (`$140`, `$80`, `$45`, `$35`) |
| Aclaración en Molotes | `bot:chat` el 2026-10-15 a las 13:00 con Twilio: `2 de epazote` → `1` | `*1.* Molotes de Champiñones con Epazote (pieza)` / `    $45`, y lo mismo con Hongos Zetas ($48) y Huitlacoche ($50). La respuesta `1` agrega la línea correcta |
| DEF-002 | Prueba de la suite QA con `max` = largo del bloque y + 3 | El bloque queda entero en una parte y ninguna termina en salto |
| Limpieza | `git worktree remove`, borrado del volcado y de las salidas del simulador | Sin worktrees ni temporales; ningún `zz-*` en `tests/` |

Nota: la aclaración usa los separadores de lista de la decisión del implementador (opciones de un bloque seguidas, sin renglón en blanco), permitidos por la decisión del usuario. Los renglones de nombre largos ("Molotes de Champiñones con Epazote (pieza)") son datos variables solos en su renglón, como en el menú (RF-1).

#### Criterios de aceptación

| CA | Resultado | Evidencia |
| --- | --- | --- |
| CA-1 | PASS | Ronda 1 sin cambios en el menú; `whatsapp-bot-format` en verde |
| CA-2 | PASS | Ídem |
| CA-3 | PASS | Corpus de `whatsapp-bot-format` en verde (incluye las respuestas de los recorridos dorados, con la aclaración nueva) |
| CA-4 | PASS | Ídem ronda 1; suites en verde |
| CA-5 | PASS | Ídem ronda 1 |
| CA-6 | PASS | Conteo por turno idéntico a `main` (`cmp`) con Meta y Twilio |
| CA-7 | PASS | `whatsapp-bot-format` y la propiedad de 500 textos; DEF-002 corregido |
| CA-8 | PASS | Dorada contra `main` y `cmp` de la plantilla y de `staffNoticeText` |
| CA-9 | PASS | `cmp` de `flowTraces` y aclaraciones del simulador respondidas igual |
| CA-10 | PASS | Sin cambios de redacción desde la ronda 1; textos exactos en verde |
| CA-11 | Diferido por decisión del usuario | Android tras el despliegue, con el bot de producción, como verificación posterior al merge (aceptado: "Acepto las recomendaciones"); iPhone pendiente hasta que el usuario tenga uno. Lista de 8 puntos en el QA Action Plan |

#### Defectos

- DEF-001: **corregido** y verificado (simulador en los dos negocios y prueba `it` reforzada).
- DEF-002: **corregido** y verificado (prueba `it`).
- Ninguno abierto. Las observaciones OBS-1 (`*MENÚ*`, de contenido, decidida por el usuario), OBS-2 y OBS-3 siguen como en la ronda 1, sin acción en este ticket.

#### Regresión, responsive, accesibilidad, UX/UI, performance y SEO

- **Regresión:** suite completa, typecheck y lint en verde. El flujo, la plantilla y los conteos son iguales a `main`. El blast radius de la corrección se limita a `clarifyQuestion` (2 consumidores en `conversation.ts`) y a `splitMessage` (`reply()` y `menuMessages`), todos cubiertos.
- **Responsive / CA-11:** verificación posterior al merge, aceptada.
- **Accesibilidad, performance y SEO:** sin cambios respecto de la ronda 1.
- **UX/UI:** la aclaración queda alineada con el menú en los dos negocios.

#### Pendientes de revisión manual

CA-11: Android tras el despliegue (el usuario responde a los 8 puntos del QA Action Plan) e iPhone cuando haya uno. Si algún punto falla, se abre un ticket de corrección.

#### Resultado final

QA_APPROVED

## Historial de cambios

### Versión 1

Descripción inicial (2026-10-15), a partir de la solicitud del usuario.

- Análisis: el Business Analyst devolvió `NEEDS_CLARIFICATION` con 6 preguntas y dos alternativas de formato del menú (A recomendada; B, agrupado por precio). Descartó la tabla en monoespaciado.
- Respuesta del usuario: "Acepto las recomendaciones". Quedaron: alternativa A, N = 32, un renglón en blanco entre productos, se conserva "Molotes de", `staffNotice` de Twilio fuera de alcance y redacciones W-1 a W-6 permitidas. X-1, X-2 y X-3 se resolvieron como se propuso.
- Aprobada por el usuario el 2026-10-15: "Aprobado".
- Revisión técnica (senior-fullstack, 2026-10-15): Technical Action Plan con las decisiones D-1 a D-7 y los hallazgos H-1 a H-7, con medición del catálogo de las semillas (saludo con el menú: Molotes 1044/1145 y Birria 703/804, bajo 1600). D-1 (sangría) requiere la prueba en teléfonos del paso 0 antes de programar. Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.
- Technical Action Plan aprobado por el usuario el 2026-10-15, incluidas las interpretaciones de D-6: "lo apruebo". Prueba del paso 0 autorizada; la sesión principal envió el mensaje de prueba (variantes A a H) desde producción al número del personal a las 11:30 UTC (HTTP 200). D-1 queda pendiente de su resultado.
- Inicio de la implementación (2026-10-15): rama `feature/REQ-F-029-formato-textos-bot-whatsapp` y ticket en `in-progress/`. Estado: `IN_PROGRESS`.
- Prueba del paso 0 (2026-10-15), en un solo teléfono del usuario: "A si, B si, C si, D no, E no, F si, G si, H se ve raro no enendí". D-1 = 4 espacios normales. La numeración (H) queda pendiente de la decisión del usuario.
- Decisiones del usuario (2026-10-15): "1 si, 2 se partia". D-8: números en negrita en todas las listas. D-9: N pendiente, porque 32 dígitos no caben en un renglón de su teléfono.
- Implementación parcial (2026-10-15): todo el alcance implementado con N = 32 provisional; typecheck, lint y 1756 pruebas en verde. T2 sigue abierta, pendiente de D-9.
- D-9 (2026-10-15): el usuario midió 29 dígitos en un renglón y eligió N = "28". RF-1, CA-1, CA-2 y CA-3 pasan de 32 a 28; W-1 y W-3 se reacomodan (W-1′ y W-3′).
- Implementación terminada (2026-10-15): typecheck y lint en 0, y 1757 pruebas en verde. Sin commit. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.
- Implementación aprobada por el usuario (2026-10-15): "Apruebo la implementación". QA Action Plan (senior-qa, fase Q1): pruebas doradas contra `main` en un worktree, comparación byte a byte de la plantilla, conteo exacto de mensajes con Meta y Twilio, casos límite de `visibleWidth` y `splitMessage`, simulador en los dos negocios y CA-11 manual del usuario. Estado: `NEEDS_QA_PLAN_APPROVAL`.
- QA Action Plan aprobado por el usuario (2026-10-15): "No tengo un Iphone ahora, apruebo el plan". QA ronda 1 (senior-qa, fase Q2): typecheck y lint en 0; `npm test` con 89 archivos y 1775 pruebas en verde (3 fallos esperados: el de `local-server`, DEF-001 y DEF-002). La dorada pasa contra `main`. La plantilla, el flujo y el conteo de mensajes son idénticos a `main` con Meta y Twilio. CA-1 a CA-10 en PASS; CA-11 pendiente (sin iPhone). Defectos: DEF-001 (MAJOR, aclaración con nombre y precio en un renglón) y DEF-002 (TRIVIAL). Estado: `NEEDS_USER_DECISION`.
- Decisión del usuario sobre la ronda 1 (2026-10-15): "Acepto las recomendaciones". DEF-001 y DEF-002 se corrigen en este ticket. CA-11 se verifica en Android después del despliegue (el usuario acepta aprobar con CA-11 como verificación posterior al merge; iPhone pendiente). `*MENÚ*` queda como observación de contenido (OBS-1). Estado: `QA_REJECTED`.
- T3 (2026-10-15): se corrigieron DEF-001 (aclaración en bloques, como el menú) y DEF-002 (partición con encabezado). typecheck y lint en 0, y 1778 pruebas en verde. Sin commit. Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.
- Correcciones aprobadas por el usuario (2026-10-15): "Si". QA ronda 2 (senior-qa): DEF-001 y DEF-002 corregidos y verificados (QA reforzó la prueba de DEF-001); `whatsapp-bot-format.test.ts` sin duplicados (50 pruebas: las 49 de la ronda 1 más 1). typecheck y lint en 0; `npm test` con 1778 pruebas en verde (1 fallo esperado de `local-server`). Dorada en `main` con los mismos sha256, y plantilla, flujo y conteos iguales a `main` (`cmp`) con Meta y Twilio. CA-1 a CA-10 en PASS; CA-11 diferido por decisión del usuario (Android tras el despliegue; iPhone pendiente). Estado: `QA_APPROVED`.
- T4 (2026-10-15): commit `14e2f5e` en `feature/REQ-F-029-formato-textos-bot-whatsapp`, ya al día con `origin/main`, y PR #60 (https://github.com/orvigas/negocio/pull/60). CI en verde: `calidad`, `docker`, `despliegue` y `auditoria` pasan; `publish` y `deploy` se omiten. Estado: `READY_FOR_MERGE`.
