import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.ts';
import type { BusinessId } from '../../src/config/businesses.ts';
import type { Config } from '../../src/config/env.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import { createFileMenuRepository } from '../../src/repositories/file-menu-repository.ts';
import type { MenuDocument } from '../../src/services/menu-schema.ts';
import type { Logger } from '../../src/utils/logger.ts';
import { makeConfig, makeRepository, type CorruptibleData } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';

const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');
const SATURDAY_NOON_MX = new Date('2026-10-10T18:00:00Z');

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const repository = await makeRepository();

async function agent({
  now = FRIDAY_NOON_MX,
  config = makeConfig(),
  logger = makeLogger(),
}: { now?: Date | (() => Date); config?: Config; logger?: Logger } = {}) {
  const app = createApp({ config, repository, logger, now: typeof now === 'function' ? now : () => now });
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
    other: 'Birriería',
  },
  birria: {
    title: 'Birriería El Muñeco | Auténtica Birria de Res',
    whatsapp: WA_BIRRIA,
    fonts: 'family=Plus+Jakarta+Sans',
    other: 'Moloteando',
  },
};

/** Todos los href de enlaces que abren WhatsApp (data-action="whatsapp-order"). */
function whatsappHrefs(html: string) {
  return [...html.matchAll(/<a\b[^>]*data-action="whatsapp-order"[^>]*>/g)].map((m) => m[0].match(/href="([^"]+)"/)![1]);
}

describe('GET / (selección automática por día)', () => {
  it('entre semana renderiza Molotes y la canónica apunta a /molotes', async () => {
    const res = await (await agent({ now: FRIDAY_NOON_MX })).get('/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.text).toContain('data-business="molotes"');
    expect(res.text).toContain(`<title>${PAGES.molotes.title}</title>`);
    expect(res.text).toContain('<link rel="canonical" href="/molotes" />');
  });

  it('en fin de semana renderiza Birria y la canónica apunta a /birria', async () => {
    const res = await (await agent({ now: SATURDAY_NOON_MX })).get('/');
    expect(res.text).toContain('data-business="birria"');
    expect(res.text).toContain('<link rel="canonical" href="/birria" />');
  });

  it.each([
    ['domingo 23:30', SUNDAY_LATE_MX, 'birria'],
    ['lunes 00:30', MONDAY_EARLY_MX, 'molotes'],
  ])('respeta el cambio de día en la zona del negocio (%s)', async (_label, now, businessId) => {
    const res = await (await agent({ now })).get('/');
    expect(res.text).toContain(`data-business="${businessId}"`);
  });

  it('decide con la zona horaria del negocio (viernes 23:30 CDMX = sábado UTC)', async () => {
    const now = new Date('2026-10-10T05:30:00Z');
    const mx = await (await agent({ now })).get('/');
    const utc = await (await agent({ now, config: makeConfig({ BUSINESS_TIMEZONE: 'UTC' }) })).get('/');
    expect(mx.text).toContain('data-business="molotes"');
    expect(utc.text).toContain('data-business="birria"');
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

  it('enlaza las sucursales a la ubicación común de Google Maps', async () => {
    const { text } = await (await agent()).get('/birria');
    expect(text.match(/href="https:\/\/maps\.app\.goo\.gl\/sAFDEeLdKzs7GGPz9"/g)!.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('Matriz San Rafael');
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
      '>* Lunes cerramos comales por molienda de nixtamal artesanal y curación de cazuelas. Sábados y domingos te esperamos en Birria El Muñeco.<',
    );
    expect(footerHourRows(text)).toEqual([
      ['Martes a Viernes', '08:30 - 15:00'],
      ['Sábado y Domingo', 'Cerrado'],
      ['Lunes', 'Cerrado por nixtamal'],
    ]);
  });

  it('CA-2: /birria publica exactamente los textos de D-8', async () => {
    const { text } = await (await agent()).get('/birria');
    expect(birriaScheduleCard(text)).toEqual([
      'Sábado y Domingo',
      '08:00 AM – 03:00 PM',
      'Consomé matutino y quesabirrias crujientes.',
      'Lunes a Viernes',
      'Cerrado',
      'Reposo y Adobo.',
    ]);
    expect(footerHourRows(text)).toEqual([
      ['Miércoles - Viernes:', 'Cerrado'],
      ['Sábados y Domingos:', '08:00 - 15:00'],
      ['Lunes y Martes:', 'Reposo y Adobo'],
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

  it('CA-5: un lunes a las 10:00 (zona del negocio) / muestra Molotes con "Lunes: Cerrado por nixtamal"', async () => {
    const { text } = await (await agent({ now: MONDAY_10_MX })).get('/');
    expect(text).toContain('data-business="molotes"');
    expect(footerHourRows(text)).toContainEqual(['Lunes', 'Cerrado por nixtamal']);
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

describe('landings con datos editables (REQ-F-001)', () => {
  async function agentWith(mutate: { businessId: BusinessId; change: (data: CorruptibleData) => unknown }) {
    const repo = await makeRepository();
    const { version } = await repo.getForEdit(mutate.businessId);
    const data = structuredClone((await repo.getPublished(mutate.businessId)).data);
    mutate.change(data);
    await repo.save(mutate.businessId, { data, expectedVersion: version, author: { id: 1, name: 'Pruebas' } });
    const app = createApp({ config: makeConfig(), repository: repo, now: () => FRIDAY_NOON_MX });
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
    expect(section).toContain('Nuestro Menú de Birria Artesanal');
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
    return (await listenLocal(createApp({ config: makeConfig(), repository: repo, now: () => FRIDAY_NOON_MX }))).request();
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
