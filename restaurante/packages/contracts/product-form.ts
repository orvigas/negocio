import type { AdminProduct, ProductFormField } from './admin.ts';

/**
 * Formulario HTML de un producto <-> entrada de `/api/v1/admin` (REQ-F-039), guiado por el
 * descriptor que sirve la API (`/productos/campos`, que sale de core). Misma forma que el
 * formulario del /admin actual (REQ-F-008, RF-6 y DT-12): nombres planos ("price", "image.src",
 * "variants.2.label"); variantes y chips en filas fijas con "Posición" y "Quitar". Las filas vacías o
 * marcadas para quitar se ignoran y el resto se ordena por posición: así se agregan, quitan y
 * reordenan sin JavaScript. Aquí no hay reglas de validación: las aplica la API (422 con `fields`).
 */

export const CHECKBOX_VALUE = 'on';

type RowKind = 'chips' | 'variants';
const ROW_KINDS: readonly RowKind[] = ['chips', 'variants'];
/** Campos de texto que deciden si una fila está vacía. */
const ROW_TEXT_KEYS: Readonly<Record<RowKind, readonly string[]>> = { chips: ['text'], variants: ['label', 'price', 'description'] };

export interface ProductFormResult {
  /** Entrada con la forma de la API. */
  input: Record<string, unknown>;
  /** Lo escrito, para volver a pintar el formulario. */
  values: Record<string, string>;
  /** Una casilla con un valor imposible: formulario manipulado (400). */
  structureError: boolean;
  /** Fila del formulario de cada elemento de `variants`/`chips` (para devolver los errores a su fila). */
  slots: Record<RowKind, number[]>;
}

const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';

/** Nombres de campo que admite el formulario de una combinación, además de los de control. */
export const productFormFieldNames = (fields: readonly ProductFormField[]): string[] => fields.map((field) => field.name);

export function parseProductForm(fields: readonly ProductFormField[], form: ReadonlyMap<string, string>): ProductFormResult {
  const values: Record<string, string> = {};
  const input: Record<string, unknown> = {};
  const slots: Record<RowKind, number[]> = { chips: [], variants: [] };
  let structureError = false;

  const read = (field: ProductFormField): string | boolean => {
    const raw = form.get(field.name);
    if (field.kind === 'bool') {
      if (raw !== undefined && raw !== CHECKBOX_VALUE) structureError = true;
      values[field.name] = raw === CHECKBOX_VALUE ? CHECKBOX_VALUE : '';
      return raw === CHECKBOX_VALUE;
    }
    values[field.name] = raw ?? '';
    return raw ?? '';
  };

  for (const field of fields.filter((candidate) => candidate.group === 'main')) input[field.name] = read(field);

  const image: Record<string, unknown> = {};
  for (const field of fields.filter((candidate) => candidate.group === 'image')) image[field.name.slice('image.'.length)] = read(field);
  if (Object.keys(image).length > 0) input.image = image;

  for (const rows of ROW_KINDS) {
    const rowFields = fields.filter((field) => field.group === rows);
    if (rowFields.length === 0) continue;
    const slotCount = Math.max(...rowFields.map((field) => (field.slot ?? 0) + 1));
    const used: { slot: number; position: number; row: Record<string, unknown> }[] = [];
    for (let slot = 0; slot < slotCount; slot += 1) {
      const row: Record<string, unknown> = {};
      let remove = false;
      let position = slot + 1;
      for (const field of rowFields.filter((candidate) => candidate.slot === slot)) {
        const key = field.name.slice(`${rows}.${slot}.`.length);
        const value = read(field);
        if (key === 'remove') remove = value === true;
        else if (key === 'position') position = typeof value === 'string' && (field.options ?? []).includes(value) ? Number(value) : slot + 1;
        else row[key] = value;
      }
      const empty = ROW_TEXT_KEYS[rows].every((key) => isBlank(row[key]));
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
export function formErrors(errors: Readonly<Record<string, string>>, slots: ProductFormResult['slots']): Record<string, string> {
  const result: Record<string, string> = {};
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

const text = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

/** Valores del formulario a partir de un producto guardado (edición). */
export function productFormValues(fields: readonly ProductFormField[], product: AdminProduct): Record<string, string> {
  const values: Record<string, string> = {};
  const record = product as unknown as Record<string, unknown>;
  for (const field of fields) {
    const [first = '', second = '', third = ''] = field.name.split('.');
    let value: unknown;
    if (field.group === 'main') value = record[first];
    else if (field.group === 'image') value = (product.image as Record<string, unknown> | null | undefined)?.[second];
    else {
      const slot = Number(second);
      const rows = (field.group === 'chips' ? product.chips : product.variants) ?? [];
      const row = rows[slot] as Record<string, unknown> | undefined;
      if (third === 'position') value = String(slot + 1);
      else if (third === 'remove') value = false;
      else value = row?.[third];
    }
    values[field.name] = field.kind === 'bool' ? (value === true ? CHECKBOX_VALUE : '') : text(value);
  }
  return values;
}

/** Valores de un formulario nuevo: filas vacías con su posición; una variante nueva empieza disponible. */
export function emptyProductFormValues(fields: readonly ProductFormField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.name.endsWith('.position')) values[field.name] = String((field.slot ?? 0) + 1);
    else if (field.group === 'variants' && field.name.endsWith('.available')) values[field.name] = CHECKBOX_VALUE;
    else values[field.name] = '';
  }
  return values;
}
