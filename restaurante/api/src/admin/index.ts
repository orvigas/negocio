import type { Freshness } from '@restaurante/contracts';
import type { BotControl, BotProvider } from '@restaurante/core/bot-control';
import type { PageRepository, ProductRepository, ProductView } from '@restaurante/core/catalog';
import type { QuoteCatalogSource } from '@restaurante/core/cotizador';
import type { InventoryCategory, InventoryItem, InventoryRepository, KardexRepository, RecipeRepository, SaveRecipeResult, Supplier, SupplierRepository } from '@restaurante/core/inventory';
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
import { createBotRoutes, type BotRoutes } from './bot-routes.ts';
import { createIdempotencyStore } from './idempotency.ts';
import { createInventoryKardexRoutes, type InventoryKardexRoutes } from './inventory-kardex-routes.ts';
import { createInventoryRecipeRoutes, type InventoryRecipeRoutes } from './inventory-recipe-routes.ts';
import { createInventoryRoutes, type InventoryRoutes } from './inventory-routes.ts';
import { createInventorySupplierRoutes, type InventorySupplierRoutes } from './inventory-supplier-routes.ts';
import { createPageRoutes, type PageRoutes } from './page-routes.ts';
import { createProductRoutes, type ProductRoutes } from './product-routes.ts';
import { createQuoteRoutes, type QuoteRoutes } from './quote-routes.ts';
import { createSessionRoutes, type SessionRoutes } from './session-routes.ts';
import { createUserRoutes, type UserRoutes } from './user-routes.ts';

/**
 * Composición de la administración de la API (REQ-F-039): sesiones y límite de intentos en memoria
 * (una sola instancia), autenticador de core, repositorio de productos de core y aviso interno. Desde REQ-F-040,
 * también los usuarios (solo administradores) y la cuenta propia, con el repositorio de usuarios.
 * Desde REQ-F-043, el control del bot (solo administradores), con la misma instancia que usa el bot.
 * Desde REQ-F-046, el cotizador de taquizas (solo administradores), con el catálogo de `quotes`.
 * Desde REQ-F-049, el catálogo de inventario (administradores y gerentes), con su repositorio de core.
 * Desde REQ-F-050, las recetas del inventario y su costo teórico (los mismos roles), con el suyo.
 * Desde REQ-F-051, los proveedores, el Kardex y las existencias (los mismos roles), con los suyos.
 */
export function createAdminRoutes({
  users,
  products,
  pages,
  notifier,
  botControl,
  botProvider,
  quotes,
  inventory,
  recipes,
  suppliers,
  kardex,
  timeZone,
  hashParams,
  now = () => new Date(),
  logger = silentLogger,
}: {
  users: UserRepository;
  products: ProductRepository;
  pages: PageRepository;
  notifier: LandingNotifier;
  /** La misma instancia que usa el bot: un cambio le llega sin esperar el refresco. */
  botControl: BotControl;
  /** Proveedor del bot en marcha; null: desactivado. */
  botProvider: BotProvider | null;
  /** Catálogo del cotizador (REQ-F-046). */
  quotes: QuoteCatalogSource;
  /** Catálogo de inventario (REQ-F-049). */
  inventory: InventoryRepository;
  /** Recetas del inventario (REQ-F-050). */
  recipes: RecipeRepository;
  /** Proveedores del inventario (REQ-F-051). */
  suppliers: SupplierRepository;
  /** Kardex, documentos y existencias (REQ-F-051). */
  kardex: KardexRepository;
  timeZone: string;
  /** Costo de scrypt del hash ficticio y de las contraseñas nuevas (las pruebas lo bajan). */
  hashParams?: PasswordHashParams;
  now?: () => Date;
  logger?: Logger;
}): { session: SessionRoutes; products: ProductRoutes; pages: PageRoutes; users: UserRoutes; account: AccountRoutes; bot: BotRoutes; quotes: QuoteRoutes; inventory: InventoryRoutes; recipes: InventoryRecipeRoutes; suppliers: InventorySupplierRoutes; kardex: InventoryKardexRoutes } {
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
    pages: createPageRoutes({ access, pages, notifier, logger }),
    users: createUserRoutes({ access, sessions, users, timeZone, ...(hashParams ? { hashParams } : {}), logger }),
    account: createAccountRoutes({ access, sessions, users, ...(hashParams ? { hashParams } : {}), logger }),
    bot: createBotRoutes({ access, botControl, botProvider, timeZone, logger }),
    quotes: createQuoteRoutes({ access, quotes, logger }),
    inventory: createInventoryRoutes({
      access,
      inventory,
      idempotency: {
        items: createIdempotencyStore<InventoryItem>({ now: () => now().getTime() }),
        categories: createIdempotencyStore<InventoryCategory>({ now: () => now().getTime() }),
      },
      timeZone,
      logger,
    }),
    recipes: createInventoryRecipeRoutes({
      access,
      recipes,
      idempotency: createIdempotencyStore<SaveRecipeResult>({ now: () => now().getTime() }),
      timeZone,
      logger,
    }),
    suppliers: createInventorySupplierRoutes({ access, suppliers, idempotency: createIdempotencyStore<Supplier>({ now: () => now().getTime() }), timeZone, logger }),
    kardex: createInventoryKardexRoutes({ access, kardex, timeZone, logger }),
  };
}
