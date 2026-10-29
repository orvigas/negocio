import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { hashPassword } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { VALID_ENV } from '../helpers.ts';
import { ADMIN_ENV, TEST_HASH_PARAMS } from '../support/admin.ts';
import { makeDatabase, makeTempDir } from '../support/database.ts';
import { freePorts, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';

/**
 * De extremo a extremo con los procesos reales (REQ-F-039, PR 3; CA-9 y CA-10): landing-pages, la API
 * e inventory-manager contra MySQL, con el aviso interno conectado como en producción
 * (LANDING_INTERNAL_URL -> INTERNAL_PORT de landing-pages, con la misma credencial).
 *
 * Un producto marcado como no disponible en el admin nuevo deja de verse en la siguiente visita a la
 * landing y el catálogo del bot se recarga, sin reiniciar nada. Un aviso con una credencial incorrecta
 * no invalida nada.
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
const EDITOR = { username: 'eli-e2e', password: 'contraseña-de-eli-e2e-039' };
const TOKEN = VALID_ENV.INTERNAL_NOTIFY_TOKEN;

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

const logLines = (stdout: string) =>
  stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);

async function startStack() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const dataDir = await makeTempDir();
  cleanups.push(dataDir.cleanup);
  // Distintos entre sí y de los de las landings (freePorts devuelve exactamente dos).
  const [apiPort, inventoryPort] = (await freePorts(2)) as [number, number];
  // Las landings arrancan sin API (sirven la semilla) y la leen en cuanto responde.
  const landing = await startServer({ DATA_DIR: dataDir.dir, ...ADMIN_ENV, DATABASE_URL: databaseUrl(database.config), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000);
  cleanups.push(() => landing.stop());
  expect(landing.started, landing.output().stderr).toBe(true);
  const api = await startServer(
    { DATABASE_URL: databaseUrl(database.config), PORT: String(apiPort), LANDING_INTERNAL_URL: landing.internalUrl, INTERNAL_NOTIFY_TOKEN: TOKEN },
    60_000,
    { args: [API_ENTRY] },
  );
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const passwordHash = await hashPassword(EDITOR.password, TEST_HASH_PARAMS);
  await createUserRepository({ prisma: database.prisma }).create(
    { username: EDITOR.username, displayName: 'Eli E2E', role: 'editor', businesses: ['molotes'], passwordHash },
    { kind: 'system' },
  );
  const inventory = await startServer({ NODE_ENV: 'development', PORT: String(inventoryPort), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000, { args: [INVENTORY_ENTRY] });
  cleanups.push(() => inventory.stop());
  expect(inventory.started, inventory.output().stderr).toBe(true);
  return { landing, api, inventory, adminUrl: `http://127.0.0.1:${inventoryPort}` };
}

/** Navegador mínimo del admin: cookie, Origin y Sec-Fetch-Site del mismo origen; sin seguir redirecciones. */
function browser(base: string) {
  let cookie = '';
  const remember = (res: Response) => {
    for (const line of res.headers.getSetCookie()) cookie = line.split(';')[0] ?? '';
    return res;
  };
  const headers = () => ({ origin: base, 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) });
  return {
    get: async (path: string) => remember(await fetch(`${base}${path}`, { redirect: 'manual', headers: headers() })),
    post: async (path: string, form: Record<string, string>) =>
      remember(
        await fetch(`${base}${path}`, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers() },
          body: new URLSearchParams(form).toString(),
        }),
      ),
  };
}

/** Campos del formulario como los enviaría el navegador (las casillas, solo si están marcadas). */
function formFields(html: string, selector: string): Record<string, string> {
  const form = new JSDOM(html).window.document.querySelector(selector);
  if (!form) throw new Error(`No se encontró ${selector}`);
  const fields: Record<string, string> = {};
  for (const element of form.querySelectorAll<HTMLInputElement>('input[name], select[name], textarea[name]')) {
    if (element.type === 'checkbox' && !element.checked) continue;
    fields[element.name] = element.value;
  }
  return fields;
}

const landingHtml = async (url: string) => (await fetch(`${url}/molotes`)).text();

describe('admin nuevo -> api -> aviso -> landing y bot (CA-9 y CA-10)', () => {
  it('un producto marcado como no disponible desaparece en la siguiente visita a la landing y el bot recarga, sin reiniciar', async () => {
    const stack = await startStack();
    const admin = browser(stack.adminUrl);
    expect((await admin.post('/acceso', { username: EDITOR.username, password: EDITOR.password })).status).toBe(303);

    // Primer producto de la lista de Molotes, visible en la landing (cuando la landing ya leyó la API).
    const list = new JSDOM(await (await admin.get('/molotes/productos')).text()).window.document;
    const row = list.querySelector('[data-product-row]');
    const id = row?.getAttribute('data-product-row') ?? '';
    const name = row?.querySelector('.product-row__name')?.textContent?.replace(/^\s*\d+\.\s*/, '').trim() ?? '';
    expect(name).not.toBe('');
    let visible = false;
    for (let attempt = 0; attempt < 30 && !visible; attempt += 1) {
      visible = (await landingHtml(stack.landing.url)).includes(name);
      if (!visible) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(visible).toBe(true);

    // Edición en el admin nuevo: se quita "Disponible" y se guarda.
    const edit = await (await admin.get(`/molotes/productos/${id}/editar`)).text();
    const fields = formFields(edit, '#product-form');
    expect(fields.available).toBe('on');
    delete fields.available;
    const saved = await admin.post(`/molotes/productos/${id}`, { ...fields, action: 'update' });
    expect(saved.status).toBe(303);
    // La landing y el bot confirmaron el aviso antes de responder (sin "pendiente").
    expect(saved.headers.get('location')).toBe('/molotes/productos?ok=saved');

    // La siguiente visita ya no lo muestra, sin reiniciar ningún proceso.
    expect(await landingHtml(stack.landing.url)).not.toContain(name);
    // La línea de log llega por la tubería de stdout del proceso hijo y puede hacerlo después de la
    // respuesta HTTP: se espera a que esté antes de comprobarla.
    const notifiedLines = () => logLines(stack.landing.output().stdout).filter((line) => line.msg === 'products_change_notified');
    await expect.poll(() => notifiedLines().length).toBeGreaterThan(0);
    expect(notifiedLines().at(-1)).toMatchObject({ business: 'molotes', landing: true, bot: true });

    // Ningún log de los tres procesos lleva la contraseña ni la credencial del aviso (CA-16).
    const all = [stack.landing, stack.api, stack.inventory].flatMap((proc) => [proc.output().stdout, proc.output().stderr]).join('\n');
    expect(all).not.toContain(EDITOR.password);
    expect(all).not.toContain(TOKEN);
  });

  it('un aviso con una credencial incorrecta o sin ella se rechaza y no invalida nada (CA-10)', async () => {
    const stack = await startStack();
    const post = (token: string | null) =>
      fetch(`${stack.landing.internalUrl}/internal/v1/productos-cambiados`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ business: 'molotes' }),
      });
    for (const token of [null, 'otra-credencial-incorrecta-0123456789abcdef']) expect((await post(token)).status).toBe(401);
    // La respuesta 401 puede llegar antes que la línea de log del rechazo (tubería de stdout del hijo).
    await expect.poll(() => logLines(stack.landing.output().stdout).filter((line) => line.msg === 'internal_notify_rejected').length).toBe(2);
    const lines = logLines(stack.landing.output().stdout);
    expect(lines.filter((line) => line.msg === 'internal_notify_rejected')).toHaveLength(2);
    expect(lines.some((line) => line.msg === 'products_change_notified')).toBe(false);
    // El puerto de la app (el que enruta Traefik) no tiene el aviso.
    expect((await fetch(`${stack.landing.url}/internal/v1/productos-cambiados`, { method: 'POST' })).status).toBe(404);
  });
});
