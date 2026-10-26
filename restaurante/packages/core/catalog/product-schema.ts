import { BUSINESS, isBusinessId, type BusinessId } from '../shared/index.ts';
import {
  DRINK_TONES,
  ICON_PATTERN,
  MOLOTES_TONES,
  imageSrcError,
  isPlainObject,
  textError,
  type TextNode,
} from './menu-schema.ts';
import { centsToInput, parsePesosInput } from './price.ts';

/**
 * Modelo común de producto y sus reglas (REQ-F-008, RF-1 y RF-7).
 *
 * Una definición declarativa por combinación de negocio, categoría y tipo de detalle dice qué
 * campos admite cada producto. La API (JSON) y los formularios HTML (campos planos convertidos
 * a la misma forma) se validan con `validateProductInput`, con los mismos mensajes que REQ-F-001.
 *
 * Entrada (lo que escribe el usuario): precios en pesos (`price`, `orderPrice`, `variants[].price`)
 * como número JSON o texto ("45.50"). Salida: centavos (`priceCents`...).
 */

export const PRODUCT_CATEGORIES = Object.freeze(['platillo', 'bebida'] as const);
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const DETAILS_TYPES = Object.freeze(['chips', 'portion', 'variants'] as const);
export type DetailsType = (typeof DETAILS_TYPES)[number];

export const isProductCategory = (value: unknown): value is ProductCategory =>
  typeof value === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(value);
export const isDetailsType = (value: unknown): value is DetailsType =>
  typeof value === 'string' && (DETAILS_TYPES as readonly string[]).includes(value);

/** Límites de D-13. */
export const MAX_ACTIVE_PRODUCTS = 50;
export const MIN_ROWS = 1;
export const MAX_ROWS = 6;

export interface ProductImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}
export interface ProductVariant {
  label: string;
  priceCents: number;
  description: string;
  available: boolean;
}
export interface ProductChip {
  text: string;
  highlight: boolean;
}

/** Negocio, categoría y tipo de detalle: se eligen al crear y no cambian (D-14). */
export interface ProductKind {
  business: BusinessId;
  category: ProductCategory;
  detailsType: DetailsType | null;
}

/** Campos editables; los que no corresponden a la combinación van en null o vacíos. */
export interface ProductFields {
  name: string;
  description: string | null;
  label: string | null;
  priceCents: number | null;
  priceUnit: string | null;
  image: ProductImage | null;
  tone: string | null;
  orderPriceCents: number | null;
  orderQuantity: number | null;
  icon: string | null;
  detailsLabel: string | null;
  portion: string | null;
  portionExtra: string | null;
  chips: ProductChip[];
  variants: ProductVariant[];
}

/** Producto guardado. */
export interface Product extends ProductKind, ProductFields {
  id: number;
  slug: string;
  available: boolean;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  deletedAt: Date | null;
}

// --- Definiciones por combinación ---------------------------------------------

export type FieldRule =
  | { kind: 'text'; node: TextNode }
  | { kind: 'price'; label: string }
  | { kind: 'int'; label: string; min: number; max: number }
  | { kind: 'enum'; label: string; options: readonly string[] }
  | { kind: 'icon'; label: string }
  | { kind: 'image' }
  | { kind: 'chips' }
  | { kind: 'variants' };

/** Nombre del campo de entrada (API y formulario). */
export type InputField =
  | 'name'
  | 'description'
  | 'label'
  | 'price'
  | 'priceUnit'
  | 'image'
  | 'tone'
  | 'orderPrice'
  | 'orderQuantity'
  | 'icon'
  | 'detailsLabel'
  | 'portion'
  | 'portionExtra'
  | 'chips'
  | 'variants';

const text = (label: string, max: number, optional = false): FieldRule => ({ kind: 'text', node: { kind: 'text', label, max, optional } });

const NAME = text('Nombre', 80);
const DESCRIPTION = text('Descripción', 400);
const IMAGE: FieldRule = { kind: 'image' };
const TAG = text('Etiqueta (tag)', 40);
const DETAILS_LABEL = text('Título del bloque de detalle', 40);
const PRICE: FieldRule = { kind: 'price', label: 'Precio' };
const PRICE_UNIT = text('Unidad de precio (opcional, p. ej. "c/u")', 40, true);

export type FieldDefinitions = Readonly<Partial<Record<InputField, FieldRule>>>;

const MOLOTES_PLATILLO: FieldDefinitions = Object.freeze({
  name: NAME,
  description: DESCRIPTION,
  label: text('Badge', 40),
  tone: { kind: 'enum', label: 'Tono del badge', options: MOLOTES_TONES },
  price: { kind: 'price', label: 'Precio unitario' },
  orderPrice: { kind: 'price', label: 'Precio por orden' },
  orderQuantity: { kind: 'int', label: 'Cantidad por orden', min: 1, max: 20 },
  image: IMAGE,
});

const MOLOTES_BEBIDA: FieldDefinitions = Object.freeze({
  name: NAME,
  description: DESCRIPTION,
  icon: { kind: 'icon', label: 'Icono (Material Symbols)' },
  tone: { kind: 'enum', label: 'Tono del icono', options: DRINK_TONES },
  price: PRICE,
});

const BIRRIA_COMMON: FieldDefinitions = { name: NAME, label: TAG, image: IMAGE, detailsLabel: DETAILS_LABEL };
const BIRRIA_OWN_PRICE: FieldDefinitions = { description: DESCRIPTION, price: PRICE, priceUnit: PRICE_UNIT };
const CHIPS: FieldRule = { kind: 'chips' };
const VARIANTS: FieldRule = { kind: 'variants' };

const BIRRIA_DEFINITIONS: Readonly<Record<DetailsType, FieldDefinitions>> = Object.freeze({
  chips: Object.freeze({ ...BIRRIA_COMMON, ...BIRRIA_OWN_PRICE, chips: CHIPS }),
  portion: Object.freeze({
    ...BIRRIA_COMMON,
    ...BIRRIA_OWN_PRICE,
    portion: text('Porción', 40),
    portionExtra: text('Extra', 40),
  }),
  // Con variantes, el precio y la descripción son los de la variante activa (REQ-F-001, RF-2).
  variants: Object.freeze({ ...BIRRIA_COMMON, variants: VARIANTS }),
});

/** ¿Es válida la combinación? (RF-1.3: Molotes platillo/bebida sin tipo; Birria solo platillo con tipo). */
export function isValidKind(kind: { business: unknown; category: unknown; detailsType: unknown }): kind is ProductKind {
  if (!isBusinessId(kind.business) || !isProductCategory(kind.category)) return false;
  if (kind.business === BUSINESS.MOLOTES) return kind.detailsType === null;
  return kind.category === 'platillo' && isDetailsType(kind.detailsType);
}

/** Campos que admite una combinación válida. */
export function fieldDefinitions(kind: ProductKind): FieldDefinitions {
  if (kind.business === BUSINESS.MOLOTES) return kind.category === 'bebida' ? MOLOTES_BEBIDA : MOLOTES_PLATILLO;
  if (kind.detailsType === null) throw new TypeError('Los productos de Birria requieren tipo de detalle');
  return BIRRIA_DEFINITIONS[kind.detailsType];
}

/** Etiquetas de los campos (formularios y mensajes). */
export function fieldLabel(rule: FieldRule): string {
  switch (rule.kind) {
    case 'text':
      return rule.node.label;
    case 'image':
      return 'Imagen';
    case 'chips':
      return 'Chips';
    case 'variants':
      return 'Variantes';
    default:
      return rule.label;
  }
}

/** Categorías que admite cada negocio (Birria: solo platillos). */
export const categoriesOf = (business: BusinessId): readonly ProductCategory[] =>
  business === BUSINESS.MOLOTES ? PRODUCT_CATEGORIES : ['platillo'];

// --- Validación de la entrada ---------------------------------------------------

export type FieldErrors = Record<string, string>;

/** Campos de metadatos que la entrada puede traer además de los editables. */
const IDENTITY_FIELDS = Object.freeze(['slug', 'category', 'detailsType']);

export interface ValidationOptions {
  /** create: `category`/`detailsType` definen la combinación; update: deben coincidir si llegan. */
  mode: 'create' | 'update';
  /** Producto vigente (update): slug, categoría y tipo no se pueden cambiar (CA-18). */
  current?: Pick<Product, 'slug' | 'category' | 'detailsType'>;
}

export interface ValidatedInput {
  fields: ProductFields;
  /** Solo en update (en create se ignora: el producto nuevo nace no disponible, D-17). */
  available: boolean | null;
}

export type ValidationResult = { ok: true; value: ValidatedInput } | { ok: false; errors: FieldErrors };

const INT_TEXT = /^\d{1,5}$/;

/** Precio de entrada (pesos) -> centavos. Admite número JSON o texto (DT-3). */
function priceCents(value: unknown): { cents?: number; error?: string } {
  let raw: unknown = value;
  if (typeof value === 'number') raw = Number.isFinite(value) ? String(value) : '';
  const result = parsePesosInput(raw);
  return result.ok ? { cents: result.cents } : { error: result.error };
}

/** Entero de entrada: número JSON entero o texto de dígitos (formularios). */
function intValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value === 'string' && INT_TEXT.test(value.trim())) return Number(value.trim());
  return null;
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : null;
}

function emptyFields(name: string): ProductFields {
  return {
    name,
    description: null,
    label: null,
    priceCents: null,
    priceUnit: null,
    image: null,
    tone: null,
    orderPriceCents: null,
    orderQuantity: null,
    icon: null,
    detailsLabel: null,
    portion: null,
    portionExtra: null,
    chips: [],
    variants: [],
  };
}

function checkRows(value: unknown, path: string, errors: FieldErrors): unknown[] | null {
  if (!Array.isArray(value)) {
    errors[path] = 'Debe ser una lista.';
    return null;
  }
  if (value.length < MIN_ROWS || value.length > MAX_ROWS) {
    errors[path] = `Agrega de ${MIN_ROWS} a ${MAX_ROWS} elementos.`;
    return null;
  }
  // Array.isArray lo tipa como any[]: sus elementos aún no están validados.
  return value as unknown[];
}

function checkKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, errors: FieldErrors): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors[path ? `${path}.${key}` : key] = 'Campo desconocido.';
  }
}

function textValue(node: TextNode, value: unknown, path: string, errors: FieldErrors): string | null {
  const normalized = normalizeText(value);
  if (normalized === null) {
    if (node.optional && (value === undefined || value === null)) return null;
    errors[path] = value === undefined ? 'Falta el campo.' : 'Debe ser texto.';
    return null;
  }
  const error = textError(node, normalized);
  if (error) errors[path] = error;
  return node.optional && normalized === '' ? null : normalized;
}

function booleanValue(value: unknown, path: string, errors: FieldErrors): boolean {
  if (typeof value === 'boolean') return value;
  errors[path] = value === undefined ? 'Falta el campo.' : 'Debe ser verdadero o falso.';
  return false;
}

function imageValue(value: unknown, errors: FieldErrors): ProductImage | null {
  if (!isPlainObject(value)) {
    errors.image = value === undefined ? 'Falta el campo.' : 'Debe ser un objeto.';
    return null;
  }
  checkKeys(value, ['src', 'alt', 'width', 'height'], 'image', errors);
  const src = typeof value.src === 'string' ? value.src.trim() : value.src;
  const srcError = imageSrcError(src);
  if (srcError) errors['image.src'] = srcError;
  const alt = textValue({ kind: 'text', label: 'Texto alternativo (alt)', max: 150, optional: false }, value.alt, 'image.alt', errors);
  const size = (name: 'width' | 'height'): number => {
    const parsed = intValue(value[name]);
    if (parsed === null || parsed < 1 || parsed > 4000) {
      errors[`image.${name}`] = 'Escribe un número entero de 1 a 4000.';
      return 0;
    }
    return parsed;
  };
  const width = size('width');
  const height = size('height');
  // Con src válido (imageSrcError comprobó que es texto) y el resto validado arriba.
  return { src: src as string, alt: alt ?? '', width, height };
}

function chipsValue(value: unknown, errors: FieldErrors): ProductChip[] {
  const rows = checkRows(value, 'chips', errors);
  if (!rows) return [];
  return rows.map((row, index) => {
    const path = `chips.${index}`;
    if (!isPlainObject(row)) {
      errors[path] = 'Debe ser un objeto.';
      return { text: '', highlight: false };
    }
    checkKeys(row, ['text', 'highlight'], path, errors);
    return {
      text: textValue({ kind: 'text', label: 'Texto del chip', max: 40, optional: false }, row.text, `${path}.text`, errors) ?? '',
      highlight: booleanValue(row.highlight, `${path}.highlight`, errors),
    };
  });
}

function variantsValue(value: unknown, errors: FieldErrors): ProductVariant[] {
  const rows = checkRows(value, 'variants', errors);
  if (!rows) return [];
  return rows.map((row, index) => {
    const path = `variants.${index}`;
    if (!isPlainObject(row)) {
      errors[path] = 'Debe ser un objeto.';
      return { label: '', priceCents: 0, description: '', available: false };
    }
    checkKeys(row, ['label', 'price', 'description', 'available'], path, errors);
    const price = priceCents(row.price);
    if (price.error) errors[`${path}.price`] = price.error;
    return {
      label: textValue({ kind: 'text', label: 'Etiqueta de la variante', max: 40, optional: false }, row.label, `${path}.label`, errors) ?? '',
      priceCents: price.cents ?? 0,
      description: textValue({ kind: 'text', label: 'Descripción', max: 400, optional: false }, row.description, `${path}.description`, errors) ?? '',
      available: booleanValue(row.available, `${path}.available`, errors),
    };
  });
}

/** Aplica la regla de un campo y guarda el valor en `fields`. */
function applyRule(field: InputField, rule: FieldRule, value: unknown, fields: ProductFields, errors: FieldErrors): void {
  switch (rule.kind) {
    case 'text': {
      const result = textValue(rule.node, value, field, errors);
      // Solo los campos de texto del modelo usan esta regla.
      (fields as unknown as Record<string, unknown>)[field] = result;
      return;
    }
    case 'price': {
      const { cents, error } = priceCents(value);
      if (error) errors[field] = error;
      if (field === 'orderPrice') fields.orderPriceCents = cents ?? null;
      else fields.priceCents = cents ?? null;
      return;
    }
    case 'int': {
      const parsed = intValue(value);
      if (parsed === null || parsed < rule.min || parsed > rule.max) errors[field] = `Escribe un número entero de ${rule.min} a ${rule.max}.`;
      fields.orderQuantity = parsed;
      return;
    }
    case 'enum':
      if (typeof value !== 'string' || !rule.options.includes(value)) errors[field] = 'Elige una opción de la lista.';
      fields.tone = typeof value === 'string' ? value : null;
      return;
    case 'icon': {
      const icon = typeof value === 'string' ? value.trim() : '';
      if (!ICON_PATTERN.test(icon)) errors[field] = 'Usa solo minúsculas, dígitos y "_" (máximo 40).';
      fields.icon = icon;
      return;
    }
    case 'image':
      fields.image = imageValue(value, errors);
      return;
    case 'chips':
      fields.chips = chipsValue(value, errors);
      return;
    case 'variants':
      fields.variants = variantsValue(value, errors);
      return;
    default:
      throw new Error(`Regla desconocida: ${String((rule as { kind: unknown }).kind)}`);
  }
}

/**
 * Valida la entrada de un producto para una combinación ya resuelta.
 * - Campos desconocidos, de otra combinación o `author` (D-18): error en ese campo.
 * - `slug`, `category` y `detailsType`: en update solo se aceptan si coinciden (CA-18); en create
 *   se aceptan `category` y `detailsType` (definen la combinación) y se rechaza `slug` (RF-7.2).
 * - `available`: obligatorio en update; en create se ignora (D-17).
 */
export function validateProductInput(kind: ProductKind, input: unknown, { mode, current }: ValidationOptions): ValidationResult {
  const errors: FieldErrors = {};
  if (!isPlainObject(input)) return { ok: false, errors: { '': 'El cuerpo debe ser un objeto.' } };

  const definitions = fieldDefinitions(kind);
  const editable = Object.keys(definitions) as InputField[];
  const allowed = [...editable, 'available', ...IDENTITY_FIELDS, ...(mode === 'update' ? ['version'] : [])];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) errors[key] = 'Campo desconocido.';
  }

  if (mode === 'create') {
    if (Object.hasOwn(input, 'slug')) errors.slug = 'El identificador se genera a partir del nombre.';
  } else {
    const fixed = { slug: current?.slug, category: current?.category, detailsType: current?.detailsType };
    for (const key of IDENTITY_FIELDS) {
      // `key` es una de las tres claves de `fixed`.
      if (Object.hasOwn(input, key) && input[key] !== fixed[key as keyof typeof fixed]) errors[key] = 'Este campo no se puede modificar.';
    }
  }

  const fields = emptyFields('');
  for (const field of editable) {
    // `field` sale de las claves de `definitions`: siempre tiene regla.
    applyRule(field, definitions[field] as FieldRule, input[field], fields, errors);
  }

  let available: boolean | null = null;
  if (mode === 'update') available = booleanValue(input.available, 'available', errors);

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { fields, available } };
}

// --- Representación de salida (API) -----------------------------------------------

/** Precio en pesos con dos decimales ("45.00"). */
export const pesos = (cents: number): string => centsToInput(cents);

/** Campos editables de un producto en la forma de entrada (formularios, comparación). */
export function toInput(product: Product): Record<string, unknown> {
  const definitions = fieldDefinitions(product);
  const result: Record<string, unknown> = {};
  for (const field of Object.keys(definitions) as InputField[]) {
    switch (field) {
      case 'price':
        result.price = product.priceCents === null ? null : pesos(product.priceCents);
        break;
      case 'orderPrice':
        result.orderPrice = product.orderPriceCents === null ? null : pesos(product.orderPriceCents);
        break;
      case 'variants':
        result.variants = product.variants.map((variant) => ({
          label: variant.label,
          price: pesos(variant.priceCents),
          description: variant.description,
          available: variant.available,
        }));
        break;
      case 'chips':
        result.chips = product.chips.map((chip) => ({ ...chip }));
        break;
      case 'image':
        result.image = product.image ? { ...product.image } : null;
        break;
      default:
        result[field] = product[field];
    }
  }
  return result;
}

/** Valores comparables de un producto para el registro (precios en centavos, RF-8.3). */
export function changeSnapshot(product: Product): Record<string, unknown> {
  const definitions = fieldDefinitions(product);
  const snapshot: Record<string, unknown> = {
    available: product.available,
    position: product.position,
    deleted: product.deleted,
  };
  for (const field of Object.keys(definitions) as InputField[]) {
    if (field === 'price') snapshot.priceCents = product.priceCents;
    else if (field === 'orderPrice') snapshot.orderPriceCents = product.orderPriceCents;
    else snapshot[field] = structuredClone(product[field]);
  }
  return snapshot;
}
