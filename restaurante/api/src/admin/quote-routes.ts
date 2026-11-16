import type { Context } from 'koa';

import {
  QUOTE_NOT_FOUND_CODE,
  QUOTE_UNAVAILABLE_CODE,
  quoteCalculationRequestSchema,
  quoteCalculationResponseSchema,
  quoteDefaultsResponseSchema,
} from '@restaurante/contracts';
import {
  QUOTE_LIMITS,
  QUOTE_MESSAGES,
  QUOTE_NOTES,
  QUOTE_SECTIONS,
  QuoteNotFoundError,
  QuoteUnavailableError,
  applyAdjustments,
  buildMatrix,
  calculateQuote,
  quoteFields,
  type QuoteCatalog,
  type QuoteCatalogSource,
} from '@restaurante/core/cotizador';
import { isBusinessId, type BusinessId, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess } from './access.ts';
import { createResponder, validationFailed } from './responses.ts';

/**
 * Cotizador de taquizas en `/api/v1/admin/:negocio/cotizador` (REQ-F-046), solo para administradores.
 * Orden: sesión (401) -> rol (403, antes de mirar el negocio) -> negocio con cotizador (404) ->
 * catálogo válido (503) -> cuerpo (413, 415, 400, 422) -> cálculo.
 *
 * El cálculo es un POST sin efectos: no escribe nada (RN-14) y por eso no exige CSRF (la API se
 * autentica con `Authorization: Bearer`, no con cookies). Los ajustes viajan en el cuerpo, nunca en
 * una URL, y no se registran: el log solo lleva cuántos campos fallaron (RF-9, CA-19).
 */

type RouteContext = Context & { params: Record<string, string> };
type Handler = (ctx: RouteContext) => Promise<void>;

export interface QuoteRoutes {
  defaults: Handler;
  calculate: Handler;
}

/** Cuerpo JSON del cálculo: como mucho 200 claves cortas con valores cortos. */
export const QUOTE_BODY_LIMIT = 16 * 1024;
const BODY_FIELDS: readonly string[] = Object.freeze(['personas', 'ajustes']);

const FORBIDDEN = 'Solo los administradores pueden usar el cotizador.';
const VALIDATION_MESSAGE = 'Revisa los campos marcados: no se calculó nada.';

const notFound = () => new ApiHttpError(404, QUOTE_NOT_FOUND_CODE, 'Este negocio no tiene cotizador.');
const unavailable = () => new ApiHttpError(503, QUOTE_UNAVAILABLE_CODE, 'Cotizador no disponible.');

export function createQuoteRoutes({ access, quotes, logger }: { access: AdminAccess; quotes: QuoteCatalogSource; logger: Logger }): QuoteRoutes {
  const { send, closedBody } = createResponder(logger);

  async function catalogOf(ctx: RouteContext): Promise<{ business: BusinessId; catalog: QuoteCatalog }> {
    await access.adminOnly(ctx, { write: false, forbiddenMessage: FORBIDDEN });
    const { business } = ctx.params;
    if (!isBusinessId(business)) throw notFound();
    try {
      return { business, catalog: await quotes.load(business) };
    } catch (err) {
      if (err instanceof QuoteNotFoundError) throw notFound();
      if (err instanceof QuoteUnavailableError) throw unavailable();
      throw err;
    }
  }

  /** Solo cuántos campos fallaron: nunca las claves con sus valores ni el cuerpo. */
  function rejected(ctx: RouteContext, errors: Record<string, string>): void {
    logger.info('quote_validation_failed', { fields: Object.keys(errors).length });
    validationFailed(ctx, errors, VALIDATION_MESSAGE);
  }

  return Object.freeze<QuoteRoutes>({
    async defaults(ctx) {
      const { business, catalog } = await catalogOf(ctx);
      send(ctx, quoteDefaultsResponseSchema, {
        quote: {
          business,
          personas: { min: QUOTE_LIMITS.personasMin, max: QUOTE_LIMITS.personasMax },
          sections: QUOTE_SECTIONS,
          fields: quoteFields(catalog),
          notes: QUOTE_NOTES,
        },
      });
    },

    async calculate(ctx) {
      const { catalog } = await catalogOf(ctx);
      const raw = await closedBody(ctx, BODY_FIELDS, QUOTE_BODY_LIMIT);
      if (!raw) return;
      const body = quoteCalculationRequestSchema.safeParse(raw);
      if (!body.success) return rejected(ctx, { '': QUOTE_MESSAGES.invalidAdjustments });
      const adjusted = applyAdjustments(catalog, body.data);
      if (!adjusted.ok) return rejected(ctx, adjusted.errors);
      const { personas, effective, modified } = adjusted;
      send(ctx, quoteCalculationResponseSchema, { result: { ...calculateQuote(effective, personas), modified, matrix: buildMatrix(effective) } });
    },
  });
}
