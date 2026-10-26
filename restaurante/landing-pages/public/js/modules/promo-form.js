/**
 * Formulario de promociones (presente en ambos diseños).
 *
 * Origen en _stich_source_:
 *   - molotes: handleSubscribe() oculta el formulario y muestra el mensaje de éxito.
 *   - birria:  onsubmit en línea que muestra el mensaje de estado.
 *
 * Marcado esperado:
 *   <form data-promo-form data-promo-status="promo-status" [data-promo-hide-on-success] novalidate?>
 *   <p id="promo-status" role="status" hidden>...</p>
 *
 * IMPORTANTE: igual que en el diseño, no envía datos a ningún servidor todavía.
 */

function findStatusElement(form) {
  const id = form.dataset.promoStatus;
  return id ? form.ownerDocument.getElementById(id) : null;
}

/** @param {SubmitEvent} event */
export function handlePromoSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-promo-form]')) return;

  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const status = findStatusElement(form);
  if (status) status.hidden = false;
  if (form.hasAttribute('data-promo-hide-on-success')) form.hidden = true;
}

/** Registra un único listener delegado. Devuelve una función para retirarlo. */
export function initPromoForms(root = document) {
  root.addEventListener('submit', handlePromoSubmit);
  return () => root.removeEventListener('submit', handlePromoSubmit);
}
