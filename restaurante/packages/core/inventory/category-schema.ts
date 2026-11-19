import type { FieldErrors } from './errors.ts';
import { nameKey, readName } from './text.ts';

/** Categoría del inventario (REQ-F-049, RF-6): lista administrable; se inactiva, no se borra. */

export const CATEGORY_NAME_MAX = 60;

export interface InventoryCategory {
  id: number;
  name: string;
  nameKey: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryFieldsInput {
  name?: unknown;
}

export type CategoryFieldsResult = { ok: true; value: { name: string; nameKey: string } } | { ok: false; errors: FieldErrors };

export function validateCategoryFields(input: CategoryFieldsInput): CategoryFieldsResult {
  const name = readName(input.name, CATEGORY_NAME_MAX);
  if ('error' in name) return { ok: false, errors: { name: name.error } };
  return { ok: true, value: { name: name.value, nameKey: nameKey(name.value) } };
}
