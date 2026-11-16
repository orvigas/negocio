import { describe, expect, it } from 'vitest';

import { signedIn, textOf } from '../support/bot-page.ts';
import { ANA, ELI, dom, formFields } from '../support/browser.ts';

/**
 * Pantalla del cotizador de taquizas (REQ-F-046) contra el doble de la API: permiso y enlace (CA-22),
 * URL de diferencias (CA-16), restablecer (CA-17), validación accesible (CA-15), mínimo (CA-6), avisos
 * fijos (CA-23), query larga, repetida o desconocida (CA-20), cotizador no disponible (CA-21) y logs sin
 * la query ni los valores (CA-19). Las cifras las prueba la API.
 */

const PATH = '/birria/cotizador';
/** Valor centinela: no debe aparecer en ningún log. */
const SENTINEL = '98765.43';

const navLinks = (html: string) => [...dom(html).querySelectorAll('.admin-header__subnav a')].map((link) => link.textContent?.trim());
const openSections = (html: string) => [...dom(html).querySelectorAll<HTMLDetailsElement>('details.quote-section')].filter((details) => details.open).map((details) => details.id);
const valueOf = (html: string, name: string) => dom(html).querySelector<HTMLInputElement>(`input[name="${name}"]:not([type="radio"])`)?.value;

describe('cotizador: acceso y menú', () => {
  it('un editor recibe 403 y no ve el enlace; un administrador sí; /molotes/cotizador no existe', async () => {
    const editor = await signedIn(ELI);
    const denied = await editor.browser.get(PATH);
    expect(denied.status).toBe(403);
    expect(textOf(await denied.text())).toContain('Solo los administradores pueden usar el cotizador.');
    expect(navLinks(await (await editor.browser.get('/molotes/productos')).text())).not.toContain('Cotizador');
    expect(editor.h.api.requests.some((request) => request.path.includes('/cotizador'))).toBe(false);

    const { browser } = await signedIn(ANA);
    expect(navLinks(await (await browser.get('/birria/productos')).text())).toContain('Cotizador');
    expect(navLinks(await (await browser.get('/molotes/productos')).text())).not.toContain('Cotizador');
    expect((await browser.get('/molotes/cotizador')).status).toBe(404);
  });

  it('sin sesión va al acceso y vuelve al cotizador con la misma query', async () => {
    const { h, browser } = await signedIn(ANA);
    const anonymous = h.browser();
    const query = 'n=60&p.tradicional.f=110';
    const response = await anonymous.get(`${PATH}?${query}`);
    expect(response.status).toBe(303);
    const next = new URL(response.headers.get('location') ?? '', h.url).searchParams.get('next');
    expect(next).toBe(`${PATH}?${query}`);
    const login = await anonymous.login(ANA, next ?? undefined);
    expect(login.headers.get('location')).toBe(`${PATH}?${query}`);
    expect((await browser.get(`${PATH}?${query}`)).status).toBe(200);
  });

  it('con una query larga, el acceso no falla: vuelve con ella si cabe en el formulario de acceso y, si no, sin ella', async () => {
    const { h } = await signedIn(ANA);
    // Codificada en el formulario de acceso, la vuelta mide 43 + 6 por repetición: 492 caben en 3 000; 1 000 no.
    for (const [repeats, kept] of [[492, true], [1000, false]] as const) {
      const anonymous = h.browser();
      const query = `n=60&m.extra=${'1%2C'.repeat(repeats)}`;
      const response = await anonymous.get(`${PATH}?${query}`);
      expect(response.status).toBe(303);
      const next = new URL(response.headers.get('location') ?? '', h.url).searchParams.get('next');
      const expected = kept ? `${PATH}?${query}` : PATH;
      expect(next).toBe(expected);
      const login = await anonymous.login(ANA, next ?? undefined);
      expect(login.status).toBe(303);
      expect(login.headers.get('location')).toBe(expected);
    }
  });
});

describe('cotizador: formulario, URL de diferencias y resultados', () => {
  it('sin query muestra los valores del JSON, las secciones plegadas, los avisos y las marcas provisionales', async () => {
    const { h, browser } = await signedIn(ANA);
    const response = await browser.get(PATH);
    expect(response.status).toBe(200);
    const html = await response.text();
    const text = textOf(html);
    expect(dom(html).querySelector('h1')?.textContent).toBe('Cotizador de taquizas');
    expect(openSections(html)).toEqual([]);
    expect(dom(html).querySelectorAll('details.quote-section')).toHaveLength(5);
    expect(text).toContain('El cálculo no incluye impuestos, comisiones de cobro, renta, depreciación ni transporte extraordinario.');
    expect(text).toContain('Cambiar la composición de un paquete no cambia su tarifa');
    expect(dom(html).querySelector('label[for="q-i.masa.costo"]')?.textContent).toContain('provisional');
    expect(dom(html).querySelector('label[for="q-i.carne-res.costo"]')?.textContent).not.toContain('provisional');
    expect(text).not.toContain('modificado');
    expect(valueOf(html, 'i.carne-res.costo')).toBe('170');
    expect(dom(html).querySelector<HTMLInputElement>('input[name="p.mixto-1.on"][value="1"]')?.checked).toBe(true);
    expect(dom(html).querySelector('#quote-form')?.getAttribute('method')).toBe('get');
    expect(dom(html).querySelector('.quote-results')).toBeNull();
    expect(h.api.quote.calculations).toHaveLength(0);
  });

  it('"Calcular" redirige a la URL con N y solo las diferencias; esa URL calcula y marca lo modificado (CA-16)', async () => {
    const { h, browser } = await signedIn(ANA);
    const fields = formFields(await (await browser.get(PATH)).text(), '#quote-form');
    fields.n = ' 60 ';
    fields['i.carne-res.costo'] = '170.00'; // Igual al JSON: no viaja.
    fields['cb.horas'] = '9,5'; // Coma decimal: viaja con punto.
    fields['p.tradicional.q.consome-500'] = '0';
    fields['p.mixto-1.on'] = '0';
    const submitted = await browser.get(`${PATH}?${new URLSearchParams(fields).toString()}`);
    expect(submitted.status).toBe(303);
    const location = submitted.headers.get('location') ?? '';
    expect(location).toBe(`${PATH}?n=60&p.tradicional.q.consome-500=0&p.mixto-1.on=0&cb.horas=9.5`);
    expect(h.api.quote.calculations).toHaveLength(0);

    const response = await browser.get(location);
    expect(response.status).toBe(200);
    const html = await response.text();
    const text = textOf(html);
    expect(h.api.quote.calculations).toEqual([{ personas: '60', ajustes: { 'p.tradicional.q.consome-500': '0', 'p.mixto-1.on': '0', 'cb.horas': '9.5' } }]);
    expect(text).toContain('Resultado para 60 personas');
    expect(text).toContain('$134 por persona');
    expect(text).toContain('$19 más caro que la carta');
    expect([...dom(html).querySelectorAll('.quote-package__name')].map((name) => name.textContent)).toEqual(['Tradicional']);
    expect(openSections(html)).toEqual(['seccion-paquetes', 'seccion-costos']);
    expect(dom(html).querySelector('label[for="q-cb.horas"]')?.textContent).toContain('modificado');
    expect(dom(html).querySelector('label[for="q-i.carne-res.costo"]')?.textContent).not.toContain('modificado');
    expect(dom(html).querySelector<HTMLInputElement>('input[name="p.mixto-1.on"][value="0"]')?.checked).toBe(true);
    expect(dom(html).querySelector('caption')?.textContent).toContain('margen real');
    // Restablecer conserva N y vuelve a los valores del JSON (CA-17).
    const reset = dom(html).querySelector<HTMLAnchorElement>('.quote-form__reset')?.getAttribute('href');
    expect(reset).toBe(`${PATH}?n=60`);
    const restored = await (await browser.get(reset ?? '')).text();
    expect(textOf(restored)).not.toContain('modificado');
    expect(valueOf(restored, 'cb.horas')).toBe('4.5');
    expect(valueOf(restored, 'n')).toBe('60');
  });

  it('con margen al 50 % indica que mandó el margen; por debajo del mínimo no hay precios (CA-6 y CA-10)', async () => {
    const { browser } = await signedIn(ANA);
    expect(textOf(await (await browser.get(`${PATH}?n=60&po.margen=50`)).text())).toContain('Mandó el margen objetivo');
    const below = await (await browser.get(`${PATH}?n=29`)).text();
    expect(textOf(below)).toContain('El mínimo es 30 personas');
    expect(dom(below).querySelectorAll('.quote-package__price')).toHaveLength(2);
    for (const price of dom(below).querySelectorAll('.quote-package__price')) expect(price.textContent).toContain('Sin precio');
  });
});

describe('cotizador: validación y rechazos', () => {
  it('un 422 pinta el resumen enlazado, el error junto al campo y lo escrito, sin resultados (CA-15)', async () => {
    const { browser } = await signedIn(ANA);
    const response = await browser.get(`${PATH}?n=abc&p.tradicional.f=120&i.masa.costo=texto`);
    expect(response.status).toBe(422);
    const html = await response.text();
    const page = dom(html);
    const summary = page.querySelector('main .notice[role="alert"]');
    expect(summary?.textContent).toContain('No se calculó nada');
    const links = [...(summary?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href'));
    expect(links).toEqual(['#q-n', '#q-p.tradicional.f', '#q-i.masa.costo']);
    const floor = page.querySelector<HTMLInputElement>('#q-p\\.tradicional\\.f');
    expect(floor?.getAttribute('aria-invalid')).toBe('true');
    expect(floor?.getAttribute('aria-describedby')).toContain('q-p.tradicional.f-error');
    expect(page.getElementById('q-p.tradicional.f-error')?.textContent).toContain('debe ser menor que la tarifa en la referencia b');
    expect(floor?.value).toBe('120');
    expect(valueOf(html, 'i.masa.costo')).toBe('texto');
    expect(valueOf(html, 'n')).toBe('abc');
    expect(openSections(html)).toEqual(['seccion-paquetes', 'seccion-insumos']);
    expect(page.querySelector('.quote-results')).toBeNull();
  });

  it('una query de más de 8 KiB, repetida o desconocida da un aviso sin cálculo; los logs no llevan la query (CA-19 y CA-20)', async () => {
    const { h, browser } = await signedIn(ANA);
    const long = await browser.get(`${PATH}?n=60&fe.mano-obra=${SENTINEL}&c.taco=${'1'.repeat(8200)}`);
    expect(long.status).toBe(200);
    expect(textOf(await long.text())).toContain('La configuración es demasiado larga; restablece los valores.');
    const repeated = await (await browser.get(`${PATH}?n=60&fe.mano-obra=${SENTINEL}&fe.mano-obra=1`)).text();
    expect(textOf(repeated)).toContain('El enlace tiene campos repetidos; restablece los valores.');
    const unknown = await (await browser.get(`${PATH}?n=60&p.borrado.a=${SENTINEL}`)).text();
    expect(textOf(unknown)).toContain('El enlace tiene campos que ya no existen; restablece los valores.');
    expect(dom(unknown).querySelector('main .notice a')?.getAttribute('href')).toBe(`${PATH}?n=60`);
    expect(h.api.quote.calculations).toHaveLength(0);

    // Un cálculo aceptado y uno rechazado por la API, con el centinela.
    expect((await browser.get(`${PATH}?n=60&fe.mano-obra=${SENTINEL}`)).status).toBe(200);
    expect((await browser.get(`${PATH}?n=60&fe.mano-obra=${SENTINEL}&p.tradicional.f=999`)).status).toBe(422);
    const logs = h.logger.lines.join('\n');
    expect(logs).toContain('"quote_rejected"');
    for (const secret of [SENTINEL, 'fe.mano-obra', 'p.borrado', 'n=60', '?']) expect(logs).not.toContain(secret);
  });

  it('con el JSON del cotizador inválido muestra "Cotizador no disponible" sin detalles (CA-21)', async () => {
    const { h, browser } = await signedIn(ANA);
    h.api.quote.available = false;
    const response = await browser.get(`${PATH}?n=60`);
    expect(response.status).toBe(503);
    const text = textOf(await response.text());
    expect(text).toContain('Cotizador no disponible.');
    expect(text).not.toContain('QUOTE_UNAVAILABLE');
  });
});
