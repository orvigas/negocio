/**
 * Entrada JS de la landing de Birria El Muñeco (birria).
 * Fuente: manejadores onclick/onsubmit en línea de
 * _stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html
 */
import { initHomeNotice } from '../modules/home-notice.js';
import { initPromoForms } from '../modules/promo-form.js';
import { initVariantSelectors } from '../modules/variant-selector.js';

initPromoForms();
initVariantSelectors();
// Al final: si el aviso de inicio se abre, los demás módulos ya están listos.
initHomeNotice();
