import { describe, expect, it } from 'vitest';

import { LOCK_MS, MAX_FAILURES, createLoginThrottle } from '../../src/services/login-throttle.js';
import { makeClock } from '../support/admin.js';

describe('createLoginThrottle (P-3)', () => {
  it('bloquea 15 minutos tras 5 fallos desde el mismo origen', () => {
    const clock = makeClock();
    const throttle = createLoginThrottle({ now: clock.now });
    for (let i = 1; i < MAX_FAILURES; i += 1) expect(throttle.recordFailure('1.1.1.1')).toBe(false);
    expect(throttle.status('1.1.1.1').locked).toBe(false);

    expect(throttle.recordFailure('1.1.1.1')).toBe(true);
    expect(throttle.status('1.1.1.1')).toEqual({ locked: true, retryAfterSeconds: LOCK_MS / 1000 });
    expect(throttle.status('2.2.2.2').locked).toBe(false);

    clock.advance(LOCK_MS - 1000);
    expect(throttle.status('1.1.1.1').locked).toBe(true);
    clock.advance(1000);
    expect(throttle.status('1.1.1.1').locked).toBe(false);
  });

  it('un acceso correcto reinicia el contador', () => {
    const throttle = createLoginThrottle();
    for (let i = 1; i < MAX_FAILURES; i += 1) throttle.recordFailure('ip');
    throttle.recordSuccess('ip');
    expect(throttle.recordFailure('ip')).toBe(false);
  });

  it('los fallos aislados caducan tras la ventana', () => {
    const clock = makeClock();
    const throttle = createLoginThrottle({ now: clock.now });
    for (let i = 1; i < MAX_FAILURES; i += 1) throttle.recordFailure('ip');
    clock.advance(LOCK_MS);
    expect(throttle.recordFailure('ip')).toBe(false);
  });

  it('limita la cantidad de orígenes en memoria', () => {
    const throttle = createLoginThrottle({ maxTracked: 2, maxFailures: 1 });
    throttle.recordFailure('a');
    throttle.recordFailure('b');
    throttle.recordFailure('c');
    expect(throttle.status('a').locked).toBe(false);
    expect(throttle.status('c').locked).toBe(true);
  });
});
