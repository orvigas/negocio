import { expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';

import { ADMIN_PASSWORD, ADMIN_USER, createUser, csrfFrom, loginAs, setupAdmin, type Browser } from './admin.ts';

/**
 * Matriz de autorización de /admin (REQ-F-007) en los archivos
 * admin-authorization-matrix*.test.ts. REQ-F-041: preparación compartida por los archivos en que
 * se partió admin-authorization-matrix.test.ts, sin cambios.
 */

export type Actor = 'anonimo' | 'editorMolotes' | 'editorBirria' | 'editorAmbos' | 'admin' | 'adminDesactivado';

export const ACTORS: readonly Actor[] = ['anonimo', 'editorMolotes', 'editorBirria', 'editorAmbos', 'admin', 'adminDesactivado'];

export const BUSINESSES_OF: Readonly<Partial<Record<Actor, readonly BusinessId[]>>> = {
  editorMolotes: ['molotes'],
  editorBirria: ['birria'],
  editorAmbos: ['molotes', 'birria'],
  admin: BUSINESS_IDS,
};

export const isEditor = (actor: Actor) => actor.startsWith('editor');
export const hasSession = (actor: Actor) => actor !== 'anonimo' && actor !== 'adminDesactivado';

export async function setupMatrix() {
  const context = await setupAdmin();
  const { users } = context;
  await createUser(users, { username: 'em', businesses: ['molotes'] });
  await createUser(users, { username: 'eb', businesses: ['birria'] });
  await createUser(users, { username: 'e2', businesses: ['molotes', 'birria'] });
  const target = await createUser(users, { username: 'objetivo', businesses: ['molotes'] });
  const retired = await createUser(users, { username: 'jubilado', role: 'admin' });

  const browsers: Record<Actor, Browser> = {
    anonimo: context.browser(),
    editorMolotes: await loginAs(context.browser(), 'em'),
    editorBirria: await loginAs(context.browser(), 'eb'),
    editorAmbos: await loginAs(context.browser(), 'e2'),
    admin: await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD),
    adminDesactivado: await loginAs(context.browser(), 'jubilado'),
  };
  // Token CSRF válido de cada sesión (el del administrador desactivado se toma antes de desactivarlo).
  const csrf: Partial<Record<Actor, string>> = {};
  for (const actor of ACTORS) {
    if (actor === 'anonimo') continue;
    csrf[actor] = csrfFrom((await browsers[actor].get('/admin/cuenta')).text);
  }
  await users.setActive(retired.id, false, { kind: 'system' });

  const snapshot = async () => ({
    files: [...context.repository.storage.files.entries()].sort(([a], [b]) => a.localeCompare(b)),
    changes: context.repository.storage.changes.length,
    users: await context.prisma.user.findMany({ include: { businesses: true }, orderBy: { id: 'asc' } }),
    audit: await context.prisma.userAudit.count(),
    // REQ-F-025: lista negra, auditoría del bot e interruptor.
    bot: [await context.prisma.botBlock.count(), await context.prisma.botAudit.count(), await context.prisma.botControl.count()],
  });

  return { ...context, browsers, csrf, target, snapshot };
}

export function expectLoginRedirect(res: { status: number; headers: Record<string, string> }, label: string) {
  expect(res.status, label).toBe(303);
  expect(res.headers.location, label).toMatch(/^\/admin\/login(\?|$)/);
}

/** Las tres carreras entre dos administradores (D-7, CA-10). REQ-F-041: se reparten en dos archivos. */
export const LAST_ADMIN_RACES = [
  ['se desactivan', 'deactivate'],
  ['se degradan a editor', 'demote'],
  ['uno desactiva y el otro degrada', 'mixed'],
] as const;

/**
 * Las carreras de `rows` (cada una, 5 rondas con una base nueva). Se llama dentro del describe de
 * los archivos admin-authorization-matrix-concurrencia*.test.ts.
 */
export function lastAdminRaces(rows: readonly (typeof LAST_ADMIN_RACES)[number][]): void {
  async function twoAdmins() {
    const context = await setupAdmin();
    const second = await createUser(context.users, { username: 'segunda', displayName: 'Segunda', role: 'admin' });
    const owner = (await context.users.findCredentials(ADMIN_USER))?.user;
    if (!owner) throw new Error('Falta el primer administrador');
    const a1 = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const a2 = await loginAs(context.browser(), 'segunda');
    const token1 = csrfFrom((await a1.get('/admin/usuarios')).text);
    const token2 = csrfFrom((await a2.get('/admin/usuarios')).text);
    const activeAdmins = () => context.prisma.user.count({ where: { role: 'admin', active: true } });
    return { ...context, owner, second, a1, a2, token1, token2, activeAdmins };
  }

  const demote = (username: string, displayName: string) => ({ username, displayName, role: 'editor', 'business-molotes': 'on' });

  it.each(rows)('dos administradores que %s el uno al otro a la vez: nunca quedan cero', async (_label, mode) => {
    for (let round = 0; round < 5; round++) {
      const { owner, second, a1, a2, token1, token2, activeAdmins, prisma } = await twoAdmins();
      const auditBefore = await prisma.userAudit.count();
      const first =
        mode === 'demote'
          ? a1.post(`/admin/usuarios/${second.id}`).type('form').send({ _csrf: token1, ...demote('segunda', 'Segunda') })
          : a1.post(`/admin/usuarios/${second.id}/desactivar`).type('form').send({ _csrf: token1 });
      const other =
        mode === 'deactivate'
          ? a2.post(`/admin/usuarios/${owner.id}/desactivar`).type('form').send({ _csrf: token2 })
          : a2.post(`/admin/usuarios/${owner.id}`).type('form').send({ _csrf: token2, ...demote(ADMIN_USER, owner.displayName) });
      const results = await Promise.all([first, other]);

      expect(await activeAdmins(), `${mode} ronda ${round}`).toBe(1);
      const applied = results.filter((res) => res.status === 303 && res.headers.location?.startsWith('/admin/usuarios?ok='));
      expect(applied, `${mode} ronda ${round}: ${results.map((res) => res.status).join(',')}`).toHaveLength(1);
      // La otra se rechaza por D-7 (409) o porque su sesión ya se cerró (303 al acceso); nunca 5xx.
      for (const res of results) expect(res.status).toBeLessThan(500);
      // Solo la operación aplicada queda en la auditoría.
      expect(await prisma.userAudit.count()).toBe(auditBefore + 1);
    }
  });
}
