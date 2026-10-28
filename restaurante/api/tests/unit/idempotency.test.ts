import { describe, expect, it } from 'vitest';

import { IDEMPOTENCY_TTL_MS, IdempotencyKeyReusedError, createIdempotencyStore, fingerprintOf } from '../../src/admin/idempotency.ts';

const req = (userId: number, key: string, { scope = 'molotes', body = { name: 'X' } }: { scope?: string; body?: Record<string, string> } = {}) => ({
  userId,
  scope,
  key,
  fingerprint: fingerprintOf(body),
});

/** Altas idempotentes (REQ-F-039, doble envío): una vez por usuario, negocio y clave durante 10 minutos. */

describe('createIdempotencyStore', () => {
  it('la misma clave del mismo usuario devuelve el primer resultado sin repetir la tarea', async () => {
    const store = createIdempotencyStore<number>();
    let runs = 0;
    const task = async () => ++runs;
    expect(await store.run(req(1, 'clave'), task)).toEqual({ value: 1, replayed: false });
    expect(await store.run(req(1, 'clave'), task)).toEqual({ value: 1, replayed: true });
    // Otro usuario con la misma clave no comparte el resultado.
    expect(await store.run(req(2, 'clave'), task)).toEqual({ value: 2, replayed: false });
  });

  it('si la tarea falla, la clave se olvida y se puede reintentar', async () => {
    const store = createIdempotencyStore<string>();
    await expect(store.run(req(1, 'k'), () => Promise.reject(new Error('fallo')))).rejects.toThrow('fallo');
    expect(await store.run(req(1, 'k'), async () => 'bien')).toEqual({ value: 'bien', replayed: false });
  });

  it('caduca a los 10 minutos y respeta el tope de claves', async () => {
    let now = 0;
    const store = createIdempotencyStore<number>({ now: () => now, maxKeys: 2 });
    let runs = 0;
    const task = async () => ++runs;
    await store.run(req(1, 'a'), task);
    now = IDEMPOTENCY_TTL_MS;
    expect((await store.run(req(1, 'a'), task)).replayed).toBe(false);
    await store.run(req(1, 'b'), task);
    await store.run(req(1, 'c'), task);
    // Con el tope de 2, la clave más antigua (a) se descartó.
    expect((await store.run(req(1, 'a'), task)).replayed).toBe(false);
  });

  it('DEF-002: la misma clave en otro negocio es otra alta', async () => {
    const store = createIdempotencyStore<number>();
    let runs = 0;
    const task = async () => ++runs;
    await store.run(req(1, 'k'), task);
    expect(await store.run(req(1, 'k', { scope: 'birria' }), task)).toEqual({ value: 2, replayed: false });
  });

  it('DEF-002: la misma clave con otro cuerpo se rechaza (IdempotencyKeyReusedError) sin ejecutar la tarea', async () => {
    const store = createIdempotencyStore<number>();
    let runs = 0;
    const task = async () => ++runs;
    await store.run(req(1, 'k', { body: { name: 'A' } }), task);
    await expect(store.run(req(1, 'k', { body: { name: 'B' } }), task)).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    expect(runs).toBe(1);
  });
});
