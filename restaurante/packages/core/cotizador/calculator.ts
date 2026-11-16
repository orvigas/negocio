import type { QuoteCatalog, QuoteMatrixConfig, QuotePackage, QuoteSaleItem, QuoteSupply } from './catalog.ts';
import { ceilInt, roundHalfUp } from './rounding.ts';
import { commercialTariff } from './tariff.ts';

/**
 * Cálculo de la cotización (REQ-F-046, RN-1 a RN-13) sobre un catálogo ya validado y con los ajustes
 * aplicados. TS puro y sin estado: no guarda nada (RN-14). Los importes salen ya redondeados (2
 * decimales; margen real en % con 1) para que la pantalla no haga cuentas; por dentro se usa el valor
 * sin redondear.
 */

export type QuotePriceSource = 'margin' | 'commercial';

export interface PackageQuote {
  id: string;
  name: string;
  /** Precio sugerido por persona (RN-10); null por debajo del mínimo. */
  price: number | null;
  /** Venta del evento = precio × N. */
  sale: number | null;
  /** Costo del evento = costo total por persona × N. */
  eventCost: number;
  profit: number | null;
  /** Margen real en %, con 1 decimal. */
  marginPct: number | null;
  /** Costo variable por persona (RN-2). */
  variableCost: number;
  /** Costo fijo por persona (RN-7). */
  fixedCost: number;
  /** Costo total por persona. */
  totalCost: number;
  /** Piezas por persona (S-3). */
  pieces: number;
  /** Precio por margen (RN-8). */
  marginPrice: number | null;
  /** Precio comercial (RN-9). */
  commercialPrice: number | null;
  /** Cuál mandó; con empate, la tarifa comercial. */
  priceSource: QuotePriceSource | null;
  /** Σ qᵢ × precio a la carta; null si algún ítem incluido no tiene precio a la carta. */
  cartaPrice: number | null;
  /** Precio a la carta − precio sugerido (RN-12): positivo, ahorro; negativo, más caro que la carta. */
  cartaDiff: number | null;
}

export interface QuoteResult {
  personas: number;
  /** N < minPersonas: ningún paquete tiene precio (RN-10, CA-6). */
  belowMinimum: boolean;
  minPersonas: number;
  /** Solo los paquetes activos, en el orden del catálogo. */
  packages: PackageQuote[];
}

export interface QuoteMatrixCell {
  price: number;
  marginPct: number;
}

export interface QuoteMatrix {
  rows: number[];
  /** Solo los paquetes activos; una celda por fila (null por debajo del mínimo). */
  packages: { id: string; name: string; cells: (QuoteMatrixCell | null)[] }[];
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** Cantidad cruda en la unidad del insumo (RN-1): la receta en g si el insumo va en kg, y neta. */
function rawAmount(supply: QuoteSupply, cantidad: number): number {
  const amount = supply.unidad === 'kg' ? cantidad / 1000 : cantidad;
  return amount / (1 - (supply.mermaPct ?? 0) / 100);
}

/** Costo de una cantidad de receta (RN-1, RN-4 a RN-6): lineal, sin redondear a presentaciones. */
const lineCost = (supply: QuoteSupply, cantidad: number): number => (rawAmount(supply, cantidad) * supply.costo) / (supply.presentacion ?? 1);

function lookup<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (!found) throw new Error('El catálogo del cotizador tiene una referencia rota');
  return found;
}

const includedItems = (catalog: QuoteCatalog, pkg: QuotePackage): { sale: QuoteSaleItem; porPersona: number }[] =>
  pkg.items.filter(({ porPersona }) => porPersona > 0).map(({ item, porPersona }) => ({ sale: lookup(catalog.itemsVenta, item), porPersona }));

/** Costo variable por persona (RN-2) y combustible (RN-3), sin redondear. */
function variablePerPerson(catalog: QuoteCatalog, pkg: QuotePackage): number {
  const { combustible } = catalog;
  const base = lookup(catalog.insumos, combustible.insumoBase);
  let recipes = 0;
  let baseRawKg = 0;
  for (const { sale, porPersona } of includedItems(catalog, pkg)) {
    for (const line of sale.receta) {
      const supply = lookup(catalog.insumos, line.insumo);
      recipes += porPersona * lineCost(supply, line.cantidad);
      if (supply.id === base.id) baseRawKg += porPersona * rawAmount(supply, line.cantidad);
    }
  }
  const fuel = (baseRawKg * combustible.costoHora * combustible.horasTanda) / combustible.crudoPorTandaKg;
  return recipes + sum(catalog.costosPorPersona.map(({ costo }) => costo)) + fuel;
}

function cartaPriceOf(catalog: QuoteCatalog, pkg: QuotePackage): number | null {
  const included = includedItems(catalog, pkg);
  if (included.some(({ sale }) => sale.precioCarta === null)) return null;
  return roundHalfUp(sum(included.map(({ sale, porPersona }) => porPersona * (sale.precioCarta ?? 0))), 2);
}

function quotePackage(catalog: QuoteCatalog, pkg: QuotePackage, n: number): PackageQuote {
  const { minPersonas, refPersonas, margenObjetivoPct } = catalog.politica;
  const variable = variablePerPerson(catalog, pkg);
  const fixedTotal = sum(catalog.costosFijosEvento.map(({ costo }) => costo));
  const total = variable + fixedTotal / n;
  const eventCost = variable * n + fixedTotal;
  const pieces = sum(includedItems(catalog, pkg).filter(({ sale }) => sale.pieza).map(({ porPersona }) => porPersona));
  const cartaPrice = cartaPriceOf(catalog, pkg);
  const costs = {
    id: pkg.id,
    name: pkg.nombre,
    eventCost: roundHalfUp(eventCost, 2),
    variableCost: roundHalfUp(variable, 2),
    fixedCost: roundHalfUp(fixedTotal / n, 2),
    totalCost: roundHalfUp(total, 2),
    pieces: roundHalfUp(pieces, 2),
    cartaPrice,
  };
  if (n < minPersonas) {
    return { ...costs, price: null, sale: null, profit: null, marginPct: null, marginPrice: null, commercialPrice: null, priceSource: null, cartaDiff: null };
  }
  const marginPrice = ceilInt(total / (1 - margenObjetivoPct / 100));
  const commercialPrice = roundHalfUp(commercialTariff({ ...pkg.tarifa, minPersonas, refPersonas }, n));
  const price = Math.max(marginPrice, commercialPrice);
  const sale = price * n;
  return {
    ...costs,
    price,
    sale: roundHalfUp(sale, 2),
    profit: roundHalfUp(sale - eventCost, 2),
    marginPct: roundHalfUp(((sale - eventCost) / sale) * 100, 1),
    marginPrice,
    commercialPrice,
    priceSource: marginPrice > commercialPrice ? 'margin' : 'commercial',
    cartaDiff: cartaPrice === null ? null : roundHalfUp(cartaPrice - price, 2),
  };
}

const activePackages = (catalog: QuoteCatalog): QuotePackage[] => catalog.paquetes.filter(({ activo }) => activo);

/** Cotización para N personas de cada paquete activo. */
export function calculateQuote(catalog: QuoteCatalog, personas: number): QuoteResult {
  const { minPersonas } = catalog.politica;
  return {
    personas,
    belowMinimum: personas < minPersonas,
    minPersonas,
    packages: activePackages(catalog).map((pkg) => quotePackage(catalog, pkg, personas)),
  };
}

const onGrid = ({ desde, hasta, paso }: QuoteMatrixConfig, value: number): boolean => value >= desde && value <= hasta && (value - desde) % paso === 0;

/** Número de filas de la matriz sin generarlas (el rango puede ser enorme antes de validarlo). */
export function matrixRowCount(config: QuoteMatrixConfig): number {
  const range = config.hasta >= config.desde ? Math.floor((config.hasta - config.desde) / config.paso) + 1 : 0;
  return range + new Set(config.extra.filter((value) => !onGrid(config, value))).size;
}

/** Filas de la matriz: de `desde` a `hasta` con `paso`, más las extra, sin repetidos y en orden. */
export function matrixRows(config: QuoteMatrixConfig): number[] {
  const rows = new Set<number>(config.extra);
  for (let value = config.desde; value <= config.hasta; value += config.paso) rows.add(value);
  return [...rows].sort((a, b) => a - b);
}

/** Matriz de volumen (RF-4): los mismos precios que el cálculo individual. */
export function buildMatrix(catalog: QuoteCatalog): QuoteMatrix {
  const rows = matrixRows(catalog.matriz);
  return {
    rows,
    packages: activePackages(catalog).map((pkg) => ({
      id: pkg.id,
      name: pkg.nombre,
      cells: rows.map((n) => {
        const { price, marginPct } = quotePackage(catalog, pkg, n);
        return price === null || marginPct === null ? null : { price, marginPct };
      }),
    })),
  };
}
