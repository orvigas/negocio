import { describe, expect, it } from 'vitest';

import {
  inventoryCategoryResponseSchema,
  inventoryItemDetailResponseSchema,
  inventoryItemResponseSchema,
  itemKardexResponseSchema,
  kardexDocumentDetailResponseSchema,
  kardexDocumentListResponseSchema,
  kardexDocumentWriteResponseSchema,
  kardexOptionsResponseSchema,
  kardexReversalPreviewResponseSchema,
  stockResponseSchema,
  supplierDetailResponseSchema,
  supplierListResponseSchema,
  supplierResponseSchema,
  validationErrorSchema,
} from '@restaurante/contracts';

import { ADMIN, MANAGER, MOLOTES_EDITOR, call, session, startAdmin, type AdminHarness, type Session } from '../support/admin.ts';

/**
 * Proveedores, Kardex y existencias en `/api/v1/admin/inventario` (REQ-F-051, T3), en proceso con el
 * store en memoria: permisos (CA-21), CSRF, contrato de las respuestas (decimales como texto), códigos
 * de error propios (409, 422 por línea y 503), idempotencia persistente de los documentos (CA-12) y
 * la existencia en la ficha (RF-10). Las reglas se prueban en `inventory-kardex.test.ts` y la base en
 * `prisma-inventory-kardex.test.ts`. Datos ficticios.
 */

const I = '/api/v1/admin/inventario';
const TODAY = '2026-10-26';
const KEY = 'envio-de-compra-0000000001';

async function catalog(h: AdminHarness, auth: Session) {
  const res = await call(h.url, `${I}/categorias`, auth, { method: 'POST', body: { name: 'Abarrotes' } });
  const categoryId = inventoryCategoryResponseSchema.parse(await res.json()).category.id;
  const create = async (body: Record<string, unknown>) => {
    const created = await call(h.url, `${I}/articulos`, auth, { method: 'POST', body: { categoryId, ...body } });
    expect(created.status).toBe(201);
    return inventoryItemResponseSchema.parse(await created.json()).item;
  };
  const masa = await create({ type: 'insumo', name: 'Masa ficticia', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }] });
  const taco = await create({ type: 'compuesto', name: 'Taco ficticio', baseUnit: 'pza' });
  return { categoryId, masa, taco };
}

const purchaseBody = (itemId: number, quantity = '2', amount = '1000.00', unit = 'bulto') => ({ occurredOn: TODAY, lines: [{ itemId, quantity, unit, amount }] });

async function post(h: AdminHarness, auth: Session, path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await call(h.url, path, auth, { method: 'POST', body, headers });
  return { res, json: (await res.json()) as unknown };
}

describe('acceso (CA-21)', () => {
  const ROUTES = [
    { method: 'GET', path: `${I}/proveedores` },
    { method: 'GET', path: `${I}/proveedores/1` },
    { method: 'POST', path: `${I}/proveedores`, body: { name: 'Molino' } },
    { method: 'PUT', path: `${I}/proveedores/1`, body: { version: 1, name: 'Molino' } },
    { method: 'POST', path: `${I}/proveedores/1/desactivar`, body: { version: 1 } },
    { method: 'POST', path: `${I}/proveedores/1/reactivar`, body: { version: 1 } },
    { method: 'GET', path: `${I}/kardex/opciones` },
    { method: 'GET', path: `${I}/existencias` },
    { method: 'GET', path: `${I}/documentos` },
    { method: 'GET', path: `${I}/documentos/1` },
    { method: 'POST', path: `${I}/documentos/saldo-inicial`, body: { occurredOn: TODAY, lines: [] } },
    { method: 'POST', path: `${I}/documentos/compras`, body: purchaseBody(1) },
    { method: 'POST', path: `${I}/documentos/ajustes`, body: { occurredOn: TODAY, reason: 'otro', lines: [] } },
    { method: 'POST', path: `${I}/documentos/1/devoluciones`, body: { occurredOn: TODAY, lines: [] } },
    { method: 'GET', path: `${I}/documentos/1/reversion` },
    { method: 'POST', path: `${I}/documentos/1/reversion`, body: { reason: 'x' } },
    { method: 'GET', path: `${I}/articulos/1/kardex` },
    // DEF-003: con un id que no es numérico, el acceso se comprueba antes que el 404.
    { method: 'POST', path: `${I}/documentos/abc/devoluciones`, body: { occurredOn: TODAY, lines: [] } },
    { method: 'POST', path: `${I}/documentos/abc/reversion`, body: { reason: 'x' } },
  ];

  it('editor: 403 FORBIDDEN_ROLE en lectura y escritura; sin sesión, 401; sin CSRF, 403; y no se escribe nada', async () => {
    const h = await startAdmin({ users: [MOLOTES_EDITOR, MANAGER] });
    const eli = await session(h.url, MOLOTES_EDITOR);
    const gema = await session(h.url, MANAGER);
    for (const route of ROUTES) {
      const forbidden = await call(h.url, route.path, eli, { method: route.method, body: route.body });
      expect(forbidden.status, `${route.method} ${route.path}`).toBe(403);
      expect((await forbidden.json()).error.code).toBe('FORBIDDEN_ROLE');
      const anonymous = await call(h.url, route.path, null, { method: route.method, body: route.body });
      expect(anonymous.status, `${route.method} ${route.path}`).toBe(401);
      if (route.method !== 'GET') {
        const noCsrf = await call(h.url, route.path, gema, { method: route.method, body: route.body, csrf: null });
        expect(noCsrf.status, `${route.method} ${route.path}`).toBe(403);
        expect((await noCsrf.json()).error.code).toBe('CSRF_INVALID');
      }
    }
    expect(h.inventoryStore.state.documents).toHaveLength(0);
    expect(h.inventoryStore.state.suppliers).toHaveLength(0);
  });

  it('el gerente y el administrador usan todas las lecturas', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    for (const user of [ADMIN, MANAGER]) {
      const auth = await session(h.url, user);
      for (const path of [`${I}/proveedores`, `${I}/kardex/opciones`, `${I}/existencias`, `${I}/documentos`]) expect((await call(h.url, path, auth)).status, path).toBe(200);
    }
  });
});

describe('proveedores (RF-1, CA-22)', () => {
  it('alta, lista, ficha con historial, conflicto de versión con quién guardó y reactivación con el nombre en uso', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    const gema = await session(h.url, MANAGER);
    const ana = await session(h.url, ADMIN);
    const created = await post(h, gema, `${I}/proveedores`, { name: 'Molino ficticio', contact: 'ventas@molino.example' });
    expect(created.res.status).toBe(201);
    const molino = supplierResponseSchema.parse(created.json).supplier;
    expect(molino).toMatchObject({ name: 'Molino ficticio', contact: 'ventas@molino.example', active: true, version: 1 });

    const duplicated = await post(h, gema, `${I}/proveedores`, { name: 'MOLINO FICTICIO' });
    expect(duplicated.res.status).toBe(422);
    expect(validationErrorSchema.parse(duplicated.json).error.fields).toEqual({ name: 'Ya hay un proveedor activo con ese nombre.' });
    const badContact = await post(h, gema, `${I}/proveedores`, { name: 'Otro', contact: 'Calle 1' });
    expect(Object.keys(validationErrorSchema.parse(badContact.json).error.fields ?? {})).toEqual(['contact']);

    expect((await call(h.url, `${I}/proveedores/${molino.id}`, ana, { method: 'PUT', body: { version: 1, name: 'Molino ficticio SA', contact: null } })).status).toBe(200);
    const conflict = await call(h.url, `${I}/proveedores/${molino.id}`, gema, { method: 'PUT', body: { version: 1, name: 'Molino ficticio 2' } });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toMatchObject({ code: 'SUPPLIER_VERSION_CONFLICT', current: { id: molino.id, version: 2, updatedBy: 'Ana Admin' } });

    expect((await post(h, gema, `${I}/proveedores/${molino.id}/desactivar`, { version: 2 })).res.status).toBe(200);
    expect((await post(h, gema, `${I}/proveedores`, { name: 'Molino ficticio SA' })).res.status).toBe(201);
    const reactivate = await post(h, gema, `${I}/proveedores/${molino.id}/reactivar`, { version: 3 });
    expect(reactivate.res.status).toBe(422);

    const list = supplierListResponseSchema.parse(await (await call(h.url, `${I}/proveedores?estado=all&q=molino`, gema)).json());
    expect(list.suppliers.map((s) => [s.name, s.active])).toEqual([
      ['Molino ficticio SA', false],
      ['Molino ficticio SA', true],
    ]);
    const detail = supplierDetailResponseSchema.parse(await (await call(h.url, `${I}/proveedores/${molino.id}`, gema)).json());
    expect(detail.history.map((entry) => entry.action)).toEqual(['deactivate', 'update', 'create']);
    const badFilter = await call(h.url, `${I}/proveedores?estado=borrados`, gema);
    expect(validationErrorSchema.parse(await badFilter.json()).error.fields).toHaveProperty('estado');
    expect((await call(h.url, `${I}/proveedores/999`, gema)).status).toBe(404);
  });
});

describe('documentos (RF-2 a RF-6, RF-9)', () => {
  it('compra: 201 con decimales como texto; mismo envío, 200 y un solo documento; otra clave con otros datos, 422 (CA-12)', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { masa } = await catalog(h, gema);
    const first = await post(h, gema, `${I}/documentos/compras`, purchaseBody(masa.id), { 'Idempotency-Key': KEY });
    expect(first.res.status).toBe(201);
    expect(first.res.headers.get('location')).toMatch(/\/documentos\/\d+$/);
    const document = kardexDocumentWriteResponseSchema.parse(first.json).document;
    expect(document).toMatchObject({ type: 'compra', typeLabel: 'Compra', occurredOn: TODAY, totalCost: '1000.0000', costBasis: 'con_iva', author: 'Gema Gerente' });

    const again = await post(h, gema, `${I}/documentos/compras`, purchaseBody(masa.id), { 'Idempotency-Key': KEY });
    expect(again.res.status).toBe(200);
    expect(kardexDocumentWriteResponseSchema.parse(again.json)).toMatchObject({ replayed: true, document: { id: document.id } });
    const reused = await post(h, gema, `${I}/documentos/compras`, purchaseBody(masa.id, '3'), { 'Idempotency-Key': KEY });
    expect(reused.res.status).toBe(422);
    expect((reused.json as { error: { code: string } }).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(h.inventoryStore.state.documents).toHaveLength(1);

    const detail = kardexDocumentDetailResponseSchema.parse(await (await call(h.url, `${I}/documentos/${document.id}`, gema)).json());
    expect(detail.lines.map((l) => [l.itemName, l.quantity, l.enteredQuantity, l.enteredUnit, l.unitCost, l.avgCostAfter, l.returnable])).toEqual([['Masa ficticia', '50.000', '2.000', 'bulto', '20.0000', '20.0000', '50.000']]);
    const ficha = inventoryItemDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${masa.id}`, gema)).json());
    expect(ficha.item.stock).toEqual({ quantity: '50.000', avgCost: '20.0000', lastCost: '20.0000' });
  });

  it('422 por línea con las claves del contrato, campos desconocidos y 409 propios (saldo inicial, reversión, devoluciones)', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { masa, taco } = await catalog(h, gema);
    const invalid = await post(h, gema, `${I}/documentos/compras`, { occurredOn: '2026-10-27', lines: [{ itemId: taco.id, quantity: '1,5', unit: 'pza', amount: '10' }] });
    expect(invalid.res.status).toBe(422);
    expect(validationErrorSchema.parse(invalid.json).error.fields).toEqual({ occurredOn: 'La fecha no puede ser futura.', 'lines.0.quantity': 'Usa punto decimal, no coma (p. ej. 0.5).' });
    const unknown = await post(h, gema, `${I}/documentos/compras`, { ...purchaseBody(masa.id), lines: [{ itemId: masa.id, quantity: '1', unit: 'kg', amount: '1', price: '1' }] });
    expect(validationErrorSchema.parse(unknown.json).error.fields).toEqual({ 'lines.0.price': 'Campo desconocido.' });

    const saldo = { occurredOn: TODAY, lines: [{ itemId: masa.id, quantity: '12.5', unit: 'kg', unitCost: '18.5' }] };
    expect((await post(h, gema, `${I}/documentos/saldo-inicial`, saldo)).res.status).toBe(201);
    const second = await post(h, gema, `${I}/documentos/saldo-inicial`, saldo);
    expect(second.res.status).toBe(409);
    expect((second.json as { error: unknown }).error).toMatchObject({ code: 'INITIAL_BALANCE_NOT_ALLOWED', items: [{ itemId: masa.id, name: 'Masa ficticia' }] });

    const bought = kardexDocumentWriteResponseSchema.parse((await post(h, gema, `${I}/documentos/compras`, purchaseBody(masa.id, '25', '600.00', 'kg'))).json).document;
    const lineId = kardexDocumentDetailResponseSchema.parse(await (await call(h.url, `${I}/documentos/${bought.id}`, gema)).json()).lines[0]?.id;
    const returned = await post(h, gema, `${I}/documentos/${bought.id}/devoluciones`, { occurredOn: TODAY, lines: [{ sourceMovementId: lineId, quantity: '5' }] });
    expect(returned.res.status).toBe(201);
    const returnId = kardexDocumentWriteResponseSchema.parse(returned.json).document.id;
    const blocked = await post(h, gema, `${I}/documentos/${bought.id}/reversion`, { reason: 'error' });
    expect(blocked.res.status).toBe(409);
    expect((blocked.json as { error: unknown }).error).toMatchObject({ code: 'DOCUMENT_HAS_RETURNS', returnIds: [returnId] });

    const preview = kardexReversalPreviewResponseSchema.parse(await (await call(h.url, `${I}/documentos/${returnId}/reversion`, gema)).json());
    expect(preview.lines.map((l) => [l.quantity, l.unitCost, l.negative])).toEqual([['5.000', '24.0000', false]]);
    const reversal = await post(h, gema, `${I}/documentos/${returnId}/reversion`, { reason: 'No salió' });
    expect(reversal.res.status).toBe(201);
    const reversalId = kardexDocumentWriteResponseSchema.parse(reversal.json).document.id;
    expect((await post(h, gema, `${I}/documentos/${returnId}/reversion`, { reason: 'otra' })).json).toMatchObject({ error: { code: 'ALREADY_REVERSED' } });
    expect((await post(h, gema, `${I}/documentos/${reversalId}/reversion`, { reason: 'otra' })).json).toMatchObject({ error: { code: 'REVERSAL_NOT_REVERSIBLE' } });
    expect((await post(h, gema, `${I}/documentos/${reversalId}/devoluciones`, { occurredOn: TODAY, lines: [{ sourceMovementId: 1, quantity: '1' }] })).json).toMatchObject({ error: { code: 'DOCUMENT_NOT_RETURNABLE' } });
    expect((await call(h.url, `${I}/documentos/999`, gema)).status).toBe(404);
  });

  it('DEF-001: un valor que no cabe en sus columnas es 422 en el campo, no 503', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { masa } = await catalog(h, gema);
    const huge = await post(h, gema, `${I}/documentos/saldo-inicial`, { occurredOn: TODAY, lines: [{ itemId: masa.id, quantity: '9999999999.999', unit: 'kg', unitCost: '99999999999.9999' }] });
    expect(huge.res.status).toBe(422);
    expect(validationErrorSchema.parse(huge.json).error.fields).toHaveProperty(['lines.0.quantity']);
  });

  it('503 INVENTORY_BUSY si otra escritura retiene el bloqueo: no se escribe nada', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { masa } = await catalog(h, gema);
    h.inventoryStore.failNext(1, 'busy');
    const busy = await post(h, gema, `${I}/documentos/compras`, purchaseBody(masa.id));
    expect(busy.res.status).toBe(503);
    expect((busy.json as { error: { code: string } }).error.code).toBe('INVENTORY_BUSY');
    expect(h.inventoryStore.state.documents).toHaveLength(0);
  });
});

describe('lecturas (RF-7, RF-8, RF-9)', () => {
  it('existencias con totales y filtros en español, lista de documentos, Kardex paginado y opciones de los formularios', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { masa, taco, categoryId } = await catalog(h, gema);
    // OBS-27: la compra lleva una fecha del hecho distinta de la de registro (2026-10-26).
    await post(h, gema, `${I}/documentos/compras`, { ...purchaseBody(masa.id), occurredOn: '2026-10-20' });
    await post(h, gema, `${I}/documentos/ajustes`, { occurredOn: TODAY, reason: 'error_captura', lines: [{ itemId: masa.id, direction: 'salida', quantity: '60', unit: 'kg' }] });

    const stock = stockResponseSchema.parse(await (await call(h.url, `${I}/existencias?estado=negativos`, gema)).json());
    expect(stock.entries.map((e) => [e.item.name, e.quantity, e.avgCost, e.value, e.negative])).toEqual([['Masa ficticia', '-10.000', '20.0000', '-200.00', true]]);
    expect(stock.totals).toEqual({ positiveValue: '0.00', negativeValue: '-200.00', noCostCount: 0 });
    const badStock = await call(h.url, `${I}/existencias?estado=raro&pagina=0`, gema);
    expect(Object.keys(validationErrorSchema.parse(await badStock.json()).error.fields ?? {}).sort()).toEqual(['estado']);

    const documents = kardexDocumentListResponseSchema.parse(await (await call(h.url, `${I}/documentos?tipo=compra`, gema)).json());
    expect(documents.documents.map((d) => d.type)).toEqual(['compra']);
    const badDocs = await call(h.url, `${I}/documentos?pagina=0`, gema);
    expect(validationErrorSchema.parse(await badDocs.json()).error.fields).toHaveProperty('pagina');

    // DEF-004 (RN-T3-1): un Compuesto y un no inventariable no llevan existencias: la ficha y su Kardex dan `stock: null`.
    const mano = inventoryItemResponseSchema.parse(
      (await post(h, gema, `${I}/articulos`, { categoryId, type: 'insumo', name: 'Mano de obra ficticia', baseUnit: 'hr', inventoriable: false, referenceCost: '80' })).json,
    ).item;
    for (const item of [taco, mano]) {
      expect(inventoryItemDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${item.id}`, gema)).json()).item.stock, item.name).toBeNull();
      expect(itemKardexResponseSchema.parse(await (await call(h.url, `${I}/articulos/${item.id}/kardex`, gema)).json()).stock, item.name).toBeNull();
    }

    const kardex = itemKardexResponseSchema.parse(await (await call(h.url, `${I}/articulos/${masa.id}/kardex`, gema)).json());
    // OBS-21 y OBS-27: cada movimiento lleva la fecha del hecho de su documento (RF-8), no la de registro.
    expect(kardex.movements.map((m) => m.occurredOn)).toEqual([TODAY, '2026-10-20']);
    expect(kardex.movements.map((m) => [m.seq, m.typeLabel, m.balanceAfter])).toEqual([
      [2, 'Ajuste', '-10.000'],
      [1, 'Compra', '50.000'],
    ]);
    expect(kardex.stock).toEqual({ quantity: '-10.000', avgCost: '20.0000', lastCost: '20.0000' });
    expect((await call(h.url, `${I}/articulos/999/kardex`, gema)).status).toBe(404);

    const options = kardexOptionsResponseSchema.parse(await (await call(h.url, `${I}/kardex/opciones`, gema)).json());
    expect(options.items.map((i) => [i.name, i.avgCost, i.initialBalanceAllowed])).toEqual([['Masa ficticia', '20.0000', false]]);
    // «Hoy» en BUSINESS_TIMEZONE para la fecha del hecho de los formularios (RN-T3-3).
    expect(options.today).toBe(TODAY);
  });
});
