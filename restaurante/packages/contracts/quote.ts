import { z } from 'zod';

import { PUBLIC_BUSINESS_IDS } from './products.ts';

/**
 * Contrato del cotizador de taquizas (REQ-F-046): `GET /api/v1/admin/<negocio>/cotizador` (campos
 * editables con los valores del JSON) y `POST /api/v1/admin/<negocio>/cotizador/calculos` (cálculo con
 * las diferencias respecto del JSON). Solo administradores. Las reglas (rangos, fórmulas) son de core
 * y las aplica la API: un campo inválido responde 422 `VALIDATION_FAILED` con `fields` por clave (`n`
 * para las personas; `''` para lo general). Nada se guarda.
 */

/** 503: el JSON del cotizador no es válido o no se pudo leer. */
export const QUOTE_UNAVAILABLE_CODE = 'QUOTE_UNAVAILABLE';
/** 404: el negocio no tiene cotizador (Molotes). */
export const QUOTE_NOT_FOUND_CODE = 'QUOTE_NOT_FOUND';

/** Límites del cuerpo del cálculo: acotan el costo de cada petición. */
export const QUOTE_REQUEST_LIMITS = Object.freeze({ maxAdjustments: 200, keyPattern: /^[a-z0-9.-]{1,80}$/, maxValueLength: 64 });

export const quoteFieldSchema = z.object({
  key: z.string(),
  section: z.string(),
  group: z.string(),
  label: z.string(),
  unit: z.string(),
  kind: z.enum(['int', 'decimal', 'money', 'percent', 'optionalMoney', 'active', 'intList']),
  min: z.number().nullable(),
  minExclusive: z.boolean(),
  max: z.number().nullable(),
  maxExclusive: z.boolean(),
  decimals: z.number().int().nonnegative(),
  optional: z.boolean(),
  provisional: z.boolean(),
  /** Valor del JSON como texto canónico (punto decimal). */
  defaultValue: z.string(),
});
export type QuoteField = z.infer<typeof quoteFieldSchema>;

/** 200 de `GET /:negocio/cotizador`. */
export const quoteDefaultsResponseSchema = z.object({
  quote: z.object({
    business: z.enum(PUBLIC_BUSINESS_IDS),
    personas: z.object({ min: z.number().int(), max: z.number().int() }),
    sections: z.array(z.object({ id: z.string(), title: z.string() })),
    fields: z.array(quoteFieldSchema),
    notes: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
});
export type QuoteDefaultsResponse = z.infer<typeof quoteDefaultsResponseSchema>;

/** Cuerpo de `POST /:negocio/cotizador/calculos`: personas y solo los campos que difieren del JSON, como texto. */
export const quoteCalculationRequestSchema = z.strictObject({
  personas: z.string().max(QUOTE_REQUEST_LIMITS.maxValueLength),
  ajustes: z
    // `z.record` descarta la clave `__proto__` antes de validarla: se revisan antes las claves propias.
    .custom<unknown>((value) => typeof value !== 'object' || value === null || Object.keys(value).every((key) => QUOTE_REQUEST_LIMITS.keyPattern.test(key)))
    .pipe(
      z
        .record(z.string().regex(QUOTE_REQUEST_LIMITS.keyPattern), z.string().max(QUOTE_REQUEST_LIMITS.maxValueLength))
        .refine((ajustes) => Object.keys(ajustes).length <= QUOTE_REQUEST_LIMITS.maxAdjustments),
    ),
});
export type QuoteCalculationRequest = z.infer<typeof quoteCalculationRequestSchema>;

const amount = z.number();

export const quotePackageResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Precio sugerido por persona; null por debajo del mínimo. */
  price: amount.nullable(),
  sale: amount.nullable(),
  eventCost: amount,
  profit: amount.nullable(),
  /** Margen real en %, con 1 decimal. */
  marginPct: amount.nullable(),
  variableCost: amount,
  fixedCost: amount,
  totalCost: amount,
  pieces: amount,
  marginPrice: amount.nullable(),
  commercialPrice: amount.nullable(),
  /** Cuál mandó: el precio por margen o la tarifa comercial. */
  priceSource: z.enum(['margin', 'commercial']).nullable(),
  cartaPrice: amount.nullable(),
  /** Precio a la carta − precio sugerido: positivo, ahorro; negativo, más caro que la carta. */
  cartaDiff: amount.nullable(),
});
export type QuotePackageResult = z.infer<typeof quotePackageResultSchema>;

export const quoteMatrixSchema = z.object({
  rows: z.array(z.number().int()),
  packages: z.array(z.object({ id: z.string(), name: z.string(), cells: z.array(z.object({ price: amount, marginPct: amount }).nullable()) })),
});

/** 200 de `POST /:negocio/cotizador/calculos`. `modified`: claves que difieren del JSON. */
export const quoteCalculationResponseSchema = z.object({
  result: z.object({
    personas: z.number().int(),
    belowMinimum: z.boolean(),
    minPersonas: z.number().int(),
    modified: z.array(z.string()),
    packages: z.array(quotePackageResultSchema),
    matrix: quoteMatrixSchema,
  }),
});
export type QuoteCalculationResponse = z.infer<typeof quoteCalculationResponseSchema>;
