// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initVariantSelectors } from '../../public/js/modules/variant-selector.js';

describe('variant-selector', () => {
  let dispose;

  beforeEach(() => {
    document.body.innerHTML = `
      <p id="price">$155 MXN</p><p id="desc">Grande</p>
      <div data-variant-group data-variant-price="price" data-variant-description="desc">
        <button id="big" type="button" aria-pressed="true" data-variant data-price="$155 MXN" data-description="Grande">Grande</button>
        <button id="small" type="button" aria-pressed="false" data-variant data-price="$110 MXN" data-description="<b>Chica</b>"><span>Chica</span></button>
      </div>
      <p id="drink-desc">Horchata</p>
      <div data-variant-group data-variant-description="drink-desc">
        <button id="coke" type="button" aria-pressed="false" data-variant data-description="Coca-Cola">Coca-Cola</button>
      </div>`;
    dispose = initVariantSelectors(document);
  });

  afterEach(() => dispose());

  it('actualiza precio, descripción (como texto) y aria-pressed', () => {
    document.querySelector('#small span').click();
    expect(document.getElementById('price').textContent).toBe('$110 MXN');
    expect(document.getElementById('desc').textContent).toBe('<b>Chica</b>');
    expect(document.getElementById('desc').querySelector('b')).toBeNull();
    expect(document.getElementById('small').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('big').getAttribute('aria-pressed')).toBe('false');
  });

  it('solo cambia la descripción si la variante no tiene precio', () => {
    document.getElementById('coke').click();
    expect(document.getElementById('drink-desc').textContent).toBe('Coca-Cola');
    expect(document.getElementById('price').textContent).toBe('$155 MXN');
  });

  it('dispose retira el listener', () => {
    dispose();
    document.getElementById('small').click();
    expect(document.getElementById('price').textContent).toBe('$155 MXN');
    dispose = () => {};
  });
});
