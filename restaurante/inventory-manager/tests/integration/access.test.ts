import { describe, expect, it } from 'vitest';

import { ANA, ELI, dom, startInventory } from '../support/browser.ts';
import { freePortUrl } from '../support/ports.ts';

/**
 * Acceso, sesión, permisos, CSRF y cabeceras del admin nuevo (REQ-F-039: RF-1 a RF-6; CA-1 a CA-5 y
 * CA-16), contra el doble de /api/v1/admin.
 */

describe('entrar (RF-1, CA-1)', () => {
  it('en producción: cookie __Host-admin_sid HttpOnly, Secure, SameSite=Strict, Path=/ y sin Domain; la IP reenviada es la del proxy (CA-2)', async () => {
    const h = await startInventory({ env: { NODE_ENV: 'production', TRUST_PROXY: 'true' } });
    const browser = h.browser();
    // El navegador intenta falsear X-Forwarded-For; Traefik añade la IP real al final.
    Object.assign(browser.headers, { 'x-forwarded-proto': 'https', 'x-forwarded-for': '198.51.100.1, 203.0.113.9' });
    const res = await browser.post('/acceso', { username: ANA.username, password: ANA.password }, { origin: 'https://' + new URL(h.url).host });
    expect(res.status).toBe(303);
    const [cookie = ''] = res.headers.getSetCookie();
    expect(cookie).toMatch(/^__Host-admin_sid=sesion-/);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('secure');
    expect(cookie.toLowerCase()).toContain('samesite=strict');
    expect(cookie.toLowerCase()).toContain('path=/');
    expect(cookie.toLowerCase()).not.toContain('domain');
    expect(cookie.toLowerCase()).not.toContain('max-age');
    const loginRequest = h.api.requests.find((request) => request.path === '/api/v1/admin/sesion' && request.method === 'POST');
    expect(loginRequest?.headers['x-forwarded-for']).toBe('203.0.113.9');
  });

  it('en producción sin HTTPS: 503 sin formulario; /salud responde igual (HEALTHCHECK por HTTP, DEF-005)', async () => {
    const h = await startInventory({ env: { NODE_ENV: 'production', TRUST_PROXY: 'true' } });
    const browser = h.browser();
    expect((await browser.get('/acceso')).status).toBe(503);
    const health = await browser.get('/salud');
    expect(health.status).toBe(200);
    expect(await health.text()).toBe('ok');
    expect(health.headers.get('cache-control')).toBe('no-store');
  });

  it('credenciales inválidas: mensaje genérico, 401 y ninguna cookie de sesión', async () => {
    const h = await startInventory();
    const res = await h.browser().post('/acceso', { username: 'ana', password: 'mal' });
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await res.text()).toContain('Usuario o contraseña incorrectos.');
  });

  it('con la API caída: 503 con un aviso claro y sin detalles internos', async () => {
    const h = await startInventory({ apiUrl: await freePortUrl() });
    const res = await h.browser().login(ANA);
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).toContain('Servicio no disponible.');
    expect(html).not.toMatch(/ECONNREFUSED|fetch failed|\n\s+at /);
  });

  it('un editor de un solo negocio va directo a sus productos; el administrador elige', async () => {
    const h = await startInventory();
    const eli = h.browser();
    await eli.login(ELI);
    const home = await eli.get('/');
    expect(home.status).toBe(303);
    expect(home.headers.get('location')).toBe('/molotes/productos');
    const ana = h.browser();
    await ana.login(ANA);
    const picker = dom(await (await ana.get('/')).text());
    expect([...picker.querySelectorAll('.business-picker a')].map((link) => link.getAttribute('href'))).toEqual(['/molotes/productos', '/birria/productos']);
  });
});

describe('vigencia y retorno (RF-3, CA-3)', () => {
  it('sin sesión va al acceso y, tras entrar, vuelve a la pantalla pedida', async () => {
    const h = await startInventory();
    const browser = h.browser();
    const res = await browser.get('/molotes/productos/eliminados');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fproductos%2Feliminados');
    const page = dom(await (await browser.get('/acceso?next=%2Fmolotes%2Fproductos%2Feliminados')).text());
    expect(page.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe('/molotes/productos/eliminados');
    const login = await browser.login(ANA, '/molotes/productos/eliminados');
    expect(login.headers.get('location')).toBe('/molotes/productos/eliminados');
  });

  it.each(['https://evil.example/', '//evil.example', '/\\evil.example', '/acceso', 'javascript:alert(1)'])('un destino no interno (%s) se ignora: vuelve al inicio', async (next) => {
    const h = await startInventory();
    const res = await h.browser().login(ANA, next);
    expect(res.headers.get('location')).toBe('/');
  });

  it('una sesión que la API ya no reconoce (caducada, cuenta desactivada o sessionVersion distinta) lleva al acceso y borra la cookie', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.login(ELI);
    h.api.sessions.clear();
    const res = await browser.get('/molotes/productos');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fproductos');
    expect(browser.cookies.size).toBe(0);
  });

  it('un POST con la sesión caducada avisa al entrar y no guarda nada', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.login(ELI);
    h.api.sessions.clear();
    const res = await browser.post('/molotes/productos', { _csrf: 'x', category: 'platillo', name: 'Nada' });
    expect(res.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fproductos%2Fnuevo&expirada=1');
    expect(await (await browser.get('/acceso?expirada=1')).text()).toContain('Tu sesión caducó.');
    expect(h.api.products).toEqual([]);
  });
});

describe('salir (RF-4)', () => {
  it('invalida la sesión en la API, borra la cookie y vuelve al acceso', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.login(ELI);
    const page = dom(await (await browser.get('/molotes/productos')).text());
    const csrf = page.querySelector<HTMLInputElement>('.admin-header__logout input[name="_csrf"]')?.value ?? '';
    const res = await browser.post('/salir', { _csrf: csrf });
    expect(res.headers.get('location')).toBe('/acceso');
    expect(browser.cookies.size).toBe(0);
    expect(h.api.sessions.size).toBe(0);
    expect((await browser.get('/molotes/productos')).status).toBe(303);
  });
});

describe('permisos (RF-6, CA-4)', () => {
  it('un editor de Molotes no ve Birria: 403 "sin permiso" y ningún dato; un negocio inexistente da 404', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.login(ELI);
    for (const path of ['/birria/productos', '/birria/productos/nuevo', '/birria/productos/eliminados', '/birria/productos/5/editar']) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(403);
      expect(await res.text()).toContain('No tienes permiso sobre este negocio.');
    }
    expect(h.api.requests.some((request) => request.path.includes('/birria/'))).toBe(false);
    expect((await browser.get('/tacos/productos')).status).toBe(404);
    // La navegación solo ofrece sus negocios.
    const page = dom(await (await browser.get('/molotes/productos')).text());
    expect([...page.querySelectorAll('.admin-header__nav a')].map((link) => link.textContent)).toEqual(['Molotes']);
  });
});

describe('CSRF en dos capas (D-2, CA-5)', () => {
  it('Origin ajeno o Sec-Fetch-Site cross-site: 403 sin llamar a la API', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.login(ELI);
    const before = h.api.requests.length;
    expect((await browser.post('/molotes/productos', { name: 'X' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await browser.post('/molotes/productos', { name: 'X' }, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(h.api.requests.length).toBe(before);
  });

  it('sin token o con el de otra sesión: la API lo rechaza (403) y nada cambia', async () => {
    const h = await startInventory();
    const eli = h.browser();
    await eli.login(ELI);
    const ana = h.browser();
    await ana.login(ANA);
    const otherToken = dom(await (await ana.get('/molotes/productos')).text()).querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';
    for (const csrf of ['', otherToken]) {
      const res = await eli.post('/molotes/productos', { _csrf: csrf, category: 'platillo', detailsType: '', name: 'Intruso' });
      expect(res.status).toBe(403);
    }
    expect(h.api.products).toEqual([]);
  });
});

describe('cabeceras y logs (RF-5, CA-16)', () => {
  it('favicon del negocio desde los iconos de las landings (lista cerrada de archivos)', async () => {
    const h = await startInventory();
    const browser = h.browser();
    const icon = await browser.get('/img/birria/icons/favicon.ico');
    expect(icon.status).toBe(200);
    expect(icon.headers.get('content-type')).toBe('image/x-icon');
    expect(icon.headers.get('cache-control')).toBe('public, max-age=86400');
    expect((await browser.get('/img/molotes/icons/icon-32.png')).headers.get('content-type')).toBe('image/png');
    for (const path of ['/img/tacos/icons/favicon.ico', '/img/birria/icons/icon-512.png', '/img/birria/icons/..%2F..%2Fbirria.jpg']) expect((await browser.get(path)).status, path).toBe(404);
    await browser.login(ELI);
    const page = dom(await (await browser.get('/molotes/productos')).text());
    expect(page.querySelector('link[rel="icon"][sizes="any"]')?.getAttribute('href')).toBe('/img/molotes/icons/favicon.ico');
    const login = dom(await (await h.browser().get('/acceso')).text());
    expect(login.querySelector('link[rel="icon"][sizes="any"]')?.getAttribute('href')).toBe('/img/birria/icons/favicon.ico');
  });

  it('no-store, noindex, CSP estricta y Referrer-Policy same-origin en las pantallas; robots.txt lo bloquea todo', async () => {
    const h = await startInventory();
    const browser = h.browser();
    for (const path of ['/acceso', '/no-existe']) {
      const res = await browser.get(path);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(res.headers.get('referrer-policy')).toBe('same-origin');
      expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
      expect(await res.text()).toContain('<meta name="robots" content="noindex, nofollow" />');
    }
    expect(await (await browser.get('/robots.txt')).text()).toContain('Disallow: /');
    expect((await browser.get('/salud')).status).toBe(200);
  });

  it('ningún log lleva contraseñas, ids de sesión ni tokens CSRF', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.post('/acceso', { username: 'ana', password: 'contraseña-equivocada' });
    await browser.login(ANA);
    const page = await (await browser.get('/molotes/productos')).text();
    const csrf = dom(page).querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';
    await browser.post('/molotes/productos', { _csrf: csrf, category: 'platillo', detailsType: '', name: '' });
    const log = h.logger.lines.join('\n');
    const sessionId = [...browser.cookies.values()][0] ?? '';
    for (const secret of [ANA.password, 'contraseña-equivocada', sessionId, csrf]) expect(log).not.toContain(secret);
    expect(log).toContain('"msg":"request"');
  });
});
