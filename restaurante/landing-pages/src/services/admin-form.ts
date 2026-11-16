/**
 * Formulario de administración -> datos de página. El análisis vive en core desde REQ-F-044, para que
 * `/admin` y `/api/v1/admin` apliquen las mismas reglas.
 */
export { CHECKBOX_VALUE, FORM_META_FIELDS, parsePageForm as parseAdminForm, type PageFormResult as AdminFormResult } from '@restaurante/core/catalog';
