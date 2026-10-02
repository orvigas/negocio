import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { makeConfig } from '../helpers.js';

const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');
const SATURDAY_NOON_MX = new Date('2026-10-10T18:00:00Z');

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function agent({
  now = FRIDAY_NOON_MX,
  config = makeConfig(),
  logger = makeLogger(),
} = {}) {
  const app = createApp({ config, logger, now: typeof now === 'function' ? now : () => now });
  return request(app.callback());
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
function whatsappHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*data-action="whatsapp-order"[^>]*>/g)].map((m) => m[0].match(/href="([^"]+)"/)[1]);
}

describe('GET / (selección automática por día)', () => {
  it('entre semana renderiza Molotes y la canónica apunta a /molotes', async () => {
    const res = await agent({ now: FRIDAY_NOON_MX }).get('/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.text).toContain('data-business="molotes"');
    expect(res.text).toContain(`<title>${PAGES.molotes.title}</title>`);
    expect(res.text).toContain('<link rel="canonical" href="/molotes" />');
  });

  it('en fin de semana renderiza Birria y la canónica apunta a /birria', async () => {
    const res = await agent({ now: SATURDAY_NOON_MX }).get('/');
    expect(res.text).toContain('data-business="birria"');
    expect(res.text).toContain('<link rel="canonical" href="/birria" />');
  });

  it.each([
    ['domingo 23:30', SUNDAY_LATE_MX, 'birria'],
    ['lunes 00:30', MONDAY_EARLY_MX, 'molotes'],
  ])('respeta el cambio de día en la zona del negocio (%s)', async (_label, now, businessId) => {
    const res = await agent({ now }).get('/');
    expect(res.text).toContain(`data-business="${businessId}"`);
  });

  it('decide con la zona horaria del negocio (viernes 23:30 CDMX = sábado UTC)', async () => {
    const now = new Date('2026-10-10T05:30:00Z');
    const mx = await agent({ now }).get('/');
    const utc = await agent({ now, config: makeConfig({ BUSINESS_TIMEZONE: 'UTC' }) }).get('/');
    expect(mx.text).toContain('data-business="molotes"');
    expect(utc.text).toContain('data-business="birria"');
  });

  it('envía cabeceras de seguridad', async () => {
    const res = await agent().get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe.each(Object.keys(PAGES))('GET /%s (ruta dedicada)', (businessId) => {
  const page = PAGES[businessId];

  it.each([
    ['viernes', FRIDAY_NOON_MX],
    ['sábado', SATURDAY_NOON_MX],
  ])('renderiza siempre su landing, sin importar el día (%s)', async (_day, now) => {
    const res = await agent({ now }).get(`/${businessId}`);
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain(`data-business="${businessId}"`);
    expect(res.text).not.toContain(page.other);
  });

  it('incluye SEO básico: title, description, viewport, Open Graph y canónica', async () => {
    const { text } = await agent().get(`/${businessId}`);
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
    const { text } = await agent({ config }).get(`/${businessId}`);
    expect(text).toContain(`<link rel="canonical" href="https://ejemplo.mx/${businessId}" />`);
    expect(text).toContain(`<meta property="og:url" content="https://ejemplo.mx/${businessId}" />`);
    expect(text).toMatch(new RegExp(`<meta property="og:image" content="https://ejemplo\\.mx/img/${businessId}/logo-${businessId}\\.webp" />`));
  });

  it('carga sus propios assets', async () => {
    const { text } = await agent().get(`/${businessId}`);
    expect(text).toContain(`<link rel="stylesheet" href="/css/${businessId}/main.css" />`);
    expect(text).toContain(`<script type="module" src="/js/${businessId}/main.js"></script>`);
    expect(text).toContain(page.fonts);
  });

  it('estructura semántica: un h1, skip link, header, nav, main y footer', async () => {
    const { text } = await agent().get(`/${businessId}`);
    expect(text.match(/<h1\b/g)).toHaveLength(1);
    expect(text).toContain('href="#main-content"');
    expect(text).toContain('<main id="main-content"');
    expect(text).toMatch(/<header\b/);
    expect(text).toMatch(/<nav\b[^>]*aria-label="Principal"/);
    expect(text).toMatch(/<footer\b/);
  });

  it('todos los CTA de pedido usan el enlace de WhatsApp configurado', async () => {
    const { text } = await agent().get(`/${businessId}`);
    const hrefs = whatsappHrefs(text);
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    expect(new Set(hrefs)).toEqual(new Set([page.whatsapp.replaceAll('&', '&amp;')]));
    expect(text).not.toContain('wa.me/525541239080'); // enlace de ejemplo del diseño
  });

  it('usa la URL de WhatsApp configurada (escapada en el atributo)', async () => {
    const env = { [`WHATSAPP_${businessId.toUpperCase()}_URL`]: 'https://example.com/bot?a=1&b=2' };
    const { text } = await agent({ config: makeConfig(env) }).get(`/${businessId}`);
    expect(new Set(whatsappHrefs(text))).toEqual(new Set(['https://example.com/bot?a=1&amp;b=2']));
  });

  it('los enlaces externos abren en otra pestaña con rel seguro', async () => {
    const { text } = await agent().get(`/${businessId}`);
    const blanks = [...text.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
    expect(blanks.length).toBeGreaterThan(0);
    for (const tag of blanks) expect(tag).toContain('rel="noopener noreferrer"');
  });

  it('no usa imágenes remotas, scripts en línea ni enlaces vacíos', async () => {
    const { text } = await agent().get(`/${businessId}`);
    expect(text).not.toMatch(/googleusercontent|cdn\.tailwindcss/);
    expect(text).not.toMatch(/\son[a-z]+="/);
    expect(text).not.toMatch(/<script(?![^>]*type="module" src=)/);
    expect(text).not.toContain('href="#"');
  });

  it('las anclas internas apuntan a secciones existentes', async () => {
    const { text } = await agent().get(`/${businessId}`);
    const ids = new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...text.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) expect(ids.has(anchor), anchor).toBe(true);
  });

  it('todas las imágenes tienen alt, dimensiones y existen en public/', async () => {
    const { text } = await agent().get(`/${businessId}`);
    const imgs = [...text.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThan(5);
    for (const tag of imgs) {
      expect(tag, tag).toMatch(/\salt="[^"]*"/);
      expect(tag, tag).toMatch(/\swidth="\d+" height="\d+"/);
      const src = tag.match(/src="([^"]+)"/)[1];
      const res = await agent().get(src);
      expect(res.status, src).toBe(200);
    }
  });

  it('formulario de promociones accesible enganchado por data-promo-form', async () => {
    const { text } = await agent().get(`/${businessId}`);
    expect(text).toMatch(/<form\b[^>]*data-promo-form/);
    const status = text.match(/data-promo-status="([^"]+)"/)[1];
    expect(text).toMatch(new RegExp(`id="${status}"[^>]*role="status"[^>]*hidden`));
    for (const [, id] of text.matchAll(/<input id="([^"]+)"/g)) {
      expect(text).toContain(`<label class="sr-only" for="${id}">`);
    }
  });
});

describe('GET /birria: contenido del diseño', () => {
  it('renderiza los 6 platillos con selectores de variante accesibles', async () => {
    const { text } = await agent().get('/birria');
    expect(text.match(/<article id="card-/g)).toHaveLength(6);
    expect(text.match(/data-variant-group/g)).toHaveLength(3);
    expect(text).toContain('data-variant-price="price-birriamen" data-variant-description="desc-birriamen"');
    expect(text).toContain('id="price-birriamen"');
    expect(text).toMatch(/aria-pressed="true" data-variant data-price="\$155 MXN"/);
    expect(text).toMatch(/aria-pressed="false" data-variant data-price="\$110 MXN"/);
    expect(text).toContain('Quesabirria con Tortilla de Mano');
  });

  it('enlaza las sucursales a la ubicación común de Google Maps', async () => {
    const { text } = await agent().get('/birria');
    expect(text.match(/href="https:\/\/maps\.app\.goo\.gl\/sAFDEeLdKzs7GGPz9"/g).length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('Matriz San Rafael');
  });
});

describe('GET /molotes: contenido del diseño', () => {
  it('renderiza los 8 molotes con precio individual y por orden', async () => {
    const { text } = await agent().get('/molotes');
    expect(text.match(/class="menu-card /g)).toHaveLength(8);
    expect(text).toContain('Molotes de Huitlacoche con Epazote');
    expect(text).toContain('$50 c/u');
    expect(text).toContain('$145 orden de 3');
  });

  it('renderiza las bebidas de la base dentro de #bebidas-seccion con su icono y tono', async () => {
    const { text } = await agent().get('/molotes');
    const section = text.slice(text.indexOf('id="bebidas-seccion"'), text.indexOf('<!-- EL RITUAL'));
    expect(section.match(/<li class=/g)).toHaveLength(2);
    expect(section).toMatch(/rounded-full bg-secondary-container\/20" aria-hidden="true">\s*<span class="material-symbols-outlined text-2xl text-\[#d97706\]">water_full</);
    expect(section).toMatch(/rounded-full bg-\[#fee2e2\]" aria-hidden="true">\s*<span class="material-symbols-outlined text-2xl text-\[#dc2626\]">sports_bar</);
    expect(section).toContain('Refrescos Familia Coca-Cola');
    expect(section.match(/>\$35 MXN</g)).toHaveLength(2);
  });

  it('el formulario se oculta al enviarse (data-promo-hide-on-success)', async () => {
    const { text } = await agent().get('/molotes');
    expect(text).toMatch(/<form id="promo-form"[^>]*data-promo-hide-on-success/);
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
    const res = await agent().get(path);
    expect(res.status).toBe(200);
    expect(res.type).toBe(type);
  });

  it('no sirve archivos ocultos ni permite salir de public/', async () => {
    const hidden = await agent().get('/css/.gitkeep');
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('NOT_FOUND');

    const traversal = await agent().get('/..%2Fpackage.json');
    expect(traversal.status).toBe(403);
    expect(traversal.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    expect(traversal.text).not.toContain('"dependencies"');
  });
});

describe('errores', () => {
  it.each(['/no-existe', '/molotes/extra', '/tacos'])('404 con formato común en %s', async (path) => {
    const res = await agent().get(path);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
  });

  it('405 en rutas dedicadas con métodos no permitidos', async () => {
    const res = await agent().delete('/birria');
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('404 con formato { error: { code, message } }', async () => {
    const logger = makeLogger();
    const res = await agent({ logger }).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
    expect(logger.warn).toHaveBeenCalledWith('request_error', expect.objectContaining({ status: 404 }));
  });

  it('405 en métodos no permitidos con cabecera Allow', async () => {
    const res = await agent().post('/');
    expect(res.status).toBe(405);
    expect(res.headers.allow).toContain('GET');
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('500 sin detalles internos ni stack fuera de desarrollo, registrando el error en servidor', async () => {
    const logger = makeLogger();
    const now = () => {
      throw new Error('detalle interno secreto');
    };
    const res = await agent({ now, logger, config: makeConfig({ NODE_ENV: 'production' }) }).get('/');

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
    const res = await agent({ now, config: makeConfig({ NODE_ENV: 'development' }) }).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error.stack).toContain('boom');
  });
});
