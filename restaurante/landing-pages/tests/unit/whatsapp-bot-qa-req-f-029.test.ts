import { describe, expect, it } from 'vitest';

import { INDENT, MAX_LINE_WIDTH, chunkText, emojiCount, splitMessage, visibleWidth } from '../../src/services/whatsapp-bot/text.ts';
import { runFlowScripts } from '../support/bot-golden.ts';

/**
 * QA de REQ-F-029 (ronda 1): casos límite de `visibleWidth` y `splitMessage` que no cubre
 * `whatsapp-bot-format.test.ts`, propiedades de la partición con textos generados y los defectos
 * DEF-001 y DEF-002 del QA Report (ronda 1), corregidos en la ronda 2; sus pruebas pasaron de `it.fails` a `it`.
 */

describe('visibleWidth y emojiCount: casos límite (QA REQ-F-029, N-4)', () => {
  it('cadena vacía y solo marcadores miden 0', () => {
    expect(visibleWidth('')).toBe(0);
    expect(visibleWidth('**__~~')).toBe(0);
    expect(emojiCount('')).toBe(0);
  });

  it('la sangría inicial se descuenta hasta 4 caracteres, de cualquier tipo y mezclada', () => {
    expect(visibleWidth('    abc')).toBe(3);
    expect(visibleWidth('    abc')).toBe(3);
    expect(visibleWidth(' abc')).toBe(3);
    // El quinto espacio ya no es sangría (definición: 4 como máximo).
    expect(visibleWidth('     abc')).toBe(4);
    // Un espacio interior sí cuenta.
    expect(visibleWidth('a b')).toBe(3);
  });

  it('acentos, ñ, "×", "·" y "—" cuentan 1; también en forma descompuesta (NFD)', () => {
    expect(visibleWidth('áéíóúñ×·—')).toBe(9);
    expect(visibleWidth('á')).toBe(1);
  });

  it('emoji simple, con U+FE0F, con tono de piel y con ZWJ cuentan 2 y son un emoji', () => {
    for (const emoji of ['🧀', '🕒', '✅', '🛵', '👋🏽', '👨‍🍳', '🏳️‍🌈']) {
      expect(visibleWidth(emoji), emoji).toBe(2);
      expect(emojiCount(emoji), emoji).toBe(1);
    }
    expect(visibleWidth('*1.* 🧀 *Queso*')).toBe(11);
  });

  it('banderas y keycaps no son pictográficos: cuentan 1 y no son emoji (se documenta; el bot no los usa)', () => {
    expect(visibleWidth('🇲🇽')).toBe(1);
    expect(visibleWidth('1️⃣')).toBe(1);
    expect(emojiCount('🇲🇽 1️⃣')).toBe(0);
  });

  it('©, ® y ™ cuentan como emoji (Extended_Pictographic)', () => {
    expect(emojiCount('© ® ™')).toBe(3);
  });

  it('la regla de 28 dígitos mide exactamente MAX_LINE_WIDTH', () => {
    expect(MAX_LINE_WIDTH).toBe(28);
    expect(visibleWidth('1234567890123456789012345678')).toBe(MAX_LINE_WIDTH);
  });
});

describe('splitMessage: casos límite (QA REQ-F-029, N-7)', () => {
  it('texto vacío, solo renglones en blanco o de espacios: sin partes', () => {
    expect(splitMessage('')).toEqual([]);
    expect(splitMessage('\n')).toEqual([]);
    expect(splitMessage('   \n \n ')).toEqual([]);
  });

  it('renglones en blanco al principio y al final no llegan a ninguna parte', () => {
    expect(splitMessage('\n\nHola\n\nAdiós\n\n')).toEqual(['Hola\n\nAdiós']);
  });

  it('un renglón de solo espacios entre bloques cuenta como renglón en blanco', () => {
    expect(splitMessage('A\n   \nB', 2)).toEqual(['A', 'B']);
  });

  it('un renglón con sangría al principio del texto no se pega a nada y no se pierde', () => {
    expect(splitMessage(`${INDENT}x\nY`)).toEqual([`${INDENT}x\nY`]);
  });

  it('un encabezado al final del texto se conserva', () => {
    expect(splitMessage('Texto\n\n*FIN*', 5)).toEqual(['Texto', '*FIN*']);
  });

  it('dos encabezados seguidos se quedan con el bloque que encabezan', () => {
    const text = `${'a'.repeat(20)}\n\n*UNO*\n\n*DOS*\n\n*1.* Agua\n${INDENT}$35`;
    const parts = splitMessage(text, 40);
    expect(parts[0]).toBe('a'.repeat(20));
    expect(parts[1]).toBe(`*UNO*\n\n*DOS*\n\n*1.* Agua\n${INDENT}$35`);
  });

  it('L-3: un encabezado de sección justo en el límite nunca queda solo al final de una parte', () => {
    const before = 'b'.repeat(30);
    const block = `*9.* Agua\n${INDENT}$35`;
    // "before\n\n*BEBIDAS*" mide exactamente 41: cabría, pero el encabezado debe irse con su producto.
    const parts = splitMessage(`${before}\n\n*BEBIDAS*\n\n${block}`, 41);
    expect(parts).toEqual([before, `*BEBIDAS*\n\n${block}`]);
  });

  it('un bloque de exactamente max va entero; con max + 1 se parte por renglones (chunkText)', () => {
    const block = `*1.* Nombre\n${INDENT}$45`;
    expect(splitMessage(block, block.length)).toEqual([block]);
    expect(splitMessage(block, block.length - 1)).toEqual(chunkText(block, block.length - 1));
  });

  it('"*Total: $X*" se trata como encabezado y se queda con lo siguiente, sin romper RF-7', () => {
    const parts = splitMessage(`*1.* A\n${INDENT}1 × $1 c/u = $1\n\n*Total: $1*\n\n*1.* Agregar`, 26);
    expect(parts).toEqual([`*1.* A\n${INDENT}1 × $1 c/u = $1`, '*Total: $1*\n\n*1.* Agregar']);
  });
});

/** Generador determinista (mulberry32) para las propiedades. */
function prng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('splitMessage: propiedades con textos generados (QA REQ-F-029, N-7 y RF-12)', () => {
  const words = ['Molotes', 'de', 'Queso', '🧀', '$45', '·', 'orden', 'áé', '×', '*MOLOTES*', 'Calle', '#10'];

  function randomText(next: () => number): { text: string; blocks: string[] } {
    const blocks: string[] = [];
    const pieces: string[] = [];
    const count = 1 + Math.floor(next() * 40);
    for (let index = 0; index < count; index += 1) {
      const head = Array.from({ length: 1 + Math.floor(next() * 8) }, () => words[Math.floor(next() * words.length)]).join(' ');
      const continuation = Array.from({ length: Math.floor(next() * 3) }, () => `${INDENT}${Math.floor(next() * 9) + 1} × $${Math.floor(next() * 200)}`);
      const block = [head, ...continuation].join('\n');
      blocks.push(block);
      pieces.push(block, next() < 0.5 ? '\n' : '\n\n');
    }
    pieces.pop();
    return { text: pieces.join(''), blocks };
  }

  it('500 textos y límites variados: partes ≤ max, sin bordes en blanco, sin perder renglones y sin separar un bloque que cabe', () => {
    const next = prng(29);
    for (let round = 0; round < 500; round += 1) {
      const { text, blocks } = randomText(next);
      const longest = Math.max(...blocks.map((block) => block.length));
      const max = longest + Math.floor(next() * 300);
      const parts = splitMessage(text, max);
      for (const part of parts) {
        expect(part.length).toBeLessThanOrEqual(max);
        expect(part).not.toMatch(/^\n|\n$/);
        expect(part).not.toContain('\n\n\n');
        expect(part.startsWith(INDENT)).toBe(false);
      }
      // Ningún renglón se pierde ni cambia de orden.
      const nonBlank = (value: string): string[] => value.split('\n').filter((row) => row.trim() !== '');
      expect(parts.flatMap(nonBlank)).toEqual(nonBlank(text));
      // Cada bloque (renglón y sus continuaciones con sangría) queda entero en una parte.
      for (const block of blocks) expect(parts.some((part) => part.includes(block)), block).toBe(true);
    }
  });

  it('sin renglones en blanco ni sangría coincide con chunkText en 300 textos', () => {
    const next = prng(1600);
    for (let round = 0; round < 300; round += 1) {
      const rows = Array.from({ length: 1 + Math.floor(next() * 60) }, () => 'x'.repeat(1 + Math.floor(next() * 50)));
      const max = 50 + Math.floor(next() * 400);
      expect(splitMessage(rows.join('\n'), max)).toEqual(chunkText(rows.join('\n'), max));
    }
  });
});

describe('DEF-001 (QA REQ-F-029, ronda 1): opciones de la aclaración', () => {
  // RF-1: "Un dato variable va solo en su renglón, o al final del renglón de su etiqueta, sin otro
  // dato ni precio detrás". Antes la aclaración mostraba "*2.* Bebidas Frías del Comal (Coca-Cola Vidrio) — $35".
  it('RF-1: ningún renglón de la aclaración lleva un nombre de producto seguido de su precio', async () => {
    const offending: string[] = [];
    let options = 0;
    await runFlowScripts((script, input, result) => {
      if (script !== 'birria-aclaracion' || input !== 'consomé, una bebida y 2 tacos') return;
      const clarify = result.replies.find((reply) => reply.includes('Necesito que me aclares'));
      if (clarify === undefined) return;
      const rows = clarify.slice(clarify.indexOf('Necesito que me aclares')).split('\n');
      rows.forEach((row, index) => {
        if (!/^\*\d+\.\* /.test(row)) return;
        options += 1;
        const price = rows[index + 1] ?? '';
        // El nombre va sin precio; el precio, en el renglón siguiente con sangría y de 28 o menos.
        if (row.includes('$') || !price.startsWith(INDENT) || !/\$\d/.test(price) || visibleWidth(price) > MAX_LINE_WIDTH) offending.push(row);
      });
    });
    // Consomé (3 opciones) y bebida (2): la prueba no pasa en vacío.
    expect(options).toBe(5);
    expect(offending).toEqual([]);
  });
});

describe('DEF-002 (QA REQ-F-029, ronda 1): encabezado más bloque mayores que el límite', () => {
  // RF-12 y RF-7: si el encabezado unido a su bloque no cabe en `max` pero el bloque solo sí, antes se
  // parte por renglones (chunkText): el producto queda separado de su precio o una parte termina en
  // un salto. Inalcanzable con los límites reales (1600 y 4096) y los topes del catálogo.
  it('un bloque que cabe solo nunca se separa aunque su encabezado no quepa con él', () => {
    const block = `*1.* Agua\n${INDENT}$35`;
    for (const max of [block.length, block.length + 3]) {
      const parts = splitMessage(`*BEBIDAS*\n\n${block}`, max);
      expect(parts.some((part) => part.includes(block)), String(max)).toBe(true);
      for (const part of parts) expect(part).not.toMatch(/\n$/);
    }
  });
});
