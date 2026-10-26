import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_DIR, createApp } from '../../src/app.ts';
import { BUSINESS_IDS, type BusinessId } from '../../src/config/businesses.ts';
import type { Config } from '../../src/config/env.ts';
import { iconFilePath, type IconKey } from '../../src/content/icons.ts';
import { getBusinessContent } from '../../src/content/index.ts';
import { makeConfig, makeRepository } from '../helpers.ts';
import { login, makeClock, setupAdmin } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductsFor } from '../support/products.ts';
import { readIcoSizes, readPng } from '../support/png.ts';

// CDMX es UTC-6 todo el año.
const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');
const FRIDAY_LATE_MX_SATURDAY_UTC = new Date('2026-10-10T02:00:00Z'); // viernes 20:00 CDMX = sábado UTC
const FRIDAY_LAST_SECOND_MX = new Date('2026-10-10T05:59:59Z'); // viernes 23:59:59 CDMX
const SATURDAY_FIRST_SECOND_MX = new Date('2026-10-10T06:00:00Z'); // sábado 00:00:00 CDMX
const SATURDAY_NOON_MX = new Date('2026-10-10T18:00:00Z');
const SUNDAY_LAST_SECOND_MX = new Date('2026-10-12T05:59:59Z'); // domingo 23:59:59 CDMX
const MONDAY_FIRST_SECOND_MX = new Date('2026-10-12T06:00:00Z'); // lunes 00:00:00 CDMX

const OTHER = { molotes: 'birria', birria: 'molotes' };
const THEME = { molotes: '#03132b', birria: '#290808' };

const repository = await makeRepository();
const products = await makeProductsFor(repository);

async function agent({ now = FRIDAY_NOON_MX, config = makeConfig() }: { now?: Date | (() => Date); config?: Config } = {}) {
  const clock = typeof now === 'function' ? now : () => now;
  return (await listenLocal(createApp({ config, repository, products, now: clock }))).request();
}

const iconFile = (businessId: BusinessId, key: IconKey) => readFileSync(join(DEFAULT_PUBLIC_DIR, iconFilePath(businessId, key)));

/** Recursos de iconos que declara el <head>. */
function headIcons(html: string) {
  const { document } = new JSDOM(html).window;
  const links = [...document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')];
  return {
    links: links.map((link) => ({
      rel: link.getAttribute('rel'),
      href: link.getAttribute('href'),
      sizes: link.getAttribute('sizes'),
      type: link.getAttribute('type'),
    })),
    themeColor: document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  };
}

function expectedHead(businessId: BusinessId) {
  const v = getBusinessContent(businessId).icons.version;
  const base = `/img/${businessId}/icons`;
  return {
    links: [
      { rel: 'icon', href: `${base}/favicon.ico?v=${v}`, sizes: '16x16 32x32 48x48', type: null },
      { rel: 'icon', href: `${base}/icon-16.png?v=${v}`, sizes: '16x16', type: 'image/png' },
      { rel: 'icon', href: `${base}/icon-32.png?v=${v}`, sizes: '32x32', type: 'image/png' },
      { rel: 'apple-touch-icon', href: `${base}/apple-touch-icon.png?v=${v}`, sizes: '180x180', type: null },
      { rel: 'manifest', href: `/${businessId}.webmanifest`, sizes: null, type: null },
    ],
    themeColor: THEME[businessId],
  };
}

describe('<head> de cada landing (CA-1, CA-2)', () => {
  it.each(BUSINESS_IDS)('/%s declara solo sus iconos, su manifest y su theme-color', async (businessId) => {
    // Un día del otro negocio: la ruta fija no depende del día.
    const now = businessId === 'molotes' ? SATURDAY_NOON_MX : FRIDAY_NOON_MX;
    const res = await (await agent({ now })).get(`/${businessId}`);
    expect(res.status).toBe(200);
    const head = headIcons(res.text);
    expect(head).toEqual(expectedHead(businessId));
    for (const { href } of head.links) expect(href).not.toContain(OTHER[businessId]);
  });
});

// REQ-F-028: `/` es siempre Birria, así que su <head> declara los iconos de Birria cualquier día.
describe('<head> de / (CA-3; REQ-F-028)', () => {
  it.each([
    ['viernes a mediodía', FRIDAY_NOON_MX],
    ['viernes 20:00 CDMX (ya es sábado en UTC)', FRIDAY_LATE_MX_SATURDAY_UTC],
    ['viernes 23:59:59', FRIDAY_LAST_SECOND_MX],
    ['sábado 00:00:00', SATURDAY_FIRST_SECOND_MX],
    ['domingo 23:59:59', SUNDAY_LAST_SECOND_MX],
    ['lunes 00:00:00', MONDAY_FIRST_SECOND_MX],
  ] as const)('%s -> iconos de Birria, idénticos a /birria', async (_label, now) => {
    const client = await agent({ now });
    const [root, fixed] = await Promise.all([client.get('/'), client.get('/birria')]);
    expect(headIcons(root.text)).toEqual(headIcons(fixed.text));
    expect(headIcons(root.text)).toEqual(expectedHead('birria'));
  });
});

describe('recursos referenciados (CA-4, CA-6)', () => {
  it.each(BUSINESS_IDS)('%s: cada URL del <head> y del manifest responde 200 con su tipo y tamaño', async (businessId) => {
    const client = await agent();
    const { links } = headIcons((await client.get(`/${businessId}`).expect(200)).text);

    const manifestRes = await client.get(links.find((link) => link.rel === 'manifest')!.href!);
    expect(manifestRes.status).toBe(200);
    expect(manifestRes.headers['content-type']).toMatch(/^application\/manifest\+json/);
    const manifest = JSON.parse(manifestRes.text);
    expect(manifest.start_url).toBe(`/${businessId}`);

    const images = [
      ...links.filter((link) => link.rel !== 'manifest').map(({ href, sizes }) => ({ href, sizes })),
      ...manifest.icons.map(({ src, sizes }: { src: string; sizes: string }) => ({ href: src, sizes })),
    ];
    for (const { href, sizes } of images) {
      expect(href).not.toContain(OTHER[businessId]);
      const res = await client.get(href).buffer(true);
      expect(res.status, href).toBe(200);
      if (href.includes('.ico')) {
        expect(res.headers['content-type'], href).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)/);
        expect(readIcoSizes(res.body).map(({ width }) => `${width}x${width}`).join(' ')).toBe(sizes);
      } else {
        expect(res.headers['content-type'], href).toBe('image/png');
        const { width, height } = readPng(res.body);
        expect(`${width}x${height}`, href).toBe(sizes);
      }
    }
  });
});

// REQ-F-028 (D-T1): los iconos de la raíz son siempre los de Birria, como `/`.
describe('iconos de la raíz (CA-7, CA-8; REQ-F-028)', () => {
  const ROOT_ICONS: [string, IconKey, RegExp][] = [
    ['/favicon.ico', 'ico', /^image\/x-icon/],
    ['/apple-touch-icon.png', 'appleTouch', /^image\/png/],
    ['/apple-touch-icon-precomposed.png', 'appleTouch', /^image\/png/],
  ];

  it.each(ROOT_ICONS)('%s sirve siempre el icono de Birria y obliga a revalidar', async (path, key, type) => {
    for (const now of [FRIDAY_LAST_SECOND_MX, SATURDAY_FIRST_SECOND_MX, SUNDAY_LAST_SECOND_MX, MONDAY_FIRST_SECOND_MX]) {
      const res = await (await agent({ now })).get(path).buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(type);
      expect(Buffer.compare(res.body, iconFile('birria', key)), `${path} ${now.toISOString()}`).toBe(0);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['cache-control']).not.toMatch(/max-age/);
      expect(res.headers.etag).toMatch(/^"[\w-]+"$/);
    }
  });

  it('responde 304 si el navegador ya tiene el icono, también tras la medianoche (ya no cambia con el día)', async () => {
    let now = FRIDAY_LAST_SECOND_MX;
    const client = await agent({ now: () => now });

    const first = await client.get('/favicon.ico');
    const etag = first.headers.etag;
    const again = await client.get('/favicon.ico').set('If-None-Match', etag!);
    expect(again.status).toBe(304);
    expect(again.headers['cache-control']).toBe('no-cache');

    expect(Buffer.compare(first.body as Buffer, iconFile('birria', 'ico'))).toBe(0);

    now = SATURDAY_FIRST_SECOND_MX;
    const next = await client.get('/favicon.ico').set('If-None-Match', etag!);
    expect(next.status).toBe(304);
  });

  it('HEAD /favicon.ico responde 200 sin cuerpo', async () => {
    const res = await (await agent()).head('/favicon.ico');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/x-icon/);
  });

  it('funciona con la administración deshabilitada (sin credenciales)', async () => {
    const config = makeConfig();
    expect(config.adminBootstrap).toBeNull();
    const res = await (await agent({ config })).get('/favicon.ico');
    expect(res.status).toBe(200);
  });

  it('los manifests piden revalidación', async () => {
    const res = await (await agent()).get('/birria.webmanifest');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers.etag).toBeDefined();
  });
});

describe('favicon en /admin (CA-9)', () => {
  function adminHead(html: string) {
    const head = headIcons(html);
    expect(head.themeColor).toBeNull();
    expect(head.links.some((link) => link.rel === 'manifest' || link.rel === 'apple-touch-icon')).toBe(false);
    return head.links;
  }
  const faviconLinks = (businessId: BusinessId) => expectedHead(businessId).links.filter((link) => link.rel === 'icon');

  it.each([
    [FRIDAY_LAST_SECOND_MX, 'molotes'],
    [SATURDAY_FIRST_SECOND_MX, 'birria'],
    [SUNDAY_LAST_SECOND_MX, 'birria'],
    [MONDAY_FIRST_SECOND_MX, 'molotes'],
  ] as const)('%s: el login muestra el favicon de %s, sin manifest ni theme-color', async (start, businessId) => {
    const { request: client } = await setupAdmin({ clock: makeClock(start) });
    const res = await client().get('/admin/login');
    expect(res.status).toBe(200);
    expect(adminHead(res.text)).toEqual(faviconLinks(businessId));
  });

  it('las páginas de cada negocio muestran el favicon del día, no el del negocio editado', async () => {
    const { browser } = await setupAdmin({ clock: makeClock(SATURDAY_NOON_MX) });
    const client = browser();
    await login(client);
    for (const businessId of BUSINESS_IDS) {
      const page = await client.get(`/admin/${businessId}`);
      expect(page.status).toBe(200);
      expect(adminHead(page.text)).toEqual(faviconLinks('birria'));
      const confirm = await client.get(`/admin/${businessId}/restaurar-anterior`);
      expect(confirm.status).toBe(200);
      expect(adminHead(confirm.text)).toEqual(faviconLinks('birria'));
    }
  });
});

// QA (REQ-F-002, plan aprobado): A-1 y A-2.
describe('QA: zona horaria configurable (A-1, CA-3, CA-7, CA-9, CLAUDE.md §11)', () => {
  // Viernes 10:00 en CDMX = sábado 01:00 en Tokio (UTC+9).
  const FRIDAY_MX_SATURDAY_TOKYO = new Date('2026-10-09T16:00:00Z');

  it.each([
    ['America/Mexico_City', 'molotes'],
    ['Asia/Tokyo', 'birria'],
  ] as const)('con BUSINESS_TIMEZONE=%s, /admin/login sigue el día de esa zona (%s); / y los iconos de la raíz son de Birria', async (timeZone, businessId) => {
    const config = makeConfig({ BUSINESS_TIMEZONE: timeZone });
    const client = await agent({ now: FRIDAY_MX_SATURDAY_TOKYO, config });

    // REQ-F-028: `/` y los iconos de la raíz ya no dependen del día.
    expect(headIcons((await client.get('/').expect(200)).text)).toEqual(expectedHead('birria'));

    const ico = await client.get('/favicon.ico').buffer(true);
    expect(Buffer.compare(ico.body, iconFile('birria', 'ico'))).toBe(0);
    const precomposed = await client.get('/apple-touch-icon-precomposed.png').buffer(true);
    expect(Buffer.compare(precomposed.body, iconFile('birria', 'appleTouch'))).toBe(0);

    const { request: adminClient } = await setupAdmin({
      env: { BUSINESS_TIMEZONE: timeZone },
      clock: makeClock(FRIDAY_MX_SATURDAY_TOKYO),
    });
    const loginPage = await adminClient().get('/admin/login').expect(200);
    const icons = headIcons(loginPage.text).links;
    expect(icons).toEqual(expectedHead(businessId).links.filter((link) => link.rel === 'icon'));
  });
});

describe('QA: HEAD y validadores de las rutas de la raíz (A-2, CA-7, CA-8)', () => {
  it('HEAD /apple-touch-icon-precomposed.png responde 200 con image/png, no-cache y sin cuerpo', async () => {
    const res = await (await agent()).head('/apple-touch-icon-precomposed.png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/png/);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body ?? {}).toEqual({});
  });

  it.each(['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'])(
    '%s con un ETag que no es el actual responde 200 con el icono de Birria',
    async (path) => {
      const birriaEtag = (await (await agent({ now: SATURDAY_NOON_MX })).get(path)).headers.etag;
      expect((await (await agent({ now: FRIDAY_NOON_MX })).get(path).set('If-None-Match', birriaEtag!)).status).toBe(304);
      const res = await (await agent({ now: FRIDAY_NOON_MX })).get(path).set('If-None-Match', '"otro"').buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers.etag).toBe(birriaEtag);
      const key = path === '/favicon.ico' ? 'ico' : 'appleTouch';
      expect(Buffer.compare(res.body, iconFile('birria', key))).toBe(0);
    },
  );
});
