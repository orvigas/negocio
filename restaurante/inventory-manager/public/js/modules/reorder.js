/**
 * Reordenar sin recargar la página (REQ-F-039, RF-8): mejora los formularios "Subir" y "Bajar"
 * (`data-reorder`). Se envían con fetch a la misma ruta con `X-Fragment: product-list`; el servidor
 * aplica la misma regla que sin JavaScript y responde la lista vigente, que reemplaza la anterior.
 * El foco vuelve al mismo botón (o al otro del mismo producto) y una región `aria-live` anuncia la
 * nueva posición. Si algo falla, el formulario se envía de forma normal.
 *
 * Marcado:
 *   <div data-product-list>… <form data-reorder action="…/subir" method="post">
 *     <button data-reorder-button="up" data-product-id="7">Subir</button></form> …</div>
 *   <p role="status" aria-live="polite" data-reorder-status></p>
 */

function announce(doc, text) {
  const status = doc.querySelector('[data-reorder-status]');
  if (status) status.textContent = text;
}

/** Texto de la nueva posición del producto en la lista renderizada. */
function positionText(list, productId) {
  const row = list.querySelector(`[data-product-row="${productId}"]`);
  if (!row) return '';
  const rows = [...row.parentElement.querySelectorAll(':scope > [data-product-row]')];
  const name = row.querySelector('.product-row__name')?.textContent?.replace(/^\s*\d+\.\s*/, '').trim() ?? '';
  return `${name}: posición ${rows.indexOf(row) + 1} de ${rows.length}`;
}

function restoreFocus(list, productId, direction) {
  const other = direction === 'up' ? 'down' : 'up';
  const target =
    list.querySelector(`[data-product-id="${productId}"][data-reorder-button="${direction}"]`) ??
    list.querySelector(`[data-product-id="${productId}"][data-reorder-button="${other}"]`);
  target?.focus();
}

/** @param {SubmitEvent} event */
export async function handleReorderSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-reorder]')) return;
  const doc = form.ownerDocument;
  const list = doc.querySelector('[data-product-list]');
  const button = form.querySelector('[data-reorder-button]');
  if (!list || !button || typeof fetch !== 'function') return;
  event.preventDefault();
  const productId = button.dataset.productId;
  const direction = button.dataset.reorderButton;
  button.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),
      headers: { 'X-Fragment': 'product-list' },
      credentials: 'same-origin',
      redirect: 'error',
    });
    if (response.status !== 200 && response.status !== 409) throw new Error(`HTTP ${response.status}`);
    list.innerHTML = await response.text();
    restoreFocus(list, productId, direction);
    announce(doc, response.status === 409 ? 'La lista cambió mientras tanto: no se movió nada. Revisa el orden actual.' : positionText(list, productId));
  } catch {
    // Sin la mejora: el envío normal aplica la misma regla y vuelve a la lista (PRG).
    form.removeAttribute('data-reorder');
    form.submit();
  }
}

export function initReorder(root = document) {
  const listener = (event) => void handleReorderSubmit(event);
  root.addEventListener('submit', listener);
  return () => root.removeEventListener('submit', listener);
}
