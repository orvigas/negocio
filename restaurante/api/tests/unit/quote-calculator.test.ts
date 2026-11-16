import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  QuoteNotFoundError,
  QuoteUnavailableError,
  applyAdjustments,
  buildMatrix,
  calculateQuote,
  ceilInt,
  commercialTariff,
  parseQuoteCatalog,
  roundHalfUp,
  type QuoteCatalog,
  type QuoteResult,
} from '@restaurante/core/cotizador';
import type { LogFields } from '@restaurante/core/shared';

import { QUOTE_CATALOG_FILES, createFileQuoteCatalogSource } from '../../src/cotizador/file-catalog-source.ts';

/**
 * Cotizador de taquizas (REQ-F-046): el JSON real de `api` (su validación en el CI, RF-10 y CA-21), la
 * tarifa contra el Excel y la fórmula extendida, el cálculo (CA-1 a CA-14) y la validación de los
 * ajustes (CA-15).
 */

const PACKAGES = ['tradicional', 'mixto-1', 'mixto-2', 'especial'] as const;

/** Precio sugerido del Tradicional en el Excel (`Cotizador_Taquiza_Birria.xlsx`) para N = 30 a 100. */
const EXCEL_TRADITIONAL = [
  145, 145, 144, 144, 144, 143, 143, 143, 142, 142, 141, 141, 141, 140, 140, 140, 139, 139, 139, 138, 138, 138, 137, 137, 136, 136, 136, 135, 135, 135, 134, 134, 134, 133,
  133, 133, 132, 132, 131, 131, 131, 130, 130, 130, 129, 129, 129, 128, 128, 128, 127, 127, 126, 126, 126, 125, 125, 125, 124, 124, 124, 123, 123, 123, 122, 122, 121, 121,
  121, 120, 120,
];

function recordingLogger() {
  const logs: { msg: string; fields: LogFields | undefined }[] = [];
  const record = (msg: string, fields?: LogFields) => void logs.push({ msg, fields });
  return { logs, logger: { debug: record, info: record, warn: record, error: record } };
}

let catalog: QuoteCatalog;
let rawJson: Record<string, unknown>;

beforeAll(async () => {
  const { logs, logger } = recordingLogger();
  const source = createFileQuoteCatalogSource({ logger });
  await source.init();
  // El JSON real debe ser válido: si no, falla `npm test` en el CI (RF-10).
  expect(logs).toEqual([]);
  catalog = await source.load('birria');
  const file = QUOTE_CATALOG_FILES.birria;
  if (!file) throw new Error('falta el JSON de Birria');
  rawJson = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
});

function quote(personas: number, ajustes: Record<string, string> = {}): QuoteResult & { modified: string[] } {
  const adjusted = applyAdjustments(catalog, { personas: String(personas), ajustes });
  if (!adjusted.ok) throw new Error(`ajustes rechazados: ${JSON.stringify(adjusted.errors)}`);
  return { ...calculateQuote(adjusted.effective, adjusted.personas), modified: adjusted.modified };
}

function pkg(result: QuoteResult, id: string) {
  const found = result.packages.find((entry) => entry.id === id);
  if (!found) throw new Error(`sin el paquete ${id}`);
  return found;
}

const prices = (result: QuoteResult) => result.packages.map(({ price }) => price);

function rejected(ajustes: Record<string, string>, personas = '60'): Record<string, string> {
  const adjusted = applyAdjustments(catalog, { personas, ajustes });
  if (adjusted.ok) throw new Error('se esperaba un rechazo');
  return adjusted.errors;
}

describe('tarifa y redondeo', () => {
  it('reproduce el Excel en los 71 enteros de 30 a 100 en los cuatro paquetes', () => {
    for (let n = 30; n <= 100; n += 1) {
      const excel = EXCEL_TRADITIONAL[n - 30] ?? 0;
      expect(prices(quote(n)), `N = ${String(n)}`).toEqual([excel, excel + 10, excel + 20, excel + 30]);
    }
  });

  it('sigue la curva por encima de la referencia (tabla de ejemplo del ticket)', () => {
    const params = { a: 145, b: 120, f: 100, minPersonas: 30, refPersonas: 100 };
    expect([120, 150, 200, 300, 500].map((n) => roundHalfUp(commercialTariff(params, n), 2))).toEqual([113.99, 108.19, 103.35, 100.56, 100.02]);
    expect([120, 150, 200, 300, 500].map((n) => pkg(quote(n), 'tradicional').price)).toEqual([114, 108, 103, 101, 100]);
    // Continuidad en la referencia: N = 101 da 120 (tarifa 119.646; el ticket la cita truncada, 119.64).
    expect(commercialTariff(params, 101)).toBeCloseTo(119.646, 3);
    expect(pkg(quote(101), 'tradicional').price).toBe(120);
  });

  it('redondea 0.5 hacia arriba y absorbe el error de coma flotante', () => {
    // N = 37: tarifa exacta 142.5 -> 143, como ROUND de Excel.
    expect(pkg(quote(37), 'tradicional').commercialPrice).toBe(143);
    expect(ceilInt(63 / 0.7)).toBe(90);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(-19.5)).toBe(-20);
  });

  it('con a = b la tarifa es plana: vale b también por encima de la referencia', () => {
    expect(commercialTariff({ a: 120, b: 120, f: 100, minPersonas: 30, refPersonas: 100 }, 400)).toBe(120);
  });

  it('CA-5: nunca baja del piso F ni sube al aumentar N, hasta 5 000', () => {
    const floors: Record<string, number> = { tradicional: 100, 'mixto-1': 110, 'mixto-2': 120, especial: 130 };
    const last: Record<string, number> = {};
    for (let n = 101; n <= 5000; n += 1) {
      for (const result of quote(n).packages) {
        const price = result.price ?? 0;
        expect(price).toBeGreaterThanOrEqual(floors[result.id] ?? Infinity);
        expect(price).toBeLessThanOrEqual(last[result.id] ?? Infinity);
        last[result.id] = price;
      }
    }
    expect(pkg(quote(500), 'tradicional').price).toBe(100);
    expect(pkg(quote(5000), 'tradicional').price).toBe(100);
  });
});

describe('cálculo con los valores del JSON', () => {
  it('CA-1: con 60 personas', () => {
    const result = quote(60);
    expect(pkg(result, 'tradicional')).toMatchObject({ price: 134, sale: 8040, eventCost: 4426.57, profit: 3613.43, marginPct: 44.9, priceSource: 'commercial' });
    expect(prices(result)).toEqual([134, 144, 154, 164]);
    expect(result.modified).toEqual([]);
  });

  it('CA-2: costo variable y piezas por persona', () => {
    const result = quote(60);
    expect(result.packages.map(({ variableCost }) => variableCost)).toEqual([47.11, 53.11, 59.11, 65.11]);
    expect(result.packages.map(({ pieces }) => pieces)).toEqual([3, 3, 3, 3]);
  });

  it('CA-3 y CA-4: bordes del tramo recto y tramo extendido', () => {
    expect(prices(quote(30))).toEqual([145, 155, 165, 175]);
    expect(prices(quote(100))).toEqual([120, 130, 140, 150]);
    expect(pkg(quote(200), 'mixto-1').price).toBe(113);
  });

  it('CA-6: por debajo del mínimo ningún paquete tiene precio', () => {
    const result = quote(29);
    expect(result).toMatchObject({ belowMinimum: true, minPersonas: 30 });
    for (const entry of result.packages) expect(entry).toMatchObject({ price: null, sale: null, profit: null, marginPct: null, priceSource: null, cartaDiff: null });
    expect(quote(30).belowMinimum).toBe(false);
  });

  it('CA-13: diferencia frente a la carta solo si todos los ítems tienen precio a la carta', () => {
    const result = quote(60, { 'c.taco': '35' });
    expect(pkg(result, 'tradicional')).toMatchObject({ cartaPrice: 175, cartaDiff: 41 });
    for (const id of ['mixto-1', 'mixto-2', 'especial']) expect(pkg(result, id)).toMatchObject({ cartaPrice: null, cartaDiff: null });
    expect(result.modified).toEqual(['c.taco']);
  });

  it('CA-14: matriz con los mismos precios que el cálculo individual', () => {
    const matrix = buildMatrix(catalog);
    expect(matrix.rows).toEqual([30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300]);
    expect(matrix.packages.map(({ id }) => id)).toEqual([...PACKAGES]);
    expect(matrix.packages[0]?.cells.map((cell) => cell?.price)).toEqual([145, 141, 138, 134, 131, 127, 124, 120, 108, 103, 101]);
    matrix.rows.forEach((n, row) => {
      for (const column of matrix.packages) expect(column.cells[row]).toEqual({ price: pkg(quote(n), column.id).price, marginPct: pkg(quote(n), column.id).marginPct });
    });
  });
});

describe('ajustes', () => {
  it('CA-7: carne a 200 $/kg', () => {
    expect(pkg(quote(60, { 'i.carne-res.costo': '200' }), 'tradicional')).toMatchObject({ variableCost: 53.11, eventCost: 4786.57, profit: 3253.43, price: 134 });
  });

  it('CA-8: 9 horas por tanda', () => {
    expect(pkg(quote(60, { 'cb.horas': '9' }), 'tradicional').variableCost).toBe(47.75);
  });

  it('CA-9: consomé en 0 en el Tradicional y Mixto 1 desactivado', () => {
    const result = quote(60, { 'p.tradicional.q.consome-500': '0', 'p.mixto-1.on': '0' });
    expect(pkg(result, 'tradicional')).toMatchObject({ variableCost: 46.61, cartaPrice: 115, cartaDiff: -19 });
    expect(result.packages.map(({ id }) => id)).toEqual(['tradicional', 'mixto-2', 'especial']);
    const adjusted = applyAdjustments(catalog, { personas: '60', ajustes: { 'p.mixto-1.on': '0' } });
    if (!adjusted.ok) throw new Error('rechazado');
    expect(buildMatrix(adjusted.effective).packages.map(({ id }) => id)).toEqual(['tradicional', 'mixto-2', 'especial']);
  });

  it('CA-10 y CA-11: cuando manda el margen', () => {
    expect(pkg(quote(60, { 'po.margen': '50' }), 'tradicional')).toMatchObject({ price: 148, sale: 8880, priceSource: 'margin', marginPct: 50.2 });
    expect(pkg(quote(30, { 'fe.mano-obra': '3000' }), 'tradicional')).toMatchObject({ price: 211, priceSource: 'margin' });
  });

  it('CA-12: piso F y referencia', () => {
    expect(pkg(quote(200, { 'p.tradicional.f': '110' }), 'tradicional').price).toBe(110);
    expect(pkg(quote(100, { 'po.ref': '120' }), 'tradicional').price).toBe(126);
  });

  it('CA-14: rango, paso y sin filas extra', () => {
    const adjusted = applyAdjustments(catalog, { personas: '60', ajustes: { 'm.desde': '30', 'm.hasta': '50', 'm.paso': '5', 'm.extra': '' } });
    if (!adjusted.ok) throw new Error('rechazado');
    expect(buildMatrix(adjusted.effective).rows).toEqual([30, 35, 40, 45, 50]);
    expect(adjusted.modified).toEqual(['m.hasta', 'm.paso', 'm.extra']);
  });

  it('acepta coma decimal; un valor igual al del JSON no cuenta como modificado', () => {
    expect(quote(60, { 'cb.horas': '4,5', 'm.extra': '300 200, 150' }).modified).toEqual([]);
    expect(quote(60, { 'cb.horas': '4,6' }).modified).toEqual(['cb.horas']);
  });

  it('nunca modifica el catálogo recibido', () => {
    quote(60, { 'i.carne-res.costo': '200', 'p.tradicional.on': '0' });
    expect(quote(60).packages[0]).toMatchObject({ id: 'tradicional', variableCost: 47.11 });
  });

  it('CA-15: cada caso inválido marca su campo y no calcula nada', () => {
    expect(Object.keys(rejected({ 'p.tradicional.f': '120' }))).toEqual(['p.tradicional.f']);
    expect(rejected({ 'p.tradicional.f': '120' })['p.tradicional.f']).toBe('Tarifa del paquete "Tradicional": el piso F (120) debe ser menor que la tarifa en la referencia b (120).');
    expect(Object.keys(rejected({ 'p.tradicional.a': '110' }))).toEqual(['p.tradicional.b']);
    expect(rejected({ 'po.min': '100' })).toHaveProperty(['po.ref']);
    expect(Object.keys(rejected({ 'i.carne-res.merma': '100', 'po.margen': '100' }))).toEqual(['i.carne-res.merma', 'po.margen']);
    const values = rejected({ 'cb.hora': '-1', 'cb.horas': 'abc', 'cb.kg': '', 'c.taco': 'Infinity', 'i.masa.costo': '1e3', 'i.queso.costo': '15.123', 'r.taco.masa': '1,5,0' });
    expect(Object.keys(values).sort()).toEqual(['c.taco', 'cb.hora', 'cb.horas', 'cb.kg', 'i.masa.costo', 'i.queso.costo', 'r.taco.masa']);
    expect(rejected({ 'cb.kg': '0' })).toHaveProperty(['cb.kg']);
    expect(rejected({ 'p.tradicional.q.taco': '0', 'p.tradicional.q.consome-500': '0', 'p.tradicional.q.agua-500': '0' })).toHaveProperty(['p.tradicional.q.taco']);
    const none = rejected(Object.fromEntries(PACKAGES.map((id) => [`p.${id}.on`, '0'])));
    expect(Object.keys(none)).toEqual(PACKAGES.map((id) => `p.${id}.on`));
    expect(rejected({ 'm.desde': '20' })).toHaveProperty(['m.desde']);
    expect(rejected({ 'm.hasta': '20' })).toHaveProperty(['m.hasta']);
    expect(rejected({ 'm.paso': '1' })).toHaveProperty(['m.paso']);
  });

  it('rechaza claves desconocidas, ajustes mal formados y personas fuera de rango', () => {
    expect(rejected({ 'p.inexistente.a': '1' })).toEqual({ '': 'El enlace tiene campos que ya no existen; restablece los valores.' });
    expect(applyAdjustments(catalog, { personas: '60', ajustes: [] })).toMatchObject({ ok: false, errors: { '': expect.any(String) } });
    for (const personas of ['', '0', '5001', '1.5', '-3', 'diez']) expect(rejected({}, personas)).toHaveProperty(['n']);
    expect(quote(5000).personas).toBe(5000);
  });
});

describe('validación del JSON (CA-21)', () => {
  const withChange = (change: (json: Record<string, unknown>) => void) => {
    const json = structuredClone(rawJson);
    change(json);
    return parseQuoteCatalog(json);
  };
  const packages = (json: Record<string, unknown>) => json.paquetes as { tarifa: Record<string, number>; items: { item: string }[] }[];

  it('F ≥ b: nombra el paquete y el campo', () => {
    const parsed = withChange((json) => {
      const tarifa = packages(json)[0]?.tarifa;
      if (tarifa) tarifa.f = 120;
    });
    expect(parsed).toEqual({
      ok: false,
      issues: [{ path: '$.paquetes[0].tarifa.f', message: 'Tarifa del paquete "Tradicional": el piso F (120) debe ser menor que la tarifa en la referencia b (120).' }],
    });
  });

  it('una referencia rota: nombra el paquete y el ítem', () => {
    const parsed = withChange((json) => {
      const item = packages(json)[1]?.items[0];
      if (item) item.item = 'tako';
    });
    expect(parsed).toEqual({ ok: false, issues: [{ path: '$.paquetes[1].items[0].item', message: 'Paquete "Mixto 1": el ítem "tako" no existe.' }] });
  });

  it('un valor fuera de rango y un campo desconocido', () => {
    const parsed = withChange((json) => {
      (json.politica as Record<string, number>).margenObjetivoPct = 100;
      json.extra = true;
    });
    expect(parsed).toMatchObject({ ok: false, issues: [{ path: '$.extra', message: 'Campo desconocido.' }] });
    const range = withChange((json) => {
      (json.politica as Record<string, number>).margenObjetivoPct = 100;
    });
    expect(range).toEqual({ ok: false, issues: [{ path: '$.politica.margenObjetivoPct', message: 'Política — Margen objetivo: Debe ser al menos 0 y menor que 100.' }] });
  });

  it('el origen de archivo: Molotes no tiene cotizador y un JSON ilegible deja el de Birria "no disponible"', async () => {
    const { logs, logger } = recordingLogger();
    const source = createFileQuoteCatalogSource({ files: { birria: new URL('./no-existe.json', import.meta.url) }, logger });
    await source.init();
    await expect(source.load('birria')).rejects.toBeInstanceOf(QuoteUnavailableError);
    await expect(source.load('molotes')).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect(logs).toEqual([{ msg: 'quote_catalog_invalid', fields: expect.objectContaining({ business: 'birria', reason: 'unreadable' }) }]);
  });
});
