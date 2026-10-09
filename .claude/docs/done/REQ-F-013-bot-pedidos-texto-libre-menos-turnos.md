# REQ-F-013 — Bot de WhatsApp: pedidos en texto libre con menos turnos

## Estado

DONE (2026-10-09; PR #35 mergeado en `main`, commit de merge `b0da83f`)

Pull Request: https://github.com/orvigas/negocio/pull/35. CI del PR: `calidad` y `docker` en verde en `194a778` y `668e70c`. CI del push a `main` de `b0da83f`: en verde.

## Aprobación

Aprobado por el usuario (versión 2, fecha 2026-10-08). Citas textuales:

- solicitud original: "Como senior business analyst quiero que mejores el flujo del bot para que consuma los menos mensajes posibles hasta llegar a ejecutar los pedidos, además quiero que sea capaz de entender lo que el cliente le pida sin tener que tipar numeros exactos de producto y despues una cantidad, quiero que sea más semanticamente fluido";
- respuesta a las preguntas del borrador v1: "todas las recomendadas";
- aprobación del borrador v2: "apruebo REQ-F-013 v2".

"todas las recomendadas" aprueba la opción recomendada de cada pregunta del v1: 1 A a 10 A, "sí" en la 11 y 12 A. La 13 no aplica, porque se eligió A en la 2. También cierra las contradicciones X-1 a X-9 según lo propuesto e incorpora como propuestas aprobadas los requisitos que faltaban en el v1.

Las nueve precisiones marcadas como **[precisión v2]** se le presentaron al usuario una por una antes de la aprobación, y forman parte de la versión aprobada.

Origen: amplía REQ-F-009 y REQ-F-012 (los dos en `done/`).

## Objetivo

Que el cliente cierre un pedido por WhatsApp con el mínimo de mensajes y escribiendo de forma natural, por ejemplo "2 molotes de papa y una coca".

- **Lo que se optimiza** son los turnos y el esfuerzo del cliente (la experiencia y la conversión), **no el costo**. Con Meta en producción, las respuestas del bot dentro de la ventana de 24 h no se cobran. `senior-fullstack` confirmará las tarifas vigentes.
- Los números de opción siguen funcionando como alternativa.
- No cambian las reglas de negocio, la privacidad ni el aviso al personal.

### Medición del flujo de REQ-F-009 (punto de partida)

Ejemplo 1: Molotes, en horario, para recoger, con 2 órdenes de Queso Oaxaca y 1 refresco.

- Hoy hacen falta **13 mensajes del cliente y 14 del bot** al cliente, más el aviso al personal.
- El aviso de privacidad y la pregunta del nombre son dos mensajes separados.

Ejemplo 2: Birria, a domicilio, con 3 quesabirrias y 1 consomé chico con carne.

- Hoy hacen falta 14 mensajes del cliente y 15 del bot.

## Decisiones confirmadas por el usuario (2026-10-08)

| Decisión | Pregunta y opción | Contenido |
|---|---|---|
| D-1 | 1 A | Se optimizan los turnos y el esfuerzo del cliente. Los números se mantienen como alternativa. |
| D-2 | 2 A | El intérprete es **determinista y propio**, sin IA ni servicios externos. El enfoque híbrido (C) queda para un ticket posterior. Criterio de diseño: el intérprete debe poder sustituirse sin rehacer la conversación. |
| D-3 | 3 A | En Molotes, si no se indica la presentación, se toma **pieza**. Una línea sin presentación hereda "orden" si la línea anterior **del mismo mensaje** lo indicó. |
| D-4 | 4 A | Lo que no es ambiguo se agrega de inmediato. Todas las ambigüedades de un mensaje se resuelven con **una sola pregunta**. |
| D-5 | 5 A | El nombre y la forma de entrega (con la dirección, si es a domicilio) se piden **en un solo mensaje**, junto con el aviso de privacidad. Después se pide solo lo que falte. |
| D-6 | 6 A | Las notas se ofrecen en el resumen y desaparece el paso de notas. |
| D-7 | 7 A | Inicio directo. Si el primer mensaje expresa intención de pedir, el bot muestra el menú en ese mismo turno. Si el mensaje ya trae productos, los agrega. |
| D-8 | 8 A | Cada línea puede llevar un **detalle** de hasta 60 caracteres (un sabor o una indicación). El detalle no cambia el precio y se ve en el resumen y en el aviso al personal. |
| D-9 | 9 A | Se agrega y se quita por nombre. "Cancelar" como mensaje completo sigue cancelando el pedido. Para cambiar una cantidad, se quita la línea y se vuelve a agregar. |
| D-10 | 10 A | Los sinónimos se definen por `slug` en el contenido de cada negocio. Además, cada producto se reconoce automáticamente por las palabras de su nombre. |
| D-11 | 11 | Metas de mensajes: con texto libre, como máximo 4 del cliente y 5 del bot; si el pedido llega en el primer mensaje, como máximo 3 del cliente; para el ejemplo 1 hecho solo con números, como máximo 10 del cliente. |
| D-12 | 12 A | Se toleran errores de ortografía: hasta 1 edición en palabras de 4 a 7 letras y hasta 2 en palabras de 8 o más. Si hay empate entre productos, el bot pregunta. |

## Relación con REQ-F-009 y REQ-F-012

REQ-F-009 y REQ-F-012 están en `done/` y no se modifican. Este ticket **sustituye** las siguientes partes de REQ-F-009:

- **D-9.** La interacción deja de ser solo con números o palabras clave. El texto libre pasa a ser el modo principal y los números quedan como alternativa (X-2).
- **"Fuera de alcance: Lenguaje natural libre o IA".** Se levanta solo la parte de lenguaje natural, con un intérprete determinista. **La IA sigue fuera de alcance** (X-1).
- **RF-4.1.** Cambian el saludo y el inicio de la conversación.
- **RF-4.3 y RF-4.4.** Cambia la forma de agregar productos y el orden en que se piden los datos y las notas.
- **RF-4.5.** Cambia la indicación de confirmación del resumen.
- **RF-4.9.** Cambia el texto de ayuda.
- **CA-12.** El rechazo pasa a ser por línea: una línea no válida no se agrega y las demás sí.
- **DT-12 y D-10.** Se amplían los sinónimos de "persona". Se mantiene la regla de que una palabra clave solo cuenta si es el mensaje completo.

Todo lo demás de REQ-F-009 y REQ-F-012 sigue vigente (RN-10).

### Contradicciones resueltas

- **X-1.** Se levanta la exclusión de lenguaje natural de REQ-F-009, sin IA.
- **X-2.** D-9 de REQ-F-009 queda sustituida.
- **X-3.** Las palabras clave solo cuentan como mensaje completo. "cancela la X" dentro de una frase quita la línea X (RF-7).
- **X-4.** Un mensaje que es solo un número conserva el significado que tiene hoy en cada paso (RF-4.4).
- **X-5.** El aviso de privacidad va en el mismo mensaje que pide los datos, y los datos solo se capturan después de mostrarlo (RF-5.1).
- **X-6.** No aplica, porque no hay transferencia a terceros.
- **X-7.** El objetivo es la experiencia del cliente, no el costo.
- **X-8.** Las notas van en el resumen (RF-6).
- **X-9.** En un pedido mixto se agrega lo del negocio de la conversación y se añade, en el mismo mensaje, la nota del otro negocio (RF-1.10).

## Alcance

- Interpretación de pedidos en texto libre.
- Desambiguación.
- Inicio directo.
- Datos del cliente agrupados.
- Notas en el resumen.
- Quitar productos por nombre.
- Detalle por línea.
- Sinónimos y vocabulario en el contenido de cada negocio.
- Compatibilidad con los números.
- Contadores de interpretación en el log, sin texto.
- Textos del bot.
- Pruebas: batería de frases y conteo de mensajes.
- README y `npm run bot:chat`.

## Fuera de alcance

- IA o LLM, incluido el enfoque híbrido (para un ticket posterior).
- Voz, imágenes y transcripción.
- Listas y botones interactivos de WhatsApp.
- Cambiar la cantidad de una línea con una sola frase.
- Recordar al cliente entre pedidos (RN-5 de REQ-F-009).
- Editar sinónimos o vocabulario desde `/admin`.
- Promociones.
- Otros idiomas.
- Cambios en las landings, en el catálogo, en `/admin` o en los proveedores.

## Requisitos

### RF-1. Interpretación de pedidos en texto libre

1. **Dónde se interpreta.** Un mensaje se interpreta como pedido en el saludo, en el menú y en el carrito. En el resumen, solo cuando empieza con un verbo de edición (RF-7.3).
2. **Cómo se separan las líneas.** Con "y", comas, "+" o saltos de línea.
3. **Qué se reconoce en cada línea.**
   - **Producto.** Se reconoce por su nombre completo o parcial, o por un sinónimo configurado (D-10). No se distinguen mayúsculas ni acentos, se aceptan singular, plural y variantes de género ("chico" corresponde a "Chica"), y se aplica la tolerancia de D-12.
   - **Cantidad.** En número o en palabra: de "un", "una" o "uno" hasta "veinte"; "un par" = 2; "media docena" = 6; "docena" = 12. Si no se indica, es 1.
   - **Presentación o variante,** si se menciona: "pieza", "orden" u "órdenes", "chico", "grande", "con carne", "sin carne", etc. Si no se menciona, se aplican D-3 y RF-3.
   - **Detalle** (D-8 y RF-8).
4. **Relleno.** Se ignoran palabras de relleno como "hola", "quiero", "me das", "por favor" o "porfa". La lista es configurable en el contenido.
5. **Números dentro del texto.** Un número seguido de un producto es una **cantidad**. El "de N" que sigue a "orden" es la **presentación**, no una cantidad. Por ejemplo, "una orden de 3 de queso" es 1 orden de Queso Oaxaca.
6. **Líneas repetidas.** Si dos líneas tienen el mismo producto, la misma presentación y el mismo detalle, se **suman**, sin pasar de 20. **[precisión v2]** Si el detalle es distinto, son líneas distintas.
7. **Máximo de líneas.** Se interpretan como máximo 15 líneas por mensaje, y el pedido completo respeta el tope de 15 líneas (D-12 de REQ-F-009). El bot avisa de lo que no agregó.
8. **Fragmentos no entendidos.** Lo que el bot no entiende nunca se descarta en silencio: el bot le dice al cliente qué fragmentos no entendió.
9. **Productos no disponibles.** Si el cliente nombra un producto del negocio que hoy no está disponible, el bot no lo agrega y le dice que no está disponible. **[precisión v2]** Un producto eliminado del catálogo se trata como texto no reconocido.
10. **Productos del otro negocio (X-9).** Se agrega lo que sí es del negocio de la conversación y se añade, **en el mismo mensaje**, la nota del otro negocio (RF-3.4 de REQ-F-009).

### RF-2. Respuesta tras agregar productos

El bot responde en **un solo mensaje** con:

- lo que agregó, con la presentación y el detalle;
- lo que no agregó y por qué: no entendido, no disponible, del otro negocio o fuera de límites;
- el carrito con el total;
- el siguiente paso: "Si es todo, envíame tu nombre y si es para *recoger* o *a domicilio* (con tu dirección)";
- el aviso de privacidad (RF-5);
- la indicación de que puede escribir más productos o "quita <producto>".

### RF-3. Desambiguación (D-4, D-12)

1. **Cuándo es ambigua una línea.**
   - Cuando coincide con varios productos, como "de epazote".
   - Cuando le falta una variante obligatoria, como "consomé", "birriamen" o "bebida" en Birria.
   - Cuando hay un empate por la tolerancia de ortografía.
2. **Cómo se pregunta.** Las líneas que no son ambiguas se agregan de inmediato. Todas las ambiguas del mensaje se preguntan **en un solo mensaje**, con un bloque por línea y opciones numeradas.
3. **[precisión v2] Cómo se responde.**
   - El cliente responde en un solo mensaje, en el orden de los bloques, con números o con nombres. Por ejemplo, "2, 1" o "chico con carne y grande".
   - Si resuelve solo una parte, se agrega lo resuelto y el bot vuelve a preguntar solo por lo que falta.
   - Si en vez de contestar el cliente escribe otro pedido, las líneas pendientes se descartan con un aviso y el nuevo mensaje se procesa como pedido.
4. **Costo de cada ambigüedad.** Cada línea ambigua añade como máximo **1 mensaje del cliente y 1 del bot**.

### RF-4. Inicio directo (D-7) y números como alternativa (D-1)

1. **Saludo.** Conserva las 4 opciones numeradas e invita a escribir el pedido con un ejemplo: "Escríbeme tu pedido, por ejemplo: *2 molotes de queso y una coca*". El ejemplo de cada negocio está en su contenido.
2. **[precisión v2] Intención de pedir.** Si el primer mensaje expresa intención de pedir, el bot saluda, aplica D-16 (RF-9) y muestra el menú en ese mismo turno.
   - Las palabras de intención se configuran en el contenido: "pedido", "pedir", "ordenar" y "encargar".
   - Esto incluye el mensaje inicial de las landings ("Hola, quiero hacer un pedido de …").
3. **Primer mensaje con productos.** El bot saluda y agrega los productos (RF-1 y RF-2) en ese mismo turno. Si el mensaje trae un nombre o una dirección, **no** se capturan (X-5).
4. **Mensajes que son solo un número.** Conservan el significado que tienen hoy en cada paso (X-4):

   | Paso | Qué significa el número |
   |---|---|
   | Saludo | Opciones 1 a 4 |
   | Menú | Número de producto |
   | Opción | Presentación o variante |
   | Cantidad | Cantidad |
   | Carrito | Opciones 1 a 4 |
   | Quitar | Número de línea |
   | Entrega | 1 o 2 |
   | Resumen | 1 o 2 |

   El flujo numerado completo de REQ-F-009 sigue funcionando.

### RF-5. Datos del cliente agrupados (D-5, X-5)

1. **Aviso de privacidad.** El aviso de D-17 de REQ-F-009 va **en el mismo mensaje** que pide los datos, y deja de ser un mensaje aparte. Los datos personales solo se capturan después de que el bot haya mostrado ese aviso.
2. **Formatos aceptados.** Por ejemplo:
   - "Juan, recoger";
   - "Ana, domicilio, Calle 5 #10, Col. Centro, junto a la farmacia".
3. **Palabras de entrega.** Se configuran en el contenido:
   - para recoger: "recoger", "paso", "sucursal";
   - a domicilio: "domicilio", "envío", "a casa".
4. **Datos que faltan.** El bot pide **solo** lo que falte: la forma de entrega ("1. Recoger 2. A domicilio") o la dirección.
5. **Límites.** Siguen los de D-12 de REQ-F-009: nombre de 1 a 60 caracteres y dirección de 5 a 200.
6. **[precisión v2] Datos frente a productos.** Mientras el carrito admite tanto productos como datos, el bot decide así:

   | El mensaje contiene | Lo que hace el bot |
   |---|---|
   | Una palabra de entrega, sin productos reconocidos | Lo trata como datos |
   | Productos, sin palabra de entrega | Lo trata como productos |
   | Las dos cosas | Hace **una** pregunta para aclararlo |
   | Ninguna de las dos | Responde con la ayuda breve |

7. **Fin del pedido.** En el carrito, "listo", "es todo" o "terminar" repiten la petición de datos. El "4" sigue funcionando.

### RF-6. Resumen, notas y confirmación (D-6)

1. **Contenido del resumen.** Conserva el contenido de RF-4.5 de REQ-F-009 y añade el detalle de cada línea. Termina con: "Escribe *sí* para confirmar, o escribe una nota para agregarla. *cancelar* para cancelar".
2. **[precisión v2] Notas.** Un texto que no sea una palabra de confirmación, una palabra clave ni una edición (RF-7.3) se toma como **nota**:
   - reemplaza a la anterior y admite como máximo 200 caracteres;
   - el bot vuelve a mostrar el resumen;
   - "sin notas" borra la nota.
3. **Confirmar.** El pedido se confirma con "1", "si", "sí", "confirmar", "confirmo", "ok", "va", "dale", "listo" o "correcto", como mensaje completo y normalizado.
   - **[precisión aprobada, 2026-10-08]** El mensaje también confirma si, después de normalizarlo y quitar las palabras de relleno y de cortesía del vocabulario común (por ejemplo "por favor", "porfa", "gracias", "muchas gracias"), solo queda una palabra de confirmación: "sí por favor", "ok gracias", "si porfa" o "dale, gracias" confirman. "si, sin cebolla en los tacos" no confirma (es una nota o una edición), "no" sigue sin cancelar y "sí" a secas sigue confirmando. RN-3 (confirmación explícita) se mantiene. Cita del usuario: "Apruebo el plan de QA, sí a 2, 3 y 4, y corrige el sí por favor".
4. **Cancelar.** El pedido se cancela con "2" o "cancelar".
5. **[precisión v2] "No".** "no" ni cancela ni se guarda como nota: el bot repite la indicación del resumen.
6. **Sin cambios.** Se mantienen D-13 (revalidar antes de confirmar), CA-13 (dirección obligatoria a domicilio), RN-3 y RN-4 de REQ-F-009.

### RF-7. Quitar y editar (D-9, X-3)

1. **Quitar por nombre.** Un mensaje que **empieza** con "quita …", "quitar …", "elimina …" o "sin el/la/los/las <producto>" quita las líneas de ese producto.
   - **[precisión v2]** Se quita la línea completa, sea cual sea la cantidad indicada, y el bot dice qué quitó.
   - Si el producto tiene varias líneas (por presentación o por detalle), el bot pregunta cuál quitar, con opciones numeradas.
2. **Palabras clave.** Solo cuentan si son el mensaje completo (DT-12 de REQ-F-009). "cancela la coca" **no** cancela el pedido: se trata como quitar la coca.
3. **[precisión v2] Editar desde el resumen.** Un mensaje que empieza con "agrega", "añade", "también" o un verbo de quitar, seguido de un producto, edita el carrito y el bot vuelve a mostrar el resumen. Cualquier otro texto es una nota (RF-6.2).
4. **Carrito numerado.** Las opciones numeradas del carrito (agregar, quitar, vaciar y terminar) siguen funcionando.

### RF-8. Detalle por línea (D-8)

1. **Qué se toma como detalle.**
   - Las palabras que el cliente escribe junto al producto y que no son producto, cantidad, presentación, variante ni relleno. Por ejemplo, "sin cebolla" o "bien doraditos".
   - Los **detalles reconocidos** que se configuran por producto en el contenido. Además de quedar como detalle, sirven para identificar el producto. Por ejemplo, "jamaica" y "horchata" se reconocen como Aguas Frescas con el detalle "Jamaica" u "Horchata", y "sprite" o "coca sin azúcar" se reconocen como Refrescos con su detalle.
2. **Longitud.** El detalle admite como máximo 60 caracteres. **[precisión v2]** Si es más largo, se recorta, y el resumen muestra el detalle recortado.
3. **Dónde aparece.** El detalle no cambia el precio. Se ve:
   - en el carrito y en el resumen;
   - en el aviso al personal: en el parámetro `lineas` de la plantilla de Meta y en el texto libre de Twilio.

   **Nunca** va al log.
4. **"sin" como variante o como detalle.** En Birria, "consomé chico sin carne" es la variante "Sin Carne". En cualquier otro producto, "sin …" es un detalle.

### RF-9. Horario (sin cambios)

- D-16 se comprueba al empezar el pedido (PT-2 A de REQ-F-009): al expresar intención de pedir, al elegir "2" o al agregar el primer producto, ya sea por número o con texto libre.
- Si ese día no se aceptan pedidos, no se agrega nada y el bot responde con el mensaje de D-16.
- La marca "fuera de horario" no cambia.

### RF-10. Vocabulario configurable (D-10)

1. **Por negocio y por slug,** en `src/content/{molotes,birria}/bot.ts`:
   - los sinónimos de cada producto. Por ejemplo, para Queso Oaxaca "quesillo"; para Papas con Chorizo "papa"; para Birriamen "ramen"; para Refrescos "coca" y "refresco";
   - los sinónimos de variantes y presentaciones;
   - los detalles reconocidos.
2. **Comunes,** en `src/content/common/bot.ts`:
   - las palabras de cantidad, relleno, intención, entrega, confirmación y quitar;
   - los sinónimos de "persona": "hablar con alguien", "quiero hablar con alguien", "atención" y "operador", además de los actuales.
3. **Cambios en el catálogo.** Un producto nuevo o renombrado en `/admin` se reconoce por su nombre aunque no tenga sinónimos. Los sinónimos de un slug que ya no existe se ignoran sin error.

### RF-11. Logs (sin cambios, más contadores)

- Sigue vigente RF-9 de REQ-F-009: **nunca** se registran el texto del cliente, los detalles, el nombre, la dirección ni las notas.
- Se registra un evento por cada mensaje interpretado, solo con contadores: líneas reconocidas, ambiguas, no reconocidas y rechazadas por límites. El evento lleva el `conversationId` y el negocio. El nombre del evento lo decide `senior-fullstack`.

## Flujo objetivo

Ejemplo 1: Molotes, para recoger, con 2 órdenes de Queso Oaxaca y 1 refresco.

| # | Cliente | Bot (1 mensaje por turno) |
|---|---|---|
| 1 | "Hola, quiero hacer un pedido de molotes" (el mensaje de la landing) | Saludo, estado del horario y menú, con la invitación y el ejemplo |
| 2 | "2 órdenes de queso y una coca" | Productos agregados, carrito con el total, petición de datos y aviso de privacidad |
| 3 | "Juan, recoger" | Resumen, con la opción de confirmar o escribir una nota |
| 4 | "sí" | Confirmación, y aviso al personal |

**Resultado.** 4 mensajes del cliente y 4 del bot. Con Twilio pueden ser 5 del bot, si el saludo y el menú no caben en 1600 caracteres. Hoy son 13 y 14.

- Si el pedido viene en el primer mensaje: 3 y 3.
- Si es a domicilio: lo mismo, porque la dirección va en el mensaje 3.

**Solo con números**, el cliente envía 10 mensajes:

1. El mensaje de la landing.
2. "1": el producto.
3. "2": orden.
4. "2": la cantidad.
5. "1": agregar otro.
6. "10": refrescos.
7. "1": la cantidad.
8. "4": terminar.
9. "Juan, recoger".
10. "1": confirmar.

## Historias de usuario

- **HU-1.** **Como** cliente **quiero** escribir mi pedido como lo diría en voz alta **para** no buscar números de producto ni contestar una pregunta por cada cosa.
- **HU-2.** **Como** cliente **quiero** cerrar mi pedido en pocos mensajes **para** terminar rápido.
- **HU-3.** **Como** cliente **quiero** que el bot me pregunte solo lo que no entendió **para** no repetir todo.
- **HU-4.** **Como** cliente **quiero** indicar sabores o preferencias ("coca sin azúcar", "sin cebolla") **para** recibir lo que pedí.
- **HU-5.** **Como** personal **quiero** recibir cada línea con su detalle **para** prepararla bien.
- **HU-6.** **Como** cliente acostumbrado a los números **quiero** seguir usándolos.

## Reglas de negocio

- **RN-10.** Siguen vigentes, sin cambios:
  - RN-1 a RN-6 de REQ-F-009 y RN-7 a RN-9 de REQ-F-012;
  - D-4, D-11, D-12, D-13, D-14, D-15, D-16 (con PT-2 A), D-17 (su texto se integra en la petición de datos), D-18 y D-19 de REQ-F-009;
  - RF-7 de REQ-F-009 (aviso al personal, una sola vez) y RF-9 de REQ-F-009 (logs y privacidad);
  - la limitación por número de cliente y el descarte de mensajes viejos;
  - la conversación es la misma con Meta y con Twilio;
  - las landings no cambian.
- **RN-11.** El intérprete nunca confirma un pedido ni fija precios: los precios salen siempre del catálogo. Tampoco agrega nada sin mostrárselo al cliente.
- **RN-12.** Ningún texto del cliente sale del servidor, salvo en los mensajes al personal que ya existen.
- **RN-13.** Lo que el bot no entiende se le dice al cliente. Nunca se descarta en silencio.

## Criterios de aceptación

### Conteo de mensajes (D-11)

- **CA-1.** Given el ejemplo 1, o un pedido de Birria de hasta 2 productos sin ambigüedad, para recoger o a domicilio, When el cliente escribe en texto libre empezando por el mensaje de la landing, Then el pedido se confirma con **4 mensajes del cliente o menos** y **5 del bot al cliente o menos**, sin contar el aviso al personal.
- **CA-2.** Given que el primer mensaje trae el pedido completo, When el cliente sigue el flujo, Then el pedido se confirma con **3 mensajes del cliente o menos**.
- **CA-3.** Given el ejemplo 1 hecho solo con números (con los datos en un solo mensaje), When se confirma, Then se usan **10 mensajes del cliente o menos**, con el mismo carrito, el mismo total y el mismo aviso al personal que hoy.
- **CA-4.** Given un mensaje con 2 líneas ambiguas y 1 clara, When se procesa, Then se agrega la clara y el bot hace **una** sola pregunta. Given que el cliente responde a las dos, Then las dos quedan agregadas, con 1 mensaje del cliente y 1 del bot adicionales.

### Frases que deben entenderse (catálogo de `data/*/current.json`)

- **CA-5. Molotes.**

  | El cliente escribe | El bot entiende |
  |---|---|
  | "2 molotes de papa y una coca" | 2 Papas con Chorizo (pieza) y 1 Refrescos Familia Coca-Cola (detalle "Coca-Cola") |
  | "quiero una orden de queso" | 1 Queso Oaxaca (orden de 3) |
  | "una orden de 3 de queso" | 1 Queso Oaxaca (orden de 3) |
  | "3 ordenes de tinga y 2 de chorizo" | 3 Tinga de Pollo (orden) y 2 Papas con Chorizo (orden, por herencia) |
  | "dos de huitlacoche, una de champiñones" | 2 Huitlacoche y 1 Champiñones (pieza) |
  | "2 de chicharon" | 2 Chicharrón Prensado |
  | "un molote de quesillo" | 1 Queso Oaxaca |
  | "una agua de jamaica" | 1 Aguas Frescas (detalle "Jamaica") |
  | "dos cocas sin azucar" | 2 Refrescos (detalle de Coca-Cola sin azúcar) |
  | "MOLOTES DE HONGOS" | 1 Hongos Zetas |
  | "uno de epazote" | Una pregunta con Champiñones, Hongos Zetas y Huitlacoche |
  | "2 de queso bien doraditos" | 2 Queso Oaxaca (detalle "bien doraditos") |

- **CA-6. Birria.**

  | El cliente escribe | El bot entiende |
  |---|---|
  | "3 quesabirrias y un consome chico con carne" | 3 Quesabirria y 1 Consomé Chico (Con Carne) |
  | "2 tacos y una coca" | 2 Taco de Birria y 1 Bebidas (Coca-Cola Vidrio) |
  | "un birriamen chico" | 1 Birriamen (Chica) |
  | "un ramen grande" | 1 Birriamen (Grande) |
  | "una horchata" | 1 Bebidas (Aguas Frescas, detalle "Horchata") |
  | "consomé" | Una pregunta con Grande, Chico con carne y Chico sin carne |
  | "2 tacos sin cebolla" | 2 Taco de Birria (detalle "sin cebolla") |

### Comportamiento

- **CA-7.** Given el menú, When el cliente escribe "5", Then se agrega el producto 5, como hoy. Todo el flujo numerado de REQ-F-009 sigue funcionando: opciones, cantidades, carrito, quitar y vaciar.
- **CA-8. Rechazos.**
  - "quiero 25 tacos": la línea se rechaza con el mensaje de D-12 y no se agrega. En "25 tacos y una coca", la coca sí se agrega.
  - La línea 16 no se agrega, con aviso.
  - Un producto no disponible no se agrega, con aviso.
  - "2 tacos de birria" un martes: el bot responde con la nota del otro negocio y no agrega nada.
  - "2 tacos y un molote" en Birria: el bot agrega los tacos y da la nota del otro negocio en el mismo mensaje.
- **CA-9.** Given "jsjsj y 2 tacos", When se procesa, Then se agregan los tacos y el bot dice que no entendió "jsjsj".
- **CA-10.** Given "cancelar" como mensaje completo, When se procesa, Then se cancela el pedido sin enviar nada. Given "cancela la coca" o "quita la coca", Then se quita la línea de la coca y la conversación sigue.
- **CA-11.** Given una línea con un detalle de más de 60 caracteres, When se muestra, Then el detalle se ve recortado a 60. El detalle aparece en el resumen y en el aviso al personal, con Meta y con Twilio, y no cambia el precio.
- **CA-12. Datos del cliente.**
  - "Juan, recoger": el bot pasa al resumen.
  - "Ana, domicilio, Calle 5 #10 Col. Centro": resumen a domicilio con esa dirección.
  - "Ana, domicilio": el bot pide solo la dirección.
  - "Juan", cuando el bot espera productos o datos: el bot responde con la ayuda breve.
  - Un mensaje con productos y una palabra de entrega: el bot hace una pregunta para aclararlo.
- **CA-13. Resumen.**
  - "sí": confirma.
  - "sin picante, por favor": queda como nota y el bot vuelve a mostrar el resumen.
  - "agrega una coca": edita el carrito y el bot vuelve a mostrar el resumen.
  - "no": el bot repite la indicación, sin cancelar.
  - "2" o "cancelar": cancelan el pedido.
- **CA-14. D-16 y horario.**
  - Given un viernes a las 16:00, When llega el mensaje de la landing o "2 molotes de queso", Then el bot responde con el mensaje de D-16 y el carrito queda vacío.
  - Given un lunes a las 10:00, When llega un pedido, Then los productos se agregan y el resumen lleva la marca "fuera de horario".
- **CA-15. Privacidad.**
  - El aviso de D-17 va en el mismo mensaje que pide los datos.
  - Un nombre o una dirección escritos en el primer mensaje no aparecen en el resumen.
  - El log capturado en todos los flujos no contiene texto del cliente, detalles, nombres, direcciones ni notas, y sí contiene los contadores de RF-11.
  - Ninguna prueba ni ningún flujo hace peticiones externas para interpretar los mensajes.
- **CA-16.** Given un producto renombrado o nuevo en el catálogo, sin sinónimos, When el cliente escribe su nombre, Then el bot lo reconoce. Un sinónimo de un slug que no existe no provoca errores.
- **CA-17.** Las pruebas de REQ-F-009 y REQ-F-012 que no dependen de los pasos que cambian siguen pasando. Las que sí dependen se actualizan con una referencia a este ticket.
- **CA-18.**
  - `typecheck`, `lint`, `npm test`, `docker compose run --rm test` y el CI pasan.
  - `npm run bot:chat` permite recorrer el flujo nuevo con Meta y con Twilio.
  - El README documenta el vocabulario configurable y cómo añadir sinónimos.

## Casos límite

- **Números y cantidades.**
  - Un mensaje que es solo un número, en cada paso.
  - "orden de 3" frente a "3 órdenes".
  - Cantidades en palabra, 0, 21 y "media docena".
  - Un producto repetido en el mismo mensaje.
  - Más de 15 líneas.
- **Catálogo.**
  - Productos no disponibles o eliminados.
  - Productos del otro negocio y pedidos mixtos.
  - Ambigüedades del catálogo real: "epazote", "consomé" y "hongos".
  - Un cambio del catálogo antes de confirmar (D-13).
- **Lenguaje.**
  - Género y número de las palabras.
  - "sin" como variante y como detalle.
  - Mensajes que solo traen saludo o relleno.
  - Emojis, mayúsculas y acentos.
  - Mensajes muy largos.
- **Conversación.**
  - Una ambigüedad pendiente a la que el cliente responde con otro pedido.
  - Dos mensajes muy seguidos (la cola ya existe).
  - Audio o imagen (D-15, sin cambios).
- **Datos del cliente.**
  - Un nombre o una dirección con palabras de producto o con números ("Calle 5 #10").
  - Un mensaje con productos y datos a la vez.
  - Datos escritos antes del aviso de privacidad.
- **Horario y proveedor.**
  - D-16 y fuera de horario.
  - Medianoche (CA-6a y CA-6b de REQ-F-009, sin cambios).
  - El límite de 1600 caracteres de Twilio en el mensaje del saludo con el menú.

## Dependencias

- REQ-F-009 y REQ-F-012 (`done/`): este ticket modifica su conversación.
- REQ-F-008: el catálogo, los slugs y la disponibilidad.
- REQ-F-010: los horarios y D-16.
- No hay dependencias ni servicios externos nuevos.

## Riesgos

- **Malentendidos.** El bot puede entender algo distinto de lo que quiso decir el cliente. Se mitiga con RF-2, el resumen y RN-11.
- **Sinónimos desactualizados.** Pueden quedarse atrás cuando se agregan productos. Se mitiga con el reconocimiento por nombre.
- **Mejora del vocabulario.** Como no se registra el texto, no se puede mejorar el vocabulario con datos reales: solo hay contadores, y las mejoras dependen de lo que informe el personal.
- **Hábito del flujo anterior.** Puede confundir a los clientes acostumbrados a los números. Se mitiga con la compatibilidad numérica.
- **Twilio.** El saludo con el menú puede ocupar 2 mensajes. Sigue dentro de la meta.
- **Plantilla de Meta.** El texto libre que crece en el aviso al personal puede acercarse al límite de los parámetros de la plantilla de Meta. Ese límite no está verificado (CA-26 de REQ-F-009).

## Action Plan

### Objetivo

Que un pedido por WhatsApp se cierre en 4 turnos del cliente o menos, en texto natural, con las mismas garantías que hoy.

### Alcance

RF-1 a RF-11.

### Fuera de alcance

Ver la sección "Fuera de alcance".

### Cambios requeridos

1. Vocabulario en el contenido (RF-10): común y por slug.
2. Intérprete determinista y sustituible (RF-1, RF-3 y RF-8; D-2 y D-12).
3. Nueva secuencia de la conversación:
   - inicio directo (RF-4);
   - respuesta del carrito con la petición de datos (RF-2 y RF-5);
   - resumen con notas y ediciones (RF-6 y RF-7).
4. Detalle por línea en el carrito, el resumen y el aviso al personal, con los dos proveedores (RF-8).
5. Contadores en el log (RF-11).
6. Textos del bot, incluidos la ayuda y el ejemplo de cada negocio.
7. Pruebas:
   - batería de frases (CA-5 y CA-6);
   - conteo de mensajes (CA-1 a CA-4);
   - comportamiento y regresión (CA-7 a CA-17).
8. README y `bot:chat` (CA-18).

### Reglas de negocio

RN-10 a RN-13.

### UX/UI

Solo conversacional:

- un mensaje del bot por turno siempre que sea posible;
- ejemplos de frases en la invitación a pedir.

No aplica `_stich_source_/` y las landings no cambian.

### Integraciones

Ninguna nueva.

### Casos límite

Ver la sección "Casos límite".

### Criterios de aceptación

CA-1 a CA-18.

### Dependencias

Ver la sección "Dependencias".

### Riesgos

Ver la sección "Riesgos".

### Orden recomendado

1. Vocabulario.
2. Intérprete, con la batería de frases.
3. Secuencia de la conversación.
4. Detalle en el aviso al personal.
5. Logs.
6. Regresión y documentación.

### Resultado esperado

El cliente pide como habla, el bot solo pregunta lo necesario y el personal recibe el pedido con sus detalles.

## Trazabilidad

| Objetivo | Requisito | Historia | Criterios |
|---|---|---|---|
| Menos turnos | RF-2, RF-4, RF-5, RF-6; D-5 a D-7, D-11 | HU-2 | CA-1 a CA-4, CA-12, CA-13 |
| Texto libre | RF-1, RF-3, RF-10; D-2 a D-4, D-10, D-12 | HU-1, HU-3 | CA-5, CA-6, CA-9, CA-16 |
| Detalles | RF-8; D-8 | HU-4, HU-5 | CA-11 |
| Edición | RF-7; D-9 | HU-1 | CA-10, CA-13 |
| Compatibilidad | RF-4.4; D-1 | HU-6 | CA-3, CA-7, CA-17 |
| Reglas y privacidad | RF-9, RF-11; RN-10 a RN-13 | — | CA-8, CA-14, CA-15, CA-18 |

No hay diseño en `_stich_source_/`: el bot es solo conversacional.

## Revisión técnica

Revisión de `senior-fullstack` (2026-10-08) sobre el código actual de `restaurante/src/services/whatsapp-bot/` (`conversation.ts`, `messages.ts`, `orchestrator.ts`, `catalog.ts`, `text.ts`, `chat-bot.ts`, `providers/`), el contenido `src/content/{common,molotes,birria}/bot.ts`, el catálogo de `data/*/current.json` (idéntico a las semillas `src/content/*/seed.json` que usan las pruebas), las pruebas del bot y `scripts/bot-chat.ts`. No hay contradicciones que bloqueen: los puntos de abajo se resuelven en el Technical Action Plan. El hallazgo R-1 cambia una premisa del objetivo y conviene que el usuario lo conozca antes de aprobar.

### R-1. Tarifas vigentes (consultadas el 2026-10-08, con acceso a internet)

**Meta** (página oficial de precios y hoja de tarifas en USD vigente desde el 1 de octubre de 2026; mercado México, por mensaje **entregado**):

| Categoría | USD por mensaje |
|---|---|
| Marketing | 0.0397 |
| Utility | 0.0085 |
| Authentication | 0.0085 |
| Service (texto libre dentro de la ventana de 24 h) | 0.0085 |

- **Cambio desde el 1 de octubre de 2026: Meta vuelve a cobrar los mensajes de servicio.** Cada número de negocio tiene **1000 mensajes de servicio gratis al mes** (no se acumulan). A partir del 1001 se cobran. Sin método de pago, Meta **deja de entregar** los mensajes de servicio al agotar el cupo gratuito.
- Los mensajes del cliente al negocio no se cobran.
- Las plantillas utility enviadas con la ventana abierta: la página de Meta las incluye en "cobrar por mensajes que antes eran gratuitos", y en la lista de "cuándo Meta no cobra" solo quedan la ventana gratuita de anuncios (FEP) y el cupo de 1000 de servicio. La página de Twilio (septiembre de 2026) todavía dice que no pagan cuota de Meta. Hay una discrepancia entre las dos fuentes, que se confirma en la facturación real. Al personal casi nunca se le escribe con la ventana abierta, así que el aviso se paga como utility (0.0085 USD) en cualquier caso.

**Twilio** (página de precios de WhatsApp, "Pricing current as of September 2026"): 0.005 USD por mensaje, entrante **o** saliente, más las cuotas de Meta, que Twilio traslada tal cual. Los mensajes que terminan en `failed` pagan 0.001 USD. El sandbox se usa con la prueba gratuita.

**Consecuencias:**

- La premisa del objetivo ("con Meta en producción, las respuestas del bot dentro de la ventana de 24 h no se cobran") **ya no es cierta** desde el 1 de octubre de 2026. D-1 no cambia, porque optimizar los turnos también reduce el costo: un pedido pasa de unos 14 mensajes del bot a unos 4 (−70 %). Con un único número para los dos negocios, el cupo gratuito alcanza para unos 250 pedidos al mes. Después, cada pedido cuesta del orden de 0.035 USD en mensajes de servicio, más 0.0085 USD del aviso al personal.
- El README dice que la plantilla del aviso "es gratuita si la ventana está abierta". Se corrige dentro de este ticket (README, CA-18).
- Recordatorio operativo, fuera del código: la cuenta de Meta de producción necesita método de pago (ya estaba en los prerrequisitos de REQ-F-009).

### R-2. Límite de los parámetros de la plantilla de Meta

- **Documentado** (referencia de componentes de plantilla): el cuerpo (`BODY`) admite **como máximo 1024 caracteres**. Error de envío 132005: "el texto traducido es demasiado largo".
- **No documentado** en las páginas consultadas: el límite de cada parámetro por separado ni el del cuerpo ya rellenado ("hidratado"). Por precaución, el diseño garantiza que el **cuerpo hidratado** no supere 1024 caracteres. Se confirma en CA-26 de REQ-F-009 (sigue pendiente).
- **Riesgo real.** OBS-2 de REQ-F-009 midió un `lineas` de 1805 caracteres en el peor caso. Con el detalle (hasta 60 caracteres por línea) crece aún más. El resto de los parámetros está acotado por las validaciones: nombre ≤ 60, dirección ≤ 200, notas ≤ 200. El texto fijo de la plantilla del README mide unos 110 caracteres. En el peor caso quedan unos 300 caracteres para `lineas`.
- **Decisión técnica (DT-1, abajo):** `lineas` se compacta por niveles hasta caber en el presupuesto. Nunca se pierde una línea y el total sigue siendo exacto. Solo aplica a las plantillas (Meta y el Content Template de Twilio, que es la misma plantilla de WhatsApp). El texto libre de Twilio no tiene ese límite y se parte en trozos de 1600 (DT-9 de REQ-F-012).

### R-3. Saludo con el menú dentro de 1600 caracteres (Twilio)

Medido con el catálogo de las semillas (igual a `data/*/current.json`):

| Negocio | Saludo actual | Menú actual | Saludo + menú |
|---|---|---|---|
| Molotes | 345 | 715 | ~1062 |
| Birria (fuera de horario) | 456 | 398 | ~856 |

- Con la invitación y el ejemplo (unos 120 caracteres más), los dos caben en **un** mensaje de Twilio.
- El catálogo puede crecer hasta 50 productos activos con nombres de 80 caracteres, y entonces no cabría. No hace falta código nuevo: el saludo con el menú sale como **una sola respuesta** y `BotOrchestrator.reply` ya la parte con `chunkText(texto, chatBot.maxTextLength)`. Parte por líneas y nunca corta un producto (CA-6 de REQ-F-012). En ese caso son 2 mensajes del bot, dentro de la meta de CA-1 (≤ 5).
- Una prueba fija que, con el catálogo actual, el turno de intención produce exactamente 1 mensaje con Twilio.

### R-4. Intérprete sustituible (D-2)

Hoy no hay intérprete: `conversation.ts` solo lee números (`parseNumber`) y las palabras clave de `KEYWORDS`. El plan crea una interfaz `OrderInterpreter`, separada de la máquina de estados:

- se inyecta por `TurnContext` (y por `createBotOrchestrator`, con la implementación determinista por defecto);
- la conversación solo consume resultados estructurados (slugs, claves de opción, cantidades y detalles), nunca texto interpretado por su cuenta.

Un intérprete híbrido futuro solo tendría que implementar la misma interfaz. Una prueba lo demuestra con un intérprete falso.

### R-5. Hallazgos del código y del catálogo que el diseño debe cubrir

1. **"birria" y "molotes" no pueden identificar productos.** Todos los platillos de Molotes empiezan con "Molotes de…". "Taco de Birria" contiene "birria". El mensaje de las landings es "Hola, quiero hacer un pedido de birria" (`.env.example`). Si "birria" contara como nombre, ese mensaje agregaría un taco. Cada negocio declara sus **palabras genéricas** (`molote`; `birria`, `birrieria`), que no puntúan para elegir un producto.
2. **Conflicto de numeración en el primer turno.** El saludo actual trae las opciones 1 a 4. Si en el mismo mensaje sale el menú (1 a 10), el "1" sería ambiguo. Cuando el saludo incluye el menú (intención de pedir o "menú"), no lleva las opciones 1 a 4. Así un número significa "producto", como en el paso Menú (X-4).
3. **"pedido" es palabra clave del carrito** (`KEYWORDS.cart`) **y palabra de intención** (RF-4.2). En el primer mensaje gana la intención (el carrito está vacío). Después, "pedido" como mensaje completo sigue mostrando el carrito.
4. **Palabras de entrega dentro de una línea de producto.** "2 tacos para recoger" en el primer mensaje no puede convertir "para recoger" en detalle. Las palabras de entrega, intención y relleno nunca forman parte de un detalle ni de un fragmento "no entendido". Antes del aviso de privacidad, tampoco se capturan como datos (X-5).
5. **Nombres o direcciones que se parecen a productos** (RF-5.6). "Tina, recoger" se parece a "tinga" con 1 edición. Para decidir entre datos y productos, solo cuentan los productos reconocidos **sin** la tolerancia de ortografía. La tolerancia sigue aplicando al interpretar un pedido.
6. **Productos no disponibles** (RF-1.9). `buildCatalog` hoy descarta los no disponibles, así que el intérprete no los distinguiría de un texto desconocido. El catálogo del bot expone aparte los productos y variantes **no disponibles** (los eliminados no están en la caché publicada, así que siguen como texto no reconocido).
7. **La conversación se duplica en memoria** con `structuredClone` en cada turno. Los estados nuevos (líneas pendientes de aclarar, texto pendiente de RF-5.6) deben ser datos serializables, sin funciones ni clases.
8. **"0" en el resumen.** Hoy "0" significa "sin notas" en el paso de notas, que desaparece. En el resumen, "0" se trata como "sin notas" (no como una nota con el texto "0").

### R-6. Contradicciones o ambigüedades

No hay. Las precisiones de diseño que no cambian el alcance funcional se fijan en el plan, y se pueden revisar al aprobarlo:

- (a) Con "recoger", el texto que sigue a la palabra de entrega se guarda como nota y se ve en el resumen, en lugar de descartarse (RN-13).
- (b) "orden de N" con una N distinta de la del catálogo se pregunta (pieza u orden) en lugar de corregirse en silencio (RN-11).
- (c) Una aclaración con más de 9 opciones se trata como no entendida y se pide más detalle.
- (d) Las palabras de cantidad de "veintiuno" a "treinta" se reconocen para rechazarlas con el mensaje de D-12, en lugar de quedar como detalle.

## Technical Action Plan

### Objetivo técnico

- Agregar al bot un intérprete determinista y sustituible de pedidos en texto libre, con un vocabulario configurable por negocio.
- Rehacer la secuencia de la conversación para cumplir D-11:
  - inicio directo;
  - datos en un mensaje;
  - notas en el resumen;
  - aclaraciones en una sola pregunta.
- Mantener intactos el flujo numérico, las reglas de negocio, la privacidad, los proveedores y el aviso único al personal.

### Archivos o componentes afectados

| Archivo | Cambio |
|---|---|
| `src/content/common/bot.ts` | Textos nuevos o cambiados (saludo con invitación, respuesta del carrito, petición de datos con privacidad, aclaraciones, resumen, ayuda) y vocabulario común (`botVocabulary`). `KEYWORDS` pasa aquí desde `conversation.ts`, con los sinónimos nuevos de "persona". |
| `src/content/molotes/bot.ts`, `src/content/birria/bot.ts` | `vocabulary`: palabras genéricas, ejemplo de pedido, sinónimos, variantes y detalles reconocidos por slug. |
| `src/content/bot.ts` | Tipos del vocabulario y acceso por negocio. |
| `src/services/whatsapp-bot/interpreter/` (nuevo) | `types.ts` (interfaz y resultados), `tokens.ts` (tokens con posiciones, forma canónica), `fuzzy.ts` (distancia acotada), `vocabulary.ts` (índice a partir del catálogo y el contenido), `order.ts` (líneas de pedido y respuestas a aclaraciones), `customer-data.ts` (nombre, entrega y dirección), `deterministic.ts` (`createDeterministicInterpreter`). |
| `src/services/whatsapp-bot/catalog.ts` | `BotCatalog.unavailable`: productos y variantes no disponibles, solo para avisar. |
| `src/services/whatsapp-bot/conversation.ts` | Estados nuevos, `TurnContext.interpreter`, `TurnResult.interpretations` (contadores). Desaparece el paso `notes`. |
| `src/services/whatsapp-bot/messages.ts` | `CartLine.detail`, formato de la línea con detalle, mensajes nuevos y presupuesto de `lineas` (DT-1). |
| `src/services/whatsapp-bot/orchestrator.ts` | Opción `interpreter` y evento de log `bot_order_interpreted`. |
| `src/services/whatsapp-bot/text.ts` | Sin cambios de comportamiento (`chunkText` ya parte a 1600 y a 4096). |
| `scripts/bot-chat.ts` | Solo el texto de ayuda o los ejemplos si hace falta: el script ya habla con el orquestador real. |
| `restaurante/README.md` | Vocabulario configurable, cómo añadir sinónimos, flujo nuevo, plantilla (presupuesto y tarifas de R-1). |
| `tests/` | Ver "Testing". |

No cambian `chat-bot.ts`, `providers/`, las rutas, el webhook, las landings, `/admin`, el catálogo, Prisma, `.env.example` ni las dependencias.

### Contenido / configuración (RF-10)

**Vocabulario común** (`botVocabulary`, en `common/bot.ts`). Todas las entradas se escriben normalizadas: minúsculas y sin acentos. Una prueba lo verifica.

- `quantities`: de "un", "una" y "uno" hasta "veinte", más "veintiuno" a "treinta" (precisión R-6 d) y "cero". `quantityPhrases`: "un par" = 2, "media docena" = 6, "docena" = 12.
- `filler`: "hola", "buenas", "buenos dias", "quiero", "quisiera", "me das", "dame", "me regalas", "por favor", "porfa", "hacer", "ser", "para", "mas", etc.
- `connectors` (no puntúan ni forman parte de un detalle por sí solas): "de", "del", "la", "el", "los", "las", "con", "en", "a", "y".
- `intent`: "pedido", "pedir", "ordenar", "encargar".
- `delivery`: `{ pickup: ['recoger', 'paso', 'sucursal'], delivery: ['domicilio', 'envio', 'a casa'] }`.
- `confirm` (RF-6.3), `finish` ("listo", "es todo", "terminar"), `clearNotes` ("sin notas", "0").
- `remove` ("quita", "quitar", "elimina", "eliminar", "cancela", "sin el", "sin la", "sin los", "sin las") y `add` ("agrega", "agregar", "anade", "también").
- `presentations` (`{ pieza: [...], orden: [...] }`).
- `keywords`: los actuales de `KEYWORDS`, más los de "persona" de RF-10.2.

**Vocabulario por negocio** (`<negocio>/bot.ts`, clave `vocabulary`):

```ts
vocabulary: {
  example: '2 molotes de queso y una coca',          // RF-4.1
  genericWords: ['molote'],                           // R-5.1 (Birria: ['birria', 'birrieria'])
  products: {
    'queso-oaxaca': { synonyms: ['quesillo'] },
    'papas-con-chorizo': { synonyms: ['papa'] },
    'refrescos': {
      synonyms: ['refresco', 'coca'],
      details: [                                      // más largo primero
        { words: 'coca sin azucar', detail: 'Coca-Cola Sin Azúcar' },
        { words: 'coca', detail: 'Coca-Cola' },
        { words: 'sprite', detail: 'Sprite' },
        { words: 'sidral', detail: 'Sidral Mundet' },
      ],
    },
    'aguas-frescas': { synonyms: ['agua'], details: [{ words: 'jamaica', detail: 'Jamaica' }, { words: 'horchata', detail: 'Horchata' }, { words: 'limon', detail: 'Limón con chía' }] },
  },
}
// Birria: 'birriamen': { synonyms: ['ramen'] }, 'taco-de-birria': { synonyms: ['taco'] },
// 'bebidas': { variants: { 'Coca-Cola Vidrio': ['coca', 'refresco'], 'Aguas Frescas': ['agua'] },
//              details: [{ words: 'horchata', detail: 'Horchata', variant: 'Aguas Frescas' }, { words: 'jamaica', detail: 'Jamaica', variant: 'Aguas Frescas' }] }
```

- Un slug que no está en el catálogo vigente se ignora sin error (RF-10.3, CA-16).
- Un detalle con `variant` fija esa variante.
- El vocabulario es de solo lectura (`Object.freeze`) y se tipa con un tipo común a los dos negocios.

### Backend: diseño del intérprete (RF-1, RF-3, RF-8; D-2, D-3, D-12)

**Interfaz** (`interpreter/types.ts`):

```ts
export interface OrderInterpreter {
  /** Líneas de pedido de un mensaje (RF-1). Nunca lanza; nunca registra. */
  order(text: string, scope: InterpretScope): OrderInterpretation;
  /** Respuesta a una aclaración pendiente (RF-3.3), en el orden de los bloques. */
  answer(text: string, blocks: readonly ClarifyBlock[], scope: InterpretScope): AnswerInterpretation;
  /** Datos del cliente (RF-5): solo se llama después del aviso de privacidad. */
  customerData(text: string): CustomerDataInterpretation;
}
interface InterpretScope { business; catalog: BotCatalog; otherCatalog: BotCatalog; vocabulary; otherVocabulary }
```

**Resultados** (datos serializables):

- `OrderInterpretation = { lines: InterpretedLine[]; overflow: number; intent: boolean; hasExactProduct: boolean; hasDeliveryWord: boolean }`.
- `InterpretedLine` es uno de:
  - `item { slug, optionKey, quantity, detail }`;
  - `ambiguous { quantity, detail, reason: 'products' | 'variant' | 'typo', candidates: { slug, optionKey }[] }`;
  - `unavailable { fragment }`;
  - `otherBusiness { fragment }`;
  - `outOfRange { fragment }` (cantidad 0 o mayor que 20);
  - `unknown { fragment }`.
- `fragment` es el texto original del cliente. Solo se devuelve al cliente y **nunca** se registra.

**Algoritmo** (`order.ts`), determinista y sin expresiones regulares con retroceso costoso. La entrada ya está limitada a 1000 caracteres (`MAX_TEXT_LENGTH`).

1. **Segmentar** el texto original por saltos de línea, ",", ";", "+" y la palabra "y", salvo cuando la "y" forma parte de un nombre o sinónimo presente en el texto. Los segmentos sin tokens con significado (solo relleno, conectores, palabras genéricas, intención o un artículo) se ignoran. Solo se interpretan los primeros 15 segmentos con contenido. El resto cuenta en `overflow` (RF-1.7).
2. **Tokenizar** cada segmento con posiciones en el texto original. Forma comparable: `normalizeInput`. Forma canónica, aplicada igual al cliente y al vocabulario, para el número y el género:
   - quitar "es" tras l, n, r, d, z o j ("órdenes" → "orden", "champiñones" → "champinon");
   - si no, quitar la "s" final;
   - unificar la "a" o la "o" final ("chico" ≈ "chica").
   - Las palabras de 3 letras o menos no se transforman.
3. **Cantidad.** La expresión de cantidad (dígitos, palabra o frase) más cercana **antes** del producto. Si no hay, un número suelto al final del segmento. Si tampoco, 1.
   - "orden de N" y "N órdenes": la N de "orden de N" se consume como presentación (RF-1.5). Si N no es la cantidad de la orden del catálogo, la línea pasa a `ambiguous` (`variant`) (R-6 b).
   - Una cantidad de 0 o mayor que 20 da `outOfRange` (CA-8).
4. **Detalles reconocidos y frases de variante, primero y de la más larga a la más corta.** Por ejemplo "coca sin azucar", "con carne", "sin carne" o "coca-cola vidrio". Sus tokens se consumen.
5. **Candidatos de producto.** Puntúan, para cada producto del catálogo del negocio:
   - los tokens de su nombre (sin conectores ni palabras genéricas);
   - sus sinónimos;
   - las etiquetas de sus variantes;
   - los sinónimos de variante;
   - las palabras de sus detalles reconocidos.
   - Los tokens que siguen a "con" o "sin" solo puntúan si los anteriores no identifican ningún producto. Así "tinga con queso" es Tinga con el detalle "con queso", y "champiñones con epazote" es Champiñones.
   - Puntaje = (tokens coincidentes, tokens exactos). Se comparan en orden lexicográfico.
6. **Tolerancia (D-12).** Solo si un token no coincide exactamente con nada del vocabulario, incluidas las palabras comunes. Distancia de Damerau-Levenshtein restringida (OSA), calculada con un tope:
   - palabras del cliente de 4 a 7 letras: ≤ 1;
   - de 8 o más letras: ≤ 2;
   - de 3 o menos: 0.
   - Gana la menor distancia. Si un token queda a la misma distancia de términos de productos distintos, esos productos empatan (`reason: 'typo'`).
   - Las palabras de entrega, confirmación y palabras clave nunca se comparan con tolerancia.
7. **Elección.**
   - Un único producto con el mejor puntaje es el producto de la línea.
   - Si hay empate, la línea es `ambiguous` (`products`). "uno de epazote" da Champiñones, Hongos Zetas y Huitlacoche. "consomé" da Grande, Chico con carne y Chico sin carne.
   - Si no hay ningún candidato, se prueba lo mismo contra el catálogo y las palabras clave del **otro** negocio (`otherBusiness`), después contra los no disponibles (`unavailable`). Si nada coincide, la línea es `unknown`.
8. **Opción.**
   - Molotes: la presentación mencionada; si no, "orden" si una línea anterior **del mismo mensaje** la indicó (D-3); si no, "pieza".
   - Birria con variantes: una frase de variante, un sinónimo o un token distintivo de una etiqueta ("grande", "chica", "agua"). "con" y "sin" solos no bastan.
   - Producto de un solo precio: `unico`.
   - Sin variante resuelta, la línea es `ambiguous` (`variant`) y los candidatos son todas sus opciones.
   - En un empate de productos, los candidatos son pares (producto, opción): cada producto aporta su opción resuelta o todas sus opciones.
   - Con más de 9 candidatos, la línea es `unknown` (R-6 c).
9. **Detalle (RF-8).**
   - Se forma con los tokens sobrantes del segmento, en el texto original y en orden.
   - Se excluyen el relleno, la intención, las palabras de entrega, las palabras genéricas y los tokens del propio nombre del producto elegido.
   - Se quitan los conectores al principio y al final.
   - Se une con el detalle reconocido mediante ", ".
   - Se pasa por `cleanText` y se recorta a 60 puntos de código.
   - El detalle no cambia el precio.
10. **Unión de líneas repetidas (RF-1.6).** Mismo slug, misma opción y mismo detalle normalizado. Se suman sin pasar de 20. Esto lo hace la conversación, que también une con las líneas del carrito.

**Respuesta a una aclaración** (`answer`):

- Se parte por "," "y" o espacios entre números.
- Cada parte se asigna al bloque en el orden de los bloques: un número es el índice de la opción; un texto se puntúa solo contra las etiquetas de los candidatos del bloque, con el mismo método.
- Devuelve las elecciones resueltas, los bloques que siguen pendientes y si el mensaje "parece un pedido nuevo": no se resolvió ninguna parte y `order()` reconoce al menos un producto. En ese caso se aplica RF-3.3.

**Datos del cliente** (`customer-data.ts`):

- Se busca la **primera** palabra de entrega, solo por coincidencia exacta.
- Nombre: el texto original anterior, sin puntuación en los bordes ni prefijos de relleno como "soy" o "a nombre de".
- Dirección: el texto posterior, si es a domicilio.
- Si es para recoger, el texto posterior es la nota (R-6 a).
- Devuelve `{ name?, delivery?, address?, note? }`. La validación de longitudes (D-12 de REQ-F-009) se queda en la conversación.

### Backend: máquina de estados (`conversation.ts`)

`Step` = `root | browse | option | quantity | cart | remove | clarify | dataOrProducts | name | delivery | address | confirm | sending`. Desaparece `notes`.

Campos nuevos de `Conversation`, todos serializables y solo en memoria:

- `privacyShown: boolean`;
- `clarify: { blocks: ClarifyBlock[]; returnTo: 'cart' | 'confirm' } | null`;
- `removeChoices: number[] | null`;
- `pendingText: string | null`, el texto de RF-5.6 mientras se aclara. Se borra al resolverlo y nunca se registra.

Orden de evaluación de cada mensaje:

1. Palabra clave como mensaje completo. "cancelar" cancela.
2. Mensaje que es solo un número: el significado del paso, según la tabla de RF-4.4. El flujo numérico de REQ-F-009 no cambia.
3. Texto libre, según el paso:

| Paso | Texto libre |
|---|---|
| Primer mensaje | Saludo. Con intención: D-16 y, si se aceptan pedidos, el menú en **la misma respuesta** (sin las opciones 1 a 4, R-5.2). Con productos: D-16, se agregan y va la respuesta de RF-2 en la misma respuesta. Sin nada: saludo, opciones 1 a 4 e invitación con el ejemplo. |
| `root`, `browse` | `order()`. Con productos: D-16 y RF-2. Sin productos: ayuda breve, o la nota del otro negocio (RF-3.4). |
| `cart` | Empieza con un verbo de quitar: quitar por nombre (RF-7.1), con `remove` y `removeChoices` si hay varias líneas. `finish`: repite la petición de datos. Si no, la tabla de RF-5.6 con `hasExactProduct` y `hasDeliveryWord`: datos, productos, una pregunta (`dataOrProducts`, con "1. Agregar productos 2. Son mis datos") o ayuda breve. |
| `clarify` | `answer()`. Resuelto: se agrega y se vuelve a `returnTo`. Parcial: se agrega lo resuelto y se pregunta lo que falta. Pedido nuevo: aviso de descarte y se procesa como pedido. |
| `name`, `delivery`, `address` | Igual que hoy, pero se llega solo a lo que falte (RF-5.4). "Ana, domicilio" lleva a `address`. Al completarse, al resumen. |
| `confirm` | `confirm`: confirma, revalidando con D-13 y CA-13 como hoy. "2" o "cancelar": cancela. "no": repite la indicación. `clearNotes`: borra la nota. Empieza con un verbo de agregar o quitar seguido de un producto: edita y vuelve a mostrar el resumen (con `clarify.returnTo = 'confirm'` si hay ambigüedad). Cualquier otro texto: nota de hasta 200 caracteres, que reemplaza la anterior, y vuelve a mostrar el resumen. |

Otras reglas:

- Los datos solo se capturan con `privacyShown === true` (X-5). Antes, las palabras de entrega se ignoran (R-5.4).
- La respuesta de RF-2 es **un** texto con estas partes:
  - lo agregado, con la opción y el detalle;
  - lo no agregado, por motivo: no entendido (citando el fragmento), no disponible, del otro negocio con su nota, fuera de límites con el mensaje de D-12, o líneas de más;
  - el carrito con el total;
  - las opciones 1 a 4 (para el flujo numérico);
  - la petición de datos con el aviso de privacidad (marca `privacyShown`);
  - "escribe más productos o *quita <producto>*".
- Si en el mismo mensaje hay líneas ambiguas, la pregunta única de RF-3.2 se añade **al final del mismo texto** y el paso pasa a `clarify`. Cada ambigüedad cuesta 1 mensaje del cliente y 1 del bot (RF-3.4, CA-4).
- RN-11: el intérprete nunca fija precios. Las líneas se construyen con `findOption` sobre el catálogo vigente, y D-13 revalida antes de confirmar, conservando el detalle.

### Backend: detalle por línea y aviso al personal (RF-8)

- `CartLine` gana `readonly detail: string` (`''` si no hay).
- Formato de la línea: `2 × Refrescos Familia Coca-Cola · Coca-Cola Sin Azúcar — $35 c/u = $70`. Se aplica en el carrito, el resumen, `staffNoticeText` (Twilio, texto libre) y `lineas` (plantilla).
- **DT-1. Presupuesto de la plantilla.** El texto fijo de la plantilla pasa a una constante (`STAFF_TEMPLATE_BODY`, que una prueba compara con el README). `lineas` recibe `1024 − (texto fijo + resto de parámetros ya saneados)` caracteres y se compacta por niveles hasta caber:
  - L0: completo;
  - L1: sin el precio unitario;
  - L2: detalles recortados a 20 caracteres;
  - L3: cada línea recortada a su parte proporcional con "…", con el prefijo "(abreviado)".
  - Nunca se omite una línea, la cantidad ni el total.
  - Si hubo compactación, se registra `bot_staff_notice_compacted { business, level }`, sin texto.
  - El texto libre de Twilio nunca se compacta.

### Logs (RF-11)

Evento `bot_order_interpreted`, uno por cada llamada a `order()` o `answer()` con texto:

```json
{ "conversationId": "…", "business": "molotes", "source": "order|answer|edit",
  "recognized": 2, "ambiguous": 1, "unrecognized": 0, "rejected": 1, "unavailable": 0, "otherBusiness": 0 }
```

- `rejected` cuenta las cantidades fuera de rango y las líneas de más (`overflow`).
- La conversación lo devuelve en `TurnResult.interpretations` (sigue siendo pura) y lo registra el orquestador.
- Nunca incluye fragmentos, detalles, nombres, direcciones, notas ni el número sin enmascarar.

### Manejo de errores

- El intérprete nunca lanza con una entrada de texto. Una prueba de propiedades lo verifica con entradas aleatorias, emojis y 1000 caracteres.
- Un fallo inesperado sigue cayendo en `bot_processing_failed` (sin el mensaje), como hoy.
- Un vocabulario mal formado (por ejemplo, sin normalizar) lo detecta una prueba unitaria, no el arranque.

### Testing

1. **Batería de frases** (`tests/unit/whatsapp-bot-interpreter.test.ts`, guiada por tablas):
   - todas las filas de CA-5 y CA-6 contra el catálogo de las semillas (igual a `data/*/current.json`), comprobando el slug, la opción, la cantidad y el detalle exactos;
   - casos límite: cantidades en palabra, "un par", "media docena", 0, 21, "veinticinco", "orden de 3" frente a "3 órdenes", "orden de 5", herencia de "orden" solo dentro del mismo mensaje, líneas repetidas que se suman o se separan por el detalle, 16 líneas, género y número, mayúsculas, acentos y emojis;
   - tolerancia: 1 edición en 4 a 7 letras, 2 en 8 o más, 0 en 3 o menos, y empates por tolerancia;
   - "sin" como variante y como detalle; "con queso" como detalle;
   - producto no disponible, variante no disponible, producto eliminado y otro negocio ("2 tacos de birria" en Molotes, "un molote" en Birria);
   - mensajes que solo traen relleno, el mensaje de las landings de cada negocio (no agrega nada) y "jsjsj y 2 tacos" (CA-9);
   - CA-16: producto nuevo o renombrado mediante el repositorio en memoria, sin sinónimos; sinónimo de un slug inexistente.
2. **Datos del cliente** (unitarias): los formatos de CA-12, "Ana, domicilio", "Juan" solo, "Tina, recoger" y "Calle 5 #10".
3. **Conteo de mensajes** (`tests/integration/chat-bot-message-count.test.ts`, con los dos proveedores mediante los drivers de `chat-bot-contract`):
   - CA-1: ejemplo 1, y Birria con 2 productos para recoger y a domicilio. Se cuentan las llamadas `say` del cliente (≤ 4) y los textos que recibe el cliente en el doble (≤ 5), aparte del aviso al personal (exactamente 1).
   - CA-2: ≤ 3 mensajes del cliente.
   - CA-3: ejemplo 1 solo con números, ≤ 10 mensajes del cliente, con el mismo total ($295) y los mismos importes en el aviso.
   - CA-4: 2 líneas ambiguas y 1 clara, más 1 mensaje del cliente y 1 del bot.
   - Twilio: el turno de intención con el catálogo actual produce 1 mensaje de 1600 caracteres o menos.
4. **Comportamiento** (actualización de `whatsapp-bot-conversation.test.ts` y pruebas nuevas para CA-7 a CA-14):
   - el helper `checkout` pasa a enviar los datos en un mensaje;
   - las pruebas que dependen del nombre o las notas en pasos separados se actualizan con una referencia a "REQ-F-013" (CA-17).
5. **Detalle y plantilla** (CA-11):
   - un detalle de más de 60 caracteres se ve recortado en el resumen, en `staffTemplateParams.lineas` y en `staffNoticeText`, con el mismo precio;
   - DT-1: en el peor caso (15 líneas con nombres de 80 caracteres, detalles de 60, dirección y notas de 200), el cuerpo hidratado de `STAFF_TEMPLATE_BODY` mide 1024 caracteres o menos y conserva las 15 cantidades y el total;
   - el README contiene `STAFF_TEMPLATE_BODY`.
6. **Privacidad** (CA-15): ampliar las pruebas que revisan el log capturado. Tras recorrer todos los flujos, el log no contiene los textos enviados, los detalles, el nombre, la dirección ni las notas, y contiene `bot_order_interpreted` con los contadores. `tests/setup/no-meta.ts` sigue bloqueando cualquier `fetch` externo.
7. **Sustituibilidad** (D-2): un `OrderInterpreter` falso, inyectado en el orquestador, controla la conversación sin tocarla.
8. **`bot:chat`** (`tests/integration/bot-chat.test.ts`): el guion recorre el flujo nuevo con `--proveedor meta` y con `--proveedor twilio`.
9. **Regresión:** toda la suite, `typecheck`, `lint`, `docker compose run --rm test` y el CI (CA-18).

### Seguridad

- Sin servicios externos ni dependencias nuevas (CA-15, RN-12).
- El texto del cliente solo sale hacia el propio cliente (fragmentos no entendidos) y hacia el personal (detalles y notas, como hoy).
- Los parámetros de la plantilla se siguen saneando (132018).
- La entrada está acotada a 1000 caracteres.
- Algoritmos lineales o acotados: la distancia de edición se calcula con un tope, sobre a lo sumo unos 200 tokens frente a unos cientos de términos.
- No se usan expresiones regulares construidas con texto del cliente.

### Performance

- El índice del vocabulario se construye por turno a partir del catálogo en caché (50 productos como máximo). Su costo es despreciable frente al envío por HTTP.
- No se usa caché nueva ni hay acceso a la base de datos.

### Riesgos técnicos

- **Malentendidos del intérprete.** Se mitigan con el resumen (RN-11), la batería de frases y los contadores.
- **Frases sin separador** ("2 tacos 1 coca"). Pueden dar un empate y una pregunta. RF-1.2 no lo exige y queda como limitación documentada.
- **Límite de la plantilla sin confirmar** (CA-26 de REQ-F-009). DT-1 cubre el peor caso con 1024.
- **Costo de Meta** (R-1): ya no es gratuito pasado el cupo de 1000 al mes. El flujo nuevo reduce el número de mensajes.
- **Tamaño del cambio en las pruebas existentes** del flujo (CA-17).

### Orden de implementación

1. Vocabulario en el contenido y sus tipos.
2. `interpreter/` (tokens, tolerancia, vocabulario, pedido, datos) con la batería de frases.
3. `catalog.ts` (no disponibles).
4. `messages.ts` (detalle, mensajes y DT-1).
5. `conversation.ts` (estados), con sus pruebas.
6. `orchestrator.ts` (inyección y log).
7. Conteo de mensajes, privacidad, `bot:chat` y regresión.
8. README.
9. Validación completa.

### Criterios de finalización

- CA-1 a CA-17 cubiertos por pruebas automáticas que pasan con los dos proveedores.
- CA-18: `npm run typecheck`, `npm run lint` y `npm test` en 0; `docker compose run --rm test`, si Docker está disponible, y el CI del PR en verde.
- `git diff` sin cambios ajenos.
- README actualizado (vocabulario, sinónimos, flujo, presupuesto y tarifas de la plantilla).

## Implementation Result

### Rama

`feature/REQ-F-013-bot-pedidos-texto-libre-menos-turnos`, creada desde `main` actualizado (`a689dd0`). Sin commits: el commit y el PR se hacen en T4. El ticket no estaba versionado, así que se movió de `backlog/` a `in-progress/` con `mv` (no se podía con `git mv`).

### Cambios realizados

1. **Vocabulario** (RF-10):
   - `botVocabulary` (cantidades, relleno, conectores, intención, entrega, confirmar, terminar, borrar notas, quitar, agregar y presentaciones) y `botKeywords` (con los sinónimos nuevos de "persona"), en `src/content/common/bot.ts`;
   - `vocabulary` de cada negocio (`example`, `genericWords` y `products` por slug), en `src/content/{molotes,birria}/bot.ts`;
   - tipos `BusinessVocabulary` y `getBotVocabulary` en `src/content/bot.ts`. `tsc` comprueba que el contenido de los dos negocios cumple el contrato.
2. **Intérprete** (`src/services/whatsapp-bot/interpreter/`, D-2): `types.ts` (`OrderInterpreter`), `tokens.ts`, `fuzzy.ts` (Damerau-Levenshtein con tope), `vocabulary.ts` (índices), `order.ts` (pedido y respuesta a aclaraciones), `customer-data.ts` y `deterministic.ts`. Sigue el algoritmo del plan.
   - Añadí una regla acotada, sin cambiar el alcance: un segmento sin producto ni cantidad que empieza con "con" o "sin" continúa el detalle de la línea anterior. Sin ella, "2 tacos sin cebolla, con mucha salsa" partía el detalle por la coma.
3. **Catálogo** (`catalog.ts`): `BotCatalog.unavailable` (productos y variantes no disponibles, solo para avisar) y `CatalogOption.units` (piezas de la orden).
4. **Mensajes** (`messages.ts`):
   - `CartLine.detail`, y la línea con su detalle (`… · detalle`);
   - `greetingHeader` y `greeting` con la invitación y el ejemplo;
   - `menuText`, `dataRequest` y `clarifyQuestion`;
   - DT-1: `STAFF_TEMPLATE_BODY`, `buildStaffTemplate` con la compactación por niveles y `hydrateStaffTemplate`.
5. **Máquina de estados** (`conversation.ts`):
   - pasos nuevos: `clarify` y `dataOrProducts`; desaparece `notes`;
   - campos nuevos: `privacyShown`, `clarify`, `removeChoices` y `pendingText`;
   - inicio directo en un solo mensaje, la respuesta de RF-2 en un mensaje, los datos agrupados (RF-5.6), y el resumen con notas y ediciones (RF-6, RF-7);
   - `TurnContext.interpreter` y `TurnResult.interpretations`.
6. **Orquestador:** opción `interpreter` (determinista por defecto) y eventos `bot_order_interpreted` (solo contadores) y `bot_staff_notice_compacted`.
7. **`scripts/bot-chat.ts`:** el comentario de uso explica el texto libre.
8. **Precisión aprobada de RF-6.3 ("sí por favor"):** en el resumen, `withoutCourtesy` (`conversation.ts`) quita el relleno y la cortesía del vocabulario común (sin los verbos de agregar) y confirma si solo queda una palabra de confirmación. "no gracias" se trata como "no". Se agregaron "muchas gracias" y "mil gracias" al relleno ("gracias" ya estaba).
9. **README:** flujo nuevo, "Vocabulario del bot" (cómo añadir sinónimos), "Costos de Meta y Twilio" (corrige que la plantilla fuera gratuita y menciona el método de pago), presupuesto de la plantilla y el log del intérprete.
10. **Pruebas:**
   - nuevas: `tests/unit/whatsapp-bot-interpreter.test.ts` (batería de CA-5 y CA-6 y casos límite), `tests/unit/whatsapp-bot-free-text.test.ts` (CA-7 a CA-15, RF-3.3, RF-7.1, D-2, DT-1, R-3) y `tests/integration/chat-bot-message-count.test.ts` (CA-1 a CA-4, con Meta y con Twilio);
   - actualizadas, con referencia a REQ-F-013 (CA-17): conversación, orquestador, infra, Twilio, contrato, webhooks, QA de Twilio y `bot:chat`.

### Criterios de aceptación

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | Cumple | Ejemplo 1: **4 mensajes del cliente y 4 del bot**, con Meta y con Twilio (el saludo y el menú llegan en 1 mensaje de 1600 caracteres o menos). Birria con 2 productos, para recoger y a domicilio: 4 y 4. Un solo aviso al personal. |
| CA-2 | Cumple | El pedido en el primer mensaje: **3 del cliente y 3 del bot**. |
| CA-3 | Cumple | Solo con números: **10 del cliente**, total $295 y las mismas líneas en el aviso que en REQ-F-009. |
| CA-4 | Cumple | 2 líneas ambiguas y 1 clara: se agrega la clara y se hace 1 pregunta; "2, 1" agrega las dos. **+1 del cliente y +1 del bot** (5 y 5 en total). |
| CA-5 | Cumple | Las 12 frases de Molotes, con el producto, la opción, la cantidad y el detalle exactos. |
| CA-6 | Cumple | Las 7 frases de Birria. |
| CA-7 | Cumple | "5" en el menú; el flujo numérico completo (opciones, cantidades, quitar, vaciar); las pruebas numéricas de REQ-F-009 pasan. |
| CA-8 | Cumple | 25 tacos, 25 tacos y una coca, línea 16, producto no disponible, "2 tacos de birria" un martes y "2 tacos y un molote" en Birria. |
| CA-9 | Cumple | "jsjsj y 2 tacos". |
| CA-10 | Cumple | "cancelar", "cancela la coca", "quita la coca" y varias líneas del mismo producto. |
| CA-11 | Cumple | Detalle de más de 60 caracteres recortado en el resumen, en la plantilla de Meta y en el texto de Twilio, con el precio sin cambios. |
| CA-12 | Cumple | "Juan, recoger"; "Ana, domicilio, …"; "Ana, domicilio" (pide la dirección); "recoger" (pide el nombre); "Juan" (ayuda); productos con palabra de entrega (pregunta). |
| CA-13 | Cumple | "sí", nota, "agrega una coca", "no", "sin la coca", "sin notas", "2" y "cancelar". | Precisión aprobada: "sí por favor", "ok gracias", "si porfa", "dale, gracias", "Confirmo, muchas gracias 🙏" y "listo, gracias" confirman; "si, sin cebolla en los tacos", "sí, agrega una coca" y "si quiero picante" quedan como nota; "no" y "no gracias" repiten la indicación.
| CA-14 | Cumple | Viernes a las 16:00 (mensaje de la landing y "2 molotes de queso"): D-16 y el carrito vacío. Lunes a las 10:00: los productos se agregan, con la marca. |
| CA-15 | Cumple | El aviso de privacidad va con la petición de datos. El nombre del primer mensaje no se captura. El log no contiene textos, detalles, nombres, direcciones ni notas, y sí contiene `bot_order_interpreted`. Sin peticiones externas (`tests/setup/no-meta.ts`). |
| CA-16 | Cumple | Producto nuevo y producto renombrado sin sinónimos. Un sinónimo de un slug eliminado no da error. |
| CA-17 | Cumple | Las pruebas de REQ-F-009 y REQ-F-012 pasan. Las que dependían de los pasos de nombre y notas se actualizaron con la referencia. |
| CA-18 | Cumple en local | `typecheck`, `lint`, `npm test` y `docker compose run --rm test` en verde. `bot:chat` recorre el flujo nuevo con Meta y con Twilio. README actualizado. **Falta el CI del PR (T4).** |

### Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Código 0 |
| `npm run lint` | Código 0 (sin errores ni avisos) |
| `npm test` | Código 0: 65 archivos, 1208 pasan y 1 fallo esperado (`it.fails` preexistente de REQ-F-011). Tras la precisión de "sí por favor"; antes eran 1196. |
| `docker compose run --rm test` | Código 0: 65 archivos, 1191 pasan, 1 fallo esperado y 5 omitidas (`skipIf(runningAsRoot())` preexistentes) |
| `npm run build:css` | No aplica: no se tocaron estilos, plantillas HTML ni clases |
| `npm run bot:chat -- --ahora 2026-10-10T10:00` (manual) | Flujo de Birria con aclaración, domicilio, nota y confirmación; plantilla con el detalle |

### Archivos afectados

- `restaurante/src/content/common/bot.ts`, `restaurante/src/content/molotes/bot.ts`, `restaurante/src/content/birria/bot.ts`, `restaurante/src/content/bot.ts`
- `restaurante/src/services/whatsapp-bot/interpreter/` (nuevo: `types.ts`, `tokens.ts`, `fuzzy.ts`, `vocabulary.ts`, `order.ts`, `customer-data.ts`, `deterministic.ts`)
- `restaurante/src/services/whatsapp-bot/catalog.ts`, `restaurante/src/services/whatsapp-bot/conversation.ts`, `restaurante/src/services/whatsapp-bot/messages.ts`, `restaurante/src/services/whatsapp-bot/orchestrator.ts`
- `restaurante/scripts/bot-chat.ts`, `restaurante/README.md`
- Pruebas nuevas: `restaurante/tests/unit/whatsapp-bot-interpreter.test.ts`, `restaurante/tests/unit/whatsapp-bot-free-text.test.ts`, `restaurante/tests/integration/chat-bot-message-count.test.ts`
- Pruebas actualizadas: `tests/unit/whatsapp-bot-{conversation,orchestrator,infra,twilio}.test.ts`, `tests/integration/{bot-chat,chat-bot-contract,whatsapp-webhook,whatsapp-webhook-twilio,whatsapp-twilio-qa-round1}.test.ts`

Sin cambios en `.env`, `.env.example`, dependencias, proveedores, rutas, landings ni `/admin`.

### Riesgos o pendientes

- **CI del PR** (`calidad` y `docker`): se comprueba en T4.
- **CA-26 de REQ-F-009** sigue pendiente: la longitud real que acepta la plantilla de Meta (DT-1 aplica 1024 al cuerpo ya rellenado, por precaución).
- **Limitaciones conocidas del intérprete:**
  - frases sin separador ("2 tacos 1 coca") pueden dar un empate y una pregunta;
  - las palabras sueltas que siguen a una coma sin "con" o "sin" ("…, bien doraditos") se informan como no entendidas, en lugar de formar parte del detalle;
  - un nombre de producto con " y " solo se protege si está completo en el texto.
- **Documentación del agente.** `.claude/agents/senior-fullstack.md` no menciona `interpreter/` en la descripción del bot. Es configuración del agente y no la modifiqué; si se quiere, que lo actualice la sesión principal.
- **Costos** (R-1): la cuenta de Meta de producción necesita método de pago.

### Correcciones de la ronda 1 de QA (2026-10-09)

Decisión del usuario: "corrige todo, incluida la ayuda tras el nombre".

- **DEF-001.** Antes de interpretar un segmento como línea nueva, `refineVariant` (`interpreter/order.ts`) comprueba si solo nombra variantes de la línea anterior. "…, con carne", "…, sin carne" o "…, grande", sin cantidad ni presentación, completan esa línea (de ambigua a concreta, o con menos candidatos) y nunca crean otra línea ni una pregunta duplicada. Si la variante no es del producto anterior ("3 tacos, con carne"), queda como su detalle: la regla de "con" y "sin" ahora se aplica antes de interpretar el segmento, no solo con los no entendidos.
- **DEF-002.** Criterio aceptado por el usuario. Un segmento con varias cantidades sin separador se parte por ellas; no cuentan las que siguen a "de" ("coca de 600", "orden de 3") ni los multiplicadores.
  - Si cada parte es un producto, se agregan todos con sus cantidades ("2 tacos 1 coca", "dos de tinga 2 de queso").
  - Si una parte no se entiende ("2 tacos 1 cocacolota", "2 tacos 3"), no se agrega nada de ese segmento y el bot pide reescribirlo con comas, proponiendo el texto separado (línea `unclear`).
  - Nunca se pierde una parte, nunca cambia una cantidad y nunca queda un número sobrante como detalle.
- **DEF-003.** "x2", "2x" y "x 2" son cantidad. Una cantidad y un multiplicador a la vez ("3 tacos x2") no se adivinan: no se agrega esa línea y el bot pide una sola cantidad por producto.
- **DEF-004.** `clip` (`messages.ts`) recorta por puntos de código y nunca parte un emoji.
- **DEF-005.**
  - Un segmento con palabra de entrega y sin producto ya no se informa como "no entendido" (R-5.4).
  - Si el mensaje traía datos de entrega antes del aviso de privacidad, la respuesta añade "Tus datos de entrega te los pido al final…".
  - El primer mensaje sin productos pero con algo que avisar (otro negocio, no separable, etc.) también se responde en un solo mensaje.
- **OBS-1.** En el carrito, tras el aviso de privacidad (también después de "4"), el nombre solo recibe la ayuda breve con el recordatorio "Si es tu nombre, escribe también si es para *recoger* o *a domicilio*…, por ejemplo: *Ana, recoger*". CA-12 se mantiene.
- **README:** "x2", la separación sin comas y la continuación "…, con carne".
- **Pruebas.**
  - Los 8 casos `it.fails` de `tests/unit/whatsapp-bot-qa-req-f-013.test.ts` (7 pruebas, una con 3 casos) pasan a pruebas normales y pasan, sin cambiar sus aserciones.
  - La prueba "limitaciones aceptadas: "2 tacos 1 coca"…" cambió de forma, por el criterio aceptado de DEF-002: antes esperaba una pregunta sin agregar nada; ahora espera los dos productos con sus cantidades. Además añade el caso que no se puede separar (sin agregar nada y con la petición de comas). La garantía de fondo se mantiene y se refuerza: no agregar algo equivocado ni perder una parte.
  - Pruebas nuevas en `tests/unit/whatsapp-bot-interpreter.test.ts` (DEF-001 a DEF-003 y DEF-005) y en `tests/unit/whatsapp-bot-free-text.test.ts` (DEF-005 y OBS-1).
- **Validaciones:**
  - `npm run typecheck`: código 0.
  - `npm run lint`: código 0.
  - `npm test`: código 0; 67 archivos, 1312 pasan y 1 fallo esperado (REQ-F-011).
  - `docker compose run --rm test`: código 0; 1307 pasan, 1 fallo esperado y 5 omitidas (`skipIf(runningAsRoot())`, ya existentes).

### Correcciones de la ronda 2 de QA (2026-10-09)

Decisión del usuario: "corrige DEF-006, DEF-007 y OBS-2, acepta OBS-3".

- **DEF-006** (`interpreter/order.ts`, `analyze`). "N de M de <producto>" (en número o en palabra: "1 de 3", "una de 3", "dos de 3") son N órdenes de M: "de M" se toma como la presentación, como "orden de M" en RF-1.5.
  - Si M es la orden del catálogo, la línea es "orden" y la herencia de D-3 sigue aplicando: "1 de 3 de tinga, 2 de queso" da 2 órdenes de Queso.
  - Si M no coincide ("1 de 5 de tinga"), el bot pregunta (pieza u orden, R-6 b) y no agrega esa línea.
  - "2 de queso 1 de 3 de tinga", con o sin coma, da 2 piezas de Queso y 1 orden de Tinga.
  - Nunca queda un número como detalle.
- **DEF-007.** Una palabra del nombre del producto precedida de un número que no es la cantidad ("de 2 tortillas") ya no se consume como producto y queda en el detalle: "3 tacos de 2 tortillas" da "3 × Taco de Birria con Tortilla de Mano · 2 tortillas". "3 tacos con 2 tortillas" sigue siendo OBS-3, aceptada.
- **OBS-2.**
  - La línea `unclear` lleva `reason` ('unseparated' o 'quantity') en lugar de la frase partida.
  - El aviso de "escríbelo separado con comas" usa `separatedExample`, un ejemplo fijo del vocabulario de cada negocio ("*2 de queso, 1 coca*" en Molotes y "*2 tacos, 1 coca*" en Birria).
  - Se mantiene el criterio de DEF-002: de ese segmento no se agrega ni se pierde nada.
- **README:** `separatedExample` y "1 de 3 de tinga".
- **Pruebas.**
  - El `it.fails.each` de DEF-006 pasa a `it.each`. Conserva su aserción y añade una positiva (las líneas exactas agregadas), más una prueba nueva para "1 de 5 de tinga" (pregunta, nada agregado).
  - Las dos pruebas que esperaban el ejemplo partido se actualizaron:
    - la de limitaciones del archivo de QA ahora espera "*2 tacos, 1 coca*" y que no aparezca "*2 tacos, 1 cocacolota*";
    - la de DEF-002 del intérprete ahora comprueba la razón 'unseparated'.
  - Pruebas nuevas:
    - DEF-006: 8 casos en el intérprete;
    - DEF-007: en el intérprete y de punta a punta;
    - OBS-2: 5 frases de punta a punta, con el ejemplo fijo de cada negocio y el carrito vacío.
- **Validaciones:**
  - `npm run typecheck`: código 0.
  - `npm run lint`: código 0.
  - `npm test`: código 0; 67 archivos, 1344 pasan y 1 fallo esperado (REQ-F-011).
  - `docker compose run --rm test`: código 0; 1339 pasan, 1 fallo esperado y 5 omitidas (ya existentes).

### Correcciones de la ronda 3 de QA (2026-10-09)

Decisión del usuario: "corrige DEF-008 con A y B como recomiendas, DEF-009 y que 'una orden de tacos' pregunte; después de esta ronda, lo menor se acepta".

Los cambios están en `interpreter/order.ts`.

- **DEF-008 A.** En un producto sin orden en el catálogo, con la palabra "orden" u "órdenes" escrita y "de M", se agregan N×M unidades. "de M" no queda en el detalle.
  - "1 orden de 3 de tacos" agrega 3 tacos.
  - "2 órdenes de 3 tacos" agrega 6 tacos.
  - "1 orden de 3 de coca" agrega 3 Refrescos.
  - Si N×M pasa de 20 ("3 órdenes de 7 tacos"), se rechaza con el mensaje de D-12.
  - El análisis distingue ahora si la palabra "orden" está escrita (`presentationWord`) o si la orden viene de "N de M".
- **DEF-008 B.** Sin la palabra "orden", "N de M de <producto sin orden>" no se agrega y el bot pide la cantidad ("No entendí cuántos quieres en …"). Nunca se descarta "de M" sin avisar. Casos: "una de 3 de tacos", "2 de 3 de quesabirria", "1 de 3 de coca" y "1 de 2 de consome grande".
- **DEF-009.** "de N piezas" (o "de N órdenes") describe el producto y no es la cantidad ni la presentación: el detalle conserva "3 piezas". "2 tacos de 3 piezas" da 2 tacos con el detalle "3 piezas", y "2 de queso de 3 piezas" da 2 piezas de Queso con ese mismo detalle.
- **OBS-4.** "una orden de tacos", sin número y en un producto sin orden, pide la cantidad y no agrega esa línea. Las demás líneas del mensaje se agregan, también sin separador: "1 orden de tacos 2 quesabirrias" agrega las quesabirrias. Una línea que pide la cantidad ya no impide separar las demás.
- **README:** la regla de "órdenes" en productos sin orden.
- **Pruebas.**
  - Los `it.fails.each` de DEF-008 (3 casos) y DEF-009 (2 casos) pasan a `it.each` sin cambiar sus aserciones.
  - Refuerzos:
    - DEF-008 A con las líneas exactas: `3 × Taco de Birria con Tortilla de Mano`, `6 × …` y `3 × Refrescos Familia Coca-Cola · Coca-Cola`;
    - el rechazo de 21;
    - DEF-008 B con los 4 casos, sin agregar nada y con la pregunta;
    - DEF-009 con el detalle exacto "3 piezas".
  - Pruebas nuevas de OBS-4 (3 casos) en `tests/unit/whatsapp-bot-free-text.test.ts`.
- **Validaciones:**
  - `npm run typecheck`: código 0.
  - `npm run lint`: código 0.
  - `npm test`: código 0; 67 archivos, 1360 pasan y 1 fallo esperado (REQ-F-011).
  - `docker compose run --rm test`: código 0; 1355 pasan, 1 fallo esperado y 5 omitidas (ya existentes).

## QA Action Plan

Elaborado por `senior-qa` el 2026-10-08, tras la aprobación de la implementación ("apruebo la implementación y actualiza el agente"). Todavía no se ha ejecutado nada.

### Objetivo

Comprobar con evidencia que:

- el bot entiende pedidos en texto libre y cierra un pedido con los turnos de D-11, con Meta y con Twilio;
- se mantienen las garantías de REQ-F-009 y REQ-F-012: flujo numerado, D-13, D-16, aviso único al personal, privacidad, cola, límite por número y descarte de mensajes viejos;
- el intérprete es determinista, no hace peticiones externas, no registra texto y se puede sustituir sin tocar la conversación.

### Requisito bajo prueba

- REQ-F-013 v2, con D-1 a D-12, RF-1 a RF-11, RN-10 a RN-13 y las nueve precisiones v2.
- Del Technical Action Plan aprobado: R-5.1 a R-5.8, las precisiones (a) a (d) de R-6 y DT-1.
- La regla añadida en la implementación ("con" o "sin" después de una coma continúa el detalle de la línea anterior) no está en el requisito. Se valida que no contradiga RF-1.2, RF-8 ni RN-13.

### Alcance de la revisión (diff frente a `main`, sin commits)

- **Producción:**
  - `src/content/{common,molotes,birria}/bot.ts` y `src/content/bot.ts`;
  - `src/services/whatsapp-bot/{catalog,conversation,messages,orchestrator}.ts`;
  - `src/services/whatsapp-bot/interpreter/`, nuevo, con 7 archivos;
  - `scripts/bot-chat.ts` y `README.md`.
- **Pruebas:** 3 archivos nuevos y 9 actualizados.
- **Agente:** `.claude/agents/senior-fullstack.md`, que cambió la sesión principal con autorización.
- **Fuera del diff:** `package.json` y `package-lock.json` (no hay dependencias nuevas), `.env.example`, los proveedores, las rutas, las landings y `/admin`.
- **Consumidores de los módulos modificados** (CodeGraph no devolvió el radio de impacto; se obtuvo con grep):
  - `src/app.ts` y `scripts/bot-chat.ts`;
  - `tests/support/{twilio,whatsapp}.ts`;
  - las pruebas de contrato, de webhooks (Meta y Twilio), de QA de Twilio, de infraestructura, del orquestador y de la conversación.

### Criterios de aceptación → pruebas

| CA | Pruebas que lo cubren |
|---|---|
| CA-1 | F-1, F-2 y F-3 con los dos proveedores: conteo propio en las pruebas nuevas de QA, más la existente `chat-bot-message-count`. |
| CA-2 | F-4, con los dos proveedores. |
| CA-3 | F-5: solo números, con 10 mensajes del cliente o menos, total de $295 y el aviso con los mismos importes. Se compara el aviso con el de `main`, obtenido con un `git worktree` de `main` en el directorio temporal, sin tocar la rama ni los cambios sin commit. |
| CA-4 | F-6: más 1 mensaje del cliente y 1 del bot, con los dos proveedores. |
| CA-5 y CA-6 | F-7: las 19 frases, con la verificación exacta del slug, la opción, la cantidad, el detalle **y el precio** que muestra la respuesta de RF-2 (no solo la salida del intérprete). |
| CA-7 | R-1 y R-2 (flujo numerado completo) y N-1 (un mensaje que es solo un número, en cada paso de la tabla de RF-4.4). |
| CA-8 | N-2 a N-6. |
| CA-9 | N-7. |
| CA-10 | F-10 y N-8. |
| CA-11 | F-11 y DT-1 (P-1 a P-4). |
| CA-12 | F-12 y L-9 a L-14. |
| CA-13 | F-13 y L-15 a L-18. |
| CA-14 | F-14, con fechas simuladas en `America/Mexico_City` y el servidor en otra zona horaria (`TZ=UTC` y `TZ=Asia/Tokyo`). |
| CA-15 | S-1 a S-6. |
| CA-16 | F-15 y L-19. |
| CA-17 | R-3 a R-9. Revisión del diff de las pruebas actualizadas: ninguna aserción de REQ-F-009 o REQ-F-012 se debilitó sin la referencia a REQ-F-013. |
| CA-18 | Q-1 a Q-6. El CI del PR queda pendiente para T4 (ver preguntas). |

### Riesgos identificados

1. **Malentendido silencioso:** el intérprete agrega otro producto, otra cantidad u otra variante sin preguntar. Es el riesgo principal. Lo mitigan RF-2 y el resumen, pero cuesta un pedido equivocado.
2. **Descarte silencioso de texto** (incumpliría RN-13), en especial con la regla nueva de "con" o "sin", en la segmentación por "y" y en los fragmentos que cuentan como relleno.
3. **Datos frente a productos** (RF-5.6): nombres o direcciones con palabras de producto ("Calle de la Papa 10", "Tina", "Paco"), o con palabras de entrega dentro del nombre.
4. **Privacidad:** fragmentos, detalles, `pendingText` o notas que se filtran al log, incluso por la ruta de `bot_processing_failed`.
5. **DT-1:** la longitud medida en unidades UTF-16 y no en caracteres, un emoji cortado a la mitad al recortar, o el cuerpo hidratado por encima de 1024 si los parámetros saneados crecen.
6. **Regresión del flujo numerado,** de D-13 al conservar el detalle, del aviso único y de la cola o el límite por número.
7. **Conflicto de números** en el primer turno (R-5.2) y "pedido" como intención o como palabra clave (R-5.3).
8. **Rendimiento** del intérprete con 1000 caracteres (tolerancia con tope y segmentación).

### Pruebas funcionales (flujo principal)

Con los dos proveedores, por HTTP firmado, con el orquestador real y los dobles. Las fechas son simuladas: un martes a las 12:00 para Molotes y un sábado a las 12:00 para Birria.

- **F-1.** Ejemplo 1 (CA-1): el mensaje de la landing, "2 órdenes de queso y una coca", "Juan, recoger" y "sí". Se comprueban el carrito, el total, la línea con el detalle "Coca-Cola" y un único aviso al personal.
- **F-2.** Birria, 2 productos, para recoger: "3 quesabirrias y un consome chico con carne".
- **F-3.** Birria a domicilio, con la dirección en el mensaje 3. La dirección aparece en el resumen y en el aviso.
- **F-4.** El pedido completo en el primer mensaje (CA-2): sin texto de intención, y con el mensaje de la landing seguido de productos en el mismo mensaje.
- **F-5.** Solo con números (CA-3), según la secuencia del ticket.
- **F-6.** Dos líneas ambiguas y una clara (CA-4): "uno de epazote, un consomé y 2 de queso", y después "2, 1". También con la respuesta en palabras ("hongos y chico con carne").
- **F-7.** Batería de CA-5 y CA-6 por la conversación completa, comprobando el texto de RF-2: lo agregado con el detalle, el total, la petición de datos con la privacidad y la indicación "quita <producto>".
- **F-10.** "cancelar", "cancela la coca", "quita la coca" y "sin la coca". También quitar con varias líneas del mismo producto, con las opciones numeradas.
- **F-11.** Un detalle de 61 caracteres o más, recortado a 60 en el carrito, el resumen, `lineas` (Meta) y el texto de Twilio, con el precio sin cambios.
- **F-12.** "Juan, recoger", "Ana, domicilio, Calle 5 #10 Col. Centro", "Ana, domicilio" (pide solo la dirección), "recoger" (pide solo el nombre) y "Juan" (ayuda breve). Un mensaje con productos y una palabra de entrega lleva a una sola pregunta, y se comprueban las dos respuestas posibles ("1" y "2").
- **F-13.** En el resumen:
  - "sí", "si", "SÍ", "confirmo", "ok", "va", "dale", "listo", "correcto" y "1" confirman;
  - "sin picante, por favor" es una nota, que reemplaza a la anterior, se ve en el resumen y en el aviso, y admite hasta 200 caracteres;
  - "sin notas" y "0" borran la nota;
  - "agrega una coca" y "también 2 de tinga" editan el carrito;
  - "no" repite la indicación;
  - "2" y "cancelar" cancelan.
- **F-14.** D-16: un viernes a las 16:00, con el mensaje de la landing y con "2 molotes de queso", el carrito queda vacío. Un lunes a las 10:00 los productos se agregan y el resumen lleva la marca "fuera de horario". Se repite con el proceso en `TZ=UTC` y en `TZ=Asia/Tokyo`.
- **F-15.** CA-16: un producto nuevo y uno renombrado mediante el repositorio en memoria, y un sinónimo de un slug inexistente. Se comprueba la conversación completa, no solo el intérprete.

### Pruebas negativas y casos límite

- **N-1.** Un mensaje que es solo un número en cada paso de la tabla de RF-4.4, incluido el primer turno con el menú visible, donde "1" es un producto y no la opción 1 (R-5.2).
- **N-2.** "quiero 25 tacos", "25 tacos y una coca", "0 tacos", "veintiuno tacos" y "treinta tacos" (R-6 d), y "21 tacos".
- **N-3.** Un mensaje con 16 líneas, y un carrito de 14 líneas que recibe 3 más: el tope de 15 se aplica al pedido completo y el bot avisa de lo que no agregó.
- **N-4.** Un producto no disponible y una variante no disponible, con aviso. Un producto eliminado se trata como no reconocido.
- **N-5.** "2 tacos de birria" un martes, y "un molote" o "2 de queso" en Birria.
- **N-6.** "2 tacos y un molote" en Birria: los tacos y la nota del otro negocio, en un solo mensaje.
- **N-7.** "jsjsj y 2 tacos", "asdf", y solo emojis o solo relleno ("hola buenas", "porfa").
- **N-8.** "cancelar" con texto alrededor ("cancelar por favor") no cancela el pedido. "Cancelar" con mayúsculas o acentos, como mensaje completo, sí lo cancela.
- **L-1.** "orden de 3" frente a "3 órdenes", "orden de 5" (R-6 b), "2 órdenes de 3 de queso" y "una orden de 3 de queso".
- **L-2.** La herencia de "orden" solo dentro del mismo mensaje (D-3): una línea en un mensaje nuevo vuelve a "pieza".
- **L-3.** Líneas repetidas: con el mismo detalle se suman, sin pasar de 20 (por ejemplo, "15 de queso y 10 de queso"), y con un detalle distinto quedan como líneas separadas. Se repite contra lo que ya hay en el carrito.
- **L-4.** Tolerancia de D-12, en los extremos:
  - 1 edición en palabras de 4 y de 7 letras;
  - 2 ediciones en una de 8;
  - 0 en palabras de 3 letras;
  - 2 ediciones en una de 4 a 7 letras no se corrigen;
  - empates;
  - las palabras de entrega, confirmación y palabras clave no se corrigen ("recojer" no es entrega; "cancelr" no cancela).
- **L-5.** "sin" como variante en el consomé chico y como detalle en otros productos. "con" como detalle ("tinga con queso") o como parte del nombre ("papas con chorizo", "taco con tortilla de mano").
- **L-6.** Mensajes de 1000 caracteres o más (se truncan según `MAX_TEXT_LENGTH`), emojis, texto mezclado con números de teléfono y saltos de línea.
- **L-7.** Una aclaración pendiente a la que el cliente responde con otro pedido (RF-3.3), y una respuesta con un número fuera de rango.
- **L-8.** Una aclaración con más de 9 opciones (R-6 c), forzada con un catálogo en memoria.
- **L-9.** Un nombre con palabras de producto o parecido a un producto: "Tina, recoger" y "Papa Luis, recoger".
- **L-10.** Una dirección con números y palabras de producto: "Luis, domicilio, Calle de la Papa 10, Col. Centro".
- **L-11.** Datos sin comas: "Paco domicilio Reforma 123" y "soy Ana y paso por ellos".
- **L-12.** Datos escritos antes del aviso de privacidad (en el primer mensaje): no se capturan (X-5, R-5.4).
- **L-13.** Los límites de D-12 de REQ-F-009: un nombre de 61 caracteres y una dirección de 4 y de 201.
- **L-14.** "Juan, recoger, paso a las 3": el texto que sigue a "recoger" se guarda como nota (R-6 a).
- **L-15.** "no gracias", "sí por favor" y "ok gracias" en el resumen. Según RF-6.3 y RF-6.2 deberían quedar como nota. Se registra el comportamiento real como observación de UX.
- **L-16.** "pedido" en el primer mensaje (intención) y a mitad del flujo (muestra el carrito, R-5.3).
- **L-17.** Los sinónimos nuevos de "persona" ("hablar con alguien", "quiero hablar con alguien", "atención", "operador") como mensaje completo, y la frase dentro de un pedido.
- **L-18.** D-13 con detalle: un producto cuyo precio cambia o que deja de estar disponible entre el resumen y "sí". Se revalida, se informa al cliente y la línea conserva el detalle.
- **L-19.** Un producto nuevo cuyo nombre incluye " y " (limitación 3).

### Batería exploratoria de robustez del intérprete

Frases reales que no están en el ticket. Se ejecutan con la conversación completa (para ver el texto de RF-2) y con el intérprete. No crean criterios nuevos: cada resultado se clasifica así:

| Resultado | Clasificación propuesta |
|---|---|
| Entiende lo esperado | OK |
| Pregunta, o informa que no entendió, una frase con una lectura razonable | Observación de robustez, sin defecto |
| Agrega un producto, una cantidad o una variante distintos de lo escrito, sin preguntar | `DEFECT`, MAJOR (contradice RN-11 y RF-1.3; el resumen permite corregirlo) |
| Descarta texto sin decirlo | `DEFECT`, MAJOR (RN-13) |
| Precio distinto del catálogo, excepción o mensaje vacío | `DEFECT`, CRITICAL |
| Falla una frase de CA-5 o CA-6, o un caso descrito literalmente en un RF | `DEFECT`, según su impacto |

**Molotes:**

- "me das 3 de queso y 2 de tinga porfa"
- "quiero 2 ordenes de papa con chorizo y una coca sin azucar"
- "2 molotes de queso, 1 de picadillo y un sprite"
- "una docena de queso", "media docena de tinga", "un par de cocas"
- "2 de hongo", "2 zetas", "3 de champi"
- "2 de chicharrón y 2 de chicharron prensado" (se deberían sumar: 4)
- "2 de queso sin crema y 2 de queso" (dos líneas)
- "1 orden de 2 de tinga" (R-6 b) y "2 ordenes de 3 de queso"
- "quiero 2 de papa", "1 agua de horchata" y "1 limon", en líneas separadas
- "2 de queso + 1 jamaica", "una coca de vidrio", "tinga x2", "2x queso"
- "molotes de queso oaxaca 🔥🔥", "QUIERO 3 DE TINGA!!!"
- "dos de tinga 2 de queso" (sin separador, limitación 1)

**Birria:**

- "3 quesabirrias, 2 tacos sin cebolla, con mucha salsa y un consome grande" (regla de "con" y "sin")
- "un consome chico, con carne": la regla de continuación frente a la variante, que puede acabar en pregunta o en detalle
- "2 tacos, sin cebolla, bien dorados" (limitación 2)
- "2 birriamen grandes y 1 chico", "una coca y una jamaica", "2 tacos y 1 agua"
- "4 tacos de birria" en Birria (palabra genérica) y "quiero birria"
- "2 quesabirias", "2 tcos" y "consome sin carne"
- "2 tacos 1 coca" y "2 tacos 1 quesabirria" (limitación 1)
- "2 tacos con tortilla de mano" (el nombre contiene "con")

**Edición:**

- "quita 1 taco": quita la línea completa (precisión v2).
- "cancela los tacos", "sin los tacos" y "elimina la coca".
- "sin cebolla" en el carrito (no es quitar, porque no lleva artículo).

### Valoración de las limitaciones declaradas

| Limitación | Qué se mide | Propuesta |
|---|---|---|
| 1. "2 tacos 1 coca" sin separador puede acabar en pregunta | Si el resultado es siempre una pregunta o un aviso, o si en algún caso agrega algo distinto sin preguntar (por ejemplo, 1 taco, 21 tacos o 2 cocas) | RF-1.2 solo exige "y", comas, "+" y saltos de línea, así que una pregunta es aceptable (observación). Un resultado silencioso equivocado sería `DEFECT` MAJOR. |
| 2. Un texto suelto tras una coma que no empieza con "con" o "sin" sale como no entendido | Que se informe citando el fragmento y que el resto se agregue | Cumple RF-1.2 (la coma separa) y RN-13 (se informa), así que es aceptable. Se pregunta al usuario si lo acepta como limitación (pregunta 3). |
| 3. Un nombre de producto con " y " solo se protege si aparece completo | Hoy ningún producto de las semillas lleva " y ", así que no tiene efecto en el catálogo actual. Se prueba con un producto en memoria ("Agua de Limón y Chía"), nombrado completo y en parte | Aceptable si al nombrarlo en parte el bot pregunta o informa. `DEFECT` si agrega otra cosa sin decirlo. |
| Regla nueva de "con" o "sin" tras una coma | Que no absorba una línea que sí es un pedido ("2 tacos, sin cebolla, con carne un consomé") ni una variante de Birria | Se valida contra RF-8.1 y RN-13. |

### Pruebas de integración (WhatsApp, los dos proveedores)

- **I-1.** Cada respuesta del bot es un solo mensaje por turno (salvo la partición prevista). Con Twilio, el turno de intención produce 1 mensaje de 1600 caracteres o menos con el catálogo actual (R-3), y un catálogo de 50 productos con nombres de 80 caracteres se parte sin cortar ningún producto.
- **I-2.** El aviso al personal se envía una sola vez:
  - Meta: plantilla, con `lineas` que lleva el detalle;
  - Twilio: texto libre, con el detalle, partido en 1600 si hace falta.
- **I-3.** Las firmas, la respuesta 200 inmediata, la deduplicación por id, la cola de mensajes muy seguidos, el límite por número y el descarte de mensajes viejos, con el flujo nuevo.
- **I-4.** Audio o imagen (D-15) en mitad del flujo nuevo, incluida una aclaración pendiente.
- **I-5.** Las landings: el CTA de WhatsApp de `/molotes` y `/birria` mantiene su `href` y su texto (el mensaje de `.env.example`), comprobado por HTTP. Ese texto, enviado al bot, es intención y no agrega nada (R-5.1).

### DT-1: la plantilla compactada a 1024 caracteres

- **P-1.** Peor caso: 15 líneas con nombres de 80 caracteres, detalles de 60, cantidad 20, nombre de 60, dirección de 200 y notas de 200. El cuerpo hidratado de `STAFF_TEMPLATE_BODY` mide 1024 caracteres o menos, conserva las 15 cantidades, los 15 productos (al menos su inicio) y el total exacto, y se registra `bot_staff_notice_compacted` con el nivel y sin texto.
- **P-2.** El mismo peor caso con emojis y caracteres fuera del BMP en los detalles, el nombre y las notas: la longitud se mide en caracteres (puntos de código), ningún emoji queda partido y el resultado sigue saneado (sin saltos de línea, tabuladores ni 4 espacios seguidos; 132018).
- **P-3.** Cada nivel (L0 a L3) se alcanza con pedidos crecientes. Un pedido normal no se compacta. El texto libre de Twilio nunca se compacta.
- **P-4.** `STAFF_TEMPLATE_BODY` coincide con el texto de la plantilla del README.

### Privacidad y log (CA-15, RF-11, RN-12)

- **S-1.** Se recorren todos los flujos (F-1 a F-15, la aclaración, `dataOrProducts`, notas, quitar, D-13 y cancelar) con un log capturado, usando textos centinela únicos (por ejemplo "ZQXNOMBRE", "ZQXCALLE", "ZQXNOTA", "ZQXDETALLE" y "ZQXFRAG"). Ningún centinela aparece en el log.
- **S-2.** Hay un `bot_order_interpreted` por cada mensaje interpretado, con `conversationId`, `business`, `source` y los contadores correctos para casos conocidos (por ejemplo, "jsjsj y 2 tacos" da `recognized` 1 y `unrecognized` 1). El número va enmascarado.
- **S-3.** Un intérprete falso que lanza una excepción: queda `bot_processing_failed` sin texto y el cliente no recibe datos internos.
- **S-4.** `tests/setup/no-meta.ts` sigue activo y ninguna prueba hace `fetch` externo. Por grep: `interpreter/` no usa `fetch`, ni red, ni nuevas dependencias.
- **S-5.** `npm run bot:chat` con los dos proveedores: la salida del log (stderr) no contiene los textos escritos.
- **S-6.** Un nombre o una dirección del primer mensaje no aparecen en el resumen (X-5).

### Sustituibilidad del intérprete (D-2, R-4)

- **D-1.** Un `OrderInterpreter` falso, inyectado con `createBotOrchestrator({ interpreter })`, devuelve resultados fijos (un ítem, una ambigüedad y datos del cliente). La conversación agrega, pregunta y cierra el pedido sin usar el intérprete determinista.
- **D-2.** Revisión estática: `conversation.ts` y `orchestrator.ts` solo dependen de `interpreter/types.ts` y de `deterministic.ts` (este, como valor por defecto), no de `order.ts`, `tokens.ts` ni `vocabulary.ts`. Los resultados son datos serializables (`structuredClone` no falla con los estados `clarify` ni `pendingText`).
- **D-3.** El intérprete no fija precios: con un intérprete falso que devuelve un slug y una opción, el precio sale del catálogo (RN-11).

### Pruebas de regresión

- **R-1.** El flujo numerado completo de REQ-F-009 con los dos proveedores: opciones, cantidades, agregar otro, quitar por número, vaciar, terminar, entrega 1 y 2, y confirmar o cancelar en el resumen.
- **R-2.** Las palabras clave como mensaje completo: `menú`, `carrito`, `cancelar`, `persona` y `ayuda`.
- **R-3.** El negocio queda fijado a medianoche (CA-6a y CA-6b de REQ-F-009) y la expiración tras 2 h.
- **R-4.** D-13 (precio o disponibilidad que cambian antes de confirmar) y CA-13 de REQ-F-009 (dirección obligatoria a domicilio).
- **R-5.** El aviso al personal se envía una sola vez, incluso con un reintento del webhook.
- **R-6.** REQ-F-012: la selección del proveedor, la partición a 1600 caracteres, la firma de Twilio y los fallos de entrega.
- **R-7.** Revisión del diff de las 9 pruebas actualizadas: qué aserciones cambiaron, que lleven la referencia a REQ-F-013 y que ninguna se haya debilitado más de lo que exige el cambio de pasos.
- **R-8.** Las landings y `/admin`: toda la suite (`app`, `landing-*`, `admin-*`), sin cambios en su comportamiento.
- **R-9.** La suite completa (`npm test`).

### Pruebas de performance

- **PF-1.** El tiempo del intérprete con 1000 caracteres de peor caso (muchas palabras de 8 o más letras que activan la tolerancia, y muchos separadores), medido en 100 repeticiones. Se informa el p95 como dato. Solo sería defecto si un mensaje tarda lo bastante como para retrasar la cola de forma visible (más de 100 ms por mensaje, medido).
- **PF-2.** No hay dependencias nuevas, accesos a la base de datos ni cachés nuevas (revisión del diff).

### Pruebas de calidad y documentación (CA-18)

- **Q-1.** `npm run typecheck` termina con 0.
- **Q-2.** `npm run lint` termina con 0, sin avisos. No se ejecuta `lint:fix`.
- **Q-3.** `npm test` termina con 0. Se compara el número de pruebas con el de `main`, y el único fallo esperado es el `it.fails` preexistente de REQ-F-011.
- **Q-4.** `docker compose run --rm test`, si Docker está disponible. Si no, queda bloqueado por el entorno, sin defecto.
- **Q-5.** `npm run bot:chat` con `--proveedor meta` y con `--proveedor twilio`, recorriendo el flujo nuevo por stdin.
- **Q-6.** Documentación:
  - el README cubre el vocabulario configurable, cómo añadir sinónimos (el ejemplo funciona: se prueba en una copia temporal), el flujo nuevo, el presupuesto de la plantilla, los costos y el log del intérprete;
  - no documenta nada que no exista;
  - los nombres de los eventos y de los campos coinciden con el código;
  - `.claude/agents/senior-fullstack.md` describe `interpreter/` de forma coherente con el código.

### Responsive, accesibilidad, UX/UI vs. `_stich_source_/` y SEO

**No aplican.** El ticket no cambia las landings, ni las plantillas HTML, el CSS o `public/js` (lo confirma el diff), y no hay diseño de Stitch para el bot.

- La regresión de las landings se cubre con la suite (R-8) y con I-5 por HTTP.
- No se usa el navegador.
- La "UX conversacional" se valida con los textos de RF-2, RF-4.1, RF-5 y RF-6.1 dentro de las pruebas funcionales.

### Pruebas automatizadas (nuevas, solo en `restaurante/tests/`)

1. **`tests/integration/whatsapp-bot-qa-req-f-013.test.ts`.** Con los dos proveedores, mediante `PROVIDER_DRIVERS` y `listenLocal`:
   - F-1 a F-6, F-12 a F-14 y N-1;
   - el log con centinelas (S-1 y S-2);
   - I-2 a I-4;
   - D-13 con detalle (L-18).
2. **`tests/unit/whatsapp-bot-qa-req-f-013.test.ts`.**
   - L-1 a L-17 y L-19, la batería exploratoria (solo las filas que resulten OK o que confirmen un requisito, como regresión) y las limitaciones;
   - DT-1 (P-1 a P-3 con emojis);
   - el intérprete falso que lanza (S-3) y la serialización (D-2);
   - PF-1, como medición informativa, sin una aserción de tiempo frágil.

Las pruebas existentes no se modifican. Los resultados exploratorios que no sean OK se registran en el QA Report, no como pruebas que fallan.

### Evidencia requerida

- La salida de typecheck, lint, `npm test` (con el conteo) y Docker.
- Las pruebas nuevas en verde, o en rojo con el defecto asociado.
- Para cada fila de la batería exploratoria, el texto real de la respuesta del bot o la salida del intérprete.
- Los extractos del log capturado (eventos y contadores) y la búsqueda de los centinelas.
- La longitud medida del cuerpo hidratado de DT-1 en cada nivel.
- La transcripción de `bot:chat` con los dos proveedores.

### Criterios de aprobación

- CA-1 a CA-17 en PASS con evidencia, con los dos proveedores donde aplique.
- CA-18 en PASS en local. El CI queda como pendiente de T4.
- Sin defectos BLOCKER ni CRITICAL, y los MAJOR aceptados explícitamente por el usuario.
- `npm test`, typecheck y lint en 0.
- Sin regresión del flujo numerado, de REQ-F-009 ni de REQ-F-012.
- Ningún texto del cliente en el log.

## QA Report

### Ronda

1 (2026-10-09, senior-qa). Plan aprobado: "Apruebo el plan de QA, sí a 2, 3 y 4, y corrige el sí por favor". Incluye la corrección de RF-6.3 ("sí por favor"), aprobada con un "Si".

### Pruebas ejecutadas

| Comando o acción | Resultado |
|---|---|
| `git branch --show-current` / `git status` | `feature/REQ-F-013-bot-pedidos-texto-libre-menos-turnos`. Los mismos 25 cambios sin commit, más las 2 pruebas nuevas de QA. |
| `npm run typecheck` | Código 0 |
| `npm run lint` | Código 0, sin avisos (también con las pruebas nuevas). No se ejecutó `lint:fix`. |
| `npm test` (antes de las pruebas de QA) | Código 0: 65 archivos, 1208 pasan y 1 fallo esperado (`it.fails` de REQ-F-011) |
| `npm test` (con las pruebas de QA) | Código 0: 67 archivos, 1281 pasan y 8 fallos esperados (el de REQ-F-011 y los 7 `it.fails` de DEF-001 a DEF-004) |
| `docker compose run --rm --build test` | Código 0: 67 archivos, 1276 pasan, 8 fallos esperados y 5 omitidas (`skipIf(runningAsRoot())`, ya existentes) |
| Pruebas del bot con `TZ=UTC` y con `TZ=Asia/Tokyo` (`whatsapp-bot-*`, `chat-bot-*`, `whatsapp-*`) | 13 archivos, 431 pasan y 7 fallos esperados en las dos zonas |
| `npm run build:css` y `PORT=3100 npm start`, con `curl` a `/molotes` y `/birria` | 200. El `href` es `https://wa.me/14155238886?text=Hola%2C%20quiero%20hacer%20un%20pedido%20de%20<negocio>`, con `target="_blank"` y `rel="noopener noreferrer"`. Sin cambios en `public/`. Servidor detenido. |
| `npm run bot:chat -- --ahora 2026-10-10T12:00 --proveedor meta` y `twilio`, por stdin | Código 0. Flujo completo: aclaración, domicilio, nota y "sí por favor". El aviso lleva el detalle (`lineas` con Meta; texto libre con Twilio). |
| Batería exploratoria: unas 70 frases por la conversación real, con un script temporal | Resultados abajo y en las pruebas nuevas |
| DT-1: script con un barrido de 360 combinaciones con emojis | Sobre DEF-004: ver "Defectos encontrados" |
| Rendimiento: `order()` con 1000 caracteres, 100 repeticiones | p95 de 0.7 ms (pedido normal), 2.9 ms (palabras largas), 3.6 ms (120 separadores) y 10 ms (ruido) |
| CA-3 frente a `main` (`git worktree` de `main` en el directorio temporal, después eliminado) | `staffTemplateParams` y `staffNoticeText` dan exactamente lo mismo en `main` y en la rama para el pedido del ejemplo 1 |

**Pruebas nuevas** (solo en `restaurante/tests/`):

- `tests/unit/whatsapp-bot-qa-req-f-013.test.ts`, con 74 casos:
  - las frases exploratorias correctas, como regresión;
  - las limitaciones aceptadas;
  - RF-6.3 con los casos adversos;
  - resumen, edición y notas, y D-13 con detalle;
  - los números por paso y las palabras clave;
  - los datos del cliente;
  - el intérprete que lanza un error y la copia del estado;
  - DT-1 con emojis;
  - `it.fails` para DEF-001 a DEF-004.
- `tests/integration/whatsapp-bot-qa-req-f-013.test.ts`, con 6 casos sobre Meta y Twilio por HTTP firmado:
  - el log con centinelas a lo largo de todo el flujo;
  - el detalle en el aviso;
  - el aviso único;
  - la deduplicación por id;
  - una imagen durante una aclaración.

Antes de dar por buenos los `it.fails`, comprobé que, ejecutados como pruebas normales, fallan por el motivo descrito (en una copia temporal, ya eliminada).

### Criterios de aceptación

| CA | Resultado | Evidencia |
|---|---|---|
| CA-1 | PASS | `chat-bot-message-count` con Meta y con Twilio. Ejemplo 1: 4 mensajes del cliente y 4 del bot, con el saludo y el menú en 1 mensaje de 1600 caracteres o menos. Birria para recoger y a domicilio: 4 o menos y 5 o menos. Un solo aviso. |
| CA-2 | PASS | 3 mensajes del cliente y 3 del bot, con los dos proveedores. |
| CA-3 | PASS | 10 mensajes del cliente y total de $295. El aviso es idéntico al de `main` (comparación con el worktree). |
| CA-4 | PASS | Una sola pregunta; "2, 1" agrega las dos líneas; +1 y +1 (5 y 5), con los dos proveedores. |
| CA-5 | PASS | Las 12 frases, en la batería existente. Además, 15 frases exploratorias correctas en Molotes, con el precio. |
| CA-6 | PASS | Las 7 frases. Pero DEF-001 aparece con variantes cercanas a la frase del criterio: ", con carne" después de una coma. |
| CA-7 | PASS | "5" en el menú; "1" en el primer turno es un producto; opción, cantidad, carrito y quitar por número; las pruebas de REQ-F-009 pasan. |
| CA-8 | PASS | 25, "25 tacos y una coca", 0, 21, "veintiuno", "treinta", 16 líneas, el tope de 15 en el carrito (con aviso), no disponible y el otro negocio. |
| CA-9 | PASS | "jsjsj y 2 tacos", y también "zqxfrag y 2 tacos…" con los dos proveedores. |
| CA-10 | PASS | "cancelar" y "CANCELAR" cancelan; "cancelar por favor" no; "cancela los tacos", "quita la coca", "sin la coca"; "quita 1 taco" quita la línea completa. |
| CA-11 | PASS | Detalle recortado a 60, con Meta y con Twilio, sin cambio de precio. El detalle llega al aviso por HTTP con los dos proveedores. Ver DEF-004 (emojis en la compactación). |
| CA-12 | PASS | "Juan, recoger", "Ana, domicilio, …", "Ana, domicilio" (pide la dirección), "Juan" (ayuda), productos con palabra de entrega (una pregunta), "Tina, recoger", "Calle de la Papa 10" (pregunta, y con "2" la dirección completa), datos sin comas, nombre de 61 y direcciones de 4 y 201 rechazados. |
| CA-13 | PASS | "sí" y las confirmaciones de RF-6.3; la nota (200 sí, 201 no); "0" y "sin notas"; "agrega" y "también"; "no", "no gracias" y "no quiero" repiten la indicación; "2" y "cancelar" cancelan. Precisión de "sí por favor": confirman "sí por favor", "ok gracias", "si porfa", "dale, gracias", "Sí, muchas gracias" y "sí, nada más". Quedan como nota "sí, agrega una coca", "si quiero picante", "sí pero sin cebolla", "si, otra coca" y "si para llevar". |
| CA-14 | PASS | Viernes a las 16:00 (D-16) y lunes a las 10:00 ("fuera de horario"), también con `TZ=UTC` y `TZ=Asia/Tokyo`. |
| CA-15 | PASS | Aviso de privacidad junto a la petición de datos. "Pedro" y "Calle Falsa" del primer mensaje no llegan al resumen. Centinelas: el log, con los dos proveedores, no contiene fragmentos, detalles, nombre, dirección, nota ni el número. `bot_order_interpreted` lleva solo las claves esperadas y los contadores correctos. Un intérprete que lanza deja `bot_processing_failed` sin texto. `interpreter/` no tiene `fetch` ni red, y `no-meta.ts` sigue activo. |
| CA-16 | PASS | Producto nuevo y renombrado; sinónimo de un slug eliminado. |
| CA-17 | PASS | Revisé el diff de las 9 pruebas actualizadas: solo cambian los pasos de nombre, entrega y notas y los textos de ayuda, con la referencia a REQ-F-013. Ninguna aserción de negocio se debilitó. |
| CA-18 | PASS (en local) | typecheck, lint, `npm test`, Docker y `bot:chat` con los dos proveedores. El README está revisado. El CI queda pendiente de T4 y no bloquea (decisión 4). |

### Defectos encontrados

### DEF-001
- **Severidad:** MAJOR.
- **Criterio afectado:** RF-1.3, RF-3 y RN-11 (relacionado con CA-6 y CA-4). Lo provoca la regla nueva de "con" o "sin" tras una coma.
- **Descripción:** un fragmento "con carne" o "sin carne" después de una coma se interpreta como **otro consomé**:
  - con el consomé, el bot lo agrega y además vuelve a preguntar por él;
  - con otro producto, agrega un consomé que nadie pidió.
- **Pasos para reproducir** (Birria, sábado):
  1. "3 tacos, con carne"
  2. "un consome chico, con carne", y después "1"
  3. "2 tacos y 1 consome chico, con carne"
  4. "1 consome, sin carne"
  5. "1 birriamen, grande"
- **Resultado esperado:** que se agregue o se pregunte una sola vez lo que el cliente pidió, sin productos de más.
- **Resultado actual:**
  - (1) agrega 3 tacos **y 1 Tazón de Consomé Chico (Con Carne) por $80**;
  - (2) agrega 1 consomé con carne **y** pregunta "1) un consome chico"; al responder "1", el carrito queda con **2 consomés ($160)**;
  - (3) y (4) agregan el consomé y también preguntan por él;
  - (5) dos bloques de pregunta: el segundo ofrece el Consomé Grande.
- **Evidencia:** `it.fails` "DEF-001" en `tests/unit/whatsapp-bot-qa-req-f-013.test.ts` (4 casos), y la transcripción de la batería exploratoria.
- **Impacto:** un pedido equivocado y un cobro mayor si el cliente no revisa el carrito o contesta la pregunta. Se ve en RF-2 y en el resumen, así que hay una alternativa.
- **Recomendación:** una frase de variante sin producto, después de una coma, no debería crear una línea nueva. Debería completar la variante de la línea anterior o quedar como detalle de esa línea, sin duplicar la pregunta.

### DEF-002
- **Severidad:** MAJOR.
- **Criterio afectado:** RN-13 y RF-1.3. Es la excepción de la decisión 3: aceptada si acaba en una pregunta, pero "siguen siendo defecto si el bot agrega algo equivocado sin avisar".
- **Descripción:** sin separador, el bot pregunta qué producto es. Al contestar, agrega solo el elegido, con la cantidad del otro o la primera, deja el número sobrante como detalle y descarta el otro producto **sin avisar**.
- **Pasos para reproducir:**
  1. Birria: "2 tacos 1 coca" → "1"
  2. Birria: "2 tacos 1 coca" → "2"
  3. Molotes: "dos de tinga 2 de queso" → "1"
- **Resultado esperado:** que se agreguen los dos productos, o que el bot diga qué no agregó.
- **Resultado actual:**
  - (1) "2 × Taco de Birria … · 1", y la coca desaparece sin aviso;
  - (2) "**2** × Bebidas Frías del Comal (Coca-Cola Vidrio) · 1", cuando se pidió 1 coca, y los tacos desaparecen;
  - (3) "2 × Molotes de Tinga de Pollo (pieza) · 2", y el queso desaparece.
- **Evidencia:** `it.fails` "DEF-002" y la transcripción exploratoria.
- **Impacto:** se pierde parte del pedido y cambian cantidades sin aviso. El carrito lo muestra.
- **Recomendación:** que la respuesta a la aclaración no descarte en silencio el resto del fragmento, por ejemplo informándolo como no entendido.

### DEF-003
- **Severidad:** MAJOR (escala aprobada: una cantidad distinta de la escrita, sin preguntar).
- **Criterio afectado:** RF-1.3 (cantidad en número).
- **Descripción:** "x2" o "2x" no se reconocen como cantidad. La línea se agrega con 1 unidad y el detalle "x2".
- **Pasos para reproducir:**
  1. Molotes: "tinga x2" → "1 × Molotes de Tinga de Pollo (pieza) · x2".
  2. Molotes: "2x queso" → "1 × … Queso Oaxaca (pieza) · 2x".
  3. Birria: "3 tacos x2" → "3 × Taco … · x2".
- **Resultado esperado:** la cantidad escrita, o una pregunta.
- **Resultado actual:** 1 unidad, con "x2" como detalle.
- **Evidencia:** `it.fails` "DEF-003" y la batería exploratoria.
- **Impacto:** el cliente recibe menos producto. Es visible en el carrito y en el resumen. El formato "x2" no aparece en RF-1.3, pero es un número junto al producto.
- **Recomendación:** reconocer "xN" y "Nx" como cantidad, o al menos no agregar la línea sin preguntar.

### DEF-004
- **Severidad:** MINOR.
- **Criterio afectado:** DT-1 (P-2 del plan) y CA-11.
- **Descripción:** en los niveles L2 y L3 de la compactación, `clip` (`messages.ts`) corta por unidades UTF-16. Si el corte cae en un emoji, deja un sustituto suelto (`\ud83d`) en `lineas`.
- **Pasos para reproducir:** 15 líneas con nombres de 10 caracteres con emojis, detalles de 60 "🔥", dirección y notas de 200, y `buildStaffTemplate`. En el barrido, 157 de 360 combinaciones dejaron un sustituto suelto.
- **Resultado esperado:** que ningún emoji quede partido.
- **Resultado actual:** `lineas` contiene "🔥🔥🔥🔥🔥\ud83d…".
- **Evidencia:** `it.fails` "DEF-004".
- **Impacto:** solo ocurre con pedidos muy grandes que obligan a compactar y con emojis en el detalle. No se sabe cómo trata Meta un sustituto suelto: si lo rechaza, el aviso al personal fallaría después de que el cliente recibió la confirmación (`bot_staff_delivery_failed`). Es poco probable.
- **Recomendación:** recortar por puntos de código, como ya hace el detalle a 60.

### DEF-005
- **Severidad:** TRIVIAL.
- **Criterio afectado:** R-5.4 del plan técnico aprobado.
- **Descripción:** en el primer mensaje, "Hola soy Pedro, quiero 2 de queso, a domicilio en Calle Falsa 123" se informa como `No entendí: "a domicilio en Calle Falsa 123"`. R-5.4 dice que las palabras de entrega nunca forman parte de un fragmento no entendido.
- **Resultado esperado:** que el fragmento no incluya la palabra de entrega, o un aviso que explique que los datos se piden después.
- **Impacto:** cosmético. El dato no se captura (X-5 se cumple) y solo se devuelve al propio cliente.
- **Recomendación:** revisarlo junto con DEF-001 y DEF-002.

### Observaciones (no son defectos)

- **OBS-1. Ayuda tras "4" y un nombre solo** (se corrige por decisión del usuario). Si el cliente escribe solo su nombre ("Ana") después de "4", recibe la ayuda breve sobre cómo pedir productos, como exige CA-12. Esa ayuda no le recuerda que debe indicar la forma de entrega. Además, el paso "Entrega 1 o 2" de RF-4.4 no se alcanza en la práctica: la tabla de RF-5.6 lo resuelve como ayuda. Es una mejora de UX opcional.
- **Limitación 3 (" y " en un nombre).** Con un producto en memoria "Molotes de Frijol y Queso":
  - "2 molotes de frijol y queso" funciona;
  - "2 de frijol y queso" agrega el frijol y pregunta por "queso", con el riesgo de agregar un queso de más si el cliente responde.
  
  Hoy no afecta, porque ningún producto del catálogo lleva " y ".
- **Respuestas que no se agregan sin aviso de error,** aunque el bot dice que no entendió y RN-13 se cumple:
  - "3 de champi" y "quiero birria" dan la ayuda;
  - "sin cebolla" en el carrito da la ayuda;
  - "15 tacos y 10 tacos" rechaza la segunda línea, en lugar de sumarla hasta 20, con un mensaje claro.
- **"sí, agrega una coca" en el resumen** queda como nota y no se agrega la coca. Cumple RF-6.3 y RF-7.3, porque la edición tiene que empezar con el verbo. Ni confirma ni pierde el texto: se ve en el resumen y llega al personal.
- **DT-1 con emojis en el nombre, la dirección y las notas** (60, 200 y 200 emojis): 780 caracteres (puntos de código), dentro de 1024, pero 1240 unidades UTF-16. Si Meta contara en UTF-16, se pasaría. Queda ligado a CA-26 de REQ-F-009, que sigue pendiente.
- **`bot:chat` usa un logger silencioso,** así que S-5 no aplica. La privacidad del log se verificó con el logger que registra, en las pruebas de integración.

### Regresión

- La suite completa pasa: 1281 pruebas en local y 1276 en Docker. Las pruebas de REQ-F-009 y REQ-F-012 pasan con los dos proveedores: flujo numerado, D-13, aviso único, deduplicación, partición a 1600 caracteres, firmas, límite por número y medianoche.
- El aviso al personal del flujo numerado es idéntico al de `main`.
- Las landings y `/admin` no cambian: el diff no toca `public/`, `src/views`, `src/styles`, `package.json` ni `.env.example`, la suite pasa y el CTA se comprobó por HTTP.

### Responsive

No aplica: el diff no toca las landings ni la interfaz.

### Accesibilidad

No aplica, por el mismo motivo. El CTA de WhatsApp mantiene su `href`, `target` y `rel`.

### UX/UI

No hay diseño en `_stich_source_/` para el bot. La UX conversacional se validó con los textos de RF-2, RF-4.1, RF-5 y RF-6.1. Ver las observaciones.

### Performance

El intérprete tarda como máximo 12 ms con 1000 caracteres de ruido, y 0.7 ms de p95 con un pedido normal. Sin dependencias, cachés ni accesos a la base de datos nuevos.

### SEO

No aplica: las landings no cambian.

### Pendientes de revisión manual

- CI del PR (T4). No bloquea, por la decisión 4.
- CA-26 de REQ-F-009: el límite real de la plantilla de Meta y cómo trata un sustituto UTF-16 suelto (relacionado con DEF-004).

### Decisión del usuario (2026-10-09)

Cita textual: "corrige todo, incluida la ayuda tras el nombre".

Se corrigen en este ticket:

- DEF-001 a DEF-005;
- la observación de la ayuda tras el nombre (OBS-1): la ayuda que recibe el cliente cuando escribe solo su nombre en el carrito debe recordarle que indique "recoger" o "a domicilio".

**Criterio para DEF-002,** propuesto por la sesión principal y aceptado por el usuario: si el intérprete no puede separar con seguridad un mensaje sin separadores ("2 tacos 1 coca"), pregunta por el mensaje completo (por ejemplo, "¿Quisiste decir 2 tacos y 1 coca?") o pide que se reescriba con coma. Nunca agrega una parte y pierde la otra, ni cambia cantidades sin avisar.

La observación del producto con " y " en el nombre queda registrada y no se corrige.

### Lista de correcciones para senior-fullstack

| Id | Qué se espera | Prueba que la verifica |
|---|---|---|
| DEF-001 | Un fragmento de variante ("con carne", "sin carne", "grande") después de una coma, sin producto, no crea una línea nueva ni duplica una pregunta. Completa la variante de la línea anterior o queda como su detalle. Casos: "3 tacos, con carne"; "un consome chico, con carne" (con la respuesta "1"); "2 tacos y 1 consome chico, con carne"; "1 consome, sin carne"; "1 birriamen, grande". | `it.fails` "DEF-001: \"3 tacos, con carne\" …" y `it.fails.each` "DEF-001: \"%s\" agrega el consomé o pregunta…" (3 casos) |
| DEF-002 | Con el criterio aceptado. Casos: "2 tacos 1 coca" (respondiendo "1" y "2"), "2 tacos 1 quesabirria" y "dos de tinga 2 de queso". No queda un número sobrante como detalle ("· 1"). | `it.fails` "DEF-002: …". Además, hay que ajustar la prueba "limitaciones aceptadas: \"2 tacos 1 coca\" sin separador acaba en una pregunta" si cambia la forma de la pregunta. |
| DEF-003 | "tinga x2", "2x queso" y "3 tacos x2" usan la cantidad escrita (o preguntan), nunca 1 unidad con el detalle "x2". | `it.fails` "DEF-003: …" |
| DEF-004 | El recorte de los niveles L2 y L3 de DT-1 no parte emojis: recorta por puntos de código. | `it.fails` "DEF-004: …" |
| DEF-005 | El fragmento "no entendido" no incluye palabras de entrega (R-5.4), o el aviso explica que los datos se piden después. Caso: "Hola soy Pedro, quiero 2 de queso, a domicilio en Calle Falsa 123" en el primer mensaje. | Una prueba nueva, de senior-fullstack o de QA en la revalidación |
| OBS-1 | "Ana" (solo el nombre) en el carrito, también después de "4": la ayuda recuerda que se indique "recoger" o "a domicilio" (por ejemplo, "Ana, recoger"). CA-12 sigue cumpliéndose: es una ayuda breve. | Una prueba nueva, de senior-fullstack o de QA en la revalidación |

Todas las pruebas `it.fails` de `restaurante/tests/unit/whatsapp-bot-qa-req-f-013.test.ts` (bloque "QA REQ-F-013: defectos abiertos (ronda 1)", 7 casos) deben pasar a `it` / `it.each` normales y pasar. `npm test` debe quedar solo con el fallo esperado de REQ-F-011.

### Resultado final

QA_REJECTED

Decisión del usuario: corregir DEF-001 a DEF-005 y OBS-1. Todos los criterios de aceptación pasaban con evidencia; no hay BLOCKER ni CRITICAL.

### Ronda 2 (revalidación, 2026-10-09)

Correcciones aprobadas por el usuario: "apruebo las correcciones". También aprobó el criterio ajustado de DEF-002: sin separadores, se agregan todas las partes con su cantidad o no se agrega nada y se piden comas.

#### Pruebas ejecutadas

| Comando o acción | Resultado |
|---|---|
| `npm run typecheck` y `npm run lint` | Código 0, sin avisos |
| `npm test`, al empezar | Código 0: 1312 pasan y 1 fallo esperado (REQ-F-011) |
| `npm test`, con las pruebas de QA de la ronda 2 | Código 0: 1325 pasan y 4 fallos esperados (REQ-F-011 y 3 `it.fails` de DEF-006) |
| `docker compose run --rm --build test` | Código 0: 1320 pasan, 4 fallos esperados y 5 omitidas, ya existentes |
| Pruebas del bot con `TZ=UTC` y con `TZ=Asia/Tokyo` | 475 pasan y 3 fallos esperados en las dos zonas |
| `npm run bot:chat` con Meta y con Twilio | Código 0. Pedido sin separador ("2 tacos zqxdet 1 coca"), "consome, con carne", domicilio, nota y "sí por favor". El aviso lleva las 3 líneas con el detalle. |
| Batería exploratoria de la ronda 1, repetida completa | Todas las frases OK, salvo las que se describen abajo |
| Batería adversa de DEF-002, nueva, con unas 45 frases | Resultados abajo |
| DT-1: barrido de 360 combinaciones con emojis | 0 sustitutos sueltos y un máximo de 1018 caracteres. El peor caso con emojis en todo mide 780 puntos de código. |
| Log con centinelas, Meta y Twilio (`tests/integration/whatsapp-bot-qa-req-f-013.test.ts`) | Pasa: ningún texto del cliente en el log, y los contadores correctos |
| CA-1 a CA-4 (`chat-bot-message-count`, los dos proveedores) | Pasan: 4 y 4, 3 y 3, 10, y +1/+1 |

**Revisión del cambio en mi prueba de limitaciones ("2 tacos 1 coca"):**

- No debilita nada. Ahora exige los dos productos con sus cantidades, sin pregunta, y añade el caso que no se puede separar: no agrega nada y pide comas.
- La prueba "DEF-002" que senior-fullstack pasó a normal sí había quedado débil: después del cambio, la respuesta "1" en el carrito muestra el menú, que contiene "Coca", así que la prueba pasaba sin comprobar nada. La sustituí por 6 casos que se separan y 4 que no.
- También reforcé DEF-003 con 5 casos.

#### Defectos de la ronda 1

| Defecto | Resultado | Evidencia |
|---|---|---|
| DEF-001 | Corregido | "3 tacos, con carne" da 3 tacos con el detalle "con carne". "un consome chico, con carne", "1 consome, sin carne", "1 birriamen, grande" y "2 birriamen, chico" quedan resueltos sin pregunta. "2 tacos y 1 consome chico, con carne" ya no duplica la línea. |
| DEF-002 | Corregido, con el criterio aceptado | "2 tacos 1 coca", "dos de tinga 2 de queso", "dos tacos tres quesabirrias", "2 tacos 2 quesabirrias 1 coca 1 jamaica" y "2 ordenes de queso 1 coca" agregan todo. "2 tacos 1 cocacolota", "2 tacos 3", "2 tacos 1" y "2 tacos 1 sin cebolla" no agregan nada y piden comas. "2 tacos 21 quesabirrias" agrega los tacos y rechaza las 21 con el mensaje de D-12. "2 tacos 1 molote" agrega los tacos y da la nota del otro negocio. |
| DEF-003 | Corregido | "tinga x2", "2x queso", "x2 tacos" y "taco x2, quesabirria x3" usan la cantidad escrita. "3 tacos x2", "1 taco x 2" y "2 tacos x 3 quesabirrias" no agregan nada y piden una sola cantidad. |
| DEF-004 | Corregido | 0 de 360 combinaciones dejan un sustituto suelto (antes, 157). La prueba DEF-004 pasa. |
| DEF-005 | Corregido | En el primer mensaje con "a domicilio en Calle Falsa 123", la dirección ya no se cita. Se añade "Tus datos de entrega te los pido al final…". |
| OBS-1 | Corregido | "Ana" o "Juan" solos en el carrito, también después de "4": "Si es tu nombre, escribe también si es para *recoger* o *a domicilio* …, por ejemplo: *Ana, recoger*". |

#### Defectos nuevos

### DEF-006
- **Severidad:** MAJOR (escala aprobada: una cantidad distinta de la escrita, sin preguntar). Además, contradice el criterio aceptado para DEF-002: "nunca cambia una cantidad".
- **Criterio afectado:** RF-1.3, RF-1.5 y RN-11.
- **Descripción:** "N de M de <producto>", sin la palabra "orden", toma M como cantidad y deja N como detalle. Ocurre también dentro de un mensaje con coma o sin separador.
- **Pasos para reproducir** (Molotes, martes):
  1. "1 de 3 de tinga"
  2. "una de 3 de queso"
  3. "2 de 3 de queso"
  4. "2 de queso 1 de 3 de tinga" (o con coma)
- **Resultado esperado:** que el bot respete la cantidad escrita o pregunte (por ejemplo, ¿N piezas, o N órdenes de 3?). Nunca una cantidad que el cliente no escribió.
- **Resultado actual:**
  - (1) "3 × Molotes de Tinga de Pollo (pieza) · 1";
  - (2) "3 × Molotes de Queso Oaxaca (pieza)";
  - (3) "3 × Molotes de Queso Oaxaca (pieza) · 2";
  - (4) "2 × Queso" y "3 × Tinga (pieza) · 1".
- **Evidencia:** `it.fails.each` "DEF-006" (3 casos) en `tests/unit/whatsapp-bot-qa-req-f-013.test.ts`, y la batería adversa.
- **Impacto:** el cliente que quiso decir "una orden de 3" recibe 3 piezas ($135 en lugar de $130). Con "2 de 3", recibe 3 piezas en lugar de 2 órdenes. Se ve en el carrito y en el resumen. No consta si esto ya ocurría antes de la ronda 1, porque el patrón no estaba en la batería.
- **Recomendación:** tratar "N de M de <producto>" como "orden de M" cuando M coincide con la orden del catálogo (con la regla R-6 b si no coincide), o preguntar. En ningún caso dejar un número como detalle.

### DEF-007
- **Severidad:** MINOR.
- **Criterio afectado:** RF-8.1 y el criterio de DEF-002 ("nunca queda un número sobrante como detalle").
- **Descripción:** en "3 tacos de 2 tortillas", "tortillas" se consume como parte del nombre ("con Tortilla de Mano") y queda solo "2" como detalle.
- **Resultado actual:** "3 × Taco de Birria con Tortilla de Mano · 2".
- **Resultado esperado:** el detalle "de 2 tortillas", o "no entendido".
- **Impacto:** el personal recibe un detalle que no se entiende. La cantidad y el producto son correctos.
- **Recomendación:** que un número dentro de un detalle no quede sin el texto que lo acompaña.

#### Observaciones de la ronda 2 (no son defectos según la escala aprobada)

- **OBS-2. Números de hora, personas o medidas en un mensaje sin comas.** "quiero 2 tacos a las 3", "2 tacos para 3 personas", "2 de queso para las 2", "mesa 5: 2 de queso", "1 coca 2 litros" y "2 de queso con 3 chiles" ya no agregan nada: el bot pide reescribirlos con comas. Cumple el criterio aceptado, porque no pierde nada ni cambia cantidades. Pero el ejemplo que propone parte la frase por los números y queda raro ("*quiero, 2 tacos a las, 3*" o "*2 tacos para, 3 personas*"), y si el cliente lo copia, una parte saldrá como no entendida. Son frases reales y frecuentes.
- **OBS-3. Preguntas que pueden sumar productos de más si el cliente las contesta literalmente.** No son silenciosas: el bot pregunta y muestra opciones con precio. Casos:
  - "2 birriamen 1 grande 1 chico" da 3 bloques ("2 birriamen", "1 grande", "1 chico");
  - "1 consome chico 2 con carne" agrega 2 con carne y pregunta por "1 consome chico";
  - "2 tacos con 2 tortillas" pregunta por "2 tortillas";
  - "2 tacos, grande" y "1 consome, con carne, grande" preguntan por "grande".
- La observación de la ronda 1 sobre el producto con " y " en el nombre sigue registrada, sin cambios.

#### Regresión, responsive, accesibilidad, UX/UI, SEO y rendimiento

- **Regresión:** la suite completa pasa en local y en Docker, con los dos proveedores. Las pruebas de REQ-F-009 y REQ-F-012 pasan. Las correcciones no tocan las landings ni `/admin`: el diff sigue sin cambios en `public/`, `src/views`, `src/styles`, `package.json` ni `.env.example`.
- **Responsive, accesibilidad y SEO:** no aplican, como en la ronda 1.
- **Rendimiento:** sin cambios relevantes. La suite tarda lo mismo (unos 15 s).

#### Pendientes de revisión manual

- CI del PR (T4). No bloquea.
- CA-26 de REQ-F-009 (límite real de la plantilla de Meta).

#### Decisión del usuario sobre la ronda 2 (2026-10-09)

Cita textual: "corrige DEF-006, DEF-007 y OBS-2, acepta OBS-3".

Criterios propuestos por la sesión principal y aceptados por el usuario:

- **DEF-006:** "N de M de <producto>" se trata como N órdenes de M cuando M coincide con la orden del catálogo. Si no coincide, el bot pregunta, como en R-6 (b). Nunca queda un número como detalle.
- **DEF-007:** el detalle conserva "2 tortillas" (o el texto completo que corresponda), no solo el número.
- **OBS-2:** el aviso de "escríbelo con comas" ya no propone la frase del cliente partida. Usa un ejemplo fijo del negocio (por ejemplo, "*2 tacos, 1 coca*") que sale del vocabulario o del contenido.
- **OBS-3:** se acepta como está.

#### Lista de correcciones de la ronda 2 para senior-fullstack

| Id | Qué se espera | Prueba que la verifica |
|---|---|---|
| DEF-006 | Molotes, con la orden de 3 del catálogo: "1 de 3 de tinga", 1 orden de Tinga; "una de 3 de queso", 1 orden de Queso; "2 de 3 de queso", 2 órdenes de Queso; "2 de queso 1 de 3 de tinga" (con o sin coma), 2 piezas de Queso y 1 orden de Tinga. "1 de 5 de tinga" (M distinta de la orden), una pregunta (R-6 b), sin agregar nada de esa línea. Nunca queda un número como detalle. | `it.fails.each` "DEF-006: \"%s\" no cambia la cantidad ni deja un número como detalle" (3 casos, en el bloque "QA REQ-F-013: defectos abiertos (ronda 2)" de `tests/unit/whatsapp-bot-qa-req-f-013.test.ts`). Se deben pasar a `it.each` y pasar. Conviene añadir aserciones positivas: la orden de 3 y el caso de M distinta. |
| DEF-007 | "3 tacos de 2 tortillas": 3 × Taco de Birria con Tortilla de Mano, con un detalle que conserve el texto ("de 2 tortillas" o "2 tortillas"), no "· 2". | Prueba nueva, de senior-fullstack o de QA en la ronda 3 |
| OBS-2 | Para "quiero 2 tacos a las 3", "2 tacos para 3 personas", "mesa 5: 2 de queso", "1 coca 2 litros" o "2 tacos 1 cocacolota", el aviso de reescribir con comas usa un ejemplo fijo del negocio, sacado del vocabulario o del contenido (como "*2 tacos, 1 coca*"), y no la frase del cliente partida. No se agrega nada de ese segmento y no se pierde nada, como en el criterio de DEF-002. | Hay que actualizar la aserción con el texto exacto de la prueba de limitaciones ("2 tacos 1 cocacolota"), que hoy espera el ejemplo partido "*2 tacos, 1 cocacolota*", y la equivalente de `tests/unit/whatsapp-bot-interpreter.test.ts` o `whatsapp-bot-free-text.test.ts` si existe. Las pruebas DEF-002 de "no se puede separar" (que buscan `No pude separar "<texto>"`) se mantienen. |
| OBS-3 | Se acepta sin cambios. | — |

Al terminar, `npm test` debe tener solo el fallo esperado de REQ-F-011, y `typecheck` y `lint` deben terminar en 0.

#### Resultado de la ronda 2

QA_REJECTED

Por decisión del usuario se corrigen DEF-006, DEF-007 y OBS-2. DEF-001 a DEF-005 y OBS-1 quedaron verificados en esta ronda. CA-1 a CA-18 siguen en PASS (CA-18 en local).

### Ronda 3 (revalidación, 2026-10-09)

Correcciones de la ronda 2 aprobadas por el usuario: "apruebo las correcciones".

#### Pruebas ejecutadas

| Comando o acción | Resultado |
|---|---|
| `npm run typecheck` y `npm run lint` | Código 0, sin avisos (también con las pruebas de QA de la ronda 3) |
| `npm test`, al empezar | Código 0: 1344 pasan y 1 fallo esperado (REQ-F-011) |
| `npm test`, con las pruebas de QA de la ronda 3 | Código 0: 1344 pasan y 6 fallos esperados (REQ-F-011 y 5 `it.fails` de DEF-008 y DEF-009) |
| `docker compose run --rm --build test` | Código 0: 1339 pasan, 1 fallo esperado y 5 omitidas, ya existentes (antes de añadir los `it.fails` de la ronda 3) |
| Pruebas del bot con `TZ=UTC` y con `TZ=Asia/Tokyo` | 494 pasan en las dos zonas |
| CA-1 a CA-4 y el log con centinelas, con Meta y con Twilio (`chat-bot-message-count` y `whatsapp-bot-qa-req-f-013`, de integración) | 18 de 18 pasan |
| DT-1: barrido con emojis | 0 de 360 combinaciones con sustitutos sueltos. El peor caso mide 1020 caracteres; con emojis en todo, 780 puntos de código. Se conservan las 15 cantidades y el total. |
| `npm run bot:chat` con Meta y con Twilio | Código 0. "1 de 3 de tinga 2 de queso zqxdet", domicilio, nota y "sí por favor". El aviso lleva "1 × Tinga (orden de 3)" y "2 × Queso (orden de 3) · zqxdet" (herencia de D-3). |
| Baterías exploratoria y adversa de las rondas 1 y 2, repetidas completas | Sin regresiones: todas dan el mismo resultado que en la ronda 2, con las correcciones aplicadas |
| Variantes de "N de M": unas 40 frases nuevas | Resultados abajo |

**Revisión de los cambios en mis pruebas:**

- **DEF-006:** el `it.each` conserva mi aserción (ninguna línea con 3 unidades ni un número como detalle) y añade la aserción positiva con las líneas exactas. La prueba "1 de 5 de tinga" exige la pregunta y que no se agregue nada. Más fuerte que antes.
- **Ejemplo partido (archivo de QA):** exige el texto completo con "*2 tacos, 1 coca*" y que no aparezca "*2 tacos, 1 cocacolota*". Más fuerte.
- **Ejemplo partido (`whatsapp-bot-interpreter.test.ts`):** ahora comprueba la razón `unseparated` en lugar del texto. El ejemplo fijo lo comprueban de punta a punta las 5 pruebas de OBS-2 de `whatsapp-bot-free-text.test.ts`, con el texto exacto y el carrito vacío. No se pierde cobertura.
- **"3 tacos con 2 tortillas":** quitar esa prueba es correcto, porque es OBS-3, aceptada.

#### Correcciones de la ronda 2

| Id | Resultado | Evidencia |
|---|---|---|
| DEF-006 | Corregido para los productos con orden | "1 de 3 de tinga", "una de 3 de queso", "dos de tres de queso", "una de tres de papa", "2 de 3 de queso", "3 de 3 de queso" y "un par de 3 de tinga" dan N órdenes de 3. "2 de queso 1 de 3 de tinga" (con y sin coma) da 2 piezas y 1 orden. "1 de 5 de tinga" y "1 de 2 de tinga" preguntan. "21 de 3 de queso" se rechaza (D-12). "1 de 3 de tinga, 2 de queso" da 2 órdenes de Queso (herencia de D-3, como dice el requisito). Ver DEF-008 para los productos sin orden. |
| DEF-007 | Corregido | "3 tacos de 2 tortillas" da "· 2 tortillas"; "2 quesabirrias de 2 quesos", "· 2 quesos"; "2 de queso de 2 colores", "· 2 colores". Ver DEF-009 para "de N piezas". |
| OBS-2 | Corregido | El aviso de reescribir con comas usa siempre el ejemplo fijo: "*2 tacos, 1 coca*" en Birria y "*2 de queso, 1 coca*" en Molotes. De ese segmento no se agrega nada. |

#### Defectos nuevos

### DEF-008
- **Severidad:** MAJOR (escala aprobada: descartar texto sin decirlo y agregar una cantidad distinta de lo que se pudo querer, sin preguntar). Es una corrección incompleta de DEF-006: el criterio aceptado dice "si no coincide, el bot pregunta, como en R-6 (b)".
- **Criterio afectado:** RN-13, RF-1.5 y el criterio aceptado de DEF-006.
- **Descripción:** con un producto sin orden en el catálogo (tacos, quesabirrias, consomés, bebidas), "N de M de <producto>" o "N orden de M de <producto>" agrega N unidades y descarta "de M" en silencio.
- **Pasos para reproducir:**
  - Birria: "1 orden de 3 de tacos", "una de 3 de tacos", "2 de 3 de quesabirria" y "1 de 2 de consome grande";
  - Molotes: "1 de 3 de coca", "1 orden de 3 de coca", "una de 3 de refresco" y "1 de 3 de agua de jamaica".
- **Resultado esperado:** una pregunta (como en R-6 b, porque M no es la orden de ese producto), o un aviso de lo que no se entendió. Nunca descartar "de M".
- **Resultado actual:** "1 × Taco de Birria con Tortilla de Mano", "2 × Quesabirria", "1 × Tazón de Consomé Grande", "1 × Refrescos · Coca-Cola", sin pregunta ni aviso.
- **Evidencia:** `it.fails.each` "DEF-008" (3 casos) en `tests/unit/whatsapp-bot-qa-req-f-013.test.ts`.
- **Impacto:** en Birria, "una orden de 3 tacos" es una forma natural de pedir. El cliente recibe 1 taco ($40) en lugar de 3 ($120). Se ve en el carrito y en el resumen.
- **Recomendación:** aplicar a los productos sin orden la misma regla que a los que la tienen cuando M no coincide (preguntar), o informar el fragmento.

### DEF-009
- **Severidad:** MINOR.
- **Criterio afectado:** el criterio aceptado de DEF-007 ("nunca queda un número como detalle").
- **Descripción:** "de N piezas" deja solo el número como detalle, porque "piezas" se consume como presentación.
- **Pasos para reproducir:** "2 tacos de 3 piezas" da "2 × Taco … · 3"; "2 de queso de 3 piezas" da "2 × Queso (pieza) · 3".
- **Resultado esperado:** el detalle conserva el texto ("de 3 piezas" o "3 piezas"), o el bot pregunta.
- **Evidencia:** `it.fails.each` "DEF-009" (2 casos).
- **Impacto:** el personal recibe un detalle que no se entiende. El producto, la cantidad y el precio son correctos.
- **Recomendación:** que "pieza" y "piezas" después de un número que no es la cantidad no se consuman como presentación.

#### Observaciones de la ronda 3 (no son defectos)

- **OBS-4.** "una orden de tacos" (sin número) y "1 orden de tacos 2 quesabirrias" agregan 1 taco: la palabra "orden" no tiene efecto en un producto sin orden. Ya ocurría en la ronda 2 y entonces lo di por bueno. Es razonable, pero en Birria "una orden de tacos" suele significar varios tacos. Conviene revisarlo junto con DEF-008.
- **OBS-5.** "media docena de 3 de queso" agrega 6 órdenes de 3 ($780). Es una lectura literal y válida de una frase rara, pero el cliente podría haber querido 6 molotes.
- OBS-3 (aceptada) y la observación del producto con " y " en el nombre siguen igual.

#### Regresión, responsive, accesibilidad, UX/UI, SEO y rendimiento

- **Regresión:** la suite completa pasa en local y en Docker, con los dos proveedores. Las baterías de las rondas 1 y 2 no cambian. El diff sigue sin tocar `public/`, las vistas, los estilos, `package.json` ni `.env.example`.
- **Responsive, accesibilidad y SEO:** no aplican.
- **Rendimiento:** sin cambios (la suite tarda unos 16 s).

#### Pendientes de revisión manual

- CI del PR (T4). No bloquea.
- CA-26 de REQ-F-009 (límite real de la plantilla de Meta).

#### Decisión del usuario sobre la ronda 3 (2026-10-09)

Cita textual: "corrige DEF-008 con A y B como recomiendas, DEF-009 y que 'una orden de tacos' pregunte; después de esta ronda, lo menor se acepta".

Criterios aceptados:

- **DEF-008**, para los productos que no tienen la presentación "orden" en el catálogo:
  - **A.** Con la palabra "orden" u "órdenes" explícita, "N orden(es) de M <producto>" agrega N×M unidades, que se ven en el carrito. "1 orden de 3 de tacos" agrega 3 tacos y "2 órdenes de 3 tacos", 6. Se aplican los límites de D-12: si N×M es mayor que 20, la línea se rechaza con el mensaje de D-12.
  - **B.** Sin la palabra "orden" ("2 de 3 de quesabirria", "1 de 3 de coca"), el bot pregunta y no agrega esa línea.
  - Nunca se descarta "de M" sin avisar.
- **DEF-009:** "2 tacos de 3 piezas" no deja un número suelto como detalle.
- **OBS-4:** "una orden de tacos", sin número, en un producto sin orden, pregunta cuántos.
- **Criterio de cierre para la próxima revalidación**, decidido por el usuario ("después de esta ronda, lo menor se acepta"): los hallazgos nuevos MINOR, TRIVIAL u observaciones se aceptan y se registran como pendientes, sin bloquear. Solo un defecto MAJOR o peor, o una corrección que falle, vuelve a requerir decisión.

#### Lista de correcciones de la ronda 3 para senior-fullstack

| Id | Qué se espera | Prueba que la verifica |
|---|---|---|
| DEF-008 A | Birria: "1 orden de 3 de tacos" agrega 3 × Taco; "2 órdenes de 3 tacos" agrega 6 × Taco; "1 orden de 3 de coca" (Molotes) agrega 3 × Refrescos. "3 órdenes de 7 tacos" (21) se rechaza con el mensaje de D-12. Sin "de 3" en el detalle. | `it.fails.each` "DEF-008" de `tests/unit/whatsapp-bot-qa-req-f-013.test.ts` (bloque "defectos abiertos (ronda 3)"), caso "1 orden de 3 de tacos": pasa a normal y se refuerza con las líneas exactas (`3 × Taco de Birria con Tortilla de Mano`). Hay que añadir los casos "2 órdenes de 3 tacos" y el rechazo de 21. |
| DEF-008 B | "una de 3 de tacos", "2 de 3 de quesabirria", "1 de 3 de coca", "1 de 2 de consome grande": una pregunta, sin agregar esa línea. | El mismo `it.fails.each`, casos "una de 3 de tacos" y "1 de 3 de coca": pasan a normales y se refuerzan con `added(reply)` vacío y la pregunta. |
| DEF-009 | "2 tacos de 3 piezas" y "2 de queso de 3 piezas": el detalle conserva el texto ("de 3 piezas" o "3 piezas") o el bot pregunta; nunca "· 3". | `it.fails.each` "DEF-009" (2 casos): pasan a normales. |
| OBS-4 | "una orden de tacos" (y "1 orden de tacos 2 quesabirrias" en lo que toca a los tacos): pregunta cuántos, sin agregar esa línea. Las demás líneas del mensaje se agregan. | Una prueba nueva, de senior-fullstack o de QA en la ronda 4 |

Todos los `it.fails` de `tests/unit/whatsapp-bot-qa-req-f-013.test.ts` (5 casos) deben pasar a `it.each` normales y pasar. `npm test` debe quedar solo con el fallo esperado de REQ-F-011, y `typecheck` y `lint` deben terminar en 0.

#### Resultado de la ronda 3

QA_REJECTED

Por decisión del usuario se corrigen DEF-008 (A y B), DEF-009 y OBS-4. DEF-006 (en los productos con orden), DEF-007 y OBS-2 quedaron verificados en esta ronda. CA-1 a CA-18 siguen en PASS (CA-18 en local).

### Ronda 4 (revalidación, 2026-10-09)

Correcciones de la ronda 3 aprobadas por el usuario: "Apruebo las correcciones". Se aplica el criterio de cierre que decidió el usuario en la ronda 3 ("después de esta ronda, lo menor se acepta").

#### Pruebas ejecutadas

| Comando o acción | Resultado |
|---|---|
| `npm run typecheck` y `npm run lint` | Código 0, sin avisos (también con las pruebas de QA de la ronda 4) |
| `npm test`, al empezar | Código 0: 1360 pasan y 1 fallo esperado (REQ-F-011) |
| `npm test`, con las pruebas de QA de la ronda 4 | Código 0: 67 archivos, 1367 pasan y 1 fallo esperado (REQ-F-011). No queda ningún `it.fails` de QA. |
| `docker compose run --rm --build test` | Código 0: 1355 pasan, 1 fallo esperado y 5 omitidas, ya existentes (antes de añadir las 7 pruebas de la ronda 4) |
| Pruebas del bot con `TZ=UTC` y con `TZ=Asia/Tokyo` | 510 pasan en las dos zonas |
| CA-1 a CA-4 y el log con centinelas, con Meta y con Twilio | 18 de 18 pasan |
| DT-1: barrido con emojis | 0 de 360 combinaciones con sustitutos sueltos. El peor caso mide 1020 caracteres (780 puntos de código con emojis en todo). Se conservan las 15 cantidades y el total. |
| `npm run bot:chat` con Meta y con Twilio | Código 0. "1 orden de 3 de tacos zqxdet 2 quesabirrias", domicilio, nota y "sí por favor". El aviso lleva "3 × Taco … · zqxdet a $40 = $120" y "2 × Quesabirria … = $130". |
| Baterías de las rondas 1 a 3, repetidas completas y comparadas con la ronda 3 | Solo cambian los casos corregidos a propósito (DEF-008, DEF-009 y OBS-4). Sin regresiones. |
| Batería de "orden" y "N de M", en productos con orden y sin ella, con los límites de D-12 | Unas 50 frases. Resultados abajo. |

**Revisión de los cambios en mis pruebas:**

- Los `it.fails.each` de DEF-008 y DEF-009 pasaron a `it.each` y conservan su aserción.
- Los refuerzos exigen las líneas exactas (A), el rechazo de 21, la pregunta sin agregar nada (B) y el detalle exacto "3 piezas".
- Nada se debilitó.

#### Correcciones de la ronda 3

| Id | Resultado | Evidencia |
|---|---|---|
| DEF-008 A | Corregido | "1 orden de 3 de tacos" agrega 3; "una orden de 3 tacos", 3; "orden de 3 tacos", 3; "2 órdenes de 3 tacos", 6; "1 orden de 20 tacos", 20; "1 orden de 3 de coca", 3 Refrescos; "1 orden de 3 tacos sin cebolla", 3 con el detalle; "una orden de 3 de consome chico con carne", 3; "1 orden de 2 de birriamen grande", 2. "3 órdenes de 7 tacos" (21) y "1 orden de 0 tacos" se rechazan con el mensaje de D-12. Con productos que tienen orden, no cambia nada: "1 orden de 3 de tinga" da 1 orden y "1 orden de 5 de tinga" pregunta. |
| DEF-008 B | Corregido | "una de 3 de tacos", "2 de 3 de quesabirria", "1 de 2 de consome grande" y "1 de 3 de coca" dan `No entendí cuántos quieres en "…"` y no agregan nada. "1 de 3 de tinga" sigue dando 1 orden (DEF-006). |
| DEF-009 | Corregido | "2 tacos de 3 piezas" da "· 3 piezas", igual que "2 de queso de 3 piezas". |
| OBS-4 | Corregido | "una orden de tacos", "una orden de coca" y "1 orden de coca" piden la cantidad. "una orden de tacos y 2 quesabirrias", "1 orden de tacos 2 quesabirrias", "2 quesabirrias 1 orden de tacos", "una orden de tacos 1 coca", "2 tacos 1 orden de tacos" y "una orden de queso 1 orden de coca" agregan el resto y piden la cantidad de esa línea. |

**Cambio de comportamiento (una línea que pide la cantidad ya no impide separar el resto), con casos adversos:**

- "2 tacos 1 orden de tacos 3 quesabirrias", "una de 3 de tacos 1 de 2 de quesabirria 1 coca", "3 tacos x2 1 coca" y "1 orden de coca 1 de 3 de queso 1 jamaica" agregan solo lo claro y piden la cantidad de cada línea dudosa, citándola.
- Si una parte no se entiende ("una orden de tacos 2 quesabirrias 1 cocacolota", "una orden de tacos para 3 personas", "una orden de tacos 3"), no se agrega nada y el bot pide comas con el ejemplo fijo.
- "1 orden de 3 tacos 21 quesabirrias" agrega 3 tacos y rechaza las 21 con el mensaje de D-12.
- Nunca se pierde una parte, nunca cambia una cantidad y nunca queda un número solo como detalle. Fijado con 7 pruebas nuevas en `tests/unit/whatsapp-bot-qa-req-f-013.test.ts` (bloque "ronda 4").

#### Defectos nuevos

Ninguno.

#### Observaciones de la ronda 4 (aceptadas como pendientes según el criterio de cierre)

- **OBS-6.** En "una orden de tacos, sin cebolla", la línea de tacos pide la cantidad y "sin cebolla" sale como "No entendí", porque la línea anterior no se agregó. Se informa todo y no se pierde nada. Basta con que el cliente reescriba la línea.
- Siguen registradas: OBS-3 (aceptada), OBS-5 ("media docena de 3 de queso") y la del producto con " y " en el nombre.

#### Regresión, responsive, accesibilidad, UX/UI, SEO y rendimiento

- **Regresión:** la suite completa pasa en local y en Docker, con los dos proveedores. Las baterías anteriores no cambian salvo en los casos corregidos. El diff sigue sin tocar `public/`, las vistas, los estilos, `package.json` ni `.env.example`.
- **Responsive, accesibilidad y SEO:** no aplican.
- **Rendimiento:** sin cambios (la suite tarda unos 16 s).

#### Pendientes

- CI del PR (T4). No bloquea, por la decisión 4 de la ronda 1.
- CA-26 de REQ-F-009 (límite real de la plantilla de Meta, y si cuenta en UTF-16).
- Observaciones aceptadas: OBS-3, OBS-5, OBS-6 y la del producto con " y ".

#### Resultado de la ronda 4

QA_APPROVED

- CA-1 a CA-18 en PASS (CA-18 en local; el CI queda para T4).
- DEF-001 a DEF-009, OBS-1, OBS-2 y OBS-4 corregidos y verificados.
- Sin defectos abiertos.
- `npm test`, typecheck, lint y Docker en verde.
- Ningún texto del cliente en el log, con los dos proveedores.

## Historial de cambios

### Versión 1

Análisis inicial, con las preguntas 1 a 13 y la medición del flujo actual.

### Versión 2 (aprobada el 2026-10-08)

- Incorpora la respuesta "todas las recomendadas":
  - D-1 a D-12;
  - el cierre de X-1 a X-9;
  - los requisitos que faltaban, como propuestas aprobadas.
- Añade las nueve precisiones marcadas **[precisión v2]**:
  - RF-1.6 y RF-1.9;
  - RF-3.3;
  - RF-4.2;
  - RF-5.6;
  - RF-6.2 y RF-6.5;
  - RF-7.1 y RF-7.3;
  - RF-8.2.
- Aprobación del usuario: "apruebo REQ-F-013 v2".

### Revisión técnica (2026-10-08, senior-fullstack)

- Revisión técnica (R-1 a R-6), con las tarifas vigentes de Meta y Twilio. Desde el 01-10-2026, Meta cobra los mensajes de servicio pasado el cupo de 1000 al mes.
- Technical Action Plan añadido, con DT-1 (presupuesto de la plantilla).
- Estado: `NEEDS_TECHNICAL_PLAN_APPROVAL`.

### Implementación (2026-10-08, senior-fullstack)

- Plan técnico aprobado por el usuario ("Apruebo el plan técnico"), con DT-1 y las precisiones (a) a (d) de R-6.
- Implementación en `feature/REQ-F-013-bot-pedidos-texto-libre-menos-turnos` y "Implementation Result" añadido.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, fase Q1 (2026-10-08, senior-qa)

- Implementación aprobada por el usuario ("apruebo la implementación y actualiza el agente").
- QA Action Plan añadido, sin ejecutar pruebas todavía.
- Estado: `NEEDS_QA_PLAN_APPROVAL`.

### Precisión de "sí por favor" (2026-10-08, senior-fullstack)

- Precisión aprobada por el usuario antes de la QA: "Apruebo el plan de QA, sí a 2, 3 y 4, y corrige el sí por favor".
- Ahora un mensaje del resumen confirma si, sin relleno ni cortesía, solo queda una palabra de confirmación (RF-6.3).
- Pruebas añadidas en `tests/unit/whatsapp-bot-free-text.test.ts`. `typecheck`, `lint` y `npm test` en verde.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, aprobaciones antes de la fase Q2 (2026-10-09, senior-qa)

- QA Action Plan aprobado por el usuario: "Apruebo el plan de QA, sí a 2, 3 y 4, y corrige el sí por favor".
  - Pregunta 1: se aprueba el plan, con las 2 pruebas nuevas.
  - Pregunta 2: se acepta la escala de severidad de la batería exploratoria.
  - Pregunta 3: se aceptan como limitaciones "2 tacos 1 coca" (si acaba en una pregunta) y ", bien doraditos" (si se informa como no entendido).
  - Pregunta 4: CA-18 se da por aprobado con la validación local, y el CI queda como pendiente que no bloquea.
  - Pregunta 5: se corrige "sí por favor" en lugar de registrarlo como observación.
- La corrección de "sí por favor" (RF-6.3, `withoutCourtesy`) la aprobó el usuario con un "Si". La QA la incluye, con casos adversos.
- Comienza la fase Q2 (ronda 1).

### QA, fase Q2, ronda 1 (2026-10-09, senior-qa)

- Plan ejecutado y QA Report añadido.
- Pruebas nuevas:
  - `tests/unit/whatsapp-bot-qa-req-f-013.test.ts`;
  - `tests/integration/whatsapp-bot-qa-req-f-013.test.ts`.
- Resultado:
  - CA-1 a CA-18 en PASS (CA-18 en local);
  - defectos MAJOR: DEF-001, DEF-002 y DEF-003;
  - DEF-004 es MINOR y DEF-005, TRIVIAL.
- Estado: `NEEDS_USER_DECISION`.

### QA, decisión sobre la ronda 1 (2026-10-09, senior-qa)

- Decisión del usuario: "corrige todo, incluida la ayuda tras el nombre".
- Se corrigen DEF-001 a DEF-005 y OBS-1 (la ayuda tras el nombre). DEF-002 se corrige con el criterio aceptado (preguntar por el mensaje completo o pedir que se reescriba con coma).
- La observación del producto con " y " en el nombre queda registrada, sin corrección.
- Estado: `QA_REJECTED`.

### Correcciones de QA, ronda 1 (2026-10-09, senior-fullstack)

- Se corrigieron DEF-001 a DEF-005 y OBS-1 por decisión del usuario ("corrige todo, incluida la ayuda tras el nombre").
- Las pruebas `it.fails` de QA pasaron a pruebas normales y pasan.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, fase Q2, ronda 2 (2026-10-09, senior-qa)

- Correcciones aprobadas por el usuario: "apruebo las correcciones". Incluyen el criterio ajustado de DEF-002.
- DEF-001 a DEF-005 y OBS-1, corregidos y verificados.
- Pruebas de QA reforzadas (DEF-002 y DEF-003) y nuevos `it.fails` para DEF-006.
- Defectos nuevos: DEF-006 (MAJOR) y DEF-007 (MINOR). Observaciones OBS-2 y OBS-3.
- Estado: `NEEDS_USER_DECISION`.

### QA, decisión sobre la ronda 2 (2026-10-09, senior-qa)

- Decisión del usuario: "corrige DEF-006, DEF-007 y OBS-2, acepta OBS-3".
- Criterios aceptados: DEF-006 se trata como N órdenes de M si M coincide con la orden (si no, una pregunta); DEF-007 conserva el texto del detalle; OBS-2 usa un ejemplo fijo del negocio en el aviso de comas.
- OBS-3 aceptada.
- Estado: `QA_REJECTED`.

### Correcciones de QA, ronda 2 (2026-10-09, senior-fullstack)

- Se corrigieron DEF-006, DEF-007 y OBS-2; OBS-3 se acepta sin cambios, por decisión del usuario ("corrige DEF-006, DEF-007 y OBS-2, acepta OBS-3").
- El `it.fails.each` de DEF-006 pasó a `it.each`, con aserciones positivas.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, fase Q2, ronda 3 (2026-10-09, senior-qa)

- Correcciones de la ronda 2 aprobadas por el usuario: "apruebo las correcciones".
- DEF-006 (en los productos con orden), DEF-007 y OBS-2, corregidos y verificados. Los cambios de senior-fullstack en las pruebas de QA no las debilitan.
- Defectos nuevos: DEF-008 (MAJOR, DEF-006 incompleto en los productos sin orden) y DEF-009 (MINOR), fijados con `it.fails`. Observaciones OBS-4 y OBS-5.
- Estado: `NEEDS_USER_DECISION`.

### QA, decisión sobre la ronda 3 (2026-10-09, senior-qa)

- Decisión del usuario: "corrige DEF-008 con A y B como recomiendas, DEF-009 y que 'una orden de tacos' pregunte; después de esta ronda, lo menor se acepta".
- Se corrigen DEF-008 (A: N×M con "orden" explícita y los límites de D-12; B: una pregunta sin "orden"), DEF-009 y OBS-4 (una pregunta).
- Criterio de cierre decidido por el usuario para la próxima revalidación: lo MINOR, lo TRIVIAL y las observaciones nuevas se aceptan como pendientes; solo un defecto MAJOR o peor, o una corrección que falle, requiere decisión.
- Estado: `QA_REJECTED`.

### Correcciones de QA, ronda 3 (2026-10-09, senior-fullstack)

- Se corrigieron DEF-008 (A y B), DEF-009 y OBS-4 por decisión del usuario ("corrige DEF-008 con A y B como recomiendas, DEF-009 y que 'una orden de tacos' pregunte; después de esta ronda, lo menor se acepta").
- Los `it.fails.each` de la ronda 3 pasaron a `it.each`, con refuerzos.
- Estado: `NEEDS_IMPLEMENTATION_APPROVAL`.

### QA, fase Q2, ronda 4 (2026-10-09, senior-qa)

- Correcciones de la ronda 3 aprobadas por el usuario: "Apruebo las correcciones".
- DEF-008 (A y B), DEF-009 y OBS-4, corregidos y verificados, también con casos adversos del cambio de separación.
- Sin regresiones en las baterías anteriores.
- 7 pruebas de QA nuevas. No queda ningún `it.fails` de QA.
- Sin defectos nuevos. OBS-6 se acepta como pendiente, según el criterio de cierre del usuario.
- Estado: `QA_APPROVED`.

### Commit y Pull Request (2026-10-09, senior-fullstack)

- QA_APPROVED en la ronda 4.
- Antes del commit se volvieron a ejecutar las validaciones:
  - `npm run typecheck`: código 0;
  - `npm run lint`: código 0;
  - `npm test`: código 0; 1367 pasan y 1 fallo esperado (REQ-F-011).
- Commit `194a778` ("feat: permite pedir por WhatsApp en texto libre con menos mensajes") en `feature/REQ-F-013-bot-pedidos-texto-libre-menos-turnos`. Incluye:
  - la implementación y sus correcciones;
  - el ticket;
  - las pruebas de QA;
  - la línea de `.claude/agents/senior-fullstack.md` sobre el intérprete, autorizada por el usuario.
- Pull Request: https://github.com/orvigas/negocio/pull/35, contra `main`.
- CI del PR (run 37949999642): `calidad` pass (3m2s), `docker` pass (1m46s) y GitGuardian pass.
- Estado: `READY_FOR_MERGE`.

### Cierre T5

2026-10-09, `senior-fullstack`. El usuario confirma el merge del PR #35. Cita textual: "PR Fusionado".

- **Merge:** el 2026-10-09T15:32:43Z (09:32 del 2026-10-09, hora de Ciudad de México), con el commit `b0da83f`.
- **CI del push a `main`:** `b0da83f` en verde: https://github.com/orvigas/negocio/actions/runs/37952536480.
- **Siguen pendientes, sin bloquear el cierre:**
  - CA-26 de REQ-F-009: la prueba con Meta real (límite de la plantilla);
  - las observaciones aceptadas OBS-3, OBS-5, OBS-6 y la del producto con " y " en el nombre.

El ticket pasa de `in-progress/` a `done/`. Se borra la rama `feature/REQ-F-013-bot-pedidos-texto-libre-menos-turnos`, local y remota. El usuario tiene autorizado borrar las ramas de feature ya mergeadas.

Estado: `DONE`.
