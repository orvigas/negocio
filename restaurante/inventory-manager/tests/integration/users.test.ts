import { describe, expect, it } from 'vitest';

import { ANA, ELI, dom, formFields, startInventory, type Browser, type Harness } from '../support/browser.ts';

/**
 * Usuarios y "Mi cuenta" en el admin nuevo, sin JavaScript (REQ-F-040: RF-1 a RF-10, RF-14, RF-15 y
 * RF-17; CA-1 a CA-3, CA-5 a CA-13 y CA-15), contra el doble de /api/v1/admin. Todo con
 * POST/redirect/GET. Las reglas reales (MySQL y los dos admins) están en landing-pages/tests.
 */

const NEW_PASSWORD = 'contraseña-nueva-040';
const ELI_ID = ELI.user.id;
const ANA_ID = ANA.user.id;

async function as(user = ANA, options: Parameters<typeof startInventory>[0] = {}) {
  const h = await startInventory(options);
  const browser = h.browser();
  expect((await browser.login(user)).status).toBe(303);
  return { h, browser };
}

const userRequests = (h: Harness) => h.api.requests.filter((request) => request.path.includes('/usuarios') || request.path.includes('/cuenta'));
const lastWrite = (h: Harness) => [...h.api.requests].reverse().find((request) => request.method !== 'GET');
const formOf = async (browser: Browser, path: string) => formFields(await (await browser.get(path)).text(), '#user-form');
const text = (html: string) => dom(html).body.textContent?.replace(/\s+/g, ' ') ?? '';

describe('permisos (RF-1, CA-1)', () => {
  it('un editor no ve "Usuarios" y recibe 403 sin datos en cada pantalla y acción, sin pedir usuarios a la API', async () => {
    const { h, browser } = await as(ELI);
    const home = dom(await (await browser.get('/molotes/productos')).text());
    expect([...home.querySelectorAll('.admin-header__nav a')].map((link) => link.textContent)).toEqual(['Molotes']);
    expect(home.querySelector('a[href="/cuenta"]')?.textContent).toBe('Mi cuenta');

    const csrf = formFields(await (await browser.get('/cuenta')).text(), '#user-form')._csrf ?? '';
    for (const path of ['/usuarios', '/usuarios/nuevo', `/usuarios/${ELI_ID}/editar`, `/usuarios/${ANA_ID}/contrasena`, '/usuarios/abc/editar']) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(403);
      const body = await res.text();
      expect(body).toContain('No tienes permiso para gestionar usuarios.');
      expect(body).not.toContain('Ana Admin (ana)');
    }
    for (const [path, form] of [
      ['/usuarios', { _csrf: csrf, username: 'x', displayName: 'x', role: 'admin', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }],
      [`/usuarios/${ELI_ID}`, { _csrf: csrf, username: 'eli', displayName: 'Eli', role: 'admin' }],
      [`/usuarios/${ANA_ID}/desactivar`, { _csrf: csrf }],
      [`/usuarios/${ANA_ID}/reactivar`, { _csrf: csrf }],
      [`/usuarios/${ANA_ID}/contrasena`, { _csrf: csrf, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }],
    ] as const) {
      expect((await browser.post(path, form)).status, path).toBe(403);
    }
    expect(userRequests(h)).toEqual([]);
  });

  it('sin sesión: al acceso con el retorno a la pantalla pedida, y tras entrar se vuelve a ella (RF-14, CA-15)', async () => {
    const h = await startInventory();
    const browser = h.browser();
    for (const path of ['/usuarios', '/usuarios/nuevo', `/usuarios/${ELI_ID}/editar`, `/usuarios/${ELI_ID}/contrasena`, '/cuenta']) {
      const res = await browser.get(path);
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe(`/acceso?next=${encodeURIComponent(path)}`);
    }
    const back = await browser.login(ANA, `/usuarios/${ELI_ID}/editar`);
    expect(back.headers.get('location')).toBe(`/usuarios/${ELI_ID}/editar`);
    const outside = await h.browser().login(ANA, '//evil.example/usuarios');
    expect(outside.headers.get('location')).toBe('/');
  });
});

describe('lista (RF-3, CA-2)', () => {
  it('muestra usuario, nombre, rol, negocios ("Todos" para el administrador), estado en texto y último acceso', async () => {
    const { h, browser } = await as();
    h.api.managed[1]!.lastLoginAt = '2026-10-28T13:45:10-06:00';
    h.api.managed[1]!.active = false;
    const res = await browser.get('/usuarios');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const html = await res.text();
    const page = dom(html);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(page.querySelector('.admin-header__nav a[aria-current="page"]')?.textContent).toBe('Usuarios');
    const rows = [...page.querySelectorAll('[data-user-row]')].map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('Ana Admin (ana)');
    expect(rows[0]).toContain('Rol: Administrador');
    expect(rows[0]).toContain('Negocios: Todos');
    expect(rows[0]).toContain('Estado: Activo');
    expect(rows[0]).toContain('Último acceso: Nunca');
    expect(rows[1]).toContain('Negocios: Molotes');
    expect(rows[1]).toContain('Estado: Desactivado');
    expect(rows[1]).toContain('Último acceso: 28/10/2026 13:45');
    // Desactivar y reactivar son botones de formulario (POST), con el nombre del usuario.
    const forms = [...page.querySelectorAll<HTMLFormElement>('form.user-status')];
    expect(forms.map((form) => [form.method, form.getAttribute('action'), form.querySelector('button')?.textContent])).toEqual([
      ['post', `/usuarios/${ANA_ID}/desactivar`, 'Desactivar a Ana Admin'],
      ['post', `/usuarios/${ELI_ID}/reactivar`, 'Reactivar a Eli Molotes'],
    ]);
  });
});

describe('alta (RF-4, CA-3)', () => {
  it('sin JS: crea el usuario con el token CSRF y vuelve a la lista con el aviso; el nuevo puede entrar', async () => {
    const { h, browser } = await as();
    const html = await (await browser.get('/usuarios/nuevo')).text();
    const page = dom(html);
    expect(page.querySelector('#f-username')?.getAttribute('autocomplete')).toBe('off');
    expect(page.querySelector('#f-password')?.getAttribute('autocomplete')).toBe('new-password');
    expect(page.querySelector('#f-password')?.hasAttribute('minlength')).toBe(false);
    expect(page.querySelector('#f-password')?.hasAttribute('maxlength')).toBe(false);
    expect(page.querySelector('#f-passwordConfirmation')?.getAttribute('autocomplete')).toBe('new-password');
    expect(page.querySelector('label[for="f-password"]')?.textContent).toBe('Contraseña nueva');
    expect(page.querySelector('#f-password-help')?.textContent).toContain('Entre 12 y 256 caracteres');
    const fields = formFields(html, '#user-form');
    const res = await browser.post('/usuarios', { ...fields, username: 'nora', displayName: 'Nora Nueva', role: 'editor', 'business-birria': 'on', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/usuarios?ok=created');
    const write = lastWrite(h);
    expect(write?.headers['x-csrf-token']).toBe(fields._csrf);
    expect(write?.body).toEqual({ username: 'nora', displayName: 'Nora Nueva', role: 'editor', businesses: ['birria'], password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    const list = text(await (await browser.get('/usuarios?ok=created')).text());
    expect(list).toContain('Usuario creado: ya puede entrar con su contraseña.');
    expect(list).toContain('Nora Nueva (nora)');
    expect((await h.browser().login({ username: 'nora', password: NEW_PASSWORD, user: ELI.user })).status).toBe(303);
  });

  it('422: lo escrito se conserva sin las contraseñas, el error va junto a su campo y en el resumen con enlace', async () => {
    const { browser } = await as();
    const fields = await formOf(browser, '/usuarios/nuevo');
    const res = await browser.post('/usuarios', { ...fields, username: 'ELI', displayName: 'Otra Eli', role: 'editor', 'business-molotes': 'on', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).not.toContain(NEW_PASSWORD);
    const page = dom(html);
    const username = page.querySelector<HTMLInputElement>('#f-username');
    expect(username?.value).toBe('ELI');
    expect(username?.getAttribute('aria-invalid')).toBe('true');
    expect(username?.getAttribute('aria-describedby')).toContain('f-username-error');
    expect(page.querySelector('#f-username-error')?.textContent).toContain('Ya existe un usuario con ese nombre de acceso');
    expect(page.querySelector<HTMLInputElement>('#f-displayName')?.value).toBe('Otra Eli');
    expect(page.querySelector<HTMLInputElement>('#f-business-molotes')?.checked).toBe(true);
    expect(page.querySelector<HTMLInputElement>('#f-password')?.value).toBe('');
    expect(page.querySelector('.notice--error a[href="#f-username"]')?.textContent).toContain('Usuario de acceso');
    expect(page.querySelector('.notice--error')?.getAttribute('role')).toBe('alert');
  });

  it('un campo desconocido (por ejemplo, `active`): 400 sin llamar a la API', async () => {
    const { h, browser } = await as();
    const fields = await formOf(browser, '/usuarios/nuevo');
    const before = userRequests(h).length;
    const res = await browser.post('/usuarios', { ...fields, username: 'x', active: 'false' });
    expect(res.status).toBe(400);
    expect(userRequests(h).length).toBe(before);
  });

  it('con la API caída (503): aviso de servicio no disponible, lo escrito conservado sin contraseñas y sin trazas (CA-10)', async () => {
    const { h, browser } = await as();
    const fields = await formOf(browser, '/usuarios/nuevo');
    for (const mode of ['writes-down', 'down'] as const) {
      h.api.mode = mode;
      const res = await browser.post('/usuarios', { ...fields, username: 'nora', displayName: 'Nora', role: 'editor', 'business-birria': 'on', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
      expect(res.status, mode).toBe(503);
      const html = await res.text();
      expect(html).toContain('Servicio no disponible.');
      expect(html).not.toContain(NEW_PASSWORD);
      expect(html).not.toMatch(/DATABASE_UNAVAILABLE|at \w+ \(/);
      expect(dom(html).querySelector<HTMLInputElement>('#f-username')?.value).toBe('nora');
      expect(dom(html).querySelector<HTMLInputElement>('#f-business-birria')?.checked).toBe(true);
    }
  });
});

describe('edición, estado y contraseña (RF-5 a RF-9)', () => {
  it('editar: el formulario trae sus datos y el estado; guardar vuelve a la lista (PRG)', async () => {
    const { h, browser } = await as();
    const html = await (await browser.get(`/usuarios/${ELI_ID}/editar`)).text();
    const page = dom(html);
    expect(page.querySelector('h1')?.textContent).toBe('Editar a Eli Molotes');
    expect(page.querySelector('#f-password')).toBeNull();
    expect(page.querySelector('.user-form__status')?.textContent).toContain('Activo');
    expect(page.querySelector('.user-form__status form')?.getAttribute('action')).toBe(`/usuarios/${ELI_ID}/desactivar`);
    const fields = formFields(html, '#user-form');
    expect(fields).toMatchObject({ username: 'eli', displayName: 'Eli Molotes', role: 'editor', 'business-molotes': 'on' });
    const res = await browser.post(`/usuarios/${ELI_ID}`, { ...fields, 'business-birria': 'on' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/usuarios?ok=updated');
    expect(lastWrite(h)?.body).toEqual({ username: 'eli', displayName: 'Eli Molotes', role: 'editor', businesses: ['molotes', 'birria'] });
  });

  it('id inexistente o mal formado: 404 sin datos (CA-11)', async () => {
    const { browser } = await as();
    for (const path of ['/usuarios/999/editar', '/usuarios/abc/editar', '/usuarios/0/contrasena', '/usuarios/999/contrasena']) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(404);
      expect(await res.text()).toContain('No encontramos lo que buscas.');
    }
  });

  it('último administrador (409): aviso urgente, lo escrito se conserva y nada cambia (CA-6)', async () => {
    const { h, browser } = await as();
    const fields = await formOf(browser, `/usuarios/${ANA_ID}/editar`);
    const res = await browser.post(`/usuarios/${ANA_ID}`, { ...fields, role: 'editor', 'business-birria': 'on' });
    expect(res.status).toBe(409);
    const page = dom(await res.text());
    const alert = page.querySelector('.notice[role="alert"]');
    expect(alert?.textContent).toContain('Debe quedar al menos un administrador activo');
    expect(alert?.hasAttribute('autofocus')).toBe(true);
    expect(page.querySelector<HTMLSelectElement>('#f-role')?.value).toBe('editor');
    expect(h.api.managed.find((user) => user.id === ANA_ID)?.role).toBe('admin');

    const csrf = fields._csrf ?? '';
    const off = await browser.post(`/usuarios/${ANA_ID}/desactivar`, { _csrf: csrf });
    expect(off.status).toBe(409);
    expect(await off.text()).toContain('Debe quedar al menos un administrador activo');
    expect(h.api.managed.find((user) => user.id === ANA_ID)?.active).toBe(true);
  });

  it('desactivar y reactivar a otro: PRG con su aviso', async () => {
    const { h, browser } = await as();
    const csrf = (await formOf(browser, '/usuarios/nuevo'))._csrf ?? '';
    const off = await browser.post(`/usuarios/${ELI_ID}/desactivar`, { _csrf: csrf });
    expect(off.headers.get('location')).toBe('/usuarios?ok=deactivated');
    expect(h.api.managed.find((user) => user.id === ELI_ID)?.active).toBe(false);
    const on = await browser.post(`/usuarios/${ELI_ID}/reactivar`, { _csrf: csrf });
    expect(on.headers.get('location')).toBe('/usuarios?ok=reactivated');
    expect(await (await browser.get('/usuarios?ok=reactivated')).text()).toContain('Usuario reactivado');
  });

  it('degradarse a sí mismo sin ser el último administrador: cookie borrada y al acceso con el aviso; ya no ve "Usuarios"', async () => {
    const { h, browser } = await as();
    // Un segundo administrador (por la API) para que Ana no sea la última.
    const csrf = (await formOf(browser, '/usuarios/nuevo'))._csrf ?? '';
    await browser.post('/usuarios', { _csrf: csrf, username: 'beto', displayName: 'Beto', role: 'admin', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    const fields = await formOf(browser, `/usuarios/${ANA_ID}/editar`);
    const res = await browser.post(`/usuarios/${ANA_ID}`, { ...fields, role: 'editor', 'business-birria': 'on' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/acceso?ok=sesion_cerrada');
    expect(browser.cookies.size).toBe(0);
    const login = await (await browser.get('/acceso?ok=sesion_cerrada')).text();
    expect(text(login)).toContain('Tu sesión se cerró.');
    expect((await browser.login({ ...ANA, password: ANA.password })).status).toBe(303);
    const nav = dom(await (await browser.get('/birria/productos')).text());
    expect([...nav.querySelectorAll('.admin-header__nav a')].map((link) => link.textContent)).not.toContain('Usuarios');
    expect((await browser.get('/usuarios')).status).toBe(403);
    expect(h.api.managed.find((user) => user.id === ANA_ID)?.role).toBe('editor');
  });

  it('restablecer la contraseña de otro: sin `value`, PRG y la contraseña anterior deja de valer', async () => {
    const { h, browser } = await as();
    const html = await (await browser.get(`/usuarios/${ELI_ID}/contrasena`)).text();
    expect(dom(html).querySelector('h1')?.textContent).toBe('Restablecer la contraseña de Eli Molotes');
    const fields = formFields(html, '#user-form');
    expect(Object.keys(fields).sort()).toEqual(['_csrf', 'password', 'passwordConfirmation']);
    const bad = await browser.post(`/usuarios/${ELI_ID}/contrasena`, { ...fields, password: NEW_PASSWORD, passwordConfirmation: 'otra-cosa-larga' });
    expect(bad.status).toBe(422);
    const badHtml = await bad.text();
    expect(badHtml).not.toContain(NEW_PASSWORD);
    expect(dom(badHtml).querySelector('#f-passwordConfirmation-error')?.textContent).toContain('Las contraseñas no coinciden.');
    const res = await browser.post(`/usuarios/${ELI_ID}/contrasena`, { ...fields, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.headers.get('location')).toBe('/usuarios?ok=password_reset');
    expect((await h.browser().login(ELI)).status).toBe(401);
  });

  it('restablecerse la propia contraseña desde "Usuarios" cierra también la sesión actual', async () => {
    const { browser } = await as();
    const fields = await formOf(browser, `/usuarios/${ANA_ID}/contrasena`);
    const res = await browser.post(`/usuarios/${ANA_ID}/contrasena`, { ...fields, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.headers.get('location')).toBe('/acceso?ok=sesion_cerrada');
    expect((await browser.get('/usuarios')).status).toBe(303);
  });
});

describe('seguridad (CA-9, CA-12)', () => {
  it('un Origin ajeno o Sec-Fetch-Site distinto: 403 sin llamar a la API', async () => {
    const { h, browser } = await as();
    const fields = await formOf(browser, '/usuarios/nuevo');
    const before = h.api.requests.length;
    expect((await browser.post(`/usuarios/${ELI_ID}/desactivar`, { _csrf: fields._csrf ?? '' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await browser.post('/cuenta', { _csrf: fields._csrf ?? '' }, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(h.api.requests.length).toBe(before);
  });

  it('sin token CSRF o con uno de otra sesión: la API responde 403 y se muestra "Petición no válida"; nada cambia', async () => {
    const { h, browser } = await as();
    const other = h.browser();
    await other.login(ANA);
    const foreign = (await formOf(other, '/usuarios/nuevo'))._csrf ?? '';
    for (const csrf of ['', foreign]) {
      const res = await browser.post(`/usuarios/${ELI_ID}/desactivar`, { _csrf: csrf });
      expect(res.status).toBe(403);
      expect(await res.text()).toContain('Petición no válida');
    }
    expect(h.api.managed.find((user) => user.id === ELI_ID)?.active).toBe(true);
  });

  it('ningún log contiene contraseñas, ids de sesión ni tokens CSRF', async () => {
    const { h, browser } = await as();
    const fields = await formOf(browser, '/usuarios/nuevo');
    await browser.post('/usuarios', { ...fields, username: 'nora', displayName: 'Nora', role: 'editor', 'business-birria': 'on', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    const account = await formOf(browser, '/cuenta');
    await browser.post('/cuenta', { ...account, currentPassword: ANA.password, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    const logs = h.logger.lines.join('\n');
    for (const secret of [NEW_PASSWORD, ANA.password, fields._csrf ?? 'x', ...h.api.sessions.keys(), ...browser.cookies.values()]) expect(logs).not.toContain(secret);
  });
});

describe('"Mi cuenta" (RF-2, RF-10, CA-8)', () => {
  it('un editor cambia su contraseña: la cookie se reescribe con la sesión nueva y la página siguiente la usa', async () => {
    const { h, browser } = await as(ELI);
    const html = await (await browser.get('/cuenta')).text();
    const page = dom(html);
    expect(page.querySelector('h1')?.textContent).toBe('Mi cuenta');
    expect(page.querySelector('a[href="/cuenta"]')?.getAttribute('aria-current')).toBe('page');
    expect(text(html)).toContain('Rol: Editor');
    expect(page.querySelector('#f-currentPassword')?.getAttribute('autocomplete')).toBe('current-password');
    expect(page.querySelector('#f-password')?.getAttribute('autocomplete')).toBe('new-password');
    const before = [...browser.cookies.values()][0];
    const other = h.browser();
    await other.login(ELI);

    const fields = formFields(html, '#user-form');
    const res = await browser.post('/cuenta', { ...fields, currentPassword: ELI.password, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/cuenta?ok=password_change');
    const cookie = res.headers.getSetCookie().find((line) => line.startsWith('admin_sid='));
    expect(cookie?.toLowerCase()).toContain('httponly');
    expect(cookie?.toLowerCase()).toContain('samesite=strict');
    const after = [...browser.cookies.values()][0];
    expect(after).not.toBe(before);
    expect(h.api.sessions.has(after ?? '')).toBe(true);
    expect(h.api.sessions.has(before ?? '')).toBe(false);
    const done = await browser.get('/cuenta?ok=password_change');
    expect(done.status).toBe(200);
    expect(await done.text()).toContain('Contraseña cambiada.');
    // La otra sesión del mismo usuario dejó de valer.
    expect((await other.get('/cuenta')).status).toBe(303);
    expect((await h.browser().login({ ...ELI, password: NEW_PASSWORD })).status).toBe(303);
  });

  it('con la actual incorrecta: error en ese campo, sin repintar contraseñas, y la sesión sigue igual', async () => {
    const { h, browser } = await as(ELI);
    const fields = await formOf(browser, '/cuenta');
    const res = await browser.post('/cuenta', { ...fields, currentPassword: 'no-es-la-mia', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).not.toContain(NEW_PASSWORD);
    expect(html).not.toContain('no-es-la-mia');
    const current = dom(html).querySelector('#f-currentPassword');
    expect(current?.getAttribute('aria-invalid')).toBe('true');
    expect(dom(html).querySelector('#f-currentPassword-error')?.textContent).toContain('La contraseña actual no es correcta.');
    expect(h.api.passwords.get(ELI_ID)).toBe(ELI.password);
    expect((await browser.get('/cuenta')).status).toBe(200);
  });

  it.each([['role', 'admin'], ['businesses', 'birria'], ['id', '1'], ['business-birria', 'on']])('un campo ajeno (%s): 400 y no se llama a la API', async (name, value) => {
    const { h, browser } = await as(ELI);
    const fields = await formOf(browser, '/cuenta');
    const res = await browser.post('/cuenta', { ...fields, currentPassword: ELI.password, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD, [name]: value });
    expect(res.status).toBe(400);
    expect(userRequests(h)).toEqual([]);
  });

  it('con la API caída: 503 con el aviso, sin contraseñas ni trazas', async () => {
    const { h, browser } = await as(ELI);
    const fields = await formOf(browser, '/cuenta');
    h.api.mode = 'down';
    const res = await browser.post('/cuenta', { ...fields, currentPassword: ELI.password, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).toContain('Servicio no disponible.');
    expect(html).not.toContain(NEW_PASSWORD);
    expect(html).not.toContain(ELI.password);
  });

  it('sesión caducada a mitad del formulario: al acceso con el aviso y el retorno a "Mi cuenta"', async () => {
    const { h, browser } = await as(ELI);
    const fields = await formOf(browser, '/cuenta');
    h.api.sessions.clear();
    const res = await browser.post('/cuenta', { ...fields, currentPassword: ELI.password, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/acceso?next=%2Fcuenta&expirada=1');
  });
});

describe('accesibilidad y diseño responsive (RF-17, CA-13)', () => {
  it.each(['/usuarios', '/usuarios/nuevo', `/usuarios/${ELI_ID}/editar`, `/usuarios/${ELI_ID}/contrasena`, '/cuenta'])('%s: un h1, etiquetas con su campo, salto al contenido y sin anchos fijos', async (path) => {
    const { browser } = await as();
    const html = await (await browser.get(path)).text();
    const page = dom(html);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('a[href="#contenido"]')?.textContent).toBe('Saltar al contenido');
    for (const input of page.querySelectorAll<HTMLInputElement>('main input:not([type="hidden"]), main select')) {
      expect(page.querySelector(`label[for="${input.id}"]`), input.name).not.toBeNull();
    }
    for (const input of page.querySelectorAll<HTMLInputElement>('input[type="password"]')) expect(input.hasAttribute('value')).toBe(false);
    // Sin desplazamiento horizontal a 375 px: nada de anchos fijos en píxeles; los textos largos se cortan.
    expect(html).not.toMatch(/\bw-\[\d+px\]|min-w-\[\d+px\]/);
  });
});
