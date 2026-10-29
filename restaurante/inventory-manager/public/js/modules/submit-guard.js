/**
 * Evita el doble envío (REQ-F-039, casos límite "Doble envío" y "Conexión lenta"): al enviar un
 * formulario marcado con `data-submit-guard`, el botón pulsado queda deshabilitado, con
 * `aria-busy="true"` y el texto de `data-busy-text` ("Guardando…"). Sin JavaScript el formulario
 * funciona igual (y el alta lleva su clave de idempotencia).
 *
 * Marcado: <form data-submit-guard> … <button type="submit" data-busy-text="Guardando…">Guardar</button>
 */

/** @param {SubmitEvent} event */
export function handleGuardedSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-submit-guard]') || event.defaultPrevented) return;
  if (form.dataset.submitting === 'true') {
    event.preventDefault();
    return;
  }
  form.dataset.submitting = 'true';
  const button = event.submitter instanceof HTMLButtonElement ? event.submitter : form.querySelector('button[type="submit"]');
  if (!button) return;
  // El navegador ya incluye el name/value del botón pulsado en los datos del envío (se construyen al
  // enviar). No se copia a un campo oculto: se enviaría dos veces y el servidor rechaza los campos
  // repetidos (DEF-006 de QA). Por eso el botón se deshabilita después, no ahora.
  button.setAttribute('aria-busy', 'true');
  if (button.dataset.busyText) button.textContent = button.dataset.busyText;
  setTimeout(() => {
    button.disabled = true;
  }, 0);
}

/** Registra un único listener delegado. Devuelve una función para retirarlo. */
export function initSubmitGuard(root = document) {
  root.addEventListener('submit', handleGuardedSubmit);
  return () => root.removeEventListener('submit', handleGuardedSubmit);
}
