import { describe, expect, it } from 'vitest';

import { USER_PASSWORD, createUser, csrfFrom, login, loginAs, setupAdmin, textOf, type Browser } from '../support/admin.ts';

/** Mi cuenta: cambiar la propia contraseña (REQ-F-007, D-9, R-9; CA-13). */

const NEW_PASSWORD = 'mi-clave-nueva-2026';

async function changePassword(browser: Browser, values: Record<string, string>) {
  const page = await browser.get('/admin/cuenta');
  return browser.post('/admin/cuenta').type('form').send({ _csrf: csrfFrom(page.text), ...values });
}

describe('Mi cuenta (CA-13)', () => {
  it('con la contraseña actual correcta: entra con la nueva, no con la anterior; la sesión actual sigue y las demás se cierran', async () => {
    const { users, browser } = await setupAdmin();
    await createUser(users, { username: 'ana' });
    const here = await loginAs(browser(), 'ana');
    const elsewhere = await loginAs(browser(), 'ana');

    const res = await changePassword(here, { currentPassword: USER_PASSWORD, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/cuenta?ok=password_change');
    expect(textOf((await here.get(res.headers.location!)).text)).toContain('Contraseña cambiada.');
    expect((await here.get('/admin/molotes')).status).toBe(200);
    expect((await elsewhere.get('/admin/molotes')).status).toBe(303);

    expect((await login(browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(401);
    expect((await login(browser(), { username: 'ana', password: NEW_PASSWORD })).status).toBe(303);
  });

  it('con la contraseña actual incorrecta no cambia nada y no cuenta para el bloqueo de acceso', async () => {
    const { users, browser, prisma } = await setupAdmin();
    const ana = await createUser(users, { username: 'ana' });
    const session = await loginAs(browser(), 'ana');
    const before = await prisma.user.findUnique({ where: { id: ana.id } });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await changePassword(session, { currentPassword: 'no-es-la-actual', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD });
      expect(res.status).toBe(422);
      expect(res.text).toContain('id="u-currentPassword-error"');
      expect(textOf(res.text)).toContain('La contraseña actual no es correcta.');
      expect(res.text).not.toContain(NEW_PASSWORD);
    }
    expect(await prisma.user.findUnique({ where: { id: ana.id } })).toEqual(before);
    expect((await session.get('/admin/molotes')).status).toBe(200);
    expect((await login(browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(303);
  });

  it('la nueva debe tener al menos 12 caracteres y coincidir', async () => {
    const { users, browser } = await setupAdmin();
    await createUser(users, { username: 'ana' });
    const session = await loginAs(browser(), 'ana');
    const short = await changePassword(session, { currentPassword: USER_PASSWORD, password: 'corta', passwordConfirmation: 'corta' });
    expect(short.status).toBe(422);
    expect(textOf(short.text)).toContain('al menos 12 caracteres');
    const mismatch = await changePassword(session, { currentPassword: USER_PASSWORD, password: NEW_PASSWORD, passwordConfirmation: 'otra-distinta-123' });
    expect(mismatch.status).toBe(422);
    expect(textOf(mismatch.text)).toContain('Las contraseñas no coinciden.');
  });

  it('la página es accesible y sin JavaScript', async () => {
    const { users, browser } = await setupAdmin();
    await createUser(users, { username: 'ana' });
    const page = await (await loginAs(browser(), 'ana')).get('/admin/cuenta');
    expect(page.status).toBe(200);
    expect(page.text).not.toMatch(/<script/);
    expect(page.text).toMatch(/<input[^>]*id="u-currentPassword"[^>]*type="password"[^>]*autocomplete="current-password"/);
    expect(page.text).toMatch(/aria-current="page">Mi cuenta<\/a>/);
  });
});
