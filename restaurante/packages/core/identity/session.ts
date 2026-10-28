import type { SessionInfo, SessionStore } from './session-store.ts';
import type { UserRecord, UserRepository } from './user-repository.ts';

/**
 * Sesión vigente (REQ-F-007, D-8 y DT-7; en core desde REQ-F-039 porque la comparten /admin y la API):
 * el id corresponde a una sesión que no caducó, su usuario existe, está activo y no cambió su
 * `sessionVersion`. Si no, destruye la sesión (si existía) y devuelve null; quien llama decide la
 * respuesta (303 al acceso en HTML, 401 en las APIs).
 */
export async function resolveSession(
  { sessions, users }: { sessions: SessionStore; users: Pick<UserRepository, 'findById'> },
  id: unknown,
): Promise<{ session: SessionInfo; user: UserRecord } | null> {
  const session = sessions.touch(id);
  const user = session ? await users.findById(session.userId) : null;
  if (!session || !user || !user.active || user.sessionVersion !== session.sessionVersion) {
    if (session) sessions.destroy(session.id);
    return null;
  }
  return { session, user };
}
