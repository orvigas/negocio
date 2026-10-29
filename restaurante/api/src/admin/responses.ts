import type { Context } from 'koa';

import type { Logger } from '@restaurante/core/shared';
import { readJsonBody } from '@restaurante/web';

/**
 * Piezas comunes de las rutas de `/api/v1/admin` (REQ-F-039; compartidas con usuarios y cuenta desde
 * REQ-F-040): respuestas validadas con el contrato, el 422 por campo y la lectura de un cuerpo JSON con
 * una lista cerrada de campos.
 */

/** Esquema de respuesta del contrato (solo se usa `safeParse`). */
export interface ResponseSchema {
  safeParse(value: unknown): { success: true; data: unknown } | { success: false; error: { issues: readonly unknown[] } };
}

export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export const DEFAULT_VALIDATION_MESSAGE = 'Los datos no son válidos: no se guardó nada.';

export function validationFailed(ctx: Context, fields: Record<string, string>, message = DEFAULT_VALIDATION_MESSAGE): void {
  ctx.status = 422;
  ctx.body = { error: { code: 'VALIDATION_FAILED', message, fields } };
}

// Propiedades función (no métodos): se usan sueltas sin perder el contexto.
export interface Responder {
  /** Responde validando con el contrato: una respuesta que no lo cumple es un error interno. */
  send: (ctx: Context, schema: ResponseSchema, body: unknown, status?: number) => void;
  /** Lee un objeto JSON con solo los campos indicados; si no, 422 y null. */
  closedBody: (ctx: Context, allowed: readonly string[], limit: number) => Promise<Record<string, unknown> | null>;
}

export function createResponder(logger: Logger): Responder {
  return Object.freeze<Responder>({
    send(ctx, schema, body, status = 200) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        logger.error('admin_response_invalid', { path: ctx.path, issues: parsed.error.issues.length });
        throw new Error('La respuesta no cumple el contrato');
      }
      ctx.status = status;
      ctx.body = parsed.data;
    },

    async closedBody(ctx, allowed, limit) {
      const body = await readJsonBody(ctx, { limit });
      if (!isRecord(body)) {
        validationFailed(ctx, { '': 'El cuerpo debe ser un objeto.' });
        return null;
      }
      const unknownKeys = Object.keys(body).filter((key) => !allowed.includes(key));
      if (unknownKeys.length > 0) {
        validationFailed(ctx, Object.fromEntries(unknownKeys.map((key) => [key, 'Campo desconocido.'])));
        return null;
      }
      return body;
    },
  });
}
