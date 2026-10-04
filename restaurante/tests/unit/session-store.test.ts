import { describe, expect, it } from 'vitest';

import { SESSION_IDLE_MS, createSessionStore } from '../../src/services/session-store.ts';
import { makeClock } from '../support/admin.ts';

describe('createSessionStore', () => {
  it('crea sesiones con id y token CSRF aleatorios de 256 bits', () => {
    const store = createSessionStore();
    const a = store.create();
    const b = store.create();
    expect(a.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.id).not.toBe(b.id);
    expect(a.csrfToken).not.toBe(a.id);
  });

  it('caduca tras 2 horas de inactividad y se renueva con la actividad (P-3)', () => {
    const clock = makeClock();
    const store = createSessionStore({ now: clock.now });
    const { id } = store.create();

    clock.advance(SESSION_IDLE_MS - 1000);
    expect(store.touch(id)).not.toBeNull();
    clock.advance(SESSION_IDLE_MS - 1000);
    expect(store.touch(id)).not.toBeNull();
    clock.advance(SESSION_IDLE_MS);
    expect(store.touch(id)).toBeNull();
    expect(store.size).toBe(0);
  });

  it('ignora ids con formato inválido o desconocidos', () => {
    const store = createSessionStore();
    expect(store.touch(undefined)).toBeNull();
    expect(store.touch('corto')).toBeNull();
    expect(store.touch('a'.repeat(43))).toBeNull();
  });

  it('destroy cierra la sesión', () => {
    const store = createSessionStore();
    const { id } = store.create();
    store.destroy(id);
    expect(store.touch(id)).toBeNull();
  });

  it('respeta el tope de sesiones descartando la menos reciente', () => {
    const store = createSessionStore({ maxSessions: 2 });
    const first = store.create();
    const second = store.create();
    store.touch(first.id);
    store.create();
    expect(store.size).toBe(2);
    expect(store.touch(second.id)).toBeNull();
    expect(store.touch(first.id)).not.toBeNull();
  });
});
