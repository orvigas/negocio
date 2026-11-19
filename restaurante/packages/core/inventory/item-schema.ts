import { QUANTITY_SCALE, formatDecimal, parseDecimal } from './decimal.ts';
import type { FieldErrors } from './errors.ts';
import { readName, readOptionalText, nameKey } from './text.ts';
import { INVENTORY_UNITS, SYSTEM_UNIT_KEYS, isInventoryUnit, unitKey, type InventoryUnit, type PackagingUnit } from './units.ts';

/**
 * Artículo del inventario (REQ-F-049, RN-1, RF-2, RF-3 y RF-5): tipos, límites y validación de los
 * campos editables. Las reglas que dependen de otros datos (nombre único, SKU, categoría, padre)
 * viven en inventory-repository.ts.
 */

export const ITEM_TYPES = Object.freeze(['insumo', 'intermedio', 'compuesto', 'reventa'] as const);
export type ItemType = (typeof ITEM_TYPES)[number];

/** simple: artículo normal; parent: agrupa variantes; variant: hija de un parent (un solo nivel). */
export const ITEM_KINDS = Object.freeze(['simple', 'parent', 'variant'] as const);
export type ItemKind = (typeof ITEM_KINDS)[number];

/** Un padre solo agrupa variantes de Reventa o Compuesto (RF-5). */
export const PARENT_TYPES: readonly ItemType[] = Object.freeze(['reventa', 'compuesto']);

export const isItemType = (value: unknown): value is ItemType => typeof value === 'string' && (ITEM_TYPES as readonly string[]).includes(value);
export const isItemKind = (value: unknown): value is ItemKind => typeof value === 'string' && (ITEM_KINDS as readonly string[]).includes(value);

export const ITEM_LIMITS = Object.freeze({
  NAME_MAX: 80,
  DESCRIPTION_MAX: 400,
  SKU_MAX: 40,
  UNITS_MAX: 8,
  UNIT_NAME_MAX: 30,
  /** Factor máximo de un empaque: 1 000 000 unidades base (escala 3). */
  FACTOR_MAX: 1_000_000n * 10n ** BigInt(QUANTITY_SCALE),
});

const SKU_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Artículo guardado. */
export interface InventoryItem {
  id: number;
  kind: ItemKind;
  type: ItemType;
  parentId: number | null;
  categoryId: number;
  name: string;
  nameKey: string;
  description: string | null;
  /** SKU vigente tal como se escribió. */
  sku: string | null;
  /** null solo en un padre. */
  baseUnit: InventoryUnit | null;
  units: PackagingUnit[];
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedById: number | null;
  updatedByName: string | null;
}

/** Campos editables ya validados y normalizados. */
export interface ItemFields {
  name: string;
  nameKey: string;
  description: string | null;
  sku: string | null;
  baseUnit: InventoryUnit | null;
  units: PackagingUnit[];
}

/** Campos editables tal como llegan (sin validar). Los factores, como texto decimal («24»). */
export interface ItemFieldsInput {
  name?: unknown;
  description?: unknown;
  sku?: unknown;
  baseUnit?: unknown;
  units?: unknown;
}

export type ItemFieldsResult = { ok: true; value: ItemFields } | { ok: false; errors: FieldErrors };

/** Clave única de un SKU (PV-14): en mayúsculas. */
export const skuKey = (sku: string): string => sku.toUpperCase();

const isBlank = (value: unknown): boolean => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function readSku(raw: unknown, errors: FieldErrors): string | null {
  if (isBlank(raw)) return null;
  if (typeof raw !== 'string') {
    errors.sku = 'Debe ser texto.';
    return null;
  }
  const sku = raw.trim();
  if (sku.length > ITEM_LIMITS.SKU_MAX) errors.sku = `Máximo ${ITEM_LIMITS.SKU_MAX} caracteres.`;
  else if (!SKU_PATTERN.test(sku)) errors.sku = 'Usa solo letras sin acento, dígitos, punto, guion y guion bajo.';
  return sku;
}

/** Factor de un empaque: > 0, ≤ 1 000 000 y con 3 decimales como máximo (CA-6). */
export function readFactor(raw: unknown): { value: bigint } | { error: string } {
  const parsed = parseDecimal(raw);
  if (!parsed.ok) return { error: raw === undefined || raw === null || raw === '' ? 'Escribe el factor.' : parsed.error };
  if (parsed.value <= 0n) return { error: 'El factor debe ser mayor que 0.' };
  if (parsed.value > ITEM_LIMITS.FACTOR_MAX) return { error: 'El factor no puede pasar de 1 000 000.' };
  return { value: parsed.value };
}

function readUnits(raw: unknown, errors: FieldErrors): PackagingUnit[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.units = 'Debe ser una lista.';
    return [];
  }
  // Array.isArray lo tipa como any[]: sus elementos aún no están validados.
  const rows = raw as unknown[];
  if (rows.length > ITEM_LIMITS.UNITS_MAX) {
    errors.units = `Máximo ${ITEM_LIMITS.UNITS_MAX} unidades de empaque.`;
    return [];
  }
  const seen = new Set<string>();
  const units: PackagingUnit[] = [];
  for (const [index, row] of rows.entries()) {
    const path = `units.${index}`;
    if (!isRecord(row)) {
      errors[path] = 'Debe ser un objeto.';
      continue;
    }
    const name = readName(row.name, ITEM_LIMITS.UNIT_NAME_MAX, 'el nombre del empaque');
    const factor = readFactor(row.factor);
    if ('error' in name) errors[`${path}.name`] = name.error;
    else if (SYSTEM_UNIT_KEYS.has(unitKey(name.value))) errors[`${path}.name`] = `No puede llamarse como una unidad del sistema (${INVENTORY_UNITS.join(', ')}).`;
    else if (seen.has(unitKey(name.value))) errors[`${path}.name`] = 'Ya hay un empaque con ese nombre en el artículo.';
    if ('error' in factor) errors[`${path}.factor`] = factor.error;
    if ('value' in name) seen.add(unitKey(name.value));
    if ('value' in name && 'value' in factor) units.push({ name: name.value, factor: factor.value });
  }
  return units;
}

/**
 * Valida los campos editables de un artículo de la clase `kind`. Un padre no lleva unidad base, SKU
 * ni empaques (van en cada variante); el resto exige la unidad base.
 */
export function validateItemFields(input: ItemFieldsInput, kind: ItemKind): ItemFieldsResult {
  const errors: FieldErrors = {};
  const name = readName(input.name, ITEM_LIMITS.NAME_MAX);
  if ('error' in name) errors.name = name.error;
  const description = readOptionalText(input.description, ITEM_LIMITS.DESCRIPTION_MAX);
  if ('error' in description) errors.description = description.error;

  let baseUnit: InventoryUnit | null = null;
  let sku: string | null = null;
  let units: PackagingUnit[] = [];
  if (kind === 'parent') {
    if (!isBlank(input.baseUnit)) errors.baseUnit = 'Un artículo padre no lleva unidad base: va en cada variante.';
    if (!isBlank(input.sku)) errors.sku = 'Un artículo padre no lleva SKU: va en cada variante.';
    if (Array.isArray(input.units) ? input.units.length > 0 : !isBlank(input.units)) errors.units = 'Un artículo padre no lleva empaques: van en cada variante.';
  } else {
    if (isInventoryUnit(input.baseUnit)) baseUnit = input.baseUnit;
    else errors.baseUnit = `Elige la unidad base (${INVENTORY_UNITS.join(', ')}).`;
    sku = readSku(input.sku, errors);
    units = readUnits(input.units, errors);
  }

  if (Object.keys(errors).length > 0 || 'error' in name || 'error' in description) return { ok: false, errors };
  return { ok: true, value: { name: name.value, nameKey: nameKey(name.value), description: description.value, sku, baseUnit, units } };
}

/** Empaques como texto (historial y comparación): [{ name, factor: '24.000' }]. */
export const unitsSnapshot = (units: readonly PackagingUnit[]): { name: string; factor: string }[] =>
  units.map((unit) => ({ name: unit.name, factor: formatDecimal(unit.factor) }));
