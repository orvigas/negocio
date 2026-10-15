/**
 * Textos del flujo del bot de WhatsApp compartidos por los dos negocios (REQ-F-009, RF-4;
 * REQ-F-013). Marcadores entre llaves (`{negocio}`) que sustituye
 * src/services/whatsapp-bot/messages.ts. El cliente escribe su pedido con sus palabras y los
 * números de opción siguen funcionando (REQ-F-013, D-1); las palabras clave funcionan en cualquier
 * paso como mensaje completo (D-10).
 *
 * Emojis: acompañan a la palabra y nunca la sustituyen, como mucho dos por línea. El intérprete los
 * ignora (separan palabras), así que un cliente que copie un texto del bot se entiende igual. No van
 * en los textos que llegan a los parámetros de la plantilla de Meta (`pickup`, `delivery`,
 * `staffHours`, `staffOffHours`, `noNotes`): su texto lo fija la plantilla aprobada.
 *
 * Formato (REQ-F-029): renglones estructurados de hasta 28 de ancho visible, un renglón en blanco
 * entre párrafos y el contacto o la URL solos en su renglón. Las claves de la plantilla y
 * `staffNotice` no se reacomodan: lo que recibe el personal no cambia.
 */
export const botText = Object.freeze({
  greeting: '¡Hola! 👋 Te atiende el asistente de *{negocio}*.\n\n{lema}',
  openNow: '🕒 Estamos abiertos hasta las {cierre}.',
  closedNow: '🌙 En este momento estamos cerrados.\nAbrimos {apertura}.\n\nPuedes ver el menú y dejar tu pedido: lo atenderemos cuando abramos.',
  /** Fuera de horario y sin pedidos (D-16): el negocio no abre hoy ni mañana. */
  closedNoOrders: '🌙 En este momento estamos cerrados.\nAbrimos {apertura}.\n\nPuedes ver el menú; los pedidos se reciben desde el día anterior a la apertura.',
  rootOptions: '*¿Qué deseas hacer?*\n*1.* 📋 Ver el menú\n*2.* 🛒 Hacer un pedido\n*3.* 🕒 Horario y ubicación\n*4.* 🙋 Hablar con una persona',
  /** W-1 (REQ-F-029). */
  keywordsHint: '💬 En cualquier momento,\nescribe:\n*menú* · *carrito* · *cancelar*\n*persona* · *ayuda*',
  /** W-2 (REQ-F-029): el ejemplo va en su propio renglón. */
  help: 'Puedes escribir tu pedido con tus palabras, por ejemplo:\n*{ejemplo}*\n\nTambién respondo a números de opción y a palabras clave.',
  notUnderstood: 'No entendí tu mensaje. 🤔',
  textOnly: 'Por ahora solo entiendo mensajes de texto.',
  hoursAndLocation: '🕒 *{negocio}* atiende {horario}.\n\n📍 *Ubicación:*\n{mapa}',
  otherBusiness: '*{otro}* atiende {horarioOtro}.\n\nHoy te atiende *{negocio}*.',
  menuTitle: '📋 *Menú de {negocio}*',
  menuPrompt: 'Escríbeme tu pedido, por ejemplo:\n*{ejemplo}*\n\nTambién puedes escribir el número de un producto.',
  /** Invitación del saludo (REQ-F-013, RF-4.1). */
  orderInvite: 'O escríbeme tu pedido, por ejemplo:\n*{ejemplo}*',
  menuEmpty: 'Por ahora no tenemos productos disponibles.\n\nEscribe *persona* para hablar con alguien de {negocio}.',
  ordersClosed:
    '🌙 Por ahora *{negocio}* no está tomando pedidos: abre {apertura}.\n\n*{otro}* abre {aperturaOtro}.\n\nPuedes ver el menú (escribe *menú*) o hablar con una persona (escribe *persona*).',
  chooseOption: '¿Cuál opción de *{producto}*?\n{opciones}',
  askQuantity: '¿Cuántas de *{producto}*?\nEscribe un número del 1 al {max}.',
  invalidNumber: 'Escribe solo el número de una de las opciones.',
  invalidQuantity: 'La cantidad debe ser un número entero del 1 al {max}.',
  lineTooLarge: 'Con esa cantidad tendrías más de {max} de *{producto}*. Elige una cantidad menor.',
  tooManyLines: 'Tu pedido ya tiene {max} productos distintos, el máximo. Quita uno antes de agregar otro.',
  added: '✅ Agregado:\n{lineas}',
  notAdded: 'No agregué:\n{lineas}',
  notUnderstoodFragment: '- No entendí: "{fragmento}".',
  unavailableLine: '- {producto}: no está disponible por ahora.',
  outOfRangeLine: '- "{fragmento}": la cantidad debe ser un número entero del 1 al {max}.',
  overflowLine: '- {cantidad} producto(s) más: entiendo hasta {max} por mensaje.',
  otherBusinessLine: '- "{fragmento}": es de *{otro}*.',
  /** DEF-002: varias cantidades y productos sin separador que no se pudieron separar con seguridad. */
  unseparatedLine: '- No pude separar "{fragmento}". Escríbelo separado con comas, por ejemplo: *{ejemplo}*.',
  /** DEF-003: una cantidad y un multiplicador a la vez ("3 tacos x2"). */
  unclearLine: '- No entendí cuántos quieres en "{fragmento}". Escribe una sola cantidad por producto, por ejemplo: *{ejemplo}*.',
  limitLine: '- {motivo}',
  moreHint: 'Puedes escribir más productos o *quita <producto>*.',
  /** DEF-005: los datos escritos antes del aviso de privacidad no se toman (X-5); se piden después. */
  dataLater: 'Tus datos de entrega te los pido al final, cuando termines tu pedido.',
  /** OBS-1: ayuda en el carrito cuando el cliente solo escribe su nombre. */
  dataHint: 'Si es tu nombre, escribe también si es para *recoger* o *a domicilio* (con tu dirección), por ejemplo: *Ana, recoger*.',
  /** Petición de los datos con el aviso de privacidad (REQ-F-013, RF-5.1; D-17 de REQ-F-009). */
  askData:
    'Si es todo, envíame:\n- tu nombre\n- 🏪 *recoger* o\n  🛵 *a domicilio*\n  (con tu dirección)\n\nPor ejemplo:\n*Ana, recoger*\n*Ana, domicilio, Calle 5 #10, Centro*',
  /** Una sola pregunta para todas las líneas ambiguas (REQ-F-013, RF-3.2). */
  clarifyTitle: 'Necesito que me aclares:',
  clarifyBlock: '*{numero}) {fragmento}*\n{opciones}',
  clarifyHint: 'Responde con los números en orden (por ejemplo: *{ejemplo}*) o con los nombres.',
  clarifyDiscarded: 'Dejé sin agregar lo que te había preguntado y tomé tu nuevo mensaje.',
  /** W-4 (REQ-F-029). */
  dataOrProducts: 'Tu mensaje trae productos y datos de entrega.\n¿Qué hago?\n*1.* Agregar los productos\n*2.* Son mis datos de entrega',
  removeNotFound: 'No encontré "{texto}" en tu carrito.',
  cartTitle: '🛒 *Tu pedido*',
  cartEmpty: '🛒 Tu carrito está vacío.',
  cartOptions: '*1.* Agregar otro producto\n*2.* Quitar un producto\n*3.* Vaciar el carrito\n*4.* Terminar mi pedido',
  removePrompt: '¿Qué producto quitas?\nEscribe su número.\n\n{lineas}',
  removeWhich: '¿Cuál quitas?\nEscribe su número.\n\n{lineas}',
  removed: 'Quitado: {producto}.',
  emptied: '🧹 Listo, vacié tu carrito.',
  privacy: '🔒 Para preparar y entregar tu pedido necesito tu nombre y, si es a domicilio, tu dirección. Solo se usan para este pedido y no se guardan.',
  askName: '¿A nombre de quién es el pedido?',
  invalidName: 'El nombre debe tener entre 1 y {max} caracteres.',
  askDelivery: '¿Cómo lo quieres?\n*1.* 🏪 Recoger en sucursal\n*2.* 🛵 A domicilio',
  askAddress: '¿Cuál es la dirección de entrega?\n(calle, número, colonia y referencias)',
  invalidAddress: 'La dirección debe tener entre {min} y {max} caracteres.',
  invalidNotes: 'Las notas pueden tener hasta {max} caracteres.',
  /** Íconos de la forma de entrega en el resumen del cliente (no van al aviso al personal). */
  deliveryIcons: Object.freeze({ pickup: '🏪', delivery: '🛵' }),
  pickup: 'Recoger en sucursal',
  delivery: 'A domicilio: {direccion}',
  /** Forma de entrega a domicilio en el resumen del cliente; la dirección va en el renglón siguiente (REQ-F-029). */
  deliveryHome: 'A domicilio',
  /** Etiquetas de los datos del resumen del cliente (en negrita; REQ-F-029, RF-5). */
  summaryFields: Object.freeze({ delivery: 'Entrega:', name: 'Nombre:', notes: 'Notas:' }),
  /** Total del carrito y del resumen (en negrita). */
  total: 'Total: {total}',
  deliveryCost: 'El personal te confirmará el costo del envío.',
  noNotes: 'Sin notas',
  summaryTitle: '📝 *Resumen de tu pedido*\n*{codigo}* · {negocio}',
  /** W-5 (REQ-F-029). */
  offHours: '🌙 *FUERA DE HORARIO*\nTu pedido se atenderá cuando abramos, {apertura}.',
  /** Indicación del resumen (REQ-F-013, RF-6.1): confirmar, nota o cancelar. W-6 (REQ-F-029). */
  confirmPrompt: '✅ Escribe *sí* para confirmar.\nO escribe una nota para agregarla.\nEscribe *cancelar* para cancelar.',
  catalogChanged: 'Algunos productos cambiaron desde que los agregaste:',
  lineRemoved: '- {producto} ya no está disponible y lo quité.',
  linePriceChanged: '- {producto} cambió de precio: ahora {precio}.',
  cartNowEmpty: 'Tu carrito quedó vacío.',
  confirmed: '¡Listo! 🙌\nTu pedido *{codigo}* fue enviado a {negocio}.\n\nEl personal te escribirá para confirmarlo. 😋',
  staffFailed:
    'No pude enviar tu pedido *{codigo}* al personal de {negocio}.\n\nPor favor escríbeles directamente:\n{contacto}',
  /** REQ-F-025, RF-1.1: el número ya hizo el máximo de pedidos de hoy (al empezar). */
  orderLimitReached:
    'Por hoy ya recibimos el máximo de pedidos desde este número.\n\nSi quieres pedir algo más, escribe directamente al personal de *{negocio}*:\n{contacto}',
  /** REQ-F-025, RF-1.1 y RF-2.1: al confirmar, el aviso al personal no se envía por un tope. */
  orderCapContact:
    'Tu pedido *{codigo}* no se pudo enviar automáticamente al personal de {negocio}.\n\nPor favor escríbeles directamente con tu pedido:\n{contacto}',
  /** REQ-F-025, RF-1.2: tope diario de mensajes del número (se envía una sola vez). */
  dailyLimitReached:
    'Llegaste al límite de mensajes de hoy con el asistente.\n\nPara continuar, escribe directamente al personal de *{negocio}*:\n{contacto}',
  /** REQ-F-025, RF-2.1: modo contacto directo (tope global de avisos al personal). */
  directContactMode:
    'Por ahora no puedo tomar pedidos por este medio.\n\nEscribe directamente al personal de *{negocio}*:\n{contacto}',
  cancelled: 'Pedido cancelado.\n\nCuando quieras, escríbenos de nuevo. 👋',
  person: '🙋 Para hablar con una persona de *{negocio}*, escribe a:\n{contacto}',
  staffHours: 'En horario',
  staffOffHours: 'FUERA DE HORARIO, abre {apertura}',
  /**
   * Aviso al personal como texto libre (REQ-F-012, D-6: Twilio sin Content Template). Mismo
   * contenido que los parámetros de la plantilla de Meta (REQ-F-009 CA-14).
   */
  staffNotice:
    '🔔 *Nuevo pedido {codigo}* - {negocio}\n{horario}\nCliente: {cliente}\nWhatsApp: {whatsapp}\nEntrega: {entrega}\n{lineas}\nTotal: {total}\nNotas: {notas}',
  priceEach: 'c/u',
  piece: 'pieza',
  order: 'orden de {cantidad}',
});

/**
 * Palabras clave (D-10 y DT-12 de REQ-F-009): solo cuentan si son el mensaje completo, ya
 * normalizado (minúsculas, sin acentos ni signos). REQ-F-013, RF-10.2: más sinónimos de "persona".
 */
export const botKeywords = Object.freeze({
  menu: Object.freeze(['menu', 'ver menu', 'ver el menu']),
  cart: Object.freeze(['carrito', 'ver carrito', 'mi carrito', 'pedido', 'mi pedido']),
  cancel: Object.freeze(['cancelar', 'cancela', 'cancelar pedido']),
  person: Object.freeze(['persona', 'humano', 'hablar con una persona', 'asesor', 'hablar con alguien', 'quiero hablar con alguien', 'atencion', 'operador']),
  help: Object.freeze(['ayuda', 'help']),
});

/**
 * Vocabulario común del intérprete de pedidos (REQ-F-013, RF-10.2). Todo va normalizado
 * (minúsculas y sin acentos); las frases, con un espacio entre palabras. Una prueba lo verifica.
 */
export const botVocabulary = Object.freeze({
  /** Cantidades en palabra (RF-1.3). De "veintiuno" a "treinta" se reconocen para rechazarlas (D-12). */
  quantityWords: Object.freeze({
    cero: 0, un: 1, una: 1, uno: 1, unos: 1, unas: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
    veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  } as Readonly<Record<string, number>>),
  /** Frases de cantidad (se buscan antes que las palabras sueltas). */
  quantityPhrases: Object.freeze({ 'un par': 2, 'media docena': 6, 'una docena': 12, docena: 12 } as Readonly<Record<string, number>>),
  /** Relleno que se ignora (RF-1.4), incluidos los verbos de agregar. */
  filler: Object.freeze([
    'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buen dia', 'que tal', 'quiero', 'quisiera', 'queria', 'me das', 'me da', 'dame', 'deme', 'me regalas',
    'me puedes dar', 'me pones', 'ponme', 'por favor', 'porfa', 'porfavor', 'favor', 'gracias', 'muchas gracias', 'mil gracias', 'hacer', 'para', 'mas', 'tambien', 'agrega',
    'agregar', 'agregame', 'anade', 'anadir', 'otro', 'otra', 'otros', 'otras', 'solo', 'nada mas',
  ]),
  /** Palabras de enlace: no identifican productos ni forman un detalle por sí solas. */
  connectors: Object.freeze(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'a', 'al', 'y', 'e']),
  /** Intención de pedir (RF-4.2). */
  intent: Object.freeze(['pedido', 'pedir', 'ordenar', 'encargar']),
  /** Forma de entrega (RF-5.3). */
  pickup: Object.freeze(['recoger', 'paso', 'sucursal']),
  delivery: Object.freeze(['domicilio', 'envio', 'a casa']),
  /** Prefijos del nombre que se quitan ("soy Ana"). */
  namePrefixes: Object.freeze(['soy', 'me llamo', 'mi nombre es', 'a nombre de', 'nombre']),
  /** Confirmación del resumen, como mensaje completo (RF-6.3). */
  confirm: Object.freeze(['1', 'si', 'confirmar', 'confirmo', 'ok', 'va', 'dale', 'listo', 'correcto']),
  /** Fin del pedido en el carrito (RF-5.7). */
  finish: Object.freeze(['listo', 'es todo', 'terminar', 'seria todo', 'eso es todo']),
  /** Borrar la nota en el resumen (RF-6.2). */
  clearNotes: Object.freeze(['sin notas', 'sin nota', '0']),
  /** Quitar por nombre, al principio del mensaje (RF-7.1, X-3). */
  remove: Object.freeze(['quita', 'quitar', 'quitame', 'elimina', 'eliminar', 'cancela', 'borra', 'sin el', 'sin la', 'sin los', 'sin las']),
  /** Editar desde el resumen agregando (RF-7.3). */
  add: Object.freeze(['agrega', 'agregar', 'agregame', 'anade', 'anadir', 'tambien']),
  /** Presentaciones de Molotes (RF-1.3; D-3). */
  presentations: Object.freeze({ pieza: Object.freeze(['pieza']), orden: Object.freeze(['orden']) }),
});
