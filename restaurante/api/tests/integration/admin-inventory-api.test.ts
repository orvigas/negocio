import { describe, expect, it } from 'vitest';

import {
  conflictErrorSchema,
  inventoryCategoryResponseSchema,
  inventoryConversionResponseSchema,
  inventoryItemDetailResponseSchema,
  inventoryItemListResponseSchema,
  inventoryItemResponseSchema,
  sessionResponseSchema,
  userResponseSchema,
  validationErrorSchema,
} from '@restaurante/contracts';

import { ADMIN, MANAGER, MOLOTES_EDITOR, PASSWORD, call, login, session, startAdmin, type AdminHarness, type Session } from '../support/admin.ts';

/**
 * Catálogo de inventario en `/api/v1/admin/inventario` (REQ-F-049, T1), en proceso con el store en
 * memoria: permisos por rol (RF-9, CA-10 y CA-11), CSRF, códigos y formato de error, conflicto (CA-9),
 * alta idempotente (doble envío) y la sesión del gerente. Las reglas del catálogo se prueban en
 * `inventory-catalog.test.ts` y la persistencia en MySQL en `prisma-inventory-store.test.ts`.
 */

const P = '/api/v1/admin';
const I = `${P}/inventario`;
const KEY = 'clave-de-idempotencia-0001';

const masa = (categoryId: number) => ({ type: 'insumo', categoryId, name: 'Masa de maíz', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }] });

async function category(h: AdminHarness, auth: Session, name = 'Abarrotes'): Promise<number> {
  const res = await call(h.url, `${I}/categorias`, auth, { method: 'POST', body: { name } });
  expect(res.status).toBe(201);
  return inventoryCategoryResponseSchema.parse(await res.json()).category.id;
}

async function createItem(h: AdminHarness, auth: Session, body: Record<string, unknown>): Promise<number> {
  const res = await call(h.url, `${I}/articulos`, auth, { method: 'POST', body });
  expect(res.status).toBe(201);
  return inventoryItemResponseSchema.parse(await res.json()).item.id;
}

/** Todas las rutas del inventario, con un cuerpo válido en las escrituras. */
const ROUTES = [
  { method: 'GET', path: `${I}/articulos` },
  { method: 'POST', path: `${I}/articulos`, body: masa(1) },
  { method: 'GET', path: `${I}/articulos/1` },
  { method: 'GET', path: `${I}/articulos/1/conversion?cantidad=1&unidad=kg` },
  { method: 'PUT', path: `${I}/articulos/1`, body: { ...masa(1), version: 1 } },
  { method: 'POST', path: `${I}/articulos/1/desactivar`, body: { version: 1 } },
  { method: 'POST', path: `${I}/articulos/1/reactivar`, body: { version: 1 } },
  { method: 'GET', path: `${I}/categorias` },
  { method: 'POST', path: `${I}/categorias`, body: { name: 'Abarrotes' } },
  { method: 'PUT', path: `${I}/categorias/1`, body: { name: 'Carnes' } },
  { method: 'POST', path: `${I}/categorias/1/desactivar`, body: {} },
  { method: 'POST', path: `${I}/categorias/1/reactivar`, body: {} },
];

const isEmpty = (h: AdminHarness) => h.inventoryStore.state.items.length === 0 && h.inventoryStore.state.categories.length === 0 && h.inventoryStore.state.changes.length === 0;

describe('acceso (RF-9, CA-10 y CA-11)', () => {
  it('sin sesión: 401 en todas las rutas y no se escribe nada', async () => {
    const h = await startAdmin();
    for (const route of ROUTES) {
      const res = await call(h.url, route.path, null, { method: route.method, body: route.body });
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    }
    expect(isEmpty(h)).toBe(true);
  });

  it('un editor recibe 403 FORBIDDEN_ROLE en lectura y escritura, y no se escribe nada (CA-10)', async () => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    for (const route of ROUTES) {
      const res = await call(h.url, route.path, eli, { method: route.method, body: route.body });
      expect(res.status, `${route.method} ${route.path}`).toBe(403);
      expect(await res.json()).toEqual({ error: { code: 'FORBIDDEN_ROLE', message: 'No tienes permiso para gestionar el inventario.' } });
    }
    expect(isEmpty(h)).toBe(true);
  });

  it('escrituras sin token CSRF, con el de otra sesión o con uno falso: 403 y no se escribe nada', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    const gema = await session(h.url, MANAGER);
    const other = await session(h.url, ADMIN);
    for (const csrf of [null, other.csrfToken, 'x'.repeat(43)]) {
      for (const route of ROUTES.filter((entry) => entry.method !== 'GET')) {
        const res = await call(h.url, route.path, gema, { method: route.method, body: route.body, csrf });
        expect(res.status, `${route.method} ${route.path}`).toBe(403);
        expect((await res.json()).error.code).toBe('CSRF_INVALID');
      }
    }
    expect(isEmpty(h)).toBe(true);
  });

  it('el gerente entra al inventario y recibe 403 en usuarios, bot, cotizador, productos y página (CA-11)', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    const gema = await session(h.url, MANAGER);
    const me = sessionResponseSchema.parse(await (await call(h.url, `${P}/sesion`, gema)).json());
    expect(me.user).toMatchObject({ role: 'gerente', businesses: [] });
    expect((await call(h.url, `${I}/articulos`, gema)).status).toBe(200);
    expect((await call(h.url, `${I}/categorias`, gema)).status).toBe(200);
    for (const path of [`${P}/usuarios`, `${P}/bot`, `${P}/birria/cotizador`, `${P}/molotes/productos`, `${P}/birria/productos`, `${P}/birria/pagina`]) {
      const res = await call(h.url, path, gema);
      expect(res.status, path).toBe(403);
    }
    const write = await call(h.url, `${P}/molotes/productos`, gema, { method: 'POST', body: {} });
    expect(write.status).toBe(403);
  });

  it('un administrador crea un gerente: los negocios enviados se ignoran y el gerente entra al inventario', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const password = 'contraseña-del-gerente-049';
    const res = await call(h.url, `${P}/usuarios`, ana, {
      method: 'POST',
      body: { username: 'gema', displayName: 'Gema Gerente', role: 'gerente', businesses: ['molotes'], password, passwordConfirmation: password },
    });
    expect(res.status).toBe(201);
    expect(userResponseSchema.parse(await res.json()).user).toMatchObject({ role: 'gerente', businesses: [] });
    const logged = await login(h.url, 'gema', password);
    expect(logged.status).toBe(201);
    const { session: gema } = (await logged.json()) as { session: Session };
    expect((await call(h.url, `${I}/articulos`, gema)).status).toBe(200);
  });

  it('desactivar a un gerente invalida su sesión a mitad de uso (D-8)', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    const gema = await session(h.url, MANAGER);
    const ana = await session(h.url, ADMIN);
    expect((await call(h.url, `${I}/articulos`, gema)).status).toBe(200);
    expect((await call(h.url, `${P}/usuarios/${h.ids.gema}/desactivar`, ana, { method: 'POST', body: {} })).status).toBe(200);
    const res = await call(h.url, `${I}/articulos`, gema);
    expect(res.status).toBe(401);
    expect((await login(h.url, MANAGER.username, PASSWORD)).status).toBe(401);
  });
});

describe('catálogo en la API', () => {
  it('alta, ficha con equivalencias e historial, lista y conversión (CA-1, CA-4 y CA-5)', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const categoryId = await category(h, gema);
    const created = await call(h.url, `${I}/articulos`, gema, { method: 'POST', body: masa(categoryId) });
    expect(created.status).toBe(201);
    const { item } = inventoryItemResponseSchema.parse(await created.json());
    expect(created.headers.get('location')).toBe(`${I}/articulos/${item.id}`);
    expect(item).toMatchObject({ kind: 'simple', type: 'insumo', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25.000' }], version: 1, updatedBy: 'Gema Gerente' });

    const detail = inventoryItemDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${item.id}`, gema)).json());
    expect(detail.item.category).toEqual({ id: categoryId, name: 'Abarrotes', active: true });
    expect(detail.item.equivalences).toEqual([
      { unit: 'bulto', quantity: '25.000' },
      { unit: 'g', quantity: '0.001' },
    ]);
    expect(detail.history).toHaveLength(1);
    expect(detail.history[0]).toMatchObject({ action: 'create', author: 'Gema Gerente' });

    const list = inventoryItemListResponseSchema.parse(await (await call(h.url, `${I}/articulos?estado=active&tipo=insumo&q=masa`, gema)).json());
    expect(list.items.map((entry) => [entry.name, entry.categoryName])).toEqual([['Masa de maíz', 'Abarrotes']]);
    expect(list.page).toEqual({ number: 1, size: 50, total: 1 });

    const bultos = await call(h.url, `${I}/articulos/${item.id}/conversion?cantidad=2&unidad=bulto`, gema);
    expect(inventoryConversionResponseSchema.parse(await bultos.json())).toEqual({ quantity: '50.000', unit: 'kg' });
    const grams = await call(h.url, `${I}/articulos/${item.id}/conversion?cantidad=500&unidad=g`, gema);
    expect(inventoryConversionResponseSchema.parse(await grams.json())).toEqual({ quantity: '0.500', unit: 'kg' });
    const pieces = await call(h.url, `${I}/articulos/${item.id}/conversion?cantidad=1&unidad=pza`, gema);
    expect(pieces.status).toBe(422);
    expect((await pieces.json()).error.code).toBe('UNIT_CONVERSION_UNAVAILABLE');
    const comma = await call(h.url, `${I}/articulos/${item.id}/conversion?cantidad=0,5&unidad=kg`, gema);
    expect(Object.keys(validationErrorSchema.parse(await comma.json()).error.fields)).toEqual(['cantidad']);
  });

  it('errores por campo (422), cuerpo cerrado, filtros inválidos e ids desconocidos (404)', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const categoryId = await category(h, gema);
    await createItem(h, gema, { type: 'insumo', categoryId, name: 'Sal', baseUnit: 'kg' });
    const fieldsOf = async (res: Response) => {
      expect(res.status).toBe(422);
      return Object.keys(validationErrorSchema.parse(await res.json()).error.fields);
    };
    expect(await fieldsOf(await call(h.url, `${I}/articulos`, gema, { method: 'POST', body: { type: 'insumo', categoryId, name: ' sal ', baseUnit: 'kg' } }))).toEqual(['name']);
    expect(await fieldsOf(await call(h.url, `${I}/articulos`, gema, { method: 'POST', body: { ...masa(categoryId), units: [{ name: 'bulto', factor: '0' }] } }))).toEqual(['units.0.factor']);
    expect(await fieldsOf(await call(h.url, `${I}/articulos`, gema, { method: 'POST', body: { ...masa(categoryId), price: 10 } }))).toEqual(['price']);
    expect(await fieldsOf(await call(h.url, `${I}/articulos?estado=borrados&pagina=0`, gema))).toEqual(['estado', 'pagina']);
    expect(h.inventoryStore.state.items.length).toBe(1);

    for (const path of [`${I}/articulos/abc`, `${I}/articulos/999`]) {
      const res = await call(h.url, path, gema);
      expect(res.status, path).toBe(404);
      expect((await res.json()).error.code).toBe('ITEM_NOT_FOUND');
    }
    const missing = await call(h.url, `${I}/categorias/999`, gema, { method: 'PUT', body: { name: 'Carnes' } });
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('conflicto de versión (CA-9): la segunda edición recibe 409 con los datos vigentes y "guardar encima" queda en el historial', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    const gema = await session(h.url, MANAGER);
    const ana = await session(h.url, ADMIN);
    const categoryId = await category(h, gema);
    const id = await createItem(h, gema, masa(categoryId));
    const first = await call(h.url, `${I}/articulos/${id}`, ana, { method: 'PUT', body: { ...masa(categoryId), description: 'De Ana', version: 1 } });
    expect(first.status).toBe(200);
    const second = await call(h.url, `${I}/articulos/${id}`, gema, { method: 'PUT', body: { ...masa(categoryId), description: 'De Gema', version: 1 } });
    expect(second.status).toBe(409);
    const conflict = conflictErrorSchema.parse(await second.json());
    expect(conflict.error.current).toMatchObject({ id, version: 2, updatedBy: 'Ana Admin' });
    expect(h.inventoryStore.state.items.find((entry) => entry.id === id)?.description).toBe('De Ana');

    const overwrite = await call(h.url, `${I}/articulos/${id}`, gema, { method: 'PUT', body: { ...masa(categoryId), description: 'De Gema', version: 2, overwrite: true } });
    expect(overwrite.status).toBe(200);
    const detail = inventoryItemDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${id}`, gema)).json());
    expect(detail.item).toMatchObject({ description: 'De Gema', version: 3 });
    expect(detail.history.map((entry) => entry.action)).toEqual(['overwrite_after_conflict', 'update', 'create']);
  });

  it('alta idempotente (doble envío): la misma clave y el mismo cuerpo crean un solo artículo; con otro cuerpo, 422', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const categoryId = await category(h, gema);
    const send = (body: unknown, key = KEY) => call(h.url, `${I}/articulos`, gema, { method: 'POST', body, headers: { 'Idempotency-Key': key } });
    const [a, b] = await Promise.all([send(masa(categoryId)), send(masa(categoryId))]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const ids = await Promise.all([a, b].map(async (res) => inventoryItemResponseSchema.parse(await res.json()).item.id));
    expect(ids[0]).toBe(ids[1]);
    expect(h.inventoryStore.state.items.length).toBe(1);

    const reused = await send({ ...masa(categoryId), name: 'Otra masa' });
    expect(reused.status).toBe(422);
    expect((await reused.json()).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const invalid = await send(masa(categoryId), 'corta');
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe('INVALID_IDEMPOTENCY_KEY');
    expect(h.inventoryStore.state.items.length).toBe(1);
  });

  it('padre con variantes, categoría en uso y reactivación: 409 con su código y el mensaje del dominio', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const categoryId = await category(h, gema, 'Bebidas');
    const parentId = await createItem(h, gema, { kind: 'parent', type: 'reventa', categoryId, name: 'Refresco 600 ml' });
    const cocaId = await createItem(h, gema, { kind: 'variant', parentId, name: 'Coca-Cola', baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }] });

    const blocked = await call(h.url, `${I}/articulos/${parentId}/desactivar`, gema, { method: 'POST', body: { version: 1 } });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error).toEqual({ code: 'ITEM_HAS_ACTIVE_VARIANTS', message: 'El artículo tiene 1 variante activa: confirma que también se inactivan.' });
    const inUse = await call(h.url, `${I}/categorias/${categoryId}/desactivar`, gema, { method: 'POST', body: {} });
    expect(inUse.status).toBe(409);
    expect((await inUse.json()).error).toEqual({ code: 'CATEGORY_IN_USE', message: 'La usan 2 artículos activos.' });

    const confirmed = await call(h.url, `${I}/articulos/${parentId}/desactivar`, gema, { method: 'POST', body: { version: 1, variants: 'deactivate' } });
    expect(confirmed.status).toBe(200);
    const coca = inventoryItemDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${cocaId}`, gema)).json());
    expect(coca.item).toMatchObject({ active: false, version: 2 });
    const orphan = await call(h.url, `${I}/articulos/${cocaId}/reactivar`, gema, { method: 'POST', body: { version: 2 } });
    expect(orphan.status).toBe(409);
    expect((await orphan.json()).error.code).toBe('PARENT_INACTIVE');
  });

  it('base de datos caída: 503 DATABASE_UNAVAILABLE sin detalles', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    h.inventoryStore.failNext();
    const res = await call(h.url, `${I}/articulos`, gema);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('DATABASE_UNAVAILABLE');
  });
});
