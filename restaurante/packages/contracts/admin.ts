import { z } from 'zod';

import { PUBLIC_BUSINESS_IDS, type PublicBusinessId } from './products.ts';

/**
 * Contrato de la API de administración `/api/v1/admin` (REQ-F-039, RF-1 a RF-12; D-1 y D-2).
 *
 * La sesión pertenece a la API: el login devuelve un id opaco que el admin (inventory-manager)
 * guarda en su cookie y reenvía como `Authorization: Bearer <id>` en cada llamada interna. Las
 * escrituras exigen además el token CSRF de esa sesión en `X-CSRF-Token`. El login cuenta los
 * intentos por la IP de `X-Forwarded-For`, que pone el admin (la API solo es alcanzable desde la red
 * interna).
 *
 * Las reglas de los productos están solo en core (`validateProductInput`): este contrato describe la
 * forma de lo que sale y no repite las reglas de lo que entra (la API responde 422 con `fields`).
 * Los objetos descartan los campos desconocidos al validar una respuesta.
 */

export const ADMIN_API_PREFIX = '/api/v1/admin';
export const CSRF_HEADER = 'X-CSRF-Token';
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
/** Formato de `Idempotency-Key`: 16 a 64 caracteres de base64url. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** Rutas de la API de administración (relativas al origen de la API). */
export const adminPaths = Object.freeze({
  session: `${ADMIN_API_PREFIX}/sesion`,
  products: (business: PublicBusinessId) => `${ADMIN_API_PREFIX}/${business}/productos`,
  productFields: (business: PublicBusinessId) => `${ADMIN_API_PREFIX}/${business}/productos/campos`,
  productOrder: (business: PublicBusinessId) => `${ADMIN_API_PREFIX}/${business}/productos/orden`,
  product: (business: PublicBusinessId, id: number) => `${ADMIN_API_PREFIX}/${business}/productos/${id}`,
  productRestore: (business: PublicBusinessId, id: number) => `${ADMIN_API_PREFIX}/${business}/productos/${id}/recuperar`,
  productMove: (business: PublicBusinessId, id: number) => `${ADMIN_API_PREFIX}/${business}/productos/${id}/mover`,
});

const businessId = z.enum(PUBLIC_BUSINESS_IDS);
const isoDate = z.string().min(1);
const id = z.number().int().positive();

// --- Acceso -----------------------------------------------------------------------

export const loginRequestSchema = z.object({ username: z.string().max(200), password: z.string().max(1024) });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const adminUserSchema = z.object({
  id,
  name: z.string(),
  role: z.enum(['admin', 'editor']),
  /** Negocios en los que puede editar (el administrador, todos). */
  businesses: z.array(businessId),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** 201 de `POST /sesion`. */
export const loginResponseSchema = z.object({
  session: z.object({ id: z.string().min(1), csrfToken: z.string().min(1) }),
  user: adminUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** 200 de `GET /sesion`. */
export const sessionResponseSchema = z.object({ user: adminUserSchema, csrfToken: z.string().min(1) });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

// --- Productos ----------------------------------------------------------------------

const optionalText = z.string().nullable().optional();
const optionalCents = z.number().int().nonnegative().nullable().optional();

export const adminProductSchema = z.object({
  id,
  business: businessId,
  category: z.enum(['platillo', 'bebida']),
  detailsType: z.enum(['chips', 'portion', 'variants']).nullable(),
  slug: z.string(),
  name: z.string(),
  // Campos de la combinación (los demás no aparecen). Precios en pesos ("45.00") y en centavos.
  description: optionalText,
  label: optionalText,
  price: optionalText,
  priceUnit: optionalText,
  image: z.object({ src: z.string(), alt: z.string(), width: z.number().int(), height: z.number().int() }).nullable().optional(),
  tone: optionalText,
  orderPrice: optionalText,
  orderQuantity: z.number().int().nullable().optional(),
  icon: optionalText,
  detailsLabel: optionalText,
  portion: optionalText,
  portionExtra: optionalText,
  chips: z.array(z.object({ text: z.string(), highlight: z.boolean() })).optional(),
  variants: z.array(z.object({ label: z.string(), price: z.string(), priceCents: z.number().int(), description: z.string(), available: z.boolean() })).optional(),
  priceCents: optionalCents,
  orderPriceCents: optionalCents,
  available: z.boolean(),
  position: z.number().int(),
  version: id,
  deleted: z.boolean(),
  deletedAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  /** Último cambio (historial con autor): `id` null si fue la importación del sistema. */
  updatedBy: z.object({ id: z.number().int().nullable(), name: z.string() }).nullable(),
});
export type AdminProduct = z.infer<typeof adminProductSchema>;

/**
 * Frescura tras una escritura (RF-12): `confirmed` si landing-pages confirmó que la landing y el bot
 * ya tienen el cambio; `pending` si el aviso interno no respondió a tiempo (se reintenta en segundo
 * plano y la red de seguridad es de 60 s).
 */
export const freshnessSchema = z.enum(['confirmed', 'pending']);
export type Freshness = z.infer<typeof freshnessSchema>;

export const productResponseSchema = z.object({ product: adminProductSchema });
export const productWriteResponseSchema = z.object({ product: adminProductSchema, meta: z.object({ freshness: freshnessSchema }) });
export const productListResponseSchema = z.object({ products: z.array(adminProductSchema) });
export const productListWriteResponseSchema = z.object({ products: z.array(adminProductSchema), meta: z.object({ freshness: freshnessSchema }) });

/** Campo del formulario de una combinación (descriptor que sale de core, `productFormLeaves`). */
export const productFormFieldSchema = z.object({
  name: z.string(),
  group: z.enum(['main', 'image', 'chips', 'variants']),
  slot: z.number().int().nonnegative().optional(),
  kind: z.enum(['text', 'price', 'int', 'bool', 'enum', 'icon', 'imageSrc']),
  label: z.string(),
  max: z.number().int().optional(),
  min: z.number().int().optional(),
  optional: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});
export type ProductFormField = z.infer<typeof productFormFieldSchema>;

export const productFieldsResponseSchema = z.object({
  category: z.enum(['platillo', 'bebida']),
  detailsType: z.enum(['chips', 'portion', 'variants']).nullable(),
  /** Campos del alta (sin "Disponible": un producto nuevo se crea no disponible). */
  create: z.array(productFormFieldSchema),
  /** Campos de la edición (con "Disponible"). */
  update: z.array(productFormFieldSchema),
});
export type ProductFieldsResponse = z.infer<typeof productFieldsResponseSchema>;

// --- Errores --------------------------------------------------------------------------

/** 422: errores por campo (la clave '' es un error general). */
export const validationErrorSchema = z.object({
  error: z.object({ code: z.literal('VALIDATION_FAILED'), message: z.string(), fields: z.record(z.string(), z.string()) }),
});

/** 409: versión vigente del producto, quién y cuándo. */
export const conflictErrorSchema = z.object({
  error: z.object({
    code: z.literal('VERSION_CONFLICT'),
    message: z.string(),
    current: z.object({ id, version: id, updatedAt: isoDate, updatedBy: z.string().nullable() }),
  }),
});
