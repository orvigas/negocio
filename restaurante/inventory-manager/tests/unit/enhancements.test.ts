// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initReorder } from '../../public/js/modules/reorder.js';
import { initSubmitGuard } from '../../public/js/modules/submit-guard.js';

/**
 * Mejoras con JavaScript del admin nuevo (REQ-F-039, RF-8 y casos límite "Doble envío" y "Conexión
 * lenta"): sin ellas todo funciona igual.
 */

const disposers: (() => void)[] = [];
afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('submit-guard', () => {
  it('marca el botón como ocupado, no duplica su valor y bloquea el segundo envío', async () => {
    document.body.innerHTML = `<form data-submit-guard action="/x" method="post"><button type="submit" name="action" value="update" data-busy-text="Guardando…">Guardar</button></form>`;
    disposers.push(initSubmitGuard(document));
    const form = document.querySelector('form')!;
    const button = document.querySelector('button')!;
    // Evita la navegación de jsdom después de que actúe el listener delegado (en window, al final).
    const stop = (event: Event) => event.preventDefault();
    window.addEventListener('submit', stop);
    disposers.push(() => window.removeEventListener('submit', stop));
    const first = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button });
    form.dispatchEvent(first);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toBe('Guardando…');
    // No duplica el valor del botón (DEF-006): el navegador ya lo envía.
    expect(form.querySelector('input[type="hidden"][name="action"]')).toBeNull();
    expect(new FormData(form, button).getAll('action')).toEqual(['update']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.disabled).toBe(true);
    const second = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button });
    form.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(true);
  });
});

describe('reorder', () => {
  const LIST = (first: string, second: string) => `
    <ol>
      <li data-product-row="${first === 'A' ? 1 : 2}"><p class="product-row__name"><span>1.</span> ${first}</p>
        <form data-reorder action="/molotes/productos/${first === 'A' ? 1 : 2}/bajar" method="post"><input type="hidden" name="version" value="1" />
        <button data-reorder-button="down" data-product-id="${first === 'A' ? 1 : 2}">Bajar</button></form></li>
      <li data-product-row="${second === 'A' ? 1 : 2}"><p class="product-row__name"><span>2.</span> ${second}</p>
        <form data-reorder action="/molotes/productos/${second === 'A' ? 1 : 2}/subir" method="post"><input type="hidden" name="version" value="1" />
        <button data-reorder-button="up" data-product-id="${second === 'A' ? 1 : 2}">Subir</button></form></li>
    </ol>`;

  it('envía con X-Fragment, reemplaza la lista, mantiene el foco en el producto movido y anuncia su posición', async () => {
    document.body.innerHTML = `<div data-product-list>${LIST('A', 'B')}</div><p role="status" aria-live="polite" data-reorder-status></p>`;
    const fetch = vi.fn(async () => new Response(LIST('B', 'A'), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    disposers.push(initReorder(document));
    const form = document.querySelector<HTMLFormElement>('form[action$="/2/subir"]')!;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('[data-reorder-status]')?.textContent).toBe('B: posición 1 de 2'));
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('x-fragment')).toBe('product-list');
    expect(document.activeElement?.getAttribute('data-product-id')).toBe('2');
    expect(document.querySelector('[data-product-list] li')?.getAttribute('data-product-row')).toBe('2');
  });

  it('con 409 reemplaza la lista y avisa que no se movió nada', async () => {
    document.body.innerHTML = `<div data-product-list>${LIST('A', 'B')}</div><p data-reorder-status></p>`;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(LIST('A', 'B'), { status: 409 })));
    disposers.push(initReorder(document));
    document.querySelector<HTMLFormElement>('form[action$="/2/subir"]')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('[data-reorder-status]')?.textContent).toContain('no se movió nada'));
  });

  it('si la petición falla, envía el formulario de forma normal', async () => {
    document.body.innerHTML = `<div data-product-list>${LIST('A', 'B')}</div>`;
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('red'))));
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    disposers.push(initReorder(document));
    const form = document.querySelector<HTMLFormElement>('form[action$="/2/subir"]')!;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(submit).toHaveBeenCalled());
    expect(form.hasAttribute('data-reorder')).toBe(false);
  });
});
