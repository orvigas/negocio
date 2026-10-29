// Punto de entrada del admin nuevo (REQ-F-039): solo mejoras; todo funciona sin JavaScript.
import { initReorder } from './modules/reorder.js';
import { initSubmitGuard } from './modules/submit-guard.js';

initSubmitGuard();
initReorder();
