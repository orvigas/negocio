import { z } from 'zod';

import { freshnessSchema } from './admin.ts';
import type { PublicBusinessId } from './products.ts';

/**
 * Contrato de los datos de página (REQ-F-044): lo que pintan las landings en
 * `/api/v1/public/<negocio>/pagina` y la edición en `/api/v1/admin/<negocio>/pagina`. Aquí solo va la
 * forma: las reglas (largos, precios) son las de core y las aplica la API. Sin datos en MySQL, o antes
 * del corte, ambos endpoints responden 503 con el código `PAGE_UNAVAILABLE`.
 */

/** Código del 503 "aún no disponible": no es una avería, y una escritura no se aplicó. */
export const PAGE_UNAVAILABLE_CODE = 'PAGE_UNAVAILABLE';
export const PAGE_CONFLICT_CODE = 'PAGE_CONFLICT';
export const PAGE_NO_PREVIOUS_CODE = 'PAGE_NO_PREVIOUS';

/** Ruta del endpoint público de página de un negocio. */
export const publicPagePath = (business: PublicBusinessId): string => `/api/v1/public/${business}/pagina`;

const cents = z.number().int().nonnegative();
const promoSchema = z.object({ badge: z.string(), title: z.string(), description: z.string() });

export const publicPageSchemas = {
  molotes: z.object({
    hero: z.object({ showcase: z.object({ tag: z.string(), title: z.string(), description: z.string(), priceCents: cents, unit: z.string() }) }),
    menu: z.object({ highlight: z.string() }),
    promo: promoSchema,
  }),
  birria: z.object({
    hero: z.object({ showcase: z.object({ title: z.string(), description: z.string(), priceCents: cents }) }),
    promo: promoSchema,
  }),
} as const;

export type PublicPage = { [Id in PublicBusinessId]: z.infer<(typeof publicPageSchemas)[Id]> };

export const pageResponseSchemas = {
  molotes: z.object({ data: publicPageSchemas.molotes }),
  birria: z.object({ data: publicPageSchemas.birria }),
} as const;

/** Campo del formulario de página: inventory-manager lo pinta sin conocer el esquema de core. */
export const pageFormFieldSchema = z.object({
  name: z.string(),
  group: z.string(),
  kind: z.enum(['text', 'price']),
  label: z.string(),
  max: z.number().int().positive().optional(),
  optional: z.boolean().optional(),
});
export type PageFormField = z.infer<typeof pageFormFieldSchema>;

export const adminPageSchema = z.object({
  version: z.string().min(1),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  /** Hay una versión anterior válida que restaurar. */
  hasPrevious: z.boolean(),
  /** Valores como texto del formulario, por nombre de campo. */
  values: z.record(z.string(), z.string()),
});
export type AdminPage = z.infer<typeof adminPageSchema>;

/** 200 de `GET /:negocio/pagina`. */
export const pageStateResponseSchema = z.object({ page: adminPageSchema, fields: z.array(pageFormFieldSchema) });
export type PageStateResponse = z.infer<typeof pageStateResponseSchema>;

const expectedVersion = z.string().min(1).max(200);

/**
 * Cuerpo de `PUT /:negocio/pagina`. `fields`: lo escrito en cada campo, como texto; la API lo interpreta
 * y responde 422 con `fields` por campo. `overwrite`: "Guardar mis cambios de todos modos" tras un 409.
 */
export const pageSaveRequestSchema = z.strictObject({
  expectedVersion,
  overwrite: z.boolean().optional(),
  fields: z.record(z.string(), z.string()),
});
export type PageSaveRequest = z.infer<typeof pageSaveRequestSchema>;

/** Cuerpo de `POST /:negocio/pagina/restaurar`: sin versión, repetirla la desharía sin avisar. */
export const pageRestoreRequestSchema = z.strictObject({ expectedVersion });
export type PageRestoreRequest = z.infer<typeof pageRestoreRequestSchema>;

/** 200 de guardar y restaurar. `freshness`: si la landing ya lo muestra (RF-9). */
export const pageWriteResponseSchema = z.object({ page: adminPageSchema, meta: z.object({ freshness: freshnessSchema }) });
export type PageWriteResponse = z.infer<typeof pageWriteResponseSchema>;

/** `currentPage` del 409 `PAGE_CONFLICT`: quién guardó y cuándo (CA-9). */
export const pageConflictSchema = z.object({ version: z.string(), updatedAt: z.string().nullable(), updatedBy: z.string().nullable() });
