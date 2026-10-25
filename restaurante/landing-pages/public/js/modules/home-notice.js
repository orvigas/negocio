/**
 * Aviso del día: el de la página de inicio (REQ-F-028) y el de la landing de Molotes (REQ-F-034).
 * Conserva el nombre "home-notice" (módulo, atributos y claves de sesión) también en Molotes:
 * renombrar las claves rompería la marca compartida del aviso de descanso.
 *
 * El servidor decide qué aviso toca según el día en la zona del negocio y lo pinta como un
 * <dialog> cerrado (sin JS no se ve ni tapa nada). Este módulo nunca usa el reloj del
 * dispositivo: solo abre el aviso que llegó en el HTML.
 *
 * Marcado esperado:
 *   <dialog data-home-notice="molotes|rest|weekend" aria-labelledby="...">
 *     ... <button type="button" data-action="close-home-notice">…</button>
 *   </dialog>
 *
 * - Se muestra una vez por sesión del navegador, con una marca distinta por aviso (RN-5),
 *   guardada en cuanto se abre (RN-6). Si sessionStorage falla, se muestra igual (CA-8).
 *   La marca es `homeNotice:<variante>:seen`: el aviso de descanso ("rest") de / y de Molotes
 *   la comparte (se ve una vez entre ambas rutas) y "weekend" (solo Molotes) tiene la suya.
 * - Escape lo cierra el navegador; el foco queda dentro del diálogo mientras está abierto y
 *   vuelve a la página al cerrarse (comportamiento nativo de showModal, D-T3).
 * - No se abre si la persona ya interactuó antes de que cargara el JS (D-T4).
 * - Se cierra en `pagehide` para que "atrás" (bfcache) no lo devuelva abierto.
 */

const STORAGE_PREFIX = 'homeNotice:';

/** sessionStorage puede no existir o lanzar (modo privado, cookies bloqueadas). */
function readSeen(win, key) {
  try {
    return win.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markSeen(win, key) {
  try {
    win.sessionStorage.setItem(key, '1');
  } catch {
    // Sin almacenamiento el aviso se mostrará en cada carga, pero se puede cerrar.
  }
}

/** La persona ya desplazó la página o movió el foco antes de que corriera este módulo. */
function alreadyInteracted(doc, win) {
  const active = doc.activeElement;
  return win.scrollY > 0 || (active !== null && active !== doc.body && active !== doc.documentElement);
}

/**
 * @param {{ doc?: Document, win?: Window }} [options]
 * @returns {() => void} quita los manejadores (pruebas)
 */
export function initHomeNotice({ doc = document, win = window } = {}) {
  const dialog = doc.querySelector('dialog[data-home-notice]');
  if (!dialog || typeof dialog.showModal !== 'function') return () => {};

  const key = `${STORAGE_PREFIX}${dialog.dataset.homeNotice}:seen`;
  if (readSeen(win, key) || alreadyInteracted(doc, win)) return () => {};

  const onClick = (event) => {
    if (event.target instanceof Element && event.target.closest('[data-action="close-home-notice"]')) dialog.close();
  };
  const onPageHide = () => {
    if (dialog.open) dialog.close();
  };

  dialog.addEventListener('click', onClick);
  win.addEventListener('pagehide', onPageHide);
  dialog.showModal();
  markSeen(win, key);

  return () => {
    dialog.removeEventListener('click', onClick);
    win.removeEventListener('pagehide', onPageHide);
  };
}
