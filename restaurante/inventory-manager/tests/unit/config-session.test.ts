import { describe, expect, it } from 'vitest';

import { InventoryConfigError, loadInventoryConfig } from '../../src/config.ts';
import { sanitizeNext, sessionCookieName } from '../../src/session.ts';

/** Configuración del admin nuevo y destino tras entrar (REQ-F-039, RF-3 y CA-3). */

describe('loadInventoryConfig', () => {
  it('valores por defecto y API obligatoria', () => {
    expect(loadInventoryConfig({ NODE_ENV: 'production', API_INTERNAL_URL: 'http://api:3001/' })).toEqual({
      nodeEnv: 'production',
      isProduction: true,
      host: '127.0.0.1',
      port: 3003,
      apiInternalUrl: 'http://api:3001',
      trustProxy: false,
    });
  });

  it.each([
    [{ API_INTERNAL_URL: undefined }, 'API_INTERNAL_URL'],
    [{ API_INTERNAL_URL: 'http://u:secreto@api:3001' }, 'API_INTERNAL_URL'],
    [{ HOST: 'localhost' }, 'HOST'],
    [{ PORT: '0' }, 'PORT'],
    [{ TRUST_PROXY: 'si' }, 'TRUST_PROXY'],
    [{ NODE_ENV: 'staging' }, 'NODE_ENV'],
  ])('rechaza %j sin repetir el valor', (override, name) => {
    let error: unknown;
    try {
      loadInventoryConfig({ NODE_ENV: 'test', API_INTERNAL_URL: 'http://api:3001', ...override });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(InventoryConfigError);
    expect((error as Error).message).toContain(name);
    expect((error as Error).message).not.toContain('secreto');
  });
});

describe('sesión', () => {
  it('la cookie lleva el prefijo __Host- en producción', () => {
    expect(sessionCookieName(true)).toBe('__Host-admin_sid');
    expect(sessionCookieName(false)).toBe('admin_sid');
  });

  it.each([
    ['/', '/'],
    ['/molotes/productos', '/molotes/productos'],
    ['/birria/productos/nuevo', '/birria/productos/nuevo'],
    ['/molotes/productos/12/editar', '/molotes/productos/12/editar'],
    ['/molotes/productos/12/eliminar', '/molotes/productos/12/eliminar'],
    ['/usuarios', '/usuarios'],
    ['/usuarios/nuevo', '/usuarios/nuevo'],
    ['/usuarios/7/editar', '/usuarios/7/editar'],
    ['/usuarios/7/contrasena', '/usuarios/7/contrasena'],
    ['/cuenta', '/cuenta'],
    ['/usuarios/abc/editar', '/'],
    ['/usuarios/0/editar', '/'],
    ['/usuarios/7', '/'],
    ['/usuarios/7/desactivar', '/'],
    ['/cuenta/', '/'],
    ['/bot', '/bot'],
    ['/bot/', '/'],
    ['/bot?ok=paused', '/'],
    ['/bot/interruptor', '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['/tacos/productos', '/'],
    ['/molotes/productos?x=1', '/'],
    // Cotizador (REQ-F-046): vuelve con la misma query, sin caracteres fuera de una query codificada y
    // acotada a 3 000 caracteres ya codificada como campo del formulario de acceso (DEF-004).
    ['/birria/cotizador', '/birria/cotizador'],
    ['/birria/cotizador?n=60&p.tradicional.f=110&m.extra=150%2C+200', '/birria/cotizador?n=60&p.tradicional.f=110&m.extra=150%2C+200'],
    [`/birria/cotizador?n=${'1'.repeat(2972)}`, `/birria/cotizador?n=${'1'.repeat(2972)}`],
    [`/birria/cotizador?n=${'1'.repeat(2973)}`, '/'],
    [`/birria/cotizador?m.extra=${'%2C'.repeat(590)}`, `/birria/cotizador?m.extra=${'%2C'.repeat(590)}`],
    [`/birria/cotizador?m.extra=${'%2C'.repeat(600)}`, '/'],
    ['/birria/cotizador?n=60#x', '/'],
    ['/birria/cotizador?n=<script>', '/'],
    ['/birria/cotizador?next=//evil.example', '/'],
    ['/birria/cotizador/', '/'],
    ['/molotes/cotizador', '/'],
    ['/birria/cotizadorx', '/'],
    [undefined, '/'],
  ])('sanitizeNext(%s) = %s', (value, expected) => {
    expect(sanitizeNext(value)).toBe(expected);
  });
});
