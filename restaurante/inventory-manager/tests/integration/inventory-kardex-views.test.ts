import { describe, expect, it } from 'vitest';

import type { InventoryItem, KardexDocument, KardexDocumentDetailResponse } from '@restaurante/contracts';

import type { DoubleUser } from '../support/api-double.ts';
import { ANA, ELI, GEMA, dom, formFields, startInventory, type Harness } from '../support/browser.ts';

/**
 * Pantallas del Kardex (REQ-F-051, T3; PR 3a) contra el doble de /api/v1/admin/inventario, sin
 * JavaScript: existencias valorizadas (RF-7, CA-16), Kardex y costo en la ficha (RF-8, RF-10, CA-17),
 * proveedores (RF-1, CA-22), documentos y reversión con confirmación (RF-4, RF-9, CA-6), permisos (CA-21),
 * la clave de envío en cada escritura (OBS-16) y OBS-12 (a) y (c). Las reglas y los números están en
 * api/tests (core y la API). Datos ficticios.
 */

const AT = '2026-11-26T10:00:00-06:00';
let next = 300;

function addItem(h: Harness, name: string, type: InventoryItem['type'], extra: Partial<InventoryItem> = {}): InventoryItem {
  const item: InventoryItem = { id: ++next, kind: 'simple', type, parentId: null, categoryId: 1, name, description: null, sku: null, baseUnit: 'kg', units: [], active: true, version: 1, createdAt: AT, updatedAt: AT, updatedBy: 'Semilla', referenceCost: null, inventoriable: true, ...extra };
  h.api.inventory.items.push(item);
  return item;
}

function purchase(id: number, extra: Partial<KardexDocument> = {}): KardexDocument {
  return { id, type: 'compra', typeLabel: 'Compra', occurredOn: '2026-11-26', recordedAt: AT, supplier: { id: 1, name: 'Molino ficticio' }, reference: 'F-1', costBasis: 'con_iva', reason: null, note: null, totalCost: '1000.0000', reversesDocumentId: null, reversedById: null, sourceDocumentId: null, author: 'Gema Gerente', ...extra };
}

async function as(user: DoubleUser) {
  const h = await startInventory({ users: [ANA, ELI, GEMA] });
  h.api.inventory.categories.push({ id: 1, name: 'Abarrotes ficticios', active: true, createdAt: AT, updatedAt: AT });
  const masa = addItem(h, 'Masa ficticia', 'insumo', { units: [{ name: 'bulto', factor: '25.000' }] });
  const browser = h.browser();
  expect((await browser.login(user)).status).toBe(303);
  return { h, browser, masa };
}

const text = (html: string) => dom(html).body.textContent?.replace(/\s+/g, ' ') ?? '';

function seedDocument(h: Harness, masa: InventoryItem, document: KardexDocument): KardexDocumentDetailResponse {
  const detail: KardexDocumentDetailResponse = {
    document,
    lines: [
      { id: 1, documentId: document.id, line: 1, itemId: masa.id, seq: 1, type: document.type, typeLabel: document.typeLabel, quantity: '50.000', enteredQuantity: '2.000', enteredUnit: 'bulto', balanceBefore: '0.000', balanceAfter: '50.000', unitCost: '20.0000', lineTotal: '1000.0000', avgCostBefore: null, avgCostAfter: '20.0000', sourceMovementId: null, recordedAt: AT, author: 'Gema Gerente', itemName: masa.name, baseUnit: 'kg', returnable: '50.000' },
    ],
    returns: [],
  };
  h.api.inventory.kardex.documents.set(document.id, detail);
  return detail;
}

describe('acceso (CA-21) y vuelta tras el acceso (OBS-12 a)', () => {
  it('el Editor no ve las secciones y recibe 403 sin pedir datos', async () => {
    const { browser } = await as(ELI);
    for (const path of ['/inventario/existencias', '/inventario/proveedores', '/inventario/documentos', '/inventario/documentos/1/revertir']) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(403);
      expect(text(await res.text())).not.toContain('Existencias');
    }
  });

  it('sin sesión, una pantalla del inventario vuelve a sí misma (con su query) tras el acceso; un destino externo se ignora', async () => {
    const h = await startInventory({ users: [GEMA] });
    const browser = h.browser();
    const res = await browser.get('/inventario/existencias?estado=negativos');
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location') ?? '', h.url);
    expect(location.pathname).toBe('/acceso');
    expect(location.searchParams.get('next')).toBe('/inventario/existencias?estado=negativos');
    const login = await browser.login(GEMA, '/inventario/existencias?estado=negativos');
    expect(login.headers.get('location')).toBe('/inventario/existencias?estado=negativos');
    // OBS-20: el patrón de /inventario no admite otro origen, «//», «..» ni caracteres fuera de una query codificada.
    for (const hostile of ['//sitio-ajeno.example/inventario', '/inventario//sitio-ajeno.example', '/inventario/../usuarios', '/inventario\\sitio-ajeno.example', '/inventario/existencias?x=<script>', 'https://sitio-ajeno.example/inventario']) {
      const other = h.browser();
      expect((await other.login(GEMA, hostile)).headers.get('location'), hostile).toBe('/');
    }
  });
});

describe('existencias (RF-7, CA-16) y página fuera de rango (OBS-12 c)', () => {
  it('muestra la tabla con caption, estados con texto y totales; sin «N resultados» y «No hay…» a la vez fuera de rango', async () => {
    const { h, browser, masa } = await as(GEMA);
    h.api.inventory.kardex.stock = {
      entries: [
        { item: { id: masa.id, name: masa.name, kind: 'simple', type: 'insumo', baseUnit: 'kg', active: true }, categoryName: 'Abarrotes ficticios', quantity: '-2.000', avgCost: '20.0000', lastCost: '24.0000', value: '-40.00', negative: true, noCost: false },
        { item: { id: 999, name: 'Cebolla ficticia', kind: 'simple', type: 'insumo', baseUnit: 'kg', active: false }, categoryName: 'Abarrotes ficticios', quantity: '1.000', avgCost: null, lastCost: null, value: null, negative: false, noCost: true },
      ],
      totals: { positiveValue: '0.00', negativeValue: '-40.00', noCostCount: 1 },
      page: { number: 1, size: 50, total: 2 },
    };
    const html = await (await browser.get('/inventario/existencias')).text();
    const page = dom(html);
    expect(page.querySelector('caption')?.textContent).toContain('Existencias valorizadas');
    expect(page.querySelector('a[aria-current="true"]')?.textContent).toBe('Existencias');
    const body = text(html);
    // REQUIREMENT_AMBIGUITY-1 (opción A): los costos unitarios con 4 decimales; los valores, con 2.
    for (const expected of ['−2 kg', '$20.0000 / kg', '$24.0000 / kg', '−$40.00', 'Negativo', 'Sin costo', 'Inactivo', '2 artículos.', 'Artículos sin costo']) expect(body).toContain(expected);

    const out = text(await (await browser.get('/inventario/existencias?pagina=3')).text());
    expect(out).toContain('Esta página no existe: hay 2 artículos en 1 página.');
    expect(out).not.toContain('2 artículos.');
    expect(out).not.toContain('No hay');
    // También en la lista de artículos de T1.
    const items = text(await (await browser.get('/inventario/articulos?pagina=4')).text());
    expect(items).toContain('Esta página no existe');
    expect(items).not.toContain('No hay artículos');

    const invalid = await browser.get('/inventario/existencias?estado=raro');
    expect(invalid.status).toBe(422);
    expect(text(await invalid.text())).toContain('Revisa los filtros.');
  });
});

describe('ficha: costo real y Kardex (RF-8, RF-10, CA-17)', () => {
  it('muestra existencia, CPP y último costo, y el Kardex con enlace al documento; un Compuesto no lleva Kardex', async () => {
    const { h, browser, masa } = await as(GEMA);
    const item = h.api.inventory.items.find((entry) => entry.id === masa.id);
    if (!item) throw new Error('falta el artículo');
    Object.assign(item, { stock: { quantity: '50.000', avgCost: '20.0000', lastCost: '20.0000' } });
    h.api.inventory.kardex.kardex.set(masa.id, {
      item: { id: masa.id, name: masa.name, kind: 'simple', type: 'insumo', baseUnit: 'kg', active: true },
      stock: { quantity: '50.000', avgCost: '20.0000', lastCost: '20.0000' },
      movements: [{ id: 1, documentId: 7, line: 1, itemId: masa.id, seq: 1, type: 'compra', typeLabel: 'Compra', quantity: '50.000', enteredQuantity: '2.000', enteredUnit: 'bulto', balanceBefore: '0.000', balanceAfter: '50.000', unitCost: '20.0000', lineTotal: '1000.0000', avgCostBefore: null, avgCostAfter: '20.0000', sourceMovementId: null, recordedAt: AT, author: 'Gema Gerente', occurredOn: '2026-11-25' }],
      page: { number: 1, size: 50, total: 1 },
    });
    const html = await (await browser.get(`/inventario/articulos/${masa.id}`)).text();
    const body = text(html);
    for (const expected of ['Existencia', '50 kg', 'Costo promedio (CPP)', '$20.0000 / kg', 'Último costo', 'Kardex', '25/11/2026', '+2 bulto', '+50 kg', '$20.0000', '1 movimiento.']) expect(body).toContain(expected);
    expect(dom(html).querySelector('section[aria-labelledby="kardex"] a[href="/inventario/documentos/7"]')?.textContent).toBe('#7');
    expect(dom(html).querySelector('section[aria-labelledby="kardex"] caption')).not.toBeNull();

    const taco = addItem(h, 'Taco ficticio', 'compuesto', { baseUnit: 'pza' });
    const tacoHtml = await (await browser.get(`/inventario/articulos/${taco.id}`)).text();
    expect(dom(tacoHtml).querySelector('#kardex')).toBeNull();
    expect(text(tacoHtml)).toContain('No lleva existencias');
  });
});

describe('proveedores (RF-1, CA-22)', () => {
  it('alta con Idempotency-Key (OBS-16), error por campo, conflicto de versión con lo escrito conservado e inactivación', async () => {
    const { h, browser } = await as(GEMA);
    const form = await (await browser.get('/inventario/proveedores/nuevo')).text();
    const fields = formFields(form, '#inventory-supplier-form');
    expect(fields.requestId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const created = await browser.post('/inventario/proveedores', { ...fields, action: 'create', name: 'Molino ficticio', contact: 'ventas@molino.example' });
    expect(created.status).toBe(303);
    expect(h.api.inventory.kardex.keys).toContain(fields.requestId);
    expect(text(await (await browser.get(created.headers.get('location') ?? '')).text())).toContain('Proveedor creado.');

    const repeated = await browser.post('/inventario/proveedores', { ...formFields(await (await browser.get('/inventario/proveedores/nuevo')).text(), '#inventory-supplier-form'), action: 'create', name: 'MOLINO FICTICIO' });
    expect(repeated.status).toBe(422);
    const repeatedPage = dom(await repeated.text());
    expect(repeatedPage.querySelector('#f-name')?.getAttribute('aria-invalid')).toBe('true');
    expect(repeatedPage.body.textContent).toContain('Ya hay un proveedor activo con ese nombre.');

    const supplier = h.api.inventory.kardex.suppliers[0];
    if (!supplier) throw new Error('falta el proveedor');
    const edit = await (await browser.get(`/inventario/proveedores/${supplier.id}/editar`)).text();
    h.api.inventory.kardex.touchSupplier(supplier.id, 'Ana Admin');
    const conflict = await browser.post(`/inventario/proveedores/${supplier.id}`, { ...formFields(edit, '#inventory-supplier-form'), action: 'update', name: 'Molino ficticio SA' });
    expect(conflict.status).toBe(409);
    const conflictHtml = await conflict.text();
    expect(text(conflictHtml)).toContain('Ana Admin guardó cambios mientras lo editabas');
    expect(dom(conflictHtml).querySelector('#f-name')?.getAttribute('value')).toBe('Molino ficticio SA');
    expect(dom(conflictHtml).querySelector('button[value="overwrite"]')).not.toBeNull();
    const overwrite = await browser.post(`/inventario/proveedores/${supplier.id}`, { ...formFields(conflictHtml, '#inventory-supplier-form'), action: 'overwrite' });
    expect(overwrite.status).toBe(303);
    expect(supplier.name).toBe('Molino ficticio SA');

    const list = await (await browser.get('/inventario/proveedores')).text();
    const status = dom(list).querySelector('form.inventory-status');
    expect(status?.textContent).toContain('Inactivar');
    const deactivate = await browser.post(status?.getAttribute('action') ?? '', formFields(list, 'form.inventory-status'));
    expect(deactivate.status).toBe(303);
    expect(supplier.active).toBe(false);
  });
});

describe('documentos y reversión (RF-4, RF-9, CA-6)', () => {
  it('lista y detalle con su estado; la reversión muestra los movimientos contrarios, avisa del negativo, exige motivo y envía la clave', async () => {
    const { h, browser, masa } = await as(GEMA);
    seedDocument(h, masa, purchase(7));
    h.api.inventory.kardex.previews.set(7, { lines: [{ itemId: masa.id, itemName: masa.name, quantity: '-50.000', unitCost: '20.0000', balanceAfter: '-8.000', negative: true }] });

    const list = text(await (await browser.get('/inventario/documentos')).text());
    for (const expected of ['#7', 'Compra', '26/11/2026', 'Molino ficticio', '$1,000.00', 'Vigente']) expect(list).toContain(expected);
    const detail = await (await browser.get('/inventario/documentos/7')).text();
    for (const expected of ['Compra #7', 'Con IVA', 'F-1', '+50 kg', '$20.0000', '$1,000.00', 'Por devolver', 'Sin devoluciones.']) expect(text(detail)).toContain(expected);
    expect(dom(detail).querySelector('a[href="/inventario/documentos/7/revertir"]')?.textContent).toBe('Revertir');

    const confirm = await (await browser.get('/inventario/documentos/7/revertir')).text();
    // OBS-26: las cantidades de la vista previa llevan la unidad base.
    for (const expected of ['Movimientos contrarios que se registrarán', '−50 kg', '−8 kg', '$20.0000', 'Quedará negativa', 'Alguna existencia quedará negativa.']) expect(text(confirm)).toContain(expected);
    const fields = formFields(confirm, '#inventory-reversal-form');
    const empty = await browser.post('/inventario/documentos/7/revertir', { ...fields, action: 'reverse', reason: '  ' });
    expect(empty.status).toBe(422);
    expect(dom(await empty.text()).querySelector('#f-reason')?.getAttribute('aria-invalid')).toBe('true');

    const done = await browser.post('/inventario/documentos/7/revertir', { ...fields, action: 'reverse', reason: 'Factura duplicada' });
    expect(done.status).toBe(303);
    expect(h.api.inventory.kardex.keys).toContain(fields.requestId);
    const reversal = await (await browser.get(done.headers.get('location') ?? '')).text();
    expect(text(reversal)).toContain('Documento revertido');
    expect(text(reversal)).toContain('Reversión de #7');
    const original = await (await browser.get('/inventario/documentos/7')).text();
    expect(text(original)).toContain('Revertido por #');
    expect(dom(original).querySelector('a[href="/inventario/documentos/7/revertir"]')).toBeNull();
    // OBS-22: cada documento enlaza al otro.
    const reversalId = new URL(done.headers.get('location') ?? '', h.url).pathname.split('/').at(-1);
    expect(dom(original).querySelector(`a[href="/inventario/documentos/${reversalId}"]`)?.textContent).toBe(`Ver la reversión #${reversalId}`);
    expect(dom(reversal).querySelector('a[href="/inventario/documentos/7"]')?.textContent).toBe('Ver el documento revertido #7');
  });

  it('con la API caída al revertir, responde 503 y conserva el motivo y la clave de envío (DEF-005)', async () => {
    const { h, browser, masa } = await as(GEMA);
    seedDocument(h, masa, purchase(9));
    const confirm = await (await browser.get('/inventario/documentos/9/revertir')).text();
    const fields = formFields(confirm, '#inventory-reversal-form');
    for (const mode of ['writes-down', 'down'] as const) {
      h.api.mode = mode;
      const res = await browser.post('/inventario/documentos/9/revertir', { ...fields, action: 'reverse', reason: 'Factura duplicada' });
      expect(res.status, mode).toBe(503);
      const html = await res.text();
      expect(dom(html).querySelector('#f-reason')?.textContent, mode).toBe('Factura duplicada');
      expect(formFields(html, '#inventory-reversal-form').requestId, mode).toBe(fields.requestId);
      expect(text(html), mode).toContain('Servicio no disponible.');
    }
    h.api.mode = 'ok';
    expect((await browser.post('/inventario/documentos/9/revertir', { ...fields, action: 'reverse', reason: 'Factura duplicada' })).status).toBe(303);
  });

  it('una compra con devoluciones vigentes no se revierte: el aviso las nombra y conserva el motivo', async () => {
    const { h, browser, masa } = await as(GEMA);
    seedDocument(h, masa, purchase(8));
    h.api.inventory.kardex.blockedByReturns.set(8, [12]);
    const confirm = await (await browser.get('/inventario/documentos/8/revertir')).text();
    const res = await browser.post('/inventario/documentos/8/revertir', { ...formFields(confirm, '#inventory-reversal-form'), action: 'reverse', reason: 'Error' });
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(text(html)).toContain('Revierte primero las devoluciones #12');
    expect(dom(html).querySelector('#f-reason')?.textContent).toBe('Error');
  });
});
