import { describe, expect, it } from 'vitest';

import type { BusinessId } from '../../src/config/businesses.ts';
import { ADMIN_USER, createUser, login, loginAs, setupAdmin, type Browser } from '../support/admin.ts';
import { VALID_INPUTS } from '../support/products.ts';

/**
 * Matriz completa de permisos de la API de productos con MySQL real (REQ-F-008, CA-13, CA-15,
 * D-5′, D-19 y RN-8). Ampliación de QA aprobada por el usuario (P-1).
 *
 * Actores: administrador, editor de Molotes, editor de Birria y editor de ambos negocios.
 * Para cada actor y negocio se ejecutan las 7 operaciones por negocio. Con permiso, cada una
 * responde con éxito; sin permiso, responde 403 `FORBIDDEN_BUSINESS` (también las lecturas y
 * aunque falte el CSRF) y la base de datos queda idéntica.
 */

const API = '/admin/api';
const productsPath = (business: BusinessId) => `${API}/${business}/productos`;

type Actor = 'admin' | 'editorMolotes' | 'editorBirria' | 'editorAmbos';

const ACTORS: Record<Actor, { username: string; businesses: BusinessId[] | null }> = {
  admin: { username: ADMIN_USER, businesses: null },
  editorMolotes: { username: 'eva', businesses: ['molotes'] },
  editorBirria: { username: 'beto', businesses: ['birria'] },
  editorAmbos: { username: 'ale', businesses: ['molotes', 'birria'] },
};

const CREATE_INPUT: Record<BusinessId, Record<string, unknown>> = {
  molotes: { category: 'bebida', ...VALID_INPUTS.molotesBebida },
  birria: { category: 'platillo', detailsType: 'chips', ...VALID_INPUTS.birriaChips },
};

/** Cuerpo de PUT válido para el producto creado con CREATE_INPUT. */
const updateInput = (business: BusinessId, version: number) => {
  // category y detailsType no se envían al actualizar (no son editables, D-14).
  const editable = Object.fromEntries(Object.entries(CREATE_INPUT[business]).filter(([key]) => key !== 'category' && key !== 'detailsType'));
  return { ...editable, name: `${String(editable.name)} editado`, available: true, version };
};

const canOperate = (actor: Actor, business: BusinessId) => {
  const { businesses } = ACTORS[actor];
  return businesses === null || businesses.includes(business);
};

async function sessionToken(browser: Browser): Promise<string> {
  const res = await browser.get(`${API}/sesion`);
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

/** Contexto con los cuatro actores y un navegador con sesión para cada uno. */
async function setup() {
  const context = await setupAdmin();
  for (const [actor, { username, businesses }] of Object.entries(ACTORS) as [Actor, (typeof ACTORS)[Actor]][]) {
    if (actor !== 'admin') await createUser(context.users, { username, displayName: username, businesses: businesses ?? [] });
  }
  const sessions = {} as Record<Actor, { browser: Browser; csrf: string }>;
  for (const actor of Object.keys(ACTORS) as Actor[]) {
    const browser = context.browser();
    if (actor === 'admin') expect((await login(browser)).status).toBe(303);
    else await loginAs(browser, ACTORS[actor].username);
    sessions[actor] = { browser, csrf: await sessionToken(browser) };
  }
  /** Huella completa de las tablas de productos (para comprobar que nada cambió). */
  const snapshot = async () => ({
    products: await context.prisma.product.findMany({ orderBy: { id: 'asc' } }),
    variants: await context.prisma.productVariant.findMany({ orderBy: { id: 'asc' } }),
    chips: await context.prisma.productChip.findMany({ orderBy: { id: 'asc' } }),
    changes: await context.prisma.productChange.count(),
  });
  return { ...context, sessions, snapshot };
}

const CASES = (Object.keys(ACTORS) as Actor[]).flatMap((actor) => (['molotes', 'birria'] as BusinessId[]).map((business) => [actor, business] as const));

describe('API de productos: matriz de permisos por rol y negocio (P-1)', () => {
  it.each(CASES.filter(([actor, business]) => canOperate(actor, business)))('%s puede hacer las 7 operaciones sobre %s', async (actor, business) => {
    const { sessions } = await setup();
    const { browser, csrf } = sessions[actor];
    const path = productsPath(business);

    const list = await browser.get(path);
    expect(list.status, 'listar').toBe(200);
    expect(list.body.products.length).toBeGreaterThan(0);

    const created = await browser.post(path).set('X-CSRF-Token', csrf).send(CREATE_INPUT[business]);
    expect(created.status, 'crear').toBe(201);
    const { id } = created.body.product as { id: number };

    const read = await browser.get(`${path}/${id}`);
    expect(read.status, 'ver').toBe(200);
    expect(read.body.product).toMatchObject({ id, business, version: 1 });

    const updated = await browser.put(`${path}/${id}`).set('X-CSRF-Token', csrf).send(updateInput(business, 1));
    expect(updated.status, 'actualizar').toBe(200);
    expect(updated.body.product).toMatchObject({ version: 2, available: true });

    const category = created.body.product.category as string;
    const active = (await browser.get(`${path}?categoria=${category}`)).body.products as { id: number; version: number }[];
    const reversed = [...active].reverse().map(({ id: itemId, version }) => ({ id: itemId, version }));
    const reordered = await browser.put(`${path}/orden`).set('X-CSRF-Token', csrf).send({ category, items: reversed });
    expect(reordered.status, 'reordenar').toBe(200);
    expect(reordered.body.products.map((item: { id: number }) => item.id)).toEqual(reversed.map((item) => item.id));

    const current = (await browser.get(`${path}/${id}`)).body.product as { version: number };
    const removed = await browser.delete(`${path}/${id}?version=${current.version}`).set('X-CSRF-Token', csrf);
    expect(removed.status, 'eliminar').toBe(200);
    expect(removed.body.product).toMatchObject({ deleted: true });

    const restored = await browser.post(`${path}/${id}/recuperar`).set('X-CSRF-Token', csrf).send({ version: removed.body.product.version });
    expect(restored.status, 'recuperar').toBe(200);
    expect(restored.body.product).toMatchObject({ deleted: false, available: false });
  });

  it.each(CASES.filter(([actor, business]) => !canOperate(actor, business)))(
    '%s recibe 403 en las 7 operaciones sobre %s, con y sin CSRF, y nada cambia',
    async (actor, business) => {
      const { sessions, snapshot } = await setup();
      // Un producto activo y uno eliminado del negocio prohibido, preparados por el administrador.
      const admin = sessions.admin;
      const path = productsPath(business);
      const [target] = (await admin.browser.get(path)).body.products as { id: number; version: number; category: string }[];
      const victim = (await admin.browser.post(path).set('X-CSRF-Token', admin.csrf).send(CREATE_INPUT[business])).body.product as { id: number };
      const deleted = await admin.browser.delete(`${path}/${victim.id}?version=1`).set('X-CSRF-Token', admin.csrf);
      expect(deleted.status).toBe(200);
      const items = ((await admin.browser.get(`${path}?categoria=${target!.category}`)).body.products as { id: number; version: number }[]).map(
        ({ id, version }) => ({ id, version }),
      );

      const before = await snapshot();
      const { browser, csrf } = sessions[actor];
      const withCsrf = (token: string | null) => {
        const set = <T extends { set: (name: string, value: string) => T }>(req: T): T => (token === null ? req : req.set('X-CSRF-Token', token));
        return [
          ['listar', browser.get(path)],
          ['listar eliminados', browser.get(`${path}?eliminados=1`)],
          ['ver', browser.get(`${path}/${target!.id}`)],
          ['crear', set(browser.post(path)).send(CREATE_INPUT[business])],
          ['actualizar', set(browser.put(`${path}/${target!.id}`)).send(updateInput(business, target!.version))],
          ['reordenar', set(browser.put(`${path}/orden`)).send({ category: target!.category, items: [...items].reverse() })],
          ['eliminar', set(browser.delete(`${path}/${target!.id}?version=${target!.version}`))],
          ['recuperar', set(browser.post(`${path}/${victim.id}/recuperar`)).send({ version: 2 })],
        ] as const;
      };
      for (const token of [csrf, null]) {
        for (const [operation, request] of withCsrf(token)) {
          const res = await request;
          expect(res.status, `${operation} (${token ? 'con' : 'sin'} CSRF)`).toBe(403);
          expect(res.body.error.code, operation).toBe('FORBIDDEN_BUSINESS');
          expect(JSON.stringify(res.body), operation).not.toContain('"products"');
        }
      }
      expect(await snapshot()).toEqual(before);
    },
  );

  it('un editor sin el negocio no distingue un id existente de uno inexistente (403 antes que 404)', async () => {
    const { sessions } = await setup();
    const { browser } = sessions.editorMolotes;
    const [existing] = (await sessions.admin.browser.get(productsPath('birria'))).body.products as { id: number }[];
    for (const id of [existing!.id, 999_999]) {
      const res = await browser.get(`${productsPath('birria')}/${id}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_BUSINESS');
    }
  });

  it('un editor con permiso recibe 404 al pedir por su negocio un producto del otro (CA-22)', async () => {
    const { sessions } = await setup();
    const { browser, csrf } = sessions.editorAmbos;
    const [birria] = (await browser.get(productsPath('birria'))).body.products as { id: number; version: number }[];
    expect((await browser.get(`${productsPath('molotes')}/${birria!.id}`)).status).toBe(404);
    expect((await browser.delete(`${productsPath('molotes')}/${birria!.id}?version=${birria!.version}`).set('X-CSRF-Token', csrf)).status).toBe(404);
    expect((await browser.get(`${productsPath('birria')}/${birria!.id}`)).body.product).toMatchObject({ deleted: false, version: birria!.version });
  });
});
