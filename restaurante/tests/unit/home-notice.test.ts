// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { birriaContent } from '../../src/content/birria/index.ts';
import type { HomeNotice } from '../../src/services/business-schedule.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { createRenderer } from '../../src/views/render.ts';
import { initHomeNotice } from '../../public/js/modules/home-notice.js';
import { makeConfig, seedData } from '../helpers.ts';

/**
 * Aviso de la página de inicio (REQ-F-028): marcado del servidor y módulo
 * public/js/modules/home-notice.js sobre el HTML real de Birria.
 * jsdom no implementa showModal/close de <dialog>: se simulan con el atributo `open`.
 */
const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

function mount(homeNotice: HomeNotice | null) {
  const html = renderLandingPage({ renderer, config: makeConfig(), businessId: 'birria', menu: seedData('birria'), homeNotice }).toString();
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, 'text/html').documentElement.innerHTML;
  window.scrollTo = () => {};
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
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

  it('Molotes nunca pinta el aviso', () => {
    const html = renderLandingPage({ renderer, config: makeConfig(), businessId: 'molotes', menu: seedData('molotes'), homeNotice: 'molotes' }).toString();
    expect(html).not.toContain('<dialog');
  });

  it('CA-12: los textos no están en las plantillas ni en el JS (salen del contenido)', () => {
    const files = [
      join(DEFAULT_VIEWS_DIR, 'partials/birria/home-notice.html'),
      join(DEFAULT_VIEWS_DIR, 'partials/birria/home-notice-molotes-action.html'),
      join(DEFAULT_VIEWS_DIR, 'partials/birria/home-notice-rest-action.html'),
      join(DEFAULT_VIEWS_DIR, '../../public/js/modules/home-notice.js'),
    ].map((file) => readFileSync(file, 'utf8'));
    for (const notice of Object.values(birriaContent.homeNotices)) {
      for (const text of [notice.title, notice.body, notice.linkLabel, notice.closeLabel, notice.linkHref]) {
        for (const file of files) expect(file).not.toContain(text);
      }
    }
  });

  it('escapa los textos del contenido', () => {
    const notice = { ...birriaContent.homeNotices.rest, title: '<script>x</script>', body: '"a" & <b>' };
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
});
