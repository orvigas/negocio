import { quoteAt, type QuoteCatalog, type QuoteUnit } from './catalog.ts';
import { matrixRowCount } from './calculator.ts';

/**
 * Campos editables del cotizador (REQ-F-046, S-1 y "Campos editables"): la única definición de las
 * claves, sus rangos y su lectura y escritura sobre el catálogo. La usan la validación del JSON, los
 * ajustes y, por el DTO de la API, la pantalla.
 *
 * Claves cortas y estables, basadas en los ids del JSON (seguras en una URL sin codificar):
 * `i.<insumo>.costo|merma|pres`, `r.<ítem>.<insumo>`, `pp.<id>`, `fe.<id>`, `cb.hora|horas|kg`,
 * `po.min|ref|margen`, `p.<paquete>.on|a|b|f`, `p.<paquete>.q.<ítem>`, `c.<ítem>` y
 * `m.desde|hasta|paso|extra`. Las personas (`n`) van aparte.
 */

export const QUOTE_LIMITS = Object.freeze({
  personasMin: 1,
  personasMax: 5000,
  matrixMaxRows: 50,
  matrixMaxExtra: 10,
});

export const QUOTE_SECTIONS = Object.freeze([
  { id: 'paquetes', title: 'Paquetes y tarifas' },
  { id: 'insumos', title: 'Costos de insumos y recetas' },
  { id: 'costos', title: 'Costos por persona, combustible y costos fijos' },
  { id: 'politica', title: 'Política y precios a la carta' },
  { id: 'matriz', title: 'Matriz de volumen' },
] as const);
export type QuoteSectionId = (typeof QUOTE_SECTIONS)[number]['id'];

/** Avisos fijos de la pantalla (RF-5). */
export const QUOTE_NOTES = Object.freeze([
  { id: 'exclusions', text: 'El cálculo no incluye impuestos, comisiones de cobro, renta, depreciación ni transporte extraordinario.' },
  { id: 'tariff', text: 'Cambiar la composición de un paquete no cambia su tarifa: ajusta también a, b y F.' },
  { id: 'not-saved', text: 'Los ajustes solo se aplican a este cálculo: no se guarda nada. Los valores por defecto se cambian en el JSON del cotizador, con un PR.' },
] as const);

export const QUOTE_FIELD_KINDS = Object.freeze(['int', 'decimal', 'money', 'percent', 'optionalMoney', 'active', 'intList'] as const);
export type QuoteFieldKind = (typeof QUOTE_FIELD_KINDS)[number];

/** Descriptor público de un campo (lo que recibe la pantalla). */
export interface QuoteField {
  key: string;
  section: QuoteSectionId;
  /** Grupo dentro de la sección (paquete, insumo, receta...). */
  group: string;
  label: string;
  unit: string;
  kind: QuoteFieldKind;
  min: number | null;
  minExclusive: boolean;
  max: number | null;
  maxExclusive: boolean;
  /** Decimales admitidos (0 en los enteros). */
  decimals: number;
  /** Vacío permitido (precio a la carta). */
  optional: boolean;
  /** Dato provisional (masa y consomé, RF-5). */
  provisional: boolean;
  /** Valor del catálogo como texto canónico (punto decimal). */
  defaultValue: string;
}

interface DefBase extends Omit<QuoteField, 'defaultValue' | 'kind'> {
  /** Ruta en el JSON, para los mensajes de arranque y CI. */
  path: string;
  /** A quién pertenece el campo en un mensaje del JSON ("Paquete "Tradicional""). */
  context: string;
}

type NumberDef = DefBase & { kind: 'int' | 'decimal' | 'money' | 'percent'; get(c: QuoteCatalog): number; set(c: QuoteCatalog, value: number): void };
type OptionalDef = DefBase & { kind: 'optionalMoney'; get(c: QuoteCatalog): number | null; set(c: QuoteCatalog, value: number | null): void };
type ActiveDef = DefBase & { kind: 'active'; get(c: QuoteCatalog): boolean; set(c: QuoteCatalog, value: boolean): void };
type ListDef = DefBase & { kind: 'intList'; get(c: QuoteCatalog): number[]; set(c: QuoteCatalog, value: number[]): void };

/** Definición interna: descriptor más lectura y escritura sobre el catálogo. */
export type QuoteFieldDef = NumberDef | OptionalDef | ActiveDef | ListDef;
export type QuoteFieldValue = number | null | boolean | number[];

const MONEY_MAX = 100_000;
const FIXED_MAX = 1_000_000;

type Range = Pick<QuoteField, 'min' | 'minExclusive' | 'max' | 'maxExclusive' | 'decimals'>;
const range = (min: number, max: number, decimals: number, { minExclusive = false, maxExclusive = false } = {}): Range => ({ min, max, decimals, minExclusive, maxExclusive });
const MONEY = range(0, MONEY_MAX, 2);
const PERCENT = range(0, 100, 4, { maxExclusive: true });

const RECIPE_UNITS: Readonly<Record<QuoteUnit, { unit: string; max: number }>> = Object.freeze({
  kg: { unit: 'g', max: 5000 },
  l: { unit: 'l', max: 100 },
  porcion: { unit: 'porciones', max: 100 },
});
const UNIT_NAMES: Readonly<Record<QuoteUnit, string>> = Object.freeze({ kg: 'kg', l: 'l', porcion: 'porción' });

function numberDef(base: Omit<NumberDef, 'optional' | 'provisional' | keyof Range> & Partial<Pick<QuoteField, 'provisional'>>, limits: Range): NumberDef {
  return { optional: false, provisional: false, ...limits, ...base };
}

/** Campos editables del catálogo, en el orden de la pantalla. */
export function quoteFieldDefs(catalog: QuoteCatalog): QuoteFieldDef[] {
  const defs: QuoteFieldDef[] = [];
  const supplyIndex = new Map(catalog.insumos.map((supply, index) => [supply.id, index]));

  // 1. Paquetes y tarifas.
  catalog.paquetes.forEach((pkg, p) => {
    const group = pkg.nombre;
    const context = `Paquete "${pkg.nombre}"`;
    const pkgAt = (c: QuoteCatalog) => quoteAt(c.paquetes, p);
    const base = { section: 'paquetes', group, context } as const;
    defs.push({
      ...base,
      key: `p.${pkg.id}.on`,
      path: `paquetes[${p}].activo`,
      kind: 'active',
      label: 'Activo',
      unit: '',
      optional: false,
      provisional: false,
      min: null,
      minExclusive: false,
      max: null,
      maxExclusive: false,
      decimals: 0,
      get: (c) => pkgAt(c).activo,
      set: (c, value) => {
        pkgAt(c).activo = value;
      },
    });
    const tariff = (letter: 'a' | 'b' | 'f', label: string): NumberDef =>
      numberDef(
        {
          ...base,
          key: `p.${pkg.id}.${letter}`,
          path: `paquetes[${p}].tarifa.${letter}`,
          kind: 'money',
          label,
          unit: '$/persona',
          get: (c) => pkgAt(c).tarifa[letter],
          set: (c, value) => {
            pkgAt(c).tarifa[letter] = value;
          },
        },
        range(0, MONEY_MAX, 2, { minExclusive: true }),
      );
    defs.push(tariff('a', 'Tarifa en el mínimo (a)'), tariff('b', 'Tarifa en la referencia (b)'), tariff('f', 'Piso (F)'));
    pkg.items.forEach(({ item }, i) => {
      const sale = catalog.itemsVenta.find((entry) => entry.id === item);
      defs.push(
        numberDef(
          {
            ...base,
            key: `p.${pkg.id}.q.${item}`,
            path: `paquetes[${p}].items(${item}).porPersona`,
            kind: 'decimal',
            label: sale?.nombre ?? item,
            unit: 'por persona',
            get: (c) => quoteAt(pkgAt(c).items, i).porPersona,
            set: (c, value) => {
              quoteAt(pkgAt(c).items, i).porPersona = value;
            },
          },
          range(0, 50, 2),
        ),
      );
    });
  });

  // 2. Insumos y recetas.
  catalog.insumos.forEach((supply, s) => {
    const base = { section: 'insumos', group: supply.nombre, context: `Insumo "${supply.nombre}"`, provisional: supply.provisional } as const;
    const supplyAt = (c: QuoteCatalog) => quoteAt(c.insumos, s);
    defs.push(
      numberDef(
        {
          ...base,
          key: `i.${supply.id}.costo`,
          path: `insumos[${s}].costo`,
          kind: 'money',
          label: supply.presentacion === null ? 'Costo' : 'Costo por presentación',
          unit: supply.presentacion === null ? `$/${UNIT_NAMES[supply.unidad]}` : '$',
          get: (c) => supplyAt(c).costo,
          set: (c, value) => {
            supplyAt(c).costo = value;
          },
        },
        MONEY,
      ),
    );
    if (supply.mermaPct !== null) {
      defs.push(
        numberDef(
          {
            ...base,
            key: `i.${supply.id}.merma`,
            path: `insumos[${s}].mermaPct`,
            kind: 'percent',
            label: 'Merma',
            unit: '%',
            get: (c) => supplyAt(c).mermaPct ?? 0,
            set: (c, value) => {
              supplyAt(c).mermaPct = value;
            },
          },
          PERCENT,
        ),
      );
    }
    if (supply.presentacion !== null) {
      defs.push(
        numberDef(
          {
            ...base,
            key: `i.${supply.id}.pres`,
            path: `insumos[${s}].presentacion`,
            kind: 'decimal',
            label: 'Tamaño de la presentación',
            unit: supply.unidad === 'porcion' ? 'porciones' : supply.unidad,
            get: (c) => supplyAt(c).presentacion ?? 1,
            set: (c, value) => {
              supplyAt(c).presentacion = value;
            },
          },
          range(0, 1000, 4, { minExclusive: true }),
        ),
      );
    }
  });
  catalog.itemsVenta.forEach((sale, j) => {
    sale.receta.forEach((line, k) => {
      const supply = catalog.insumos[supplyIndex.get(line.insumo) ?? -1];
      if (!supply) return;
      const recipeUnit = RECIPE_UNITS[supply.unidad];
      defs.push(
        numberDef(
          {
            section: 'insumos',
            group: `Receta: ${sale.nombre}`,
            context: `Receta de "${sale.nombre}"`,
            provisional: supply.provisional,
            key: `r.${sale.id}.${supply.id}`,
            path: `itemsVenta[${j}].receta[${k}].cantidad`,
            kind: 'decimal',
            label: supply.mermaPct === null ? supply.nombre : `${supply.nombre} (cantidad neta, ya cocida)`,
            unit: recipeUnit.unit,
            get: (c) => quoteAt(quoteAt(c.itemsVenta, j).receta, k).cantidad,
            set: (c, value) => {
              quoteAt(quoteAt(c.itemsVenta, j).receta, k).cantidad = value;
            },
          },
          range(0, recipeUnit.max, 4),
        ),
      );
    });
  });

  // 3. Costos por persona, combustible y fijos.
  const costList = (list: 'costosPorPersona' | 'costosFijosEvento', prefix: string, group: string, unit: string, max: number) => {
    catalog[list].forEach((cost, index) => {
      defs.push(
        numberDef(
          {
            section: 'costos',
            group,
            context: group,
            key: `${prefix}.${cost.id}`,
            path: `${list}[${index}].costo`,
            kind: 'money',
            label: cost.concepto,
            unit,
            get: (c) => quoteAt(c[list], index).costo,
            set: (c, value) => {
              quoteAt(c[list], index).costo = value;
            },
          },
          range(0, max, 2),
        ),
      );
    });
  };
  costList('costosPorPersona', 'pp', 'Costos por persona', '$/persona', MONEY_MAX);
  const fuel = { section: 'costos', group: 'Combustible', context: 'Combustible' } as const;
  const base = catalog.insumos.find((supply) => supply.id === catalog.combustible.insumoBase);
  defs.push(
    numberDef(
      {
        ...fuel,
        key: 'cb.hora',
        path: 'combustible.costoHora',
        kind: 'money',
        label: 'Costo por hora',
        unit: '$/h',
        get: (c) => c.combustible.costoHora,
        set: (c, value) => {
          c.combustible.costoHora = value;
        },
      },
      MONEY,
    ),
    numberDef(
      {
        ...fuel,
        key: 'cb.horas',
        path: 'combustible.horasTanda',
        kind: 'decimal',
        label: 'Horas por tanda',
        unit: 'h',
        get: (c) => c.combustible.horasTanda,
        set: (c, value) => {
          c.combustible.horasTanda = value;
        },
      },
      range(0, 48, 4),
    ),
    numberDef(
      {
        ...fuel,
        key: 'cb.kg',
        path: 'combustible.crudoPorTandaKg',
        kind: 'decimal',
        label: `${base?.nombre ?? 'Insumo base'} por tanda`,
        unit: 'kg',
        get: (c) => c.combustible.crudoPorTandaKg,
        set: (c, value) => {
          c.combustible.crudoPorTandaKg = value;
        },
      },
      range(0, 1000, 4, { minExclusive: true }),
    ),
  );
  costList('costosFijosEvento', 'fe', 'Costos fijos por evento', '$/evento', FIXED_MAX);

  // 4. Política y precios a la carta.
  const policy = { section: 'politica', group: 'Política', context: 'Política' } as const;
  defs.push(
    numberDef(
      {
        ...policy,
        key: 'po.min',
        path: 'politica.minPersonas',
        kind: 'int',
        label: 'Mínimo de personas',
        unit: 'personas',
        get: (c) => c.politica.minPersonas,
        set: (c, value) => {
          c.politica.minPersonas = value;
        },
      },
      range(1, QUOTE_LIMITS.personasMax - 1, 0),
    ),
    numberDef(
      {
        ...policy,
        key: 'po.ref',
        path: 'politica.refPersonas',
        kind: 'int',
        label: 'Referencia (fin del tramo recto)',
        unit: 'personas',
        get: (c) => c.politica.refPersonas,
        set: (c, value) => {
          c.politica.refPersonas = value;
        },
      },
      range(1, QUOTE_LIMITS.personasMax, 0),
    ),
    numberDef(
      {
        ...policy,
        key: 'po.margen',
        path: 'politica.margenObjetivoPct',
        kind: 'percent',
        label: 'Margen objetivo',
        unit: '%',
        get: (c) => c.politica.margenObjetivoPct,
        set: (c, value) => {
          c.politica.margenObjetivoPct = value;
        },
      },
      PERCENT,
    ),
  );
  catalog.itemsVenta.forEach((sale, j) => {
    defs.push({
      section: 'politica',
      group: 'Precios a la carta',
      context: `Ítem "${sale.nombre}"`,
      key: `c.${sale.id}`,
      path: `itemsVenta[${j}].precioCarta`,
      kind: 'optionalMoney',
      label: sale.nombre,
      unit: '$',
      optional: true,
      provisional: false,
      ...MONEY,
      get: (c) => quoteAt(c.itemsVenta, j).precioCarta,
      set: (c, value) => {
        quoteAt(c.itemsVenta, j).precioCarta = value;
      },
    });
  });

  // 5. Matriz.
  const matrix = { section: 'matriz', group: 'Matriz', context: 'Matriz' } as const;
  const matrixInt = (key: 'desde' | 'hasta' | 'paso', label: string): NumberDef =>
    numberDef(
      {
        ...matrix,
        key: `m.${key}`,
        path: `matriz.${key}`,
        kind: 'int',
        label,
        unit: 'personas',
        get: (c) => c.matriz[key],
        set: (c, value) => {
          c.matriz[key] = value;
        },
      },
      range(1, QUOTE_LIMITS.personasMax, 0),
    );
  defs.push(matrixInt('desde', 'Desde'), matrixInt('hasta', 'Hasta'), matrixInt('paso', 'Paso'), {
    ...matrix,
    key: 'm.extra',
    path: 'matriz.extra',
    kind: 'intList',
    label: 'Filas extra',
    unit: 'personas',
    optional: true,
    provisional: false,
    ...range(1, QUOTE_LIMITS.personasMax, 0),
    get: (c) => [...c.matriz.extra],
    set: (c, value) => {
      c.matriz.extra = normalizeList(value);
    },
  });
  return defs;
}

/** Sin repetidos y en orden. */
export const normalizeList = (values: readonly number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

/** Texto canónico de un valor (punto decimal; lista separada por comas). */
export function formatFieldValue(value: QuoteFieldValue): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** Descriptores públicos con los valores del catálogo. */
export function quoteFields(catalog: QuoteCatalog): QuoteField[] {
  return quoteFieldDefs(catalog).map((def) => ({
    key: def.key,
    section: def.section,
    group: def.group,
    label: def.label,
    unit: def.unit,
    kind: def.kind,
    min: def.min,
    minExclusive: def.minExclusive,
    max: def.max,
    maxExclusive: def.maxExclusive,
    decimals: def.decimals,
    optional: def.optional,
    provisional: def.provisional,
    defaultValue: formatFieldValue(def.get(catalog)),
  }));
}

// --- Validación de valores --------------------------------------------------------------

const decimalsOk = (value: number, decimals: number): boolean => Number(value.toFixed(decimals)) === value;

function rangeMessage({ min, max, minExclusive, maxExclusive }: Range): string {
  if (minExclusive) return `Debe ser mayor que ${String(min)} y como máximo ${String(max)}.`;
  if (maxExclusive) return `Debe ser al menos ${String(min)} y menor que ${String(max)}.`;
  return `Debe estar entre ${String(min)} y ${String(max)}.`;
}

function inRange(value: number, { min, max, minExclusive, maxExclusive }: Range): boolean {
  if (min !== null && (minExclusive ? value <= min : value < min)) return false;
  return max === null || (maxExclusive ? value < max : value <= max);
}

function checkNumber(def: Range, value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Escribe un número.';
  if (def.decimals === 0 && !Number.isInteger(value)) return 'Escribe un número entero.';
  if (!decimalsOk(value, def.decimals)) return `Usa como máximo ${String(def.decimals)} decimales.`;
  return inRange(value, def) ? null : rangeMessage(def);
}

/** Error de un valor ya tipado (o null): mismo criterio para el JSON y para los ajustes. */
export function checkFieldValue(def: QuoteFieldDef, value: unknown): string | null {
  switch (def.kind) {
    case 'active':
      return typeof value === 'boolean' ? null : 'Elige activo o inactivo.';
    case 'optionalMoney':
      return value === null ? null : checkNumber(def, value);
    case 'intList': {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'number' || !Number.isInteger(entry))) return 'Escribe enteros separados por comas o espacios.';
      if (value.length > QUOTE_LIMITS.matrixMaxExtra) return `Como máximo ${String(QUOTE_LIMITS.matrixMaxExtra)} filas extra.`;
      return value.every((entry: number) => inRange(entry, def)) ? null : `Cada fila extra debe estar entre ${String(def.min)} y ${String(def.max)}.`;
    }
    default:
      return checkNumber(def, value);
  }
}

const NUMBER_TEXT = /^-?\d+(?:[.,]\d+)?$/;
const LIST_SEPARATOR = /[\s,]+/;

/** Texto de un número con punto o coma decimal (un solo separador, sin espacios internos ni exponentes). */
function parseNumberText(text: string, def: Range): { value: number } | { error: string } {
  if (!NUMBER_TEXT.test(text)) return { error: 'Escribe un número: usa punto o coma para los decimales, sin separador de miles.' };
  const decimals = text.split(/[.,]/)[1]?.length ?? 0;
  if (def.decimals === 0 && decimals > 0) return { error: 'Escribe un número entero.' };
  if (decimals > def.decimals) return { error: `Usa como máximo ${String(def.decimals)} decimales.` };
  return { value: Number(text.replace(',', '.')) };
}

/** Interpreta el texto escrito en un campo y comprueba su rango. */
export function parseFieldText(def: QuoteFieldDef, raw: string): { value: QuoteFieldValue } | { error: string } {
  const text = raw.trim();
  let value: QuoteFieldValue;
  if (def.kind === 'active') {
    if (text !== '1' && text !== '0') return { error: 'Elige activo o inactivo.' };
    value = text === '1';
  } else if (def.kind === 'intList') {
    if (text === '') return { value: [] };
    const parts = text.split(LIST_SEPARATOR);
    if (parts.some((part) => !/^\d{1,6}$/.test(part))) return { error: 'Escribe enteros separados por comas o espacios.' };
    value = parts.map(Number);
  } else if (text === '') {
    if (def.kind !== 'optionalMoney') return { error: 'Este campo es obligatorio.' };
    value = null;
  } else {
    const parsed = parseNumberText(text, def);
    if ('error' in parsed) return parsed;
    value = parsed.value;
  }
  const error = checkFieldValue(def, value);
  return error === null ? { value } : { error };
}

/** Escribe un valor ya validado en el catálogo. */
export function setFieldValue(def: QuoteFieldDef, catalog: QuoteCatalog, value: QuoteFieldValue): void {
  switch (def.kind) {
    case 'active':
      if (typeof value === 'boolean') def.set(catalog, value);
      return;
    case 'intList':
      if (Array.isArray(value)) def.set(catalog, value);
      return;
    case 'optionalMoney':
      if (value === null || typeof value === 'number') def.set(catalog, value);
      return;
    default:
      if (typeof value === 'number') def.set(catalog, value);
  }
}

/** Igualdad de valores (las listas, como conjuntos ordenados). */
export function sameFieldValue(a: QuoteFieldValue, b: QuoteFieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return formatFieldValue(normalizeList(a)) === formatFieldValue(normalizeList(b));
  return a === b;
}

// --- Reglas cruzadas ------------------------------------------------------------------------

export interface QuoteCrossIssue {
  key: string;
  message: string;
  /** El mensaje ya nombra el paquete o la política (en el JSON no se le antepone el campo). */
  named: boolean;
}

/**
 * Reglas entre campos: F < b ≤ a, mínimo < referencia, al menos un paquete activo y un ítem > 0 por
 * paquete, y la matriz (desde ≥ mínimo, hasta ≥ desde, ≤ 50 filas). `activeOnly`: los ajustes solo
 * exigen ítems en los paquetes activos; el JSON, en todos.
 */
export function crossCheck(catalog: QuoteCatalog, { activeOnly }: { activeOnly: boolean }): QuoteCrossIssue[] {
  const issues: QuoteCrossIssue[] = [];
  for (const pkg of catalog.paquetes) {
    const { a, b, f } = pkg.tarifa;
    if (b > a) {
      issues.push({ key: `p.${pkg.id}.b`, message: `Tarifa del paquete "${pkg.nombre}": la tarifa en la referencia b (${String(b)}) no puede ser mayor que la tarifa en el mínimo a (${String(a)}).`, named: true });
    }
    if (f >= b) {
      issues.push({ key: `p.${pkg.id}.f`, message: `Tarifa del paquete "${pkg.nombre}": el piso F (${String(f)}) debe ser menor que la tarifa en la referencia b (${String(b)}).`, named: true });
    }
    const first = pkg.items[0];
    if ((pkg.activo || !activeOnly) && first && pkg.items.every(({ porPersona }) => porPersona === 0)) {
      issues.push({ key: `p.${pkg.id}.q.${first.item}`, message: `El paquete "${pkg.nombre}" debe incluir al menos un ítem con cantidad mayor que 0.`, named: true });
    }
  }
  if (!catalog.paquetes.some(({ activo }) => activo)) {
    for (const pkg of catalog.paquetes) issues.push({ key: `p.${pkg.id}.on`, message: 'Activa al menos un paquete.', named: true });
  }
  const { minPersonas, refPersonas } = catalog.politica;
  if (refPersonas <= minPersonas) {
    issues.push({ key: 'po.ref', message: `La referencia (${String(refPersonas)}) debe ser mayor que el mínimo de personas (${String(minPersonas)}).`, named: true });
  }
  const { desde, hasta } = catalog.matriz;
  if (desde < minPersonas) issues.push({ key: 'm.desde', message: `Debe ser al menos el mínimo de personas (${String(minPersonas)}).`, named: false });
  if (hasta < desde) issues.push({ key: 'm.hasta', message: `Debe ser mayor o igual que "desde" (${String(desde)}).`, named: false });
  const rows = matrixRowCount(catalog.matriz);
  if (rows > QUOTE_LIMITS.matrixMaxRows) {
    issues.push({ key: 'm.paso', message: `La matriz tendría ${String(rows)} filas y el máximo es ${String(QUOTE_LIMITS.matrixMaxRows)}: sube el paso o reduce el rango.`, named: false });
  }
  return issues;
}
