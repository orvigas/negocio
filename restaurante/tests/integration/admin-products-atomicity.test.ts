import { describe, expect, it } from 'vitest';

import { login, setupAdmin } from '../support/admin.ts';
import { IMAGE } from '../support/products.ts';

/**
 * Atomicidad de las escrituras de productos por HTTP con SQLite real (REQ-F-008, RF-2.3, RF-7.5 y
 * DT-5). Ampliación de QA aprobada por el usuario (P-3).
 *
 * Los fallos a mitad de la transacción se provocan con triggers de SQLite que abortan la inserción
 * de una variante o de la entrada del registro: el producto, sus variantes, sus chips y la entrada
 * de `product_change` se guardan juntos o no se guardan.
 */

const API = '/admin/api';
const BIRRIA = `${API}/birria/productos`;
const MOLOTES = `${API}/molotes/productos`;

const variant = (label: string, price: number | string = 40) => ({ label, price, description: `${label} desc`, available: true });

const VARIANTS_PRODUCT = {
  category: 'platillo',
  detailsType: 'variants',
  name: 'Agua Fresca',
  label: 'Fría',
  image: IMAGE,
  detailsLabel: 'Elige:',
  variants: [variant('Chica', 30)],
};

async function setup() {
  const context = await setupAdmin();
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  const csrf = (await browser.get(`${API}/sesion`)).body.csrfToken as string;
  const snapshot = async () => ({
    products: await context.prisma.product.findMany({ orderBy: { id: 'asc' } }),
    variants: await context.prisma.productVariant.findMany({ orderBy: { id: 'asc' } }),
    chips: await context.prisma.productChip.findMany({ orderBy: { id: 'asc' } }),
    changes: await context.prisma.productChange.findMany({ orderBy: { id: 'asc' } }),
  });
  const sql = (statement: string) => context.prisma.$executeRawUnsafe(statement);
  return { ...context, browser, csrf, snapshot, sql };
}

/** Cuerpo de PUT del producto de variantes con la lista de variantes indicada. */
const variantsUpdate = (version: number, variants: unknown[]) => {
  // category y detailsType no se envían al actualizar (no son editables, D-14).
  const editable = Object.fromEntries(Object.entries(VARIANTS_PRODUCT).filter(([key]) => key !== 'category' && key !== 'detailsType'));
  return { ...editable, variants, available: true, version };
};

describe('atomicidad de las escrituras de productos con SQLite real (P-3)', () => {
  it('un PUT con 6 variantes donde la sexta no es válida responde 422 y no cambia nada', async () => {
    const { browser, csrf, snapshot, request } = await setup();
    const created = await browser.post(BIRRIA).set('X-CSRF-Token', csrf).send(VARIANTS_PRODUCT);
    expect(created.status).toBe(201);
    const before = await snapshot();
    const landing = (await request().get('/birria')).text;

    const variants = [variant('V1'), variant('V2'), variant('V3'), variant('V4'), variant('V5'), variant('V6', 0)];
    const res = await browser.put(`${BIRRIA}/${created.body.product.id}`).set('X-CSRF-Token', csrf).send(variantsUpdate(1, variants));
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toEqual(['variants.5.price']);

    expect(await snapshot()).toEqual(before);
    expect((await request().get('/birria')).text).toBe(landing);
  });

  it('si la entrada del registro falla, un PUT que reemplaza variantes no deja nada a medias', async () => {
    const { browser, csrf, snapshot, sql, request } = await setup();
    const created = await browser.post(BIRRIA).set('X-CSRF-Token', csrf).send(VARIANTS_PRODUCT);
    const { id } = created.body.product as { id: number };
    const before = await snapshot();
    const landing = (await request().get('/birria')).text;

    await sql(`CREATE TRIGGER qa_fail_change BEFORE INSERT ON product_change BEGIN SELECT RAISE(ABORT, 'qa-trigger-change'); END`);
    const variants = [variant('V1'), variant('V2'), variant('V3')];
    const res = await browser.put(`${BIRRIA}/${id}`).set('X-CSRF-Token', csrf).send(variantsUpdate(1, variants));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' } });

    expect(await snapshot()).toEqual(before);
    expect((await request().get('/birria')).text).toBe(landing);

    // La versión no avanzó: sin el fallo, la misma petición se aplica.
    await sql('DROP TRIGGER qa_fail_change');
    const retry = await browser.put(`${BIRRIA}/${id}`).set('X-CSRF-Token', csrf).send(variantsUpdate(1, variants));
    expect(retry.status).toBe(200);
    expect(retry.body.product.variants).toHaveLength(3);
  });

  it('si una variante falla a mitad de la creación, no queda el producto ni su slug reservado', async () => {
    const { browser, csrf, snapshot, sql } = await setup();
    const before = await snapshot();

    await sql(`CREATE TRIGGER qa_fail_variant BEFORE INSERT ON product_variant WHEN NEW.label = 'Falla' BEGIN SELECT RAISE(ABORT, 'qa-trigger-variant'); END`);
    const input = { ...VARIANTS_PRODUCT, variants: [variant('Bien'), variant('Falla'), variant('Otra')] };
    const res = await browser.post(BIRRIA).set('X-CSRF-Token', csrf).send(input);
    expect(res.status).toBe(503);
    expect(await snapshot()).toEqual(before);

    await sql('DROP TRIGGER qa_fail_variant');
    const retry = await browser.post(BIRRIA).set('X-CSRF-Token', csrf).send(input);
    expect(retry.status).toBe(201);
    expect(retry.body.product.slug).toBe('agua-fresca');
  });

  it('si el registro falla al reordenar, ninguna posición cambia', async () => {
    const { browser, csrf, snapshot, sql, request } = await setup();
    const items = ((await browser.get(`${MOLOTES}?categoria=platillo`)).body.products as { id: number; version: number }[]).map(({ id, version }) => ({
      id,
      version,
    }));
    const before = await snapshot();
    const landing = (await request().get('/molotes')).text;

    await sql(`CREATE TRIGGER qa_fail_reorder BEFORE INSERT ON product_change WHEN NEW.action = 'reorder' BEGIN SELECT RAISE(ABORT, 'qa-trigger-reorder'); END`);
    const res = await browser.put(`${MOLOTES}/orden`).set('X-CSRF-Token', csrf).send({ category: 'platillo', items: [...items].reverse() });
    expect(res.status).toBe(503);
    expect(await snapshot()).toEqual(before);
    expect((await request().get('/molotes')).text).toBe(landing);
  });

  it('si el registro falla al eliminar o recuperar, el producto sigue como estaba', async () => {
    const { browser, csrf, snapshot, sql } = await setup();
    const [drink] = (await browser.get(`${MOLOTES}?categoria=bebida`)).body.products as { id: number; version: number }[];
    const before = await snapshot();

    await sql(`CREATE TRIGGER qa_fail_delete BEFORE INSERT ON product_change WHEN NEW.action = 'delete' BEGIN SELECT RAISE(ABORT, 'qa-trigger-delete'); END`);
    expect((await browser.delete(`${MOLOTES}/${drink!.id}?version=${drink!.version}`).set('X-CSRF-Token', csrf)).status).toBe(503);
    expect(await snapshot()).toEqual(before);
    await sql('DROP TRIGGER qa_fail_delete');

    const removed = await browser.delete(`${MOLOTES}/${drink!.id}?version=${drink!.version}`).set('X-CSRF-Token', csrf);
    expect(removed.status).toBe(200);
    const afterDelete = await snapshot();
    await sql(`CREATE TRIGGER qa_fail_restore BEFORE INSERT ON product_change WHEN NEW.action = 'restore' BEGIN SELECT RAISE(ABORT, 'qa-trigger-restore'); END`);
    expect((await browser.post(`${MOLOTES}/${drink!.id}/recuperar`).set('X-CSRF-Token', csrf).send({ version: removed.body.product.version })).status).toBe(503);
    expect(await snapshot()).toEqual(afterDelete);
  });
});
