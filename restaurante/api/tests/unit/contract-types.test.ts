import { describe, expect, expectTypeOf, it } from 'vitest';

import { PUBLIC_BUSINESS_IDS, type PublicBusinessId, type PublicProducts } from '@restaurante/contracts';
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
