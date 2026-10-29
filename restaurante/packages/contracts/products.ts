import { z } from 'zod';

/**
 * Contrato del endpoint público de productos (REQ-F-038, RF-1 y RF-2):
 *
 *   GET /api/v1/public/{molotes|birria}/productos  ->  200 { "data": <productos publicados> }
 *
 * Se define una sola vez aquí: la API serializa con estos esquemas y las landings validan con ellos
 * lo que reciben. Los objetos descartan los campos desconocidos (una ampliación compatible de la
 * API no rompe a sus clientes). La equivalencia con `PublishedProducts` de core la comprueba una
 * prueba de tipos de `api/`.
 */

/** Negocios con endpoint público (los mismos ids que core; lo comprueba una prueba de `api/`). */
export const PUBLIC_BUSINESS_IDS = ['molotes', 'birria'] as const;
export type PublicBusinessId = (typeof PUBLIC_BUSINESS_IDS)[number];

export const isPublicBusinessId = (value: unknown): value is PublicBusinessId =>
  typeof value === 'string' && (PUBLIC_BUSINESS_IDS as readonly string[]).includes(value);

/** Ruta del endpoint de productos de un negocio. */
export const publicProductsPath = (business: PublicBusinessId): string => `/api/v1/public/${business}/productos`;

const cents = z.number().int().nonnegative();
const imageSchema = z.object({ src: z.string(), alt: z.string(), width: z.number().int().nonnegative(), height: z.number().int().nonnegative() });

export const molotesItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  badge: z.string(),
  tone: z.string(),
  unitPriceCents: cents,
  orderPriceCents: cents,
  orderQuantity: z.number().int().nonnegative(),
  available: z.boolean(),
  image: imageSchema,
});

export const molotesDrinkSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  tone: z.string(),
  priceCents: cents,
  available: z.boolean(),
});

const birriaBase = {
  slug: z.string(),
  name: z.string(),
  tag: z.string(),
  available: z.boolean(),
  image: imageSchema,
  detailsLabel: z.string(),
};
const birriaOwnPrice = { description: z.string(), priceCents: cents, priceUnit: z.string() };

export const birriaItemSchema = z.discriminatedUnion('detailsType', [
  z.object({
    ...birriaBase,
    ...birriaOwnPrice,
    detailsType: z.literal('chips'),
    chips: z.array(z.object({ text: z.string(), highlight: z.boolean() })),
  }),
  z.object({ ...birriaBase, ...birriaOwnPrice, detailsType: z.literal('portion'), portion: z.string(), portionExtra: z.string() }),
  z.object({
    ...birriaBase,
    detailsType: z.literal('variants'),
    variants: z.array(z.object({ label: z.string(), priceCents: cents, description: z.string(), available: z.boolean() })),
  }),
]);

/** Productos publicados de cada negocio (la forma de REQ-F-001 que pintan las landings). */
export const publicProductsSchemas = {
  molotes: z.object({ menu: z.array(molotesItemSchema), drinks: z.array(molotesDrinkSchema) }),
  birria: z.object({ menu: z.array(birriaItemSchema) }),
} as const;

export type PublicProducts = { [Id in PublicBusinessId]: z.infer<(typeof publicProductsSchemas)[Id]> };

/** Cuerpo de la respuesta 200 del endpoint de un negocio. */
export const productsResponseSchemas = {
  molotes: z.object({ data: publicProductsSchemas.molotes }),
  birria: z.object({ data: publicProductsSchemas.birria }),
} as const;

export type ProductsResponse<Id extends PublicBusinessId> = { data: PublicProducts[Id] };

/** Cuerpo de cualquier respuesta de error de la API (`.claude/rules/manejo-de-errores.md`). */
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof apiErrorSchema>;
