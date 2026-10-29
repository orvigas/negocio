import type { Freshness } from '@restaurante/contracts';
import type { ProductRepository, ProductView } from '@restaurante/core/catalog';
import {
  createLoginThrottle,
  createSessionStore,
  createUserAuthenticator,
  type PasswordHashParams,
  type UserRepository,
} from '@restaurante/core/identity';
import { silentLogger, type Logger } from '@restaurante/core/shared';

import type { LandingNotifier } from '../notifier.ts';
import { createAccountRoutes, type AccountRoutes } from './account-routes.ts';
import { createAdminAccess } from './access.ts';
import { createIdempotencyStore } from './idempotency.ts';
import { createProductRoutes, type ProductRoutes } from './product-routes.ts';
import { createSessionRoutes, type SessionRoutes } from './session-routes.ts';
import { createUserRoutes, type UserRoutes } from './user-routes.ts';

/**
 * Composición de la administración de la API (REQ-F-039): sesiones y límite de intentos en memoria
 * (una sola instancia, como el /admin actual, pero con su propio almacén: "Sesión aparte en cada
 * admin"), autenticador de core, repositorio de productos de core y aviso interno. Desde REQ-F-040,
 * también los usuarios (solo administradores) y la cuenta propia, con el repositorio de usuarios.
 */
export function createAdminRoutes({
  users,
  products,
  notifier,
  timeZone,
  hashParams,
  now = () => new Date(),
  logger = silentLogger,
}: {
  users: UserRepository;
  products: ProductRepository;
  notifier: LandingNotifier;
  timeZone: string;
  /** Costo de scrypt del hash ficticio y de las contraseñas nuevas (las pruebas lo bajan). */
  hashParams?: PasswordHashParams;
  now?: () => Date;
  logger?: Logger;
}): { session: SessionRoutes; products: ProductRoutes; users: UserRoutes; account: AccountRoutes } {
  const sessions = createSessionStore({ now });
  const access = createAdminAccess({ sessions, users, logger });
  return {
    session: createSessionRoutes({
      access,
      sessions,
      throttle: createLoginThrottle({ now }),
      users,
      authenticator: createUserAuthenticator({ users, ...(hashParams ? { hashParams } : {}) }),
      logger,
      now,
    }),
    products: createProductRoutes({
      access,
      products,
      notifier,
      idempotency: createIdempotencyStore<{ product: ProductView; freshness: Freshness }>({ now: () => now().getTime() }),
      timeZone,
      logger,
    }),
    users: createUserRoutes({ access, sessions, users, timeZone, ...(hashParams ? { hashParams } : {}), logger }),
    account: createAccountRoutes({ access, sessions, users, ...(hashParams ? { hashParams } : {}), logger }),
  };
}
