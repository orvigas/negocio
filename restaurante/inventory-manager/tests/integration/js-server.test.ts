// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { initSubmitGuard } from '../../public/js/modules/submit-guard.js';
import { product } from '../support/api-double.ts';
import { ELI, startInventory } from '../support/browser.ts';

/**
 * El JavaScript de mejora junto con el servidor (DEF-006 de QA, REQ-F-039): la página real del admin,
 * con `submit-guard.js` activo, envía al servidor exactamente lo que el navegador construye al enviar
 * (incluido el name/value del botón pulsado) y el servidor lo acepta. Las pruebas por separado del JS
 * (jsdom) y del servidor no detectaban el campo `action` repetido.
 */

const disposers: (() => void)[] = [];
afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  document.body.innerHTML = '';
});

/** Pinta el <body> de una página del servidor, activa submit-guard y devuelve los datos del envío. */
function submitWithGuard(html: string, buttonSelector: string, edit: (form: HTMLFormElement) => void): URLSearchParams {
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  disposers.push(initSubmitGuard(document));
  const form = document.querySelector<HTMLFormElement>('#product-form')!;
  edit(form);
  const button = form.querySelector<HTMLButtonElement>(buttonSelector)!;
  let data: URLSearchParams | null = null;
  // Último en la cadena (window): captura los datos como los construye el navegador y evita la navegación.
  const capture = (event: Event) => {
    event.preventDefault();
    data = new URLSearchParams(new FormData(form, button) as unknown as Record<string, string>);
  };
  window.addEventListener('submit', capture);
  disposers.push(() => window.removeEventListener('submit', capture));
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button }));
  if (!data) throw new Error('No se envió el formulario');
  return data;
}

describe('submit-guard con el servidor (DEF-006)', () => {
  it('editar con JS: un solo campo action y el servidor guarda (303)', async () => {
    const h = await startInventory({ products: [product(1, 'molotes', 'Molote de Queso', 1)] });
    const browser = h.browser();
    await browser.login(ELI);
    const html = await (await browser.get('/molotes/productos/1/editar')).text();
    const data = submitWithGuard(html, 'button[value="update"]', (form) => {
      form.querySelector<HTMLInputElement>('#f-name')!.value = 'Molote con JS';
    });
    expect(data.getAll('action')).toEqual(['update']);
    const res = await browser.postBody('/molotes/productos/1', data);
    expect(res.status).toBe(303);
    expect(h.api.products[0]?.name).toBe('Molote con JS');
  });

  it('crear con JS: un solo campo action y el servidor crea (303)', async () => {
    const h = await startInventory();
    const browser = h.browser();
    await browser.login(ELI);
    const html = await (await browser.get('/molotes/productos/nuevo?categoria=bebida')).text();
    const data = submitWithGuard(html, 'button[value="create"]', (form) => {
      form.querySelector<HTMLInputElement>('#f-name')!.value = 'Agua con JS';
    });
    expect(data.getAll('action')).toEqual(['create']);
    const res = await browser.postBody('/molotes/productos', data);
    expect(res.status).toBe(303);
    expect(h.api.products.map((candidate) => candidate.name)).toEqual(['Agua con JS']);
  });

  it('sobrescribir tras un 409 con JS: un solo action=overwrite y el servidor guarda', async () => {
    const h = await startInventory({ products: [product(1, 'molotes', 'Molote de Queso', 1)] });
    const browser = h.browser();
    await browser.login(ELI);
    const edit = await (await browser.get('/molotes/productos/1/editar')).text();
    const first = submitWithGuard(edit, 'button[value="update"]', () => {});
    h.api.touch(1, 'Luis');
    const conflict = await browser.postBody('/molotes/productos/1', first);
    expect(conflict.status).toBe(409);
    disposers.pop()?.();
    disposers.pop()?.();
    const data = submitWithGuard(await conflict.text(), 'button[value="overwrite"]', () => {});
    expect(data.getAll('action')).toEqual(['overwrite']);
    expect((await browser.postBody('/molotes/productos/1', data)).status).toBe(303);
  });
});
