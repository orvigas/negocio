import { QUANTITY_INTEGER_DIGITS, QUANTITY_SCALE, divideRounded, formatDecimal } from './decimal.ts';
import { InventoryError } from './errors.ts';

/**
 * Unidades y conversiones del inventario (REQ-F-049, RN-3, RF-3 y RF-4).
 *
 * - Unidades del sistema: kg y g (masa), L y ml (volumen) y pza (pieza). Dentro de una magnitud se
 *   convierte con factores fijos (1 kg = 1000 g; 1 L = 1000 ml).
 * - Entre magnitudes distintas o desde una presentación (caja → pza, bulto → kg) solo se convierte
 *   con una unidad de empaque propia del artículo, cuyo factor va hacia su unidad base.
 * - Una conversión sin factor se rechaza. Toda cantidad se expresa con escala 3 (decimal.ts).
 */

export const INVENTORY_UNITS = Object.freeze(['kg', 'g', 'L', 'ml', 'pza'] as const);
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const MAGNITUDES = Object.freeze(['mass', 'volume', 'piece'] as const);
export type Magnitude = (typeof MAGNITUDES)[number];

export const isInventoryUnit = (value: unknown): value is InventoryUnit =>
  typeof value === 'string' && (INVENTORY_UNITS as readonly string[]).includes(value);

/** Magnitud y factor de cada unidad hacia la menor de su magnitud (g, ml o pza). */
const SYSTEM_UNITS: Readonly<Record<InventoryUnit, { magnitude: Magnitude; factor: bigint }>> = Object.freeze({
  kg: { magnitude: 'mass', factor: 1000n },
  g: { magnitude: 'mass', factor: 1n },
  L: { magnitude: 'volume', factor: 1000n },
  ml: { magnitude: 'volume', factor: 1n },
  pza: { magnitude: 'piece', factor: 1n },
});

export const magnitudeOf = (unit: InventoryUnit): Magnitude => SYSTEM_UNITS[unit].magnitude;

/** Mayor cantidad que se guarda (DECIMAL(13,3)): 9 999 999 999.999. */
export const MAX_QUANTITY = 10n ** BigInt(QUANTITY_INTEGER_DIGITS + QUANTITY_SCALE) - 1n;

/** Unidad de empaque del artículo: `factor` unidades base (escala 3) por unidad. */
export interface PackagingUnit {
  name: string;
  factor: bigint;
}

/** Lo que una conversión necesita del artículo. */
export interface ConvertibleItem {
  /** null en un artículo padre (no tiene existencias). */
  baseUnit: InventoryUnit | null;
  units: readonly PackagingUnit[];
}

export const UNIT_CONVERSION_CODES = Object.freeze({
  UNAVAILABLE: 'UNIT_CONVERSION_UNAVAILABLE',
  UNKNOWN_UNIT: 'UNKNOWN_UNIT',
  TOO_SMALL: 'QUANTITY_TOO_SMALL',
  TOO_LARGE: 'QUANTITY_TOO_LARGE',
} as const);
export type UnitConversionCode = (typeof UNIT_CONVERSION_CODES)[keyof typeof UNIT_CONVERSION_CODES];

/** La conversión no es posible (sin factor, unidad desconocida o resultado fuera de rango). */
export class UnitConversionError extends InventoryError {
  readonly code: UnitConversionCode;

  constructor(code: UnitConversionCode, message: string) {
    super(message);
    this.name = 'UnitConversionError';
    this.code = code;
  }
}

/** Clave de comparación de un nombre de unidad (sin distinguir mayúsculas). */
export const unitKey = (name: string): string => name.trim().normalize('NFC').toLowerCase();

/** Claves de las unidades del sistema: un empaque no puede llamarse igual (sería ambiguo). */
export const SYSTEM_UNIT_KEYS: ReadonlySet<string> = new Set(INVENTORY_UNITS.map((unit) => unit.toLowerCase()));

function systemUnitOf(name: string): InventoryUnit | null {
  const key = unitKey(name);
  return INVENTORY_UNITS.find((unit) => unit.toLowerCase() === key) ?? null;
}

/** Factor de `from` hacia la base, como fracción exacta `numerator / denominator` (escala 3 en el numerador). */
function ratioToBase(from: string, item: ConvertibleItem & { baseUnit: InventoryUnit }): { numerator: bigint; denominator: bigint } | null {
  const system = systemUnitOf(from);
  if (system) {
    const source = SYSTEM_UNITS[system];
    const base = SYSTEM_UNITS[item.baseUnit];
    if (source.magnitude !== base.magnitude) return null;
    return { numerator: source.factor * 10n ** BigInt(QUANTITY_SCALE), denominator: base.factor };
  }
  const key = unitKey(from);
  const packaging = item.units.find((unit) => unitKey(unit.name) === key);
  return packaging ? { numerator: packaging.factor, denominator: 1n } : null;
}

const knownUnit = (from: string, item: ConvertibleItem): boolean =>
  systemUnitOf(from) !== null || item.units.some((unit) => unitKey(unit.name) === unitKey(from));

/**
 * Convierte `quantity` (escala 3) expresada en `from` (unidad del sistema o empaque del artículo) a
 * la unidad base del artículo, con escala 3 y redondeo de la mitad hacia arriba. Una cantidad positiva
 * que redondea a 0 se rechaza (no se puede guardar).
 */
export function convertToBase(quantity: bigint, from: string, item: ConvertibleItem): bigint {
  const { baseUnit } = item;
  if (baseUnit === null) throw new UnitConversionError(UNIT_CONVERSION_CODES.UNAVAILABLE, 'Un artículo padre no tiene unidad base: convierte en cada variante.');
  if (!knownUnit(from, item)) throw new UnitConversionError(UNIT_CONVERSION_CODES.UNKNOWN_UNIT, `La unidad «${from}» no existe en este artículo.`);
  const ratio = ratioToBase(from, { ...item, baseUnit });
  if (!ratio) throw new UnitConversionError(UNIT_CONVERSION_CODES.UNAVAILABLE, `No hay factor para convertir ${systemUnitOf(from) ?? from} a ${baseUnit} en este artículo.`);
  const result = divideRounded(quantity * ratio.numerator, ratio.denominator * 10n ** BigInt(QUANTITY_SCALE));
  if (quantity > 0n && result === 0n) {
    throw new UnitConversionError(UNIT_CONVERSION_CODES.TOO_SMALL, `La cantidad es demasiado pequeña: en ${baseUnit} se redondea a 0.`);
  }
  if (result > MAX_QUANTITY || -result > MAX_QUANTITY) {
    throw new UnitConversionError(UNIT_CONVERSION_CODES.TOO_LARGE, `La cantidad convertida supera el máximo (${formatDecimal(MAX_QUANTITY)} ${baseUnit}).`);
  }
  return result;
}

export interface Equivalence {
  /** Unidad de origen (del sistema o de empaque). */
  unit: string;
  /** Cuánto es 1 `unit` en la unidad base (escala 3). */
  quantity: bigint;
}

/**
 * Tabla de equivalencias de la ficha (RF-4): cada empaque del artículo y cada unidad del sistema de
 * la misma magnitud que la base, expresados en la unidad base. Vacía en un padre.
 */
export function equivalences(item: ConvertibleItem): Equivalence[] {
  const { baseUnit } = item;
  if (baseUnit === null) return [];
  const one = 10n ** BigInt(QUANTITY_SCALE);
  const system = INVENTORY_UNITS.filter((unit) => unit !== baseUnit && magnitudeOf(unit) === magnitudeOf(baseUnit));
  return [...item.units.map((unit) => unit.name), ...system].map((unit) => ({ unit, quantity: convertToBase(one, unit, item) }));
}
