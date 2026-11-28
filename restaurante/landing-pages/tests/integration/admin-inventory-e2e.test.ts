import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { makeDatabase } from '../support/database.ts';
import { freePorts, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';

/**
 * Inventario de extremo a extremo con los procesos reales (REQ-F-049, T1, PR 3): la API contra MySQL
 * (prepara la instalación y crea el primer administrador) e inventory-manager, sin JavaScript.
 *
 * Un administrador crea un gerente; el gerente entra directo al inventario, da de alta una categoría y
 * "Masa de maíz" en kg con "bulto = 25", ve la equivalencia y la conversión en la ficha, y una edición
 * simultánea del administrador recibe el conflicto con quién y cuándo (CA-1, CA-4, CA-9 y CA-11).
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
const GEMA_PASSWORD = 'contraseña-de-gema-049';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function startStack() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const [apiPort, inventoryPort] = (await freePorts(2)) as [number, number];
  const api = await startServer({ ...ADMIN_ENV, DATABASE_URL: databaseUrl(database.config), PORT: String(apiPort), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const inventory = await startServer({ NODE_ENV: 'development', PORT: String(inventoryPort), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000, { args: [INVENTORY_ENTRY] });
  cleanups.push(() => inventory.stop());
  expect(inventory.started, inventory.output().stderr).toBe(true);
  return { database, adminUrl: `http://127.0.0.1:${inventoryPort}` };
}

/** Navegador mínimo: cookies, Origin y Sec-Fetch-Site del mismo origen; sin seguir redirecciones. */
function browser(base: string) {
  const cookies = new Map<string, string>();
  const remember = (res: Response) => {
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const index = pair.indexOf('=');
      const value = pair.slice(index + 1);
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) cookies.delete(pair.slice(0, index));
      else cookies.set(pair.slice(0, index), value);
    }
    return res;
  };
  const headers = () => ({ origin: base, 'sec-fetch-site': 'same-origin', ...(cookies.size > 0 ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}) });
  return {
    get: async (path: string) => remember(await fetch(`${base}${path}`, { redirect: 'manual', headers: headers() })),
    post: async (path: string, form: Record<string, string>) =>
      remember(await fetch(`${base}${path}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers() }, body: new URLSearchParams(form).toString() })),
  };
}

const page = (html: string) => new JSDOM(html).window.document;
const text = (html: string) => page(html).body.textContent?.replace(/\s+/g, ' ') ?? '';

/** Campos del formulario como los enviaría el navegador (las casillas, solo si están marcadas). */
function formFields(html: string, selector: string): Record<string, string> {
  const form = page(html).querySelector(selector);
  if (!form) throw new Error(`No se encontró ${selector}`);
  const fields: Record<string, string> = {};
  for (const element of form.querySelectorAll<HTMLInputElement>('input[name], select[name], textarea[name]')) {
    if (element.type === 'checkbox' && !element.checked) continue;
    fields[element.name] = element.value;
  }
  return fields;
}

describe('inventario entre la API real y el admin nuevo', () => {
  it('un gerente creado por el administrador da de alta un artículo con su empaque, lo convierte y una edición simultánea recibe el conflicto', async () => {
    const { database, adminUrl } = await startStack();
    const owner = browser(adminUrl);
    expect((await owner.post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    const userForm = formFields(await (await owner.get('/usuarios/nuevo')).text(), '#user-form');
    const created = await owner.post('/usuarios', { ...userForm, username: 'gema', displayName: 'Gema Gerente', role: 'gerente', password: GEMA_PASSWORD, passwordConfirmation: GEMA_PASSWORD });
    expect(created.headers.get('location')).toBe('/usuarios?ok=created');

    const gema = browser(adminUrl);
    expect((await gema.post('/acceso', { username: 'gema', password: GEMA_PASSWORD })).status).toBe(303);
    expect((await gema.get('/')).headers.get('location')).toBe('/inventario/articulos');
    expect((await gema.get('/usuarios')).status).toBe(403);

    const categories = await (await gema.get('/inventario/categorias')).text();
    expect((await gema.post('/inventario/categorias', { ...formFields(categories, '#inventory-category-form'), name: 'Abarrotes' })).headers.get('location')).toBe('/inventario/categorias?ok=category_created');
    const category = await database.prisma.inventoryCategory.findFirstOrThrow({ where: { name: 'Abarrotes' } });

    const newForm = await (await gema.get('/inventario/articulos/nuevo')).text();
    const saved = await gema.post('/inventario/articulos', {
      ...formFields(newForm, '#inventory-item-form'),
      action: 'create',
      name: 'Masa de maíz',
      type: 'insumo',
      categoryId: String(category.id),
      baseUnit: 'kg',
      'units.0.name': 'bulto',
      'units.0.factor': '25',
    });
    expect(saved.status).toBe(303);
    const itemPath = (saved.headers.get('location') ?? '').split('?')[0] ?? '';
    expect(itemPath).toMatch(/^\/inventario\/articulos\/\d+$/);

    const detail = text(await (await gema.get(itemPath)).text());
    expect(detail).toContain('1 bulto = 25 kg');
    expect(detail).toContain('Alta · Gema Gerente');
    expect(text(await (await gema.get(`${itemPath}?cantidad=2&unidad=bulto`)).text())).toContain('2 bulto = 50 kg');
    expect(text(await (await gema.get('/inventario/articulos')).text())).toContain('Masa de maíz');

    // Los dos abren la edición con la misma versión; guarda primero el gerente.
    const ownerEdit = formFields(await (await owner.get(`${itemPath}/editar`)).text(), '#inventory-item-form');
    const gemaEdit = formFields(await (await gema.get(`${itemPath}/editar`)).text(), '#inventory-item-form');
    expect((await gema.post(itemPath, { ...gemaEdit, action: 'update', description: 'Para tortillas y molotes' })).status).toBe(303);
    const conflict = await owner.post(itemPath, { ...ownerEdit, action: 'update', name: 'Masa' });
    expect(conflict.status).toBe(409);
    expect(text(await conflict.text())).toMatch(/Última modificación: Gema Gerente, el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\./);

    const item = await database.prisma.inventoryItem.findFirstOrThrow({ where: { name: 'Masa de maíz' } });
    expect(item.description).toBe('Para tortillas y molotes');
    const history = await database.prisma.inventoryChange.findMany({ where: { entity: 'item', entityId: item.id }, orderBy: { id: 'asc' } });
    expect(history.map((entry) => [entry.action, entry.actorName])).toEqual([
      ['create', 'Gema Gerente'],
      ['update', 'Gema Gerente'],
    ]);
  }, 120_000);
});
