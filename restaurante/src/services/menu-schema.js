import { BUSINESS } from '../config/businesses.js';
import { isValidPriceCents } from './price.js';

/**
 * Esquema de los datos editables por negocio (REQ-F-001, RF-2 y RF-3).
 *
 * Un único esquema declarativo sirve para:
 *  - validar el JSON guardado (arranque, restauraciones): `validateMenuData`;
 *  - leer el formulario de administración: src/services/admin-form.js;
 *  - pintar el formulario: src/views/admin/.
 *
 * La estructura (cantidad y orden de productos, chips y variantes; `id`, `slug` y
 * `detailsType`) no es editable: se compara siempre contra un documento de referencia.
 */

export const SCHEMA_VERSION = 1;

export const MOLOTES_TONES = Object.freeze(['secondary', 'primary', 'tertiary', 'sky', 'amber', 'red', 'gold']);
export const DRINK_TONES = Object.freeze(['amber', 'red']);

export const AUTHOR_MAX_LENGTH = 60;
export const KEY_PATTERN = /^[a-z0-9-]{1,60}$/;
export const ICON_PATTERN = /^[a-z0-9_]{1,40}$/;
export const IMAGE_SRC_PATTERN = /^\/img\/[A-Za-z0-9/_.-]+\.(?:jpg|jpeg|png|webp)$/;
const IMAGE_SIZE = Object.freeze({ min: 1, max: 4000 });

// --- Constructores de nodos -------------------------------------------------

const text = (label, max, { optional = false } = {}) => Object.freeze({ kind: 'text', label, max, optional });
const price = (label) => Object.freeze({ kind: 'price', label });
const int = (label, min, max) => Object.freeze({ kind: 'int', label, min, max });
const bool = (label) => Object.freeze({ kind: 'bool', label });
const choice = (label, options) => Object.freeze({ kind: 'enum', label, options });
const icon = (label) => Object.freeze({ kind: 'icon', label });
const imageSrc = (label) => Object.freeze({ kind: 'imageSrc', label });
/** Identificador no editable: debe coincidir con la referencia. */
const key = (label) => Object.freeze({ kind: 'key', label });
const object = (fields, { legend } = {}) => Object.freeze({ kind: 'object', fields: Object.freeze(fields), legend });
const list = (item) => Object.freeze({ kind: 'list', item });
const union = (tag, variants, { legend } = {}) => Object.freeze({ kind: 'union', tag, variants: Object.freeze(variants), legend });

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

const MOLOTES_SCHEMA = object({
  hero: object(
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
  ),
  menu: object(
    {
      highlight: text('Texto destacado del menú', 120),
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
          { legend: (value) => value.name },
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
          { legend: (value) => value.name },
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

const BIRRIA_SCHEMA = object({
  hero: object(
    {
      showcase: object({
        title: text('Título', 120),
        description: text('Descripción', 400),
        priceCents: price('Precio'),
      }),
    },
    { legend: () => 'Showcase del hero' },
  ),
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
                  { legend: (value, index) => `Variante ${index + 1}: ${value.label}` },
                ),
              ),
            }),
          },
          { legend: (value) => value.name },
        ),
      ),
    },
    { legend: () => 'Menú de birria' },
  ),
  promo: PROMO,
});

const SCHEMAS = Object.freeze({
  [BUSINESS.MOLOTES]: MOLOTES_SCHEMA,
  [BUSINESS.BIRRIA]: BIRRIA_SCHEMA,
});

/** @param {'molotes'|'birria'} businessId */
export function getMenuSchema(businessId) {
  if (!Object.hasOwn(SCHEMAS, businessId)) throw new Error(`No hay esquema para el negocio: ${businessId}`);
  return SCHEMAS[businessId];
}

// --- Reglas de las hojas ------------------------------------------------------

/** Longitud en puntos de código (no en unidades UTF-16). */
export const textLength = (value) => [...value].length;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/** Mensaje de error de un texto ya recortado, o null si es válido. */
export function textError(node, value) {
  if (!node.optional && value.trim() === '') return 'Este campo es obligatorio.';
  if (textLength(value) > node.max) return `Máximo ${node.max} caracteres.`;
  return null;
}

/** Ruta de imagen con formato válido (la existencia del archivo se comprueba al guardar, DT-6). */
export function imageSrcError(value) {
  if (typeof value !== 'string' || !IMAGE_SRC_PATTERN.test(value) || value.includes('..') || value.includes('//')) {
    return 'La ruta debe empezar con /img/, terminar en .jpg, .jpeg, .png o .webp y no contener "..".';
  }
  return null;
}

/** Valida una hoja ya tipada (documento JSON). Devuelve un mensaje o null. */
function leafError(node, value, reference) {
  switch (node.kind) {
    case 'text':
      return typeof value === 'string' ? textError(node, value) : 'Debe ser texto.';
    case 'price':
      return isValidPriceCents(value) ? null : 'Precio fuera de rango o con más de 2 decimales.';
    case 'int':
      return Number.isInteger(value) && value >= node.min && value <= node.max ? null : `Debe ser un entero de ${node.min} a ${node.max}.`;
    case 'bool':
      return typeof value === 'boolean' ? null : 'Debe ser verdadero o falso.';
    case 'enum':
      return node.options.includes(value) ? null : 'Valor fuera de la lista permitida.';
    case 'icon':
      return typeof value === 'string' && ICON_PATTERN.test(value) ? null : 'Solo minúsculas, dígitos y "_".';
    case 'imageSrc':
      return imageSrcError(value);
    case 'key':
      if (typeof value !== 'string' || !KEY_PATTERN.test(value)) return 'Identificador inválido.';
      return value === reference ? null : 'La estructura no se puede modificar.';
    default:
      throw new Error(`Tipo de nodo desconocido: ${node.kind}`);
  }
}

/** Resuelve el nodo concreto de una unión según la etiqueta del valor de referencia. */
export function resolveUnion(node, reference) {
  const tag = reference?.[node.tag];
  return Object.hasOwn(node.variants, tag) ? node.variants[tag] : undefined;
}

function validateNode(node, value, reference, path, errors) {
  const fail = (message, at = path) => errors.push({ path: at.join('.'), message });

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
      if (Object.hasOwn(value, name)) {
        validateNode(node.fields[name], value[name], reference?.[name], [...path, name], errors);
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
    if (!concrete || !isPlainObject(value) || value[node.tag] !== reference[node.tag]) {
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
 * @returns {{ path: string, message: string }[]} Lista vacía si es válido.
 */
export function validateMenuData(businessId, data, reference) {
  const errors = [];
  validateNode(getMenuSchema(businessId), data, reference, [], errors);
  return errors;
}

/**
 * Valida el sobre completo de un documento guardado.
 * @returns {{ path: string, message: string }[]}
 */
export function validateMenuDocument(businessId, document, referenceData) {
  if (!isPlainObject(document)) return [{ path: '', message: 'El documento debe ser un objeto.' }];
  const errors = [];
  const allowed = ['schemaVersion', 'business', 'revision', 'updatedAt', 'updatedBy', 'data'];
  for (const name of Object.keys(document)) {
    if (!allowed.includes(name)) errors.push({ path: name, message: 'Campo desconocido.' });
  }
  if (document.schemaVersion !== SCHEMA_VERSION) errors.push({ path: 'schemaVersion', message: 'Versión de esquema no soportada.' });
  if (document.business !== businessId) errors.push({ path: 'business', message: 'El documento es de otro negocio.' });
  if (!Number.isSafeInteger(document.revision) || document.revision < 0) {
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
