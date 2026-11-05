import { expect } from 'vitest';

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
