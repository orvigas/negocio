import { describe, expect, it } from 'vitest';

import { BUSINESS, type BusinessId } from '@restaurante/core/shared';
import { toInput, type ProductRepository, type PublishedProducts } from '@restaurante/core/catalog';

import { ANA } from '../support/products.ts';
import { CUSTOMER, STAFF, WEEK, inboundPayload, makeBotHarness, mx, type BotHarness } from '../support/whatsapp.ts';

/**
 * Conversación del bot de WhatsApp (REQ-F-009, RF-3 a RF-6) con el bot real, el doble de la Cloud
 * API y el reloj controlado. Semana de referencia: lunes 5 a domingo 11 de octubre de 2026.
 */

async function findProduct(h: BotHarness, business: BusinessId, name: string) {
  const product = (await (h.products as ProductRepository).list(business)).find((candidate) => candidate.name === name);
  if (!product) throw new Error(`Falta el producto de la semilla: ${name}`);
  return product;
}

/** Edita un producto como lo haría la administración (entrada completa). */
async function editProduct(h: BotHarness, business: BusinessId, name: string, change: (input: Record<string, unknown>) => void): Promise<void> {
  const product = await findProduct(h, business, name);
  const input = { ...toInput(product), available: product.available };
  change(input);
  await (h.products as ProductRepository).update(business, product.id, { input, expectedVersion: product.version }, ANA);
}

async function removeProduct(h: BotHarness, business: BusinessId, name: string): Promise<void> {
  const product = await findProduct(h, business, name);
  await (h.products as ProductRepository).remove(business, product.id, product.version, ANA);
}

/** Agrega al carrito un producto del menú (número, opción opcional y cantidad). */
async function add(h: BotHarness, product: number, quantity: number, option?: number): Promise<string> {
  await h.ask(String(product));
  if (option !== undefined) await h.ask(String(option));
  return h.ask(String(quantity));
}

/**
 * Del carrito al resumen (REQ-F-013, RF-5): "4", los datos en un solo mensaje y, si se pide, una
 * nota escrita en el resumen (RF-6.2).
 */
async function checkout(h: BotHarness, { delivery = 1, address = 'Calle Falsa 123, Centro', notes = '' } = {}): Promise<string> {
  await h.ask('4');
  const summary = await h.ask(delivery === 2 ? `Ana Pérez, domicilio, ${address}, al recibir` : 'Ana Pérez, recoger, efectivo');
  return notes === '' ? summary : h.ask(notes);
}

describe('selección del negocio (RF-3)', () => {
  it('CA-5: un martes a las 10:00 saluda como Molotes y un sábado como Birria', async () => {
    const tuesday = await makeBotHarness({ at: mx(`${WEEK.tue}T10:00`) });
    const greetingTue = await tuesday.ask('Hola');
    expect(greetingTue).toContain('Moloteando');
    expect(greetingTue).toContain('*1.* 📋 Ver el menú');
    expect(greetingTue).toContain('Estamos abiertos hasta las 15:00');

    const saturday = await makeBotHarness({ at: mx(`${WEEK.sat}T10:00`) });
    expect(await saturday.ask('Hola')).toContain('Birria El Muñeco');
  });

  it('CA-6a: un pedido de Molotes del lunes a las 23:50 confirmado el martes 00:10 sigue siendo de Molotes', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.mon}T23:50`) });
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 1, 2, 2);
    h.clock.now = mx(`${WEEK.tue}T00:10`);
    const summary = await checkout(h);
    expect(summary).toContain('Moloteando');
    expect(summary).toContain('FUERA DE HORARIO');
    expect(await h.ask('1')).toContain('fue enviado a Moloteando');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
    expect(h.double.templatesTo(STAFF.birria)).toHaveLength(0);
    expect(h.double.templatesTo(STAFF.molotes)[0]?.template?.params.horario).toMatch(/^FUERA DE HORARIO, abre hoy a las 08:30$/);
  });

  it('CA-6b: una conversación de Molotes del viernes 23:50 sigue en Molotes el sábado 00:10 y aplica D-16', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.fri}T23:50`) });
    expect(await h.ask('Hola')).toContain('Moloteando');
    h.clock.now = mx(`${WEEK.sat}T00:10`);
    const menu = await h.ask('menú');
    expect(menu).toContain('Menú de Moloteando');
    expect(menu).toContain('Molotes de Queso Oaxaca');
    expect(menu).not.toContain('Quesabirria');
    const attempt = await h.ask('1');
    expect(attempt).toContain('no está tomando pedidos');
    expect(attempt).toContain('Moloteando* no está tomando pedidos: abre el martes a las 08:30');
  });

  it('CA-6b: lo mismo con Birria entre el domingo 23:50 y el lunes 00:10', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.sun}T23:50`) });
    expect(await h.ask('Hola')).toContain('Birria El Muñeco');
    h.clock.now = mx(`${WEEK.nextMon}T00:10`);
    expect(await h.ask('menu')).toContain('Menú de Birria El Muñeco');
    expect(await h.ask('2')).toContain('Birria El Muñeco* no está tomando pedidos: abre el sábado a las 08:00');
  });

  it('CA-7: tras 2 h sin actividad empieza una conversación nueva con el negocio de ese momento', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.fri}T22:30`) });
    await h.ask('Hola');
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
    h.clock.now = mx(`${WEEK.sat}T00:31`);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
    expect(await h.ask('Hola')).toContain('Birria El Muñeco');
    expect(h.logger.lines.filter((line) => line.msg === 'bot_conversation_started').map((line) => line.business)).toEqual(['molotes', 'birria']);
  });

  it('CA-8: un martes desde /birria atiende como Molotes e indica los días de Birria', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.tue}T10:00`) });
    const reply = await h.ask('Hola, quiero hacer un pedido de birria');
    expect(reply).toContain('Te atiende el asistente de *Moloteando*');
    expect(reply).toContain('*Birria El Muñeco* atiende sábado y domingo de 08:00 a 15:00');
  });

  it('RF-3.4: también si lo pide más tarde, en el menú', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.tue}T10:00`) });
    await h.ask('Hola');
    await h.ask('1');
    expect(await h.ask('quiero quesabirria')).toContain('Birria El Muñeco* atiende sábado y domingo');
  });
});

describe('menú y pedido (RF-4, RF-5)', () => {
  it('muestra el menú de Molotes con las bebidas en su sección y el de Birria con sus variantes', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    const menu = await h.ask('1');
    expect(menu).toContain('*MOLOTES*\n\n*1.* 🧀 *Molotes de Queso Oaxaca*\n    pieza $45 · orden de 3 $130');
    expect(menu).toContain('*BEBIDAS*\n\n*9.* 🍹 *Aguas Frescas Naturales del Día*\n    $35');

    const birria = await makeBotHarness({ at: mx(`${WEEK.sat}T10:00`) });
    await birria.ask('Hola');
    const birriaMenu = await birria.ask('1');
    expect(birriaMenu).toContain('*4.* 🍲 *Tazón de Consomé Chico*\n    Con Carne $80\n    Sin Carne $45');
  });

  it('CA-9: no muestra productos no disponibles ni eliminados, ni variantes no disponibles', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.sat}T10:00`) });
    await editProduct(h, BUSINESS.BIRRIA, 'Taco de Birria con Tortilla de Mano', (input) => {
      input.available = false;
    });
    await removeProduct(h, BUSINESS.BIRRIA, 'Quesabirria con Tortilla de Mano');
    await editProduct(h, BUSINESS.BIRRIA, 'Tazón de Consomé Chico', (input) => {
      input.variants = (input.variants as Record<string, unknown>[]).map((variant, index) => ({ ...variant, available: index !== 0 }));
    });

    await h.ask('Hola');
    const menu = await h.ask('1');
    expect(menu).not.toContain('Taco de Birria');
    expect(menu).not.toContain('Quesabirria con Tortilla');
    expect(menu).toContain('*Tazón de Consomé Chico*\n    Sin Carne $45');
    expect(menu).not.toContain('Con Carne $80');
  });

  it('CA-10: 2 órdenes de Molotes de Queso Oaxaca y 1 bebida: líneas, subtotales y total del catálogo', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    expect(await add(h, 1, 2, 2)).toContain('Agregado:\n- 2 × Molotes de Queso Oaxaca (orden de 3)');
    await h.ask('1');
    const cart = await add(h, 9, 1);
    expect(cart).toContain('*1.* Molotes de Queso Oaxaca (orden de 3)\n    2 × $130 c/u = $260');
    expect(cart).toContain('*2.* Aguas Frescas Naturales del Día\n    1 × $35 c/u = $35');
    expect(cart).toContain('*Total: $295*');
    const summary = await checkout(h);
    expect(summary).toContain('*Resumen de tu pedido*\n*M-T001* · Moloteando');
    expect(summary).toContain('*Total: $295*');
    expect(summary).toContain('*Entrega:* Recoger en sucursal');
    expect(summary).not.toContain('FUERA DE HORARIO');
  });

  it('suma la misma presentación en una línea y permite quitar y vaciar', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 1, 2, 1);
    await h.ask('1');
    const merged = await add(h, 1, 3, 1);
    expect(merged).toContain('*1.* Molotes de Queso Oaxaca (pieza)\n    5 × $45 c/u = $225');
    await h.ask('1');
    await add(h, 10, 1);
    await h.ask('2');
    const removed = await h.ask('1');
    expect(removed).toContain('Quitado: Molotes de Queso Oaxaca (pieza).');
    expect(removed).toContain('*1.* Refrescos Familia Coca-Cola');
    expect(await h.ask('3')).toContain('Listo, vacié tu carrito.');
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
  });

  it('CA-11: si cambia el precio de un producto del carrito, avisa y muestra el resumen actualizado antes de confirmar', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 2);
    await checkout(h);
    await editProduct(h, BUSINESS.MOLOTES, 'Aguas Frescas Naturales del Día', (input) => {
      input.price = '40';
    });

    const reply = await h.ask('1');
    expect(reply).toContain('Algunos productos cambiaron');
    expect(reply).toContain('Aguas Frescas Naturales del Día cambió de precio: ahora $40');
    expect(reply).toContain('- Aguas Frescas Naturales del Día\n    2 × $40 c/u = $80');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
    await h.ask('1');
    expect(h.double.templatesTo(STAFF.molotes)[0]?.template?.params.total).toBe('$80');
  });

  it('un producto eliminado entre el carrito y la confirmación se quita con aviso', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await h.ask('1');
    await add(h, 10, 1);
    await checkout(h);
    await removeProduct(h, BUSINESS.MOLOTES, 'Aguas Frescas Naturales del Día');
    const reply = await h.ask('1');
    expect(reply).toContain('Aguas Frescas Naturales del Día ya no está disponible y lo quité.');
    expect(reply).toContain('*Total: $35*');
  });

  it.each(['0', '21', 'abc', '-1', '2.5'])('CA-12: rechaza la cantidad %s y el carrito no cambia', async (quantity) => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await h.ask('9');
    const reply = await h.ask(quantity);
    expect(reply).toContain('La cantidad debe ser un número entero del 1 al 20.');
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
  });

  it('CA-12: rechaza la línea 16 y una línea que superaría 20 unidades', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    // 8 platillos × 2 presentaciones = 16 opciones distintas.
    for (let product = 1; product <= 8; product += 1) {
      for (const option of [1, 2]) {
        const reply = await add(h, product, 1, option);
        const lineCount = (product - 1) * 2 + option;
        if (lineCount <= 15) expect(reply).toContain('Agregado');
        else expect(reply).toContain('ya tiene 15 productos distintos');
        await h.ask('1');
      }
    }
    await h.ask('carrito');
    const cart = await h.ask('carrito');
    expect(cart).toContain('*15.* ');
    expect(cart).not.toContain('*16.* ');

    const other = await makeBotHarness();
    await other.ask('Hola');
    await other.ask('2');
    await add(other, 9, 15);
    await other.ask('1');
    expect(await add(other, 9, 6)).toContain('tendrías más de 20');
    expect(await other.ask('carrito')).toContain('Aguas Frescas Naturales del Día\n    15 × ');
  });

  it('CA-13: a domicilio pide la dirección y la valida (5 a 200 caracteres); la nota se escribe en el resumen (REQ-F-013, RF-5.4, RF-6.2)', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await h.ask('4');
    expect(await h.ask('Ana, domicilio')).toContain('¿Cuál es la dirección de entrega?');
    expect(await h.ask('Av')).toContain('La dirección debe tener entre 5 y 200 caracteres.');
    expect(await h.ask('x'.repeat(201))).toContain('La dirección debe tener entre 5 y 200 caracteres.');
    // REQ-F-035, CA-2: con la dirección válida se pregunta el pago con las 2 opciones de domicilio.
    expect(await h.ask('Calle Falsa 123')).toBe('💳 *¿Cómo vas a pagar?*\n*1.* Pagar al recibir\n*2.* Transferencia');
    expect(await h.ask('1')).toContain('Escribe *sí* para confirmar.\nO escribe una nota');
    const summary = await h.ask('Sin cebolla 🌶️');
    expect(summary).toContain('*Entrega:* A domicilio\nCalle Falsa 123');
    expect(summary).toContain('*Notas:* Sin cebolla 🌶️');
    expect(summary).toContain('El personal te confirmará el costo del envío.');
  });

  it('valida el nombre (1 a 60, contando emojis como un carácter) y muestra el aviso de privacidad antes (REQ-F-013, RF-5.1)', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    const privacy = await h.ask('4');
    expect(privacy).toContain('Solo se usan para este pedido y no se guardan.');
    expect(await h.ask(`${'A'.repeat(61)}, recoger, efectivo`)).toContain('El nombre debe tener entre 1 y 60 caracteres.');
    expect(await h.ask(`${'😀'.repeat(60)}`)).toContain(`*Nombre:* ${'😀'.repeat(60)}`);
  });

  it('CA-20: sin productos disponibles lo dice y ofrece hablar con una persona', async () => {
    const empty: Pick<ProductRepository, 'getPublished'> = {
      getPublished: <Id extends 'molotes' | 'birria'>(business: Id) =>
        (business === 'molotes' ? { menu: [], drinks: [] } : { menu: [] }) as PublishedProducts[Id],
    };
    const h = await makeBotHarness({ products: empty });
    await h.ask('Hola');
    expect(await h.ask('1')).toContain('Por ahora no tenemos productos disponibles.\n\nEscribe *persona*');
  });
});

describe('opciones del cliente (D-10, D-15, RF-4.7 a RF-4.9)', () => {
  it.each(['cancelar', 'CANCELAR', 'Cancelar!'])('CA-16: "%s" en cualquier paso cierra sin enviar nada al personal', async (word) => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await checkout(h);
    expect(await h.ask(word)).toContain('Pedido cancelado.');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
  });

  it('CA-16: "2" en el resumen también cancela', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await checkout(h);
    expect(await h.ask('2')).toContain('Pedido cancelado.');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
  });

  it.each(['persona', 'Persona', 'HUMANO'])('CA-17: "%s" da el contacto del personal del negocio de la conversación', async (word) => {
    const saturday = await makeBotHarness({ at: mx(`${WEEK.sat}T10:00`) });
    await saturday.ask('Hola');
    expect(await saturday.ask(word)).toContain(`https://wa.me/${STAFF.birria}`);
  });

  it.each(['image', 'audio', 'sticker', 'location', 'contacts'] as const)('CA-18: un mensaje %s recibe el aviso de solo texto y las opciones del paso', async (kind) => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('1');
    const before = h.double.textsTo(CUSTOMER).length;
    await h.deliver(inboundPayload(kind, { at: h.clock.now }));
    const reply = h.double.textsTo(CUSTOMER).slice(before).join('\n');
    expect(reply).toContain('Por ahora solo entiendo mensajes de texto.');
    expect(reply).toContain('el número de un producto');
  });

  it('un primer mensaje que no es texto saluda y avisa', async () => {
    const h = await makeBotHarness();
    await h.deliver(inboundPayload('audio', { at: h.clock.now }));
    const reply = h.double.textsTo(CUSTOMER).join('\n');
    expect(reply).toContain('Moloteando');
    expect(reply).toContain('solo entiendo mensajes de texto');
  });

  it('RF-4.9: un texto no reconocido da una ayuda breve y las opciones del paso; "ayuda" también', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    const reply = await h.ask('qué tal 🤔');
    expect(reply).toContain('No entendí tu mensaje.');
    expect(reply).toContain('*2.* 🛒 Hacer un pedido');
    // REQ-F-013, RF-4.9: la ayuda invita a escribir el pedido con un ejemplo.
    expect(await h.ask('Ayuda')).toContain('Puedes escribir tu pedido con tus palabras, por ejemplo:\n*2 molotes de queso 🧀 y una coca 🥤*');
  });

  it('palabras clave sin distinguir acentos ni mayúsculas: "MENÚ" y "Menu"', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    expect(await h.ask('MENÚ')).toContain('Menú de Moloteando');
    expect(await h.ask('Menu')).toContain('Menú de Moloteando');
  });

  it('una palabra clave dentro de un texto más largo no se toma como palabra clave (p. ej. el nombre)', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await h.ask('4');
    expect(await h.ask('Persona Cancelar López, recoger, efectivo')).toContain('*Nombre:* Persona Cancelar López');
  });

  it('opción 3: horario y ubicación del contenido del negocio', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    const reply = await h.ask('3');
    expect(reply).toContain('*Moloteando* atiende martes a viernes de 08:30 a 15:00');
    // Ubicación de la única sucursal (REQ-F-032, R-10).
    expect(reply).toContain('https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853');
    expect(reply).not.toContain('maps.app.goo.gl');
  });
});

describe('horario (RF-6, D-16)', () => {
  it.each([
    [`${WEEK.wed}T16:00`, 'Moloteando', 'mañana jueves a las 08:30'],
    [`${WEEK.wed}T07:00`, 'Moloteando', 'hoy a las 08:30'],
    [`${WEEK.sat}T16:00`, 'Birria El Muñeco', 'mañana domingo a las 08:00'],
  ])('CA-19: %s avisa cuándo abre, deja pedir y marca el resumen', async (local, name, opening) => {
    const h = await makeBotHarness({ at: mx(local) });
    const greeting = await h.ask('Hola');
    expect(greeting).toContain(name);
    expect(greeting).toContain(`En este momento estamos cerrados.\nAbrimos ${opening}.`);
    await h.ask('2');
    await add(h, 1, 1, ...(name === 'Moloteando' ? [1] : []));
    const summary = await checkout(h);
    expect(summary).toContain(`*FUERA DE HORARIO*\nTu pedido se atenderá cuando abramos, ${opening}.`);
    await h.ask('1');
    const staff = name === 'Moloteando' ? STAFF.molotes : STAFF.birria;
    expect(h.double.templatesTo(staff)[0]?.template?.params.horario).toBe(`FUERA DE HORARIO, abre ${opening}`);
  });

  it('CA-27: el lunes a las 10:00 saluda como Molotes, avisa que abre el martes 08:30 y deja pedir con la marca', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.mon}T10:00`) });
    const greeting = await h.ask('Hola');
    expect(greeting).toContain('Moloteando');
    expect(greeting).toContain('Abrimos mañana martes a las 08:30');
    expect(await h.ask('1')).toContain('Molotes de Queso Oaxaca');
    await add(h, 9, 1);
    const summary = await checkout(h);
    expect(summary).toContain('FUERA DE HORARIO');
    expect(await h.ask('1')).toContain('fue enviado a Moloteando');
  });

  it.each([
    [`${WEEK.fri}T16:00`, 'Moloteando', 'el martes a las 08:30', 'Birria El Muñeco', 'mañana sábado a las 08:00'],
    [`${WEEK.sun}T16:00`, 'Birria El Muñeco', 'el sábado a las 08:00', 'Moloteando', 'el martes a las 08:30'],
  ])('CA-28: %s no toma el pedido, informa las aperturas y ofrece una persona', async (local, name, opening, other, otherOpening) => {
    const h = await makeBotHarness({ at: mx(local) });
    const greeting = await h.ask('Hola');
    expect(greeting).toContain(`En este momento estamos cerrados.\nAbrimos ${opening}.\n\nPuedes ver el menú; los pedidos se reciben`);
    expect(greeting).not.toContain('dejar tu pedido');
    for (const attempt of ['2', '1']) {
      if (attempt === '1') await h.ask('menú');
      const reply = await h.ask(attempt === '2' ? '2' : '1');
      expect(reply).toContain(`*${name}* no está tomando pedidos: abre ${opening}.\n\n*${other}* abre ${otherOpening}.`);
      expect(reply).toContain('hablar con una persona (escribe *persona*)');
    }
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
  });

  it('PT-2 A: un pedido empezado antes del cierre del viernes se acepta aunque se confirme después', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.fri}T14:55`) });
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    h.clock.now = mx(`${WEEK.fri}T15:05`);
    const summary = await checkout(h);
    expect(summary).toContain('🌙 *FUERA DE HORARIO*\nTu pedido se atenderá cuando abramos, el martes a las 08:30.');
    expect(await h.ask('1')).toContain('fue enviado');
  });
});

describe('estado en memoria (RF-9.3, CA-22)', () => {
  it('CA-22: al confirmar o cancelar, los datos de la conversación ya no están en memoria', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await checkout(h);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
    await h.ask('1');
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
    expect(h.bot.conversationCount).toBe(0);

    await h.ask('Hola');
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
    await h.ask('cancelar');
    expect(h.bot.conversationCount).toBe(0);
  });

  it('conversaciones de clientes distintos son independientes', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2');
    await add(h, 9, 1);
    await h.ask('Hola', { from: '5215599990000' });
    expect(await h.ask('carrito', { from: '5215599990000' })).toContain('Tu carrito está vacío.');
    expect(await h.ask('carrito')).toContain('*1.* Aguas Frescas Naturales del Día\n    1 × $35');
  });
});
