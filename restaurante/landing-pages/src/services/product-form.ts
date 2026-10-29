import {
  POSITION_OPTIONS,
  ROW_SLOTS,
  pesos,
  productFormLeaves,
  type FieldErrors,
  type FormLeaf,
  type Product,
  type ProductKind,
  type RowKind,
} from '@restaurante/core/catalog';

import { CHECKBOX_VALUE } from './admin-form.ts';

/**
 * Formulario HTML de un producto (REQ-F-008, RF-6 y DT-12) <-> entrada de la API. Los campos del
 * formulario (`productFormLeaves`) están en core/catalog desde REQ-F-039: la API los sirve como
 * descriptor al admin nuevo.
 *
 * Los nombres de campo son planos ("price", "image.src", "variants.2.label"). Variantes y chips
 * se muestran en 6 filas fijas: cada fila tiene sus campos, una "Posición" (1 a 6) y "Quitar".
 * Las filas vacías o marcadas para quitar se ignoran; el resto se ordena por posición. Así se
 * agregan, quitan y reordenan sin JavaScript. Las reglas son las mismas de la API
 * (validateProductInput); aquí solo se traduce la forma y los errores vuelven a su fila.
 */

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
