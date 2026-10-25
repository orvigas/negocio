import { afterEach, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../src/db/client.ts';
import type { DatabaseConfig } from '../../src/config/env.ts';
import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, createUser, csrfFrom, login, loginAs, setupAdmin } from '../support/admin.ts';

/**
 * Esperas de bloqueo largas con MySQL real (REQ-F-014, casos límite y desviación aprobada: sin
 * `innodb_lock_wait_timeout` en la sesión). Otra conexión mantiene un bloqueo de fila
 * (SELECT … FOR UPDATE) mientras la app escribe y lo libera a los 12 s, después del `timeout` de
 * 10 s de las transacciones de Prisma. Se comprueba lo que exige el ticket: ninguna operación queda
 * a medias (503 sin cambios, o éxito completo con su registro), el resto de la app sigue atendiendo
 * y todo vuelve a funcionar al liberar el bloqueo. Sin liberarlo, MySQL corta la espera a los 50 s
 * (innodb_lock_wait_timeout por defecto) con 503; bajarlo es tarea de REQ-F-016 (QA de REQ-F-014).
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bloquea filas desde otra conexión (otro pool, como otro proceso) hasta llamar a release(). */
async function holdLock(config: DatabaseConfig, sql: string, ...values: unknown[]) {
  const client = createPrismaClient(config);
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let acquired!: () => void;
  const locked = new Promise<void>((resolve) => (acquired = resolve));
  const transaction = client.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(sql, ...values);
      acquired();
      await released;
    },
    { maxWait: 5000, timeout: 120_000 },
  );
  await locked;
  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    release();
    await transaction;
    await client.$disconnect();
  };
  cleanups.push(finish);
  return finish;
}

const HOLD_MS = 12_000;

describe('espera de bloqueo prolongada (REQ-F-014, desviación del cliente)', () => {
  it('desactivar un usuario con su fila bloqueada: nada a medias y la app se recupera', async () => {
    const context = await setupAdmin();
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    await createUser(context.users, { username: 'beto', role: 'admin' });
    const session = await loginAs(context.browser(), 'beto', USER_PASSWORD);
    const page = await session.get('/admin/usuarios');
    const auditBefore = await context.prisma.userAudit.count();

    const release = await holdLock(context.database.config, 'SELECT id FROM `user` WHERE id = ? FOR UPDATE', owner.id);
    const pending = session.post(`/admin/usuarios/${owner.id}/desactivar`).type('form').send({ _csrf: csrfFrom(page.text) });
    await wait(HOLD_MS);
    await release();
    const res = await pending;
    await wait(1000);
    const stored = await context.prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    const audit = await context.prisma.userAudit.count();
    if (res.status === 303) {
      expect(stored.active).toBe(false);
      expect(audit).toBe(auditBefore + 1);
      return;
    }
    expect(res.status).toBe(503);
    expect(stored.active).toBe(true);
    expect(audit).toBe(auditBefore);

    const again = await session.get('/admin/usuarios');
    const ok = await session.post(`/admin/usuarios/${owner.id}/desactivar`).type('form').send({ _csrf: csrfFrom(again.text) });
    expect(ok.status).toBe(303);
    expect((await context.prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).active).toBe(false);
  }, 60_000);

  it('editar un producto con su fila bloqueada: nada a medias y después se guarda', async () => {
    const context = await setupAdmin();
    const browser = context.browser();
    expect((await login(browser)).status).toBe(303);
    const csrf = (await browser.get('/admin/api/sesion')).body.csrfToken as string;
    const product = (await browser.get('/admin/api/birria/productos')).body.products[0];
    const { id, slug, category, detailsType, version, ...rest } = product;
    const editable = Object.fromEntries(
      Object.entries(rest).filter(([key]) => ['name', 'label', 'description', 'price', 'priceUnit', 'image', 'detailsLabel', 'chips', 'available'].includes(key)),
    );
    const body = { ...editable, name: 'Nombre editado durante el bloqueo', slug, category, detailsType, version };
    const changesBefore = await context.prisma.productChange.count();

    const release = await holdLock(context.database.config, 'SELECT id FROM `product` WHERE id = ? FOR UPDATE', id);
    const pending = browser.put(`/admin/api/birria/productos/${id}`).set('X-CSRF-Token', csrf).send(body);
    await wait(HOLD_MS);
    await release();
    const res = await pending;
    await wait(1000);
    const stored = await context.prisma.product.findUniqueOrThrow({ where: { id } });
    const changes = await context.prisma.productChange.count();
    if (res.status === 200) {
      expect(stored.version).toBe(version + 1);
      expect(changes).toBe(changesBefore + 1);
      return;
    }
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' } });
    expect(stored.version).toBe(version);
    expect(stored.name).toBe(product.name);
    expect(changes).toBe(changesBefore);

    const ok = await browser.put(`/admin/api/birria/productos/${id}`).set('X-CSRF-Token', csrf).send(body);
    expect(ok.status).toBe(200);
    expect(ok.body.product.name).toBe('Nombre editado durante el bloqueo');
  }, 60_000);

  it('iniciar sesión con la fila del usuario bloqueada: no se cuelga y el resto de la app sigue atendiendo', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'beto', role: 'admin' });
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    const other = await loginAs(context.browser(), 'beto', USER_PASSWORD);

    const release = await holdLock(context.database.config, 'SELECT id FROM `user` WHERE id = ? FOR UPDATE', owner.id);
    const pending = login(context.browser(), { username: ADMIN_USER, password: ADMIN_PASSWORD });

    // Mientras el acceso espera, el resto del admin y las landings responden (el pool no se agota).
    await wait(1500);
    expect((await other.get('/admin/usuarios')).status).toBe(200);
    expect((await context.request().get('/molotes')).status).toBe(200);

    await wait(HOLD_MS - 1500);
    await release();
    expect([303, 503]).toContain((await pending).status);

    // Al liberar, el acceso vuelve a funcionar al momento.
    const started = Date.now();
    expect((await login(context.browser(), { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    expect(Date.now() - started).toBeLessThan(5000);
  }, 60_000);
});
