import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.ts';
import { BUSINESS_IDS, type BusinessId } from '../../src/config/businesses.ts';
import type { Config } from '../../src/config/env.ts';
import { commonContent, getBusinessContent } from '../../src/content/index.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import { createFileMenuRepository } from '../../src/repositories/file-menu-repository.ts';
import type { MenuDocument } from '../../src/services/menu-schema.ts';
import { hoursAndLocation } from '../../src/services/whatsapp-bot/messages.ts';
import type { Logger } from '../../src/utils/logger.ts';
import { makeConfig, makeRepository, type CorruptibleData } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository, makeProductsFor, seedSources } from '../support/products.ts';

const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');
const SATURDAY_NOON_MX = new Date('2026-10-10T18:00:00Z');

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const repository = await makeRepository();
const products = await makeProductsFor(repository);

async function agent({
  now = FRIDAY_NOON_MX,
  config = makeConfig(),
  logger = makeLogger(),
}: { now?: Date | (() => Date); config?: Config; logger?: Logger } = {}) {
  const app = createApp({ config, repository, products, logger, now: typeof now === 'function' ? now : () => now });
  return (await listenLocal(app)).request();
}

const SUNDAY_LATE_MX = new Date('2026-10-12T05:30:00Z'); // domingo 23:30 CDMX
const MONDAY_EARLY_MX = new Date('2026-10-12T06:30:00Z'); // lunes 00:30 CDMX

const WA_MOLOTES = 'https://wa.me/5210000000001?text=Hola%2C%20quiero%20hacer%20un%20pedido%20de%20molotes';
const WA_BIRRIA = 'https://wa.me/5210000000002?text=Hola%2C%20quiero%20hacer%20un%20pedido%20de%20birria';

const PAGES = {
  molotes: {
    title: 'Moloteando | Auténticos Molotes Artesanales',
    whatsapp: WA_MOLOTES,
    fonts: 'family=Epilogue:ital',
    other: 'Quesabirrias',
  },
  birria: {
    title: 'Birria El Muñeco | Birria de Res Estilo Los Altos de Jalisco',
    whatsapp: WA_BIRRIA,
    fonts: 'family=Plus+Jakarta+Sans',
    other: 'Moloteando',
  },
};

/** Todos los href de enlaces que abren WhatsApp (data-action="whatsapp-order"). */
function whatsappHrefs(html: string) {
  return [...html.matchAll(/<a\b[^>]*data-action="whatsapp-order"[^>]*>/g)].map((m) => m[0].match(/href="([^"]+)"/)![1]);
}

/** Variante del aviso de inicio en el HTML (`data-home-notice`), o null si no hay. */
function homeNoticeOf(html: string): string | null {
  return /<dialog\b[^>]*data-home-notice="([^"]+)"/.exec(html)?.[1] ?? null;
}

const MONDAY_LATE_MX_TUESDAY_UTC = new Date('2026-10-13T05:30:00Z'); // lunes 23:30 CDMX = martes UTC
const TUESDAY_NOON_MX = new Date('2026-10-13T18:00:00Z');
const WEDNESDAY_NOON_MX = new Date('2026-10-14T18:00:00Z');
const THURSDAY_NOON_MX = new Date('2026-10-15T18:00:00Z');
const SUNDAY_NOON_MX = new Date('2026-10-11T18:00:00Z');

describe('GET / (siempre Birria, con el aviso del día; REQ-F-028)', () => {
  it.each([
    ['lunes', MONDAY_EARLY_MX],
    ['martes', TUESDAY_NOON_MX],
    ['viernes', FRIDAY_NOON_MX],
    ['sábado', SATURDAY_NOON_MX],
    ['domingo', SUNDAY_LATE_MX],
  ])('CA-10: el %s renderiza Birria con su SEO y la canónica a /birria', async (_label, now) => {
    const res = await (await agent({ now })).get('/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.text).toContain('data-business="birria"');
    expect(res.text).not.toContain('data-business="molotes"');
    expect(res.text).toContain(`<title>${PAGES.birria.title}</title>`);
    expect(res.text).toContain(`<meta property="og:title" content="${PAGES.birria.title}" />`);
    expect(res.text).toContain('<link rel="canonical" href="/birria" />');
    expect(res.text).toContain('<script type="module" src="/js/birria/main.js"></script>');
  });

  it.each([
    ['lunes 00:30', MONDAY_EARLY_MX, 'rest'],
    ['martes', TUESDAY_NOON_MX, 'molotes'],
    ['viernes', FRIDAY_NOON_MX, 'molotes'],
    ['sábado', SATURDAY_NOON_MX, null],
    ['domingo 23:30', SUNDAY_LATE_MX, null],
  ])('CA-1 a CA-3: el %s el aviso es %s', async (_label, now, notice) => {
    const res = await (await agent({ now })).get('/');
    expect(homeNoticeOf(res.text)).toBe(notice);
  });

  it('CA-2, CA-3: el aviso llega cerrado (sin el atributo open) y con un título asociado', async () => {
    for (const now of [MONDAY_EARLY_MX, FRIDAY_NOON_MX]) {
      const { text } = await (await agent({ now })).get('/');
      const dialog = /<dialog\b[^>]*>/.exec(text)![0];
      expect(dialog).not.toMatch(/\bopen\b/);
      expect(dialog).toContain('aria-labelledby="home-notice-title"');
      expect(text).toContain('id="home-notice-title"');
      expect(text.match(/<dialog\b/g)).toHaveLength(1);
    }
  });

  it('CA-11: decide con la zona horaria del negocio (lunes 23:30 CDMX = martes UTC)', async () => {
    const mx = await (await agent({ now: MONDAY_LATE_MX_TUESDAY_UTC })).get('/');
    const utc = await (await agent({ now: MONDAY_LATE_MX_TUESDAY_UTC, config: makeConfig({ BUSINESS_TIMEZONE: 'UTC' }) })).get('/');
    expect(homeNoticeOf(mx.text)).toBe('rest');
    expect(homeNoticeOf(utc.text)).toBe('molotes');
  });

  // REQ-F-034 (RT-3): /molotes ya tiene sus avisos (lunes y fin de semana); /birria sigue sin ninguno.
  it('CA-4 (REQ-F-034, CA-3): /birria nunca lleva aviso, ningún día', async () => {
    for (const now of [MONDAY_EARLY_MX, TUESDAY_NOON_MX, WEDNESDAY_NOON_MX, THURSDAY_NOON_MX, FRIDAY_NOON_MX, SATURDAY_NOON_MX, SUNDAY_NOON_MX]) {
      const { text } = await (await agent({ now })).get('/birria');
      expect(text).not.toContain('data-home-notice');
      expect(text).not.toContain('<dialog');
    }
  });

  it.each([
    ['lunes', 'rest'],
    ['martes', 'molotes'],
    ['miercoles', 'molotes'],
    ['jueves', 'molotes'],
    ['viernes', 'molotes'],
    ['sabado', null],
    ['domingo', null],
  ])('CA-13: en desarrollo ?dia=%s fuerza el aviso (%s)', async (dia, notice) => {
    const client = await agent({ now: SATURDAY_NOON_MX, config: makeConfig({ NODE_ENV: 'development' }) });
    const { text } = await client.get(`/?dia=${dia}`);
    expect(homeNoticeOf(text)).toBe(notice);
    expect(text).toContain('data-business="birria"');
  });

  it('CA-13: en desarrollo, un ?dia no válido se ignora y decide el día real', async () => {
    const client = await agent({ now: FRIDAY_NOON_MX, config: makeConfig({ NODE_ENV: 'development' }) });
    for (const dia of ['Lunes', 'miércoles', 'mon', '', 'constructor', '__proto__']) {
      const res = await client.get(`/?dia=${encodeURIComponent(dia)}`);
      expect(res.status).toBe(200);
      expect(homeNoticeOf(res.text), dia).toBe('molotes');
    }
    expect(homeNoticeOf((await client.get('/?dia=lunes&dia=sabado')).text)).toBe('molotes');
  });

  it.each(['production', 'test'] as const)('CA-13: con NODE_ENV=%s, ?dia no tiene efecto', async (nodeEnv) => {
    const config = makeConfig(nodeEnv === 'production' ? { NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante' } : { NODE_ENV: 'test' });
    const client = await agent({ now: SATURDAY_NOON_MX, config });
    expect(homeNoticeOf((await client.get('/?dia=lunes')).text)).toBeNull();
    const weekday = await agent({ now: TUESDAY_NOON_MX, config });
    expect(homeNoticeOf((await weekday.get('/?dia=sabado')).text)).toBe('molotes');
  });

  it('CA-13: ?dia en desarrollo no afecta a /birria', async () => {
    const client = await agent({ now: TUESDAY_NOON_MX, config: makeConfig({ NODE_ENV: 'development' }) });
    for (const dia of ['lunes', 'martes', 'sabado', 'domingo']) {
      expect((await client.get(`/birria?dia=${dia}`)).text).not.toContain('data-home-notice');
    }
  });

  it('envía cabeceras de seguridad', async () => {
    const res = await (await agent()).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe.each(Object.keys(PAGES) as BusinessId[])('GET /%s (ruta dedicada)', (businessId) => {
  const page = PAGES[businessId];

  it.each([
    ['viernes', FRIDAY_NOON_MX],
    ['sábado', SATURDAY_NOON_MX],
  ])('renderiza siempre su landing, sin importar el día (%s)', async (_day, now) => {
    const res = await (await agent({ now })).get(`/${businessId}`);
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain(`data-business="${businessId}"`);
    expect(res.text).not.toContain(page.other);
  });

  it('incluye SEO básico: title, description, viewport, Open Graph y canónica', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    expect(text).toContain('<html lang="es-MX">');
    expect(text).toContain(`<title>${page.title}</title>`);
    expect(text).toMatch(/<meta name="description" content="[^"]{50,}" \/>/);
    expect(text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />');
    expect(text).toContain(`<meta property="og:title" content="${page.title}" />`);
    expect(text).toContain('<meta property="og:locale" content="es_MX" />');
    expect(text).toContain(`<link rel="canonical" href="/${businessId}" />`);
    // Sin SITE_URL no se emiten og:url/og:image (requieren URL absoluta).
    expect(text).not.toContain('og:url');
  });

  it('con SITE_URL usa URLs absolutas en canónica, og:url y og:image', async () => {
    const config = makeConfig({ SITE_URL: 'https://ejemplo.mx/' });
    const { text } = await (await agent({ config })).get(`/${businessId}`);
    expect(text).toContain(`<link rel="canonical" href="https://ejemplo.mx/${businessId}" />`);
    expect(text).toContain(`<meta property="og:url" content="https://ejemplo.mx/${businessId}" />`);
    expect(text).toMatch(new RegExp(`<meta property="og:image" content="https://ejemplo\\.mx/img/${businessId}/logo-${businessId}\\.webp" />`));
  });

  it('carga sus propios assets', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    expect(text).toContain(`<link rel="stylesheet" href="/css/${businessId}/main.css" />`);
    expect(text).toContain(`<script type="module" src="/js/${businessId}/main.js"></script>`);
    expect(text).toContain(page.fonts);
  });

  it('estructura semántica: un h1, skip link, header, nav, main y footer', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    expect(text.match(/<h1\b/g)).toHaveLength(1);
    expect(text).toContain('href="#main-content"');
    expect(text).toContain('<main id="main-content"');
    expect(text).toMatch(/<header\b/);
    expect(text).toMatch(/<nav\b[^>]*aria-label="Principal"/);
    expect(text).toMatch(/<footer\b/);
  });

  it('todos los CTA de pedido usan el enlace de WhatsApp configurado', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    const hrefs = whatsappHrefs(text);
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    expect(new Set(hrefs)).toEqual(new Set([page.whatsapp.replaceAll('&', '&amp;')]));
    expect(text).not.toContain('wa.me/525541239080'); // enlace de ejemplo del diseño
  });

  it('usa la URL de WhatsApp configurada (escapada en el atributo)', async () => {
    const env = { [`WHATSAPP_${businessId.toUpperCase()}_URL`]: 'https://example.com/bot?a=1&b=2' };
    const { text } = await (await agent({ config: makeConfig(env) })).get(`/${businessId}`);
    expect(new Set(whatsappHrefs(text))).toEqual(new Set(['https://example.com/bot?a=1&amp;b=2']));
  });

  it('los enlaces externos abren en otra pestaña con rel seguro', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    const blanks = [...text.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
    expect(blanks.length).toBeGreaterThan(0);
    for (const tag of blanks) expect(tag).toContain('rel="noopener noreferrer"');
  });

  it('no usa imágenes remotas, scripts en línea ni enlaces vacíos', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    expect(text).not.toMatch(/googleusercontent|cdn\.tailwindcss/);
    expect(text).not.toMatch(/\son[a-z]+="/);
    expect(text).not.toMatch(/<script(?![^>]*type="module" src=)/);
    expect(text).not.toContain('href="#"');
  });

  it('las anclas internas apuntan a secciones existentes', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    const ids = new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...text.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) expect(ids.has(anchor), anchor).toBe(true);
  });

  it('todas las imágenes tienen alt, dimensiones y existen en public/', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    const imgs = [...text.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThan(5);
    for (const tag of imgs) {
      expect(tag, tag).toMatch(/\salt="[^"]*"/);
      expect(tag, tag).toMatch(/\swidth="\d+" height="\d+"/);
      const src = tag.match(/src="([^"]+)"/)![1]!;
      const res = await (await agent()).get(src);
      expect(res.status, src).toBe(200);
    }
  });

  it('formulario de promociones accesible enganchado por data-promo-form', async () => {
    const { text } = await (await agent()).get(`/${businessId}`);
    expect(text).toMatch(/<form\b[^>]*data-promo-form/);
    const status = text.match(/data-promo-status="([^"]+)"/)![1];
    expect(text).toMatch(new RegExp(`id="${status}"[^>]*role="status"[^>]*hidden`));
    for (const [, id] of text.matchAll(/<input id="([^"]+)"/g)) {
      expect(text).toContain(`<label class="sr-only" for="${id}">`);
    }
  });
});

describe('GET /molotes: aviso de descanso y de fin de semana (REQ-F-034)', () => {
  it.each([
    ['lunes 00:30', MONDAY_EARLY_MX, 'rest'],
    ['lunes 23:30 (martes en UTC)', MONDAY_LATE_MX_TUESDAY_UTC, 'rest'],
    ['martes', TUESDAY_NOON_MX, null],
    ['miércoles', WEDNESDAY_NOON_MX, null],
    ['jueves', THURSDAY_NOON_MX, null],
    ['viernes', FRIDAY_NOON_MX, null],
    ['sábado', SATURDAY_NOON_MX, 'weekend'],
    ['domingo', SUNDAY_NOON_MX, 'weekend'],
    ['domingo 23:30', SUNDAY_LATE_MX, 'weekend'],
  ])('CA-1, CA-2: el %s el aviso de /molotes es %s', async (_label, now, notice) => {
    const res = await (await agent({ now })).get('/molotes');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.text).toContain('data-business="molotes"');
    expect(homeNoticeOf(res.text)).toBe(notice);
    expect(res.text.match(/<dialog\b/g) ?? []).toHaveLength(notice === null ? 0 : 1);
  });

  it('CA-1: el sábado llega cerrado, con su título asociado, los textos de R-2 y el enlace a /birria', async () => {
    const { text } = await (await agent({ now: SATURDAY_NOON_MX })).get('/molotes');
    const { document } = new JSDOM(text).window;
    const dialog = document.querySelector('dialog[data-home-notice="weekend"]')!;
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('¡Raza, hoy toca birria!');
    expect(dialog.querySelector('a')!.getAttribute('href')).toBe('/birria');
    expect(dialog.querySelector('a')!.textContent.trim()).toBe('Ver Birria El Muñeco');
    expect(dialog.querySelector('button')!.textContent).toBe('Quedarme en Molotes');
    expect(text).toContain('<script type="module" src="/js/molotes/main.js"></script>');
  });

  it('CA-2: el lunes lleva los textos de R-3 y un único botón "Ver el menú"', async () => {
    const { text } = await (await agent({ now: MONDAY_EARLY_MX })).get('/molotes');
    const { document } = new JSDOM(text).window;
    const dialog = document.querySelector('dialog[data-home-notice="rest"]')!;
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('¡Los lunes descansamos!');
    expect(dialog.querySelectorAll('a')).toHaveLength(0);
    expect([...dialog.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Ver el menú']);
  });

  it('CA-3: el aviso de / no cambia (lunes descanso, martes a viernes Molotes, fin de semana ninguno)', async () => {
    for (const [now, notice] of [
      [MONDAY_EARLY_MX, 'rest'],
      [TUESDAY_NOON_MX, 'molotes'],
      [FRIDAY_NOON_MX, 'molotes'],
      [SATURDAY_NOON_MX, null],
      [SUNDAY_NOON_MX, null],
    ] as const) {
      expect(homeNoticeOf((await (await agent({ now })).get('/')).text)).toBe(notice);
    }
  });

  it.each([
    ['sabado', 'weekend'],
    ['domingo', 'weekend'],
    ['lunes', 'rest'],
    ['martes', null],
    ['viernes', null],
  ])('CA-7: en desarrollo /molotes?dia=%s muestra %s', async (dia, notice) => {
    const client = await agent({ now: TUESDAY_NOON_MX, config: makeConfig({ NODE_ENV: 'development' }) });
    expect(homeNoticeOf((await client.get(`/molotes?dia=${dia}`)).text)).toBe(notice);
  });

  it('CA-7: en desarrollo, /molotes?dia=martes un sábado no muestra aviso y un ?dia no válido se ignora', async () => {
    const client = await agent({ now: SATURDAY_NOON_MX, config: makeConfig({ NODE_ENV: 'development' }) });
    expect(homeNoticeOf((await client.get('/molotes?dia=martes')).text)).toBeNull();
    for (const dia of ['Sabado', 'sábado', 'sat', '', '__proto__']) {
      expect(homeNoticeOf((await client.get(`/molotes?dia=${encodeURIComponent(dia)}`)).text), dia).toBe('weekend');
    }
  });

  it.each(['production', 'test'] as const)('CA-7: con NODE_ENV=%s, ?dia no tiene efecto en /molotes', async (nodeEnv) => {
    const config = makeConfig(nodeEnv === 'production' ? { NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante' } : { NODE_ENV: 'test' });
    const tuesday = await agent({ now: TUESDAY_NOON_MX, config });
    expect(homeNoticeOf((await tuesday.get('/molotes?dia=sabado')).text)).toBeNull();
    expect(homeNoticeOf((await tuesday.get('/molotes?dia=lunes')).text)).toBeNull();
    const saturday = await agent({ now: SATURDAY_NOON_MX, config });
    expect(homeNoticeOf((await saturday.get('/molotes?dia=martes')).text)).toBe('weekend');
  });
});

describe('GET /birria: contenido del diseño', () => {
  it('renderiza los 6 platillos con selectores de variante accesibles', async () => {
    const { text } = await (await agent()).get('/birria');
    expect(text.match(/<article id="card-/g)).toHaveLength(6);
    expect(text.match(/data-variant-group/g)).toHaveLength(3);
    expect(text).toContain('data-variant-price="price-birriamen" data-variant-description="desc-birriamen"');
    expect(text).toContain('id="price-birriamen"');
    expect(text).toMatch(/aria-pressed="true" data-variant data-price="\$155 MXN"/);
    expect(text).toMatch(/aria-pressed="false" data-variant data-price="\$110 MXN"/);
    expect(text).toContain('Quesabirria con Tortilla de Mano');
  });

  it('muestra una sola sucursal enlazada a la ubicación común (REQ-F-032, R-5)', async () => {
    const { text } = await (await agent()).get('/birria');
    const document = new JSDOM(text).window.document;
    const branches = document.querySelectorAll('.branches-card ol > li');
    expect(branches).toHaveLength(1);
    expect(branches[0]!.querySelector('h4')?.textContent).toBe('Birria El Muñeco');
    expect(branches[0]!.querySelector('a')?.getAttribute('href')).toBe(commonContent.location.mapsUrl);
    expect(text).not.toContain('Matriz San Rafael');
  });
});

describe('GET /molotes: contenido del diseño', () => {
  it('renderiza los 8 molotes con precio individual y por orden', async () => {
    const { text } = await (await agent()).get('/molotes');
    expect(text.match(/class="menu-card /g)).toHaveLength(8);
    expect(text).toContain('Molotes de Huitlacoche con Epazote');
    expect(text).toContain('$50 c/u');
    expect(text).toContain('$145 orden de 3');
  });

  it('renderiza las bebidas de la base dentro de #bebidas-seccion con su icono y tono', async () => {
    const { text } = await (await agent()).get('/molotes');
    const section = text.slice(text.indexOf('id="bebidas-seccion"'), text.indexOf('<!-- EL RITUAL'));
    expect(section.match(/<li class=/g)).toHaveLength(2);
    expect(section).toMatch(/rounded-full bg-secondary-container\/20" aria-hidden="true">\s*<span class="material-symbols-outlined text-2xl text-\[#d97706\]">water_full</);
    expect(section).toMatch(/rounded-full bg-\[#fee2e2\]" aria-hidden="true">\s*<span class="material-symbols-outlined text-2xl text-\[#dc2626\]">sports_bar</);
    expect(section).toContain('Refrescos Familia Coca-Cola');
    expect(section.match(/>\$35 MXN</g)).toHaveLength(2);
  });

  it('el formulario se oculta al enviarse (data-promo-hide-on-success)', async () => {
    const { text } = await (await agent()).get('/molotes');
    expect(text).toMatch(/<form id="promo-form"[^>]*data-promo-hide-on-success/);
  });
});

describe('GET /molotes: textos y datos comerciales reales (REQ-F-031)', () => {
  const molotes = getBusinessContent('molotes');
  const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853';
  const EMBED_SRC =
    'https://www.google.com/maps/embed?pb=!4v1792064722212!6m8!1m7!1sCliD7xRS-mkCpf6MwseHcQ!2m2!1d18.81823603166285!2d-98.96914471124853!3f189.613958693852!4f-9.01272483181998!5f0.7820865974627469';

  const molotesPage = async () => {
    const { text } = await (await agent()).get('/molotes');
    return { html: text, document: new JSDOM(text).window.document };
  };
  const normalized = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

  it('CA-1: el HTML publicado no contiene ninguna afirmación retirada (atributos incluidos) y conserva "Queso Oaxaca"', async () => {
    const { html, document } = await molotesPage();
    // OT-1: los <path> de los iconos SVG contienen secuencias como "4.945"; no son texto publicado.
    const markup = html.replace(/<svg\b[\s\S]*?<\/svg>/g, '');
    const text = normalized(document.body.textContent);
    const RETIRED = [
      'oaxaqueños', '15 Años', 'generaciones', '1,500', 'Sucursales Activas', 'Sucursales', 'térmic', 'Uber', 'Rappi',
      'moloteando.mx', '2x1', '2×1', 'Jueves', 'Club del Comal', 'ofertas secretas', 'plátano macho', 'Callejon del Sabor',
      'San Jerónimo', '5548920184', '4.9', 'S.A. de C.V.', '2024', 'Facturación', 'curación de cazuelas', 'Cerrado por nixtamal',
      'Solo promociones crujientes y reales',
    ];
    for (const term of RETIRED) {
      expect(markup, `HTML: ${term}`).not.toContain(term);
      expect(text, `texto: ${term}`).not.toContain(term);
    }
    // La métrica antigua iba en dos elementos ("+15" y "Años de Tradición").
    expect(text).not.toContain('Años de Tradición');
    expect(text).toContain('Queso Oaxaca');
  });

  it('CA-2: el formulario dice "Activar promoción" y su mensaje de éxito (oculto) es el aprobado', async () => {
    const { document } = await molotesPage();
    const form = document.querySelector('#promo-form')!;
    expect(normalized(form.querySelector('button[type="submit"] span:not([aria-hidden])')?.textContent)).toBe('Activar promoción');
    expect(form.hasAttribute('action')).toBe(false);
    const success = document.querySelector('#promo-success')!;
    expect(success.hasAttribute('hidden')).toBe(true);
    expect(normalized(success.textContent)).toBe('¡Gracias por tu interés! Pregunta por la promoción vigente al pedir por WhatsApp.');
    expect(molotes.promo.success).toBe(normalized(success.textContent));
  });

  // REQ-F-032 (R-6) revierte "sin correo en Molotes": el pie lleva el teléfono y el correo comunes.
  it('CA-3 y CA-4 (REQ-F-032, R-6): el pie lleva el teléfono oficial y el correo común', async () => {
    const { document } = await molotesPage();
    const footer = document.querySelector('footer')!;
    const phone = footer.querySelector('a[href^="tel:"]')!;
    expect(phone.getAttribute('href')).toBe('tel:+527352782306');
    expect(normalized(phone.textContent)).toBe('+52 735 278 2306');
    const emails = footer.querySelectorAll('a[href^="mailto:"]');
    expect(emails).toHaveLength(1);
    expect(emails[0]!.getAttribute('href')).toBe('mailto:ordenes@birriaelmuneco.mx');
    expect(normalized(emails[0]!.textContent)).toBe('ordenes@birriaelmuneco.mx');
    expect(normalized(footer.textContent)).toContain('Contacto y ubicación');
  });

  it('CA-5 y CA-6: un solo mapa embebido con el src oficial y tres enlaces a la ubicación (REQ-F-032 suma "Recoger en sucursal")', async () => {
    const { html, document } = await molotesPage();
    const iframes = document.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    const iframe = iframes[0]!;
    expect(iframe.closest('#pedidos-seccion')).not.toBeNull();
    expect(iframe.getAttribute('src')).toBe(EMBED_SRC);
    expect(iframe.getAttribute('title')).toBe('Ubicación de Moloteando en Google Maps');
    expect(iframe.getAttribute('loading')).toBe('lazy');
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true);
    expect(iframe.hasAttribute('width')).toBe(false);

    const links = [...document.querySelectorAll('a')].filter((a) => a.getAttribute('href') === MAPS_URL);
    expect(links).toHaveLength(3);
    const [pickup, directions, footerLink] = links;
    expect(pickup!.closest('#pedidos-seccion ul')).not.toBeNull();
    expect(directions!.closest('#pedidos-seccion')).not.toBeNull();
    expect(normalized(directions!.textContent)).toBe(`directions${commonContent.location.label} ${commonContent.location.assistiveText}`);
    expect(footerLink!.closest('footer')).not.toBeNull();
    expect(normalized(footerLink!.textContent)).toBe('Ver ubicación en Google Maps (se abre en una pestaña nueva)');
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(html).not.toContain('maps.app.goo.gl');
  });

  // REQ-F-032 (R-3, R-4 y R-10) revierte "enlace corto común": hay una sola ubicación, con mapa en ambas landings.
  it('CA-7 (REQ-F-032): / y /birria usan la ubicación única con su mapa embebido, y el bot la envía', async () => {
    const client = await agent();
    for (const path of ['/', '/birria']) {
      const { text } = await client.get(path);
      const document = new JSDOM(text).window.document;
      expect(document.querySelectorAll(`a[href="${MAPS_URL}"]`).length, path).toBeGreaterThan(0);
      expect(document.querySelectorAll('iframe'), path).toHaveLength(1);
      expect(document.querySelector('iframe')!.getAttribute('src'), path).toBe(EMBED_SRC);
      expect(text, path).not.toContain('maps.app.goo.gl');
    }
    for (const businessId of BUSINESS_IDS) expect(hoursAndLocation(businessId)).toContain(MAPS_URL);
  });

  it('CA-8: casillas de plataformas: WhatsApp (enlace al bot), Motomandados (informativa) y Recoger en sucursal (REQ-F-032, R-8)', async () => {
    const { document } = await molotesPage();
    const list = document.querySelector('#pedidos-seccion ul')!;
    expect(list.className).toBe('grid grid-cols-2 gap-space-sm');
    const items = [...list.children];
    expect(items).toHaveLength(3);
    const whatsapp = items[0]!.querySelector('a.platform')!;
    expect(whatsapp.getAttribute('data-action')).toBe('whatsapp-order');
    expect(whatsapp.getAttribute('href')).toBe(WA_MOLOTES);
    expect(normalized(whatsapp.textContent)).toContain('WhatsApp Sin comisiones');
    expect(items[1]!.classList.contains('platform')).toBe(true);
    expect(items[1]!.querySelector('a')).toBeNull();
    expect(normalized(items[1]!.textContent)).toBe('moped Motomandados Costo según distancia');
    // La tercera casilla ocupa la fila completa: la cuadrícula de 2 columnas no deja huecos.
    expect(items[2]!.className).toBe('col-span-2');
    const pickup = items[2]!.querySelector('a.platform')!;
    expect(pickup.getAttribute('href')).toBe(MAPS_URL);
    expect(pickup.getAttribute('target')).toBe('_blank');
    expect(pickup.getAttribute('rel')).toBe('noopener noreferrer');
    expect(normalized(pickup.textContent)).toBe(`storefront Recoger en sucursal Pasa por tu pedido ${commonContent.location.assistiveText}`);
  });

  it('CA-9: los textos corregidos coinciden con sus requisitos', async () => {
    const { document } = await molotesPage();
    const text = normalized(document.body.textContent);
    const metrics = [...document.querySelectorAll('.ritual__metrics > div')].map((metric) => ({
      value: normalized(metric.querySelector('dd.order-1')?.textContent),
      title: normalized(metric.querySelector('dt')?.textContent),
      note: normalized(metric.querySelector('dd.order-3')?.textContent),
    }));
    expect(metrics).toEqual([
      { value: '2026', title: 'Desde', note: 'Comal recién encendido' },
      { value: '1', title: 'Sucursal', note: 'Te esperamos de martes a viernes' },
      { value: 'A mano', title: 'Hecho pieza por pieza', note: 'Masa recién amasada' },
    ]);
    for (const expected of [
      'Disfruta tus molotes crujientes hasta tu puerta. Contamos con servicio de entrega mediante motomandados; el costo se calcula según la distancia de entrega. Consulta el costo al realizar tu pedido por WhatsApp.',
      'Estilo Poblano',
      '© 2026 Moloteando. Todos los derechos reservados.',
      'Pedidos y Domicilio',
      '* Lunes descansamos. Sábados y domingos te esperamos en Birria El Muñeco.',
      'Molotes estilo poblano, crujientes y hechos a mano, con crema de rancho, queso fresco y salsas de molcajete.',
      'Logramos esta textura templando la masa con un toque sutil de puré de papa criolla y cuidando cada fritura en el comal.',
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(normalized(document.querySelector('.hero__pills li:last-child')?.textContent)).toBe('star Estilo Poblano');
    const disclaimer = [...document.querySelectorAll('#pedidos-seccion span')].find((span) => span.textContent?.startsWith('Sin spam'));
    expect(disclaimer?.textContent).toBe('Sin spam molesto.');
    expect([...document.querySelectorAll('nav a')].map((a) => normalized(a.textContent))).toContain('Ubicación');
    expect(molotes.nav.at(-1)).toEqual({ label: 'Ubicación', href: '#pedidos-seccion' });
  });

  it('CA-11: la CSP solo añade www.google.com en frame-src a la política por defecto', async () => {
    const EXPECTED = {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", 'https:', "'unsafe-inline'"],
      'upgrade-insecure-requests': [],
      'frame-src': ['https://www.google.com'],
    };
    const client = await agent();
    // REQ-F-032 (CA-5): /birria tiene ahora su mapa embebido con la misma política.
    for (const path of ['/molotes', '/', '/birria', '/admin/login']) {
      const header = (await client.get(path)).headers['content-security-policy'] as string;
      const directives = Object.fromEntries(
        header
          .split(';')
          .map((directive) => directive.trim().split(/\s+/))
          .filter(([name]) => name)
          .map(([name, ...values]) => [name, values]),
      );
      expect(directives, path).toEqual(EXPECTED);
    }
  });
});

describe('REQ-F-032: contacto, ubicación y plataformas de la única sucursal', () => {
  const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=18.81823603166285,-98.96914471124853';
  const EMBED_SRC =
    'https://www.google.com/maps/embed?pb=!4v1792064722212!6m8!1m7!1sCliD7xRS-mkCpf6MwseHcQ!2m2!1d18.81823603166285!2d-98.96914471124853!3f189.613958693852!4f-9.01272483181998!5f0.7820865974627469';
  const PATHS = ['/', '/birria', '/molotes'] as const;
  const normalized = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
  const load = async (path: string, now?: Date) => {
    const { text } = await (await agent(now ? { now } : {})).get(path);
    return { html: text, document: new JSDOM(text).window.document };
  };
  const hrefs = (document: Document, prefix: string) =>
    new Set([...document.querySelectorAll(`a[href^="${prefix}"]`)].map((a) => a.getAttribute('href')));

  it.each(PATHS)('CA-3: %s solo enlaza al teléfono y al correo comunes, en el pie', async (path) => {
    const { document } = await load(path);
    expect(hrefs(document, 'tel:')).toEqual(new Set(['tel:+527352782306']));
    expect(hrefs(document, 'mailto:')).toEqual(new Set(['mailto:ordenes@birriaelmuneco.mx']));
    // El pie de página es el último <footer> (la cita del ritual de Birria también usa uno).
    const footer = [...document.querySelectorAll('footer')].at(-1)!;
    expect(normalized(footer.querySelector('a[href^="tel:"]')?.textContent)).toBe('+52 735 278 2306');
    expect(normalized(footer.querySelector('a[href^="mailto:"]')?.textContent)).toBe('ordenes@birriaelmuneco.mx');
    const location = [...footer.querySelectorAll('a')].find((a) => a.getAttribute('href') === MAPS_URL)!;
    expect(normalized(location.textContent)).toBe('Ver ubicación en Google Maps (se abre en una pestaña nueva)');
  });

  it.each(PATHS)('CA-4: %s no usa el enlace corto', async (path) => {
    const { html } = await load(path);
    expect(html).not.toContain('maps.app.goo.gl');
  });

  it('CA-4 y R-10: "Horario y ubicación" del bot envía la ubicación única para ambos negocios', () => {
    for (const businessId of BUSINESS_IDS) {
      expect(hoursAndLocation(businessId)).toContain(MAPS_URL);
      expect(hoursAndLocation(businessId)).not.toContain('maps.app.goo.gl');
    }
  });

  it.each([
    ['/ (lunes)', '/', new Date('2026-10-12T16:00:00Z')], // lunes 10:00 CDMX
    ['/ (martes)', '/', TUESDAY_NOON_MX],
    ['/ (sábado)', '/', SATURDAY_NOON_MX],
    ['/birria', '/birria', FRIDAY_NOON_MX],
  ] as const)('CA-5: %s tiene un solo mapa embebido de la sucursal, diferido', async (_name, path, now) => {
    const { document } = await load(path, now);
    const iframes = document.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    const iframe = iframes[0]!;
    expect(iframe.closest('#ubicaciones-pedidos .branches-card')).not.toBeNull();
    expect(iframe.getAttribute('src')).toBe(EMBED_SRC);
    expect(iframe.getAttribute('title')).toBe('Ubicación de Birria El Muñeco en Google Maps');
    expect(iframe.getAttribute('loading')).toBe('lazy');
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
  });

  it('R-4 y R-5: una sola sucursal, sin dirección postal, con "Cómo llegar" y "Abrir en Google Maps"', async () => {
    const { document } = await load('/birria');
    const card = document.querySelector('.branches-card')!;
    expect(normalized(card.querySelector('h3')?.textContent)).toBe('Nuestra Sucursal');
    const branches = card.querySelectorAll('ol > li');
    expect(branches).toHaveLength(1);
    expect(normalized(branches[0]!.querySelector('p')?.textContent)).toBe('Consulta la ubicación en el mapa.');
    const links = [...card.querySelectorAll('a')];
    expect(links.map((a) => normalized(a.textContent))).toEqual([
      `${commonContent.location.label} Birria El Muñeco ${commonContent.location.assistiveText}`,
      'pin_drop Abrir en Google Maps (se abre en una pestaña nueva)',
    ]);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(MAPS_URL);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.querySelector('.sr-only')).not.toBeNull();
    }
    expect(normalized(card.textContent)).not.toContain('Estacionamiento');
  });

  it('CA-6: Birria tiene exactamente sus tres plataformas, sin huecos en la cuadrícula de 2 columnas', async () => {
    const { document } = await load('/birria');
    const list = document.querySelector('.delivery-card ul')!;
    expect(list.className).toBe('grid grid-cols-2 gap-3 pt-1');
    const items = [...list.children];
    expect(items.map((item) => normalized(item.textContent))).toEqual([
      `chat WhatsApp Sin comisiones ${commonContent.cta.assistiveText}`,
      'moped Motomandados Costo según distancia',
      `shopping_bag Recoger en sucursal Pasa por tu pedido ${commonContent.location.assistiveText}`,
    ]);
    expect(items[0]!.querySelector('a')?.getAttribute('href')).toBe(WA_BIRRIA);
    expect(items[1]!.querySelector('a')).toBeNull();
    expect(items[2]!.className).toBe('col-span-2');
    const pickup = items[2]!.querySelector('a')!;
    expect(pickup.getAttribute('href')).toBe(MAPS_URL);
    for (const link of [items[0]!.querySelector('a')!, pickup]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.querySelector('.sr-only')).not.toBeNull();
    }
  });

  it('CA-7: el horario de la sección y del pie de /birria coincide con R-7', async () => {
    const { document } = await load('/birria');
    const rows = [...[...document.querySelectorAll('footer')].at(-1)!.querySelector('ul')!.querySelectorAll('li')].map((li) =>
      [...li.querySelectorAll('span')].map((span) => normalized(span.textContent)),
    );
    expect(rows).toEqual([
      ['Lunes:', 'Cerrado'],
      ['Sábados y Domingos:', '08:00 - 15:00'],
      ['Martes a Viernes:', 'Hay Molotes'],
    ]);
    const text = normalized(document.body.textContent);
    expect(text).toContain('Sábado y Domingo 08:00 AM – 03:00 PM');
    expect(text).toContain('Lunes a Viernes Cerrado');
  });

  // QA ronda 1 (DEF-001 a DEF-004): textos aprobados que no caben a 320–375 px. jsdom no
  // calcula el layout: aquí se fijan las utilidades responsivas; la medida real se hizo con
  // Chrome headless a 320, 360, 375, 414, 640, 768, 1024, 1280 y 1440 px.
  it('DEF-001 a DEF-003: plataformas, métricas e insignias de Birria se adaptan al ancho móvil', async () => {
    const { document } = await load('/birria');
    for (const platform of document.querySelectorAll('.delivery-card .platform')) {
      expect(platform.classList.contains('flex-col'), 'en columna en móvil').toBe(true);
      expect(platform.classList.contains('sm:flex-row'), 'en fila desde sm').toBe(true);
    }
    const metrics = document.querySelector('.ritual__metrics')!;
    expect(metrics.classList.contains('grid-cols-1')).toBe(true);
    expect(metrics.classList.contains('sm:grid-cols-3')).toBe(true);
    for (const value of metrics.querySelectorAll('dd')) expect(value.classList.contains('lg:text-xl')).toBe(true);
    const badges = document.querySelectorAll('.hero__badges .trust-badge');
    expect(badges).toHaveLength(3);
    for (const badge of badges) {
      expect(badge.classList.contains('p-2.5')).toBe(true);
      expect(badge.querySelector('span.font-headline')!.classList.contains('text-sm')).toBe(true);
    }
  });

  it('DEF-004: el icono de "Recoger en sucursal" de Molotes usa un color de la paleta con contraste', async () => {
    const { document } = await load('/molotes');
    const icon = [...document.querySelectorAll('#pedidos-seccion .platform .material-symbols-outlined')].find((node) => node.textContent === 'storefront')!;
    expect(icon.classList.contains('text-primary')).toBe(true);
    expect(icon.className).not.toContain('rgb(3,43,95)');
  });

  it.each(PATHS)('CA-8: ningún botón ni enlace de %s contiene "2x1" ni "2×1"', async (path) => {
    const { document } = await load(path);
    for (const control of document.querySelectorAll('button, a')) {
      expect(control.textContent ?? '').not.toMatch(/2\s*[x×]\s*1/i);
    }
  });
});

describe('REQ-F-033: navegación cruzada desde el pie', () => {
  it.each([
    ['/', FRIDAY_NOON_MX, '/molotes'],
    ['/', SATURDAY_NOON_MX, '/molotes'],
    ['/birria', FRIDAY_NOON_MX, '/molotes'],
    ['/molotes', FRIDAY_NOON_MX, '/birria'],
  ] as const)('CA-3: el enlace del pie de %s (%s) lleva a %s y esa landing responde 200 sin redirección', async (path, now, target) => {
    const client = await agent({ now });
    const { text } = await client.get(path).expect(200);
    const footer = new JSDOM(text).window.document.querySelector('footer.site-footer')!;
    const links = [...footer.querySelectorAll('a.cross-link')];
    expect(links).toHaveLength(1);
    const href = links[0]!.getAttribute('href')!;
    expect(href).toBe(target);
    const res = await client.get(href).redirects(0);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<link rel="canonical" href="${target}" />`);
  });
});

describe('horarios reales (REQ-F-010)', () => {
  const MONDAY_10_MX = new Date('2026-10-12T16:00:00Z'); // lunes 10:00 CDMX

  /** Filas [días, horas] de la tabla "Horarios del Comal" del pie, en orden. */
  function footerHourRows(html: string) {
    const footer = html.slice(html.indexOf('<footer'));
    return [...footer.matchAll(/<li class="flex justify-between[^"]*"><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span><\/li>/g)].map(
      ([, days, hours]) => [days, hours],
    );
  }

  /** Texto de los <p> de la tarjeta "Horarios de Servicio" de Birria, en orden. */
  function birriaScheduleCard(html: string) {
    const card = html.slice(html.indexOf('class="schedule-card'), html.indexOf('class="branches-card'));
    return [...card.matchAll(/<p class="[^"]*">([^<]*)<\/p>/g)].map(([, text]) => text);
  }

  it('CA-1: /molotes publica exactamente los textos de D-4 (orden PT-1 A), D-5 y D-7', async () => {
    const { text } = await (await agent()).get('/molotes');
    expect(text).toContain('>Horario de Comal: Mar - Vie 08:30 a 15:00 hrs • Salsas Caseras y Masa Recién Frita<');
    expect(text).toContain('>Martes a Viernes de 8:30 AM a 3:00 PM<');
    expect(text).toContain(
      '>* Lunes descansamos. Sábados y domingos te esperamos en Birria El Muñeco.<',
    );
    expect(footerHourRows(text)).toEqual([
      ['Martes a Viernes', '08:30 - 15:00'],
      ['Sábado y Domingo', 'Cerrado'],
      ['Lunes', 'Cerrado'],
    ]);
  });

  it('CA-2: /birria publica exactamente los textos de D-8', async () => {
    const { text } = await (await agent()).get('/birria');
    // Textos de REQ-F-032 (R-7, tabla editorial).
    expect(birriaScheduleCard(text)).toEqual([
      'Sábado y Domingo',
      '08:00 AM – 03:00 PM',
      'Birria, consomé y quesabirrias para el antojo del finde.',
      'Lunes a Viernes',
      'Cerrado',
      'De martes a viernes te esperan nuestros Molotes.',
    ]);
    expect(footerHourRows(text)).toEqual([
      ['Lunes:', 'Cerrado'],
      ['Sábados y Domingos:', '08:00 - 15:00'],
      ['Martes a Viernes:', 'Hay Molotes'],
    ]);
  });

  it('CA-3: ni src/content/ ni el HTML servido contienen los horarios anteriores', async () => {
    const OLD_TEXTS = [
      'Mar - Dom',
      'Martes a Domingo',
      '13:00 - 22:30',
      '12:00 - 23:00',
      '10:00 AM a 8:00 PM',
      'Viernes a Domingo',
      'Lunes a Jueves',
      '05:00 PM',
      '07:00 PM',
      '08:30 - 17:00',
      '07:30 - 18:30',
    ];
    const contentDir = join(import.meta.dirname, '..', '..', 'src', 'content');
    const files = (await readdir(contentDir, { recursive: true })).filter((file) => /\.(ts|json)$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    const sources = await Promise.all(
      files.map(async (file) => [file, await readFile(join(contentDir, file), 'utf8')] as const),
    );
    const pages = await Promise.all(
      (['/molotes', '/birria'] as const).map(async (path) => [path, (await (await agent()).get(path)).text] as const),
    );
    for (const [where, text] of [...sources, ...pages]) {
      for (const old of OLD_TEXTS) expect(text, `${where}: ${old}`).not.toContain(old);
    }
  });

  // REQ-F-028 sustituye REQ-F-010 D-2: el lunes `/` es Birria con el aviso de descanso; el
  // horario "Lunes: Cerrado" sigue en la landing de Molotes (texto de REQ-F-031, R-22).
  it('CA-5: un lunes a las 10:00 (zona del negocio) / muestra Birria con el aviso de descanso, y /molotes "Lunes: Cerrado"', async () => {
    const client = await agent({ now: MONDAY_10_MX });
    const { text } = await client.get('/');
    expect(text).toContain('data-business="birria"');
    expect(homeNoticeOf(text)).toBe('rest');
    expect(footerHourRows((await client.get('/molotes')).text)).toContainEqual(['Lunes', 'Cerrado']);
  });

  it('CA-5: un sábado / muestra Birria con su horario', async () => {
    const { text } = await (await agent({ now: SATURDAY_NOON_MX })).get('/');
    expect(text).toContain('data-business="birria"');
    expect(footerHourRows(text)).toContainEqual(['Sábados y Domingos:', '08:00 - 15:00']);
  });
});

describe('estáticos', () => {
  it.each([
    ['/js/molotes/main.js', 'text/javascript'],
    ['/js/birria/main.js', 'text/javascript'],
    ['/js/modules/promo-form.js', 'text/javascript'],
    ['/img/molotes/logo-molotes.webp', 'image/webp'],
    ['/img/birria/quesabirria.jpg', 'image/jpeg'],
    ['/img/common/bebidas-aguas-frescas-refrescos.jpg', 'image/jpeg'],
    ['/css/molotes/main.css', 'text/css'],
    ['/css/birria/main.css', 'text/css'],
  ])('sirve %s', async (path, type) => {
    const res = await (await agent()).get(path);
    expect(res.status).toBe(200);
    expect(res.type).toBe(type);
  });

  it('no sirve archivos ocultos ni permite salir de public/', async () => {
    const hidden = await (await agent()).get('/css/.gitkeep');
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('NOT_FOUND');

    const traversal = await (await agent()).get('/..%2Fpackage.json');
    expect(traversal.status).toBe(403);
    expect(traversal.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    expect(traversal.text).not.toContain('"dependencies"');
  });
});

describe('errores', () => {
  it.each(['/no-existe', '/molotes/extra', '/tacos'])('404 con formato común en %s', async (path) => {
    const res = await (await agent()).get(path);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
  });

  it('405 en rutas dedicadas con métodos no permitidos', async () => {
    const res = await (await agent()).delete('/birria');
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('404 con formato { error: { code, message } }', async () => {
    const logger = makeLogger();
    const res = await (await agent({ logger })).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
    expect(logger.warn).toHaveBeenCalledWith('request_error', expect.objectContaining({ status: 404 }));
  });

  it('405 en métodos no permitidos con cabecera Allow', async () => {
    const res = await (await agent()).post('/');
    expect(res.status).toBe(405);
    expect(res.headers.allow).toContain('GET');
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('500 sin detalles internos ni stack fuera de desarrollo, registrando el error en servidor', async () => {
    const logger = makeLogger();
    const now = () => {
      throw new Error('detalle interno secreto');
    };
    const res = await (await agent({ now, logger, config: makeConfig({ NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante' }) })).get('/');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } });
    expect(res.text).not.toContain('secreto');
    expect(logger.error).toHaveBeenCalledWith(
      'request_error',
      expect.objectContaining({ status: 500, err: expect.objectContaining({ message: 'detalle interno secreto' }) }),
    );
  });

  it('incluye el stack solo en desarrollo', async () => {
    const now = () => {
      throw new Error('boom');
    };
    const res = await (await agent({ now, config: makeConfig({ NODE_ENV: 'development' }) })).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error.stack).toContain('boom');
  });
});

describe('landings con productos guardados (REQ-F-001 y REQ-F-008)', () => {
  /** Productos importados desde datos cambiados: equivale a productos guardados con esos valores. */
  async function agentWith(mutate: { businessId: BusinessId; change: (data: CorruptibleData) => unknown }) {
    const repo = await makeRepository();
    const sources = seedSources();
    mutate.change(sources[mutate.businessId].data);
    const { repository: productRepo } = await makeProductRepository({ sources });
    const app = createApp({ config: makeConfig(), repository: repo, products: productRepo, now: () => FRIDAY_NOON_MX });
    return (await listenLocal(app)).request();
  }

  it('CA-1: el precio unitario guardado se muestra en la tarjeta', async () => {
    const client = await agentWith({ businessId: 'molotes', change: (data: CorruptibleData) => (data.menu.items[0].unitPriceCents = 5000) });
    const { text } = await client.get('/molotes');
    const card = text.slice(text.indexOf('>Molotes de Queso Oaxaca<'));
    expect(card.slice(0, 800)).toContain('$50 c/u');
  });

  it('CA-9: una sección sin productos conserva su encabezado y muestra el aviso con el CTA de WhatsApp', async () => {
    const client = await agentWith({
      businessId: 'molotes',
      change: (data: CorruptibleData) => {
        for (const item of data.menu.items) item.available = false;
      },
    });
    const { text } = await client.get('/molotes');
    expect(text).toContain('Menú de Molotes Tradicionales');
    expect(text).not.toMatch(/class="menu-card /);
    const grid = text.slice(text.indexOf('class="menu__grid'), text.indexOf('<!-- BEBIDAS -->'));
    expect(grid).toContain('Por ahora no tenemos productos disponibles en esta sección. Escríbenos por WhatsApp.');
    expect(whatsappHrefs(grid)).toEqual([WA_MOLOTES.replaceAll('&', '&amp;')]);
    // Las bebidas siguen visibles.
    expect(text).toContain('Refrescos Familia Coca-Cola');
  });

  it('CA-9 (birria): sin platillos disponibles muestra el aviso dentro de la sección del menú', async () => {
    const client = await agentWith({
      businessId: 'birria',
      change: (data: CorruptibleData) => {
        for (const item of data.menu.items) item.available = false;
      },
    });
    const { text } = await client.get('/birria');
    const section = text.slice(text.indexOf('id="menu-especialidades"'), text.indexOf('</section>', text.indexOf('id="menu-especialidades"')));
    expect(section).toContain('Menú de Birria El Muñeco');
    expect(section).toContain('Por ahora no tenemos productos disponibles en esta sección. Escríbenos por WhatsApp.');
    expect(section).not.toContain('<article id="card-');
  });

  it('CA-6: una bebida no disponible no aparece en la sección de bebidas', async () => {
    const client = await agentWith({ businessId: 'molotes', change: (data: CorruptibleData) => (data.drinks.items[1].available = false) });
    const { text } = await client.get('/molotes');
    const section = text.slice(text.indexOf('id="bebidas-seccion"'), text.indexOf('<!-- EL RITUAL'));
    expect(section.match(/<li class=/g)).toHaveLength(1);
    expect(section).not.toContain('Refrescos Familia Coca-Cola');
  });
});

describe('archivo dañado al arrancar con el repositorio de archivos (CA-34, CA-35)', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'landing-data-'));
    await mkdir(join(dataDir, 'molotes'), { recursive: true });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  async function start() {
    const repo = createFileMenuRepository({ dataDir, timezone: 'America/Mexico_City' });
    await repo.init();
    const productRepo = await makeProductsFor(repo);
    return (await listenLocal(createApp({ config: makeConfig(), repository: repo, products: productRepo, now: () => FRIDAY_NOON_MX }))).request();
  }

  it('CA-34: con JSON inválido y una versión anterior válida, /molotes responde 200 con la versión anterior', async () => {
    const previous = loadSeedDocument('molotes') as MenuDocument<'molotes'>;
    previous.data.menu.highlight = 'Destacado de la versión anterior';
    await writeFile(join(dataDir, 'molotes', 'previous.json'), JSON.stringify(previous));
    await writeFile(join(dataDir, 'molotes', 'current.json'), '{ roto');

    const res = await (await start()).get('/molotes');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Destacado de la versión anterior');
    expect((await readdir(join(dataDir, 'molotes'))).some((name) => /^damaged-\d{4}-.*\.json$/.test(name))).toBe(true);
  });

  it('CA-35: sin una versión anterior válida, /molotes muestra la semilla', async () => {
    await writeFile(join(dataDir, 'molotes', 'current.json'), '{ roto');
    const res = await (await start()).get('/molotes');
    expect(res.status).toBe(200);
    expect(res.text).toContain((loadSeedDocument('molotes') as MenuDocument<'molotes'>).data.menu.highlight);
  });

  it('CA-4: en una instalación nueva crea los archivos desde la semilla y la landing no cambia', async () => {
    const res = await (await start()).get('/birria');
    expect(res.status).toBe(200);
    expect(JSON.parse(await readFile(join(dataDir, 'birria', 'current.json'), 'utf8'))).toEqual(loadSeedDocument('birria'));
    await expect(res.text).toMatchFileSnapshot('../snapshots/landing-birria.html');
  });
});
