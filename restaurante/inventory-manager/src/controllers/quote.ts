import { QUOTE_NOT_FOUND_CODE, QUOTE_UNAVAILABLE_CODE, type AdminApiClient, type AdminApiResult, type AdminCredentials, type QuoteField } from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId, sanitizeNext } from '../session.ts';
import type { Views } from '../views/index.ts';
import { QUOTE_BUSINESS, QUOTE_PATH, QUOTE_PERSONAS_FIELD, QUOTE_SUBMIT_FIELD, type QuoteDefaults } from '../views/quote.ts';
import { createControllerKit, isHttpError, type Ctx, type Session } from './common.ts';

/**
 * Cotizador de taquizas (REQ-F-046) en `GET /birria/cotizador`, solo para administradores. Aquí no se
 * calcula ni se valida ningún valor: la API (core) lo hace todo. Este controlador solo traduce la
 * query a `{ personas, ajustes }` y pinta la respuesta. Nada se guarda.
 *
 * Orden: tamaño de la query (sin leerla) -> sesión (303 al acceso, con la misma query si cabe como vuelta) -> rol
 * administrador (403) -> valores por defecto de la API (503 `QUOTE_UNAVAILABLE`: "Cotizador no
 * disponible") -> claves repetidas o desconocidas (aviso, sin cálculo) -> con el marcador del botón
 * (`calcular=1`, el formulario completo), 303 a la URL con solo N y las diferencias (RF-7, CA-16) -> sin
 * N, el formulario con los valores del JSON -> con N, el cálculo (200) o los errores por campo (422).
 *
 * Privacidad (RF-9, CA-19): nunca se registran la query, las claves ni los valores; solo el motivo de
 * un rechazo (`quote_rejected`) y los fallos de la API sin detalles.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface QuoteController {
  page: Handler;
}

/** Tope de la query (RF-7 y validación transversal): por encima no se lee ni se calcula nada. */
export const QUOTE_QUERY_LIMIT = 8 * 1024;

const FORBIDDEN = 'Solo los administradores pueden usar el cotizador.';
const MESSAGES = Object.freeze({
  too_long: 'La configuración es demasiado larga; restablece los valores.',
  duplicate: 'El enlace tiene campos repetidos; restablece los valores.',
  unknown: 'El enlace tiene campos que ya no existen; restablece los valores.',
});
type Rejection = keyof typeof MESSAGES;

const PERSONAS_PATTERN = /^\d{1,6}$/;
const PLAIN_NUMBER = /^\d+(?:\.\d+)?$/;
const DECIMAL_COMMA = /^\d+,\d+$/;
const LIST_SEPARATOR = /[\s,]+/;

/** Texto que se lleva a la URL: recortado y, en un número con coma decimal, con punto (Revisión técnica, punto 2). */
export function normalizeQuoteValue(field: QuoteField, raw: string): string {
  const text = raw.trim();
  return field.kind !== 'intList' && DECIMAL_COMMA.test(text) ? text.replace(',', '.') : text;
}

/** Lista de enteros sin repetidos y en orden (como la guarda core), o null si algún elemento no es un entero. */
function intList(text: string): string | null {
  const parts = text.split(LIST_SEPARATOR).filter((part) => part !== '');
  if (!parts.every((part) => PERSONAS_PATTERN.test(part))) return null;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b).join(',');
}

/** ¿El valor (ya normalizado) es el del JSON? Un valor inválido nunca lo es: se conserva para mostrar su error. */
export function isQuoteDefault(field: QuoteField, text: string): boolean {
  if (text === field.defaultValue) return true;
  if (field.kind === 'active') return false;
  if (field.kind === 'intList') {
    const list = intList(text);
    return list !== null && list === intList(field.defaultValue);
  }
  return PLAIN_NUMBER.test(text) && PLAIN_NUMBER.test(field.defaultValue) && Number(text) === Number(field.defaultValue);
}

export function createQuoteController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): QuoteController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, toLogin, unavailable, failureReason, fieldErrors, notFound } = kit;

  /** El cálculo no tiene efectos, pero viaja en un POST: se envía el token CSRF de la sesión igualmente. */
  const credentialsOf = (auth: Session): AdminCredentials => ({ sessionId: auth.sessionId, csrfToken: auth.csrfToken });

  /** 401 -> acceso; 403 (p. ej. rol cambiado durante la sesión) -> sin permiso; 503 propio -> no disponible; resto -> 503 común. */
  function apiFailure(ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, returnTo: string): void {
    if (!result.ok && result.kind === 'http' && result.status === 401) {
      clearSessionId(ctx, config.isProduction);
      return toLogin(ctx, returnTo);
    }
    if (!result.ok && result.kind === 'http' && result.status === 403) return kit.forbidden(ctx, auth, FORBIDDEN);
    if (isHttpError(result, 404, QUOTE_NOT_FOUND_CODE)) return notFound(ctx, { context: auth });
    if (isHttpError(result, 503, QUOTE_UNAVAILABLE_CODE)) {
      logger.warn('quote_unavailable_shown', { status: 503 });
      return send(ctx, 503, views.quoteUnavailable(auth));
    }
    return unavailable(ctx, failureReason(result), auth, QUOTE_BUSINESS, 'quote');
  }

  /** "Restablecer valores del JSON" conserva N si parece un número de personas (S-7). */
  function resetHref(personas: string | null): string {
    const text = personas?.trim() ?? '';
    return PERSONAS_PATTERN.test(text) ? `${QUOTE_PATH}?${new URLSearchParams({ [QUOTE_PERSONAS_FIELD]: text }).toString()}` : QUOTE_PATH;
  }

  /** Query rechazada: el formulario con los valores del JSON y el aviso, sin cálculo (CA-20). */
  function rejected(ctx: Ctx, auth: Session, quote: QuoteDefaults, reason: Rejection, personas: string | null): void {
    logger.info('quote_rejected', { reason });
    const reset = resetHref(personas);
    const notice: SafeHtml = views.notice({ tone: 'error', title: MESSAGES[reason], links: [{ href: reset, label: 'Restablecer valores del JSON' }] });
    send(ctx, 200, views.quotePage({ context: auth, quote, personas: '', values: {}, modified: new Set(), resetHref: reset, notices: [notice] }));
  }

  /** Lee la query: null y el motivo si hay claves repetidas o desconocidas. */
  function readQuery(querystring: string, fields: ReadonlyMap<string, QuoteField>): { params: Map<string, string> } | { reason: Rejection } {
    const params = new Map<string, string>();
    for (const [key, value] of new URLSearchParams(querystring)) {
      if (params.has(key)) return { reason: 'duplicate' };
      const known = key === QUOTE_PERSONAS_FIELD || fields.has(key) || (key === QUOTE_SUBMIT_FIELD && value === '1');
      if (!known) return { reason: 'unknown' };
      params.set(key, value);
    }
    return { params };
  }

  /** URL de diferencias (RF-7): N y, en el orden de la pantalla, solo los campos que difieren del JSON. */
  function differencesUrl(params: ReadonlyMap<string, string>, quote: QuoteDefaults): string {
    const query = new URLSearchParams({ [QUOTE_PERSONAS_FIELD]: (params.get(QUOTE_PERSONAS_FIELD) ?? '').trim() });
    for (const field of quote.fields) {
      const raw = params.get(field.key);
      if (raw === undefined) continue;
      const value = normalizeQuoteValue(field, raw);
      if (!isQuoteDefault(field, value)) query.set(field.key, value);
    }
    return `${QUOTE_PATH}?${query.toString()}`;
  }

  return Object.freeze<QuoteController>({
    async page(ctx) {
      const tooLong = Buffer.byteLength(ctx.querystring) > QUOTE_QUERY_LIMIT;
      // Vuelta tras el acceso: con la query si cabe en el formulario de acceso; si no, sin ella (DEF-004).
      const withQuery = `${QUOTE_PATH}?${ctx.querystring}`;
      const returnTo = tooLong || ctx.querystring === '' || sanitizeNext(withQuery) !== withQuery ? QUOTE_PATH : withQuery;
      const auth = await kit.adminSession(ctx, returnTo, FORBIDDEN);
      if (!auth) return;

      const defaults = await api.getQuoteDefaults(credentialsOf(auth), QUOTE_BUSINESS);
      if (!defaults.ok) return apiFailure(ctx, defaults, auth, returnTo);
      const { quote } = defaults.data;
      if (tooLong) return rejected(ctx, auth, quote, 'too_long', null);

      const fields = new Map(quote.fields.map((field) => [field.key, field]));
      const read = readQuery(ctx.querystring, fields);
      if ('reason' in read) return rejected(ctx, auth, quote, read.reason, new URLSearchParams(ctx.querystring).get(QUOTE_PERSONAS_FIELD));
      const { params } = read;

      if (params.has(QUOTE_SUBMIT_FIELD)) return seeOther(ctx, differencesUrl(params, quote));

      const personas = params.get(QUOTE_PERSONAS_FIELD);
      const ajustes = Object.fromEntries([...params].filter(([key]) => fields.has(key)));
      const modified = new Set(
        quote.fields
          .filter((field) => {
            const raw = params.get(field.key);
            return raw !== undefined && !isQuoteDefault(field, normalizeQuoteValue(field, raw));
          })
          .map((field) => field.key),
      );
      const view = { context: auth, quote, personas: personas ?? '', values: ajustes, modified, resetHref: resetHref(personas ?? null) };
      if (personas === undefined) return send(ctx, 200, views.quotePage(view));

      const result = await api.calculateQuote(credentialsOf(auth), QUOTE_BUSINESS, { personas, ajustes });
      if (result.ok) return send(ctx, 200, views.quotePage({ ...view, result: result.data.result }));
      const errors = fieldErrors(result);
      if (errors) return send(ctx, 422, views.quotePage({ ...view, errors }));
      return apiFailure(ctx, result, auth, returnTo);
    },
  });
}
