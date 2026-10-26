import type { AdminBootstrapConfig } from '../config/env.ts';
import type { UserRepository } from '../repositories/user-repository.ts';
import type { Logger } from '../utils/logger.ts';

/**
 * Primer administrador al arrancar (REQ-F-007, D-4, D-13, R-4 y DT-11).
 *
 * - Sin usuarios y con ADMIN_USER/ADMIN_PASSWORD_HASH: crea un administrador activo con ese
 *   usuario y ese hash (nombre visible = usuario). Queda en la auditoría como `bootstrap`.
 * - Con usuarios y con las variables: no toca nada y deja un aviso, sin los valores.
 * - Sin usuarios ni variables: /admin queda no disponible (503) hasta que haya un usuario
 *   (p. ej. creado con `npm run admin:recover`).
 */

export type BootstrapResult = 'created' | 'ignored' | 'existing' | 'disabled';

export async function bootstrapAdmin({
  users,
  bootstrap,
  logger,
}: {
  users: UserRepository;
  bootstrap: AdminBootstrapConfig;
  logger: Logger;
}): Promise<BootstrapResult> {
  if (await users.hasUsers()) {
    if (bootstrap) {
      logger.warn('admin_bootstrap_ignored', { reason: 'users_exist' });
      return 'ignored';
    }
    return 'existing';
  }
  if (!bootstrap) {
    logger.warn('admin_disabled', { reason: 'no_users' });
    return 'disabled';
  }
  const user = await users.bootstrap({ username: bootstrap.user, passwordHash: bootstrap.passwordHash });
  if (!user) return 'existing';
  logger.info('admin_bootstrap_created', { userId: user.id });
  return 'created';
}
