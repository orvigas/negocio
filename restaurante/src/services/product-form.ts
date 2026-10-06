import { CHECKBOX_VALUE } from './admin-form.ts';
import type { LeafNode } from './menu-schema.ts';
import {
  MAX_ROWS,
  fieldDefinitions,
  pesos,
  type FieldErrors,
  type FieldRule,
  type InputField,
  type Product,
  type ProductKind,
} from './product-schema.ts';

/**
 * Formulario HTML de un producto (REQ-F-008, RF-6 y DT-12) <-> entrada de la API.
 *
 * Los nombres de campo son planos ("price", "image.src", "variants.2.label"). Variantes y chips
 * se muestran en 6 filas fijas: cada fila tiene sus campos, una "Posición" (1 a 6) y "Quitar".
 * Las filas vacías o marcadas para quitar se ignoran; el resto se ordena por posición. Así se
 * agregan, quitan y reordenan sin JavaScript. Las reglas son las mismas de la API
 * (validateProductInput); aquí solo se traduce la forma y los errores vuelven a su fila.
 */

export const ROW_SLOTS = MAX_ROWS;
const POSITION_OPTIONS = Object.freeze(Array.from({ length: ROW_SLOTS }, (_, index) => String(index + 1)));

/** Campo del formulario: nombre plano, nodo para pintarlo y a qué grupo pertenece. */
export interface FormLeaf {
  name: string;
  node: LeafNode;
  group: 'main' | 'image' | 'chips' | 'variants';
  /** Fila (0 a 5) de variantes o chips. */
  slot?: number;
}

type RowKind = 'chips' | 'variants';

const IMAGE_LEAVES: readonly [string, LeafNode][] = Object.freeze([
  ['src', { kind: 'imageSrc', label: 'Ruta de la imagen' }],
  ['alt', { kind: 'text', label: 'Texto alternativo (alt)', max: 150, optional: false }],
  ['width', { kind: 'int', label: 'Ancho (px)', min: 1, max: 4000 }],
  ['height', { kind: 'int', label: 'Alto (px)', min: 1, max: 4000 }],
]);

const ROW_LEAVES: Readonly<Record<RowKind, readonly [string, LeafNode][]>> = Object.freeze({
  chips: [
    ['text', { kind: 'text', label: 'Texto del chip', max: 40, optional: true }],
    ['highlight', { kind: 'bool', label: 'Resaltado' }],
  ],
  variants: [
    ['label', { kind: 'text', label: 'Etiqueta de la variante', max: 40, optional: true }],
    ['price', { kind: 'price', label: 'Precio' }],
    ['description', { kind: 'text', label: 'Descripción', max: 400, optional: true }],
    ['available', { kind: 'bool', label: 'Disponible' }],
  ],
});

const ROW_CONTROLS: readonly [string, LeafNode][] = Object.freeze([
  ['position', { kind: 'enum', label: 'Posición', options: POSITION_OPTIONS }],
  ['remove', { kind: 'bool', label: 'Quitar esta fila' }],
]);

function leafOf(rule: FieldRule): LeafNode | null {
  switch (rule.kind) {
    case 'text':
      return rule.node;
    case 'price':
      return { kind: 'price', label: rule.label };
    case 'int':
      return { kind: 'int', label: rule.label, min: rule.min, max: rule.max };
    case 'enum':
      return { kind: 'enum', label: rule.label, options: rule.options };
    case 'icon':
      return { kind: 'icon', label: rule.label };
    default:
      return null;
  }
}

/** Campos del formulario de una combinación, en el orden en que se pintan. */
export function productFormLeaves(kind: ProductKind, { withAvailable }: { withAvailable: boolean }): FormLeaf[] {
  const leaves: FormLeaf[] = [];
  const definitions = fieldDefinitions(kind);
  for (const [field, rule] of Object.entries(definitions) as [InputField, FieldRule][]) {
    const leaf = leafOf(rule);
    if (leaf) leaves.push({ name: field, node: leaf, group: 'main' });
  }
  if (withAvailable) leaves.push({ name: 'available', node: { kind: 'bool', label: 'Disponible (visible en la landing)' }, group: 'main' });
  if (definitions.image) {
    for (const [name, node] of IMAGE_LEAVES) leaves.push({ name: `image.${name}`, node, group: 'image' });
  }
  for (const rows of ['chips', 'variants'] as const) {
    if (!definitions[rows]) continue;
    for (let slot = 0; slot < ROW_SLOTS; slot += 1) {
      for (const [name, node] of [...ROW_LEAVES[rows], ...ROW_CONTROLS]) leaves.push({ name: `${rows}.${slot}.${name}`, node, group: rows, slot });
    }
  }
  return leaves;
}

/** Campos de control además de los del producto. */
export const PRODUCT_FORM_META = Object.freeze(['version', 'action', 'category', 'detailsType']);

export const productFormFieldNames = (kind: ProductKind, options: { withAvailable: boolean }): string[] => [
  ...productFormLeaves(kind, options).map((leaf) => leaf.name),
  ...PRODUCT_FORM_META,
];

export interface ProductFormResult {
  /** Entrada con la forma de la API (se valida con validateProductInput). */
  input: Record<string, unknown>;
  /** Lo escrito, para volver a pintar el formulario. */
  values: Record<string, string>;
  /** Una casilla con un valor imposible: formulario manipulado (400). */
  structureError: boolean;
  /** Fila del formulario de cada elemento de `variants`/`chips` (para devolver los errores a su fila). */
  slots: Record<RowKind, number[]>;
}

const isBlank = (value: string | undefined): boolean => value === undefined || value.trim() === '';

export function parseProductForm(kind: ProductKind, fields: Map<string, string>, { withAvailable }: { withAvailable: boolean }): ProductFormResult {
  const values: Record<string, string> = {};
  const input: Record<string, unknown> = {};
  const slots: Record<RowKind, number[]> = { chips: [], variants: [] };
  let structureError = false;
  const leaves = productFormLeaves(kind, { withAvailable });

  const read = (leaf: FormLeaf): string | boolean => {
    const raw = fields.get(leaf.name);
    if (leaf.node.kind === 'bool') {
      if (raw !== undefined && raw !== CHECKBOX_VALUE) structureError = true;
      values[leaf.name] = raw === CHECKBOX_VALUE ? CHECKBOX_VALUE : '';
      return raw === CHECKBOX_VALUE;
    }
    values[leaf.name] = raw ?? '';
    return raw ?? '';
  };

  for (const leaf of leaves.filter((candidate) => candidate.group === 'main')) input[leaf.name] = read(leaf);

  const image: Record<string, unknown> = {};
  for (const leaf of leaves.filter((candidate) => candidate.group === 'image')) image[leaf.name.slice('image.'.length)] = read(leaf);
  if (Object.keys(image).length > 0) input.image = image;

  for (const rows of ['chips', 'variants'] as const) {
    const rowLeaves = leaves.filter((leaf) => leaf.group === rows);
    if (rowLeaves.length === 0) continue;
    const used: { slot: number; position: number; row: Record<string, unknown> }[] = [];
    for (let slot = 0; slot < ROW_SLOTS; slot += 1) {
      const row: Record<string, unknown> = {};
      let remove = false;
      let position = slot + 1;
      for (const leaf of rowLeaves.filter((candidate) => candidate.slot === slot)) {
        const key = leaf.name.slice(`${rows}.${slot}.`.length);
        const value = read(leaf);
        if (key === 'remove') remove = value === true;
        else if (key === 'position') position = POSITION_OPTIONS.includes(String(value)) ? Number(value) : slot + 1;
        else row[key] = value;
      }
      const textKeys = rows === 'chips' ? ['text'] : ['label', 'price', 'description'];
      const empty = textKeys.every((key) => isBlank(row[key] as string | undefined));
      if (!remove && !empty) used.push({ slot, position, row });
    }
    // Con la misma posición, primero la fila que se movió a esa posición (la que el usuario cambió).
    const moved = (entry: { slot: number; position: number }): number => (entry.position === entry.slot + 1 ? 1 : 0);
    used.sort((a, b) => a.position - b.position || moved(a) - moved(b) || a.slot - b.slot);
    slots[rows] = used.map((entry) => entry.slot);
    input[rows] = used.map((entry) => entry.row);
  }

  return { input, values, structureError, slots };
}

/** Devuelve los errores de variantes/chips a la fila del formulario donde se escribieron. */
export function formErrors(errors: FieldErrors, slots: ProductFormResult['slots']): FieldErrors {
  const result: FieldErrors = {};
  for (const [path, message] of Object.entries(errors)) {
    const match = /^(chips|variants)\.(\d+)(\..+)?$/.exec(path);
    if (match) {
      const rows = match[1] as RowKind;
      const slot = slots[rows][Number(match[2])];
      result[slot === undefined ? rows : `${rows}.${slot}${match[3] ?? ''}`] = message;
    } else {
      result[path] = message;
    }
  }
  return result;
}

/** Valores del formulario a partir de un producto guardado (edición). */
export function productFormValues(product: Product, { withAvailable }: { withAvailable: boolean }): Record<string, string> {
  const values: Record<string, string> = {};
  for (const leaf of productFormLeaves(product, { withAvailable })) {
    const [first, second, third] = leaf.name.split('.');
    let value: unknown;
    if (leaf.group === 'main') {
      if (first === 'available') value = product.available;
      else if (first === 'price') value = product.priceCents === null ? '' : pesos(product.priceCents);
      else if (first === 'orderPrice') value = product.orderPriceCents === null ? '' : pesos(product.orderPriceCents);
      // `first` es un campo de la combinación (productFormLeaves).
      else value = product[first as keyof Product];
    } else if (leaf.group === 'image') {
      // `second` es src, alt, width o height.
      value = product.image?.[second as keyof NonNullable<Product['image']>];
    } else {
      const slot = Number(second);
      const rows = leaf.group === 'chips' ? product.chips : product.variants;
      const row = rows[slot] as Record<string, unknown> | undefined;
      if (third === 'position') value = String(slot + 1);
      else if (third === 'remove') value = false;
      else if (third === 'price') value = row ? pesos(row.priceCents as number) : '';
      // `third` es un campo de la fila (ROW_LEAVES).
      else value = row?.[third as string];
    }
    if (leaf.node.kind === 'bool') values[leaf.name] = value === true ? CHECKBOX_VALUE : '';
    else values[leaf.name] = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }
  return values;
}

/** Valores de un formulario nuevo (filas vacías con su posición). */
export function emptyProductFormValues(kind: ProductKind): Record<string, string> {
  const values: Record<string, string> = {};
  for (const leaf of productFormLeaves(kind, { withAvailable: false })) {
    values[leaf.name] = leaf.name.endsWith('.position') ? String((leaf.slot ?? 0) + 1) : '';
  }
  // Una fila nueva de variante empieza disponible.
  for (let slot = 0; slot < ROW_SLOTS; slot += 1) if (`variants.${slot}.available` in values) values[`variants.${slot}.available`] = CHECKBOX_VALUE;
  return values;
}
