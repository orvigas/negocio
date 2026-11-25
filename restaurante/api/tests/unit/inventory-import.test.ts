import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createMemoryInventoryStore, createRecipeRepository, formatDecimal, runMasterImport, type ImportReport } from '@restaurante/core/inventory';

import {
  fictitiousRefusal,
  formatImportReport,
  importExitCode,
  importRefusal,
  parseImportArgs,
  parseJson,
  readLimited,
} from '../../scripts/support/inventory-import-cli.ts';

/**
 * Importación única de datos maestros (REQ-F-050, A5 y CA-13) sobre el store en memoria, con el
 * archivo ficticio de `tests/fixtures/inventory-import/` (misma estructura que el real, que nunca entra
 * al repositorio), y las salvaguardas del comando. La escritura en MySQL (todo o nada) se prueba en
 * `landing-pages/tests/integration/prisma-inventory-import.test.ts`.
 */

const FIXTURE = new URL('../fixtures/inventory-import/ficticio.json', import.meta.url);
const NOW = new Date('2026-11-20T18:00:00.000Z');

type Fixture = Record<string, unknown> & {
  articulos: Record<string, unknown>[];
  padres: (Record<string, unknown> & { variantes: Record<string, unknown>[] })[];
  recetas: (Record<string, unknown> & { lineas: Record<string, unknown>[] })[];
};
const fixture = (): Fixture => JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture;

function setup() {
  const store = createMemoryInventoryStore();
  const run = (input: unknown, write: boolean) => runMasterImport({ store, input, write, now: () => NOW });
  const snapshot = () => JSON.stringify({ ...store.state, skus: [...store.state.skus], inUse: [...store.state.inUse] }, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));
  return { store, run, snapshot };
}

const EXPECTED = { categorias: 5, articulos: 13, variantes: 3, recetas: 3, lineas: 9 };
const NOTHING = { categorias: 0, articulos: 0, variantes: 0, recetas: 0 };
const issuesOf = (report: ImportReport) => [...report.errors, ...report.conflicts].map(({ fila, campo }) => `${fila} ${campo}`);

describe('importación única (A5, CA-13)', () => {
  it('el ensayo valida y cuenta sin escribir nada', async () => {
    const { store, run, snapshot } = setup();
    const before = snapshot();
    const report = await run(fixture(), false);
    expect(report).toMatchObject({ mode: 'ensayo', written: false, ficticio: true, created: EXPECTED, omitted: NOTHING, errors: [], conflicts: [], warnings: [] });
    expect(snapshot()).toBe(before);
    expect(store.state.items).toHaveLength(0);
  });

  it('la escritura crea los conteos esperados, con correcciones, unidades del libro, variantes únicas, versión 1 y autor "Importación"', async () => {
    const { store, run } = setup();
    const report = await run(fixture(), true);
    expect(report).toMatchObject({ mode: 'escritura', written: true, created: EXPECTED, errors: [], conflicts: [] });
    const { items, categories, recipeVersions, changes } = store.state;
    expect(categories).toHaveLength(5);
    expect(items).toHaveLength(16);
    const byName = new Map(items.map((item) => [item.name, item]));
    // Correcciones (coincidencia exacta tras recortar) y unidades del libro (gr -> g, lt -> L).
    expect(byName.has('Tortilla ficticia')).toBe(true);
    expect([...byName.keys()].some((name) => name.includes('Tortiya'))).toBe(false);
    expect([byName.get('Harina ficticia')?.baseUnit, byName.get('Aceite ficticio')?.baseUnit, byName.get('Gas ficticio')?.baseUnit]).toEqual(['g', 'L', 'hr']);
    expect(byName.get('Gas ficticio')).toMatchObject({ inventoriable: false, referenceCost: 250_000n });
    expect(byName.get('Cebolla ficticia')?.referenceCost).toBeNull();
    // Variantes con nombre completo y únicas, bajo su padre.
    const parent = byName.get('Refresco ficticio');
    const variants = items.filter((item) => item.parentId === parent?.id).map((item) => item.name);
    expect(variants.sort()).toEqual(['Refresco Marca Dos Cola 600 ml', 'Refresco Marca Uno Cola 600 ml', 'Refresco Marca Uno Naranja 600 ml']);
    expect(new Set(items.map((item) => item.nameKey)).size).toBe(items.length);
    // Recetas como versión 1, vigentes desde la importación, con el autor "Importación".
    expect(recipeVersions.map((version) => [version.number, version.validFrom.toISOString(), version.validTo, version.createdById, version.createdByName])).toEqual(
      Array.from({ length: 3 }, () => [1, NOW.toISOString(), null, null, 'Importación']),
    );
    expect(new Set(changes.map((change) => change.actorName))).toEqual(new Set(['Importación']));
    expect(changes.filter((change) => change.entity === 'recipe').map((change) => change.action)).toEqual(['new_version', 'new_version', 'new_version']);
    expect(store.state.skus.get('SAL-FIC-1')?.itemId).toBe(byName.get('Sal ficticia')?.id);

    // La merma de cocción va en la línea (RN-T2-1) y el costo es el del cálculo a mano.
    const recipes = createRecipeRepository({ store, now: () => NOW });
    const carne = await recipes.getRecipe(byName.get('Carne cocida ficticia')?.id ?? 0);
    expect(carne.current?.version.lines.map((line) => [formatDecimal(line.netBaseQuantity), formatDecimal(line.wastePercent, 2), formatDecimal(line.grossBaseQuantity)])).toEqual([
      ['6.000', '40.00', '10.000'],
      ['2.000', '0.00', '2.000'],
    ]);
    expect(formatDecimal(carne.current?.cost.unitCost ?? -1n, 4)).toBe('258.3333');
    const salsa = await recipes.getRecipe(byName.get('Salsa ficticia')?.id ?? 0);
    expect(formatDecimal(salsa.current?.cost.unitCost ?? -1n, 4)).toBe('7.1000');
    const taco = await recipes.getRecipe(byName.get('Taco ficticio')?.id ?? 0);
    expect(taco.current?.cost.unitCost).toBeNull();
    expect(taco.current?.cost.missing.map((entry) => entry.name)).toEqual(['Cebolla ficticia']);
  });

  it('repetir con los mismos datos no crea nada; un dato distinto es un conflicto y no se escribe nada (PT-2)', async () => {
    const { run, snapshot } = setup();
    await run(fixture(), true);
    const after = snapshot();
    const again = await run(fixture(), true);
    expect(again).toMatchObject({ written: true, created: { categorias: 0, articulos: 0, variantes: 0, recetas: 0, lineas: 0 }, omitted: { categorias: 5, articulos: 13, variantes: 3, recetas: 3 }, errors: [], conflicts: [] });
    expect(snapshot()).toBe(after);

    const changed = fixture();
    changed.articulos[5] = { ...changed.articulos[5], costoReferencia: '11.0000' };
    changed.articulos.push({ nombre: 'Orégano ficticio', tipo: 'insumo', categoria: 'Abarrotes ficticios', unidadBase: 'gr', fila: 'Ing!15' });
    const firstLine = changed.recetas[0]?.lineas[0];
    if (firstLine) firstLine.cantidad = '600';
    // DEF-005: el conflicto de una receta señala el campo que difiere, no siempre las líneas.
    const second = changed.recetas[1];
    if (second) second.rendimiento = '9.000';
    const conflicted = await run(changed, true);
    expect(conflicted.written).toBe(false);
    expect(conflicted.conflicts.map(({ fila, campo }) => `${fila} ${campo}`)).toEqual(['Ing!10 costoReferencia', 'Rec!2 lineas', `${String(second?.fila)} rendimiento`]);
    expect(conflicted.created.articulos).toBe(1);
    expect(snapshot()).toBe(after);
  });

  it('un ciclo o una unidad inválida no escriben nada y listan cada error con su fila, sin valores', async () => {
    const { run, snapshot } = setup();
    const before = snapshot();
    const cyclic = fixture();
    cyclic.recetas[0]?.lineas.push({ ingrediente: 'Carne cocida ficticia', cantidad: '1', unidad: 'kg', fila: 'Rec!5b' });
    cyclic.recetas[1]?.lineas.push({ ingrediente: 'Salsa ficticia', cantidad: '1', unidad: 'lt', fila: 'Rec!8b' });
    cyclic.articulos[6] = { ...cyclic.articulos[6], unidadBase: 'lb' };
    const report = await run(cyclic, true);
    expect(report.written).toBe(false);
    expect(issuesOf(report)).toEqual(['Ing!11 unidadBase', 'Rec!2 lineas']);
    expect(report.errors.find((issue) => issue.fila === 'Rec!2')?.mensaje).toBe('La receta se contendría a sí misma: Rec!2 → Rec!6 → Rec!2.');
    expect(JSON.stringify(report)).not.toMatch(/Salsa|Carne|Comino/);
    expect(snapshot()).toBe(before);
  });

  it('errores de contenido con la clave del archivo: merma del 100 %, coma decimal, nombre repetido, Compuesto como ingrediente y corrección sin usar', async () => {
    const { run } = setup();
    const file = fixture();
    const [salsa, carne, taco] = file.recetas;
    if (!salsa || !carne || !taco) throw new Error('fixture incompleto');
    Object.assign(carne.lineas[0] ?? {}, { merma: '100.00' });
    Object.assign(salsa.lineas[1] ?? {}, { cantidad: '0,100' });
    file.padres[0]?.variantes.push({ nombre: 'refresco marca uno cola 600 ML', unidadBase: 'pza', fila: 'Prod!10' });
    taco.lineas.push({ ingrediente: 'Taco ficticio', cantidad: '1', unidad: 'pza', fila: 'Rec!13c' });
    file.correcciones = [...(file.correcciones as unknown[]), { original: 'Nada ficticio', corregido: 'Otro ficticio' }];
    const report = await run(file, false);
    expect(issuesOf(report).sort()).toEqual(['Prod!10 nombre', 'Rec!13c ingrediente', 'Rec!4 cantidad', 'Rec!7 merma']);
    expect(report.warnings).toEqual([{ fila: 'correcciones.1', campo: 'original', mensaje: 'La corrección no se usó en ningún nombre.' }]);
  });

  it('la forma del archivo es cerrada: formato, versión, claves desconocidas y tipos', async () => {
    const { run } = setup();
    const report = await run({ ...fixture(), formato: 'otro', version: 2, extra: true, articulos: [{ nombre: 1, fila: 'Ing!2', precio: '3' }] }, true);
    expect(report.written).toBe(false);
    expect(report.errors.map(({ fila, campo }) => `${fila} ${campo}`)).toEqual(
      expect.arrayContaining(['$ extra', '$ formato', '$ version', 'Ing!2 precio', 'Ing!2 nombre', 'Ing!2 tipo', 'Ing!2 categoria', 'Ing!2 unidadBase']),
    );
    expect((await run('no es un objeto', false)).errors).toEqual([{ fila: '$', campo: '', mensaje: 'Debe ser un objeto.' }]);
  });
});

describe('comando inventory:import: argumentos, salvaguardas e informe', () => {
  it('argumentos: --archivo obligatorio, ensayo por defecto y nada desconocido', () => {
    expect(parseImportArgs(['--archivo', 'datos.json'])).toEqual({ ok: true, args: { file: 'datos.json', write: false, production: false } });
    expect(parseImportArgs(['--archivo', '-', '--escribir', '--produccion'])).toEqual({ ok: true, args: { file: '-', write: true, production: true } });
    expect(parseImportArgs(['--escribir']).ok).toBe(false);
    expect(parseImportArgs(['--archivo']).ok).toBe(false);
    expect(parseImportArgs(['--archivo', 'a.json', '--forzar']).ok).toBe(false);
    // DEF-006: un --archivo repetido no elige uno en silencio.
    expect(parseImportArgs(['--archivo', 'a.json', '--archivo', 'b.json'])).toMatchObject({ ok: false, message: expect.stringContaining('Uso:') as unknown });
  });

  it('salvaguardas: production exige --produccion; fuera de producción, solo base local; nunca el archivo ficticio en producción', () => {
    expect(importRefusal({ nodeEnv: 'production', host: 'mysql', production: true })).toBeNull();
    expect(importRefusal({ nodeEnv: 'production', host: 'mysql', production: false })).toMatch(/--produccion/);
    expect(importRefusal({ nodeEnv: 'development', host: '127.0.0.1', production: false })).toBeNull();
    expect(importRefusal({ nodeEnv: undefined, host: 'mysql-dev', production: false })).toBeNull();
    expect(importRefusal({ nodeEnv: 'development', host: '10.0.0.5', production: false })).toMatch(/base local/);
    expect(importRefusal({ nodeEnv: 'development', host: '127.0.0.1', production: true })).toMatch(/NODE_ENV=production/);
    expect(fictitiousRefusal({ production: true, ficticio: true })).toMatch(/ficticio/);
    expect(fictitiousRefusal({ production: true, ficticio: false })).toBeNull();
    expect(fictitiousRefusal({ production: false, ficticio: true })).toBeNull();
  });

  it('lectura acotada (2 MB) y JSON estricto, sin repetir el contenido', async () => {
    async function* chunks(...parts: string[]) {
      yield* parts;
    }
    expect(await readLimited(chunks('{"a":', '1}'), 16)).toEqual({ ok: true, text: '{"a":1}' });
    expect((await readLimited(chunks('x'.repeat(10), 'y'.repeat(10)), 16)).ok).toBe(false);
    expect(parseJson('{"a":1}')).toEqual({ ok: true, data: { a: 1 } });
    expect(parseJson('{"secreto": 1,}')).toEqual({ ok: false, message: 'El archivo no es un JSON válido.' });
  });

  it('el informe solo lleva conteos y filas, sin nombres ni costos, y sale con 1 si hay problemas', async () => {
    const { run } = setup();
    const ok = await run(fixture(), false);
    const text = formatImportReport(ok);
    expect(text).toContain('Se crearían: categorías 5, artículos 13, variantes 3, recetas 3, líneas 9.');
    expect(text).not.toMatch(/Harina|Carne|Salsa|Tortilla|150\.0000|40\.00/);
    expect(importExitCode(ok)).toBe(0);
    const bad = await run({ ...fixture(), version: 9 }, false);
    expect(formatImportReport(bad)).toContain('  - $ [version]: Versión de formato no admitida (se admite 1).');
    expect(importExitCode(bad)).toBe(1);
  });
});
