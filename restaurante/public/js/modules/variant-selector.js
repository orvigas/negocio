/**
 * Selector de variantes de un platillo (tamaño, con/sin carne, tipo de bebida).
 *
 * Origen en _stich_source_ (birria): botones con onclick en línea que cambiaban
 * precio, descripción y reescribían className. Aquí se sustituye por delegación
 * de eventos, atributos data-* y aria-pressed (el estilo activo se resuelve con
 * la variante de Tailwind `aria-pressed:`).
 *
 * Marcado esperado:
 *   <div data-variant-group data-variant-price="price-birriamen" data-variant-description="desc-birriamen">
 *     <button type="button" aria-pressed="true"  data-variant data-price="$155 MXN" data-description="...">Grande</button>
 *     <button type="button" aria-pressed="false" data-variant data-price="$110 MXN" data-description="...">Chica</button>
 *   </div>
 *   data-price es opcional (p. ej. bebidas con el mismo precio).
 */

function setText(doc, id, value) {
  if (!id || value === undefined) return;
  const el = doc.getElementById(id);
  if (el) el.textContent = value;
}

/** @param {HTMLElement} button */
export function selectVariant(button) {
  const group = button.closest('[data-variant-group]');
  if (!group) return;

  for (const option of group.querySelectorAll('[data-variant]')) {
    option.setAttribute('aria-pressed', String(option === button));
  }

  const doc = button.ownerDocument;
  setText(doc, group.dataset.variantPrice, button.dataset.price);
  setText(doc, group.dataset.variantDescription, button.dataset.description);
}

/** @param {MouseEvent} event */
export function handleVariantClick(event) {
  const button = event.target instanceof Element ? event.target.closest('[data-variant]') : null;
  if (button) selectVariant(button);
}

/** Registra un único listener delegado. Devuelve una función para retirarlo. */
export function initVariantSelectors(root = document) {
  root.addEventListener('click', handleVariantClick);
  return () => root.removeEventListener('click', handleVariantClick);
}
