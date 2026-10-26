// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { BUSINESS_PATHS } from '../../src/config/businesses.ts';
import { birriaContent } from '../../src/content/birria/index.ts';
import { molotesContent } from '../../src/content/molotes/index.ts';
import type { HomeNotice, MolotesNotice } from '../../src/services/business-schedule.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { withNoticeHref } from '../../src/views/landings/shared.ts';
import { createRenderer } from '../../src/views/render.ts';
import { initHomeNotice } from '../../public/js/modules/home-notice.js';
import { makeConfig, seedData } from '../helpers.ts';

/**
 * Aviso de la página de inicio (REQ-F-028) y de /molotes (REQ-F-034): marcado del servidor y
 * módulo public/js/modules/home-notice.js sobre el HTML real de Birria y de Molotes.
 * jsdom no implementa showModal/close de <dialog>: se simulan con el atributo `open`.
 */
const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

function load(html: string) {
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, 'text/html').documentElement.innerHTML;
  window.scrollTo = () => {};
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
}

/** `/` con su aviso (o `/birria` con null). */
function mount(homeNotice: HomeNotice | null) {
  load(renderLandingPage({ renderer, config: makeConfig(), businessId: 'birria', menu: seedData('birria'), homeNotice }).toString());
}

function molotesHtml(homeNotice?: MolotesNotice | null) {
  return renderLandingPage({ renderer, config: makeConfig(), businessId: 'molotes', menu: seedData('molotes'), homeNotice }).toString();
}

/** `/molotes` con su aviso (REQ-F-034). */
function mountMolotes(homeNotice: MolotesNotice | null) {
  load(molotesHtml(homeNotice));
}

const dialog = () => document.querySelector<HTMLDialogElement>('dialog[data-home-notice]');

describe('marcado del aviso (servidor)', () => {
  it('CA-2: "Molotes" con los textos del contenido y un único enlace (logo + texto) a /molotes', () => {
    mount('molotes');
    const notice = birriaContent.homeNotices.molotes;
    const el = dialog()!;
    expect(el.dataset.homeNotice).toBe('molotes');
    expect(el.hasAttribute('open')).toBe(false);
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)!.textContent).toBe(notice.title);
    expect(el.textContent).toContain(notice.body);

    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.getAttribute('href')).toBe('/molotes');
    expect(link.textContent.trim()).toBe('¡Ordenar ya!');
    const img = link.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/img/molotes/logo-molotes.webp');
    expect(img.getAttribute('alt')).toBe('Molotes');
    expect(img.getAttribute('alt')).not.toContain('Ordenar');

    const close = el.querySelector('button[data-action="close-home-notice"]')!;
    expect(close.getAttribute('type')).toBe('button');
    expect(close.textContent).toBe('Cerrar');
  });

  it('CA-3: "Descanso" con el enlace "Mañana hay molotes" a /molotes y el botón Cerrar', () => {
    mount('rest');
    const notice = birriaContent.homeNotices.rest;
    const el = dialog()!;
    expect(el.dataset.homeNotice).toBe('rest');
    expect(document.getElementById('home-notice-title')!.textContent).toBe('¡Los lunes descansamos!');
    expect(el.textContent).toContain(notice.body);
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('/molotes');
    expect(links[0]!.textContent).toBe('Mañana hay molotes');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-action="close-home-notice"]')!.textContent).toBe('Cerrar');
  });

  it('CA-1: sin aviso no hay <dialog> y el resto de la página no cambia', () => {
    const without = renderLandingPage({ renderer, config: makeConfig(), businessId: 'birria', menu: seedData('birria') }).toString();
    const rest = renderLandingPage({ renderer, config: makeConfig(), businessId: 'birria', menu: seedData('birria'), homeNotice: 'rest' }).toString();
    expect(without).not.toContain('<dialog');
    expect(rest.replace(/<dialog\b[\s\S]*<\/dialog>\n?/, '')).toBe(without);
  });

  it('REQ-F-034, RT-3: Birria sin aviso (/birria) no pinta ningún <dialog>', () => {
    mount(null);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('REQ-F-034: un aviso de / que no es de Molotes falla rápido en /molotes', () => {
    // @ts-expect-error: aviso "molotes" (de /) en la landing de Molotes, a propósito.
    expect(() => molotesHtml('molotes')).toThrow(/Aviso desconocido/);
  });

  it('CA-12: los textos no están en las plantillas ni en el JS (salen del contenido)', () => {
    const files = [
      join(DEFAULT_VIEWS_DIR, 'partials/birria/home-notice.html'),
      join(DEFAULT_VIEWS_DIR, 'partials/birria/home-notice-molotes-action.html'),
      join(DEFAULT_VIEWS_DIR, 'partials/birria/home-notice-rest-action.html'),
      join(DEFAULT_VIEWS_DIR, '../../public/js/modules/home-notice.js'),
    ].map((file) => readFileSync(file, 'utf8'));
    for (const notice of Object.values(birriaContent.homeNotices)) {
      for (const text of [notice.title, notice.body, notice.linkLabel, notice.closeLabel, BUSINESS_PATHS[notice.business]]) {
        for (const file of files) expect(file).not.toContain(text);
      }
    }
  });

  it('escapa los textos del contenido', () => {
    const notice = { ...withNoticeHref(birriaContent.homeNotices.rest), title: '<script>x</script>', body: '"a" & <b>' };
    const html = renderer
      .render('partials/birria/home-notice', {
        variant: 'rest',
        notice,
        action: renderer.render('partials/birria/home-notice-rest-action', { notice }),
      })
      .toString();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('&quot;a&quot; &amp; &lt;b&gt;');
  });
});

describe('initHomeNotice (public/js/modules/home-notice.js)', () => {
  let dispose: (() => void) | undefined;
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;

  beforeEach(() => {
    sessionStorage.clear();
    proto.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    proto.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    delete proto.showModal;
    delete proto.close;
    vi.restoreAllMocks();
  });

  it('CA-2, CA-3: abre el aviso al cargar y lo marca como visto en cuanto se muestra (RN-6)', () => {
    mount('molotes');
    dispose = initHomeNotice();
    expect(dialog()!.open).toBe(true);
    expect(sessionStorage.getItem('homeNotice:molotes:seen')).toBe('1');
  });

  it('CA-5: "Cerrar" lo cierra', () => {
    mount('rest');
    dispose = initHomeNotice();
    document.querySelector<HTMLButtonElement>('[data-action="close-home-notice"]')!.click();
    expect(dialog()!.open).toBe(false);
  });

  it('CA-7: no vuelve a abrirse en la misma sesión', () => {
    mount('molotes');
    dispose = initHomeNotice();
    dispose();
    mount('molotes');
    dispose = initHomeNotice();
    expect(dialog()!.open).toBe(false);
    expect(proto.showModal).toHaveBeenCalledTimes(1);
  });

  it('RN-5: la marca es distinta por aviso (visto el del lunes, el del martes sí sale)', () => {
    mount('rest');
    dispose = initHomeNotice();
    dispose();
    mount('molotes');
    dispose = initHomeNotice();
    expect(dialog()!.open).toBe(true);
  });

  it('CA-8: si sessionStorage falla, se muestra igual, sin errores, y se puede cerrar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });
    mount('molotes');
    expect(() => (dispose = initHomeNotice())).not.toThrow();
    expect(dialog()!.open).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-action="close-home-notice"]')!.click();
    expect(dialog()!.open).toBe(false);
  });

  it('CA-8: si acceder a sessionStorage lanza, se muestra igual', () => {
    mount('rest');
    const win = new Proxy(window, {
      get(target, key) {
        if (key === 'sessionStorage') throw new DOMException('bloqueado', 'SecurityError');
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
    expect(() => (dispose = initHomeNotice({ win }))).not.toThrow();
    expect(dialog()!.open).toBe(true);
  });

  it('RN-6, CA-7: al salir de la página (pagehide) se cierra, para que "atrás" no lo muestre abierto', () => {
    mount('molotes');
    dispose = initHomeNotice();
    window.dispatchEvent(new Event('pagehide'));
    expect(dialog()!.open).toBe(false);
  });

  it('D-T4: no se abre ni se marca si la persona ya desplazó la página', () => {
    mount('molotes');
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    dispose = initHomeNotice();
    expect(dialog()!.open).toBe(false);
    expect(sessionStorage.getItem('homeNotice:molotes:seen')).toBeNull();
  });

  it('D-T4: no se abre si la persona ya movió el foco', () => {
    mount('rest');
    document.querySelector<HTMLAnchorElement>('a[href]')!.focus();
    dispose = initHomeNotice();
    expect(dialog()!.open).toBe(false);
  });

  it('CA-1, CA-4: sin aviso en la página no hace nada', () => {
    mount(null);
    expect(() => (dispose = initHomeNotice())).not.toThrow();
    expect(proto.showModal).not.toHaveBeenCalled();
  });

  it('sin soporte de <dialog> (showModal) no hace nada: la página ya está completa', () => {
    delete proto.showModal;
    mount('molotes');
    expect(() => (dispose = initHomeNotice())).not.toThrow();
    expect(dialog()!.open).toBe(false);
    expect(sessionStorage.getItem('homeNotice:molotes:seen')).toBeNull();
  });

  describe('/molotes (REQ-F-034)', () => {
    it('CA-1: abre el aviso de fin de semana y lo marca con su propia clave', () => {
      mountMolotes('weekend');
      dispose = initHomeNotice();
      expect(dialog()!.open).toBe(true);
      expect(sessionStorage.getItem('homeNotice:weekend:seen')).toBe('1');
    });

    it.each([
      ['weekend', 'Quedarme en Molotes'],
      ['rest', 'Ver el menú'],
    ] as const)('CA-4: en el aviso %s, "%s" lo cierra', (variant, label) => {
      mountMolotes(variant);
      dispose = initHomeNotice();
      const close = document.querySelector<HTMLButtonElement>('[data-action="close-home-notice"]')!;
      expect(close.textContent).toBe(label);
      close.click();
      expect(dialog()!.open).toBe(false);
    });

    it.each(['weekend', 'rest'] as const)('CA-5: recargar /molotes en la misma sesión no reabre el aviso %s', (variant) => {
      mountMolotes(variant);
      dispose = initHomeNotice();
      dispose();
      mountMolotes(variant);
      dispose = initHomeNotice();
      expect(dialog()!.open).toBe(false);
      expect(proto.showModal).toHaveBeenCalledTimes(1);
    });

    it('CA-5: el descanso visto en / no se repite en /molotes', () => {
      mount('rest');
      dispose = initHomeNotice();
      dispose();
      mountMolotes('rest');
      dispose = initHomeNotice();
      expect(dialog()!.open).toBe(false);
    });

    it('CA-5: el descanso visto en /molotes no se repite en /', () => {
      mountMolotes('rest');
      dispose = initHomeNotice();
      dispose();
      mount('rest');
      dispose = initHomeNotice();
      expect(dialog()!.open).toBe(false);
    });

    it('CA-5: haber visto el aviso "Molotes" de / no impide el de fin de semana', () => {
      mount('molotes');
      dispose = initHomeNotice();
      dispose();
      mountMolotes('weekend');
      dispose = initHomeNotice();
      expect(dialog()!.open).toBe(true);
    });

    it('CA-6: si sessionStorage falla, el aviso de fin de semana se muestra y se puede cerrar', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('lleno', 'QuotaExceededError');
      });
      mountMolotes('weekend');
      expect(() => (dispose = initHomeNotice())).not.toThrow();
      expect(dialog()!.open).toBe(true);
      document.querySelector<HTMLButtonElement>('[data-action="close-home-notice"]')!.click();
      expect(dialog()!.open).toBe(false);
    });

    it('R-4: se cierra en pagehide', () => {
      mountMolotes('weekend');
      dispose = initHomeNotice();
      window.dispatchEvent(new Event('pagehide'));
      expect(dialog()!.open).toBe(false);
    });

    it('CA-2: entre semana no hay aviso y el módulo no hace nada', () => {
      mountMolotes(null);
      expect(() => (dispose = initHomeNotice())).not.toThrow();
      expect(proto.showModal).not.toHaveBeenCalled();
    });
  });
});

describe('marcado del aviso de /molotes (servidor, REQ-F-034)', () => {
  it('CA-1: fin de semana con los textos de R-2, un enlace a /birria con el emblema decorativo y "Quedarme en Molotes"', () => {
    mountMolotes('weekend');
    const notice = molotesContent.notices.weekend;
    const el = dialog()!;
    expect(el.dataset.homeNotice).toBe('weekend');
    expect(el.hasAttribute('open')).toBe(false);
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)!.textContent).toBe('¡Raza, hoy toca birria!');
    expect(el.querySelector('p')!.textContent).toBe(
      '¡Qué bueno que se te antojaron unos molotes! Los nuestros son de estilo poblano y te esperan de martes a viernes. Pero no te vayas con el antojo: este fin de semana nos ponemos bien birrieros con Birria El Muñeco. ¡Échale un ojo al menú y descubre qué se te antoja hoy!',
    );
    expect(notice.title).toBe('¡Raza, hoy toca birria!');

    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.getAttribute('href')).toBe('/birria');
    expect(link.textContent.trim()).toBe('Ver Birria El Muñeco');
    const img = link.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/img/birria/logo-birria.webp');
    expect(img.getAttribute('alt')).toBe('');

    const buttons = el.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute('type')).toBe('button');
    expect(buttons[0]!.dataset.action).toBe('close-home-notice');
    expect(buttons[0]!.textContent).toBe('Quedarme en Molotes');
  });

  it('CA-2: lunes con los textos de R-3 y un único botón "Ver el menú", sin enlaces', () => {
    mountMolotes('rest');
    const el = dialog()!;
    expect(el.dataset.homeNotice).toBe('rest');
    expect(el.hasAttribute('open')).toBe(false);
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)!.textContent).toBe('¡Los lunes descansamos!');
    expect(el.querySelector('p')!.textContent).toBe(
      'Hoy el comal agarra fuerzas. Mañana martes volvemos con molotes estilo poblano recién hechecitos. Mientras, échale un ojo al menú y ve escogiendo tu antojo.',
    );
    expect(el.querySelectorAll('a')).toHaveLength(0);
    expect(el.querySelector('img')).toBeNull();
    const buttons = el.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.dataset.action).toBe('close-home-notice');
    expect(buttons[0]!.textContent).toBe('Ver el menú');
  });

  it('CA-2, CA-6: sin aviso no hay <dialog> y el resto de la página no cambia (sin JS se consulta igual)', () => {
    const without = molotesHtml();
    expect(without).not.toContain('<dialog');
    expect(molotesHtml(null)).toBe(without);
    for (const variant of ['weekend', 'rest'] as const) {
      const html = molotesHtml(variant);
      expect(html.match(/<dialog\b/g)).toHaveLength(1);
      expect(html.replace(/<dialog\b[\s\S]*<\/dialog>\n?/, '')).toBe(without);
    }
  });

  it('los textos no están en las plantillas ni en el JS (salen del contenido)', () => {
    const files = [
      join(DEFAULT_VIEWS_DIR, 'partials/molotes/notice.html'),
      join(DEFAULT_VIEWS_DIR, 'partials/molotes/notice-weekend-action.html'),
      join(DEFAULT_VIEWS_DIR, 'pages/molotes.html'),
      join(DEFAULT_VIEWS_DIR, '../../public/js/modules/home-notice.js'),
      join(DEFAULT_VIEWS_DIR, '../../public/js/molotes/main.js'),
    ].map((file) => readFileSync(file, 'utf8'));
    const { weekend, rest } = molotesContent.notices;
    for (const text of [weekend.title, weekend.body, weekend.linkLabel, weekend.closeLabel, BUSINESS_PATHS[weekend.business], rest.title, rest.body, rest.closeLabel]) {
      for (const file of files) expect(file).not.toContain(text);
    }
  });

  it('escapa los textos del contenido', () => {
    const notice = { ...molotesContent.notices.rest, title: '<script>x</script>', body: '"a" & <b>' };
    const html = renderer.render('partials/molotes/notice', { variant: 'rest', notice, action: renderer.join([]), closeClass: '' }).toString();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('&quot;a&quot; &amp; &lt;b&gt;');
  });
});
