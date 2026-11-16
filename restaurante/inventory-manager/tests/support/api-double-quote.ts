import type { Context } from 'koa';

import { QUOTE_NOT_FOUND_CODE, QUOTE_UNAVAILABLE_CODE, type QuoteDefaultsResponse, type QuoteField, type QuotePackageResult } from '@restaurante/contracts';

/**
 * Doble de `/api/v1/admin/:negocio/cotizador` (REQ-F-046). Mismo orden que la API real: sesión (en
 * `api-double.ts`) -> rol administrador (403) -> negocio con cotizador (404) -> disponibilidad (503)
 * -> cálculo. Los campos son un subconjunto de los de core con sus valores del JSON; el "cálculo"
 * devuelve las cifras del ticket para los casos que usan las pruebas (no reproduce la fórmula: eso lo
 * prueban `api/tests/unit/quote-calculator.test.ts` y `admin-quote-api.test.ts`).
 */

export interface QuoteDouble {
  /** `false`: el JSON no es válido (503 `QUOTE_UNAVAILABLE`). */
  available: boolean;
  /** Cuerpos recibidos en los cálculos (lo que comprueba "solo las diferencias"). */
  calculations: { personas: unknown; ajustes: unknown }[];
}

export const createQuoteDouble = (): QuoteDouble => ({ available: true, calculations: [] });

const base = { minExclusive: false, maxExclusive: false, optional: false, provisional: false };
const money = (key: string, section: string, group: string, label: string, unit: string, defaultValue: string, extra: Partial<QuoteField> = {}): QuoteField => ({
  ...base,
  key,
  section,
  group,
  label,
  unit,
  kind: 'money',
  min: 0,
  max: 100000,
  decimals: 2,
  defaultValue,
  ...extra,
});
const decimal = (key: string, section: string, group: string, label: string, unit: string, defaultValue: string, extra: Partial<QuoteField> = {}): QuoteField => ({
  ...money(key, section, group, label, unit, defaultValue),
  kind: 'decimal',
  decimals: 4,
  ...extra,
});
const int = (key: string, section: string, group: string, label: string, defaultValue: string): QuoteField => ({ ...money(key, section, group, label, 'personas', defaultValue), kind: 'int', min: 1, max: 5000, decimals: 0 });
const active = (key: string, group: string): QuoteField => ({ ...base, key, section: 'paquetes', group, label: 'Activo', unit: '', kind: 'active', min: null, max: null, decimals: 0, defaultValue: '1' });

export const QUOTE_FIELDS: QuoteField[] = [
  active('p.tradicional.on', 'Tradicional'),
  money('p.tradicional.a', 'paquetes', 'Tradicional', 'Tarifa en el mínimo (a)', '$/persona', '145', { minExclusive: true }),
  money('p.tradicional.b', 'paquetes', 'Tradicional', 'Tarifa en la referencia (b)', '$/persona', '120', { minExclusive: true }),
  money('p.tradicional.f', 'paquetes', 'Tradicional', 'Piso (F)', '$/persona', '100', { minExclusive: true }),
  decimal('p.tradicional.q.taco', 'paquetes', 'Tradicional', 'Taco de birria', 'por persona', '3', { max: 50, decimals: 2 }),
  decimal('p.tradicional.q.consome-500', 'paquetes', 'Tradicional', 'Consomé 500 ml', 'por persona', '1', { max: 50, decimals: 2 }),
  active('p.mixto-1.on', 'Mixto 1'),
  money('p.mixto-1.f', 'paquetes', 'Mixto 1', 'Piso (F)', '$/persona', '110', { minExclusive: true }),
  money('i.carne-res.costo', 'insumos', 'Carne de res cruda', 'Costo', '$/kg', '170'),
  { ...money('i.carne-res.merma', 'insumos', 'Carne de res cruda', 'Merma', '%', '40'), kind: 'percent', max: 100, maxExclusive: true, decimals: 4 },
  money('i.masa.costo', 'insumos', 'Masa', 'Costo', '$/kg', '15', { provisional: true }),
  decimal('r.taco.carne-res', 'insumos', 'Receta: Taco de birria', 'Carne de res cruda (cantidad neta, ya cocida)', 'g', '40', { max: 5000 }),
  decimal('r.taco.masa', 'insumos', 'Receta: Taco de birria', 'Masa', 'g', '40', { max: 5000, provisional: true }),
  money('pp.complementos', 'costos', 'Costos por persona', 'Complementos y desechables', '$/persona', '6'),
  decimal('cb.horas', 'costos', 'Combustible', 'Horas por tanda', 'h', '4.5', { max: 48 }),
  money('fe.mano-obra', 'costos', 'Costos fijos por evento', 'Mano de obra y logística', '$/evento', '1600', { max: 1000000 }),
  int('po.min', 'politica', 'Política', 'Mínimo de personas', '30'),
  int('po.ref', 'politica', 'Política', 'Referencia (fin del tramo recto)', '100'),
  { ...money('po.margen', 'politica', 'Política', 'Margen objetivo', '%', '30'), kind: 'percent', max: 100, maxExclusive: true, decimals: 4 },
  { ...money('c.taco', 'politica', 'Precios a la carta', 'Taco de birria', '$', '30'), kind: 'optionalMoney', optional: true },
  { ...money('c.quesabirria', 'politica', 'Precios a la carta', 'Quesabirria', '$', ''), kind: 'optionalMoney', optional: true },
  int('m.desde', 'matriz', 'Matriz', 'Desde', '30'),
  int('m.hasta', 'matriz', 'Matriz', 'Hasta', '100'),
  int('m.paso', 'matriz', 'Matriz', 'Paso', '10'),
  { ...int('m.extra', 'matriz', 'Matriz', 'Filas extra', '150, 200, 300'), kind: 'intList', optional: true },
];

export const QUOTE_DEFAULTS: QuoteDefaultsResponse = {
  quote: {
    business: 'birria',
    personas: { min: 1, max: 5000 },
    sections: [
      { id: 'paquetes', title: 'Paquetes y tarifas' },
      { id: 'insumos', title: 'Costos de insumos y recetas' },
      { id: 'costos', title: 'Costos por persona, combustible y costos fijos' },
      { id: 'politica', title: 'Política y precios a la carta' },
      { id: 'matriz', title: 'Matriz de volumen' },
    ],
    fields: QUOTE_FIELDS,
    notes: [
      { id: 'exclusions', text: 'El cálculo no incluye impuestos, comisiones de cobro, renta, depreciación ni transporte extraordinario.' },
      { id: 'tariff', text: 'Cambiar la composición de un paquete no cambia su tarifa: ajusta también a, b y F.' },
      { id: 'not-saved', text: 'Los ajustes solo se aplican a este cálculo: no se guarda nada. Los valores por defecto se cambian en el JSON del cotizador, con un PR.' },
    ],
  },
};

const fail = (ctx: Context, status: number, code: string, message: string, fields?: Record<string, string>): void => {
  ctx.status = status;
  ctx.body = { error: { code, message, ...(fields ? { fields } : {}) } };
};

const NUMBER = /^\d+(?:[.,]\d+)?$/;

/** Cifras del ticket con N = 60 (CA-1, CA-9 y CA-10); por debajo del mínimo, sin precios (CA-6). */
function packagesFor(personas: number, ajustes: Record<string, string>): QuotePackageResult[] {
  const min = Number(ajustes['po.min'] ?? 30);
  const below = personas < min;
  const noConsome = ajustes['p.tradicional.q.consome-500'] === '0';
  const margin = ajustes['po.margen'] === '50';
  const price = margin ? 148 : 134;
  const cartaPrice = noConsome ? 115 : 160;
  const tradicional: QuotePackageResult = {
    id: 'tradicional',
    name: 'Tradicional',
    price: below ? null : price,
    sale: below ? null : price * personas,
    eventCost: 4426.57,
    profit: below ? null : price * personas - 4426.57,
    marginPct: below ? null : margin ? 50.2 : 44.9,
    variableCost: noConsome ? 46.61 : 47.11,
    fixedCost: 26.67,
    totalCost: 73.78,
    pieces: 3,
    marginPrice: below ? null : margin ? 148 : 106,
    commercialPrice: below ? null : 134,
    priceSource: below ? null : margin ? 'margin' : 'commercial',
    cartaPrice,
    cartaDiff: below ? null : cartaPrice - price,
  };
  const mixto: QuotePackageResult = { ...tradicional, id: 'mixto-1', name: 'Mixto 1', price: below ? null : 144, sale: below ? null : 144 * personas, cartaPrice: null, cartaDiff: null, pieces: 3 };
  return ajustes['p.mixto-1.on'] === '0' ? [tradicional] : [tradicional, mixto];
}

export function handleQuote(ctx: Context, double: QuoteDouble, business: string, calculating: boolean, record: Record<string, unknown>): void {
  if (business !== 'birria') return fail(ctx, 404, QUOTE_NOT_FOUND_CODE, 'Este negocio no tiene cotizador.');
  if (!double.available) return fail(ctx, 503, QUOTE_UNAVAILABLE_CODE, 'Cotizador no disponible.');
  if (!calculating) {
    ctx.body = QUOTE_DEFAULTS;
    return undefined;
  }
  double.calculations.push({ personas: record.personas, ajustes: record.ajustes });
  const ajustes = (record.ajustes ?? {}) as Record<string, string>;
  const errors: Record<string, string> = {};
  const personas = typeof record.personas === 'string' && /^\d{1,4}$/.test(record.personas.trim()) ? Number(record.personas) : null;
  if (personas === null || personas < 1 || personas > 5000) errors.n = 'Escribe un número entero de personas entre 1 y 5000.';
  const known = new Map(QUOTE_FIELDS.map((field) => [field.key, field]));
  for (const [key, value] of Object.entries(ajustes)) {
    const field = known.get(key);
    if (!field) errors[''] = 'El enlace tiene campos que ya no existen; restablece los valores.';
    else if (field.kind === 'active' ? !['0', '1'].includes(value) : field.kind !== 'intList' && !(field.optional && value === '') && !NUMBER.test(value)) errors[key] = 'Escribe un número.';
  }
  const f = Number((ajustes['p.tradicional.f'] ?? '100').replace(',', '.'));
  const b = Number((ajustes['p.tradicional.b'] ?? '120').replace(',', '.'));
  if (!errors['p.tradicional.f'] && f >= b) errors['p.tradicional.f'] = `Tarifa del paquete "Tradicional": el piso F (${String(f)}) debe ser menor que la tarifa en la referencia b (${String(b)}).`;
  if (Object.keys(errors).length > 0 || personas === null) return fail(ctx, 422, 'VALIDATION_FAILED', 'Revisa los campos marcados: no se calculó nada.', errors);

  const packages = packagesFor(personas, ajustes);
  ctx.body = {
    result: {
      personas,
      belowMinimum: personas < Number(ajustes['po.min'] ?? 30),
      minPersonas: Number(ajustes['po.min'] ?? 30),
      modified: Object.keys(ajustes),
      packages,
      matrix: {
        rows: [30, 60, 100],
        packages: packages.map(({ id, name }) => ({ id, name, cells: [{ price: 145, marginPct: 30.2 }, { price: 134, marginPct: 44.9 }, null] })),
      },
    },
  };
  return undefined;
}
