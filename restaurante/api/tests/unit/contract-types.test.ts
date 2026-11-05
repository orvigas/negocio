import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  BOT_BLOCK_ORIGINS,
  BOT_DEFAULT_DURATION,
  BOT_MANUAL_DURATIONS,
  BOT_PROVIDER_IDS,
  BOT_REASON_MAX,
  BOT_USAGE_COUNTERS,
  PUBLIC_BUSINESS_IDS,
  USER_LIMITS,
  USER_ROLES,
  type BotManualDuration,
  type BotState,
  type ManagedUser,
  type PublicBusinessId,
  type PublicProducts,
  type UserRole,
} from '@restaurante/contracts';
import {
  BLOCK_ORIGINS,
  BOT_PROVIDERS,
  DEFAULT_BOT_LIMITS,
  DEFAULT_MANUAL_DURATION,
  MANUAL_DURATIONS,
  REASON_MAX_LENGTH,
  createBotControl,
  createMemoryBotControlStore,
  type BlockOrigin,
  type BotProvider,
  type ManualDuration,
  type ReachedCap,
  type UsageBlock,
} from '@restaurante/core/bot-control';
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLES,
  USERNAME_MAX_LENGTH,
  type Role,
  type UserRecord,
} from '@restaurante/core/identity';
import type { PublishedProducts } from '@restaurante/core/catalog';
import { BUSINESS_IDS, silentLogger, type BusinessId } from '@restaurante/core/shared';

/**
 * El contrato de contracts y los tipos de core no se desincronizan (REQ-F-038, RF-2;
 * .claude/rules/frontend-backend.md). `npm run typecheck` comprueba los expectTypeOf.
 */
describe('contrato de productos ↔ core', () => {
  it('los productos publicados tienen la misma forma en core y en el contrato', () => {
    expectTypeOf<PublicProducts['molotes']>().toEqualTypeOf<PublishedProducts['molotes']>();
    expectTypeOf<PublicProducts['birria']>().toEqualTypeOf<PublishedProducts['birria']>();
  });

  it('los negocios públicos son los de core', () => {
    expectTypeOf<PublicBusinessId>().toEqualTypeOf<BusinessId>();
    expect([...PUBLIC_BUSINESS_IDS].sort()).toEqual([...BUSINESS_IDS].sort());
  });
});

describe('contrato de usuarios ↔ core (REQ-F-040)', () => {
  it('los roles del contrato son los de core', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<Role>();
    expect([...USER_ROLES]).toEqual([...ROLES]);
  });

  it('los límites de los textos de ayuda son los de core (la regla está solo en core)', () => {
    expect(USER_LIMITS).toEqual({
      usernameMax: USERNAME_MAX_LENGTH,
      displayNameMax: DISPLAY_NAME_MAX_LENGTH,
      passwordMin: PASSWORD_MIN_LENGTH,
      passwordMax: PASSWORD_MAX_LENGTH,
    });
  });

  it('el usuario gestionado no expone `sessionVersion` (ni hashes)', () => {
    expectTypeOf<ManagedUser>().not.toHaveProperty('sessionVersion');
    expectTypeOf<ManagedUser>().not.toHaveProperty('passwordHash');
    expectTypeOf<ManagedUser['businesses']>().toEqualTypeOf<UserRecord['businesses']>();
  });
});

describe('contrato del bot ↔ core (REQ-F-043)', () => {
  it('las listas cerradas del contrato son las de core', async () => {
    expectTypeOf<BotManualDuration>().toEqualTypeOf<ManualDuration>();
    expectTypeOf<BotState['reached'][number]['cap']>().toEqualTypeOf<ReachedCap>();
    expectTypeOf<BotState['blocks'][number]['origin']>().toEqualTypeOf<BlockOrigin>();
    expectTypeOf<BotState['usage']['counters'][number]['id']>().toEqualTypeOf<UsageBlock>();
    expectTypeOf<NonNullable<BotState['status']['provider']>>().toEqualTypeOf<BotProvider>();
    expect([...BOT_MANUAL_DURATIONS]).toEqual(Object.keys(MANUAL_DURATIONS));
    expect(BOT_DEFAULT_DURATION).toBe(DEFAULT_MANUAL_DURATION);
    expect(BOT_REASON_MAX).toBe(REASON_MAX_LENGTH);
    expect([...BOT_BLOCK_ORIGINS].sort()).toEqual([...BLOCK_ORIGINS].sort());
    expect([...BOT_PROVIDER_IDS].sort()).toEqual([...BOT_PROVIDERS].sort());
    const control = createBotControl({ store: createMemoryBotControlStore(), keys: null, limits: DEFAULT_BOT_LIMITS, timeZone: 'America/Mexico_City', staff: [], logger: silentLogger });
    await control.init();
    expect((await control.snapshot()).usage.statuses.map(({ id }) => id)).toEqual([...BOT_USAGE_COUNTERS]);
  });

  it('el estado del bot no expone el seudónimo, la clave ni los dígitos sueltos', () => {
    expectTypeOf<BotState['blocks'][number]>().not.toHaveProperty('phoneHash');
    expectTypeOf<BotState['blocks'][number]>().not.toHaveProperty('keyId');
    expectTypeOf<BotState['blocks'][number]>().not.toHaveProperty('last4');
    expectTypeOf<BotState['reached'][number]>().not.toHaveProperty('hash');
  });
});
