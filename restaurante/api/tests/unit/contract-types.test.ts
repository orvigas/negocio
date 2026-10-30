import { describe, expect, expectTypeOf, it } from 'vitest';

import { PUBLIC_BUSINESS_IDS, USER_LIMITS, USER_ROLES, type ManagedUser, type PublicBusinessId, type PublicProducts, type UserRole } from '@restaurante/contracts';
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
import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';

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
