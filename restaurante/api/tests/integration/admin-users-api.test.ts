import { describe, expect, it } from 'vitest';

import {
  lastAdminErrorSchema,
  passwordChangeResponseSchema,
  userListResponseSchema,
  userResponseSchema,
  userWriteResponseSchema,
  validationErrorSchema,
} from '@restaurante/contracts';
import { LAST_ADMIN_MESSAGE, USERNAME_TAKEN_MESSAGE, WRONG_CURRENT_PASSWORD_MESSAGE } from '@restaurante/core/identity';

import { ADMIN, MOLOTES_EDITOR, PASSWORD, call, login, nextIp, session, startAdmin, type AdminHarness, type Session, type TestUser } from '../support/admin.ts';

/**
 * Usuarios y cuenta propia en `/api/v1/admin` (REQ-F-040), en proceso con el doble del repositorio de
 * usuarios: permisos (RF-1, RF-2, CA-1), CSRF (CA-9), cuerpo cerrado (CA-8, R-2), códigos y formato de
 * error (RF-16), D-7 y D-8 tal como los ve el HTTP, cuenta propia (RF-10) y ausencia de secretos
 * (RF-13, CA-12). Las reglas reales con MySQL y entre los dos admins están en
 * landing-pages/tests/integration/users-api-process.test.ts.
 */

const P = '/api/v1/admin';
const NEW_PASSWORD = 'otra-contraseña-larga-040';
const SECOND_ADMIN: TestUser = { username: 'beto', displayName: 'Beto Admin', role: 'admin', businesses: [] };

const newEditor = (username = 'nora') => ({
  username,
  displayName: 'Nora Nueva',
  role: 'editor',
  businesses: ['birria'],
  password: NEW_PASSWORD,
  passwordConfirmation: NEW_PASSWORD,
});

const editorData = (businesses: string[] = ['molotes'], displayName = 'Eli Molotes') => ({ username: 'eli', displayName, role: 'editor', businesses });

/** Las 8 rutas, con un cuerpo válido para las escrituras. */
function routes(h: AdminHarness) {
  const eli = h.ids.eli as number;
  return [
    { method: 'GET', path: `${P}/usuarios` },
    { method: 'POST', path: `${P}/usuarios`, body: newEditor() },
    { method: 'GET', path: `${P}/usuarios/${eli}` },
    { method: 'PUT', path: `${P}/usuarios/${eli}`, body: editorData(['birria']) },
    { method: 'POST', path: `${P}/usuarios/${eli}/desactivar`, body: {} },
    { method: 'POST', path: `${P}/usuarios/${eli}/reactivar`, body: {} },
    { method: 'PUT', path: `${P}/usuarios/${eli}/contrasena`, body: { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } },
  ];
}

async function sessionStatus(h: AdminHarness, auth: Session): Promise<number> {
  return (await call(h.url, `${P}/sesion`, auth)).status;
}

describe('permisos (RF-1, CA-1) y CSRF (CA-9)', () => {
  it('sin sesión: 401 en todas las rutas, sin escribir', async () => {
    const h = await startAdmin();
    for (const route of [...routes(h), { method: 'POST', path: `${P}/cuenta/contrasena`, body: {} }]) {
      const res = await call(h.url, route.path, null, { method: route.method, body: route.body });
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    }
    expect(h.calls.writes).toBe(0);
  });

  it('un editor recibe 403 sin datos en todas las rutas de usuarios, también con su propio id y con un id mal formado', async () => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    const own = h.ids.eli as number;
    const all = [
      ...routes(h),
      { method: 'GET', path: `${P}/usuarios/abc` },
      { method: 'PUT', path: `${P}/usuarios/${own}`, body: { ...editorData(), role: 'admin' } },
      { method: 'POST', path: `${P}/usuarios/productos/desactivar`, body: {} },
      { method: 'GET', path: `${P}/usuarios/productos` },
    ];
    for (const route of all) {
      const res = await call(h.url, route.path, eli, { method: route.method, body: route.body });
      expect(res.status, `${route.method} ${route.path}`).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: { code: 'FORBIDDEN_ROLE', message: 'No tienes permiso para gestionar usuarios.' } });
    }
    expect(h.calls.writes).toBe(0);
    expect(h.audit).toEqual([]);
  });

  it('escrituras sin token CSRF, con el de otra sesión o con uno falso: 403 y nada cambia', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const other = await session(h.url, ADMIN);
    const writes = [...routes(h).filter((route) => route.method !== 'GET'), { method: 'POST', path: `${P}/cuenta/contrasena`, body: { currentPassword: PASSWORD, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } }];
    for (const csrf of [null, other.csrfToken, 'x'.repeat(43)]) {
      for (const route of writes) {
        const res = await call(h.url, route.path, ana, { method: route.method, body: route.body, csrf });
        expect(res.status, `${route.method} ${route.path}`).toBe(403);
        expect((await res.json()).error.code).toBe('CSRF_INVALID');
      }
    }
    expect(h.calls.writes).toBe(0);
  });
});

describe('usuarios (RF-3 a RF-9)', () => {
  it('lista: contrato, activos primero y por usuario de acceso, sin sessionVersion ni hashes; último acceso en la zona del negocio', async () => {
    const h = await startAdmin({ users: [MOLOTES_EDITOR, ADMIN, SECOND_ADMIN] });
    h.change(h.ids.beto as number, { active: false });
    await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios`, await session(h.url, ADMIN));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(text).not.toMatch(/sessionVersion|passwordHash|scrypt\$/);
    const body = userListResponseSchema.parse(JSON.parse(text));
    expect(body.users.map((user) => [user.username, user.active])).toEqual([
      ['ana', true],
      ['eli', true],
      ['beto', false],
    ]);
    const ana = body.users[0]!;
    expect(ana).toMatchObject({ role: 'admin', businesses: [], displayName: 'Ana Admin' });
    // 18:00 UTC del 26 de octubre es 12:00 en Ciudad de México (UTC-6).
    expect(ana.lastLoginAt).toBe('2026-10-26T12:00:00-06:00');
    expect(body.users[1]!.lastLoginAt).toBeNull();
  });

  it('crear: 201 con el contrato, auditoría `create` con el actor y el usuario nuevo puede entrar', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: newEditor() });
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toContain(NEW_PASSWORD);
    const { user } = userResponseSchema.parse(JSON.parse(text));
    expect(user).toMatchObject({ username: 'nora', displayName: 'Nora Nueva', role: 'editor', businesses: ['birria'], active: true, lastLoginAt: null });
    expect(h.audit).toEqual([{ action: 'create', actorId: h.ids.ana, targetId: user.id }]);
    expect((await login(h.url, 'nora', NEW_PASSWORD)).status).toBe(201);
  });

  it('crear con un administrador: los negocios enviados se ignoran (los tiene todos)', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: { ...newEditor(), role: 'admin', businesses: ['molotes'] } });
    expect(res.status).toBe(201);
    expect((await res.json()).user).toMatchObject({ role: 'admin', businesses: [] });
  });

  it.each([
    ['usuario vacío', { username: '  ' }, 'username'],
    ['usuario de 61 caracteres', { username: 'u'.repeat(61) }, 'username'],
    ['nombre con caracteres de control', { displayName: 'Nora\u0007' }, 'displayName'],
    ['rol desconocido', { role: 'root' }, 'role'],
    ['editor sin negocios', { businesses: [] }, 'businesses'],
    ['negocio desconocido', { businesses: ['tacos'] }, 'businesses'],
    ['negocios que no son lista', { businesses: 'birria' }, 'businesses'],
    ['contraseña de 11 caracteres', { password: 'c'.repeat(11), passwordConfirmation: 'c'.repeat(11) }, 'password'],
    ['contraseña de 257 caracteres', { password: 'c'.repeat(257), passwordConfirmation: 'c'.repeat(257) }, 'password'],
    ['confirmación distinta', { passwordConfirmation: 'otra-cosa-larga-040' }, 'passwordConfirmation'],
    ['campo desconocido', { sessionVersion: 9 }, 'sessionVersion'],
    ['usuario que no es texto', { username: 7 }, 'username'],
  ])('crear con %s: 422 en ese campo y no se crea nada', async (_name, patch, field) => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: { ...newEditor(), ...patch } });
    expect(res.status).toBe(422);
    const body = validationErrorSchema.parse(await res.json());
    expect(Object.keys(body.error.fields)).toContain(field);
    expect(h.calls.writes).toBe(0);
  });

  it('una contraseña de 12 caracteres multibyte (más de 12 bytes) se acepta: se cuentan caracteres', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const password = 'ñandú-güero!';
    expect([...password].length).toBe(12);
    const res = await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: { ...newEditor(), password, passwordConfirmation: password } });
    expect(res.status).toBe(201);
    expect((await login(h.url, 'nora', password)).status).toBe(201);
  });

  it('usuario de acceso repetido con otras mayúsculas (y doble envío): 422 en `username`, una sola cuenta', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    expect((await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: newEditor() })).status).toBe(201);
    for (const username of ['nora', 'NORA', 'Eli']) {
      const res = await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: newEditor(username) });
      expect(res.status).toBe(422);
      expect((await res.json()).error.fields).toEqual({ username: USERNAME_TAKEN_MESSAGE });
    }
    expect(h.audit.filter((entry) => entry.action === 'create')).toHaveLength(1);
  });

  it.each([
    ['sin application/json', { 'Content-Type': 'text/plain' }, 'hola', 415],
    ['JSON inválido', { 'Content-Type': 'application/json' }, '{', 400],
    ['más de 16 KiB', { 'Content-Type': 'application/json' }, JSON.stringify({ ...newEditor(), displayName: 'x'.repeat(17 * 1024) }), 413],
    ['una lista en vez de un objeto', { 'Content-Type': 'application/json' }, '[]', 422],
  ])('cuerpo %s: %s y no se crea nada', async (_name, headers, body, status) => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await fetch(`${h.url}${P}/usuarios`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${ana.id}`, 'X-CSRF-Token': ana.csrfToken }, body });
    expect(res.status).toBe(status);
    expect(Object.keys(await res.json())).toEqual(['error']);
    expect(h.calls.writes).toBe(0);
  });

  it.each(['999', '0', 'abc', '1e3', '12345678901', '-1'])('id %s inexistente o mal formado: 404 sin datos en ver y en las escrituras', async (id) => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    for (const route of [
      { method: 'GET', path: `${P}/usuarios/${id}` },
      { method: 'PUT', path: `${P}/usuarios/${id}`, body: editorData() },
      { method: 'POST', path: `${P}/usuarios/${id}/desactivar`, body: {} },
      { method: 'PUT', path: `${P}/usuarios/${id}/contrasena`, body: { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } },
    ]) {
      const res = await call(h.url, route.path, ana, { method: route.method, body: route.body });
      expect(res.status, `${route.method} ${route.path}`).toBe(404);
      expect(await res.json()).toEqual({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } });
    }
    expect(h.calls.writes).toBe(0);
  });

  it('editar los negocios cierra las sesiones del editor (D-8); editar solo el nombre no', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const eli = h.ids.eli as number;
    const eliSession = await session(h.url, MOLOTES_EDITOR);

    const rename = await call(h.url, `${P}/usuarios/${eli}`, ana, { method: 'PUT', body: editorData(['molotes'], 'Eli Renombrada') });
    expect(rename.status).toBe(200);
    expect(userWriteResponseSchema.parse(await rename.json()).meta).toEqual({ ownSessionClosed: false });
    expect(await sessionStatus(h, eliSession)).toBe(200);

    const res = await call(h.url, `${P}/usuarios/${eli}`, ana, { method: 'PUT', body: editorData(['molotes', 'birria'], 'Eli Renombrada') });
    expect(res.status).toBe(200);
    const body = userWriteResponseSchema.parse(await res.json());
    expect(body.user.businesses).toEqual(['molotes', 'birria']);
    expect(body.meta.ownSessionClosed).toBe(false);
    expect(await sessionStatus(h, eliSession)).toBe(401);
    expect(await sessionStatus(h, ana)).toBe(200);
    expect(h.audit.map((entry) => [entry.action, Object.keys(entry.changes ?? {})])).toEqual([
      ['update', ['displayName']],
      ['update', ['businesses']],
    ]);
  });

  it('editar sin cambios no audita', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    expect((await call(h.url, `${P}/usuarios/${h.ids.eli}`, ana, { method: 'PUT', body: editorData() })).status).toBe(200);
    expect(h.audit).toEqual([]);
  });

  it('editar con un campo de contraseña o de estado: 422 (lista cerrada) y nada cambia', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    for (const extra of [{ password: NEW_PASSWORD }, { active: false }, { id: 1 }]) {
      const res = await call(h.url, `${P}/usuarios/${h.ids.eli}`, ana, { method: 'PUT', body: { ...editorData(['birria']), ...extra } });
      expect(res.status).toBe(422);
    }
    expect(h.calls.writes).toBe(0);
  });

  it('último administrador (D-7): desactivarse o pasarse a editor da 409 con el aviso y nada cambia', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const self = h.ids.ana as number;
    const attempts = [
      { method: 'POST', path: `${P}/usuarios/${self}/desactivar`, body: {} },
      { method: 'PUT', path: `${P}/usuarios/${self}`, body: { username: 'ana', displayName: 'Ana Admin', role: 'editor', businesses: ['molotes'] } },
    ];
    for (const attempt of attempts) {
      const res = await call(h.url, attempt.path, ana, { method: attempt.method, body: attempt.body });
      expect(res.status).toBe(409);
      expect(lastAdminErrorSchema.parse(await res.json())).toEqual({ error: { code: 'LAST_ADMIN', message: LAST_ADMIN_MESSAGE } });
    }
    expect(h.calls.writes).toBe(0);
    expect(h.audit).toEqual([]);
    expect(await sessionStatus(h, ana)).toBe(200);
  });

  it('con dos administradores, uno se degrada a sí mismo: 200, `ownSessionClosed` y su sesión cae', async () => {
    const h = await startAdmin({ users: [ADMIN, SECOND_ADMIN, MOLOTES_EDITOR] });
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios/${h.ids.ana}`, ana, { method: 'PUT', body: { username: 'ana', displayName: 'Ana Admin', role: 'editor', businesses: ['birria'] } });
    expect(res.status).toBe(200);
    expect((await res.json()).meta).toEqual({ ownSessionClosed: true });
    expect(await sessionStatus(h, ana)).toBe(401);
  });

  it('con dos administradores, uno se desactiva a sí mismo: 200, `ownSessionClosed` y ya no puede entrar', async () => {
    const h = await startAdmin({ users: [ADMIN, SECOND_ADMIN] });
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios/${h.ids.ana}/desactivar`, ana, { method: 'POST', body: {} });
    expect(res.status).toBe(200);
    expect((await res.json()).meta).toEqual({ ownSessionClosed: true });
    expect(await sessionStatus(h, ana)).toBe(401);
    expect((await login(h.url, 'ana')).status).toBe(401);
  });

  it('desactivar y reactivar: la sesión cae, no puede entrar y tras reactivar sí; repetir no cambia nada', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const eli = h.ids.eli as number;
    const eliSession = await session(h.url, MOLOTES_EDITOR);

    const off = await call(h.url, `${P}/usuarios/${eli}/desactivar`, ana, { method: 'POST', body: {} });
    expect(off.status).toBe(200);
    expect((await off.json()).user.active).toBe(false);
    expect(await sessionStatus(h, eliSession)).toBe(401);
    expect((await login(h.url, 'eli')).status).toBe(401);
    expect((await call(h.url, `${P}/usuarios/${eli}/desactivar`, ana, { method: 'POST', body: {} })).status).toBe(200);

    const on = await call(h.url, `${P}/usuarios/${eli}/reactivar`, ana, { method: 'POST', body: {} });
    expect(on.status).toBe(200);
    expect((await on.json()).user.active).toBe(true);
    expect((await login(h.url, 'eli')).status).toBe(201);
    expect(h.audit.map((entry) => entry.action)).toEqual(['deactivate', 'reactivate']);
  });

  it('desactivar con cuerpo: 422 por el campo desconocido y nada cambia', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios/${h.ids.eli}/desactivar`, ana, { method: 'POST', body: { active: true } });
    expect(res.status).toBe(422);
    expect(h.calls.writes).toBe(0);
  });

  it('restablecer la contraseña: sesiones cerradas, la anterior deja de valer y la nueva funciona; auditoría sin hash', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const eliSession = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/usuarios/${h.ids.eli}/contrasena`, ana, { method: 'PUT', body: { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(NEW_PASSWORD);
    expect(JSON.parse(text).meta).toEqual({ ownSessionClosed: false });
    expect(await sessionStatus(h, eliSession)).toBe(401);
    expect((await login(h.url, 'eli', PASSWORD)).status).toBe(401);
    expect((await login(h.url, 'eli', NEW_PASSWORD)).status).toBe(201);
    expect(h.audit).toEqual([{ action: 'password_reset', actorId: h.ids.ana, targetId: h.ids.eli }]);
  });

  it('restablecerse la propia contraseña desde usuarios cierra también la sesión actual', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios/${h.ids.ana}/contrasena`, ana, { method: 'PUT', body: { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } });
    expect((await res.json()).meta).toEqual({ ownSessionClosed: true });
    expect(await sessionStatus(h, ana)).toBe(401);
  });

  it('restablecer con contraseñas inválidas: 422 por campo y nada cambia', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/usuarios/${h.ids.eli}/contrasena`, ana, { method: 'PUT', body: { password: NEW_PASSWORD, passwordConfirmation: 'no-coincide-040' } });
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields).toEqual({ passwordConfirmation: 'Las contraseñas no coinciden.' });
    expect(h.calls.writes).toBe(0);
  });

  it('base de datos caída: 503 DATABASE_UNAVAILABLE sin trazas', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    h.failNext();
    const res = await call(h.url, `${P}/usuarios`, ana);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Servicio no disponible temporalmente.' } });
  });
});

describe('cuenta propia (RF-2 y RF-10, CA-8)', () => {
  const change = (currentPassword = PASSWORD, password = NEW_PASSWORD) => ({ currentPassword, password, passwordConfirmation: password });

  it('con la actual correcta: 200 con una sesión nueva; la anterior y las demás dejan de valer; auditoría `password_change`', async () => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    const otherBrowser = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/cuenta/contrasena`, eli, { method: 'POST', body: change() });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(text).not.toContain(NEW_PASSWORD);
    const body = passwordChangeResponseSchema.parse(JSON.parse(text));
    expect(body.session.id).not.toBe(eli.id);
    expect(body.session.csrfToken).not.toBe(eli.csrfToken);
    expect(body.user).toEqual({ id: h.ids.eli, name: 'Eli Molotes', role: 'editor', businesses: ['molotes'] });
    expect(await sessionStatus(h, eli)).toBe(401);
    expect(await sessionStatus(h, otherBrowser)).toBe(401);
    expect(await sessionStatus(h, body.session)).toBe(200);
    expect((await login(h.url, 'eli', NEW_PASSWORD)).status).toBe(201);
    expect(h.audit).toEqual([{ action: 'password_change', actorId: h.ids.eli, targetId: h.ids.eli }]);
  });

  it('con la actual incorrecta: 422 en ese campo, nada cambia y no cuenta para el límite de intentos de acceso', async () => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    const ip = nextIp();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await call(h.url, `${P}/cuenta/contrasena`, eli, { method: 'POST', body: change('no-es-la-actual-040'), headers: { 'X-Forwarded-For': ip } });
      expect(res.status).toBe(422);
      expect((await res.json()).error.fields).toEqual({ currentPassword: WRONG_CURRENT_PASSWORD_MESSAGE });
    }
    expect(h.calls.writes).toBe(0);
    expect(await sessionStatus(h, eli)).toBe(200);
    expect((await login(h.url, 'eli', PASSWORD, ip)).status).toBe(201);
  });

  it('con la actual incorrecta y la nueva inválida: los dos errores', async () => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/cuenta/contrasena`, eli, { method: 'POST', body: change('mal', 'corta') });
    expect(Object.keys((await res.json()).error.fields).sort()).toEqual(['currentPassword', 'password']);
  });

  it.each([{ role: 'admin' }, { businesses: ['birria'] }, { id: 1 }, { userId: 1 }])('un campo ajeno (%o): 422 y nada cambia (R-2)', async (extra) => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/cuenta/contrasena`, eli, { method: 'POST', body: { ...change(), ...extra } });
    expect(res.status).toBe(422);
    expect(h.calls.writes).toBe(0);
    expect(await sessionStatus(h, eli)).toBe(200);
    expect((await call(h.url, `${P}/sesion`, eli).then((r) => r.json())).user.role).toBe('editor');
  });
});

describe('secretos (RF-13, CA-12)', () => {
  it('ningún log contiene contraseñas, hashes, ids de sesión ni tokens CSRF', async () => {
    const h = await startAdmin();
    const ana = await session(h.url, ADMIN);
    await call(h.url, `${P}/usuarios`, ana, { method: 'POST', body: newEditor() });
    await call(h.url, `${P}/usuarios/${h.ids.eli}/contrasena`, ana, { method: 'PUT', body: { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } });
    const res = await call(h.url, `${P}/cuenta/contrasena`, ana, { method: 'POST', body: { currentPassword: PASSWORD, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } });
    const fresh = passwordChangeResponseSchema.parse(await res.json()).session;
    await call(h.url, `${P}/cuenta/contrasena`, fresh, { method: 'POST', body: { currentPassword: 'mal-mal-mal-mal', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } });
    const logs = h.logger.lines.join('\n');
    expect(logs).toContain('admin_user_created');
    expect(logs).toContain('admin_password_changed');
    expect(logs).toContain('admin_password_change_rejected');
    for (const secret of [PASSWORD, NEW_PASSWORD, 'mal-mal-mal-mal', 'scrypt$', ana.id, ana.csrfToken, fresh.id, fresh.csrfToken, ...h.hashes.values()]) {
      expect(logs).not.toContain(secret);
    }
  });
});
