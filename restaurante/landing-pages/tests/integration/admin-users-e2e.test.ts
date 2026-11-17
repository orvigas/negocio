import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { makeDatabase } from '../support/database.ts';
import { freePorts, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';

/**
 * Usuarios y "Mi cuenta" de extremo a extremo con los procesos reales (REQ-F-040, PR 2): landing-pages
 * (con ADMIN_NEW_URL, como en producción, y sin base de datos desde REQ-F-045), la API contra MySQL
 * (prepara la instalación y crea el primer administrador) e inventory-manager.
 *
 * Un administrador crea, edita, desactiva, reactiva y restablece la contraseña de un editor en el admin
 * nuevo (formularios reales, sin JavaScript); las sesiones del editor caen cuando deben (D-8). El
 * editor cambia su contraseña en "Mi cuenta" y sigue con sesión (cookie nueva). El /admin retirado de
 * las landings lleva al admin nuevo. La auditoría registra cada paso y ningún log lleva secretos.
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
const FIRST = 'contraseña-de-nora-040';
const RESET = 'contraseña-restablecida-040';
const OWN = 'contraseña-propia-de-nora-040';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function startStack() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  // Distintos entre sí y de los de las landings (freePorts devuelve exactamente dos).
  const [apiPort, inventoryPort] = (await freePorts(2)) as [number, number];
  const adminUrl = `http://127.0.0.1:${inventoryPort}`;
  const landing = await startServer({ API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, ADMIN_NEW_URL: adminUrl }, 60_000);
  cleanups.push(() => landing.stop());
  expect(landing.started, landing.output().stderr).toBe(true);
  const api = await startServer({ ...ADMIN_ENV, DATABASE_URL: databaseUrl(database.config), PORT: String(apiPort), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
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
  const headers = () => ({ origin: base, 'sec-fetch-site': 'same-origin', ...(cookies.size > 0 ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}) });
  return {
    cookies,
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
type Browser = ReturnType<typeof browser>;

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

describe('usuarios y "Mi cuenta" entre los dos admins (CA-3 a CA-5, CA-7, CA-8, CA-12 y CA-14)', () => {
  it('alta, cambio de negocios, desactivar, reactivar, restablecer y "Mi cuenta", con la auditoría y sin secretos en los logs', async () => {
    const stack = await startStack();
    const owner = browser(stack.adminUrl);
    expect((await owner.post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    const csrf = formFields(await (await owner.get('/usuarios/nuevo')).text(), '#user-form')._csrf ?? '';

    // Alta en el admin nuevo, sin JavaScript.
    const created = await owner.post('/usuarios', { _csrf: csrf, username: 'nora', displayName: 'Nora Editora', role: 'editor', 'business-molotes': 'on', password: FIRST, passwordConfirmation: FIRST });
    expect(created.headers.get('location')).toBe('/usuarios?ok=created');
    const nora = await stack.database.prisma.user.findUniqueOrThrow({ where: { usernameKey: 'nora' } });

    /** Nora entra en el admin nuevo. */
    const signIn = async (password: string) => {
      const inventory = browser(stack.adminUrl);
      expect((await inventory.post('/acceso', { username: 'nora', password })).status).toBe(303);
      return { inventory };
    };
    const expectSessions = async ({ inventory }: { inventory: Browser }, open: boolean) => {
      expect((await inventory.get('/cuenta')).status).toBe(open ? 200 : 303);
    };
    const canEnter = async (password: string) => (await browser(stack.adminUrl).post('/acceso', { username: 'nora', password })).status;

    // Cambiar los negocios en el admin nuevo cierra sus sesiones (D-8).
    let sessions = await signIn(FIRST);
    await expectSessions(sessions, true);
    const edit = formFields(await (await owner.get(`/usuarios/${nora.id}/editar`)).text(), '#user-form');
    expect((await owner.post(`/usuarios/${nora.id}`, { ...edit, 'business-birria': 'on' })).headers.get('location')).toBe('/usuarios?ok=updated');
    await expectSessions(sessions, false);

    // Desactivar: su sesión cae y no puede entrar; reactivar: vuelve a entrar.
    sessions = await signIn(FIRST);
    expect((await owner.post(`/usuarios/${nora.id}/desactivar`, { _csrf: csrf })).headers.get('location')).toBe('/usuarios?ok=deactivated');
    await expectSessions(sessions, false);
    expect(await canEnter(FIRST)).toBe(401);
    expect((await owner.post(`/usuarios/${nora.id}/reactivar`, { _csrf: csrf })).headers.get('location')).toBe('/usuarios?ok=reactivated');

    // Restablecer: su sesión cae, la anterior deja de valer y la nueva sirve.
    sessions = await signIn(FIRST);
    const reset = await owner.post(`/usuarios/${nora.id}/contrasena`, { _csrf: csrf, password: RESET, passwordConfirmation: RESET });
    expect(reset.headers.get('location')).toBe('/usuarios?ok=password_reset');
    await expectSessions(sessions, false);
    expect(await canEnter(FIRST)).toBe(401);

    // "Mi cuenta" del admin nuevo: sigue con sesión (cookie nueva) y la contraseña nueva sirve.
    sessions = await signIn(RESET);
    const before = [...sessions.inventory.cookies.values()][0];
    const account = formFields(await (await sessions.inventory.get('/cuenta')).text(), '#user-form');
    const changed = await sessions.inventory.post('/cuenta', { ...account, currentPassword: RESET, password: OWN, passwordConfirmation: OWN });
    expect(changed.headers.get('location')).toBe('/cuenta?ok=password_change');
    expect([...sessions.inventory.cookies.values()][0]).not.toBe(before);
    expect((await sessions.inventory.get('/cuenta?ok=password_change')).status).toBe(200);
    expect(await canEnter(OWN)).toBe(303);

    // El /admin retirado de las landings lleva al admin nuevo (REQ-F-045, CA-1) y no deja escribir (CA-2).
    const oldAdmin = browser(stack.landing.url);
    const moved = await oldAdmin.get('/admin/usuarios');
    expect(moved.status).toBe(302);
    expect(moved.headers.get('location')).toBe(`${stack.adminUrl}/`);
    expect((await oldAdmin.post('/admin/login', { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(410);
    expect(oldAdmin.cookies.size).toBe(0);

    // La auditoría registra cada paso, con el actor y sin hashes.
    const audit = await stack.database.prisma.userAudit.findMany({ where: { targetId: nora.id }, orderBy: { id: 'asc' } });
    expect(audit.map((entry) => entry.action)).toEqual(['create', 'update', 'deactivate', 'reactivate', 'password_reset', 'password_change']);
    expect(audit.every((entry) => entry.actorKind === 'user')).toBe(true);
    expect(JSON.stringify(audit)).not.toMatch(/scrypt|contraseña-/);

    // Ningún log de los tres procesos lleva contraseñas, hashes, ids de sesión ni tokens CSRF. Las
    // líneas llegan por la tubería de stdout del hijo y pueden hacerlo después de la respuesta HTTP.
    await expect.poll(() => stack.api.output().stdout, { timeout: 10_000 }).toContain('"msg":"admin_password_changed"');
    const all = [stack.landing, stack.api, stack.inventory].flatMap((proc) => [proc.output().stdout, proc.output().stderr]).join('\n');
    for (const secret of [ADMIN_PASSWORD, FIRST, RESET, OWN, 'scrypt$', csrf, ...owner.cookies.values(), ...sessions.inventory.cookies.values()]) {
      expect(all).not.toContain(secret);
    }
  }, 180_000);
});
