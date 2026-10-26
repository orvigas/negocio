import { BUSINESS, type BusinessId } from '../config/businesses.ts';
import { isValidPriceCents } from './price.ts';

/**
 * Esquema de los datos editables por negocio (REQ-F-001, RF-2 y RF-3).
 *
 * Un único esquema declarativo sirve para:
 *  - validar el JSON guardado (arranque, restauraciones): `validateMenuData`;
 *  - leer el formulario de administración: src/services/admin-form.ts;
 *  - pintar el formulario: src/views/admin/.
 *
 * La estructura (cantidad y orden de productos, chips y variantes; `id`, `slug` y
 * `detailsType`) no es editable: se compara siempre contra un documento de referencia.
 *
 * REQ-F-008 (Q-3 A): los productos pasan a la base de datos. El documento conserva este formato
 * (v1) con las listas de productos "congeladas", pero el formulario, el guardado y el registro
 * trabajan solo con los datos de página (`getPageSchema`: hero, texto destacado y promociones).
 */

export const SCHEMA_VERSION = 1;

export const MOLOTES_TONES = Object.freeze(['secondary', 'primary', 'tertiary', 'sky', 'amber', 'red', 'gold']);
export const DRINK_TONES = Object.freeze(['amber', 'red']);

export const AUTHOR_MAX_LENGTH = 60;
export const KEY_PATTERN = /^[a-z0-9-]{1,60}$/;
export const ICON_PATTERN = /^[a-z0-9_]{1,40}$/;
/** Máximo de la ruta de imagen (REQ-F-014, P-3): cabe en la columna `image_src` (VARCHAR(255)). */
export const IMAGE_SRC_MAX_LENGTH = 255;
export const IMAGE_SRC_PATTERN = /^\/img\/[A-Za-z0-9/_.-]+\.(?:jpg|jpeg|png|webp)$/;
const IMAGE_SIZE = Object.freeze({ min: 1, max: 4000 });

// --- Tipos de los nodos del esquema ---------------------------------------------

/** Objeto JSON ya comprobado como objeto plano (sus valores aún sin validar). */
export type JsonObject = Record<string, unknown>;
/** Título del fieldset de un objeto o unión, calculado a partir de su valor. */
export type LegendFn = (value: JsonObject, index: number) => string;

export interface TextNode { readonly kind: 'text'; readonly label: string; readonly max: number; readonly optional: boolean }
export interface PriceNode { readonly kind: 'price'; readonly label: string }
export interface IntNode { readonly kind: 'int'; readonly label: string; readonly min: number; readonly max: number }
export interface BoolNode { readonly kind: 'bool'; readonly label: string }
export interface EnumNode { readonly kind: 'enum'; readonly label: string; readonly options: readonly string[] }
export interface IconNode { readonly kind: 'icon'; readonly label: string }
export interface ImageSrcNode { readonly kind: 'imageSrc'; readonly label: string }
export interface KeyNode { readonly kind: 'key'; readonly label: string }
export interface ObjectNode {
  readonly kind: 'object';
  readonly fields: Readonly<Record<string, SchemaNode>>;
  readonly legend: LegendFn | undefined;
}
export interface ListNode { readonly kind: 'list'; readonly item: SchemaNode }
export interface UnionNode {
  readonly kind: 'union';
  readonly tag: string;
  readonly variants: Readonly<Record<string, ObjectNode>>;
  readonly legend: LegendFn | undefined;
}
export type LeafNode = TextNode | PriceNode | IntNode | BoolNode | EnumNode | IconNode | ImageSrcNode | KeyNode;
export type SchemaNode = LeafNode | ObjectNode | ListNode | UnionNode;

// --- Tipos de los datos editables (forma garantizada por validateMenuData) -------

export interface ImageData { src: string; alt: string; width: number; height: number }
export interface PromoData { badge: string; title: string; description: string }

export interface MolotesItem {
  id: string;
  name: string;
  description: string;
  badge: string;
  tone: string;
  unitPriceCents: number;
  orderPriceCents: number;
  orderQuantity: number;
  available: boolean;
  image: ImageData;
}
export interface MolotesDrink {
  id: string;
  name: string;
  description: string;
  icon: string;
  tone: string;
  priceCents: number;
  available: boolean;
}
export interface MolotesMenuData {
  hero: { showcase: { tag: string; title: string; description: string; priceCents: number; unit: string } };
  menu: { highlight: string; items: MolotesItem[] };
  drinks: { items: MolotesDrink[] };
  promo: PromoData;
}

interface BirriaItemBase {
  slug: string;
  name: string;
  tag: string;
  available: boolean;
  image: ImageData;
  detailsLabel: string;
}
interface BirriaOwnPrice { description: string; priceCents: number; priceUnit: string }
export interface BirriaChip { text: string; highlight: boolean }
export interface BirriaVariant { label: string; priceCents: number; description: string; available: boolean }
export interface BirriaChipsItem extends BirriaItemBase, BirriaOwnPrice { detailsType: 'chips'; chips: BirriaChip[] }
export interface BirriaPortionItem extends BirriaItemBase, BirriaOwnPrice {
  detailsType: 'portion';
  portion: string;
  portionExtra: string;
}
export interface BirriaVariantsItem extends BirriaItemBase { detailsType: 'variants'; variants: BirriaVariant[] }
export type BirriaItem = BirriaChipsItem | BirriaPortionItem | BirriaVariantsItem;
export interface BirriaMenuData {
  hero: { showcase: { title: string; description: string; priceCents: number } };
  menu: { items: BirriaItem[] };
  promo: PromoData;
}

export interface MenuDataByBusiness {
  molotes: MolotesMenuData;
  birria: BirriaMenuData;
}
export type MenuData = MenuDataByBusiness[BusinessId];

/** Sobre de un documento guardado (DATA_DIR) o de una semilla. */
export interface MenuDocument<Id extends BusinessId = BusinessId> {
  schemaVersion: number;
  business: Id;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  data: MenuDataByBusiness[Id];
}

export interface ValidationError {
  path: string;
  message: string;
}

// --- Constructores de nodos -------------------------------------------------

const text = (label: string, max: number, { optional = false } = {}): TextNode =>
  Object.freeze({ kind: 'text', label, max, optional });
const price = (label: string): PriceNode => Object.freeze({ kind: 'price', label });
const int = (label: string, min: number, max: number): IntNode => Object.freeze({ kind: 'int', label, min, max });
const bool = (label: string): BoolNode => Object.freeze({ kind: 'bool', label });
const choice = (label: string, options: readonly string[]): EnumNode => Object.freeze({ kind: 'enum', label, options });
const icon = (label: string): IconNode => Object.freeze({ kind: 'icon', label });
const imageSrc = (label: string): ImageSrcNode => Object.freeze({ kind: 'imageSrc', label });
/** Identificador no editable: debe coincidir con la referencia. */
const key = (label: string): KeyNode => Object.freeze({ kind: 'key', label });
const object = (fields: Record<string, SchemaNode>, { legend }: { legend?: LegendFn } = {}): ObjectNode =>
  Object.freeze({ kind: 'object', fields: Object.freeze(fields), legend });
const list = (item: SchemaNode): ListNode => Object.freeze({ kind: 'list', item });
const union = (tag: string, variants: Record<string, ObjectNode>, { legend }: { legend?: LegendFn } = {}): UnionNode =>
  Object.freeze({ kind: 'union', tag, variants: Object.freeze(variants), legend });

export const LEAF_KINDS = Object.freeze(['text', 'price', 'int', 'bool', 'enum', 'icon', 'imageSrc', 'key']);

const IMAGE = object(
  {
    src: imageSrc('Ruta de la imagen'),
    alt: text('Texto alternativo (alt)', 150),
    width: int('Ancho (px)', IMAGE_SIZE.min, IMAGE_SIZE.max),
    height: int('Alto (px)', IMAGE_SIZE.min, IMAGE_SIZE.max),
  },
  { legend: () => 'Imagen' },
);

const PROMO = object(
  {
    badge: text('Badge de la promoción', 120),
    title: text('Título de la promoción', 120),
    description: text('Descripción de la promoción', 400),
  },
  { legend: () => 'Promoción' },
);

const MOLOTES_HERO = object(
  {
    showcase: object({
      tag: text('Etiqueta', 40),
      title: text('Título', 120),
      description: text('Descripción', 400),
      priceCents: price('Precio'),
      unit: text('Texto de unidad', 40),
    }),
  },
  { legend: () => 'Showcase del hero' },
);
const MOLOTES_HIGHLIGHT = text('Texto destacado del menú', 120);

const MOLOTES_SCHEMA = object({
  hero: MOLOTES_HERO,
  menu: object(
    {
      highlight: MOLOTES_HIGHLIGHT,
      items: list(
        object(
          {
            id: key('Identificador'),
            name: text('Nombre', 80),
            description: text('Descripción', 400),
            badge: text('Badge', 40),
            tone: choice('Tono del badge', MOLOTES_TONES),
            unitPriceCents: price('Precio unitario'),
            orderPriceCents: price('Precio por orden'),
            orderQuantity: int('Cantidad por orden', 1, 20),
            available: bool('Disponible'),
            image: IMAGE,
          },
          { legend: (value) => String(value.name) },
        ),
      ),
    },
    { legend: () => 'Menú de molotes' },
  ),
  drinks: object(
    {
      items: list(
        object(
          {
            id: key('Identificador'),
            name: text('Nombre', 80),
            description: text('Descripción', 400),
            icon: icon('Icono (Material Symbols)'),
            tone: choice('Tono del icono', DRINK_TONES),
            priceCents: price('Precio'),
            available: bool('Disponible'),
          },
          { legend: (value) => String(value.name) },
        ),
      ),
    },
    { legend: () => 'Bebidas' },
  ),
  promo: PROMO,
});

const BIRRIA_COMMON = Object.freeze({
  slug: key('Identificador'),
  name: text('Nombre', 80),
  tag: text('Etiqueta (tag)', 40),
  available: bool('Disponible'),
  image: IMAGE,
  detailsType: key('Tipo de detalle'),
  detailsLabel: text('Título del bloque de detalle', 40),
});

const BIRRIA_OWN_PRICE = Object.freeze({
  description: text('Descripción', 400),
  priceCents: price('Precio'),
  priceUnit: text('Unidad de precio (opcional, p. ej. "c/u")', 40, { optional: true }),
});

const BIRRIA_HERO = object(
  {
    showcase: object({
      title: text('Título', 120),
      description: text('Descripción', 400),
      priceCents: price('Precio'),
    }),
  },
  { legend: () => 'Showcase del hero' },
);

const BIRRIA_SCHEMA = object({
  hero: BIRRIA_HERO,
  menu: object(
    {
      items: list(
        union(
          'detailsType',
          {
            chips: object({
              ...BIRRIA_COMMON,
              ...BIRRIA_OWN_PRICE,
              chips: list(
                object(
                  { text: text('Texto del chip', 40), highlight: bool('Resaltado') },
                  { legend: (_value, index) => `Chip ${index + 1}` },
                ),
              ),
            }),
            portion: object({
              ...BIRRIA_COMMON,
              ...BIRRIA_OWN_PRICE,
              portion: text('Porción', 40),
              portionExtra: text('Extra', 40),
            }),
            // Con variantes, el precio y la descripción son los de la variante activa (RF-2).
            variants: object({
              ...BIRRIA_COMMON,
              variants: list(
                object(
                  {
                    label: text('Etiqueta de la variante', 40),
                    priceCents: price('Precio'),
                    description: text('Descripción', 400),
                    available: bool('Disponible'),
                  },
                  { legend: (value, index) => `Variante ${index + 1}: ${String(value.label)}` },
                ),
              ),
            }),
          },
          { legend: (value) => String(value.name) },
        ),
      ),
    },
    { legend: () => 'Menú de birria' },
  ),
  promo: PROMO,
});

const SCHEMAS: Readonly<Record<BusinessId, ObjectNode>> = Object.freeze({
  [BUSINESS.MOLOTES]: MOLOTES_SCHEMA,
  [BUSINESS.BIRRIA]: BIRRIA_SCHEMA,
});

export function getMenuSchema(businessId: BusinessId): ObjectNode {
  if (!Object.hasOwn(SCHEMAS, businessId)) throw new Error(`No hay esquema para el negocio: ${businessId}`);
  return SCHEMAS[businessId];
}

// --- Datos de página (REQ-F-008, Q-3 A) ------------------------------------------------

/** Datos editables que siguen en el JSON: hero, texto destacado (Molotes) y promociones. */
export interface PageDataByBusiness {
  molotes: { hero: MolotesMenuData['hero']; menu: { highlight: string }; promo: PromoData };
  birria: { hero: BirriaMenuData['hero']; promo: PromoData };
}
export type PageData = PageDataByBusiness[BusinessId];

const PAGE_SCHEMAS: Readonly<Record<BusinessId, ObjectNode>> = Object.freeze({
  [BUSINESS.MOLOTES]: object({
    hero: MOLOTES_HERO,
    menu: object({ highlight: MOLOTES_HIGHLIGHT }, { legend: () => 'Menú de molotes' }),
    promo: PROMO,
  }),
  [BUSINESS.BIRRIA]: object({ hero: BIRRIA_HERO, promo: PROMO }),
});

/** Esquema del formulario de página (sin productos). */
export function getPageSchema(businessId: BusinessId): ObjectNode {
  if (!Object.hasOwn(PAGE_SCHEMAS, businessId)) throw new Error(`No hay esquema para el negocio: ${businessId}`);
  return PAGE_SCHEMAS[businessId];
}

/** Datos de página de un documento completo (copia). */
export function pickPageData<Id extends BusinessId>(businessId: Id, data: MenuDataByBusiness[Id]): PageDataByBusiness[Id] {
  if (businessId === BUSINESS.MOLOTES) {
    // Negocio Molotes: los datos tienen la forma de Molotes.
    const molotes = data as MolotesMenuData;
    const page: PageDataByBusiness['molotes'] = structuredClone({ hero: molotes.hero, menu: { highlight: molotes.menu.highlight }, promo: molotes.promo });
    return page;
  }
  const birria = data as BirriaMenuData;
  const page: PageDataByBusiness['birria'] = structuredClone({ hero: birria.hero, promo: birria.promo });
  return page as PageDataByBusiness[Id];
}

/** Documento completo con los datos de página nuevos y las listas de productos tal cual (congeladas). */
export function mergePageData<Id extends BusinessId>(businessId: Id, data: MenuDataByBusiness[Id], page: PageDataByBusiness[Id]): MenuDataByBusiness[Id] {
  if (businessId === BUSINESS.MOLOTES) {
    const molotes = data as MolotesMenuData;
    const molotesPage = page as PageDataByBusiness['molotes'];
    const merged: MolotesMenuData = structuredClone({
      ...molotes,
      hero: molotesPage.hero,
      menu: { ...molotes.menu, highlight: molotesPage.menu.highlight },
      promo: molotesPage.promo,
    });
    return merged as MenuDataByBusiness[Id];
  }
  const birria = data as BirriaMenuData;
  const birriaPage = page;
  const merged: BirriaMenuData = structuredClone({ ...birria, hero: birriaPage.hero, promo: birriaPage.promo });
  return merged as MenuDataByBusiness[Id];
}

// --- Reglas de las hojas ------------------------------------------------------

/** Longitud en puntos de código (no en unidades UTF-16). */
export const textLength = (value: string): number => [...value].length;

export const isPlainObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/** Equivale a `container?.[key]` sobre un valor JSON sin validar. */
export const childOf = (container: unknown, key: string | number): unknown =>
  // Cualquier valor no nulo admite el acceso por propiedad, igual que `?.[]`.
  container == null ? undefined : (container as Record<string | number, unknown>)[key];

/** Mensaje de error de un texto ya recortado, o null si es válido. */
export function textError(node: TextNode, value: string): string | null {
  if (!node.optional && value.trim() === '') return 'Este campo es obligatorio.';
  if (textLength(value) > node.max) return `Máximo ${node.max} caracteres.`;
  return null;
}

/** Ruta de imagen con formato válido (la existencia del archivo se comprueba al guardar, DT-6). */
export function imageSrcError(value: unknown): string | null {
  if (typeof value !== 'string' || !IMAGE_SRC_PATTERN.test(value) || value.includes('..') || value.includes('//')) {
    return 'La ruta debe empezar con /img/, terminar en .jpg, .jpeg, .png o .webp y no contener "..".';
  }
  if (value.length > IMAGE_SRC_MAX_LENGTH) return `La ruta es demasiado larga (máximo ${IMAGE_SRC_MAX_LENGTH} caracteres).`;
  return null;
}

/** Valida una hoja ya tipada (documento JSON). Devuelve un mensaje o null. */
function leafError(node: LeafNode, value: unknown, reference: unknown): string | null {
  switch (node.kind) {
    case 'text':
      return typeof value === 'string' ? textError(node, value) : 'Debe ser texto.';
    case 'price':
      return isValidPriceCents(value) ? null : 'Precio fuera de rango o con más de 2 decimales.';
    case 'int':
      return typeof value === 'number' && Number.isInteger(value) && value >= node.min && value <= node.max ? null : `Debe ser un entero de ${node.min} a ${node.max}.`;
    case 'bool':
      return typeof value === 'boolean' ? null : 'Debe ser verdadero o falso.';
    case 'enum':
      // Se amplía el tipo de la lista para buscar un valor aún sin validar.
      return (node.options as readonly unknown[]).includes(value) ? null : 'Valor fuera de la lista permitida.';
    case 'icon':
      return typeof value === 'string' && ICON_PATTERN.test(value) ? null : 'Solo minúsculas, dígitos y "_".';
    case 'imageSrc':
      return imageSrcError(value);
    case 'key':
      if (typeof value !== 'string' || !KEY_PATTERN.test(value)) return 'Identificador inválido.';
      return value === reference ? null : 'La estructura no se puede modificar.';
    default:
      throw new Error(`Tipo de nodo desconocido: ${String((node as { kind: unknown }).kind)}`);
  }
}

/** Resuelve el nodo concreto de una unión según la etiqueta del valor de referencia. */
export function resolveUnion(node: UnionNode, reference: unknown): ObjectNode | undefined {
  const tag = childOf(reference, node.tag);
  return typeof tag === 'string' && Object.hasOwn(node.variants, tag) ? node.variants[tag] : undefined;
}

function validateNode(node: SchemaNode, value: unknown, reference: unknown, path: string[], errors: ValidationError[]): void {
  const fail = (message: string, at = path) => errors.push({ path: at.join('.'), message });

  if (node.kind === 'object') {
    if (!isPlainObject(value)) {
      fail('Debe ser un objeto.');
      return;
    }
    const expected = Object.keys(node.fields);
    for (const name of Object.keys(value)) {
      if (!expected.includes(name)) fail('Campo desconocido.', [...path, name]);
    }
    for (const name of expected) {
      const field = node.fields[name];
      if (field !== undefined && Object.hasOwn(value, name)) {
        validateNode(field, value[name], childOf(reference, name), [...path, name], errors);
      } else {
        fail('Falta el campo.', [...path, name]);
      }
    }
    return;
  }

  if (node.kind === 'list') {
    if (!Array.isArray(value)) {
      fail('Debe ser una lista.');
    } else if (!Array.isArray(reference) || value.length !== reference.length) {
      fail('La estructura no se puede modificar.');
    } else {
      value.forEach((item, index) => validateNode(node.item, item, reference[index], [...path, String(index)], errors));
    }
    return;
  }

  if (node.kind === 'union') {
    const concrete = resolveUnion(node, reference);
    if (!concrete || !isPlainObject(value) || value[node.tag] !== childOf(reference, node.tag)) {
      fail('La estructura no se puede modificar.');
    } else {
      validateNode(concrete, value, reference, path, errors);
    }
    return;
  }

  const message = leafError(node, value, reference);
  if (message) fail(message);
}

/**
 * Valida los datos editables de un negocio contra su esquema y una referencia de estructura
 * (normalmente la semilla). Para validar la propia semilla, usar la semilla como referencia.
 *
 * Devuelve una lista vacía si es válido.
 */
export function validateMenuData(businessId: BusinessId, data: unknown, reference: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  validateNode(getMenuSchema(businessId), data, reference, [], errors);
  return errors;
}

/** Valida los datos de página (hero, destacado y promociones; sin listas). */
export function validatePageData(businessId: BusinessId, data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  validateNode(getPageSchema(businessId), data, undefined, [], errors);
  return errors;
}

/** Valida el sobre completo de un documento guardado. */
export function validateMenuDocument(businessId: BusinessId, document: unknown, referenceData: unknown): ValidationError[] {
  if (!isPlainObject(document)) return [{ path: '', message: 'El documento debe ser un objeto.' }];
  const errors: ValidationError[] = [];
  const allowed = ['schemaVersion', 'business', 'revision', 'updatedAt', 'updatedBy', 'data'];
  for (const name of Object.keys(document)) {
    if (!allowed.includes(name)) errors.push({ path: name, message: 'Campo desconocido.' });
  }
  if (document.schemaVersion !== SCHEMA_VERSION) errors.push({ path: 'schemaVersion', message: 'Versión de esquema no soportada.' });
  if (document.business !== businessId) errors.push({ path: 'business', message: 'El documento es de otro negocio.' });
  if (typeof document.revision !== 'number' || !Number.isSafeInteger(document.revision) || document.revision < 0) {
    errors.push({ path: 'revision', message: 'Revisión inválida.' });
  }
  if (document.updatedAt !== null && (typeof document.updatedAt !== 'string' || Number.isNaN(Date.parse(document.updatedAt)))) {
    errors.push({ path: 'updatedAt', message: 'Fecha inválida.' });
  }
  if (
    document.updatedBy !== null &&
    (typeof document.updatedBy !== 'string' || document.updatedBy.trim() === '' || textLength(document.updatedBy) > AUTHOR_MAX_LENGTH)
  ) {
    errors.push({ path: 'updatedBy', message: 'Autor inválido.' });
  }
  if (!Object.hasOwn(document, 'data')) {
    errors.push({ path: 'data', message: 'Falta el campo.' });
  } else {
    errors.push(...validateMenuData(businessId, document.data, referenceData));
  }
  return errors;
}
