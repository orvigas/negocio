// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initPromoForms } from '../../public/js/modules/promo-form.js';

function submit(form: HTMLElement) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('promo-form', () => {
  let dispose: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="hide" data-promo-form data-promo-status="ok-hide" data-promo-hide-on-success>
        <label for="email">Correo</label>
        <input id="email" type="email" required />
      </form>
      <p id="ok-hide" role="status" hidden>Gracias</p>
      <form id="keep" data-promo-form data-promo-status="ok-keep"></form>
      <p id="ok-keep" role="status" hidden>Listo</p>
      <form id="other"></form>`;
    dispose = initPromoForms(document);
  });

  afterEach(() => dispose());

  it('no muestra éxito si el formulario es inválido', () => {
    submit(document.getElementById('hide')!);
    expect(document.getElementById('ok-hide')!.hidden).toBe(true);
    expect(document.getElementById('hide')!.hidden).toBe(false);
  });

  it('muestra el estado y oculta el formulario cuando se pide (diseño molotes)', () => {
    (document.getElementById('email')! as HTMLInputElement).value = 'cliente@example.com';
    submit(document.getElementById('hide')!);
    expect(document.getElementById('ok-hide')!.hidden).toBe(false);
    expect(document.getElementById('hide')!.hidden).toBe(true);
  });

  it('muestra el estado sin ocultar el formulario (diseño birria)', () => {
    submit(document.getElementById('keep')!);
    expect(document.getElementById('ok-keep')!.hidden).toBe(false);
    expect(document.getElementById('keep')!.hidden).toBe(false);
  });

  it('ignora formularios sin data-promo-form', () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    document.getElementById('other')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
