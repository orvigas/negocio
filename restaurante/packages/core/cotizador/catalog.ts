import type { BusinessId } from '../shared/index.ts';

/**
 * Catálogo del cotizador de taquizas (REQ-F-046): insumos, ítems de venta con su receta, costos,
 * política, matriz y paquetes. Llega ya validado (`parseQuoteCatalog`) y el cálculo no sabe de dónde
 * viene (RF-12): hoy, de un JSON de `api`; en la fase 2, en parte de la tabla de productos.
 *
 * Unidades: la receta usa la unidad que se deriva del insumo (insumo en kg → receta en g; en l → l; en
 * porciones → porciones). Porcentajes en %, importes en pesos.
 */

export const QUOTE_UNITS = Object.freeze(['kg', 'l', 'porcion'] as const);
export type QuoteUnit = (typeof QUOTE_UNITS)[number];

export interface QuoteSupply {
  id: string;
  nombre: string;
  unidad: QuoteUnit;
  /** Costo por unidad o, si hay `presentacion`, por presentación. */
  costo: number;
  /** Merma (%): la receta indica cantidades netas; cruda = neta / (1 − merma). Null: sin merma. */
  mermaPct: number | null;
  /** Unidades por presentación (agua: 18 l por vitrolero). Null: el costo es por unidad. */
  presentacion: number | null;
  provisional: boolean;
}

export interface QuoteRecipeLine {
  insumo: string;
  /** En g si el insumo va en kg; si no, en su unidad. */
  cantidad: number;
}

export interface QuoteSaleItem {
  id: string;
  nombre: string;
  /** Slug del producto de Birria (fase 2) o null. */
  producto: string | null;
  /** Null: sin precio a la carta. */
  precioCarta: number | null;
  /** Cuenta como pieza (taco, quesabirria). */
  pieza: boolean;
  receta: QuoteRecipeLine[];
}

export interface QuoteCost {
  id: string;
  concepto: string;
  costo: number;
}

export interface QuoteFuel {
  costoHora: number;
  horasTanda: number;
  /** Insumo (en kg) cuyos gramos crudos por persona determinan las tandas. */
  insumoBase: string;
  crudoPorTandaKg: number;
}

export interface QuotePolicy {
  minPersonas: number;
  refPersonas: number;
  margenObjetivoPct: number;
}

export interface QuoteMatrixConfig {
  desde: number;
  hasta: number;
  paso: number;
  /** Filas adicionales, sin repetidos y en orden. */
  extra: number[];
}

export interface QuoteTariff {
  a: number;
  b: number;
  f: number;
}

export interface QuotePackageItem {
  item: string;
  porPersona: number;
}

export interface QuotePackage {
  id: string;
  nombre: string;
  activo: boolean;
  tarifa: QuoteTariff;
  /** Todos los ítems de venta, en el orden del catálogo; 0 = no incluido. */
  items: QuotePackageItem[];
}

export interface QuoteCatalog {
  version: 1;
  negocio: BusinessId;
  insumos: QuoteSupply[];
  itemsVenta: QuoteSaleItem[];
  costosPorPersona: QuoteCost[];
  combustible: QuoteFuel;
  costosFijosEvento: QuoteCost[];
  politica: QuotePolicy;
  matriz: QuoteMatrixConfig;
  paquetes: QuotePackage[];
}

/** Elemento `i` de una lista cuya forma ya validó el catálogo. */
export function quoteAt<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error('El catálogo del cotizador no tiene la forma esperada');
  return value;
}
