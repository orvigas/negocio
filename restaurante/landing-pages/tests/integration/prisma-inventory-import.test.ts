import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { createInventoryRepository, runMasterImport } from '@restaurante/core/inventory';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';

import { makeDatabase, type TestDatabase } from '../support/database.ts';

/**
 * Importación única de datos maestros (REQ-F-050, A5 y CA-13) sobre MySQL 8.4 real, con el archivo
 * ficticio de la `api` (nunca datos reales): escritura todo o nada en una transacción, decimales
 * exactos, autor "Importación" en el historial y repetición sin cambios. Las reglas del plan se prueban
 * con el store en memoria en `api/tests/unit/inventory-import.test.ts`.
 */

const FIXTURE = new URL('../../../api/tests/fixtures/inventory-import/ficticio.json', import.meta.url);
const fixture = (): unknown => JSON.parse(readFileSync(FIXTURE, 'utf8'));

const databases: TestDatabase[] = [];
afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.cleanup();
});

async function setup() {
  const database = await makeDatabase();
  databases.push(database);
  const { prisma } = database;
  const store = createPrismaInventoryStore({ prisma, writeTimeoutMs: 60_000 });
  const counts = async () => ({
    categories: await prisma.inventoryCategory.count(),
    items: await prisma.inventoryItem.count(),
    units: await prisma.inventoryItemUnit.count(),
    skus: await prisma.inventorySku.count(),
    versions: await prisma.inventoryRecipeVersion.count(),
    lines: await prisma.inventoryRecipeLine.count(),
    changes: await prisma.inventoryChange.count(),
  });
  return { prisma, store, counts, run: (write: boolean) => runMasterImport({ store, input: fixture(), write }) };
}

describe('importación única en MySQL', () => {
  it('escribe todo en una transacción con decimales exactos y el autor "Importación"; repetirla no cambia nada', async () => {
    const { prisma, counts, run } = await setup();
    const dryRun = await run(false);
    expect(dryRun).toMatchObject({ written: false, errors: [], conflicts: [] });
    expect(await counts()).toEqual({ categories: 0, items: 0, units: 0, skus: 0, versions: 0, lines: 0, changes: 0 });

    const report = await run(true);
    expect(report).toMatchObject({ written: true, created: { categorias: 5, articulos: 13, variantes: 3, recetas: 3, lineas: 9 }, errors: [], conflicts: [] });
    const written = await counts();
    expect(written).toEqual({ categories: 5, items: 16, units: 2, skus: 1, versions: 3, lines: 9, changes: 24 });

    const authors = await prisma.inventoryChange.groupBy({ by: ['actorId', 'actorName'], _count: true });
    expect(authors).toEqual([{ actorId: null, actorName: 'Importación', _count: 24 }]);
    const versions = await prisma.inventoryRecipeVersion.findMany({ select: { number: true, validTo: true, createdById: true, createdByName: true } });
    expect(versions).toEqual(Array.from({ length: 3 }, () => ({ number: 1, validTo: null, createdById: null, createdByName: 'Importación' })));
    const carne = await prisma.inventoryItem.findFirstOrThrow({ where: { name: 'Carne cruda ficticia' }, select: { id: true } });
    const line = await prisma.inventoryRecipeLine.findFirstOrThrow({ where: { ingredientItemId: carne.id } });
    expect([line.quantity.toFixed(3), line.wastePercent.toFixed(2), line.grossBaseQuantity.toFixed(3)]).toEqual(['6.000', '40.00', '10.000']);
    const harina = await prisma.inventoryItem.findFirstOrThrow({ where: { name: 'Harina ficticia' }, select: { baseUnit: true, referenceCost: true } });
    expect([harina.baseUnit, harina.referenceCost?.toFixed(4)]).toEqual(['g', '0.0200']);

    const again = await run(true);
    expect(again).toMatchObject({ written: true, created: { categorias: 0, articulos: 0, variantes: 0, recetas: 0, lineas: 0 }, errors: [], conflicts: [] });
    expect(await counts()).toEqual(written);
  });

  it('un rechazo a mitad de la escritura (SKU que ya tuvo otro artículo) no deja nada escrito', async () => {
    const { prisma, store, counts, run } = await setup();
    const inventory = createInventoryRepository({ store });
    const author = { id: null, name: 'Prueba' };
    const category = await inventory.createCategory({ name: 'Otra categoría' }, author);
    const item = await inventory.createItem({ type: 'insumo', categoryId: category.id, name: 'Sal de otro proveedor', baseUnit: 'kg', sku: 'SAL-FIC-1' }, author);
    // El SKU queda registrado para ese artículo aunque cambie: el plan no lo ve, la escritura sí (PV-14).
    await inventory.updateItem(item.id, { categoryId: category.id, name: item.name, baseUnit: 'kg', sku: 'SAL-OTRO-2', version: item.version }, author);
    const before = await counts();

    const report = await run(true);
    expect(report.written).toBe(false);
    expect(report.errors).toEqual([{ fila: 'Ing!10', campo: 'sku', mensaje: 'Ese SKU ya se usó en otro artículo del inventario.' }]);
    expect(await counts()).toEqual(before);
    expect(await prisma.inventoryItem.findMany({ select: { name: true } })).toEqual([{ name: 'Sal de otro proveedor' }]);
  });
});
