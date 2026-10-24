/**
 * Entrada JS de la landing de Moloteando (molotes).
 * Fuente: <script> de _stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html
 *
 * No se migraron addToOrder()/clearOrder(): en el diseño ningún elemento las invoca
 * y referencian elementos inexistentes (#cart-count, #cart-total).
 */
import { initHomeNotice } from '../modules/home-notice.js';
import { initPromoForms } from '../modules/promo-form.js';

initPromoForms();
// Al final: si el aviso del día (lunes o fin de semana, REQ-F-034) se abre, la página ya está lista.
initHomeNotice();
