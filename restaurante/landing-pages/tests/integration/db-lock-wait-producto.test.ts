import { afterEach, describe, expect, it } from 'vitest';

import { login, setupAdmin } from '../support/admin.ts';
import { HOLD_MS, expectLockWaitBelowHold, holdLock, wait } from '../support/lock-wait.ts';

/**
 * Espera de bloqueo prolongada (REQ-F-014; ver tests/support/lock-wait.ts). Se comprueba lo que
 * exige el ticket: ninguna operación queda a medias (503 sin cambios, o éxito completo con su
 * registro), el resto de la app sigue atendiendo y todo vuelve a funcionar al liberar el bloqueo.
 * REQ-F-041: uno de los tres casos de db-lock-wait.test.ts, ahora en su propio archivo.
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('espera de bloqueo prolongada (REQ-F-014, desviación del cliente)', () => {
  it('editar un producto con su fila bloqueada: nada a medias y después se guarda', async () => {
    const context = await setupAdmin();
    await expectLockWaitBelowHold(context.database.config);
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

    const release = await holdLock(cleanups, context.database.config, 'SELECT id FROM `product` WHERE id = ? FOR UPDATE', id);
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

});
