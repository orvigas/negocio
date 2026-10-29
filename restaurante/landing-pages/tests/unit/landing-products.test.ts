import { describe, expect, it } from 'vitest';

import type { PublicApiClient, PublicApiResult, PublicBusinessId, PublicProducts } from '@restaurante/contracts';
import { productsFromMenuData, toPublished } from '@restaurante/core/catalog';
import { BUSINESS_IDS } from '@restaurante/core/shared';

import { createLandingProducts, loadSeedProducts, withProducts } from '../../src/services/landing-products.ts';
import { makeRecordingLogger, seedData } from '../helpers.ts';

/**
 * Caché de los productos de las landings (REQ-F-038, RF-5 y RF-6; CA-4 a CA-7 a nivel unitario):
 * frescura, invalidación, un vuelo por negocio, última copia buena, semilla y log.
 */

const seeds = loadSeedProducts();
const renamed = (name: string): PublicProducts['birria'] => ({ menu: seeds.birria.menu.map((item, index) => (index === 0 ? { ...item, name } : item)) });

/** Cliente falso: cada petición queda pendiente hasta que la prueba la resuelve. */
function fakeClient() {
  const pending: { business: PublicBusinessId; resolve: (result: PublicApiResult<PublicBusinessId>) => void }[] = [];
  const client: PublicApiClient = {
    getProducts<Id extends PublicBusinessId>(business: Id) {
      return new Promise<PublicApiResult<Id>>((resolve) => {
        pending.push({ business, resolve: resolve as (result: PublicApiResult<PublicBusinessId>) => void });
      });
    },
  };
  const take = (business: PublicBusinessId, newest = false) => {
    const index = newest ? pending.findLastIndex((call) => call.business === business) : pending.findIndex((call) => call.business === business);
    if (index < 0) throw new Error(`Sin petición pendiente de ${business}`);
    return pending.splice(index, 1)[0]!;
  };
  return {
    client,
    pending,
    /** Resuelve la petición pendiente más vieja del negocio (o la más nueva con `newest`). */
    ok(business: PublicBusinessId, data: PublicProducts[PublicBusinessId], newest = false) {
      take(business, newest).resolve({ ok: true, data });
    },
    fail(business: PublicBusinessId, reason: 'timeout' | 'network' | 'invalid_body' | 'http_status' = 'network', status?: number) {
      take(business).resolve({ ok: false, reason, ...(status === undefined ? {} : { status }) });
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(options: { ttlMs?: number; retryMs?: number; logEveryMs?: number } = {}) {
  const api = fakeClient();
  const logger = makeRecordingLogger();
  const clock = { now: 1_000_000 };
  const products = createLandingProducts({ client: api.client, seeds, logger, now: () => clock.now, ...options });
  return { api, logger, clock, products };
}

/** Carga inicial buena de los dos negocios. */
async function warm(ctx: ReturnType<typeof setup>, birria = renamed('Desde la API')) {
  const warmUp = ctx.products.warmUp();
  ctx.api.ok('molotes', seeds.molotes);
  ctx.api.ok('birria', birria);
  await warmUp;
}

describe('semilla de respaldo', () => {
  it.each(BUSINESS_IDS)('%s: es lo que la base tendría al importar la semilla (toPublished de la importación)', (business) => {
    const imported = productsFromMenuData(business, seedData(business), new Date()).map((product, index) => ({ ...product, id: index + 1 }));
    expect(seeds[business]).toEqual(toPublished(business, imported));
  });
});

describe('createLandingProducts', () => {
  it('sin ninguna carga buena sirve la semilla y registra el evento (CA-6)', async () => {
    const ctx = setup();
    const warmUp = ctx.products.warmUp();
    ctx.api.fail('molotes', 'network');
    ctx.api.fail('birria', 'timeout');
    await warmUp;
    expect(await ctx.products.get('birria')).toBe(seeds.birria);
    expect(ctx.logger.lines.filter((line) => line.msg === 'landing_products_fallback')).toEqual([
      expect.objectContaining({ level: 'warn', business: 'molotes', reason: 'network', source: 'seed' }),
      expect.objectContaining({ level: 'warn', business: 'birria', reason: 'timeout', source: 'seed' }),
    ]);
  });

  it('fresco: se sirve sin pedir nada a la API', async () => {
    const ctx = setup();
    await warm(ctx);
    expect(ctx.logger.lines.filter((line) => line.msg === 'landing_products_loaded').map((line) => line.business)).toEqual(['molotes', 'birria']);
    for (let i = 0; i < 5; i += 1) expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Desde la API');
    expect(ctx.api.pending).toHaveLength(0);
  });

  it('invalidado: la siguiente visita espera los datos nuevos (al instante, CA-4) y el otro negocio no pide nada', async () => {
    const ctx = setup();
    await warm(ctx);
    ctx.products.invalidate('birria');
    const visit = ctx.products.get('birria');
    await flush();
    expect(ctx.api.pending.map((call) => call.business)).toEqual(['birria']);
    ctx.api.ok('birria', renamed('Cambiado en /admin'));
    expect((await visit).menu[0]!.name).toBe('Cambiado en /admin');
    await ctx.products.get('molotes');
    expect(ctx.api.pending).toHaveLength(0);
  });

  it('visitas simultáneas tras una invalidación: una sola petición a la API', async () => {
    const ctx = setup();
    await warm(ctx);
    ctx.products.invalidate('birria');
    const visits = Array.from({ length: 20 }, () => ctx.products.get('birria'));
    await flush();
    expect(ctx.api.pending).toHaveLength(1);
    ctx.api.ok('birria', renamed('Una vez'));
    expect(new Set((await Promise.all(visits)).map((data) => data.menu[0]!.name))).toEqual(new Set(['Una vez']));
  });

  it('un vuelo iniciado antes de la invalidación no la satisface (podría haber leído antes del commit)', async () => {
    const ctx = setup({ ttlMs: 10 });
    await warm(ctx);
    ctx.clock.now += 20;
    // TTL vencido: refresco en segundo plano, todavía en curso.
    await ctx.products.get('birria');
    expect(ctx.api.pending).toHaveLength(1);
    ctx.products.invalidate('birria');
    const visit = ctx.products.get('birria');
    await flush();
    expect(ctx.api.pending).toHaveLength(2);
    // El vuelo viejo termina después, con datos anteriores al cambio: no se sirven.
    ctx.api.ok('birria', renamed('Nuevo'), true);
    expect((await visit).menu[0]!.name).toBe('Nuevo');
    ctx.api.ok('birria', renamed('Viejo'));
    await flush();
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Nuevo');
  });

  it('API caída tras una copia buena: sirve la última copia, registra el evento y se recupera sin reiniciar (CA-5)', async () => {
    const ctx = setup({ retryMs: 5000 });
    await warm(ctx);
    ctx.products.invalidate('birria');
    const visit = ctx.products.get('birria');
    await flush();
    ctx.api.fail('birria', 'http_status', 503);
    expect((await visit).menu[0]!.name).toBe('Desde la API');
    expect(ctx.logger.lines.at(-1)).toMatchObject({ msg: 'landing_products_fallback', business: 'birria', reason: 'http_status', status: 503, source: 'last_good' });

    // Durante la caída nadie espera y no se reintenta antes de retryMs.
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Desde la API');
    expect(ctx.api.pending).toHaveLength(0);

    // Pasado retryMs: reintento en segundo plano; la visita siguiente ya ve los datos.
    ctx.clock.now += 5000;
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Desde la API');
    expect(ctx.api.pending).toHaveLength(1);
    ctx.api.ok('birria', renamed('Restablecida'));
    await flush();
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Restablecida');
    expect(ctx.logger.lines.at(-1)).toMatchObject({ level: 'info', msg: 'landing_products_recovered', business: 'birria', failures: 1 });
  });

  it('TTL vencido: sirve lo que tiene y refresca en segundo plano (stale-while-revalidate)', async () => {
    const ctx = setup({ ttlMs: 60_000 });
    await warm(ctx);
    ctx.clock.now += 60_000;
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Desde la API');
    expect(ctx.api.pending).toHaveLength(1);
    ctx.api.ok('birria', renamed('Refrescado'));
    await flush();
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Refrescado');
  });

  it('el log de una caída larga se limita a uno por minuto', async () => {
    const ctx = setup({ retryMs: 5000, logEveryMs: 60_000 });
    const warmUp = ctx.products.warmUp();
    ctx.api.fail('molotes');
    ctx.api.fail('birria');
    await warmUp;
    for (let i = 0; i < 24; i += 1) {
      ctx.clock.now += 5000;
      await ctx.products.get('birria');
      ctx.api.fail('birria');
      await flush();
    }
    const logged = ctx.logger.lines.filter((line) => line.msg === 'landing_products_fallback' && line.business === 'birria');
    expect(logged).toHaveLength(3);
    expect(logged.map((line) => line.failures)).toEqual([1, 13, 25]);
  });

  it('el log no lleva la URL ni los datos', async () => {
    const ctx = setup();
    const warmUp = ctx.products.warmUp();
    ctx.api.fail('molotes');
    ctx.api.fail('birria');
    await warmUp;
    const text = JSON.stringify(ctx.logger.lines);
    expect(text).not.toMatch(/http|api\.|Tacos|Molote/);
  });

  it('confirmFresh: sin cambios pendientes no pide nada; tras una invalidación espera y dice si la API respondió (DEF-003)', async () => {
    const ctx = setup();
    await warm(ctx);
    expect(await ctx.products.confirmFresh('birria')).toBe(true);
    expect(ctx.api.pending).toHaveLength(0);

    ctx.products.invalidate('birria');
    const confirmed = ctx.products.confirmFresh('birria');
    await flush();
    ctx.api.ok('birria', renamed('Confirmado'));
    expect(await confirmed).toBe(true);
    // La visita siguiente ya está al día: no vuelve a pedir.
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Confirmado');
    expect(ctx.api.pending).toHaveLength(0);

    ctx.products.invalidate('birria');
    const failed = ctx.products.confirmFresh('birria');
    await flush();
    ctx.api.fail('birria', 'network');
    expect(await failed).toBe(false);
    expect((await ctx.products.get('birria')).menu[0]!.name).toBe('Confirmado');
  });

  it('valida sus dependencias', () => {
    // @ts-expect-error: sin cliente, a propósito.
    expect(() => createLandingProducts({ seeds })).toThrow(TypeError);
    // @ts-expect-error: sin semillas, a propósito.
    expect(() => createLandingProducts({ client: fakeClient().client })).toThrow(TypeError);
  });
});

describe('withProducts', () => {
  it('sustituye las listas del JSON por las de la API y conserva hero, destacado y promoción', () => {
    const data = seedData('molotes');
    const lists: PublicProducts['molotes'] = { menu: [], drinks: seeds.molotes.drinks.slice(0, 1) };
    const merged = withProducts('molotes', data, lists);
    expect(merged.menu.items).toEqual([]);
    expect(merged.drinks.items).toHaveLength(1);
    expect(merged.hero).toEqual(data.hero);
    expect(merged.promo).toEqual(data.promo);
    expect(merged.menu.highlight).toBe(data.menu.highlight);
  });
});
