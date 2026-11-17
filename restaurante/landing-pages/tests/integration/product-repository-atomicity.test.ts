import { afterEach, describe, expect, it } from 'vitest';

import { ProductValidationError, createProductRepository } from '@restaurante/core/catalog';
import { DatabaseUnavailableError } from '@restaurante/core/shared';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';

import { ADMIN_PASSWORD_HASH } from '../support/admin.ts';
import { adminSql, makeDatabase } from '../support/database.ts';
import { IMAGE, seedSources } from '../support/products.ts';

/**
 * Atomicidad de las escrituras de productos con MySQL real (REQ-F-008, RF-2.3, RF-7.5 y DT-5).
 * Ampliación de QA aprobada por el usuario (P-3). Desde REQ-F-045 se prueba sobre el repositorio de
 * productos (el mismo que usa la API de administración), sin el /admin retirado.
 *
 * Los fallos a mitad de la transacción se provocan con triggers de MySQL que abortan la inserción
 * de una variante o de la entrada del registro: el producto, sus variantes, sus chips y la entrada
 * de `product_change` se guardan juntos o no se guardan, y lo publicado no cambia.
 */

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

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function setup() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  // Autor de los cambios (product_change.actorId tiene clave foránea a user).
  const user = await database.prisma.user.create({ data: { username: 'dueno', usernameKey: 'dueno', displayName: 'Dueño', role: 'admin', passwordHash: ADMIN_PASSWORD_HASH, updatedAt: new Date() } });
  const author = { id: user.id, name: user.displayName };
  const products = createProductRepository({ store: createPrismaProductStore({ prisma: database.prisma }), imageExists: async () => true });
  await products.init(seedSources());
  const { prisma } = database;
  const snapshot = async () => ({
    products: await prisma.product.findMany({ orderBy: { id: 'asc' } }),
    variants: await prisma.productVariant.findMany({ orderBy: { id: 'asc' } }),
    chips: await prisma.productChip.findMany({ orderBy: { id: 'asc' } }),
    changes: await prisma.productChange.findMany({ orderBy: { id: 'asc' } }),
  });
  // DDL de prueba (triggers) con el usuario admin: el de la app no tiene privilegios DDL (CA-6).
  const sql = (statement: string) => adminSql(database.name, statement);
  return { products, author, snapshot, sql };
}

/** Entrada de actualización del producto de variantes con la lista de variantes indicada. */
const variantsUpdate = (variants: unknown[]) => {
  // category y detailsType no se envían al actualizar (no son editables, D-14).
  const editable = Object.fromEntries(Object.entries(VARIANTS_PRODUCT).filter(([key]) => key !== 'category' && key !== 'detailsType'));
  return { ...editable, variants, available: true };
};

describe('atomicidad de las escrituras de productos con MySQL real (P-3)', () => {
  it('una actualización con 6 variantes donde la sexta no es válida se rechaza y no cambia nada', async () => {
    const { products, author, snapshot } = await setup();
    const created = await products.create('birria', { input: VARIANTS_PRODUCT }, author);
    const before = await snapshot();
    const published = products.getPublished('birria');

    const variants = [variant('V1'), variant('V2'), variant('V3'), variant('V4'), variant('V5'), variant('V6', 0)];
    const rejected = products.update('birria', created.id, { input: variantsUpdate(variants), expectedVersion: created.version }, author);
    await expect(rejected).rejects.toBeInstanceOf(ProductValidationError);
    await expect(rejected).rejects.toMatchObject({ fields: { 'variants.5.price': expect.any(String) } });

    expect(await snapshot()).toEqual(before);
    expect(products.getPublished('birria')).toEqual(published);
  });

  it('si la entrada del registro falla, una actualización que reemplaza variantes no deja nada a medias', async () => {
    const { products, author, snapshot, sql } = await setup();
    const created = await products.create('birria', { input: VARIANTS_PRODUCT }, author);
    const before = await snapshot();
    const published = products.getPublished('birria');

    await sql(`CREATE TRIGGER qa_fail_change BEFORE INSERT ON product_change FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qa-trigger-change'`);
    const variants = [variant('V1'), variant('V2'), variant('V3')];
    const request = { input: variantsUpdate(variants), expectedVersion: created.version };
    await expect(products.update('birria', created.id, request, author)).rejects.toBeInstanceOf(DatabaseUnavailableError);

    expect(await snapshot()).toEqual(before);
    expect(products.getPublished('birria')).toEqual(published);

    // La versión no avanzó: sin el fallo, la misma petición se aplica.
    await sql('DROP TRIGGER qa_fail_change');
    expect((await products.update('birria', created.id, request, author)).variants).toHaveLength(3);
  });

  it('si una variante falla a mitad de la creación, no queda el producto ni su slug reservado', async () => {
    const { products, author, snapshot, sql } = await setup();
    const before = await snapshot();

    await sql(`CREATE TRIGGER qa_fail_variant BEFORE INSERT ON product_variant FOR EACH ROW BEGIN IF NEW.label = 'Falla' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qa-trigger-variant'; END IF; END`);
    const input = { ...VARIANTS_PRODUCT, variants: [variant('Bien'), variant('Falla'), variant('Otra')] };
    await expect(products.create('birria', { input }, author)).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(await snapshot()).toEqual(before);

    await sql('DROP TRIGGER qa_fail_variant');
    expect((await products.create('birria', { input }, author)).slug).toBe('agua-fresca');
  });

  it('si el registro falla al reordenar, ninguna posición cambia', async () => {
    const { products, author, snapshot, sql } = await setup();
    const items = (await products.list('molotes', { category: 'platillo' })).map(({ id, version }) => ({ id, version }));
    const before = await snapshot();
    const published = products.getPublished('molotes');

    await sql(`CREATE TRIGGER qa_fail_reorder BEFORE INSERT ON product_change FOR EACH ROW BEGIN IF NEW.action = 'reorder' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qa-trigger-reorder'; END IF; END`);
    await expect(products.reorder('molotes', 'platillo', [...items].reverse(), author)).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(await snapshot()).toEqual(before);
    expect(products.getPublished('molotes')).toEqual(published);
  });

  it('si el registro falla al eliminar o recuperar, el producto sigue como estaba', async () => {
    const { products, author, snapshot, sql } = await setup();
    const [drink] = await products.list('molotes', { category: 'bebida' });
    const before = await snapshot();

    await sql(`CREATE TRIGGER qa_fail_delete BEFORE INSERT ON product_change FOR EACH ROW BEGIN IF NEW.action = 'delete' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qa-trigger-delete'; END IF; END`);
    await expect(products.remove('molotes', drink!.id, drink!.version, author)).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(await snapshot()).toEqual(before);
    await sql('DROP TRIGGER qa_fail_delete');

    const removed = await products.remove('molotes', drink!.id, drink!.version, author);
    const afterDelete = await snapshot();
    await sql(`CREATE TRIGGER qa_fail_restore BEFORE INSERT ON product_change FOR EACH ROW BEGIN IF NEW.action = 'restore' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qa-trigger-restore'; END IF; END`);
    await expect(products.restore('molotes', drink!.id, removed.version, author)).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(await snapshot()).toEqual(afterDelete);
  });
});
