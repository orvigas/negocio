import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER, csrfFrom } from '../support/admin.ts';
import { makeDatabase, makeTempDir } from '../support/database.ts';
import { freePorts, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';

/**
 * Sondas de QA de REQ-F-040, PR 2 (Q-1 a Q-4 del QA Action Plan), con los procesos reales contra MySQL:
 * landing-pages (con ADMIN_NEW_URL), la API e inventory-manager.
 *
 * - Q-1: la solo lectura del /admin actual no escribe nada sin sesión (303), con un editor (403) ni con
 *   un administrador y un cuerpo malicioso (410); la lista de solo lectura escapa el HTML.
 * - Q-2: en el admin nuevo, un POST con Origin ajeno, de otro sitio sin Origin o sin token CSRF da 403
 *   y no cambia la base.
 * - Q-3: un `?ok=` desconocido no pinta avisos; un editor que fuerza `role=admin` recibe 403 y sigue
 *   siendo editor.
 * - Q-4: el retorno tras entrar vuelve a las pantallas nuevas y descarta destinos externos o mal formados.
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
const EDITOR_PASSWORD = 'contraseña-qa-del-editor-040';
const XSS_NAME = '<img src=x onerror=alert(1)>';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function startStack() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const dataDir = await makeTempDir();
  cleanups.push(dataDir.cleanup);
  const [apiPort, inventoryPort] = (await freePorts(2)) as [number, number];
  const adminUrl = `http://127.0.0.1:${inventoryPort}`;
  const landing = await startServer(
    { DATA_DIR: dataDir.dir, ...ADMIN_ENV, DATABASE_URL: databaseUrl(database.config), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, ADMIN_NEW_URL: adminUrl },
    60_000,
  );
  cleanups.push(() => landing.stop());
  expect(landing.started, landing.output().stderr).toBe(true);
  const api = await startServer({ DATABASE_URL: databaseUrl(database.config), PORT: String(apiPort), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const inventory = await startServer({ NODE_ENV: 'development', PORT: String(inventoryPort), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000, { args: [INVENTORY_ENTRY] });
  cleanups.push(() => inventory.stop());
  expect(inventory.started, inventory.output().stderr).toBe(true);
  return { database, landing, api, inventory, adminUrl };
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
  const cookieHeader = (): Record<string, string> => (cookies.size > 0 ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {});
  const sameOrigin = () => ({ origin: base, 'sec-fetch-site': 'same-origin', ...cookieHeader() });
  return {
    get: async (path: string) => remember(await fetch(`${base}${path}`, { redirect: 'manual', headers: sameOrigin() })),
    post: async (path: string, form: Record<string, string>, headers: Record<string, string> = sameOrigin()) =>
      remember(
        await fetch(`${base}${path}`, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
          body: new URLSearchParams(form).toString(),
        }),
      ),
    cookieHeader,
  };
}

const csrfOf = (html: string): string => new JSDOM(html).window.document.querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';

describe('sondas de QA del PR 2 de REQ-F-040 (Q-1 a Q-4)', () => {
  it('solo lectura sin escrituras, mismo origen y CSRF, avisos, escalada forzada y retorno tras entrar', async () => {
    const stack = await startStack();
    const { prisma } = stack.database;
    // Estado de los usuarios y de su auditoría. Entrar actualiza `lastLoginAt` (y `updatedAt`): no cuenta como cambio.
    const snapshot = async () => {
      const users = await prisma.user.findMany({ include: { businesses: true }, orderBy: { id: 'asc' } });
      const stable = users.map((user) => ({ ...user, lastLoginAt: null, updatedAt: null }));
      return JSON.stringify([stable, await prisma.userAudit.findMany({ orderBy: { id: 'asc' } })]);
    };

    // Preparación: el administrador crea en el admin nuevo un editor con un nombre visible con HTML.
    const owner = browser(stack.adminUrl);
    expect((await owner.post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    const ownerCsrf = csrfOf(await (await owner.get('/usuarios/nuevo')).text());
    const created = await owner.post('/usuarios', {
      _csrf: ownerCsrf,
      username: 'qa"<editor',
      displayName: XSS_NAME,
      role: 'editor',
      'business-molotes': 'on',
      password: EDITOR_PASSWORD,
      passwordConfirmation: EDITOR_PASSWORD,
    });
    expect(created.headers.get('location')).toBe('/usuarios?ok=created');
    const editor = await prisma.user.findUniqueOrThrow({ where: { usernameKey: 'qa"<editor' } });

    // S-5: el HTML del nombre se pinta escapado en el admin nuevo (lista y edición).
    for (const path of ['/usuarios', `/usuarios/${editor.id}/editar`]) {
      const html = await (await owner.get(path)).text();
      expect(html, path).not.toContain(XSS_NAME);
      expect(html, path).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(new JSDOM(html).window.document.querySelectorAll('main img').length, path).toBe(0);
    }

    // Q-3: una clave `ok` desconocida no pinta ningún aviso; una conocida sí.
    const noticesOf = async (path: string) => new JSDOM(await (await owner.get(path)).text()).window.document.querySelectorAll('main .notice').length;
    expect(await noticesOf('/usuarios?ok=desconocido')).toBe(0);
    expect(await noticesOf('/usuarios?ok=__proto__')).toBe(0);
    expect(await noticesOf('/cuenta?ok=created')).toBe(0);
    expect(await noticesOf('/usuarios?ok=created')).toBe(1);

    // Q-1: el /admin actual en solo lectura.
    const landingAdmin = browser(stack.landing.url);
    expect((await landingAdmin.post('/admin/login', { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    const readonly = await (await landingAdmin.get('/admin/usuarios')).text();
    expect(readonly).not.toContain(XSS_NAME);
    expect(readonly).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(new JSDOM(readonly).window.document.querySelectorAll('main img, main form').length).toBe(0);
    const landingCsrf = csrfFrom(await (await landingAdmin.get('/admin/molotes')).text());

    const landingEditor = browser(stack.landing.url);
    expect((await landingEditor.post('/admin/login', { username: 'qa"<editor', password: EDITOR_PASSWORD })).status).toBe(303);
    const editorLandingCsrf = csrfFrom(await (await landingEditor.get('/admin/molotes')).text());

    const malicious = { role: 'admin', displayName: 'x'.repeat(20 * 1024) };
    const userPosts = ['/admin/usuarios', `/admin/usuarios/${editor.id}`, `/admin/usuarios/${editor.id}/desactivar`, `/admin/usuarios/${editor.id}/reactivar`, `/admin/usuarios/${editor.id}/contrasena`];
    const before = await snapshot();
    for (const path of [...userPosts, '/admin/cuenta']) {
      const anonymous = await browser(stack.landing.url).post(path, { ...malicious });
      expect(anonymous.status, `sin sesión ${path}`).toBe(303);
      expect(anonymous.headers.get('location'), `sin sesión ${path}`).toMatch(/^\/admin\/login/);
      const asAdmin = await landingAdmin.post(path, { _csrf: landingCsrf, ...malicious, password: 'otra-contraseña-000', passwordConfirmation: 'otra-contraseña-000' });
      expect(asAdmin.status, `administrador ${path}`).toBe(410);
      expect(asAdmin.headers.get('cache-control'), path).toBe('no-store');
    }
    for (const path of userPosts) expect((await landingEditor.post(path, { _csrf: editorLandingCsrf, ...malicious })).status, `editor ${path}`).toBe(403);
    expect((await landingEditor.post('/admin/cuenta', { _csrf: editorLandingCsrf, currentPassword: EDITOR_PASSWORD, password: 'otra-contraseña-000', passwordConfirmation: 'otra-contraseña-000' })).status).toBe(410);
    expect(await snapshot()).toBe(before);

    // Q-2: mismo origen y CSRF en el admin nuevo, contra la API real.
    const statusPath = `/usuarios/${editor.id}/desactivar`;
    const crossOrigin = { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', ...owner.cookieHeader() };
    const crossSiteNoOrigin = { 'sec-fetch-site': 'cross-site', ...owner.cookieHeader() };
    const forged: [string, Record<string, string>][] = [
      ['/usuarios', { _csrf: ownerCsrf, username: 'intruso', displayName: 'Intruso', role: 'admin', password: EDITOR_PASSWORD, passwordConfirmation: EDITOR_PASSWORD }],
      [statusPath, { _csrf: ownerCsrf }],
      ['/cuenta', { _csrf: ownerCsrf, currentPassword: ADMIN_PASSWORD, password: 'otra-contraseña-000', passwordConfirmation: 'otra-contraseña-000' }],
    ];
    for (const [path, form] of forged) {
      expect((await owner.post(path, form, crossOrigin)).status, `Origin ajeno ${path}`).toBe(403);
      expect((await owner.post(path, form, crossSiteNoOrigin)).status, `cross-site ${path}`).toBe(403);
      const withoutToken = Object.fromEntries(Object.entries(form).filter(([name]) => name !== '_csrf'));
      const noToken = await owner.post(path, withoutToken);
      expect(noToken.status, `sin _csrf ${path}`).toBe(403);
      expect(await noToken.text(), path).toContain('Petición no válida');
    }
    expect(await snapshot()).toBe(before);

    // Q-3: un editor que fuerza `role=admin` sobre sí mismo en el admin nuevo.
    const inventoryEditor = browser(stack.adminUrl);
    expect((await inventoryEditor.post('/acceso', { username: 'qa"<editor', password: EDITOR_PASSWORD })).status).toBe(303);
    const editorCsrf = csrfOf(await (await inventoryEditor.get('/cuenta')).text());
    const escalation = await inventoryEditor.post(`/usuarios/${editor.id}`, { _csrf: editorCsrf, username: 'qa"<editor', displayName: 'Ahora admin', role: 'admin' });
    expect(escalation.status).toBe(403);
    expect(await escalation.text()).not.toContain('Ahora admin');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: editor.id } })).role).toBe('editor');
    expect(await snapshot()).toBe(before);

    // Q-4: retorno tras entrar (RF-14, CA-15).
    const nextCases: [string, string][] = [
      ['/cuenta', '/cuenta'],
      ['/usuarios', '/usuarios'],
      ['/usuarios/nuevo', '/usuarios/nuevo'],
      [`/usuarios/${editor.id}/editar`, `/usuarios/${editor.id}/editar`],
      [`/usuarios/${editor.id}/contrasena`, `/usuarios/${editor.id}/contrasena`],
      ['/usuarios/0/editar', '/'],
      [`/usuarios/${editor.id}/desactivar`, '/'],
      ['//evil.example', '/'],
      ['/%2F%2Fevil.example', '/'],
      ['https://evil.example/usuarios', '/'],
      ['/usuarios?x=1', '/'],
    ];
    for (const [next, expected] of nextCases) {
      const page = await (await browser(stack.adminUrl).get(`/acceso?next=${encodeURIComponent(next)}`)).text();
      const hidden = new JSDOM(page).window.document.querySelector<HTMLInputElement>('input[name="next"]')?.value;
      expect(hidden, `formulario con next=${next}`).toBe(expected);
      const res = await browser(stack.adminUrl).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD, next });
      expect(res.status, next).toBe(303);
      expect(res.headers.get('location'), next).toBe(expected);
    }

    // CA-12: ningún log de los tres procesos contiene las contraseñas, hashes ni cookies de sesión.
    await expect.poll(() => stack.landing.output().stdout, { timeout: 5_000 }).toContain('admin_users_moved');
    const logs = [stack.landing, stack.api, stack.inventory].map((proc) => `${proc.output().stdout}\n${proc.output().stderr}`).join('\n');
    for (const secret of [ADMIN_PASSWORD, EDITOR_PASSWORD, 'otra-contraseña-000', 'scrypt$', ownerCsrf, editorCsrf, landingCsrf]) expect(logs).not.toContain(secret);
    const sessionIds = owner.cookieHeader().cookie?.split('; ').map((pair) => pair.slice(pair.indexOf('=') + 1)) ?? [];
    expect(sessionIds.length).toBeGreaterThan(0);
    for (const id of sessionIds) expect(logs).not.toContain(id);
  });
});
