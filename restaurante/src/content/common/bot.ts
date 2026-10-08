/**
 * Textos del flujo del bot de WhatsApp compartidos por los dos negocios (REQ-F-009, RF-4).
 * Marcadores entre llaves (`{negocio}`) que sustituye src/services/whatsapp-bot/messages.ts.
 * Mensajes breves y opciones numeradas (D-9); las palabras clave funcionan en cualquier paso (D-10).
 */
export const botText = Object.freeze({
  greeting: '¡Hola! Te atiende el asistente de *{negocio}*. {lema}',
  openNow: 'Estamos abiertos hasta las {cierre}.',
  closedNow: 'En este momento estamos cerrados. Abrimos {apertura}. Puedes ver el menú y dejar tu pedido: lo atenderemos cuando abramos.',
  /** Fuera de horario y sin pedidos (D-16): el negocio no abre hoy ni mañana. */
  closedNoOrders: 'En este momento estamos cerrados. Abrimos {apertura}. Puedes ver el menú; los pedidos se reciben desde el día anterior a la apertura.',
  rootOptions: '¿Qué deseas hacer?\n1. Ver el menú\n2. Hacer un pedido\n3. Horario y ubicación\n4. Hablar con una persona',
  keywordsHint: 'En cualquier momento puedes escribir: *menú*, *carrito*, *cancelar*, *persona* o *ayuda*.',
  help: 'Respondo a números de opción y a palabras clave.',
  notUnderstood: 'No entendí tu mensaje.',
  textOnly: 'Por ahora solo entiendo mensajes de texto.',
  hoursAndLocation: '*{negocio}* atiende {horario}.\nUbicación: {mapa}',
  otherBusiness: '*{otro}* atiende {horarioOtro}. Hoy te atiende *{negocio}*.',
  menuTitle: '*Menú de {negocio}*',
  menuPrompt: 'Escribe el número de un producto para agregarlo a tu pedido.',
  menuEmpty: 'Por ahora no tenemos productos disponibles. Escribe *persona* para hablar con alguien de {negocio}.',
  ordersClosed:
    'Por ahora *{negocio}* no está tomando pedidos: abre {apertura}. *{otro}* abre {aperturaOtro}.\nPuedes ver el menú (escribe *menú*) o hablar con una persona (escribe *persona*).',
  chooseOption: '¿Cuál opción de *{producto}*?\n{opciones}',
  askQuantity: '¿Cuántas de *{producto}*? Escribe un número del 1 al {max}.',
  invalidNumber: 'Escribe solo el número de una de las opciones.',
  invalidQuantity: 'La cantidad debe ser un número entero del 1 al {max}.',
  lineTooLarge: 'Con esa cantidad tendrías más de {max} de *{producto}*. Elige una cantidad menor.',
  tooManyLines: 'Tu pedido ya tiene {max} productos distintos, el máximo. Quita uno antes de agregar otro.',
  added: 'Agregado: {linea}.',
  cartTitle: '*Tu pedido*',
  cartEmpty: 'Tu carrito está vacío.',
  cartOptions: '1. Agregar otro producto\n2. Quitar un producto\n3. Vaciar el carrito\n4. Terminar mi pedido',
  removePrompt: '¿Qué producto quitas? Escribe su número.\n{lineas}',
  removed: 'Quitado: {producto}.',
  emptied: 'Listo, vacié tu carrito.',
  privacy: 'Para preparar y entregar tu pedido necesito tu nombre y, si es a domicilio, tu dirección. Solo se usan para este pedido y no se guardan.',
  askName: '¿A nombre de quién es el pedido?',
  invalidName: 'El nombre debe tener entre 1 y {max} caracteres.',
  askDelivery: '¿Cómo lo quieres?\n1. Recoger en sucursal\n2. A domicilio',
  askAddress: '¿Cuál es la dirección de entrega? (calle, número, colonia y referencias)',
  invalidAddress: 'La dirección debe tener entre {min} y {max} caracteres.',
  askNotes: '¿Alguna nota para tu pedido? Escribe *0* si no tienes.',
  invalidNotes: 'Las notas pueden tener hasta {max} caracteres.',
  pickup: 'Recoger en sucursal',
  delivery: 'A domicilio: {direccion}',
  deliveryCost: 'El personal te confirmará el costo del envío.',
  noNotes: 'Sin notas',
  summaryTitle: '*Resumen de tu pedido {codigo}*\n{negocio}',
  offHours: 'FUERA DE HORARIO: tu pedido se atenderá cuando abramos, {apertura}.',
  confirmPrompt: 'Escribe *1* para confirmar o *2* para cancelar.',
  catalogChanged: 'Algunos productos cambiaron desde que los agregaste:',
  lineRemoved: '- {producto} ya no está disponible y lo quité.',
  linePriceChanged: '- {producto} cambió de precio: ahora {precio}.',
  cartNowEmpty: 'Tu carrito quedó vacío.',
  confirmed: '¡Listo! Tu pedido *{codigo}* fue enviado a {negocio}. El personal te escribirá para confirmarlo.',
  staffFailed:
    'No pude enviar tu pedido *{codigo}* al personal de {negocio}. Por favor escríbeles directamente: {contacto}',
  cancelled: 'Pedido cancelado. Cuando quieras, escríbenos de nuevo.',
  person: 'Para hablar con una persona de *{negocio}*, escribe a: {contacto}',
  staffHours: 'En horario',
  staffOffHours: 'FUERA DE HORARIO, abre {apertura}',
  /**
   * Aviso al personal como texto libre (REQ-F-012, D-6: Twilio sin Content Template). Mismo
   * contenido que los parámetros de la plantilla de Meta (REQ-F-009 CA-14).
   */
  staffNotice:
    '*Nuevo pedido {codigo}* - {negocio}\n{horario}\nCliente: {cliente}\nWhatsApp: {whatsapp}\nEntrega: {entrega}\n{lineas}\nTotal: {total}\nNotas: {notas}',
  priceEach: 'c/u',
  piece: 'pieza',
  order: 'orden de {cantidad}',
});
