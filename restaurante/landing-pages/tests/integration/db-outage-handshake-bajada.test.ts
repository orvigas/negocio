import { afterEach, describe, it } from 'vitest';

import { expectHandshakeCuts, type Mode } from '../support/db-cut-proxy.ts';

/** Cortes a mitad del handshake de MySQL (REQ-F-014, RF-9): ver tests/support/db-cut-proxy.ts (REQ-F-041). */

const MODES: readonly Mode[] = [{ direction: 'down', bytes: 110 }, { direction: 'down', bytes: 140 }, { direction: 'down', bytes: 1000 }];

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('cortes a mitad del handshake de MySQL (RF-9, desviación del cliente)', () => {
  it('ningún rechazo sin manejar, 503 mientras dura y recuperación sola', () => expectHandshakeCuts(MODES, cleanups), 180_000);
});
