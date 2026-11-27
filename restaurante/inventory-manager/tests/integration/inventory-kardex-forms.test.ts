import { describe, expect, it } from 'vitest';

import type { InventoryItem, KardexDocument } from '@restaurante/contracts';

import type { DoubleUser } from '../support/api-double.ts';
import { ANA, ELI, GEMA, dom, formFields, startInventory, type Browser, type Harness } from '../support/browser.ts';

/**
 * Formularios del Kardex con líneas (REQ-F-051, T3; PR 3b) contra el doble de /api/v1/admin/inventario,
 * sin JavaScript: compra, saldo inicial, ajuste y devolución a proveedor. Bloques de 10 filas hasta 50 con
 * el foco en la primera fila nueva (PV-T3-4), errores por línea en su fila (OBS-15), `Idempotency-Key` en
 * cada envío (OBS-16) y lo escrito conservado con la API caída u ocupada (DEF-005). Las reglas y los
 * números están en api/tests. Datos ficticios.
 */

const AT = '2026-11-26T10:00:00-06:00';
const TODAY = '2026-11-26';
let next = 600;

function addItem(h: Harness, name: string, type: InventoryItem['type'], extra: Partial<InventoryItem> = {}): InventoryItem {
  const item: InventoryItem = { id: ++next, kind: 'simple', type, parentId: null, categoryId: 1, name, description: null, sku: null, baseUnit: 'kg', units: [], active: true, version: 1, createdAt: AT, updatedAt: AT, updatedBy: 'Semilla', referenceCost: null, inventoriable: true, ...extra };
  h.api.inventory.items.push(item);
  return item;
}

async function as(user: DoubleUser) {
  const h = await startInventory({ users: [ANA, ELI, GEMA] });
  h.api.inventory.categories.push({ id: 1, name: 'Abarrotes ficticios', active: true, createdAt: AT, updatedAt: AT });
  const masa = addItem(h, 'Masa ficticia', 'insumo', { units: [{ name: 'bulto', factor: '25.000' }], referenceCost: '18.5000' });
  const sal = addItem(h, 'Sal ficticia', 'insumo');
  addItem(h, 'Taco ficticio', 'compuesto', { baseUnit: 'pza' });
  h.api.inventory.kardex.suppliers.push({ id: 1, name: 'Molino ficticio', contact: null, active: true, version: 1, updatedAt: AT, updatedBy: 'Semilla' });
  const browser = h.browser();
  expect((await browser.login(user)).status).toBe(303);
  return { h, browser, masa, sal };
}

const text = (html: string) => dom(html).body.textContent?.replace(/\s+/g, ' ') ?? '';
const FORM = '#inventory-document-form';
const send = (browser: Browser, path: string, html: string, changes: Record<string, string>, action = 'save') => browser.post(path, { ...formFields(html, FORM), action, ...changes });

describe('compra (RF-3) con bloques de filas (PV-T3-4)', () => {
  it('10 filas con un datalist de artículos con existencias; añade bloques de 10 hasta 50 conservando lo escrito; registra con la clave de envío', async () => {
    const { h, browser, masa, sal } = await as(GEMA);
    const path = '/inventario/documentos/nuevo/compra';
    const html = await (await browser.get(path)).text();
    const page = dom(html);
    expect(page.querySelectorAll('fieldset.kardex-line')).toHaveLength(10);
    expect([...page.querySelectorAll('#kardex-items option')].map((option) => option.getAttribute('value'))).toEqual(['Masa ficticia', 'Sal ficticia']);
    expect(page.querySelector('#f-occurredOn')?.getAttribute('value')).toBe(TODAY);
    // DEF-008: un solo `type`, el de fecha (con dos, el navegador toma el primero).
    expect(page.querySelector('#f-occurredOn')?.outerHTML.match(/\stype="/g)).toHaveLength(1);
    expect(page.querySelector('#f-occurredOn')?.getAttribute('type')).toBe('date');
    expect(page.querySelector('#f-occurredOn')?.getAttribute('max')).toBe(TODAY);
    expect(page.querySelector('#f-occurredOn')?.getAttribute('min')).toBe('2026-10-26');
    expect([...page.querySelectorAll('#f-supplierId option')].map((option) => option.textContent)).toEqual(['Sin proveedor', 'Molino ficticio']);
    expect(text(html)).toContain('Con IVA');

    let current = html;
    for (const rows of [20, 30, 40, 50]) {
      const res = await send(browser, path, current, { 'lines.0.item': 'Masa ficticia', 'lines.0.quantity': '2', 'lines.0.unit': 'bulto', 'lines.0.amount': '1000.00' }, 'rows');
      expect(res.status).toBe(200);
      current = await res.text();
      const shown = dom(current);
      expect(shown.querySelectorAll('fieldset.kardex-line')).toHaveLength(rows);
      expect(shown.querySelector('#f-lines-0-item')?.getAttribute('value')).toBe('Masa ficticia');
      expect([...shown.querySelectorAll('[autofocus]')].map((element) => element.id)).toEqual([`f-lines-${rows - 10}-item`]);
    }
    expect(dom(current).querySelector('button[value="rows"]')).toBeNull();
    expect(h.api.inventory.kardex.writes).toHaveLength(0);

    const requestId = formFields(current, FORM).requestId ?? '';
    const saved = await send(browser, path, current, { supplierId: '1', reference: 'F-1', 'lines.3.item': 'sal ficticia', 'lines.3.quantity': '1', 'lines.3.unit': 'kg', 'lines.3.amount': '12' });
    expect(saved.status).toBe(303);
    expect(h.api.inventory.kardex.keys).toContain(requestId);
    expect(h.api.inventory.kardex.writes[0]?.body).toEqual({
      occurredOn: TODAY,
      note: null,
      supplierId: 1,
      reference: 'F-1',
      lines: [
        { itemId: masa.id, quantity: '2', unit: 'bulto', amount: '1000.00' },
        { itemId: sal.id, quantity: '1', unit: 'kg', amount: '12' },
      ],
    });
    expect(text(await (await browser.get(saved.headers.get('location') ?? '')).text())).toContain('Documento registrado');
  });

  it('los errores de la API vuelven a la fila del formulario (OBS-15), con el resumen enlazado y lo escrito conservado', async () => {
    const { h, browser } = await as(GEMA);
    const path = '/inventario/documentos/nuevo/compra';
    const html = await (await browser.get(path)).text();
    // Filas 1 y 4 escritas (la 2 y la 3 vacías): los errores de la API (lista compacta) van a la fila 4.
    const res = await send(browser, path, html, {
      'lines.0.item': 'Masa ficticia',
      'lines.0.quantity': '1',
      'lines.0.unit': 'kg',
      'lines.0.amount': '10',
      'lines.3.item': 'Harina inexistente',
      'lines.3.quantity': '1,5',
      'lines.3.unit': 'kg',
      'lines.3.amount': '10.001',
    });
    expect(res.status).toBe(422);
    const page = dom(await res.text());
    expect(page.querySelector('#f-lines-3-item')?.getAttribute('aria-invalid')).toBe('true');
    expect(page.querySelector('#f-lines-3-item-error')?.textContent).toContain('No hay un artículo que admita este documento con ese nombre');
    expect(page.querySelector('#f-lines-3-quantity')?.getAttribute('aria-invalid')).toBe('true');
    expect(page.querySelector('#f-lines-3-amount-error')?.textContent).toContain('Máximo 2 decimales.');
    expect(page.querySelector('#f-lines-0-item')?.getAttribute('aria-invalid')).toBeNull();
    expect([...page.querySelectorAll('.notice__list a')].map((link) => link.getAttribute('href'))).toEqual(expect.arrayContaining(['#f-lines-3-item', '#f-lines-3-quantity', '#f-lines-3-amount']));
    expect(page.querySelector('#f-lines-3-amount')?.getAttribute('value')).toBe('10.001');
    expect(h.api.inventory.kardex.writes).toHaveLength(0);
  });

  it('con la API caída u ocupada responde 503 con lo escrito y la misma clave; al reenviar se registra una sola vez', async () => {
    const { h, browser } = await as(GEMA);
    const path = '/inventario/documentos/nuevo/compra';
    const html = await (await browser.get(path)).text();
    const changes = { 'lines.0.item': 'Masa ficticia', 'lines.0.quantity': '2', 'lines.0.unit': 'bulto', 'lines.0.amount': '1000.00' };
    const requestId = formFields(html, FORM).requestId;
    for (const mode of ['down', 'writes-down'] as const) {
      h.api.mode = mode;
      const res = await send(browser, path, html, changes);
      expect(res.status, mode).toBe(503);
      const repainted = await res.text();
      expect(dom(repainted).querySelector('#f-lines-0-amount')?.getAttribute('value'), mode).toBe('1000.00');
      expect(formFields(repainted, FORM).requestId, mode).toBe(requestId);
    }
    h.api.mode = 'ok';
    h.api.inventory.kardex.busyNext = true;
    const busy = await send(browser, path, html, changes);
    expect(busy.status).toBe(503);
    expect(text(await busy.text())).toContain('El inventario está ocupado');
    expect((await send(browser, path, html, changes)).status).toBe(303);
    expect((await send(browser, path, html, changes)).status).toBe(303);
    expect(h.api.inventory.kardex.writes).toHaveLength(1);
  });
});

describe('saldo inicial (RF-2) y ajuste (RF-5)', () => {
  it('el saldo inicial solo ofrece artículos sin movimientos (OBS-30) y explica en su fila uno que ya los tiene, sin enviarlo (DEF-007)', async () => {
    const { h, browser, sal } = await as(GEMA);
    h.api.inventory.kardex.takenItems.add(sal.id);
    const path = '/inventario/documentos/nuevo/saldo-inicial';
    const html = await (await browser.get(path)).text();
    expect([...dom(html).querySelectorAll('#kardex-items option')].map((option) => option.getAttribute('value'))).toEqual(['Masa ficticia']);
    expect(dom(html).querySelector('#f-occurredOn')?.getAttribute('type')).toBe('date');
    const res = await send(browser, path, html, { 'lines.2.item': 'Sal ficticia', 'lines.2.quantity': '2', 'lines.2.unit': 'kg', 'lines.2.unitCost': '12' });
    expect(res.status).toBe(409);
    const page = dom(await res.text());
    expect(page.querySelector('#f-lines-2-item-error')?.textContent).toContain('El artículo ya tiene movimientos: corrige su existencia con un ajuste.');
    expect(page.querySelector('#f-lines-2-unitCost')?.getAttribute('value')).toBe('12');
    // Se explica antes de enviar: la API no recibe ninguna escritura.
    expect(h.api.inventory.kardex.keys).not.toContain(formFields(html, FORM).requestId);
    expect(h.api.inventory.kardex.writes).toHaveLength(0);
  });

  it('el saldo inicial precarga el costo de referencia y marca en su línea un artículo con movimientos (409)', async () => {
    const { h, browser, masa } = await as(GEMA);
    const path = '/inventario/documentos/nuevo/saldo-inicial';
    const html = await (await browser.get(path)).text();
    const filled = await (await send(browser, path, html, { 'lines.0.item': 'Masa ficticia', 'lines.0.quantity': '12.5', 'lines.0.unit': 'kg' }, 'rows')).text();
    expect(dom(filled).querySelector('#f-lines-0-unitCost')?.getAttribute('value')).toBe('18.5');

    // Otra persona registró un movimiento del artículo después de abrir el formulario.
    h.api.inventory.kardex.conflictItems.add(masa.id);
    const res = await send(browser, path, filled, {});
    expect(res.status).toBe(409);
    const page = dom(await res.text());
    expect(page.querySelector('#f-lines-0-item-error')?.textContent).toContain('corrige su existencia con un ajuste');
    expect(page.querySelector('#f-lines-0-quantity')?.getAttribute('value')).toBe('12.5');
  });

  it('el ajuste envía la dirección, el motivo y el costo solo si se escribe', async () => {
    const { h, browser, sal } = await as(GEMA);
    const path = '/inventario/documentos/nuevo/ajuste';
    const html = await (await browser.get(path)).text();
    expect(dom(html).querySelector('#f-occurredOn')?.getAttribute('type')).toBe('date');
    expect([...dom(html).querySelectorAll('#f-reason option')].map((option) => option.getAttribute('value'))).toEqual(['', 'error_captura', 'otro']);
    expect([...dom(html).querySelectorAll('#f-lines-0-direction option')].map((option) => option.getAttribute('value'))).toEqual(['salida', 'entrada']);
    const res = await send(browser, path, html, { reason: 'otro', note: 'Se cayó un costal', 'lines.0.item': 'Sal ficticia', 'lines.0.direction': 'entrada', 'lines.0.quantity': '2', 'lines.0.unit': 'kg', 'lines.0.unitCost': '12.5' });
    expect(res.status).toBe(303);
    expect(h.api.inventory.kardex.writes[0]?.body).toEqual({ occurredOn: TODAY, note: 'Se cayó un costal', reason: 'otro', lines: [{ itemId: sal.id, quantity: '2', unit: 'kg', direction: 'entrada', unitCost: '12.5' }] });
  });
});

describe('devolución a proveedor (RF-6) y acciones (CA-21)', () => {
  function purchase(h: Harness, masa: InventoryItem): KardexDocument {
    const document: KardexDocument = { id: 70, type: 'compra', typeLabel: 'Compra', occurredOn: TODAY, recordedAt: AT, supplier: { id: 1, name: 'Molino ficticio' }, reference: null, costBasis: 'con_iva', reason: null, note: null, totalCost: '600.0000', reversesDocumentId: null, reversedById: null, sourceDocumentId: null, author: 'Gema Gerente' };
    h.api.inventory.kardex.documents.set(70, {
      document,
      lines: [{ id: 5, documentId: 70, line: 1, itemId: masa.id, seq: 1, type: 'compra', typeLabel: 'Compra', quantity: '25.000', enteredQuantity: '25.000', enteredUnit: 'kg', balanceBefore: '0.000', balanceAfter: '25.000', unitCost: '24.0000', lineTotal: '600.0000', avgCostBefore: null, avgCostAfter: '24.0000', sourceMovementId: null, recordedAt: AT, author: 'Gema Gerente', itemName: masa.name, baseUnit: 'kg', returnable: '20.000' }],
      returns: [],
    });
    return document;
  }

  it('desde el detalle de una compra: una fila por línea con lo que queda por devolver; pasarse se marca en la fila; con la clave registra', async () => {
    const { h, browser, masa } = await as(GEMA);
    purchase(h, masa);
    const detail = await (await browser.get('/inventario/documentos/70')).text();
    expect(dom(detail).querySelector('a[href="/inventario/documentos/70/devolver"]')?.textContent).toBe('Devolver');
    const html = await (await browser.get('/inventario/documentos/70/devolver')).text();
    for (const expected of ['Línea 1: Masa ficticia', '25 kg a $24.0000 / kg', 'Queda por devolver', '20 kg']) expect(text(html)).toContain(expected);
    const tooMuch = await browser.post('/inventario/documentos/70/devolver', { ...formFields(html, FORM), 'lines.0.quantity': '21' });
    expect(tooMuch.status).toBe(422);
    const page = dom(await tooMuch.text());
    expect(page.querySelector('#f-lines-0-quantity-error')?.textContent).toContain('Es más de lo que queda por devolver');
    expect(page.querySelector('#f-lines-0-quantity')?.getAttribute('value')).toBe('21');
    expect(dom(html).querySelector('#f-occurredOn')?.getAttribute('type')).toBe('date');
    const fields = formFields(html, FORM);
    // DEF-009: con la API caída al comprobar la sesión, vuelven las filas, la cantidad escrita y los límites de la fecha.
    h.api.mode = 'down';
    const down = await browser.post('/inventario/documentos/70/devolver', { ...fields, 'lines.0.quantity': '5' });
    expect(down.status).toBe(503);
    const downPage = dom(await down.text());
    expect(downPage.querySelector('#f-lines-0-quantity')?.getAttribute('value')).toBe('5');
    expect(downPage.body.textContent).toContain('Línea 1: Masa ficticia (kg)');
    expect(downPage.querySelector('#f-occurredOn')?.getAttribute('max')).toBe(TODAY);
    expect(downPage.querySelector('#f-occurredOn')?.getAttribute('min')).toBe('2026-10-26');
    expect(formFields(downPage.documentElement.outerHTML, FORM).requestId).toBe(fields.requestId);
    h.api.mode = 'ok';
    const done = await browser.post('/inventario/documentos/70/devolver', { ...fields, 'lines.0.quantity': '5' });
    expect(done.status).toBe(303);
    expect(h.api.inventory.kardex.keys).toContain(fields.requestId);
    expect(h.api.inventory.kardex.writes[0]?.body).toEqual({ occurredOn: TODAY, note: null, lines: [{ sourceMovementId: 5, quantity: '5' }] });
  });

  it('la lista de documentos ofrece los tres formularios; el Editor recibe 403', async () => {
    const { browser } = await as(GEMA);
    const list = dom(await (await browser.get('/inventario/documentos')).text());
    for (const kind of ['compra', 'saldo-inicial', 'ajuste']) expect(list.querySelector(`a[href="/inventario/documentos/nuevo/${kind}"]`), kind).not.toBeNull();
    expect((await browser.get('/inventario/documentos/nuevo/otro')).status).toBe(404);
    const { browser: eli } = await as(ELI);
    expect((await eli.get('/inventario/documentos/nuevo/compra')).status).toBe(403);
  });
});
